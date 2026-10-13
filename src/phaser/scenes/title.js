// Title screen with the menu: five rows.
//   up/down      move between the rows: 1 player, 2 players, round length, rounds, settings
//   left/right   change the value on the row: CPU difficulty, 60/90/120 s, best of 1/3/5/7
//   1 / 2        pick the mode directly
//   Enter/Space  start (or open the settings)

import { withSceneScope } from './scope.js';
import { WIDTH } from '../../config.js';
import { version } from '../../../package.json';
import logoAtlas from '../../../assets/cartoon/logo.json';
import { menuLift } from '../../layout.js';
import { centerUi, dimmer } from '../render/uiLayer.js';
import { wasPressed, padSeenYet, setKeyFilter } from '../input.js';
import { createCheatListener, toggleCheat } from '../../cheats.js';
import { audioUnlocked, play } from '../../audio.js';
import { createHerd, updateAnimal } from '../../logic/animal.js';
import { createRng } from '../../logic/rng.js';
import { startMatch, DIFFICULTIES } from '../../session.js';
import { LENGTHS, ROUNDS, step, saveOptions, pickOptions } from '../../options.js';
import { createBackdrop, createPenForeground, COLORS } from '../render/backdrop.js';
import { createShootingStars } from '../render/shootingStars.js';
import { createTieFlyby } from '../render/tieFlyby.js';
import { occasion } from '../../occasion.js';
import { createAnimalView } from '../render/animalView.js';
import { createSaucerView } from '../render/saucerView.js';
import { label } from '../render/text.js';
import { createPlayScene } from './play.js';
import { createSettingsScene } from './settings.js';

const pressed = (...codes) => codes.some(wasPressed);
const KEYS_MARGIN = 40; // the players' keys, in the top corners
const SAUCER_Y = 215; // where the idling saucers hover, under the keys

