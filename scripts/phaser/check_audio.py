"""Milestone 5: native Web Audio synthesis, real gestures and scene delivery.

Offline checks require Vite at --base-url. --phaser-url optionally checks the
production host as well. No sound recipes, engine code or frozen references are
rewritten. Physical listening and other browsers remain explicit review gates.
"""
import argparse
import base64
import hashlib
import json
import tempfile
import wave
from pathlib import Path
from shutil import which

import numpy as np
from playwright.sync_api import sync_playwright
from check_primitives import preservation
from check_scenes import SETUP

ROOT = Path(__file__).resolve().parents[2]


def open_page(browser, base, renderer='auto', phaser=True, trusted=True):
    context = browser.new_context(viewport={'width': 1280, 'height': 720})
    context.add_init_script(path=str(ROOT/'scripts/phaser/audio_probe.js'))
    context.add_init_script("Date.now=()=>1790000000123;window.__pads=[];Object.defineProperty(navigator,'getGamepads',{value:()=>window.__pads});")
    page = context.new_page(); errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base.rstrip('/')+'/?date=2026-02-15'+('&engine=phaser&renderer='+renderer if phaser else ''))
    page.wait_for_function('!!window.__game')
    assert page.locator('canvas').count() == 1
    assert page.evaluate('__audioProbe.contexts.length') == 0, 'Engine created an audio context before a gesture'
    if phaser:
        assert page.evaluate('__game.app.config.audio.noAudio && !__game.app.sound.context && __game.app.sound.sounds.length===0')
    if trusted:
        page.keyboard.press('Space')
        page.wait_for_function('__audioProbe.contexts.length===1 && __audioProbe.contexts[0].state==="running"')
        assert page.locator('#start').count() == 0
    if phaser:
        page.evaluate(SETUP)
    else:
        page.evaluate("__game.app.ticker.stop()")
    return context, page, errors


def install_recipes(page, base):
    page.evaluate("async url=>{const audio=await import(new URL('src/audio.js',url));__audioProbe.installRecipes(audio);}", base)


