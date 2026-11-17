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
 async function make(options){const p=await browser.newPage(options);p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().startsWith('http://localhost')&&r.status()>=400)badResources.push(r.url())});await p.goto('http://localhost:8766');await p.waitForTimeout(700);return p;}
 const page=await make({viewport:{width:1440,height:900}});
 await page.waitForTimeout(600);
 const hero=await page.locator('.hero').boundingBox();
 const eyebrow=await page.locator('.hero .eyebrow').boundingBox();
 const logo=await page.locator('.hero .logo-desktop').boundingBox();
 const band=await page.locator('.hero .marquee').boundingBox();
 const cueY=band.y+band.height/2;
 assert(eyebrow.y>hero.height*.22,'Eyebrow belongs to logo group, not the topbar');
 assert(logo.y-eyebrow.y-eyebrow.height<35,'Eyebrow sits directly above logo');
 assert.equal(await page.locator('#student-list').evaluate(e=>getComputedStyle(e).filter),'none');
 assert.equal(await page.locator('#student-list').evaluate(e=>getComputedStyle(e).opacity),'1');
 for(let i=0;i<3;i++){
   await page.mouse.move(700,cueY);await page.waitForTimeout(750);
   assert.equal(await page.locator('.cursor-label').textContent(),'Bajá para\nver más');
   assert(await page.locator('#custom-cursor').evaluate(e=>e.classList.contains('is-scroll')));
   assert.equal(await page.locator('.cursor-scroll').evaluate(e=>getComputedStyle(e).opacity),'1');
   assert.equal(await page.locator('.hero-shade').count(),0);
   assert.equal(await page.locator('.hero').getAttribute('data-pointer-follow'),'false');
   await page.mouse.move(700,180);await page.waitForTimeout(750);
   assert(await page.locator('#obras').evaluate(e=>Number(e.style.getPropertyValue('--catalog-opacity'))<.5));
 }
 await page.mouse.move(700,cueY);await page.waitForTimeout(650);
 await page.screenshot({path:path.join(os.tmpdir(),'artimanas-preview-v24.png')});
 // Mouse focus on a name must not latch the hover effect after returning to the hero.
 await page.locator('#student-list a').first().evaluate(e=>e.focus({preventScroll:true}));
 await page.mouse.move(700,180);await page.waitForTimeout(750);
 assert(await page.locator('#obras').evaluate(e=>Number(e.style.getPropertyValue('--catalog-opacity'))<.5));
 await page.evaluate(()=>scrollTo({top:1300,behavior:'instant'}));await page.waitForTimeout(900);
 assert(!await page.locator('#obras').evaluate(e=>e.classList.contains('is-preview')));
 assert.equal(await page.locator('#student-list').evaluate(e=>getComputedStyle(e).filter),'none');
 // A partially visible name is focused without moving the page or the list.
 const name=page.locator('#student-list a').nth(5);
 await name.evaluate(e=>{const list=e.closest('.student-sidebar');list.scrollTop=e.offsetTop-3;});
 const box=await name.boundingBox();
 const start=await page.evaluate(()=>({y:scrollY,list:document.querySelector('.student-sidebar').scrollTop}));
 await page.mouse.move(box.x+35,Math.max(35,box.y+box.height-5));await page.mouse.down();
 await page.waitForTimeout(150);
 assert.deepEqual(await page.evaluate(()=>({y:scrollY,list:document.querySelector('.student-sidebar').scrollTop})),start);
 await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('#work-dialog').open);
 assert.equal(new URL(page.url()).searchParams.get('obra'),await name.getAttribute('data-open-work'));
 await page.waitForFunction(()=>document.querySelector('#work-dialog').dataset.phase==='settled');
 await page.keyboard.press('Escape');await page.waitForTimeout(550);
 // Main scrolling changes the highlighted work, but never drags the name list.
 const listScroll=await page.locator('.student-sidebar').evaluate(e=>e.scrollTop);
 await page.evaluate(()=>scrollBy({top:1000,behavior:'instant'}));await page.waitForTimeout(950);
 assert.equal(await page.locator('.student-sidebar').evaluate(e=>e.scrollTop),listScroll);
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(1000);
 await page.screenshot({path:path.join(os.tmpdir(),'artimanas-hero-mobile-v24.png')});
 console.log(JSON.stringify({errors,badResources,checks:'hero label, preview blur, repeated pointer-only hover, scroll cursor, stale focus, partial name click, stable list'},null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(badResources,[]);
 await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
