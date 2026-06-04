/*
 * Post Agent Bridge — UXP plugin for Adobe Photoshop.
 *
 * Connects to the Post Agent Tauri app's local WebSocket server
 * (ws://localhost:1733) and exposes a small command vocabulary that
 * lets Post Agent open, edit, and export Photoshop documents.
 *
 * Wire protocol — JSON text frames:
 *   Tauri  → Plugin: { type: "request",  request_id, command, params }
 *   Plugin → Tauri:  { type: "response", request_id, ok, result?, error? }
 *   Plugin → Tauri:  { type: "event",    event, data }
 *   Plugin → Tauri:  { type: "hello",    plugin_version, photoshop_version }
 */

const photoshop = require("photoshop");
const { app, action, core, constants, imaging } = photoshop;
const uxp = require("uxp");
const fs = uxp.storage.localFileSystem;

const BRIDGE_URL = "ws://localhost:1733";
const PLUGIN_VERSION = "0.1.0";
const RECONNECT_MIN_MS = 500;
const RECONNECT_MAX_MS = 8000;

let socket = null;
let reconnectDelay = RECONNECT_MIN_MS;
let reconnectTimer = null;
let notifierRegistered = false;

const dot = document.getElementById("dot");
const stateLabel = document.getElementById("state");
const metaLabel = document.getElementById("meta");
const logEl = document.getElementById("log");
const reconnectBtn = document.getElementById("reconnect");

reconnectBtn.addEventListener("click", () => {
  if (socket) {
    try { socket.close(); } catch (_) {}
  }
  reconnectDelay = RECONNECT_MIN_MS;
  connect();
});

function log(msg, kind) {
  const row = document.createElement("div");
  row.className = "row" + (kind ? " " + kind : "");
  const ts = new Date().toLocaleTimeString();
  row.textContent = `[${ts}] ${msg}`;
  logEl.appendChild(row);
  while (logEl.children.length > 80) logEl.removeChild(logEl.firstChild);
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(connected, detail) {
  dot.classList.toggle("ok", !!connected);
  dot.classList.toggle("bad", !connected);
  stateLabel.textContent = connected ? "Tilkoblet Post Agent" : "Frakoblet";
  metaLabel.textContent = detail || BRIDGE_URL;
}

function connect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  log(`Kobler til ${BRIDGE_URL}…`);
  try {
    socket = new WebSocket(BRIDGE_URL);
  } catch (err) {
    log(`new WebSocket: ${err.message || err}`, "err");
    scheduleReconnect();
    return;
  }

  socket.addEventListener("open", () => {
    reconnectDelay = RECONNECT_MIN_MS;
    setStatus(true);
    log("Tilkoblet", "ok");
    const hello = {
      type: "hello",
      plugin_version: PLUGIN_VERSION,
      photoshop_version: (app && app.version) || null,
    };
    safeSend(hello);
    registerActionNotifiers().catch((err) =>
      log(`registerActionNotifiers: ${err.message || err}`, "err"),
    );
  });

  socket.addEventListener("message", (event) => {
    let msg;
    try { msg = JSON.parse(event.data); }
    catch (err) { log(`bad json: ${err.message || err}`, "err"); return; }
    if (msg.type === "request") {
      handleRequest(msg).catch((err) => {
        log(`handler crash: ${err.message || err}`, "err");
        respond(msg.request_id, false, null, err.message || String(err));
      });
    }
  });

  socket.addEventListener("close", () => {
    setStatus(false);
    log("Tilkobling lukket");
    scheduleReconnect();
  });

  socket.addEventListener("error", () => {
    // WebSocket error events are intentionally opaque; "close" will fire
    // immediately after with the real reason.
    setStatus(false, "Tilkoblings­feil");
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
    connect();
  }, reconnectDelay);
}

function safeSend(obj) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  try { socket.send(JSON.stringify(obj)); }
  catch (err) { log(`send: ${err.message || err}`, "err"); }
}

function respond(requestId, ok, result, error) {
  safeSend({
    type: "response",
    request_id: requestId,
    ok,
    result: ok ? (result === undefined ? null : result) : null,
    error: ok ? null : error,
  });
}

function emitEvent(name, data) {
  safeSend({ type: "event", event: name, data: data === undefined ? null : data });
}

// ---------------------------------------------------------------------------
// Command dispatch
// ---------------------------------------------------------------------------

async function handleRequest(msg) {
  const { request_id, command, params } = msg;
  const handler = COMMANDS[command];
  if (!handler) {
    respond(request_id, false, null, `Ukjent kommando: ${command}`);
    return;
  }
  try {
    const result = await handler(params || {});
    respond(request_id, true, result);
  } catch (err) {
    respond(request_id, false, null, err.message || String(err));
  }
}

