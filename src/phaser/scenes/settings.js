// Settings, from the title screen: the same sound, full screen and 16:9
// items as the pause menu. Esc or "Back" returns to the title screen.

import { withSceneScope } from './scope.js';
import { WIDTH } from '../../config.js';
import { wasPressed, padSeenYet } from '../input.js';
import { createBackdrop } from '../render/backdrop.js';
import { centerUi, dimmer } from '../render/uiLayer.js';
import { createMenu, settingsItems } from '../render/menu.js';
import { label } from '../render/text.js';
import { createTitleScene } from './title.js';

export function createSettingsScene(game, session) {
  return withSceneScope(game, (art, scope) => {
    const view = scope.root;
    const backdrop = createBackdrop(art);
    art.add(view, backdrop.view);
    art.add(view, dimmer(art, 0.6));

    const title = label(art, 'SETTINGS', { size: 72, color: 0xffffff, bold: true, anchorX: 0.5, anchorY: 0.5 });
    title.setPosition(WIDTH / 2, 190);
    const menu = createMenu(art, {
      active: () => t >= 0.2,
      y0: 300,
      items: [...settingsItems(session), { id: 'back', text: () => 'BACK' }],
    });
    const help = label(art, '', { size: 16, color: 0x8a93c0, anchorX: 0.5, anchorY: 0.5 });
    help.setPosition(WIDTH / 2, 540);
    const note = label(art, '"16:9: YES" keeps the game area 16:9 (black bars on a taller window).\n"NO" lets it use the whole height.', {
      size: 14,
      color: 0x8a93c0,
      anchorX: 0.5,
      anchorY: 0.5,
    });
    note.setPosition(WIDTH / 2, 600);
    art.add(view, title, menu.view, help, note);
    const centered = centerUi(art, view, 2);

    let t = 0;
    return {
      view,
      kind: 'settings',
      destroy() {
        menu.dispose();
      },
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
  });
}
