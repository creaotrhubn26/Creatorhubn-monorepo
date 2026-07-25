/* Post Agent — Bryllupsveiviseren som Resolve-panel (prototype).
   Speiler GuidedWeddingWizard-flyten fra appen: kilder → multicam → lyd →
   sanger → personer → stil → live → color/QC — pluss Etterarbeid
   (ubrukt-materiale m/ AI-anbefalinger og playhead-hopp). */
"use strict";
const PA = window.postagent;

const S = {  // veiviser-state (speiler appens wizard-state, forenklet)
    step: "sources",
    folder: null, cameras: [], scan: null,
    audioFolder: null, matches: null,
    songs: [], culture: "",
    faces: null, style: "balanced",
    logGamma: null, qcWarnings: [],
    bins: "Dag 1,Dag 2", cat: null, recs: null, excluded: [],
    chosen: {}, busy: false,
    doneSteps: new Set(),
};

const STEPS = [
    { id: "sources",  n: 1, label: "Kilder + kameraer" },
    { id: "material", n: 2, label: "Multicam-scan" },
    { id: "audio",    n: 3, label: "Ekstern lyd" },
    { id: "music",    n: 4, label: "Sanger" },
    { id: "persons",  n: 5, label: "Personer" },
    { id: "style",    n: 6, label: "Stil" },
    { id: "live",     n: 7, label: "Live-arbeid" },
    { id: "color",    n: 8, label: "Color / QC" },
    { id: "unused",   n: 9, label: "🧠 Ubrukt-materiale", sep: "Etterarbeid" },
];

// ── infrastruktur ──
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function status(msg, cls) { $("status-msg").textContent = msg; $("status-msg").className = cls || ""; }
PA.onProgress((p) => {
    const pct = p.total ? Math.round((p.current / p.total) * 100) : 0;
    $("progress-wrap").classList.remove("hidden");
    $("progress-bar").style.width = pct + "%";
    if (p.message) status(p.message);
});
function progressDone() { $("progress-wrap").classList.add("hidden"); $("progress-bar").style.width = "0%"; }

async function run(scriptId, params, dryRun, busyMsg) {
    S.busy = true; render(); status(busyMsg || "Kjører " + scriptId + " …");
    try {
        const v = await PA.runScript(scriptId, params, Boolean(dryRun));
        status("Ferdig: " + scriptId, "ok-text");
        return v;
    } catch (e) {
        status("Feil i " + scriptId + ": " + String(e.message || e).slice(0, 160), "err");
        throw e;
    } finally { S.busy = false; progressDone(); render(); }
}

async function refreshProject() {
    const info = await PA.projectInfo();
    const chip = $("project-chip");
    if (info.projectOpen) {
        chip.textContent = `● ${info.projectName} — ${info.timelineName || "ingen timeline"} @ ${info.fps || "?"} fps`;
        chip.className = "ok";
    } else {
        chip.textContent = info.connected ? "Resolve tilkoblet — åpne et prosjekt" : "⚠ ikke tilkoblet Resolve";
        chip.className = "";
    }
    return info;
}

