// Settings, from the title screen: the same sound, full screen and 16:9
// items as the pause menu. Esc or "Back" returns to the title screen.

import { Container, Graphics } from 'pixi.js';
import { WIDTH } from '../config.js';
import { PAD } from '../layout.js';
import { wasPressed, padSeenYet } from '../input.js';
import { createBackdrop } from '../render/backdrop.js';
import { centerUi } from '../render/uiLayer.js';
import { createMenu, settingsItems } from '../render/menu.js';
import { label } from '../render/text.js';
import { createTitleScene } from './title.js';

export function createSettingsScene(game, session) {
  const view = new Container();
  const backdrop = createBackdrop();
  view.addChild(backdrop.view);
  view.addChild(new Graphics().rect(0, -PAD, WIDTH, 720 + 2 * PAD).fill({ color: 0x000000, alpha: 0.6 }));

  const title = label('SETTINGS', { size: 72, color: 0xffffff, bold: true, anchorX: 0.5, anchorY: 0.5 });
  title.position.set(WIDTH / 2, 190);
  const menu = createMenu({
    y0: 300,
    items: [...settingsItems(session), { id: 'back', text: () => 'BACK' }],
  });
  const help = label('', { size: 16, color: 0x8a93c0, anchorX: 0.5, anchorY: 0.5 });
  help.position.set(WIDTH / 2, 540);
  const note = label('"16:9: YES" keeps the game area 16:9 (black bars on a taller window).\n"NO" lets it use the whole height.', {
    size: 14,
    color: 0x8a93c0,
    anchorX: 0.5,
    anchorY: 0.5,
  });
  note.position.set(WIDTH / 2, 600);
  view.addChild(title, menu.view, help, note);
  const centered = centerUi(view, 2);

  let t = 0;
  return {
    view,
    update(dt) {
      t += dt;
      if (t < 0.2) return; // the press that opened this screen
      const id = menu.selected();
      help.text = padSeenYet() ? '↑ ↓ choose   ENTER / A: select   ESC: back' : '↑ ↓ choose   ENTER or SPACE: select   ESC: back';
      if (id === 'back' || wasPressed('Escape')) game.go(createTitleScene, session);
    },
    render() {
      centered.sync();
      backdrop.tick(t);
    },
  };
}
