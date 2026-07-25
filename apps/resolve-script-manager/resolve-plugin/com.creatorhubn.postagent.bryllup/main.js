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
        const key = anthropicKey();
        const child = spawn('python3', args, { env: key ? { ...PY_ENV, ANTHROPIC_API_KEY: key } : PY_ENV, cwd: PY_ROOT });
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

// ── Kontekst-motoren: billig snapshot (polles ~2s fra panelet) ──
// Alt try/catch-et enkeltvis: felter som ikke gjelder aktiv side utelates
// heller enn å velte hele snapshotet.
async function currentTimeline() {
    const resolve = await getResolve();
    if (!resolve) return { resolve: null };
    const pm = await resolve.GetProjectManager();
    const project = await pm.GetCurrentProject();
    const tl = project ? await project.GetCurrentTimeline() : null;
    return { resolve, project, tl };
}

ipcMain.handle('context-snapshot', async () => {
    const snap = {};
    try {
        const { resolve, project, tl } = await currentTimeline();
        if (!resolve) return { connected: false };
        snap.connected = true;
        snap.page = await resolve.GetCurrentPage();
        if (project) snap.projectName = await project.GetName();
        if (tl) {
            snap.timelineName = await tl.GetName();
            snap.fps = await tl.GetSetting('timelineFrameRate');
            try { snap.tc = await tl.GetCurrentTimecode(); } catch { /* media-side */ }
            try {
                const item = await tl.GetCurrentVideoItem();
                if (item) snap.currentItem = await item.GetName();
            } catch { /* ikke tilgjengelig på alle sider */ }
            try { snap.inOut = await tl.GetMarkInOut(); } catch { /* eldre API */ }
            snap.videoTracks = await tl.GetTrackCount('video');
            snap.audioTracks = await tl.GetTrackCount('audio');
        }
        try {
            const mp = await project.GetMediaPool();
            const sel = await mp.GetSelectedClips();
            if (sel && sel.length) {
                snap.selectedClips = [];
                for (const c of sel.slice(0, 8)) snap.selectedClips.push(await c.GetName());
                snap.selectedCount = sel.length;
            }
        } catch { /* utvalg ikke tilgjengelig */ }
    } catch (e) {
        snap.error = String(e).slice(0, 150);
    }
    return snap;
});

// ── Direkte-API-operasjoner (native funksjoner orkestreres, ikke kopieres) ──
ipcMain.handle('transcribe-selected', async (_ev, useSpeakers) => {
    const { project } = await currentTimeline();
    const mp = await project.GetMediaPool();
    const sel = (await mp.GetSelectedClips()) || [];
    let ok = 0;
    for (const c of sel) {
        try { if (await c.TranscribeAudio(Boolean(useSpeakers))) ok++; } catch { /* per-klipp */ }
    }
    return { total: sel.length, ok };
});

ipcMain.handle('intellisearch-selected', async (_ev, identifyFaces) => {
    const { project } = await currentTimeline();
    const mp = await project.GetMediaPool();
    const sel = (await mp.GetSelectedClips()) || [];
    let ok = 0;
    for (const c of sel) {
        try { if (await c.AnalyzeForIntellisearch(Boolean(identifyFaces), false)) ok++; } catch { /* per-klipp */ }
    }
    return { total: sel.length, ok };
});

ipcMain.handle('voice-isolation-info', async () => {
    const { tl } = await currentTimeline();
    if (!tl) return [];
    const n = Math.min(8, (await tl.GetTrackCount('audio')) || 0);
    const out = [];
    for (let t = 1; t <= n; t++) {
        try {
            const st = await tl.GetVoiceIsolationState(t);
            out.push({ track: t, name: await tl.GetTrackName('audio', t), ...st });
        } catch { out.push({ track: t, unsupported: true }); }
    }
    return out;
});

ipcMain.handle('set-voice-isolation', async (_ev, track, isEnabled, amount) => {
    const { tl } = await currentTimeline();
    if (!tl) return false;
    return Boolean(await tl.SetVoiceIsolationState(track, { isEnabled, amount: amount ?? 50 }));
});

ipcMain.handle('create-subtitles', async () => {
    const { tl } = await currentTimeline();
    if (!tl) return false;
    // Default-innstillinger (språk: auto) — tar minutter på lang timeline.
    try { return Boolean(await tl.CreateSubtitlesFromAudio()); }
    catch { return Boolean(await tl.CreateSubtitlesFromAudio({})); }
});

