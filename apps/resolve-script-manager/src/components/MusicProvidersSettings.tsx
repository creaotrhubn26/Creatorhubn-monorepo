/**
 * MusicProvidersSettings — UI for å administrere credential-profiler.
 *
 *   • List profiler (Min egen + opprettede)
 *   • Add/Edit/Delete profil
 *   • Per profil: input-field per provider (Soundstripe, Musicbed, Artlist, ...)
 *   • Set active globalt
 */

import { useEffect, useState } from "react";
import { executeScript } from "../api";

interface Profile {
  id: string;
  name: string;
  credentialsConfigured: string[];
  credentialsMasked?: Record<string, string>;
}

interface Props {
  onClose: () => void;
}

interface ProviderInfo {
  id: string;
  name: string;
  placeholder: string;
  /** URL hvor bruker logger inn + finner token. Vi åpner direkte hit. */
  loginUrl: string;
  /** Stegvis veiledning. */
  instructions: string[];
  /** Domain for Clearbit-logo (gir ekte brand-logo i UI). */
  logoDomain: string;
  /** Fallback emoji hvis logo-fetch feiler. */
  emoji: string;
  /** Hex farge for branding (knapp-aksent). */
  brandColor?: string;
  /** Hvis true, har provider OAuth — vi setter opp callback. (TODO) */
  hasOAuth?: boolean;
}

/** Clearbit Logo API gir ekte brand-logoer mot bare domain. */
const logoUrl = (domain: string) => `https://logo.clearbit.com/${domain}?size=64`;

function ProviderLogo({ prov }: { prov: ProviderInfo }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span style={{ fontSize: 22, width: 32, height: 32,
                            display: "flex", alignItems: "center", justifyContent: "center" }}>
      {prov.emoji}
    </span>;
  }
  return (
    <img src={logoUrl(prov.logoDomain)} alt={prov.name}
          onError={() => setFailed(true)}
          style={{ width: 32, height: 32, objectFit: "contain",
                    borderRadius: 4, background: "white", padding: 2 }} />
  );
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: "soundstripe", name: "Soundstripe", logoDomain: "soundstripe.com", emoji: "🎶",
    brandColor: "#FF3D00",
    placeholder: "Lim inn token fra Soundstripe-dashboard",
    loginUrl: "https://app.soundstripe.com/account/api",
    instructions: [
      "Logg inn med din epost og passord",
      "Klikk \"Generate new token\" i API-seksjonen",
      "Kopiér tokenet (lang tegnstreng)",
      "Lim inn her under",
    ],
  },
  {
    id: "musicbed", name: "Musicbed", logoDomain: "musicbed.com", emoji: "🎼",
    brandColor: "#1A1A1A",
    placeholder: "Partner API key (krever Partner Program)",
    loginUrl: "https://www.musicbed.com/account",
    instructions: [
      "Krever Musicbed Partner-status",
      "Søk på partnership@musicbed.com",
      "Etter godkjenning: dashboard → API → kopier key",
    ],
  },
  {
    id: "artlist", name: "Artlist", logoDomain: "artlist.io", emoji: "🎵",
    brandColor: "#00C7B7",
    placeholder: "Account-referanse eller lisens-ID",
    loginUrl: "https://artlist.io/account",
    instructions: [
      "Artlist har ingen offentlig API",
      "Vi åpner deres katalog i nettleseren",
      "Du laster ned WAV manuelt etter kjøp",
      "Lim inn lisens-kode her for å spore i Post Agent",
    ],
  },
  {
    id: "audiojungle", name: "AudioJungle (Envato)", logoDomain: "envato.com", emoji: "🎷",
    brandColor: "#82B541",
    placeholder: "Envato Personal Token",
    loginUrl: "https://build.envato.com/my-apps/",
    instructions: [
      "Logg inn med din Envato-konto",
      "Klikk \"Register a new app\" og lag en personal token",
      "Velg \"Access AudioJungle items\" i scopes",
      "Kopier tokenet (vises bare én gang)",
    ],
  },
  {
    id: "epidemic", name: "Epidemic Sound", logoDomain: "epidemicsound.com", emoji: "🎧",
    brandColor: "#000000",
    placeholder: "Partner API key (lukket beta)",
    loginUrl: "https://www.epidemicsound.com/api",
    instructions: [
      "Epidemic Sound API er bare for godkjente partnere",
      "Kontakt: developers@epidemicsound.com",
    ],
  },
  {
    id: "storyblocks", name: "Storyblocks Audio", logoDomain: "storyblocks.com", emoji: "📦",
    brandColor: "#FF6B35",
    placeholder: "Stock API key (Enterprise-konto)",
    loginUrl: "https://api.storyblocks.com/",
    instructions: [
      "Krever Enterprise-konto hos Storyblocks",
      "Dashboard → API → Generate key",
    ],
  },
  {
    id: "premiumbeat", name: "PremiumBeat", logoDomain: "premiumbeat.com", emoji: "💥",
    brandColor: "#FF2A2D",
    placeholder: "Shutterstock developer token",
    loginUrl: "https://www.shutterstock.com/account/developers",
    instructions: [
      "PremiumBeat eies av Shutterstock — bruk Shutterstock API",
      "Logg inn med Shutterstock-konto",
      "Klikk \"Create app\" og generer token",
    ],
  },
  {
    id: "jamendo", name: "Jamendo", logoDomain: "jamendo.com", emoji: "🌍",
    brandColor: "#FF8500",
    placeholder: "Client ID (gratis registrering)",
    loginUrl: "https://devportal.jamendo.com/",
    instructions: [
      "Helt gratis å registrere seg",
      "Logg inn med ny eller eksisterende konto",
      "Klikk \"Create a new app\" → fyll inn navn",
      "Kopier client ID (ikke client secret)",
    ],
    hasOAuth: true,
  },
  {
    id: "pixabay", name: "Pixabay", logoDomain: "pixabay.com", emoji: "📸",
    brandColor: "#7CB342",
    placeholder: "API key (gratis registrering)",
    loginUrl: "https://pixabay.com/accounts/register/",
    instructions: [
      "Gratis registrering, ingen kredittkort",
      "Etter login: gå til https://pixabay.com/api/docs/",
      "Din API-key vises øverst på siden",
      "Kopier og lim inn",
    ],
  },
];

