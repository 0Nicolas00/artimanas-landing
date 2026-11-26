// Both renderers use screen UVs with the origin at the top left.
export const designWidth = 1090;
export const designHeight = 684;
const bleed = 65;

export const DISTANCE_RANGE = .12;
export const POINTER_DISPLACEMENT = .017;
export const POINTER_FALLOFF = .031;
export const WAVE_FREQUENCY = [9.8, 12.4];
export const WAVE_AMPLITUDE = [.0088, .0102];
export const WAVE_RIPPLE = .27;
export const TRACE_FEATHER = .085;
export const TRACE_COMPLETE = 1 + TRACE_FEATHER;
const pulseRadius = .015;

export function glassCrop(aspect) {
  const width = designWidth * Math.min(1, aspect / 1.08);
  return { width, left: (designWidth - width) / 2 };
}

export function glassFieldView(aspect) {
  // Let portrait screens crop both sides without flattening the shapes.
  const { width, left } = glassCrop(aspect);
  const textureWidth = designWidth + 2 * bleed;
  const textureHeight = designHeight + 2 * bleed;
  return [
    width / textureWidth, designHeight / textureHeight,
    (bleed + left) / textureWidth, bleed / textureHeight,
  ];
}

export function glassWave(time, reducedMotion) {
  const turn = 2 * Math.PI;
  const rate = reducedMotion ? .76 : 1;
  const strength = reducedMotion ? .46 : 1;
  const phase = period => (time * rate % period) / period * turn;
  // Expand each existing contour along its normal, without shrinking thin tips.
  const pulse = pulseRadius * strength * (.5 - .5 * Math.cos(phase(5.2)));
  return [phase(8.4), phase(10.6), strength, pulse];
}

export function softStep(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

export function glassFrame(now, entranceStart, idleTime, reducedMotion) {
  if (entranceStart === undefined) {
    return { wave: glassWave(idleTime, reducedMotion), trace: TRACE_COMPLETE, stroke: 1, fill: 1, feather: 0 };
  }
  const elapsed = Math.max(0, (now - Number(entranceStart)) / 1000);
  const traceDuration = reducedMotion ? 1.85 : 2.25;
  const fillDuration = reducedMotion ? 2.55 : 3.1;
  const drawing = softStep(elapsed / traceDuration);
  const strokeFade = softStep(elapsed / .8);
  const idle = Math.max(0, elapsed - traceDuration);
  const wave = glassWave(idle, reducedMotion);
  wave[2] *= softStep(idle / .55);
  wave[3] *= softStep(idle / .55);
  return {
    wave,
    trace: TRACE_COMPLETE * drawing,
    stroke: (.40 + .60 * softStep(elapsed / fillDuration)) * strokeFade,
    fill: softStep((elapsed - .3) / (fillDuration - .3)),
    feather: (reducedMotion ? .0045 : .008) * (1 - drawing),
  };
}

export function waveOffset(position, axis, phase) {
  const spatial = WAVE_FREQUENCY[axis] * position;
  return WAVE_AMPLITUDE[axis] * (
    Math.sin(spatial - phase) + WAVE_RIPPLE * Math.sin(spatial * 1.7 + phase)
  );
}

export function smoothContact(contact, target, dt) {
  if (target.active) {
    const follow = contact.strength < .001 ? 1 : -Math.expm1(-dt / .19);
    contact.x += (target.x - contact.x) * follow;
    contact.y += (target.y - contact.y) * follow;
  }
  const ease = -Math.expm1(-dt / (target.active ? .24 : .36));
  contact.strength += (Number(target.active) - contact.strength) * ease;
}
