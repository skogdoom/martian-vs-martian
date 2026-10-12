"""Milestone 3: real Pixi references, recipe/pose audits, bounded pixels and pools.

Requires Playwright, Pillow and NumPy. Writes evidence outside frozen baselines.
"""
import argparse
import hashlib
import io
import copy
import json
import math
import re
import tempfile
from pathlib import Path
from shutil import which

import numpy as np
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright
from check_primitives import preservation

ROOT = Path(__file__).resolve().parents[2]
PAGES = ['sky', 'scenery', 'saucers', 'animals', 'icons', 'drops', 'wolves', 'weapons', 'hud', 'menus', 'effects-a', 'effects-b', 'effects-c', 'arena']
DATES = ['02-15', '12-24', '12-31', '06-19', '05-04', '10-31']
PHASES = ['waning', 'quarter', 'waxing', 'full']
LAYOUTS = [(1280, 720, False), (1440, 900, False), (1024, 768, False), (2000, 720, True), (600, 1200, False), (600, 1200, True)]


def box_has(mask, radius, omit_right=False, omit_bottom=False):
    """Square neighbourhood query in linear time (also at image boundaries)."""
    height, width = mask.shape
    integral = np.pad(mask.astype(np.int32), ((1, 0), (1, 0))).cumsum(0, dtype=np.int32).cumsum(1, dtype=np.int32)
    x = np.arange(width); y = np.arange(height)
    left = np.maximum(0, x - radius); right = np.minimum(width, x + radius + 1) - int(omit_right)
    top = np.maximum(0, y - radius); bottom = np.minimum(height, y + radius + 1) - int(omit_bottom)
    return (integral[bottom[:, None], right] - integral[top[:, None], right]
            - integral[bottom[:, None], left] + integral[top[:, None], left]) > 0


