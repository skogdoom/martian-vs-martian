// Play scene: runs the world and draws it.

import { Container } from 'pixi.js';
import { playerInput } from '../input.js';
import { createWorld, stepWorld, SIDES } from '../logic/world.js';
import { createBackdrop } from '../render/backdrop.js';
import { createSaucerView } from '../render/saucerView.js';

export function createPlayScene() {
  const view = new Container();
  view.addChild(createBackdrop());

  const world = createWorld();

  const saucerViews = {};
  for (const side of SIDES) {
    saucerViews[side] = createSaucerView(side);
    view.addChild(saucerViews[side].view);
  }

  return {
    view,
    world,
    update(dt) {
      stepWorld(world, { red: playerInput('red'), blue: playerInput('blue') }, dt);
    },
    render() {
      for (const side of SIDES) saucerViews[side].sync(world.saucers[side]);
    },
  };
}
