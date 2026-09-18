// @ts-nocheck
/**
 * split-sheet-sign-portal.tsx — OFFENTLIG bidragsyter-portal (/signer/:code).
 *
 * Bandet/bidragsyterne åpner lenken, ser HELE fordelingen (hvem får hva, %+kr),
 * velger sin rad og signerer godkjennelse. Fungerer også som «se avtalen senere».
 * Workspace-design (navy/oransje).
 */
import React, { useEffect, useRef, useState } from 'react';
import { useRoute } from 'wouter';
import { ws } from '../components/workspace/workspaceTheme';

const API = (import.meta as any).env?.VITE_API_URL || '';

const numberOrNull = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const formatNumber = (value: number) => value.toLocaleString('nb-NO', { maximumFractionDigits: 2 });

const formatMoney = (value: unknown, currency = 'NOK', minimumFractionDigits = 0) => {
  const amount = numberOrNull(value);
  if (amount == null) return null;
  try {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: currency || 'NOK',
      minimumFractionDigits,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString('nb-NO', { minimumFractionDigits, maximumFractionDigits: 2 })} ${currency || 'NOK'}`;
  }
};

const contributorType = (contributor: any) => contributor?.compensationType || 'share';

const hourlyEstimate = (contributor: any) => {
  const explicit = numberOrNull(contributor?.estimatedAmount);
  if (explicit != null) return explicit;
  const rate = numberOrNull(contributor?.hourlyRate);
  const hours = numberOrNull(contributor?.estimatedHours);
  return rate != null && hours != null ? rate * hours : null;
};

const contributorOptionLabel = (contributor: any) => {
  const role = contributor?.role ? ` (${contributor.role})` : '';
  const type = contributorType(contributor);
  if (type === 'hourly') {
    const rate = formatMoney(contributor?.hourlyRate, contributor?.currency, 2);
    const hours = numberOrNull(contributor?.estimatedHours);
    return `${contributor.name} — ${rate ? `${rate}/t` : 'timepris'}${hours != null ? ` · ${formatNumber(hours)} t estimert` : ''}${role}`;
  }
  if (type === 'fixed') {
    const amount = formatMoney(contributor?.estimatedAmount ?? contributor?.amountKr, contributor?.currency);
    return `${contributor.name} — ${amount || 'fast honorar'}${role}`;
  }
  return `${contributor.name} — ${contributor.percentage}%${role}`;
};

const consumeSigningToken = (code: string): string => {
  if (typeof window === 'undefined') return '';
  try {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    const urlToken = url.searchParams.get('token') || hashParams.get('token') || '';
    if (urlToken) {
      Object.defineProperty(window, '__creatorhubSigningCredential', {
        value: { code, token: urlToken },
        configurable: true,
        enumerable: false,
        writable: false,
      });
      url.searchParams.delete('token');
      hashParams.delete('token');
      url.hash = hashParams.toString() ? `#${hashParams.toString()}` : '';
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      return urlToken;
    }
    const credential = (window as any).__creatorhubSigningCredential;
    return credential?.code === code && typeof credential?.token === 'string'
      ? credential.token
      : '';
  } catch { return ''; }
};

