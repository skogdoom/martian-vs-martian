"""Milestone 4 browser gate: real scene flow, DOM input, controllers and ownership.

Controlled final-score poses exercise tied/decisive results; round duration,
physics, input consumption, event delivery and transitions use the shipped host.
"""
import argparse
import hashlib
import json
import tempfile
from pathlib import Path
from shutil import which

from playwright.sync_api import sync_playwright
from check_primitives import preservation

ROOT = Path(__file__).resolve().parents[2]
INIT = r"""(() => {
  window.__contexts = 0; window.__fullRequests = []; window.__pads = [];
  const Audio = window.AudioContext;
  if (Audio) window.AudioContext = class extends Audio { constructor(...args) {super(...args); __contexts++;} };
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>__pads});
  window.__listeners = [];
  const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function(type,fn,opts) {
    if (this === window || this === document) __listeners.push({target:this,type,fn});
    return add.call(this,type,fn,opts);
  };
  EventTarget.prototype.removeEventListener = function(type,fn,opts) {
    const i=__listeners.findIndex(row=>row.target===this && row.type===type && row.fn===fn);
    if (i>=0) __listeners.splice(i,1);
    return remove.call(this,type,fn,opts);
  };
})();"""
SETUP = r"""() => {
  __game.app.loop.sleep(); __game.game.sys.sceneUpdate=()=>{};
  __game.game.frames.reset(0); __game.game.loop.reset();
  let now=0;
  window.__tick = (frames=1,ms=100) => {
    for(let i=0;i<frames;i++) {now+=ms; __game.game.update(now);}
  };
  window.__draw = () => __game.app.step(now,0);
  window.__texts = () => {
    const texts=[];const walk=node=>{if(node.type==='Text')texts.push(node.text);for(const child of node.list??[])walk(child);};
    walk(__game.scene.view);return texts;
  };
  window.__press = code => {
    window.dispatchEvent(new KeyboardEvent('keydown',{code,key:code,cancelable:true}));
    window.dispatchEvent(new KeyboardEvent('keyup',{code,key:code})); __tick();
  };
  window.__snapshot = () => {
    const count=n=>1+(n.list??[]).reduce((sum,c)=>sum+count(c),0);
    return {objects:count(__game.game.root),display:__game.game.sys.displayList.length,
      updates:__game.game.sys.updateList.getActive().length,textures:__game.app.textures.getTextureKeys().length,
      gpu:__game.app.renderer.glTextureWrappers?.length??0,store:__game.game.presentation.stats,
      input:__game.input.inputStats(),fullscreen:__game.fullscreen.fullscreenStats(),
      listeners:__listeners.filter(row=>['keydown','keyup','blur','fullscreenchange','webkitfullscreenchange'].includes(row.type)).length};
  };
  window.__start = players => {__game.session.players=players;__game.session.rounds=1;__game.session.length=60;
    __press(players===1?'Digit1':'Digit2');__press('Enter');
    if(__game.scene.kind!=='play')throw Error('start did not enter play');};
  window.__endRound = result => {
    const r=__game.scene.round;if(!r)throw Error('not in play');
    // Advance an actual round through countdown, then run all but the final
    // fixed step. These renders retain real transforms/cosmetic updates.
    while(r.phase==='countdown')__tick();
    while(r.timeLeft>0.2)__tick();
    for(const a of r.world.animals) {a.state='gone';a.pen=null;}
    const cow=r.world.animals.find(a=>a.kind==='cow');
    if(result!=='tie')Object.assign(cow,{state:'pen',pen:result,x:result==='red'?70:1210,y:660,vx:0,vy:0});
    while(r.phase!=='over')__tick();
    if(__game.scene.kind!=='roundEnd')throw Error('round did not finish');
  };
  window.__finishResult = () => {__tick(11);__press('Space');};
  window.__menuTitle = () => {__tick(13);__press('Escape');__tick(4);};
  const prototype=Object.getPrototypeOf(__game.app.textures.get('__DEFAULT').source[0]),update=prototype.update;
  let pending=null;
  prototype.update=function(...args){if(pending&&this.isCanvas){pending.add(this);return;}return update.apply(this,args);};
  window.__batch = fn => {const sources=new Set();pending=sources;try{return fn();}finally{pending=null;
    for(const source of sources)if(source.renderer&&source.glTexture)update.call(source);}};
}"""