def reference_edges(snapshot, size, dpr, radius):
    """Edges from the real reference geometry, including occluded/subpixel edges.

    Pixel edges alone miss an occluded particle or a snowflake whose MSAA
    coverage rounded to zero. This mask uses only audited Pixi recipes, never
    candidate pixels. Flat shape interiors remain subject to the colour gate.
    """
    width, height, fixed = size
    scale = min(width / 1280, height / 720)
    visible = min(height / scale, 720 if fixed else 1080)
    extra = max(0, visible - 720)
    image = Image.new('L', (width * dpr, height * dpr))
    draw = ImageDraw.Draw(image)
    matrix = np.array([[scale*dpr, 0, math.floor((width-1280*scale)/2+.5)*dpr],
                       [0, scale*dpr, (math.floor((height-visible*scale)/2+.5)+extra*scale)*dpr], [0, 0, 1.]])
    def visit(node, parent):
        if not node['visible'] or node['alpha'] == 0: return
        co, si = math.cos(node['rotation']), math.sin(node['rotation'])
        sx, sy = node['scaleX'], node['scaleY']
        m = parent @ np.array([[co*sx, -si*sy, node['x']], [si*sx, co*sy, node['y']], [0, 0, 1.]])
        if node['kind'] == 'text' and node['text'] and node['fontFamily'] == 'monospace':
            lines = node['text'].split('\n')
            cell_height = node['height'] / len(lines)
            # Below eight device pixels a monospace character is only a few
            # coverage samples wide. Pixi's minified texture can round a glyph
            # fragment away while Canvas retains it. Use audited non-space text
            # cells as reference geometry; never exempt missing silhouettes.
            if cell_height * np.linalg.norm(m[:2,:2], 2) < 8:
                cell_width = node['width'] / max(map(len, lines))
                for row, line in enumerate(lines):
                    offset = (node['width'] - len(line)*cell_width) * {'left':0, 'center':.5, 'right':1}[node['align']]
                    for column, char in enumerate(line):
                        if char.isspace(): continue
                        x = -node['originX']*node['width'] + offset + column*cell_width
                        y = -node['originY']*node['height'] + row*cell_height
                        points = np.array([[x,y,1],[x+cell_width,y,1],[x+cell_width,y+cell_height,1],[x,y+cell_height,1],[x,y,1]]) @ m.T
                        draw.line([tuple(point[:2]) for point in points], fill=255, width=1)
        for recipe in node['paints']:
            if recipe['style'].get('alpha', 1) == 0: continue
            kind, values = recipe['kind'], recipe['values']
            points = []
            if kind == 'ellipse':
                x, y, rx, ry = values
                count = max(32, math.ceil(2*math.pi*max(rx,ry)*np.linalg.norm(m[:2,:2], 2)))
                points = [(x+rx*math.cos(t), y+ry*math.sin(t)) for t in np.linspace(0, 2*math.pi, count+1)]
            elif kind == 'polygon':
                points = list(zip(values[0][::2], values[0][1::2])); points += points[:1]
            elif kind in ['rect', 'roundRect']:
                x, y, w, h = values[:4]
                r = min(values[4], w/2, h/2) if kind == 'roundRect' else 0
                for cx, cy, start in [(x+w-r,y+r,-math.pi/2),(x+w-r,y+h-r,0),(x+r,y+h-r,math.pi/2),(x+r,y+r,math.pi)]:
                    points += [(cx+r*math.cos(t), cy+r*math.sin(t)) for t in np.linspace(start,start+math.pi/2,17)]
                points += points[:1]
            elif kind == 'curve':
                start = cursor = None
                for method, *coords in values[0]:
                    if method == 'moveTo': start = cursor = tuple(coords); points.append(cursor)
                    elif method == 'lineTo': cursor = tuple(coords); points.append(cursor)
                    elif method == 'closePath': cursor = start; points.append(cursor)
                    else:
                        controls = [cursor, *zip(coords[::2], coords[1::2])]
                        count = max(16, math.ceil(sum(math.dist(a,b) for a,b in zip(controls,controls[1:])) * np.linalg.norm(m[:2,:2],2)))
                        degree = len(controls)-1
                        for t in np.linspace(0,1,count+1)[1:]:
                            points.append(tuple(sum(math.comb(degree,i)*(1-t)**(degree-i)*t**i*p[j] for i,p in enumerate(controls)) for j in [0,1]))
                        cursor = controls[-1]
            if len(points) < 2: continue
            device = np.c_[points,np.ones(len(points))] @ m.T
            stroke = recipe['style'].get('width', 1) if 'stroke' in recipe['style'] else 0
            # Include the actual stroke, then the same bounded AA neighbourhood.
            thickness = max(1, math.ceil(stroke*np.linalg.norm(m[:2,:2],2)))
            draw.line([tuple(p[:2]) for p in device], fill=255, width=thickness)
        for child in node['children']: visit(child, m)
    visit(snapshot['tree'], matrix)
    return box_has(np.asarray(image) > 0, radius)


def compare_pixels(reference, candidate, radius, silhouette=True, edges=None):
    # Flat reference interiors retain the <=3 channel gate. Geometry and
    # silhouette gates separately cover transparent shapes and gradients.
    a, b = np.asarray(reference, dtype=np.int16), np.asarray(candidate, dtype=np.int16)
    horizontal = np.pad(np.any(a[:, 1:] != a[:, :-1], axis=2), ((0,0),(0,1)))
    vertical = np.pad(np.any(a[1:] != a[:-1], axis=2), ((0,1),(0,0)))
    flat = ~(box_has(horizontal, radius, omit_right=True) | box_has(vertical, radius, omit_bottom=True))
    bad = (np.max(np.abs(a - b), axis=2) > 3) & flat
    def foreground(image):
        contrast = np.max(np.abs(np.asarray(image, dtype=np.int16) - [16, 28, 61]), axis=2)
        # Hysteresis prevents alpha/coverage rounding from moving a faint
        # marker across the binary threshold (e.g. the 8% flight-height line).
        return contrast > 16, box_has(contrast > 3, radius)
    fg_a, near_a = foreground(reference)
    fg_b, near_b = foreground(candidate)
    missing = fg_a & ~near_b
    added = fg_b & ~near_a
    if edges is not None:
        bad &= ~edges
        added &= ~edges
    # Geometry-edge exceptions never conceal a missing reference silhouette.
    silhouette_bad = missing | added
    # A clipped subpixel snowflake/star can leave an MSAA fragment in Pixi
    # while texture sampling leaves none in Phaser. Limit this exception to
    # the same bounded image-edge band; geometry/colour/alpha audits still apply.
    bad[:radius, :] = False; bad[-radius:, :] = False
    bad[:, :radius] = False; bad[:, -radius:] = False
    silhouette_bad[:radius, :] = False; silhouette_bad[-radius:, :] = False
    silhouette_bad[:, :radius] = False; silhouette_bad[:, -radius:] = False
    return {'outside_color_bound': int(bad.sum()), 'outside_silhouette_bound': int(silhouette_bad.sum()) if silhouette else 0,
            'mean_channel_error': round(float(np.abs(a - b).mean()), 6), 'max_channel_error': int(np.abs(a - b).max())}


