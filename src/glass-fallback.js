import { TRACE_COMPLETE, glassFrame, smoothContact } from './glass-motion.mjs';
import { createGlassCanvas } from './glass-canvas.js';
import { loadGlassField } from './glass-field.js';
import { glassTraceLayout, traceDashes } from './glass-trace.mjs';

const root = document.documentElement;
const hero = document.querySelector('.hero');
const grain = hero.querySelector('.hero-grain');
if (window.ArtimanasHeroTest?.grain === 'off') grain.hidden = true;
const canvas = hero.querySelector('.glass-fallback');
const ctx = canvas.getContext('2d');
const vectorPieces = Array.from(hero.querySelectorAll('.glass-static-piece'), piece => ({
  body: piece.querySelector('.glass-vector-body'),
  rim: piece.querySelector('.glass-vector-rim'),
}));
const pointer = { active: false, x: 0, y: 0 };
const inactivePointer = { active: false };
const contact = { x: 0, y: 0, strength: 0 };
const preference = matchMedia('(prefers-reduced-motion: reduce)');
let field, renderGlass;
let visible = true, running = false, frame = 0, previous = 0, time = 0;
let needsResize = true;
let entranceClock;
let vectorFrame = 0, vectorLayout, vectorFinished = false;

function drawVector(now) {
  const { trace, stroke, fill, feather } = glassFrame(now, root.dataset.glassEntrance, 0, preference.matches);
  const complete = fill === 1;
  const height = Math.max(1, hero.clientHeight);
  vectorLayout ??= glassTraceLayout(hero, hero.clientWidth / height);
  const { runs } = vectorLayout;
  vectorPieces.forEach(({ body, rim }, index) => {
    body.style.opacity = complete ? '' : String(fill);
    rim.style.opacity = String(stroke);
    rim.style.strokeDasharray = trace < TRACE_COMPLETE ? traceDashes(runs[index], trace / TRACE_COMPLETE) : '';
    rim.style.filter = feather ? `blur(${feather * height * .32}px)` : '';
  });
  if (complete) {
    vectorFrame = 0;
    vectorFinished = true;
    delete hero.dataset.glassDrawing;
  } else {
    vectorFrame = requestAnimationFrame(drawVector);
  }
}

function waitingForEntrance() {
  return ['preparing', 'loading'].includes(root.dataset.heroIntro);
}

function schedule() {
  if (running && !frame) frame = requestAnimationFrame(draw);
}

function draw(now) {
  frame = 0;
  const reduced = preference.matches;
  const fps = reduced ? 20 : 30;
  if (previous && now - previous < 1000 / fps) {
    schedule();
    return;
  }
  const elapsed = previous ? (now - previous) / 1000 : 0;
  previous = now;
  time += elapsed;
  if (needsResize) fitCanvas();
  const waiting = waitingForEntrance();
  const entrance = root.dataset.glassEntrance;
  if (entrance !== undefined) {
    const initial = root.dataset.heroIntro === 'entering' ? Number(entrance) : now;
    // Let the stroke and opacity catch up gradually after a delayed CPU frame.
    entranceClock = Math.min(now, (entranceClock ?? initial) + 90);
  }
  // Prepare the first traced frame behind the loading screen.
  const glass = waiting ? glassFrame(now, now, time, reduced)
    : glassFrame(entranceClock ?? now, entrance, time, reduced);
  smoothContact(contact, glass.trace < TRACE_COMPLETE ? inactivePointer : pointer, Math.min(elapsed, .16));
  renderGlass(glass, {
    ...contact, strength:contact.strength * (reduced ? .55 : 1),
  });
  if (canvas.hidden) {
    canvas.hidden = false;
    hero.dataset.glassCanvas = 'ready';
  }
  if (waiting) previous = 0;
  else schedule();
}

function sync() {
  if (hero.dataset.glassOwner === 'vector' && root.dataset.glassEntrance && !vectorFrame && !vectorFinished) {
    hero.dataset.glassDrawing = '';
    vectorFrame = requestAnimationFrame(drawVector);
  }
  const covered = hero.classList.contains('shader-ready') || hero.dataset.shader === 'static' || hero.dataset.glassOwner === 'vector';
  if (covered && !canvas.hidden) {
    canvas.hidden = true;
    delete hero.dataset.glassCanvas;
  }
  running = Boolean(field && visible && !document.hidden && !document.body.classList.contains('modal-open') && !covered);
  if (running) {
    schedule();
  } else {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
    pointer.active = false;
  }
}

function fitCanvas() {
  needsResize = false;
  const { clientWidth: width, clientHeight: height } = hero;
  const factor = Math.min(window.devicePixelRatio || 1, 1600 / Math.max(width,height,1),
    Math.sqrt(1_350_000 / Math.max(width*height,1)));
  const pixelWidth = Math.max(1, Math.round(width * factor));
  const pixelHeight = Math.max(1, Math.round(height * factor));
  if (renderGlass && canvas.width === pixelWidth && canvas.height === pixelHeight) return;
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  const { timing } = glassTraceLayout(hero, pixelWidth / pixelHeight);
  renderGlass = createGlassCanvas(ctx, window.ArtimanasHeroPalette.colors, field, timing);
}

if (ctx && window.ArtimanasHeroTest?.mode !== 'static') {
  try {
    field = loadGlassField();
    sync();
  } catch (error) {
    console.warn(error);
  }
}
new ResizeObserver(() => { needsResize = true; vectorLayout = undefined; schedule(); }).observe(hero);
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(hero);
const observer = new MutationObserver(sync);
observer.observe(hero, { attributes: true, attributeFilter: ['class','data-shader','data-glass-owner'] });
observer.observe(root, { attributes: true, attributeFilter: ['data-hero-intro'] });
observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
document.addEventListener('visibilitychange', sync);
preference.addEventListener('change', sync);
function move(event) {
  if (event.pointerType === 'touch' || canvas.hidden || root.dataset.heroIntro || document.body.classList.contains('modal-open')) return;
  const rect = hero.getBoundingClientRect();
  pointer.x = (event.clientX - rect.left) / rect.width;
  pointer.y = (event.clientY - rect.top) / rect.height;
  pointer.active = true;
}
hero.addEventListener('pointerenter', move, { passive:true });
hero.addEventListener('pointermove', move, { passive:true });
const release = () => { pointer.active = false; };
hero.addEventListener('pointerleave', release);
hero.addEventListener('pointercancel', release);
window.addEventListener('blur', release);
window.addEventListener('scroll', release, { passive: true });
