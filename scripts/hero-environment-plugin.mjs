import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function heroEnvironmentPlugin() {
  const metadata = JSON.parse(await readFile('node_modules/@shadergradient/react/package.json', 'utf8'));
  if (metadata.version !== '2.4.20') {
    throw new Error('Revisar la integración de EnvironmentMap antes de actualizar ShaderGradient.');
  }
  let replaced = false;
  return {
    name: 'single-hero-environment',
    setup(build) {
      build.onResolve({ filter: /chunk-V6TQH2YK\.mjs$/ }, args => {
        if (!args.importer.replaceAll('\\', '/').includes('/node_modules/@shadergradient/react/')) return;
        replaced = true;
        return { path: path.resolve('src/hero-environment.jsx') };
      });
      build.onEnd(result => {
        if (!result.errors.length && !replaced) {
          return { errors: [{ text: 'No se encontró el EnvironmentMap esperado de ShaderGradient 2.4.20.' }] };
        }
      });
    },
  };
}
