// Bounded observer for the soak: no retained history of nodes or subscriptions.
(() => {
  const probe = { sources: new Map(), contexts: [], listeners: [], next: 0 };
  window.__soakProbe = probe;
  const NativeAudio = window.AudioContext;
  window.AudioContext = class extends NativeAudio {
    constructor(...args) {
      super(...args);
      probe.contexts.push(new WeakRef(this));
    }
  };
  for (const method of ['createOscillator', 'createBufferSource']) {
    const native = BaseAudioContext.prototype[method];
    BaseAudioContext.prototype[method] = function (...args) {
      const node = native.apply(this, args),
        id = ++probe.next;
      const record = { node: new WeakRef(node), context: this, stop: null };
      const start = node.start,
        stop = node.stop;
      node.start = (...values) => {
        probe.sources.set(id, record);
        return start.apply(node, values);
      };
      node.stop = (...values) => {
        record.stop = values[0];
        return stop.apply(node, values);
      };
      node.addEventListener('ended', () => probe.sources.delete(id), { once: true });
      return node;
    };
  }
  const add = EventTarget.prototype.addEventListener,
    remove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, options) {
    if (this === window || this === document) probe.listeners.push({ target: this, type, fn });
    return add.call(this, type, fn, options);
  };
  EventTarget.prototype.removeEventListener = function (type, fn, options) {
    const index = probe.listeners.findIndex((r) => r.target === this && r.type === type && r.fn === fn);
    if (index >= 0) probe.listeners.splice(index, 1);
    return remove.call(this, type, fn, options);
  };
  probe.snapshot = () => {
    for (const [id, r] of probe.sources) if (r.stop !== null && r.stop < r.context.currentTime && !r.node.deref()) probe.sources.delete(id);
    return {
      audioContexts: probe.contexts
        .map((r) => r.deref())
        .filter(Boolean)
        .map((c) => c.state),
      audioSources: probe.sources.size,
      listeners: probe.listeners.length,
    };
  };
})();
