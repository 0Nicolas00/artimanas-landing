import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function packageStatic() {
  const manifest = JSON.parse(await readFile('scripts/optimized-assets.json', 'utf8'));
  const excluded = new Set([
    ...manifest.exclude,
    ...Object.entries(manifest.replacements).filter(([old, next]) => old !== next).map(([old]) => old),
  ]);
  const root = process.cwd();
  await rm('dist', { recursive: true, force: true });
  await mkdir('dist', { recursive: true });
  for (const name of ['index.html', '404.html', 'css', 'js', 'assets']) {
    await cp(name, `dist/${name}`, {
      recursive: true,
      filter: source => !excluded.has(path.relative(root, source).split(path.sep).join('/')),
    });
  }
  async function normalize(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await normalize(file);
      else if (/\.(html|css|js|svg|txt)$/i.test(entry.name)) {
        const content = await readFile(file, 'utf8');
        if (content.includes('\r\n')) await writeFile(file, content.replaceAll('\r\n', '\n'));
      }
    }
  }
  await normalize('dist');
  console.log('Publicación preparada en dist/ (sin originales reemplazados ni archivos de desarrollo).');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await packageStatic();
