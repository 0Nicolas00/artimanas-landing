const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'qa-captures', 'catalog-slide');
const baseline = process.argv.includes('--baseline');
const phase = baseline ? 'before' : 'after';
const sizes = [[1440, 900], [768, 900], [390, 900], [1440, 600], [1440, 1100], [768, 640], [390, 700]];
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) return response.writeHead(403).end();
  try {
    const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
      '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png' };
    response.setHeader('Content-Type', types[path.extname(file).toLowerCase()] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
  } catch { response.writeHead(404).end(); }
});

async function centerImage(page, selector) {
  await page.locator(selector).evaluate(element => {
    const rect = element.getBoundingClientRect();
    scrollTo({ top: scrollY + rect.top + rect.height / 2 - innerHeight / 2, behavior: 'instant' });
  });
  await page.waitForTimeout(1000);
}

async function main() {
  await new Promise(resolve => server.listen(8979, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const results = [];
  let content;
  try {
    for (const [width, height] of sizes) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:8979/?heroTest=static');
      await page.locator('.work-card img').evaluateAll(async images => {
        await Promise.all(images.map(image => { image.loading = 'eager'; return image.decode(); }));
      });
      await page.waitForTimeout(300);
      const currentContent = await page.locator('.work-card').evaluateAll(cards => cards.map(card => ({
        slug: card.dataset.slug, category: card.dataset.category, pending: card.dataset.imagePending === 'true',
        title: card.querySelector('h3').textContent, author: card.querySelector('.work-author').textContent,
        image: card.querySelector('img').getAttribute('src')
      })));
      content = currentContent;
      const artwork = '.work-card[data-slug="t-i-t-o-andres"]';
      await centerImage(page, artwork + ' img');
      await page.mouse.move(10, 110);
      const measurements = await page.evaluate(() => {
        const works = document.querySelector('.works').getBoundingClientRect();
        const button = document.querySelector('#filter-trigger');
        const rect = button.getBoundingClientRect();
        const style = getComputedStyle(button);
        return { overflow: document.documentElement.scrollWidth > innerWidth,
          column: { left: works.left, width: works.width },
          filter: { background: style.backgroundColor, height: rect.height,
            bottom: innerHeight - rect.bottom, center: rect.left + rect.width / 2 },
          images: [...document.querySelectorAll('.work-card img')].map(image => {
            const rect = image.getBoundingClientRect();
            return { slug: image.closest('article').dataset.slug, width: rect.width, height: rect.height,
              naturalRatio: image.naturalWidth / image.naturalHeight, opacity: getComputedStyle(image).opacity,
              transform: getComputedStyle(image).transform };
          }),
          progress: document.querySelectorAll('#catalog-progress span').length,
          filterInputs: [...document.querySelectorAll('#filter-dialog input')].map(input => input.name)
        };
      });
      await page.screenshot({ path: path.join(output, `${phase}-${width}x${height}.png`) });
      if (!baseline) {
        assert.equal(measurements.overflow, false);
        assert.equal(measurements.filter.background, 'rgb(255, 255, 255)');
        assert.equal(measurements.filter.height, 44);
        assert(measurements.filterInputs.length === 5 && measurements.filterInputs.every(name => name === 'categoria'));
        for (const image of measurements.images) {
          assert(Math.abs(image.width / image.height / image.naturalRatio - 1) < 0.003, `Original ratio ${image.slug} at ${width}x${height}`);
          if (width <= 1100) {
            assert.equal(image.opacity, '1');
            assert.equal(image.transform, 'none');
          }
        }
        if (width === 1440) {
          assert.equal(measurements.column.left, 440);
          assert.equal(measurements.column.width, 560);
          assert(Math.abs(measurements.filter.center - 720) < 1);
          assert.equal(measurements.filter.bottom, 48);
          assert.equal(measurements.progress, content.length);
          assert.equal(await page.locator('#catalog-progress .is-active').count(), 1);
          assert(await page.locator('#catalog-progress').evaluate(element => {
            const rect = element.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= innerHeight;
          }));
          const meta = await page.locator(artwork + ' .work-meta').evaluate(element => {
            const category=element.querySelector('.work-category'), title=element.querySelector('h3'), author=element.querySelector('.work-author');
            const a=category.getBoundingClientRect(), b=title.getBoundingClientRect(), c=author.getBoundingClientRect();
            return { left:element.getBoundingClientRect().left, categoryGap:b.top-a.bottom, authorGap:c.top-b.bottom,
              categorySize:getComputedStyle(category).fontSize, titleSize:getComputedStyle(title).fontSize, authorSize:getComputedStyle(author).fontSize,
              avatarContent:getComputedStyle(author,'::before').content };
          });
          assert.deepEqual(meta, {left:1030,categoryGap:12,authorGap:32,categorySize:'14px',titleSize:'32px',authorSize:'18px',avatarContent:'none'});
          const hierarchy=await page.locator('.work-card').evaluateAll(cards=>cards.map(card=>{
            const style=getComputedStyle(card.querySelector('img'));
            return {active:card.classList.contains('is-active'),opacity:Number(style.opacity),scale:new DOMMatrixReadOnly(style.transform).a,
              height:card.getBoundingClientRect().height};
          }));
          const active=hierarchy.find(card=>card.active);
          assert(active.opacity>.99 && active.scale>1.37);
          assert(hierarchy.filter(card=>!card.active).every(card=>card.opacity<active.opacity && card.scale<active.scale));
          assert(hierarchy.every(card=>Math.abs(card.height-height*.34)<1));
          assert.equal(await page.locator('#student-list a[aria-current="true"]').getAttribute('data-open-work'), 't-i-t-o-andres');
          await page.mouse.move(width/2,height/2);
          await page.mouse.wheel(0,height*.34);
          await page.waitForTimeout(1200);
          assert.equal(await page.locator('.work-card.is-active').getAttribute('data-slug'), content[2].slug);
          assert.equal(await page.locator('#student-list a[aria-current="true"]').getAttribute('data-open-work'), content[2].slug);
          assert.equal(await page.locator('#catalog-progress .is-active').getAttribute('data-progress-for'), content[2].slug);
          assert(await page.locator('.work-card.is-active').evaluate(card=>{
            const rect=card.getBoundingClientRect();
            return Math.abs(rect.top+rect.height/2-innerHeight/2)<2;
          }));
          measurements.wheelSelectionSynchronized=true;
          await centerImage(page, '.work-card[data-slug="deriva-ferrer"] img');
          assert.equal(await page.locator('#catalog-progress .is-active').getAttribute('data-progress-for'), 'deriva-ferrer');
          await centerImage(page, artwork + ' img');
          measurements.progressFollowsScroll=true;
        } else {
          const cards=await page.locator('.work-card').evaluateAll(elements=>elements.map(element=>{
            const image=element.querySelector('img'), title=element.querySelector('h3'), author=element.querySelector('.work-author');
            const a=image.getBoundingClientRect(), b=title.getBoundingClientRect(), c=author.getBoundingClientRect();
            return {left:a.left,top:a.top,bottom:c.bottom,width:a.width,imageGap:b.top-a.bottom,authorGap:c.top-b.bottom,
              titleSize:getComputedStyle(title).fontSize,authorSize:getComputedStyle(author).fontSize,
              readable:author.scrollWidth<=author.clientWidth && author.scrollHeight<=author.clientHeight && title.scrollHeight<=title.clientHeight};
          }));
          assert(cards.every(card=>card.width===(width===768?340:167) && card.imageGap===8 && card.authorGap===4 && card.titleSize==='16px' && card.authorSize==='12px' && card.readable));
          assert.equal(cards[1].left-cards[0].left-cards[0].width,24);
          for (const left of new Set(cards.map(card=>card.left))) {
            const column=cards.filter(card=>card.left===left);
            assert(column.slice(1).every((card,index)=>card.top-column[index].bottom>=40 && card.top-column[index].bottom<41));
          }
          assert.equal(await page.locator('#works').evaluate(element=>element.getBoundingClientRect().top-document.querySelector('.hero').getBoundingClientRect().bottom),64);
          measurements.namesReadable=true;
        }
        await page.locator(artwork + ' .work-link').hover();
        await page.waitForTimeout(650);
        assert.equal(await page.locator('.cursor-label').textContent(), 'Ver obra');
        await page.mouse.move(10, 110);
      }
      if (height === 900 || !baseline) {
        await page.locator('#filter-trigger').click();
        await page.waitForTimeout(500); // Capture the sheet after its entrance animation.
        if (height === 900) await page.screenshot({ path: path.join(output, `${phase}-${width}-filters.png`) });
        if (!baseline) {
          await page.locator('input[name="categoria"][value="sensorialidad"]').check();
          if (width <= 1100) await page.locator('#apply-filters').click();
          else await page.locator('#filter-dialog [data-close-dialog]').click();
          await page.waitForTimeout(400);
          const filtered = page.locator('.work-card:not([hidden])');
          assert.equal(await filtered.count(), content.filter(work => work.category === 'sensorialidad').length);
          assert(await filtered.evaluateAll(cards => cards.every(card => card.dataset.category === 'sensorialidad')));
          assert((await page.locator('#filter-trigger span').textContent()).includes('(1)'));
          if (width === 1440) assert.equal(await page.locator('#catalog-progress span').count(), await filtered.count());
          const first = filtered.first();
          const slug = await first.getAttribute('data-slug');
          const expected = content.find(work => work.slug === slug);
          const link = first.locator('.work-link');
          await link.scrollIntoViewIfNeeded();
          await page.waitForTimeout(100);
          const position = await page.evaluate(() => scrollY);
          await link.click();
          await page.waitForFunction(() => document.querySelector('#work-dialog').dataset.phase === 'settled');
          assert.equal(await page.locator('#detail-title').textContent(), expected.title);
          assert.equal(await page.locator('#detail-author').textContent(), expected.author);
          assert.equal(new URL(page.url()).searchParams.get('obra'), slug);
          assert.equal(await page.locator('#media-stage img').evaluate(image => getComputedStyle(image).objectFit), 'contain');
          if (height === 900) await page.screenshot({ path: path.join(output, `after-${width}-detail.png`) });
          await page.locator('#work-dialog [data-close-dialog]').click();
          await page.waitForFunction(() => !document.querySelector('#work-dialog').open);
          await page.waitForTimeout(400);
          assert(Math.abs(await page.evaluate(() => scrollY) - position) < 2);
          measurements.detailRestored = true;
          await page.locator('#filter-trigger').click();
          await page.locator('#clear-filters').click();
          if (width <= 1100) await page.locator('#apply-filters').click();
          else await page.locator('#filter-dialog [data-close-dialog]').click();
          assert.equal(await page.locator('.work-card:not([hidden])').count(), content.length);
          assert.deepEqual(errors, []);
        } else await page.keyboard.press('Escape');
      }
      results.push({ width, height, ...measurements, errors });
      await page.close();
    }
    if (!baseline) assert.deepEqual(content, JSON.parse(fs.readFileSync(path.join(root, 'qa-captures/catalog/before.json'))).content);
    fs.writeFileSync(path.join(output, `${phase}.json`), JSON.stringify({ content, results }, null, 2));
    console.log(JSON.stringify({ phase, sizes: results.map(result => ({ width: result.width, height: result.height,
      overflow: result.overflow, detailRestored: result.detailRestored, errors: result.errors })) }, null, 2));
  } finally { await browser.close(); server.close(); }
}

main().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
