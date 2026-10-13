// Full screen (F key, double-click, or the pause menu). The canvas already
// follows the window size, so going full screen just refits the game area
// (see layout.js).
//
// Browsers keep Esc for themselves in full screen: it leaves full screen and
// the page never sees the key. Chrome and Edge let a page ask for it with the
// Keyboard Lock API, which we do while in full screen, so Esc can open the
// pause menu (holding Esc still leaves full screen). Where that isn't
// available (Firefox, Safari), leaving full screen by the browser's Esc is
// reported through `onUnexpectedExit`, and the game pauses instead.

const el = document.documentElement;

export const fullscreenSupported = !!(el.requestFullscreen || el.webkitRequestFullscreen);

export function isFullscreen() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

let expectedExit = false; // the game itself is leaving full screen
const exitListeners = new Set();

/** Called when full screen ends and the game did not ask for it (Esc in
 * browsers without Keyboard Lock). Returns an unsubscribe function. */
export function onUnexpectedExit(fn) {
  exitListeners.add(fn);
  return () => exitListeners.delete(fn);
}

function onChange() {
  const kb = navigator.keyboard;
  if (isFullscreen()) {
    expectedExit = false;
    // Deliver Esc to the page while in full screen, where the browser allows it.
    kb?.lock?.(['Escape']).catch?.(() => {});
    return;
  }
  kb?.unlock?.();
  if (!expectedExit) for (const fn of exitListeners) fn();
  expectedExit = false;
}
document.addEventListener('fullscreenchange', onChange);
document.addEventListener('webkitfullscreenchange', onChange);

export function toggleFullscreen() {
  if (!fullscreenSupported) return;
  try {
    if (isFullscreen()) {
      expectedExit = true;
      (document.exitFullscreen || document.webkitExitFullscreen).call(document)?.catch?.(() => {
        expectedExit = false;
      });
    } else {
      (el.requestFullscreen || el.webkitRequestFullscreen).call(el)?.catch?.(() => {});
    }
  } catch {
    // Refused (e.g. not from a user gesture, or blocked by an iframe): stay windowed.
    expectedExit = false;
  }
}