def event_mapping(page):
    # Independent expectations cover every switch arm and its data-dependent branches.
    cases = [
        ({'type':'shot','side':'red','x':0},['zap']),
        ({'type':'shot','side':'blue','x':1280,'triple':True},['zap','zap']),
        ({'type':'dryFire'},['dry']),({'type':'hit','shielded':False,'x':640},['thud']),
        ({'type':'hit','shielded':True,'x':640},['deflect']),
        ({'type':'ram','shielded':False,'x':640},['thud','boom']),
        ({'type':'ram','shielded':True,'x':640},['deflect']),({'type':'dazed'},['womp']),
        ({'type':'burst'},['splat']),({'type':'animalRain','count':2,'to':'cow'},['moo']),
        ({'type':'animalRain','count':2,'to':'lamb'},['baa']),({'type':'animalRain','count':0},[]),
        ({'type':'bump'},['boing']),({'type':'reload'},['click']),
        *[({'type':'hook','side':'red','kind':kind,'x':0},['lift']+([voice] if voice else []))
          for kind,voice in [('cow','moo'),('lamb','baa'),('greenman','chirp'),('wolf','growl'),('crate',None),('package',None),('timebomb',None)]],
        ({'type':'interrupt','side':'red'},['womp']),({'type':'pickup','side':'blue'},['ding']),
        ({'type':'land','delivered':False},[]),({'type':'land','delivered':True,'golden':True},['goldChime']),
        ({'type':'land','delivered':True,'stolen':False},['chime']),
        ({'type':'land','delivered':True,'stolen':True},['chime']),
        ({'type':'countdown'},['beep']),({'type':'go'},['beep']),({'type':'roundEnd'},['jingle']),
        ({'type':'release','kind':'cow'},['moo']),({'type':'release','kind':'crate'},[]),
        ({'type':'wolfIncoming'},['howl']),({'type':'wolfLeaves'},['howl']),
        ({'type':'wolfEat'},['chomp','baa']),({'type':'wolfLand'},['growl']),
        ({'type':'tick','n':5},['tick']),({'type':'tick','n':3},['tick']),
        ({'type':'timeBombDrop'},['whistle']),({'type':'timeBombLand'},['click']),
        ({'type':'splat'},['splat']),({'type':'spooked','kind':'cow'},['moo','boing']),
        ({'type':'spooked','kind':'lamb'},['baa','boing']),({'type':'extinguish'},['fizz']),
        ({'type':'rocketLaunch'},['whoosh']),({'type':'bombDrop'},['whistle']),
        ({'type':'explosion','big':False},['boom']),({'type':'explosion','big':True},['boom']),
        ({'type':'chuteOpen'},['flap']),({'type':'greenmanPanic'},['ohNo']),
        ({'type':'greenmanGone'},['splat']),({'type':'crateIncoming'},['horn']),
        ({'type':'ammoCrate'},['click','ding']),({'type':'goldenIncoming'},['harp']),
        ({'type':'dropIncoming'},['siren']),({'type':'restock'},['horn','moo']),
        ({'type':'powerup'},['fanfare']),({'type':'powerEnd','side':'red'},['powerDown']),
        ({'type':'knockLoose'},['pop']),({'type':'laserOn','side':'blue'},['laser']),
        ({'type':'laserOff','side':'blue'},[]),({'type':'unknown'},[]),
    ]
    traces = page.evaluate("""cases=>{
      const p=__audioProbe;let clock=1;const rows=[];
      for(const [event,expected] of cases){p.clock=clock;clock+=.3;p.recipes=[];p.audio.handleEvents([event]);
        const starts=p.recipes.filter(r=>r.action==='start');
        if(JSON.stringify(starts.map(r=>r.name))!==JSON.stringify(expected))throw Error(JSON.stringify({event,expected,actual:p.recipes}));
        rows.push({event,trace:structuredClone(p.recipes)});}
      p.audio.stopVoices();return rows;
    }""", cases)
    assert traces[0]['trace'][0]['opts']['side'] == 'red'
    assert traces[0]['trace'][0]['pan'] == -0.6000000238418579
    assert [row['opts']['side'] for row in traces[1]['trace']] == ['blue','red']
    assert traces[1]['trace'][0]['pan'] > .59
    by_event = {(row['event']['type'],json.dumps(row['event'],sort_keys=True)):row for row in traces}
    assert len(by_event) == len(cases)
    lands = [row for row in traces if row['event']['type']=='land' and row['trace']]
    assert [row['trace'][0]['opts'].get('full') for row in lands] == [None,True,False]
    ticks = [row for row in traces if row['event']['type']=='tick']
    assert [row['trace'][0]['opts']['urgent'] for row in ticks] == [False,True]
    countdown = [row for row in traces if row['event']['type'] in ('countdown','go')]
    assert [row['trace'][0]['opts'] for row in countdown] == [{},{'go':True}]
    assert any(row['action']=='stop' and row['name']=='lift' for case in traces for row in case['trace'])
    assert any(row['action']=='stop' and row['name']=='laser' for case in traces for row in case['trace'])
    # Explicit interrupted/overwritten voices, burst, power expiry and round cleanup.
    stops = page.evaluate("""()=>{
      const p=__audioProbe;p.recipes=[];p.clock=30;
      p.audio.handleEvents([{type:'hook',side:'red',kind:'cow'},{type:'hook',side:'blue',kind:'lamb'},
        {type:'laserOn',side:'red'},{type:'laserOn',side:'blue'}]);
      p.clock=30.1;p.audio.handleEvents([{type:'burst',lifting:'red'},{type:'powerEnd',side:'blue'},{type:'roundEnd'}]);
      const trace=structuredClone(p.recipes);p.clock=null;return trace;
    }""")
    assert [(r['name'],r['t']) for r in stops if r['action']=='stop'] == [('lift',30.1),('laser',30.1),('laser',30.1),('lift',30.1)]
    return {'cases':len(cases),'traces':traces,'overlapping_voice_cleanup':stops}


