// Menu text sits in the middle of the screen even when the window is taller
// than 16:9, while the scenery (ground, sky, herd) stays put at the bottom
// like in a round. A scene calls `centerUi(view, first)` once it is built:
// every child of `view` from index `first` on moves into a layer that is
// lifted by half the extra height, and `sync()` keeps it there on resizes.

import { Container, Graphics } from 'pixi.js';
import { WIDTH, HEIGHT } from '../config.js';
import { menuLift, PAD } from '../layout.js';

/** A black veil over the whole scene, however tall the screen, to put text on. */
export function dimmer(alpha) {
  return new Graphics().rect(0, -PAD, WIDTH, HEIGHT + 2 * PAD).fill({ color: 0x000000, alpha });
}

export function centerUi(view, first) {
  const ui = new Container();
  for (const child of view.children.slice(first)) ui.addChild(child);
  view.addChild(ui);
  return {
    ui,
    sync() {
      ui.y = menuLift();
    },
  };
}
