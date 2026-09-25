// Static arena: sky, flight band, ground and pens.

import { Container, Graphics } from 'pixi.js';
import { WIDTH, HEIGHT, ARENA } from '../config.js';
import { label } from './text.js';

export const COLORS = {
  red: 0xe5484d,
  blue: 0x3e8ef7,
};

export function createBackdrop() {
  const view = new Container();
  const g = new Graphics();

  g.rect(0, 0, WIDTH, HEIGHT).fill(0x0b1026);
  // Flight band.
  g.rect(0, ARENA.flightTop, WIDTH, ARENA.flightBottom - ARENA.flightTop).fill({ color: 0x1a2350, alpha: 0.5 });
  g.moveTo(0, ARENA.flightBottom).lineTo(WIDTH, ARENA.flightBottom).stroke({ color: 0x3a4a8a, width: 1, alpha: 0.6 });
  // Ground.
  g.rect(0, ARENA.groundY, WIDTH, HEIGHT - ARENA.groundY).fill(0x2f6b2a);

  // Pens: tinted floor and a fence on the field side.
  for (const [side, pen] of Object.entries(ARENA.pens)) {
    g.rect(pen.left, ARENA.groundY, pen.right - pen.left, HEIGHT - ARENA.groundY).fill({ color: COLORS[side], alpha: 0.35 });
    const fx = side === 'red' ? pen.right : pen.left;
    g.rect(fx - 3, ARENA.groundY - 44, 6, 44).fill(0x8a6a3a);
  }

  // Walls.
  g.rect(0, 0, WIDTH, HEIGHT).stroke({ color: 0x5a6aa0, width: 4, alignment: 1 });

  view.addChild(g);

  for (const [side, pen] of Object.entries(ARENA.pens)) {
    const t = label(side === 'red' ? 'RED PEN' : 'BLUE PEN', { size: 14, color: COLORS[side], bold: true, anchorX: 0.5 });
    t.position.set((pen.left + pen.right) / 2, ARENA.groundY + 30);
    view.addChild(t);
  }

  return view;
}
