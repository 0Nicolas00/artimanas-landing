const {chromium}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),output=path.join(root,'qa-captures/ticket-exports');
const baseline=process.argv.includes('--baseline'),phase=baseline?'before':'after';
const assets=fs.readdirSync(path.join(root,'assets')).filter(name=>/^[a-f0-9]{12}\.(webp|jpg)$/.test(name)||['Favicon.webp','footer-orb.webp','Frame 38.png'].includes(name));
fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/__assets'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<style>body{background:#333;color:white;display:grid;grid-template-columns:repeat(4,240px);gap:10px;font:14px sans-serif}figure{margin:0}img{width:230px;height:160px;object-fit:contain}</style>'+assets.map(name=>`<figure><img src="/assets/${name}"><figcaption>${name}</figcaption></figure>`).join(''));}
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'})[path.extname(file).toLowerCase()]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
async function openFromNav(page,width){
  if(width<600)await page.locator('[data-open-menu]').click();
  await page.locator(width<600?'#menu-dialog [data-open-event]':'.desktop-nav[data-open-event]').click();
}
async function main(){
  await new Promise(resolve=>server.listen(8982,'127.0.0.1',resolve));
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH}),results=[];
  try{
    if(process.argv.includes('--assets')){
      const page=await browser.newPage({viewport:{width:1000,height:650}});await page.goto('http://127.0.0.1:8982/__assets');
      await page.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
      await page.screenshot({path:path.join(output,'assets.png'),fullPage:true});
      console.log(await page.locator('img').evaluateAll(images=>images.map(img=>({file:decodeURIComponent(img.src.split('/').pop()),width:img.naturalWidth,height:img.naturalHeight}))));return;
    }
    for(const [width,height] of [[1440,900],[768,900],[390,900],[1440,600],[1440,1100],[768,640],[390,700],[390,500],[320,568],[1101,700]]){
      const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:8982/?heroTest=static&muestra=');await page.waitForFunction(()=>document.querySelector('#event-dialog').open);await page.evaluate(()=>document.fonts.ready);
      await page.locator('.ticket img').evaluate(img=>img.decode());await page.waitForTimeout(100);
      await page.screenshot({path:path.join(output,`${phase}-${width}x${height}.png`)});
      const measurement=await page.evaluate(()=>{
        const ticket=document.querySelector('.ticket').getBoundingClientRect(),link=document.querySelector('#event-dialog a'),map=link.getBoundingClientRect(),close=document.querySelector('#event-dialog .dialog-close').getBoundingClientRect();
        return {ticket:{top:ticket.top,left:ticket.left,width:ticket.width,height:ticket.height},maps:{top:map.top,width:map.width,href:link.href},close:{top:close.top,right:innerWidth-close.right,width:close.width},address:document.querySelector('.ticket-copy address').innerText,overflow:document.documentElement.scrollWidth>innerWidth,dialogOverflow:document.querySelector('#event-dialog').scrollWidth>innerWidth};
      });
      if(!baseline){
        assert(measurement.address.includes('28 de Noviembre * 19:00 hrs'));
        assert(measurement.address.includes('Diagonal 78 Nº 680 esquina 62'));
        assert.equal(new URL(measurement.maps.href).searchParams.get('destination'),'Sede Fonseca, Diagonal 78 Nº 680, La Plata, Argentina');
        assert.equal(measurement.overflow,false);assert.equal(measurement.dialogOverflow,false);
        assert.equal(measurement.close.width,44);assert.equal(measurement.close.right,width>1100?64:width>=600?32:16);
        assert.equal(measurement.close.top,width>=600?64:66);
        assert(await page.locator('.ticket img').evaluate(img=>{
          const r=img.getBoundingClientRect();
          return Math.abs(r.width/r.height-img.naturalWidth/img.naturalHeight)<.003 && img.currentSrc.endsWith(innerWidth<=1100?'TicketMobile.webp':'Ticket.webp');
        }));
        if(height===900){assert(Math.abs(measurement.ticket.top-(width>1100?309:width>=600?108:136))<1);assert(Math.abs(measurement.maps.top-(width>1100?776:width>=600?765:740))<1);}
        assert(measurement.ticket.left>=0&&measurement.ticket.left+measurement.ticket.width<=width);
        await page.context().route('https://www.google.com/maps/**',route=>route.fulfill({contentType:'text/html',body:'<p>Maps: destino de prueba</p>'}));
        const popupPromise=page.waitForEvent('popup');await page.locator('#event-dialog a').click();const popup=await popupPromise;await popup.waitForLoadState();
        assert.equal(new URL(popup.url()).searchParams.get('destination'),'Sede Fonseca, Diagonal 78 Nº 680, La Plata, Argentina');await popup.close();
        assert(await page.locator('#event-dialog').isVisible());
        await page.locator('#event-dialog [data-close-dialog]').click();await page.waitForFunction(()=>!document.querySelector('#event-dialog').open);
        assert(!new URL(page.url()).searchParams.has('muestra'));
        await openFromNav(page,width);assert(await page.locator('#event-dialog').isVisible());
        await page.locator('.ticket img').click();assert(await page.locator('#event-dialog').isVisible());
        await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#event-dialog').open);
        await openFromNav(page,width);await page.locator('#event-dialog').click({position:{x:4,y:4}});await page.waitForFunction(()=>!document.querySelector('#event-dialog').open);
        assert.deepEqual(errors,[]);
        measurement.interactions=true;
      }
      results.push({width,height,...measurement,errors});await page.close();
    }
    fs.writeFileSync(path.join(output,`${phase}.json`),JSON.stringify(results,null,2));console.log(JSON.stringify({phase,results},null,2));
  }finally{await browser.close();server.close();}
}
main().catch(error=>{console.error(error);server.close();process.exitCode=1;});