const COMMANDS = {
  ping: async () => ({ pong: true, time: Date.now() }),

  "app.info": async () => ({
    photoshop_version: (app && app.version) || null,
    locale: uxp.host && uxp.host.uiLocale,
    active_document: app.activeDocument ? documentSummary(app.activeDocument) : null,
    documents: app.documents.map(documentSummary),
  }),

  "doc.open": async ({ path }) => {
    assertString(path, "path");
    const entry = await fs.getEntryWithUrl("file:" + encodeURI(path));
    let opened;
    await core.executeAsModal(async () => {
      opened = await app.open(entry);
    }, { commandName: "Post Agent: open" });
    return documentSummary(opened || app.activeDocument);
  },

  "doc.save": async () => {
    await core.executeAsModal(async () => {
      await app.activeDocument.save();
    }, { commandName: "Post Agent: save" });
    return { saved: true };
  },

  "doc.export": async ({ path, format, quality }) => {
    assertString(path, "path");
    assertString(format, "format");
    const dir = path.substring(0, Math.max(path.lastIndexOf("/"), 0));
    const name = path.substring(path.lastIndexOf("/") + 1);
    const folder = await fs.getEntryWithUrl("file:" + encodeURI(dir));
    const file = await folder.createFile(name, { overwrite: true });
    await core.executeAsModal(async () => {
      const doc = app.activeDocument;
      const fmt = format.toLowerCase();
      if (fmt === "jpg" || fmt === "jpeg") {
        await doc.saveAs.jpg(file, { quality: quality ?? 10 });
      } else if (fmt === "png") {
        await doc.saveAs.png(file, { compression: 6 });
      } else if (fmt === "psd") {
        await doc.saveAs.psd(file, { maximizeCompatibility: true });
      } else if (fmt === "tiff" || fmt === "tif") {
        await doc.saveAs.tif(file);
      } else {
        throw new Error(`Ukjent eksportformat: ${format}`);
      }
    }, { commandName: "Post Agent: export" });
    return { path, format };
  },

  "smartObject.replace": async ({ layer_name, file_path }) => {
    assertString(layer_name, "layer_name");
    assertString(file_path, "file_path");
    const doc = requireActiveDocument();
    const layer = findLayerByName(doc, layer_name);
    if (!layer) throw new Error(`Fant ikke layer "${layer_name}"`);
    const entry = await fs.getEntryWithUrl("file:" + encodeURI(file_path));
    const token = await fs.createSessionToken(entry);
    await core.executeAsModal(async () => {
      doc.activeLayers = [layer];
      await action.batchPlay(
        [
          {
            _obj: "placedLayerReplaceContents",
            null: { _path: token, _kind: "local" },
            _options: { dialogOptions: "dontDisplay" },
          },
        ],
        {},
      );
    }, { commandName: "Post Agent: smart object replace" });
    return { layer_name, file_path };
  },

  "text.setContents": async ({ layer_name, contents }) => {
    assertString(layer_name, "layer_name");
    assertString(contents, "contents");
    const doc = requireActiveDocument();
    const layer = findLayerByName(doc, layer_name);
    if (!layer) throw new Error(`Fant ikke layer "${layer_name}"`);
    if (layer.kind !== constants.LayerKind.TEXT) {
      throw new Error(`Layer "${layer_name}" er ikke en text-layer`);
    }
    await core.executeAsModal(async () => {
      layer.textItem.contents = contents;
    }, { commandName: "Post Agent: set text" });
    return { layer_name, contents };
  },

  "layer.toggle": async ({ layer_name, visible }) => {
    assertString(layer_name, "layer_name");
    if (typeof visible !== "boolean") throw new Error("visible må være boolean");
    const doc = requireActiveDocument();
    const layer = findLayerByName(doc, layer_name);
    if (!layer) throw new Error(`Fant ikke layer "${layer_name}"`);
    await core.executeAsModal(async () => {
      layer.visible = visible;
    }, { commandName: "Post Agent: toggle layer" });
    return { layer_name, visible };
  },

  /*
   * List alle layers i aktivt dokument med metadata. Brukes av Firefly
   * Prompt Assistant for å gjette subject_description fra layer-navn,
   * og som generell introspection-API for Claude tool-use loops.
   *
   * Returnerer: { layers: [{name, kind, visible, has_text, is_smart_object}, ...] }
   * Layer-tre flatets ut — gruppe-medlemmer listes med parent-prefix.
   */
  "doc.listLayers": async () => {
    const doc = requireActiveDocument();
    const layers = [];
    const walk = (group, prefix) => {
      for (const layer of group.layers || []) {
        const fullName = prefix ? `${prefix}/${layer.name}` : layer.name;
        const kind = layer.kind ?? null;
        layers.push({
          name: fullName,
          kind: typeof kind === "string" ? kind : String(kind ?? "unknown"),
          visible: !!layer.visible,
          has_text: kind === "text" || !!layer.textItem,
          is_smart_object: kind === "smartObject",
        });
        if (layer.layers && layer.layers.length > 0) {
          walk(layer, fullName);
        }
      }
    };
    walk(doc, "");
    return { layers, count: layers.length };
  },

  /*
   * Selection-introspection: returnerer bounding box (top/left/bottom/
   * right + width/height) av aktiv selection i aktivt dokument, eller
   * `exists: false` hvis ingen aktiv selection finnes. Brukes for å
   * gi Claude/Firefly hint om hvor i bildet endringen skal skje.
   */
  "selection.info": async () => {
    const doc = requireActiveDocument();
    const sel = doc.selection;
    if (!sel || !sel.bounds) {
      return { exists: false };
    }
    const b = sel.bounds;
    // bounds kan være et UIScript-objekt eller en array — normaliser
    const top = b.top ?? b[1] ?? 0;
    const left = b.left ?? b[0] ?? 0;
    const bottom = b.bottom ?? b[3] ?? 0;
    const right = b.right ?? b[2] ?? 0;
    const width = right - left;
    const height = bottom - top;
    if (width <= 0 || height <= 0) {
      return { exists: false };
    }
    return {
      exists: true,
      bounds: { top, left, bottom, right },
      width,
      height,
      doc_width: doc.width,
      doc_height: doc.height,
      coverage_pct: Math.round(((width * height) / (doc.width * doc.height)) * 100),
    };
  },

  /*
   * Hent base64-encoded thumbnail av aktivt dokument. Bruker imaging-API
   * sin targetSize for automatisk skalering — lengste side blir
   * `max_size` (default 1024px). Returnerer:
   *   { base64, width, height, doc_width, doc_height, mime_type }
   *
   * Brukes for å sende live-thumbnails til Claude vision-API slik at
   * AI Creative Director kan SE bildet, ikke bare høre beskrivelser.
   */
  "doc.thumbnail": async ({ max_size } = {}) => {
    const doc = requireActiveDocument();
    const targetMax = typeof max_size === "number" && max_size > 0 ? max_size : 1024;
    const longSide = Math.max(doc.width, doc.height);
    const scale = Math.min(1, targetMax / longSide);
    const targetW = Math.max(1, Math.round(doc.width * scale));
    const targetH = Math.max(1, Math.round(doc.height * scale));

    let base64 = "";
    await core.executeAsModal(async () => {
      const pixels = await imaging.getPixels({
        documentID: doc.id,
        targetSize: { width: targetW, height: targetH },
        componentSize: 8,
        applyAlpha: true,
      });
      const encoded = await imaging.encodeImageData({
        imageData: pixels.imageData,
        base64: true,
      });
      base64 = typeof encoded === "string" ? encoded : "";
      // Frigjør memory — UXP imaging-API krever explicit dispose
      pixels.imageData.dispose();
    }, { commandName: "Post Agent: capture thumbnail" });

    return {
      base64,
      width: targetW,
      height: targetH,
      doc_width: doc.width,
      doc_height: doc.height,
      mime_type: "image/png",
    };
  },

  /*
   * Last en PNG-mask som Photoshop selection. Brukes for å pre-definere
   * regionen før gen.fill — Claude kan generere/levere en alpha-mask
   * og kalle denne i stedet for å la brukeren manuelt tegne selection.
   *
   * Implementasjon: åpner mask-fila som midlertidig dokument, kopierer
   * dens content som channel-data til aktivt dokument, laster channel
   * som selection, lukker mask-doc uten å lagre.
   *
   * Krav: mask-fila må ha samme dimensjoner som aktivt dokument
   * (resize ikke implementert i V1 — Claude bør levere riktig størrelse).
   *
   * threshold (0-255, default 128) styrer hva som regnes som "selected"
   * fra grayscale mask-pixels.
   */
  "selection.fromMask": async ({ mask_path, threshold }) => {
    assertString(mask_path, "mask_path");
    const targetDoc = requireActiveDocument();
    const docW = targetDoc.width;
    const docH = targetDoc.height;
    const thr = typeof threshold === "number" ? threshold : 128;

    let pixelsSelected = 0;
    await core.executeAsModal(async () => {
      // Åpne mask-fila som midlertidig doc
      const maskEntry = await fs.getEntryWithUrl("file:" + encodeURI(mask_path));
      const maskDoc = await app.open(maskEntry);
      try {
        if (maskDoc.width !== docW || maskDoc.height !== docH) {
          throw new Error(
            `Mask-dimensjoner ${maskDoc.width}×${maskDoc.height} matcher ikke doc ${docW}×${docH}. Resize mask manuelt eller via Photoshop.`,
          );
        }

        // Les mask-pixels via imaging-API
        const pixels = await imaging.getPixels({
          documentID: maskDoc.id,
          componentSize: 8,
          applyAlpha: false,
        });

        // Bygg en boolean-array fra grayscale-input (gjennomsnitt RGB)
        const data = await pixels.imageData.getData();
        const components = pixels.imageData.components;
        const total = maskDoc.width * maskDoc.height;
        const maskArr = new Uint8Array(total);
        for (let i = 0; i < total; i++) {
          // Gjennomsnitt over R+G+B (eller bruk alpha hvis tilstede)
          let sum = 0;
          for (let c = 0; c < Math.min(3, components); c++) {
            sum += data[i * components + c];
          }
          const gray = sum / Math.min(3, components);
          maskArr[i] = gray > thr ? 255 : 0;
          if (maskArr[i] === 255) pixelsSelected++;
        }
        pixels.imageData.dispose();

        // Lukk mask-doc før vi bytter aktivt
        await maskDoc.closeWithoutSaving();

        // Push selection til aktivt dokument via putSelection
        const selImageData = await imaging.createImageData({
          width: docW,
          height: docH,
          components: 1,
          colorSpace: "Grayscale",
          colorProfile: "",
          pixelFormat: "PixelByPixel",
        });
        await selImageData.setData({ data: maskArr });
        await imaging.putSelection({
          documentID: targetDoc.id,
          imageData: selImageData,
        });
        selImageData.dispose();
      } catch (err) {
        try {
          await maskDoc.closeWithoutSaving();
        } catch {
          /* ignored — doc kanskje allerede lukket */
        }
        throw err;
      }
    }, { commandName: "Post Agent: selection from mask" });

    return {
      mask_path,
      pixels_selected: pixelsSelected,
      doc_width: docW,
      doc_height: docH,
    };
  },

  /*
   * History-snapshot: lager et navngitt history-state i Photoshop som
   * kan rolles tilbake til via history.revert. Brukes av Multi-Agent
   * Director for trygge AI-eksperimenter — "test denne endringen, kan
   * reverteres om brukeren ikke liker".
   *
   * Bruker batchPlay-make-snapshotEvent som lager et new history-state.
   * Returnerer state-navnet så caller kan referere det senere.
   */
  "history.snapshot": async ({ name } = {}) => {
    const doc = requireActiveDocument();
    const snapshotName = name || `Post Agent ${new Date().toISOString().slice(11, 19)}`;
    await core.executeAsModal(async () => {
      await action.batchPlay(
        [
          {
            _obj: "make",
            _target: [{ _ref: "snapshotClass" }],
            from: { _ref: "historyState", _property: "currentHistoryState" },
            name: snapshotName,
          },
        ],
        {},
      );
    }, { commandName: "Post Agent: history snapshot" });
    return { snapshot_name: snapshotName, doc_name: doc.name };
  },

  /*
   * History-revert: går tilbake til navngitt history-state. Hvis state
   * ikke finnes, kaster en feil — Multi-Agent Director kan fange den
   * og falle tilbake til full revert (doc.open på siste lagrede).
   */
  "history.revert": async ({ name }) => {
    assertString(name, "name");
    const doc = requireActiveDocument();
    await core.executeAsModal(async () => {
      await action.batchPlay(
        [
          {
            _obj: "select",
            _target: [{ _ref: "snapshotClass", _name: name }],
          },
        ],
        {},
      );
    }, { commandName: "Post Agent: history revert" });
    return { reverted_to: name, doc_name: doc.name };
  },

  /*
   * Resolve command-router: send en kommando til watch-resolve-commands.lua
   * (som må kjøres i Resolve) og vent på respons. Filsystem-basert IPC:
   *   - Skriv request til ~/PostAgent/resolve-commands/<id>.json
   *   - Vent til ~/PostAgent/resolve-results/<id>.json dukker opp
   *   - Les respons + slett fra results
   *
   * timeout_ms (default 15000) styrer hvor lenge vi venter på respons.
   * Hvis Resolve Lua-script ikke kjører eller ikke svarer, kaster vi feil.
   *
   * Supported commands (per Lua-handlers): quickExport.list, quickExport.run,
   * project.info, mediaPool.listItems. Utvid Lua-script for flere.
   */
  "resolve.sendCommand": async ({ name, args, timeout_ms } = {}) => {
    assertString(name, "name");
    const home = await fs.getFolder("home").catch(() => null);
    if (!home) throw new Error("Klarte ikke åpne home-folder");

    let postAgent;
    try {
      postAgent = await home.getEntry("PostAgent");
    } catch {
      postAgent = await home.createFolder("PostAgent");
    }
    let commandsDir;
    try {
      commandsDir = await postAgent.getEntry("resolve-commands");
    } catch {
      commandsDir = await postAgent.createFolder("resolve-commands");
    }
    let resultsDir;
    try {
      resultsDir = await postAgent.getEntry("resolve-results");
    } catch {
      resultsDir = await postAgent.createFolder("resolve-results");
    }

    const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const requestPayload = JSON.stringify({ id, name, args: args || {} });
    const reqFile = await commandsDir.createFile(`${id}.json`, { overwrite: true });
    await reqFile.write(requestPayload, { format: "utf8" });

    // Poll results-folder for matching <id>.json
    const deadline = Date.now() + (typeof timeout_ms === "number" ? timeout_ms : 15000);
    const pollIntervalMs = 200;
    while (Date.now() < deadline) {
      try {
        const respEntry = await resultsDir.getEntry(`${id}.json`);
        const respText = await respEntry.read({ format: "utf8" });
        // Rydd opp
        try { await respEntry.delete(); } catch { /* ignored */ }
        const parsed = JSON.parse(respText);
        if (parsed.ok === false) {
          throw new Error(parsed.error || "Resolve-handler feilet");
        }
        return parsed.result ?? parsed;
      } catch (e) {
        // Hvis getEntry feiler er det fordi filen ikke finnes enda — vent
        if (e instanceof Error && e.message.includes("Resolve-handler")) throw e;
      }
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
    throw new Error(
      `Timeout (${timeout_ms ?? 15000}ms): Resolve svarte ikke. Kjører watch-resolve-commands.lua i Resolve?`,
    );
  },

  "resolve.quickExportList": async () => {
    return await COMMANDS["resolve.sendCommand"]({ name: "quickExport.list" });
  },

  "resolve.quickExportRun": async ({ preset_name, target_dir, custom_name, video_quality } = {}) => {
    assertString(preset_name, "preset_name");
    const params = {};
    if (target_dir) params.TargetDir = target_dir;
    if (custom_name) params.CustomName = custom_name;
    if (video_quality) params.VideoQuality = video_quality;
    return await COMMANDS["resolve.sendCommand"]({
      name: "quickExport.run",
      args: { preset_name, params },
      timeout_ms: 120000, // render kan ta lang tid
    });
  },

  "resolve.projectInfo": async () => {
    return await COMMANDS["resolve.sendCommand"]({ name: "project.info" });
  },

  "resolve.mediaPoolListItems": async () => {
    return await COMMANDS["resolve.sendCommand"]({ name: "mediaPool.listItems" });
  },

  "resolve.powerGradeList": async () => {
    return await COMMANDS["resolve.sendCommand"]({ name: "powerGrade.list" });
  },

  "resolve.powerGradeCreate": async ({ name } = {}) => {
    return await COMMANDS["resolve.sendCommand"]({
      name: "powerGrade.create",
      args: { name: name || "" },
    });
  },

  "resolve.powerGradeExport": async ({ album_name, folder_path, prefix, format } = {}) => {
    assertString(album_name, "album_name");
    assertString(folder_path, "folder_path");
    return await COMMANDS["resolve.sendCommand"]({
      name: "powerGrade.export",
      args: { album_name, folder_path, prefix: prefix || "postagent_grade", format: format || "drx" },
    });
  },

  /*
   * Resolve 21 AI: 5 scriptable AI-funksjoner via command-router. Krever
   * AI-modeller nedlastet i Resolve → Preferences → AI.
   */
  "resolve.audioTranscribe": async ({ clip_id, use_speaker_detection } = {}) => {
    return await COMMANDS["resolve.sendCommand"]({
      name: "audio.transcribe",
      args: { clip_id, use_speaker_detection: !!use_speaker_detection },
      timeout_ms: 300000, // transkripsjon kan ta lang tid
    });
  },

  "resolve.audioClassify": async ({ clip_id } = {}) => {
    return await COMMANDS["resolve.sendCommand"]({
      name: "audio.classify",
      args: { clip_id },
      timeout_ms: 300000,
    });
  },

  "resolve.speechGenerate": async ({ text, voice, timecode, model, add_to_timeline } = {}) => {
    assertString(text, "text");
    return await COMMANDS["resolve.sendCommand"]({
      name: "speech.generate",
      args: {
        text,
        voice: voice || "",
        timecode: timecode || "00:00:00:00",
        model: model || "",
        add_to_timeline: !!add_to_timeline,
      },
      timeout_ms: 120000,
    });
  },

  "resolve.slateAnalyze": async ({ clip_id, marker_color } = {}) => {
    return await COMMANDS["resolve.sendCommand"]({
      name: "slate.analyze",
      args: { clip_id, marker_color: marker_color || "Yellow" },
      timeout_ms: 180000,
    });
  },

  "resolve.timelineSmartReframe": async () => {
    return await COMMANDS["resolve.sendCommand"]({
      name: "timeline.smartReframe",
      args: {},
      timeout_ms: 180000,
    });
  },

  "resolve.timelineGetCurrentItem": async () => {
    return await COMMANDS["resolve.sendCommand"]({
      name: "timeline.getCurrentItem",
      args: {},
    });
  },

  "resolve.magicMaskCreate": async ({ mode } = {}) => {
    return await COMMANDS["resolve.sendCommand"]({
      name: "magicMask.create",
      args: { mode: mode || "BI" },
      timeout_ms: 180000,
    });
  },

  "resolve.magicMaskRegenerate": async () => {
    return await COMMANDS["resolve.sendCommand"]({
      name: "magicMask.regenerate",
      args: {},
      timeout_ms: 180000,
    });
  },

  "resolve.dolbyVisionAnalyze": async () => {
    return await COMMANDS["resolve.sendCommand"]({
      name: "dolbyVision.analyze",
      args: {},
      timeout_ms: 300000,
    });
  },

  /*
   * Resolve 21 AI IntelliSearch-bro: les den nyeste analyse-resultat-
   * filen fra ~/PostAgent/intellisearch/ som ble skrevet av Resolve
   * Lua-scriptet analyze-intellisearch.lua. Brukes av Multi-Agent
   * Director for å lese ekte AI face/object-data fra Resolve i stedet
   * for syntetiske signals.
   *
   * Returnerer: { found, file, schema_version, project, folder, epoch,
   *               items: [{media_pool_item_id, clip_name, file_path, ...}] }
   * Eller: { found: false } hvis ingen analyse er kjørt enda.
   */
  "resolve.readIntellisearch": async ({ clip_name_filter } = {}) => {
    const home = await fs.getFolder("home").catch(() => null);
    if (!home) throw new Error("Klarte ikke åpne home-folder");
    let isDir;
    try {
      const postAgent = await home.getEntry("PostAgent");
      isDir = await postAgent.getEntry("intellisearch");
    } catch {
      return { found: false, hint: "Kjør analyze-intellisearch.lua i Resolve først." };
    }
    if (!isDir.isFolder) return { found: false };

    const entries = await isDir.getEntries();
    const jsons = entries.filter((e) => e.isFile && /\.json$/i.test(e.name));
    if (jsons.length === 0) {
      return { found: false, hint: "Ingen analyse-filer enda. Kjør analyze-intellisearch.lua i Resolve." };
    }

    // Nyeste fil (epoch i navnet sorterer korrekt som streng)
    jsons.sort((a, b) => b.name.localeCompare(a.name));
    const newest = jsons[0];
    const text = await newest.read({ format: "utf8" });
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { found: false, hint: "Klarte ikke parse JSON: " + newest.name };
    }

    let items = parsed.items || [];
    if (typeof clip_name_filter === "string" && clip_name_filter.length > 0) {
      const f = clip_name_filter.toLowerCase();
      items = items.filter((i) => (i.clip_name || "").toLowerCase().includes(f));
    }

    return {
      found: true,
      file: newest.nativePath,
      schema_version: parsed.schema_version,
      project: parsed.project,
      folder: parsed.folder,
      epoch: parsed.epoch,
      mode: parsed.mode,
      items,
      total: items.length,
    };
  },

  /*
   * Resolve-bro: list stills i ~/PostAgent/inbox/ som er eksportert
   * fra DaVinci Resolve via export-still-to-postagent.lua. Returnerer
   * filer sortert nyeste først med metadata fra sidefil hvis tilgjengelig.
   */
  "resolve.listInbox": async () => {
    const home = await fs.getFolder("home").catch(() => null);
    if (!home) throw new Error("Klarte ikke åpne home-folder");
    let inbox;
    try {
      const postAgent = await home.getEntry("PostAgent");
      inbox = await postAgent.getEntry("inbox");
    } catch {
      return { items: [], inbox_dir: null, count: 0 };
    }
    if (!inbox.isFolder) return { items: [], inbox_dir: null, count: 0 };
    const entries = await inbox.getEntries();
    const stills = entries.filter((e) => e.isFile && /\.(png|tif|tiff|jpg|jpeg|psd)$/i.test(e.name));
    const items = await Promise.all(
      stills.map(async (entry) => {
        const prefix = entry.name.replace(/\.[^.]+$/, "");
        let metadata = null;
        const meta = entries.find((e) => e.name === prefix + ".json");
        if (meta) {
          try {
            const text = await meta.read({ format: "utf8" });
            metadata = JSON.parse(text);
          } catch {
            // metadata er optional
          }
        }
        return { path: entry.nativePath, name: entry.name, metadata };
      }),
    );
    items.sort((a, b) => b.name.localeCompare(a.name));
    return { items, inbox_dir: inbox.nativePath, count: items.length };
  },

  /*
   * Åpne nyeste still fra Resolve-inbox direkte i Photoshop. Kaller
   * doc.open under panseret.
   */
  "resolve.openLatest": async () => {
    const result = await COMMANDS["resolve.listInbox"]({});
    if (!result.items || result.items.length === 0) {
      throw new Error("Ingen still i ~/PostAgent/inbox/. Kjør export-still-to-postagent.lua i Resolve først.");
    }
    const newest = result.items[0];
    await COMMANDS["doc.open"]({ path: newest.path });
    return { opened: newest.path, metadata: newest.metadata ?? null };
  },

  /*
   * Eksporter aktivt dokument til ~/PostAgent/outbox/. Resolve-scriptet
   * insert-from-postagent.lua importerer dette tilbake til Media Pool.
   */
  "resolve.exportBack": async ({ format, quality } = {}) => {
    const doc = requireActiveDocument();
    const fmt = (format || "png").toLowerCase();
    const home = await fs.getFolder("home").catch(() => null);
    if (!home) throw new Error("Klarte ikke åpne home-folder");

    let postAgent;
    try {
      postAgent = await home.getEntry("PostAgent");
    } catch {
      postAgent = await home.createFolder("PostAgent");
    }
    let outbox;
    try {
      outbox = await postAgent.getEntry("outbox");
    } catch {
      outbox = await postAgent.createFolder("outbox");
    }

    const stem = (doc.name || `postagent-${Date.now()}`).replace(/\.[^.]+$/, "");
    const fileName = `${stem}.${fmt}`;
    const outFile = await outbox.createFile(fileName, { overwrite: true });

    await core.executeAsModal(async () => {
      if (fmt === "jpg" || fmt === "jpeg") {
        await doc.saveAs.jpg(outFile, { quality: quality ?? 10 });
      } else if (fmt === "png") {
        await doc.saveAs.png(outFile, { compression: 6 });
      } else if (fmt === "tif" || fmt === "tiff") {
        await doc.saveAs.tif(outFile);
      } else if (fmt === "psd") {
        await doc.saveAs.psd(outFile, { maximizeCompatibility: true });
      } else {
        throw new Error(`Ukjent format: ${fmt}`);
      }
    }, { commandName: "Post Agent: export back to Resolve" });

    // Bevar metadata fra original inbox-fil (hvis tilgjengelig) så
    // insert-from-postagent.lua kan auto-replace timeline-clipet.
    // Vi matcher på filnavn: doc.name "<epoch>_<project>_<timecode>" → samme prefix-.json i inbox.
    let metadataPreserved = false;
    try {
      const inbox = await postAgent.getEntry("inbox");
      const inboxEntries = await inbox.getEntries();
      const metaCandidate = inboxEntries.find((e) => e.name === stem + ".json");
      if (metaCandidate) {
        const text = await metaCandidate.read({ format: "utf8" });
        const outMetaFile = await outbox.createFile(stem + ".json", { overwrite: true });
        await outMetaFile.write(text, { format: "utf8" });
        metadataPreserved = true;
      }
    } catch {
      // metadata er optional — auto-replace blir bare ikke tilgjengelig
    }

    return {
      exported_to: outFile.nativePath,
      outbox_dir: outbox.nativePath,
      metadata_preserved: metadataPreserved,
      next_step: metadataPreserved
        ? "Kjør insert-from-postagent.lua i Resolve — auto-replace aktivert"
        : "Kjør insert-from-postagent.lua i Resolve (ingen original-clip-metadata → ny media-import)",
    };
  },

  /*
   * Template-scan: åpner en .psd, leter etter alle layers med navn `{{key}}`
   * og returnerer en katalog over feltene. Text-layers blir string-felt;
   * smart objects blir file-felt. Andre layer-typer ignoreres.
   * Åpningen er midlertidig — vi lukker uten å lagre etterpå.
   */
  "template.scan": async ({ template_path }) => {
    assertString(template_path, "template_path");
    const entry = await fs.getEntryWithUrl("file:" + encodeURI(template_path));
    let fields = [];
    let all_candidates = [];
    let template_summary = null;
    await core.executeAsModal(async () => {
      const doc = await app.open(entry);
      try {
        template_summary = documentSummary(doc);
        fields = collectTemplateFields(doc);
        all_candidates = collectFillableCandidates(doc);
      } finally {
        await doc.closeWithoutSaving();
      }
    }, { commandName: "Post Agent: template scan" });
    return { template_path, template: template_summary, fields, all_candidates };
  },

  /*
   * Template auto-rename: åpner template, gir alle layers i `mappings`
   * navn på formen `{{new_key}}`, lagrer som en KOPI (output_path)
   * — originalen er urørt. Lar Irlin slippe å manuelt navngi layers
   * i Photoshop før hun bruker template-systemet.
   */
  /*
   * Template-scaffold: lager en ny PSD-fil fra scratch med spec.
   * Hver text-felt blir et TextLayer navngitt {{key}} med en
   * placeholder-tekst. Brukeren får en PSD klar til å bli fylt av
   * template-systemet — slipper å starte fra blankt i Photoshop.
   *
   * spec: { width, height, background_color?, fields: [{ key, type, hint, x?, y?, font_size? }] }
   * type kan være "text" (vi lager TextLayer) eller "image_placeholder"
   * (vi lager en farget rektangel-layer som Irlin kan høyreklikke →
   * Convert to Smart Object i Photoshop manuelt).
   */
  "template.scaffold": async ({ output_path, spec }) => {
    assertString(output_path, "output_path");
    if (!spec || typeof spec !== "object") throw new Error("spec må være et objekt");
    const { width, height, fields, background_color } = spec;
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      throw new Error("spec.width og spec.height må være tall");
    }
    if (!Array.isArray(fields)) throw new Error("spec.fields må være en array");

    const outDir = output_path.substring(0, Math.max(output_path.lastIndexOf("/"), 0));
    const outName = output_path.substring(output_path.lastIndexOf("/") + 1);
    const outFolder = await fs.getEntryWithUrl("file:" + encodeURI(outDir));
    const bg = background_color || { red: 240, green: 240, blue: 240 };

    const createdLayers = [];
    await core.executeAsModal(async () => {
      // Lag dokument
      const doc = await app.createDocument({
        width,
        height,
        resolution: 72,
        mode: "RGBColorMode",
        fill: "white",
        title: spec.name || "Post Agent template",
      });

      // Fyll bakgrunn med background_color via batchPlay
      await action.batchPlay(
        [
          {
            _obj: "set",
            _target: [{ _ref: "color", _property: "foregroundColor" }],
            to: {
              _obj: "RGBColor",
              red: bg.red,
              green: bg.green,
              blue: bg.blue,
            },
          },
          {
            _obj: "fill",
            using: { _enum: "fillContents", _value: "foregroundColor" },
          },
        ],
        {},
      );

      // For hver field, lag en layer
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        if (!f.key) continue;
        const layerName = `{{${f.key}}}`;
        if (f.type === "text") {
          // Plasser text-layeren ca. 10% inn fra venstre, jevnt fordelt vertikalt
          const x = f.x ?? Math.round(width * 0.08);
          const y = f.y ?? Math.round(height * (0.15 + (i / Math.max(fields.length, 1)) * 0.6));
          const fontSize = f.font_size ?? Math.round(height / 20);
          const placeholder = f.hint || layerName;
          await action.batchPlay(
            [
              {
                _obj: "make",
                _target: [{ _ref: "textLayer" }],
                using: {
                  _obj: "textLayer",
                  name: layerName,
                  textKey: placeholder,
                  textClickPoint: {
                    _obj: "paint",
                    horizontal: { _unit: "percentUnit", _value: (x / width) * 100 },
                    vertical: { _unit: "percentUnit", _value: (y / height) * 100 },
                  },
                  textStyleRange: [
                    {
                      _obj: "textStyleRange",
                      from: 0,
                      to: placeholder.length,
                      textStyle: {
                        _obj: "textStyle",
                        fontPostScriptName: "Helvetica",
                        size: { _unit: "pointsUnit", _value: fontSize },
                        color: { _obj: "RGBColor", red: 30, green: 30, blue: 30 },
                      },
                    },
                  ],
                },
              },
            ],
            {},
          );
          createdLayers.push({ key: f.key, type: "text", layer_name: layerName });
        } else if (f.type === "image_placeholder") {
          // Lag en smart-object-layer fra eksisterende fil-path.
          // Hvis ingen file_path er gitt, skip — UI-en vil måtte be brukeren
          // legge til bildet manuelt etterpå (raster-only-tilfelle).
          if (!f.file_path) {
            createdLayers.push({
              key: f.key,
              type: "image_placeholder",
              layer_name: layerName,
              skipped: "no file_path provided",
            });
            continue;
          }
          try {
            const fileEntry = await fs.getEntryWithUrl("file:" + encodeURI(f.file_path));
            const token = await fs.createSessionToken(fileEntry);
            // placedFile batchPlay lager smart-object-layer fra fila
            await action.batchPlay(
              [
                {
                  _obj: "placedFile",
                  null: { _path: token, _kind: "local" },
                  freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
                  offset: {
                    _obj: "offset",
                    horizontal: { _unit: "pixelsUnit", _value: 0 },
                    vertical: { _unit: "pixelsUnit", _value: 0 },
                  },
                  _options: { dialogOptions: "dontDisplay" },
                },
              ],
              {},
            );
            // Newly placed layer is now activeLayer — rename den til {{key}}
            if (doc.activeLayers && doc.activeLayers.length > 0) {
              doc.activeLayers[0].name = layerName;
            }
            createdLayers.push({
              key: f.key,
              type: "image_placeholder",
              layer_name: layerName,
              file_path: f.file_path,
            });
          } catch (err) {
            createdLayers.push({
              key: f.key,
              type: "image_placeholder",
              layer_name: layerName,
              error: err.message || String(err),
            });
          }
        }
      }

      // Lagre som PSD
      const outFile = await outFolder.createFile(outName, { overwrite: true });
      await doc.saveAs.psd(outFile, { maximizeCompatibility: true });
    }, { commandName: "Post Agent: template scaffold" });

    return {
      output_path,
      created_layers: createdLayers,
      notes:
        "Smart-object-felter må legges til manuelt i Photoshop (File → Place Embedded + gi navn {{key}}). Vi støtter foreløpig bare text-scaffolding.",
    };
  },

  "template.autoRename": async ({ template_path, output_path, mappings }) => {
    assertString(template_path, "template_path");
    assertString(output_path, "output_path");
    if (!Array.isArray(mappings) || mappings.length === 0) {
      throw new Error("mappings må være en non-empty array av { layer_name, new_key }");
    }
    const entry = await fs.getEntryWithUrl("file:" + encodeURI(template_path));
    const outDir = output_path.substring(0, Math.max(output_path.lastIndexOf("/"), 0));
    const outName = output_path.substring(output_path.lastIndexOf("/") + 1);
    const outFolder = await fs.getEntryWithUrl("file:" + encodeURI(outDir));
    let result;
    await core.executeAsModal(async () => {
      const doc = await app.open(entry);
      try {
        result = await renameLayersToFieldKeys(doc, mappings);
        const outFile = await outFolder.createFile(outName, { overwrite: true });
        await doc.saveAs.psd(outFile, { maximizeCompatibility: true });
      } finally {
        await doc.closeWithoutSaving();
      }
    }, { commandName: "Post Agent: template auto-rename" });
    return { template_path, output_path, ...result };
  },

  /*
   * Template-render: åpner template, fyller hver `{{key}}`-layer med
   * verdien fra data, eksporterer til output_path, og lukker uten å lagre
   * — så templatet selv aldri muteres på disk.
   */
  "template.render": async ({ template_path, data, output_path, format, quality }) => {
    assertString(template_path, "template_path");
    assertString(output_path, "output_path");
    assertString(format, "format");
    if (!data || typeof data !== "object") throw new Error("data må være et objekt");

    const templateEntry = await fs.getEntryWithUrl("file:" + encodeURI(template_path));
    const outDir = output_path.substring(0, Math.max(output_path.lastIndexOf("/"), 0));
    const outName = output_path.substring(output_path.lastIndexOf("/") + 1);
    const outFolder = await fs.getEntryWithUrl("file:" + encodeURI(outDir));

    const applied = [];
    const skipped = [];

    await core.executeAsModal(async () => {
      const doc = await app.open(templateEntry);
      try {
        const fields = collectTemplateFields(doc);
        const fieldsByKey = new Map(fields.map((f) => [f.key, f]));
        for (const [key, value] of Object.entries(data)) {
          const field = fieldsByKey.get(key);
          if (!field) {
            skipped.push({ key, reason: "no matching layer" });
            continue;
          }
          const layer = findLayerByName(doc, field.layer_name);
          if (!layer) {
            skipped.push({ key, reason: "layer disappeared" });
            continue;
          }
          if (field.type === "text") {
            if (typeof value !== "string") {
              skipped.push({ key, reason: "text expects string" });
              continue;
            }
            layer.textItem.contents = value;
            applied.push({ key, type: "text" });
          } else if (field.type === "image") {
            if (typeof value !== "string" || !value) {
              skipped.push({ key, reason: "image expects file path" });
              continue;
            }
            const fileEntry = await fs.getEntryWithUrl("file:" + encodeURI(value));
            const token = await fs.createSessionToken(fileEntry);
            doc.activeLayers = [layer];
            await action.batchPlay(
              [
                {
                  _obj: "placedLayerReplaceContents",
                  null: { _path: token, _kind: "local" },
                  _options: { dialogOptions: "dontDisplay" },
                },
              ],
              {},
            );
            applied.push({ key, type: "image" });
          }
        }

        // Export
        const outFile = await outFolder.createFile(outName, { overwrite: true });
        const fmt = format.toLowerCase();
        if (fmt === "jpg" || fmt === "jpeg") {
          await doc.saveAs.jpg(outFile, { quality: quality ?? 10 });
        } else if (fmt === "png") {
          await doc.saveAs.png(outFile, { compression: 6 });
        } else if (fmt === "psd") {
          await doc.saveAs.psd(outFile, { maximizeCompatibility: true });
        } else if (fmt === "tiff" || fmt === "tif") {
          await doc.saveAs.tif(outFile);
        } else {
          throw new Error(`Ukjent eksportformat: ${format}`);
        }
      } finally {
        await doc.closeWithoutSaving();
      }
    }, { commandName: "Post Agent: template render" });

    return { template_path, output_path, format, applied, skipped };
  },

  /*
   * Batch-render: kjører `template.render` N ganger fra samme template,
   * én per item i `items`. Hver item er `{data, output_path, format?, quality?}`.
   * `default_format`/`default_quality` brukes når item ikke spesifiserer.
   *
   * Hver render åpner templatet på nytt og lukker uten å lagre — det
   * garanterer at felter som ikke er med i item N ikke arver verdier fra
   * item N-1. Trade-off: tregere enn å holde dokumentet åpent, men
   * trivialt korrekt.
   *
   * Resultat: { template_path, items: [{output_path, applied[], skipped[]}], failed[] }
   */
  "batch.run": async ({ template_path, items, default_format, default_quality }) => {
    assertString(template_path, "template_path");
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('"items" må være en non-empty array');
    }

    const templateEntry = await fs.getEntryWithUrl("file:" + encodeURI(template_path));
    const results = [];
    const failed = [];

    await core.executeAsModal(async () => {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemFormat = item.format || default_format;
        const itemQuality = item.quality ?? default_quality ?? 10;

        try {
          if (!item.output_path) throw new Error(`item[${i}].output_path mangler`);
          if (!itemFormat) throw new Error(`item[${i}].format mangler (og ingen default_format)`);
          if (!item.data || typeof item.data !== "object") {
            throw new Error(`item[${i}].data må være et objekt`);
          }

          const outDir = item.output_path.substring(0, Math.max(item.output_path.lastIndexOf("/"), 0));
          const outName = item.output_path.substring(item.output_path.lastIndexOf("/") + 1);
          const outFolder = await fs.getEntryWithUrl("file:" + encodeURI(outDir));

          const doc = await app.open(templateEntry);
          const applied = [];
          const skipped = [];
          try {
            const fields = collectTemplateFields(doc);
            const fieldsByKey = new Map(fields.map((f) => [f.key, f]));
            for (const [key, value] of Object.entries(item.data)) {
              const field = fieldsByKey.get(key);
              if (!field) {
                skipped.push({ key, reason: "no matching layer" });
                continue;
              }
              const layer = findLayerByName(doc, field.layer_name);
              if (!layer) {
                skipped.push({ key, reason: "layer disappeared" });
                continue;
              }
              if (field.type === "text") {
                if (typeof value !== "string") {
                  skipped.push({ key, reason: "text expects string" });
                  continue;
                }
                layer.textItem.contents = value;
                applied.push({ key, type: "text" });
              } else if (field.type === "image") {
                if (typeof value !== "string" || !value) {
                  skipped.push({ key, reason: "image expects file path" });
                  continue;
                }
                const fileEntry = await fs.getEntryWithUrl("file:" + encodeURI(value));
                const token = await fs.createSessionToken(fileEntry);
                doc.activeLayers = [layer];
                await action.batchPlay(
                  [
                    {
                      _obj: "placedLayerReplaceContents",
                      null: { _path: token, _kind: "local" },
                      _options: { dialogOptions: "dontDisplay" },
                    },
                  ],
                  {},
                );
                applied.push({ key, type: "image" });
              }
            }

            const outFile = await outFolder.createFile(outName, { overwrite: true });
            const fmt = itemFormat.toLowerCase();
            if (fmt === "jpg" || fmt === "jpeg") {
              await doc.saveAs.jpg(outFile, { quality: itemQuality });
            } else if (fmt === "png") {
              await doc.saveAs.png(outFile, { compression: 6 });
            } else if (fmt === "psd") {
              await doc.saveAs.psd(outFile, { maximizeCompatibility: true });
            } else if (fmt === "tiff" || fmt === "tif") {
              await doc.saveAs.tif(outFile);
            } else {
              throw new Error(`Ukjent eksportformat: ${itemFormat}`);
            }

            results.push({ index: i, output_path: item.output_path, format: fmt, applied, skipped });
          } finally {
            await doc.closeWithoutSaving();
          }
        } catch (err) {
          failed.push({ index: i, output_path: item.output_path || null, error: String(err && err.message ? err.message : err) });
        }
      }
    }, { commandName: "Post Agent: batch render" });

    return { template_path, total: items.length, succeeded: results.length, failed_count: failed.length, items: results, failed };
  },

  /*
   * Multi-aspect-eksport: fra én master-PSD, render ut N varianter
   * med ulike aspect-ratios. Bruker "fill-by-resize + center-crop" som
   * default — mest brukbart for sosial-pakker.
   *
   * `target_long_edge` (px) styrer outputstørrelsen: longest side blir
   * dette tallet, kort side beregnes ut fra aspect.
   *   1080 + "1:1"  → 1080×1080
   *   1080 + "9:16" → 1080×1920
   *   1080 + "16:9" → 1920×1080
   *   1080 + "4:5"  → 1080×1350
   *
   * Hver iteration åpner master på nytt → ingen mutasjons-arv.
   */
  /*
   * Sett aktiv selection via en enkel mode.
   * V1 støtter: "all", "none", "invert".
   * (PNG-mask-import + threshold-til-selection kommer i en senere
   *  iterasjon — krever copy/paste channel-flow som er mer kompleks.)
   */
  "selection.select": async ({ mode }) => {
    assertString(mode, "mode");
    const doc = requireActiveDocument();
    await core.executeAsModal(async () => {
      switch (mode) {
        case "all":
          await doc.selection.selectAll();
          break;
        case "none":
          await doc.selection.deselect();
          break;
        case "invert":
          await doc.selection.invert();
          break;
        default:
          throw new Error(`Ukjent selection mode: ${mode}. Støtter: all, none, invert`);
      }
    }, { commandName: `Post Agent: selection.${mode}` });
    return { mode };
  },

  /*
   * Adobe Firefly Generative Fill på nåværende selection. Tom prompt
   * betyr "remove/auto-fill background" (samme som Generative Expand
   * sin auto-fill). Krever Photoshop 2024 (25.0+) — Adobe-konto med
   * aktiv Firefly-kvote må være innlogget.
   */
  "gen.fill": async ({ prompt }) => {
    requireActiveDocument();
    const promptText = typeof prompt === "string" ? prompt : "";

    await core.executeAsModal(async () => {
      await action.batchPlay(
        [
          {
            _obj: "syntheticFill",
            prompt: promptText,
            serviceID: "clio",
            serviceOptionsList: {
              clio: {
                _obj: "clio",
                clio_advanced_options:
                  '{"customModelId":"","sref":"","sref_strength":0,"contentReference":""}',
              },
            },
          },
        ],
        {},
      );
    }, { commandName: `Post Agent: gen.fill${promptText ? ` "${promptText.slice(0, 40)}"` : " (auto)"}` });

    return { prompt: promptText, mode: promptText ? "generate" : "auto" };
  },

  /*
   * Generative Expand: utvid canvas til target W×H med anchor, og
   * auto-fill det nye området via Firefly. Kombinerer canvas-resize +
   * selection.invert + gen.fill(""). Anchor styrer hvor original
   * komposisjon plasseres i den nye canvasen — default "middleCenter".
   *
   * Krever Photoshop 2024 (25.0+) med aktiv Firefly-konto.
   */
  "gen.expand": async ({ target_width, target_height, anchor, prompt }) => {
    if (typeof target_width !== "number" || target_width <= 0) {
      throw new Error('"target_width" må være et positivt tall (px)');
    }
    if (typeof target_height !== "number" || target_height <= 0) {
      throw new Error('"target_height" må være et positivt tall (px)');
    }
    const doc = requireActiveDocument();
    const anchorPos = anchor || "middleCenter";
    const promptText = typeof prompt === "string" ? prompt : "";

    const beforeW = doc.width;
    const beforeH = doc.height;

    await core.executeAsModal(async () => {
      // 1) Utvid canvas — eksisterende innhold beholdes ifølge anchor
      await doc.resizeCanvas(target_width, target_height, anchorPos);

      // 2) Select nytt-utvidet område: select all → invert IKKE riktig
      //    fordi original innholdet kan være mindre enn ny canvas. Triks:
      //    selectAll dekker hele canvas. For å treffe bare nye områder
      //    måtte vi vite forrige bounds. Enklere: la gen.fill jobbe på
      //    hele canvas — Firefly er smart nok til å kun fylle tomme
      //    pixels. Det fungerer fordi "syntheticFill" med tom prompt
      //    er identisk med UI's "Generative Expand"-knapp.
      await doc.selection.selectAll();

      await action.batchPlay(
        [
          {
            _obj: "syntheticFill",
            prompt: promptText,
            serviceID: "clio",
            serviceOptionsList: {
              clio: {
                _obj: "clio",
                clio_advanced_options:
                  '{"customModelId":"","sref":"","sref_strength":0,"contentReference":""}',
              },
            },
          },
        ],
        {},
      );

      await doc.selection.deselect();
    }, { commandName: `Post Agent: gen.expand ${target_width}×${target_height}` });

    return {
      before: { width: beforeW, height: beforeH },
      after: { width: target_width, height: target_height },
      anchor: anchorPos,
      prompt: promptText,
    };
  },

  /*
   * Legg til en ikke-destruktiv adjustment layer over aktivt dokument
   * (eller en navngitt target-layer). V1 støtter 4 typer:
   *   - brightness_contrast: { brightness: -150..150, contrast: -150..150 }
   *   - hue_saturation:      { hue: -180..180, saturation: -100..100, lightness: -100..100 }
   *   - color_balance:       { midtones: [r,g,b], shadows?: [r,g,b], highlights?: [r,g,b] }
   *                          (verdier -100..100, preserveLuminosity default true)
   *   - curves:              { points: [[x,y], ...] } der x,y er 0..255 på composite-kanalen
   */
  "adjustment.add": async ({ type, params, name, target_layer_name }) => {
    assertString(type, "type");
    if (!params || typeof params !== "object") {
      throw new Error('"params" må være et objekt');
    }
    const doc = requireActiveDocument();

    await core.executeAsModal(async () => {
      if (target_layer_name) {
        const layer = findLayerByName(doc, target_layer_name);
        if (!layer) throw new Error(`Fant ingen layer med navn: ${target_layer_name}`);
        doc.activeLayers = [layer];
      }

      const using = buildAdjustmentDescriptor(type, params);
      await action.batchPlay(
        [
          {
            _obj: "make",
            _target: [{ _ref: "adjustmentLayer" }],
            using: { _obj: "adjustmentLayer", type: using },
          },
        ],
        {},
      );

      if (name) {
        const created = doc.activeLayers[0];
        if (created) created.name = name;
      }
    }, { commandName: `Post Agent: adjustment.${type}` });

    return { type, name: name ?? null, target_layer_name: target_layer_name ?? null };
  },

  /*
   * Applisere layer-effekter på en navngitt layer. V1 støtter 3:
   *   drop_shadow:    { opacity?:0-100, angle?:0-360, distance?:px, size?:px, color?:{r,g,b} }
   *   outer_glow:     { opacity?:0-100, size?:px, color?:{r,g,b} }
   *   color_overlay:  { opacity?:0-100, color:{r,g,b}, blend_mode?:string }
   * Flere kan settes i samme call — Photoshop kombinerer dem.
   */
  "style.apply": async ({ layer_name, effects }) => {
    assertString(layer_name, "layer_name");
    if (!effects || typeof effects !== "object") {
      throw new Error('"effects" må være et objekt');
    }
    const doc = requireActiveDocument();
    const applied = [];

    await core.executeAsModal(async () => {
      const layer = findLayerByName(doc, layer_name);
      if (!layer) throw new Error(`Fant ingen layer: ${layer_name}`);
      doc.activeLayers = [layer];

      const layerEffects = { _obj: "layerEffects", scale: { _unit: "percentUnit", _value: 100 } };

      if (effects.drop_shadow) {
        layerEffects.dropShadow = buildDropShadow(effects.drop_shadow);
        applied.push("drop_shadow");
      }
      if (effects.outer_glow) {
        layerEffects.outerGlow = buildOuterGlow(effects.outer_glow);
        applied.push("outer_glow");
      }
      if (effects.color_overlay) {
        layerEffects.solidFill = buildColorOverlay(effects.color_overlay);
        applied.push("color_overlay");
      }

      if (applied.length === 0) {
        throw new Error("Ingen kjent effect — støtter: drop_shadow, outer_glow, color_overlay");
      }

      await action.batchPlay(
        [
          {
            _obj: "set",
            _target: [
              { _ref: "property", _property: "layerEffects" },
              { _ref: "layer", _enum: "ordinal", _value: "targetEnum" },
            ],
            to: layerEffects,
          },
        ],
        {},
      );
    }, { commandName: `Post Agent: style.apply (${applied.join("+")})` });

    return { layer_name, applied };
  },

  "multiAspect.export": async ({
    master_path,
    output_dir,
    base_name,
    aspects,
    target_long_edge,
    format,
    quality,
  }) => {
    assertString(master_path, "master_path");
    assertString(output_dir, "output_dir");
    assertString(base_name, "base_name");
    assertString(format, "format");
    if (!Array.isArray(aspects) || aspects.length === 0) {
      throw new Error('"aspects" må være en non-empty array');
    }
    if (typeof target_long_edge !== "number" || target_long_edge <= 0) {
      throw new Error('"target_long_edge" må være et positivt tall (px)');
    }

    const masterEntry = await fs.getEntryWithUrl("file:" + encodeURI(master_path));
    const outFolder = await fs.getEntryWithUrl("file:" + encodeURI(output_dir));
    const results = [];
    const failed = [];

    await core.executeAsModal(async () => {
      for (let i = 0; i < aspects.length; i++) {
        const aspect = aspects[i];
        try {
          const target = computeTargetDimensions(aspect, target_long_edge);
          const aspectSlug = aspect.replace(/:/g, "x");
          const outName = `${base_name}_${aspectSlug}.${format.toLowerCase()}`;

          const doc = await app.open(masterEntry);
          try {
            const masterW = doc.width;
            const masterH = doc.height;
            const masterAspect = masterW / masterH;
            const targetAspect = target.width / target.height;

            // Fill-by-resize: skalere så bildet dekker target W×H,
            // overflod blir senter-cropped av canvas-resize etterpå.
            let resizeW;
            let resizeH;
            if (targetAspect > masterAspect) {
              // Target er bredere enn master → match bredde
              resizeW = target.width;
              resizeH = Math.round(masterH * (target.width / masterW));
            } else {
              // Target er smalere/like → match høyde
              resizeH = target.height;
              resizeW = Math.round(masterW * (target.height / masterH));
            }

            await doc.resizeImage(resizeW, resizeH, doc.resolution, "bicubicSharper");
            await doc.resizeCanvas(target.width, target.height, "middleCenter");

            const outFile = await outFolder.createFile(outName, { overwrite: true });
            const fmt = format.toLowerCase();
            if (fmt === "jpg" || fmt === "jpeg") {
              await doc.saveAs.jpg(outFile, { quality: quality ?? 10 });
            } else if (fmt === "png") {
              await doc.saveAs.png(outFile, { compression: 6 });
            } else if (fmt === "psd") {
              await doc.saveAs.psd(outFile, { maximizeCompatibility: true });
            } else if (fmt === "tiff" || fmt === "tif") {
              await doc.saveAs.tif(outFile);
            } else {
              throw new Error(`Ukjent eksportformat: ${format}`);
            }

            results.push({
              aspect,
              output_path: `${output_dir}/${outName}`,
              width: target.width,
              height: target.height,
            });
          } finally {
            await doc.closeWithoutSaving();
          }
        } catch (err) {
          failed.push({ aspect, error: String(err && err.message ? err.message : err) });
        }
      }
    }, { commandName: "Post Agent: multi-aspect export" });

    return {
      master_path,
      output_dir,
      base_name,
      total: aspects.length,
      succeeded: results.length,
      failed_count: failed.length,
      items: results,
      failed,
    };
  },
};