def open_page(context, base, renderer, controller_only=False):
    page=context.new_page(); errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('console',lambda message:errors.append(message.text) if message.type=='error' else None)
    page.add_init_script(INIT)
    page.goto(base+'?engine=phaser&date=2026-02-15'+('&renderer=canvas' if renderer=='canvas' else ''))
    page.wait_for_function('window.__game?.scene?.kind === "title"')
    assert page.locator('canvas').count()==1
    assert page.evaluate('__contexts')==0
    if controller_only:
        page.evaluate('__game.game.started=true;document.getElementById("start").remove()')
    else:
        page.keyboard.press('Space')
        assert page.locator('#start').count()==0
        assert page.evaluate('__game.scene.kind')=='title'
    page.evaluate(SETUP);page.evaluate('__tick(4)')
    return page,errors


def keyboard_and_settings(page):
    page.evaluate(r"""() => {
      const input=__game.input,assert=(ok,msg)=>{if(!ok)throw Error(msg);};
      const e=new KeyboardEvent('keydown',{key:'x',code:'KeyD',cancelable:true});
      assert(!window.dispatchEvent(e)&&input.isDown('KeyD'),'physical code or preventDefault');
      window.dispatchEvent(new Event('blur'));assert(!input.isDown('KeyD'),'blur did not clear held');input.endStep();
      window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',repeat:true}));assert(!input.wasPressed('Space'),'repeat became edge');
      window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space'}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'Space'}));
      assert(input.wasPressed('Space')&&!input.isDown('Space'),'tap was lost');input.endStep();
      window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD'}));window.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowUp'}));
      assert(input.soloInput().x===1&&input.soloInput().y===-1,'solo key merging');
      window.dispatchEvent(new Event('blur'));input.endStep();
      __press('Digit2');__press('ArrowDown');__press('ArrowRight');__press('ArrowDown');__press('ArrowLeft');
      __press('ArrowDown');__press('Enter');assert(__game.scene.kind==='settings','settings selection');__tick(3);
      __press('ArrowDown');__press('ArrowDown');__press('Enter');
      assert(__game.session.ratio169,'ratio option');
      const saved=JSON.parse(localStorage.getItem('martian-vs-martian.options'));
      assert(saved.ratio169&&saved.length===120&&saved.rounds===1,'options persistence');
      __press('Escape');__tick(4);assert(__game.scene.kind==='title','settings return');
    }""")
    # Typing a cheat uses physical DOM events, including the swallowed F key.
    for key in ['i','d','k','f','a']:page.keyboard.press(key)
    page.evaluate('__tick()')
    assert page.evaluate('__game.session.cheats.lasers')
    assert not page.evaluate('!!document.fullscreenElement')
    for key in ['i','d','d','q','d']:page.keyboard.press(key)
    page.evaluate('__tick()')
    assert page.evaluate('__game.session.cheats.shields && !__game.session.cheats.lasers')
    page.evaluate('__game.session.cheats.shields=false')
    return {'physical_code':True,'prevent_default':True,'tap_between_steps':True,'repeat_filter':True,'blur':True,
            'solo_merging':True,'settings_round_trip':True,'options_saved':True,'cheat_swallow_and_exclusion':True}


def fullscreen_checks(page):
    # Real trusted keyboard and pointer gestures, rather than synthetic activation.
    page.keyboard.press('f');page.wait_for_function('!!document.fullscreenElement',timeout=10000)
    page.keyboard.press('f');page.wait_for_function('!document.fullscreenElement',timeout=10000)
    page.evaluate("__press('Digit2');__press('ArrowDown');__press('ArrowDown');__press('ArrowDown');__press('Enter');__tick(3);__press('ArrowDown')")
    assert page.evaluate('__game.scene.kind')=='settings'
    page.keyboard.press('Enter');page.wait_for_function('!!document.fullscreenElement',timeout=10000)
    page.evaluate('__tick()');assert page.evaluate('!!document.fullscreenElement'),'fullscreen selection executed twice'
    page.keyboard.press('Enter');page.wait_for_function('!document.fullscreenElement',timeout=10000);page.evaluate('__tick()')
    page.evaluate("__press('Escape');__tick(4);__start(2)")
    page.keyboard.press('f');page.wait_for_function('!!document.fullscreenElement',timeout=10000)
    page.evaluate('document.exitFullscreen()');page.wait_for_function('__game.scene.paused',timeout=10000)
    page.evaluate("__press('Enter');__press('KeyP');for(let i=0;i<5;i++)__press('ArrowDown');__press('Enter');__tick(4)")
    page.locator('canvas').dblclick(position={'x':600,'y':600});page.wait_for_function('!!document.fullscreenElement',timeout=10000)
    page.keyboard.press('f');page.wait_for_function('!document.fullscreenElement',timeout=10000);page.evaluate('__tick()')
    return {'trusted_f_key':True,'trusted_menu_selection_once':True,'double_click':True,'unexpected_exit_pauses':True}


