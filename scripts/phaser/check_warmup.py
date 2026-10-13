"""Independent no-warmup control: seeded actual play pixels and ownership."""
import argparse,hashlib,json,io,tempfile
from pathlib import Path
from shutil import which
from PIL import Image,ImageChops
from playwright.sync_api import sync_playwright
from check_scenes import open_page
from check_performance import INIT
from check_primitives import preservation
ROOT=Path(__file__).resolve().parents[2]
CONTROL=r"""async base=>{
 const url=new URL('src/phaser/scenes/play.js',base);
 let source=await(await fetch(url)).text();
 if(!source.includes('warmGameplayArt(game.presentation, stage);'))throw Error('No warmup call to control');
 source=source.replace('warmGameplayArt(game.presentation, stage);','');
 source=source.replace(/from\s+(['"])([^'"]+)\1/g,(_,quote,path)=>`from ${quote}${new URL(path,url)}${quote}`);
 const blob=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
 try{return (await import(blob)).createPlayScene;}finally{URL.revokeObjectURL(blob);}
}"""
PREPARE=r"""async cold=>{
 __start(2);
 const factory=cold?await (CONTROL)(location.href):(await import('/src/phaser/scenes/play.js')).createPlayScene;
 __game.game.go(factory,__game.session);
 while(__game.scene.round.phase==='countdown')__tick();
 const {spawnDrop,spawnWolf,spawnCrate,spawnGolden}=await import('/src/logic/world.js');
 const w=__game.scene.round.world;spawnDrop(w,'speed',false);spawnDrop(w,'laser',true);spawnWolf(w);spawnCrate(w,'red');spawnGolden(w,'red');
 __tick(4);__draw();
 return {phase:__game.scene.round.phase,hidden_warm_root:!cold&&__game.scene.view.list[0].getByName('prewarmed-art').visible===false};
}""".replace('CONTROL',CONTROL)
def main():
 p=argparse.ArgumentParser();p.add_argument('--base-url',default='http://127.0.0.1:5174/');p.add_argument('--output',type=Path);args=p.parse_args()
 out=args.output or Path(tempfile.mkdtemp(prefix='martian-warmup-'));out.mkdir(parents=True,exist_ok=True)
 if out.resolve().is_relative_to(ROOT/'baselines/pixi'):raise ValueError('Frozen references cannot be overwritten')
 report={'complete':False,'preservation':preservation(),'cases':[],'runtime_source_sha256':{str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted((ROOT/'src').rglob('*.js'))}}
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=which('chromium'),args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  for renderer,dpr in [('auto',1),('canvas',1),('auto',2),('canvas',2)]:
   images=[];rows=[]
   for cold in [True,False]:
    context=b.new_context(viewport={'width':1280,'height':720},device_scale_factor=dpr);context.add_init_script(INIT)
    page,errors=open_page(context,args.base_url,renderer);rows.append(page.evaluate(PREPARE,cold));images.append(Image.open(io.BytesIO(page.screenshot())).convert('RGB'));assert not errors,errors;context.close()
   error=max(max(pixel) for pixel in ImageChops.difference(*images).get_flattened_data());assert error==0,{'renderer':renderer,'dpr':dpr,'pixel_error':error}
   report['cases'].append({'renderer':renderer,'dpr':dpr,'control_removes_only_warmup_call':True,'max_channel_error':error,'cosmetic_pose_unchanged':True,'warm_root_hidden':rows[1]['hidden_warm_root']});assert rows[1]['hidden_warm_root']
   print('Warmup preserves real play pixels:',renderer,dpr,flush=True)
  b.close()
 report['complete']=True;(out/'checks.json').write_text(json.dumps(report,indent=2)+'\n')
if __name__=='__main__':main()
