const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('lunaNative', { startServer: () => ipcRenderer.invoke('luna:startServer') });
