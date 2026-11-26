// CPU version of the glass pass for browsers without WebGL. Coordinates and
// signed distances use hero heights, as in glass-shader.js.
import { DISTANCE_RANGE, POINTER_DISPLACEMENT, POINTER_FALLOFF, TRACE_COMPLETE, TRACE_FEATHER, glassFieldView, softStep, waveOffset } from './glass-motion.mjs';
import { TRACE_SAMPLES } from './glass-trace.mjs';

const clamp = (x, low, high) => Math.min(high, Math.max(low, x));
const rampSize = 1024;
const middleStop = .52;

function makeColorRamp(colors) {
  const stops = colors.map(color => {
    const rgb = Number.parseInt(color.slice(1), 16);
    return [rgb >> 16, (rgb >> 8) & 255, rgb & 255];
  });
  const ramp = new Float32Array(rampSize * 3);
  for (let i = 0; i < rampSize; i++) {
    const position = i / (rampSize - 1);
    const left = position <= middleStop ? 0 : 1;
    const mix = left ? (position - middleStop) / (1 - middleStop) : position / middleStop;
    for (let channel = 0; channel < 3; channel++) {
      const start = stops[left][channel];
      ramp[i * 3 + channel] = start + (stops[left + 1][channel] - start) * mix;
    }
  }
  return ramp;
}

