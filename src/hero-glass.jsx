import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, DataTexture, LinearFilter, Mesh, OrthographicCamera, PlaneGeometry, RedFormat, Scene, ShaderMaterial, Vector2, Vector3, Vector4, WebGLRenderTarget, HalfFloatType, UnsignedByteType } from 'three';
import { TRACE_COMPLETE, glassFieldView, glassFrame, smoothContact, softStep } from './glass-motion.mjs';
import { loadGlassField } from './glass-field.js';
import { TRACE_SAMPLES, glassTraceLayout } from './glass-trace.mjs';
import { vertexShader, fragmentShader } from './glass-shader.js';

const inactivePointer = { active: false };

export default function ProceduralGlass({ grain = true, onError }) {
  const { gl, size } = useThree();
  const clock = useRef(0);
  const reducedMotion = useRef(false);
  const pointer = useRef({ x: 0, y: 0, active: false });
  const contact = useRef({x:0, y:0, strength:0, active:false});
  const pass = useMemo(() => {
    const target = new WebGLRenderTarget(1, 1, { type: gl.extensions.has('EXT_color_buffer_float') ? HalfFloatType : UnsignedByteType });
    const field = new DataTexture(new Uint8Array([255, 255, 0, 255]), 1, 1);
    const timing = new DataTexture(new Uint8Array(TRACE_SAMPLES), TRACE_SAMPLES, 1, RedFormat);
    timing.minFilter = timing.magFilter = LinearFilter;
    field.minFilter = field.magFilter = LinearFilter;
    field.needsUpdate = true;
    const uniforms = {
      uBackground: { value: target.texture },
      uResolution: { value: new Vector2(1, 1) },
      uField: { value: field },
      uFieldView: { value: new Vector4() },
      uWave: { value: new Vector4() },
      uGlassFill: { value: 1 },
      uGlassTrace: { value: new Vector3(TRACE_COMPLETE, 1, 0) },
      uTraceTiming: { value: timing },
      uTraceRows: { value: 1 },
      uPointer: { value: new Vector3() },
      uGrainStrength: { value: grain ? .246 : 0 },
      uGrainMix: { value: 0 },
      // Match the CSS plane in display space, after the gradient's tone mapping.
      uIntroPlane: { value: new Color(window.ArtimanasHeroPalette.loading).convertLinearToSRGB() },
      uBackgroundMix: { value: 0 },
    };
    const material = new ShaderMaterial({ uniforms, vertexShader, fragmentShader, depthTest: false, depthWrite: false });
    const geometry = new PlaneGeometry(2, 2);
    const scene = new Scene();
    scene.add(new Mesh(geometry, material));
    return { target, field, timing, uniforms, material, geometry, scene, camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  }, [gl, grain]);

  useEffect(() => {
    const pixels = gl.getDrawingBufferSize(new Vector2());
    pass.target.setSize(pixels.x, pixels.y);
    pass.uniforms.uResolution.value.copy(pixels);
    const aspect = pixels.x / Math.max(1, pixels.y);
    pass.uniforms.uFieldView.value.set(...glassFieldView(aspect));
    const { runs, timing } = glassTraceLayout(document.querySelector('.hero'), aspect);
    pass.timing.image = { data: timing, width: TRACE_SAMPLES, height: runs.length };
    pass.timing.needsUpdate = true;
    pass.uniforms.uTraceRows.value = runs.length;
  }, [gl, size, pass]);

  useEffect(() => {
    try {
      pass.field.image = loadGlassField();
      pass.field.needsUpdate = true;
      pass.fieldLoaded = true;
    } catch {
      onError('glass-data');
    }
  }, [pass, onError]);

  useEffect(() => {
    const hero = document.querySelector('.hero');
    const preference = matchMedia('(prefers-reduced-motion:reduce)');
    const sync = () => { reducedMotion.current = preference.matches; };
    sync(); preference.addEventListener('change', sync);
    function move(event) {
      if (event.pointerType === 'touch' || document.documentElement.dataset.heroIntro || document.body.classList.contains('modal-open')) return;
      const rect = hero.getBoundingClientRect();
      pointer.current.x = (event.clientX-rect.left)/rect.width;
      pointer.current.y = (event.clientY-rect.top)/rect.height;
      pointer.current.active = true;
    }
    const pause = () => { pointer.current.active = false; };
    const observe = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) pause(); });
    observe.observe(hero);
    const modal = new MutationObserver(() => { if (document.body.classList.contains('modal-open')) pause(); });
    modal.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const events = { pointerenter: move, pointermove: move, pointerleave: pause, pointercancel: pause };
    for (const [name, handler] of Object.entries(events)) hero.addEventListener(name, handler, { passive: true });
    window.addEventListener('scroll', pause, { passive: true });
    window.addEventListener('resize', pause);
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', pause);
    return () => {
      pause(); observe.disconnect(); modal.disconnect();
      preference.removeEventListener('change', sync);
      for (const [name, handler] of Object.entries(events)) hero.removeEventListener(name, handler);
      window.removeEventListener('blur', pause);
      window.removeEventListener('scroll', pause);
      window.removeEventListener('resize', pause);
      document.removeEventListener('visibilitychange', pause);
      delete hero.dataset.glass;
    };
  }, []);

  // Prioridad positiva: un único render del fondo y un pase de cristal en el mismo canvas.
  useFrame(({ scene, camera }, delta) => {
    if (!pass.fieldLoaded) return;
    const dt = Math.min(delta, .16);
    const reduced = reducedMotion.current;
    clock.current += delta;
    const time = clock.current;
    const { glassEntrance: entranceStart, heroIntro: phase } = document.documentElement.dataset;
    const now = performance.now();
    const waiting = phase === 'preparing' || phase === 'loading';
    const { wave, trace, stroke, fill, feather } = glassFrame(now, waiting ? now : entranceStart, time, reduced);
    smoothContact(contact.current, trace < TRACE_COMPLETE ? inactivePointer : pointer.current, dt);
    pass.uniforms.uWave.value.set(...wave);
    pass.uniforms.uGlassFill.value = fill;
    pass.uniforms.uGlassTrace.value.set(trace, stroke, feather);
    pass.uniforms.uPointer.value.set(contact.current.x, contact.current.y, contact.current.strength * (reduced ? .55 : 1));
    // Match the background texture's crossfade in hero-effects.css.
    const grainPeriod = reduced ? 6.6 : 4.4;
    const grainMix = .5 - .5 * Math.cos(time * 2 * Math.PI / grainPeriod);
    pass.uniforms.uGrainMix.value = grainMix * (reduced ? .4 : 1);
    const revealMs = waiting ? 0 : entranceStart === undefined ? Infinity : now - Number(entranceStart);
    const grainFade = softStep(revealMs / 1250);
    pass.uniforms.uGrainStrength.value = grain ? .246 * grainFade : 0;
    pass.uniforms.uBackgroundMix.value = softStep(revealMs / 1350);
    const previous = gl.getRenderTarget();
    try {
      gl.setRenderTarget(pass.target);
      gl.clear(); gl.render(scene, camera);
      gl.setRenderTarget(previous);
      pass.material.uniformsNeedUpdate = true;
      gl.render(pass.scene, pass.camera);
      if (!pass.painted) {
        pass.painted = true;
        gl.domElement.closest('.hero').dataset.glass = 'brand-contours';
      }
    } finally { gl.setRenderTarget(previous); }
  }, 1);

  useEffect(() => () => {
    pass.target.dispose(); pass.field.dispose(); pass.timing.dispose(); pass.geometry.dispose(); pass.material.dispose();
  }, [pass]);
  return null;
}