export function MusicProvidersSettings({ onClose }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCreds, setEditCreds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const sum = await executeScript("read_credential_profiles", {}, false);
      const r = sum.events.find((e) => e.type === "result");
      const val = r?.value as { profiles?: Profile[]; activeProfileId?: string } | undefined;
      if (val?.profiles) setProfiles(val.profiles);
      if (val?.activeProfileId) setActiveProfileId(val.activeProfileId);
    } catch (err) {
      setError(String(err));
    }
  };

  useEffect(() => { load(); }, []);

  const startEdit = (p?: Profile) => {
    if (p) {
      setEditingId(p.id);
      setEditName(p.name);
      setEditCreds({}); // Vi viser ikke eksisterende keys (de er masked); bruker kan re-paste eller la stå
    } else {
      setEditingId("__new__");
      setEditName("");
      setEditCreds({});
    }
  };

  const saveEdit = async () => {
    if (!editName.trim()) { setError("Navn må fylles inn"); return; }
    setBusy(true);
    setError(null);
    try {
      const payload: { id?: string; name: string; credentials: Record<string, string> } = {
        name: editName.trim(),
        credentials: editCreds,
      };
      if (editingId && editingId !== "__new__") payload.id = editingId;
      await executeScript("save_credential_profiles", {
        action: "upsert_profile", payload,
      }, false);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteProfile = async (id: string) => {
    if (!confirm(`Slett profil? Credentials forsvinner.`)) return;
    setBusy(true);
    try {
      await executeScript("save_credential_profiles", {
        action: "delete_profile", payload: { id },
      }, false);
      await load();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const setActive = async (id: string) => {
    setBusy(true);
    try {
      await executeScript("save_credential_profiles", {
        action: "set_active", payload: { profileId: id },
      }, false);
      setActiveProfileId(id);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop anim-fade-in" onClick={!busy ? onClose : undefined}>
      <div className="modal anim-slide-up" onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 720, width: "min(96vw, 720px)", maxHeight: "92vh", overflowY: "auto" }}>
        <h2>⚙ Musikk-leverandører</h2>
        <p style={{ fontSize: 12, opacity: 0.75, marginTop: -4 }}>
          Lagre API-keys per provider. Du kan ha flere profiler (egne credentials + klient-credentials).
          Hver prosjekt kan bruke ulik profil.
        </p>

        {error && (
          <div style={{ marginTop: 12, background: "var(--bg-3)",
                          borderLeft: "3px solid var(--danger)", padding: 10, borderRadius: 4 }}>
            <strong>Feil:</strong> {error}
          </div>
        )}

        {/* Profil-liste */}
        {!editingId && (
          <>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {profiles.map((p) => {
                const isActive = activeProfileId === p.id;
                return (
                  <div key={p.id} style={{ background: "var(--bg-3)", padding: 12,
                                              borderRadius: 8, border: isActive ? "1px solid var(--accent)" : "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="radio" checked={isActive}
                              onChange={() => setActive(p.id)}
                              disabled={busy} />
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: 13 }}>{p.name}</strong>
                        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                          {p.credentialsConfigured.length > 0
                            ? `Konfigurert: ${p.credentialsConfigured.join(", ")}`
                            : "Ingen credentials lagret (kun gratis providers virker)"}
                        </div>
                      </div>
                      <button onClick={() => startEdit(p)} disabled={busy}
                              style={{ fontSize: 11, padding: "4px 10px" }}>Redigér</button>
                      {p.id !== "default" && (
                        <button onClick={() => deleteProfile(p.id)} disabled={busy}
                                style={{ fontSize: 11, padding: "4px 10px",
                                          color: "var(--danger)" }}>Slett</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => startEdit()} disabled={busy}
                    style={{ marginTop: 12, width: "100%", padding: "8px 14px" }}>
              + Ny profil
            </button>
          </>
        )}

        {/* Edit-form */}
        {editingId && (
          <div style={{ marginTop: 14 }}>
            <div className="field">
              <label>Profil-navn</label>
              <input type="text" placeholder='F.eks. "Klient: Acme Corp"'
                      value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>

            <div style={{ marginTop: 16, fontSize: 12, fontWeight: 600 }}>
              Logg inn på leverandørene
            </div>
            <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 8 }}>
              Klikk "Logg inn" for å åpne leverandørens login-side i nettleseren. Følg trinnene
              under, kopier tokenet, og lim inn her. La felt stå tomt for å beholde forrige.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {PROVIDERS.map((prov) => (
                <div key={prov.id}
                      style={{ background: "rgba(0,0,0,0.20)", padding: 12,
                                borderRadius: 6, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12,
                                  marginBottom: 10 }}>
                    {/* Brand-logo via Clearbit, fallback til emoji */}
                    <ProviderLogo prov={prov} />
                    <strong style={{ flex: 1, fontSize: 13 }}>{prov.name}</strong>
                    <button onClick={() => {
                      try {
                        window.open(prov.loginUrl, "_blank", "noopener,noreferrer");
                      } catch { /* noop */ }
                    }} style={{ fontSize: 11, padding: "6px 14px",
                                  background: prov.brandColor || "var(--accent-dim)",
                                  color: "white", fontWeight: 600,
                                  border: "none", borderRadius: 4,
                                  cursor: "pointer" }}>
                      Logg inn på {prov.name} ↗
                    </button>
                  </div>
                  <ol style={{ fontSize: 10, opacity: 0.75, margin: "0 0 10px 18px",
                                  padding: 0, lineHeight: 1.6 }}>
                    {prov.instructions.map((step, i) => <li key={i}>{step}</li>)}
                  </ol>
                  <input type="password" placeholder={prov.placeholder}
                          value={editCreds[prov.id] ?? ""}
                          onChange={(e) => setEditCreds((p) => ({ ...p, [prov.id]: e.target.value }))}
                          style={{ fontSize: 11 }} />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={() => { setEditingId(null); setEditCreds({}); }}
                      disabled={busy}>Avbryt</button>
              <button onClick={saveEdit} disabled={busy} className="primary">
                {busy ? "Lagrer …" : "Lagre profil"}
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border)",
                        fontSize: 11, opacity: 0.6, lineHeight: 1.5 }}>
          📁 Credentials lagres i <code>~/Library/Application Support/no.creatorhubn.roleroom-post-agent/credential_profiles.json</code> med permissions 0600 (kun din bruker kan lese).
        </div>

        {!editingId && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={onClose} disabled={busy}>Lukk</button>
          </div>
        )}
      </div>
    </div>
  );
}
