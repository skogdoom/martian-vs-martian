// Synthesized sound effects (Web Audio API). No sample files.
//
// Browsers only allow audio after a user gesture, so the title screen calls
// `unlockAudio()` from its keydown handler. Every sound is a function
// (ac, out, t, opts) that builds a small node graph starting at time `t`, so
// the same code can also render into an OfflineAudioContext.

import { WIDTH, HOOK } from './config.js';

let ctx = null;
let master = null;
let muted = false;
let noiseBuffer = null;
const VOLUME = 0.55;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = createBus(ctx);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : VOLUME, master.context.currentTime, 0.02);
  return muted;
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

  powerDown(ac, out, t) {
    tone(ac, out, t, { type: 'triangle', freq: 784, dur: 0.15, peak: 0.12, hold: 0.05 });
    tone(ac, out, t + 0.14, { type: 'triangle', freq: 392, dur: 0.3, peak: 0.12, hold: 0.08 });
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

  /** Two low horn blasts as an ammo crate comes down. */
  horn(ac, out, t) {
    for (const [at, freq] of [[0, 196], [0.28, 262]]) {
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

export function play(name, { x, ...opts } = {}) {
  if (!ctx || ctx.state !== 'running') return null;
  return SOUNDS[name](ctx, output(x), ctx.currentTime + 0.005, opts);
}

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
        play('thud', { x: e.x });
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
        if (e.kind !== 'crate') play({ cow: 'moo', lamb: 'baa', greenman: 'chirp' }[e.kind], { x: e.x });
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
        for (const side of ['red', 'blue']) {
          stopLift(side);
          stopVoice(laserVoices, side);
        }
        play('jingle');
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
