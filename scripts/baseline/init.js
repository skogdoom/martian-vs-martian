// Injected before any application module by the browser capture runner.
// Date.now seeds logic; Math.random is a separate cosmetic stream.
(() => {
  const NativeDate = Date;
  const epoch = Date.UTC(2026, 9, 11, 12);
  class FixedDate extends NativeDate {
    constructor(...args) {
      super(...(args.length ? args : [epoch]));
    }
    static now() {
      return epoch;
    }
  }
  window.Date = FixedDate;
  let seed = 12345;
  const random = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Math.random = random;
  const raf = window.requestAnimationFrame.bind(window);
  const cancel = window.cancelAnimationFrame.bind(window);
  // Prevent an uncontrolled frame from advancing scenes during asynchronous boot.
  window.requestAnimationFrame = () => 0;
  window.cancelAnimationFrame = () => {};
  window.__baselineClock = {
    epoch,
    cosmeticSeed: 12345,
    reset() {
      seed = 12345;
    },
    live() {
      window.requestAnimationFrame = raf;
      window.cancelAnimationFrame = cancel;
    },
  };
})();
