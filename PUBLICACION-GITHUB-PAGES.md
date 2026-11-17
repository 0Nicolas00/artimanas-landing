# Copia temporal de Artimañas 2026

Repositorio: `0Nicolas00/artimanas-landing`.

- Rama para seguir trabajando: `trabajo/2026`.
- Rama de publicación independiente: `gh-pages`.
- Carpeta del sitio temporal en esa rama: `2026/temporal/`.
- Dirección de la copia: `https://0nicolas00.github.io/artimanas-landing/2026/temporal/`.

Los cambios en `trabajo/2026` no actualizan la copia publicada. La publicación cambia únicamente cuando se actualiza `gh-pages`.

La copia contiene el HTML, CSS, JavaScript compilado y los archivos de `assets/`, incluidas las fotos en `assets/Obras/` y los mapas HDR del shader. Se conservan las rutas relativas para funcionar dentro de la subcarpeta de Pages.

El proyecto se edita desde esta carpeta de VS Code. Para compilar el shader y probar en local:

```sh
npm ci --legacy-peer-deps
npm run build
npm run dev
```

La carpeta `.pages-preview/` es una copia local para comprobar la publicación bajo `/artimanas-landing/2026/temporal/`; está excluida de Git.
