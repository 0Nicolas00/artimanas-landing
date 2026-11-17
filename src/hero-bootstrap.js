import { PALETTES } from '../Hero.jsx';

// Inlined into <head> by the build: choose before CSS/the hero can first paint.
const params = new URLSearchParams(location.search);
const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const mode = local && ['shader', 'static'].includes(params.get('heroTest')) ? params.get('heroTest') : null;
const requestedPalette = Number(params.get('palette') ?? 0);
if (mode) {
  const density = Number(params.get('heroDpr') ?? 1);
  window.ArtimanasHeroTest = Object.freeze({
    mode,
    pixelDensity: [0.5, 0.75, 1].includes(density) ? density : 1,
    grain: params.get('heroGrain') === 'off' ? 'off' : 'on',
  });
}
const index = mode
  ? (Number.isInteger(requestedPalette) && requestedPalette >= 0 && requestedPalette < PALETTES.length ? requestedPalette : 0)
  : Math.floor(Math.random() * PALETTES.length);
const colors = Object.freeze([...PALETTES[index].colors]);
window.ArtimanasHeroPalette = Object.freeze({ index, colors });
colors.forEach((color, i) => document.documentElement.style.setProperty(`--hero-color-${i + 1}`, color));

// Keep the selected static CSS gradient visible if the bundle fails to load.
window.addEventListener('error', event => {
  const scriptFailed = event.target?.matches?.('script[data-hero-shader]');
  const startupFailed = event.filename?.includes('/hero-shader.bundle.js');
  if (!scriptFailed && !startupFailed) return;
  const hero = document.querySelector('.hero');
  if (!hero || hero.dataset.shader === 'ready') return;
  hero.dataset.shader = 'fallback';
  hero.dataset.shaderFallback = 'bundle-error';
}, true);