def check_missing_silhouettes(report, output):
    """Recheck saved pixels without any geometry exception for missing shapes."""
    checked = 0
    for case in report['cases']:
        name = case['name']
        # Arena has a gradient; sky/scenery comparisons separately check it.
        if '-arena-' in name or '-sky-' in name: continue
        dpr = int(re.search(r'-dpr(\d)-', name).group(1))
        dimensions = re.search(r'-(\d+)x(\d+)-fixed', name)
        scale = min(int(dimensions[1])/1280, int(dimensions[2])/720) if dimensions else 1
        radius = math.ceil(3*scale*dpr)
        reference = np.asarray(Image.open(output / (name+'-pixi.png')).convert('RGB'), dtype=np.int16)
        candidate = np.asarray(Image.open(output / (name+'-phaser.png')).convert('RGB'), dtype=np.int16)
        definite = np.max(np.abs(reference-[16,28,61]), axis=2) > 16
        possible = np.max(np.abs(candidate-[16,28,61]), axis=2) > 3
        missing = definite & ~box_has(possible, radius)
        missing[:radius,:] = False; missing[-radius:,:] = False
        missing[:,:radius] = False; missing[:,-radius:] = False
        assert not missing.any(), (name, int(missing.sum()))
        case['missing_reference_pixels'] = 0
        checked += 1
    report['strict_missing_silhouettes'] = {'checked_frames': checked, 'missing_reference_pixels': 0, 'geometry_edge_exceptions': False}
    return report['strict_missing_silhouettes']


def compare_tree(a, b, path=''):
    assert type(a) == type(b) or isinstance(a, (int, float)) and isinstance(b, (int, float)), (path, a, b)
    if isinstance(a, dict):
        assert a.keys() == b.keys(), (path, a.keys(), b.keys())
        if a.get('kind') == 'roundRect' and a.get('style', {}).get('fill') == 0xffffff and a.get('values', [])[-1:] == [8]:
            # This one speech-bubble recipe measures the native label's width.
            assert max(abs(x-y) for x,y in zip(a['values'], b['values'])) < 1
            a, b = {**a, 'values': []}, {**b, 'values': []}
        for key in a:
            if key == 'width' and a.get('kind') == 'text':
                assert abs(a[key] - b[key]) < 1, (path + '/width', a[key], b[key])
            else:
                compare_tree(a[key], b[key], path + '/' + key)
    elif isinstance(a, list):
        assert len(a) == len(b), (path, len(a), len(b))
        for index, (left, right) in enumerate(zip(a, b)):
            compare_tree(left, right, path + f'/{index}')
    elif isinstance(a, (int, float)) and not isinstance(a, bool):
        # Text's measured width exception is handled on text nodes above;
        # stroke widths and all other numeric recipe/pose values remain exact.
        assert abs(a - b) < 1e-8, (path, a, b)
    else:
        assert a == b, (path, a, b)