def throttle_checks(page):
    return page.evaluate("""()=>{
      const p=__audioProbe,assert=(ok,msg)=>{if(!ok)throw Error(msg);};p.audio.stopVoices();p.recipes=[];p.clock=0;
      for(let i=0;i<10;i++)p.audio.play('zap');assert(p.recipes.length===3,'identical start cap');
      p.clock=.081;p.audio.play('zap');assert(p.recipes.length===4,'same window expiry');
      p.clock=1;p.recipes=[];
      for(const name of Object.keys(p.audio.SOUNDS))p.audio.play(name);
      assert(p.recipes.length===24,'global start cap');
      p.clock=1.251;p.audio.play('zap');assert(p.recipes.length===25,'global window expiry');
      p.clock=.01;p.audio.play('zap');assert(p.recipes.length===26,'clock reset');
      assert(p.audio.play('missing')===null,'missing recipe');p.audio.stopVoices();p.clock=null;
      return {same_sound_starts:3,same_window_seconds:.08,global_starts:24,global_window_seconds:.25,clock_reset:true,missing_sound_silent:true};
    }""")


def listening_trace(page):
    return page.evaluate("""()=>{
      const p=__audioProbe;p.audio.stopVoices();p.recipes=[];
      const at=(t,events)=>{p.clock=t;p.audio.handleEvents(events);};
      at(.1,[{type:'countdown'}]);at(.6,[{type:'go'}]);
      at(1,[{type:'shot',side:'red',x:0}]);at(1.4,[{type:'shot',side:'blue',x:1280}]);
      at(1.8,[{type:'hook',side:'red',kind:'cow',x:160}]);at(2.4,[{type:'interrupt',side:'red',x:160}]);
      at(3,[{type:'laserOn',side:'red'},{type:'laserOn',side:'blue'}]);
      at(3.7,[{type:'laserOff',side:'red'},{type:'laserOff',side:'blue'}]);
      at(4.3,Array.from({length:9},()=>({type:'burst',x:640})));
      at(5,[{type:'land',delivered:true,x:160}]);
      at(6,[{type:'land',delivered:true,golden:true,x:1120}]);at(8.5,[{type:'roundEnd'}]);
      p.clock=null;return structuredClone(p.recipes);
    }""")


def offline_checks(page, base, trace, output, label):
    page.evaluate("""async url=>{
      // Deterministic noise is a fixture only. Production Math.random is untouched.
      let seed=192837;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      window.__offline=await import(new URL('scripts/phaser/audio_offline.js',url));
    }""",base)
    names=page.evaluate('Object.keys(__audioProbe.audio.SOUNDS)')
    cases=[{'name':name} for name in names]
    cases += [{'name':'zap','opts':{'side':'blue'}},{'name':'tick','opts':{'urgent':True}},
              {'name':'chime','opts':{'full':False}},{'name':'boom','opts':{'big':False}},
              {'name':'beep','opts':{'go':True}},{'name':'lift','stop':.35},
              {'name':'zap','pan':-.6},{'name':'zap','pan':.6},{'name':'zap','muted':True}]
    rows=[]
    for case in cases:
        metrics=page.evaluate('fixture=>__offline.renderRecipe(fixture)',case)
        if case.get('muted'):
            assert metrics['peak']==0
        else:
            assert 0<metrics['peak']<1.1,(case,metrics)
            assert .09<=metrics['first']<.15,(case,metrics)
            assert .12<metrics['last']<3.5,(case,metrics)
        rows.append({'fixture':case,'metrics':metrics})
    normal={row['fixture']['name']:row['metrics'] for row in rows[:len(names)]}
    variants=rows[len(names):]
    assert variants[0]['metrics']['crossings']>normal['zap']['crossings']
    assert variants[1]['metrics']['crossings']>normal['tick']['crossings']
    assert variants[3]['metrics']['rms'][0]<normal['boom']['rms'][0]
    assert variants[5]['metrics']['last']<normal['lift']['last']
    left,right=variants[6]['metrics']['rms'],variants[7]['metrics']['rms']
    assert left[0]>left[1]*2 and right[1]>right[0]*2
    assert abs(left[0]-right[1])<1e-7 and abs(left[1]-right[0])<1e-7
    rendered=page.evaluate('trace=>__offline.renderTrace(trace)',trace)
    (output/(label+'-float.pcm')).write_bytes(base64.b64decode(rendered.pop('float_pcm')))
    pcm=base64.b64decode(rendered.pop('pcm'))
    with wave.open(str(output/(label+'-events.wav')),'wb') as wav:
        wav.setnchannels(2);wav.setsampwidth(2);wav.setframerate(48000);wav.writeframes(pcm)
    return {'recipes':len(names),'cases':rows,'listening_trace':trace,'listening_pcm':rendered}


