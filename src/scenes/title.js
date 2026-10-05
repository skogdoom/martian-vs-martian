// Title screen with the menu: five rows.
//   up/down      move between the rows: 1 player, 2 players, round length, rounds, settings
//   left/right   change the value on the row: CPU difficulty, 60/90/120 s, best of 1/3/5/7
//   1 / 2        pick the mode directly
//   Enter/Space  start (or open the settings)

import { Container } from 'pixi.js';
import { WIDTH } from '../config.js';
import { menuLift } from '../layout.js';
import { centerUi, dimmer } from '../render/uiLayer.js';
import { wasPressed, padSeenYet } from '../input.js';
import { audioUnlocked } from '../audio.js';
import { createHerd, updateAnimal } from '../logic/animal.js';
import { createRng } from '../logic/rng.js';
import { startMatch, DIFFICULTIES } from '../session.js';
import { LENGTHS, ROUNDS, step, saveOptions, pickOptions } from '../options.js';
import { createBackdrop, COLORS } from '../render/backdrop.js';
import { createShootingStars } from '../render/shootingStars.js';
import { createAnimalView } from '../render/animalView.js';
import { createSaucerView } from '../render/saucerView.js';
import { label } from '../render/text.js';
import { createPlayScene } from './play.js';
import { createSettingsScene } from './settings.js';

const pressed = (...codes) => codes.some(wasPressed);
const KEYS_MARGIN = 40; // the players' keys, in the top corners
const SAUCER_Y = 215; // where the idling saucers hover, under the keys

