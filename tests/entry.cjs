const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert'),os=require('os');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 let p=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(p.endsWith(path.sep))p+='index.html';
 if(!p.startsWith(root)){res.writeHead(403);return res.end();}
 try {const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml','.jpg':'image/jpeg'};res.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));}catch(e){res.writeHead(404);res.end();}
});
(async()=>{
 await new Promise(r=>server.listen(8766,r));
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--disable-dev-shm-usage'],headless:true});
 const errors=[],badResources=[];
 async function make(options){const p=await browser.newPage(options);p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().startsWith('http://localhost')&&r.status()>=400)badResources.push(r.url())});await p.goto('http://localhost:8766');await p.waitForFunction(()=>!document.documentElement.dataset.heroIntro);return p;}
 const page=await make({viewport:{width:1440,height:900}});
 // Artwork access waits for the transition from the full-height cover.
 assert.equal(await page.locator('#student-heading').evaluate(e=>getComputedStyle(e).filter),'none');
 assert(await page.locator('#works').evaluate(e=>e.inert));
 await page.locator('.work-link').first().evaluate(e=>e.click());
 assert(!await page.locator('#work-dialog').isVisible(),'Cover artwork cannot open');
 const band=await page.locator('.hero .marquee').boundingBox();
 await page.mouse.move(700,band.y+band.height/2);await page.waitForTimeout(750);
 assert.equal(await page.locator('.cursor-label').textContent(),'Bajá para\nver más');
 await page.mouse.wheel(0,40);
 await page.waitForFunction(()=>scrollY>10);
 await page.waitForFunction(()=>document.querySelector('.cursor-label').textContent!=='Bajá para\nver más',{},{timeout:400});
 assert.notEqual(await page.locator('.cursor-label').textContent(),'Bajá para\nver más','Hint leaves at the beginning of scrolling');
 await page.mouse.wheel(0,60); // Same gesture momentum must not cut the centering short.
 await page.waitForFunction(()=>document.querySelector('#obras').dataset.entering==='false');
 const firstCenter=await page.locator('.work-card').first().evaluate(e=>{const r=e.getBoundingClientRect();return Math.abs(r.top+r.height/2-innerHeight/2);});
 assert(firstCenter<2,`First work centered: ${firstCenter}`);
 assert(!await page.locator('#works').evaluate(e=>e.inert));
 await page.waitForTimeout(900);
 const gap=await page.evaluate(()=>document.querySelector('.work-card img').getBoundingClientRect().top-document.querySelector('.hero').getBoundingClientRect().bottom);
 assert(gap>30,`Hero-to-artwork breathing room: ${gap}`);
 // Text fades before the cursor shrinks and is clipped inside its circular boundary.
 await page.locator('.work-link').first().hover();await page.waitForTimeout(700);
 await page.mouse.move(10,300);await page.waitForTimeout(100);
 assert.equal(await page.locator('.cursor-label').textContent(),'');
 assert.equal(await page.locator('#custom-cursor').evaluate(e=>getComputedStyle(e).overflow),'hidden');
 // Compare the final animated rectangle with the actual contained photo after handoff.
 async function checkHandoff(p,index){
   await p.locator('.work-link').nth(index).click();
   await p.waitForFunction(()=>!!document.querySelector('.detail-moving-image')?.getAnimations().length);
   const end=await p.locator('.detail-moving-image').evaluate(e=>{
     const {delay,duration}=e.getAnimations()[0].effect.getTiming();
     const animations=document.querySelector('#work-dialog').getAnimations({subtree:true});
     for(const a of animations){a.pause();a.currentTime=0;}
     const start=e.getBoundingClientRect(),startY=start.top+start.height/2;
     for(const a of animations)a.currentTime=delay+duration-1;
     const r=e.getBoundingClientRect();
     return {left:r.left,top:r.top,width:r.width,height:r.height,startY};
   });
   assert(Math.abs(end.startY-(await p.evaluate(()=>innerHeight/2)))<2,'The photo is centered before the detail opens');
   assert(Math.abs(end.startY-(end.top+end.height/2))<1,'The photo moves horizontally');
   await p.evaluate(()=>{for(const a of document.querySelector('#work-dialog').getAnimations({subtree:true}))a.play();});
   await p.waitForFunction(()=>!document.querySelector('.detail-moving-image'));
   const final=await p.locator('#media-stage img').evaluate(e=>{
     const r=e.getBoundingClientRect(),scale=Math.min(r.width/e.naturalWidth,r.height/e.naturalHeight);
     const width=e.naturalWidth*scale,height=e.naturalHeight*scale;
     return {left:r.left+(r.width-width)/2,top:r.top+(r.height-height)/2,width,height};
   });
   for(const key of ['left','top','width','height'])assert(Math.abs(end[key]-final[key])<1,`No image jump (${key}): ${JSON.stringify({end,final})}`);
   await p.waitForFunction(()=>document.querySelector('#work-dialog').dataset.phase==='settled');
   await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('#work-dialog').open);
 }
 await checkHandoff(page,0);
 await page.evaluate(()=>scrollTo({top:1650,behavior:'instant'}));await page.waitForTimeout(1000);
 await checkHandoff(page,3);
 const mobile=await make({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 assert(await mobile.locator('#works').evaluate(e=>e.inert));
 // Native touch scroll completes the entry after the finger is released.
 await mobile.evaluate(()=>{dispatchEvent(new Event('touchstart'));scrollTo({top:60,behavior:'instant'});});
 await mobile.waitForTimeout(100);
 await mobile.evaluate(()=>dispatchEvent(new Event('touchend')));
 await mobile.waitForFunction(()=>document.querySelector('#obras').dataset.entering==='true');
 await mobile.waitForFunction(()=>document.querySelector('#obras').dataset.entering==='false');
 const mobileCenter=await mobile.locator('.work-link').first().evaluate(e=>{const r=e.getBoundingClientRect();return Math.abs(r.top+r.height/2-innerHeight/2);});
 assert(mobileCenter<2,`Mobile first photo centered: ${mobileCenter}`);
 await checkHandoff(mobile,0);
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(500);
 await page.mouse.move(700,180);await page.keyboard.press('PageDown');
 await page.waitForFunction(()=>document.querySelector('#obras').dataset.entering==='true');
 await page.waitForFunction(()=>document.querySelector('#obras').dataset.entering==='false');
 assert(!await page.locator('#works').evaluate(e=>e.inert));
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
 await page.getByRole('button',{name:'Ir a la primera obra'}).click();
 await page.waitForFunction(()=>{
   const r=document.querySelector('.work-card').getBoundingClientRect();
   return Math.abs(r.top+r.height/2-innerHeight/2)<2;
 });
 const dot=page.locator('#catalog-progress button').nth(10);
 const slug=await dot.getAttribute('data-progress-for');
 await dot.click();
 await page.waitForFunction(id=>{
   const card=document.querySelector('.work-card.is-active');
   const r=card.getBoundingClientRect();
   return card.dataset.slug===id&&Math.abs(r.top+r.height/2-innerHeight/2)<2;
 },slug);
 assert.equal(await dot.getAttribute('aria-current'),'true');
 const name=page.locator(`#student-list a[data-open-work="${slug}"]`);
 await name.click();
 await page.evaluate(()=>{
   dispatchEvent(new WheelEvent('wheel',{deltaY:16,cancelable:true}));
   dispatchEvent(new Event('resize'));
 });
 await page.waitForFunction(id=>document.querySelector('#work-dialog').open&&new URLSearchParams(location.search).get('obra')===id,slug);
 await page.waitForFunction(()=>document.querySelector('#work-dialog').dataset.phase==='settled');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#work-dialog').open);
 await page.locator('#filter-trigger').click();
 const category=page.locator('#filter-dialog input[name="categoria"]').first();
 await category.check();
 assert(await page.locator('.work-card[hidden]').count());
 await page.reload();
 assert.equal(new URL(page.url()).searchParams.has('categoria'),false);
 assert.equal(await page.locator('.work-card[hidden]').count(),0);
 async function checkReturnToTop(p,touch){
   const bottom=await p.evaluate(()=>{
     scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});
     return scrollY;
   });
   const control=p.getByRole('button',{name:'Volver arriba'});
   if(touch)await control.tap();
   else await control.click();
   await p.waitForFunction(bottom=>scrollY>0&&scrollY<bottom-1,bottom);
   await p.evaluate(()=>{
     dispatchEvent(new Event('resize'));
     dispatchEvent(new WheelEvent('wheel',{deltaY:9,cancelable:true}));
   });
   await p.waitForFunction(()=>scrollY===0&&document.activeElement.id==='home-title');
 }
 await checkReturnToTop(page,false);
 await checkReturnToTop(mobile,true);
 console.log(JSON.stringify({errors,badResources,checks:'cover entry, image handoff and return to top on desktop/mobile, one-click selection with residual scroll, filters reset on reload'},null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(badResources,[]);
 await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
