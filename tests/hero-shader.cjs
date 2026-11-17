const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert'),os=require('os');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 try {res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}
 catch {res.writeHead(404);res.end();}
});
const palettes=[['#14032A','#451489','#9F5EF3'],['#3105BD','#EB6944','#DC4390'],['#08CCDD','#00B9D0','#00E6D0'],['#E7632F','#F65FBD','#E45749'],['#EAF158','#E1B5E1','#2F04BC']];
(async()=>{
 let browser;
 try {
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const errors=[],badResources=[];
  for(const mobile of [false,true])for(let index=0;index<5;index++){
   const viewport=mobile?{width:390,height:844}:{width:1440,height:900};
   const page=await browser.newPage({viewport,deviceScaleFactor:1,...(mobile?{isMobile:true,hasTouch:true}:{})});
   page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
   page.on('console',m=>{if(m.type()==='error')console.error(m.text().slice(0,500));});
   page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1')&&r.status()>=400){badResources.push(r.url());console.error(r.status(),r.url());}});
   await page.addInitScript(index=>{
    const random=Math.random;window.paletteDraws=0;
    Math.random=()=>{if(!window.ArtimanasHeroPalette){window.paletteDraws++;return (index+.5)/5;}return random();};
    window.gpuDraws=0;
    for(const API of [window.WebGLRenderingContext,window.WebGL2RenderingContext].filter(Boolean)){
     for(const method of ['drawArrays','drawElements']){const draw=API.prototype[method];API.prototype[method]=function(...args){window.gpuDraws++;return draw.apply(this,args);};}
    }
   },index);
   await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
   const hero=page.locator('.hero');
   try {await page.waitForFunction(()=>['ready','fallback'].includes(document.querySelector('.hero').dataset.shader),{},{timeout:40000});}
   catch(e){console.error(await hero.evaluate(e=>e.dataset));throw e;}
   assert.equal(await hero.getAttribute('data-shader'),'ready',JSON.stringify(await hero.evaluate(e=>e.dataset)));
   assert.equal(await hero.getAttribute('data-shader-colors'),palettes[index].join(','));
   assert.equal(await page.locator('#hero-gradient').count(),0,'Legacy Canvas is absent');
   const draws=await page.evaluate(()=>window.gpuDraws);
   await page.waitForFunction(n=>window.gpuDraws>n+3,draws);
   assert(await hero.locator('h1 img').evaluateAll(images=>images.filter(e=>e.clientWidth>0).every(e=>e.complete&&e.naturalWidth>0)));
   assert(await page.locator('.hero .marquee').isVisible());
   assert.equal(await page.locator('#hero-shader canvas').evaluate(e=>getComputedStyle(e).pointerEvents),'none');
   const prefix=path.join(os.tmpdir(),`artimanas-shader-${index}-${mobile?'mobile':'desktop'}`);
   await page.screenshot({path:prefix+'.png'});
   const height=await hero.evaluate(e=>e.offsetHeight);
   await page.screenshot({path:prefix+'-seam.png',clip:{x:0,y:height-24,width:viewport.width,height:48}});
   const phase=await hero.getAttribute('data-phase');
   await page.setViewportSize(mobile?{width:844,height:390}:{width:1200,height:800});
   await page.setViewportSize(viewport);
   assert.equal(await hero.getAttribute('data-shader-colors'),palettes[index].join(','));
   assert.equal(await page.evaluate(()=>window.paletteDraws),1);
   assert.equal(await hero.getAttribute('data-phase'),phase,'2D clock remains stopped during shader resize');
   if(mobile){
    await page.locator('[data-open-menu]').click();
    await page.locator('#menu-dialog [data-open-event]').click();
   }else await page.locator('[data-open-event]').first().click();
   assert(await page.locator('#event-dialog').isVisible(),'HTML links remain clickable');
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('#event-dialog').open);
   if(mobile&&await page.locator('#menu-dialog').isVisible()){
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.querySelector('#menu-dialog').open);
   }
   await page.evaluate(()=>scrollTo({top:1300,behavior:'instant'}));
   await page.waitForFunction(()=>!document.querySelector('#works').inert);
   const card=page.locator('.work-card.is-active .work-link');
   if(await card.count())await card.click();else await page.locator('.work-link').first().click();
   await page.waitForFunction(()=>document.querySelector('#work-dialog').dataset.phase==='settled');
   assert((await page.locator('#detail-description').textContent()).trim().length>0);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   // Context loss reveals the selected static gradient.
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('#work-dialog').open);
   await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
   await page.waitForFunction(()=>document.querySelector('.hero').dataset.shaderMotion==='running');
   await page.locator('#hero-shader canvas').evaluate(e=>e.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
   await page.waitForFunction(()=>document.querySelector('.hero').dataset.shader==='fallback');
   assert.equal(await page.locator('#hero-gradient').count(),0);
   assert((await hero.evaluate(e=>getComputedStyle(e).backgroundImage)).startsWith('linear-gradient('));
   await page.close();
   console.log(`PASS shader palette ${index+1} ${mobile?'mobile':'desktop'}: render, resize, HTML, catalog, static gradient after context loss`);
  }
  const unavailable=await browser.newPage();
  await unavailable.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /^webgl/.test(type)?null:get.call(this,type,...args);};});
  await unavailable.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await unavailable.waitForFunction(()=>document.querySelector('.hero').dataset.shader==='fallback');
  assert.equal(await unavailable.locator('#hero-shader canvas').count(),0);
  assert.equal(await unavailable.locator('#hero-gradient').count(),0);
  assert((await unavailable.locator('.hero').evaluate(e=>getComputedStyle(e).backgroundImage)).startsWith('linear-gradient('));
  await unavailable.close();
  assert.deepEqual(errors,[]);assert.deepEqual(badResources,[]);
  console.log('PASS no WebGL: selected static gradient');
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
