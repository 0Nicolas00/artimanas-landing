// Functional regression checks only: software WebGL is not a performance benchmark.
// Start Live Server, then run: node tests/hero-lifecycle.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.BRAVE_PATH || 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 750 } });
    await page.addInitScript(() => {
      window.audit = { contexts2D: 0, draws2D: 0, gpuDraws: 0, commits: 0, renderers: 0 };
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        supportsFiber: true,
        inject() { return ++audit.renderers; },
        onCommitFiberRoot() { audit.commits++; },
        onCommitFiberUnmount() {},
      };
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        if (this.id === 'hero-gradient' && kind === '2d') audit.contexts2D++;
        return get.call(this, kind, ...args);
      };
      const put = CanvasRenderingContext2D.prototype.putImageData;
      CanvasRenderingContext2D.prototype.putImageData = function (...args) {
        if (this.canvas.id === 'hero-gradient') audit.draws2D++;
        return put.apply(this, args);
      };
      for (const API of [window.WebGLRenderingContext, window.WebGL2RenderingContext].filter(Boolean)) {
        for (const name of ['drawArrays', 'drawElements']) {
          const draw = API.prototype[name];
          API.prototype[name] = function (...args) {
            if (this.canvas.closest('#hero-shader')) audit.gpuDraws++;
            return draw.apply(this, args);
          };
        }
      }
    });
    const draws = () => page.evaluate(() => audit.gpuDraws);
    async function expectPaused(label) {
      await page.waitForFunction(() => document.querySelector('.hero').dataset.shaderMotion === 'paused');
      // Let an already queued frame and Canvas's debounced scroll measurement finish.
      await page.waitForTimeout(500);
      const before = await draws();
      await page.waitForTimeout(1500);
      assert.equal(await draws(), before, label);
    }
    async function expectRunning() {
      const before = await draws();
      await page.waitForFunction(n => audit.gpuDraws > n + 5, before);
    }
    await page.goto(process.env.HERO_URL || 'http://127.0.0.1:5500/index.html');
    await page.waitForFunction(() => document.querySelector('.hero').dataset.shader === 'ready');
    await expectRunning();
    const before = await page.evaluate(() => ({ ...audit }));
    assert(before.renderers > 0, 'React commit observer must be active');
    for (let batch = 0; batch < 10; batch++) {
      await page.evaluate(() => {
        const hero = document.querySelector('.hero'), rect = hero.getBoundingClientRect();
        for (let i = 0; i < 20; i++) hero.dispatchEvent(new PointerEvent('pointermove', {
          pointerType: 'mouse', clientX: rect.left + (i % 2 ? .9 : .1) * rect.width,
          clientY: rect.top + .5 * rect.height, bubbles: true,
        }));
      });
      await page.waitForTimeout(50);
    }
    const moved = await page.evaluate(() => ({ ...audit }));
    assert.equal(moved.commits - before.commits, 0, 'Pointer events must not commit React updates');
    assert.equal(moved.contexts2D, 0, 'Fallback must stay uninitialized while shader is ready');
    assert.equal(moved.draws2D, 0);
    await page.evaluate(() => scrollTo({ top: innerHeight * 2, behavior: 'instant' }));
    await page.waitForFunction(() => document.querySelector('.hero').getBoundingClientRect().bottom < 0);
    await expectPaused('No shader draws offscreen, including after scroll reconfiguration');
    await page.setViewportSize({ width: 1050, height: 700 });
    await expectPaused('Resize must not restart an offscreen shader');
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await expectRunning();
    await page.evaluate(() => document.body.classList.add('modal-open'));
    await expectPaused('Shader must pause behind a modal');
    await page.evaluate(() => document.body.classList.remove('modal-open'));
    await expectRunning();
    await page.locator('.site-header [data-page-link="galeria"]').click();
    await expectPaused('Shader must pause in the gallery view');
    console.log('PASS: 2D idle; 200 pointer events, 0 React commits; offscreen/resize/modal/gallery paused; animation resumes.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
