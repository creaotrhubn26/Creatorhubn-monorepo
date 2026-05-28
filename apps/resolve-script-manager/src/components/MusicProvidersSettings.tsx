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

const PROVIDERS: Array<{ id: string; name: string; placeholder: string }> = [
  { id: "soundstripe", name: "Soundstripe", placeholder: "API key fra Pro-abonnement" },
  { id: "musicbed", name: "Musicbed", placeholder: "Partner API key" },
  { id: "artlist", name: "Artlist", placeholder: "Lisens-kode eller account-ref" },
  { id: "audiojungle", name: "AudioJungle (Envato)", placeholder: "Envato Personal Token" },
  { id: "epidemic", name: "Epidemic Sound", placeholder: "Partner key" },
  { id: "storyblocks", name: "Storyblocks", placeholder: "Stock API key" },
  { id: "premiumbeat", name: "PremiumBeat", placeholder: "Shutterstock API key" },
  { id: "jamendo", name: "Jamendo", placeholder: "Client ID (free signup)" },
  { id: "pixabay", name: "Pixabay", placeholder: "API key (free signup)" },
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
    <div className="modal-backdrop" onClick={!busy ? onClose : undefined}>
      <div className="modal" onClick={(e) => e.stopPropagation()}
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

            <div style={{ marginTop: 14, fontSize: 12, fontWeight: 600 }}>
              Credentials per leverandør
            </div>
            <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 6 }}>
              La feltene stå tomme for å beholde eksisterende verdi. Skriv inn ny for å oppdatere. Skriv mellomrom for å slette.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {PROVIDERS.map((prov) => (
                <div key={prov.id} className="field">
                  <label style={{ fontSize: 11 }}>{prov.name}</label>
                  <input type="password" placeholder={prov.placeholder}
                          value={editCreds[prov.id] ?? ""}
                          onChange={(e) => setEditCreds((p) => ({ ...p, [prov.id]: e.target.value }))} />
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
