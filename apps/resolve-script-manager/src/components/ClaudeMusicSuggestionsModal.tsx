/**
 * ClaudeMusicSuggestionsModal — viser Claude-foreslåtte musikk-stiler for
 * en spesifikk scene/segment. Klikk på et forslag → åpner provider-søket
 * med søke-query forhåndsutfylt.
 *
 * Driftes via execute_script("claude_music_suggestions", {chapter, durationSec, ...}).
 */

import { useEffect, useState } from "react";
import { executeScript } from "../api";
import { IconX, IconSparkle } from "./Icons";

interface Suggestion {
  title: string;
  artistOrStyle: string;
  bpmTarget: number;
  durationSec: number;
  mood: string;
  why: string;
  searchQuery: string;
  preferredProviders: string[];
}

interface ClaudeMusicSuggestionsModalProps {
  open: boolean;
  chapter: string;
  durationSec: number;
  cutPaceHz?: number;
  availableProviders?: string[];
  onClose: () => void;
  /** Klikk på et forslag → kall denne med searchQuery for å åpne provider-søk. */
  onUseSuggestion: (query: string, preferredProviders: string[]) => void;
}

const CHAPTER_LABEL: Record<string, string> = {
  ceremony: "Vielsen",
  vows: "Løftene",
  first_dance: "First Dance",
  speeches: "Taler",
  nikkah: "Nikkah",
  party: "Festen",
  details: "Detaljer",
  preparation: "Forberedelser",
  highlight: "Highlight",
};

export function ClaudeMusicSuggestionsModal({
  open, chapter, durationSec, cutPaceHz, availableProviders,
  onClose, onUseSuggestion,
}: ClaudeMusicSuggestionsModalProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      setLoading(true); setError(null); setSuggestions([]);
      try {
        const params: Record<string, unknown> = {
          chapter,
          durationSec,
        };
        if (cutPaceHz != null) params.cutPaceHz = cutPaceHz;
        if (availableProviders && availableProviders.length > 0) {
          params.cuesAvailable = availableProviders;
        }
        const result = await executeScript("claude_music_suggestions", params);
        if (cancelled) return;
        const data = (result as unknown as { result?: { suggestions?: Suggestion[] } })?.result;
        const list = data?.suggestions ?? [];
        if (list.length === 0) {
          setError("Claude returnerte ingen forslag.");
        } else {
          setSuggestions(list);
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, chapter, durationSec, cutPaceHz, availableProviders]);

  if (!open) return null;

  const chapterLabel = CHAPTER_LABEL[chapter] ?? chapter;

  return (
    <div className="ce-shortcuts-backdrop" onClick={onClose}>
      <div className="ce-shortcuts-modal anim-pop-in"
           onClick={(e) => e.stopPropagation()}
           style={{ width: 560, maxHeight: "85vh", overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                       marginBottom: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 16 }}>
              <IconSparkle size={16} />
              <span>Musikk-forslag for {chapterLabel}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
              {durationSec.toFixed(0)}s · Claude analyserer scenetype + stemning
            </div>
          </div>
          <button onClick={onClose}
                  style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--text-2)" }}>
            <IconX size={16} />
          </button>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-2)" }}>
            <div className="anim-pulse" style={{ fontSize: 13 }}>
              Claude tenker …
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: "rgba(239,79,111,0.10)", borderLeft: "3px solid #ef4f6f",
                          padding: 12, borderRadius: 4, fontSize: 12, color: "#ef4f6f" }}>
            {error}
          </div>
        )}

        {!loading && !error && suggestions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {suggestions.map((s, i) => (
              <div key={i} className="anim-stagger"
                   style={{ background: "var(--bg-2)", border: "1px solid var(--border)",
                              borderRadius: 8, padding: 12, cursor: "pointer",
                              animationDelay: `${i * 60}ms` }}
                   onClick={() => onUseSuggestion(s.searchQuery, s.preferredProviders ?? [])}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                                gap: 8 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-2)" }}>
                      {s.artistOrStyle}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, fontSize: 10 }}>
                    <span style={{ background: "var(--bg-3)", padding: "2px 6px", borderRadius: 999 }}>
                      {s.bpmTarget} BPM
                    </span>
                    <span style={{ background: "var(--bg-3)", padding: "2px 6px", borderRadius: 999 }}>
                      {s.durationSec}s
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 6, lineHeight: 1.4 }}>
                  {s.why}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8,
                                fontSize: 11 }}>
                  <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                    Søk: {s.searchQuery}
                  </span>
                  {s.preferredProviders && s.preferredProviders.length > 0 && (
                    <span style={{ color: "var(--text-3)" }}>
                      → {s.preferredProviders.join(", ")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && (
          <div style={{ marginTop: 16, fontSize: 11, color: "var(--text-3)",
                          textAlign: "center" }}>
            Klikk på et forslag for å åpne provider-søk med query forhåndsutfylt.
          </div>
        )}
      </div>
    </div>
  );
}

export default ClaudeMusicSuggestionsModal;
