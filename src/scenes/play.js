// Play scene: one round, from the countdown to the final whistle.

import { Container, Graphics } from 'pixi.js';
import { WIDTH, HEIGHT, AMMO_CRATE, BOT, RAM, PAUSE_KEY } from '../config.js';
import { momentum, speed } from '../logic/saucer.js';
import { createBot } from '../logic/bot.js';
import { createRng } from '../logic/rng.js';
import { sideName, isCpu, startMatch } from '../session.js';
import { playerInput, soloInput, wasPressed, rumble, padSeenYet } from '../input.js';
import { handleEvents, stopVoices, setAudioPaused, toggleMute, isMuted } from '../audio.js';
import { SIDES } from '../logic/world.js';
import { createRound, stepRound, countdownNumber } from '../logic/round.js';
import { scores } from '../logic/scoring.js';
import { roundWinner, recordRound, roundNumber, isSuddenDeath } from '../logic/match.js';
import { addRoundToTally, addMatchToTally } from '../logic/tally.js';
import { createBackdrop } from '../render/backdrop.js';
import { createSaucerView } from '../render/saucerView.js';
import { createProjectileView } from '../render/projectileView.js';
import { createAnimalView, createBeamView } from '../render/animalView.js';
import { createEffects } from '../render/effects.js';
import { createDropsView, POWER_NAMES, POWER_COLOR } from '../render/powerupView.js';
import { createWolvesView } from '../render/wolfView.js';
import { createTimeBombsView } from '../render/timeBombView.js';
import { COLORS } from '../render/backdrop.js';
import { createHud } from '../render/hud.js';
import { label } from '../render/text.js';
import { createRoundEndScene } from './roundEnd.js';
import { createTitleScene } from './title.js';