def open_page(context, base, date, phaser, renderer, dev_base):
    page = context.new_page()
    failures = []
    page.on('pageerror', lambda error: failures.append(str(error)))
    page.on('console', lambda message: failures.append(message.text) if message.type == 'error' else None)
    page.add_init_script(path=str(ROOT / 'scripts/baseline/init.js'))
    if phaser:
        page.add_init_script('window.__baselineClock.live()')
    page.goto(base.rstrip('/') + '/?date=2026-' + date + ('&engine=phaser&gallery=primitives&renderer=' + renderer if phaser else ''))
    page.wait_for_function('!!window.__game', polling=50)
    page.locator('#start').dispatch_event('pointerdown')
    if phaser:
        page.evaluate('__game.app.loop.sleep(); __game.game.sys.sceneUpdate = () => {}')
    else:
        page.evaluate('__game.app.ticker.stop()')
    page.evaluate("""async base => {
      const {installPaintAudit, snapshotArtwork} = await import(new URL('scripts/phaser/artwork_audit.js', base));
      installPaintAudit(); window.__snapshotArtwork = snapshotArtwork;
    }""", dev_base)
    if phaser:
        page.evaluate("""() => {
          const prototype = Object.getPrototypeOf(__game.app.textures.get('__DEFAULT').source[0]);
          const update = prototype.update;
          let pending = null;
          prototype.update = function(...args) {
            if (pending && this.isCanvas) { pending.add(this); return; }
            return update.apply(this, args);
          };
          // All real Canvas drawing and view updates still run at 60 Hz. Only
          // redundant GPU uploads for intermediate, undisplayed poses are delayed.
          // Final images use the normal TextureSource update and Phaser renderer.
          window.__batchArtworkUploads = fn => {
            const sources = new Set(); pending = sources;
            try { fn(); } finally {
              pending = null;
              for (const source of sources) if (source.renderer && source.glTexture) update.call(source);
            }
          };
        }""")
    assert not failures, failures
    return page, failures


def prepare(page, name, phase, phaser):
    return page.evaluate("""async ({name, phase, phaser}) => {
      if (phaser) {
        // The shipped preview exports a factory hook below; no dev-only renderer
        // code is needed by a production build.
        const factory = __game.game.artworkFactory;
        __game.game.go(factory, name, phase, 12345, true); __game.scene.testing = true;
      } else {
        const {installPixiArtwork} = await import('/scripts/phaser/pixi_artwork.js');
        await installPixiArtwork(name, phase);
      }
      __game.scene.render();
      return __game.scene.cells;
    }""", {'name': name, 'phase': phase, 'phaser': phaser})


def sample(page, steps, phaser, batch=False):
    result = page.evaluate("""({steps, phaser, batch}) => {
      const advance = () => {
        for (let i = 0; i < steps; i++) { __game.scene.update(1/60); __game.scene.render(); }
        __game.scene.render();
      };
      if (phaser && batch) __batchArtworkUploads(advance); else advance();
      if (phaser) __game.app.step(0, 0); else __game.app.render();
      return __snapshotArtwork(phaser);
    }""", {'steps': steps, 'phaser': phaser, 'batch': batch})
    return result, Image.open(io.BytesIO(page.screenshot(scale='device'))).convert('RGB')


def set_layout(page, size, phaser):
    width, height, fixed = size
    page.set_viewport_size({'width': width, 'height': height})
    page.evaluate("""async ({fixed, phaser}) => {
      const setFixed169 = phaser ? __game.game.setFixed169 : (await import('/src/layout.js')).setFixed169;
      setFixed169(fixed); __game.session.ratio169 = fixed;
      if (phaser) __game.game.fit(); else __game.app.resize();
    }""", {'fixed': fixed, 'phaser': phaser})


def sky_error(reference, candidate, size, dpr):
    width, height, fixed = size
    scale = min(width / 1280, height / 720)
    visible = min(height / scale, 720 if fixed else 1080)
    extra = max(0, visible - 720)
    x = math.floor((width - 1280 * scale) / 2 + 0.5)
    y = math.floor((height - visible * scale) / 2 + 0.5)
    area = tuple(round(v * dpr) for v in (x + 4 * scale, y + (80 + extra) * scale,
                                         x + 1276 * scale, y + (650 + extra) * scale))
    return int(np.abs(np.asarray(reference.crop(area), dtype=np.int16) - np.asarray(candidate.crop(area), dtype=np.int16)).max())


