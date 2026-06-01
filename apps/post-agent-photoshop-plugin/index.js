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