/**
 * Parse aspect-streng som "9:16" eller "16:9" og beregn W×H der den
 * lengste siden blir `long_edge`.
 */
/**
 * Bygg "type"-descriptoren for en adjustment-layer. Returnert objekt
 * leveres som `using.type` i batchPlay `_obj: "make" → adjustmentLayer`.
 */
function buildAdjustmentDescriptor(type, params) {
  switch (type) {
    case "brightness_contrast":
      return {
        _obj: "brightnessEvent",
        brightness: Number(params.brightness) || 0,
        center: Number(params.contrast) || 0,
        useLegacy: false,
      };
    case "hue_saturation":
      return {
        _obj: "hueSaturation",
        colorize: false,
        adjustment: [
          {
            _obj: "hueSatAdjustmentV2",
            hue: Number(params.hue) || 0,
            saturation: Number(params.saturation) || 0,
            lightness: Number(params.lightness) || 0,
          },
        ],
      };
    case "color_balance": {
      const cb = {
        _obj: "colorBalance",
        preserveLuminosity: params.preserveLuminosity !== false,
      };
      if (Array.isArray(params.shadows)) cb.shadowLevels = params.shadows.map(Number);
      if (Array.isArray(params.midtones)) cb.midtoneLevels = params.midtones.map(Number);
      if (Array.isArray(params.highlights)) cb.highlightLevels = params.highlights.map(Number);
      if (!cb.midtoneLevels && !cb.shadowLevels && !cb.highlightLevels) {
        cb.midtoneLevels = [0, 0, 0];
      }
      return cb;
    }
    case "curves": {
      if (!Array.isArray(params.points) || params.points.length < 2) {
        throw new Error("curves trenger minst 2 punkter, hver som [x, y] med 0-255-verdier");
      }
      return {
        _obj: "curves",
        adjustment: [
          {
            _obj: "curvesAdjustment",
            channel: { _ref: "channel", _enum: "channel", _value: "composite" },
            curve: params.points.map(([x, y]) => ({
              _obj: "paint",
              horizontal: Number(x),
              vertical: Number(y),
            })),
          },
        ],
      };
    }
    default:
      throw new Error(`Ukjent adjustment-type: ${type}. Støtter: brightness_contrast, hue_saturation, color_balance, curves`);
  }
}

