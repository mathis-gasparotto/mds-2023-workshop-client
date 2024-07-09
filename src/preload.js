const { contextBridge, ipcRenderer } = require('electron/renderer')
const path = require('path')

contextBridge.exposeInMainWorld('electronAPI', {
  generateVideo: (fileIds) => ipcRenderer.invoke('dialog:generateVideo', fileIds).then(dst => dst && path.relative(__dirname, dst).replace(/\\/g, '/')),
  getFolders: () => ipcRenderer.invoke('dialog:getFolders'),
  getFiles: (folderId) => ipcRenderer.invoke('dialog:getFiles', folderId),
  message: (callback) => ipcRenderer.on('message', (_event, value) => callback(value)),
  clearOutputs: () => ipcRenderer.send('clearOutputs')
})