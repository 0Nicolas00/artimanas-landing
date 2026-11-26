import { designHeight, glassCrop } from './glass-motion.mjs';

export const TRACE_SAMPLES = 256;

function visibleRuns(path, aspect) {
  const { width, left } = glassCrop(aspect);
  const length = path.getTotalLength();
  const inside = phase => {
    const { x, y } = path.getPointAtLength(phase * length);
    return x >= left && x <= left + width && y >= 0 && y <= designHeight;
  };
  const runs = [];
  let open = inside(0);
  let start = 0;
  for (let i = 1; i <= TRACE_SAMPLES; i++) {
    const phase = i / TRACE_SAMPLES;
    const visible = inside(phase);
    if (visible === open) continue;
    // Refine the cut so both tips start at the visible edge on any aspect ratio.
    let low = (i - 1) / TRACE_SAMPLES;
    let high = phase;
    for (let n = 0; n < 6; n++) {
      const middle = (low + high) / 2;
      if (inside(middle) === open) low = middle;
      else high = middle;
    }
    const cut = (low + high) / 2;
    if (visible) start = cut;
    else runs.push([start, cut]);
    open = visible;
  }
  if (open) runs.push([start, 1]);
  // A path's parameter can wrap across its SVG move-to point.
  if (runs.length > 1 && runs[0][0] === 0 && runs.at(-1)[1] === 1) {
    const [, end] = runs.shift();
    runs.at(-1)[1] = end + 1;
  }
  return runs;
}

export function glassTraceLayout(hero, aspect) {
  const paths = [...hero.querySelectorAll('.glass-static defs path')];
  const runs = paths.map(path => visibleRuns(path, aspect));
  const timing = new Uint8Array(TRACE_SAMPLES * runs.length);
  runs.forEach((segments, row) => {
    for (const [start, end] of segments) {
      for (let i = Math.ceil(start * 255); i <= Math.floor(end * 255); i++) {
        const fraction = (i / 255 - start) / (end - start);
        timing[row * TRACE_SAMPLES + i % 255] = Math.round(255 * (1 - Math.abs(2 * fraction - 1)));
      }
    }
    timing[row * TRACE_SAMPLES + 255] = timing[row * TRACE_SAMPLES];
  });
  return { runs, timing };
}

export function traceDashes(runs, progress) {
  const segments = [];
  for (const [start, end] of runs) {
    const advance = (end - start) * progress / 2;
    for (const [from, to] of [[start, start + advance], [end - advance, end]]) {
      if (from >= 1) segments.push([from - 1, to - 1]);
      else if (to > 1) segments.push([from, 1], [0, to - 1]);
      else segments.push([from, to]);
    }
  }
  let previous = 0;
  const dashes = [0];
  for (const [start, end] of segments.sort(([a], [b]) => a - b)) {
    dashes.push(start - previous, end - start);
    previous = end;
  }
  return dashes.concat(1).join(' ');
}
