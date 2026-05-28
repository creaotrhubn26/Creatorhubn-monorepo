/**
 * MusicSearchModal — unified søk over musikk-providers (Jamendo, Pixabay,
 * Soundstripe, Artlist) med credential-profil-velger.
 *
 * Source-dropdown lar brukeren bytte mellom:
 *   • Lokal profil (egne credentials)
 *   • Klient-credentials (Min egen / Acme Vault / Hamis Vault / etc.)
 *
 * Klikk på track → trigger download → returner WAV-path til kalleren
 * via onSelect-callback.
 */

import { useEffect, useMemo, useState } from "react";
import { executeScript } from "../api";
import { MusicProvidersSettings } from "./MusicProvidersSettings";
import { loadSettings } from "./SettingsModal";

interface TrackResult {
  provider: string;
  trackId: string;
  title: string;
  artist: string;
  duration: number;
  bpm?: number | null;
  genre?: string | null;
  mood?: string | null;
  previewUrl?: string | null;
  downloadUrl?: string | null;
  licenseUrl?: string | null;
  thumbnailUrl?: string | null;
  priceUsd?: number | null;
  licenseType?: string;
}

interface ProfileInfo {
  id: string;
  name: string;
  credentialsConfigured: string[];
}

interface Props {
  sourceVideo?: string;
  onClose: () => void;
  onSelect: (track: { wavPath: string; title: string; artist: string; provider: string }) => void;
}

