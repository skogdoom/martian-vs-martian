// Title screen with the mode menu. Any key also unlocks audio.
//   up/down      1 or 2 players
//   left/right   CPU difficulty (1 player)
//   1 / 2        pick the mode directly
//   Enter/Space  start

import { Container, Graphics } from 'pixi.js';
import { WIDTH, HEIGHT } from '../config.js';
import { wasPressed, onKey } from '../input.js';
import { unlockAudio } from '../audio.js';
import { createHerd, updateAnimal } from '../logic/animal.js';
import { createRng } from '../logic/rng.js';
import { startMatch, DIFFICULTIES } from '../session.js';
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
  const red = label('RED ALIEN', { size: 64, color: COLORS.red, bold: true, anchorX: 1, anchorY: 0.5 });
  const vs = label('vs', { size: 32, color: 0xffffff, anchorX: 0.5, anchorY: 0.5 });
  const blue = label('BLUE ALIEN', { size: 64, color: COLORS.blue, bold: true, anchorX: 0, anchorY: 0.5 });
  red.position.set(cx - 40, 150);
  vs.position.set(cx, 150);
  blue.position.set(cx + 40, 150);

  const blurb = label('Abduct cows and lambs. Bring them in low: from too high they go splat.', {
    size: 18,
    color: 0xcfd6ff,
    anchorX: 0.5,
  });
  blurb.position.set(cx, 215);
  const powerHint = label('Little green men parachute in during the round. Beam one up for a power-up!', {
    size: 16,
    color: 0x6cff6c,
    anchorX: 0.5,
  });
  powerHint.position.set(cx, 243);
  const campHint = label('Hover over your own pen too long and your animals get spooked out.', {
    size: 14,
    color: 0x8a93c0,
    anchorX: 0.5,
  });
  campHint.position.set(cx, 266);
  view.addChild(campHint);

  const redKeys = label('', { size: 20, color: COLORS.red, anchorX: 0.5 });
  redKeys.position.set(cx - 220, 290);
  const blueKeys = label('', { size: 20, color: COLORS.blue, anchorX: 0.5 });
  blueKeys.position.set(cx + 220, 290);

  // The menu.
  const onePlayer = label('', { size: 26, bold: true, anchorX: 0 });
  onePlayer.position.set(cx - 230, 395);
  const twoPlayers = label('', { size: 26, bold: true, anchorX: 0 });
  twoPlayers.position.set(cx - 230, 432);

  const prompt = label('ENTER OR SPACE TO START', { size: 22, color: 0xffffff, bold: true, anchorX: 0.5 });
  prompt.position.set(cx, 492);
  const help = label('↑ ↓  mode   ← →  difficulty   M  sound   ESC  back to this menu', {
    size: 14,
    color: 0x8a93c0,
    anchorX: 0.5,
  });
  help.position.set(cx, 528);

  view.addChild(red, vs, blue, blurb, powerHint, redKeys, blueKeys, onePlayer, twoPlayers, prompt, help);

  // Unlock from inside the key event itself: some browsers insist on it.
  const unsubscribe = onKey(unlockAudio);

  function refreshMenu() {
    const solo = session.players === 1;
    onePlayer.text = `${solo ? '▶' : ' '} 1 PLAYER  vs CPU   ◀ ${session.difficulty.toUpperCase()} ▶`;
    twoPlayers.text = `${solo ? ' ' : '▶'} 2 PLAYERS`;
    onePlayer.alpha = solo ? 1 : 0.5;
    twoPlayers.alpha = solo ? 0.5 : 1;
    redKeys.text = solo
      ? 'YOU (RED)\nmove  WASD or ARROWS\nshoot SPACE or ENTER\n(drops what you carry)'
      : 'RED\nmove  W A S D\nshoot SPACE\n(drops what you carry)';
    blueKeys.text = solo ? `CPU (BLUE)\n${session.difficulty.toUpperCase()}` : 'BLUE\nmove  ARROWS\nshoot ENTER\n(drops what you carry)';
  }
  refreshMenu();

  let t = 0;
  return {
    view,
    destroy: unsubscribe,
    update(dt) {
      t += dt;
      for (const a of herd) updateAnimal(a, dt, rng);
      if (t < 0.3) return;

      if (pressed('ArrowUp', 'KeyW', 'Digit1', 'Numpad1')) session.players = 1;
      if (pressed('ArrowDown', 'KeyS', 'Digit2', 'Numpad2')) session.players = 2;
      if (session.players === 1) {
        const i = DIFFICULTIES.indexOf(session.difficulty);
        if (pressed('ArrowLeft', 'KeyA')) session.difficulty = DIFFICULTIES[Math.max(0, i - 1)];
        if (pressed('ArrowRight', 'KeyD')) session.difficulty = DIFFICULTIES[Math.min(DIFFICULTIES.length - 1, i + 1)];
      }
      refreshMenu();

      if (pressed('Enter', 'Space', 'NumpadEnter')) {
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
