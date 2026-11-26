import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { heroEnvironmentPlugin } from './hero-environment-plugin.mjs';
import { packageStatic } from './package-static.mjs';
// Extract only the palette literal from Hero.jsx; do not ship React in the head.
const paletteSource = (await readFile('Hero.jsx', 'utf8')).match(/export const PALETTES = \[[\s\S]*?\n\];/)?.[0];
if (!paletteSource) throw new Error('No se encontró PALETTES en Hero.jsx.');
const startupSource = (await readFile('src/hero-bootstrap.js', 'utf8')).replace(/^import[^\n]+\n/, '');
const bootstrap = await build({
  stdin: { contents: paletteSource.replace('export ', '') + '\n' + startupSource, loader: 'js' },
  bundle: true, write: false,
  format: 'iife', platform: 'browser', target: ['es2020'], jsx: 'automatic',
  minify: true, define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'none',
});
const inline = bootstrap.outputFiles[0].text.trim().replace(/<\/script/gi, '<\\/script');
if (inline.length > 2000) throw new Error('El bootstrap de paletas debe ser pequeño.');
const html = await readFile('index.html', 'utf8');
// Keep the charset first and the palette bootstrap ahead of every stylesheet.
const placeholder = (await readFile('assets/brand-glass-static.svg', 'utf8')).trim();
const cleanHtml = html.replace(/\s*<script data-hero-bootstrap>[\s\S]*?<\/script>/, '')
  .replace(/(<div class="glass-static" aria-hidden="true">)[\s\S]*?(<\/div>)/, (_, open, close) => open + placeholder + close);
await writeFile('index.html', cleanHtml.replace('<meta charset="utf-8">',
  () => `<meta charset="utf-8">\n  <script data-hero-bootstrap>${inline}</script>`));
await build({
  entryPoints: ['src/hero-shader.jsx'], outfile: 'js/hero-shader.bundle.js',
  loader: { '.gz': 'binary' },
  plugins: [await heroEnvironmentPlugin()],
  bundle: true, format: 'iife', platform: 'browser', target: ['es2020'],
  jsx: 'automatic', minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'linked', logLevel: 'info',
});
await build({
  entryPoints: ['src/glass-fallback.js'], outfile: 'js/glass-fallback.bundle.js',
  loader: { '.gz': 'binary' },
  bundle: true, minify: true, format: 'iife', target: ['es2020'],
});
await packageStatic();
