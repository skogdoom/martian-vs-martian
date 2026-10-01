// Full screen toggle (F key or double-click). The canvas already follows the
// window size, so going full screen just refits the game area (see layout.js).

const el = document.documentElement;

export const fullscreenSupported = !!(el.requestFullscreen || el.webkitRequestFullscreen);

function current() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

export function toggleFullscreen() {
  if (!fullscreenSupported) return;
  try {
    if (current()) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document)?.catch?.(() => {});
    } else {
      (el.requestFullscreen || el.webkitRequestFullscreen).call(el)?.catch?.(() => {});
    }
  } catch {
    // Refused (e.g. not from a user gesture, or blocked by an iframe): stay windowed.
  }
}
