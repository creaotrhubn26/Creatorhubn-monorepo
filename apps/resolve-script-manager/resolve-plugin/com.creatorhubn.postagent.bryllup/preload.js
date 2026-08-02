const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('postagent', {
    runScript: (scriptId, params, dryRun) => ipcRenderer.invoke('run-script', scriptId, params, dryRun),
    pickFolder: (title) => ipcRenderer.invoke('pick-folder', title),
    projectInfo: () => ipcRenderer.invoke('project-info'),
    jumpToTc: (tc) => ipcRenderer.invoke('jump-to-tc', tc),
    contextSnapshot: () => ipcRenderer.invoke('context-snapshot'),
    transcribeSelected: (useSpeakers) => ipcRenderer.invoke('transcribe-selected', useSpeakers),
    intellisearchSelected: (identifyFaces) => ipcRenderer.invoke('intellisearch-selected', identifyFaces),
    voiceIsolationInfo: () => ipcRenderer.invoke('voice-isolation-info'),
    setVoiceIsolation: (track, isEnabled, amount) => ipcRenderer.invoke('set-voice-isolation', track, isEnabled, amount),
    renderInfo: () => ipcRenderer.invoke('render-info'),
    createSubtitles: () => ipcRenderer.invoke('create-subtitles'),
    operatorChat: (history) => ipcRenderer.invoke('operator-chat', history),
    backupTimeline: () => ipcRenderer.invoke('backup-timeline'),
    startRendering: () => ipcRenderer.invoke('start-rendering'),
    onProgress: (cb) => {
        const handler = (_ev, data) => cb(data);
        ipcRenderer.on('script-progress', handler);
        return () => ipcRenderer.removeListener('script-progress', handler);
    },
});
