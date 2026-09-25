// Play scene. Milestone 1: arena plus a key-state readout for both players.

import { Container, Text } from 'pixi.js';
import { WIDTH } from '../config.js';
import { playerInput } from '../input.js';
import { createBackdrop, COLORS } from '../render/backdrop.js';

export function createPlayScene() {
  const view = new Container();
  view.addChild(createBackdrop());

  const readouts = {};
  const shots = { red: 0, blue: 0 };
  for (const side of ['red', 'blue']) {
    const t = new Text({ text: '', style: { fill: COLORS[side], fontFamily: 'monospace', fontSize: 18 } });
    t.anchor.set(side === 'red' ? 0 : 1, 0);
    t.position.set(side === 'red' ? 20 : WIDTH - 20, 20);
    view.addChild(t);
    readouts[side] = t;
  }

  const input = { red: null, blue: null };

  return {
    view,
    update() {
      for (const side of ['red', 'blue']) {
        input[side] = playerInput(side);
        if (input[side].shoot) shots[side]++;
      }
    },
    render() {
      for (const side of ['red', 'blue']) {
        const i = input[side];
        if (!i) continue;
        readouts[side].text = `${side.toUpperCase()}  x:${i.x}  y:${i.y}  shots:${shots[side]}`;
      }
    },
  };
}
