// Play scene: one round, from the countdown to the final whistle.

import { Container } from 'pixi.js';
import { WIDTH } from '../config.js';
import { playerInput } from '../input.js';
import { handleEvents } from '../audio.js';
import { SIDES } from '../logic/world.js';
import { createRound, stepRound, countdownNumber } from '../logic/round.js';
import { scores } from '../logic/scoring.js';
import { roundWinner, recordRound, roundNumber } from '../logic/match.js';
import { addRoundToTally, addMatchToTally } from '../logic/tally.js';
import { createBackdrop } from '../render/backdrop.js';
import { createSaucerView } from '../render/saucerView.js';
import { createProjectileView } from '../render/projectileView.js';
import { createAnimalView, createBeamView } from '../render/animalView.js';
import { createEffects } from '../render/effects.js';
import { createGreenManView, POWER_NAMES, POWER_COLOR } from '../render/powerupView.js';
import { COLORS } from '../render/backdrop.js';
import { createHud } from '../render/hud.js';
import { label } from '../render/text.js';
import { createRoundEndScene } from './roundEnd.js';

export function createPlayScene(game, session) {
  const { match, tally } = session;
  const number = roundNumber(match);
  const round = createRound();
  const { world } = round;

  // `stage` holds the arena and shakes; the HUD and banners sit above it and don't.
  const view = new Container();
  const stage = new Container();
  const backdrop = createBackdrop();
  const beamView = createBeamView();
  const animalView = createAnimalView(world.animals);
  const saucerViews = {};
  for (const side of SIDES) saucerViews[side] = createSaucerView(side);
  const greenMan = createGreenManView();
  const projectileView = createProjectileView();
  const effects = createEffects();
  stage.addChild(
    backdrop.view,
    beamView.view,
    animalView.view,
    greenMan.view,
    ...SIDES.map((side) => saucerViews[side].view),
    projectileView.view,
    effects.view,
  );
  const hud = createHud();
  view.addChild(stage, hud.view);

  const banner = label('', { size: 96, color: 0xffffff, bold: true, anchorX: 0.5, anchorY: 0.5 });
  banner.position.set(WIDTH / 2, 280);
  const sub = label(`ROUND ${number}`, { size: 28, color: 0xcfd6ff, bold: true, anchorX: 0.5, anchorY: 0.5 });
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

  let goFlash = 0;
  let t = 0;

  function render() {
    backdrop.tick(t);
    beamView.sync(world, t);
    animalView.sync(t);
    for (const side of SIDES) {
      const s = world.saucers[side];
      const other = world.saucers[side === 'red' ? 'blue' : 'red'];
      const hook = world.hooks[side];
      saucerViews[side].sync(s, t, {
        power: world.powers[side]?.type ?? null,
        look: Math.sign(other.x - s.x) || 1,
        hit: effects.hitFlash[side],
        beam: Boolean(hook.target || hook.carrying),
      });
    }
    greenMan.sync(world.drop, t);
    projectileView.sync(world, t);
    announcement.visible = announceLeft > 0;
    announcement.alpha = Math.min(1, announceLeft * 2);
    effects.render();
    const shake = effects.shakeOffset();
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
  }

  function finish() {
    // Draw the final state: this view stays up behind the round result.
    render();
    stage.position.set(0, 0);
    const points = scores(world.animals);
    const result = roundWinner(points);
    addRoundToTally(tally, world.animals);
    const outcome = recordRound(match, result);
    if (match.over) addMatchToTally(tally, match);
    game.go(createRoundEndScene, session, { number, points, result, outcome, background: view });
  }

  return {
    view,
    round,
    update(dt) {
      if (round.phase === 'over') return;
      t += dt;
      stepRound(round, { red: playerInput('red'), blue: playerInput('blue') }, dt);
      effects.handle(round.events);
      effects.ambient(world);
      for (const e of round.events) {
        if (e.type === 'dropIncoming') announce(`POWER-UP INCOMING: ${POWER_NAMES[e.power]}`, POWER_COLOR);
        if (e.type === 'powerup') announce(`${e.side.toUpperCase()} GETS ${POWER_NAMES[e.power]}!`, COLORS[e.side]);
        if (e.type === 'goldenIncoming') {
          announce(`GOLDEN ${e.kind.toUpperCase()}! ${e.side.toUpperCase()} CAN EVEN THE SCORE`, 0xffcf3a);
        }
        if (e.type === 'land' && e.delivered && e.golden) announce(`${e.pen.toUpperCase()} EVENS THE SCORE!`, 0xffcf3a);
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