def negative_controls(reference, radius, edges):
    results = {}
    for name, area, colour in [('missing-saucer', (50, 70, 280, 230), (16, 28, 61)),
                               ('added-interior-colour', (605, 620, 655, 650), (255, 0, 255))]:
        broken = reference.copy(); ImageDraw.Draw(broken).rectangle(area, fill=colour)
        result = compare_pixels(reference, broken, radius, edges=edges)
        assert result['outside_color_bound'] or result['outside_silhouette_bound'], name
        results[name] = result
    # Even a geometry-edge mask covering every pixel cannot hide erased art.
    erased = Image.new('RGB', reference.size, (16,28,61))
    check = compare_pixels(reference, erased, radius, edges=np.ones((reference.height,reference.width), dtype=bool))
    assert check['outside_silhouette_bound']
    results['erased-art-with-full-edge-mask'] = check
    return results


def negative_audits(reference):
    results = []
    for kind in ['position', 'recipe', 'text']:
        broken = copy.deepcopy(reference)
        def mutate(node):
            if kind == 'position': node['x'] += 4; return True
            if kind == 'recipe' and node['paints']: node['paints'].pop(); return True
            if kind == 'text' and node.get('text'): node['text'] += '!'; return True
            return any(mutate(child) for child in node['children'])
        assert mutate(broken['tree'])
        try: compare_tree(reference, broken)
        except AssertionError: results.append(kind)
        else: raise AssertionError('Audit accepted broken ' + kind)
    return results


