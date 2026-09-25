// Play scene: one round, from the countdown to the final whistle.

import { Container } from 'pixi.js';
import { WIDTH } from '../config.js';
import { playerInput } from '../input.js';
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
  const projectileView = createProjectileView();
  const effects = createEffects();
  stage.addChild(
    backdrop.view,
    beamView.view,
    animalView.view,
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
        look: Math.sign(other.x - s.x) || 1,
        hit: effects.hitFlash[side],
        beam: Boolean(hook.target || hook.carrying),
      });
    }
    projectileView.sync(world.projectiles);
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
      effects.update(dt);
      if (round.events.some((e) => e.type === 'go')) goFlash = 0.7;
      goFlash = Math.max(0, goFlash - dt);
      if (round.phase === 'over') finish();
    },
    render,
  };
}
