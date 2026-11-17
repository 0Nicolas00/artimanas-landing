const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'qa-captures', 'cover');
const baseline = process.argv.includes('--baseline');
const phase = baseline ? 'before' : 'after';
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
      '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
    response.setHeader('Content-Type', types[path.extname(file).toLowerCase()] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
  } catch {
    response.writeHead(404).end();
  }
});

function shaderHashes() {
  return Object.fromEntries(['Hero.jsx', 'src/hero-shader.jsx', 'js/hero-shader.bundle.js'].map(file => {
    return [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')];
  }));
}

async function measure(page) {
  return page.evaluate(() => {
    const rect = selector => {
      const element = document.querySelector(selector);
      const box = element.getBoundingClientRect();
      return { x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height,
        layoutTop: element.offsetTop, layoutWidth: element.offsetWidth, layoutHeight: element.offsetHeight };
    };
    const hero = document.querySelector('.hero');
    const logo = document.querySelector(innerWidth > 1100 ? '.logo-desktop' : '.logo-stacked');
    return {
      hero: rect('.hero'), nav: rect('.site-nav'), center: rect('.hero-center'), eyebrow: rect('.hero .eyebrow'),
      logo: rect(innerWidth > 1100 ? '.logo-desktop' : '.logo-stacked'),
      slices: [...document.querySelectorAll('.logo-stacked img')].map(image => ({
        source: image.getAttribute('src'), naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
        width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height })),
      band: rect('.hero .marquee'), heading: rect('#student-heading'),
      logoFilter: getComputedStyle(logo).filter,
      eyebrowShadow: getComputedStyle(document.querySelector('.hero .eyebrow')).boxShadow,
      eyebrowTextShadow: getComputedStyle(document.querySelector('.hero .eyebrow')).textShadow,
      shader: hero.dataset.shader, pointerFollow: hero.dataset.pointerFollow,
      palette: window.ArtimanasHeroPalette.colors,
      overflow: document.documentElement.scrollWidth > innerWidth
    };
  });
}

async function verifyBand(page) {
  return page.locator('.hero .marquee').evaluate(element => {
    const hero = element.closest('.hero');
    const [first, second] = element.querySelectorAll('.marquee-group');
    const track = element.querySelector('.marquee-track');
    const band = element.getBoundingClientRect();
    const parent = hero.getBoundingClientRect();
    return { groupWidth: first.offsetWidth, secondWidth: second.offsetWidth, viewWidth: element.clientWidth,
      identical: first.innerHTML === second.innerHTML, trackWidth: track.offsetWidth,
      contained: band.top >= parent.top && band.bottom <= parent.bottom,
      viewportTop: band.top, viewportBottom: band.bottom, actualScroll: scrollY };
  });
}

async function main() {
  await new Promise(resolve => server.listen(8978, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = [];
  try {
    for (const width of [1440, 768, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:8978/?heroTest=shader&palette=0');
      await page.waitForFunction(() => document.querySelector('.hero').dataset.shader === 'ready');
      await page.waitForTimeout(3900);
      await page.mouse.move(width - 10, 110);
      await page.screenshot({ path: path.join(output, `${phase}-${width}.png`) });
      const measurements = await measure(page);
      const samples = [];
      for (const scroll of [0, 500, 360, 120]) {
        await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), scroll);
        await page.waitForTimeout(100);
        const sample = await verifyBand(page);
        samples.push({ scroll, ...sample });
        if (!baseline) {
          assert(sample.contained, `Band stays inside the hero at ${width}, scroll ${scroll}`);
          assert.equal(sample.actualScroll, scroll);
          assert(sample.identical && sample.groupWidth >= sample.viewWidth && sample.groupWidth === sample.secondWidth);
          assert(Math.abs(sample.trackWidth - sample.groupWidth * 2) <= 1);
        }
        if (scroll === 360) await page.screenshot({ path: path.join(output, `${phase}-${width}-scroll.png`) });
      }
      if (!baseline) {
        assert.equal(measurements.hero.height, 900);
        assert.equal(measurements.nav.height, 72);
        assert.equal(measurements.overflow, false);
        assert.equal(measurements.logoFilter, 'none');
        assert.equal(measurements.eyebrowShadow, 'none');
        assert.equal(measurements.eyebrowTextShadow, 'none');
        assert.equal(measurements.pointerFollow, 'false');
        assert.deepEqual(measurements.palette, ['#14032A', '#451489', '#9F5EF3']);
        if (width === 1440) {
          assert.equal(measurements.nav.x, 80);
          assert.equal(measurements.logo.width, 1008);
          assert.equal(measurements.logo.x, 216);
          assert.equal(measurements.heading.y - measurements.hero.height, 80);
        } else if (width === 768) {
          assert.equal(measurements.logo.width, 435);
          assert.equal(measurements.logo.height, 465);
          assert.equal(measurements.logo.y, 217);
          assert.equal(measurements.center.y, 145);
        } else {
          assert.equal(measurements.center.y, 223);
          assert.equal(measurements.center.width, 325);
          assert.equal(measurements.center.height, 433);
        }
        assert.equal(measurements.eyebrow.layoutWidth, width === 390 ? 294 : 310);
        assert.equal(measurements.eyebrow.layoutHeight, 77);
        assert(Math.abs(measurements.band.y - (width === 1440 ? 740 : width === 768 ? 760 : 755)) < 0.1);
        await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
        await page.waitForTimeout(300);
        await page.mouse.wheel(0, 40);
        await page.waitForFunction(() => document.querySelector('#obras').dataset.entering === 'true');
        await page.waitForFunction(() => document.querySelector('#obras').dataset.entering === 'false');
        const centerError = await page.locator(width > 1100 ? '.work-card' : '.work-link').first().evaluate(element => {
          const rect = element.getBoundingClientRect();
          return Math.abs(rect.top + rect.height / 2 - innerHeight / 2);
        });
        assert(centerError < 2, `Catalog entry at ${width}: ${centerError}`);
        assert.equal(await page.locator('#works').evaluate(element => element.inert), false);
        measurements.catalogCenterError = centerError;
        await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
        await page.waitForFunction(() => scrollY === 0);
        await page.waitForTimeout(300);
        await page.keyboard.press('PageDown');
        await page.waitForFunction(() => document.querySelector('#obras').dataset.entering === 'true');
        await page.waitForFunction(() => document.querySelector('#obras').dataset.entering === 'false');
        assert.equal(await page.locator('#works').evaluate(element => element.inert), false,
          JSON.stringify(await page.evaluate(width => ({ width, scroll: scrollY,
            entering: document.querySelector('#obras').dataset.entering,
            focused: document.activeElement.tagName }), width)));
        assert.deepEqual(errors, []);
      }
      results.push({ width, ...measurements, bandSamples: samples, errors });
      await page.close();
    }
    const record = { shaderHashes: shaderHashes(), results };
    if (!baseline) assert.deepEqual(record.shaderHashes, JSON.parse(fs.readFileSync(path.join(output, 'before.json'))).shaderHashes);
    fs.writeFileSync(path.join(output, `${phase}.json`), JSON.stringify(record, null, 2));
    console.log(JSON.stringify(record, null, 2));
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
