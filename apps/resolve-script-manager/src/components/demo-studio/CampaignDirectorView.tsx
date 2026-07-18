/**
 * CampaignDirectorView.tsx — «Kampanje-regissør»-UI (fase 1b).
 *
 * Kobler motoren (campaignDirector.deriveCampaign) til et regissør-brett:
 * mål-velger, sesong-bue, feed-simulering, pilar-miks og post-detalj med
 * hook-varianter + lås/regenerer. Alt on-brand (aktiv Brand Kit → aksent/logo).
 */
import { useState } from 'react';

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SendIcon from '@mui/icons-material/Send';

import type { InfographicBrand } from './infographicStudio.js';
import {
  deriveCampaign, computePillarMix,
  GOAL_LABELS, PILLAR_LABELS, PLATFORM_LABELS,
  type Campaign, type CampaignGoal, type CampaignPost, type ContentPillar, type PostPlatform,
} from './campaignDirector.js';

const C = { bg: '#0b1120', panel: '#0f1524', panel2: '#141b2b', line: '#202a40', ink: '#e8eefc', soft: '#8a98b5', faint: '#7c8bad' };
const VIDEO: Record<PostPlatform, boolean> = { tiktok: true, reels: true, stories: true, youtube: true, feed: false, linkedin: false };
const PILLAR_COLOR: Record<ContentPillar, string> = { proof: '#a855f7', education: '#7c5cff', social_proof: '#ff8c5d', offer: '#4fc76b', story: '#f6bd3b' };
const GOALS: CampaignGoal[] = ['awareness', 'leads', 'bookings', 'trust'];
const WEEK_ARC = ['Teaser', 'Bevis', 'Story', 'Tilbud', 'Recap', 'Recap', 'Recap', 'Recap'];

function factKey(p: CampaignPost): string { return (p.kpi.label + '|' + p.kpi.value).toLowerCase(); }

