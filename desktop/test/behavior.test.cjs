'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createBehavior, TIMING } = require('../lib/behavior.cjs');
function fixture() {
  let now = 0, serial = 0; const timers = new Map(), changes = [];
  const behavior = createBehavior({ now: () => now, onChange: s => changes.push(s), setTimeout: (fn, ms) => { const id = ++serial; timers.set(id, {fn, at: now + ms}); return id; }, clearTimeout: id => timers.delete(id) });
  function advance(ms) { const end = now + ms; for (;;) { const next = [...timers].filter(([,t]) => t.at <= end).sort((a,b) => a[1].at - b[1].at)[0]; if (!next) break; now = next[1].at; timers.delete(next[0]); next[1].fn(); } now = end; }
  return { behavior, advance, changes, timers };
}
test('idle asks for a pat then enters a seven-second drowsy phase before sleeping', () => {
  const f = fixture(); f.advance(75000); assert.equal(f.behavior.getState().activity, 'asking');
  f.advance(18000); assert.equal(f.behavior.getState().activity, 'awake');
  f.advance(87000); assert.equal(f.behavior.getState().activity, 'drowsy');
  f.advance(7000); assert.equal(f.behavior.getState().activity, 'sleeping');
});
test('click wakes once and preserves a full ten-second waking action', () => {
  const f = fixture(); f.behavior.sleep(); f.advance(7000); f.behavior.wake(); const since = f.behavior.getState().activitySince;
  f.advance(3000); f.behavior.interact(); f.behavior.petHead(); assert.equal(f.behavior.getState().activitySince, since);
  f.advance(6999); assert.equal(f.behavior.getState().activity, 'waking'); f.advance(1); assert.equal(f.behavior.getState().activity, 'awake');
});
test('head pats lead to seven seconds of petting and 45 seconds of happy tail movement', () => {
  const f = fixture(); f.behavior.requestPat(); f.behavior.petHead(); f.advance(TIMING.pettingMs - 1); assert.equal(f.behavior.getState().activity, 'petting');
  f.advance(1); assert.equal(f.behavior.getState().activity, 'happy'); f.advance(44999); assert.equal(f.behavior.getState().activity, 'happy'); f.advance(1); assert.equal(f.behavior.getState().activity, 'awake');
});
test('status reads and movement interactions do not reset the current animation phase', () => {
  const f = fixture(); f.behavior.petHead(); const first = f.behavior.getState().activitySince; f.advance(2000); f.behavior.interact({preserveActivity:true});
  assert.equal(f.behavior.getState().activitySince, first); f.advance(5000); assert.equal(f.behavior.getState().activity, 'happy');
});
test('recent interaction postpones idle sleep rather than leaving stale timers', () => {
  const f = fixture(); f.advance(170000); f.behavior.interact(); f.advance(179999); assert.notEqual(f.behavior.getState().activity, 'drowsy'); f.advance(1); assert.equal(f.behavior.getState().activity, 'drowsy');
});
test('hidden and disposed pets never run idle actions or stale phase callbacks', () => {
  const f = fixture(); f.behavior.petHead(); f.behavior.setVisible(false); f.advance(1000000); assert.equal(f.behavior.getState().activity, 'awake'); assert.equal(f.timers.size, 0);
  f.behavior.setVisible(true); f.advance(75000); assert.equal(f.behavior.getState().activity, 'asking'); f.behavior.dispose(); f.advance(1000000); assert.equal(f.timers.size, 0);
});
test('choosing a pose resets transient actions and their completion callbacks', () => {
  const f = fixture(); f.behavior.sleep(); f.advance(3000); f.behavior.reset(); f.advance(5000); assert.equal(f.behavior.getState().activity, 'awake');
});
test('seated outfit posing lasts 22 seconds and returns to normal idle', () => {
  const f = fixture(); f.behavior.showcase(); f.advance(21999); assert.equal(f.behavior.getState().activity,'showcase'); f.advance(1); assert.equal(f.behavior.getState().activity,'awake');
});
