"""Check the default Phaser production build after the Pixi cutover.

Serve immutable production files at root and a Pages-style subdirectory. Run real
scene/input/controller checks; no Vite or unbundled game modules supply the game.
"""
import argparse
import hashlib
import json
import shutil
import tempfile
import threading
import io

from PIL import Image, ImageChops
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright
from check_primitives import preservation
from check_performance import INIT
from check_scenes import open_page, keyboard_and_settings, match_flow, controllers, ownership, disposal

ROOT = Path(__file__).resolve().parents[2]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def manifest(folder):
    report = json.loads((folder / 'engine-build.json').read_text())
    assert report['schema'] == 1 and report['engine'] == 'phaser'
    modules = report['modules']
    assert modules and any('node_modules/phaser/' in name for name in modules)
    assert not any('node_modules/pixi.js/' in name or name in ['src/main.js', 'src/input.js', 'src/fullscreen.js']
                   or name.startswith(('src/render/', 'src/scenes/', 'references/pixi/')) for name in modules)
    assets = {str(p.relative_to(folder)): hashlib.sha256(p.read_bytes()).hexdigest()
              for p in sorted(folder.rglob('*')) if p.is_file()}
    return {'engine': report['engine'], 'module_count': len(modules), 'pixi_modules': 0, 'artifact_sha256': assets}


