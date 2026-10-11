import { STEP } from '../config.js';

export const MAX_FRAME = 0.25;
// Pixi's default ticker.minFPS = 10 clamps deltaMS before main.js sees it.
export const TICKER_FRAME = 0.1;

/** Renderer-independent scheduling; scene updates own event delivery. */
export function createFixedLoop({ poll, update, clear, render }) {
  let acc = 0;
  return {
    advance(deltaMS) {
      const dt = Math.min(Math.max(0, deltaMS / 1000), MAX_FRAME, TICKER_FRAME);
      acc += dt;
      let steps = 0;
      while (acc >= STEP) {
        poll();
        update(STEP);
        clear();
        acc -= STEP;
        steps++;
      }
      render();
      return { dt, steps };
    },
    reset() {
      acc = 0;
      clear();
    },
    get remainder() {
      return acc;
    },
  };
}

/** Use RAF timestamps: Phaser resets its delta on focus/visibility return. */
export function createFrameClock(now) {
  let last = now;
  return {
    delta(time) {
      const elapsed = Math.max(0, time - last);
      last = time;
      return elapsed;
    },
    reset(time) {
      last = time;
    },
  };
}
