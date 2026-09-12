/**
 * ModuleGate — paywall vist når en modul ikke er låst opp.
 *
 * Brukes for à la carte-moduler (Demo Studio, Marketing, Capture, Resolve).
 * Viser kjøp-CTA (→ Marketplace i nettleser) + "Jeg har kjøpt"-refresh, og
 * en logg-inn-prompt hvis brukeren ikke er innlogget.
 */

import { useState } from "react";
import {
  MODULE_LABELS,
  MODULE_PRICE_NOK,
  openModulePurchase,
  refreshEntitlements,
  type PostAgentModule,
} from "../entitlements";

interface ModuleGateProps {
  module: PostAgentModule;
  signedIn: boolean;
  onClose: () => void;
  onSignIn?: () => void;
}

export function ModuleGate({ module, signedIn, onClose, onSignIn }: ModuleGateProps) {
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const label = MODULE_LABELS[module];
  const price = MODULE_PRICE_NOK[module];

  async function handleAlreadyBought() {
    setChecking(true);
    setNote(null);
    const mods = await refreshEntitlements();
    setChecking(false);
    if (!mods.includes(module)) {
      setNote(
        "Fant ingen aktiv " +
          label +
          "-modul enda. Kjøp kan ta noen sekunder å registrere — prøv igjen om litt.",
      );
    }
    // Hvis modulen nå er aktiv, fyrer refreshEntitlements event → parent gater inn.
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: 40,
        textAlign: "center",
        background: "linear-gradient(160deg, #0f172a 0%, #1a1030 100%)",
        color: "#f0eaff",
      }}
    >
      <div
        style={{
          maxWidth: 460,
          background: "rgba(110,63,199,0.10)",
          border: "1px solid rgba(160,48,192,0.30)",
          borderRadius: 16,
          padding: "32px 28px",
        }}
      >
        <div style={{ fontSize: 13, letterSpacing: 1, color: "#b8a8d8", textTransform: "uppercase" }}>
          Modul låst
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: "8px 0 6px" }}>{label}</h2>
        <p style={{ fontSize: 14, color: "#d8c8e8", lineHeight: 1.6, margin: "0 0 22px" }}>
          {signedIn
            ? `Denne modulen krever et aktivt abonnement (${price} kr/mnd). Kjøp den i Marketplace — du betaler kun for modulene du bruker.`
            : "Du må logge inn og ha et aktivt abonnement for å bruke denne modulen."}
        </p>

        {signedIn ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              className="primary"
              style={{ padding: "12px 20px", fontSize: 15 }}
              onClick={() => openModulePurchase(module)}
            >
              Kjøp {label} — {price} kr/mnd
            </button>
            <button
              className="ghost"
              style={{ padding: "10px 20px" }}
              disabled={checking}
              onClick={handleAlreadyBought}
            >
              {checking ? "Sjekker…" : "Jeg har kjøpt — oppdater"}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              className="primary"
              style={{ padding: "12px 20px", fontSize: 15 }}
              onClick={() => (onSignIn ? onSignIn() : undefined)}
            >
              Logg inn
            </button>
          </div>
        )}

        {note && (
          <div style={{ marginTop: 16, fontSize: 13, color: "#f0b8b8" }}>{note}</div>
        )}

        <button
          className="ghost"
          style={{ marginTop: 22, padding: "8px 16px", opacity: 0.7 }}
          onClick={onClose}
        >
          Tilbake
        </button>
      </div>
    </div>
  );
}
