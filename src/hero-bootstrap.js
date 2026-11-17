import { PALETTES } from '../Hero.jsx';

// Inlined into <head> by the build: choose before CSS/the hero can first paint.
const index = Math.floor(Math.random() * PALETTES.length);
const colors = Object.freeze([...PALETTES[index].colors]);
window.ArtimanasHeroPalette = Object.freeze({ index, colors });
colors.forEach((color, i) => document.documentElement.style.setProperty(`--hero-color-${i + 1}`, color));

// A failed bundle download must also wake the standalone 2D fallback.
window.addEventListener('error', event => {
  const scriptFailed = event.target?.matches?.('script[data-hero-shader]');
  const startupFailed = event.filename?.includes('/hero-shader.bundle.js');
  if (!scriptFailed && !startupFailed) return;
  const hero = document.querySelector('.hero');
  if (!hero || hero.dataset.shader === 'ready') return;
  hero.dataset.shader = 'fallback';
  hero.dataset.shaderFallback = 'bundle-error';
  hero.dispatchEvent(new Event('artimanas:shader-state'));
}, true);
