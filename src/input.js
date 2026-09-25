// Keyboard state. Keys are tracked by `KeyboardEvent.code`.
// `pressed` holds keys that went down since the last `endStep()`,
// so a tap between two fixed steps is never lost.

import { KEYS } from './config.js';

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

export function anyPressed() {
  return pressed.size > 0;
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
  };
}
