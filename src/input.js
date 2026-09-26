// Keyboard state. Keys are tracked by `KeyboardEvent.code`.
// `pressed` holds keys that went down since the last `endStep()`,
// so a tap between two fixed steps is never lost.

import { KEYS, MUTE_KEY } from './config.js';

const down = new Set();
const pressed = new Set();
const listeners = new Set();

const gameKeys = new Set(Object.values(KEYS).flatMap((k) => Object.values(k)));

window.addEventListener('keydown', (e) => {
  if (gameKeys.has(e.code)) e.preventDefault();
  if (e.repeat) return;
  down.add(e.code);
  pressed.add(e.code);
  for (const fn of listeners) fn(e.code);
});

window.addEventListener('keyup', (e) => {
  down.delete(e.code);
});

window.addEventListener('blur', () => down.clear());

export function isDown(code) {
  return down.has(code);
}

export function wasPressed(code) {
  return pressed.has(code);
}

/** Any key except the mute toggle, so muting never skips a screen. */
export function anyPressed() {
  for (const code of pressed) if (code !== MUTE_KEY) return true;
  return false;
}

export function endStep() {
  pressed.clear();
}

/** Called on every fresh keydown. Returns an unsubscribe function. */
export function onKey(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Control state for one player, in the shape the logic expects. */
export function playerInput(side) {
  const k = KEYS[side];
  return {
    x: (isDown(k.right) ? 1 : 0) - (isDown(k.left) ? 1 : 0),
    y: (isDown(k.down) ? 1 : 0) - (isDown(k.up) ? 1 : 0),
    shoot: wasPressed(k.shoot),
    fire: isDown(k.shoot), // held, for the laser
  };
}

/** One player on the whole keyboard: either key set steers the same saucer. */
export function soloInput() {
  const a = playerInput('red');
  const b = playerInput('blue');
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  return {
    x: clamp(a.x + b.x),
    y: clamp(a.y + b.y),
    shoot: a.shoot || b.shoot,
    fire: a.fire || b.fire,
  };
}
