// Native Phaser containers and owned paint images for the procedural artwork.
// Paint slots survive clear/redraw; unchanged recipes never upload again. Each
// fill/stroke has its own alpha, preserving blending when its parent fades.
import * as shapes from './shapes.js';
import { createRng } from '../logic/rng.js';

export function createArt(scope, { random = createRng(crypto.getRandomValues(new Uint32Array(1))[0]), audit = false } = {}) {
  const painters = new WeakMap();
  let uploads = 0;
  const art = {
    scope,
    random,
    isDrawing: (view) => painters.has(view),
    recipes: (view) => painters.get(view)?.recipes ?? [],
    container: () => scope.container(),
    graphics(recipe) {
      const view = scope.container();
      const painter = createPainter(view);
      painters.set(view, painter);
      recipe?.(painter);
      return view;
    },
    draw(view) {
      const painter = painters.get(view);
      if (!painter) throw new Error('Drawing requires an artwork paint container');
      return painter;
    },
    add(parent, ...children) {
      for (const child of children) scope.attach(parent, child);
    },
    addAt(parent, child, index) {
      scope.attach(parent, child, index);
    },
    tint: (view, color) => scope.tint(view, color),
    color: (view) => scope.color(view),
    label: (text, options) => scope.label(text, options),
    get uploads() {
      return uploads;
    },
  };

  function createPainter(view) {
    const slots = [];
    const recipes = [];
    let next = 0;
    view.once('destroy', () => (slots.length = 0));
    function paint(kind, values, bounds, style) {
      if (audit) recipes[next] = { kind, values, style };
      // A solid rectangle is one procedural color pixel stretched by its native
      // Image transform. A padded 1280x1520 background otherwise needs a 4096²
      // canvas even though every pixel has the same color. Changing bar/beam
      // dimensions now reuses the texture, just like changing position or alpha.
      const solidRect = kind === 'rect' && style.stroke === undefined;
      // Explicit padding includes negative coordinates and the miter limit.
      const pad = 2 + (style.stroke === undefined ? 0 : ((style.width ?? 1) / 2) * (['round', 'bevel'].includes(style.join) ? 1 : 10));
      const area = solidRect
        ? { x: 0, y: 0, width: 1, height: 1 }
        : { x: 0, y: 0, width: Math.ceil(bounds.width + 2 * pad - 1e-9), height: Math.ceil(bounds.height + 2 * pad - 1e-9) };
      const x = bounds.x - pad;
      const y = bounds.y - pad;
      // Translation and alpha are native Image properties. Cosmetic motion
      // therefore does not rebake a circle, rectangle or an unchanged path.
      const options = { ...style, alpha: 1 };
      const local = solidRect
        ? [0, 0, 1, 1]
        : kind === 'polygon'
          ? [values[0].map((v, i) => v - (i % 2 ? y : x))]
          : kind === 'curve'
            ? [values[0].map(([method, ...coords]) => [method, ...coords.map((v, i) => v - (i % 2 ? y : x))])]
            : [values[0] - x, values[1] - y, ...values.slice(2)];
      // Limit large sky/beam textures while retaining 4x sampling for small art.
      const resolution = solidRect ? 1 : Math.min(4, 4096 / Math.max(area.width, area.height));
      // Power-of-two canvases let Phaser generate mip levels. Without them,
      // minification point-samples a supersampled mask and can lose tiny stars
      // or snowflakes even though their geometry is correct. Extra pixels stay
      // transparent and do not change the logical recipe or its origin.
      area.width = 2 ** Math.ceil(Math.log2(Math.ceil(area.width * resolution))) / resolution;
      area.height = 2 ** Math.ceil(Math.log2(Math.ceil(area.height * resolution))) / resolution;
      const signature = JSON.stringify([kind, local, options, area, resolution], (_key, value) =>
        typeof value === 'number' ? Math.round(value * 1e8) / 1e8 : value,
      );
      const render = (ctx) => {
        if (kind === 'curve')
          shapes.path(
            ctx,
            (path) => {
              for (const [method, ...coords] of local[0]) path[method](...coords);
            },
            options,
          );
        else shapes[kind](ctx, ...local, options);
      };
      let slot = slots[next];
      if (!slot) {
        const image = scope.bitmap(area, render, { resolution, imageSmoothingQuality: 'high' }, view);
        // Graphics can have children (the wolf's blood); paint precedes them.
        scope.attach(view, image, next);
        slot = { image, signature };
        slots.push(slot);
        uploads++;
      } else if (signature !== slot.signature) {
        scope.repaint(slot.image, area, render, { resolution });
        slot.signature = signature;
        uploads++;
      }
      slot.image
        .setPosition(solidRect ? values[0] : x, solidRect ? values[1] : y)
        .setScale(solidRect ? values[2] : 1 / resolution, solidRect ? values[3] : 1 / resolution)
        .setAlpha(style.alpha ?? 1)
        .setVisible(true);
      next++;
      return painter;
    }
    function pointBounds(points) {
      const xs = points.filter((_, i) => i % 2 === 0);
      const ys = points.filter((_, i) => i % 2 === 1);
      return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    }
    const painter = {
      recipes,
      clear() {
        next = 0;
        recipes.length = 0;
        for (const slot of slots) slot.image.visible = false;
        return this;
      },
      ellipse(x, y, rx, ry, style) {
        return paint('ellipse', [x, y, rx, ry], { x: x - rx, y: y - ry, width: rx * 2, height: ry * 2 }, style);
      },
      circle(x, y, r, style) {
        return this.ellipse(x, y, r, r, style);
      },
      rect(x, y, width, height, style) {
        return paint('rect', [x, y, width, height], { x, y, width, height }, style);
      },
      roundRect(x, y, width, height, r, style) {
        return paint('roundRect', [x, y, width, height, r], { x, y, width, height }, style);
      },
      polygon(points, style) {
        return paint('polygon', [points], pointBounds(points), style);
      },
      star(x, y, points, outer, inner, style, rotation = 0) {
        return this.polygon(shapes.starPoints(x, y, points, outer, inner, rotation), style);
      },
      curve(commands, style) {
        return paint('curve', [commands], pointBounds(commands.flatMap((command) => command.slice(1))), style);
      },
    };
    return painter;
  }
  return art;
}
