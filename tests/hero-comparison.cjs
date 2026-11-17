// Run with Live Server. These measurements describe this browser session.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const baseUrl = process.env.HERO_URL || 'http://127.0.0.1:5500/index.html';
const variants = [
  ['static', 'heroTest=static&palette=0'],
  ['shader', 'heroTest=shader&palette=0'],
  ['resolution', 'heroTest=shader&palette=0&heroDpr=0.75'],
  ['grain', 'heroTest=shader&palette=0&heroGrain=off'],
  ['combined', 'heroTest=shader&palette=0&heroDpr=0.75&heroGrain=off'],
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BRAVE_PATH || 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript(() => {
      window.audit = { draws: 0, time: 0, updates: 0, contexts: 0 };
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (/^webgl/.test(type)) audit.contexts++;
        return getContext.call(this, type, ...args);
      };
      for (const API of [window.WebGLRenderingContext, window.WebGL2RenderingContext].filter(Boolean)) {
        const locations = new WeakSet();
        const locate = API.prototype.getUniformLocation;
        const scalar = API.prototype.uniform1f;
        API.prototype.getUniformLocation = function (program, name) {
          const location = locate.call(this, program, name);
          if (location && name === 'uTime') locations.add(location);
          return location;
        };
        API.prototype.uniform1f = function (location, value) {
          if (locations.has(location)) { audit.time = value; audit.updates++; }
          return scalar.call(this, location, value);
        };
        for (const method of ['drawArrays', 'drawElements']) {
          const draw = API.prototype[method];
          API.prototype[method] = function (...args) {
            if (this.canvas.closest('#hero-shader')) audit.draws++;
            return draw.apply(this, args);
          };
        }
      }
    });
    let palette;
    let fullWidth;
    for (const [name, query] of variants) {
      const url = new URL(baseUrl);
      url.search = query;
      await page.goto(url.href);
      await page.waitForFunction(() => {
        const state = document.querySelector('.hero').dataset.shader;
        return state === 'static' || (state === 'ready' && audit.time > 2);
      });
      const colors = await page.evaluate(() => ArtimanasHeroPalette.colors.join(','));
      palette ??= colors;
      assert.equal(colors, palette, 'Both backgrounds use the same palette');
      const width = await page.locator('#hero-shader canvas').evaluateAll(nodes => nodes[0]?.width || 0);
      if (name === 'shader') fullWidth = width;
      if (name === 'resolution') assert(width < fullWidth, 'Internal resolution decreases');
      if (name === 'static') {
        assert.equal(width, 0);
        assert.equal(await page.evaluate(() => audit.contexts), 0, 'Static mode never initializes WebGL');
      }
      const idle = await page.evaluate(async () => {
        const before = { ...audit }, start = performance.now(), times = [];
        await new Promise(resolve => {
          function sample(now) {
            times.push(now);
            if (now - start >= 1200) resolve();
            else requestAnimationFrame(sample);
          }
          requestAnimationFrame(sample);
        });
        const intervals = times.slice(1).map((time, index) => time - times[index]);
        return {
          pageFrames: times.length,
          shaderUpdates: audit.updates - before.updates,
          gpuDraws: audit.draws - before.draws,
          longestFrameMs: Math.round(Math.max(...intervals) * 10) / 10,
        };
      });
      await page.mouse.move(700, 850);
      await page.mouse.wheel(0, 250);
      await page.waitForFunction(() => scrollY > 20 && document.querySelector('#obras').dataset.entering === 'false');
      assert.equal(await page.locator('#works').evaluate(element => element.inert), false);
      console.log(JSON.stringify({ variant: name, canvasWidth: width, ...idle }));
    }
    await page.evaluate(() => scrollTo({ top: innerHeight * 2, behavior: 'instant' }));
    await page.waitForFunction(() => document.querySelector('.hero').dataset.shaderMotion === 'paused');
    await page.waitForTimeout(500);
    const draws = await page.evaluate(() => audit.draws);
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => audit.draws), draws, 'Offscreen shader does not render');
    const defaultUrl = new URL(baseUrl);
    defaultUrl.search = '';
    await page.goto(defaultUrl.href);
    await page.waitForFunction(() => document.querySelector('.hero').dataset.shader === 'ready' && audit.time > 2);
    assert.equal(await page.evaluate(() => window.ArtimanasHeroTest), undefined);
    assert.equal(await page.locator('#hero-shader canvas').evaluate(canvas => canvas.width), Math.floor(fullWidth * .75));
    const normal = await page.evaluate(async () => {
      const before = { ...audit };
      await new Promise(resolve => setTimeout(resolve, 400));
      return { draws: audit.draws - before.draws, updates: audit.updates - before.updates };
    });
    assert(normal.updates > 0, 'Normal cover animates automatically');
    assert.equal(normal.draws, normal.updates, 'Normal cover omits the grain rendering pass');
    console.log('PASS: same palette, static mode, resolution, grain, combined settings, catalog and offscreen pause.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
