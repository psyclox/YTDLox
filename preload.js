const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
    getVideoInfo: (url) => ipcRenderer.invoke('ytdl:getInfo', url),
    downloadVideo: (options) => ipcRenderer.invoke('ytdl:download', options),
    searchVideo: (query, searchType, offset) => ipcRenderer.invoke('ytdl:search', query, searchType, offset),
    getConfig: () => ipcRenderer.invoke('config:get'),
    setConfig: (config) => ipcRenderer.invoke('config:set', config),
    openFile: (filePath) => ipcRenderer.invoke('shell:openFile', filePath),
    openFolder: (filePath) => ipcRenderer.invoke('shell:openFolder', filePath),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_event, data) => callback(data)),
    onDownloadStatus: (callback) => ipcRenderer.on('download-status', (_event, data) => callback(data)),
    onDownloadComplete: (callback) => ipcRenderer.on('download-complete', (_event, data) => callback(data)),
    onDownloadError: (callback) => ipcRenderer.on('download-error', (_event, data) => callback(data))
});
