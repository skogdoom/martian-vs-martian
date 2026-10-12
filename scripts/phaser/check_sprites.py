"""Exercise cartoon art, real settings, pause preservation and atlas ownership.

Requires Playwright and Pillow. Use a dev/preview URL. The production harness
separately verifies subdirectory asset routing and complete matches/controllers.
"""
import argparse
import hashlib
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from check_primitives import preservation
from check_scenes import INIT, SETUP

PAGES = ['arena', 'sky', 'scenery', 'saucers', 'animals', 'icons', 'drops', 'wolves', 'weapons', 'hud', 'menus', 'effects-a', 'effects-b', 'effects-c']
DATES = ['2026-02-15', '2026-12-24', '2026-12-31', '2026-06-19', '2026-05-04', '2026-10-31']


def open_page(context, url):
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.add_init_script(INIT)
    page.goto(url)
    page.wait_for_function('!!window.__game', timeout=60000)
    page.evaluate('__game.game.started=true;document.getElementById("start")?.remove()')
    page.evaluate(SETUP)
    return page, errors


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:5188/')
    parser.add_argument('--output', type=Path, default=Path('/tmp/martian-sprites'))
    args = parser.parse_args()
    output = args.output
    output.mkdir(parents=True, exist_ok=True)
    report = {'complete': False, 'preservation': preservation(), 'gallery': [], 'seasonal': [], 'settings': []}
    root = Path(__file__).resolve().parents[2]
    report['runtime_source_sha256'] = {str(f.relative_to(root)): hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted((root / 'src').rglob('*.js'))}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                                    args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        report['browser'] = browser.version
        for renderer in ['auto', 'canvas']:
            query = '&renderer=canvas' if renderer == 'canvas' else ''
            context = browser.new_context(viewport={'width': 1280, 'height': 720}, device_scale_factor=2)
            for name in PAGES:
                page, errors = open_page(context, args.base_url + f'?gallery=artwork&graphics=cartoon&art={name}&date=2026-02-15' + query)
                page.evaluate('__tick(12);__draw()')
                assert not errors, (name, errors)
                assert not page.evaluate('__game.game.halted')
                visible = page.evaluate("""() => {
                  const count=n=>!n.visible||n.alpha===0?0:Number(Boolean(n.getData?.('atlas')))+(n.list??[]).reduce((sum,c)=>sum+count(c),0);
                  return count(__game.scene.view);
                }""")
                if name not in ['sky', 'menus', 'effects-a', 'effects-b', 'effects-c']:
                    assert visible > 0, (name, 'Cartoon artwork is hidden')
                if name in ['arena', 'animals', 'icons', 'drops', 'wolves', 'weapons']:
                    page.screenshot(path=str(output / f'{renderer}-{name}.png'))
                report['gallery'].append({'renderer': renderer, 'page': name, 'errors': 0, 'visibleAtlasImages': visible})
                page.close()
            for date in DATES:
                page, errors = open_page(context, args.base_url + '?graphics=cartoon&date=' + date + query)
                page.evaluate('__tick(90);__draw()')
                assert not errors, (date, errors)
                report['seasonal'].append({'renderer': renderer, 'date': date, 'errors': 0})
                if renderer == 'auto':
                    page.screenshot(path=str(output / f'season-{date}.png'))
                page.close()
            context.close()

            # No graphics query override here: reload must read the saved choice.
            context = browser.new_context(viewport={'width': 1280, 'height': 720})
            page, errors = open_page(context, args.base_url + '?date=2026-02-15' + query)
            page.evaluate('__tick(4);__draw()')
            page.screenshot(path=str(output / f'{renderer}-title.png'))
            assert not page.evaluate('__game.game.graphics.classic')
            page.evaluate("__press('Digit2');for(let i=0;i<3;i++)__press('ArrowDown');__press('Enter');__tick(3);__choose('CLASSIC GRAPHICS: OFF')")
            assert page.evaluate('__game.scene.kind') == 'settings'
            assert page.evaluate('__game.game.graphics.classic')
            assert page.evaluate('JSON.parse(localStorage.getItem("martian-vs-martian.graphics")).classic')
            page.reload()
            page.wait_for_function('!!window.__game')
            assert page.evaluate('__game.game.graphics.classic')
            page.evaluate('__game.game.started=true;document.getElementById("start")?.remove()')
            page.evaluate(SETUP)
            page.evaluate('__tick(4);__start(2);while(__game.scene.round.phase==="countdown")__tick();__press("KeyP");__draw()')
            page.screenshot(path=str(output / f'{renderer}-classic-paused.png'))
            result = page.evaluate(r"""() => {
              const scene=__game.scene, round=scene.round, session=__game.session;
              const before=JSON.stringify({round,session});
              const assert=(v,m)=>{if(!v)throw Error(m);};
              const atlasCount=()=>__game.app.textures.getTextureKeys().filter(k=>k.startsWith('cartoon-')).length;
              assert(atlasCount()===4,'atlas sheets missing');
              __choose('CLASSIC GRAPHICS: ON');__draw();
              assert(!__game.game.graphics.classic,'did not switch to cartoon');
              const snapshot=__snapshot();
              for(let i=0;i<12;i++){
                __choose('CLASSIC GRAPHICS: OFF');__draw();
                __choose('CLASSIC GRAPHICS: ON');__draw();
                assert(__game.scene===scene && scene.round===round && __game.session===session,'replaced game state');
                assert(JSON.stringify({round,session})===before,'changed paused simulation');
              }
              const after=__snapshot();
              assert(snapshot.objects===after.objects,'art objects grew across toggles');
              assert(snapshot.textures===after.textures,'textures grew across toggles');
              assert(snapshot.input.subscriptions===after.input.subscriptions,'input listeners grew');
              __press('KeyP');__tick(4);__draw();
              assert(round.timeLeft<JSON.parse(before).round.timeLeft,'round did not resume');
              return {toggles:25,roundIdentityPreserved:true,pausedStatePreserved:true,atlasSheets:atlasCount(),before:snapshot,after};
            }""")
            page.screenshot(path=str(output / f'{renderer}-play.png'))
            assert not errors, errors
            assert not page.evaluate('__game.game.halted')
            report['settings'].append({'renderer': renderer, 'savedChoiceSurvivesReload': True, **result})
            context.close()
            print('Sprite coverage and settings passed:', renderer, flush=True)
        browser.close()
    report['complete'] = True
    report['limitations'] = ['Chromium software GPU and Canvas checks do not establish Safari/M1 performance or physical controller acceptance for the new artwork.']
    (output / 'checks.json').write_text(json.dumps(report, indent=2) + '\n')
    print('Saved', output / 'checks.json')


if __name__ == '__main__':
    main()
