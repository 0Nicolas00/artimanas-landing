import React, { Component, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useFrame, useStore, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import ProceduralGlass from './hero-glass.jsx';
import HeroBackground, { PALETTES, SHADER_SETTINGS } from '../Hero.jsx';

const hero = document.querySelector('.hero');
const host = document.querySelector('#hero-shader');
// Enable in index.html and reload the page.
const pointerFollowEnabled = hero?.dataset.pointerFollow === 'true';
const comparison = window.ArtimanasHeroTest;
const staticBackground = comparison?.mode === 'static';
if (hero && staticBackground) {
  hero.dataset.shader = 'static';
  hero.dataset.shaderMotion = 'paused';
}
let root;
let failed = false;
let ready = false;
let loadingTimer;

function entranceUsesBackup() {
  return ['canvas', 'vector'].includes(hero.dataset.glassOwner);
}

function fallback(reason) {
  if (failed) return;
  failed = true;
  clearTimeout(loadingTimer);
  hero.classList.remove('shader-ready');
  hero.dataset.shader = 'fallback';
  hero.dataset.shaderMotion = 'paused';
  hero.dataset.shaderFallback = reason;
  queueMicrotask(() => root?.unmount());
}

function activate() {
  if (ready || failed) return;
  ready = true;
  clearTimeout(loadingTimer);
  hero.dataset.shader = 'ready';
  hero.classList.add('shader-ready');
}

class BackgroundBoundary extends Component {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch() { fallback('render-error'); }
  render() { return this.state.error ? null : this.props.children; }
}

// Screen-relative drag applied to the actual shader mesh, not the HTML/canvas layer.
const POINTER_MOTION = { response: 0.28, inertia: 1.1, amount: 0.005, pull: 0.005 };
function ShaderPointerMotion() {
  const { scene, camera } = useThree();
  const mesh = useRef(null);
  const motion = useRef({ targetX: 0, targetY: 0, x: 0, y: 0, trailX: 0, trailY: 0 });
  const base = useRef(new Vector3(SHADER_SETTINGS.positionX, SHADER_SETTINGS.positionY, SHADER_SETTINGS.positionZ));
  const offset = useRef(new Vector3());
  useEffect(() => {
    const finePointer = matchMedia('(hover:hover) and (pointer:fine)');
    let lastPoint = null;
    const center = () => { lastPoint = null; motion.current.targetX = motion.current.targetY = 0; };
    const update = () => {
      if (!lastPoint || !finePointer.matches || !ready || failed) return center();
      const rect = hero.getBoundingClientRect();
      const { x, y } = lastPoint;
      if (!rect.width || !rect.height || x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return center();
      motion.current.targetX = Math.max(-1, Math.min(1, (x - rect.left) / rect.width * 2 - 1));
      motion.current.targetY = Math.max(-1, Math.min(1, (y - rect.top) / rect.height * 2 - 1));
    };
    const move = event => {
      if (event.pointerType !== 'mouse') return;
      lastPoint = { x: event.clientX, y: event.clientY }; update();
    };
    const touch = event => { if (event.pointerType !== 'mouse') center(); };
    hero.addEventListener('pointermove', move, { passive: true });
    hero.addEventListener('pointerleave', center);
    hero.addEventListener('pointerdown', touch, { passive: true });
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', center, { passive: true });
    window.addEventListener('blur', center);
    document.addEventListener('visibilitychange', center);
    finePointer.addEventListener('change', center);
    return () => {
      hero.removeEventListener('pointermove', move);
      hero.removeEventListener('pointerleave', center);
      hero.removeEventListener('pointerdown', touch);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', center);
      window.removeEventListener('blur', center);
      document.removeEventListener('visibilitychange', center);
      finePointer.removeEventListener('change', center);
    };
  }, []);
  useFrame((_, delta) => {
    if (!ready || failed) return;
    mesh.current ??= scene.getObjectByName('shadergradient-mesh');
    if (!mesh.current) return;
    const state = motion.current, dt = Math.min(delta, 0.25);
    const ease = 1 - Math.exp(-dt / POINTER_MOTION.response);
    const slow = 1 - Math.exp(-dt / POINTER_MOTION.inertia);
    state.x += (state.targetX - state.x) * ease;
    state.y += (state.targetY - state.y) * ease;
    state.trailX += (state.x - state.trailX) * slow;
    state.trailY += (state.y - state.trailY) * slow;
    const x = state.x * POINTER_MOTION.amount + (state.x - state.trailX) * POINTER_MOTION.pull;
    const y = state.y * POINTER_MOTION.amount + (state.y - state.trailY) * POINTER_MOTION.pull;
    // Projection includes cameraZoom (15.1 in the reference); keep drag at a few
    // percent of the visible image rather than magnifying it with the camera.
    offset.current.copy(base.current).applyMatrix4(camera.matrixWorldInverse);
    const depth = camera.isPerspectiveCamera ? Math.abs(offset.current.z) : 1;
    const width = 2 * depth / camera.projectionMatrix.elements[0];
    const height = 2 * depth / camera.projectionMatrix.elements[5];
    // Camera orientation is preserved: screen X/Y work even with polar angle 180°.
    offset.current.set(x * width, -y * height, 0).applyQuaternion(camera.quaternion);
    mesh.current.position.copy(base.current).add(offset.current);
  });
  return null;
}

function RendererLifecycle() {
  const { gl, scene, setFrameloop, invalidate } = useThree();
  const store = useStore();
  const renderedFrames = useRef(0);
  useFrame(() => {
    if (ready || failed || entranceUsesBackup() || !scene.environment || hero.dataset.glass !== 'brand-contours') return;
    let mesh = false;
    scene.traverse(object => { if (object.isMesh && object.visible) mesh = true; });
    if (!mesh || gl.info.render.calls === 0) return;
    if (gl.info.programs?.some(program => program.diagnostics?.runnable === false)) {
      fallback('shader-compile');
      return;
    }
    // Reveal after geometry, HDR environment and actual GPU draws are ready.
    if (++renderedFrames.current >= 2) activate();
  });
  useEffect(() => {
    let visible = hero.getBoundingClientRect().bottom > 0;
    const sync = () => {
      if (entranceUsesBackup()) return fallback('entrance-renderer');
      const running = visible && !document.hidden && !document.body.classList.contains('modal-open');
      const frameloop = running ? 'always' : 'never';
      if (store.getState().frameloop !== frameloop) {
        setFrameloop(frameloop);
        if (running) invalidate();
      }
      hero.dataset.shaderMotion = running ? 'running' : 'paused';
    };
    // Canvas reconfigures on scroll/resize and can restore its default "always".
    // Keep the visibility policy authoritative even after that reconfiguration.
    const unsubscribe = store.subscribe((state, previous) => {
      if (state.frameloop !== previous.frameloop) sync();
    });
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(hero);
    const mutations = new MutationObserver(sync);
    mutations.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    mutations.observe(hero, { attributes: true, attributeFilter: ['data-glass-owner'] });
    const lost = event => { event.preventDefault(); fallback('context-lost'); };
    gl.domElement.addEventListener('webglcontextlost', lost);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      unsubscribe();
      observer.disconnect(); mutations.disconnect();
      gl.domElement.removeEventListener('webglcontextlost', lost);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [gl, store, setFrameloop, invalidate]);
  return null;
}

if (hero && host && !staticBackground && !entranceUsesBackup()) {
  // The inline head bootstrap owns the only random choice for this page load.
  const index = window.ArtimanasHeroPalette?.index ?? 0;
  hero.dataset.shaderPalette = String(index);
  hero.dataset.shaderColors = PALETTES[index].colors.join(',');
  try {
    const probe = document.createElement('canvas');
    const context = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!context) fallback('webgl-unavailable');
    else {
      context.getExtension('WEBGL_lose_context')?.loseContext();
      hero.dataset.shader = 'loading';
      const checkLoading = () => {
        if (ready || failed) return;
        const rect = hero.getBoundingClientRect();
        if (document.hidden || rect.bottom <= 0 || rect.top >= innerHeight) {
          loadingTimer = setTimeout(checkLoading, 30000);
        } else fallback('load-timeout');
      };
      loadingTimer = setTimeout(checkLoading, 30000);
      root = createRoot(host);
      root.render(
        <BackgroundBoundary>
          <HeroBackground palette={PALETTES[index]} pixelDensity={comparison?.pixelDensity}>
            <RendererLifecycle />
            <ProceduralGlass grain={comparison?.grain !== 'off'} onError={fallback} />
            {pointerFollowEnabled && <ShaderPointerMotion />}
          </HeroBackground>
        </BackgroundBoundary>
      );
    }
  } catch { fallback('webgl-unavailable'); }
}
