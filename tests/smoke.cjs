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
 assert.equal(await page.locator('.hero').evaluate(e=>e.clientHeight),810);
 assert.equal(await page.locator('#filter-trigger').isVisible(),false);
 await page.screenshot({path:path.join(os.tmpdir(),'artimanas-desktop.png')});
 await page.evaluate(()=>scrollTo({top:1100,behavior:'instant'}));await page.waitForTimeout(800);
 assert(await page.locator('#filter-trigger').isVisible());
 await page.screenshot({path:path.join(os.tmpdir(),'artimanas-catalog.png')});
 await page.locator('#student-list a').first().click();
 await page.waitForFunction(()=>document.querySelector('#work-dialog').dataset.phase==='settled');
 assert(await page.locator('#work-dialog').isVisible());assert(await page.locator('#media-stage img').isVisible());
 console.log('Detail columns',await page.locator('.work-detail').evaluate(e=>getComputedStyle(e).gridTemplateColumns));
 await page.screenshot({path:path.join(os.tmpdir(),'artimanas-detail.png')});
 await page.locator('#detail-student-list a[data-open-work="charca-tecnica-aroza"]').click();assert.equal(await page.locator('#detail-author').textContent(),'Aroza, Matias');
 await page.locator('#work-dialog [data-close-dialog]').click();await page.waitForTimeout(400);
 assert.equal(await page.locator('#work-dialog').isVisible(),false);
 await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));await page.waitForTimeout(600);
 assert.equal(await page.locator('#filter-trigger span').textContent(),'Ir arriba');
 await page.screenshot({path:path.join(os.tmpdir(),'artimanas-footer.png')});
 await page.locator('#filter-trigger').click();await page.waitForTimeout(1800);assert(await page.evaluate(()=>scrollY<2));
 await page.locator('[data-open-event]').first().click();assert((await page.locator('#event-dialog a').getAttribute('href')).includes('Calle+62'));
 await page.locator('#event-dialog [data-close-dialog]').click();await page.waitForTimeout(300);
 // Cursor: point on blank space, large white circle above artwork.
 await page.mouse.move(100,100);assert.equal(await page.locator('.custom-cursor').evaluate(e=>getComputedStyle(e).width),'12px');
 await page.evaluate(()=>scrollTo({top:1000,behavior:'instant'}));await page.waitForTimeout(800);await page.locator('.work-link').nth(1).hover();await page.waitForTimeout(650);
 assert.equal(await page.locator('.custom-cursor').evaluate(e=>getComputedStyle(e).width),'90px');
 // A marquee group must cover the viewport, both copies must be identical.
 const marquee=await page.locator('.hero .marquee-track').evaluate(e=>({a:e.children[0].offsetWidth,b:e.children[1].offsetWidth,view:e.parentElement.clientWidth,text:e.children[0].innerHTML===e.children[1].innerHTML}));assert(marquee.a>=marquee.view&&marquee.a===marquee.b&&marquee.text);
 const mobile=await make({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 assert(Math.abs(await mobile.locator('.hero').evaluate(e=>e.clientHeight)-844*.9)<1);
 assert.equal(await mobile.locator('#sensor-permission').count(),0);
 assert(await mobile.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
 await mobile.screenshot({path:path.join(os.tmpdir(),'artimanas-mobile.png')});
 await mobile.evaluate(()=>scrollTo({top:800,behavior:'instant'}));await mobile.waitForTimeout(400);await mobile.locator('#filter-trigger').click();
 await mobile.locator('#tab-alumnos').click();await mobile.locator('input[value="aroza-matias"]').check();
 await mobile.waitForTimeout(450);
 assert(await mobile.evaluate(()=>innerWidth===visualViewport.width&&innerHeight===visualViewport.height));
 assert(await mobile.locator('#filter-dialog').evaluate(e=>e.getBoundingClientRect().bottom<=visualViewport.height+1));
 assert(await mobile.locator('#clear-filters').evaluate(e=>e.getBoundingClientRect().bottom<innerHeight-10));
 await mobile.screenshot({path:path.join(os.tmpdir(),'artimanas-filter.png')});
 assert.equal(await mobile.locator('#apply-filters').textContent(),'Mostrar 1 obra');
 await mobile.locator('#apply-filters').click();await mobile.waitForTimeout(500);
 assert.equal(await mobile.locator('.work-card:visible').count(),1);
 // Reset via URL, then test opening the image detail on touch viewport.
 await mobile.goto('http://localhost:8766');await mobile.locator('.work-link').first().click();await mobile.waitForTimeout(1350);
 assert(await mobile.locator('#media-stage img').isVisible());
 await mobile.screenshot({path:path.join(os.tmpdir(),'artimanas-mobile-detail.png')});
 await mobile.locator('#work-dialog [data-close-dialog]').click();await mobile.waitForTimeout(400);
 await mobile.evaluate(()=>scrollTo({top:document.querySelector('#site-footer').offsetTop-350,behavior:'instant'}));await mobile.waitForTimeout(400);await mobile.screenshot({path:path.join(os.tmpdir(),'artimanas-mobile-footer-transition.png')});
 for(const width of [360,768,1100,1101,1920,3840]){
  await page.setViewportSize({width,height:900});await page.goto('http://localhost:8766');await page.waitForTimeout(250);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth),`Overflow at ${width}`);
  assert(await page.locator('.hero-center').evaluate(e=>Math.abs(e.getBoundingClientRect().left+e.clientWidth/2-innerWidth/2)<1),`Hero not centered at ${width}`);
 }
 console.log(JSON.stringify({errors,badResources,marquee,checks:'Desktop/mobile layout, detail, filter, history, top button, cursor, marquee, overflow'},null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(badResources,[]);
 await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
