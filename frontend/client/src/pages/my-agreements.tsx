// @ts-nocheck
/**
 * my-agreements.tsx — «Mine avtaler» (/mine-avtaler).
 *
 * Innlogget visning: split sheets brukeren er bidragsyter på (matchet på e-post).
 * Slik ser et bandmedlem som senere lager CreatorHub-konto avtalene de har
 * signert / er del av — uansett hvem som eier arket. Workspace-design.
 */
import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../components/workspace/workspaceTheme';

const fmtDate = (iso?: string) => { if (!iso) return ''; try { return new Date(iso).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return ''; } };

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

const agreementType = (agreement: any) => agreement?.compensationType || (agreement?.compensationModel === 'hourly' ? 'hourly' : 'share');

const estimatedHourlyAmount = (agreement: any) => {
  const explicit = numberOrNull(agreement?.estimatedAmount);
  if (explicit != null) return explicit;
  const rate = numberOrNull(agreement?.hourlyRate);
  const hours = numberOrNull(agreement?.estimatedHours);
  return rate != null && hours != null ? rate * hours : null;
};

const agreementViewPath = (agreement: any) => {
  if (!agreement?.viewUrl) return `/signer/${agreement?.accessCode || ''}`;
  try {
    const url = new URL(agreement.viewUrl, window.location.origin);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    const token = url.searchParams.get('token') || hashParams.get('token') || '';
    if (token) {
      const code = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '').toUpperCase();
      Object.defineProperty(window, '__creatorhubSigningCredential', {
        value: { code, token },
        configurable: true,
        enumerable: false,
        writable: false,
      });
      url.searchParams.delete('token');
      hashParams.delete('token');
      url.hash = hashParams.toString() ? `#${hashParams.toString()}` : '';
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return `/signer/${agreement?.accessCode || ''}`; }
};

const MyAgreements: React.FC = () => {
  const [, navigate] = useLocation();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest('/api/my-split-sheets')
      .then((r: any) => setItems(Array.isArray(r?.agreements) ? r.agreements : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const wrap: React.CSSProperties = { minHeight: '100vh', background: ws.bg, color: ws.text, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', padding: '40px 16px' };

  return (
    <div style={wrap}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Mine avtaler</div>
        <div style={{ fontSize: 13, color: ws.textDim, marginBottom: 24 }}>Honoraravtaler og split sheets du har signert eller er del av.</div>

        {loading ? (
          <div style={{ color: ws.textDim }}>Laster …</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', background: ws.panel, borderRadius: 16, border: `1px solid ${ws.borderSoft}` }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Ingen avtaler ennå</div>
            <div style={{ fontSize: 13, color: ws.textDim, marginTop: 6 }}>Når noen legger deg til i en honoraravtale eller et split sheet med e-posten din, dukker den opp her.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((a: any) => {
              const type = agreementType(a);
              const rate = numberOrNull(a.hourlyRate);
              const hours = numberOrNull(a.estimatedHours);
              const hourlyAmount = estimatedHourlyAmount(a);
              const fixedAmount = numberOrNull(a.estimatedAmount);

              return (
              <div key={a.id} style={{ background: ws.panel, borderRadius: 14, border: `1px solid ${a.mySigned ? ws.borderSoft : ws.accentBorder}`, padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{a.title || (type === 'share' ? 'Split sheet' : 'Honoraravtale')}</span>
                    {a.status === 'completed'
                      ? <span style={{ fontSize: 10.5, fontWeight: 700, color: ws.green, background: ws.greenSoft, padding: '2px 8px', borderRadius: 6 }}>Fullført</span>
                      : <span style={{ fontSize: 10.5, fontWeight: 700, color: ws.amber, background: ws.amberSoft, padding: '2px 8px', borderRadius: 6 }}>{a.signedCount}/{a.total} signert</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: ws.textDim, marginTop: 4 }}>
                    {type === 'hourly' ? (
                      <>
                        Avtalt timesats: <b style={{ color: ws.accent }}>{rate != null ? `${formatMoney(rate, a.currency, 2)}/t` : 'ikke oppgitt'}</b>
                        {hours != null ? ` · Estimat: ${formatNumber(hours)} t` : ''}
                        {hourlyAmount != null ? ` · ${formatMoney(hourlyAmount, a.currency)}` : ''}
                        {a.myRole ? ` · ${a.myRole}` : ''}
                      </>
                    ) : type === 'fixed' ? (
                      <>
                        Avtalt honorar: <b style={{ color: ws.accent }}>{formatMoney(fixedAmount ?? a.amount, a.currency) || 'ikke oppgitt'}</b>{a.myRole ? ` · ${a.myRole}` : ''}
                      </>
                    ) : (
                      <>Din andel: <b style={{ color: ws.accent }}>{a.mySharePct}%</b>{a.amount ? ` · ${Math.round(a.amount * a.mySharePct / 100).toLocaleString('nb-NO')} kr` : ''}{a.myRole ? ` · ${a.myRole}` : ''}</>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: ws.textFaint, marginTop: 2 }}>{fmtDate(a.createdAt)}{a.mySigned ? ' · du har signert ✓' : a.canSign ? ' · venter på din signatur' : ' · venter på personlig signeringsinvitasjon'}</div>
                </div>
                {a.viewUrl && (
                  <button onClick={() => navigate(agreementViewPath(a))}
                    style={{ flexShrink: 0, padding: '9px 16px', borderRadius: 9, border: a.canSign ? 'none' : `1px solid ${ws.border}`, background: a.canSign ? ws.accent : 'transparent', color: a.canSign ? ws.accentContrast : ws.text, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    {a.canSign ? 'Signer' : 'Se avtale'}
                  </button>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyAgreements;
