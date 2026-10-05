import { describe, it, expect } from 'vitest';
import { createSoundThrottle } from '../src/audio.js';

describe('the sound throttle', () => {
  it('lets a few of the same sound start at once, then holds the rest back for a moment', () => {
    const t = createSoundThrottle();
    expect([1, 2, 3, 4].map(() => t.allow('zap', 10))).toEqual([true, true, true, false]);
    expect(t.allow('boom', 10)).toBe(true); // another sound is fine
    expect(t.allow('zap', 10.2)).toBe(true); // and a little later, again
  });

  it('caps all sounds starting together', () => {
    const t = createSoundThrottle();
    let allowed = 0;
    for (let i = 0; i < 40; i++) if (t.allow(`s${i}`, 5)) allowed++;
    expect(allowed).toBe(24);
    expect(t.allow('late', 5.3)).toBe(true);
  });

  it('keeps working when a new audio context starts its clock at zero again', () => {
    const t = createSoundThrottle();
    // Busy at 300 s on the old clock...
    for (let i = 0; i < 30; i++) t.allow(`s${i % 5}`, 300 + i * 0.01);
    // ...then a fresh context: its clock reads 0.5 s. Without forgetting the old
    // times, every sound from here on would be refused for good.
    let allowed = 0;
    for (let i = 0; i < 100; i++) if (t.allow('zap', 0.5 + i * 0.1)) allowed++;
    expect(allowed).toBe(100);
  });
});
