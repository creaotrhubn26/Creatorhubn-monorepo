/* Post Agent — Bryllupsveiviseren som Resolve-panel (prototype).
   Speiler GuidedWeddingWizard-flyten fra appen: kilder → multicam → lyd →
   sanger → personer → stil → live → color/QC — pluss Etterarbeid
   (ubrukt-materiale m/ AI-anbefalinger og playhead-hopp). */
"use strict";
const PA = window.postagent;

const S = {  // veiviser-state (speiler appens wizard-state, forenklet)
    step: "operator",
    ctx: null, prevCtx: null, journal: [],
    voiceTracks: null, render: null,
    dialog: null, dialogHits: null, dialogPauses: null, dialogReps: null,
    dialogSel: {},
    tempo: null, jumpcuts: null, takes: null, angles: null,
    chat: [], chatBusy: false,
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
    { id: "operator", n: 0, label: "🎛 Operatør" },
    { id: "chat",     n: 0, label: "💬 Spør" },
    { id: "sources",  n: 1, label: "Kilder + kameraer" },
    { id: "material", n: 2, label: "Multicam-scan" },
    { id: "audio",    n: 3, label: "Ekstern lyd" },
    { id: "music",    n: 4, label: "Sanger" },
    { id: "persons",  n: 5, label: "Personer" },
    { id: "style",    n: 6, label: "Stil" },
    { id: "live",     n: 7, label: "Live-arbeid" },
    { id: "color",    n: 8, label: "Color / QC" },
    { id: "unused",   n: 9, label: "🧠 Ubrukt-materiale", sep: "Etterarbeid" },
    { id: "dialog",   n: 10, label: "🗣 Dialog" },
    { id: "assist",   n: 11, label: "✂ Assistenter" },
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
        log(`Kjørte ${scriptId}${dryRun ? " (dry-run)" : ""}`);
        return v;
    } catch (e) {
        status("Feil i " + scriptId + ": " + String(e.message || e).slice(0, 160), "err");
        throw e;
    } finally { S.busy = false; progressDone(); render(); }
}

// ── Kontekst-motoren: snapshot (2s) → diff → journal ──
function log(msg) {
    const t = new Date().toTimeString().slice(0, 8);
    S.journal.unshift({ t, msg });
    S.journal = S.journal.slice(0, 40);
    if (S.step === "operator") render();
}

const PAGE_NO = { media: "Media", cut: "Cut", edit: "Edit", fusion: "Fusion",
                  color: "Color", fairlight: "Fairlight", deliver: "Deliver" };

function diffContext(prev, cur) {
    if (!prev || !cur.connected) return;
    if (prev.page !== cur.page && cur.page)
        log(`Byttet til ${PAGE_NO[cur.page] || cur.page}-siden`);
    if (prev.timelineName !== cur.timelineName && cur.timelineName)
        log(`Timeline: «${cur.timelineName}»`);
    if (prev.currentItem !== cur.currentItem && cur.currentItem)
        log(`Klipp under playhead: ${cur.currentItem}`);
    if (JSON.stringify(prev.selectedClips) !== JSON.stringify(cur.selectedClips) && cur.selectedCount)
        log(`${cur.selectedCount} klipp valgt i Media Pool`);
    if (JSON.stringify(prev.inOut) !== JSON.stringify(cur.inOut) && cur.inOut && Object.keys(cur.inOut).length)
        log("In/out-range endret");
}

async function pollContext() {
    try {
        const cur = await PA.contextSnapshot();
        diffContext(S.ctx, cur);
        S.prevCtx = S.ctx; S.ctx = cur;
        renderContextStrip();
    } catch { /* neste poll */ }
}

