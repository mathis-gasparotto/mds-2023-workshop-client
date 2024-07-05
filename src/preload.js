const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('electronAPI', {
  generateVideo: () => ipcRenderer.send('generate-video'),
  videoGenerated: (callback) => ipcRenderer.on('video-generated', (_event, value) => callback(value))
  })