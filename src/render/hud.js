// HUD: per-player score, round wins and ammo in the top corners; timer in the middle.

import { Container, Graphics } from 'pixi.js';
import { WIDTH, COMBAT, POWERUP } from '../config.js';
import { SIDES } from '../logic/world.js';
import { reloadProgress } from '../logic/weapon.js';
import { scores } from '../logic/scoring.js';
import { COLORS } from './backdrop.js';
import { label } from './text.js';
import { createPowerIcon, POWER_NAMES, POWER_COLOR } from './powerupView.js';

const PANEL_W = 180;
const MARGIN = 16;

function createPanel(side, title) {
  const view = new Container();
  const left = side === 'red';
  view.position.set(left ? MARGIN : WIDTH - MARGIN - PANEL_W, MARGIN);

  const name = label(title, { size: 18, color: COLORS[side], bold: true, anchorX: left ? 0 : 1 });
  name.x = left ? 0 : PANEL_W;
  const ammo = label('', { size: 14, color: 0xcfd6ff, anchorX: left ? 0 : 1 });
  ammo.position.set(left ? 0 : PANEL_W, 48);
  const score = label('0', { size: 34, color: 0xffffff, bold: true, anchorX: left ? 1 : 0 });
  score.x = left ? PANEL_W : 0;
  const wins = label('', { size: 14, color: 0xffd76a, anchorX: left ? 0 : 1 });
  wins.position.set(left ? 0 : PANEL_W, 80);
  const pips = new Graphics();
  view.addChild(name, score, pips, ammo, wins);

  // Active power-up: icon, name, seconds left and a draining bar.
  const power = new Container();
  power.y = 104;
  const powerName = label('', { size: 13, color: POWER_COLOR, bold: true, anchorX: left ? 0 : 1 });
  powerName.position.set(left ? 28 : PANEL_W - 28, 0);
  const powerBar = new Graphics();
  power.addChild(powerName, powerBar);
  view.addChild(power);
  let icon = null;
  let iconType = null;

  return {
    view,
    sync(weapon, points, roundWins, active) {
      score.text = String(points);
      wins.text = `WINS ${'★'.repeat(roundWins) || '-'}`;
      const unlimited = active?.type === 'laser' || active?.type === 'triple';
      ammo.text = unlimited ? 'AMMO ∞' : `AMMO ${weapon.ammo}`;

      power.visible = active !== null;
      if (active) {
        if (iconType !== active.type) {
          icon?.destroy({ children: true });
          icon = createPowerIcon(active.type, 11);
          icon.position.set(left ? 11 : PANEL_W - 11, 8);
          power.addChild(icon);
          iconType = active.type;
        }
        // Single-use power-ups (timeLeft null) wait for the shoot key.
        const timed = active.timeLeft !== null;
        powerName.text = timed ? `${POWER_NAMES[active.type]} ${Math.ceil(active.timeLeft)}` : `${POWER_NAMES[active.type]} ×1`;
        const w = 120;
        const f = timed ? Math.max(0, active.timeLeft / POWERUP.duration) : 1;
        const x = left ? 28 : PANEL_W - 28 - w;
        powerBar.clear();
        powerBar.rect(x, 18, w, 4).fill({ color: POWER_COLOR, alpha: 0.2 });
        powerBar.rect(left ? x : x + w * (1 - f), 18, w * f, 4).fill(POWER_COLOR);
        // Blink for the last three seconds.
        power.alpha = timed && active.timeLeft < 3 ? 0.55 + 0.45 * Math.sin(active.timeLeft * 18) : 1;
      }
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

/** `names` is how each side is labelled, e.g. { red: 'RED', blue: 'CPU' }. */
export function createHud(names = { red: 'RED', blue: 'BLUE' }) {
  const view = new Container();
  const panels = {};
  for (const side of SIDES) {
    panels[side] = createPanel(side, names[side]);
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
      for (const side of SIDES) panels[side].sync(world.weapons[side], points[side], match.wins[side], world.powers[side]);
      const secs = Math.ceil(timeLeft - 1e-9);
      timer.text = String(secs);
      const color = secs <= 10 ? 0xff6a6a : 0xffffff;
      if (timer.tint !== color) timer.tint = color;
      roundInfo.text = `ROUND ${match.results.length + 1} · BEST OF ${match.scheduled}`;
    },
  };
}
