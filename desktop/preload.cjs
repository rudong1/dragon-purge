'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const actions = new Set([
  'show-menu', 'toggle-visible', 'set-pose', 'set-size', 'toggle-always-on-top',
  'toggle-autostart', 'create-shortcut', 'check-updates', 'install-update', 'quit'
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
  }
}));
