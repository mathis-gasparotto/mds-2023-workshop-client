const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('electronAPI', {
  generateVideo: () => ipcRenderer.send('generate-video'),
  videoCreated: (callback) => ipcRenderer.on('video-created', (_event, value) => callback(value))
})