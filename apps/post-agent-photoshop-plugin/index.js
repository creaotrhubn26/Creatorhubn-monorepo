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
const { app, action, core, constants } = photoshop;
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
   * Template-scan: åpner en .psd, leter etter alle layers med navn `{{key}}`
   * og returnerer en katalog over feltene. Text-layers blir string-felt;
   * smart objects blir file-felt. Andre layer-typer ignoreres.
   * Åpningen er midlertidig — vi lukker uten å lagre etterpå.
   */
  "template.scan": async ({ template_path }) => {
    assertString(template_path, "template_path");
    const entry = await fs.getEntryWithUrl("file:" + encodeURI(template_path));
    let fields = [];
    let template_summary = null;
    await core.executeAsModal(async () => {
      const doc = await app.open(entry);
      try {
        template_summary = documentSummary(doc);
        fields = collectTemplateFields(doc);
      } finally {
        await doc.closeWithoutSaving();
      }
    }, { commandName: "Post Agent: template scan" });
    return { template_path, template: template_summary, fields };
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
};

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
