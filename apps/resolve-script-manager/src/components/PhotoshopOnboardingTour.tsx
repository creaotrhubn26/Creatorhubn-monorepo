/**
 * PhotoshopOnboardingTour — første-gang-bruker får en kort guided
 * tour som forklarer hva hver Photoshop-funksjon i Post Agent gjør.
 *
 * Auto-vises én gang basert på localStorage-flagg. Brukeren kan
 * hoppe over når som helst, eller åpne tour-en igjen senere fra
 * HeaderBar-menyen.
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "trrpa.photoshopTourCompleted";

export function hasCompletedPhotoshopTour(): boolean {
  try {
    return Boolean(localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

export function markPhotoshopTourCompleted(): void {
  try {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  } catch {
    /* noop — private mode */
  }
}

interface Props {
  onClose: () => void;
}

interface Step {
  title: string;
  emoji: string;
  body: React.ReactNode;
}

const STEPS: Step[] = [
  {
    title: "Velkommen!",
    emoji: "👋",
    body: (
      <>
        <p>
          Post Agent kan nå styre <strong>Adobe Photoshop</strong> direkte fra denne appen.
          La meg vise deg de fire nye verktøyene du har fått.
        </p>
        <p style={{ color: "#888", fontSize: 11, marginTop: 12 }}>
          Du finner alle under tannhjul-menyen øverst til høyre.
          Tar 60 sekunder.
        </p>
      </>
    ),
  },
  {
    title: "Helse-sjekk Photoshop",
    emoji: "✓",
    body: (
      <>
        <p>
          <strong>Begynn alltid her.</strong> Helse-sjekken kjører 8 tester
          som verifiserer at hele koblingen til Photoshop fungerer.
        </p>
        <p>
          Når banneret er grønt med <strong>"ALT FUNGERER"</strong>, er du klar.
          Hvis noe er rødt, står en <strong>Fix:</strong>-tekst som forteller hva du må gjøre.
        </p>
      </>
    ),
  },
  {
    title: "Photoshop Bridge",
    emoji: "🌉",
    body: (
      <>
        <p>
          Manuell test-konsoll for enkle Photoshop-kommandoer:
          åpne, lagre, eksportere, bytte smart-object, endre tekst, skru layers av/på.
        </p>
        <p style={{ color: "#888", fontSize: 11, marginTop: 12 }}>
          Brukes mest for å verifisere at noe spesifikt fungerer før
          du bruker Agent eller Templates.
        </p>
      </>
    ),
  },
  {
    title: "Photoshop Templates",
    emoji: "📄",
    body: (
      <>
        <p>
          Pek på en <code>.psd</code>-fil med <code>{"{{key}}"}</code>-navngitte layers,
          fyll inn skjemaet, og Post Agent rendrer et nytt bilde for deg.
        </p>
        <p>
          <strong>Originalen forblir urørt</strong> — appen åpner, fyller, eksporterer,
          og lukker uten å lagre.
        </p>
        <p style={{ color: "#888", fontSize: 11, marginTop: 12 }}>
          Se <code>docs/post-agent/photoshop-templates-cookbook.md</code> for
          hvordan du navngir layers.
        </p>
      </>
    ),
  },
  {
    title: "🎨 Photoshop Agent",
    emoji: "🎨",
    body: (
      <>
        <p>
          Den kraftige varianten: <strong>skriv hva du vil på norsk</strong>, og
          AI-en kaller Photoshop-funksjoner for deg.
        </p>
        <p style={{ background: "rgba(167,139,250,0.10)", padding: "8px 12px", borderRadius: 6, fontStyle: "italic" }}>
          "Bruk template /Users/.../poster.psd, sett title til 'Vinterkurs',
          eksporter som JPG til ~/Desktop/poster.jpg"
        </p>
        <p style={{ color: "#888", fontSize: 11, marginTop: 12 }}>
          Se <code>docs/post-agent/photoshop-agent-prompts.md</code> for 10+ ferdige prompts.
        </p>
      </>
    ),
  },
  {
    title: "PSD-galleri",
    emoji: "🖼",
    body: (
      <>
        <p>
          Visuelt galleri over alle <code>.psd</code>-filer i en mappe — med thumbnails,
          dimensjoner og layer-antall.
        </p>
        <p>
          <strong>Trenger ikke Photoshop åpent</strong> — Post Agent leser PSD-formatet
          direkte i Rust. Klikk på en tile for å åpne fila.
        </p>
      </>
    ),
  },
  {
    title: "Du er klar!",
    emoji: "🚀",
    body: (
      <>
        <p>
          Det er alt. Hvis du står fast, klikk <strong>"Send feedback"</strong> i
          tannhjul-menyen — vi får e-post med diagnostikk-info og kan hjelpe deg raskt.
        </p>
        <p style={{ color: "#888", fontSize: 11, marginTop: 12 }}>
          Du kan åpne denne touren igjen via tannhjul → "Vis Photoshop-tour på nytt".
        </p>
      </>
    ),
  },
];