def match_flow(page,output,label):
    result=page.evaluate(r"""() => __batch(() => {
      const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
      __start(2);while(__game.scene.round.phase==='countdown')__tick();
      const scene=__game.scene,r=scene.round,ammo=r.world.weapons.red.ammo;
      __press('Space');assert(r.world.weapons.red.ammo===ammo-1,'shoot edge repeated across steps');
      __press('KeyP');const frozen=JSON.stringify(r);__tick(4);
      assert(JSON.stringify(r)===frozen&&scene.paused,'pause advances round');
      __press('Enter');assert(!scene.paused,'resume menu');
      __press('KeyP');__press('ArrowDown');__press('Enter');
      assert(__game.scene!==scene&&__game.scene.round.phase==='countdown','restart');
      assert(__game.session.match.results.length===0,'restart kept match');
      __press('Escape');for(let i=0;i<5;i++)__press('ArrowDown');__press('Enter');__tick(4);
      assert(__game.scene.kind==='title','exit to title');
      __start(1);__endRound('blue');
      assert(__game.session.match.over&&__game.session.match.winner==='blue','solo result');
      const adopted=__game.scene.background,roundState=JSON.stringify(__game.session.match),tree=count(adopted);
      __tick(5);assert(__game.scene.background===adopted&&count(adopted)===tree,'frozen view replaced');
      assert(JSON.stringify(__game.session.match)===roundState,'result counted twice');
      return {adoptedObjects:tree,soloWinner:__game.session.match.winner,soloTally:structuredClone(__game.session.tally)};
      function count(node){return 1+(node.list??[]).reduce((n,c)=>n+count(c),0);}
    })""")
    page.evaluate('__draw()');page.screenshot(path=str(output/(label+'-result.png')))
    # Resize only the frozen layout: no simulation, tick or random shake.
    before=page.evaluate('JSON.stringify(__game.scene.background.list[0].list.map(n=>[n.x,n.y,n.rotation,n.alpha]))')
    page.evaluate('__game.session.ratio169=false;__game.game.setFixed169(false)');page.set_viewport_size({'width':600,'height':1200});page.evaluate('__game.game.fit();__game.scene.render();__draw()')
    assert page.evaluate('__game.scene.background.list[1].y')==-360
    assert page.evaluate('JSON.stringify(__game.scene.background.list[0].list.map(n=>[n.x,n.y,n.rotation,n.alpha]))')==before
    page.screenshot(path=str(output/(label+'-result-portrait.png')))
    page.set_viewport_size({'width':1280,'height':720});page.evaluate('__game.game.fit()')
    page.evaluate(r"""() => __batch(() => {
      const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
      const frozen=__game.scene.background;__finishResult();assert(__game.scene.kind==='tally','tally');
      assert(!frozen.scene,'adopted tree survived result');
      __tick(13);const tally=JSON.stringify(__game.session.tally);__press('Space');
      assert(__game.scene.kind==='play'&&JSON.stringify(__game.session.tally)===tally,'play-again lost tally');
      __press('KeyP');for(let i=0;i<5;i++)__press('ArrowDown');__press('Enter');__tick(4);
      __start(2);__endRound('tie');assert(!__game.session.match.over&&__game.session.match.scheduled===2,'tie extension');
      __finishResult();assert(__game.scene.kind==='play'&&__texts().includes('SUDDEN DEATH'),'sudden death');
      __endRound('red');assert(__game.session.match.over&&__game.session.match.wins.red===1,'decisive sudden death');
      __finishResult();assert(__game.scene.kind==='tally','two-player tally');
      assert(__game.session.tally.matchWins.red===1,'match tally counted twice');
    })""")
    page.evaluate('__draw()');page.screenshot(path=str(output/(label+'-tally.png')))
    page.evaluate('__menuTitle()')
    return {**result,'shoot_once_in_multistep_frame':True,'pause_resume':True,'restart':True,'exit':True,
            'frozen_adoption_resize_and_release':True,'solo_match':True,'two_player_match':True,'sudden_death':True,'play_again_retains_tally':True}


