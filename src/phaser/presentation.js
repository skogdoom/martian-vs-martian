// Focused Phaser construction and ownership. No Pixi API emulation.
import { colorCss, multiplyColor } from './shapes.js';

let nextStore = 0;

export function createPresentation(scene) {
  const prefix = `mvm-${nextStore++}`;
  let nextTexture = 0;
  let disposed = false;
  const entries = new Map();
  const shared = new Map();
  const variants = new Map();
  const cached = new Map();
  const pending = new Set();
  // Reuse blink/animation recipes across frames without retaining a whole round.
  const idle = new Map();
  const idleLimit = 64;
  const idleByteLimit = 4 * 1024 * 1024;
  let idleBytes = 0;
  const bytes = (entry) => entry.canvas.width * entry.canvas.height * 4;
  const images = new WeakMap();
  const atlasImages = new WeakMap();
  const colors = new WeakMap();
  const labels = new WeakMap();

  function texture(bounds, draw, { resolution = 2, sharedId = null, imageSmoothingQuality = null, cacheKey = null } = {}) {
    if (disposed) throw new Error('Presentation has been disposed');
    if (sharedId !== null && shared.has(sharedId)) return shared.get(sharedId);
    if (cacheKey !== null && cached.has(cacheKey)) return cached.get(cacheKey);
    const key = `${prefix}-${nextTexture++}`;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(bounds.width * resolution);
    canvas.height = Math.ceil(bounds.height * resolution);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.scale(resolution, resolution);
    context.translate(-bounds.x, -bounds.y);
    draw(context);
    // Immutable artwork needs a canvas source, not CanvasTexture's unused
    // getImageData / pixel-array copy. Mutable private bitmaps keep that API.
    const resource = cacheKey !== null || sharedId !== null ? scene.textures.addImage(key, canvas) : scene.textures.addCanvas(key, canvas);
    if (!resource) throw new Error(`Cannot allocate texture ${key}`);
    const entry = { key, bounds, resolution, canvas, refs: 0, sharedId, variantId: null, revision: 0, imageSmoothingQuality, cacheKey };
    entries.set(key, entry);
    if (sharedId !== null) shared.set(sharedId, entry);
    if (cacheKey !== null) cached.set(cacheKey, entry);
    return entry;
  }

  function activate(entry) {
    pending.delete(entry);
    if (idle.delete(entry)) idleBytes -= bytes(entry);
  }
  function remove(entry) {
    activate(entry);
    scene.textures.remove(entry.key);
    entries.delete(entry.key);
    pending.delete(entry);
    if (entry.variantId) variants.delete(entry.variantId);
    if (entry.cacheKey !== null && cached.get(entry.cacheKey) === entry) cached.delete(entry.cacheKey);
  }
  function flush(force = false) {
    for (const entry of pending) {
      if (entry.refs !== 0) continue;
      if (force || bytes(entry) > idleByteLimit) remove(entry);
      else if (!idle.has(entry)) {
        idle.set(entry, true);
        idleBytes += bytes(entry);
      }
    }
    pending.clear();
    while (idle.size && (force || idle.size > idleLimit || idleBytes > idleByteLimit)) remove(idle.keys().next().value);
  }
  const postrender = () => flush();
  scene.game.events.on('postrender', postrender);
  function release(entry, defer = false) {
    entry.refs--;
    if (entry.refs < 0) throw new Error(`Texture released twice: ${entry.key}`);
    if (entry.refs === 0 && entry.sharedId === null) {
      // Keep a displaced recipe through this frame: another particle slot may
      // need it later in the same render. Destroyed views release immediately.
      if (defer && entry.cacheKey !== null) pending.add(entry);
      else remove(entry);
    }
  }
  function tinted(base, tint) {
    if (tint === 0xffffff) return base;
    const id = `${base.key}:${base.revision}:${tint}`;
    if (variants.has(id)) return variants.get(id);
    const entry = texture(
      base.bounds,
      (context) => {
        // Restore pixel coordinates: multiplication preserves alpha and works in
        // Canvas as well as WebGL. Native Phaser setTint is WebGL-only.
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.drawImage(base.canvas, 0, 0);
        const pixels = context.getImageData(0, 0, base.canvas.width, base.canvas.height);
        const factors = [(tint >> 16) & 255, (tint >> 8) & 255, tint & 255];
        for (let i = 0; i < pixels.data.length; i += 4) {
          for (let channel = 0; channel < 3; channel++) pixels.data[i + channel] = Math.round((pixels.data[i + channel] * factors[channel]) / 255);
        }
        context.putImageData(pixels, 0, 0);
      },
      { resolution: base.resolution },
    );
    entry.variantId = id;
    variants.set(id, entry);
    return entry;
  }

  function inheritedTint(node) {
    let tint = 0xffffff;
    for (let parent = node.parentContainer; parent; parent = parent.parentContainer) tint = multiplyColor(tint, colors.get(parent) ?? 0xffffff);
    return tint;
  }

  function applyTint(node, inherited = inheritedTint(node)) {
    const tint = multiplyColor(inherited, colors.get(node) ?? 0xffffff);
    const atlas = atlasImages.get(node);
    const state = images.get(node);
    if (atlas) {
      if (scene.game.renderer.gl) node.setTint(tint);
      else {
        // Canvas has no native Image tint. Cache a frame/color pair once, using
        // the same bounded recipe store as classic art; never edit the atlas.
        let next = null;
        if (tint !== 0xffffff) {
          const frame = scene.textures.getFrame(atlas.key, atlas.frame);
          next = texture(
            { x: 0, y: 0, width: frame.cutWidth, height: frame.cutHeight },
            (ctx) => {
              ctx.drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, frame.cutWidth, frame.cutHeight);
              const pixels = ctx.getImageData(0, 0, frame.cutWidth, frame.cutHeight);
              const factors = [(tint >> 16) & 255, (tint >> 8) & 255, tint & 255];
              for (let i = 0; i < pixels.data.length; i += 4)
                for (let c = 0; c < 3; c++) pixels.data[i + c] = Math.round((pixels.data[i + c] * factors[c]) / 255);
              ctx.putImageData(pixels, 0, 0);
            },
            { resolution: 1, cacheKey: `atlas:${atlas.key}:${atlas.frame}:${tint}` },
          );
        }
        if (next !== atlas.current) {
          if (next) {
            activate(next);
            next.refs++;
          }
          const previous = atlas.current;
          atlas.current = next;
          node.setTexture(next?.key ?? atlas.key, next ? undefined : atlas.frame);
          if (previous) release(previous, true);
        }
      }
    } else if (state) {
      const next = scene.game.renderer.gl ? state.base : tinted(state.base, tint);
      if (scene.game.renderer.gl) node.setTint(tint);
      else node.clearTint();
      if (next !== state.current) {
        if (next !== state.base) next.refs++;
        const previous = state.current;
        state.current = next;
        node.setTexture(next.key);
        if (previous !== state.base) release(previous);
      }
    } else if (labels.has(node)) {
      const color = colorCss(multiplyColor(labels.get(node), tint));
      if (node.style.color !== color) node.setColor(color);
    } else if (!node.list && tint !== 0xffffff) {
      throw new Error('Tint requires a managed image, label, or container');
    }
    for (const child of node.list ?? []) applyTint(child, tint);
  }

  function attach(parent, child, index) {
    child.parentContainer?.remove(child);
    child.removeFromDisplayList();
    if (index === undefined) parent.add(child);
    else parent.addAt(child, index);
    applyTint(child);
    return child;
  }

  function scope() {
    if (disposed) throw new Error('Presentation has been disposed');
    const root = scene.make.container({ add: false });
    let ended = false;
    root.once('destroy', () => {
      ended = true;
      flush(true);
    });
    function active() {
      if (ended || disposed) throw new Error('Presentation scope has been disposed');
    }
    return {
      root,
      webgl: Boolean(scene.game.renderer.gl),
      get disposed() {
        return ended;
      },
      container(parent = root) {
        active();
        return attach(parent, scene.make.container({ add: false }));
      },
      graphics(parent = root) {
        active();
        return attach(parent, scene.make.graphics({ add: false }));
      },
      atlasImage(key, frame, parent = root) {
        active();
        if (!scene.textures.getFrame(key, frame)) throw new Error(`Missing atlas frame ${key}/${frame}`);
        const image = scene.make.image({ key, frame, add: false });
        const state = { key, frame, current: null };
        atlasImages.set(image, state);
        image.once('destroy', () => {
          if (state.current) release(state.current);
        });
        return attach(parent, image);
      },
      atlasFrame(image, frame, key) {
        active();
        const state = atlasImages.get(image);
        if (!state) throw new Error('Frame changes require a managed atlas image');
        key ??= state.key;
        if (state.frame === frame && state.key === key) return;
        if (!scene.textures.getFrame(key, frame)) throw new Error(`Missing atlas frame ${key}/${frame}`);
        state.key = key;
        state.frame = frame;
        image.setTexture(state.key, frame);
        applyTint(image);
      },
      image(entry, parent = root) {
        active();
        if (!entries.has(entry.key)) throw new Error('Texture is no longer owned by this presentation');
        const image = scene.make.image({ key: entry.key, add: false });
        image
          .setOrigin((-entry.bounds.x * entry.resolution) / entry.canvas.width, (-entry.bounds.y * entry.resolution) / entry.canvas.height)
          .setScale(1 / entry.resolution);
        activate(entry);
        entry.refs++;
        if (entry.imageSmoothingQuality) {
          const nativeRender = image.renderCanvas;
          const quality = entry.imageSmoothingQuality;
          // A supersampled mask needs area filtering when it shrinks in Canvas.
          // Scope this setting to paint images; text and other page graphics keep
          // their original sampling. WebGL still uses the native Image renderer.
          image.renderCanvas = function (renderer, ...args) {
            const context = renderer.currentContext;
            const previous = context.imageSmoothingQuality;
            context.imageSmoothingQuality = quality;
            try {
              return nativeRender.call(this, renderer, ...args);
            } finally {
              context.imageSmoothingQuality = previous;
            }
          };
        }
        const state = { base: entry, current: entry };
        images.set(image, state);
        image.once('destroy', () => {
          if (state.current !== state.base) release(state.current);
          release(state.base);
        });
        return attach(parent, image);
      },
      label(value, { size = 18, color = 0xffffff, bold = false, anchorX = 0, anchorY = 0, align = 'left' } = {}, parent = root) {
        active();
        const measurement = document.createElement('canvas').getContext('2d');
        measurement.font = `${bold ? 'bold' : 'normal'} ${size}px monospace`;
        const metrics = measurement.measureText('|ÉqÅM');
        const ascent = metrics.actualBoundingBoxAscent;
        const descent = metrics.actualBoundingBoxDescent;
        const label = scene.make.text({
          text: value,
          style: {
            fontFamily: 'monospace',
            fontSize: `${size}px`,
            fontStyle: bold ? 'bold' : '',
            color: colorCss(color),
            align,
            resolution: 2,
            metrics: { ascent, descent, fontSize: ascent + descent },
          },
          add: false,
        });
        label.setOrigin(anchorX, anchorY);
        labels.set(label, color);
        return attach(parent, label);
      },
      bitmap(bounds, draw, options, parent = root) {
        active();
        return this.image(texture(bounds, draw, options), parent);
      },
      repaint(image, bounds, draw, { resolution = 2, cacheKey = null } = {}) {
        active();
        const state = images.get(image);
        const entry = state?.base;
        if (!entry || entry.sharedId !== null || (cacheKey === null && (entry.refs !== 1 || entry.cacheKey !== null)))
          throw new Error('Repaint requires an exclusively owned bitmap');
        if (cacheKey !== null) {
          const replacement = texture(bounds, draw, { resolution, cacheKey, imageSmoothingQuality: entry.imageSmoothingQuality });
          activate(replacement);
          replacement.refs++;
          const old = state.base;
          const current = state.current;
          state.base = state.current = replacement;
          image.setTexture(replacement.key);
          if (current !== old) release(current);
          release(old, true);
        } else {
          entry.bounds = bounds;
          entry.resolution = resolution;
          entry.revision++;
          const resource = scene.textures.get(entry.key);
          // setSize uploads a blank resized canvas. Defer that upload until
          // drawing has finished, while retaining its native size/frame updates.
          const refresh = resource.refresh;
          resource.refresh = () => resource;
          try {
            resource.setSize(Math.ceil(bounds.width * resolution), Math.ceil(bounds.height * resolution));
          } finally {
            resource.refresh = refresh;
          }
          const context = entry.canvas.getContext('2d');
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.clearRect(0, 0, entry.canvas.width, entry.canvas.height);
          context.scale(resolution, resolution);
          context.translate(-bounds.x, -bounds.y);
          draw(context);
          resource.refresh();
        }
        applyTint(image);
        const base = state.base;
        image
          .setTexture(state.current.key)
          .setOrigin((-bounds.x * resolution) / base.canvas.width, (-bounds.y * resolution) / base.canvas.height)
          .setScale(1 / resolution);
      },
      attach(parent, child, index) {
        active();
        return attach(parent, child, index);
      },
      tint(node, color) {
        active();
        colors.set(node, color);
        applyTint(node);
      },
      color(node) {
        return colors.get(node) ?? 0xffffff;
      },
      dispose() {
        if (!ended) root.destroy();
      },
    };
  }

  return {
    scope,
    shared(id, bounds, draw, resolution = 2) {
      return texture(bounds, draw, { sharedId: id, resolution });
    },
    get metrics() {
      return {
        cachedRecipes: cached.size,
        pendingRecipes: pending.size,
        retainedRecipes: idle.size,
        retainedRgbaBytes: idleBytes,
        canvasRgbaBytes: [...entries.values()].reduce((sum, e) => sum + e.canvas.width * e.canvas.height * 4, 0),
      };
    },
    get stats() {
      return {
        textures: entries.size,
        shared: shared.size,
        variants: variants.size,
        references: [...entries.values()].reduce((sum, entry) => sum + entry.refs, 0),
      };
    },
    dispose() {
      if (disposed) return;
      const live = [...entries.values()].filter((entry) => entry.refs > 0);
      if (live.length) throw new Error('Destroy presentation views before their texture store');
      for (const entry of entries.values()) scene.textures.remove(entry.key);
      entries.clear();
      shared.clear();
      variants.clear();
      cached.clear();
      pending.clear();
      idle.clear();
      idleBytes = 0;
      scene.game.events.off('postrender', postrender);
      disposed = true;
    },
  };
}
