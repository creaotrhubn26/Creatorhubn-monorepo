/**
 * PhotoshopSetupWizard — guidet stegvis installasjon av Photoshop +
 * UXP Developer Tool + Bridge-plugin. Designet for Irlin/Irene som
 * IKKE har gjort UDT-sideload før og trenger håndholding på hver
 * deltakerklikk.
 *
 * Auto-detekterer hvor langt brukeren har kommet (Tauri-command
 * photoshop_setup_status) så hvert besøk hopper rett til neste
 * uutførte steg.
 */

import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getStatus } from "../services/photoshopBridgeService";

interface SetupStatus {
  photoshop_installed: boolean;
  photoshop_path: string | null;
  photoshop_version: string | null;
  udt_installed: boolean;
  udt_path: string | null;
  plugin_manifest_path: string | null;
  plugin_manifest_exists: boolean;
}

interface Props {
  onClose: () => void;
}

type StepState = "pending" | "current" | "done";

export function PhotoshopSetupWizard({ onClose }: Props) {
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const s = await invoke<SetupStatus>("photoshop_setup_status");
      setSetup(s);
      const b = await getStatus();
      setBridgeConnected(b.connected);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Refresh hver 3. sekund så brukeren ser fremgang etter at hun
    // klikker noe i Photoshop / UDT
    const id = setInterval(() => setRefreshTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (refreshTick > 0) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  const stepStates = computeStepStates(setup, bridgeConnected);

  const openUdt = async () => {
    setBusy(true);
    try {
      await invoke<string>("open_udt");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const revealManifest = async () => {
    setBusy(true);
    try {
      await invoke<string>("reveal_photoshop_plugin_manifest");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const allDone = stepStates.every((s) => s === "done");

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <header style={header}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Photoshop-oppsett</h2>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
              Steg-for-steg gjennom alt du trenger for å bruke Photoshop-funksjonene
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </header>

        {allDone && (
          <div style={successBanner}>
            ✓ Alt klart! Du kan bruke Photoshop-funksjonene nå.
          </div>
        )}

        <div style={body}>
          {!setup && <div style={{ color: "#888" }}>Sjekker status…</div>}
          {setup && (
            <>
              <StepCard
                index={1}
                state={stepStates[0]}
                title="Adobe Photoshop installert"
                body={
                  stepStates[0] === "done" ? (
                    <span>
                      Funnet: <code>{setup.photoshop_version ?? "ukjent versjon"}</code>
                    </span>
                  ) : (
                    <>
                      <p style={{ margin: "0 0 8px" }}>
                        Vi finner ikke Adobe Photoshop i <code>/Applications/</code>. Du
                        trenger Photoshop 2022 (versjon 23) eller nyere.
                      </p>
                      <p style={{ margin: 0, color: "#888", fontSize: 11 }}>
                        Installer fra Creative Cloud Desktop og kom tilbake hit. Vi
                        oppdager den automatisk innen 3 sekunder.
                      </p>
                    </>
                  )
                }
              />

              <StepCard
                index={2}
                state={stepStates[1]}
                title="Adobe UXP Developer Tool installert"
                body={
                  stepStates[1] === "done" ? (
                    <span>
                      Funnet: <code>{setup.udt_path}</code>
                    </span>
                  ) : (
                    <>
                      <p style={{ margin: "0 0 8px" }}>
                        UXP Developer Tool er gratis og kreves for å laste pluginen.
                      </p>
                      <p style={{ margin: 0, color: "#888", fontSize: 11 }}>
                        Åpne <strong>Creative Cloud Desktop</strong> → Apps → søk{" "}
                        <strong>"UXP Developer Tool"</strong> → klikk Installer. Vi
                        detekterer den automatisk når installasjonen er ferdig.
                      </p>
                    </>
                  )
                }
              />

              <StepCard
                index={3}
                state={stepStates[2]}
                title="Photoshop er åpent med et dokument"
                body={
                  stepStates[2] === "done" ? (
                    <span>Photoshop kjører og har minst ett åpent dokument.</span>
                  ) : (
                    <>
                      <p style={{ margin: "0 0 8px" }}>
                        Start Photoshop manuelt og lag et nytt dokument (File → New → OK).
                        UXP-pluginen kan ikke lastes når Photoshop er i "headless mode".
                      </p>
                      {!setup.photoshop_installed && (
                        <p style={{ fontSize: 11, color: "#888", margin: 0 }}>
                          Krever at steg 1 er fullført først.
                        </p>
                      )}
                    </>
                  )
                }
              />

              <StepCard
                index={4}
                state={stepStates[3]}
                title="Plugin lastet i Photoshop"
                body={
                  stepStates[3] === "done" ? (
                    <span>Pluginen "Post Agent Bridge" er tilkoblet.</span>
                  ) : (
                    <>
                      <p style={{ margin: "0 0 8px" }}>
                        Klikk knappene under for å gjøre dette enkelt:
                      </p>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                        <button
                          onClick={openUdt}
                          disabled={busy || !setup.udt_installed}
                          style={secondaryBtn}
                        >
                          1. Åpne UXP Developer Tool
                        </button>
                        <button
                          onClick={revealManifest}
                          disabled={busy || !setup.plugin_manifest_exists}
                          style={secondaryBtn}
                        >
                          2. Vis plugin-manifest i Finder
                        </button>
                      </div>
                      <ol style={{ margin: "0 0 0 18px", padding: 0, color: "#bbb", lineHeight: 1.6 }}>
                        <li>Klikk <strong>Add Plugin</strong> øverst i UDT</li>
                        <li>
                          Dra <code>manifest.json</code> fra Finder-vinduet inn i UDT — eller bla deg fram til den
                        </li>
                        <li>
                          På rad-en "Post Agent Bridge", klikk <strong>Load</strong>
                        </li>
                        <li>Panel skal dukke opp i Photoshop → vi oppdager det automatisk</li>
                      </ol>
                    </>
                  )
                }
              />
            </>
          )}
        </div>

        {error && <div style={errorBox}>{error}</div>}

        <footer style={footerBar}>
          <button onClick={refresh} style={secondaryBtn} disabled={busy}>
            Sjekk på nytt
          </button>
          <button onClick={onClose} style={primaryBtn}>
            {allDone ? "Kom i gang" : "Lukk"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function computeStepStates(
  setup: SetupStatus | null,
  bridgeConnected: boolean,
): StepState[] {
  const states: StepState[] = ["pending", "pending", "pending", "pending"];
  if (!setup) return states;
  states[0] = setup.photoshop_installed ? "done" : "current";
  states[1] = setup.udt_installed
    ? "done"
    : setup.photoshop_installed
    ? "current"
    : "pending";
  // Steg 3: vi vet ikke om Photoshop er åpent uten å pinge — bridgeConnected
  // er beste proxy. Merk som "current" når både PS + UDT er installert.
  states[2] = bridgeConnected
    ? "done"
    : setup.photoshop_installed && setup.udt_installed
    ? "current"
    : "pending";
  states[3] = bridgeConnected ? "done" : states[2] === "done" ? "current" : "pending";
  return states;
}

function StepCard({
  index,
  state,
  title,
  body,
}: {
  index: number;
  state: StepState;
  title: string;
  body: React.ReactNode;
}) {
  const stateColor =
    state === "done" ? "#4ad48a" : state === "current" ? "#3b82f6" : "#444";
  const icon = state === "done" ? "✓" : state === "current" ? `${index}` : `${index}`;
  return (
    <div
      style={{
        ...stepCard,
        borderLeft: `3px solid ${stateColor}`,
        opacity: state === "pending" ? 0.5 : 1,
      }}
    >
      <div
        style={{
          ...stepBadge,
          background: state === "done" ? "rgba(74,212,138,0.18)" : "rgba(59,130,246,0.18)",
          color: stateColor,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={stepTitle}>
          {title}
          {state === "current" && (
            <span style={stepCurrentBadge}>Nå-steg</span>
          )}
        </div>
        <div style={stepBody}>{body}</div>
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
  width: "min(620px, 95vw)",
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

const successBanner: React.CSSProperties = {
  background: "rgba(74,212,138,0.15)",
  color: "#4ad48a",
  borderBottom: "1px solid rgba(74,212,138,0.4)",
  padding: "12px 18px",
  fontWeight: 600,
  fontSize: 13,
  textAlign: "center",
};

const body: React.CSSProperties = {
  padding: 16,
  overflowY: "auto",
  flex: 1,
};

const stepCard: React.CSSProperties = {
  display: "flex",
  gap: 14,
  alignItems: "flex-start",
  padding: "12px 14px",
  borderRadius: 6,
  marginBottom: 10,
  background: "#181818",
};

const stepBadge: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  fontWeight: 700,
  flexShrink: 0,
};

const stepTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 4,
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const stepCurrentBadge: React.CSSProperties = {
  background: "rgba(59,130,246,0.2)",
  border: "1px solid rgba(59,130,246,0.5)",
  color: "#60a5fa",
  fontSize: 10,
  padding: "1px 6px",
  borderRadius: 999,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const stepBody: React.CSSProperties = {
  fontSize: 12,
  color: "#bbb",
  lineHeight: 1.5,
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

const secondaryBtn: React.CSSProperties = {
  background: "#2a2a2a",
  color: "#ddd",
  border: "1px solid #3a3a3a",
  borderRadius: 4,
  padding: "6px 12px",
  fontSize: 11,
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  background: "#3b82f6",
  color: "white",
  border: 0,
  borderRadius: 4,
  padding: "8px 18px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