export function createPlayScene(game, session) {
  const { match, tally } = session;
  const number = roundNumber(match);
  const round = createRound(undefined, session.length);
  const { world } = round;

  // `stage` holds the arena and shakes; the HUD and banners sit above it and don't.
  const view = new Container();
  const stage = new Container();
  const backdrop = createBackdrop();
  const beamView = createBeamView();
  const animalView = createAnimalView(world.animals);
  const saucerViews = {};
  for (const side of SIDES) saucerViews[side] = createSaucerView(side);
  const dropsView = createDropsView();
  const wolvesView = createWolvesView();
  const timeBombsView = createTimeBombsView();
  const projectileView = createProjectileView();
  const effects = createEffects();
  stage.addChild(
    backdrop.view,
    beamView.view,
    animalView.view,
    wolvesView.view,
    dropsView.view,
    timeBombsView.view,
    ...SIDES.map((side) => saucerViews[side].view),
    projectileView.view,
    effects.view,
  );
  const hud = createHud({ red: sideName(session, 'red'), blue: sideName(session, 'blue') });
  const name = (side) => sideName(session, side);
  // In a 1-player game the CPU flies Blue and the player may use either key set.
  const cpu = isCpu(session, 'blue') ? createBot('blue', createRng(), BOT[session.difficulty], session.length) : null;
  view.addChild(stage, hud.view);

  const banner = label('', { size: 96, color: 0xffffff, bold: true, anchorX: 0.5, anchorY: 0.5 });
  banner.position.set(WIDTH / 2, 280);
  const sub = label(isSuddenDeath(match) ? 'SUDDEN DEATH' : `ROUND ${number}`, { size: 28, color: 0xcfd6ff, bold: true, anchorX: 0.5, anchorY: 0.5 });
  sub.position.set(WIDTH / 2, 200);
  view.addChild(banner, sub);

  // Power-up announcements under the HUD.
  const announcement = label('', { size: 30, color: 0xffffff, bold: true, anchorX: 0.5, anchorY: 0.5 });
  announcement.position.set(WIDTH / 2, 150);
  view.addChild(announcement);
  let announceLeft = 0;
  function announce(text, color) {
    announcement.text = text;
    announcement.tint = color;
    announceLeft = 2.2;
  }

  // Pause: P or Esc, or Start on a controller. Everything freezes, sound included,
  // and a menu comes up, which a controller can use fully.
  let paused = false;
  let choice = 0;
  const dim = new Graphics().rect(0, 0, WIDTH, HEIGHT).fill({ color: 0x000000, alpha: 0.6 });
  const pausedTitle = label('PAUSED', { size: 72, color: 0xffffff, bold: true, anchorX: 0.5, anchorY: 0.5 });
  pausedTitle.position.set(WIDTH / 2, 215);
  const ITEMS = [
    { id: 'resume', text: () => 'RESUME', padOk: true },
    { id: 'restart', text: () => 'RESTART THE GAME', padOk: true },
    { id: 'sound', text: () => `SOUND: ${isMuted() ? 'OFF' : 'ON'}`, padOk: true },
    { id: 'exit', text: () => 'EXIT TO MAIN MENU', padOk: true },
  ];
  const itemLabels = ITEMS.map((_, i) => {
    const l = label('', { size: 30, bold: true, anchorX: 0.5, anchorY: 0.5 });
    l.position.set(WIDTH / 2, 300 + i * 52);
    return l;
  });
  const pausedHelp = label('', { size: 16, color: 0x8a93c0, anchorX: 0.5, anchorY: 0.5 });
  pausedHelp.position.set(WIDTH / 2, 530);
  const pauseView = new Container();
  pauseView.addChild(dim, pausedTitle, ...itemLabels, pausedHelp);
  pauseView.visible = false;
  function refreshPauseMenu() {
    ITEMS.forEach((item, i) => {
      itemLabels[i].text = `${i === choice ? '▶ ' : '  '}${item.text()}${i === choice ? ' ◀' : '  '}`;
      itemLabels[i].tint = i === choice ? 0xffffff : 0x8a93c0;
    });
    pausedHelp.text = padSeenYet()
      ? '↑ ↓ choose   ENTER / A: select   P / Start / ESC: resume'
      : '↑ ↓ choose   ENTER or SPACE: select   P or ESC: resume';
  }
  function setPaused(on) {
    paused = on;
    pauseView.visible = on;
    setAudioPaused(on);
    if (on) {
      choice = 0;
      refreshPauseMenu();
    }
  }
  /** Run the pause menu for this step. Returns true if the scene changed. */
  function pauseMenu() {
    const up = wasPressed('ArrowUp') || wasPressed('KeyW') || wasPressed('PadUp');
    const down = wasPressed('ArrowDown') || wasPressed('KeyS') || wasPressed('PadDown');
    if (up) choice = (choice + ITEMS.length - 1) % ITEMS.length;
    if (down) choice = (choice + 1) % ITEMS.length;
    const byKey = ['Enter', 'Space', 'NumpadEnter'].some(wasPressed);
    const byPad = wasPressed('PadConfirm');
    if (byKey || (byPad && ITEMS[choice].padOk)) {
      const { id } = ITEMS[choice];
      if (id === 'resume') setPaused(false);
      else if (id === 'sound') toggleMute();
      else if (id === 'restart') {
        startMatch(session);
        game.go(createPlayScene, session);
        return true;
      } else if (id === 'exit') {
        game.go(createTitleScene, session);
        return true;
      }
    }
    refreshPauseMenu();
    return false;
  }

  let goFlash = 0;
  let t = 0;

  function render() {
    backdrop.tick(t);
    beamView.sync(world, t);
    animalView.sync(t, world.spook);
    for (const side of SIDES) {
      const s = world.saucers[side];
      const other = world.saucers[side === 'red' ? 'blue' : 'red'];
      const hook = world.hooks[side];
      saucerViews[side].sync(s, t, {
        power: world.powers[side]?.type ?? null,
        look: Math.sign(other.x - s.x) || 1,
        hit: effects.hitFlash[side],
        deflect: effects.deflect[side],
        momentum: momentum(s),
        ramReady: speed(s) >= RAM.speed && s.stun === 0 && !hook.carrying,
        beam: Boolean(hook.target || hook.carrying),
      });
    }
    dropsView.sync(world.drops, t);
    wolvesView.sync(world.wolves, t);
    timeBombsView.sync(world.timeBombs, t);
    projectileView.sync(world, t);
    announcement.visible = announceLeft > 0;
    announcement.alpha = Math.min(1, announceLeft * 2);
    effects.render();
    const shake = paused ? { x: 0, y: 0 } : effects.shakeOffset();
    stage.position.set(shake.x, shake.y);
    hud.sync(world, { timeLeft: round.timeLeft, match });

    if (round.phase === 'countdown') {
      banner.text = String(countdownNumber(round));
      banner.alpha = 1;
      banner.visible = sub.visible = true;
    } else if (goFlash > 0 && round.phase === 'play') {
      banner.text = 'GO!';
      banner.alpha = Math.min(1, goFlash * 3);
      banner.visible = true;
      sub.visible = false;
    } else {
      banner.visible = sub.visible = false;
    }
    if (paused) banner.visible = sub.visible = false;
  }

  function finish() {
    // Draw the final state: this view stays up behind the round result,
    // without a half-faded announcement.
    announceLeft = 0;
    render();
    stage.position.set(0, 0);
    const points = scores(world.animals);
    const result = roundWinner(points);
    addRoundToTally(tally, world.animals);
    const outcome = recordRound(match, result);
    if (match.over) addMatchToTally(tally, match);
    game.go(createRoundEndScene, session, { number, points, result, outcome, background: view });
  }

  view.addChild(pauseView); // above everything, banners and announcements included

  return {
    view,
    round,
    destroy() {
      setAudioPaused(false);
      stopVoices();
    },
    update(dt) {
      if (round.phase === 'over') return;
      if (wasPressed(PAUSE_KEY) || wasPressed('PadPause') || wasPressed('Escape')) {
        setPaused(!paused);
        return;
      }
      if (paused) {
        pauseMenu();
        return;
      }
      t += dt;
      const elapsed = round.length - round.timeLeft;
      const inputs = cpu
        ? { red: soloInput(), blue: round.phase === 'play' ? cpu.think(world, dt, elapsed) : undefined }
        : { red: playerInput('red'), blue: playerInput('blue') };
      stepRound(round, inputs, dt);
      effects.handle(round.events);
      effects.ambient(world);
      for (const e of round.events) {
        if (e.type === 'dropIncoming') {
          announce(e.mystery ? 'MYSTERY PACKAGE INCOMING!' : `POWER-UP INCOMING: ${POWER_NAMES[e.power]}`, e.mystery ? 0xc86cff : POWER_COLOR);
        }
        if (e.type === 'powerup') {
          const got = e.mystery ? `OPENS THE PACKAGE: ${POWER_NAMES[e.power]}!` : `GETS ${POWER_NAMES[e.power]}!`;
          announce(`${name(e.side)} ${got}`, COLORS[e.side]);
        }
        if (e.type === 'animalRain') {
          const [from, to] = [`${e.from.toUpperCase()}S`, `${e.to.toUpperCase()}S`];
          announce(e.count ? `${name(e.side)} TURNS ${e.count} ${from} INTO ${to}!` : `NO ${from} TO TURN INTO ${to}`, COLORS[e.side]);
        }
        if (e.type === 'wolfIncoming') announce('A WOLF IS LOOSE! IT EATS LAMBS', 0xcfd6ff);
        if (e.type === 'wolfLand' && e.pen) {
          if (!e.by) announce(`THE WOLF LANDS IN ${name(e.pen)}'S PEN!`, COLORS[e.pen]);
          else if (e.by === e.pen) announce(`${name(e.by)} PUTS THE WOLF IN ITS OWN PEN!`, COLORS[e.by]);
          else announce(`${name(e.by)} PUTS THE WOLF IN ${name(e.pen)}'S PEN!`, COLORS[e.by]);
        }
        if (e.type === 'wolfLeaves') announce('THE WOLF GETS BORED AND LEAVES', 0xcfd6ff);
        if (e.type === 'hit' && !e.shielded) rumble(e.side, 150, 0.7);
        if (e.type === 'ram' && !e.shielded) rumble(e.victim, 300, 1);
        if (e.type === 'dazed' || e.type === 'timeBombHeld') rumble(e.side, 400, 1);
        if (e.type === 'dazed') announce(`${name(e.side)} IS DAZED BY THREE HITS!`, COLORS[e.side === 'red' ? 'blue' : 'red']);
        if (e.type === 'ram') {
          announce(e.shielded ? `${name(e.side)}'S RAM BOUNCES OFF THE SHIELD` : `${name(e.side)} RAMS ${name(e.victim)}!`, COLORS[e.side]);
        }
        if (e.type === 'timeBombLand' && e.pen) {
          if (!e.by) announce(`THE TIME BOMB LANDS IN ${name(e.pen)}'S PEN!`, COLORS[e.pen]);
          else if (e.by === e.pen) announce(`${name(e.by)} PUTS THE TIME BOMB IN ITS OWN PEN!`, COLORS[e.by]);
          else announce(`${name(e.by)} PUTS THE TIME BOMB IN ${name(e.pen)}'S PEN!`, COLORS[e.by]);
        }
        if (e.type === 'timeBombHeld') announce(`${name(e.side)} WAS HOLDING THE TIME BOMB!`, COLORS[e.side]);
        if (e.type === 'restock') announce('FRESH ANIMALS INCOMING!', 0xffffff);
        if (e.type === 'spooked') announce(`${name(e.side)}'S ANIMALS ARE SPOOKED!`, COLORS[e.side]);
        if (e.type === 'bombBlast' && e.timed) {
          if (!e.pen) announce('THE TIME BOMB GOES OFF IN THE FIELD', 0xcfd6ff);
          else announce(`THE TIME BOMB BLASTS ${e.count} OUT OF ${name(e.pen)}'S PEN!`, COLORS[e.pen]);
        } else if (e.type === 'bombBlast') {
          if (!e.pen) announce(`${name(e.side)}'S BOMB MISSED`, 0xcfd6ff);
          else if (e.pen === e.side) announce(`${name(e.side)} BOMBED ITS OWN PEN!`, COLORS[e.side]);
          else announce(`${name(e.side)} BLASTS ${e.count} OUT OF ${name(e.pen)}'S PEN!`, COLORS[e.side]);
        }
        if (e.type === 'crateIncoming') announce(`AMMO DROP! ${name(e.side)} IS OUT OF SHOTS`, 0xffd76a);
        if (e.type === 'ammoCrate') announce(`${name(e.side)} GRABS +${AMMO_CRATE.refill} AMMO`, COLORS[e.side]);
        if (e.type === 'goldenIncoming') {
          announce(`GOLDEN ${e.kind.toUpperCase()}! ${name(e.side)} CAN EVEN THE SCORE`, 0xffcf3a);
        }
        if (e.type === 'land' && e.delivered && e.golden) announce(`${name(e.pen)} EVENS THE SCORE!`, 0xffcf3a);
      }
      announceLeft = Math.max(0, announceLeft - dt);
      handleEvents(round.events);
      effects.update(dt);
      if (round.events.some((e) => e.type === 'go')) goFlash = 0.7;
      goFlash = Math.max(0, goFlash - dt);
      if (round.phase === 'over') finish();
    },
    render,
  };
}
