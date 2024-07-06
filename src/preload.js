const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('electronAPI', {
  generateVideo: (fileIds) => ipcRenderer.invoke('dialog:generateVideo', fileIds),
  getFolders: () => ipcRenderer.invoke('dialog:getFolders'),
  getFiles: (folderId) => ipcRenderer.invoke('dialog:getFiles', folderId),
  message: (callback) => ipcRenderer.on('message', (_event, value) => callback(value)),
  clearOutputs: () => ipcRenderer.send('clearOutputs')
})