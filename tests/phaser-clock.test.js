import { readFile } from 'node:fs/promises';
import { describe, it, expect } from 'vitest';
import { STEP } from '../src/config.js';
import { createFixedLoop, createFrameClock } from '../src/phaser/clock.js';
import { createScenarios, fixturePath } from '../scripts/baseline/logic.js';

const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));

describe('Phaser host fixed-step boundary', () => {
  it('polls before update, clears edges after each step, and renders once per frame', () => {
    const calls = [];
    let pressed = true;
    const loop = createFixedLoop({
      poll: () => calls.push('poll'),
      update: (dt) => calls.push([dt, pressed]),
      clear: () => {
        calls.push('clear');
        pressed = false;
      },
      render: () => calls.push('render'),
    });
    loop.advance(5);
    expect(calls).toEqual(['render']); // a tap waits until a fixed step is due
    loop.advance(30);
    expect(calls.slice(1)).toEqual(['poll', [STEP, true], 'clear', 'poll', [STEP, false], 'clear', 'render']);
  });

  it('matches the actual Pixi 100ms ticker clamp on stalls and resets after recovery', () => {
    let steps = 0;
    let cleared = 0;
    const loop = createFixedLoop({ poll() {}, update: () => steps++, clear: () => cleared++, render() {} });
    const frame = loop.advance(2000);
    expect(frame.dt).toBe(0.1);
    expect(steps).toBe(6);
    loop.advance(10);
    loop.reset();
    expect(loop.remainder).toBe(0);
    expect(cleared).toBe(7);
    loop.advance(10);
    expect(steps).toBe(6);
  });

  it.each([30, 60, 120, 144])('preserves the Pixi floating-point step boundary at %iHz', (hz) => {
    let steps = 0;
    const loop = createFixedLoop({ poll() {}, update: () => steps++, clear() {}, render() {} });
    const clock = createFrameClock(0);
    for (let i = 1; i <= hz; i++) loop.advance(clock.delta((i * 1000) / hz));
    // Same floating-point accumulator as Pixi: a boundary may fall in the next frame.
    expect(steps).toBeGreaterThanOrEqual(59);
    expect(steps).toBeLessThanOrEqual(60);
    loop.advance(0.000001);
    expect(steps).toBe(60);
  });

  it('retains wall time through Phaser delta resets on tab return, then applies the Pixi clamp', () => {
    const clock = createFrameClock(100);
    expect(clock.delta(116)).toBe(16);
    expect(clock.delta(5116)).toBe(5000);
    clock.reset(6000);
    expect(clock.delta(6016)).toBe(16);
  });
});

// Replay the real seeded rules and ordered events through the clock used by the
// browser host. At an explicit fixture action, finish that step before applying it.
for (const [label, durations] of [
  ['30Hz', [1000 / 30]],
  ['60Hz', [1000 / 60]],
  ['120Hz', [1000 / 120]],
  ['144Hz', [1000 / 144]],
  ['stalls', [1000 / 144, 33, 250, 2000, 10]],
]) {
  describe(`preservation traces through Phaser scheduling: ${label}`, () => {
    for (const name of Object.keys(fixture.scenarios)) {
      it(name, () => {
        let index = 0;
        let step = null;
        const loop = createFixedLoop({ poll() {}, update: () => step(), clear() {}, render() {} });
        const scenarios = createScenarios((count, advance) => {
          let done = 0;
          step = () => {
            if (done >= count) throw new Error('Double step across fixture action');
            advance();
            done++;
          };
          while (done < count) {
            const remainingMS = ((count - done) * STEP - loop.remainder) * 1000;
            loop.advance(Math.min(durations[index++ % durations.length], remainingMS + 1e-8));
          }
        });
        expect(scenarios[name]()).toEqual(fixture.scenarios[name]);
      });
    }
  });
}
