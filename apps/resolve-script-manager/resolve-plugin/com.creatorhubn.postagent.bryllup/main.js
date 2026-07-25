// Post Agent — Bryllup: Workflow Integration for DaVinci Resolve Studio.
// Prototype: panelet gjenbruker Post Agent-motoren (python-scripts via registry)
// og bruker Resolve-API-et direkte for interaktive ting (playhead-hopp,
// prosjekt-info). Kjøres av Resolves innebygde Electron (sandboxed renderer).
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const WorkflowIntegration = require('./WorkflowIntegration.node');

const PLUGIN_ID = 'com.creatorhubn.postagent.bryllup';

// Prototype: peker på utviklings-checkouten. Produksjon bundler motoren.
const PY_ROOT = '/Users/danielqazi/Creatorhubn-monorepo/apps/resolve-script-manager/python';
const PY_ENV = {
    ...process.env,
    RESOLVE_SCRIPT_API: '/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting',
    RESOLVE_SCRIPT_LIB: '/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so',
    PYTHONPATH: '/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules',
    // Framework-python først: samme interpreter som appen/CLI-testene
    // (har anthropic-SDK + certifi for vision-laget).
    PATH: `/Library/Frameworks/Python.framework/Versions/3.14/bin:${process.env.PATH || ''}:/opt/homebrew/bin:/usr/local/bin`,
    SSL_CERT_FILE: '/Users/danielqazi/Library/Python/3.14/lib/python/site-packages/certifi/cacert.pem',
    PYTHONDONTWRITEBYTECODE: '1',
};

let mainWindow = null;
let resolveObj = null;
let registry = null;

function loadRegistry() {
    if (!registry) {
        registry = JSON.parse(fs.readFileSync(path.join(PY_ROOT, 'registry.json'), 'utf8'));
    }
    return registry;
}

async function getResolve() {
    if (resolveObj) return resolveObj;
    const ok = await WorkflowIntegration.Initialize(PLUGIN_ID);
    if (!ok) return null;
    resolveObj = await WorkflowIntegration.GetResolve();
    return resolveObj;
}

// ── IPC: kjør python-script fra registry (samme motor som appen) ──
ipcMain.handle('run-script', async (_ev, scriptId, params, dryRun) => {
    const entry = loadRegistry().scripts.find((s) => s.id === scriptId);
    if (!entry) throw new Error(`Ukjent script: ${scriptId}`);
    const scriptPath = path.join(PY_ROOT, entry.scriptPath);
    const args = [scriptPath, `--params=${JSON.stringify(params || {})}`];
    if (dryRun) args.push('--dry-run');

    return new Promise((resolvePromise, rejectPromise) => {
        const child = spawn('python3', args, { env: PY_ENV, cwd: PY_ROOT });
        let result = null;
        let errMsg = '';
        let buf = '';
        child.stdout.on('data', (d) => {
            buf += d.toString();
            let nl;
            while ((nl = buf.indexOf('\n')) >= 0) {
                const line = buf.slice(0, nl).trim();
                buf = buf.slice(nl + 1);
                if (!line) continue;
                try {
                    const ev = JSON.parse(line);
                    if (ev.type === 'result') result = ev.value;
                    else if (ev.type === 'error') errMsg = ev.message || 'script-feil';
                    else if (ev.type === 'progress' && mainWindow) {
                        mainWindow.webContents.send('script-progress', {
                            scriptId, current: ev.current, total: ev.total, message: ev.message,
                        });
                    }
                } catch { /* ikke-JSON linje — ignorer */ }
            }
        });
        child.stderr.on('data', (d) => { errMsg = errMsg || d.toString().slice(0, 400); });
        child.on('close', (code) => {
            if (result !== null) resolvePromise(result);
            else rejectPromise(new Error(errMsg || `script avsluttet med kode ${code}`));
        });
        child.on('error', (e) => rejectPromise(e));
    });
});

ipcMain.handle('pick-folder', async (_ev, title) => {
    const r = await dialog.showOpenDialog(mainWindow, {
        title: title || 'Velg mappe', properties: ['openDirectory'],
    });
    return r.canceled ? null : r.filePaths[0];
});

// ── IPC: direkte Resolve-API (det som gir mening å gjøre synkront i panelet) ──
ipcMain.handle('project-info', async () => {
    try {
        const resolve = await getResolve();
        if (!resolve) return { connected: false };
        const pm = await resolve.GetProjectManager();
        const project = await pm.GetCurrentProject();
        if (!project) return { connected: true, projectOpen: false };
        const tl = await project.GetCurrentTimeline();
        return {
            connected: true,
            projectOpen: true,
            projectName: await project.GetName(),
            timelineName: tl ? await tl.GetName() : null,
            fps: tl ? await tl.GetSetting('timelineFrameRate') : null,
            timelineCount: await project.GetTimelineCount(),
        };
    } catch (e) {
        return { connected: false, error: String(e).slice(0, 200) };
    }
});

ipcMain.handle('jump-to-tc', async (_ev, tc) => {
    const resolve = await getResolve();
    if (!resolve) return false;
    const pm = await resolve.GetProjectManager();
    const project = await pm.GetCurrentProject();
    const tl = project ? await project.GetCurrentTimeline() : null;
    if (!tl) return false;
    return Boolean(await tl.SetCurrentTimecode(tc));
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1180,
        height: 820,
        backgroundColor: '#16161d',
        title: 'Post Agent — Bryllup',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    mainWindow.loadFile('index.html');
    mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
    await getResolve();
    createWindow();
});

app.on('window-all-closed', () => {
    try { WorkflowIntegration.CleanUp(); } catch { /* best effort */ }
    app.quit();
});
