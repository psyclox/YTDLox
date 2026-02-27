const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
    getVideoInfo: (url) => ipcRenderer.invoke('ytdl:getInfo', url),
    downloadVideo: (options) => ipcRenderer.invoke('ytdl:download', options),
    searchVideo: (query) => ipcRenderer.invoke('ytdl:search', query),
    getConfig: () => ipcRenderer.invoke('config:get'),
    setConfig: (config) => ipcRenderer.invoke('config:set', config),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_event, data) => callback(data)),
    onDownloadStatus: (callback) => ipcRenderer.on('download-status', (_event, data) => callback(data)),
    onDownloadComplete: (callback) => ipcRenderer.on('download-complete', (_event, data) => callback(data)),
    onDownloadError: (callback) => ipcRenderer.on('download-error', (_event, data) => callback(data))
});
