const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert'),os=require('os');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 let p=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(p.endsWith('/'))p+='index.html';
 if(!p.startsWith(root)){res.writeHead(403);return res.end();}
 try {const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml','.jpg':'image/jpeg'};res.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));}catch(e){res.writeHead(404);res.end();}
});
(async()=>{
 await new Promise(r=>server.listen(8766,r));
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--disable-dev-shm-usage'],headless:true});
 const errors=[],badResources=[];
 async function make(options){const p=await browser.newPage(options);p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().startsWith('http://localhost')&&r.status()>=400)badResources.push(r.url())});await p.goto('http://localhost:8766');await p.waitForTimeout(700);return p;}
 const page=await make({viewport:{width:1440,height:900}});
 await page.evaluate(()=>scrollTo({top:1300,behavior:'instant'}));await page.waitForTimeout(900);
 // A name first scrolls its card to the center, then begins the detail slide.
 await page.evaluate(()=>{
   const show=HTMLDialogElement.prototype.showModal;
   HTMLDialogElement.prototype.showModal=function(){
     if(this.id==='work-dialog'){
       const sidebar=document.querySelector('.student-sidebar');
       window.namesBeforeOpen={rect:sidebar.getBoundingClientRect().toJSON(),scroll:sidebar.scrollTop,
         rows:[...sidebar.querySelectorAll('li')].map(e=>e.getBoundingClientRect().toJSON())};
     }
     return show.call(this);
   };
 });
 const name=page.locator('#student-list a').nth(7);
 const slug=await name.getAttribute('data-open-work');
 const before=await page.evaluate(()=>scrollY);
 await name.click();
 assert(!await page.locator('#work-dialog').isVisible());
 await page.waitForFunction(start=>Math.abs(scrollY-start)>20,before);
 assert(!await page.locator('#work-dialog').isVisible(),'Detail stays closed during travel');
 await page.waitForFunction(()=>document.querySelector('#work-dialog').open);
 const centerError=await page.locator(`[data-slug="${slug}"]`).evaluate(e=>{const r=e.getBoundingClientRect();return Math.abs(r.top+r.height/2-innerHeight/2);});
 assert(centerError<2,`Selected artwork centered before opening: ${centerError}`);
 assert.equal(new URL(page.url()).searchParams.get('obra'),slug);
 const namesStable=()=>{
   const before=window.namesBeforeOpen,list=document.querySelector('.detail-students');
   const after=list.getBoundingClientRect();
   const sameRect=['left','top','width','height'].every(key=>Math.abs(after[key]-before.rect[key])<1);
   // Compare layout rows, independent of the selected label's decorative pulse.
   const rows=[...list.querySelectorAll('li')];
   return sameRect&&Math.abs(list.scrollTop-before.scroll)<1&&rows.every((e,i)=>{
     const r=e.getBoundingClientRect(),old=before.rows[i];
     return old&&Math.abs(r.left-old.left)<1&&Math.abs(r.top-old.top)<1&&Math.abs(r.height-old.height)<1;
   });
 };
 assert(await page.evaluate(namesStable),'Name rows retain position, spacing and scroll during opening');

 await page.waitForFunction(()=>document.querySelector('#work-dialog').dataset.phase==='settled');
 assert(await page.evaluate(namesStable),'Name rows remain fixed after opening');
 await page.keyboard.press('Escape');await page.waitForTimeout(550);
 // User interruption cancels the pending opening, not just its scroll frames.
 await page.locator('#student-list a').first().click();
 await page.waitForTimeout(150);await page.mouse.wheel(0,100);
 await page.waitForTimeout(1800);
 assert(!await page.locator('#work-dialog').isVisible(),'Wheel cancels pending detail');
 // A newer name wins; no stale callback opens the previous work later.
 await page.locator('#student-list a').nth(2).click();
 await page.locator('#student-list a').nth(5).click();
 const latest=await page.locator('#student-list a').nth(5).getAttribute('data-open-work');
 await page.waitForFunction(()=>document.querySelector('#work-dialog').dataset.phase==='settled');
 assert.equal(new URL(page.url()).searchParams.get('obra'),latest);
 await page.keyboard.press('Escape');await page.waitForTimeout(550);
 await page.evaluate(()=>scrollTo({top:1300,behavior:'instant'}));await page.waitForTimeout(900);
 const square=await page.locator('.work-card.is-active img').evaluate(e=>{const r=e.getBoundingClientRect();return Math.abs(r.width-r.height)<1;});assert(square);
 await page.locator('.work-card.is-active .work-link').click();
 assert.equal(await page.locator('#work-dialog').getAttribute('data-phase'),'composing');
 assert.equal(await page.locator('.detail-neighbor').first().evaluate(e=>getComputedStyle(e).filter),'blur(0px)');
 assert(await page.locator('.detail-moving-image').count());
 assert(await page.locator('.work-card img.detail-source-hidden').count());
 assert.equal(await page.locator('.detail-copy').evaluate(e=>e.getAnimations().some(a=>a.effect.getKeyframes()[0].transform==='translateX(-100%)')),true);
 await page.evaluate(()=>{for(const a of document.querySelector('#work-dialog').getAnimations({subtree:true})){a.pause();a.currentTime=350;}});
 await page.screenshot({path:path.join(os.tmpdir(),'artimanas-compose.png')});
 await page.evaluate(()=>{for(const a of document.querySelector('#work-dialog').getAnimations({subtree:true}))a.play();});
 await page.waitForFunction(()=>document.querySelector('#work-dialog').dataset.phase==='blurring');
 const blurFrames=await page.locator('.detail-neighbor').first().evaluate(e=>{
   const a=e.getAnimations().find(a=>a.effect.getKeyframes().some(k=>k.filter));
   a.pause();a.currentTime=200;const early=getComputedStyle(e).filter;
   a.currentTime=600;const late=getComputedStyle(e).filter;a.play();return [early,late];
 });
 const [earlyBlur,lateBlur]=blurFrames.map(v=>Number(v.match(/[\d.]+/)[0]));
 assert(earlyBlur>0&&earlyBlur<lateBlur&&lateBlur<20,`Progressive blur: ${blurFrames}`);
 await page.waitForFunction(()=>document.querySelector('#work-dialog').dataset.phase==='settled');await page.waitForTimeout(650);
 assert.equal(await page.locator('.detail-moving-image').count(),0);
 assert.equal(await page.locator('#contenido').evaluate(e=>getComputedStyle(e).opacity),'0');
 assert.equal(await page.locator('.detail-neighbor').first().evaluate(e=>getComputedStyle(e).filter),'blur(20px)');
 assert.equal(await page.locator('.detail-students').evaluate(e=>getComputedStyle(e).paddingLeft),'0px');
 await page.screenshot({path:path.join(os.tmpdir(),'artimanas-settled.png')});
 await page.keyboard.press('Escape');await page.waitForTimeout(550);
 assert(!await page.locator('#work-dialog').isVisible());
 assert(!await page.locator('body').evaluate(e=>e.classList.contains('work-detail-open')));
 assert.equal(await page.locator('#contenido').evaluate(e=>getComputedStyle(e).opacity),'1');
 assert.equal(await page.locator('.detail-source-hidden').count(),0);
 // Interrupt opening before any queued continuation can re-open or hide content.
 await page.locator('.work-card.is-active .work-link').click();await page.keyboard.press('Escape');await page.waitForTimeout(950);
 assert(!await page.locator('#work-dialog').isVisible());assert.equal(await page.locator('.detail-moving-image').count(),0);
 // Back/forward restores the same state without orphan animation layers.
 await page.locator('.work-card.is-active .work-link').click();await page.goBack();await page.waitForTimeout(950);
 assert(!await page.locator('#work-dialog').isVisible());assert.equal(await page.locator('#contenido').evaluate(e=>getComputedStyle(e).opacity),'1');
 assert.equal(await page.locator('.detail-source-hidden').count(),0);
 await page.goForward();await page.waitForTimeout(1400);assert(await page.locator('#work-dialog').isVisible());
 await page.keyboard.press('Escape');await page.waitForTimeout(550);
 // Pop expands past its final radius then settles; repeated moves do not restart it.
 await page.mouse.move(10,300);await page.locator('.work-card.is-active .work-link').hover();
 const pop=await page.locator('#custom-cursor').evaluate(e=>e.getAnimations().find(a=>a.effect.getKeyframes().some(k=>k.width==='101px'))?.effect.getKeyframes().map(k=>k.width));
 assert(pop?.includes('101px'));await page.waitForTimeout(650);assert.equal(await page.locator('#custom-cursor').evaluate(e=>getComputedStyle(e).width),'90px');
 await page.mouse.move(10,300);await page.waitForTimeout(500);assert.equal(await page.locator('#custom-cursor').evaluate(e=>getComputedStyle(e).width),'12px');
 // Explicit interaction animations remain visible in both OS preference modes.
 for(const reducedMotion of ['no-preference','reduce']){
   await page.emulateMedia({reducedMotion});
   await page.locator('.work-card.is-active .work-link').click();
   await page.evaluate(()=>{for(const a of document.querySelector('#work-dialog').getAnimations({subtree:true})){a.pause();a.currentTime=180;}});
   const x1=await page.locator('.detail-copy').evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).m41);
   const r1=await page.locator('.detail-moving-image').boundingBox();
   await page.evaluate(()=>{for(const a of document.querySelector('#work-dialog').getAnimations({subtree:true}))a.currentTime=440;});
   const x2=await page.locator('.detail-copy').evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).m41);
   const r2=await page.locator('.detail-moving-image').boundingBox();
   assert(x1 < -100 && x2 > x1 && x2 < -5,`${reducedMotion}: visible intermediate slide ${x1}, ${x2}`);
   assert(Math.abs(r1.x-r2.x)>10 || Math.abs(r1.width-r2.width)>10,'Artwork visibly changes composition');
   assert.equal(await page.locator('.detail-neighbor').first().evaluate(e=>getComputedStyle(e).filter),'blur(0px)');
   await page.evaluate(()=>{for(const a of document.querySelector('#work-dialog').getAnimations({subtree:true}))a.play();});
   await page.waitForFunction(()=>document.querySelector('#work-dialog').dataset.phase==='settled');
   await page.keyboard.press('Escape');await page.waitForTimeout(550);
   await page.mouse.move(10,300);await page.waitForTimeout(500);
   await page.locator('.work-card.is-active .work-link').hover();
   const growth=await page.locator('#custom-cursor').evaluate(async e=>{
     const a=e.getAnimations().find(a=>a.effect.getKeyframes().some(k=>k.width));
     if(!a)return [];
     a.pause();a.currentTime=90;
     const w1=parseFloat(getComputedStyle(e).width);
     a.currentTime=180;
     const w2=parseFloat(getComputedStyle(e).width);
     a.finish();return [w1,w2];
   });
   assert(growth[0]>12 && growth[0]<90 && growth[1]>growth[0],`${reducedMotion}: growing cursor ${growth}`);
   await page.mouse.move(10,300);
   const shrinking=await page.locator('#custom-cursor').evaluate(e=>{
     const a=e.getAnimations().find(a=>a.effect.getKeyframes().some(k=>k.width));
     if(!a)return -1;
     a.pause();a.currentTime=90;
     const width=parseFloat(getComputedStyle(e).width);
     a.play();return width;
   });
   assert(shrinking>12 && shrinking<90,`${reducedMotion}: shrinking cursor ${shrinking}`);
   await page.waitForTimeout(90);assert.equal(await page.locator('.cursor-label').textContent(),'');
   // Scroll must not cancel the cursor or remove its current hover animation.
   await page.evaluate(()=>window.dispatchEvent(new Event('scroll')));
   await page.waitForTimeout(30);
   assert.equal(await page.locator('#custom-cursor').evaluate(e=>getComputedStyle(e).opacity),'1');
   await page.waitForTimeout(500);
 }
 const mobile=await make({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 assert(await mobile.locator('.work-card img').first().evaluate(e=>Math.abs(e.clientWidth-e.clientHeight)<1));
 await mobile.evaluate(()=>scrollTo({top:650,behavior:'instant'}));await mobile.waitForTimeout(500);
 const staticBefore=await mobile.locator('.work-card img').nth(1).boundingBox();
 await mobile.locator('.work-link').first().click();
 assert.equal(await mobile.locator('.detail-neighbor').count(),0,'Mobile never builds a vertical background list');
 const staticAfter=await mobile.locator('.work-card img').nth(1).boundingBox();
 assert.deepEqual(staticAfter,staticBefore,'Unselected mobile photos stay in place');
 assert.equal(await mobile.locator('#contenido').evaluate(e=>getComputedStyle(e).opacity),'1');
 await mobile.waitForFunction(()=>document.querySelector('#work-dialog').dataset.phase==='blurring');
 const mobileBlur=await mobile.locator('.detail-veil').evaluate(e=>{
   const a=e.getAnimations()[0];a.pause();a.currentTime=400;
   const filter=getComputedStyle(e).backdropFilter;a.play();return filter;
 });
 const mobileBlurValue=Number(mobileBlur.match(/[\d.]+/)[0]);
 assert(mobileBlurValue>0&&mobileBlurValue<12,`Mobile progressive blur: ${mobileBlur}`);
 await mobile.waitForFunction(()=>document.querySelector('#work-dialog').dataset.phase==='settled');
 assert(await mobile.evaluate(()=>innerWidth===visualViewport.width));
 assert(await mobile.locator('#media-stage img').isVisible());
 await mobile.screenshot({path:path.join(os.tmpdir(),'artimanas-mobile-detail-v24.png')});
 console.log(JSON.stringify({errors,badResources,checks:'square cards, staged opening and delayed blur, slide from left, compact margins, interruption, history, pop, reduced motion, mobile detail'},null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(badResources,[]);
 await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