export function createGlassCanvas(ctx, colors, field, timing) {
  const {width, height} = ctx.canvas;
  const aspect = width / height;
  const distances = new Float32Array(width * height);
  const outlineTimes = new Float32Array(width * height);
  const [viewWidth, viewHeight, viewLeft, viewTop] = glassFieldView(aspect);
  const fieldDistances = new Float32Array(field.width * field.height);
  const fieldTimes = new Uint8Array(fieldDistances.length);
  for (let i = 0; i < fieldDistances.length; i++) {
    const sample = field.data[i * 4] * 16 + field.data[i * 4 + 1] / 17;
    fieldDistances[i] = (2 * sample / 4095 - 1) * DISTANCE_RANGE;
    fieldTimes[i] = timing[field.data[i * 4 + 3] * TRACE_SAMPLES + field.data[i * 4 + 2]];
  }
  const wavesY = new Float32Array(width);
  const pixels = ctx.createImageData(width, height);
  const tint = makeColorRamp(colors);
  const angle = 130 * Math.PI / 180;
  const dx = Math.sin(angle), dy = -Math.cos(angle);
  const span = dx*width + dy*height;
  const rampIndex = t => 3 * Math.round(clamp(t, 0, 1) * (rampSize - 1));

  return function render({ wave: [phaseX, phaseY, waveStrength, pulse], trace, stroke, fill, feather }, cursor) {
    const tracing = trace < TRACE_COMPLETE;
    const edgeLimit = 2 / height + feather;
    for (let x = 0; x < width; x++) {
      const u = (x + .5) / width;
      wavesY[x] = waveStrength * waveOffset(u, 1, phaseY);
    }
    for (let y = 0; y < height; y++) {
      const v = (y + .5) / height;
      const waveX = waveStrength * waveOffset(v, 0, phaseX);
      const relativeY = v - cursor.y;
      for (let x = 0; x < width; x++) {
        const u = (x + .5) / width;
        const relativeX = (u - cursor.x) * aspect;
        const radius2 = relativeX * relativeX + relativeY * relativeY;
        const pressure = cursor.strength > .001 && radius2 < .18
          ? POINTER_DISPLACEMENT * cursor.strength * Math.exp(-radius2 / POINTER_FALLOFF) / Math.max(.055, Math.sqrt(radius2))
          : 0;
        const warpedX = u + (waveX - pressure * relativeX) / aspect;
        const warpedY = v + wavesY[x] - pressure * relativeY;
        const fieldX = (warpedX * viewWidth + viewLeft) * field.width - .5;
        const fieldY = (warpedY * viewHeight + viewTop) * field.height - .5;
        const left = Math.floor(fieldX), top = Math.floor(fieldY);
        const wx = fieldX - left, wy = fieldY - top;
        const index = top * field.width + left;
        const valueTop = (1 - wx) * fieldDistances[index] + wx * fieldDistances[index + 1];
        const below = index + field.width;
        const valueBottom = (1 - wx) * fieldDistances[below] + wx * fieldDistances[below + 1];
        const d = (1 - wy) * valueTop + wy * valueBottom - pulse;
        const pixel = y * width + x;
        distances[pixel] = d;
        if (tracing && d > -.036 && d < edgeLimit) {
          const upper = (1 - wx) * fieldTimes[index] + wx * fieldTimes[index + 1];
          const lower = (1 - wx) * fieldTimes[below] + wx * fieldTimes[below + 1];
          outlineTimes[pixel] = ((1 - wy) * upper + wy * lower) / 255;
        }
      }
    }

    const dst=pixels.data;
    dst.fill(0);
    const softHighlight=1/(1+feather*95);
    for (let y=0; y<height; y++) {
      for (let x=0; x<width; x++) {
        const i=y*width+x, d=distances[i];
        if (d>edgeLimit) continue;
        const t=(x*dx+y*dy)/span;
        if (d<-.074) {
          const center=rampIndex(t);
          const pixel=i*4;
          dst[pixel]=tint[center];
          dst[pixel+1]=tint[center+1];
          dst[pixel+2]=tint[center+2];
          dst[pixel+3]=255*fill;
          continue;
        }
        const left=x>0?-1:0, right=x<width-1?1:0;
        const top=y>0?-width:0, bottom=y<height-1?width:0;
        // Sobel normals average neighbouring slopes before lighting the narrow rim.
        const gx=(2*(distances[i+right]-distances[i+left])
          +distances[i+top+right]-distances[i+top+left]
          +distances[i+bottom+right]-distances[i+bottom+left])*.25;
        const gy=(2*(distances[i+bottom]-distances[i+top])
          +distances[i+left+bottom]-distances[i+left+top]
          +distances[i+right+bottom]-distances[i+right+top])*.25;
        const length=Math.max(.000001,Math.sqrt(gx*gx+gy*gy));
        const slope=length*height*.5;
        const tSlope=clamp((slope-.07)/.39,0,1);
        const confidence=tSlope*tSlope*(3-2*tSlope);
        const divisor=Math.max(length,.48/height);
        const nx=gx/divisor, ny=gy/divisor;
        const rim=confidence*Math.exp(Math.min(0,d)*41);
        const projected=(nx*dx+ny*dy)*height/span;
        const refracted=t-projected*(.006+.046*rim*rim);
        const low=rampIndex(refracted-.014), high=rampIndex(refracted+.014);
        const light=rampIndex(t+projected*.08);
        const glint=Math.abs(.61*nx+.79*ny)**4;
        // Integrate the highlight over a pixel so a fine rim doesn't blink as it moves.
        const pixelVariance=(gx*gx+gy*gy)*.25+feather*feather*.5;
        const fine=Math.exp(-((d+.0027)**2/(.0024**2+pixelVariance)));
        const bevel=Math.exp(-((d+.009)**2/(.0056**2+pixelVariance)));
        const broad=Math.exp(-Math.abs(d+.014)*130);
        const revealed=tracing&&d>-.036 ? softStep(.5+(trace-outlineTimes[i])/(2*TRACE_FEATHER)) : 1;
        const white=confidence*softHighlight*revealed*(fine*(96+148*glint)+bevel*(16+96*glint));
        for (let k=0; k<3; k++) {
          const base=(tint[low+k]+tint[high+k])*.5;
          dst[i*4+k]=base*(1-.43*rim*rim)+white+confidence*broad*(.10+.18*glint)*tint[light+k];
        }
        const coverage=clamp(.5-d/(Math.max(1/height,.85*(Math.abs(gx)+Math.abs(gy)))+2*feather),0,1);
        const opacity=fill<1 ? fill+(1-fill)*stroke*revealed*(1-softStep(Math.abs(d)/.025)) : 1;
        dst[i*4+3]=255*coverage*coverage*(3-2*coverage)*opacity;
      }
    }
    ctx.putImageData(pixels,0,0);
  };
}
