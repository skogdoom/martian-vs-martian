// Exercise the unchanged recipes with Chromium's real OfflineAudioContext.
// This helper is served only by Vite for the verification script.
import { SOUNDS } from '../../src/audio.js';

const RATE = 48000;
const VOLUME = 0.55;

function bus(ac, muted = false) {
  const master = ac.createGain();
  master.gain.value = muted ? 0 : VOLUME;
  const compressor = ac.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.ratio.value = 4;
  master.connect(compressor).connect(ac.destination);
  return master;
}

function output(ac, master, pan = null) {
  if (pan === null) return master;
  const panner = ac.createStereoPanner();
  panner.pan.value = pan;
  panner.connect(master);
  return panner;
}

function metrics(buffer) {
  const channels = [...Array(buffer.numberOfChannels)].map((_, i) => buffer.getChannelData(i));
  let first = buffer.length;
  let last = 0;
  let peak = 0;
  let crossings = 0;
  const sum = [0, 0];
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < channels.length; c++) {
      const value = channels[c][i];
      if (!Number.isFinite(value)) throw Error('Non-finite audio sample');
      peak = Math.max(peak, Math.abs(value));
      sum[c] += value * value;
      if (Math.abs(value) > 0.0001) {
        first = Math.min(first, i);
        last = Math.max(last, i);
      }
    }
    if (i > 0 && channels[0][i] * channels[0][i - 1] < 0) crossings++;
  }
  return {
    rate: buffer.sampleRate,
    frames: buffer.length,
    peak,
    rms: sum.map((v) => Math.sqrt(v / buffer.length)),
    first: first / RATE,
    last: last / RATE,
    crossings,
  };
}

export async function renderRecipe({ name, opts = {}, pan = null, stop = null, muted = false }) {
  const ac = new OfflineAudioContext(2, RATE * 4, RATE);
  const result = SOUNDS[name](ac, output(ac, bus(ac, muted), pan), 0.1, opts);
  if (result?.stop) result.stop(stop ?? 0.85);
  const buffer = await ac.startRendering();
  return metrics(buffer);
}

export async function renderTrace(trace, duration = 12) {
  const ac = new OfflineAudioContext(2, RATE * duration, RATE);
  const master = bus(ac);
  const voices = new Map();
  for (const row of trace) {
    if (row.action === 'stop') {
      voices.get(row.voice)?.stop(row.t);
      continue;
    }
    const result = SOUNDS[row.name](ac, output(ac, master, row.pan), row.t, row.opts);
    if (result?.stop) voices.set(row.voice, result);
  }
  const buffer = await ac.startRendering();
  // Stereo 16-bit PCM is a portable review artifact. Assertions use float PCM.
  const bytes = new Uint8Array(buffer.length * 4);
  const data = new DataView(bytes.buffer);
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < 2; c++) data.setInt16(i * 4 + c * 2, Math.round(Math.max(-1, Math.min(1, buffer.getChannelData(c)[i])) * 32767), true);
  }
  const floats = new Float32Array([...buffer.getChannelData(0), ...buffer.getChannelData(1)]);
  const hash = await crypto.subtle.digest('SHA-256', floats.buffer);
  function encode(data) {
    let binary = '';
    for (let offset = 0; offset < data.length; offset += 16384) binary += String.fromCharCode(...data.subarray(offset, offset + 16384));
    return btoa(binary);
  }
  return {
    ...metrics(buffer),
    float_sha256: [...new Uint8Array(hash)].map((v) => v.toString(16).padStart(2, '0')).join(''),
    float_pcm: encode(new Uint8Array(floats.buffer)),
    pcm: encode(bytes),
  };
}
