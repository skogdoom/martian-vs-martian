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
  const images = new WeakMap();
  const colors = new WeakMap();
  const labels = new WeakMap();

  function texture(bounds, draw, { resolution = 2, sharedId = null } = {}) {
    if (disposed) throw new Error('Presentation has been disposed');
    if (sharedId !== null && shared.has(sharedId)) return shared.get(sharedId);
    const key = `${prefix}-${nextTexture++}`;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(bounds.width * resolution);
    canvas.height = Math.ceil(bounds.height * resolution);
    const context = canvas.getContext('2d');
    context.scale(resolution, resolution);
    context.translate(-bounds.x, -bounds.y);
    draw(context);
    const resource = scene.textures.addCanvas(key, canvas);
    if (!resource) throw new Error(`Cannot allocate texture ${key}`);
    const entry = { key, bounds, resolution, canvas, refs: 0, sharedId, variantId: null };
    entries.set(key, entry);
    if (sharedId !== null) shared.set(sharedId, entry);
    return entry;
  }

  function release(entry) {
    entry.refs--;
    if (entry.refs < 0) throw new Error(`Texture released twice: ${entry.key}`);
    if (entry.refs === 0 && entry.sharedId === null) {
      scene.textures.remove(entry.key);
      entries.delete(entry.key);
      if (entry.variantId) variants.delete(entry.variantId);
    }
  }

  function tinted(base, tint) {
    if (tint === 0xffffff) return base;
    const id = `${base.key}:${tint}`;
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
    const state = images.get(node);
    if (state) {
      const next = tinted(state.base, tint);
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
    });
    function active() {
      if (ended || disposed) throw new Error('Presentation scope has been disposed');
    }
    return {
      root,
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
      image(entry, parent = root) {
        active();
        if (!entries.has(entry.key)) throw new Error('Texture is no longer owned by this presentation');
        const image = scene.make.image({ key: entry.key, add: false });
        image
          .setOrigin((-entry.bounds.x * entry.resolution) / entry.canvas.width, (-entry.bounds.y * entry.resolution) / entry.canvas.height)
          .setScale(1 / entry.resolution);
        entry.refs++;
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
      attach(parent, child, index) {
        active();
        return attach(parent, child, index);
      },
      tint(node, color) {
        active();
        colors.set(node, color);
        applyTint(node);
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
      disposed = true;
    },
  };
}