ipcMain.handle('render-info', async () => {
    const { project } = await currentTimeline();
    if (!project) return { presets: [], jobs: [] };
    let presets = [];
    let jobs = [];
    try { presets = ((await project.GetRenderPresetList()) || []).slice(0, 20); } catch { /* — */ }
    try { jobs = ((await project.GetRenderJobList()) || []).slice(0, 10); } catch { /* — */ }
    return { presets, jobs };
});

ipcMain.handle('start-rendering', async () => {
    const { project } = await currentTimeline();
    if (!project) return false;
    return Boolean(await project.StartRendering());
});

// ── 💬 Chat-operatøren: Claude m/ verktøy-tilgang til motoren ──
// Nøkkel: env, ellers ~/.config/postagent/anthropic_key (bruker-administrert).
function anthropicKey() {
    if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
    try {
        return fs.readFileSync(
            path.join(process.env.HOME || '', '.config/postagent/anthropic_key'), 'utf8').trim();
    } catch { return null; }
}

function anthropicRequest(body) {
    const https = require('https');
    return new Promise((resolvePromise, rejectPromise) => {
        const req = https.request({
            hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': anthropicKey(),
                'anthropic-version': '2023-06-01',
            },
        }, (res) => {
            let data = '';
            res.on('data', (d) => { data += d; });
            res.on('end', () => {
                try {
                    const j = JSON.parse(data);
                    if (j.error) rejectPromise(new Error(j.error.message || 'API-feil'));
                    else resolvePromise(j);
                } catch (e) { rejectPromise(e); }
            });
        });
        req.on('error', rejectPromise);
        req.write(JSON.stringify(body));
        req.end();
    });
}

// Sikkerhets-modell for chatens script-kjøring: lesing fritt; mutasjoner
// nektes og henvises til panel-knappene (som har confirm).
const CHAT_READ_OK = new Set(['get_media_pool_state', 'unused_clips_placement',
    'recommend_unused_insertions', 'dialogue_tools', 'edit_assistants',
    'detect_timeline_gaps', 'detect_silent_sections_in_timeline', 'detect_log_gamma',
    'technical_qc']);
const CHAT_DRY_ONLY = new Set(['categorize_unused_clips', 'insert_unused_clips',
    'mark_qc_issues_on_timeline']);

async function chatRunScript(scriptId, params) {
    const p = { ...(params || {}) };
    delete p.markers; // markører/mutasjoner går via panelet
    if (scriptId === 'dialogue_tools' && String(p.mode).toLowerCase() === 'assembly') {
        return { refused: 'assembly bygger ny timeline — be brukeren gjøre det i 🗣 Dialog-fanen' };
    }
    let dry = false;
    if (CHAT_DRY_ONLY.has(scriptId)) dry = true;
    else if (!CHAT_READ_OK.has(scriptId)) return { refused: `scriptet «${scriptId}» er ikke i chat-listen` };
    const runHandler = async () => new Promise((resolvePromise, rejectPromise) => {
        const entry = loadRegistry().scripts.find((s) => s.id === scriptId);
        if (!entry) { rejectPromise(new Error('ukjent script')); return; }
        const args = [path.join(PY_ROOT, entry.scriptPath), `--params=${JSON.stringify(p)}`];
        if (dry) args.push('--dry-run');
        const key = anthropicKey();
        const child = spawn('python3', args, { env: key ? { ...PY_ENV, ANTHROPIC_API_KEY: key } : PY_ENV, cwd: PY_ROOT });
        let result = null; let err = ''; let buf = '';
        child.stdout.on('data', (d) => {
            buf += d.toString(); let nl;
            while ((nl = buf.indexOf('\n')) >= 0) {
                const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
                try { const ev = JSON.parse(line); if (ev.type === 'result') result = ev.value; if (ev.type === 'error') err = ev.message; } catch { /* — */ }
            }
        });
        child.on('close', () => result !== null ? resolvePromise(result) : rejectPromise(new Error(err || 'ingen result')));
        child.on('error', rejectPromise);
    });
    return runHandler();
}

