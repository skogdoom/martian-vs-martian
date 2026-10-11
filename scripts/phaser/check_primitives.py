"""Milestone 2: independent Pixi gallery, bounded pixel checks and real ownership.

Use a dev server for --base-url (the real Pixi factories are imported there).
--phaser-url can point at a production preview, including a subdirectory.
No command updates the preservation baseline.
"""
import argparse
import hashlib
import io
import json
import math
import tempfile
from pathlib import Path
from shutil import which

from PIL import Image, ImageChops, ImageDraw, ImageFilter
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
LAYOUTS = [(1280, 720), (1440, 900), (1024, 768), (2000, 720), (600, 1200)]
ITEMS = ['saucer-red', 'saucer-blue', 'cow', 'lamb', 'wolf', 'parachute',
         'glow', 'paths', 'gradient', 'text-left', 'text-center', 'nested-tint']


def open_page(context, base, phaser=False, renderer='auto'):
    page = context.new_page()
    failures = []
    page.on('pageerror', lambda error: failures.append(str(error)))
    page.on('console', lambda message: failures.append(message.text) if message.type == 'error' else None)
    page.add_init_script(path=str(ROOT / 'scripts/baseline/init.js'))
    if phaser:
        # Phaser creates its Scene on the first frame; the static gallery has no
        # animation/RNG updates. Freeze its loop as soon as the Scene is ready.
        page.add_init_script('window.__baselineClock.live()')
    query = '?date=2026-02-15'
    if phaser:
        query += '&engine=phaser&gallery=primitives&renderer=' + renderer
    page.goto(base.rstrip('/') + '/' + query)
    page.wait_for_function('!!window.__game', polling=50)
    if phaser:
        page.wait_for_function('window.__game.scene?.tiles?.length === 12', polling=50)
        page.evaluate("""() => {
          __game.app.loop.sleep();
          __game.game.frames.reset(0); __game.game.loop.reset();
          window.__now = 0;
          window.__draw = () => { __game.scene.render(); __game.app.step(__now += 100, 100); };
        }""")
        page.keyboard.press('Space')
        page.evaluate('window.__draw()')
    else:
        page.keyboard.press('Space')
        page.locator('#start').evaluate('(node) => node.remove()') if page.locator('#start').count() else None
        page.evaluate("""async () => {
          const gallery = await import(new URL('scripts/phaser/pixi_gallery.js', location.href));
          gallery.installPixiGallery();
          window.__draw = () => { __game.scene.render(); __game.app.render(); };
        }""")
    assert page.locator('canvas').count() == 1
    assert page.locator('#start').count() == 0
    assert not failures, failures
    return page, failures


def set_layout(page, width, height, fixed, phaser):
    page.set_viewport_size({'width': width, 'height': height})
    if phaser:
        if page.evaluate('__game.session.ratio169') != fixed:
            page.keyboard.press('v')
            page.evaluate('window.__draw()')
        page.evaluate('__game.game.fit(); window.__draw()')
        assert page.evaluate('__game.session.ratio169') == fixed
    else:
        page.evaluate("""async fixed => {
          __game.app.resize();
          const layout = await import(new URL('src/layout.js', location.href));
          layout.setFixed169(fixed); window.__draw();
        }""", fixed)
    return Image.open(io.BytesIO(page.screenshot(scale='device'))).convert('RGB')


def comparison(reference, candidate, radius=1, tolerance=3, check_silhouette=True):
    assert reference.size == candidate.size
    # The reference alone defines the bounded edge band. A candidate
    # cannot hide added shapes by declaring its own edges. Tessellated Pixi paths
    # and sampled Canvas paths blend differently where several shapes intersect;
    # allow coverage/blending differences ONLY in that band. Flat interiors stay
    # within 3. A separate silhouette check rejects absent thin strokes too.
    low = reference.filter(ImageFilter.MinFilter(2 * radius + 1))
    high = reference.filter(ImageFilter.MaxFilter(2 * radius + 1))
    difference = ImageChops.difference(reference, candidate)
    channels = list(difference.get_flattened_data())
    bad = sum(max(error) > tolerance and max(h - l for h, l in zip(upper, lower)) <= 6
              for error, upper, lower in zip(channels, high.get_flattened_data(), low.get_flattened_data()))
    def foreground(image):
        mask = Image.new('L', image.size)
        mask.putdata([255 if max(abs(c - b) for c, b in zip(pixel, (16, 28, 61))) > 16 else 0
                      for pixel in image.get_flattened_data()])
        return mask
    a, b = foreground(reference), foreground(candidate)
    nearby_a = a.filter(ImageFilter.MaxFilter(2 * radius + 1))
    nearby_b = b.filter(ImageFilter.MaxFilter(2 * radius + 1))
    silhouette = ImageChops.lighter(ImageChops.subtract(a, nearby_b), ImageChops.subtract(b, nearby_a))
    missing = sum(value != 0 for value in silhouette.get_flattened_data()) if check_silhouette else 0
    return {'outside_edge_or_color_bound': bad,
            'outside_silhouette_bound': missing,
            'max_channel_error': max(max(pixel) for pixel in channels),
            'mean_channel_error': round(sum(sum(pixel) for pixel in channels) / (len(channels) * 3), 6)}