def compare_offline(reference, candidate, output):
    assert reference['mapping']==candidate['mapping']
    assert reference['throttle']==candidate['throttle']
    assert reference['listening_trace']==candidate['listening_trace']
    for a,b in zip(reference['cases'],candidate['cases'],strict=True):
        assert a['fixture']==b['fixture']
        for key in a['metrics']:
            assert np.allclose(a['metrics'][key],b['metrics'][key],rtol=0,atol=1e-6),(a['fixture'],key)
    a=np.frombuffer((output/'pixi-float.pcm').read_bytes(),dtype='<f4')
    b=np.frombuffer((output/'phaser-float.pcm').read_bytes(),dtype='<f4')
    assert a.shape==b.shape
    error=np.abs(a-b)
    result={'samples':a.size,'max_float_error':float(error.max()),'rms_float_error':float(np.sqrt(np.mean(error.astype(np.float64)**2))),
            'max_float_error_limit':2e-6,'rms_float_error_limit':1e-8}
    assert result['max_float_error']<=2e-6 and result['rms_float_error']<=1e-8,result
    return result


def scene_trace(browser, base, lasers):
    pages=[];contexts=[];errors=[]
    for phaser in [False,True]:
        context,page,failures=open_page(browser,base,phaser=phaser);contexts.append(context);pages.append(page);errors.append(failures)
        install_recipes(page,base)
        page.evaluate("""async ({phaser,lasers,url})=>{
          const input=phaser?__game.input:await import(new URL('src/input.js',url));let now=0,last=0,acc=0;
          window.__frame=ms=>{now+=ms;const elapsed=now-last;last=now;__audioProbe.clock=1+now/1000;
            if(phaser)__game.game.update(now);
            else {acc+=Math.min(elapsed/1000,.1);while(acc>=1/60){input.pollPads();__game.scene.update(1/60);input.endStep();acc-=1/60;}__game.scene.render();}};
          window.__edge=(code,down)=>window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code}));
          for(let i=0;i<4;i++)__frame(100);__game.session.players=2;__game.session.cheats.lasers=lasers;
          __edge('Digit2',true);__frame(100);__edge('Digit2',false);__edge('Enter',true);__frame(100);__edge('Enter',false);
          if(!__game.scene.round)throw Error('not in play');
          window.__stepEvents=[];const scene=__game.scene,update=scene.update;
          scene.update=function(dt){update.call(this,dt);__stepEvents.push(structuredClone(this.round.events));};
          __audioProbe.recipes=[];
        }""",{'phaser':phaser,'lasers':lasers,'url':base})
    digest=hashlib.sha256();steps=0;sounds={};event_types=set();starts=0
    for frame in range(360):
        ms=[100,1000/30,1000/60,1000/120,1000/144][frame%5]
        edges=[]
        if frame%40==0:edges=[['Space',True],['Enter',True]]
        if frame%40==10:edges=[['Space',False],['Enter',False]]
        results=[]
        for page in pages:
            results.append(page.evaluate("""({ms,edges})=>{__stepEvents=[];__audioProbe.recipes=[];
              for(const [code,down] of edges)__edge(code,down);__frame(ms);
              return {round:JSON.parse(JSON.stringify(__game.scene.round)),events:__stepEvents,audio:structuredClone(__audioProbe.recipes)};}
            """,{'ms':ms,'edges':edges}))
        if results[0]!=results[1]:raise AssertionError({'frame':frame,'lasers':lasers,'pixi_audio':results[0]['audio'],'phaser_audio':results[1]['audio']})
        row=results[0];steps+=len(row['events']);digest.update(json.dumps(row,sort_keys=True).encode())
        flat_events=[event for events in row['events'] for event in events]
        for event_type,sound_name in [('countdown','beep'),('shot','zap'),('laserOn','laser')]:
            expected=sum(1+int(e.get('triple',False)) if event_type=='shot' else 1 for e in flat_events if e['type']==event_type)
            if event_type=='countdown':expected+=sum(e['type']=='go' for e in flat_events)
            actual=sum(r['action']=='start' and r['name']==sound_name for r in row['audio'])
            assert actual==expected,{'frame':frame,'event':event_type,'expected':expected,'actual':actual}
        event_types.update(e['type'] for events in row['events'] for e in events)
        for sound in row['audio']:
            key=sound['action']+':'+sound['name'];sounds[key]=sounds.get(key,0)+1
            if sound['action']=='start':starts+=1
    assert 'countdown' in event_types and 'go' in event_types
    assert ('laserOn' if lasers else 'shot') in event_types
    if lasers:assert 'laserOff' in event_types and sounds.get('stop:laser',0)>0
    else:assert sounds.get('start:zap',0)>0
    assert all(not e for e in errors),errors
    for context in contexts:context.close()
    return {'lasers':lasers,'frames':360,'steps':steps,'audio_starts':starts,'sounds':sounds,'event_types':sorted(event_types),'state_events_audio_sha256':digest.hexdigest()}


