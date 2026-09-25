// HUD: per-player score, round wins and ammo in the top corners; timer in the middle.

import { Container, Graphics } from 'pixi.js';
import { WIDTH, COMBAT } from '../config.js';
import { SIDES } from '../logic/world.js';
import { reloadProgress } from '../logic/weapon.js';
import { scores } from '../logic/scoring.js';
import { COLORS } from './backdrop.js';
import { label } from './text.js';

const PANEL_W = 180;
const MARGIN = 16;

function createPanel(side) {
  const view = new Container();
  const left = side === 'red';
  view.position.set(left ? MARGIN : WIDTH - MARGIN - PANEL_W, MARGIN);

  const name = label(side.toUpperCase(), { size: 18, color: COLORS[side], bold: true, anchorX: left ? 0 : 1 });
  name.x = left ? 0 : PANEL_W;
  const ammo = label('', { size: 14, color: 0xcfd6ff, anchorX: left ? 0 : 1 });
  ammo.position.set(left ? 0 : PANEL_W, 48);
  const score = label('0', { size: 34, color: 0xffffff, bold: true, anchorX: left ? 1 : 0 });
  score.x = left ? PANEL_W : 0;
  const wins = label('', { size: 14, color: 0xffd76a, anchorX: left ? 0 : 1 });
  wins.position.set(left ? 0 : PANEL_W, 80);
  const pips = new Graphics();
  view.addChild(name, score, pips, ammo, wins);

  return {
    view,
    sync(weapon, points, roundWins) {
      score.text = String(points);
      wins.text = `WINS ${'★'.repeat(roundWins) || '-'}`;
      ammo.text = `AMMO ${weapon.ammo}`;
      pips.clear();
      const r = 7;
      const gap = 20;
      for (let i = 0; i < COMBAT.clipSize; i++) {
        const cx = left ? r + i * gap : PANEL_W - r - i * gap;
        if (i < weapon.clip) pips.circle(cx, 34, r).fill(COLORS[side]);
        else pips.circle(cx, 34, r).stroke({ color: COLORS[side], width: 2, alpha: 0.5 });
      }
      const progress = reloadProgress(weapon);
      if (progress !== null) {
        const w = COMBAT.clipSize * gap;
        const x = left ? 0 : PANEL_W - w;
        pips.rect(x, 68, w, 4).fill({ color: 0xffffff, alpha: 0.2 });
        pips.rect(left ? x : x + w * (1 - progress), 68, w * progress, 4).fill(0xffffff);
      }
    },
  };
}

export function createHud() {
  const view = new Container();
  const panels = {};
  for (const side of SIDES) {
    panels[side] = createPanel(side);
    view.addChild(panels[side].view);
  }
  const timer = label('', { size: 40, color: 0xffffff, bold: true, anchorX: 0.5 });
  timer.position.set(WIDTH / 2, MARGIN - 4);
  const roundInfo = label('', { size: 14, color: 0xcfd6ff, anchorX: 0.5 });
  roundInfo.position.set(WIDTH / 2, MARGIN + 44);
  view.addChild(timer, roundInfo);

  return {
    view,
    sync(world, { timeLeft, match }) {
      const points = scores(world.animals);
      for (const side of SIDES) panels[side].sync(world.weapons[side], points[side], match.wins[side]);
      const secs = Math.ceil(timeLeft - 1e-9);
      timer.text = String(secs);
      const color = secs <= 10 ? 0xff6a6a : 0xffffff;
      if (timer.tint !== color) timer.tint = color;
      roundInfo.text = `ROUND ${match.results.length + 1} · BEST OF ${match.scheduled}`;
    },
  };
}