def check_images(reference, candidate, width, height, fixed, dpr):
    scale = min(width / 1280, height / 720)
    visible = min(height / scale, 720 if fixed else 1080)
    offset_x = math.floor((width - 1280 * scale) / 2 + 0.5)
    offset_y = math.floor((height - visible * scale) / 2 + 0.5)
    def crop(image, area):
        x1, y1, x2, y2 = area
        return image.crop(tuple(round(value * dpr) for value in (
            offset_x + x1 * scale, offset_y + y1 * scale,
            offset_x + x2 * scale, offset_y + y2 * scale)))
    checks = []
    for index, name in enumerate(ITEMS):
        x, y = 160 + index % 4 * 320, 145 + index // 4 * 215
        a = crop(reference, (x - 155, y - 105, x + 155, y + 105))
        b = crop(candidate, (x - 155, y - 105, x + 155, y + 105))
        # A gradient's colour-threshold contour is not a geometric silhouette;
        # rounding can move it despite a <=2-level match of every sky pixel.
        result = comparison(a, b, radius=max(1, math.ceil(scale * dpr)), check_silhouette=name != 'gradient')
        checks.append({'name': name, **result})
        assert result['outside_edge_or_color_bound'] == 0 and result['outside_silhouette_bound'] == 0, {name: result, 'viewport': [width, height], 'dpr': dpr, 'fixed': fixed}
    # The entire interior of the miniature sky must preserve the third stop.
    a = crop(reference, (32, 512, 288, 628))
    b = crop(candidate, (32, 512, 288, 628))
    gradient = max(max(pixel) for pixel in ImageChops.difference(a, b).get_flattened_data())
    assert gradient <= 2, {'gradient_channel_error': gradient}
    # Oversized backing scenery must remain clipped by the real field viewport.
    if offset_x >= 3:
        assert candidate.getpixel((dpr, height * dpr // 2)) == (0, 0, 0)
        assert candidate.getpixel(((width - 2) * dpr, height * dpr // 2)) == (0, 0, 0)
    if offset_y >= 3:
        assert candidate.getpixel((width * dpr // 2, dpr)) == (0, 0, 0)
        assert candidate.getpixel((width * dpr // 2, (height - 2) * dpr)) == (0, 0, 0)
    return checks, gradient


def right_align(page, phaser):
    page.evaluate("""phaser => {
      const text = __game.scene.tiles.find(tile => tile.name === 'text-center').art;
      if (phaser) text.setAlign('right'); else text.style.align = 'right';
      window.__draw();
    }""", phaser)
    return Image.open(io.BytesIO(page.screenshot(scale='device'))).convert('RGB')


def negative_controls(reference):
    # Prove that the edge allowance cannot admit missing artwork/ropes, changed
    # interiors, or displaced glyphs. These mutations never touch application
    # images or frozen goldens; they are deliberately broken in-memory copies.
    results = {}
    for name, area in [('missing-saucer', (5, 40, 315, 245)),
                       ('missing-thin-ropes', (435, 361, 525, 412)),
                       ('changed-interior', (745, 125, 825, 145))]:
        broken = reference.copy()
        ImageDraw.Draw(broken).rectangle(area, fill=(16, 28, 61) if name.startswith('missing') else (255, 0, 255))
        result = comparison(reference, broken)
        assert result['outside_edge_or_color_bound'] or result['outside_silhouette_bound'], name
        results[name] = result
    text = reference.crop((645, 470, 955, 670))
    result = comparison(text, ImageChops.offset(text, 4, 0))
    assert result['outside_silhouette_bound'] or result['outside_edge_or_color_bound']
    results['displaced-text'] = result
    return results


def preservation():
    baseline = json.loads((ROOT / 'baselines/pixi/checks.json').read_text())
    records = baseline['source'] + baseline['tests']['identities']
    for record in records:
        assert hashlib.sha256((ROOT / record['file']).read_bytes()).hexdigest() == record['sha256'], record['file']
    return {'original_source_hashes_unchanged': len(baseline['source']),
            'original_test_files_unchanged': len(baseline['tests']['identities']),
            'original_test_identities': sum(len(file['tests']) for file in baseline['tests']['identities'])}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:5174/')
    parser.add_argument('--phaser-url')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    output = args.output or Path(tempfile.mkdtemp(prefix='martian-primitives-'))
    if output.resolve().is_relative_to(ROOT / 'baselines/pixi'):
        raise ValueError('Primitive checks must not overwrite frozen Pixi references')
    output.mkdir(parents=True, exist_ok=True)
    report = {'complete': False, 'pixi_url': args.base_url, 'phaser_url': args.phaser_url or args.base_url,
              'edge_radius': 'max(1, ceil(layout_scale * DPR)) device pixels', 'edge_allowance': 'coverage/blending only; bounded silhouette in both directions', 'interior_color_allowance': 3,
              'gradient_color_allowance': 2, 'preservation': preservation(), 'cases': [], 'ownership': []}
    (output / 'checks.json').write_text(json.dumps(report, indent=2) + '\n')
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=which('chromium'), args=[
            '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        report['browser'] = 'Chromium ' + browser.version
        for renderer in ['auto', 'canvas']:
            for dpr in [1, 2]:
                context = browser.new_context(viewport={'width': 1280, 'height': 720}, device_scale_factor=dpr)
                pixi, pixi_failures = open_page(context, args.base_url)
                phaser, phaser_failures = open_page(context, args.phaser_url or args.base_url, True, renderer)
                reference_label = pixi.evaluate("""() => {
                  const label = __game.scene.tiles.find(tile => tile.name === 'text-center').art;
                  return {width: label.width, height: label.height};
                }""")
                assert phaser.evaluate('__game.app.renderer.type') == (1 if renderer == 'canvas' else 2)
                for width, height in LAYOUTS:
                    for fixed in [False, True]:
                        reference = set_layout(pixi, width, height, fixed, False)
                        candidate = set_layout(phaser, width, height, fixed, True)
                        name = f'{renderer}-dpr{dpr}-{width}x{height}-{"fixed" if fixed else "sky"}'
                        reference.save(output / (name + '-pixi.png'))
                        candidate.save(output / (name + '-phaser.png'))
                        checks, gradient = check_images(reference, candidate, width, height, fixed, dpr)
                        if not report['cases']:
                            report['negative_controls'] = negative_controls(reference)
                        report['cases'].append({'name': name, 'renderer': renderer, 'dpr': dpr,
                                                'viewport': [width, height], 'fixed169': fixed,
                                                'gradient_max_channel_error': gradient, 'label_reference_bounds': reference_label, 'tiles': checks})
                        (output / 'checks.json').write_text(json.dumps(report, indent=2) + '\n')
                reference = right_align(pixi, False)
                candidate = right_align(phaser, True)
                checks, _ = check_images(reference, candidate, width, height, fixed, dpr)
                report['cases'][-1]['right_aligned_text'] = checks[10]
                assert not pixi_failures and not phaser_failures, [pixi_failures, phaser_failures]
                if not args.phaser_url:
                    report['ownership'].append({'renderer': renderer, 'dpr': dpr, **phaser.evaluate("""async referenceLabel => {
                      const {checkOwnership} = await import(new URL('scripts/phaser/ownership.js', location.href));
                      return checkOwnership(__game.game, referenceLabel);
                    }""", reference_label)})
                    assert not phaser_failures, phaser_failures
                print(f'Passed {renderer}, DPR {dpr}: 10 layouts, 120 tiles, right-aligned text' +
                      (', ownership' if not args.phaser_url else ''), flush=True)
                context.close()
        browser.close()
    report['complete'] = True
    (output / 'checks.json').write_text(json.dumps(report, indent=2) + '\n')
    print(f'Primitive gate passed; evidence: {output}')


if __name__ == '__main__':
    main()