def lifecycle(page, cycles):
    # Production-compatible: observe native contexts/recipes via DOM controls only.
    page.evaluate('__tick(4);__game.session.cheats.lasers=true')
    for _ in range(cycles):
        page.evaluate("""()=>{
          __start(2);while(__game.scene.round.phase==='countdown')__tick();
          window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space'}));
          window.dispatchEvent(new KeyboardEvent('keydown',{code:'Enter'}));__tick();
        }""")
        assert page.evaluate('__audioProbe.contexts.length')==1
        page.evaluate("__press('KeyP')")
        page.wait_for_function('__audioProbe.contexts[0].state==="suspended"')
        before=page.evaluate('__audioProbe.snapshot()')
        # A real key while paused must not replace/resume the suspended context.
        page.keyboard.press('m');page.evaluate('__tick()')
        assert page.evaluate('__audioProbe.contexts[0].state')=='suspended'
        assert page.evaluate('__audioProbe.contexts.length')==1
        page.keyboard.press('m');page.evaluate('__tick()')
        page.evaluate("__press('Enter')")
        page.wait_for_function('__audioProbe.contexts[0].state==="running"')
        # Release held lasers, then exit through the actual pause menu.
        page.evaluate("""()=>{
          window.dispatchEvent(new KeyboardEvent('keyup',{code:'Space'}));
          window.dispatchEvent(new KeyboardEvent('keyup',{code:'Enter'}));__tick();
          __press('KeyP');for(let i=0;i<5;i++)__press('ArrowDown');__press('Enter');__tick(4);
          if(__game.scene.kind!=='title')throw Error('exit did not return to title');
        }""")
        page.wait_for_function('__audioProbe.contexts[0].state==="running"')
        assert len(before['contexts'])==1
    snapshot=page.evaluate('__audioProbe.snapshot()')
    assert snapshot['compressor']=={'threshold':-14,'ratio':4}
    # Two menu mute toggles use the original 20 ms target smoothing.
    assert page.evaluate('__audioProbe.automations.filter(r=>r.values[2]===.02).length')==cycles*2
    assert sum(row['op']=='close' for row in snapshot['operations'])==0
    return {'cycles':cycles,'one_context_across_transitions':True,'pause_suspend':True,'gesture_does_not_wake_paused_context':True,
            'resume_same_context':True,'mute_gain_smoothing_seconds':.02,'before_drain':snapshot}


