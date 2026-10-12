"""Render moving flags/ribbons and reject recurring WebGL texture uploads.

The source server supplies audit helpers; --phaser-url may serve the immutable
production candidate. The game and artwork factory come from that candidate.
"""
import argparse
import hashlib
import json
import tempfile
from pathlib import Path
from shutil import which

from playwright.sync_api import sync_playwright
from check_artwork import open_page, prepare
from check_primitives import preservation

ROOT = Path(__file__).resolve().parents[2]
PROBE = r"""() => {
  const {app, scene} = __game;
  app.step(0, 0);
  // The independent artwork fixture retains the actual backdrop view. Its last
  // four children are the two animated flags followed by the pen labels.
  const flags = scene.fixture.tracked[0].list.slice(-4, -2);
  const geometry = () => JSON.stringify(flags.map(flag => scene.art.recipes(flag)));
  const before = geometry(), texturesBefore = app.textures.getTextureKeys().length;
  const gl = app.renderer.gl, restore = [];
  let uploads = 0, draws = 0;
  for (const name of ['texImage2D', 'texSubImage2D', 'drawElements', 'drawArrays']) {
    if (!gl?.[name]) continue;
    const original = gl[name];
    gl[name] = function(...args) {
      if (name.startsWith('tex')) uploads++; else draws++;
      return original.apply(this, args);
    };
    restore.push(() => gl[name] = original);
  }
  try {
    for (let i = 0; i < 120; i++) {
      scene.update(1 / 60); scene.render(); app.step(i * 1000 / 60, 0);
    }
  } finally { for (const fn of restore) fn(); }
  return {frames: 120, webgl: Boolean(gl), uploads, draws,
    texturesBefore, texturesAfter: app.textures.getTextureKeys().length,
    flagTypes: flags.map(flag => flag.type), geometryChanged: geometry() !== before};
}"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:5174/')
    parser.add_argument('--phaser-url')
    parser.add_argument('--runtime-source-dir', type=Path, help='Source snapshot matching the served build; defaults to checkout')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    out = args.output or Path(tempfile.mkdtemp(prefix='martian-flags-'))
    if out.resolve().is_relative_to(ROOT / 'baselines/pixi'):
        raise ValueError('Do not overwrite frozen references')
    out.mkdir(parents=True, exist_ok=True)
    runtime_root = args.runtime_source_dir or ROOT
    if not (runtime_root / 'src').is_dir():
        raise ValueError('Runtime source snapshot must contain src/')
    report = {'complete': False, 'preservation': preservation(), 'cases': [],
              'source_url': args.base_url, 'runtime_url': args.phaser_url or args.base_url,
              'runtime_source_sha256': {str(p.relative_to(runtime_root)): hashlib.sha256(p.read_bytes()).hexdigest()
                                        for p in sorted((runtime_root / 'src').rglob('*.js'))},
              'caveat': 'Deterministic rendered frames check allocations, not physical Safari performance.'}
    def save():
        (out / 'checks.json').write_text(json.dumps(report, indent=2) + '\n')
    save()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=which('chromium'), args=[
                '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            report['browser'] = browser.version
            for renderer, dpr in [('auto', 1), ('canvas', 1), ('auto', 2), ('canvas', 2)]:
                for date in ['02-15', '06-19']:
                    context = browser.new_context(viewport={'width': 1280, 'height': 720}, device_scale_factor=dpr)
                    page, errors = open_page(context, args.phaser_url or args.base_url, date, True, renderer, args.base_url)
                    prepare(page, 'scenery', 'waxing', True)
                    row = {'renderer': renderer, 'dpr': dpr, 'date': date, **page.evaluate(PROBE)}
                    report['cases'].append(row)
                    save()
                    assert not errors, errors
                    assert row['geometryChanged'], 'Flag geometry did not animate'
                    assert row['webgl'] == (renderer == 'auto'), 'Requested renderer was unavailable'
                    assert row['flagTypes'] == ['Graphics' if row['webgl'] else 'Container'] * 2, row
                    if row['webgl']:
                        assert row['draws'] > 0 and row['uploads'] == 0, row
                        assert row['texturesAfter'] == row['texturesBefore'], row
                    context.close()
                    print('Moving flags passed:', renderer, dpr, date, 'uploads:', row['uploads'], flush=True)
            browser.close()
        assert len(report['cases']) == 8
        report['complete'] = True
    finally:
        save()


if __name__ == '__main__':
    main()
