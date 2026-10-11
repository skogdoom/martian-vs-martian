import { WIDTH, HEIGHT } from '../config.js';
import { menuLift, PAD } from '../layout.js';

export function dimmer(scope, alpha, parent = scope.root) {
  return scope
    .graphics(parent)
    .fillStyle(0x000000, alpha)
    .fillRect(0, -PAD, WIDTH, HEIGHT + 2 * PAD);
}

export function centerUi(scope, view, first) {
  const ui = scope.container(view);
  for (const child of view.list.slice(first, -1)) scope.attach(ui, child);
  return {
    ui,
    sync() {
      ui.y = menuLift();
    },
  };
}
