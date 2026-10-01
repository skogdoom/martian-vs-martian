// Menu text sits in the middle of the screen even when the window is taller
// than 16:9, while the scenery (ground, sky, herd) stays put at the bottom
// like in a round. A scene calls `centerUi(view, first)` once it is built:
// every child of `view` from index `first` on moves into a layer that is
// lifted by half the extra height, and `sync()` keeps it there on resizes.

import { Container } from 'pixi.js';
import { menuLift } from '../layout.js';

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
