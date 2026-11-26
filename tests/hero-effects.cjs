const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.webp':'image/webp', '.png':'image/png', '.svg':'image/svg+xml', '.hdr':'application/octet-stream' };
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try { res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file)); }
  catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath:process.env.CHROMIUM_PATH, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
    const errors = [];
    for (const width of [1440, 768, 390]) {
      const page = await browser.newPage({ viewport:{ width, height:900 }, reducedMotion:width === 768 ? 'reduce' : 'no-preference' });
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/?heroTest=shader&palette=2&heroDpr=0.75&heroGrain=off`);
      await page.waitForFunction(() => ['ready','fallback'].includes(document.querySelector('.hero').dataset.shader));
      const hero = page.locator('.hero');
      assert.equal(await hero.getAttribute('data-shader'), 'ready', await hero.getAttribute('data-shader-fallback'));
      const fade = await hero.evaluate(el => {
        const gradient = getComputedStyle(el, '::before');
        return { height: parseFloat(gradient.height), heroHeight: el.clientHeight,
          color: gradient.backgroundColor, catalogColor: getComputedStyle(document.body).backgroundColor };
      });
      assert(fade.height > fade.heroHeight * .4, 'Fundido continuo detrás de la cinta');
      assert.equal(fade.color, fade.catalogColor);
      assert.equal(await page.locator('.hero-glass img').count(), 0);
      await page.waitForFunction(() => document.querySelector('.hero').dataset.glass === 'brand-contours');
      assert.equal(await page.locator('.glass-motion-control').count(), 0);
      assert.equal(await page.locator('#works').evaluate(el => el.inert), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (width === 1440) {
        assert.equal(await page.locator('.hero').evaluate(el => el.clientHeight), 810);
        const names = await page.locator('#student-list li').evaluateAll(items => items.slice(0,2).map(el => ({ blur:parseFloat(getComputedStyle(el).filter.slice(5)), top:el.getBoundingClientRect().top })));
        assert(names[0].blur > 1);
        assert(names[0].blur < names[1].blur);
        assert(names[0].top < 900);
        const sidebar = await page.locator('.student-sidebar').boundingBox();
        assert(sidebar.y - 810 >= 48);
        await page.mouse.move(1440 * .425, 810 * .40);
        await page.waitForTimeout(400);
        await page.mouse.down();
        assert.equal(await page.locator('.hero').evaluate(el => el.hasPointerCapture(1)), false);
        await page.mouse.up();
        assert.equal(await page.locator('.hero').getAttribute('data-glass-dragging'), null);

      }
      await page.screenshot({ path:path.join(os.tmpdir(), `artimanas-hero-effects-${width}.png`) });
      await page.mouse.wheel(0, 50);
      await page.waitForFunction(() => !document.querySelector('#works').inert);
      await page.close();
    }
    assert.deepEqual(errors, []);
    console.log('Hero verificado a 1440, 768 y 390 px. Capturas temporales en', os.tmpdir());
  } finally { await browser?.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
