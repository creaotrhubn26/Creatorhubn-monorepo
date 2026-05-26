/**
 * CommandPalette — Cmd+K global fuzzy-finder (#222).
 *
 * Indexes:
 *   - All registered scripts (search by id, name, description, category)
 *   - All workflows (search by id, name, description)
 *   - Built-in actions (clear logs, open dependencies modal, health-check…)
 *
 * Selection runs the corresponding handler. Esc closes. ↑/↓ navigate.
 * Enter triggers. Cmd+K toggles visibility from anywhere in the app.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { Registry, ScriptMeta, Workflow, WorkflowMap } from "../types";

interface PaletteItem {
  id: string;
  kind: "script" | "workflow" | "action";
  title: string;
  subtitle: string;
  searchBlob: string; // pre-lowercased text used for fuzzy match
  handler: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  registry: Registry | null;
  workflows: WorkflowMap;
  onRunScript: (script: ScriptMeta, dryRun: boolean) => void;
  onSelectWorkflow: (id: string) => void;
  /** Custom actions injected from App.tsx (clear logs, open deps, etc.) */
  actions: Array<{ id: string; title: string; subtitle: string; handler: () => void }>;
}

function buildItems(
  registry: Registry | null,
  workflows: WorkflowMap,
  onRunScript: Props["onRunScript"],
  onSelectWorkflow: Props["onSelectWorkflow"],
  actions: Props["actions"],
): PaletteItem[] {
  const items: PaletteItem[] = [];
  if (registry) {
    for (const s of registry.scripts) {
      const title = s.name || s.id;
      const subtitle = `${s.category} · ${s.id}`;
      items.push({
        id: `script:${s.id}`,
        kind: "script",
        title,
        subtitle,
        searchBlob: `${title} ${s.id} ${s.category} ${s.description ?? ""}`.toLowerCase(),
        handler: () => onRunScript(s, false),
      });
      // Also expose dry-run as a separate entry so users can search for it
      items.push({
        id: `dry:${s.id}`,
        kind: "script",
        title: `${title} — Dry Run`,
        subtitle: `${s.category} · dry`,
        searchBlob: `dry ${title} ${s.id} ${s.category}`.toLowerCase(),
        handler: () => onRunScript(s, true),
      });
    }
  }
  for (const wf of Object.values(workflows) as Workflow[]) {
    items.push({
      id: `wf:${wf.id}`,
      kind: "workflow",
      title: wf.name,
      subtitle: `workflow · ${wf.steps.length} steps`,
      searchBlob: `${wf.name} ${wf.id} ${wf.description ?? ""}`.toLowerCase(),
      handler: () => onSelectWorkflow(wf.id),
    });
  }
  for (const a of actions) {
    items.push({
      id: `action:${a.id}`,
      kind: "action",
      title: a.title,
      subtitle: a.subtitle,
      searchBlob: `${a.title} ${a.subtitle} ${a.id}`.toLowerCase(),
      handler: a.handler,
    });
  }
  return items;
}

function fuzzyScore(query: string, blob: string): number {
  // Simple substring + sequential-char score. 0 = no match.
  if (!query) return 1; // empty query = match everything (sorted alphabetically later)
  if (blob.includes(query)) return 100 - blob.indexOf(query); // direct substring wins
  let qi = 0;
  let score = 0;
  for (let i = 0; i < blob.length && qi < query.length; i++) {
    if (blob[i] === query[qi]) {
      score += 10 - Math.min(9, i - qi); // earlier matches weigh more
      qi++;
    }
  }
  return qi === query.length ? score : 0;
}

export function CommandPalette({
  open, onClose, registry, workflows, onRunScript, onSelectWorkflow, actions,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  const items = useMemo(
    () => buildItems(registry, workflows, onRunScript, onSelectWorkflow, actions),
    [registry, workflows, onRunScript, onSelectWorkflow, actions],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scored = items
      .map((it) => ({ it, score: fuzzyScore(q, it.searchBlob) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40);
    return scored.map((x) => x.it);
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [activeIdx]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(10,5,24,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex", justifyContent: "center",
        paddingTop: "10vh",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 92vw)", maxHeight: "70vh",
          background: "#15093c", border: "1px solid #2c1860",
          borderRadius: 10, overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          display: "flex", flexDirection: "column",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="Søk scripts, workflows, actions… (Esc lukker)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); onClose(); }
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const pick = filtered[activeIdx];
              if (pick) { pick.handler(); onClose(); }
            }
          }}
          style={{
            width: "100%", padding: "14px 16px",
            background: "transparent", border: "none",
            borderBottom: "1px solid #2c1860",
            color: "#f0eaff", fontSize: 15, outline: "none",
          }}
        />
        <div
          ref={listRef}
          style={{ flex: 1, overflowY: "auto", padding: 4 }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: 24, color: "#8674a8", textAlign: "center", fontSize: 13 }}>
              {query ? `Ingen match for "${query}"` : "Skriv for å søke"}
            </div>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={item.id}
                data-idx={idx}
                onClick={() => { item.handler(); onClose(); }}
                onMouseEnter={() => setActiveIdx(idx)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px",
                  background: idx === activeIdx ? "rgba(160,48,192,0.18)" : "transparent",
                  borderRadius: 6, cursor: "pointer",
                  borderLeft: idx === activeIdx ? "2px solid #a030c0" : "2px solid transparent",
                }}
              >
                <span style={{
                  fontSize: 10, padding: "2px 6px",
                  background: KIND_BG[item.kind], color: KIND_FG[item.kind],
                  borderRadius: 3, fontFamily: "monospace",
                  textTransform: "uppercase", letterSpacing: 0.5,
                  minWidth: 50, textAlign: "center",
                }}>{item.kind}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, color: "#f0eaff",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{item.title}</div>
                  <div style={{
                    fontSize: 11, color: "#8674a8",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{item.subtitle}</div>
                </div>
              </div>
            ))
          )}
        </div>
        <div style={{
          padding: "6px 14px", borderTop: "1px solid #2c1860",
          fontSize: 10, color: "#7660a0",
          display: "flex", justifyContent: "space-between",
        }}>
          <span>↑↓ naviger · ↵ kjør · esc lukker</span>
          <span>{filtered.length} match · {items.length} totalt</span>
        </div>
      </div>
    </div>
  );
}

const KIND_BG: Record<string, string> = {
  script: "rgba(160,48,192,0.2)",
  workflow: "rgba(63,199,127,0.2)",
  action: "rgba(240,176,48,0.2)",
};
const KIND_FG: Record<string, string> = {
  script: "#a030c0",
  workflow: "#3fc77f",
  action: "#f0b030",
};
