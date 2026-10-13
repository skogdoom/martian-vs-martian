"""Exact production pixels before/after startup shader preparation."""
import argparse,hashlib,io,json,tempfile
from pathlib import Path
from shutil import which
from PIL import Image,ImageChops
from playwright.sync_api import sync_playwright
from check_scenes import open_page
from check_performance import INIT
from check_primitives import preservation
ROOT=Path(__file__).resolve().parents[2]
PREPARE=r"""async base=>{
 __start(2);while(__game.scene.round.phase==='countdown')__tick();
 const w=__game.scene.round.world;
 const {spawnDrop,spawnWolf,spawnCrate}=await import(new URL('src/logic/world.js',base));
 const {createAnimal,parachute}=await import(new URL('src/logic/animal.js',base));
 for(let i=0;i<4;i++){const a=createAnimal('pixel-'+i,i%2?'cow':'lamb',540+i*60);parachute(a);w.animals.push(a);}
 spawnDrop(w,'speed');spawnDrop(w,'laser',true);spawnWolf(w);spawnCrate(w,'red');
 Object.assign(w.saucers.red,{x:400,y:470,vx:0,vy:0});Object.assign(w.saucers.blue,{x:880,y:470,vx:0,vy:0});
 __press('Space');__press('Enter');__draw();
}"""
def main():
 p=argparse.ArgumentParser();p.add_argument('--before-url',required=True);p.add_argument('--after-url',required=True);p.add_argument('--fixture-url',required=True);p.add_argument('--output',type=Path);args=p.parse_args()
 out=args.output or Path(tempfile.mkdtemp(prefix='martian-render-warmup-'));out.mkdir(parents=True,exist_ok=True)
 if out.resolve().is_relative_to(ROOT/'baselines/pixi'):raise ValueError('Do not overwrite frozen references')
 report={'complete':False,'preservation':preservation(),'before_url':args.before_url,'after_url':args.after_url,'cases':[],'runtime_source_sha256':{str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted((ROOT/'src').rglob('*.js'))}}
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=which('chromium'),args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  for renderer,dpr in [('auto',1),('canvas',1),('auto',2),('canvas',2)]:
   runs=[]
   for url in [args.before_url,args.after_url]:
    context=browser.new_context(viewport={'width':1280,'height':720},device_scale_factor=dpr);context.add_init_script(INIT);page,errors=open_page(context,url,renderer);page.evaluate(PREPARE,args.fixture_url);images=[]
    for frames in [4,30,60]:
     page.evaluate('frames=>{__tick(frames);__draw();}',frames);images.append(Image.open(io.BytesIO(page.screenshot())).convert('RGB'))
    assert not errors,errors;runs.append(images);context.close()
   for pose,(a,b) in enumerate(zip(*runs)):
    error=max(max(pixel) for pixel in ImageChops.difference(a,b).get_flattened_data());assert error==0,{'renderer':renderer,'dpr':dpr,'pose':pose,'max_channel_error':error}
    report['cases'].append({'renderer':renderer,'dpr':dpr,'pose':pose,'max_channel_error':error})
   print('Production pixels unchanged:',renderer,dpr,flush=True)
  browser.close()
 report['complete']=True;(out/'checks.json').write_text(json.dumps(report,indent=2)+'\n')
if __name__=='__main__':main()
