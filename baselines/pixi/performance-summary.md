# Pixi cloud performance baseline

Three sequential 60-second samples per profile, after five seconds of warmup.
Chromium 154.0.8037.57, Linux x86_64, ANGLE SwiftShader software GPU,
1280×720 at DPR 1, sound muted. CPU includes harness instrumentation; render
submission excludes asynchronous GPU execution. These are observations, not
acceptance thresholds or physical laptop GPU results.

| Profile | Runs | Mean rAF fps range | p95 total CPU ms range | p95 submission CPU ms range |
| --- | --- | --- | --- | --- |
| ordinary | 3 | 9.98–10.30 | 2.40–2.70 | 1.50–1.60 |
| stress | 3 | 7.87–8.01 | 9.40–11.10 | 7.60–9.20 |
| snow | 3 | 9.62–9.82 | 2.80–3.50 | 1.80–2.70 |
| fireworks | 3 | 9.90–10.22 | 3.20–3.50 | 2.00–2.60 |

See performance.json for p50/p95/p99, draw calls, object/texture counts, JS heap,
fixed-step counts, and measurement caveats. Total browser process memory, GPU
memory and private particle counts are unavailable. Compare engines sequentially
on the same runner.