def controllers(page):
    return page.evaluate(r"""() => __batch(() => {
      const input=__game.input,assert=(ok,msg)=>{if(!ok)throw Error(msg);};
      const pad=index=>({index,id:'standard '+index,connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false})),
        vibrationActuator:{playEffect:(_kind,opts)=>{window.__rumble={index,opts};}}});
      __pads=[pad(0),pad(1)];__tick();
      __pads[0].axes=[.4,-.41];__pads[1].axes=[.41,0];__tick();
      assert(input.playerInput('red').x===0&&input.playerInput('red').y===-1&&input.playerInput('blue').x===1,'dead zone/slots');
      __pads[0]=null;__tick();assert(input.playerInput('red').x===0&&input.playerInput('blue').x===1,'blue slot reassigned');
      __pads.push(pad(2));__pads[2].axes=[-1,0];__tick();assert(input.playerInput('red').x===-1,'red reconnect');
      input.rumble('blue');assert(__rumble.index===1,'rumble wrong slot');
      __pads[1].axes=[0,0];__pads[2].axes=[0,0];__tick();
      __pads[2].buttons[13].pressed=true;__tick();__pads[2].buttons[13].pressed=false;__tick();
      __pads[2].buttons[0].pressed=true;__tick();assert(__game.scene.kind==='play','controller start');
      __tick(4);assert(!__game.scene.paused,'confirm leaked to new scene');
      __pads[2].buttons[0].pressed=false;__tick();__pads[2].buttons[9].pressed=true;__tick();
      assert(__game.scene.paused,'controller pause');__tick(3);assert(__game.scene.paused,'held Start repeated');
      __pads[2].buttons[9].pressed=false;__tick();__pads[2].buttons[0].pressed=true;__tick();
      assert(!__game.scene.paused,'controller resume');
      assert(__contexts===0,'controller unlocked sound');
      window.__requests=0;window.__exits=0;
      document.documentElement.requestFullscreen=()=>{__requests++;return Promise.resolve();};
      __pads[2].buttons[0].pressed=false;__tick();__pads[2].buttons[9].pressed=true;__tick();__pads[2].buttons[9].pressed=false;__tick();
      for(let i=0;i<3;i++){__pads[2].buttons[13].pressed=true;__tick();__pads[2].buttons[13].pressed=false;__tick();}
      __pads[2].buttons[0].pressed=true;__tick();assert(__requests===0,'controller entered fullscreen');
      Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>document.documentElement});
      document.exitFullscreen=()=>{__exits++;Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>null});return Promise.resolve();};
      __pads[2].buttons[0].pressed=false;__tick();__pads[2].buttons[0].pressed=true;__tick();assert(__exits===1,'controller could not leave fullscreen');
      assert(__contexts===0,'controller menu unlocked sound');
      Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>{throw Error('blocked policy');}});__tick();
      __pads=[];return {two_slots:true,dead_zone:true,reconnect:true,rumble:true,controller_start_pause_resume:true,
        no_audio_unlock:true,fullscreen_enter_blocked_exit_allowed:true,permissions_fallback:true};
    })""")


def ownership(page,cycles):
    return page.evaluate(r"""async cycles => {
      const baseline=JSON.stringify(__snapshot());
      for(let i=0;i<cycles;i++) {
        __batch(()=>{__start(2);
          // Shortening only this lifecycle fixture avoids conflating a soak
          // with the full-duration matches above. Production durations stay 60/90/120.
          __game.scene.round.countdown=0;__game.scene.round.phase='play';__game.scene.round.timeLeft=.1;
          __endRound('red');__finishResult();__menuTitle();
        });
        if(JSON.stringify(__snapshot())!==baseline)throw Error('lifecycle grew at '+i+': '+JSON.stringify(__snapshot())+' baseline '+baseline);
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      return {cycles,baseline:JSON.parse(baseline),objects_textures_and_listeners_plateau:true};
    }""",cycles)


def disposal(page):
    return page.evaluate(r"""() => {
      const input=__game.input,fullscreen=__game.fullscreen,host=__game.game;
      const fullBefore=__listeners.filter(row=>['fullscreenchange','webkitfullscreenchange'].includes(row.type)).length;
      host.dispose();host.dispose();
      window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD'}));
      if(input.isDown('KeyD')||input.wasPressed('KeyD'))throw Error('disposed keyboard listener');
      if(host.presentation.stats.textures!==0)throw Error('live paint textures');
      const handlers=__listeners.filter(row=>['keydown','keyup','blur','fullscreenchange','webkitfullscreenchange'].includes(row.type));
      // Phaser's page-level visibility/focus handlers are removed by Game.destroy,
      // whereas our input/fullscreen handlers must already be gone.
      if(handlers.some(row=>['keydown','keyup'].includes(row.type)))throw Error('keyboard service listeners survived');
      const fullAfter=handlers.filter(row=>['fullscreenchange','webkitfullscreenchange'].includes(row.type)).length;
      if(fullBefore-fullAfter!==2||fullscreen.fullscreenStats().active||fullscreen.fullscreenStats().subscriptions)throw Error('fullscreen service listeners survived');
      return {idempotent:true,input_detached:true,fullscreen_detached:true,paint_textures:0};
    }""")