// ── steg-renderere ──
const RENDER = {
    sources() {
        return `<h2>Steg 1 — Kilder + kameraer</h2>
        <div class="sub">Pek på råmateriale (minnekort/mappe). Kameraer identifiseres på metadata (make/model/serienr) og foreslås som vinkler.</div>
        <div class="card"><div class="row">
            <button id="pick-src" ${S.busy ? "disabled" : ""}>📁 Velg materiale-mappe</button>
            <span class="muted">${esc(S.folder || "ingen valgt")}</span>
            <button id="scan-src" class="primary" ${!S.folder || S.busy ? "disabled" : ""}>Identifiser kameraer</button>
        </div></div>
        ${S.cameras.map((c) => `<div class="card"><div class="row">
            <strong>${esc(c.make || "?")} ${esc(c.model || "")}</strong>
            <span class="chip">Vinkel ${c.suggestedAngle}</span>
            <span class="muted">${c.clipCount} klipp · ${Math.round((c.totalDuration || 0) / 60)} min</span>
        </div></div>`).join("")}
        ${S.cameras.length ? nextBtn("material") : ""}
        <div class="muted" style="margin-top:14px">Backup til SSD m/ manifest + hastighets-benchmark kjøres i Post Agent-appen i denne prototypen.</div>`;
    },
    material() {
        const g = S.scan;
        return `<h2>Steg 2 — Multicam-scan</h2>
        <div class="sub">Klipp grupperes på timecode-overlapp (5s-toleranse) → multicam-grupper.</div>
        <div class="card"><div class="row">
            <button id="scan-mc" class="primary" ${!S.folder || S.busy ? "disabled" : ""}>Skann ${esc(S.folder ? S.folder.split("/").pop() : "…")}</button>
            ${g ? `<span class="ok-text">${g.clipCount} klipp · ${g.multicamGroupCount} multicam-grupper</span>` : ""}
        </div></div>
        ${g ? `<div class="card"><div class="row">
            <label class="chk"><input type="checkbox" id="opt-mc" checked> Bygg multicam</label>
            <label class="chk"><input type="checkbox" id="opt-long" checked> Langfilm</label>
            <label class="chk"><input type="checkbox" id="opt-high" checked> Highlight</label>
            <label class="chk"><input type="checkbox" id="opt-teaser" checked> Teaser</label>
        </div></div>${nextBtn("audio")}` : ""}`;
    },
    audio() {
        return `<h2>Steg 3 — Ekstern lyd</h2>
        <div class="sub">Lavalier/recorder-opptak matches mot kamera-klipp via kryss-korrelasjon → sync-offset per fil.</div>
        <div class="card"><div class="row">
            <button id="pick-audio" ${S.busy ? "disabled" : ""}>📁 Velg lyd-mappe</button>
            <span class="muted">${esc(S.audioFolder || "ingen valgt — hopp over hvis alt er kamera-lyd")}</span>
            <button id="match-audio" class="primary" ${!S.audioFolder || !S.scan || S.busy ? "disabled" : ""}>Match mot klipp</button>
        </div></div>
        ${S.matches ? `<div class="card"><strong class="ok-text">${S.matches.matchCount} matcher</strong>
            ${(S.matches.matches || []).slice(0, 6).map((m) => `<div class="muted">${esc((m.externalAudio || "").split("/").pop())} → ${esc((m.clipPath || "").split("/").pop())} (offset ${(m.offsetSec ?? 0).toFixed(2)}s, ${Math.round((m.confidence || 0) * 100)} %)</div>`).join("")}
        </div>` : ""}
        ${nextBtn("music")}`;
    },
    music() {
        return `<h2>Steg 4 — Sanger</h2>
        <div class="sub">Ønske-sanger med rolle (hovedsang / inngang / første dans / dans / utgang) — brukes av timeline-byggingen og QC-ens musikk-forslag.</div>
        <div class="card"><div class="row">
            <input type="text" id="song-title" placeholder="Tittel">
            <input type="text" id="song-artist" placeholder="Artist" style="min-width:160px">
            <button id="add-song" class="small">+ Legg til</button>
        </div></div>
        ${S.songs.map((s, i) => `<div class="card"><div class="row">🎵 <strong>${esc(s.title)}</strong> <span class="muted">${esc(s.artist)}</span>
            <span class="chip">${esc(s.role)}</span><button class="small" data-del-song="${i}">✕</button></div></div>`).join("")}
        <div class="muted">Claude-forslag basert på kultur kjøres i appen i denne prototypen.</div>
        ${nextBtn("persons")}`;
    },
    persons() {
        return `<h2>Steg 5 — Personer</h2>
        <div class="sub">Ansikts-klynging over materialet → merk Brud/Brudgom/familie (styrer highlight-vekting).</div>
        <div class="card"><div class="row">
            <button id="scan-faces" class="primary" ${!S.scan || S.busy ? "disabled" : ""}>Finn personer i materialet</button>
            ${S.faces ? `<span class="ok-text">${S.faces.clusters?.length ?? 0} unike personer</span>` : ""}
        </div><div class="muted">Kan ta flere minutter på stort materiale.</div></div>
        ${nextBtn("style")}`;
    },
    style() {
        const opts = [["storytelling", "📖 Storytelling"], ["cinematic", "🎬 Cinematic"], ["energetic", "⚡ Energisk"], ["balanced", "⚖️ Balansert"]];
        return `<h2>Steg 6 — Stil</h2>
        <div class="sub">Styrer klipperytme og vekting i timeline-byggingen.</div>
        <div class="grid2">${opts.map(([id, label]) => `<div class="card style-card ${S.style === id ? "chosen" : ""}" data-style="${id}">${label}</div>`).join("")}</div>
        ${nextBtn("live")}`;
    },
    live() {
        return `<h2>Steg 7 — Live-arbeid</h2>
        <div class="sub">Highlight-ekstraksjon (shot-scoring med aksept/avvis per klipp) kjøres i Post Agent-appen i denne prototypen — resultatet (picks-fila) gjenbrukes av timeline-byggingen.</div>
        <div class="card dim">Ikke portet enda — prototypen fokuserer på de Resolve-nære stegene.</div>
        ${nextBtn("color")}`;
    },
    color() {
        return `<h2>Steg 8 — Color / QC</h2>
        <div class="sub">Log-deteksjon → prosjekt-settings/CST, deretter QC på gjeldende timeline: svarte mellomrom + stille partier (med sang-forslag fra Steg 4).</div>
        <div class="card"><div class="row">
            <button id="detect-log" ${!S.scan || S.busy ? "disabled" : ""}>Sjekk log-gamma</button>
            ${S.logGamma ? `<span class="${S.logGamma.isLog ? "warn" : "ok-text"}">${S.logGamma.isLog ? "LOG: " + esc(S.logGamma.profile) + " → CST settes" : "Ikke log — ingen CST nødvendig"}</span>` : ""}
            ${S.logGamma?.isLog ? `<button id="apply-cst" class="small" ${S.busy ? "disabled" : ""}>Sett prosjekt-settings</button>` : ""}
        </div></div>
        <div class="card"><div class="row">
            <button id="run-qc" class="primary" ${S.busy ? "disabled" : ""}>Kjør QC på gjeldende timeline</button>
            ${S.qcWarnings.length ? `<button id="qc-markers" class="small" ${S.busy ? "disabled" : ""}>Sett QC-markører (røde/gule)</button>` : ""}
        </div>
        ${S.qcWarnings.length ? `<pre class="mini">${esc(S.qcWarnings.join("\n"))}</pre>` : ""}</div>
        ${nextBtn("unused")}`;
    },
    unused() {
        const c = S.cat;
        return `<h2>🧠 Etterarbeid — Ubrukt-materiale</h2>
        <div class="sub">Finn klipp som ikke er brukt i timelinen, få AI-anbefalinger (frame-for-frame + duplikat-vakt), hopp til hullet og sett inn.</div>
        <div class="card"><div class="row">
            <input type="text" id="bins-input" value="${esc(S.bins)}" style="min-width:300px">
            <button id="analyse-unused" class="primary" ${S.busy ? "disabled" : ""}>Analyser</button>
            <button id="recs-unused" ${S.busy ? "disabled" : ""}>🧠 Anbefalinger (Claude)</button>
        </div>
        ${c ? c.bins.map((b) => `<div class="muted" style="margin-top:6px"><strong>${esc(b.bin)}</strong>: ${b.used} brukt · <span class="warn">${b.unused} ubrukt</span></div>`).join("") : ""}
        </div>
        ${(S.recs || []).map((r, i) => {
            const vi = r.vision || {};
            const rejected = vi.passer === false;
            const conf = vi.confidence != null ? `<span class="${vi.confidence >= 75 ? "conf-high" : "conf-mid"}">${vi.confidence} %</span>` : "";
            return `<div class="card ${rejected ? "dim" : ""}"><div class="row">
                ${r.thumb ? `<img class="thumb" src="file://${esc(r.thumb)}">` : `<div class="thumb"></div>`}
                <div style="flex:1;min-width:0">
                    <div class="row"><strong>${esc(r.clip)}</strong> <span class="chip">${esc(r.camera)}</span> ≈ ${esc(r.estTc)} ${conf}</div>
                    ${vi.beskrivelse ? `<div class="desc">${esc(vi.beskrivelse)}</div>` : ""}
                    ${vi.begrunnelse ? `<div class="reason">${rejected ? "⚠ " : ""}${esc(vi.begrunnelse)}</div>` : ""}
                    ${vi.bestStartSec != null ? `<span class="chip green">✂ ${vi.bestStartSec}–${vi.bestEndSec}s</span>` : ""}
                </div>
                <div style="display:flex;flex-direction:column;gap:6px">
                    <button class="small" data-jump="${esc(r.estTc)}">→ Gå til</button>
                    <button class="small primary" data-insert="${i}" ${rejected || S.busy ? "disabled" : ""}>Sett inn</button>
                </div>
            </div></div>`;
        }).join("")}
        ${S.excluded.length ? `<div class="card dim">🛡 ${S.excluded.length} klipp holdt utenfor av duplikat-vakten
            <pre class="mini">${esc(S.excluded.map((e) => `${e.clip} — ${e.reason}`).join("\n"))}</pre></div>` : ""}
        ${S.recs && !S.recs.length ? `<div class="card ok-text">Ingen kandidater — timelinen dekker materialet 👌</div>` : ""}`;
    },
};

