// Cheat codes typed on the title screen. Each toggles a cheat that lasts for
// the session (session.cheats); the title screen shows which are on.
//   ↑ ↑ ↓ ↓ ← → ← → B A   goldenHerd: every round starts with an all-golden herd
//   I D K F A             lasers: both players start every round with a laser

export const CHEAT_CODES = {
  goldenHerd: ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'],
  lasers: ['KeyI', 'KeyD', 'KeyK', 'KeyF', 'KeyA'],
};

// Keys the title screen (or the whole game) does something with. Once a code
// has got past a key that isn't one of these (the B, the I), its remaining
// keys are swallowed, so typing IDKFA doesn't toggle full screen or change a
// menu value on the way.
const MENU_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyF',
  'KeyM',
  'KeyP',
  'Enter',
  'NumpadEnter',
  'Space',
  'Escape',
  'Digit1',
  'Digit2',
  'Numpad1',
  'Numpad2',
]);

export function createCheats() {
  return { goldenHerd: false, lasers: false };
}

/** Watches key presses for the codes. `push(code)` returns { done, swallow }:
 * `done` is the name of a code just completed (or null), `swallow` whether
 * this key belongs to a code being typed and shouldn't do anything else. */
export function createCheatListener() {
  const longest = Math.max(...Object.values(CHEAT_CODES).map((c) => c.length));
  let typed = [];
  return {
    push(code) {
      typed = [...typed, code].slice(-longest);
      let done = null;
      let swallow = false;
      for (const [name, keys] of Object.entries(CHEAT_CODES)) {
        // The longest tail of what was typed that is a start of this code.
        for (let n = Math.min(keys.length, typed.length); n > 0; n--) {
          const tail = typed.slice(-n);
          if (!tail.every((k, i) => k === keys[i])) continue;
          if (n === keys.length) done = name;
          if (tail.slice(0, -1).some((k) => !MENU_KEYS.has(k))) swallow = true;
          break;
        }
      }
      if (done) typed = [];
      return { done, swallow };
    },
  };
}
