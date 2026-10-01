import { describe, it, expect } from 'vitest';
import { PAD, readPad, createPadPoller } from '../src/gamepad.js';

/** A fake pad: `buttons` is a list of pressed button indices, `axes` the first two axes. */
function pad(index, { buttons = [], axes = [0, 0], connected = true } = {}) {
  const list = Array.from({ length: 17 }, (_, i) => ({ pressed: buttons.includes(i) }));
  return { index, connected, buttons: list, axes };
}

describe('reading a pad', () => {
  it('turns the stick into -1/0/1 with a dead zone', () => {
    expect(readPad(pad(0, { axes: [0.2, -0.3] }))).toMatchObject({ x: 0, y: 0 });
    expect(readPad(pad(0, { axes: [0.9, -0.3] }))).toMatchObject({ x: 1, y: 0 });
    expect(readPad(pad(0, { axes: [-0.5, 0.45] }))).toMatchObject({ x: -1, y: 1 });
    expect(readPad(pad(0, { axes: [0.41, 1] }))).toMatchObject({ x: 1, y: 1 });
  });

  it('reads the d-pad, and stick plus d-pad never exceed 1', () => {
    expect(readPad(pad(0, { buttons: [PAD.left, PAD.up] }))).toMatchObject({ x: -1, y: -1 });
    expect(readPad(pad(0, { buttons: [PAD.right], axes: [1, 0] }))).toMatchObject({ x: 1 });
  });

  it('shoots with A, X, RB or RT, and menus use A/Start and B/Back', () => {
    for (const b of PAD.shoot) expect(readPad(pad(0, { buttons: [b] })).fire).toBe(true);
    expect(readPad(pad(0)).fire).toBe(false);
    expect(readPad(pad(0, { buttons: [9] }))).toMatchObject({ confirm: true, fire: false });
    expect(readPad(pad(0, { buttons: [1] }))).toMatchObject({ back: true, fire: false });
  });

  it('copes with a pad that has no buttons or axes', () => {
    expect(readPad({ index: 0 })).toMatchObject({ x: 0, y: 0, fire: false });
  });
});

describe('polling pads', () => {
  it('gives the first pad to Red and the second to Blue', () => {
    const p = createPadPoller();
    const { slots } = p.poll([pad(0, { axes: [1, 0] }), pad(1, { axes: [-1, 0] })]);
    expect(slots.red).toMatchObject({ x: 1 });
    expect(slots.blue).toMatchObject({ x: -1 });
  });

  it('an empty slot is null, and missing or null entries are ignored', () => {
    const p = createPadPoller();
    expect(p.poll(null).slots).toEqual({ red: null, blue: null });
    const { slots } = p.poll([null, pad(1)]);
    expect(slots.red).toMatchObject({ fire: false });
    expect(slots.blue).toBe(null);
  });

  it('reports a button once per press, per side', () => {
    const p = createPadPoller();
    expect(p.poll([pad(0), pad(1)]).pressed).toEqual([]);
    expect(p.poll([pad(0, { buttons: [0] }), pad(1)]).pressed).toEqual(['PadShoot:red', 'PadConfirm']);
    expect(p.poll([pad(0, { buttons: [0] }), pad(1)]).pressed).toEqual([]); // still held
    expect(p.poll([pad(0), pad(1)]).pressed).toEqual([]);
    expect(p.poll([pad(0), pad(1, { buttons: [7] })]).pressed).toEqual(['PadShoot:blue']);
  });

  it('turns stick flicks into menu directions, once each', () => {
    const p = createPadPoller();
    expect(p.poll([pad(0, { axes: [0, -1] })]).pressed).toEqual(['PadUp']);
    expect(p.poll([pad(0, { axes: [0, -1] })]).pressed).toEqual([]);
    expect(p.poll([pad(0, { axes: [0.9, 0] })]).pressed).toEqual(['PadRight']);
    expect(p.poll([pad(0, { buttons: [PAD.left] })]).pressed).toEqual(['PadLeft']);
    expect(p.poll([pad(0, { buttons: [PAD.down] })]).pressed).toEqual(['PadDown']);
  });

  it('a pad keeps its slot when the other one drops out', () => {
    const p = createPadPoller();
    p.poll([pad(0), pad(1)]);
    const { slots } = p.poll([pad(1, { axes: [1, 0] })]); // pad 0 unplugged
    expect(slots.red).toBe(null);
    expect(slots.blue).toMatchObject({ x: 1 });
    expect(p.padIndex('blue')).toBe(1);
    // A new pad fills the free slot.
    const again = p.poll([pad(1), pad(2, { axes: [-1, 0] })]);
    expect(again.slots.red).toMatchObject({ x: -1 });
    expect(p.padIndex('red')).toBe(2);
  });

  it('ignores a pad reported as disconnected, and a third pad', () => {
    const p = createPadPoller();
    const { slots } = p.poll([pad(0, { connected: false }), pad(1), pad(2), pad(3, { axes: [1, 0] })]);
    expect(p.padIndex('red')).toBe(1);
    expect(p.padIndex('blue')).toBe(2);
    expect(slots.blue).toMatchObject({ x: 0 });
  });
});