export function PhotoshopOnboardingTour({ onClose }: Props) {
  const [step, setStep] = useState(0);

  const close = useCallback(() => {
    markPhotoshopTourCompleted();
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setStep((s) => Math.min(s + 1, STEPS.length - 1));
      } else if (e.key === "ArrowLeft") {
        setStep((s) => Math.max(s - 1, 0));
      } else if (e.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  return (
    <div style={overlay} onClick={close}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={progressDots}>
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              style={{
                ...dot,
                background: i === step ? "#a78bfa" : i < step ? "#a78bfa55" : "#333",
              }}
              aria-label={`Gå til steg ${i + 1}`}
            />
          ))}
        </div>

        <div style={emojiArea}>{current.emoji}</div>

        <h2 style={titleStyle}>{current.title}</h2>

        <div style={bodyStyle}>{current.body}</div>

        <footer style={footerBar}>
          <button onClick={close} style={skipBtn}>
            Hopp over
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {!isFirst && (
              <button onClick={() => setStep(step - 1)} style={secondaryBtn}>
                ← Forrige
              </button>
            )}
            {isLast ? (
              <button onClick={close} style={primaryBtn}>
                Kom i gang
              </button>
            ) : (
              <button onClick={() => setStep(step + 1)} style={primaryBtn}>
                Neste →
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.75)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2500,
  backdropFilter: "blur(4px)",
};

const modal: React.CSSProperties = {
  background: "linear-gradient(180deg, #1f1f1f 0%, #1a1a1a 100%)",
  borderRadius: 12,
  width: "min(540px, 92vw)",
  maxHeight: "90vh",
  display: "flex",
  flexDirection: "column",
  color: "#ddd",
  padding: "24px 28px 20px",
  boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
  border: "1px solid #2a2a2a",
};

const progressDots: React.CSSProperties = {
  display: "flex",
  gap: 6,
  justifyContent: "center",
  marginBottom: 16,
};

const dot: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  border: 0,
  cursor: "pointer",
  padding: 0,
  transition: "background 0.2s",
};

const emojiArea: React.CSSProperties = {
  textAlign: "center",
  fontSize: 56,
  marginBottom: 8,
};

const titleStyle: React.CSSProperties = {
  textAlign: "center",
  margin: "0 0 14px",
  fontSize: 22,
  fontWeight: 700,
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  fontSize: 13,
  lineHeight: 1.6,
  color: "#ccc",
  padding: "0 4px",
};

const footerBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginTop: 20,
  paddingTop: 16,
  borderTop: "1px solid #2a2a2a",
};

const skipBtn: React.CSSProperties = {
  background: "transparent",
  border: 0,
  color: "#666",
  fontSize: 12,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  background: "#2a2a2a",
  border: "1px solid #3a3a3a",
  color: "#ddd",
  padding: "8px 14px",
  borderRadius: 6,
  fontSize: 12,
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
  border: 0,
  color: "white",
  padding: "8px 18px",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
