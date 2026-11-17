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
 await page.evaluate(()=>scrollTo({top:1000,behavior:'instant'}));await page.waitForTimeout(600);
 await page.locator('.student-sidebar h2').hover();const before=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,200);await page.waitForTimeout(300);assert(await page.evaluate(()=>scrollY)>before+100);
 await page.locator('#student-list a').nth(4).hover();const namesBefore=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,120);await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>scrollY),namesBefore);
 await page.locator('[data-page-link="galeria"]').first().click();await page.waitForTimeout(400);assert(await page.locator('.gallery-grid').isVisible());assert(await page.locator('.gallery-grid').evaluate(e=>e.clientWidth>innerWidth*.9));
 await page.locator('.gallery-item').first().click();assert(await page.locator('#photo-dialog').isVisible());await page.keyboard.press('Escape');await page.waitForTimeout(300);assert.equal(await page.locator('#photo-dialog').isVisible(),false);
 await page.screenshot({path:path.join(os.tmpdir(),'artimanas-gallery.png')});
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await mobile.addInitScript(()=>{
   window.permissionRequests=0;
   window.DeviceOrientationEvent=class {static async requestPermission(){window.permissionRequests++;return 'granted';}};
 });
 await mobile.goto('http://localhost:8766');await mobile.waitForTimeout(350);
 assert.equal(await mobile.evaluate(()=>window.permissionRequests),0);
 await mobile.locator('.hero h1').tap();await mobile.waitForTimeout(150);
 assert.equal(await mobile.evaluate(()=>window.permissionRequests),0);
 await mobile.evaluate(()=>{const e=new Event('deviceorientation');Object.defineProperties(e,{beta:{value:20},gamma:{value:15}});dispatchEvent(e);});
 assert.equal(await mobile.locator('.hero').getAttribute('data-sensor'),null);
 const desktop=await browser.newPage({viewport:{width:1440,height:900}});
 await desktop.addInitScript(()=>{window.orientationAccess=0;Object.defineProperty(window,'DeviceOrientationEvent',{configurable:true,get(){window.orientationAccess++;return null;}});});
 await desktop.goto('http://localhost:8766');await desktop.locator('.hero h1').click();assert.equal(await desktop.evaluate(()=>window.orientationAccess),0);
 await desktop.emulateMedia({reducedMotion:'reduce'});await desktop.reload();assert.equal(await desktop.locator('.marquee-track').first().evaluate(e=>getComputedStyle(e).animationName),'marquee');
 console.log('PASS: background wheel, names wheel isolation, gallery width/lightbox/Escape, no obsolete sensor requests, reduced-motion marquee.');
 await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
