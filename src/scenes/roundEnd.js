// Round result, drawn over the frozen field. Moves on by itself, or on a key.

import { Container, Graphics } from 'pixi.js';
import { WIDTH, HEIGHT, ROUND } from '../config.js';
import { anyPressed } from '../input.js';
import { COLORS } from '../render/backdrop.js';
import { label } from '../render/text.js';
import { createPlayScene } from './play.js';
import { createTallyScene } from './tally.js';

const NAMES = { red: 'RED', blue: 'BLUE' };

export function createRoundEndScene(game, session, { number, points, result, outcome, background }) {
  const { match } = session;
  const view = new Container();
  if (background) view.addChild(background);
  view.addChild(new Graphics().rect(0, 0, WIDTH, HEIGHT).fill({ color: 0x000000, alpha: 0.6 }));

  const cx = WIDTH / 2;
  const lines = [];
  const add = (text, opts, y) => {
    const t = label(text, { anchorX: 0.5, anchorY: 0.5, ...opts });
    t.position.set(cx, y);
    view.addChild(t);
    lines.push(t);
    return t;
  };

  add(`ROUND ${number}`, { size: 28, color: 0xcfd6ff, bold: true }, 170);

  const red = label(`RED ${points.red}`, { size: 56, color: COLORS.red, bold: true, anchorX: 1, anchorY: 0.5 });
  const dash = label('–', { size: 56, color: 0xffffff, anchorX: 0.5, anchorY: 0.5 });
  const blue = label(`${points.blue} BLUE`, { size: 56, color: COLORS.blue, bold: true, anchorX: 0, anchorY: 0.5 });
  red.position.set(cx - 30, 250);
  dash.position.set(cx, 250);
  blue.position.set(cx + 30, 250);
  view.addChild(red, dash, blue);

  if (result === 'tie') add('TIE — NO ONE TAKES THE ROUND', { size: 30, bold: true }, 330);
  else add(`${NAMES[result]} WINS THE ROUND`, { size: 30, color: COLORS[result], bold: true }, 330);

  add(`ROUND WINS  RED ${match.wins.red} – ${match.wins.blue} BLUE`, { size: 22, color: 0xffd76a }, 390);

  if (outcome === 'over') {
    add(`${NAMES[match.winner]} WINS THE MATCH!`, { size: 36, color: COLORS[match.winner], bold: true }, 450);
  } else if (outcome === 'extended') {
    add(`ALL SQUARE — TWO MORE ROUNDS (BEST OF ${match.scheduled})`, { size: 22, color: 0xffffff }, 450);
  }

  const prompt = add('', { size: 16, color: 0xcfd6ff }, 530);

  let t = 0;
  return {
    view,
    update(dt) {
      t += dt;
      if (t >= ROUND.resultTime || (t > 1 && anyPressed())) {
        if (match.over) game.go(createTallyScene, session);
        else game.go(createPlayScene, session);
      }
    },
    render() {
      const next = match.over ? 'tally' : `round ${number + 1}`;
      prompt.text = t > 1 ? `Press any key for ${next}` : '';
    },
  };
}