export function createTitleScene(game, session) {
  return withSceneScope(game, (art, scope) => {
    const view = scope.root;
    const backdrop = createBackdrop(art);
    art.add(view, backdrop.view);
    const shootingStars = createShootingStars(art);
    art.add(view, shootingStars.view);
    // 4 May: a flight of fighters now and then.
    const flyby = occasion === 'mayTheFourth' ? createTieFlyby(art) : null;
    if (flyby) art.add(view, flyby.view);

    // A grazing herd and two idling saucers behind the title.
    const rng = createRng();
    const herd = createHerd();
    const herdView = createAnimalView(art, herd);
    const saucers = { red: createSaucerView(art, 'red'), blue: createSaucerView(art, 'blue') };
    const foreground = createPenForeground(art);
    art.add(view, herdView.view, foreground.view, saucers.red.view, saucers.blue.view);
    art.add(view, dimmer(art, 0.25));
    const scenery = view.list.length; // everything after this is text, centred on a tall screen

    const cx = WIDTH / 2;
    const red = label(art, 'MARTIAN', { size: 64, color: COLORS.red, bold: true, anchorX: 1, anchorY: 0.5 });
    const vs = label(art, 'vs', { size: 32, color: 0xffffff, anchorX: 0.5, anchorY: 0.5 });
    const blue = label(art, 'MARTIAN', { size: 64, color: COLORS.blue, bold: true, anchorX: 0, anchorY: 0.5 });
    red.setPosition(cx - 40, 150);
    vs.setPosition(cx, 150);
    blue.setPosition(cx + 40, 150);
    const logoFrame = logoAtlas.frames.logo.frame;
    const logoScale = Math.min(500 / logoFrame.w, 260 / logoFrame.h);
    const logo = art.sprites.sprite('logo', logoFrame.w * logoScale, logoFrame.h * logoScale, cx, 155);
    red.visible = vs.visible = blue.visible = game.graphics.classic;
    logo.visible = !game.graphics.classic;
    // Which version is running: tiny, right-aligned with the end of the title, just above it.
    const versionLabel = label(art, `v${version}`, { size: 11, color: 0x8a93c0, anchorX: 1, anchorY: 1 });
    versionLabel.setPosition(blue.x + blue.width - 4, 150 - blue.height / 2 + 12);
    if (!game.graphics.classic) versionLabel.setPosition(logo.x + logo.displayWidth / 2, logo.y - logo.displayHeight / 2 - 6);

    // The rest is left for players to find out.
    // Left-aligned, with the block as a whole centred.
    const steps = ['Step 1: Abduct the animals.', 'Step 2: …?', 'Step 3: Profit!'].map((text) =>
      label(art, text, { size: 18, color: 0xcfd6ff, anchorX: 0 }),
    );
    const stepsLeft = cx - Math.max(...steps.map((l) => l.width)) / 2;
    steps.forEach((line, i) => line.setPosition(stepsLeft, 198 + i * 24));
    steps.forEach((line) => (line.visible = game.graphics.classic));

    // Each player's keys in their top corner, with their saucer idling below.
    const keys = {
      red: { title: label(art, '', { size: 22, color: COLORS.red, bold: true }), body: label(art, '', { size: 16, color: 0xdfe4ff }) },
      blue: {
        title: label(art, '', { size: 22, color: COLORS.blue, bold: true, anchorX: 1 }),
        body: label(art, '', { size: 16, color: 0xdfe4ff, anchorX: 1 }), // against the right edge, lines still left-aligned
      },
    };
    keys.red.title.setPosition(KEYS_MARGIN, 34);
    keys.red.body.setPosition(KEYS_MARGIN, 64);
    keys.blue.title.setPosition(WIDTH - KEYS_MARGIN, 34);
    keys.blue.body.setPosition(WIDTH - KEYS_MARGIN, 64);

    // The menu. Up/down moves between the rows, left/right changes a value.
    //   0  1 PLAYER vs CPU   difficulty
    //   1  2 PLAYERS
    //   2  round length
    //   3  number of rounds
    //   4  settings (opens the settings screen: sound, full screen, 16:9)
    const rows = [0, 1, 2, 3, 4].map((i) => {
      const l = label(art, '', { size: 24, bold: true, anchorX: 0 });
      l.setPosition(cx - 230, 305 + i * 32);
      return l;
    });
    let row = session.players === 1 ? 0 : 1;

    const prompt = label(art, 'ENTER OR SPACE TO START', { size: 22, color: 0xffffff, bold: true, anchorX: 0.5 });
    prompt.setPosition(cx, 484);
    const help = label(art, '↑ ↓  choose   ← →  change   M  sound   F  full screen   P / ESC  pause menu', {
      size: 14,
      color: 0x8a93c0,
      anchorX: 0.5,
    });
    help.setPosition(cx, 514);
    // Cheat codes (cheats.js): typed here, on for the session; this says which.
    const cheatsLabel = label(art, '', { size: 16, color: 0xffd76a, bold: true, anchorX: 0.5, anchorY: 0.5 });
    cheatsLabel.setPosition(cx, 70);
    const showCheats = () => {
      const on = [
        session.cheats.goldenHerd && '★ GOLDEN HERD ★',
        session.cheats.lasers && '⚡ LASERS ⚡',
        session.cheats.shields && '◆ SHIELDS ◆',
      ].filter(Boolean);
      cheatsLabel.text = on.join('    ');
    };
    showCheats();
    const cheatCodes = createCheatListener();
    const removeKeyFilter = setKeyFilter((code) => {
      const { done, swallow } = cheatCodes.push(code);
      if (done) {
        const on = toggleCheat(session.cheats, done);
        showCheats();
        play(on ? 'fanfare' : 'powerDown');
      }
      return swallow || done !== null;
    });

    // Shown once a controller has been used. Pad buttons can't start sound.
    const padHelp = label(art, '', { size: 14, color: 0x6cff6c, anchorX: 0.5 });
    padHelp.setPosition(cx, 534);

    art.add(
      view,
      cheatsLabel,
      red,
      vs,
      blue,
      logo,
      versionLabel,
      ...steps,
      keys.red.title,
      keys.red.body,
      keys.blue.title,
      keys.blue.body,
      ...rows,
      prompt,
      help,
      padHelp,
    );

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

    // Backdrop, shooting stars (and fighters on 4 May), herd, saucers and the dimming stay put; the text is centred.
    const centered = centerUi(art, view, scenery);

    let t = 0;
    return {
      view,
      kind: 'title',
      destroy() {
        removeKeyFilter();
      },
      update(dt) {
        t += dt;
        for (const a of herd) updateAnimal(a, dt, rng);
        shootingStars.update(dt);
        flyby?.update(dt);
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
        shootingStars.render();
        flyby?.render();
        herdView.sync(t);
        // Under their keys, which move up with the rest of the text on a tall screen.
        const y = SAUCER_Y + menuLift();
        saucers.red.sync({ x: 150 + Math.sin(t * 0.7) * 30, y: y + Math.sin(t * 1.1) * 14, vx: Math.cos(t * 0.7) * 21 * 10 }, t, { look: 1 });
        saucers.blue.sync({ x: 1130 + Math.sin(t * 0.8) * 30, y: y + Math.cos(t * 1.2) * 14, vx: Math.cos(t * 0.8) * 24 * 10 }, t, { look: -1 });
        prompt.alpha = 0.55 + 0.45 * Math.sin(t * 4);
      },
    };
  });
}