const SplitSheetSignPortal: React.FC = () => {
  const [, params] = useRoute('/signer/:code');
  const code = (params?.code || '').toUpperCase();
  const signingToken = consumeSigningToken(code);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pick, setPick] = useState('');      // valgt bidragsyter-id å signere som
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [mode, setMode] = useState<'draw' | 'type'>('draw'); // tegnet (finger/penn) vs skrevet
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  // Signatur-pad: tegn med finger/penn/mus (pointer events dekker touch + pen + mus).
  const posOf = (e: any) => { const c = canvasRef.current; const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) }; };
  const startDraw = (e: any) => { e.preventDefault(); const c = canvasRef.current; if (!c) return; drawing.current = true; const ctx = c.getContext('2d'); const p = posOf(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); try { c.setPointerCapture(e.pointerId); } catch { /* */ } };
  const moveDraw = (e: any) => { if (!drawing.current) return; e.preventDefault(); const c = canvasRef.current; const ctx = c.getContext('2d'); const p = posOf(e); ctx.lineTo(p.x, p.y); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); setHasInk(true); };
  const endDraw = () => { drawing.current = false; };
  const clearCanvas = () => { const c = canvasRef.current; if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height); setHasInk(false); };

  const load = () => {
    fetch(`${API}/api/public/split-sheet/${encodeURIComponent(code)}`, {
      headers: signingToken ? { 'X-Split-Sheet-Signing-Token': signingToken } : undefined,
    })
      .then((r) => { if (!r.ok) throw new Error('nf'); return r.json(); })
      .then((d) => {
        setData(d);
        const signer = (d?.contributors || []).find((contributor: any) => contributor.id === d?.signingContributorId);
        if (signer && !signer.signed) { setPick(signer.id); setName(signer.name || ''); }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (code) load(); /* eslint-disable-next-line */ }, [code]);

  const sign = async () => {
    if (!pick || !name.trim() || !consent) return;
    if (mode === 'draw' && !hasInk) return;
    const signatureImage = (mode === 'draw' && hasInk && canvasRef.current) ? canvasRef.current.toDataURL('image/png') : null;
    setErrorMessage('');
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/public/split-sheet/${encodeURIComponent(code)}/sign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributorId: pick, signerName: name.trim(), signatureImage, token: signingToken, consent: true }),
      });
      if (!r.ok) throw new Error('fail');
      setSuccessMessage('Takk! Din godkjennelse er registrert.');
      setPick(''); setName(''); setConsent(false); clearCanvas();
      load();
    } catch { setErrorMessage('Kunne ikke signere. Kontroller tilkoblingen og prøv igjen.'); }
    finally { setBusy(false); }
  };

  const wrap: React.CSSProperties = { minHeight: '100vh', background: ws.bg, color: ws.text, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', display: 'flex', justifyContent: 'center', padding: '40px 16px' };
  const card: React.CSSProperties = { width: '100%', maxWidth: 640, background: ws.panelSolid, borderRadius: 18, border: `1px solid ${ws.border}`, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' };

  if (loading) return <div style={wrap}><div style={{ color: ws.textDim, marginTop: 80 }}>Laster …</div></div>;
  if (notFound) return <div style={wrap}><div style={card}><h2 style={{ margin: 0 }}>Avtalen finnes ikke</h2><p style={{ color: ws.textDim }}>Lenken er ugyldig eller trukket tilbake.</p></div></div>;

  const unsigned = (data?.contributors || []).filter((c: any) => !c.signed);
  const contributors = data?.contributors || [];
  const inferredModel = contributors.some((c: any) => contributorType(c) !== 'share')
    ? contributors.some((c: any) => contributorType(c) === 'share') ? 'mixed' : 'hourly'
    : 'share';
  const compensationModel = data?.compensationModel || inferredModel;
  const isShareOnly = compensationModel === 'share';
  const signingContributor = contributors.find((c: any) => c.id === data?.signingContributorId);
  const canSign = Boolean(data?.canSign && signingToken && signingContributor && !signingContributor.signed);
  const selectedContributor = contributors.find((c: any) => c.id === pick);
  const selectedType = contributorType(selectedContributor);

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: ws.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ws.accent, fontSize: 20 }}>⚖️</div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: ws.accent, textTransform: 'uppercase' }}>{isShareOnly ? 'Split sheet — godkjennelse' : 'Honoraravtale — godkjennelse'}</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{data?.title || 'Fordeling'}</div>
          </div>
        </div>
        {data?.amount ? <div style={{ fontSize: 13, color: ws.textDim, marginBottom: 14 }}>{isShareOnly ? 'Total' : 'Estimert total'}: {Math.round(data.amount).toLocaleString('nb-NO')} kr</div> : <div style={{ height: 8 }} />}
        {data?.description && (
          <div style={{ marginBottom: 18, padding: '11px 13px', borderRadius: 10, border: `1px solid ${ws.borderSoft}`, background: 'rgba(255,255,255,0.025)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: ws.textFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>Avtaletekst</div>
            <div style={{ fontSize: 12.5, color: ws.textDim, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{data.description}</div>
          </div>
        )}

        {/* Fordelingen */}
        <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${ws.borderSoft}`, marginBottom: 18 }}>
          {contributors.map((c: any, i: number) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent', borderTop: i ? `1px solid ${ws.borderSoft}` : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</div>
                {c.role && <div style={{ fontSize: 11.5, color: ws.textFaint }}>{c.role}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                {contributorType(c) === 'hourly' ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 700, color: ws.accent }}>{formatMoney(c.hourlyRate, c.currency, 2) || '—'}/t</div>
                    {(numberOrNull(c.estimatedHours) != null || hourlyEstimate(c) != null) && (
                      <div style={{ fontSize: 11.5, color: ws.textDim }}>
                        Estimat: {numberOrNull(c.estimatedHours) != null ? `${formatNumber(numberOrNull(c.estimatedHours) as number)} t` : 'timer ikke oppgitt'}
                        {hourlyEstimate(c) != null ? ` · ${formatMoney(hourlyEstimate(c), c.currency)}` : ''}
                      </div>
                    )}
                  </>
                ) : contributorType(c) === 'fixed' ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 700, color: ws.accent }}>{formatMoney(c.estimatedAmount ?? c.amountKr, c.currency) || 'Fast honorar'}</div>
                    <div style={{ fontSize: 11.5, color: ws.textDim }}>Avtalt beløp</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 700, color: ws.accent }}>{c.percentage}%</div>
                    {c.amountKr != null && <div style={{ fontSize: 11.5, color: ws.textDim }}>{Math.round(c.amountKr).toLocaleString('nb-NO')} kr</div>}
                  </>
                )}
              </div>
              <div style={{ width: 84, textAlign: 'right' }}>
                {c.signed
                  ? <span style={{ fontSize: 11.5, fontWeight: 700, color: ws.green }}>✓ Signert</span>
                  : <span style={{ fontSize: 11.5, color: ws.textFaint }}>Venter</span>}
              </div>
            </div>
          ))}
        </div>

        {data?.allSigned ? (
          <div style={{ padding: 16, borderRadius: 12, background: ws.greenSoft, color: ws.green, textAlign: 'center', fontWeight: 700 }}>✓ Alle har godkjent {isShareOnly ? 'fordelingen' : 'avtalen'}</div>
        ) : successMessage ? (
          <div style={{ padding: 16, borderRadius: 12, background: ws.accentSoft, color: ws.text, textAlign: 'center' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{successMessage}</div>
            {unsigned.length > 0 && <div style={{ fontSize: 12.5, color: ws.textDim }}>Venter fortsatt på {unsigned.length} bidragsyter{unsigned.length === 1 ? '' : 'e'}.</div>}
          </div>
        ) : canSign ? (
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Signer godkjennelse</div>
            <label style={{ display: 'block', fontSize: 12.5, color: ws.textDim, marginBottom: 5 }}>Hvem er du?</label>
            <div style={{ width: '100%', padding: '11px 13px', boxSizing: 'border-box', borderRadius: 9, border: `1px solid ${ws.border}`, background: ws.panel, color: ws.text, fontSize: 14, marginBottom: 12 }}>
              {contributorOptionLabel(signingContributor)}
            </div>
            <label style={{ display: 'block', fontSize: 12.5, color: ws.textDim, marginBottom: 5 }}>Ditt fulle navn</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ola Nordmann"
              style={{ width: '100%', padding: '11px 13px', borderRadius: 9, border: `1px solid ${ws.border}`, background: ws.panel, color: ws.text, fontSize: 14, boxSizing: 'border-box', marginBottom: 12 }} />

            <label style={{ display: 'block', fontSize: 12.5, color: ws.textDim, marginBottom: 5 }}>Signatur</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {[['draw', '✍️ Tegn'], ['type', '⌨️ Skriv']].map(([m, l]) => (
                <button key={m} onClick={() => setMode(m as any)}
                  style={{ flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, border: `1px solid ${mode === m ? ws.accentBorder : ws.border}`, background: mode === m ? ws.accentSoft : 'transparent', color: mode === m ? ws.accent : ws.textDim }}>{l}</button>
              ))}
            </div>
            {mode === 'draw' ? (
              <div style={{ marginBottom: 12 }}>
                <canvas ref={canvasRef} width={560} height={150}
                  onPointerDown={startDraw} onPointerMove={moveDraw} onPointerUp={endDraw} onPointerLeave={endDraw}
                  style={{ width: '100%', height: 150, borderRadius: 9, border: `1px dashed ${hasInk ? ws.accentBorder : ws.border}`, background: ws.panel, touchAction: 'none', cursor: 'crosshair', display: 'block' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: ws.textFaint }}>Tegn med finger, penn (Apple Pencil o.l.) eller mus</span>
                  <button onClick={clearCanvas} style={{ background: 'none', border: 'none', color: ws.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Tøm</button>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 12, padding: 14, borderRadius: 9, border: `1px dashed ${ws.border}`, background: ws.panel, textAlign: 'center', minHeight: 40 }}>
                <span style={{ fontSize: 28, fontFamily: '"Segoe Script","Snell Roundhand","Brush Script MT",cursive', color: name ? ws.text : ws.textFaint }}>{name || 'Signaturen din vises her'}</span>
              </div>
            )}
            <div role="note" style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 9, border: `1px solid ${ws.accentBorder}`, background: ws.accentSoft, color: ws.text, fontSize: 12.5, lineHeight: 1.5 }}>
              Når den første deltakeren signerer, låses avtalevilkårene permanent for alle. Endringer krever en ny avtale; denne kan fortsatt arkiveres.
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: ws.text, marginBottom: 16, cursor: 'pointer' }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
              <span>{selectedType === 'hourly'
                ? 'Jeg godkjenner timesatsen som bindende vilkår. Oppgitte timer og beløp er estimater; sluttbeløpet følger godkjente timer.'
                : isShareOnly
                  ? 'Jeg bekrefter at jeg godkjenner denne fordelingen som bindende avtale.'
                  : 'Jeg bekrefter at jeg godkjenner honorarvilkårene i denne avtalen.'}</span>
            </label>
            {errorMessage && (
              <div role="alert" style={{ padding: '10px 12px', borderRadius: 9, border: `1px solid ${ws.red || '#ef4444'}`, background: 'rgba(239,68,68,0.1)', color: ws.text, fontSize: 12.5, marginBottom: 12 }}>
                {errorMessage}
              </div>
            )}
            {(() => { const ready = pick && name.trim() && consent && (mode === 'type' || hasInk); return (
            <button onClick={sign} disabled={!ready || busy}
              style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', background: !ready ? 'rgba(255,140,0,0.4)' : ws.accent, color: ws.accentContrast, fontSize: 15, fontWeight: 800, cursor: (busy || !ready) ? 'default' : 'pointer' }}>
              {busy ? 'Signerer …' : 'Signer godkjennelse'}
            </button>); })()}
          </div>
        ) : (
          <div style={{ padding: 16, borderRadius: 12, background: ws.accentSoft, color: ws.text, textAlign: 'center' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{signingContributor?.signed ? 'Denne avtalen er allerede signert fra din personlige lenke.' : 'Dette er en visningslenke.'}</div>
            <div style={{ fontSize: 12.5, color: ws.textDim }}>Av sikkerhetsgrunner må hver deltaker bruke sin personlige lenke fra e-posten for å signere. Be oppdragsansvarlig sende eller sende lenken på nytt.</div>
          </div>
        )}
        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 11, color: ws.textFaint }}>
          Har du CreatorHub-konto med samme e-post? Da finner du avtalen igjen under «Mine avtaler». · Drevet av CreatorHub
        </div>
      </div>
    </div>
  );
};

export default SplitSheetSignPortal;