function renderContextStrip() {
    const c = S.ctx;
    const el = $("context-strip");
    if (!c || !c.connected) { el.innerHTML = `<span class="ctx">⚠ ikke tilkoblet</span>`; return; }
    const bits = [];
    if (c.page) bits.push(`<span class="ctx page">${PAGE_NO[c.page] || c.page}</span>`);
    if (c.tc) bits.push(`<span class="ctx">⏱ <b>${esc(c.tc)}</b></span>`);
    if (c.currentItem) bits.push(`<span class="ctx">🎞 <b>${esc(c.currentItem.slice(0, 34))}</b></span>`);
    if (c.inOut && (c.inOut.video || c.inOut.audio)) {
        const io = c.inOut.video || c.inOut.audio;
        bits.push(`<span class="ctx">⇥ in/out: <b>${esc(String(io.in ?? "?"))}–${esc(String(io.out ?? "?"))}</b></span>`);
    }
    if (c.selectedCount) bits.push(`<span class="ctx">☑ <b>${c.selectedCount}</b> valgt</span>`);
    if (c.videoTracks) bits.push(`<span class="ctx">${c.videoTracks}V/${c.audioTracks}A</span>`);
    el.innerHTML = bits.join("") || `<span class="ctx">åpne et prosjekt</span>`;
}

