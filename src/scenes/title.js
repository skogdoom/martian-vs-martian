// Title screen: press any key to start. The keypress also unlocks audio.

import { Container, Graphics } from 'pixi.js';
import { WIDTH, HEIGHT } from '../config.js';
import { anyPressed, onKey } from '../input.js';
import { unlockAudio } from '../audio.js';
import { createMatch } from '../logic/match.js';
import { createHerd, updateAnimal } from '../logic/animal.js';
import { createRng } from '../logic/rng.js';
import { createBackdrop, COLORS } from '../render/backdrop.js';
import { createAnimalView } from '../render/animalView.js';
import { createSaucerView } from '../render/saucerView.js';
import { label } from '../render/text.js';
import { createPlayScene } from './play.js';

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
  red.position.set(cx - 40, 170);
  vs.position.set(cx, 170);
  blue.position.set(cx + 40, 170);

  const blurb = label('Abduct cows and lambs. Drop them in your pen. Shoot the other saucer.', {
    size: 18,
    color: 0xcfd6ff,
    anchorX: 0.5,
  });
  blurb.position.set(cx, 240);

  const redKeys = label('RED\nmove  W A S D\nshoot SPACE', { size: 20, color: COLORS.red, anchorX: 0.5 });
  redKeys.position.set(cx - 220, 320);
  const blueKeys = label('BLUE\nmove  ARROWS\nshoot ENTER', { size: 20, color: COLORS.blue, anchorX: 0.5 });
  blueKeys.position.set(cx + 220, 320);

  const prompt = label('PRESS ANY KEY', { size: 28, color: 0xffffff, bold: true, anchorX: 0.5 });
  prompt.position.set(cx, 480);

  view.addChild(red, vs, blue, blurb, redKeys, blueKeys, prompt);

  // Unlock from inside the key event itself: some browsers insist on it.
  const unsubscribe = onKey(unlockAudio);

  let t = 0;
  return {
    view,
    destroy: unsubscribe,
    update(dt) {
      t += dt;
      for (const a of herd) updateAnimal(a, dt, rng);
      if (t > 0.3 && anyPressed()) {
        session.match = createMatch();
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
