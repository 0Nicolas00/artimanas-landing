import { build } from 'esbuild';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
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
const cleanHtml = html.replace(/\s*<script data-hero-bootstrap>[\s\S]*?<\/script>/, '');
await writeFile('index.html', cleanHtml.replace('<meta charset="utf-8">',
  () => `<meta charset="utf-8">\n  <script data-hero-bootstrap>${inline}</script>`));
await build({
  entryPoints: ['src/hero-shader.jsx'], outfile: 'js/hero-shader.bundle.js',
  bundle: true, format: 'iife', platform: 'browser', target: ['es2020'],
  jsx: 'automatic', minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'linked', logLevel: 'info',
});
// The deploy directory contains only static files; no node_modules or React source.
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const name of ['index.html', 'css', 'js', 'assets']) {
  await cp(name, `dist/${name}`, { recursive: true });
}
// GitHub Pages serves Git blobs with LF; make the production artifact byte-identical.
async function normalizeText(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await normalizeText(file);
    else if (/\.(html|css|js|svg|txt|md)$/i.test(entry.name)) {
      const content = await readFile(file, 'utf8');
      if (content.includes('\r\n')) await writeFile(file, content.replace(/\r\n/g, '\n'));
    }
  }
}
await normalizeText('dist');
console.log('Netlify: subir la carpeta dist/');
