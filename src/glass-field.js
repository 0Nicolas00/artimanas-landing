import { gunzipSync } from 'fflate';
import packedField from './brand-glass-field.gz';

export function loadGlassField() {
  // Decode bundled bytes without loading an image or reading pixels from a canvas.
  const field = gunzipSync(packedField);
  const header = new DataView(field.buffer, field.byteOffset, field.byteLength);
  const width = header.getUint16(0, true);
  const height = header.getUint16(2, true);
  const length = width * height;
  if (!length || field.length !== 4 + 4 * length) throw new Error('Mapa de cristal inválido.');

  const data = new Uint8Array(4 * length);
  for (let y = 0; y < height; y++) {
    let red = 0, green = 0, arc = 0, shape = 0;
    const line = y * width;
    for (let x = 0; x < width; x++) {
      const i = line + x;
      red = (red + field[4 + i]) & 255;
      green = (green + field[4 + length + i]) & 255;
      arc = (arc + field[4 + 2 * length + i]) & 255;
      shape = (shape + field[4 + 3 * length + i]) & 255;
      data[4 * i] = red;
      data[4 * i + 1] = green;
      data[4 * i + 2] = arc;
      data[4 * i + 3] = shape;
    }
  }
  return { data, width, height };
}
