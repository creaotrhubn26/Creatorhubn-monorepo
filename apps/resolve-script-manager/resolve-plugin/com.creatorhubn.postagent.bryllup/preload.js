const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('postagent', {
    runScript: (scriptId, params, dryRun) => ipcRenderer.invoke('run-script', scriptId, params, dryRun),
    pickFolder: (title) => ipcRenderer.invoke('pick-folder', title),
    projectInfo: () => ipcRenderer.invoke('project-info'),
    jumpToTc: (tc) => ipcRenderer.invoke('jump-to-tc', tc),
    onProgress: (cb) => {
        const handler = (_ev, data) => cb(data);
        ipcRenderer.on('script-progress', handler);
        return () => ipcRenderer.removeListener('script-progress', handler);
    },
});
