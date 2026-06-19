/**
 * ColorNodeTreeWizard — veiviser for å bygge fargekorreksjons-node-treet i Resolve.
 *
 * Hvorfor en veiviser: Resolve-scripting kan IKKE opprette noder (AddNode finnes
 * ikke), så node-treet må bygges én gang manuelt i Color-siden. Denne veiviseren
 * (1) detekterer om filmen er gradet eller log, (2) viser nøyaktig hvilke noder du
 * skal lage — med hva hver gjør og hvorfor, (3) lar deg lagre som PowerGrade/.drx,
 * og (4) propagerer malen til alle klipp via apply_grade_template (ApplyGradeFromDRX)
 * + per-klipp eksponering.
 */
import { useState } from "react";
import { executeScript } from "../api";

// DaVinci Resolve-design: charcoal-grått, flatt, Resolve-blå selection.
const D = {
  bg: "#1b1b1b", panel: "#252525", panel2: "#2f2f2f", line: "#3a3a3a",
  ink: "#dcdcdc", soft: "#9aa0a6", faint: "#6b6b6b",
  accent: "#4d8fcc", teal: "#3fb6a8", gold: "#d99a4e", red: "#d35e6e", green: "#5fb878",
};

type ColorState = "graded" | "log" | "hdr" | null;

interface NodeDef { n: number; name: string; what: string; why: string; how: string; color: string; img: string }

const G = "/color-guide";  // illustrasjoner (public/color-guide)

// Node-tre per tilstand. Log legger CST FØRST; gradet hopper over den.
const GRADED_NODES: NodeDef[] = [
  { n: 1, name: "Balanse", color: D.teal, img: `${G}/Step4.png`, what: "Nøytraliser white balance / tint.", why: "Selv en ferdig film kan ha små fargestikk per kamera/lys — gir en ren, nøytral base å bygge på.", how: "Color Wheels: juster Gain/Offset til hvitt er nøytralt (bruk Picker på et hvitt felt)." },
  { n: 2, name: "Eksponering", color: D.gold, img: `${G}/Step5.png`, what: "Løft skygger / gain på mørke klipp.", why: "Undereksponerte klipp må løftes uten å påvirke balanse/sekundær. Egen node = scriptet kan sette per-klipp-verdi her automatisk.", how: "Lift/Gain opp til midtone ~42 IRE. (Scriptet skriver CDL på DENNE noden per klipp.)" },
  { n: 3, name: "Sekundær (område)", color: D.accent, img: `${G}/Step6.png`, what: "Isoler problem-områder: ansikter for mørke, utbrente vinduer.", why: "Målrettet fiks uten å påvirke hele bildet — f.eks. løft kun ansikt, demp kun vindu.", how: "Power Window eller Qualifier på området, så juster kun der. La stå tom hvis ikke nødvendig." },
  { n: 4, name: "Output / Look", color: D.green, img: `${G}/Step7.png`, what: "Subtil metning + kontrast for konsistens.", why: "Binder alle klipp sammen til ett uttrykk; siste, lette polering på toppen.", how: "Lett kontrast-S + sat ~1.05. Hold det subtilt — bildet er allerede gradet." },
];
const CST_NODE: NodeDef = { n: 0, name: "CST (Color Space Transform)", color: D.red, img: `${G}/Step3.png`, what: "Konverter kamera-log → Rec709 Gamma 2.4.", why: "Log er flatt og uvisbart. CST normaliserer FØR all grading — ellers grader du på feil gamma.", how: "Legg til ResolveFX «Color Space Transform». Input = kameraets log (se detektert under), Output = Rec.709 / Gamma 2.4." };
const OVERVIEW = { graded: `${G}/Step1.png`, log: `${G}/Step2.png` };

