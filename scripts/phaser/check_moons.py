"""Check moon phase lighting, circular proportions, haze and title version placement."""
import argparse
import hashlib
import io
import json
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
from check_sprites import open_page
ROOT = Path(__file__).resolve().parents[2]


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--base-url',default='http://127.0.0.1:5195/')
    parser.add_argument('--output',type=Path,default=Path('/tmp/martian-moon-review'))
    args=parser.parse_args()
    out=args.output
    out.mkdir(parents=True,exist_ok=True)
    report={'complete':False,'phases':[],'version':[], 'runtime_source_sha256':{str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted((ROOT/'src').rglob('*.js'))}}
    with sync_playwright() as p:
        b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        for renderer in ['auto','canvas']:
            c=b.new_context(viewport={'width':1280,'height':720})
            for phase in ['waning','quarter','waxing','full']:
                page,errors=open_page(c,args.base_url+f'?gallery=artwork&graphics=cartoon&art=scenery&moon={phase}&date=2026-02-15&renderer={renderer}')
                page.evaluate('__tick(4);__draw()')
                raw=page.screenshot(path=str(out/f'{renderer}-{phase}.png'))
                im=Image.open(io.BytesIO(raw)).convert('RGB')
                expected={'waning':[(-24,True),(24,False)],'quarter':[(-16,False),(16,True)],'waxing':[(-24,False),(-8,True),(24,True)],'full':[(-24,True),(24,True)]}[phase]
                # Sampling both sides checks crescent orientation as well as phase coverage.
                samples=[]
                for dx,lit in expected:
                    rgb=im.getpixel((1002+dx,188));brightness=sum(rgb)/3
                    assert brightness>100 if lit else brightness<60,(renderer,phase,dx,rgb)
                    samples.append({'dx':dx,'lit':lit,'rgb':rgb})
                if phase=='full':
                    # A circular disk has the same horizontal and vertical diameter.
                    for dx,dy in [(30,0),(-30,0),(0,30),(0,-30)]:
                        assert sum(im.getpixel((1002+dx,188+dy)))/3>100,(renderer,'full disk is oval',dx,dy)
                    for dx,dy in [(34,0),(-34,0),(0,34),(0,-34)]:
                        assert sum(im.getpixel((1002+dx,188+dy)))/3<100,(renderer,'full disk exceeds radius',dx,dy)
                haze=[sum(im.getpixel((1002+dx,188)))/3 for dx in [40,50,65]]
                assert haze[0]>haze[1]>haze[2],(renderer,phase,'missing haze',haze)
                assert not errors,errors
                report['phases'].append({'renderer':renderer,'phase':phase,'lightSamples':samples,'hazeBrightness':haze})
                page.close()
            for style in ['cartoon','classic']:
                page,errors=open_page(c,args.base_url+f'?graphics={style}&date=2026-02-15&renderer={renderer}')
                page.evaluate('__tick(4);__draw()')
                placement=page.evaluate(r'''()=>{
        const nodes=[];const visit=n=>{if(!n.visible)return;nodes.push(n);for(const c of n.list??[])visit(c);};visit(__game.scene.view);
        const version=nodes.find(n=>n.type==='Text'&&/^v\d+\./.test(n.text));
        const logo=nodes.find(n=>n.getData?.('cartoon-frame')==='logo');
        const title=nodes.filter(n=>n.type==='Text'&&n.text==='MARTIAN').at(-1);
        if(version.originX!==1||version.originY!==1)throw Error('version alignment');
        if(logo){
         if(Math.abs(version.x-logo.x-logo.displayWidth/2)>1e-8||version.y>=logo.y-logo.displayHeight/2)throw Error('version position');
        }else if(Math.abs(version.x-title.x-title.width+4)>1e-8||version.y>=title.y)throw Error('classic version changed');
        return {x:version.x,y:version.y,rightAligned:true,aboveTitle:true};
       }''')
                assert not errors,errors
                report['version'].append({'renderer':renderer,'style':style,**placement})
                page.close()
            c.close()
            print('Moon phases and version passed:',renderer,flush=True)
        b.close()
    report['complete']=True
    (out/'checks.json').write_text(json.dumps(report,indent=2)+'\n')


if __name__ == "__main__":
    main()
