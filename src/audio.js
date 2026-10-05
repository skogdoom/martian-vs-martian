// Synthesized sound effects (Web Audio API). No sample files.
//
// Browsers only allow audio after a user gesture, so main.js calls
// `unlockAudio()` from every keydown and pointerdown. That also wakes the audio
// up again if the browser suspended it mid-game (tab switch, sleep, a new
// output device). Every sound is a function
// (ac, out, t, opts) that builds a small node graph starting at time `t`, so
// the same code can also render into an OfflineAudioContext.

import { WIDTH, HOOK } from './config.js';

let ctx = null;
let master = null;
let muted = false;
let noiseBuffer = null;
const VOLUME = 0.55;

let paused = false;
let unlocked = false; // sound has run at least once this session
let createdAt = 0;

/**
 * Call from a real key press or click, and only from those: a context made
 * outside a user gesture can stay blocked for good in some browsers. If the
 * current context is not running, it is replaced by a fresh one made right
 * here, inside the gesture (unless it was made a moment ago and is still
 * starting up). While the game is paused, nothing wakes the sound.
 */
export function unlockAudio() {
  if (paused) return;
  if (ctx && (ctx.state === 'running' || performance.now() - createdAt < 500)) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (ctx) {
    const old = ctx;
    ctx = null;
    master = null;
    noiseBuffer = null;
    old.close().catch(() => {});
  }
  const fresh = new AC();
  ctx = fresh;
  master = createBus(fresh);
  createdAt = performance.now();
  fresh.addEventListener('statechange', () => {
    if (fresh.state === 'running') unlocked = true;
  });
  if (fresh.state === 'running') unlocked = true;
  else fresh.resume().catch(() => {});
}

/** Pause or resume all sound with the game. While paused, nothing wakes it up. */
export function setAudioPaused(on) {
  paused = on;
  if (!ctx) return;
  if (on) ctx.suspend().catch(() => {});
  else resume();
}

/** Ask a suspended (or, in Safari, interrupted) context to run again. */
export function resume() {
  if (paused) return;
  if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {});
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : VOLUME, master.context.currentTime, 0.02);
  return muted;
}

/** Has sound started yet this session? False until the browser has allowed it;
 * stays true afterwards, also while the game is paused. */
export function audioUnlocked() {
  if (ctx && ctx.state === 'running') unlocked = true;
  return unlocked;
}

export function isMuted() {
  return muted;
}

/** Master gain through a gentle compressor, so stacked sounds don't clip. */
function createBus(ac) {
  const gain = ac.createGain();
  gain.gain.value = muted ? 0 : VOLUME;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  gain.connect(comp).connect(ac.destination);
  return gain;
}

// ---- building blocks ----------------------------------------------------

const SILENT = 0.0001;

/** Attack, optional hold, then exponential decay to silence at t + dur. */
function envelope(param, t, dur, peak, attack = 0.005, hold = 0) {
  param.setValueAtTime(SILENT, t);
  param.exponentialRampToValueAtTime(peak, t + attack);
  if (hold > 0) param.setValueAtTime(peak, t + attack + hold);
  param.exponentialRampToValueAtTime(SILENT, t + dur);
}

function osc(ac, type, freq, t) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  return o;
}

function gainNode(ac, value = 0) {
  const g = ac.createGain();
  g.gain.value = value;
  return g;
}

