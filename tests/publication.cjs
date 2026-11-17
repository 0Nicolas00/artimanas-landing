// Verify the exact production files locally or on GitHub Pages, and exercise published UI.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist'),remote=process.argv[2],out=path.resolve(__dirname,remote?'../.pages-preview/publication-verification':'../qa-captures/publication');
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try{res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.hdr':'application/octet-stream'})[path.extname(file).toLowerCase()]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
function files(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(directory,entry.name)):[path.join(directory,entry.name)]);}
const digest=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
async function main(){
  if(!remote)await new Promise(resolve=>server.listen(8983,'127.0.0.1',resolve));
  const base=remote||'http://127.0.0.1:8983/';
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const errors=[],bad=[],results=[];fs.mkdirSync(out,{recursive:true});
  try{
    const context=await browser.newContext();
    // HEAD checks every deployed file. Full hashes check the changed runtime and ticket assets.
    const hashes=new Set(['index.html','css/catalog.css','css/overlays.css','css/hero-layout.css','css/student-links.css','js/app.js','js/catalog-preview.js','js/hero-shader.bundle.js','assets/Favicon-64.png','assets/Ticket.png','assets/TicketMobile.png']);
    let checked=0;
    for(const file of files(root)){
      const name=path.relative(root,file).split(path.sep).join('/');
      const url=new URL(name,base);url.searchParams.set('verify',digest(fs.readFileSync(file)).slice(0,12));
      const response=await context.request[hashes.has(name)?'get':'head'](url.href);
      assert.equal(response.status(),200,`Asset ${name}`);
      if(hashes.has(name))assert.equal(digest(await response.body()),digest(fs.readFileSync(file)),`Published bytes ${name}`);
      checked++;
    }
    for(const width of [1440,768,390]){
      const page=await context.newPage();await page.setViewportSize({width,height:900});
      page.on('pageerror',error=>errors.push(error.message));
      page.on('response',response=>{if(response.url().startsWith(base)&&response.status()>=400)bad.push(response.url());});
      await page.goto(base,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>document.querySelector('.hero').dataset.shader==='ready');
      assert.equal(await page.locator('.hero').getAttribute('data-pointer-follow'),'false');
      const card=page.locator('.work-card[data-slug="t-i-t-o-andres"]');
      await card.evaluate(element=>{const r=element.getBoundingClientRect();scrollTo({top:scrollY+r.top+r.height/2-innerHeight/2,behavior:'instant'});});
      await page.waitForTimeout(1100);
      assert.equal(await page.locator('#filter-trigger').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
      assert.equal(await page.locator('#filter-dialog input[name="alumno"]').count(),0);
      if(width===1440){
        assert.equal(await page.locator('#catalog-progress .is-active').getAttribute('data-progress-for'),'t-i-t-o-andres');
        assert(await card.evaluate(el=>Number(el.style.getPropertyValue('--work-scale'))>1.37));
        assert.equal(await card.locator('.work-author').evaluate(el=>getComputedStyle(el,'::before').content),'none');
      }
      await page.locator('#filter-trigger').click();
      await page.locator('input[name="categoria"][value="sensorialidad"]').check();
      if(width<=1100)await page.locator('#apply-filters').click();else await page.locator('#filter-dialog [data-close-dialog]').click();
      await page.waitForTimeout(300);
      assert(await page.locator('.work-card:not([hidden])').evaluateAll(cards=>cards.every(el=>el.dataset.category==='sensorialidad')));
      await card.scrollIntoViewIfNeeded();await page.waitForTimeout(1000);
      const y=await page.evaluate(()=>scrollY);await card.locator('.work-link').click();
      await page.waitForFunction(()=>document.querySelector('#work-dialog').dataset.phase==='settled');
      const first=await page.locator('#media-stage img').getAttribute('src');await page.locator('#media-next').click();
      assert.notEqual(await page.locator('#media-stage img').getAttribute('src'),first);
      assert(await page.locator('#description-toggle').isVisible());
      await page.locator('#description-toggle').click();assert.equal(await page.locator('#description-toggle').getAttribute('aria-expanded'),'true');
      await page.screenshot({path:path.join(out,`${remote?'public':'production'}-${width}-detail.png`)});
      await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#work-dialog').open);
      assert(Math.abs(await page.evaluate(()=>scrollY)-y)<2);
      await page.goto(new URL('?muestra=',base).href);
      await page.locator('.ticket img').evaluate(img=>img.decode());await page.waitForTimeout(200);
      assert((await page.locator('.ticket img').evaluate(img=>img.currentSrc)).endsWith(width<=1100?'TicketMobile.png':'Ticket.png'));
      assert(new URL(await page.locator('#event-dialog a').getAttribute('href')).searchParams.get('destination').includes('Diagonal 78 Nº 680'));
      await page.screenshot({path:path.join(out,`${remote?'public':'production'}-${width}-ticket.png`)});
      await page.locator('#event-dialog [data-close-dialog]').click();await page.waitForFunction(()=>!document.querySelector('#event-dialog').open);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      results.push({width,shader:true,catalog:true,filters:true,detail:true,scrollRestored:true,ticket:true});await page.close();
    }
    assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);
    const result={base,checkedFiles:checked,hashedFiles:hashes.size,results,errors,bad};
    fs.writeFileSync(path.join(out,remote?'public.json':'production.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
  }finally{await browser.close();if(!remote)server.close();}
}
main().catch(error=>{console.error(error);server.close();process.exitCode=1;});