const CHAT_TOOLS = [
    { name: 'get_context', description: 'Øyeblikksbilde av Resolve: side, prosjekt, timeline, playhead, valgte klipp, in/out.', input_schema: { type: 'object', properties: {} } },
    { name: 'run_script', description: 'Kjør et Post Agent-analyse-script. Kun lesing — mutasjoner (flytting/innsetting/markører/assembly) må brukeren gjøre via panel-fanene. Tilgjengelige id-er: get_media_pool_state, categorize_unused_clips (dry), unused_clips_placement, recommend_unused_insertions (vision="true" for Claude-syn), dialogue_tools (mode=extract|search|pauses|repetitions), edit_assistants (mode=tempo|jumpcuts|takes|angles, tc=playhead for takes/angles), detect_timeline_gaps, detect_silent_sections_in_timeline, detect_log_gamma, technical_qc (mode=sweep|color|delivery — teknisk leveransekontroll).', input_schema: { type: 'object', properties: { scriptId: { type: 'string' }, params: { type: 'object' } }, required: ['scriptId'] } },
    { name: 'jump_to', description: 'Flytt spillehodet til en tidskode (HH:MM:SS:FF).', input_schema: { type: 'object', properties: { tc: { type: 'string' } }, required: ['tc'] } },
];

const CHAT_SYSTEM = `Du er Post Agent-operatøren — en kontekstbevisst klippe-assistent inne i DaVinci Resolve, spesialisert på bryllupsfilm. Svar kort og konkret på norsk. Bruk verktøyene til å HENTE FAKTA før du svarer (get_context først når plassering er relevant). Oppgi alltid tidskoder for funn, og bruk jump_to når brukeren vil se noe. Du kan ikke endre noe selv: foreslå i stedet hvilken panel-fane brukeren skal bruke (🧠 Ubrukt-materiale for innsetting, 🗣 Dialog for assembly/markører, ✂ Assistenter for jump-cut-markører). Vær ærlig om usikkerhet.`;

ipcMain.handle('operator-chat', async (_ev, history) => {
    if (!anthropicKey()) {
        return { text: 'Mangler ANTHROPIC_API_KEY (env eller ~/.config/postagent/anthropic_key).', tools: [] };
    }
    const messages = history.map((m) => ({ role: m.role, content: m.text }));
    const toolTrace = [];
    for (let i = 0; i < 6; i++) {
        const resp = await anthropicRequest({
            model: 'claude-sonnet-4-6', max_tokens: 1200, system: CHAT_SYSTEM,
            tools: CHAT_TOOLS, messages,
        });
        const toolUses = (resp.content || []).filter((c) => c.type === 'tool_use');
        if (!toolUses.length || resp.stop_reason !== 'tool_use') {
            const text = (resp.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
            return { text: text || '(tomt svar)', tools: toolTrace };
        }
        messages.push({ role: 'assistant', content: resp.content });
        const results = [];
        for (const tu of toolUses) {
            let out;
            try {
                if (tu.name === 'get_context') {
                    out = await (async () => {
                        const { resolve, project, tl } = await currentTimeline();
                        const s = { page: resolve ? await resolve.GetCurrentPage() : null };
                        if (project) s.projectName = await project.GetName();
                        if (tl) {
                            s.timelineName = await tl.GetName();
                            try { s.tc = await tl.GetCurrentTimecode(); } catch { /* — */ }
                            try { const it = await tl.GetCurrentVideoItem(); if (it) s.currentItem = await it.GetName(); } catch { /* — */ }
                        }
                        return s;
                    })();
                } else if (tu.name === 'run_script') {
                    out = await chatRunScript(tu.input.scriptId, tu.input.params);
                    toolTrace.push(`${tu.input.scriptId}${tu.input.params?.mode ? ':' + tu.input.params.mode : ''}`);
                } else if (tu.name === 'jump_to') {
                    const { tl } = await currentTimeline();
                    out = { moved: tl ? Boolean(await tl.SetCurrentTimecode(tu.input.tc)) : false };
                    toolTrace.push(`jump:${tu.input.tc}`);
                } else {
                    out = { error: 'ukjent verktøy' };
                }
            } catch (e) { out = { error: String(e.message || e).slice(0, 300) }; }
            const asStr = JSON.stringify(out);
            results.push({ type: 'tool_result', tool_use_id: tu.id,
                content: asStr.length > 20000 ? asStr.slice(0, 20000) + '…[kuttet]' : asStr });
        }
        messages.push({ role: 'user', content: results });
    }
    return { text: 'Stoppet etter 6 verktøy-runder — spør mer spesifikt.', tools: toolTrace };
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
