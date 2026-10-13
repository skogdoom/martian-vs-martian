// Browser-only milestone 5 probe. Loaded before either engine; no runtime imports.
// Native Web Audio nodes and contexts still perform all synthesis and playback.
(() => {
  const probe = {
    contexts: [],
    created: {},
    activeSources: new Set(),
    nodes: [],
    stops: [],
    sources: new Map(),
    endedEvents: 0,
    collectedAfterStop: 0,
    recipes: [],
    operations: [],
    automations: [],
    voices: 0,
    clock: null,
  };
  window.__audioProbe = probe;
  const NativeAudio = window.AudioContext;
  if (NativeAudio) {
    window.AudioContext = class extends NativeAudio {
      constructor(...args) {
        super(...args);
        probe.contexts.push(this);
        probe.operations.push({ op: 'create' });
        const currentTime = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'currentTime').get;
        Object.defineProperty(this, 'currentTime', { get: () => probe.clock ?? currentTime.call(this) });
        for (const method of ['resume', 'suspend', 'close']) {
          const native = this[method];
          this[method] = (...values) => {
            probe.operations.push({ op: method });
            return native.apply(this, values);
          };
        }
      }
    };
  }
  // Track only source IDs until their real ended event; retain no source nodes.
  let id = 0;
  for (const method of [
    'createOscillator',
    'createBufferSource',
    'createGain',
    'createBiquadFilter',
    'createStereoPanner',
    'createDynamicsCompressor',
  ]) {
    const native = BaseAudioContext.prototype[method];
    if (!native) continue;
    BaseAudioContext.prototype[method] = function (...args) {
      const node = native.apply(this, args);
      probe.nodes.push(new WeakRef(node));
      probe.created[method] = (probe.created[method] ?? 0) + 1;
      if (node instanceof AudioScheduledSourceNode) {
        const sourceId = ++id;
        probe.sources.set(sourceId, { node: new WeakRef(node), context: this, method, stop: null });
        const start = node.start;
        const stop = node.stop;
        node.start = (...values) => {
          probe.activeSources.add(sourceId);
          return start.apply(node, values);
        };
        node.addEventListener(
          'ended',
          () => {
            probe.endedEvents++;
            probe.activeSources.delete(sourceId);
          },
          { once: true },
        );
        node.stop = (...values) => {
          probe.stops.push({ source: sourceId, time: values[0] });
          probe.sources.get(sourceId).stop = values[0];
          return stop.apply(node, values);
        };
      }
      if (method === 'createGain') {
        const target = node.gain.setTargetAtTime;
        node.gain.setTargetAtTime = (...values) => {
          probe.automations.push({ method: 'gainTarget', values });
          return target.apply(node.gain, values);
        };
      }
      if (method === 'createDynamicsCompressor') probe.compressor = node;
      return node;
    };
  }
  probe.installRecipes = (audio) => {
    probe.audio = audio;
    for (const [name, recipe] of Object.entries(audio.SOUNDS)) {
      audio.SOUNDS[name] = (ac, out, t, opts = {}) => {
        const voice = ++probe.voices;
        probe.recipes.push({ action: 'start', name, voice, t, pan: out.pan?.value ?? null, opts });
        const result = recipe(ac, out, t, opts);
        if (result?.stop) {
          const stop = result.stop;
          result.stop = (at) => {
            probe.recipes.push({ action: 'stop', name, voice, t: at });
            return stop.call(result, at);
          };
        }
        return result;
      };
    }
  };
  // Chromium can collect a source wrapper before delivering its ended event.
  // Collection alone is insufficient: require its scheduled stop to have passed.
  // An unscheduled sustained carrier must still fail the drainage gate.
  probe.drainCount = () => {
    for (const id of probe.activeSources) {
      const row = probe.sources.get(id);
      if (row.stop !== null && row.stop < row.context.currentTime && !row.node.deref()) {
        probe.activeSources.delete(id);
        probe.collectedAfterStop++;
      }
    }
    return probe.activeSources.size;
  };
  probe.snapshot = () => ({
    contexts: probe.contexts.map((ac) => ({ state: ac.state, sampleRate: ac.sampleRate })),
    activeSources: probe.drainCount(),
    endedEvents: probe.endedEvents,
    collectedAfterScheduledStop: probe.collectedAfterStop,
    retainedNodes: probe.nodes.filter((node) => node.deref()).length,
    activeSourceDetails: [...probe.activeSources].map((id) => {
      const row = probe.sources.get(id);
      return {
        id,
        method: row.method,
        stop: row.stop,
        now: row.context.currentTime,
        state: row.context.state,
        wrapperAlive: Boolean(row.node.deref()),
      };
    }),
    created: { ...probe.created },
    operations: [...probe.operations],
    compressor: probe.compressor ? { threshold: probe.compressor.threshold.value, ratio: probe.compressor.ratio.value } : null,
  });
})();
