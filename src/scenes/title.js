// Title screen with the menu: four rows.
//   up/down      move between mode (1 or 2 players), round length and rounds
//   left/right   change the value on the row: CPU difficulty, 60/90/120 s, best of 1/3/5/7
//   1 / 2        pick the mode directly
//   Enter/Space  start

import { Container, Graphics } from 'pixi.js';
import { WIDTH, HEIGHT } from '../config.js';
import { wasPressed, padSeenYet } from '../input.js';
import { audioUnlocked } from '../audio.js';
import { createHerd, updateAnimal } from '../logic/animal.js';
import { createRng } from '../logic/rng.js';
import { startMatch, DIFFICULTIES } from '../session.js';
import { LENGTHS, ROUNDS, step, saveOptions } from '../options.js';
import { createBackdrop, COLORS } from '../render/backdrop.js';
import { createAnimalView } from '../render/animalView.js';
import { createSaucerView } from '../render/saucerView.js';
import { label } from '../render/text.js';
import { createPlayScene } from './play.js';

const pressed = (...codes) => codes.some(wasPressed);

export function createTitleScene(game, session) {
  const view = new Container();
  const backdrop = createBackdrop();
  view.addChild(backdrop.view);

  // A grazing herd and two idling saucers behind the title.
  const rng = createRng();
  const herd = createHerd();
  const herdView = createAnimalView(herd);
  const saucers = { red: createSaucerView('red'), blue: createSaucerView('blue') };
  view.addChild(herdView.view, saucers.red.view, saucers.blue.view);
  view.addChild(new Graphics().rect(0, 0, WIDTH, HEIGHT).fill({ color: 0x000000, alpha: 0.25 }));

  const cx = WIDTH / 2;
  const red = label('MARTIAN', { size: 64, color: COLORS.red, bold: true, anchorX: 1, anchorY: 0.5 });
  const vs = label('vs', { size: 32, color: 0xffffff, anchorX: 0.5, anchorY: 0.5 });
  const blue = label('MARTIAN', { size: 64, color: COLORS.blue, bold: true, anchorX: 0, anchorY: 0.5 });
  red.position.set(cx - 40, 150);
  vs.position.set(cx, 150);
  blue.position.set(cx + 40, 150);

  // The rest is left for players to find out.
  // Left-aligned, with the block as a whole centred.
  const steps = ['Step 1: Abduct the animals.', 'Step 2: …?', 'Step 3: Profit!'].map((text) =>
    label(text, { size: 20, color: 0xcfd6ff, anchorX: 0 }),
  );
  const stepsLeft = cx - Math.max(...steps.map((l) => l.width)) / 2;
  steps.forEach((line, i) => line.position.set(stepsLeft, 198 + i * 27));

  const redKeys = label('', { size: 20, color: COLORS.red, anchorX: 0.5 });
  redKeys.position.set(cx - 220, 290);
  const blueKeys = label('', { size: 20, color: COLORS.blue, anchorX: 0.5 });
  blueKeys.position.set(cx + 220, 290);

  // The menu: four rows. Up/down moves between them, left/right changes a value.
  //   0  1 PLAYER vs CPU   difficulty
  //   1  2 PLAYERS
  //   2  round length
  //   3  number of rounds
  const rows = [0, 1, 2, 3].map((i) => {
    const l = label('', { size: 24, bold: true, anchorX: 0 });
    l.position.set(cx - 230, 392 + i * 31);
    return l;
  });
  let row = session.players === 1 ? 0 : 1;

  const prompt = label('ENTER OR SPACE TO START', { size: 22, color: 0xffffff, bold: true, anchorX: 0.5 });
  prompt.position.set(cx, 524);
  const help = label('↑ ↓  choose   ← →  change   M  sound   F  full screen   P / ESC  pause menu', {
    size: 14,
    color: 0x8a93c0,
    anchorX: 0.5,
  });
  help.position.set(cx, 556);
  // Shown once a controller has been used. Pad buttons can't start sound.
  const padHelp = label('', { size: 14, color: 0x6cff6c, anchorX: 0.5 });
  padHelp.position.set(cx, 576);

  view.addChild(red, vs, blue, ...steps, redKeys, blueKeys, ...rows, prompt, help, padHelp);

  function refreshMenu() {
    const solo = session.players === 1;
    const text = [
      `1 PLAYER  vs CPU   ◀ ${session.difficulty.toUpperCase()} ▶`,
      '2 PLAYERS',
      `ROUND LENGTH       ◀ ${session.length} s ▶`,
      `ROUNDS             ◀ BEST OF ${session.rounds} ▶`,
    ];
    rows.forEach((l, i) => {
      const mode = i < 2 && (i === 0) === solo; // the chosen game mode
      l.text = `${i === row ? '▶' : mode ? '•' : ' '} ${text[i]}`;
      l.alpha = i === row ? 1 : 0.5;
    });
    redKeys.text = solo
      ? 'YOU (RED)\nmove  WASD or ARROWS\nshoot SPACE or ENTER\n(drops what you carry)'
      : 'RED\nmove  W A S D\nshoot SPACE\n(drops what you carry)';
    blueKeys.text = solo ? `CPU (BLUE)\n${session.difficulty.toUpperCase()}` : 'BLUE\nmove  ARROWS\nshoot ENTER\n(drops what you carry)';
  }
  refreshMenu();

  let t = 0;
  return {
    view,
    update(dt) {
      t += dt;
      for (const a of herd) updateAnimal(a, dt, rng);
      if (t < 0.3) return;

      if (pressed('Digit1', 'Numpad1')) row = 0;
      if (pressed('Digit2', 'Numpad2')) row = 1;
      if (pressed('ArrowUp', 'KeyW', 'PadUp')) row = Math.max(0, row - 1);
      if (pressed('ArrowDown', 'KeyS', 'PadDown')) row = Math.min(rows.length - 1, row + 1);
      if (row < 2) session.players = row === 0 ? 1 : 2;
      const dir = (pressed('ArrowRight', 'KeyD', 'PadRight') ? 1 : 0) - (pressed('ArrowLeft', 'KeyA', 'PadLeft') ? 1 : 0);
      if (dir) {
        if (row === 0) session.difficulty = step(DIFFICULTIES, session.difficulty, dir);
        if (row === 2) session.length = step(LENGTHS, session.length, dir);
        if (row === 3) session.rounds = step(ROUNDS, session.rounds, dir);
        if (row >= 2) saveOptions({ length: session.length, rounds: session.rounds });
      }
      refreshMenu();
      padHelp.text = padSeenYet()
        ? 'CONTROLLER  stick or d-pad: move   A / trigger: shoot   A / Start: begin   Start: pause' +
          (audioUnlocked() ? '' : '\nthe sound starts after one key press or click')
        : '';

      if (pressed('Enter', 'Space', 'NumpadEnter', 'PadConfirm')) {
        startMatch(session);
        game.go(createPlayScene, session);
      }
    },
    render() {
      backdrop.tick(t);
      herdView.sync(t);
      saucers.red.sync({ x: 190 + Math.sin(t * 0.7) * 30, y: 330 + Math.sin(t * 1.1) * 18, vx: Math.cos(t * 0.7) * 21 * 10 }, t, { look: 1 });
      saucers.blue.sync({ x: 1090 + Math.sin(t * 0.8) * 30, y: 330 + Math.cos(t * 1.2) * 18, vx: Math.cos(t * 0.8) * 24 * 10 }, t, { look: -1 });
      prompt.alpha = 0.55 + 0.45 * Math.sin(t * 4);
    },
  };
}