def blocked_and_replacement(browser, base):
    # Playwright evaluate() grants DevTools user activation. The initial blocked
    # attempt must run entirely in the page before any evaluated inspection.
    context=browser.new_context(viewport={'width':1280,'height':720})
    context.add_init_script(path=str(ROOT/'scripts/phaser/audio_probe.js'))
    context.add_init_script("""(()=>{
      const timer=setInterval(async()=>{
        if(!window.__game)return;clearInterval(timer);
        const audio=await import(new URL('src/audio.js',location.href));__audioProbe.audio=audio;
        const before=__audioProbe.contexts.length;audio.unlockAudio();audio.unlockAudio();
        console.log('audio-blocked:'+JSON.stringify({before,count:__audioProbe.contexts.length,
          state:__audioProbe.contexts[0].state,activation:navigator.userActivation.hasBeenActive}));
      },50);
    })();""")
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    with page.expect_console_message(predicate=lambda msg:msg.text.startswith('audio-blocked:'),timeout=15000) as pending:
        page.goto(base.rstrip('/')+'/?engine=phaser')
    initial=json.loads(pending.value.text.split(':',1)[1])
    assert initial=={'before':0,'count':1,'state':'suspended','activation':False},initial
    page.wait_for_timeout(550)
    page.keyboard.press('Space')
    page.wait_for_function('__audioProbe.contexts.length===2 && __audioProbe.contexts[0].state==="closed" && __audioProbe.contexts[1].state==="running"')
    assert page.evaluate('__audioProbe.audio.audioUnlocked()')
    # A browser/device suspension is resumed by the host visibility hook.
    page.evaluate('__audioProbe.contexts[1].suspend()')
    page.wait_for_function('__audioProbe.contexts[1].state==="suspended"')
    page.evaluate('document.dispatchEvent(new Event("visibilitychange"))')
    page.wait_for_function('__audioProbe.contexts[1].state==="running"')
    assert not errors,errors
    result={'initial_untrusted_attempt':initial,'construction_grace':True,'trusted_replacement_closes_old_context':True,
            'visibility_notification_resume':True,'snapshot':page.evaluate('__audioProbe.snapshot()')}
    context.close();return result


def controller_and_pointer(browser, base):
    context,page,errors=open_page(browser,base,trusted=False)
    page.evaluate("""()=>{
      __game.game.started=true;document.getElementById('start').remove();
      const pad={index:0,connected:true,id:'audio fixture',mapping:'standard',axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
      window.__pads=[pad];__tick(4);
      window.__button=i=>{pad.buttons[i].pressed=true;__tick();pad.buttons[i].pressed=false;__tick();};
      __button(9);while(__game.scene.round.phase==='countdown')__tick();
      __button(0);__button(9);__button(13);__button(13);__button(0);
    }""")
    assert page.evaluate('__game.scene.paused')
    assert page.evaluate('__audioProbe.contexts.length')==0
    assert page.evaluate('__game.game.muted.visible && !__game.game.soundHint.visible')
    page.evaluate('__button(0);__button(9)')
    assert page.evaluate('__game.game.soundHint.visible')
    assert page.evaluate('__audioProbe.contexts.length')==0
    page.mouse.click(640,100)
    page.wait_for_function('__audioProbe.contexts.length===1 && __audioProbe.contexts[0].state==="running"')
    page.evaluate('__tick()');assert not page.evaluate('__game.game.soundHint.visible')
    assert not errors,errors
    context.close()
    return {'controller_only_creates_no_context':True,'controller_sound_toggle_cannot_unlock':True,'sound_hint_until_pointer_gesture':True,'trusted_pointer_unlock':True}


