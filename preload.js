/**
 * Preload script for Udupi POS
 * Securely exposes main process APIs to renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Update system APIs
  checkForUpdates: () => ipcRenderer.invoke('update-check'),
  downloadUpdate: () => ipcRenderer.invoke('update-download'),
  installUpdate: () => ipcRenderer.invoke('update-install'),
  
  // Listen for update events
  onUpdateEvent: (callback) => {
    ipcRenderer.on('update-event', callback);
    return () => ipcRenderer.removeListener('update-event', callback);
  },
  
  // Printing APIs
  printBill: (data) => ipcRenderer.invoke('print-bill', data),
  printKOT: (data) => ipcRenderer.invoke('print-kot', data),
  
  // Storage APIs
  loadOrders: () => ipcRenderer.invoke('load-orders'),
  saveOrders: (data) => ipcRenderer.invoke('save-orders', data),
  loadMenu: () => ipcRenderer.invoke('load-menu'),
  saveMenu: (data) => ipcRenderer.invoke('save-menu', data),
  
  // File operations
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, data) => ipcRenderer.invoke('write-file', filePath, data),
});

// For backward compatibility, also expose ipcRenderer in a controlled way
contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, callback) => {
    ipcRenderer.on(channel, callback);
    return () => ipcRenderer.removeListener(channel, callback);
  },
  removeListener: (channel, callback) => ipcRenderer.removeListener(channel, callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

console.log('Preload script loaded - Secure context bridge established');
