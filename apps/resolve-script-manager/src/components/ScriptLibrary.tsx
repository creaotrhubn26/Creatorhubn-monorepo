import { useMemo, useState } from "react";
import type { Registry, RunRecord, ScriptMeta } from "../types";
import { ScriptCard } from "./ScriptCard";

interface Props {
  registry: Registry;
  lastRunByScript: Record<string, RunRecord>;
  busy: boolean;
  onTrigger: (script: ScriptMeta, dryRun: boolean) => void;
}

export function ScriptLibrary({ registry, lastRunByScript, busy, onTrigger }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const scriptsByCategory = useMemo(() => {
    const map: Record<string, ScriptMeta[]> = { all: [...registry.scripts] };
    for (const cat of registry.categories) {
      map[cat.id] = registry.scripts.filter((s) => s.category === cat.id);
    }
    return map;
  }, [registry]);

  const visible = scriptsByCategory[activeCategory] ?? [];

  return (
    <section>
      <h3 className="section-title">Script Library</h3>
      <div className="tabs">
        <button
          className={`tab ${activeCategory === "all" ? "active" : ""}`}
          onClick={() => setActiveCategory("all")}
        >
          All <span className="count">{registry.scripts.length}</span>
        </button>
        {registry.categories.map((cat) => (
          <button
            key={cat.id}
            className={`tab ${activeCategory === cat.id ? "active" : ""}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.name}
            <span className="count">{scriptsByCategory[cat.id]?.length ?? 0}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="empty">No scripts in this category yet.</div>
      ) : (
        <div className="script-grid">
          {visible.map((script) => (
            <ScriptCard
              key={script.id}
              script={script}
              lastRun={lastRunByScript[script.id] ?? null}
              busy={busy}
              onDryRun={() => onTrigger(script, true)}
              onRun={() => onTrigger(script, false)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