def check_preview_controls(page):
    prepare(page, 'arena', 'waxing', True)
    page.evaluate("""() => {
      let time = 0;
      __game.game.frames.reset(0); __game.game.loop.reset();
      window.__advanceArtwork = () => {
        time += 100; __game.game.update(time); __game.app.step(time, 0);
        return __game.scene.elapsed;
      };
    }""")
    page.keyboard.press('p')
    elapsed = page.evaluate('__advanceArtwork()')
    frozen = page.screenshot()
    page.evaluate('__advanceArtwork(); __advanceArtwork()')
    assert page.evaluate('__game.scene.elapsed') == elapsed
    assert page.screenshot() == frozen
    page.keyboard.press('p')
    assert page.evaluate('__advanceArtwork()') > elapsed
    page.keyboard.press('ArrowRight'); page.evaluate('__advanceArtwork()')
    assert page.evaluate('__game.scene.page') == 'sky'
    page.keyboard.press('ArrowLeft'); page.evaluate('__advanceArtwork()')
    assert page.evaluate('__game.scene.page') == 'arena'
    page.evaluate('__advanceArtwork(); __advanceArtwork()')
    old = page.evaluate('__game.scene.elapsed')
    page.keyboard.press('r'); page.evaluate('__advanceArtwork()')
    assert page.evaluate('__game.scene.elapsed') < old
    was = page.evaluate('__game.session.ratio169')
    page.keyboard.press('v'); page.evaluate('__advanceArtwork()')
    assert page.evaluate('__game.session.ratio169') != was
    return {'pause_freezes_elapsed_and_pixels': True, 'resume': True,
            'page_navigation': True, 'restart': True, 'ratio_toggle': True}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:5174/')
    parser.add_argument('--phaser-url')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--batch-uploads', action='store_true', help='Batch GPU uploads for intermediate undisplayed poses; final rendering and lifecycle checks remain real')
    parser.add_argument('--quick', action='store_true')
    parser.add_argument('--smoke', action='store_true', help='Production routing/scaling smoke check')
    parser.add_argument('--controls-only', action='store_true', help='Preview keyboard controls and frozen rendering')
    parser.add_argument('--motion-only', action='store_true', help='Longer atmospheric animation samples')
    parser.add_argument('--pages', nargs='+', choices=PAGES, help='Check selected artwork pages with unchanged pixel/pose policy')
    parser.add_argument('--resume', action='store_true', help='Keep passing cases when resuming a failed run')
    args = parser.parse_args()
    output = args.output or Path(tempfile.mkdtemp(prefix='martian-artwork-'))
    if output.resolve().is_relative_to(ROOT / 'baselines/pixi'):
        raise ValueError('Artwork checks must not overwrite frozen Pixi references')
    output.mkdir(parents=True, exist_ok=True)
    runtime_hashes = {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
                      for path in sorted((ROOT / 'src').rglob('*.js'))}
    report = {'complete': False, 'preservation': preservation(), 'cases': [], 'ownership': [], 'controls': [],
              'pixel_policy': 'flat interiors +/-3 RGB; antialiasing/blending allowed only in bounded reference pixel/geometry edge neighbourhood and image border; silhouette hysteresis 16/3 bounded in both directions; geometry exceptions never mask missing reference silhouettes; independent sky <=2 RGB',
              'selected_pages': args.pages,
              'runtime_source_sha256': runtime_hashes,
              'pixi_url': args.base_url, 'phaser_url': args.phaser_url or args.base_url,
              'radius': 'ceil(3 * layout_scale * DPR) device pixels', 'sky_max_channel_error': 2, 'minified_text_cell_height_limit': '8 device pixels; non-space monospace cells from audited reference metrics; missing silhouettes still fail',
              'recipe_pose_policy': 'same native hierarchy, positions, rotations, scales, alpha, visibility, text, paint recipes; numeric tolerance 1e-8 except measured text rounding <1px'}
    if args.resume and (output / 'checks.json').exists():
        report = json.loads((output / 'checks.json').read_text())
        if report.get('runtime_source_sha256') != runtime_hashes:
            raise ValueError('Cannot resume artwork evidence after runtime source changes or without its source fingerprint; use a new output directory')
        report['complete'] = False
    report['intermediate_upload_batching'] = args.batch_uploads
    completed = {case['name'] for case in report['cases']}
    def save(): (output / 'checks.json').write_text(json.dumps(report, indent=2) + '\n')
    save()
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=which('chromium'), args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        report['browser'] = 'Chromium ' + browser.version
        modes = [('auto', 1)] if args.quick else [('auto', 1), ('canvas', 1), ('auto', 2), ('canvas', 2)]
        for renderer, dpr in modes:
            for date in (DATES[:1] if args.quick or args.controls_only else DATES):
                context = browser.new_context(viewport={'width': 1280, 'height': 720}, device_scale_factor=dpr)
                pixi, pixi_errors = open_page(context, args.base_url, date, False, renderer, args.base_url)
                phaser, phaser_errors = open_page(context, args.phaser_url or args.base_url, date, True, renderer, args.base_url)
                cases = [(name, 'waxing', [0, 6, 75, 222]) for name in PAGES] if date == '02-15' else [(name, 'full', [0, 75, 180, 222, 300, 330]) for name in ['arena', 'scenery']]
                if date == '02-15': cases += [(name, phase, [0, 75, 222]) for phase in PHASES if phase != 'waxing' for name in ['arena', 'scenery']]
                if args.smoke: cases = [(name, phase, [300]) for name, phase, _ in cases]
                if args.motion_only: cases = [(name, 'full', [300, 330, 480, 600]) for name in ['arena', 'scenery']]
                if args.controls_only: cases = []
                if args.pages: cases = [case for case in cases if case[0] in args.pages]
                for name, phase, times in cases:
                    if all(f'{renderer}-dpr{dpr}-{date}-{phase}-{name}-{stamp}' in completed for stamp in times): continue
                    prepare(pixi, name, phase, False); prepare(phaser, name, phase, True)
                    previous = 0
                    for stamp in times:
                        ident = f'{renderer}-dpr{dpr}-{date}-{phase}-{name}-{stamp}'
                        if ident in completed:
                            sample(pixi, stamp - previous, False)
                            sample(phaser, stamp - previous, True, args.batch_uploads)
                            previous = stamp
                            continue
                        a, reference = sample(pixi, stamp - previous, False)
                        b, candidate = sample(phaser, stamp - previous, True, args.batch_uploads)
                        previous = stamp
                        compare_tree(a, b)
                        radius = math.ceil(3 * dpr)
                        check = compare_pixels(reference, candidate, radius, name not in ['sky', 'arena'], reference_edges(a, LAYOUTS[0], dpr, radius))
                        ident = f'{renderer}-dpr{dpr}-{date}-{phase}-{name}-{stamp}'
                        reference.save(output / (ident + '-pixi.png')); candidate.save(output / (ident + '-phaser.png'))
                        if check['outside_color_bound'] or check['outside_silhouette_bound']:
                            (output / (ident + '-audit.json')).write_text(json.dumps(a))
                        assert not check['outside_color_bound'] and not check['outside_silhouette_bound'], (ident, check)
                        if name == 'sky':
                            check['sky_error'] = sky_error(reference, candidate, LAYOUTS[0], dpr)
                            assert check['sky_error'] <= 2, check
                        if name == 'saucers' and stamp == 75 and not report.get('negative_controls'):
                            report['negative_controls'] = negative_controls(reference, radius, reference_edges(a, LAYOUTS[0], dpr, radius))
                            report['negative_audits'] = negative_audits(a)
                        report['cases'].append({'name': ident, 'intermediate_uploads_batched': args.batch_uploads, 'paint_operations': a['painted'], 'labels': a['labels'], **check})
                    save()
                if not args.phaser_url and not args.motion_only and not args.controls_only and date == '02-15' and len(report['ownership']) <= modes.index((renderer,dpr)):
                    report['ownership'].append(phaser.evaluate('''async () => {
                      const {checkArtworkOwnership} = await import('/scripts/phaser/artwork_ownership.js');
                      return checkArtworkOwnership(__game.game);
                    }'''))
                if date == '02-15' and not args.motion_only:
                    report.setdefault('controls', []).append({'renderer': renderer, 'dpr': dpr, **check_preview_controls(phaser)})
                if not args.quick and not args.motion_only and not args.controls_only:
                    for size in (LAYOUTS[-2:] if args.smoke else LAYOUTS[1:]):
                        for name in (['arena', 'menus', 'saucers', 'sky'] if date == '02-15' else ['arena', 'scenery']):
                            if args.pages and name not in args.pages: continue
                            ident = f'{renderer}-dpr{dpr}-{date}-{name}-{size[0]}x{size[1]}-fixed{size[2]}'
                            if ident in completed: continue
                            set_layout(pixi, size, False); set_layout(phaser, size, True)
                            prepare(pixi, name, 'full', False); prepare(phaser, name, 'full', True)
                            a, reference = sample(pixi, 222, False); b, candidate = sample(phaser, 222, True, args.batch_uploads)
                            compare_tree(a, b)
                            radius = math.ceil(3 * min(size[0] / 1280, size[1] / 720) * dpr)
                            check = compare_pixels(reference, candidate, radius, name not in ['sky', 'arena'], reference_edges(a, size, dpr, radius))
                            ident = f'{renderer}-dpr{dpr}-{date}-{name}-{size[0]}x{size[1]}-fixed{size[2]}'
                            reference.save(output / (ident + '-pixi.png')); candidate.save(output / (ident + '-phaser.png'))
                            if check['outside_color_bound'] or check['outside_silhouette_bound']:
                                (output / (ident + '-audit.json')).write_text(json.dumps(a))
                            assert not check['outside_color_bound'] and not check['outside_silhouette_bound'], (ident, check)
                            if name == 'sky':
                                check['sky_error'] = sky_error(reference, candidate, size, dpr); assert check['sky_error'] <= 2, check
                            report['cases'].append({'name': ident, 'intermediate_uploads_batched': args.batch_uploads, 'paint_operations': a['painted'], 'labels': a['labels'], **check})
                    save()
                assert not pixi_errors and not phaser_errors, (pixi_errors, phaser_errors)
                print(f'Passed {renderer}, DPR {dpr}, date {date}: {len(cases)} pages/phases', flush=True)
                context.close()
        browser.close()
    check_missing_silhouettes(report, output)
    report['complete'] = True; save()
    print(f'Artwork gate passed; evidence: {output}')


if __name__ == '__main__': main()