function filter(ac, type, freq, q = 1) {
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

/** Sine LFO wired into `param` with the given depth. */
function lfo(ac, rate, depth, param, t, dur) {
  const o = osc(ac, 'sine', rate, t);
  const g = gainNode(ac, depth);
  o.connect(g).connect(param);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noiseSource(ac) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ac.sampleRate) {
    noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  return src;
}

/** A single enveloped oscillator, optionally sweeping to `to`. */
function tone(ac, out, t, { type = 'sine', freq, to, dur, peak = 0.3, attack = 0.005, hold = 0 }) {
  const o = osc(ac, type, freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = gainNode(ac);
  envelope(g.gain, t, dur, peak, attack, hold);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

/** A burst of filtered noise, optionally sweeping the filter to `to`. */
function hiss(ac, out, t, { dur, peak = 0.3, type = 'lowpass', freq = 1000, to, q = 1, attack = 0.002 }) {
  const src = noiseSource(ac);
  const f = filter(ac, type, freq, q);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = gainNode(ac);
  envelope(g.gain, t, dur, peak, attack);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

// ---- the sounds ---------------------------------------------------------

export const SOUNDS = {
  zap(ac, out, t, { side = 'red' } = {}) {
    // Red is a touch lower than Blue so the two guns are told apart.
    const base = side === 'red' ? 1250 : 1600;
    tone(ac, out, t, { type: 'square', freq: base, to: base / 8, dur: 0.16, peak: 0.17 });
    tone(ac, out, t, { type: 'sawtooth', freq: base * 1.5, to: base / 5, dur: 0.1, peak: 0.08 });
  },

  thud(ac, out, t) {
    tone(ac, out, t, { type: 'sine', freq: 170, to: 38, dur: 0.35, peak: 0.7 });
    hiss(ac, out, t, { dur: 0.22, peak: 0.45, freq: 900, to: 150 });
    hiss(ac, out, t, { dur: 0.06, peak: 0.2, type: 'highpass', freq: 2500 });
  },

  boing(ac, out, t) {
    const dur = 0.4;
    const o = osc(ac, 'sine', 150, t);
    o.frequency.exponentialRampToValueAtTime(330, t + 0.08);
    o.frequency.exponentialRampToValueAtTime(190, t + dur);
    lfo(ac, 16, 35, o.frequency, t, dur);
    const g = gainNode(ac);
    envelope(g.gain, t, dur, 0.35, 0.005);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  },

  click(ac, out, t) {
    // Two-part reload: clip out, clip in.
    hiss(ac, out, t, { dur: 0.03, peak: 0.7, type: 'bandpass', freq: 3200, q: 3 });
    tone(ac, out, t + 0.08, { type: 'square', freq: 1900, dur: 0.025, peak: 0.08 });
    hiss(ac, out, t + 0.08, { dur: 0.04, peak: 0.8, type: 'bandpass', freq: 2400, q: 3 });
  },

  dry(ac, out, t) {
    hiss(ac, out, t, { dur: 0.025, peak: 0.12, type: 'highpass', freq: 3000 });
  },

  /** Rising tone for the whole lift. Returns { stop(time) } for interrupts. */
  lift(ac, out, t, { dur = 1 } = {}) {
    const g = gainNode(ac);
    g.gain.setValueAtTime(SILENT, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.08);
    g.gain.setValueAtTime(0.13, t + dur - 0.05);
    g.gain.exponentialRampToValueAtTime(SILENT, t + dur + 0.08);
    const trem = gainNode(ac, 0.7);
    lfo(ac, 11, 0.3, trem.gain, t, dur);
    const oscs = [osc(ac, 'triangle', 220, t), osc(ac, 'sine', 440, t)];
    oscs[0].frequency.exponentialRampToValueAtTime(880, t + dur);
    oscs[1].frequency.exponentialRampToValueAtTime(1760, t + dur);
    const sub = gainNode(ac, 0.35);
    oscs[0].connect(trem);
    oscs[1].connect(sub).connect(trem);
    trem.connect(g).connect(out);
    for (const o of oscs) {
      o.start(t);
      o.stop(t + dur + 0.1);
    }
    return {
      stop(at) {
        g.gain.cancelScheduledValues(at);
        g.gain.setTargetAtTime(SILENT, at, 0.02);
        for (const o of oscs) {
          try {
            o.stop(at + 0.1);
          } catch {
            // Older Safari refuses a second stop(); the scheduled one still ends it.
          }
        }
      },
    };
  },

  womp(ac, out, t) {
    const f = filter(ac, 'lowpass', 1200, 4);
    f.frequency.exponentialRampToValueAtTime(200, t + 0.3);
    f.connect(out);
    tone(ac, f, t, { type: 'sawtooth', freq: 420, to: 110, dur: 0.3, peak: 0.2 });
  },

  ding(ac, out, t) {
    tone(ac, out, t, { type: 'sine', freq: 1320, dur: 0.25, peak: 0.16 });
    tone(ac, out, t, { type: 'sine', freq: 2640, dur: 0.12, peak: 0.05 });
  },

  moo(ac, out, t) {
    const dur = 1.0;
    const f = filter(ac, 'lowpass', 320, 7);
    f.frequency.setValueAtTime(320, t);
    f.frequency.linearRampToValueAtTime(950, t + 0.3);
    f.frequency.exponentialRampToValueAtTime(420, t + dur);
    const g = gainNode(ac);
    envelope(g.gain, t, dur, 0.22, 0.12, 0.45);
    f.connect(g).connect(out);
    for (const detune of [0, 9]) {
      const o = osc(ac, 'sawtooth', 112, t);
      o.detune.value = detune;
      o.frequency.linearRampToValueAtTime(134, t + 0.18);
      o.frequency.exponentialRampToValueAtTime(96, t + dur);
      lfo(ac, 5, 2.5, o.frequency, t, dur);
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  },

  baa(ac, out, t) {
    const dur = 0.6;
    const f = filter(ac, 'bandpass', 1300, 1.6);
    f.frequency.setValueAtTime(900, t);
    f.frequency.linearRampToValueAtTime(1500, t + 0.12);
    // Bleat: fast amplitude wobble.
    const trem = gainNode(ac, 0.55);
    lfo(ac, 24, 0.45, trem.gain, t, dur);
    const g = gainNode(ac);
    envelope(g.gain, t, dur, 0.85, 0.03, 0.3);
    f.connect(trem).connect(g).connect(out);
    const o = osc(ac, 'sawtooth', 390, t);
    o.frequency.linearRampToValueAtTime(430, t + 0.1);
    o.frequency.exponentialRampToValueAtTime(350, t + dur);
    o.connect(f);
    o.start(t);
    o.stop(t + dur + 0.05);
  },

  /** A long wolf howl: rises, holds with a waver, and falls away. */
  howl(ac, out, t) {
    const dur = 2.2;
    const g = gainNode(ac);
    envelope(g.gain, t, dur, 0.2, 0.35, 1.0);
    const f = filter(ac, 'lowpass', 1800, 1);
    f.connect(g).connect(out);
    for (const [type, mul, peak] of [
      ['sine', 1, 1],
      ['triangle', 2, 0.25],
    ]) {
      const o = osc(ac, type, 330 * mul, t);
      o.frequency.exponentialRampToValueAtTime(560 * mul, t + 0.5);
      o.frequency.setValueAtTime(560 * mul, t + 1.3);
      o.frequency.exponentialRampToValueAtTime(300 * mul, t + dur);
      lfo(ac, 5.5, 9 * mul, o.frequency, t, dur);
      const og = gainNode(ac, peak);
      o.connect(og).connect(f);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  },

  /** Low snarl when the beam grabs the wolf. */
  growl(ac, out, t) {
    const dur = 0.7;
    const f = filter(ac, 'lowpass', 500, 4);
    const trem = gainNode(ac, 0.5);
    lfo(ac, 30, 0.45, trem.gain, t, dur);
    const g = gainNode(ac);
    envelope(g.gain, t, dur, 0.5, 0.05, 0.35);
    f.connect(trem).connect(g).connect(out);
    const o = osc(ac, 'sawtooth', 85, t);
    o.frequency.linearRampToValueAtTime(110, t + 0.3);
    o.frequency.exponentialRampToValueAtTime(70, t + dur);
    o.connect(f);
    o.start(t);
    o.stop(t + dur + 0.05);
    hiss(ac, out, t, { dur, peak: 0.08, type: 'bandpass', freq: 700, q: 2 });
  },

  /** Time bomb tick; `urgent` for the last three seconds. */
  tick(ac, out, t, { urgent = false } = {}) {
    tone(ac, out, t, { type: 'square', freq: urgent ? 1760 : 1100, dur: 0.05, peak: urgent ? 0.12 : 0.08 });
    hiss(ac, out, t, { dur: 0.03, peak: 0.12, type: 'highpass', freq: 3000 });
  },

  /** Two quick bites. */
  chomp(ac, out, t) {
    for (const at of [0, 0.16]) {
      tone(ac, out, t + at, { type: 'square', freq: 220, to: 60, dur: 0.09, peak: 0.25 });
      hiss(ac, out, t + at, { dur: 0.1, peak: 0.35, type: 'bandpass', freq: 1200, to: 300, q: 1.2 });
    }
  },

  /** Bell arpeggio. Stolen (half value) animals get a shorter, lower one. */
  chime(ac, out, t, { full = true } = {}) {
    const notes = full ? [1047, 1319, 1568, 2093] : [880, 1109];
    notes.forEach((freq, i) => {
      const at = t + i * 0.07;
      tone(ac, out, at, { type: 'sine', freq, dur: 0.7, peak: 0.16 });
      tone(ac, out, at, { type: 'sine', freq: freq * 2.76, dur: 0.25, peak: 0.03 });
    });
  },

  beep(ac, out, t, { go = false } = {}) {
    tone(ac, out, t, { type: 'square', freq: go ? 1046 : 523, dur: go ? 0.45 : 0.16, peak: 0.13, hold: go ? 0.2 : 0.06 });
  },

  /** Two-tone siren as the green man starts to fall. */
  siren(ac, out, t) {
    for (let i = 0; i < 4; i++) {
      tone(ac, out, t + i * 0.22, { type: 'triangle', freq: i % 2 ? 660 : 880, dur: 0.22, peak: 0.13, hold: 0.12 });
    }
  },

  /** The green man squeaks when the beam grabs him. */
  chirp(ac, out, t) {
    const o = osc(ac, 'sine', 700, t);
    o.frequency.exponentialRampToValueAtTime(1900, t + 0.18);
    o.frequency.exponentialRampToValueAtTime(1300, t + 0.3);
    lfo(ac, 30, 60, o.frequency, t, 0.3);
    const g = gainNode(ac);
    envelope(g.gain, t, 0.32, 0.25, 0.01);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.35);
  },

  fanfare(ac, out, t) {
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      tone(ac, out, t + i * 0.06, { type: 'square', freq, dur: 0.14, peak: 0.12 });
      tone(ac, out, t + i * 0.06, { type: 'triangle', freq: freq * 2, dur: 0.3, peak: 0.12 });
    });
    tone(ac, out, t + 0.3, { type: 'triangle', freq: 1568, dur: 0.6, peak: 0.18, hold: 0.15 });
  },

  /** The green man: a squeaky little "oh... no!", falling. */
  ohNo(ac, out, t) {
    for (const [at, from, to, dur] of [
      [0, 900, 780, 0.22],
      [0.3, 1100, 520, 0.42],
    ]) {
      const o = osc(ac, 'triangle', from, t + at);
      o.frequency.exponentialRampToValueAtTime(to, t + at + dur);
      lfo(ac, 9, 40, o.frequency, t + at, dur);
      const g = gainNode(ac);
      envelope(g.gain, t + at, dur, 0.2, 0.02, dur * 0.4);
      o.connect(g).connect(out);
      o.start(t + at);
      o.stop(t + at + dur + 0.05);
    }
  },

  /** A parachute snapping open: a soft flap of cloth. */
  flap(ac, out, t) {
    hiss(ac, out, t, { dur: 0.18, peak: 0.22, type: 'bandpass', freq: 500, to: 1400, q: 0.8, attack: 0.01 });
    hiss(ac, out, t + 0.07, { dur: 0.12, peak: 0.12, type: 'bandpass', freq: 900, to: 400, q: 0.8 });
  },

  powerDown(ac, out, t) {
    tone(ac, out, t, { type: 'triangle', freq: 784, dur: 0.15, peak: 0.12, hold: 0.05 });
    tone(ac, out, t + 0.14, { type: 'triangle', freq: 392, dur: 0.3, peak: 0.12, hold: 0.08 });
  },

  /** A shot glancing off a shield. */
  deflect(ac, out, t) {
    tone(ac, out, t, { type: 'triangle', freq: 2400, to: 3400, dur: 0.18, peak: 0.14 });
    tone(ac, out, t, { type: 'sine', freq: 1200, to: 1800, dur: 0.25, peak: 0.1 });
    hiss(ac, out, t, { dur: 0.08, peak: 0.1, type: 'highpass', freq: 4000 });
  },

  pop(ac, out, t) {
    tone(ac, out, t, { type: 'sine', freq: 900, to: 150, dur: 0.12, peak: 0.3 });
    hiss(ac, out, t, { dur: 0.25, peak: 0.2, type: 'bandpass', freq: 1500, to: 400, q: 1.5 });
  },

  /** Humming laser beam while shoot is held. Returns { stop(time) }. */
  laser(ac, out, t) {
    const g = gainNode(ac);
    g.gain.setValueAtTime(SILENT, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.04);
    const f = filter(ac, 'bandpass', 1400, 2);
    lfo(ac, 7, 500, f.frequency, t, 30);
    const oscs = [osc(ac, 'sawtooth', 110, t), osc(ac, 'square', 221, t), osc(ac, 'sine', 1760, t)];
    for (const o of oscs) lfo(ac, 31, o.frequency.value * 0.03, o.frequency, t, 30);
    const top = gainNode(ac, 0.15);
    oscs[0].connect(f);
    oscs[1].connect(f);
    oscs[2].connect(top).connect(g);
    f.connect(g).connect(out);
    for (const o of oscs) o.start(t);
    return {
      stop(at) {
        g.gain.cancelScheduledValues(at);
        g.gain.setTargetAtTime(SILENT, at, 0.03);
        for (const o of oscs) o.stop(at + 0.2);
      },
    };
  },

  /** Rocket launch: a rising roar of noise and a sawtooth. */
  whoosh(ac, out, t) {
    hiss(ac, out, t, { dur: 0.6, peak: 0.35, type: 'bandpass', freq: 500, to: 2600, q: 1.2, attack: 0.05 });
    tone(ac, out, t, { type: 'sawtooth', freq: 90, to: 260, dur: 0.5, peak: 0.08, attack: 0.03 });
  },

  /** Explosion: a low thump and a long rumble of filtered noise. */
  boom(ac, out, t, { big = true } = {}) {
    const k = big ? 1 : 0.45;
    tone(ac, out, t, { type: 'sine', freq: 120, to: 30, dur: 0.6 * k + 0.2, peak: 0.8 * k });
    hiss(ac, out, t, { dur: 1.1 * k + 0.2, peak: 0.6 * k, freq: 1600, to: 90 });
    hiss(ac, out, t, { dur: 0.1, peak: 0.3 * k, type: 'highpass', freq: 2000 });
  },

  /** A bomb falling: the classic descending whistle. */
  whistle(ac, out, t) {
    tone(ac, out, t, { type: 'sine', freq: 1900, to: 700, dur: 0.7, peak: 0.12, attack: 0.03, hold: 0.4 });
  },

  /** Flames put out: a short hiss of steam. */
  fizz(ac, out, t) {
    hiss(ac, out, t, { dur: 0.5, peak: 0.25, type: 'highpass', freq: 3000, to: 5000, attack: 0.02 });
  },

  /** An animal bursting: a wet slap and a low thump. */
  splat(ac, out, t) {
    hiss(ac, out, t, { dur: 0.35, peak: 0.6, type: 'lowpass', freq: 2400, to: 180, attack: 0.003 });
    hiss(ac, out, t + 0.02, { dur: 0.15, peak: 0.3, type: 'bandpass', freq: 700, to: 250, q: 3 });
    tone(ac, out, t, { type: 'sine', freq: 140, to: 45, dur: 0.3, peak: 0.5 });
  },

  /** Two low horn blasts as an ammo crate comes down. */
  horn(ac, out, t) {
    for (const [at, freq] of [
      [0, 196],
      [0.28, 262],
    ]) {
      const f = filter(ac, 'lowpass', 1100, 1);
      f.connect(out);
      tone(ac, f, t + at, { type: 'sawtooth', freq, dur: 0.26, peak: 0.2, attack: 0.02, hold: 0.12 });
    }
  },

  /** Rising harp glissando as a golden animal appears. */
  harp(ac, out, t) {
    const notes = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093];
    notes.forEach((freq, i) => tone(ac, out, t + i * 0.045, { type: 'triangle', freq, dur: 0.6, peak: 0.1 }));
  },

  /** Big bell cascade when golden gold pays out. */
  goldChime(ac, out, t) {
    [1047, 1319, 1568, 2093, 1568, 2093, 2637].forEach((freq, i) => {
      const at = t + i * 0.08;
      tone(ac, out, at, { type: 'sine', freq, dur: 1.0, peak: 0.16 });
      tone(ac, out, at, { type: 'sine', freq: freq * 2.76, dur: 0.3, peak: 0.04 });
    });
    for (const freq of [523, 659, 784]) tone(ac, out, t + 0.5, { type: 'triangle', freq, dur: 1.2, peak: 0.08, hold: 0.4 });
  },

  jingle(ac, out, t) {
    // C E G C', then a held chord.
    const melody = [
      [523, 0, 0.14],
      [659, 0.13, 0.14],
      [784, 0.26, 0.14],
      [1047, 0.39, 0.7],
    ];
    for (const [freq, at, dur] of melody) {
      tone(ac, out, t + at, { type: 'triangle', freq, dur, peak: 0.22, hold: dur * 0.4 });
      tone(ac, out, t + at, { type: 'square', freq: freq / 2, dur, peak: 0.04, hold: dur * 0.4 });
    }
    for (const freq of [523, 659, 784]) tone(ac, out, t + 0.39, { type: 'sine', freq, dur: 0.8, peak: 0.07, hold: 0.3 });
  },
};

// ---- playback -----------------------------------------------------------

function output(x) {
  if (x === undefined || !ctx.createStereoPanner) return master;
  const p = ctx.createStereoPanner();
  p.pan.value = ((x / WIDTH) * 2 - 1) * 0.6;
  p.connect(master);
  return p;
}

// Many copies of one sound at once (nine animals bursting in the same step)
// are no louder or better than three, and cost audio nodes: cap them.
const SAME_SOUND_MAX = 3; // starts of one sound within SAME_SOUND_WINDOW
const SAME_SOUND_WINDOW = 0.08; // seconds
const ALL_SOUNDS_MAX = 24; // starts of any sound within ALL_SOUNDS_WINDOW
const ALL_SOUNDS_WINDOW = 0.25;
const recent = []; // { name, at } in audio-clock seconds

function tooMany(name, now) {
  while (recent.length && recent[0].at < now - ALL_SOUNDS_WINDOW) recent.shift();
  if (recent.length >= ALL_SOUNDS_MAX) return true;
  let same = 0;
  for (const r of recent) if (r.name === name && r.at >= now - SAME_SOUND_WINDOW) same++;
  return same >= SAME_SOUND_MAX;
}

export function play(name, { x, ...opts } = {}) {
  // A missing sound is silence, never a crash in the game loop.
  if (!ctx || !SOUNDS[name]) return null;
  if (ctx.state !== 'running') {
    resume(); // works if the browser allows it now; otherwise the next key press will
    return null;
  }
  const now = ctx.currentTime;
  if (tooMany(name, now)) return null;
  recent.push({ name, at: now });
  return SOUNDS[name](ctx, output(x), now + 0.005, opts);
}

const HOOK_VOICE = { cow: 'moo', lamb: 'baa', greenman: 'chirp', wolf: 'growl' };

// Sustained voices, one per player, that events start and stop.
const liftVoices = { red: null, blue: null };
const laserVoices = { red: null, blue: null };

function stopVoice(voices, side) {
  if (voices[side] && ctx) voices[side].stop(ctx.currentTime);
  voices[side] = null;
}

function stopLift(side) {
  stopVoice(liftVoices, side);
}

/** Silence every sustained sound, e.g. when leaving a round early. */
export function stopVoices() {
  for (const side of ['red', 'blue']) {
    stopVoice(liftVoices, side);
    stopVoice(laserVoices, side);
  }
}

/** Map world and round events to sounds. */
export function handleEvents(events) {
  for (const e of events) {
    switch (e.type) {
      case 'shot':
        play('zap', { x: e.x, side: e.side });
        if (e.triple) play('zap', { x: e.x, side: e.side === 'red' ? 'blue' : 'red' });
        break;
      case 'dryFire':
        play('dry');
        break;
      case 'hit':
        play(e.shielded ? 'deflect' : 'thud', { x: e.x });
        break;
      case 'ram':
        if (e.shielded) play('deflect', { x: e.x });
        else {
          play('thud', { x: e.x });
          play('boom', { x: e.x, big: false });
        }
        break;
      case 'dazed':
        play('womp', { x: e.x });
        break;
      case 'burst':
        if (e.lifting) stopLift(e.lifting);
        play('splat', { x: e.x });
        break;
      case 'animalRain':
        if (e.count) play(e.to === 'cow' ? 'moo' : 'baa');
        break;
      case 'bump':
        play('boing', { x: e.x });
        break;
      case 'reload':
        play('click');
        break;
      case 'hook':
        stopLift(e.side);
        liftVoices[e.side] = play('lift', { x: e.x, dur: HOOK.liftTime[e.kind] });
        // Animals and the green man have a voice; crates and packages don't.
        if (HOOK_VOICE[e.kind]) play(HOOK_VOICE[e.kind], { x: e.x });
        break;
      case 'interrupt':
        stopLift(e.side);
        play('womp', { x: e.x });
        break;
      case 'pickup':
        liftVoices[e.side] = null;
        play('ding', { x: e.x });
        break;
      case 'land':
        if (e.delivered && e.golden) play('goldChime', { x: e.x });
        else if (e.delivered) play('chime', { x: e.x, full: !e.stolen });
        break;
      case 'countdown':
        play('beep');
        break;
      case 'go':
        play('beep', { go: true });
        break;
      case 'roundEnd':
        stopVoices();
        play('jingle');
        break;
      case 'release':
        if (HOOK_VOICE[e.kind]) play(HOOK_VOICE[e.kind], { x: e.x });
        break;
      case 'wolfIncoming':
      case 'wolfLeaves':
        play('howl', { x: e.x });
        break;
      case 'wolfEat':
        play('chomp', { x: e.x });
        play('baa', { x: e.x });
        break;
      case 'wolfLand':
        play('growl', { x: e.x });
        break;
      case 'tick':
        play('tick', { x: e.x, urgent: e.n <= 3 });
        break;
      case 'timeBombDrop':
        play('whistle', { x: e.x });
        break;
      case 'timeBombLand':
        play('click', { x: e.x });
        break;
      case 'splat':
        play('splat', { x: e.x });
        break;
      case 'spooked':
        play(e.kind === 'cow' ? 'moo' : 'baa', { x: e.x });
        play('boing', { x: e.x });
        break;
      case 'extinguish':
        play('fizz', { x: e.x });
        break;
      case 'rocketLaunch':
        play('whoosh', { x: e.x });
        break;
      case 'bombDrop':
        play('whistle', { x: e.x });
        break;
      case 'explosion':
        play('boom', { x: e.x, big: e.big });
        break;
      case 'chuteOpen':
        play('flap', { x: e.x });
        break;
      case 'greenmanPanic':
        play('ohNo', { x: e.x });
        break;
      case 'greenmanGone':
        play('splat', { x: e.x });
        break;
      case 'crateIncoming':
        play('horn', { x: e.x });
        break;
      case 'ammoCrate':
        play('click', { x: e.x });
        play('ding', { x: e.x });
        break;
      case 'goldenIncoming':
        play('harp', { x: e.x });
        break;
      case 'dropIncoming':
        play('siren', { x: e.x });
        break;
      case 'restock':
        play('horn');
        play('moo');
        break;
      case 'powerup':
        play('fanfare', { x: e.x });
        break;
      case 'powerEnd':
        stopVoice(laserVoices, e.side);
        play('powerDown');
        break;
      case 'knockLoose':
        play('pop', { x: e.x });
        break;
      case 'laserOn':
        stopVoice(laserVoices, e.side);
        laserVoices[e.side] = play('laser');
        break;
      case 'laserOff':
        stopVoice(laserVoices, e.side);
        break;
    }
  }
}
