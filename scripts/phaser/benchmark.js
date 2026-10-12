// Local physical-device runner. Each engine runs alone in an iframe.
const params = new URLSearchParams(location.search);
const profiles = params.get('profiles')?.split(',') ?? ['ordinary', 'stress', 'snow', 'fireworks'];
const seconds = Number(params.get('seconds') ?? 60);
const repeats = Number(params.get('repeats') ?? 3);
const report = {
  schema: 1,
  complete: false,
  userAgent: navigator.userAgent,
  dpr: devicePixelRatio,
  samples: [],
  buildMode: 'development',
  profiles,
  seconds,
  repeats,
};
window.__benchmarkReport = report;
const status = document.getElementById('status');
document.getElementById('run').onclick = async () => {
  document.getElementById('run').disabled = true;
  Object.assign(status.style, { position: 'fixed', top: '4px', left: '4px', zIndex: 2, background: '#101c3d' });
  try {
    const allowed = ['ordinary', 'abduction', 'crowded', 'stress', 'animal-rain', 'snow', 'fireworks'];
    if (
      !Number.isInteger(seconds) ||
      seconds < 1 ||
      !Number.isInteger(repeats) ||
      repeats < 1 ||
      profiles.some((profile) => !allowed.includes(profile))
    )
      throw Error('Choose known profiles and positive integer seconds/repeats.');
    for (const profile of profiles)
      for (let repeat = 1; repeat <= repeats; repeat++)
        for (const engine of ['pixi', 'phaser']) {
          status.textContent = `${profile}, ${engine}, run ${repeat}/${repeats}. Keep this tab visible.`;
          const date = profile === 'snow' ? '2026-12-24' : profile === 'fireworks' ? '2026-12-31' : '2026-02-15';
          const frame = document.createElement('iframe');
          let html = await (await fetch('../../index.html')).text();
          const seed = `<script>window.AudioContext=undefined;window.webkitAudioContext=undefined;const D=Date;window.Date=class extends D{constructor(...a){super(...(a.length?a:['${date}T12:00:00']));}static now(){return 1790000000123;}};let seed=12345;window.__resetCosmetics=()=>seed=12345;Math.random=()=>{seed=(seed+0x6d2b79f5)>>>0;let t=Math.imul(seed^(seed>>>15),seed|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};crypto.getRandomValues=a=>{for(let i=0;i<a.length;i++)a[i]=12345;return a;};</script>`;
          html = html.replace('<head>', `<head><base href="${new URL('../../', location.href)}">${seed}`);
          html = html.replace('/src/entry.js', engine === 'phaser' ? '/src/phaser/main.js' : '/src/main.js');
          frame.srcdoc = html;
          document.getElementById('game').replaceChildren(frame);
          await new Promise((resolve) => (frame.onload = resolve));
          const deadline = performance.now() + 60000;
          while (!frame.contentWindow.__game) {
            if (performance.now() > deadline) throw Error(`${engine} did not start within 60 seconds; check the browser console.`);
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          const sample = await frame.contentWindow.eval(
            `import('${new URL('./performance.js', location.href)}').then(async m=>{await m.start();return m.measure({profile:'${profile}',durationMs:${seconds * 1000},fixtureBase:'${new URL('../../', location.href)}'});})`,
          );
          sample.repeat = repeat;
          sample.engine = engine;
          report.samples.push(sample);
          const row = document.createElement('tr');
          for (const value of [profile, engine, repeat, sample.meanFps.toFixed(2), sample.totalCpuMs.p95.toFixed(2), sample.drawCalls.p95]) {
            const cell = document.createElement('td');
            cell.textContent = value;
            row.append(cell);
          }
          document.getElementById('rows').append(row);
          frame.remove();
        }
    report.complete = true;
    status.textContent = 'Comparison finished. Save the report for review.';
  } catch (error) {
    status.textContent = `Stopped: ${error.message}. Save the partial report.`;
  }
  document.getElementById('save').disabled = false;
};
document.getElementById('save').onclick = () => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  link.download = 'martian-performance.json';
  link.click();
  URL.revokeObjectURL(link.href);
};
