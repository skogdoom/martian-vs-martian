"""Cache lifetimes and real WebGL context restoration on both pixel densities."""
import argparse,json,tempfile,hashlib
from pathlib import Path
from shutil import which
from PIL import Image,ImageChops
import io
from playwright.sync_api import sync_playwright
from check_primitives import preservation
from check_scenes import open_page
ROOT=Path(__file__).resolve().parents[2]
def main():
 p=argparse.ArgumentParser();p.add_argument('--base-url',default='http://127.0.0.1:5174/');p.add_argument('--output',type=Path);args=p.parse_args();out=args.output or Path(tempfile.mkdtemp(prefix='martian-resources-'));out.mkdir(parents=True,exist_ok=True)
 if out.resolve().is_relative_to(ROOT/'baselines/pixi'):raise ValueError('Do not overwrite frozen references')
 report={'complete':False,'preservation':preservation(),'cases':[],'runtime_source_sha256':{str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted((ROOT/'src').rglob('*.js'))}}
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=which('chromium'),args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  for renderer,dpr in [('auto',1),('canvas',1),('auto',2),('canvas',2)]:
   context=browser.new_context(viewport={'width':1280,'height':720},device_scale_factor=dpr);page,errors=open_page(context,args.base_url,renderer)
   cache=page.evaluate("async()=>{const m=await import('/scripts/phaser/cache_checks.js');return m.checkCache(__game.game);}")
   row={'renderer':renderer,'dpr':dpr,'cache':cache}
   if renderer=='auto':
    page.evaluate('__start(2);while(__game.scene.round.phase==="countdown")__tick();__game.scene.round.world.animals[0].onFire=true;__press("Space");__draw()');before=page.screenshot();snapshot=page.evaluate('__snapshot()')
    page.evaluate("window.__restore=__game.app.renderer.gl.getExtension('WEBGL_lose_context');__restore.loseContext()")
    page.wait_for_function('__game.app.renderer.contextLost',polling=100)
    page.evaluate('__restore.restoreContext()');page.wait_for_function('!__game.app.renderer.contextLost',timeout=15000,polling=100)
    page.evaluate('__draw()');after=page.screenshot()
    a,b=Image.open(io.BytesIO(before)).convert('RGB'),Image.open(io.BytesIO(after)).convert('RGB');error=max(max(pixel) for pixel in ImageChops.difference(a,b).get_flattened_data())
    assert error<=3,{'restored_pixel_error':error};assert page.evaluate('__snapshot()')==snapshot,'restoration changed resources'
    (out/f'restored-dpr{dpr}.png').write_bytes(after);row['context_restore']={'max_channel_error':error,'resources_unchanged':True,'generated_art_restored':True}
   assert not errors,errors
   report['cases'].append(row);context.close();print('Resources passed:',renderer,dpr,flush=True)
  browser.close()
 report['complete']=True;(out/'checks.json').write_text(json.dumps(report,indent=2)+'\n');print('Resource gate passed:',out)
if __name__=='__main__':main()