export function createTitleScene(game, session) {
  const view = new Container();
  const backdrop = createBackdrop();
  view.addChild(backdrop.view);
  const shootingStars = createShootingStars();
  view.addChild(shootingStars.view);

  // A grazing herd and two idling saucers behind the title.
  const rng = createRng();
  const herd = createHerd();
  const herdView = createAnimalView(herd);
  const saucers = { red: createSaucerView('red'), blue: createSaucerView('blue') };
  view.addChild(herdView.view, saucers.red.view, saucers.blue.view);
  view.addChild(dimmer(0.25));

  const cx = WIDTH / 2;
  const red = label('MARTIAN', { size: 64, color: COLORS.red, bold: true, anchorX: 1, anchorY: 0.5 });
  const vs = label('vs', { size: 32, color: 0xffffff, anchorX: 0.5, anchorY: 0.5 });
  const blue = label('MARTIAN', { size: 64, color: COLORS.blue, bold: true, anchorX: 0, anchorY: 0.5 });
  red.position.set(cx - 40, 150);
  vs.position.set(cx, 150);
  blue.position.set(cx + 40, 150);
  // The moon hangs just right of the title, half below it.
  const moonAt = { x: blue.x + blue.width + 52, y: 150 + red.height / 2 };

  // The rest is left for players to find out.
  // Left-aligned, with the block as a whole centred.
  const steps = ['Step 1: Abduct the animals.', 'Step 2: …?', 'Step 3: Profit!'].map((text) =>
    label(text, { size: 18, color: 0xcfd6ff, anchorX: 0 }),
  );
  const stepsLeft = cx - Math.max(...steps.map((l) => l.width)) / 2;
  steps.forEach((line, i) => line.position.set(stepsLeft, 198 + i * 24));

  // Each player's keys in their top corner, with their saucer idling below.
  const keys = {
    red: { title: label('', { size: 22, color: COLORS.red, bold: true }), body: label('', { size: 16, color: 0xdfe4ff }) },
    blue: {
      title: label('', { size: 22, color: COLORS.blue, bold: true, anchorX: 1 }),
      body: label('', { size: 16, color: 0xdfe4ff, anchorX: 1 }), // against the right edge, lines still left-aligned
    },
  };
  keys.red.title.position.set(KEYS_MARGIN, 34);
  keys.red.body.position.set(KEYS_MARGIN, 64);
  keys.blue.title.position.set(WIDTH - KEYS_MARGIN, 34);
  keys.blue.body.position.set(WIDTH - KEYS_MARGIN, 64);

  // The menu. Up/down moves between the rows, left/right changes a value.
  //   0  1 PLAYER vs CPU   difficulty
  //   1  2 PLAYERS
  //   2  round length
  //   3  number of rounds
  //   4  settings (opens the settings screen: sound, full screen, 16:9)
  const rows = [0, 1, 2, 3, 4].map((i) => {
    const l = label('', { size: 24, bold: true, anchorX: 0 });
    l.position.set(cx - 230, 305 + i * 32);
    return l;
  });
  let row = session.players === 1 ? 0 : 1;

  const prompt = label('ENTER OR SPACE TO START', { size: 22, color: 0xffffff, bold: true, anchorX: 0.5 });
  prompt.position.set(cx, 484);
  const help = label('↑ ↓  choose   ← →  change   M  sound   F  full screen   P / ESC  pause menu', {
    size: 14,
    color: 0x8a93c0,
    anchorX: 0.5,
  });
  help.position.set(cx, 514);
  // Shown once a controller has been used. Pad buttons can't start sound.
  const padHelp = label('', { size: 14, color: 0x6cff6c, anchorX: 0.5 });
  padHelp.position.set(cx, 534);

  view.addChild(red, vs, blue, ...steps, keys.red.title, keys.red.body, keys.blue.title, keys.blue.body, ...rows, prompt, help, padHelp);

  function refreshMenu() {
    const solo = session.players === 1;
    const text = [
      `1 PLAYER  vs CPU   ◀ ${session.difficulty.toUpperCase()} ▶`,
      '2 PLAYERS',
      `ROUND LENGTH       ◀ ${session.length} s ▶`,
      `ROUNDS             ◀ BEST OF ${session.rounds} ▶`,
      'SETTINGS',
    ];
    rows.forEach((l, i) => {
      const mode = i < 2 && (i === 0) === solo; // the chosen game mode
      l.text = `${i === row ? '▶' : mode ? '•' : ' '} ${text[i]}`;
      l.alpha = i === row ? 1 : 0.5;
    });
    keys.red.title.text = solo ? 'YOU (RED)' : 'RED';
    keys.red.body.text = solo
      ? 'move   WASD or ARROWS\nshoot  SPACE or ENTER\n(drops what you carry)'
      : 'move   W A S D\nshoot  SPACE\n(drops what you carry)';
    keys.blue.title.text = solo ? 'CPU (BLUE)' : 'BLUE';
    keys.blue.body.text = solo ? session.difficulty.toUpperCase() : 'move   ARROWS\nshoot  ENTER\n(drops what you carry)';
  }
  refreshMenu();

  // Backdrop, shooting stars, herd, saucers and the dimming stay put; the text is centred.
  const centered = centerUi(view, 6);

  let t = 0;
  return {
    view,
    update(dt) {
      t += dt;
      for (const a of herd) updateAnimal(a, dt, rng);
      shootingStars.update(dt);
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
        if (row >= 2) saveOptions(pickOptions(session));
      }
      refreshMenu();
      prompt.text = row === 4 ? 'ENTER OR SPACE FOR SETTINGS' : 'ENTER OR SPACE TO START';
      padHelp.text = padSeenYet()
        ? 'CONTROLLER  stick or d-pad: move   A / trigger: shoot   A / Start: begin   Start: pause' +
          (audioUnlocked() ? '' : '\nthe sound starts after one key press or click')
        : '';

      if (pressed('Enter', 'Space', 'NumpadEnter', 'PadConfirm')) {
        if (row === 4) {
          game.go(createSettingsScene, session);
        } else {
          startMatch(session);
          game.go(createPlayScene, session);
        }
      }
    },
    render() {
      centered.sync();
      backdrop.tick(t);
      backdrop.moon.position.set(moonAt.x, moonAt.y + menuLift()); // moves up with the title on a tall screen
      shootingStars.render();
      herdView.sync(t);
      // Under their keys, which move up with the rest of the text on a tall screen.
      const y = SAUCER_Y + menuLift();
      saucers.red.sync({ x: 150 + Math.sin(t * 0.7) * 30, y: y + Math.sin(t * 1.1) * 14, vx: Math.cos(t * 0.7) * 21 * 10 }, t, { look: 1 });
      saucers.blue.sync({ x: 1130 + Math.sin(t * 0.8) * 30, y: y + Math.cos(t * 1.2) * 14, vx: Math.cos(t * 0.8) * 24 * 10 }, t, { look: -1 });
      prompt.alpha = 0.55 + 0.45 * Math.sin(t * 4);
    },
  };
}
