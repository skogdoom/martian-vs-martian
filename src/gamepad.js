// Game controllers (Gamepad API), read as plain data so it can be tested.
//
// Standard layout: left stick or d-pad moves, A / X / RB / RT shoot (and drop),
// A or Start confirms in menus, Start pauses a round. A pad can't leave a round,
// quit, or touch the sound: that stays on the keyboard. The first connected pad
// flies Red and the second Blue. Sticks are turned into -1/0/1 per axis, like
// keys, so momentum works the same way (analog noise would keep changing the
// heading).

export const PAD = {
  dead: 0.4, // stick deflection that counts as a direction
  shoot: [0, 2, 5, 7],
  confirm: [0, 9],
  pause: [9],
  up: 12,
  down: 13,
  left: 14,
  right: 15,
};

const held = (pad, i) => Boolean(pad.buttons?.[i]?.pressed);
const anyHeld = (pad, list) => list.some((i) => held(pad, i));

const digital = (v) => (v > PAD.dead ? 1 : v < -PAD.dead ? -1 : 0);
const clamp = (v) => Math.max(-1, Math.min(1, v));

/** What one pad is doing right now. */
export function readPad(pad) {
  const stickX = digital(pad.axes?.[0] ?? 0);
  const stickY = digital(pad.axes?.[1] ?? 0);
  return {
    x: clamp(stickX + (held(pad, PAD.right) ? 1 : 0) - (held(pad, PAD.left) ? 1 : 0)),
    y: clamp(stickY + (held(pad, PAD.down) ? 1 : 0) - (held(pad, PAD.up) ? 1 : 0)),
    fire: anyHeld(pad, PAD.shoot),
    confirm: anyHeld(pad, PAD.confirm),
    pause: anyHeld(pad, PAD.pause),
  };
}

const SIDES = ['red', 'blue'];

/**
 * Polls the connected pads. Call once per fixed step with the list from
 * `navigator.getGamepads()`. A pad keeps its slot while it stays connected:
 * the first pad seen flies Red, the next Blue, and a pad that drops out frees
 * its slot for the next one (the other pad is not reassigned mid-round).
 * Returns
 *   slots    { red, blue }: { x, y, fire } or null when no pad is in that slot
 *   pressed  codes for buttons that went down since the last poll:
 *            'PadShoot:red', 'PadShoot:blue', 'PadConfirm', 'PadPause',
 *            'PadUp', 'PadDown', 'PadLeft', 'PadRight'
 */
export function createPadPoller() {
  let prev = { red: null, blue: null };
  const owner = { red: null, blue: null }; // pad.index in each slot
  return {
    poll(pads) {
      const live = [...(pads ?? [])].filter((p) => p && p.connected !== false).sort((a, b) => a.index - b.index);
      const slots = { red: null, blue: null };
      const pressed = [];
      const now = { red: null, blue: null };
      for (const side of SIDES) if (owner[side] !== null && !live.some((p) => p.index === owner[side])) owner[side] = null;
      for (const pad of live) {
        if (SIDES.some((side) => owner[side] === pad.index)) continue;
        const free = SIDES.find((side) => owner[side] === null);
        if (free) owner[free] = pad.index;
      }
      for (const side of SIDES) {
        const pad = live.find((p) => p.index === owner[side]);
        if (!pad) continue;
        const cur = readPad(pad);
        const was = prev[side];
        now[side] = cur;
        slots[side] = { x: cur.x, y: cur.y, fire: cur.fire };
        if (cur.fire && !was?.fire) pressed.push(`PadShoot:${side}`);
        if (cur.confirm && !was?.confirm) pressed.push('PadConfirm');
        if (cur.pause && !was?.pause) pressed.push('PadPause');
        if (cur.y < 0 && !(was?.y < 0)) pressed.push('PadUp');
        if (cur.y > 0 && !(was?.y > 0)) pressed.push('PadDown');
        if (cur.x < 0 && !(was?.x < 0)) pressed.push('PadLeft');
        if (cur.x > 0 && !(was?.x > 0)) pressed.push('PadRight');
      }
      prev = now;
      return { slots, pressed };
    },
    /** `pad.index` of the pad flying `side`, or null. */
    padIndex(side) {
      return owner[side];
    },
  };
}
