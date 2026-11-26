const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');

(async () => {
  const { TRACE_COMPLETE, glassFieldView, glassFrame, glassWave, smoothContact, waveOffset } = await import('../src/glass-motion.mjs');
  const { glassTraceLayout, traceDashes } = await import('../src/glass-trace.mjs');
  const desktop = glassFieldView(1440 / 810);
  const mobile = glassFieldView(390 / 900);
  assert(mobile[0] < desktop[0] && mobile[2] > desktop[2], 'Portrait crops into the same artwork');
  assert.equal(mobile[1], desktop[1], 'The vertical composition does not shift');
  assert.equal(mobile[3], desktop[3]);
  assert(glassFieldView(1440 / 810).every((value, index) => value === desktop[index]));

  const offsets = (time, reduced, u, v) => {
    const [phaseX, phaseY, strength] = glassWave(time, reduced);
    return [waveOffset(v, 0, phaseX) * strength, waveOffset(u, 1, phaseY) * strength];
  };
  for (let time = 0; time < 30; time += .17) {
    for (let position = 0; position <= 1; position += .05) {
      assert(Math.hypot(...offsets(time, false, position, position)) < .018, 'The shapes stay anchored within 18px per 1000px');
      assert(Math.hypot(...offsets(time, true, position, position)) < .009, 'Reduced motion softens the wave');
    }
  }
  const change = u => offsets(3, false, u, .5)[1] - offsets(0, false, u, .5)[1];
  assert(change(.05) < -.01 && change(.365) > .01, 'The idle wave visibly flexes different parts in opposite directions');
  for (const [reduced, peakTime] of [[false, 2.6], [true, 2.6 / .76]]) {
    const pulse = time => glassWave(time, reduced)[3];
    const peak = pulse(peakTime);
    assert.equal(pulse(0), 0);
    assert(peak > .006 && peak <= .015, 'Breathing gently expands existing rims even with reduced motion');
    assert(pulse(peakTime * .5) > 0 && pulse(peakTime * .5) < peak);
    assert(pulse(peakTime * 2) < .0001, 'The glass returns smoothly to its baseline');
  }
  for (const reduced of [false, true]) {
    const start = '5000';
    const first = glassFrame(5000, start, 0, reduced);
    const early = glassFrame(5200, start, 0, reduced);
    const middle = glassFrame(6000, start, 0, reduced);
    const closed = glassFrame(7300, start, 0, reduced);
    const complete = glassFrame(8200, start, 0, reduced);
    assert.equal(first.trace, 0);
    assert.equal(first.stroke, 0);
    assert(early.trace > 0 && early.trace < middle.trace && middle.trace < closed.trace);
    assert(early.stroke > 0 && early.stroke < .08 && early.stroke < middle.stroke, 'The first traces fade in without a jump');
    assert.equal(first.fill, 0);
    assert(middle.fill > first.fill && middle.fill < closed.fill && closed.fill < 1, 'The glass keeps gaining opacity after closure');
    assert.equal(middle.wave[2], 0, 'The shape stays in place while its contour is drawn');
    assert.equal(closed.trace, TRACE_COMPLETE);
    assert.equal(complete.fill, 1);
    assert(first.feather > middle.feather && middle.feather > complete.feather);
    assert.deepEqual(middle, glassFrame(6000, start, 30, reduced), 'Switching renderers does not restart the glass entrance');
    assert.deepEqual(glassFrame(8200, undefined, 0, reduced), { wave: glassWave(0, reduced), trace: TRACE_COMPLETE, stroke: 1, fill: 1, feather: 0 });
  }
  const shape = {
    getTotalLength: () => 1,
    getPointAtLength: t => ({ x: 550, y: 50 - 400 * (t - .5) ** 2 }),
  };
  const { timing, runs } = glassTraceLayout({ querySelectorAll: () => [shape] }, 1);
  assert.equal(runs[0].length, 1);
  const [from, to] = runs[0][0];
  assert(timing[Math.ceil(from * 255)] < 8 && timing[Math.floor(to * 255)] < 8, 'Both visible ends start early');
  assert(timing[Math.round((from + to) / 2 * 255)] > 245, 'The two strokes meet in the middle');
  const dash = traceDashes(runs[0], .5).split(' ').map(Number);
  assert(Math.abs(dash[2] - dash[4]) < .000001 && dash[3] > dash[2], 'Equal strokes preserve an open center while drawing');
  const contact = { x: .5, y: .5, strength: 0 };
  const target = { active: true, x: .24, y: .64 };
  smoothContact(contact, target, 1 / 60);
  assert(contact.strength > 0 && contact.strength < .1, 'Pointer deformation starts smoothly');
  for (let i = 0; i < 90; i++) smoothContact(contact, target, 1 / 60);
  assert(contact.strength > .98);
  target.active = false;
  for (let i = 0; i < 120; i++) smoothContact(contact, target, 1 / 60);
  assert(contact.strength < .01, 'Contour relaxes after pointer exit');

  const src = path.resolve(__dirname, '../src');
  const contours = fs.readFileSync(path.join(src, 'brand-contours.svg'), 'utf8');
  assert.equal((contours.match(/<path /g) || []).length, 5);
  const texture = fs.readFileSync(path.join(src, 'brand-glass-field.gz'));
  const unpacked = gunzipSync(texture);
  assert.equal(unpacked.readUInt16LE(0), 1220);
  assert.equal(unpacked.readUInt16LE(2), 814);
  assert.equal(unpacked.length, 4 + 4 * 1220 * 814);
  assert(texture.length < 340 * 1024);
  console.log('Contornos anclados, recorte móvil, deformación leve y mapa de marca verificados.');
})().catch(error => { console.error(error); process.exitCode = 1; });
