"""Sequential Pixi/Phaser samples from the actual game host; never overwrite references."""
import argparse,json,tempfile,hashlib
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
from check_primitives import preservation
ROOT=Path(__file__).resolve().parents[2]
INIT="""(()=>{window.AudioContext=undefined;window.webkitAudioContext=undefined;Date.now=()=>1790000000123;let seed=12345;window.__resetCosmetics=()=>seed=12345;Math.random=()=>{seed=(seed+0x6d2b79f5)>>>0;let t=Math.imul(seed^(seed>>>15),seed|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};crypto.getRandomValues=a=>{for(let i=0;i<a.length;i++)a[i]=12345;return a;};})();"""
def main():
 p=argparse.ArgumentParser();p.add_argument('--base-url',default='http://127.0.0.1:5174/');p.add_argument('--fixture-url');p.add_argument('--output',type=Path);p.add_argument('--seconds',type=int,default=60);p.add_argument('--warmup',type=int,default=5);p.add_argument('--repeats',type=int,default=3);p.add_argument('--profiles',nargs='+',default=['ordinary','crowded','stress','animal-rain','snow','fireworks']);p.add_argument('--engines',nargs='+',default=['pixi','phaser']);p.add_argument('--dpr',type=int,default=1);p.add_argument('--browser',default=which('chromium'));p.add_argument('--software-gpu',action='store_true');p.add_argument('--resume',action='store_true',help='Keep complete samples with matching runtime and settings')
 args=p.parse_args();out=args.output or Path(tempfile.mkdtemp(prefix='martian-performance-'));out.mkdir(parents=True,exist_ok=True)
 if out.resolve().is_relative_to(ROOT/'baselines/pixi'):raise ValueError('Frozen references cannot be overwritten')
 if min(args.seconds,args.repeats,args.dpr)<1:raise ValueError('Positive samples/duration/DPR required')
 configuration={'base_url':args.base_url.rstrip('/'),'fixture_url':(args.fixture_url or args.base_url).rstrip('/'),'seconds':args.seconds,'warmup':args.warmup,'repeats':args.repeats,'profiles':args.profiles,'engines':args.engines,'dpr':args.dpr,'software_gpu':args.software_gpu}
 timed=(ROOT/'scripts/phaser/performance.js').read_text().split('export async function measure',1)[1]
 timing_hash=hashlib.sha256((INIT+timed).encode()).hexdigest()
 report={'configuration':configuration,'timing_helper_sha256':timing_hash,'complete':False,'preservation':preservation(),'samples':[],'runtime_source_sha256':{str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted((ROOT/'src').rglob('*.js'))}}
 if args.resume and (out/'performance.json').exists():
  prior=json.loads((out/'performance.json').read_text())
  assert prior['configuration']==configuration,'Settings changed; choose a new output directory'
  assert prior['timing_helper_sha256']==timing_hash,'Timed helper changed; choose a new output directory'
  assert prior['runtime_source_sha256']==report['runtime_source_sha256'],'Runtime changed; choose a new output directory'
  seen=set()
  for sample in prior['samples']:
   key=(sample['profile'],sample['repeat'],sample['engine']);assert key not in seen;seen.add(key)
   assert sample['profile'] in args.profiles and sample['engine'] in args.engines and 1<=sample['repeat']<=args.repeats
   assert sample['durationMs']==args.seconds*1000 and sample['warmupMs']==args.warmup*1000
   assert sample['metadata']['dpr']==args.dpr and sample['metadata']['viewport']==[1280,720]
   assert sample['metadata']['sound']=='audio disabled for graphics benchmark'
   assert all(resource['name'].startswith(args.base_url.rstrip('/')+'/') for resource in sample['startup']['resources'])
  report=prior;report['complete']=False
 completed={(s['profile'],s['repeat'],s['engine']) for s in report['samples']}
 with sync_playwright() as playwright:
  browser=playwright.chromium.launch(executable_path=args.browser,args=['--no-sandbox']+(['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] if args.software_gpu else []));assert not args.resume or not report.get('browser') or report['browser']==browser.version,'Browser changed';report['browser']=browser.version
  for profile in args.profiles:
   for repeat in range(args.repeats):
    for engine in args.engines:
     if (profile,repeat+1,engine) in completed:continue
     context=browser.new_context(viewport={'width':1280,'height':720},device_scale_factor=args.dpr);context.add_init_script(INIT);page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
     date='2026-12-24' if profile=='snow' else '2026-12-31' if profile=='fireworks' else '2026-02-15'
     page.goto(args.base_url.rstrip('/')+'/?date='+date+('&engine=phaser' if engine=='phaser' else ''));page.wait_for_function('!!window.__game',timeout=30000)
     startup=page.evaluate('({readyMs:performance.now(),resources:performance.getEntriesByType("resource").map(r=>({name:r.name,encoded:r.encodedBodySize,transferred:r.transferSize}))})')
     fixture=args.fixture_url or args.base_url
     page.evaluate("async base=>{window.__perf=await import(new URL('scripts/phaser/performance.js',base));await __perf.start();}",fixture)
     sample=page.evaluate('options=>__perf.measure(options)',{'profile':profile,'durationMs':args.seconds*1000,'warmupMs':args.warmup*1000,'fixtureBase':fixture});assert not errors,errors
     sample.update({'engine':engine,'repeat':repeat+1,'date':date,'startup':startup});report['samples'].append(sample)
     print(profile,repeat+1,engine,'fps',round(sample['meanFps'],2),'p95 CPU',round(sample['totalCpuMs']['p95'],2),'uploads',sample['uploads']['p95'],flush=True)
     (out/'performance.json').write_text(json.dumps(report,indent=2)+'\n');context.close()
  browser.close()
 report['complete']=True;(out/'performance.json').write_text(json.dumps(report,indent=2)+'\n');print('Performance samples complete:',out,flush=True)
if __name__=='__main__':main()
