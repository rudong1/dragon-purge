'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const actions = new Set([
  'show-menu', 'toggle-visible', 'set-pose', 'set-size', 'toggle-always-on-top',
  'toggle-autostart', 'create-shortcut', 'check-updates', 'install-update', 'quit',
  'toggle-quiet-mode', 'toggle-lock-position', 'reset-position',
  'pet-interact', 'pet-head', 'sleep', 'wake', 'request-pat', 'showcase', 'tap-feet', 'summer', 'drag-begin', 'drag-move', 'drag-end'
]);

contextBridge.exposeInMainWorld('desktopPet', Object.freeze({
  getStatus: () => ipcRenderer.invoke('desktop:get-status'),
  action: (name, value) => {
    if (!actions.has(name)) return Promise.reject(new Error('Unknown desktop action.'));
    return ipcRenderer.invoke('desktop:action', name, value);
  },
  onStatus: callback => {
    if (typeof callback !== 'function') throw new TypeError('A status callback is required.');
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('desktop:status', handler);
    return () => ipcRenderer.removeListener('desktop:status', handler);
  },
  onMenu: callback => {
    if (typeof callback !== 'function') throw new TypeError('A menu callback is required.');
    const handler = (_event, request) => callback(request);
    ipcRenderer.on('desktop:show-menu', handler);
    return () => ipcRenderer.removeListener('desktop:show-menu', handler);
  }
}));
