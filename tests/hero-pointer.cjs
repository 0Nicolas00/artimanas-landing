const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert'),os=require('os');
const root=path.resolve(__dirname,'../dist');
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 try{res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}
 catch{res.writeHead(404);res.end();}
});
async function instrument(page){
 await page.addInitScript(()=>{
  window.legacyContexts=0;window.shaderTime=0;window.shaderMatrix=null;window.firstHeroFrame=null;
  const get=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){if(this.id==='hero-gradient'&&type==='2d')window.legacyContexts++;return get.call(this,type,...args);};
  // Observe the mesh's actual GPU uniforms, independently of the pointer implementation.
  for(const API of [window.WebGLRenderingContext,window.WebGL2RenderingContext].filter(Boolean)){
   const locations=new WeakMap(),programs=new WeakSet();
   const locate=API.prototype.getUniformLocation,matrix=API.prototype.uniformMatrix4fv,scalar=API.prototype.uniform1f;
   API.prototype.getUniformLocation=function(program,name){const result=locate.call(this,program,name);if(result)locations.set(result,{program,name});if(name==='uTime')programs.add(program);return result;};
   API.prototype.uniformMatrix4fv=function(location,transpose,data,...rest){const info=locations.get(location);if(programs.has(info?.program)){if(info.name==='modelViewMatrix')window.shaderMatrix=Array.from(data);if(info.name==='projectionMatrix')window.shaderProjection=Array.from(data);}return matrix.call(this,location,transpose,data,...rest);};
   API.prototype.uniform1f=function(location,value){if(locations.get(location)?.name==='uTime')window.shaderTime=value;return scalar.call(this,location,value);};
  }
  const sample=()=>{
   const hero=document.querySelector('.hero'),shader=document.querySelector('#hero-shader');
   if(hero&&shader&&getComputedStyle(hero).backgroundImage!=='none'){
    window.firstHeroFrame={state:hero.dataset.shader,background:getComputedStyle(hero).backgroundImage,opacity:getComputedStyle(shader).opacity};
   }else requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
 });
}
async function ready(page){
 await page.waitForFunction(()=>document.querySelector('.hero').dataset.shader==='ready'&&window.shaderMatrix);
 const initialTime=await page.evaluate(()=>window.shaderTime);
 await page.waitForFunction(time=>window.shaderTime>time+.5,initialTime);
 // Wait for the original camera's initial setup to settle before comparing mesh motion.
 await page.waitForFunction(()=>{
  const m=window.shaderMatrix,old=window.previousMatrix;window.previousMatrix=m?.slice();
  return old&&Math.abs(m[12]-old[12])<1e-7&&Math.abs(m[13]-old[13])<1e-7;
 });
}
(async()=>{
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.address().port}/index.html`;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const disabled=await browser.newPage({viewport:{width:1280,height:800}});
  await instrument(disabled);await disabled.goto(url);await ready(disabled);
  assert.equal(await disabled.locator('.hero').getAttribute('data-pointer-follow'),'false');
  const fixed=await disabled.evaluate(()=>window.shaderMatrix.slice()),automatic=await disabled.evaluate(()=>window.shaderTime);
  await disabled.mouse.move(30,110);await disabled.mouse.move(1250,750);
  await disabled.waitForFunction(time=>window.shaderTime>time+.5,automatic);
  const still=await disabled.evaluate(()=>window.shaderMatrix);
  assert(still.every((value,index)=>Math.abs(value-fixed[index])<1e-7),'Default background animates without pointer displacement');
  await disabled.mouse.wheel(0,250);await disabled.waitForFunction(()=>scrollY>20);
  await disabled.close();console.log('PASS default: automatic animation, fixed mesh, catalog scroll');
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  // Exercise the optional tracking mode without changing the shipped default.
  await page.route('**/index.html',async route=>{
   const response=await route.fetch();
   await route.fulfill({response,body:(await response.text()).replace('data-pointer-follow="false"','data-pointer-follow="true"')});
  });
  page.on('pageerror',e=>errors.push(e.message));await instrument(page);await page.goto(url);await ready(page);
  const base=await page.evaluate(()=>window.shaderMatrix);
  const boxes=await page.locator('.hero h1,.hero .marquee').evaluateAll(elements=>elements.map(e=>e.getBoundingClientRect().toJSON()));
  const rect=await page.locator('.hero').boundingBox();
  await page.mouse.move(30,110);
  await page.waitForFunction(base=>window.shaderMatrix[12]<base[12]-0.0001&&window.shaderMatrix[13]>base[13]+0.0001,base);
  const reversal=await page.evaluate(y=>{
   const before=window.shaderMatrix.slice();
   document.querySelector('.hero').dispatchEvent(new PointerEvent('pointermove',{clientX:1250,clientY:y,pointerType:'mouse',bubbles:true}));
   return {before,after:window.shaderMatrix.slice()};
  },rect.height-30);
  assert.deepEqual(reversal.before,reversal.after,'A rapid reversal changes only the target, never the mesh instantly');
  await page.mouse.move(1250,rect.height-30);
  await page.waitForFunction(base=>window.shaderMatrix[12]>base[12]+0.0001&&window.shaderMatrix[13]<base[13]-0.0001,base);
  await page.screenshot({path:path.join(os.tmpdir(),'artimanas-pointer-right.png')});
  assert.deepEqual(await page.locator('.hero h1,.hero .marquee').evaluateAll(elements=>elements.map(e=>e.getBoundingClientRect().toJSON())),boxes,'Logo and ribbon stay in place');
  const peak=await page.evaluate(()=>window.shaderMatrix);
  const projection=await page.evaluate(()=>window.shaderProjection);
  assert(Math.abs(peak[12]-base[12])*projection[0]/(2*Math.abs(base[14]))<.08,'Horizontal drag stays below 8% of the viewport, including camera zoom');
  assert(Math.abs(peak[13]-base[13])*projection[5]/(2*Math.abs(base[14]))<.08,'Vertical drag stays subtle');
  // The header is outside .hero: leaving it must release the drag back to center.
  await page.mouse.move(640,8);
  try{
   await page.waitForFunction(({base,peak})=>Math.abs(window.shaderMatrix[12]-base[12])<Math.abs(peak[12]-base[12])*.08,{base,peak},{timeout:40000});
   await page.waitForFunction(base=>Math.abs(window.shaderMatrix[13]-base[13])<0.00008,base,{timeout:40000});
  }catch(e){console.error({base:base.slice(12),peak:peak.slice(12),after:await page.evaluate(()=>({matrix:window.shaderMatrix.slice(12),time:window.shaderTime,state:document.querySelector('.hero').dataset.shaderMotion,target:document.elementFromPoint(640,8)?.tagName}))});throw e;}
  const time=await page.evaluate(()=>window.shaderTime);
  await page.waitForFunction(time=>window.shaderTime>time+.1,time);
  assert.equal(await page.locator('#hero-shader canvas').evaluate(e=>getComputedStyle(e).pointerEvents),'none');
  await page.locator('.site-header [data-open-event]').click();assert(await page.locator('#event-dialog').isVisible());
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#event-dialog').open);
  await page.mouse.wheel(0,250);await page.waitForFunction(()=>scrollY>20);
  // Reload both normally and without HTTP cache; neither path may initialize 2D.
  const cdp=await page.context().newCDPSession(page);await cdp.send('Network.enable');
  for(const cacheDisabled of [false,true]){
   await cdp.send('Network.setCacheDisabled',{cacheDisabled});await page.reload();
   await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await ready(page);
   const startup=await page.evaluate(()=>({frame:window.firstHeroFrame,legacy:window.legacyContexts}));
   assert.equal(startup.legacy,0);assert.equal(startup.frame.state,'loading');assert.equal(startup.frame.opacity,'0');assert(!startup.frame.background.includes('url('));
   console.log(`PASS reload ${cacheDisabled?'without cache':'normal'}: static palette, no legacy background`);
  }
  await page.close();console.log('PASS desktop: real mesh follows both axes, inertial reversal, center return, ambient motion, fixed HTML, click and scroll');
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  mobile.on('pageerror',e=>errors.push(e.message));await instrument(mobile);await mobile.goto(url);await ready(mobile);
  const mobileBase=await mobile.evaluate(()=>window.shaderMatrix),mobileTime=await mobile.evaluate(()=>window.shaderTime);
  await mobile.touchscreen.tap(40,150);await mobile.touchscreen.tap(350,600);
  await mobile.waitForFunction(time=>window.shaderTime>time+.2,mobileTime);
  const after=await mobile.evaluate(()=>window.shaderMatrix);
  assert(Math.abs(after[12]-mobileBase[12])<0.00001&&Math.abs(after[13]-mobileBase[13])<0.00001,'Touch does not drag the shader');
  assert.equal(await mobile.evaluate(()=>window.legacyContexts),0);
  await mobile.screenshot({path:path.join(os.tmpdir(),'artimanas-pointer-touch.png')});
  await mobile.close();assert.deepEqual(errors,[]);console.log('PASS touch: automatic animation keeps running without pointer drag');
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
