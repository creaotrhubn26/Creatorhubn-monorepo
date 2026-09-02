// OverlayPreviewBox — delt visnings-boks for "boks/pil + tekst over skjermbilde"-
// mønsteret. Brukt av VisualBeatsModal (manus-uthevinger) og BrandTacticModal
// (merkevare/taktikk-funn) — samme visuelle språk, forskjellig datakilde.
export function OverlayPreviewBox({
  kind,
  overlayText,
  accent,
}: {
  kind: 'overlay' | 'stat' | 'highlight' | 'infographic';
  overlayText: string;
  accent: string;
}) {
  return (
    <div style={{ position: 'relative', width: 150, height: 95, flexShrink: 0, background: 'linear-gradient(135deg,#2f2a26,#544b43)', borderRadius: 8, overflow: 'hidden' }}>
      {kind === 'stat' ? (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <div style={{ background: accent, color: '#fff', fontWeight: 800, fontSize: 18, padding: '6px 12px', borderRadius: 8, textAlign: 'center', maxWidth: '88%' }}>{overlayText}</div>
        </div>
      ) : kind === 'infographic' ? (
        <div style={{ position: 'absolute', inset: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          {[0, 1, 2, 3].map((n) => <div key={n} style={{ background: 'rgba(255,255,255,.16)', borderRadius: 4, borderLeft: `3px solid ${accent}` }} />)}
        </div>
      ) : (
        <>
          {kind === 'highlight' && <div style={{ position: 'absolute', left: '30%', top: '24%', width: '40%', height: '30%', border: `2px solid ${accent}`, borderRadius: 6, boxShadow: `0 0 0 999px rgba(0,0,0,.25)` }} />}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'linear-gradient(transparent,rgba(0,0,0,.65))', padding: '14px 8px 7px' }}>
            <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, borderLeft: `3px solid ${accent}`, paddingLeft: 6 }}>{overlayText}</span>
          </div>
        </>
      )}
    </div>
  );
}