function nextBtn(next) {
    return `<div style="margin-top:14px"><button class="primary" data-next="${next}">Neste →</button></div>`;
}

// ── handlinger ──
const ACTIONS = {
    "pick-src": async () => { const f = await PA.pickFolder("Pek mappa der bryllups-materialet ligger"); if (f) { S.folder = f; render(); } },
    "scan-src": async () => {
        const v = await run("scan_and_organize_sources", { sources: [{ path: S.folder, role: "folder" }] }, false, "Identifiserer kameraer …");
        S.cameras = v.cameras || []; S.doneSteps.add("sources"); render();
    },
    "scan-mc": async () => {
        const v = await run("scan_folder_multicam", { folder: S.folder }, false, "Skanner for multicam-grupper …");
        S.scan = v; S.doneSteps.add("material"); render();
    },
    "pick-audio": async () => { const f = await PA.pickFolder("Pek mappa med eksterne lyd-opptak"); if (f) { S.audioFolder = f; render(); } },
    "match-audio": async () => {
        const v = await run("match_external_audio_to_clips",
            { externalAudioFolder: S.audioFolder, clips: S.scan?.clips || [] }, false, "Matcher lyd mot klipp …");
        S.matches = v; S.doneSteps.add("audio"); render();
    },
    "add-song": () => {
        const t = $("song-title").value.trim(), a = $("song-artist").value.trim();
        if (t) { S.songs.push({ title: t, artist: a, role: S.songs.length ? "dance" : "main" }); render(); }
    },
    "scan-faces": async () => {
        const v = await run("cluster_faces_from_clips",
            { clips: S.scan?.clips || [], sampleIntervalSec: 10, maxFramesPerClip: 8 }, false,
            "Finner ansikter — dette tar tid …");
        S.faces = v; S.doneSteps.add("persons"); render();
    },
    "detect-log": async () => {
        const first = S.scan?.clips?.[0]?.path;
        if (!first) { status("Kjør multicam-scan (steg 2) først — trenger et klipp å sjekke.", "err"); return; }
        const v = await run("detect_log_gamma", { videoPath: first }, false, "Sjekker log-gamma …");
        S.logGamma = v; render();
    },
    "apply-cst": async () => {
        const p = { };
        const prof = (S.logGamma?.profile || "").toLowerCase();
        if (prof.includes("c-log")) { p.cstInputGamma = "Canon C-Log 2"; p.cstInputGamut = "Canon Cinema Gamut"; }
        else if (prof.includes("s-log")) { p.cstInputGamma = "Sony S-Log 3"; p.cstInputGamut = "Sony S-Gamut3.Cine"; }
        else if (prof.includes("v-log")) { p.cstInputGamma = "Panasonic V-Log"; p.cstInputGamut = "Panasonic V-Gamut"; }
        await run("apply_project_settings", p, false, "Setter prosjekt-settings …");
        status("Prosjekt-settings satt.", "ok-text");
    },
    "run-qc": async () => {
        S.qcWarnings = [];
        const info = await refreshProject();
        if (!info.timelineName) { status("Ingen timeline åpen.", "err"); return; }
        const gaps = await run("detect_timeline_gaps", { timelineName: info.timelineName }, false, "Sjekker svarte mellomrom …");
        if (gaps.verdict !== "clean" && (gaps.gapCount || 0) > 0)
            S.qcWarnings.push(`⬛ ${gaps.gapCount} svarte mellomrom (${(gaps.totalGapSec || 0).toFixed(1)}s)`);
        const silent = await run("detect_silent_sections_in_timeline",
            { timelineName: info.timelineName, unusedSongs: S.songs, minSilenceSec: 3.0 }, false, "Sjekker stille partier …");
        for (const sec of (silent.silentSections || []).slice(0, 5)) {
            const sug = sec.suggestedSongs?.[0];
            S.qcWarnings.push(`🎵 ${Math.round(sec.startSec)}s–${Math.round(sec.endSec)}s stille (${sec.durationSec.toFixed(1)}s)${sug ? ` → forslag: «${sug.title}» — ${sug.artist}` : ""}`);
        }
        if (!S.qcWarnings.length) S.qcWarnings.push("✓ QC ren — ingen funn");
        S.doneSteps.add("color"); render();
    },
    "qc-markers": async () => {
        const info = await refreshProject();
        const v = await run("mark_qc_issues_on_timeline",
            { timelineName: info.timelineName, unusedSongs: S.songs, removeOldQc: true }, false, "Setter QC-markører …");
        status(`✓ ${v.markersAdded || 0} QC-markører satt (røde = gap, gule = stille).`, "ok-text");
    },
    "analyse-unused": async () => {
        S.bins = $("bins-input").value;
        const v = await run("categorize_unused_clips", { bins: S.bins }, true, "Analyserer brukt/ubrukt …");
        S.cat = v; render();
    },
    "recs-unused": async () => {
        S.bins = $("bins-input").value;
        const v = await run("recommend_unused_insertions", { bins: S.bins, topN: "10", vision: "true" }, false,
            "Claude ser gjennom kandidatene frame-for-frame — tar ~1 min …");
        S.recs = v.recommendations || []; S.excluded = v.excluded || []; S.doneSteps.add("unused"); render();
    },
};

