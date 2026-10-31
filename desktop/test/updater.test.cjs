'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createUpdater, STARTUP_DELAY_MS, CHECK_INTERVAL_MS } = require('../updater.cjs');

function fixture(options = {}) {
  const app = Object.assign(new EventEmitter(), { isPackaged: true, getVersion: () => '0.1.0' });
  const updater = Object.assign(new EventEmitter(), {
    checkCalls: 0,
    installCalls: [],
    checkForUpdates() { this.checkCalls++; return Promise.resolve({ updateInfo: { version: '0.2.0' } }); },
    quitAndInstall(...args) { this.installCalls.push(args); },
  });
  const timeouts = new Map();
  const intervals = new Map();
  const history = [];
  let serial = 0;
  const api = createUpdater({
    app, updater, platform: 'win32', onStatus: state => history.push(state),
    setTimeout: (fn, delay) => { const key = ++serial; timeouts.set(key, { fn, delay }); return key; },
    clearTimeout: key => timeouts.delete(key),
    setInterval: (fn, delay) => { const key = ++serial; intervals.set(key, { fn, delay }); return key; },
    clearInterval: key => intervals.delete(key),
    ...options,
  });
  return { api, app, updater, timeouts, intervals, history };
}

test('development mode never loads updater or schedules network checks', async () => {
  const f = fixture({ app: { isPackaged: false, getVersion: () => '0.1.0' }, loadUpdater: () => { throw Error('must not load'); } });
  assert.equal(f.api.getState().phase, 'disabled');
  assert.equal(f.api.getState().enabled, false);
  await f.api.checkForUpdates({ manual: true });
  assert.equal(f.updater.checkCalls, 0);
  assert.equal(f.timeouts.size, 0);
  assert.equal(f.intervals.size, 0);
  assert.equal(f.api.quitAndInstall(), false);
});

test('packaged Windows checks after startup and every six hours, with background download only', async () => {
  const f = fixture();
  assert.equal([...f.timeouts.values()][0].delay, STARTUP_DELAY_MS);
  assert.equal([...f.intervals.values()][0].delay, CHECK_INTERVAL_MS);
  assert.equal(f.updater.autoDownload, true);
  assert.equal(f.updater.autoInstallOnAppQuit, false);
  assert.equal(f.updater.allowDowngrade, false);
  [...f.timeouts.values()][0].fn();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.updater.checkCalls, 1);
  f.updater.emit('update-not-available');
  [...f.intervals.values()][0].fn();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.updater.checkCalls, 2);
  assert.deepEqual(f.updater.installCalls, []);
  f.api.dispose();
});

test('concurrent checks and active downloads cannot create duplicate downloads', async () => {
  const f = fixture();
  let finish;
  f.updater.checkForUpdates = () => { f.updater.checkCalls++; return new Promise(resolve => { finish = resolve; }); };
  const first = f.api.checkForUpdates();
  const second = f.api.checkForUpdates({ manual: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.updater.checkCalls, 1);
  f.updater.emit('update-available', { version: '0.2.0' });
  finish({});
  await Promise.all([first, second]);
  await f.api.checkForUpdates({ manual: true });
  assert.equal(f.updater.checkCalls, 1);
  f.updater.emit('download-progress', { percent: 42.2 });
  assert.equal(f.api.getState().percent, 42.2);
  await f.api.checkForUpdates();
  assert.equal(f.updater.checkCalls, 1);
  f.api.dispose();
});

test('install requires a verified downloaded event and an explicit user action', () => {
  const f = fixture();
  assert.equal(f.api.quitAndInstall(), false);
  f.updater.emit('update-available', { version: '0.2.0' });
  assert.equal(f.api.quitAndInstall(), false);
  f.updater.emit('update-downloaded', { version: '0.2.0' });
  assert.equal(f.api.getState().phase, 'downloaded');
  assert.deepEqual(f.updater.installCalls, []);
  assert.equal(f.api.quitAndInstall(), true);
  assert.deepEqual(f.updater.installCalls, [[false, true]]);
  f.api.dispose();
});

test('checksum failure blocks installation without exposing raw failure details', () => {
  const f = fixture();
  f.updater.emit('error', { code: 'ERR_UPDATER_CHECKSUM_MISMATCH', message: 'secret-token-value' });
  assert.equal(f.api.getState().phase, 'error');
  assert.match(f.api.getState().message, /校验/);
  assert.ok(!JSON.stringify(f.api.getState()).includes('secret-token-value'));
  assert.equal(f.api.quitAndInstall(), false);
  f.api.dispose();
});

test('a rejected network check becomes a visible retryable error and a later check can recover', async () => {
  const f = fixture();
  f.updater.checkForUpdates = () => Promise.reject(Object.assign(Error('network error'), { code: 'ENOTFOUND' }));
  const result = await f.api.checkForUpdates({ manual: true });
  assert.equal(result.phase, 'error');
  assert.equal(result.manual, true);
  f.updater.checkForUpdates = () => { f.updater.emit('update-not-available'); return Promise.resolve({}); };
  const recovered = await f.api.checkForUpdates({ manual: true });
  assert.equal(recovered.phase, 'up-to-date');
  f.api.dispose();
});

test('disposing on quit cancels periodic checks and prevents further update callbacks', async () => {
  const f = fixture();
  const count = f.history.length;
  f.app.emit('before-quit');
  assert.equal(f.timeouts.size, 0);
  assert.equal(f.intervals.size, 0);
  f.updater.emit('update-downloaded', { version: '0.2.0' });
  await f.api.checkForUpdates();
  assert.equal(f.updater.checkCalls, 0);
  assert.equal(f.history.length, count);
  assert.equal(f.api.quitAndInstall(), false);
});

test('missing first release is diagnosed without pretending the app is up to date', () => {
  const f = fixture();
  f.updater.emit('error', { code: 'ERR_UPDATER_LATEST_VERSION_NOT_FOUND' });
  assert.equal(f.api.getState().phase, 'error');
  assert.match(f.api.getState().message, /已发布/);
  assert.notEqual(f.api.getState().phase, 'up-to-date');
  f.api.dispose();
});
