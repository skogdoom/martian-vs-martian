// Each paint operation is its own texture-backed Phaser Image. Keeping fills
// and strokes separate preserves per-shape blending when a parent fades.
import * as shapes from './shapes.js';

export function createDrawing(scope, store, id, parent) {
  let next = 0;
  function paint(bounds, render, style) {
    // Canvas' default miter limit is ten half-widths. Include it so sharp
    // corners and negative-coordinate scenery cannot be cut off when baked.
    const pad = 2 + (style.stroke === undefined ? 0 : ((style.width ?? 1) / 2) * (style.join === 'round' || style.join === 'bevel' ? 1 : 10));
    const area = {
      x: Math.floor(bounds.x - pad),
      y: Math.floor(bounds.y - pad),
      width: Math.ceil(bounds.x + bounds.width + pad) - Math.floor(bounds.x - pad),
      height: Math.ceil(bounds.y + bounds.height + pad) - Math.floor(bounds.y - pad),
    };
    for (const operation of ['fill', 'stroke']) {
      if (style[operation] === undefined) continue;
      const options = { ...style, fill: undefined, stroke: undefined, [operation]: style[operation] };
      // Cover the gallery's 2x artwork at DPR 2 without magnifying the baked
      // antialiasing fringe. Text independently retains its original 2x density.
      const entry = store.shared(`${id}:${next++}`, area, (context) => render(context, options), 4);
      scope.image(entry, parent);
    }
  }
  function bounds(points) {
    const xs = points.filter((_, index) => index % 2 === 0);
    const ys = points.filter((_, index) => index % 2 === 1);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  }
  return {
    ellipse(x, y, rx, ry, style) {
      paint({ x: x - rx, y: y - ry, width: rx * 2, height: ry * 2 }, (ctx, options) => shapes.ellipse(ctx, x, y, rx, ry, options), style);
    },
    circle(x, y, radius, style) {
      this.ellipse(x, y, radius, radius, style);
    },
    rect(x, y, width, height, style) {
      paint({ x, y, width, height }, (ctx, options) => shapes.rect(ctx, x, y, width, height, options), style);
    },
    roundRect(x, y, width, height, radius, style) {
      paint({ x, y, width, height }, (ctx, options) => shapes.roundRect(ctx, x, y, width, height, radius, options), style);
    },
    polygon(points, style) {
      paint(bounds(points), (ctx, options) => shapes.polygon(ctx, points, options), style);
    },
    star(x, y, points, outer, inner, style, rotation = 0) {
      this.polygon(shapes.starPoints(x, y, points, outer, inner, rotation), style);
    },
    curve(commands, style) {
      const points = commands.flatMap((command) => command.slice(1));
      paint(
        bounds(points),
        (ctx, options) =>
          shapes.path(
            ctx,
            (path) => {
              for (const [method, ...values] of commands) path[method](...values);
            },
            options,
          ),
        style,
      );
    },
  };
}
