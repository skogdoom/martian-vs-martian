"""Real 30-minute Phaser session plus at least 50 shortened lifecycle fixtures."""
import argparse,json,time,tempfile,hashlib
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
from check_primitives import preservation
ROOT=Path(__file__).resolve().parents[2]
DRIVER=r"""()=>{
 const runtime=__game, tap=code=>{window.dispatchEvent(new KeyboardEvent('keydown',{code}));window.dispatchEvent(new KeyboardEvent('keyup',{code}));};
 runtime.session.length=60;runtime.session.rounds=1;runtime.session.players=2;
 let cycles=0, rounds=0, restarts=0, restartStage=0, restarted=false, restartAt=0, seen=null, entered=performance.now(), lastInput=0;
 window.__soakState={cycles:0,rounds:0};
 window.__soakTimer=setInterval(()=>{
  const scene=runtime.scene,kind=scene.kind;
  if(scene!==seen){if(kind==='title' && seen?.kind==='tally')cycles++;seen=scene;entered=performance.now();if(kind==='roundEnd')rounds++;}
  const age=performance.now()-entered;
  if(kind==='title' && age>900){restarted=false;tap('Digit2');tap('Enter');}
  if(kind==='play' && scene.round.phase==='play'){
   if(cycles<50 && cycles%10===0 && !restarted && age>4000 && restartStage===0){tap('KeyP');restartStage=1;}
   if(restartStage===1 && scene.paused){tap('ArrowDown');restartStage=2;restartAt=performance.now();}
   if(restartStage===2 && performance.now()-restartAt>400){tap('Enter');restartStage=0;restarted=true;restarts++;}
   if(scene.paused || restartStage>0)return;
   if(cycles<50 && age>4500){
    const r=scene.round;r.timeLeft=.2;
    for(const a of r.world.animals){a.state='gone';a.pen=null;}
    Object.assign(r.world.animals.find(a=>a.kind==='cow'),{state:'penned',pen:'red',owner:'red',x:80,y:660});
   } else if(performance.now()-lastInput>500){
    lastInput=performance.now();tap('Space');
    const left=Math.floor(lastInput/2000)%2===0;
    for(const [code,held] of [['KeyD',left],['KeyA',!left],['ArrowLeft',left],['ArrowRight',!left]])window.dispatchEvent(new KeyboardEvent(held?'keydown':'keyup',{code}));
   }
  }
  if(kind==='roundEnd' && age>1500)tap('Space');
  if(kind==='tally' && age>1600)tap('Escape');
  window.__soakState={cycles,rounds,restarts,kind,halted:runtime.game.halted};
 },250);
 window.__soakSnapshot=()=>{
  const walk=n=>1+(n.list??[]).reduce((a,c)=>a+walk(c),0);
  return {...__soakState,heap:performance.memory?.usedJSHeapSize??null,objects:walk(runtime.game.root),
   textures:runtime.app.textures.getTextureKeys().length,gpuTextures:runtime.app.renderer.glTextureWrappers?.length??null,
   store:runtime.game.presentation.stats,paint:runtime.game.presentation.metrics,effects:runtime.scene.diagnostics?.effects??null,
   input:runtime.input.inputStats(),fullscreen:runtime.fullscreen.fullscreenStats(),observer:__soakProbe.snapshot()};
 };
}"""
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--base-url',default='http://127.0.0.1:5174/');parser.add_argument('--minutes',type=float,default=30);parser.add_argument('--output',type=Path);parser.add_argument('--min-cycles',type=int,default=50);args=parser.parse_args()
 out=args.output or Path(tempfile.mkdtemp(prefix='martian-soak-'));out.mkdir(parents=True,exist_ok=True)
 if out.resolve().is_relative_to(ROOT/'baselines/pixi'):raise ValueError('Frozen references cannot be overwritten')
 report={'complete':False,'requested_minutes':args.minutes,'preservation':preservation(),'samples':[],'runtime_source_sha256':{str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted((ROOT/'src').rglob('*.js'))}}
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=which('chromium'),args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);report['browser']=browser.version
  page=browser.new_page(viewport={'width':1280,'height':720});page.add_init_script(path=str(ROOT/'scripts/phaser/soak_probe.js'));errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(args.base_url.rstrip('/')+'/?engine=phaser&date=2026-02-15');page.wait_for_function('!!window.__game',timeout=30000);page.keyboard.press('Space');page.keyboard.press('m');page.evaluate(DRIVER)
  client=page.context.new_cdp_session(page);start=time.monotonic();next_sample=start
  while time.monotonic()-start<args.minutes*60:
   page.wait_for_timeout(1000)
   if time.monotonic()>=next_sample:
    client.send('HeapProfiler.collectGarbage');snapshot=page.evaluate('__soakSnapshot()');snapshot['elapsed_seconds']=time.monotonic()-start
    assert not snapshot['halted'] and snapshot['observer']['audioContexts']==['running'],snapshot
    if snapshot['effects']:assert snapshot['effects']['particles']<=1500 and snapshot['effects']['popups']<=12
    assert not errors,errors
    report['samples'].append(snapshot);(out/'soak.json').write_text(json.dumps(report,indent=2)+'\n');print('Soak',round(snapshot['elapsed_seconds']), 's, cycles',snapshot['cycles'],'rounds',snapshot['rounds'],'heap',snapshot['heap'],flush=True);next_sample=time.monotonic()+45
  final_sample=page.evaluate('__soakSnapshot()');report['samples'].append(final_sample);(out/'soak.json').write_text(json.dumps(report,indent=2)+'\n');print('Final session state:',final_sample,flush=True)
  page.evaluate('clearInterval(__soakTimer);window.dispatchEvent(new Event("blur"));__game.game.dispose()');page.wait_for_function('__soakProbe.snapshot().audioSources===0',timeout=40000,polling=100)
  report['duration_seconds']=time.monotonic()-start;report['final']=page.evaluate('__soakProbe.snapshot()');assert report['samples'][-1]['cycles']>=args.min_cycles
  report['complete']=True;(out/'soak.json').write_text(json.dumps(report,indent=2)+'\n');browser.close();print('Soak completed:',out,flush=True)
if __name__=='__main__':main()