def routing(browser, base, expected, query=''):
    context = browser.new_context(viewport={'width': 1280, 'height': 720})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base + query)
    page.wait_for_function('!!window.__game', timeout=60000)
    assert page.evaluate('__game.engine ?? "pixi"') == expected
    assert page.locator('canvas').count() == 1
    resources = page.evaluate('performance.getEntriesByType("resource").map(r=>r.name)')
    assert resources and all(name.startswith(base) for name in resources), resources
    assert not errors, errors
    result = {'url': base + query, 'engine': expected, 'canvases': 1, 'production_resources': resources}
    context.close()
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dist', type=Path, default=ROOT / 'dist')
    parser.add_argument('--comparison-dist', type=Path, help='Independent pre-cutover Phaser production artifact for exact pixel checks')
    parser.add_argument('--browser-engine', choices=['chromium', 'firefox', 'webkit'], default='chromium')
    parser.add_argument('--browser-executable')
    parser.add_argument('--software-gpu', action='store_true')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    output = args.output or Path(tempfile.mkdtemp(prefix='martian-candidate-'))
    if output.resolve().is_relative_to(ROOT / 'baselines/pixi'):
        raise ValueError('Do not overwrite frozen references')
    output.mkdir(parents=True, exist_ok=True)
    report = {'complete': False, 'browser_engine': args.browser_engine, 'preservation': preservation(),
              'candidate': manifest(args.dist), 'routing': [], 'cases': [], 'pixel_cases': [],
              'pixel_control': manifest(args.comparison_dist) if args.comparison_dist else None,
              'runtime_source_sha256': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
                                        for p in sorted((ROOT / 'src').rglob('*.js'))},
              'limitations': ['Manual M1 performance, sound, two-controller gameplay and rumble were accepted separately; this automated run does not re-establish physical acceptance.',
                              'Mocked controller checks do not establish physical controller or rumble support.',
                              'Browser compatibility and manual input edge cases are advisory; this runner covers production flow/input, not full cross-browser artwork/audio.']}
    def save():
        (output / 'checks.json').write_text(json.dumps(report, indent=2) + '\n')
    save()
    with tempfile.TemporaryDirectory(prefix='martian-candidate-server-') as tmp:
        folder = Path(tmp)
        shutil.copytree(args.dist, folder, dirs_exist_ok=True)
        shutil.copytree(args.dist, folder / 'martian-vs-martian')
        if args.comparison_dist:
            shutil.copytree(args.comparison_dist, folder / 'comparison')
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(folder)))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{server.server_port}/'
        try:
            with sync_playwright() as p:
                options = {}
                if args.browser_executable:
                    options['executable_path'] = args.browser_executable
                if args.browser_engine == 'chromium':
                    options['args'] = ['--no-sandbox'] + (['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] if args.software_gpu else [])
                browser = getattr(p, args.browser_engine).launch(**options)
                report['browser_version'] = browser.version
                if args.comparison_dist:
                    # Independent pre-cutover Phaser control, when supplied by the caller.
                    # Both run the actual fixed-step host with the same seed and keys.
                    for renderer, dpr in [('auto', 1), ('canvas', 1), ('auto', 2), ('canvas', 2)]:
                        images = []
                        for url in [base + 'comparison/', base]:
                            context = browser.new_context(viewport={'width': 1280, 'height': 720}, device_scale_factor=dpr)
                            context.add_init_script(INIT)
                            page, errors = open_page(context, url, renderer)
                            page.evaluate("__start(2);while(__game.scene.round.phase==='countdown')__tick();__press('Space');__press('Enter');")
                            frames = []
                            for count in [4, 30, 120]:
                                page.evaluate('count=>{__tick(count);__draw();}', count)
                                frames.append(Image.open(io.BytesIO(page.screenshot())).convert('RGB'))
                            assert not errors, errors
                            images.append(frames)
                            context.close()
                        for pose, (a, b) in enumerate(zip(*images)):
                            error = max(max(pixel) for pixel in ImageChops.difference(a, b).get_flattened_data())
                            assert error == 0, {'renderer': renderer, 'dpr': dpr, 'pose': pose, 'pixel_error': error}
                            report['pixel_cases'].append({'renderer': renderer, 'dpr': dpr, 'pose': pose, 'max_channel_error': error})
                        save()
                        print('Production matches pre-cutover Phaser pixels:', renderer, dpr, flush=True)
                for prefix in ['', 'martian-vs-martian/']:
                    url = base + prefix
                    report['routing'].append(routing(browser, url, 'phaser'))
                    report['routing'].append(routing(browser, url, 'phaser', '?engine=phaser'))
                    report['routing'].append(routing(browser, url, 'phaser', '?engine=pixi'))
                    for renderer, dpr in [('auto', 1), ('canvas', 1), ('auto', 2), ('canvas', 2)]:
                        context = browser.new_context(viewport={'width': 1280, 'height': 720}, device_scale_factor=dpr)
                        page, errors = open_page(context, url, renderer)
                        row = {'prefix': prefix, 'renderer': renderer, 'dpr': dpr,
                               'webgl': page.evaluate('!!__game.app.renderer.gl'),
                               'keyboard': keyboard_and_settings(page),
                               'flow': match_flow(page, output, f'{prefix.replace("/", "-")}{renderer}-dpr{dpr}'),
                               'ownership': ownership(page, 10), 'disposal': disposal(page)}
                        if renderer == 'canvas':
                            assert not row['webgl'], 'Canvas request used WebGL'
                        assert not errors, errors
                        context.close()
                        context = browser.new_context(viewport={'width': 1280, 'height': 720}, device_scale_factor=dpr)
                        page, errors = open_page(context, url, renderer, True)
                        row['controllers'] = controllers(page)
                        row['controller_disposal'] = disposal(page)
                        assert not errors, errors
                        context.close()
                        report['cases'].append(row)
                        save()
                        print('Production passed:', args.browser_engine, prefix or 'root', renderer, dpr, flush=True)
                browser.close()
            assert len(report['cases']) == 8 and len(report['routing']) == 6
            assert len(report['pixel_cases']) == (12 if args.comparison_dist else 0)
            report['complete'] = True
        except Exception as error:
            report['error'] = str(error)
            raise
        finally:
            save()
            server.shutdown()
            server.server_close()
            thread.join()
    print('Phaser production checks complete:', output, flush=True)


if __name__ == '__main__':
    main()
