/**
 * CinematicSuggestions — «AI-regissøren fletter capture/broll automatisk».
 *
 * Director ser HELE storyboardet + produkt-konteksten og foreslår hvor
 * AI-generert footage (krok/kontekst/overgang/outro) styrker demoen. Forslagene
 * settes inn som broll-scener (status 'pending' — ikke generert ennå), på riktig
 * plass. Brukeren genererer så hver med kreditt-vokteren (BrollComposer/Generér).
 */
import { useEffect, useState } from 'react';
import { useDemoStudio } from './demoStudioStore';
import { makeScene, type DemoScene, type DemoType, type ScriptMeta } from './demoStudioModel';
import { suggestCinematicScenes, type CinematicSuggestion } from './demoStudioAI';

interface Palette {
  panel: string; cream: string; line: string; lineStrong: string;
  ink: string; inkSoft: string; inkFaint: string; accent: string; green: string; font: string;
}

const POS_LABEL: Record<CinematicSuggestion['position'], string> = { intro: 'Intro', outro: 'Outro', after: 'Etter scene' };

export function CinematicSuggestions({ C, onClose }: { C: Palette; onClose: () => void }) {
  const { project, replaceScenes, selectScene, ensureProductBrain } = useDemoStudio();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CinematicSuggestion[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!project) return;
    let alive = true;
    const meta: ScriptMeta = project.scriptMeta ?? { tone: 'professional', audience: 'General', language: 'Norsk', length: 'medium' };
    // Forankre regien i dyp produkt-forståelse (Product Brain, cachet).
    ensureProductBrain()
      .catch(() => '')
      .then((siteContext) => suggestCinematicScenes({
        url: project.url, demoType: project.demoType as DemoType, goal: project.goal, meta, scenes: project.scenes, siteContext,
      }))
      .then((s) => { if (!alive) return; setSuggestions(s); setPicked(new Set(s.map((_, i) => i))); })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (i: number) => setPicked((p) => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const buildScene = (s: CinematicSuggestion): DemoScene => {
    const device = project?.devices[0] ?? 'macbook';
    const scene = makeScene(0, device);
    scene.source = 'broll';
    scene.brollPrompt = s.prompt;
    scene.title = s.title || 'Kinematisk klipp';
    scene.narration = s.narration || '';
    scene.requiredAction = 'AI-generert kinematisk klipp (ikke generert ennå)';
    scene.actionType = 'wait';
    scene.duration = 6;
    scene.status = 'pending';
    scene.notes = s.reason || '';
    return scene;
  };

  const insert = () => {
    if (!project) return;
    const chosen = suggestions.filter((_, i) => picked.has(i));
    let result = [...project.scenes];
    // 'after' fra høyeste indeks til laveste så innsetting ikke forskyver de andre.
    const afters = chosen.filter((s) => s.position === 'after').sort((a, b) => (b.afterIndex ?? 0) - (a.afterIndex ?? 0));
    for (const s of afters) {
      const at = Math.min(result.length, (s.afterIndex ?? result.length - 1) + 1);
      result.splice(at, 0, buildScene(s));
    }
    const intros = chosen.filter((s) => s.position === 'intro').map(buildScene);
    const outros = chosen.filter((s) => s.position === 'outro').map(buildScene);
    result = [...intros, ...result, ...outros];
    replaceScenes(result);
    const first = intros[0] ?? result.find((s) => s.source === 'broll');
    if (first) selectScene(first.id);
    onClose();
  };

  const btn = (primary?: boolean, disabled?: boolean): React.CSSProperties => ({
    padding: '9px 18px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, fontFamily: C.font,
    cursor: disabled ? 'default' : 'pointer', border: `1px solid ${primary ? C.accent : C.lineStrong}`,
    background: primary ? C.accent : C.panel, color: primary ? '#fff' : C.ink, opacity: disabled ? 0.55 : 1,
  });

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(31,27,23,0.42)', display: 'grid', placeItems: 'center', zIndex: 80 }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 540, maxWidth: '94vw', maxHeight: '86vh', overflowY: 'auto', background: C.panel,
        borderRadius: 16, padding: '20px 22px 22px', boxShadow: '0 24px 60px rgba(31,27,23,0.28)', fontFamily: C.font,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.ink }}>Kinematisk regi</div>
          <div onClick={onClose} style={{ cursor: 'pointer', color: C.inkFaint, fontSize: 18, lineHeight: 1 }}>✕</div>
        </div>
        <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3, lineHeight: 1.45 }}>
          Regissøren foreslår hvor AI-footage styrker demoen. De legges inn som scener (ikke generert ennå) — du genererer hver med kreditt-vokteren.
        </div>

        {loading && <div style={{ padding: '28px 0', textAlign: 'center', color: C.inkSoft, fontSize: 13 }}>Regissøren ser gjennom storyboardet…</div>}
        {err && <div style={{ marginTop: 14, fontSize: 12.5, color: '#d9534f' }}>Klarte ikke å hente forslag: {err}</div>}
        {!loading && !err && suggestions.length === 0 && (
          <div style={{ padding: '24px 0', textAlign: 'center', color: C.inkSoft, fontSize: 13 }}>Ingen forslag — storyboardet står støtt som det er.</div>
        )}

        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {suggestions.map((s, i) => (
            <label key={i} onClick={(e) => e.stopPropagation()} style={{
              display: 'flex', gap: 11, padding: '12px 13px', borderRadius: 11, cursor: 'pointer',
              border: `1px solid ${picked.has(i) ? C.accent : C.line}`, background: picked.has(i) ? C.cream : C.panel,
            }}>
              <input type="checkbox" checked={picked.has(i)} onChange={() => toggle(i)} style={{ marginTop: 2 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{s.title}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: C.accent, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 20, padding: '2px 7px' }}>
                    {POS_LABEL[s.position]}{s.position === 'after' && s.afterIndex != null ? ` ${s.afterIndex + 1}` : ''}
                  </span>
                </div>
                {s.narration && <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 3, lineHeight: 1.4 }}>«{s.narration}»</div>}
                <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 4, lineHeight: 1.4 }}>{s.prompt}</div>
                {s.reason && <div style={{ fontSize: 10.5, color: C.inkFaint, marginTop: 3, fontStyle: 'italic' }}>{s.reason}</div>}
              </div>
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btn(false)}>Avbryt</button>
          <button onClick={insert} disabled={picked.size === 0} style={btn(true, picked.size === 0)}>
            Legg inn {picked.size > 0 ? `(${picked.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CinematicSuggestions;
