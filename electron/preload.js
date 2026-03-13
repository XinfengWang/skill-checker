// Preload script for Electron
// This runs in a separate context before the web page loads

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: process.platform,

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // File operations (if needed in the future)
  openExternal: (url) => ipcRenderer.send('open-external', url),

  // Notifications
  showNotification: (title, body) => ipcRenderer.send('show-notification', { title, body })
});

// Log when preload script is loaded
console.log('Preload script loaded successfully');
