import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const folder = new URL('../../baselines/pixi/', import.meta.url);
const testReport = JSON.parse(await readFile(process.argv[2] ?? '/tmp/martian-original-tests.json', 'utf8'));
let originalPaths = null;
try {
  const previous = JSON.parse(await readFile(new URL('checks.json', folder), 'utf8'));
  originalPaths = new Set(previous.tests.identities.map((file) => file.file));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const original = testReport.testResults.filter((file) =>
  originalPaths ? originalPaths.has(relative(root, file.name)) : !file.name.endsWith('/baseline.test.js'),
);
if (!testReport.success || original.length !== 30 || original.flatMap((file) => file.assertionResults).length !== 271) {
  throw new Error('Expected the original 30 files / 271 executed passing tests');
}
const identities = [];
for (const file of original) {
  const contents = await readFile(file.name);
  for (const test of file.assertionResults) {
    if (test.status !== 'passed') throw new Error(`Original test not passed: ${test.fullName}`);
  }
  identities.push({
    file: relative(root, file.name),
    sha256: createHash('sha256').update(contents).digest('hex'),
    tests: file.assertionResults.map((t) => ({ name: t.fullName, status: t.status })).sort((a, b) => a.name.localeCompare(b.name)),
  });
}
identities.sort((a, b) => a.file.localeCompare(b.file));

async function files(folder) {
  const entries = await readdir(folder, { withFileTypes: true });
  return (
    await Promise.all(entries.map((entry) => (entry.isDirectory() ? files(new URL(entry.name + '/', folder)) : [new URL(entry.name, folder)])))
  ).flat();
}
const source = [];
for (const file of await files(new URL('../../src/', import.meta.url))) {
  source.push({
    file: relative(root, fileURLToPath(file)),
    sha256: createHash('sha256')
      .update(await readFile(file))
      .digest('hex'),
  });
}
const build = [];
for (const file of await files(new URL('../../dist/', import.meta.url))) {
  const content = await readFile(file);
  build.push({ file: relative(root, fileURLToPath(file)), bytes: content.length, gzipBytes: gzipSync(content).length });
}
const report = {
  schema: 1,
  logicCommit: 'a6b49901ea7279514a960baf15d5141bee04e4f0',
  capturedFromCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  node: process.version,
  npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(),
  platform: { os: process.platform, architecture: process.arch },
  tests: { originalFiles: 30, originalPassed: 271, totalPassedAtCapture: testReport.numPassedTests, identities },
  source: source.sort((a, b) => a.file.localeCompare(b.file)),
  build: build.sort((a, b) => a.file.localeCompare(b.file)),
  commands: ['npm ci --cache /workspace/.npm-cache --no-audit --no-fund', 'npm run lint', 'npm test', 'npm run build', 'npm run sim -- 10'],
  buildBytesNote: 'Per-file bytes and gzip sizes from dist; not measured HTTP transfer or a sum of eagerly loaded chunks.',
};
await writeFile(new URL('checks.json', folder), JSON.stringify(report, null, 2) + '\n');
const visuals = JSON.parse(await readFile(new URL('visuals.json', folder), 'utf8'));
const images = visuals.captures
  .map(
    (capture) =>
      `<figure><a href="${capture.file}"><img loading="lazy" width="320" src="${capture.file}" alt="${capture.case.name}, frame ${capture.frame}"></a><figcaption>${capture.case.name} · frame ${capture.frame} (+${capture.additionalSteps} steps)</figcaption></figure>`,
  )
  .join('\n');
await writeFile(
  new URL('gallery.html', folder),
  `<!doctype html><html lang="en"><meta charset="utf-8"><title>Pixi preservation baseline</title><style>body{background:#101629;color:#eef;font:16px system-ui}main{display:flex;flex-wrap:wrap}figure{margin:12px}img{object-fit:contain;height:200px}figcaption{max-width:320px}</style><h1>Pixi preservation baseline</h1><p>Fixed-step animation samples. Click an image for full size. See README.md for capture controls and limitations.</p><main>${images}</main></html>\n`,
);
console.log(`Recorded ${identities.length} original test files, source hashes, build sizes, and ${visuals.captures.length} gallery images`);

try {
  const performance = JSON.parse(await readFile(new URL('performance.json', folder), 'utf8'));
  if (performance.complete && performance.samples.length === 12 && performance.samples.every((s) => s.durationMs === 60000 && s.warmupMs === 5000)) {
    const range = (values) => `${Math.min(...values).toFixed(2)}–${Math.max(...values).toFixed(2)}`;
    const rows = ['ordinary', 'stress', 'snow', 'fireworks'].map((profile) => {
      const samples = performance.samples.filter((s) => s.profile === profile);
      return `| ${profile} | ${samples.length} | ${range(samples.map((s) => s.meanFps))} | ${range(samples.map((s) => s.totalCpuMs.p95))} | ${range(samples.map((s) => s.renderSubmissionCpuMs.p95))} |`;
    });
    await writeFile(
      new URL('performance-summary.md', folder),
      `# Pixi cloud performance baseline\n\nThree sequential 60-second samples per profile, after five seconds of warmup.\nChromium ${performance.browser}, Linux x86_64, ANGLE SwiftShader software GPU,\n1280×720 at DPR 1, sound muted. CPU includes harness instrumentation; render\nsubmission excludes asynchronous GPU execution. These are observations, not\nacceptance thresholds or physical laptop GPU results.\n\n| Profile | Runs | Mean rAF fps range | p95 total CPU ms range | p95 submission CPU ms range |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\nSee performance.json for p50/p95/p99, draw calls, object/texture counts, JS heap,\nfixed-step counts, and measurement caveats. Total browser process memory, GPU\nmemory and private particle counts are unavailable. Compare engines sequentially\non the same runner.\n`,
    );
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
