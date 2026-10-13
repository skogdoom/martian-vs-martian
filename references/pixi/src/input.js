// Keyboard and controller state. Keys are tracked by `KeyboardEvent.code`.
// `pressed` holds keys that went down since the last `endStep()`,
// so a tap between two fixed steps is never lost. Controller buttons are
// polled once per step (`pollPads`) and show up in the same `pressed` set
// under pseudo codes ('PadConfirm', 'PadPause', 'PadUp', ... see gamepad.js).

import { KEYS, MUTE_KEY, FULLSCREEN_KEY } from './config.js';
import { createPadPoller } from './gamepad.js';

const down = new Set();
const pressed = new Set();
const listeners = new Set();

const gameKeys = new Set(Object.values(KEYS).flatMap((k) => Object.values(k)));
let keyFilter = null;

window.addEventListener('keydown', (e) => {
  if (gameKeys.has(e.code)) e.preventDefault();
  if (e.repeat) return;
  // A swallowed key (part of a cheat code being typed) does nothing else: it
  // isn't pressed for the scene, and listeners are told to ignore it.
  const swallowed = Boolean(keyFilter?.(e.code));
  if (!swallowed) {
    down.add(e.code);
    pressed.add(e.code);
  }
  for (const fn of listeners) fn(e.code, { swallowed });
});

/** Let `fn(code)` see every fresh keydown first; if it returns true the key is
 * swallowed. Used by the title screen for cheat codes. Returns a remover. */
export function setKeyFilter(fn) {
  keyFilter = fn;
  return () => {
    if (keyFilter === fn) keyFilter = null;
  };
}

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

// Never count as "any key": toggles, and stick flicks.
const NOT_ANY = new Set([MUTE_KEY, FULLSCREEN_KEY, 'PadUp', 'PadDown', 'PadLeft', 'PadRight']);

/** Any key or pad button, except the toggles and stick directions, so they never skip a screen. */
export function anyPressed() {
  for (const code of pressed) if (!NOT_ANY.has(code)) return true;
  return false;
}

export function endStep() {
  pressed.clear();
}

// ---- controllers ----------------------------------------------------------

const poller = createPadPoller();
let padSlots = { red: null, blue: null };
let padSeen = false;

/** Read the controllers. Call once per fixed step, before the scene updates. */
export function pollPads() {
  const getPads = navigator.getGamepads?.bind(navigator);
  if (!getPads) return;
  let pads;
  try {
    pads = getPads();
  } catch {
    return; // blocked (e.g. by a permissions policy): keys only
  }
  const result = poller.poll(pads);
  padSlots = result.slots;
  if (padSlots.red || padSlots.blue) padSeen = true;
  // Pad buttons are not user gestures to a browser: they must never start the sound.
  for (const code of result.pressed) pressed.add(code);
}

/** Has a controller been used this session? */
export function padSeenYet() {
  return padSeen;
}

/** A short rumble on `side`'s pad, where the pad supports it. */
export function rumble(side, ms = 150, strength = 0.7) {
  try {
    const index = poller.padIndex(side);
    const pad = index === null ? null : navigator.getGamepads?.()[index];
    pad?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength });
  } catch {
    // no rumble: nothing to do
  }
}

/** Called on every fresh keydown, as fn(code, { swallowed }). Returns an unsubscribe function. */
export function onKey(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Control state for one player, in the shape the logic expects. */
export function playerInput(side) {
  const k = KEYS[side];
  const pad = padSlots[side];
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  return {
    x: clamp((isDown(k.right) ? 1 : 0) - (isDown(k.left) ? 1 : 0) + (pad?.x ?? 0)),
    y: clamp((isDown(k.down) ? 1 : 0) - (isDown(k.up) ? 1 : 0) + (pad?.y ?? 0)),
    shoot: wasPressed(k.shoot) || wasPressed(`PadShoot:${side}`),
    fire: isDown(k.shoot) || Boolean(pad?.fire), // held, for the laser
  };
}

/** One player on the whole keyboard (and any controller): every input steers the same saucer. */
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