function buildDropShadow(p) {
  return {
    _obj: "dropShadow",
    enabled: true,
    present: true,
    mode: { _enum: "blendMode", _value: "multiply" },
    color: rgbColor(p.color || { r: 0, g: 0, b: 0 }),
    opacity: { _unit: "percentUnit", _value: p.opacity ?? 35 },
    useGlobalAngle: false,
    angle: { _unit: "angleUnit", _value: p.angle ?? 120 },
    distance: { _unit: "pixelsUnit", _value: p.distance ?? 5 },
    chokeMatte: { _unit: "pixelsUnit", _value: p.spread ?? 0 },
    blur: { _unit: "pixelsUnit", _value: p.size ?? 5 },
  };
}

function buildOuterGlow(p) {
  return {
    _obj: "outerGlow",
    enabled: true,
    present: true,
    mode: { _enum: "blendMode", _value: "screen" },
    color: rgbColor(p.color || { r: 255, g: 255, b: 200 }),
    opacity: { _unit: "percentUnit", _value: p.opacity ?? 50 },
    chokeMatte: { _unit: "pixelsUnit", _value: 0 },
    blur: { _unit: "pixelsUnit", _value: p.size ?? 10 },
  };
}

function buildColorOverlay(p) {
  return {
    _obj: "solidFill",
    enabled: true,
    present: true,
    mode: { _enum: "blendMode", _value: p.blend_mode || "normal" },
    color: rgbColor(p.color || { r: 255, g: 255, b: 255 }),
    opacity: { _unit: "percentUnit", _value: p.opacity ?? 100 },
  };
}