def transition_cleanup(page):
    def activate():
        page.evaluate("""()=>{
          while(__game.scene.round.phase==='countdown')__tick();
          window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space'}));
          window.dispatchEvent(new KeyboardEvent('keydown',{code:'Enter'}));__tick();
          window.__stopsBefore=__audioProbe.stops.length;
        }""")
    page.evaluate('__start(2)');activate()
    page.evaluate("__press('KeyP');__press('ArrowDown');__press('Enter')")
    assert page.evaluate('__game.scene.kind')=='play'
    assert page.evaluate('__audioProbe.stops.length-__stopsBefore')>=6,'Restart left laser carriers running'
    page.wait_for_function('__audioProbe.contexts[0].state==="running"')
    activate()
    page.evaluate("""()=>{
      __game.scene.round.timeLeft=1/60;
      const animals=__game.scene.round.world.animals;
      for(const a of animals){a.state='gone';a.pen=null;}
      Object.assign(animals.find(a=>a.kind==='cow'),{state:'penned',pen:'red',x:80,y:660});
      __tick();
    }""")
    assert page.evaluate('__game.scene.kind')=='roundEnd'
    assert page.evaluate('__audioProbe.stops.length-__stopsBefore')>=6,'Round end left laser carriers running'
    page.evaluate('__finishResult()');assert page.evaluate('__game.scene.kind')=='tally'
    page.evaluate('__menuTitle()');assert page.evaluate('__game.scene.kind')=='title'
    page.evaluate('__start(2)');activate()
    page.evaluate("""()=>{
      const error=console.error;console.error=()=>{};
      try{__game.scene.update=()=>{throw Error('Audio recovery fixture');};__tick();}finally{console.error=error;}
    }""")
    assert page.evaluate('__game.scene.kind')=='title'
    assert page.evaluate('__audioProbe.stops.length-__stopsBefore')>=6,'Recovery left laser carriers running'
    assert page.evaluate('__audioProbe.contexts.length')==1
    page.wait_for_function('__audioProbe.contexts[0].state==="running"')
    page.evaluate('__tick(4);__start(2)');activate()
    page.evaluate('window.__disposedHost=__game.game;__disposedHost.dispose()')
    assert page.evaluate('__audioProbe.stops.length-__stopsBefore')>=6,'Host disposal left laser carriers running'
    assert page.evaluate('__audioProbe.contexts.length')==1
    return {'restart_stops_carriers':True,'round_end_stops_carriers':True,'error_recovery_stops_carriers':True,
            'host_dispose_stops_carriers':True,'transitions_retain_context':True}


