"""Compare the real Pixi and Phaser play scenes with the same physical key trace."""
import argparse
import hashlib
import json
import tempfile
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
from check_primitives import preservation

SETUP=r"""async phaser => {
  if(phaser){__game.app.loop.sleep();__game.game.sys.sceneUpdate=()=>{};__game.game.frames.reset(0);__game.game.loop.reset();}
  else __game.app.ticker.stop();
  const input=phaser?__game.input:await import('/src/input.js');
  let now=0,last=0,acc=0;
  window.__frame=ms=>{
    now+=ms;const elapsed=now-last;last=now;
    if(phaser)__game.game.update(now);
    else {acc+=Math.min(elapsed/1000,.1);while(acc>=1/60){input.pollPads();__game.scene.update(1/60);input.endStep();acc-=1/60;}__game.scene.render();}
  };
  window.__edge=(code,held)=>window.dispatchEvent(new KeyboardEvent(held?'keydown':'keyup',{code}));
  for(let i=0;i<5;i++)__frame(100);
}"""


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--base-url',default='http://127.0.0.1:5174/');parser.add_argument('--output',type=Path)
    args=parser.parse_args();output=args.output or Path(tempfile.mkdtemp(prefix='martian-scene-logic-'));output.mkdir(parents=True,exist_ok=True)
    root=Path(__file__).resolve().parents[2]
    if output.resolve().is_relative_to(root/'baselines/pixi'):raise ValueError('Do not overwrite frozen references')
    report={'complete':False,'preservation':preservation(),'cases':[],'seed':1790000000123,'frames_per_trace':600}
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=which('chromium'),args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        for players,difficulty in [(2,'normal'),(1,'easy'),(1,'normal'),(1,'hard')]:
            context=browser.new_context(viewport={'width':1280,'height':720});pages=[];errors=[]
            context.add_init_script('Date.now=()=>1790000000123')
            for phaser in [False,True]:
                page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(args.base_url+'?date=2026-02-15'+('&engine=phaser' if phaser else ''))
                page.wait_for_function('!!window.__game');page.locator('#start').dispatch_event('pointerdown');page.evaluate(SETUP,phaser)
                page.evaluate("({players,difficulty})=>{__game.session.players=players;__game.session.difficulty=difficulty;__edge(players===1?'Digit1':'Digit2',true);__frame(100);__edge(players===1?'Digit1':'Digit2',false);__edge('Enter',true);__frame(100);__edge('Enter',false);}",{'players':players,'difficulty':difficulty})
                assert page.evaluate('!!__game.scene.round')
                page.evaluate("() => {window.__events=[];const scene=__game.scene,update=scene.update;scene.update=function(dt){update.call(this,dt);__events.push(structuredClone(this.round.events));};}")
                pages.append(page)
            digest=hashlib.sha256();steps=0
            for frame in range(600):
                # Several fixed steps and zero-step frames consume real DOM edges.
                ms=[100,1000/30,1000/60,1000/120,1000/144][frame%5]
                edges=[]
                if frame%60==0:edges+=[('KeyD',True),('ArrowLeft',True)]
                if frame%60==30:edges+=[('KeyD',False),('ArrowLeft',False),('KeyW',True)]
                if frame%60==45:edges+=[('KeyW',False)]
                if frame%13==0:edges+=[('Space',True),('Space',False),('Enter',True),('Enter',False)]
                results=[]
                for page in pages:
                    results.append(page.evaluate("({ms,edges})=>{__events=[];for(const [code,held] of edges)__edge(code,held);__frame(ms);return {round:JSON.parse(JSON.stringify(__game.scene.round)),events:__events};}",{'ms':ms,'edges':edges}))
                if results[0]!=results[1]:
                    (output/f'mismatch-{players}-{difficulty}-{frame}.json').write_text(json.dumps(results,indent=2));raise AssertionError((players,difficulty,frame))
                digest.update(json.dumps(results[0],sort_keys=True).encode());steps+=len(results[0]['events'])
            assert not errors,errors
            report['cases'].append({'players':players,'difficulty':difficulty,'compared_frames':600,'compared_steps':steps,'round_and_every_step_events_sha256':digest.hexdigest()})
            print('Scene logic matches:',players,difficulty,steps,'steps',flush=True);context.close()
        browser.close()
    report['complete']=True;(output/'checks.json').write_text(json.dumps(report,indent=2)+'\n');print('Scene logic gate passed:',output)


if __name__=='__main__':main()