export function MusicSearchModal({ sourceVideo, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>("");
  const [results, setResults] = useState<TrackResult[]>([]);
  const [providerStatuses, setProviderStatuses] = useState<Record<string, string>>({});
  const [providersAvailable, setProvidersAvailable] = useState<Array<{ id: string; name: string; configured: boolean; requiresKey: boolean }>>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [providerFilter, setProviderFilter] = useState<string>("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isLoggedInRR = useMemo(() => {
    try {
      const s = loadSettings();
      return Boolean(s.RR_BEARER_TOKEN?.trim());
    } catch { return false; }
  }, [settingsOpen]);  // refresh when settings closed

  // Last profile på mount
  useEffect(() => {
    executeScript("read_credential_profiles", {}, false).then((sum) => {
      const r = sum.events.find((e) => e.type === "result");
      const val = r?.value as { profiles?: ProfileInfo[]; activeProfileId?: string; projectProfileMap?: Record<string, string> } | undefined;
      if (val?.profiles) setProfiles(val.profiles);
      // Bestem aktiv profil for dette prosjektet
      const projMap = val?.projectProfileMap || {};
      const projId = sourceVideo && projMap[sourceVideo];
      setActiveProfileId(projId || val?.activeProfileId || "default");
    }).catch(() => { /* noop */ });
  }, [sourceVideo]);

  const filteredResults = useMemo(() => {
    if (!providerFilter) return results;
    return results.filter((r) => r.provider === providerFilter);
  }, [results, providerFilter]);

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearchBusy(true);
    setSearchError(null);
    setResults([]);
    try {
      const sum = await executeScript("search_music_providers", {
        query: query.trim(),
        sourceVideo,
        limit: 8,
      }, false);
      const r = sum.events.find((e) => e.type === "result");
      const val = r?.value as {
        results?: TrackResult[];
        providerStatuses?: Record<string, string>;
        providersAvailable?: Array<{ id: string; name: string; configured: boolean; requiresKey: boolean }>;
      } | undefined;
      if (val?.results) setResults(val.results);
      if (val?.providerStatuses) setProviderStatuses(val.providerStatuses);
      if (val?.providersAvailable) setProvidersAvailable(val.providersAvailable);
    } catch (err) {
      setSearchError(String(err));
    } finally {
      setSearchBusy(false);
    }
  };

  const downloadTrack = async (track: TrackResult) => {
    setDownloadingId(`${track.provider}-${track.trackId}`);
    setDownloadError(null);
    try {
      const sum = await executeScript("download_provider_track", {
        provider: track.provider,
        trackId: track.trackId,
        downloadUrl: track.downloadUrl,
        title: track.title,
        artist: track.artist,
        sourceVideo,
      }, false);
      const r = sum.events.find((e) => e.type === "result");
      const val = r?.value as { wavPath?: string } | undefined;
      if (val?.wavPath) {
        onSelect({
          wavPath: val.wavPath,
          title: track.title,
          artist: track.artist,
          provider: track.provider,
        });
      } else {
        setDownloadError("Ingen WAV-path returnert");
      }
    } catch (err) {
      setDownloadError(String(err));
    } finally {
      setDownloadingId(null);
    }
  };

  const setProjectProfile = async (profileId: string) => {
    if (!sourceVideo) return;
    setActiveProfileId(profileId);
    try {
      await executeScript("save_credential_profiles", {
        action: "set_project_profile",
        payload: { sourceVideo, profileId },
      }, false);
    } catch (err) {
      console.warn("set_project_profile failed:", err);
    }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !downloadingId) onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [downloadingId, onClose]);

  return (
    <div className="modal-backdrop anim-fade-in" onClick={!downloadingId ? onClose : undefined}>
      <div className="modal anim-slide-up" onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 800, width: "min(96vw, 800px)", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>🎵 Søk musikk fra leverandør</h2>
          <button onClick={() => setSettingsOpen(true)}
                  title="Administrer credentials per leverandør"
                  style={{ fontSize: 11, padding: "4px 10px" }}>
            ⚙ Profiler
          </button>
        </div>

        {/* Login-status for Vault */}
        {!isLoggedInRR ? (
          <div style={{ marginTop: 10, background: "var(--bg-3)",
                          borderLeft: "3px solid #f0a500",
                          padding: 10, borderRadius: 4, fontSize: 11 }}>
            ⓘ <strong>Ikke logget inn med Role Room</strong> — du kan bruke lokal profil
            for credentials. For å hente kunde-credentials fra Vault må du logge inn
            via Settings → Sign in.
          </div>
        ) : (
          <div style={{ marginTop: 10, background: "rgba(74, 212, 138, 0.10)",
                          borderLeft: "3px solid #4ad48a",
                          padding: 10, borderRadius: 4, fontSize: 11 }}>
            🟢 <strong>Logget inn med Role Room</strong> — Vault-credentials fra prosjekt-tildelte
            klienter er tilgjengelige (kommer i neste iterasjon).
          </div>
        )}

        {/* Profil-velger */}
        <div className="field" style={{ marginTop: 12 }}>
          <label style={{ fontSize: 11, opacity: 0.7 }}>
            Bruk credentials fra
          </label>
          <select value={activeProfileId}
                  onChange={(e) => setProjectProfile(e.target.value)}
                  style={{ width: "100%" }}>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.credentialsConfigured.length > 0
                  ? p.credentialsConfigured.join(", ")
                  : "ingen paywallede konfigurert (kun gratis)"}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>
            Profilen brukes for søk + lisens. Endring lagres per prosjekt.
          </div>
        </div>

        {/* Søke-input */}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <input type="text" placeholder='F.eks. "wedding ceremony piano", "soft acoustic"'
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  disabled={searchBusy}
                  style={{ flex: 1, fontSize: 13 }} />
          <button onClick={runSearch} disabled={searchBusy || !query.trim()}
                  className="primary">
            {searchBusy ? "⏳ Søker…" : "🔍 Søk"}
          </button>
        </div>

        {/* Provider-status-badges */}
        {Object.keys(providerStatuses).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            <button onClick={() => setProviderFilter("")}
                    style={{ fontSize: 11, padding: "3px 8px",
                              background: providerFilter === "" ? "var(--accent-dim)" : "transparent",
                              border: "1px solid var(--border)" }}>
              Alle ({results.length})
            </button>
            {providersAvailable.map((p) => {
              const status = providerStatuses[p.id];
              const count = results.filter((r) => r.provider === p.id).length;
              const isConfigured = p.configured;
              return (
                <button key={p.id}
                        onClick={() => setProviderFilter(p.id)}
                        disabled={!isConfigured && p.requiresKey}
                        title={!isConfigured && p.requiresKey ? "Krever API-key i profil" : ""}
                        style={{ fontSize: 11, padding: "3px 8px",
                                  background: providerFilter === p.id ? "var(--accent-dim)" : "transparent",
                                  border: "1px solid var(--border)",
                                  opacity: isConfigured || !p.requiresKey ? 1 : 0.4 }}>
                  {status === "ok" ? "🟢" : !p.requiresKey ? "🟢" : "🔒"}
                  {" "}{p.name} {count > 0 ? `(${count})` : ""}
                </button>
              );
            })}
          </div>
        )}

        {searchError && (
          <div style={{ marginTop: 10, background: "var(--bg-3)",
                          borderLeft: "3px solid var(--danger)", padding: 8, borderRadius: 4, fontSize: 12 }}>
            <strong>Feil:</strong> {searchError}
          </div>
        )}

        {/* Resultater */}
        <div className="anim-stagger" style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6,
                       maxHeight: "50vh", overflowY: "auto" }}>
          {filteredResults.map((r) => {
            const dlId = `${r.provider}-${r.trackId}`;
            const isDownloading = downloadingId === dlId;
            return (
              <div key={dlId}
                    style={{ display: "flex", alignItems: "center", gap: 10,
                              padding: 10, background: "var(--bg-3)", borderRadius: 6 }}>
                <div style={{ width: 44, height: 44, borderRadius: 4,
                                background: r.thumbnailUrl
                                  ? `url(${r.thumbnailUrl}) center/cover`
                                  : "linear-gradient(135deg, var(--bg-4), var(--accent-dim))",
                                flex: "0 0 auto", display: "flex",
                                alignItems: "center", justifyContent: "center",
                                fontSize: 18 }}>
                  {!r.thumbnailUrl && "🎵"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden",
                                  textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.title}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>
                    {r.artist} · {r.duration.toFixed(0)}s
                    {r.bpm && ` · ${r.bpm.toFixed(0)} BPM`}
                    {r.genre && ` · ${r.genre}`}
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.5, marginTop: 2 }}>
                    {r.provider} · {r.licenseType === "subscription" ? "abonnement"
                      : r.licenseType === "royalty_free" ? "gratis"
                      : r.licenseType === "per_track" ? `$${r.priceUsd}` : r.licenseType}
                  </div>
                </div>
                {r.previewUrl && (
                  <button title="Forhåndslytte"
                          onClick={() => {
                    const a = new Audio(r.previewUrl!);
                    a.play().catch(() => { /* noop */ });
                  }} style={{ fontSize: 11, padding: "4px 8px" }}>
                    ▶
                  </button>
                )}
                {r.licenseUrl && r.provider === "artlist" && (
                  <button onClick={() => window.open(r.licenseUrl!, "_blank")}
                          style={{ fontSize: 11, padding: "4px 8px" }}>
                    🌐 Åpne
                  </button>
                )}
                {r.downloadUrl && (
                  <button className="primary"
                          disabled={isDownloading}
                          onClick={() => downloadTrack(r)}
                          style={{ fontSize: 11, padding: "4px 12px" }}>
                    {isDownloading ? "⏳" : "⬇ Velg"}
                  </button>
                )}
              </div>
            );
          })}
          {filteredResults.length === 0 && !searchBusy && results.length === 0 && query && (
            <div style={{ textAlign: "center", padding: 20, opacity: 0.5, fontSize: 12 }}>
              Ingen resultater. Prøv andre søkeord eller endre profil.
            </div>
          )}
        </div>

        {downloadError && (
          <div style={{ marginTop: 8, background: "var(--bg-3)",
                          borderLeft: "3px solid var(--danger)", padding: 8, borderRadius: 4, fontSize: 11 }}>
            <strong>Nedlasting-feil:</strong> {downloadError}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button onClick={onClose} disabled={!!downloadingId}>Lukk</button>
        </div>
      </div>

      {settingsOpen && (
        <MusicProvidersSettings onClose={() => {
          setSettingsOpen(false);
          // Reload profiles to pick up any changes
          executeScript("read_credential_profiles", {}, false).then((sum) => {
            const r = sum.events.find((e) => e.type === "result");
            const val = r?.value as { profiles?: ProfileInfo[]; activeProfileId?: string } | undefined;
            if (val?.profiles) setProfiles(val.profiles);
            if (val?.activeProfileId && !activeProfileId) setActiveProfileId(val.activeProfileId);
          });
        }} />
      )}
    </div>
  );
}
