import { useEffect, useRef, useState } from 'react';
import { pushCloudMockupProject } from '../../services/cloudMockupProjectsService';
import {
  FeedMockupApplyError,
  feedMockupLinksService,
  type FeedMockupLink,
} from '../../services/feedMockupLinksService';
import type { MockupDoc } from './mockupStudioModel';
import { rasterizeMockup } from './mockupRaster';
import { exportMotionWebm } from './mockupMotionExport';
import { MOTION_PRESETS } from './mockupMotion';

const MAX_DATA_URL_LENGTH = 1_900_000;

async function renderForFeed(doc: MockupDoc, mediaType: FeedMockupLink['mediaType']): Promise<{ dataUrl: string; fileName: string }> {
  const safeName = (doc.name || 'mockup-studio')
    .trim()
    .replace(/[^a-z0-9æøå._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'mockup-studio';
  const longEdge = Math.max(doc.canvas.w, doc.canvas.h);
  if (mediaType === 'reel') {
    const base64 = await exportMotionWebm(doc, MOTION_PRESETS.find((preset) => preset.id === 'reel')!.cfg, 0.5);
    return { dataUrl: `data:video/webm;base64,${base64}`, fileName: `${safeName}.webm` };
  }
  const targetEdges = [1600, 1350, 1080, 900];

  for (const targetEdge of targetEdges) {
    const canvas = await rasterizeMockup(doc, Math.min(1, targetEdge / longEdge), { skipAnnotations: true });
    const png = canvas.toDataURL('image/png');
    if (png.length <= MAX_DATA_URL_LENGTH) return { dataUrl: png, fileName: `${safeName}.png` };
    for (const quality of [0.9, 0.82, 0.72]) {
      const jpeg = canvas.toDataURL('image/jpeg', quality);
      if (jpeg.length <= MAX_DATA_URL_LENGTH) return { dataUrl: jpeg, fileName: `${safeName}.jpg` };
    }
  }
  throw new Error('Designet er for detaljert til feed-overføring. Reduser store bilder og prøv igjen.');
}

function platformLabel(platform: FeedMockupLink['platform']): string {
  if (platform === 'instagram') return 'Instagram';
  if (platform === 'linkedin') return 'LinkedIn';
  return 'TikTok';
}

export default function FeedPlannerPublishButton({ doc }: { doc: MockupDoc }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<FeedMockupLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setLinks(await feedMockupLinksService.list(doc.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kunne ikke hente feed-koblinger.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLinks([]);
    setMessage(null);
    setError(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const send = async (initialLink: FeedMockupLink, confirmed = false) => {
    setSendingId(initialLink.id);
    setMessage(null);
    setError(null);
    try {
      const synced = await pushCloudMockupProject(doc);
      if (!synced) throw new Error('Mockupen kunne ikke synkroniseres. Kontroller innloggingen og at alle bilder er tilgjengelige.');
      const refreshed = await feedMockupLinksService.list(doc.id);
      setLinks(refreshed);
      const link = refreshed.find((item) => item.id === initialLink.id);
      if (!link) throw new Error('Koblingen finnes ikke lenger.');
      const rendered = await renderForFeed(doc, link.mediaType);
      const result = await feedMockupLinksService.applyOutput({
        linkId: link.id,
        mediaDataUrl: rendered.dataUrl,
        fileName: rendered.fileName,
        mockupRevision: link.mockupRevision,
        confirmApprovedAssetChange: confirmed,
      });
      setMessage(result.changed
        ? `✓ Sendt til ${platformLabel(link.platform)} · ${link.feedPostTitle || link.feedPostId}`
        : link.mediaType === 'carousel' && result.variantComplete === false
          ? `✓ Slide ${link.outputPosition}/${link.expectedOutputCount} lagret. Feed-posten oppdateres når alle slidene er sendt.`
          : '✓ Feed-posten har allerede nøyaktig denne renderen. Ingen duplikat ble laget.');
      setLinks(await feedMockupLinksService.list(doc.id));
    } catch (caught) {
      if (
        caught instanceof FeedMockupApplyError
        && caught.code === 'approval_confirmation_required'
        && !confirmed
      ) {
        const approved = window.confirm(
          `${caught.message}\n\nVil du erstatte designet og sette posten til «må godkjennes på nytt»?`,
        );
        if (approved) {
          setSendingId(null);
          await send(initialLink, true);
          return;
        }
      } else {
        setError(caught instanceof Error ? caught.message : 'Kunne ikke sende designet.');
      }
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen((value) => !value); if (!open) void load(); }}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Send gjeldende Mockup Studio-design til koblet Feed Planner-post"
        style={{
          border: '1px solid rgba(73,199,255,0.5)', borderRadius: 7, padding: '7px 10px',
          background: links.length ? 'rgba(73,199,255,0.15)' : 'transparent', color: '#dceeff',
          fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        ↗ Feed Planner{links.length ? ` · ${links.length}` : ''}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Feed Planner-koblinger"
          style={{
            position: 'absolute', zIndex: 80, top: 'calc(100% + 8px)', right: 0, width: 390,
            maxWidth: 'min(390px, 90vw)', padding: 14, borderRadius: 10,
            border: '1px solid rgba(73,199,255,0.35)', background: '#121923',
            boxShadow: '0 18px 48px rgba(0,0,0,0.45)', color: '#eef6ff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 750 }}>Send til Feed Planner</div>
              <div style={{ fontSize: 11, color: '#8fa3b8', marginTop: 2 }}>Originalprosjektet beholdes; bare ferdig render sendes.</div>
            </div>
            <button onClick={() => void load()} disabled={loading} style={{ border: 0, background: 'transparent', color: '#9cc9e8', cursor: 'pointer' }} aria-label="Oppdater koblinger">↻</button>
            <button onClick={() => setOpen(false)} style={{ border: 0, background: 'transparent', color: '#9cc9e8', cursor: 'pointer' }} aria-label="Lukk">×</button>
          </div>
          {message && <div role="status" style={{ color: '#75d69c', fontSize: 11, marginBottom: 10 }}>{message}</div>}
          {error && <div role="alert" style={{ color: '#ff9a9a', fontSize: 11, marginBottom: 10 }}>{error}</div>}
          {loading && links.length === 0 ? (
            <div style={{ color: '#8fa3b8', fontSize: 12, padding: '12px 0' }}>Henter koblinger…</div>
          ) : links.length === 0 ? (
            <div style={{ color: '#a9b8c7', fontSize: 12, lineHeight: 1.5, padding: '8px 0' }}>
              Ingen feed-post er koblet ennå. Åpne posten i Role Room Feed Planner og velg «Koble design» — dette eksisterende prosjektet vil vises i listen.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
              {links.map((link) => (
                <div key={link.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 9, borderRadius: 8, background: '#18222e' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {link.feedPostTitle || link.feedPostId}
                    </div>
                    <div style={{ color: link.stale ? '#f0bd68' : '#8fa3b8', fontSize: 10.5, marginTop: 2 }}>
                      {platformLabel(link.platform)} · {link.variantLabel}{link.mediaType === 'carousel' ? ` · slide ${link.outputPosition}/${link.expectedOutputCount}` : ''} · versjon {link.mockupRevision}
                      {link.skillRuns?.length ? ` · brand ${link.qualityStatus === 'ready' ? 'verifisert' : link.qualityStatus || 'limited'}` : ''}
                      {link.stale ? ' · ny versjon må sendes' : link.lastAppliedAt ? ' · synkronisert' : ' · ikke sendt'}
                    </div>
                  </div>
                  <button
                    onClick={() => void send(link)}
                    disabled={sendingId !== null}
                    style={{
                      border: 0, borderRadius: 6, padding: '7px 9px', background: '#2d9fd2', color: '#07111a',
                      fontSize: 11, fontWeight: 750, cursor: sendingId ? 'wait' : 'pointer', opacity: sendingId && sendingId !== link.id ? 0.55 : 1,
                    }}
                  >
                    {sendingId === link.id ? 'Sender…' : link.lastAppliedAt ? 'Send på nytt' : 'Send'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