function rgbColor(c) {
  // Aksepter både {r,g,b} og {red,green,blue}
  const r = c.r ?? c.red ?? 0;
  const g = c.g ?? c.green ?? 0;
  const b = c.b ?? c.blue ?? 0;
  return { _obj: "RGBColor", red: Number(r), green: Number(g), blue: Number(b) };
}

function computeTargetDimensions(aspectStr, long_edge) {
  const m = /^(\d+):(\d+)$/.exec(String(aspectStr).trim());
  if (!m) throw new Error(`Ugyldig aspect: ${aspectStr} (forventer "W:H", f.eks. "9:16")`);
  const num = Number(m[1]);
  const den = Number(m[2]);
  if (!num || !den) throw new Error(`Ugyldig aspect: ${aspectStr}`);
  const ratio = num / den;
  if (ratio >= 1) {
    // Landscape eller square — bredden er lengste siden
    return { width: long_edge, height: Math.round(long_edge / ratio) };
  } else {
    // Portrait — høyden er lengste siden
    return { width: Math.round(long_edge * ratio), height: long_edge };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertString(value, field) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Mangler eller ugyldig "${field}"`);
  }
}

function requireActiveDocument() {
  const doc = app.activeDocument;
  if (!doc) throw new Error("Ingen aktiv document i Photoshop");
  return doc;
}

function documentSummary(doc) {
  if (!doc) return null;
  return {
    id: doc.id,
    name: doc.name,
    width: doc.width,
    height: doc.height,
    resolution: doc.resolution,
    path: (() => { try { return doc.path; } catch (_) { return null; } })(),
  };
}

function findLayerByName(doc, name) {
  const stack = [...doc.layers];
  while (stack.length) {
    const layer = stack.pop();
    if (layer.name === name) return layer;
    if (layer.layers && layer.layers.length) stack.push(...layer.layers);
  }
  return null;
}

const FIELD_PATTERN = /^\{\{\s*([\w.-]+)\s*\}\}$/;

function collectTemplateFields(doc) {
  /*
   * Walk all layers and return one entry per `{{key}}`-named layer.
   * type "text" for text-layers, "image" for smart objects. Other layer
   * kinds with matching names are reported as "unsupported" so the UI
   * can warn instead of silently dropping them.
   */
  const out = [];
  const seenKeys = new Set();
  const stack = [...doc.layers];
  while (stack.length) {
    const layer = stack.pop();
    const match = layer.name.match(FIELD_PATTERN);
    if (match) {
      const key = match[1];
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        let type;
        if (layer.kind === constants.LayerKind.TEXT) type = "text";
        else if (layer.kind === constants.LayerKind.SMARTOBJECT) type = "image";
        else type = "unsupported";
        out.push({ key, type, layer_name: layer.name, kind: String(layer.kind) });
      }
    }
    if (layer.layers && layer.layers.length) stack.push(...layer.layers);
  }
  return out;
}

function collectFillableCandidates(doc) {
  /*
   * Returnerer ALLE text + smart-object layers (uavhengig av om de
   * matcher {{key}}-mønsteret). Lar UI'en tilby auto-rename når
   * Irlin har et template uten {{key}}-konvensjon — så vi unngår
   * å sende henne tilbake til Photoshop bare for å redigere navn.
   */
  const out = [];
  const stack = [...doc.layers];
  while (stack.length) {
    const layer = stack.pop();
    const match = layer.name.match(FIELD_PATTERN);
    let type = null;
    if (layer.kind === constants.LayerKind.TEXT) type = "text";
    else if (layer.kind === constants.LayerKind.SMARTOBJECT) type = "image";
    if (type) {
      out.push({
        layer_name: layer.name,
        type,
        has_field_pattern: !!match,
        suggested_key: match ? match[1] : slugifyForFieldKey(layer.name),
      });
    }
    if (layer.layers && layer.layers.length) stack.push(...layer.layers);
  }
  return out;
}

function slugifyForFieldKey(name) {
  return (name || "")
    .toLowerCase()
    .replace(/[æå]/g, "a")
    .replace(/ø/g, "o")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 40)
    || "field";
}

async function renameLayersToFieldKeys(doc, mappings) {
  /*
   * mappings: [{ layer_name, new_key }]
   * Setter layer-name til {{new_key}} for hver i mappings.
   * Returnerer { renamed, skipped }.
   */
  const renamed = [];
  const skipped = [];
  for (const m of mappings) {
    const layer = findLayerByName(doc, m.layer_name);
    if (!layer) {
      skipped.push({ ...m, reason: "layer not found" });
      continue;
    }
    layer.name = `{{${m.new_key}}}`;
    renamed.push({ old_name: m.layer_name, new_key: m.new_key });
  }
  return { renamed, skipped };
}

async function registerActionNotifiers() {
  if (notifierRegistered) return;
  notifierRegistered = true;
  await action.addNotificationListener(
    [
      { event: "open" },
      { event: "close" },
      { event: "select" },
      { event: "make" },
    ],
    (event, descriptor) => {
      try {
        emitEvent("photoshop.action", {
          event,
          active_document: app.activeDocument ? documentSummary(app.activeDocument) : null,
        });
      } catch (err) {
        log(`notifier emit: ${err.message || err}`, "err");
      }
    },
  );
  log("Notifiers registrert");
}

// Kick things off
connect();
