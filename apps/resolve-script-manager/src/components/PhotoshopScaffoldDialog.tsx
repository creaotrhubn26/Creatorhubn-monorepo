/**
 * PhotoshopScaffoldDialog — lager en ny PSD-fil fra én av tre dans-
 * relaterte presets, eller fra en custom-spec. Lar Irlin starte med
 * en navngitt template uten å selv designe en fra scratch i Photoshop.
 *
 * Smart-object-felter må fortsatt legges til manuelt (Photoshop UXP
 * sin scaffold-API støtter foreløpig bare text-layers via batchPlay).
 * Dialogen forklarer dette tydelig så Irlin vet hva som skjer.
 */

import { useCallback, useState } from "react";
import { save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import { photoshop } from "../services/photoshopBridgeService";
import AccessibilityNewIcon from "@mui/icons-material/AccessibilityNew";
import TheaterComedyIcon from "@mui/icons-material/TheaterComedy";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import type { SvgIconComponent } from "@mui/icons-material";

interface Props {
  onClose: () => void;
}

interface FieldSpec {
  key: string;
  type: "text" | "image_placeholder";
  hint?: string;
}

interface Preset {
  id: string;
  name: string;
  description: string;
  Icon: SvgIconComponent;
  width: number;
  height: number;
  background_color: { red: number; green: number; blue: number };
  fields: FieldSpec[];
  needs_image_layers: Array<{ key: string; hint: string }>;
}

const PRESETS: Preset[] = [
  {
    id: "dance-performance-poster",
    name: "Forestillings-plakat",
    description: "Vertikalt 9:16 — for Instagram Story / printed poster",
    Icon: AccessibilityNewIcon,
    width: 1080,
    height: 1920,
    background_color: { red: 22, green: 22, blue: 30 },
    fields: [
      { key: "title", type: "text", hint: "FORESTILLINGS-TITTEL" },
      { key: "company", type: "text", hint: "Dansekompani" },
      { key: "venue", type: "text", hint: "Sted, by" },
      { key: "date", type: "text", hint: "DD. måned ÅÅÅÅ kl. HH:MM" },
      { key: "price_info", type: "text", hint: "Billetter: 250 kr" },
    ],
    needs_image_layers: [
      { key: "main_photo", hint: "Hovedbilde av danseren/forestillingen" },
      { key: "logo", hint: "Kompani-logo (PNG med transparens)" },
    ],
  },
  {
    id: "audition-flyer",
    name: "Audition-flyer",
    description: "Kvadratisk 1:1 — for Instagram-post / Facebook",
    Icon: TheaterComedyIcon,
    width: 1080,
    height: 1080,
    background_color: { red: 250, green: 245, blue: 240 },
    fields: [
      { key: "production_name", type: "text", hint: "Produksjon" },
      { key: "role_description", type: "text", hint: "Vi søker dansere som…" },
      { key: "audition_date", type: "text", hint: "Audition: dato + sted" },
      { key: "deadline", type: "text", hint: "Søknadsfrist" },
      { key: "contact", type: "text", hint: "Kontakt + søknads-link" },
    ],
    needs_image_layers: [
      { key: "background", hint: "Stemnings-foto fra tidligere produksjon" },
    ],
  },
  {
    id: "class-schedule-card",
    name: "Time-plan-kort",
    description: "4:5 — for ukentlig timeplan på Instagram",
    Icon: CalendarMonthIcon,
    width: 1080,
    height: 1350,
    background_color: { red: 240, green: 230, blue: 250 },
    fields: [
      { key: "week_range", type: "text", hint: "Uke 12 – 18. mars" },
      { key: "monday", type: "text", hint: "Mandag: 18-20 Contemporary" },
      { key: "tuesday", type: "text", hint: "Tirsdag: 17-19 Ballet" },
      { key: "wednesday", type: "text", hint: "Onsdag: 19-21 Hip Hop" },
      { key: "thursday", type: "text", hint: "Torsdag: 18-20 Jazz" },
      { key: "friday", type: "text", hint: "Fredag: åpen sal" },
      { key: "booking_url", type: "text", hint: "studio.no/booking" },
    ],
    needs_image_layers: [
      { key: "studio_logo", hint: "Studio-logo i hjørnet" },
    ],
  },
];

export function PhotoshopScaffoldDialog({ onClose }: Props) {
  const [selected, setSelected] = useState<Preset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ path: string; preset: Preset } | null>(null);

  const create = useCallback(async (preset: Preset) => {
    const ext = ".psd";
    const picked = await saveFileDialog({
      defaultPath: `${preset.id}${ext}`,
      filters: [{ name: "Photoshop", extensions: ["psd"] }],
    });
    if (typeof picked !== "string") return;
    setBusy(true);
    setError(null);
    try {
      await photoshop.scaffoldTemplate({
        output_path: picked,
        spec: {
          name: preset.name,
          width: preset.width,
          height: preset.height,
          background_color: preset.background_color,
          fields: preset.fields,
        },
      });
      setSuccess({ path: picked, preset });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <header style={header}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Lag template fra startpunkt</h2>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
              Vi lager en ny PSD-fil med text-layers ferdig navngitt og klar til bruk
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </header>

        {success && (
          <div style={successBanner}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              ✓ {success.preset.name} laget
            </div>
            <div style={{ fontSize: 11 }}>
              Lagret som <code>{success.path}</code>
            </div>
            {success.preset.needs_image_layers.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 11, lineHeight: 1.5 }}>
                <strong>Neste steg i Photoshop:</strong> Åpne fila og legg til
                disse smart-object-layers manuelt (File → Place Embedded → gi navn{" "}
                <code>{"{{key}}"}</code>):
                <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                  {success.preset.needs_image_layers.map((l) => (
                    <li key={l.key} style={{ fontFamily: "ui-monospace, monospace" }}>
                      {`{{${l.key}}}`} <span style={{ color: "#888" }}>— {l.hint}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div style={body}>
          {!success && (
            <>
              <div style={{ color: "#bbb", fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>
                Velg et startpunkt. Vi lager en PSD med text-felter ferdig navngitt
                med <code>{"{{key}}"}</code>-konvensjon, så du slipper å designe fra
                blankt og slipper å redigere layer-navn manuelt.
              </div>
              {PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  style={{
                    ...presetCard,
                    ...(selected?.id === preset.id ? presetCardActive : null),
                  }}
                  onClick={() => setSelected(preset)}
                >
                  <div style={{ flexShrink: 0 }}>
                    <preset.Icon sx={{ fontSize: 36, color: "#a78bfa" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={presetTitle}>{preset.name}</div>
                    <div style={presetDesc}>{preset.description}</div>
                    <div style={presetMeta}>
                      {preset.width}×{preset.height} · {preset.fields.length} text-felter
                      {preset.needs_image_layers.length > 0 &&
                        ` · ${preset.needs_image_layers.length} bilde-felter (legges til etterpå)`}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void create(preset);
                    }}
                    disabled={busy}
                    style={primaryBtn}
                  >
                    {busy && selected?.id === preset.id ? "Lager…" : "Lag denne"}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        {error && <div style={errorBox}>{error}</div>}

        <footer style={footerBar}>
          <div style={{ fontSize: 11, color: "#888" }}>
            Smart-object-layers (bilder) må legges til manuelt i Photoshop etterpå
          </div>
          {success && (
            <button onClick={onClose} style={primaryBtn}>
              Ferdig
            </button>
          )}
        </footer>
      </div>
    </div>
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
  width: "min(640px, 95vw)",
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

const body: React.CSSProperties = {
  padding: 16,
  overflowY: "auto",
  flex: 1,
};

const presetCard: React.CSSProperties = {
  display: "flex",
  gap: 14,
  alignItems: "flex-start",
  padding: "14px 16px",
  background: "#181818",
  borderRadius: 6,
  marginBottom: 10,
  border: "1px solid transparent",
  cursor: "pointer",
  transition: "border-color 0.1s",
};

const presetCardActive: React.CSSProperties = {
  border: "1px solid #3b82f6",
};

const presetTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 2,
};

const presetDesc: React.CSSProperties = {
  fontSize: 11,
  color: "#aaa",
  marginBottom: 6,
};

const presetMeta: React.CSSProperties = {
  fontSize: 10,
  color: "#666",
  fontFamily: "ui-monospace, monospace",
};

const successBanner: React.CSSProperties = {
  background: "rgba(74,212,138,0.15)",
  color: "#4ad48a",
  borderBottom: "1px solid rgba(74,212,138,0.4)",
  padding: "12px 18px",
  fontSize: 13,
};

const errorBox: React.CSSProperties = {
  background: "rgba(248,81,73,0.1)",
  border: "1px solid rgba(248,81,73,0.4)",
  color: "#f85149",
  borderRadius: 6,
  padding: "8px 12px",
  fontSize: 12,
  margin: "0 18px 8px",
};

const footerBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 18px",
  borderTop: "1px solid #2a2a2a",
  background: "#181818",
};

const primaryBtn: React.CSSProperties = {
  background: "#3b82f6",
  color: "white",
  border: 0,
  borderRadius: 4,
  padding: "6px 14px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  flexShrink: 0,
};