export function ColorNodeTreeWizard({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<ColorState>(null);
  const [cst, setCst] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [step, setStep] = useState(0); // 0=detect, 1..N=nodes, N+1=save, N+2=apply
  const [drxPath, setDrxPath] = useState("");
  const [applyMsg, setApplyMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nodes: NodeDef[] = state === "log" || state === "hdr" ? [CST_NODE, ...GRADED_NODES.map((n, i) => ({ ...n, n: i + 2 }))] : GRADED_NODES;
  const nodeSteps = nodes.length;
  const SAVE_STEP = 1 + nodeSteps;
  const APPLY_STEP = SAVE_STEP + 1;

  const detect = async () => {
    setDetecting(true);
    try {
      const res = await executeScript("analyze_color_state", {}, false);
      const v = res.events.find(e => e.type === "result")?.value as { state?: ColorState; cstInput?: string } | undefined;
      setState(v?.state ?? "graded");
      setCst(v?.cstInput ?? null);
      setStep(1);
    } catch {
      setState("graded"); setStep(1);
    } finally { setDetecting(false); }
  };

  const apply = async () => {
    setBusy(true); setApplyMsg(null);
    try {
      const res = await executeScript("apply_grade_template", { drxPath, exposureNode: state === "graded" ? 2 : 3 }, false);
      const v = res.events.find(e => e.type === "result")?.value as { applied?: number; corrected?: number } | undefined;
      const err = res.events.find(e => e.type === "error")?.value as { message?: string } | undefined;
      setApplyMsg(err ? `Feil: ${err.message}` : `✓ Mal anvendt på ${v?.applied ?? 0} klipp, ${v?.corrected ?? 0} eksponerings-korrigert`);
    } catch (e) {
      setApplyMsg("Feil: " + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(false); }
  };

  const btn = (primary = false): React.CSSProperties => ({
    background: primary ? D.accent : "transparent", border: `1px solid ${primary ? D.accent : D.line}`,
    color: primary ? "#fff" : D.ink, padding: "8px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer",
  });

  // Node-editor-diagram i Resolve-stil: grå node-tiles m/ output-dot + tynne koblinger.
  const Diagram = ({ active }: { active: number }) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 0, flexWrap: "wrap", margin: "16px 0",
                  padding: "14px 12px", background: "#161616", border: `1px solid ${D.line}`, borderRadius: 6 }}>
      {nodes.map((nd, i) => {
        const on = active === i + 1;
        return (
          <div key={nd.n} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: 74 }}>
              <div style={{
                position: "relative", width: 52, height: 40, borderRadius: 5,
                background: on ? "#3a3a3a" : "#2c2c2c",
                border: on ? `2px solid ${D.accent}` : "1px solid #4a4a4a",
                boxShadow: on ? `0 0 8px ${D.accent}66` : "none",
                display: "grid", placeItems: "center",
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: on ? "#fff" : D.soft }}>{nd.n}</span>
                {/* output-node-dot (Resolve grønn) */}
                <span style={{ position: "absolute", right: -4, top: "50%", transform: "translateY(-50%)", width: 7, height: 7, borderRadius: 4, background: D.green, border: "1px solid #1b1b1b" }} />
                {/* fargekode-stripe per node-rolle */}
                <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderRadius: "5px 0 0 5px", background: nd.color }} />
              </div>
              <span style={{ fontSize: 9.5, color: on ? D.ink : D.faint, fontWeight: on ? 700 : 500, textAlign: "center", lineHeight: 1.1 }}>{nd.name.split(" ")[0]}</span>
            </div>
            {i < nodes.length - 1 && <div style={{ width: 16, height: 1, background: "#5a5a5a", marginTop: 20 }} />}
          </div>
        );
      })}
    </div>
  );

  const cur = nodes[step - 1];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "grid", placeItems: "center", zIndex: 9999 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 720, maxWidth: "94vw", maxHeight: "90vh", overflow: "auto", background: D.bg, color: D.ink, border: `1px solid ${D.line}`, borderRadius: 8, padding: 24, fontFamily: "'DaVinci Sans', 'Helvetica Neue', system-ui, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>Farge-node-veiviser</span>
          {state && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: D.panel2, color: state === "graded" ? D.green : D.gold, border: `1px solid ${D.line}` }}>{state === "graded" ? "Allerede gradet" : state.toUpperCase()}</span>}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ ...btn(), padding: "4px 10px" }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: D.soft, marginBottom: 8 }}>
          Resolve-scripting kan ikke lage noder — derfor bygger DU treet én gang her, så propagerer appen det til alle klipp.
        </div>

        {step === 0 && (
          <div>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: D.ink }}>
              Først sjekker vi om filmen <b>allerede er fargekorrigert</b> (da gjør vi kun justeringer) eller er i <b>log</b> (da må vi konvertere med CST først). Dette bestemmer hvilke noder du skal lage.
            </p>
            <button disabled={detecting} onClick={() => void detect()} style={{ ...btn(true), marginTop: 8 }}>
              {detecting ? "Analyserer …" : "Detekter farge-tilstand"}
            </button>
          </div>
        )}

        {step >= 1 && step <= nodeSteps && cur && (
          <div>
            <Diagram active={step} />
            {/* Illustrasjon (ChatGPT-generert, Resolve-stil) — viser hva noden gjør + hva du justerer */}
            <img src={cur.img} alt={cur.name}
                 style={{ width: "100%", borderRadius: 6, border: `1px solid ${D.line}`, display: "block" }} />
            <div style={{ fontSize: 12.5, color: D.soft, marginTop: 10, lineHeight: 1.55 }}>
              <b style={{ color: cur.color }}>Node {cur.n} · {cur.name}.</b> <b style={{ color: D.green }}>Slik:</b> {cur.how}
              {cur.name.startsWith("CST") && cst ? ` Detektert log: ${cst}.` : ""}
            </div>
            <div style={{ fontSize: 11.5, color: D.faint, marginTop: 6 }}>I Color-siden: høyreklikk i Node Editor → «Add Node → Serial» for hver node, i rekkefølgen over.</div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={() => setStep(step - 1)} style={btn()}>← Tilbake</button>
              <div style={{ flex: 1 }} />
              <button onClick={() => setStep(step + 1)} style={btn(true)}>{step === nodeSteps ? "Ferdig med noder →" : "Neste node →"}</button>
            </div>
          </div>
        )}

        {step === SAVE_STEP && (
          <div>
            <img src={state === "graded" ? OVERVIEW.graded : OVERVIEW.log} alt="Node-tre"
                 style={{ width: "100%", borderRadius: 6, border: `1px solid ${D.line}`, display: "block", marginBottom: 4 }} />
            <Diagram active={-1} />
            <div style={{ background: D.panel, border: `1px solid ${D.line}`, borderRadius: 6, padding: 16, fontSize: 13, lineHeight: 1.7 }}>
              <b style={{ color: D.gold }}>Lagre node-treet som mal (.drx):</b>
              <ol style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                <li>I Color-siden, høyreklikk i <b>Gallery</b> → <b>Add PowerGrade Album</b> (om du ikke har en).</li>
                <li>Dra det graderte klippet inn i PowerGrade-albumet (lagrer hele node-treet som en still).</li>
                <li>Høyreklikk stillen → <b>Export</b> → velg format <b>.drx</b> → lagre. Lim inn stien under.</li>
              </ol>
            </div>
            <input value={drxPath} onChange={e => setDrxPath(e.target.value)} placeholder="/sti/til/node-tre-mal.drx"
              style={{ width: "100%", marginTop: 12, padding: "9px 11px", borderRadius: 7, border: `1px solid ${D.line}`, background: D.panel2, color: D.ink, fontSize: 12.5, colorScheme: "dark" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={() => setStep(step - 1)} style={btn()}>← Tilbake</button>
              <div style={{ flex: 1 }} />
              <button disabled={!drxPath.trim()} onClick={() => setStep(APPLY_STEP)} style={btn(true)}>Neste: propager →</button>
            </div>
          </div>
        )}

        {step === APPLY_STEP && (
          <div>
            <div style={{ background: D.panel, border: `1px solid ${D.line}`, borderRadius: 6, padding: 16, fontSize: 13, lineHeight: 1.7 }}>
              <b style={{ color: D.green }}>Propager malen til alle klipp</b>
              <p style={{ margin: "8px 0 0", color: D.soft }}>
                Appen anvender node-tre-malen ({drxPath.split("/").pop()}) på hvert klipp på den aktive timelinen via <code>ApplyGradeFromDRX</code>, og setter per-klipp eksponering på <b>Eksponering-noden</b> for de undereksponerte.
              </p>
            </div>
            <button disabled={busy} onClick={() => void apply()} style={{ ...btn(true), marginTop: 14 }}>
              {busy ? "Propagerer …" : "Bruk på alle klipp"}
            </button>
            {applyMsg && <div style={{ marginTop: 12, fontSize: 12.5, color: applyMsg.startsWith("Feil") ? D.red : D.green }}>{applyMsg}</div>}
            <div style={{ marginTop: 14 }}><button onClick={() => setStep(step - 1)} style={btn()}>← Tilbake</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
