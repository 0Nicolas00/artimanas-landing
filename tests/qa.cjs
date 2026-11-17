const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const baseline = process.argv.includes('--baseline');
const output = path.join(os.tmpdir(), 'artimanas-qa');
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
      '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.JPG': 'image/jpeg', '.webp': 'image/webp' };
    response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
  } catch {
    response.writeHead(404).end();
  }
});

async function settled(page) {
  await page.waitForFunction(() => document.querySelector('#work-dialog').dataset.phase === 'settled');
}

async function main() {
  await new Promise(resolve => server.listen(8977, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const results = [];
  try {
    for (const width of [1440, 768, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:8977/?heroTest=static');
      await page.evaluate(() => scrollTo({ top: 1300, behavior: 'instant' }));
      await page.waitForTimeout(900);
      const measurements = await page.evaluate(() => {
        const styles = selector => {
          const element = document.querySelector(selector);
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return { fontSize: style.fontSize, lineHeight: style.lineHeight, color: style.color,
            opacity: style.opacity, left: rect.left, width: rect.width };
        };
        return { heading: styles('#student-heading'), name: styles('#student-list a'),
          overflow: document.documentElement.scrollWidth > innerWidth };
      });
      if (!baseline) {
        const palette = await page.evaluate(() => {
          const style = getComputedStyle(document.documentElement);
          return ['--surface-0', '--text-base', '--text-muted', '--border', '--border-disabled',
            '--surface-active', '--surface-inverted', '--text-inverted'].map(token => style.getPropertyValue(token).trim());
        });
        assert.deepEqual(palette, ['#110910', '#f5f4f5', '#b8adb7', '#7f6c7e', '#605260', '#4e2d4d', '#f6eff5', '#2c252c']);
        const typographyOutsideScale = await page.evaluate(() => {
          const scale = new Set(['14px/20px', '16px/24px', '18px/28px', '18px/26px', '28px/36px', '32px/40px']);
          return [...document.querySelectorAll('body *')].filter(element => {
            if (element.matches('.sr-only,.star,.marquee-track i') || !element.getClientRects().length || ![...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())) return false;
            const style = getComputedStyle(element);
            if (innerWidth<=1100 && element.matches('.work-author') && style.fontSize==='12px' && style.lineHeight==='16px') return false; // TB-02 / MB-04 override G-02 here.
            return !scale.has(`${style.fontSize}/${style.lineHeight}`);
          }).map(element => ({ tag: element.tagName, className: element.className }));
        });
        assert.deepEqual(typographyOutsideScale, []);
      }
      await page.screenshot({ path: path.join(output, `${baseline ? 'before' : 'after'}-${width}-catalog.png`) });
      if (!baseline && width === 1440) {
        const alignment = await page.locator('#student-list a').first().evaluate(element => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return range.getBoundingClientRect().left - document.querySelector('#student-heading').getBoundingClientRect().left;
        });
        assert.equal(alignment, 0);
        await page.locator('.student-sidebar').evaluate(element => { element.scrollTop = 200; });
      }
      const card = page.locator('.work-card:not([hidden]) .work-link').nth(1);
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      const catalogScroll = await page.evaluate(() => scrollY);
      await card.click();
      await settled(page);
      if (!baseline) {
        const firstImage = await page.locator('#media-stage img').getAttribute('src');
        await page.keyboard.press('ArrowRight');
        assert.notEqual(await page.locator('#media-stage img').getAttribute('src'), firstImage);
        await page.keyboard.press('ArrowLeft');
        assert.equal(await page.locator('#media-stage img').getAttribute('src'), firstImage);
        measurements.slideKeyboard = true;
      }
      const list = page.locator('.detail-students');
      measurements.detailList = await list.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const heading = element.querySelector('h3').getBoundingClientRect();
        return { top: heading.top, left: heading.left, width: rect.width, height: rect.height,
          scrollTop: element.scrollTop, visible: getComputedStyle(element).display !== 'none',
          overflow: element.scrollWidth > element.clientWidth };
      });
      await page.screenshot({ path: path.join(output, `${baseline ? 'before' : 'after'}-${width}-detail.png`) });
      if (!baseline) {
        assert.equal(measurements.overflow, false, `Page overflow at ${width}`);
        const unreadableAuthors = await page.locator('.work-author').evaluateAll(elements => elements.filter(element => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const text = range.getBoundingClientRect();
          const card = element.closest('.work-card').getBoundingClientRect();
          return text.width > card.width && innerWidth <= 1100;
        }).map(element => element.textContent));
        assert.deepEqual(unreadableAuthors, []);
        if (width === 1440) {
          assert.equal(measurements.heading.fontSize, '18px');
          assert.equal(measurements.name.lineHeight, '28px');
          assert.equal(measurements.detailList.top, 16);
          assert.equal(measurements.detailList.left, 16);
          assert.equal(measurements.detailList.scrollTop, 0);
          assert.equal(measurements.detailList.overflow, false);
          assert.equal(measurements.detailList.height, 880);
          const names = page.locator('#detail-student-list a');
          const first = names.first();
          await first.hover();
          const hover = await first.evaluate(element => {
            const point = getComputedStyle(element, '::before');
            const style = getComputedStyle(element);
            return { point: point.width, shadow: style.textShadow, color: style.color };
          });
          assert.equal(hover.point, '8px');
          assert.notEqual(hover.shadow, 'none');
          assert.equal(await first.evaluate(element => getComputedStyle(element).outlineStyle), 'none');
          await first.click();
          await settled(page);
          assert.equal(new URL(page.url()).searchParams.get('obra'), await first.getAttribute('data-open-work'));
          await names.last().click();
          await settled(page);
          assert.equal(await page.locator('#detail-author').textContent(), 'Ubaldi, Guadalupe');
          assert.equal(await names.last().getAttribute('aria-current'), 'true');
          measurements.switchWithinDetail = true;
          await names.first().focus();
          await page.keyboard.press('Tab');
          const focus = await names.nth(1).evaluate(element => {
            const style = getComputedStyle(element);
            return { focused: element === document.activeElement, color: style.outlineColor,
              width: style.outlineWidth, offset: style.outlineOffset };
          });
          assert.deepEqual(focus, { focused: true, color: 'rgb(255, 255, 255)', width: '2px', offset: '0px' });
          assert(await names.nth(1).evaluate(element => {
            const item = element.getBoundingClientRect();
            const column = element.closest('.detail-students').getBoundingClientRect();
            return item.left - 2 >= column.left && item.right + 2 <= column.right;
          }), 'Keyboard outline fits inside the scrollable column');
          await page.screenshot({ path: path.join(output, 'after-1440-keyboard-focus.png') });
          const clippedNames = await names.evaluateAll(elements => elements.filter(element => {
            const range = document.createRange();
            range.selectNodeContents(element);
            const text = range.getBoundingClientRect();
            const column = element.closest('.detail-students').getBoundingClientRect();
            return text.right > column.right || text.left < column.left;
          }).map(element => element.textContent));
          assert.deepEqual(clippedNames, []);
        }
      }
      await page.locator('#work-dialog [data-close-dialog]').click();
      await page.waitForFunction(() => !document.querySelector('#work-dialog').open);
      await page.waitForTimeout(500);
      measurements.scrollDifference = await page.evaluate(original => scrollY - original, catalogScroll);
      if (!baseline) {
        assert(Math.abs(measurements.scrollDifference) < 2, `Catalog scroll restored at ${width}`);
        if (width === 1440) assert.equal(await page.locator('.student-sidebar').evaluate(element => element.scrollTop), 200);
        const other = page.locator('.work-card:not([hidden]) .work-link').nth(2);
        await other.click();
        await settled(page);
        assert.equal(await page.locator('#detail-author').textContent(), 'Aroza, Matias');
        measurements.reopenOtherWork = true;
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('#work-dialog').open);
        await page.goto('http://127.0.0.1:8977/?pagina=galeria&heroTest=static');
        assert(await page.getByText('Próximamente, fotos de la muestra', { exact: true }).isVisible());
        if (width === 390) await page.locator('[data-open-menu]').click();
        const galleryLink = page.locator(width === 390 ? '#menu-dialog [data-page-link="galeria"]' : '.desktop-nav[data-page-link="galeria"]');
        assert(await galleryLink.isVisible());
        measurements.gallery = true;
        await page.goto('http://127.0.0.1:8977/?obra=no-existe&heroTest=static');
        const errorBackground = page.locator('.error-background');
        await errorBackground.evaluate(image => image.decode());
        assert.equal(await errorBackground.getAttribute('src'), 'assets/Error404.png');
        assert.equal(await errorBackground.evaluate(image => image.naturalWidth), 5760);
        assert(await page.locator('.error-view').isVisible());
        assert(await page.locator('#error-title').evaluate(element => {
          const rect = element.getBoundingClientRect();
          return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
        }));
        await page.screenshot({ path: path.join(output, `error-${width}.png`) });
        await page.locator('.error-view [data-page-link="inicio"]').click();
        assert(await page.locator('.hero').isVisible());
        measurements.errorBackground = true;
        if (width <= 768) {
          await page.goto('http://127.0.0.1:8977/?heroTest=static');
          await page.evaluate(() => scrollTo({ top: 1300, behavior: 'instant' }));
          await page.locator('#filter-trigger').click();
          assert.equal(await page.locator('#filter-dialog input[name="alumno"]').count(), 0);
          const clippedFilters = await page.locator('#panel-categorias label span').evaluateAll(elements => elements.filter(element => {
            const range = document.createRange();
            range.selectNodeContents(element);
            const text = range.getBoundingClientRect();
            const panel = element.closest('#panel-categorias').getBoundingClientRect();
            return text.left < panel.left || text.right > panel.right;
          }).map(element => element.textContent));
          assert.deepEqual(clippedFilters, []);
          measurements.filterCategoriesReadable = true;
        }
        if (width === 1440) {
          await page.goto('http://127.0.0.1:8977/?obra=umbral-bigot&heroTest=static');
          await settled(page);
          const direct = await page.locator('.detail-students h3').boundingBox();
          assert.equal(direct.x, 16);
          assert.equal(direct.y, 16);
          assert.equal(await list.evaluate(element => element.scrollTop), 0);
          measurements.directLink = true;
          const artworkImages = await page.locator('.work-card').evaluateAll(cards => cards.flatMap(card => {
            return card.dataset.images ? card.dataset.images.split(',') : [card.querySelector('img').getAttribute('src')];
          }));
          for (const image of new Set(artworkImages)) {
            const response = await page.request.get(new URL(image.trim(), page.url()).href);
            assert.equal(response.status(), 200, `Artwork image exists: ${image}`);
          }
          assert.equal(await page.locator('#student-list').getByText(/Bareiro/).count(), 0);
          measurements.artworkPathsChecked = new Set(artworkImages).size;
        }
        assert.deepEqual(errors, []);
      }
      results.push({ width, ...measurements, errors });
      await page.close();
    }
    fs.writeFileSync(path.join(output, baseline ? 'before.json' : 'after.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ output, results }, null, 2));
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