def unsupported_audio(browser, base):
    context=browser.new_context(viewport={'width':1280,'height':720})
    context.add_init_script(path=str(ROOT/'scripts/phaser/audio_probe.js'))
    context.add_init_script('window.AudioContext=undefined;window.webkitAudioContext=undefined')
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base.rstrip('/')+'/?engine=phaser');page.wait_for_function('!!window.__game')
    page.keyboard.press('Space');page.evaluate(SETUP);page.evaluate('__tick(4);__start(2)')
    page.evaluate("while(__game.scene.round.phase==='countdown')__tick();__press('Space');__press('KeyP');__press('Enter')")
    assert page.evaluate('__game.scene.kind')=='play'
    assert page.evaluate('__audioProbe.contexts.length')==0
    assert not errors,errors
    context.close();return {'missing_audio_api_stays_playable':True}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--base-url',default='http://127.0.0.1:5174/')
    parser.add_argument('--phaser-url',action='append',default=[]);parser.add_argument('--output',type=Path);parser.add_argument('--cycles',type=int,default=6)
    args=parser.parse_args();output=args.output or Path(tempfile.mkdtemp(prefix='martian-audio-'));output.mkdir(parents=True,exist_ok=True)
    if args.cycles<1:parser.error('--cycles must be at least 1')
    if output.resolve().is_relative_to(ROOT/'baselines/pixi'):raise ValueError('Do not overwrite frozen references')
    report={'complete':False,'preservation':preservation(),'runtime_source_sha256':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((ROOT/'src').rglob('*.js'))},'offline':{},'scene_traces':[],'lifecycle':[]}
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=which('chromium'),args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=document-user-activation-required'])
        report['browser']=browser.version
        # Fresh engine pages ensure independent deterministic noise caches.
        for phaser in [False,True]:
            context,page,errors=open_page(browser,args.base_url,phaser=phaser);install_recipes(page,args.base_url)
            # Seed before the first noise recipe populates the service cache.
            page.evaluate('let seed=192837;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}')
            mapping=event_mapping(page);throttle=throttle_checks(page);trace=listening_trace(page)
            label='phaser' if phaser else 'pixi';report['offline'][label]=offline_checks(page,args.base_url,trace,output,label)
            report['offline'][label]['mapping']=mapping;report['offline'][label]['throttle']=throttle
            assert not errors,errors
            print('Offline recipes and all event branches passed:',label,flush=True);context.close()
        (output/'checks.json').write_text(json.dumps(report,indent=2)+'\n')
        report['offline_comparison']=compare_offline(report['offline']['pixi'],report['offline']['phaser'],output)
        for lasers in [False,True]:
            report['scene_traces'].append(scene_trace(browser,args.base_url,lasers));print('Real scene audio trace passed:',lasers,flush=True)
        report['autoplay_and_replacement']=blocked_and_replacement(browser,args.base_url)
        report['controller_and_pointer']=controller_and_pointer(browser,args.base_url)
        report['unsupported_audio']=unsupported_audio(browser,args.base_url)
        contexts=[];pages=[]
        cohorts=[(args.base_url,'auto'),(args.base_url,'canvas')]
        cohorts.extend((url,'auto') for url in args.phaser_url)
        for base,renderer in cohorts:
            context,page,errors=open_page(browser,base,renderer=renderer);contexts.append(context);pages.append((page,errors))
            result=lifecycle(page,args.cycles);result.update({'url':base,'renderer':renderer});report['lifecycle'].append(result)
            result['transitions']=transition_cleanup(page)
            print('Context/pause/mute cycles passed:',base,renderer,flush=True)
        # Laser LFOs have their original fixed 30 s lifetime after the carriers
        # stop. Wait for native ended events instead of treating that tail as a leak.
        for (page,errors),result in zip(pages,report['lifecycle']):
            page.wait_for_function('__audioProbe.drainCount()===0',timeout=40000,polling=100)
            client=page.context.new_cdp_session(page);client.send('HeapProfiler.collectGarbage');client.send('HeapProfiler.collectGarbage')
            result['after_drain']=page.evaluate('__audioProbe.snapshot()')
            assert result['after_drain']['retainedNodes']==2,'Collected audio wrappers did not return to the gain/compressor bus'
            page.evaluate('__disposedHost.dispose()')
            assert page.evaluate('__audioProbe.activeSources.size')==0
            assert page.evaluate('__audioProbe.contexts.length')==1
            result['disposed_no_sources']=True
            assert not errors,errors
            print('Native sources drained and host disposed:',result['renderer'],flush=True)
        for context in contexts:context.close()
        browser.close()
    report['complete']=True;(output/'checks.json').write_text(json.dumps(report,indent=2)+'\n');print('Audio gate passed:',output,flush=True)


if __name__=='__main__':main()
