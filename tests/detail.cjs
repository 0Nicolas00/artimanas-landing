const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),output=path.join(root,'qa-captures/detail');
const baseline=process.argv.includes('--baseline'),phase=baseline?'before':'after';
const sizes=[[1440,900],[768,900],[390,900],[1440,600],[1440,1100],[768,640],[390,700]];
fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':decodeURIComponent(new URL(req.url,'http://localhost').pathname)));
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png'})[path.extname(file).toLowerCase()]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
async function settled(page){await page.waitForFunction(()=>document.querySelector('#work-dialog').dataset.phase==='settled');}
async function open(page,slug){await page.goto(`http://127.0.0.1:8980/?heroTest=static&obra=${slug}`);await settled(page);await page.locator('#media-stage img').evaluate(img=>img.decode());}
async function main(){
  await new Promise(resolve=>server.listen(8980,'127.0.0.1',resolve));
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});const results=[];
  try{for(const [width,height] of (process.argv.includes('--fixtures')?[]:sizes)){
    const page=await browser.newPage({viewport:{width,height}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await open(page,'umbral-bigot');
    await page.screenshot({path:path.join(output,`${phase}-${width}x${height}-long.png`)});
    if(!baseline){
      assert(await page.locator('#description-toggle').isVisible());
      assert.equal(await page.locator('#description-toggle').getAttribute('aria-expanded'),'false');
      assert.equal(await page.locator('#detail-description').evaluate(el=>el.clientHeight),width>1100?304:216);
      assert.equal(await page.locator('#detail-description').evaluate(el=>getComputedStyle(el,'::after').content),'""');
      await page.locator('#description-toggle').click();
      assert.equal(await page.locator('#description-toggle').getAttribute('aria-expanded'),'true');
      assert(await page.locator('#detail-description').evaluate(el=>el.clientHeight>=el.scrollHeight-1));
      assert.equal(await page.locator('#detail-description').evaluate(el=>getComputedStyle(el,'::after').content),'none');
      await page.screenshot({path:path.join(output,`after-${width}x${height}-expanded.png`)});
      if(width>1100){
        await page.locator('#detail-student-list [data-open-work="fragmentos-de-luz-y-sombra-errecarte"]').click();await settled(page);
        assert(await page.locator('#description-toggle').isHidden());
        assert.equal(await page.locator('#description-toggle').getAttribute('aria-expanded'),'false');
        await page.locator('#detail-student-list [data-open-work="umbral-bigot"]').click();await settled(page);
        assert.equal(await page.locator('#description-toggle').getAttribute('aria-expanded'),'false');
      }
      await open(page,'fragmentos-de-luz-y-sombra-errecarte');
      assert(await page.locator('#description-toggle').isHidden());
      assert(await page.locator('#media-prev').isHidden());assert(await page.locator('#media-next').isHidden());
      assert.equal(await page.locator('#media-stage img').getAttribute('src'),new URL('assets/imagen-pendiente.svg',page.url()).href);
      assert(await page.locator('#media-download').isHidden());
      await open(page,'deriva-ferrer');
      assert(await page.locator('#media-prev').isHidden());assert(await page.locator('#media-dots').isHidden());
      if(width===390 && height===900){
        const download=page.waitForEvent('download');await page.locator('#media-download').click();
        assert((await download).suggestedFilename().toLowerCase().endsWith('.jpg'));
        assert(await page.locator('#work-dialog').isVisible());
      }
      await page.locator('#work-dialog [data-close-dialog]').click();await page.waitForFunction(()=>!document.querySelector('#work-dialog').open);
      assert(!new URL(page.url()).searchParams.has('obra'));
    }
    await open(page,'t-i-t-o-andres');
    await page.screenshot({path:path.join(output,`${phase}-${width}x${height}-multi.png`)});
    const measurements=await page.evaluate(()=>{
      const el=document.querySelector('.detail-copy'),r=el.getBoundingClientRect(),s=getComputedStyle(el),close=document.querySelector('#work-dialog .dialog-close'),c=close.getBoundingClientRect();
      return {overflow:document.documentElement.scrollWidth>innerWidth,panel:{left:r.left,width:r.width,padding:s.padding,gap:s.gap},close:{top:c.top,right:innerWidth-c.right,width:c.width},fullScreen:document.querySelector('#work-dialog').getBoundingClientRect().height===innerHeight};
    });
    if(!baseline){
      assert.equal(measurements.overflow,false);assert(measurements.fullScreen);assert.equal(measurements.close.width,44);
      assert.equal(measurements.close.right,16);assert.equal(measurements.close.top,width<600?67:16);
      if(width>1100)assert.deepEqual(measurements.panel,{left:320,width:318,padding:'16px',gap:'32px'});
      assert.equal(await page.locator('#media-next').evaluate(el=>el.getBoundingClientRect().width),44);
      const first=await page.locator('#media-stage img').getAttribute('src');
      await page.locator('#media-stage img').click();assert(await page.locator('#work-dialog').isVisible());
      await page.locator('#media-next').click();assert.notEqual(await page.locator('#media-stage img').getAttribute('src'),first);
      await page.locator('#media-dots button').first().click();assert.equal(await page.locator('#media-stage img').getAttribute('src'),first);
      await page.keyboard.press('ArrowRight');assert.notEqual(await page.locator('#media-stage img').getAttribute('src'),first);
      await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#media-stage img').getAttribute('src'),first);
      assert.equal(await page.locator('#media-stage img').evaluate(el=>getComputedStyle(el).objectFit),'contain');
      assert.equal(await page.locator('#research-pending').textContent(),'Descargar investigación');
      assert.equal(await page.locator('#research-pending').getAttribute('aria-disabled'),'true');
      await page.locator('#detail-title').click();assert(await page.locator('#work-dialog').isVisible());
      const panel=await page.locator('.media-panel').boundingBox();
      await page.mouse.click(panel.x+4,panel.y+panel.height-4);
      await page.waitForFunction(()=>!document.querySelector('#work-dialog').open);
      assert(!new URL(page.url()).searchParams.has('obra'));
      await page.goto('http://127.0.0.1:8980/?heroTest=static');
      const card=page.locator('.work-card[data-slug="t-i-t-o-andres"] .work-link');await card.scrollIntoViewIfNeeded();await page.waitForTimeout(1000);
      const y=await page.evaluate(()=>scrollY);await card.click();await settled(page);
      await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#work-dialog').open);
      assert(Math.abs(await page.evaluate(()=>scrollY)-y)<2);
      measurements.scrollRestored=true;
      assert.deepEqual(errors,[]);
    }
    results.push({width,height,...measurements,errors});await page.close();
  }
  if(!baseline){
    // Only this browser response supplies a video and a downloadable fixture; artwork data stays untouched.
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    await page.route(url=>url.origin==='http://127.0.0.1:8980'&&url.pathname==='/',async route=>{
      const response=await route.fetch();
      await route.fulfill({response,body:(await response.text()).replace('data-youtube="" data-research=""','data-youtube="abcdefghijk" data-research="assets/Favicon.webp"')});
    });
    await page.route('https://www.youtube-nocookie.com/**',route=>route.fulfill({contentType:'text/html',body:'<p>Video de prueba local</p>'}));
    await page.goto('http://127.0.0.1:8980/?obra=microbioespecularis-adam&heroTest=static');await settled(page);
    assert.equal(await page.locator('#media-stage iframe').count(),1);
    await page.locator('#media-stage').click();assert(await page.locator('#work-dialog').isVisible());
    await page.locator('#media-next').click();assert.equal(await page.locator('#media-stage img').count(),1);
    await page.locator('#media-prev').click();assert.equal(await page.locator('#media-stage iframe').count(),1);
    assert(await page.locator('#research-link').isVisible());assert(await page.locator('#research-pending').isHidden());
    const download=page.waitForEvent('download');await page.locator('#research-link').click();
    assert.equal((await download).suggestedFilename(),'Favicon.webp');assert(await page.locator('#work-dialog').isVisible());
    await open(page,'umbral-bigot');
    await page.locator('#description-toggle').click();await page.locator('#description-toggle').click();
    assert.equal(await page.locator('#description-toggle').getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('#detail-description').evaluate(el=>el.clientHeight),304);
    await page.setViewportSize({width:390,height:500});
    await page.waitForFunction(()=>document.querySelector('#detail-description').clientHeight===216);
    await page.locator('#description-toggle').click();
    assert(await page.locator('#detail-description').evaluate(el=>el.clientHeight>=el.scrollHeight-1));
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#work-dialog').open);
    await page.setViewportSize({width:390,height:1100});await open(page,'fragmentos-de-luz-y-sombra-errecarte');
    await page.mouse.click(4,1096);await page.waitForFunction(()=>!document.querySelector('#work-dialog').open);
    results.push({fixtures:true,videoFirst:true,researchDownload:true,readLess:true,resize:true,mobileBackgroundClose:true});
    await page.close();
  }
  fs.writeFileSync(path.join(output,process.argv.includes('--fixtures')?'fixtures.json':`${phase}.json`),JSON.stringify(results,null,2));console.log(JSON.stringify({phase,results},null,2));
  }finally{await browser.close();server.close();}
}
main().catch(error=>{console.error(error);server.close();process.exitCode=1;});