export default function CampaignDirectorView(
  { evidenceText, brand, brandName = 'Merkevare', onClose, onUsePosts }:
  { evidenceText: string; brand: InfographicBrand; brandName?: string; onClose?: () => void; onUsePosts?: (c: Campaign) => void },
) {
  const [goal, setGoal] = useState<CampaignGoal>('bookings');
  const [count, setCount] = useState(15);
  const [weeks, setWeeks] = useState(4);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [sel, setSel] = useState(0);
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const a = brand.accent || '#a855f7';

  const posts = campaign?.posts ?? [];
  const selected = posts[sel] ?? null;

  const generate = async (regen = false) => {
    setBusy(true); setErr(null);
    try {
      const fresh = await deriveCampaign({ evidenceText, brandName, goal, count, weeks });
      if (regen && campaign) {
        // Behold låste poster; fyll resten med ferske (uten fakta-duplikater).
        const keep = campaign.posts.filter((p) => locked.has(factKey(p)));
        const keepKeys = new Set(keep.map(factKey));
        const merged = [...keep, ...fresh.posts.filter((p) => !keepKeys.has(factKey(p)))].slice(0, count).sort((x, y) => x.week - y.week);
        setCampaign({ ...fresh, posts: merged, pillarMix: computePillarMix(merged) });
      } else {
        setCampaign(fresh);
      }
      setSel(0);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const toggleLock = (p: CampaignPost) => {
    setLocked((prev) => { const n = new Set(prev); const k = factKey(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  };

  const btn: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 9, border: `1px solid ${C.line}`, color: '#c4d0e4', background: C.panel2, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
  const chip = (on: boolean): React.CSSProperties => ({ fontSize: 11.5, fontWeight: 600, padding: '5px 11px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${on ? a : C.line}`, color: on ? a : C.faint, background: on ? `${a}22` : 'transparent' });
  const panel: React.CSSProperties = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 15 };
  const ptitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.soft, marginBottom: 12 };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, background: C.bg, color: C.ink, display: 'flex', flexDirection: 'column', padding: 22, overflow: 'auto' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Kampanje-regissør</h1>
        {campaign && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 7, background: `${a}22`, color: a }}>{posts.length} innlegg · {weeks} uker</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.soft }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, background: a, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>{brandName.slice(0, 2).toUpperCase()}</span>
          {brandName}
          {onClose && <CloseIcon onClick={onClose} style={{ cursor: 'pointer', marginLeft: 6 }} />}
        </div>
      </div>
      <div style={{ color: C.faint, fontSize: 12.5, marginBottom: 16 }}>Mål-drevet miks · narrativ sesong-bue · alt on-brand · animert (→ Resolve)</div>

      {/* kontroller */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 18 }}>
        <span style={{ fontSize: 11.5, color: C.soft, fontWeight: 600 }}>Mål:</span>
        {GOALS.map((g) => <span key={g} onClick={() => setGoal(g)} style={chip(goal === g)}>🎯 {GOAL_LABELS[g]}</span>)}
        <span style={{ marginLeft: 10, fontSize: 11.5, color: C.soft, fontWeight: 600 }}>Innlegg:</span>
        <input type="number" min={3} max={30} value={count} onChange={(e) => setCount(Math.min(30, Math.max(3, Number(e.target.value) || 15)))}
          style={{ width: 54, ...btn, padding: '7px 9px', colorScheme: 'dark' }} />
        <span style={{ fontSize: 11.5, color: C.soft, fontWeight: 600 }}>Uker:</span>
        <input type="number" min={1} max={8} value={weeks} onChange={(e) => setWeeks(Math.min(8, Math.max(1, Number(e.target.value) || 4)))}
          style={{ width: 48, ...btn, padding: '7px 9px', colorScheme: 'dark' }} />
        <span onClick={() => !busy && generate(false)} style={{ ...btn, background: a, borderColor: a, color: '#fff', opacity: busy ? 0.6 : 1 }}>
          <AutoAwesomeIcon style={{ fontSize: 16 }} /> {busy ? 'Genererer…' : campaign ? 'Generer på nytt' : 'Generer kampanje'}
        </span>
        {campaign && <span onClick={() => !busy && generate(true)} style={{ ...btn, opacity: busy ? 0.6 : 1 }}><RefreshIcon style={{ fontSize: 16 }} /> Regenerer (behold låste)</span>}
      </div>

      {err && <div style={{ padding: 12, borderRadius: 10, background: '#3a1518', border: '1px solid #7a2b30', color: '#f0a89f', fontSize: 12.5, marginBottom: 16 }}>{err}</div>}

      {!campaign && !busy && (
        <div style={{ ...panel, textAlign: 'center', color: C.faint, padding: 40 }}>
          Velg mål og trykk «Generer kampanje» — {count} distinkte, on-brand innlegg fra bevisene, spredt over {weeks} uker.
        </div>
      )}

      {campaign && (<>
        {/* sesong-bue */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {Array.from({ length: weeks }, (_, i) => {
            const wp = posts.filter((p) => p.week === i + 1);
            return (
              <div key={i} style={{ flex: 1, ...panel, padding: '9px 11px' }}>
                <div style={{ fontSize: 10, color: C.soft, fontWeight: 600 }}>Uke {i + 1} · {WEEK_ARC[i] ?? 'Recap'}</div>
                <div style={{ display: 'flex', gap: 3, marginTop: 7, flexWrap: 'wrap' }}>
                  {wp.length ? wp.map((_, j) => <i key={j} style={{ width: 7, height: 7, borderRadius: 4, background: a, opacity: 0.85 }} />)
                    : <i style={{ width: 7, height: 7, borderRadius: 4, background: C.line }} />}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 18 }}>
          {/* feed-simulering */}
          <div style={panel}>
            <div style={ptitle}>▦ Feed-simulering — slik ser profilen ut</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              {posts.map((p, i) => (
                <div key={i} onClick={() => setSel(i)} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                  background: `radial-gradient(120% 90% at 50% 32%, #182338, ${C.bg})`, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 12px',
                  outline: sel === i ? `2px solid ${a}` : 'none' }}>
                  <span style={{ position: 'absolute', top: 5, left: 5, fontSize: 7, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(0,0,0,.55)', color: '#fff' }}>{PLATFORM_LABELS[p.platform]}</span>
                  {VIDEO[p.platform] && <PlayArrowIcon style={{ position: 'absolute', top: 4, right: 4, fontSize: 13, color: '#fff', background: 'rgba(0,0,0,.5)', borderRadius: 7 }} />}
                  {locked.has(factKey(p)) && <LockOutlinedIcon style={{ position: 'absolute', bottom: 5, right: 5, fontSize: 12, color: a }} />}
                  <div style={{ color: a, fontSize: 7, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>{p.kpi.label}</div>
                  <div style={{ color: '#fff', fontSize: 26, fontWeight: 800, letterSpacing: '-1px', lineHeight: 0.95, marginTop: 2 }}>{p.kpi.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 9, fontSize: 10.5, color: C.faint, textAlign: 'center' }}>Design hele profil-rutenettet — gjenkjennelig signatur på tvers</div>
          </div>

          {/* høyre kolonne: miks + post-detalj */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={panel}>
              <div style={ptitle}>◍ Innholds-miks (mål: {GOAL_LABELS[goal]})</div>
              <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', marginBottom: 8 }}>
                {campaign.pillarMix.map((m) => <i key={m.pillar} style={{ width: `${m.share * 100}%`, background: PILLAR_COLOR[m.pillar] }} />)}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', fontSize: 10.5, color: '#c4d0e4' }}>
                {campaign.pillarMix.map((m) => (
                  <span key={m.pillar} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <i style={{ width: 9, height: 9, borderRadius: 3, background: PILLAR_COLOR[m.pillar] }} />{PILLAR_LABELS[m.pillar]} {Math.round(m.share * 100)}%
                  </span>
                ))}
              </div>
            </div>

            {selected && (
              <div style={panel}>
                <div style={{ ...ptitle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>✦ Post {sel + 1} · {PLATFORM_LABELS[selected.platform]} · {selected.format}</span>
                  <span onClick={() => toggleLock(selected)} title="Lås fra regenerering" style={{ cursor: 'pointer', color: locked.has(factKey(selected)) ? a : C.faint }}>
                    {locked.has(factKey(selected)) ? <LockOutlinedIcon style={{ fontSize: 16 }} /> : <LockOpenOutlinedIcon style={{ fontSize: 16 }} />}
                  </span>
                </div>
                {selected.hooks.map((h, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, color: a, background: `${a}22`, padding: '3px 8px', borderRadius: 6 }}>🧲 {h.lever}</span>
                    <div style={{ fontSize: 12, color: C.ink, marginTop: 4, lineHeight: 1.4 }}>«{h.text}»</div>
                  </div>
                ))}
                {selected.caption && <div style={{ fontSize: 11.5, color: '#c4d0e4', lineHeight: 1.45, marginTop: 6 }}>{selected.caption}</div>}
                {selected.hashtags.length > 0 && <div style={{ fontSize: 10.5, color: a, marginTop: 5 }}>{selected.hashtags.join(' ')}</div>}
                {selected.cta && <div style={{ fontSize: 11, color: C.soft, marginTop: 6 }}><b>CTA:</b> {selected.cta}</div>}
              </div>
            )}
          </div>
        </div>

        {/* bulk-handlinger */}
        <div style={{ display: 'flex', gap: 9, marginTop: 18 }}>
          <span onClick={() => onUsePosts?.(campaign)} style={{ ...btn, background: a, borderColor: a, color: '#fff' }}><FileDownloadIcon style={{ fontSize: 16 }} /> Bruk kampanjen ({posts.length})</span>
          <span style={btn}><SendIcon style={{ fontSize: 16 }} /> Send til sosial-kø</span>
        </div>
      </>)}
    </div>
  );
}
