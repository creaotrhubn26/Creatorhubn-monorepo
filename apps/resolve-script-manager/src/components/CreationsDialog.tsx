/**
 * CreationsDialog — Phase 4 ekte iterativ re-gen.
 *
 * Lar Irlin åpne en tidligere AI-generert PSD og endre kun deler av
 * den uten å re-generere alt:
 *   - Bytte ett bilde (ny prompt, samme størrelse + posisjon)
 *   - Endre tekst i ett text-felt (ny verdi)
 *   - Re-render PSD over samme path
 *
 * State-modell: hver Creation lagres som JSON-fil i app-data via
 * Rust-side creations.rs. Vi laster lista ved åpning, lar brukeren
 * velge én å iterere på, og oppdaterer den persistert etter hver re-gen.
 */

import { useCallback, useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import {
  listCreations,
  saveCreation,
  deleteCreation,
  type Creation,
  type CreationImage,
} from "../services/creationsService";
import { generateImage } from "../services/aiImageService";
import { photoshop } from "../services/photoshopBridgeService";
import type { ImageSize } from "../agents/templateArtDirector";
import RefreshIcon from "@mui/icons-material/Refresh";
import EditIcon from "@mui/icons-material/Edit";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SaveAsIcon from "@mui/icons-material/SaveAs";
import CircularProgress from "@mui/material/CircularProgress";

interface Props {
  onClose: () => void;
}

export function CreationsDialog({ onClose }: Props) {
  const [list, setList] = useState<Creation[]>([]);
  const [selected, setSelected] = useState<Creation | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const r = await listCreations();
      setList(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const regenImage = useCallback(
    async (creation: Creation, key: string, newPrompt: string) => {
      const field = creation.spec.fields.find((f) => f.key === key);
      if (!field || field.type !== "image_placeholder") return;
      setBusyKey(key);
      setError(null);
      try {
        const r = await generateImage({
          prompt: newPrompt,
          image_size: (field.image_size as ImageSize) ?? "square_hd",
        });
        const newImages = {
          ...creation.images,
          [key]: {
            path: r.image_path,
            prompt: newPrompt,
            seed: r.seed,
            width: r.width,
            height: r.height,
            model: r.model,
          },
        };
        const updated: Creation = {
          ...creation,
          images: newImages,
          updated_at: new Date().toISOString(),
        };
        await saveCreation(updated);
        setSelected(updated);
        setList((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyKey(null);
      }
    },
    [],
  );

  const updateText = useCallback(
    async (creation: Creation, key: string, newValue: string) => {
      const updated: Creation = {
        ...creation,
        text_values: { ...creation.text_values, [key]: newValue },
        updated_at: new Date().toISOString(),
      };
      await saveCreation(updated);
      setSelected(updated);
      setList((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    },
    [],
  );

  const rerender = useCallback(
    async (creation: Creation, saveAsNew: boolean) => {
      let outputPath = creation.psd_path;
      if (saveAsNew) {
        const picked = await saveFileDialog({
          defaultPath: creation.psd_path.replace(/\.psd$/i, "-v2.psd"),
          filters: [{ name: "Photoshop", extensions: ["psd"] }],
        });
        if (typeof picked !== "string") return;
        outputPath = picked;
      }
      setBusy(true);
      setError(null);
      try {
        await photoshop.scaffoldTemplate({
          output_path: outputPath,
          spec: {
            name: creation.spec.name,
            width: creation.spec.width,
            height: creation.spec.height,
            background_color: creation.spec.background_color,
            fields: creation.spec.fields.map((f) => ({
              key: f.key,
              type: f.type,
              hint:
                f.type === "text"
                  ? creation.text_values[f.key] ?? f.hint
                  : f.hint,
              x: f.x,
              y: f.y,
              font_size: f.font_size,
              file_path: creation.images[f.key]?.path,
            })),
          },
        });
        const updated: Creation = {
          ...creation,
          psd_path: outputPath,
          updated_at: new Date().toISOString(),
        };
        await saveCreation(updated);
        setSelected(updated);
        setList((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const removeCreation = useCallback(async (c: Creation) => {
    if (!confirm(`Slett kreasjon "${c.spec.name}"? PSD-filen blir ikke slettet.`)) return;
    await deleteCreation(c.id);
    setList((prev) => prev.filter((x) => x.id !== c.id));
    if (selected?.id === c.id) setSelected(null);
  }, [selected]);

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <header style={header}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Mine AI-kreasjoner</h2>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
              Iterer på tidligere genererte templater uten å re-generere alt
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </header>

        <div style={body}>
          {selected ? (
            <CreationDetail
              creation={selected}
              busy={busy}
              busyKey={busyKey}
              error={error}
              onBack={() => setSelected(null)}
              onRegenImage={regenImage}
              onUpdateText={updateText}
              onRerender={rerender}
              onDelete={removeCreation}
            />
          ) : (
            <>
              {list.length === 0 && (
                <div style={emptyState}>
                  Ingen kreasjoner ennå. Bruk <strong>AI Creative Director</strong> til
                  å lage den første — den vises automatisk her.
                </div>
              )}
              {list.length > 0 && (
                <div style={listGrid}>
                  {list.map((c) => (
                    <div
                      key={c.id}
                      style={listCard}
                      onClick={() => setSelected(c)}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={cardTitle}>{c.spec.name}</div>
                        <div style={cardMeta}>
                          {c.spec.width}×{c.spec.height} ·{" "}
                          {Object.keys(c.images).length} bilder ·{" "}
                          {new Date(c.created_at).toLocaleDateString("nb-NO")}
                        </div>
                        <div style={cardPrompt}>"{c.user_prompt}"</div>
                      </div>
                      {/* Thumbnail av første image hvis vi har en */}
                      {Object.values(c.images)[0]?.path && (
                        <img
                          src={convertFileSrc(Object.values(c.images)[0].path)}
                          alt=""
                          style={cardThumb}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail-view: redigerings-flate for én creation
// ---------------------------------------------------------------------------

interface DetailProps {
  creation: Creation;
  busy: boolean;
  busyKey: string | null;
  error: string | null;
  onBack: () => void;
  onRegenImage: (c: Creation, key: string, prompt: string) => void;
  onUpdateText: (c: Creation, key: string, value: string) => void;
  onRerender: (c: Creation, saveAsNew: boolean) => void;
  onDelete: (c: Creation) => void;
}

function CreationDetail({
  creation,
  busy,
  busyKey,
  error,
  onBack,
  onRegenImage,
  onUpdateText,
  onRerender,
  onDelete,
}: DetailProps) {
  const [editingPrompts, setEditingPrompts] = useState<Record<string, string>>({});
  const [editingTexts, setEditingTexts] = useState<Record<string, string>>({});

  const imageFields = creation.spec.fields.filter(
    (f) => f.type === "image_placeholder",
  );
  const textFields = creation.spec.fields.filter((f) => f.type === "text");

  return (
    <>
      <div style={detailHeader}>
        <button onClick={onBack} style={secondaryBtn}>
          ← Tilbake
        </button>
        <button onClick={() => onDelete(creation)} style={dangerBtn}>
          <DeleteOutlineIcon sx={{ fontSize: 14, marginRight: 4, verticalAlign: "text-bottom" }} />
          Slett
        </button>
      </div>

      <section style={card}>
        <h3 style={cardSectionTitle}>{creation.spec.name}</h3>
        <div style={{ fontSize: 11, color: "#aaa", fontStyle: "italic", marginBottom: 6 }}>
          {creation.spec.rationale}
        </div>
        <div style={{ fontSize: 11, color: "#888" }}>
          PSD: <code style={{ color: "#aaa" }}>{creation.psd_path}</code>
        </div>
      </section>

      {imageFields.length > 0 && (
        <section style={card}>
          <h3 style={cardSectionTitle}>
            <EditIcon sx={{ fontSize: 14, marginRight: 6, verticalAlign: "text-bottom" }} />
            Bilder ({imageFields.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {imageFields.map((f) => {
              const img: CreationImage | undefined = creation.images[f.key];
              const currentPrompt = editingPrompts[f.key] ?? img?.prompt ?? "";
              const isWorking = busyKey === f.key;
              return (
                <div key={f.key} style={fieldRow}>
                  <div style={fieldThumbBox}>
                    {img?.path ? (
                      <img
                        src={convertFileSrc(img.path)}
                        alt={f.key}
                        style={fieldThumb}
                      />
                    ) : (
                      <div style={fieldThumbEmpty}>(mangler)</div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={fieldKey}>{`{{${f.key}}}`}</div>
                    <textarea
                      value={currentPrompt}
                      onChange={(e) =>
                        setEditingPrompts((p) => ({ ...p, [f.key]: e.target.value }))
                      }
                      rows={2}
                      placeholder="Endre prompt og re-generer…"
                      style={textareaSmall}
                      disabled={isWorking}
                    />
                    <button
                      onClick={() =>
                        onRegenImage(creation, f.key, currentPrompt.trim())
                      }
                      disabled={isWorking || !currentPrompt.trim()}
                      style={smallPrimaryBtn}
                    >
                      {isWorking ? (
                        <CircularProgress size={11} sx={{ color: "white", marginRight: 1 }} />
                      ) : (
                        <RefreshIcon sx={{ fontSize: 12, marginRight: 4, verticalAlign: "text-bottom" }} />
                      )}
                      {isWorking ? "Genererer…" : "Re-generer dette bildet"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {textFields.length > 0 && (
        <section style={card}>
          <h3 style={cardSectionTitle}>
            <EditIcon sx={{ fontSize: 14, marginRight: 6, verticalAlign: "text-bottom" }} />
            Tekst-felter ({textFields.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {textFields.map((f) => {
              const current =
                editingTexts[f.key] ??
                creation.text_values[f.key] ??
                f.hint ??
                `{{${f.key}}}`;
              return (
                <div key={f.key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={textFieldKey}>{`{{${f.key}}}`}</div>
                  <input
                    type="text"
                    value={current}
                    onChange={(e) =>
                      setEditingTexts((t) => ({ ...t, [f.key]: e.target.value }))
                    }
                    onBlur={() => {
                      const newVal = current.trim();
                      if (newVal !== (creation.text_values[f.key] ?? "")) {
                        onUpdateText(creation, f.key, newVal);
                      }
                    }}
                    style={textInput}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {error && <div style={errorBox}>{error}</div>}

      <div style={actionBar}>
        <button
          onClick={() => onRerender(creation, false)}
          disabled={busy}
          style={primaryBtn}
        >
          <RefreshIcon sx={{ fontSize: 14, marginRight: 6, verticalAlign: "text-bottom" }} />
          {busy ? "Re-rendrer…" : "Re-render over original PSD"}
        </button>
        <button
          onClick={() => onRerender(creation, true)}
          disabled={busy}
          style={secondaryBtn}
        >
          <SaveAsIcon sx={{ fontSize: 14, marginRight: 6, verticalAlign: "text-bottom" }} />
          Lagre som ny PSD
        </button>
        <button
          onClick={() => void openPath(creation.psd_path).catch(() => {})}
          style={secondaryBtn}
        >
          <OpenInNewIcon sx={{ fontSize: 14, marginRight: 6, verticalAlign: "text-bottom" }} />
          Åpne nåværende PSD
        </button>
      </div>
    </>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2000,
};

const modal: React.CSSProperties = {
  background: "#1f1f1f",
  borderRadius: 8,
  width: "min(760px, 96vw)",
  maxHeight: "92vh",
  display: "flex",
  flexDirection: "column",
  color: "#ddd",
  fontSize: 12,
  boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
};

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  padding: "14px 18px",
  borderBottom: "1px solid #2a2a2a",
};

const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: 0,
  color: "#888",
  fontSize: 18,
  cursor: "pointer",
  padding: 4,
};

const body: React.CSSProperties = { padding: 16, overflowY: "auto", flex: 1 };

const emptyState: React.CSSProperties = {
  padding: "40px 20px",
  textAlign: "center",
  color: "#888",
  fontSize: 12,
  lineHeight: 1.6,
};

const listGrid: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const listCard: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  padding: "12px",
  background: "#242424",
  borderRadius: 6,
  cursor: "pointer",
  border: "1px solid transparent",
  transition: "border-color 0.15s",
};

const cardTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#e8e8e8",
};

const cardMeta: React.CSSProperties = {
  fontSize: 10.5,
  color: "#888",
  marginTop: 2,
};

const cardPrompt: React.CSSProperties = {
  fontSize: 11,
  color: "#aaa",
  marginTop: 6,
  fontStyle: "italic",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const cardThumb: React.CSSProperties = {
  width: 60,
  height: 60,
  objectFit: "cover",
  borderRadius: 4,
  flexShrink: 0,
};

const detailHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 12,
};

const card: React.CSSProperties = {
  background: "#242424",
  borderRadius: 6,
  padding: 14,
  marginBottom: 10,
};

const cardSectionTitle: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: 13,
  fontWeight: 600,
  color: "#e8e8e8",
};

const fieldRow: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  paddingBottom: 12,
  borderBottom: "1px solid #2a2a2a",
};

const fieldThumbBox: React.CSSProperties = {
  width: 80,
  height: 80,
  flexShrink: 0,
  background: "#141414",
  borderRadius: 4,
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const fieldThumb: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const fieldThumbEmpty: React.CSSProperties = {
  fontSize: 10,
  color: "#666",
};

const fieldKey: React.CSSProperties = {
  fontFamily: "ui-monospace, monospace",
  fontSize: 11,
  color: "#bbb",
  marginBottom: 4,
};

const textareaSmall: React.CSSProperties = {
  width: "100%",
  resize: "vertical",
  background: "#141414",
  border: "1px solid #333",
  color: "#ddd",
  padding: "6px 8px",
  borderRadius: 4,
  fontSize: 11,
  fontFamily: "inherit",
  boxSizing: "border-box",
  marginBottom: 6,
  minHeight: 50,
};

const textFieldKey: React.CSSProperties = {
  flex: "0 0 130px",
  fontFamily: "ui-monospace, monospace",
  fontSize: 11,
  color: "#bbb",
};

const textInput: React.CSSProperties = {
  flex: 1,
  background: "#141414",
  border: "1px solid #333",
  color: "#ddd",
  padding: "5px 8px",
  borderRadius: 4,
  fontSize: 12,
  fontFamily: "inherit",
};

const actionBar: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  marginTop: 6,
};

const primaryBtn: React.CSSProperties = {
  background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
  color: "white",
  border: 0,
  borderRadius: 4,
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const smallPrimaryBtn: React.CSSProperties = {
  background: "#3b82f6",
  color: "white",
  border: 0,
  borderRadius: 4,
  padding: "4px 10px",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  background: "#2a2a2a",
  color: "#ddd",
  border: "1px solid #3a3a3a",
  borderRadius: 4,
  padding: "6px 12px",
  fontSize: 11,
  cursor: "pointer",
};

const dangerBtn: React.CSSProperties = {
  background: "transparent",
  color: "#f85149",
  border: "1px solid rgba(248,81,73,0.4)",
  borderRadius: 4,
  padding: "6px 12px",
  fontSize: 11,
  cursor: "pointer",
};

const errorBox: React.CSSProperties = {
  background: "rgba(248,81,73,0.1)",
  border: "1px solid rgba(248,81,73,0.4)",
  color: "#f85149",
  borderRadius: 6,
  padding: "8px 12px",
  fontSize: 12,
  marginBottom: 10,
};
