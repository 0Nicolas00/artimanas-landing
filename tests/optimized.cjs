const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const manifest = require('../scripts/optimized-assets.json');
let checked = 0;
function check(url) {
  if (!url || /^(?:https?:|data:|#|\?)/.test(url)) return;
  const name = decodeURIComponent(url.split(/[?#]/)[0]);
  assert(fs.existsSync(path.resolve(root, name)), `Recurso faltante: ${name}`);
  checked++;
}
for (const [, value] of html.matchAll(/(?:src|srcset|href)="([^"]*)"/g)) check(value);
for (const [, value] of html.matchAll(/data-images="([^"]*)"/g)) value.split(',').forEach(check);
for (const name of fs.readdirSync(path.join(root, 'css'))) {
  const css = fs.readFileSync(path.join(root, 'css', name), 'utf8');
  for (const [, url] of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) {
    if (!url.startsWith('http') && !url.startsWith('data:')) check(path.posix.normalize(`css/${url}`));
  }
}
for (const [old, next] of Object.entries(manifest.replacements)) {
  assert(fs.existsSync(path.join(root, next)), next);
  if (old !== next) assert(!fs.existsSync(path.join(root, old)), `Original redundante: ${old}`);
}
for (const excluded of manifest.exclude) assert(!fs.existsSync(path.join(root, excluded)), excluded);
const bundle = fs.readFileSync(path.join(root, 'js/hero-shader.bundle.js'), 'utf8');
assert(bundle.includes('city.hdr'));
assert(!html.includes('hero-glass.webp') && !html.includes('hero-glass.svg'));
assert(bundle.includes('uBackground') && bundle.includes('uFieldView'));
assert(!bundle.includes('dawn.hdr') && !bundle.includes('lobby.hdr'));
assert.equal(fs.readFileSync(path.join(root, 'assets/Favicon-64.png')).readUInt32BE(16), 64);
assert.equal(fs.readFileSync(path.join(root, 'assets/Favicon-64.png')).readUInt32BE(20), 64);
assert.equal((html.match(/class="work-card"/g) || []).length, 32);
assert(html.includes('loading="lazy" decoding="async" src="assets/Error404.webp"'));
const bytes = dir => fs.readdirSync(dir, { withFileTypes: true }).reduce((total, item) => {
  const file = path.join(dir, item.name);
  return total + (item.isDirectory() ? bytes(file) : fs.statSync(file).size);
}, 0);
assert(bytes(root) < 23 * 1024 * 1024, 'Presupuesto de publicación con las fotos nuevas: menos de 23 MiB.');
console.log(JSON.stringify({ checkedReferences: checked, works: 32, hdrMaps: 1, favicon: '64x64', bytes: bytes(root) }));
