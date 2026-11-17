const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const palettes = [['#14032A','#451489','#9F5EF3'],['#3105BD','#EB6944','#DC4390'],['#08CCDD','#00B9D0','#00E6D0'],['#E7632F','#F65FBD','#E45749'],['#EAF158','#E1B5E1','#2F04BC']];
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  try {
    res.setHeader('Content-Type', ({ '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.webp':'image/webp' })[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404); res.end(); }
});
(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless:true, executablePath:process.env.CHROMIUM_PATH, args:['--disable-webgl'] });
    for (const mobile of [false, true]) for (let index = 0; index < palettes.length; index++) {
      const page = await browser.newPage({ viewport:mobile ? {width:390,height:844} : {width:1440,height:900}, ...(mobile ? {isMobile:true,hasTouch:true} : {}) });
      const requests = [];
      page.on('request', request => requests.push(request.url()));
      await page.addInitScript(index => {
        const random = Math.random;
        Math.random = () => !window.ArtimanasHeroPalette ? (index + .5) / 5 : random();
      }, index);
      await page.goto('http://127.0.0.1:' + server.address().port + '/index.html');
      await page.waitForFunction(() => document.querySelector('.hero').dataset.shader === 'fallback');
      const hero = page.locator('.hero');
      const background = await hero.evaluate(element => getComputedStyle(element).backgroundImage);
      for (const hex of palettes[index]) {
        const rgb = 'rgb(' + [1,3,5].map(offset => parseInt(hex.slice(offset, offset + 2), 16)).join(', ') + ')';
        assert(background.includes(rgb), 'Static gradient uses every color of the chosen palette');
      }
      assert.equal(await page.locator('.hero canvas').count(), 0);
      assert(!requests.some(url => /hero-gradient|mobile-tilt/.test(url)));
      await page.mouse.move(100, 200);
      await page.setViewportSize(mobile ? {width:844,height:390} : {width:1200,height:800});
      assert.equal(await hero.evaluate(element => getComputedStyle(element).backgroundImage), background);
      assert.equal(await hero.getAttribute('data-pointer-follow'), 'false');
      assert(await hero.locator('h1').isVisible());
      await page.close();
      console.log('PASS static palette ' + (index + 1) + (mobile ? ' mobile' : ' desktop'));
    }
  } finally { await browser?.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
