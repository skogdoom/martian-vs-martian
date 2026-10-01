import { Text } from 'pixi.js';

/** Monospace label. Rendered at 2x so it stays crisp when the stage is scaled up. */
export function label(text, { size = 18, color = 0xffffff, bold = false, anchorX = 0, anchorY = 0 } = {}) {
  const t = new Text({
    text,
    resolution: 2,
    style: { fill: color, fontFamily: 'monospace', fontSize: size, fontWeight: bold ? 'bold' : 'normal' },
  });
  t.anchor.set(anchorX, anchorY);
  return t;
}

/** Options for destroying a view for good. Pixi only frees a Graphics'
 * drawing data on destroy() without options or with `context: true`, and a
 * Text's style only with `style: true`; a tree destroyed with just
 * `{ children: true }` leaks every shape and text style in it. */
export const DESTROY_ALL = { children: true, context: true, style: true };
