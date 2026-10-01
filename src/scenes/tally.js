// Tally: match wins and total cows and lambs across the session.
// "Play again" starts a new match and keeps the tally.

import { Container, Graphics } from 'pixi.js';
import { WIDTH } from '../config.js';
import { PAD } from '../layout.js';
import { centerUi } from '../render/uiLayer.js';
import { anyPressed, wasPressed } from '../input.js';
import { startMatch, sideName, modeName, rulesName } from '../session.js';
import { createTitleScene } from './title.js';
import { createBackdrop, COLORS } from '../render/backdrop.js';
import { label } from '../render/text.js';
import { createPlayScene } from './play.js';

export function createTallyScene(game, session) {
  const { match, tally } = session;
  const view = new Container();
  const backdrop = createBackdrop();
  view.addChild(backdrop.view);
  view.addChild(new Graphics().rect(-0, -PAD, WIDTH, 720 + 2 * PAD).fill({ color: 0x000000, alpha: 0.6 }));

  const cx = WIDTH / 2;
  const put = (t, x, y) => {
    t.position.set(x, y);
    view.addChild(t);
    return t;
  };

  if (match?.winner) {
    const name = sideName(session, match.winner);
    put(label(`${name} WINS THE MATCH`, { size: 48, color: COLORS[match.winner], bold: true, anchorX: 0.5 }), cx, 110);
  }
  put(label(`TALLY · ${modeName(session)}`, { size: 24, color: 0xcfd6ff, bold: true, anchorX: 0.5 }), cx, 190);

  put(label(rulesName(session), { size: 15, color: 0x8a93c0, anchorX: 0.5 }), cx, 220);

  const colX = { label: cx - 260, red: cx + 20, blue: cx + 220 };
  put(label(sideName(session, 'red'), { size: 26, color: COLORS.red, bold: true, anchorX: 0.5 }), colX.red, 250);
  put(label(sideName(session, 'blue'), { size: 26, color: COLORS.blue, bold: true, anchorX: 0.5 }), colX.blue, 250);

  const rows = [
    ['Match wins', tally.matchWins],
    ['Cows', tally.cows],
    ['Lambs', tally.lambs],
  ];
  rows.forEach(([name, values], i) => {
    const y = 305 + i * 50;
    put(label(name, { size: 24, color: 0xffffff }), colX.label, y);
    put(label(String(values.red), { size: 28, color: 0xffffff, bold: true, anchorX: 0.5 }), colX.red, y - 2);
    put(label(String(values.blue), { size: 28, color: 0xffffff, bold: true, anchorX: 0.5 }), colX.blue, y - 2);
  });

  const prompt = put(label('PRESS ANY KEY TO PLAY AGAIN', { size: 24, color: 0xffffff, bold: true, anchorX: 0.5 }), cx, 520);
  const note = put(label('ESC: back to the menu. The tally resets when the page is reloaded.', { size: 14, color: 0x8a93c0, anchorX: 0.5 }), cx, 560);

  const centered = centerUi(view, 2);

  let t = 0;
  return {
    view,
    update(dt) {
      t += dt;
      if (t <= 1.2) return;
      if (wasPressed('Escape')) game.go(createTitleScene, session);
      else if (anyPressed()) {
        startMatch(session);
        game.go(createPlayScene, session);
      }
    },
    render() {
      centered.sync();
      prompt.visible = note.visible = t > 1.2;
      prompt.alpha = 0.55 + 0.45 * Math.sin(t * 4);
    },
  };
}
