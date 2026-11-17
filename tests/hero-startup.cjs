const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert'),os=require('os');
const root=path.resolve(__dirname,'../dist'),gates=new Map();
const palettes=[['#14032A','#451489','#9F5EF3'],['#3105BD','#EB6944','#DC4390'],['#08CCDD','#00B9D0','#00E6D0'],['#E7632F','#F65FBD','#E45749'],['#EAF158','#E1B5E1','#2F04BC']];
const server=http.createServer(async(req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
 const mode=req.headers['x-startup-mode'];
 if(mode==='bundle-error'&&pathname.endsWith('hero-shader.bundle.js')){res.writeHead(503);return res.end();}
 if(pathname.endsWith('.hdr')){
  if(mode==='hdr-error'){res.writeHead(503);return res.end();}
  if(gates.has(mode))await gates.get(mode).promise;
 }
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 try {res.setHeader('Cache-Control','public, max-age=3600');res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}
 catch {res.writeHead(404);res.end();}
});
async function instrument(page,index,noWebGL=false){
 await page.addInitScript(({index,noWebGL})=>{
  window.paletteDraws=0;window.legacyContexts=0;window.startupFrames=[];window.fadeSamples=[];
  new MutationObserver(()=>{
   const hero=document.querySelector('.hero'),shader=document.querySelector('#hero-shader');
   if(!hero||hero.dataset.shader!=='ready'||!shader||window.fadeSamples.length)return;
   const animation=shader.getAnimations().find(a=>a.transitionProperty==='opacity');
   if(!animation)return;
   const time=animation.currentTime;
   animation.pause();animation.currentTime=150;
   window.fadeSamples.push(Number(getComputedStyle(shader).opacity));
   animation.currentTime=time;animation.play();
  }).observe(document,{subtree:true,attributes:true,attributeFilter:['class']});
  const random=Math.random;
  Math.random=()=>{if(!window.ArtimanasHeroPalette){window.paletteDraws++;return(index+.5)/5;}return random();};
  const get=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){
   if(this.id==='hero-gradient'&&type==='2d')window.legacyContexts++;
   return noWebGL&&/^webgl/.test(type)?null:get.call(this,type,...args);
  };
  function sample(){
   const hero=document.querySelector('.hero'),shader=document.querySelector('#hero-shader');
   // RAF may run before render-blocking stylesheets load; that is not a painted hero.
   if(hero&&shader&&getComputedStyle(hero).backgroundImage!=='none'&&window.startupFrames.length<300){
    window.startupFrames.push({state:hero.dataset.shader,legacy:window.legacyContexts,
     background:getComputedStyle(hero).backgroundImage,opacity:Number(getComputedStyle(shader).opacity)});
   }
   requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
 },{index,noWebGL});
}
(async()=>{
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.address().port}/index.html`;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const cold of (process.env.STARTUP_CACHE_MODE==='cold'?[true]:[false,true]))for(let index=0;index<5;index++){
   const page=await browser.newPage({viewport:cold?{width:390,height:844}:{width:1440,height:900},...(cold?{isMobile:true,hasTouch:true}:{})});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await instrument(page,index);
   const cdp=await page.context().newCDPSession(page);
   await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:cold});
   const mode=`cold-${index}`;
   let release;
   if(cold){const promise=new Promise(r=>{release=r;});gates.set(mode,{promise,resolve:release});await page.setExtraHTTPHeaders({'X-Startup-Mode':mode});}
   await page.goto(url,{waitUntil:'domcontentloaded'});
   if(cold){
    await page.waitForFunction(()=>document.querySelector('.hero').dataset.shader==='loading'&&document.querySelector('#hero-shader canvas'));
    assert.equal(await page.evaluate(()=>window.legacyContexts),0,'Legacy Canvas must not even initialize while loading');
    await page.screenshot({path:path.join(os.tmpdir(),`artimanas-static-start-${index}.png`)});
    release();gates.delete(mode);
   }
   await page.waitForFunction(()=>document.querySelector('.hero').dataset.shader==='ready');
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('#hero-shader')).opacity==='1');
   // Exercise an actual reload, warm with browser cache or cold with cache disabled.
   await page.reload({waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('.hero').dataset.shader==='ready');
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('#hero-shader')).opacity==='1');
   const result=await page.evaluate(()=>({palette:window.ArtimanasHeroPalette,draws:window.paletteDraws,legacy:window.legacyContexts,
    colors:document.querySelector('.hero').dataset.shaderColors,frames:window.startupFrames,fadeSamples:window.fadeSamples}));
   assert.deepEqual(result.palette.colors,palettes[index]);assert.equal(result.colors,palettes[index].join(','));
   assert.equal(result.draws,1);assert.equal(result.legacy,0);
   const first=result.frames[0];
   assert(first&&first.state==='loading'&&first.opacity===0,'First painted hero is static, not an old/partial shader');
   for(const hex of palettes[index]){
    const rgb=`rgb(${parseInt(hex.slice(1,3),16)}, ${parseInt(hex.slice(3,5),16)}, ${parseInt(hex.slice(5,7),16)})`;
    assert(first.background.includes(rgb),`Static palette mismatch: ${first.background}; expected ${rgb}`);
   }
   assert(!first.background.includes('url('));
   assert(result.fadeSamples.some(opacity=>opacity>0&&opacity<1),'Crossfade has an intermediate opacity at 150ms');
   assert(result.frames.every(f=>f.legacy===0),'No legacy frame anywhere in normal startup');
   assert.deepEqual(errors,[]);
   await page.screenshot({path:path.join(os.tmpdir(),`artimanas-startup-ready-${cold?'cold':'warm'}-${index}.png`)});
   await page.close();console.log(`PASS palette ${index+1} ${cold?'cache disabled/mobile':'normal reload/desktop'}: first frame, shared palette, fade, no legacy Canvas`);
  }
  for(const failure of ['no-webgl','hdr-error','bundle-error']){
   const page=await browser.newPage();
   await instrument(page,2,failure==='no-webgl');
   await page.setExtraHTTPHeaders({'X-Startup-Mode':failure});
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('.hero').dataset.shader==='fallback');
   assert.equal(await page.evaluate(()=>window.legacyContexts),0);
   assert.equal(await page.locator('#hero-gradient').count(),0);
   assert((await page.locator('.hero').evaluate(e=>getComputedStyle(e).backgroundImage)).startsWith('linear-gradient('));
   await page.close();console.log(`PASS ${failure}: selected static gradient, no legacy Canvas`);
  }
 }finally{for(const gate of gates.values())gate.resolve?.();await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