// Side-bevisste forslag — beregnes av billige kontekst-felt, handlingene
// kjører først når brukeren klikker.
function suggestionsFor(c) {
    if (!c || !c.connected) return [];
    const sug = [];
    switch (c.page) {
        case "media":
            if (c.selectedCount) {
                sug.push({ text: `${c.selectedCount} valgte klipp — transkriber med taler-deteksjon (native)`, act: "op-transcribe" });
                sug.push({ text: `IntelliSearch-analyse på valgte (native AI-indeksering)`, act: "op-intellisearch" });
            } else {
                sug.push({ text: "Velg klipp i Media Pool for transkripsjon / IntelliSearch-analyse", act: null });
            }
            break;
        case "edit": case "cut":
            sug.push({ text: "Kjør QC på timelinen: svarte mellomrom + stille partier", act: "op-qc" });
            sug.push({ text: "Ubrukt-materiale: finn klipp som ikke er brukt + AI-anbefalinger", act: "op-unused" });
            sug.push({ text: "Dialog-verktøy: søk i talen, finn pauser/repetisjoner, bygg assembly", act: "op-dialog" });
            sug.push({ text: "Klippe-assistenter: rytme-analyse, jump-cut-vakt, takes og vinkler", act: "op-assist" });
            if (c.currentItem) sug.push({ text: `Klippet under playhead (${c.currentItem.slice(0, 28)}…): alternative takes / samtidige vinkler`, act: "op-assist" });
            break;
        case "color":
            sug.push({ text: "Grade-kopiering på tvers av lignende klipp kan bare foreslås — nodegraf leses, men utvalg styres i GUI", act: null });
            if (c.currentItem) sug.push({ text: `Sjekk log-gamma for materialet → CST-prosjektsettings`, act: "op-log" });
            break;
        case "fairlight":
            sug.push({ text: "Voice Isolation-status per spor (native) — slå på for dialogspor", act: "op-voice" });
            break;
        case "deliver":
            sug.push({ text: "Vis render-kø + presets", act: "op-render" });
            break;
        default:
            sug.push({ text: "Fusion-siden: comp-info per klipp er lesbar (GetFusionCompCount) — dypere Fusion-scripting er fase 2", act: null });
    }
    return sug;
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
    operator() {
        const c = S.ctx;
        const sug = suggestionsFor(c);
        return `<h2>🎛 Operatør</h2>
        <div class="sub">Følger med på hvor du er i Resolve og foreslår neste handling. Forslagene under er for <strong>${esc(PAGE_NO[c?.page] || "…")}</strong>-siden.</div>
        ${sug.map((s) => `<div class="card sugg"><div class="row">
            <div style="flex:1">${esc(s.text)}</div>
            ${s.act ? `<button class="small primary" id="${s.act}" ${S.busy ? "disabled" : ""}>Kjør</button>` : `<span class="chip yellow">foreslås</span>`}
        </div></div>`).join("")}
        ${S.voiceTracks ? `<div class="card"><strong>Voice Isolation per spor</strong>
            ${S.voiceTracks.map((t) => t.unsupported
                ? `<div class="muted">A${t.track}: ikke støttet</div>`
                : `<div class="row" style="margin-top:4px"><span style="min-width:140px">A${t.track} ${esc(t.name || "")}</span>
                   <span class="chip ${t.isEnabled ? "green" : ""}">${t.isEnabled ? "PÅ " + (t.amount ?? "?") + "%" : "av"}</span>
                   <button class="small" data-voice-toggle="${t.track}" data-voice-on="${t.isEnabled ? 0 : 1}">${t.isEnabled ? "Slå av" : "Slå på (50 %)"}</button></div>`).join("")}
        </div>` : ""}
        ${S.render ? `<div class="card"><strong>Render</strong>
            <div class="muted">Kø: ${S.render.jobs.length} jobber · Presets: ${esc((S.render.presets || []).slice(0, 6).map((p) => p.RenderPresetName || p).join(", "))}${(S.render.presets || []).length > 6 ? " …" : ""}</div>
            ${S.render.jobs.length ? `<div class="row" style="margin-top:6px"><button class="small primary" id="op-start-render" ${S.busy ? "disabled" : ""}>Start rendering (${S.render.jobs.length} i kø)</button></div>` : ""}
        </div>` : ""}
        <div class="card"><strong>Journal</strong> <span class="muted">— det panelet ser og gjør</span>
            ${S.journal.length ? S.journal.slice(0, 12).map((j) => `<div class="journal-line"><span class="t">${j.t}</span>${esc(j.msg)}</div>`).join("") : `<div class="muted">ingenting enda — bytt side eller velg et klipp i Resolve, så ser du at panelet følger med</div>`}
        </div>`;
    },
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
    dialog() {
        const d = S.dialog;
        const selCount = Object.values(S.dialogSel).filter(Boolean).length;
        const segRow = (s, i, selectable) => `<div class="card"><div class="row">
            ${selectable ? `<input type="checkbox" data-dialog-sel="${i}" ${S.dialogSel[i] ? "checked" : ""}>` : ""}
            <span class="chip">${esc(s.tc)}</span>
            <div style="flex:1">${esc(s.text)}</div>
            <span class="muted">${s.durationSec}s</span>
            <button class="small" data-jump="${esc(s.tc)}">→</button>
        </div></div>`;
        return `<h2>🗣 Dialog — transkripsjonen som råstoff</h2>
        <div class="sub">Undertekst-sporet (native transkripsjon) blir dialog-kart med tidskoder: søk i det som sies, finn pauser og repetisjoner, bygg assembly av valgte utsnitt.</div>
        <div class="card"><div class="row">
            <button id="dlg-subs" ${S.busy ? "disabled" : ""}>1. Generer undertekster fra lyd (native)</button>
            <button id="dlg-extract" class="primary" ${S.busy ? "disabled" : ""}>2. Les dialog-kartet</button>
            ${d ? `<span class="ok-text">${d.segments} segmenter · ${Math.round((d.speechSec || 0) / 60)} min tale</span>` : ""}
        </div>
        ${d && !d.segments ? `<div class="warn" style="margin-top:6px">${esc(d.note || "")}</div>` : ""}</div>
        ${d && d.segments ? `
        <div class="card"><div class="row">
            <input type="text" id="dlg-query" placeholder="Søk i dialogen … (f.eks. navnet på bruden)">
            <button id="dlg-search" class="small" ${S.busy ? "disabled" : ""}>Søk</button>
            <button id="dlg-pauses" class="small" ${S.busy ? "disabled" : ""}>Pauser &gt; 2s</button>
            <button id="dlg-reps" class="small" ${S.busy ? "disabled" : ""}>Repetisjoner</button>
        </div></div>
        ${S.dialogHits ? `<div class="card"><strong>${S.dialogHits.hitCount} treff</strong></div>
            ${S.dialogHits.hits.slice(0, 30).map((s) => segRow(s, -1, false)).join("")}` : ""}
        ${S.dialogPauses ? `<div class="card"><div class="row"><strong>${S.dialogPauses.pauseCount} pauser</strong>
            <button id="dlg-pause-markers" class="small" ${S.busy ? "disabled" : ""}>Sett gule markører</button></div>
            ${S.dialogPauses.pauses.slice(0, 20).map((p) => `<div class="muted">⏸ ${esc(p.tc)} — ${p.durationSec}s stille &nbsp; «…${esc(p.before)}» → «${esc(p.after)}…»</div>`).join("")}</div>` : ""}
        ${S.dialogReps ? `<div class="card"><div class="row"><strong>${S.dialogReps.repCount} repetisjons-kandidater</strong>
            <button id="dlg-rep-markers" class="small" ${S.busy ? "disabled" : ""}>Sett rosa markører</button></div>
            ${S.dialogReps.repetitions.slice(0, 20).map((r) => `<div class="muted">🔁 ${esc(r.tc)} (${Math.round(r.similarity * 100)} %) «${esc(r.first)}»</div>`).join("")}</div>` : ""}
        <div class="card"><div class="row">
            <strong>Dialog-kartet</strong> <span class="muted">velg segmenter → assembly</span>
            <input type="text" id="dlg-name" value="Assembly fra manus" style="min-width:200px">
            <button id="dlg-assembly" class="primary" ${!selCount || S.busy ? "disabled" : ""}>Bygg assembly av ${selCount} valgte (ny timeline)</button>
        </div></div>
        ${(d.list || []).slice(0, 60).map((s, i) => segRow(s, i, true)).join("")}
        ${(d.list || []).length > 60 ? `<div class="muted">… ${(d.list || []).length - 60} til (vis alle kommer i neste runde)</div>` : ""}` : ""}`;
    },
    chat() {
        return `<h2>💬 Spør operatøren</h2>
        <div class="sub">Naturlig språk mot hele motoren: «hvor er de tregeste partiene?», «finnes det ubrukte dronebilder som passer i seremonien?», «hva sies rundt 01:20?». Operatøren leser — panelfanene endrer.</div>
        <div id="chat-log">
        ${S.chat.map((m) => `<div class="card ${m.role === "user" ? "" : "sugg"}">
            <div class="muted" style="font-size:10px">${m.role === "user" ? "Du" : "Operatøren"}</div>
            <div style="white-space:pre-wrap">${esc(m.text)}</div>
            ${m.tools?.length ? `<div style="margin-top:4px">${m.tools.map((t) => `<span class="chip">${esc(t)}</span>`).join(" ")}</div>` : ""}
        </div>`).join("") || `<div class="card dim">Still et spørsmål — operatøren henter fakta fra timelinen før den svarer.</div>`}
        ${S.chatBusy ? `<div class="card dim">Operatøren undersøker … (kjører analyser ved behov)</div>` : ""}
        </div>
        <div class="card"><div class="row">
            <input type="text" id="chat-input" placeholder="Spør om timelinen, materialet, dialogen …" style="flex:1;min-width:200px" ${S.chatBusy ? "disabled" : ""}>
            <button id="chat-send" class="primary" ${S.chatBusy ? "disabled" : ""}>Send</button>
            ${S.chat.length ? `<button id="chat-clear" class="small">Tøm</button>` : ""}
        </div></div>`;
    },
    assist() {
        const t = S.tempo, j = S.jumpcuts, tk = S.takes, an = S.angles;
        const playhead = S.ctx?.tc || "";
        return `<h2>✂ Klippe-assistenter</h2>
        <div class="sub">Rytme-analyse og jump-cut-vakt for hele timelinen — og alternative takes/vinkler for klippet under playhead (${esc(playhead || "flytt spillehodet i Resolve")}).</div>
        <div class="card"><div class="row">
            <button id="as-tempo" class="primary" ${S.busy ? "disabled" : ""}>📈 Tempo & rytme</button>
            <button id="as-jumpcuts" ${S.busy ? "disabled" : ""}>⚡ Finn jump-cuts</button>
            ${j?.candidates?.length ? `<button id="as-jc-markers" class="small" ${S.busy ? "disabled" : ""}>Sett røde markører (${j.candidates.length})</button>` : ""}
        </div>
        ${t ? `<div class="muted" style="margin-top:6px">${t.shots} skudd over ${t.tracks} spor · snitt ${t.avgShotSec}s · ${t.durationMin} min</div>
            <div class="muted">Tregeste partier: ${t.slowestShots.map((s) => `<button class="small" data-jump="${esc(s.tc)}">${esc(s.tc)} (${s.sec}s)</button>`).join(" ")}</div>` : ""}
        </div>
        ${j ? `<div class="card"><strong>${j.candidates.length} jump-cut-kandidater</strong> <span class="muted">(${j.cutsChecked} kutt sjekket, ${j.hashedPairs} visuelt sammenlignet)</span>
            ${j.candidates.slice(0, 15).map((c) => `<div class="row" style="margin-top:4px"><button class="small" data-jump="${esc(c.tc)}">→ ${esc(c.tc)}</button>
                <span class="muted" style="flex:1">${esc(c.reason)}</span></div>`).join("")}
            ${j.candidates.length > 15 ? `<div class="muted">… ${j.candidates.length - 15} til</div>` : ""}
        </div>` : ""}
        <div class="card"><div class="row">
            <strong>Klippet under playhead</strong>
            <button id="as-takes" ${!playhead || S.busy ? "disabled" : ""}>🎞 Alternative takes</button>
            <button id="as-angles" ${!playhead || S.busy ? "disabled" : ""}>📐 Andre vinkler (samtidig)</button>
        </div>
        ${tk ? `<div style="margin-top:8px"><strong>${esc(tk.clip || "")}</strong> <span class="chip">${esc(tk.camera || "")}</span>
            ${(tk.neighbors || []).map((n) => `<div class="muted">${n.used ? "✓ brukt" : "○ ubrukt"} &nbsp;${esc(n.clip)} (${n.durationSec}s)</div>`).join("") || `<div class="muted">${esc(tk.note || "ingen naboer")}</div>`}</div>` : ""}
        ${an ? `<div style="margin-top:8px"><strong>${an.alternativeCount || 0} samtidige vinkler</strong> <span class="muted">for ${esc(an.clip || "")}</span>
            ${(an.alternatives || []).map((a) => `<div class="muted">${a.used ? "✓" : "○"} ${esc(a.camera)} / ${esc(a.clip)} @ ${esc(a.startTc)}</div>`).join("") || `<div class="muted">${esc(an.note || "")}</div>`}</div>` : ""}
        </div>`;
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
    // ── dialog-handlinger ──
    "dlg-subs": async () => {
        if (!confirm("Genererer undertekster fra lyd på GJELDENDE timeline (native Resolve-transkripsjon).\n\nDette legger til et undertekst-spor og tar flere minutter på en lang timeline. Fortsette?")) return;
        S.busy = true; render(); status("Resolve transkriberer timelinen — dette tar minutter …");
        try {
            const ok = await PA.createSubtitles();
            log(ok ? "Genererte undertekster fra lyd (native)" : "Undertekst-generering feilet");
            status(ok ? "✓ Undertekster generert — trykk «Les dialog-kartet»" : "Undertekst-generering feilet", ok ? "ok-text" : "err");
        } catch (e) { status("Feil: " + e.message, "err"); }
        S.busy = false; render();
    },
    "dlg-extract": async () => {
        const v = await run("dialogue_tools", { mode: "extract" }, false, "Leser dialog-kartet …");
        S.dialog = v; S.dialogSel = {}; S.dialogHits = S.dialogPauses = S.dialogReps = null; render();
    },
    "dlg-search": async () => {
        const q = $("dlg-query").value.trim();
        if (!q) return;
        S.dialogHits = await run("dialogue_tools", { mode: "search", query: q }, false, `Søker etter «${q}» …`);
        S.dialogPauses = S.dialogReps = null; render();
    },
    "dlg-pauses": async () => {
        S.dialogPauses = await run("dialogue_tools", { mode: "pauses", minPauseSec: "2.0" }, false, "Finner pauser …");
        S.dialogHits = S.dialogReps = null; render();
    },
    "dlg-pause-markers": async () => {
        const v = await run("dialogue_tools", { mode: "pauses", minPauseSec: "2.0", markers: "true" }, false, "Setter pause-markører …");
        status(`✓ ${v.markersAdded} gule PAUSE-markører satt`, "ok-text");
    },
    "dlg-reps": async () => {
        S.dialogReps = await run("dialogue_tools", { mode: "repetitions" }, false, "Finner repetisjoner …");
        S.dialogHits = S.dialogPauses = null; render();
    },
    "dlg-rep-markers": async () => {
        const v = await run("dialogue_tools", { mode: "repetitions", markers: "true" }, false, "Setter repetisjons-markører …");
        status(`✓ ${v.markersAdded} rosa REPETISJON-markører satt`, "ok-text");
    },
    "dlg-assembly": async () => {
        const chosen = (S.dialog?.list || []).filter((_s, i) => S.dialogSel[i]);
        if (!chosen.length) return;
        const name = $("dlg-name").value.trim() || "Assembly fra manus";
        if (!confirm(`Bygger NY timeline «${name}» med ${chosen.length} dialog-utsnitt (video+lyd fra V1).\n\nMaster-timelinen røres ikke — den nye åpnes etterpå. Fortsette?`)) return;
        const v = await run("dialogue_tools", {
            mode: "assembly", assemblyName: name,
            segments: JSON.stringify(chosen.map((s) => ({ start: s.startFrame, end: s.endFrame }))),
        }, false, "Bygger assembly …");
        log(`Bygde assembly «${name}»: ${v.built} utsnitt`);
        status(`✓ ${v.built} utsnitt på ny timeline «${name}» — ${v.note || ""}`, "ok-text");
    },
    // ── chat-operatøren ──
    "chat-send": async () => {
        const input = $("chat-input");
        const q = input.value.trim();
        if (!q || S.chatBusy) return;
        S.chat.push({ role: "user", text: q });
        S.chatBusy = true; render();
        try {
            const history = S.chat.map((m) => ({ role: m.role === "user" ? "user" : "assistant", text: m.text }));
            const r = await PA.operatorChat(history);
            S.chat.push({ role: "assistant", text: r.text, tools: r.tools || [] });
            if (r.tools?.length) log(`Operatøren kjørte: ${r.tools.join(", ")}`);
        } catch (e) {
            S.chat.push({ role: "assistant", text: "Feil: " + String(e.message || e).slice(0, 200) });
        }
        S.chatBusy = false; render();
        const el = $("chat-input"); if (el) el.focus();
    },
    "chat-clear": () => { S.chat = []; render(); },
    // ── klippe-assistenter ──
    "as-tempo": async () => {
        S.tempo = await run("edit_assistants", { mode: "tempo" }, false, "Analyserer rytmen …");
        render();
    },
    "as-jumpcuts": async () => {
        S.jumpcuts = await run("edit_assistants", { mode: "jumpcuts", maxCuts: "200" }, true,
            "Sjekker kuttgrensene — split-kutt + visuell sammenligning …");
        render();
    },
    "as-jc-markers": async () => {
        const v = await run("edit_assistants", { mode: "jumpcuts", maxCuts: "200", markers: "true" }, false,
            "Setter jump-cut-markører …");
        status(`✓ ${v.markersAdded} røde JUMP CUT?-markører satt`, "ok-text");
    },
    "as-takes": async () => {
        S.takes = await run("edit_assistants",
            { mode: "takes", tc: S.ctx?.tc || "", bins: S.bins }, false, "Finner alternative takes …");
        S.angles = null; render();
    },
    "as-angles": async () => {
        S.angles = await run("edit_assistants",
            { mode: "angles", tc: S.ctx?.tc || "", bins: S.bins }, false, "Finner samtidige vinkler …");
        S.takes = null; render();
    },
    // ── operatør-handlinger (side-bevisste) ──
    "op-transcribe": async () => {
        S.busy = true; render(); status("Transkriberer valgte klipp (native) — kan ta minutter …");
        try {
            const r = await PA.transcribeSelected(true);
            log(`Transkriberte ${r.ok}/${r.total} valgte klipp (taler-deteksjon)`);
            status(`✓ ${r.ok}/${r.total} transkribert`, "ok-text");
        } catch (e) { status("Transkripsjon feilet: " + e.message, "err"); }
        S.busy = false; render();
    },
    "op-intellisearch": async () => {
        S.busy = true; render(); status("IntelliSearch-analyse på valgte …");
        try {
            const r = await PA.intellisearchSelected(true);
            log(`IntelliSearch-analyserte ${r.ok}/${r.total} valgte klipp`);
            status(`✓ ${r.ok}/${r.total} analysert`, "ok-text");
        } catch (e) { status("Analyse feilet: " + e.message + " (krever at AI-pakkene er installert i Resolve)", "err"); }
        S.busy = false; render();
    },
    "op-qc": async () => { S.step = "color"; render(); await ACTIONS["run-qc"](); },
    "op-unused": () => { S.step = "unused"; render(); },
    "op-dialog": () => { S.step = "dialog"; render(); },
    "op-assist": () => { S.step = "assist"; render(); },
    "op-log": () => { S.step = "color"; render(); },
    "op-voice": async () => {
        S.voiceTracks = await PA.voiceIsolationInfo();
        log("Leste Voice Isolation-status for lydsporene");
        render();
    },
    "op-render": async () => {
        S.render = await PA.renderInfo();
        log(`Render-kø: ${S.render.jobs.length} jobber`);
        render();
    },
    "op-start-render": async () => {
        if (!confirm(`Start rendering av ${S.render?.jobs.length ?? 0} jobber i køen?`)) return;
        const ok = await PA.startRendering();
        log(ok ? "Startet rendering av køen" : "Kunne ikke starte rendering");
        status(ok ? "✓ Rendering startet" : "Rendering feilet", ok ? "ok-text" : "err");
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
    if (el.dataset.dialogSel != null) { S.dialogSel[Number(el.dataset.dialogSel)] = el.checked; render(); return; }
    if (el.dataset.insert != null) { await insertRec(Number(el.dataset.insert)); return; }
    if (el.dataset.delSong != null) { S.songs.splice(Number(el.dataset.delSong), 1); render(); return; }
    if (el.dataset.voiceToggle != null) {
        const track = Number(el.dataset.voiceToggle);
        const turnOn = el.dataset.voiceOn === "1";
        const ok = await PA.setVoiceIsolation(track, turnOn, 50);
        log(ok ? `Voice Isolation ${turnOn ? "PÅ (50 %)" : "AV"} på spor A${track}` : `Voice Isolation-endring feilet på A${track}`);
        S.voiceTracks = await PA.voiceIsolationInfo();
        render(); return;
    }
    if (el.id && ACTIONS[el.id]) { try { await ACTIONS[el.id](); } catch { /* status satt av run() */ } }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target && e.target.id === "chat-input") ACTIONS["chat-send"]();
});

render();
refreshProject();
pollContext();
setInterval(pollContext, 2000);
setInterval(refreshProject, 15000);
