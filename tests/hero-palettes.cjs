const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert'),os=require('os');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 try {res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}
 catch {res.writeHead(404);res.end();}
});
const names=['original','violeta-rosa','coral','magenta','ciruela'];
(async()=>{
 let browser;
 try {
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  const errors=[],badResources=[];
  for(const mobile of [false,true])for(let index=0;index<names.length;index++){
   const viewport=mobile?{width:390,height:844}:{width:1440,height:900};
   const page=await browser.newPage({viewport,deviceScaleFactor:1,...(mobile?{isMobile:true,hasTouch:true}:{})});
   // Exercise the standalone Canvas 2D fallback independently of the new shader.
   await page.route('**/js/hero-shader.bundle.js*',route=>route.abort());
   page.on('pageerror',e=>errors.push(e.message));
   page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1')&&r.status()>=400)badResources.push(r.url());});
   // Force each choice in tests, without adding a palette override to the site.
   await page.addInitScript(({index,mobile})=>{
    window.paletteRandomCalls=0;window.paletteRandomValue=(index+.5)/5;
    const random=Math.random;
    Math.random=()=>{
     if(!window.ArtimanasHeroPalette){window.paletteRandomCalls++;return window.paletteRandomValue;}
     return random();
    };
    if(mobile)window.DeviceOrientationEvent=class {};
   },{index,mobile});
   await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
   const hero=page.locator('.hero'),canvas=page.locator('#hero-gradient');
   await page.waitForFunction(()=>Number(document.querySelector('.hero').dataset.phase)>2.5);
   assert.equal(await hero.getAttribute('data-palette'),names[index]);
   const first=await canvas.evaluate(e=>e.toDataURL());
   const phase=Number(await hero.getAttribute('data-phase'));
   await page.waitForFunction(start=>Number(document.querySelector('.hero').dataset.phase)>start+.6,phase);
   assert.notEqual(await canvas.evaluate(e=>e.toDataURL()),first,'Ambient animation changes actual canvas pixels');
   assert(await hero.locator('h1 img').evaluateAll(images=>images.filter(e=>e.getBoundingClientRect().width>0).every(e=>e.complete&&e.naturalWidth>0)),'Visible logo images load');
   assert(await page.locator('.hero .marquee').isVisible());
   assert.equal(await page.locator('.hero .marquee-track').evaluate(e=>getComputedStyle(e).animationPlayState),'running');
   assert(await hero.evaluate(e=>{
    const base=getComputedStyle(document.body).backgroundColor;
    return base==='rgb(16, 8, 15)'&&getComputedStyle(e,'::before').backgroundImage.endsWith(base+' 100%)');
   }),'Fade ends in the catalog background color');
   const prefix=path.join(os.tmpdir(),`artimanas-palette-${index}-${mobile?'mobile':'desktop'}`);
   await page.screenshot({path:prefix+'.png'});
   const height=await hero.evaluate(e=>e.offsetHeight);
   await page.screenshot({path:prefix+'-seam.png',clip:{x:0,y:height-24,width:viewport.width,height:48}});
   if(mobile){
    await page.evaluate(()=>{
     for(const [beta,gamma] of [[0,0],[14,-14]]){
      const event=new Event('deviceorientation');Object.defineProperties(event,{beta:{value:beta},gamma:{value:gamma}});dispatchEvent(event);
     }
    });
    assert.equal(await hero.getAttribute('data-sensor'),'active');
   }else await page.mouse.move(200,200);
   const beforeInput=await canvas.evaluate(e=>e.toDataURL());
   const inputPhase=Number(await hero.getAttribute('data-phase'));
   await page.waitForFunction(start=>Number(document.querySelector('.hero').dataset.phase)>start+.4,inputPhase);
   assert.notEqual(await canvas.evaluate(e=>e.toDataURL()),beforeInput,'Animation continues with mouse/tilt input');
   // A later random value must never affect scroll, resize or rotation.
   await page.evaluate(()=>{window.paletteRandomValue=.99;scrollTo({top:innerHeight*2,behavior:'instant'});});
   await page.setViewportSize(mobile?{width:844,height:390}:{width:1200,height:800});
   if(mobile)await page.evaluate(()=>dispatchEvent(new Event('orientationchange')));
   await page.setViewportSize(viewport);
   await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
   await page.waitForFunction(()=>document.querySelector('.hero').dataset.motion==='running');
   assert.equal(await hero.getAttribute('data-palette'),names[index]);
   assert.equal(await page.evaluate(()=>window.paletteRandomCalls),1,'Only one palette draw per page load');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
   await page.close();
   console.log(`PASS ${names[index]} ${mobile?'mobile':'desktop'}: pixels animate, input, logo, ribbon, seam, stable selection`);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(badResources,[]);
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