def recovery(page,errors):
    page.evaluate(r"""() => {
      const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
      // Control the recovery window independently of software-GPU construction time.
      window.__recoveryNow=1000;performance.now=()=>__recoveryNow;
      __start(2);const old=__game.scene.view;
      __game.scene.update=()=>{throw Error('scene gate expected recovery');};
      window.dispatchEvent(new KeyboardEvent('keydown',{code:'Enter'}));__tick();
      window.dispatchEvent(new KeyboardEvent('keyup',{code:'Enter'}));
      assert(__game.scene.kind==='title'&&!old.scene,'native recovery/title cleanup');
      assert(!__game.input.wasPressed('Enter'),'pending input survived recovery');
      assert(__game.fullscreen.fullscreenStats().subscriptions===0,'play fullscreen callback survived recovery');
      __tick();assert(__game.scene.kind==='title','recovery key started match');
      __recoveryNow=7000;__game.scene.render=()=>{throw Error('scene gate expected recovery');};__tick();
      assert(__game.game.recentErrors.length===1&&!__game.game.halted,'expired recovery window');
      for(let i=0;i<3;i++){__game.scene.render=()=>{throw Error('scene gate expected recovery');};__tick();}
      assert(__game.game.halted,'repeat errors did not halt');
    }""")
    expected=[e for e in errors if 'scene gate expected recovery' in e]
    assert len(expected)==5,errors
    errors[:]=[e for e in errors if 'scene gate expected recovery' not in e]
    return {'native_title_recovery':True,'input_cleared':True,'old_view_destroyed':True,'subscriptions_removed':True,'expired_window_clears':True,'four_errors_within_five_seconds_halt':True}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--base-url',default='http://127.0.0.1:5174/');parser.add_argument('--output',type=Path)
    parser.add_argument('--quick',action='store_true');parser.add_argument('--recovery-only',action='store_true');parser.add_argument('--cycles',type=int,default=20)
    args=parser.parse_args();output=args.output or Path(tempfile.mkdtemp(prefix='martian-scenes-'));output.mkdir(parents=True,exist_ok=True)
    if output.resolve().is_relative_to(ROOT/'baselines/pixi'):raise ValueError('Do not overwrite frozen references')
    report={'complete':False,'base_url':args.base_url,'preservation':preservation(),'cases':[],
            'runtime_source_sha256':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((ROOT/'src').rglob('*.js'))},
            'limitations':['Controllers are simulated through navigator.getGamepads; physical two-controller and rumble review remains manual.','Audio listening acceptance is milestone 5; performance/soak acceptance is milestone 6.']}
    def save():(output/'checks.json').write_text(json.dumps(report,indent=2)+'\n')
    save()
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=which('chromium'),args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        report['browser']=browser.version
        for renderer,dpr in ([('auto',1)] if args.quick else [('auto',1),('canvas',1),('auto',2),('canvas',2)]):
            context=browser.new_context(viewport={'width':1280,'height':720},device_scale_factor=dpr);page,errors=open_page(context,args.base_url,renderer)
            page.set_default_timeout(0)
            if args.recovery_only:
                checks={'renderer':renderer,'dpr':dpr,'recovery':recovery(page,errors),'disposal':disposal(page)}
                assert not errors,errors
                context.close();report['cases'].append(checks);save();print('Passed recovery:',renderer,dpr,flush=True);continue
            checks={'renderer':renderer,'dpr':dpr,'keyboard':keyboard_and_settings(page),'fullscreen':fullscreen_checks(page),'flow':match_flow(page,output,f'{renderer}-dpr{dpr}')}
            if dpr==1:checks['ownership']=ownership(page,args.cycles)
            checks['disposal']=disposal(page);assert not errors,errors
            context.close()
            context=browser.new_context(viewport={'width':1280,'height':720},device_scale_factor=dpr);page,errors=open_page(context,args.base_url,renderer,True)
            checks['controllers']=controllers(page);checks['controller_disposal']=disposal(page);assert not errors,errors
            context.close();report['cases'].append(checks);save();print('Passed scenes:',renderer,dpr,flush=True)
        browser.close()
    report['complete']=True;save();print('Scene gate passed:',output)


if __name__=='__main__':main()
