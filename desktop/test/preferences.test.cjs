'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePreferences, fitWindow, WINDOW_SIZES } = require('../lib/preferences.cjs');
const { windowsShortcutOptions, quoteDesktopExec } = require('../lib/shortcuts.cjs');

test('invalid saved values cannot create invalid windows or unrecognized poses', () => {
  const value = normalizePreferences({ pose: '<script>', size: '__proto__', position: { x: NaN, y: 1 } });
  assert.equal(value.pose, 'sitting');
  assert.equal(value.size, 'medium');
  assert.equal(value.position, null);
  assert.equal(normalizePreferences({ size: ['small'] }).size, 'medium');
});

test('new installs use sitting pose while an existing standing preference survives', () => {
  assert.equal(normalizePreferences({}).pose, 'sitting');
  assert.equal(normalizePreferences({ pose: 'standing' }).pose, 'standing');
});

test('quiet and position lock are opt-in and survive saved preferences with strict booleans', () => {
  for (const input of [undefined, {}, { quietMode: 'false', lockPosition: 'true' }, { quietMode: 1, lockPosition: [] }]) {
    const value = normalizePreferences(input);
    assert.equal(value.quietMode, false); assert.equal(value.lockPosition, false);
  }
  const saved = JSON.parse(JSON.stringify(normalizePreferences({ quietMode: true, lockPosition: true })));
  assert.equal(normalizePreferences(saved).quietMode, true);
  assert.equal(normalizePreferences(saved).lockPosition, true);
});

test('clearing a saved position recovers the pet to the primary work area with a visible margin', () => {
  const primary = { x: 100, y: 50, width: 1280, height: 720 };
  const secondary = { x: -1920, y: 0, width: 1920, height: 1080 };
  const bounds = fitWindow(WINDOW_SIZES.medium, null, [primary, secondary]);
  assert.deepEqual(bounds, { x: 1056, y: 266, width: 300, height: 480 });
});

test('restored pet remains visible after its monitor is disconnected', () => {
  const area = { x: 0, y: 0, width: 1280, height: 720 };
  const bounds = fitWindow(WINDOW_SIZES.large, { x: 2900, y: 1700 }, [area]);
  assert.equal(bounds.x + bounds.width, 1280);
  assert.equal(bounds.y + bounds.height, 720);
});

test('negative coordinates on an attached left-hand monitor are preserved', () => {
  const areas = [{ x: 0, y: 0, width: 1920, height: 1080 }, { x: -1920, y: 0, width: 1920, height: 1080 }];
  const bounds = fitWindow(WINDOW_SIZES.medium, { x: -1000, y: 200 }, areas);
  assert.equal(bounds.x, -1000);
  assert.equal(bounds.y, 200);
});

test('oversized pet shrinks to fit an unusually small work area', () => {
  const bounds = fitWindow(WINDOW_SIZES.large, null, [{ x: 0, y: 0, width: 250, height: 350 }]);
  assert.deepEqual(bounds, { x: 0, y: 0, width: 250, height: 350 });
});

test('Windows installed shortcuts launch the executable without a development path', () => {
  const value = windowsShortcutOptions({ executable: 'C:\\Program Files\\Dragon\\Dragon.exe', appDirectory: 'C:\\source\\dragon', packaged: true, icon: 'icon.png' });
  assert.equal(value.target, 'C:\\Program Files\\Dragon\\Dragon.exe');
  assert.equal(value.args, '');
  assert.equal(value.cwd, 'C:\\Program Files\\Dragon');
  assert.equal(value.icon, value.target);
  assert.equal(value.appUserModelId, 'com.rudong1.dragonpet');
});

test('Linux desktop paths escape percent field codes and shell-sensitive characters', () => {
  assert.equal(quoteDesktopExec('/home/User A/100%/$Dragon'), '"/home/User A/100%%/\\$Dragon"');
});
