# Copia temporal de Artimañas 2026

Repositorio: `0Nicolas00/artimanas-landing`.

- Rama para seguir trabajando: `trabajo/2026`.
- Rama predeterminada y base estable: `main`.
- Rama de publicación independiente: `gh-pages`.
- Fuente de GitHub Pages: raíz de `gh-pages` (`/`).
- Carpeta del sitio temporal en esa rama: `2026/temporal/`.
- Dirección de la copia: `https://0nicolas00.github.io/artimanas-landing/2026/temporal/`.

Los cambios en `trabajo/2026` no actualizan la copia publicada. La publicación cambia únicamente cuando se actualiza `gh-pages`.

`main` conserva la versión estable del código actual. Los prototipos anteriores se conservan en el historial de Git. La rama `gh-pages` contiene la carpeta `2026/temporal/`, `.nojekyll` y su guía de publicación.

La copia contiene el HTML, CSS, JavaScript compilado y los archivos de `assets/`, incluidas las fotos en `assets/Obras/` y los mapas HDR del shader. Se conservan las rutas relativas para funcionar dentro de la subcarpeta de Pages.

El proyecto se edita desde esta carpeta de VS Code. Para compilar el shader y probar en local:

```sh
npm ci --legacy-peer-deps
npm run build
npm run dev
```

La carpeta `.pages-preview/` es una copia local para comprobar la publicación bajo `/artimanas-landing/2026/temporal/`; está excluida de Git.

Para el 404 de GitHub Pages, copiá `dist/404.html` también a la **raíz de `gh-pages`** al publicar. GitHub Pages toma la página de error de la raíz, incluso para rutas inexistentes dentro de `2026/temporal/`. El HTML resuelve los recursos y la salida a Inicio contra la carpeta publicada de Artimañas. En Netlify o con `npm run dev` se usa el 404 de la raíz del sitio.
