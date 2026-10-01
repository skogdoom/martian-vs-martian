// How the 1280x720 game area fills the screen.
//
// The width is always 1280 logical px. A window that is taller than 16:9 gets
// extra height instead of black bars: up to MAX_EXTRA more logical px, so the
// game uses the whole height of the screen. In the arena (the play and
// round-end scenes) the ground stays at the bottom and the extra is more sky,
// which saucers can fly into. The menu scenes sit in the middle of the
// taller area, with the scenery stretched to fill it.

import { HEIGHT, WIDTH } from './config.js';

export const MAX_EXTRA = 360; // up to 1280x1080 logical px, 4:3.4
export const PAD = 400; // scenery is drawn this far above and below the design area

export const layout = {
  extra: 0, // logical px of height beyond HEIGHT that the window shows
};

/**
 * Work out the layout for a window of w x h pixels.
 * Returns the scale, the visible logical height and where to put the root.
 */
export function fitWindow(w, h) {
  const scale = Math.min(w / WIDTH, h / HEIGHT);
  const visible = Math.min(h / scale, HEIGHT + MAX_EXTRA);
  layout.extra = visible - HEIGHT;
  return {
    scale,
    visible,
    x: Math.round((w - WIDTH * scale) / 2),
    y: Math.round((h - visible * scale) / 2),
  };
}

/** How far down the scene's origin sits: all the extra for the arena, half of it for menus. */
export function sceneShift(align) {
  return align === 'bottom' ? layout.extra : layout.extra / 2;
}