async function insertRec(i) {
    const r = S.recs[i];
    const vi = r.vision || {};
    const items = [{ clip: r.clip, frame: r.anchorFrame,
        ...(vi.bestStartSec != null ? { startSec: vi.bestStartSec, endSec: vi.bestEndSec } : {}) }];
    const v = await run("insert_unused_clips", { items: JSON.stringify(items), markers: "true" }, false, "Setter inn …");
    status(v.inserted ? `✓ ${r.clip} satt inn på spor V${v.track}` : `Innsetting feilet: ${(v.failed || []).join(", ")}`,
        v.inserted ? "ok-text" : "err");
}

// ── render + wiring ──
function render() {
    $("steps").innerHTML = STEPS.map((s) =>
        (s.sep ? `<div class="step-sep">${s.sep}</div>` : "") +
        `<div class="step-item ${S.step === s.id ? "active" : ""} ${S.doneSteps.has(s.id) ? "done-mark" : ""}" data-step="${s.id}">
            ${S.doneSteps.has(s.id) ? "✓" : s.n} · ${s.label}</div>`).join("");
    $("content").innerHTML = RENDER[S.step]();
}

document.addEventListener("click", async (ev) => {
    const el = ev.target.closest("[data-step],[data-next],[data-style],[data-jump],[data-insert],[data-del-song],button");
    if (!el) return;
    if (el.dataset.step) { S.step = el.dataset.step; render(); return; }
    if (el.dataset.next) { S.step = el.dataset.next; render(); return; }
    if (el.dataset.style) { S.style = el.dataset.style; S.doneSteps.add("style"); render(); return; }
    if (el.dataset.jump) {
        const ok = await PA.jumpToTc(el.dataset.jump);
        status(ok ? "Spillehodet flyttet til " + el.dataset.jump : "Kunne ikke flytte spillehodet", ok ? "ok-text" : "err");
        return;
    }
    if (el.dataset.insert != null) { await insertRec(Number(el.dataset.insert)); return; }
    if (el.dataset.delSong != null) { S.songs.splice(Number(el.dataset.delSong), 1); render(); return; }
    if (el.id && ACTIONS[el.id]) { try { await ACTIONS[el.id](); } catch { /* status satt av run() */ } }
});

render();
refreshProject();
setInterval(refreshProject, 15000);
