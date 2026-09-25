// Synthesized sound effects (Web Audio API). Browsers only allow audio after
// a user gesture, so the title screen calls `unlockAudio()` on its keypress.

let ctx = null;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
}
