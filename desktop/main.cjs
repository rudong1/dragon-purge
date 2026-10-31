'use strict';

const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, screen, shell, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { WINDOW_SIZES, normalizePreferences, fitWindow } = require('./lib/preferences.cjs');
const { windowsShortcutOptions, linuxDesktopEntry } = require('./lib/shortcuts.cjs');
const { createUpdater } = require('./updater.cjs');
const { createBehavior } = require('./lib/behavior.cjs');

const rendererPath = path.join(__dirname, 'renderer', 'index.html');
const rendererUrl = pathToFileURL(rendererPath).href;
const iconPath = path.join(__dirname, 'assets', 'icon.png');
const APP_ID = 'com.rudong1.dragonpet';
let window;
let tray;
let updater;
let behavior;
let drag;
let preferences = normalizePreferences({});
let preferencesPath;
let positionTimer;
let quitting = false;

function savePreferences() {
  if (!preferencesPath) return;
  try {
    fs.mkdirSync(path.dirname(preferencesPath), { recursive: true });
    const temporary = `${preferencesPath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(preferences, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, preferencesPath);
  } catch (error) {
    console.warn('Could not save desktop pet preferences:', error.message);
  }
}

function autostartEnabled() {
  if (!app.isPackaged || !['win32', 'darwin'].includes(process.platform)) return false;
  return app.getLoginItemSettings().openAtLogin;
}

function getStatus() {
  return {
    pose: preferences.pose,
    size: preferences.size,
    alwaysOnTop: preferences.alwaysOnTop,
    autostart: autostartEnabled(),
    visible: !!window && !window.isDestroyed() && window.isVisible(),
    version: app.getVersion(),
    platform: process.platform,
    packaged: app.isPackaged,
    behavior: behavior?.getState() ?? { activity: 'awake', activitySince: Date.now() },
    updater: updater?.getState() ?? { phase: 'disabled', message: '正在初始化更新检查。' }
  };
}

function broadcast() {
  if (window && !window.isDestroyed()) window.webContents.send('desktop:status', getStatus());
  if (tray && !tray.isDestroyed()) tray.setContextMenu(buildMenu());
}

function displayAreas() {
  const primary = screen.getPrimaryDisplay();
  return [primary.workArea, ...screen.getAllDisplays().filter(d => d.id !== primary.id).map(d => d.workArea)];
}

function rememberPosition() {
  if (!window || window.isDestroyed()) return;
  const { x, y } = window.getBounds();
  preferences.position = { x, y };
  savePreferences();
}

function fitCurrentWindow() {
  if (!window || window.isDestroyed()) return;
  const bounds = fitWindow(WINDOW_SIZES[preferences.size], preferences.position, displayAreas());
  window.setBounds(bounds);
  rememberPosition();
}

function setVisible(visible) {
  if (!window || window.isDestroyed()) return;
  if (visible) { fitCurrentWindow(); window.show(); }
  else { rememberPosition(); window.hide(); }
  drag = null;
  behavior?.setVisible(visible);
  broadcast();
}

function setPose(pose) {
  if (!['standing', 'sitting'].includes(pose)) throw new Error('Unknown pose.');
  preferences.pose = pose;
  behavior?.reset();
  savePreferences();
  broadcast();
}

function setSize(size) {
  if (typeof size !== 'string' || !Object.hasOwn(WINDOW_SIZES, size)) throw new Error('Unknown pet size.');
  const old = window.getBounds();
  const next = WINDOW_SIZES[size];
  preferences.position = { x: old.x + old.width - next.width, y: old.y + old.height - next.height };
  preferences.size = size;
  fitCurrentWindow();
  broadcast();
}

async function createDesktopShortcut() {
  const desktop = app.getPath('desktop');
  const executable = app.getPath('exe');
  const details = { executable, appDirectory: app.getAppPath(), packaged: app.isPackaged, icon: iconPath };
  fs.mkdirSync(desktop, { recursive: true });
  if (process.platform === 'win32') {
    const shortcutPath = path.join(desktop, '白龙娘GPT.lnk');
    const created = shell.writeShortcutLink(shortcutPath, 'create', windowsShortcutOptions(details));
    if (!created) throw new Error('无法创建桌面快捷方式，请检查桌面目录的写入权限。');
  } else if (process.platform === 'linux') {
    const shortcutPath = path.join(desktop, 'dragon-gpt.desktop');
    fs.writeFileSync(shortcutPath, linuxDesktopEntry(details), { mode: 0o755 });
    fs.chmodSync(shortcutPath, 0o755);
  } else {
    return { ok: false, message: 'macOS 请在 Finder 的应用程序目录中，为白龙娘 GPT 创建替身并移到桌面。' };
  }
  preferences.shortcutCreated = true;
  savePreferences();
  return { ok: true, message: '桌面快捷方式已创建。' };
}

async function toggleAutostart() {
  if (!app.isPackaged || !['win32', 'darwin'].includes(process.platform)) {
    return { ok: false, message: '开机启动需要先安装 Windows 或 macOS 打包版本。' };
  }
  app.setLoginItemSettings({ openAtLogin: !autostartEnabled(), path: app.getPath('exe') });
  broadcast();
  return { ok: true, message: autostartEnabled() ? '已开启开机启动。' : '已关闭开机启动。' };
}

function exitApp() {
  quitting = true;
  app.quit();
}

function buildMenu() {
  const status = getStatus();
  const update = status.updater;
  const menu = [
    { label: `白龙娘 GPT v${app.getVersion()}`, enabled: false },
    { type: 'separator' },
    { label: status.visible ? '隐藏桌宠' : '显示桌宠', click: () => setVisible(!status.visible) },
    { label: '姿势', submenu: [
      { label: '全身站姿', type: 'radio', checked: preferences.pose === 'standing', click: () => setPose('standing') },
      { label: '坐在地上', type: 'radio', checked: preferences.pose === 'sitting', click: () => setPose('sitting') }
    ] },
    { label: '大小', submenu: Object.entries({ small: '小', medium: '中', large: '大' }).map(([size, label]) => ({
      label, type: 'radio', checked: preferences.size === size, click: () => setSize(size)
    })) },
    { label: '动作', submenu: [
      { label: '坐着晃腿', click: () => setPose('sitting') },
      { label: '抱尾巴打个盹', click: () => behavior?.sleep() },
      { label: '叫醒她', enabled: ['sleeping', 'drowsy'].includes(status.behavior.activity), click: () => behavior?.wake() },
      { label: '求摸摸', click: () => behavior?.requestPat() },
      { label: '摸摸头', click: () => behavior?.petHead() },
      { label: '换装坐姿 · 好看吗？', click: () => behavior?.showcase() }
    ] },
    { label: '保持置顶', type: 'checkbox', checked: preferences.alwaysOnTop, click: () => performAction('toggle-always-on-top') },
    { label: '开机启动', type: 'checkbox', checked: status.autostart, enabled: app.isPackaged && ['win32', 'darwin'].includes(process.platform), click: () => void performAction('toggle-autostart') },
    { label: '创建桌面快捷方式', click: () => void performAction('create-shortcut').then(result => {
      if (!result.ok) void dialog.showMessageBox({ type: 'info', title: '桌面快捷方式', message: result.message });
    }) },
    { type: 'separator' },
    { label: ['checking', 'downloading'].includes(update.phase) ? update.message : '检查更新', enabled: !['checking', 'downloading'].includes(update.phase), click: async () => {
      const result = await performAction('check-updates');
      if (['disabled', 'up-to-date', 'error'].includes(updater.getState().phase)) {
        await dialog.showMessageBox({ type: result.ok ? 'info' : 'warning', title: '检查更新', message: result.message || updater.getState().message });
      }
    } },
    ...(update.phase === 'downloaded' ? [{ label: '重启并安装更新', click: () => void performAction('install-update') }] : []),
    { type: 'separator' },
    { label: '退出桌宠', click: exitApp }
  ];
  return Menu.buildFromTemplate(menu);
}

function showContextMenu() {
  if (!window || window.isDestroyed()) return;
  behavior?.interact({ preserveActivity: true });
  buildMenu().popup({ window });
}

function beginDrag() {
  if (!window || window.isDestroyed()) return;
  drag = { cursor: screen.getCursorScreenPoint(), bounds: window.getBounds() };
  behavior?.interact({ preserveActivity: true });
}

function moveDrag() {
  if (!drag || !window || window.isDestroyed()) return;
  const cursor = screen.getCursorScreenPoint();
  const position = { x: drag.bounds.x + cursor.x - drag.cursor.x, y: drag.bounds.y + cursor.y - drag.cursor.y };
  const fitted = fitWindow(drag.bounds, position, displayAreas());
  window.setPosition(fitted.x, fitted.y);
}

function endDrag() {
  if (drag) { drag = null; rememberPosition(); behavior?.interact({ preserveActivity: true }); }
}

async function performAction(action, value) {
  try {
    switch (action) {
      case 'drag-begin': beginDrag(); break;
      case 'drag-move': moveDrag(); break;
      case 'drag-end': endDrag(); break;
      case 'pet-interact': behavior?.interact(); break;
      case 'pet-head': behavior?.petHead(); break;
      case 'sleep': behavior?.sleep(); break;
      case 'wake': behavior?.wake(); break;
      case 'request-pat': behavior?.requestPat(); break;
      case 'showcase': behavior?.showcase(); break;
      case 'show-menu': showContextMenu(); break;
      case 'toggle-visible': setVisible(!window.isVisible()); break;
      case 'set-pose': setPose(value); break;
      case 'set-size': setSize(value); break;
      case 'toggle-always-on-top':
        preferences.alwaysOnTop = !preferences.alwaysOnTop;
        window.setAlwaysOnTop(preferences.alwaysOnTop, 'floating');
        savePreferences(); broadcast(); break;
      case 'toggle-autostart': return await toggleAutostart();
      case 'create-shortcut': return await createDesktopShortcut();
      case 'check-updates':
        await updater.checkForUpdates({ manual: true });
        return { ok: true, message: updater.getState().message };
      case 'install-update':
        if (updater.getState().phase !== 'downloaded') return { ok: false, message: '更新尚未下载完成。' };
        return { ok: updater.quitAndInstall() !== false };
      case 'quit': exitApp(); break;
      default: return { ok: false, message: '不支持的桌宠操作。' };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

function trustedSender(event) {
  return window && !window.isDestroyed() && event.sender.id === window.webContents.id && event.senderFrame?.url === rendererUrl;
}

function createWindow() {
  const bounds = fitWindow(WINDOW_SIZES[preferences.size], preferences.position, displayAreas());
  window = new BrowserWindow({
    ...bounds, title: '白龙娘 GPT', icon: iconPath,
    frame: false, transparent: true, backgroundColor: '#00000000',
    resizable: false, maximizable: false, fullscreenable: false, hasShadow: false,
    alwaysOnTop: preferences.alwaysOnTop, skipTaskbar: true, show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      webSecurity: true, devTools: !app.isPackaged
    }
  });
  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (url !== rendererUrl) event.preventDefault(); });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.webContents.on('context-menu', event => { event.preventDefault(); showContextMenu(); });
  window.webContents.on('did-finish-load', broadcast);
  window.on('move', () => {
    clearTimeout(positionTimer);
    positionTimer = setTimeout(rememberPosition, 200);
  });
  window.once('ready-to-show', () => { window.show(); behavior?.setVisible(true); broadcast(); });
  window.on('close', () => { rememberPosition(); });
  window.on('closed', () => { window = null; if (!quitting) exitApp(); });
  void window.loadFile(rendererPath).catch(error => {
    dialog.showErrorBox('桌宠页面无法加载', error.message);
    exitApp();
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId(APP_ID);
  app.on('second-instance', () => { if (window) { setVisible(true); window.focus(); } });
  app.on('before-quit', () => { quitting = true; clearTimeout(positionTimer); updater?.dispose(); behavior?.dispose(); drag = null; rememberPosition(); });
  app.on('window-all-closed', () => app.quit());
  app.on('activate', () => { if (window) setVisible(true); });
  app.whenReady().then(async () => {
    preferencesPath = path.join(app.getPath('userData'), 'preferences.json');
    try { preferences = normalizePreferences(JSON.parse(fs.readFileSync(preferencesPath, 'utf8'))); }
    catch { preferences = normalizePreferences({}); }
    behavior = createBehavior({ onChange: broadcast });
    createWindow();
    updater = createUpdater({ app, dialog, shell, onStatus: broadcast });
    let trayIcon = nativeImage.createFromPath(iconPath);
    if (!trayIcon.isEmpty()) trayIcon = trayIcon.resize({ width: 20, height: 20 });
    tray = new Tray(trayIcon);
    tray.setToolTip('白龙娘 GPT · 右键打开菜单');
    tray.on('click', () => setVisible(!window.isVisible()));
    tray.on('double-click', () => setVisible(true));
    broadcast();
    ipcMain.handle('desktop:get-status', event => {
      if (!trustedSender(event)) throw new Error('Untrusted desktop renderer.');
      return getStatus();
    });
    ipcMain.handle('desktop:action', (event, action, value) => {
      if (!trustedSender(event)) throw new Error('Untrusted desktop renderer.');
      return performAction(action, value);
    });
    for (const event of ['display-added', 'display-removed', 'display-metrics-changed']) screen.on(event, fitCurrentWindow);
    if (app.isPackaged && process.platform === 'win32' && !preferences.shortcutCreated) {
      try { await createDesktopShortcut(); }
      catch (error) { console.warn('Desktop shortcut was not created:', error.message); }
    }
  }).catch(error => { dialog.showErrorBox('桌宠启动失败', error.message); app.quit(); });
}
