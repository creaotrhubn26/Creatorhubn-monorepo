/**
 * my-agreements.tsx — signed agreements and durable receipts for the logged-in
 * CreatorHub user. Access to receipt PDFs is checked again by the backend.
 */
import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { apiFetch, apiRequest } from '@/lib/queryClient';
import { ws } from '../components/workspace/workspaceTheme';

type PrototypeAgreement = {
  id: string;
  title: string;
  signerName: string | null;
  signerEmail: string;
  acceptedAt: string;
  programEndsAt: string | null;
  signatureMethod: string;
  emailVerifiedAt: string | null;
  receiptId: string;
  agreementDigest: string;
  integrityVerified: boolean;
  receiptDownloadUrl: string;
};

const fmtDate = (iso?: string | null, includeTime = false) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('nb-NO', includeTime
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

const pill = (color: string, background: string): React.CSSProperties => ({
  fontSize: 10.5,
  fontWeight: 750,
  color,
  background,
  padding: '3px 8px',
  borderRadius: 999,
});

const MyAgreements: React.FC = () => {
  const [, navigate] = useLocation();
  const [splitSheets, setSplitSheets] = useState<any[]>([]);
  const [prototypeAgreements, setPrototypeAgreements] = useState<PrototypeAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      apiRequest('/api/my-split-sheets'),
      apiRequest('/api/prototype-tester-agreements/me'),
    ]).then(([splitResult, prototypeResult]) => {
      if (splitResult.status === 'fulfilled') {
        setSplitSheets(Array.isArray(splitResult.value?.agreements)
          ? splitResult.value.agreements
          : []);
      }
      if (prototypeResult.status === 'fulfilled') {
        setPrototypeAgreements(Array.isArray(prototypeResult.value?.agreements)
          ? prototypeResult.value.agreements
          : []);
      }
      if (prototypeResult.status === 'rejected') {
        setError('Kunne ikke hente signeringskvitteringene. Prøv igjen etter ny innlogging.');
      } else if (splitResult.status === 'rejected') {
        setError('Signeringskvitteringene er hentet, men split sheets kunne ikke lastes akkurat nå.');
      }
    }).finally(() => setLoading(false));
  }, []);

  const downloadReceipt = async (agreement: PrototypeAgreement) => {
    setDownloadId(agreement.receiptId);
    setError(null);
    try {
      const response = await apiFetch(agreement.receiptDownloadUrl, {
        headers: { Accept: 'application/pdf' },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Kunne ikke laste ned kvitteringen.');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `creatorhub-signeringskvittering-${agreement.receiptId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kunne ikke laste ned kvitteringen.');
    } finally {
      setDownloadId(null);
    }
  };

  const wrap: React.CSSProperties = {
    minHeight: '100vh',
    background: ws.bg,
    color: ws.text,
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    padding: '40px 16px',
  };
  const card: React.CSSProperties = {
    background: ws.panel,
    borderRadius: 14,
    border: `1px solid ${ws.borderSoft}`,
    padding: 18,
  };

  return (
    <div style={wrap} data-testid="my-agreements-page">
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>Mine avtaler</h1>
        <div style={{ fontSize: 13, color: ws.textDim, marginBottom: 24 }}>
          Signerte CreatorHub-dokumenter og split sheets samlet på ett sted.
        </div>

        {error && (
          <div role="alert" style={{ ...card, borderColor: '#ef4444', color: '#fecaca', marginBottom: 18 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ color: ws.textDim }}>Laster …</div>
        ) : (
          <>
            <section aria-labelledby="prototype-agreements-heading" style={{ marginBottom: 30 }}>
              <h2 id="prototype-agreements-heading" style={{ fontSize: 17, fontWeight: 800, margin: '0 0 5px' }}>
                Prototypeprogram
              </h2>
              <div style={{ fontSize: 12.5, color: ws.textDim, marginBottom: 13 }}>
                Programvilkår, NDA, databehandleravtale og intensjonsavtale.
              </div>
              {prototypeAgreements.length === 0 ? (
                <div style={{ ...card, color: ws.textDim }}>Ingen signerte prototype-testeravtaler ennå.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {prototypeAgreements.map((agreement) => (
                    <article
                      key={agreement.id}
                      style={card}
                      data-testid={`prototype-agreement-receipt-${agreement.receiptId}`}
                    >
                      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 460px', minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 15, fontWeight: 800 }}>{agreement.title}</span>
                            <span style={pill(ws.green, ws.greenSoft)}>Signert</span>
                            <span style={pill(
                              agreement.integrityVerified ? ws.green : ws.amber,
                              agreement.integrityVerified ? ws.greenSoft : ws.amberSoft,
                            )}>
                              {agreement.integrityVerified ? 'Integritet verifisert' : 'Må kontrolleres'}
                            </span>
                          </div>
                          <div style={{ fontSize: 12.5, color: ws.textDim, marginTop: 7 }}>
                            Signert av <b style={{ color: ws.text }}>{agreement.signerName || agreement.signerEmail}</b>
                            {' · '}{fmtDate(agreement.acceptedAt, true)}
                          </div>
                          <div style={{ fontSize: 11.5, color: ws.textFaint, marginTop: 5 }}>
                            Metode: {agreement.signatureMethod === 'email_otp_typed_name'
                              ? 'e-postkode og skrevet navn'
                              : 'skrevet navn (eldre aksept)'}
                            {agreement.emailVerifiedAt
                              ? ` · e-post verifisert ${fmtDate(agreement.emailVerifiedAt, true)}`
                              : ''}
                          </div>
                          <div style={{ fontSize: 10.5, color: ws.textFaint, marginTop: 7, overflowWrap: 'anywhere' }}>
                            Kvittering {agreement.receiptId} · SHA-256 {agreement.agreementDigest}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void downloadReceipt(agreement)}
                          disabled={downloadId === agreement.receiptId || !agreement.integrityVerified}
                          data-testid="download-prototype-receipt"
                          style={{
                            flexShrink: 0,
                            padding: '10px 16px',
                            borderRadius: 9,
                            border: 'none',
                            background: ws.accent,
                            color: ws.accentContrast,
                            fontWeight: 750,
                            fontSize: 13,
                            cursor: downloadId === agreement.receiptId ? 'wait' : 'pointer',
                            opacity: downloadId === agreement.receiptId || !agreement.integrityVerified ? 0.55 : 1,
                          }}
                        >
                          {downloadId === agreement.receiptId ? 'Laster ned…' : 'Last ned PDF-kvittering'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section aria-labelledby="split-sheets-heading">
              <h2 id="split-sheets-heading" style={{ fontSize: 17, fontWeight: 800, margin: '0 0 5px' }}>
                Split sheets
              </h2>
              <div style={{ fontSize: 12.5, color: ws.textDim, marginBottom: 13 }}>
                Royalty- og honorarfordelinger du har signert eller er del av.
              </div>
              {splitSheets.length === 0 ? (
                <div style={{ ...card, color: ws.textDim }}>
                  Når noen legger deg til i en split sheet på e-posten din, vises den her.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {splitSheets.map((agreement: any) => (
                    <div key={agreement.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 15, fontWeight: 700 }}>{agreement.title || 'Split sheet'}</span>
                          {agreement.status === 'completed'
                            ? <span style={pill(ws.green, ws.greenSoft)}>Fullført</span>
                            : <span style={pill(ws.amber, ws.amberSoft)}>{agreement.signedCount}/{agreement.total} signert</span>}
                        </div>
                        <div style={{ fontSize: 12.5, color: ws.textDim, marginTop: 4 }}>
                          Din andel: <b style={{ color: ws.accent }}>{agreement.mySharePct}%</b>
                          {agreement.amount ? ` · ${Math.round(agreement.amount * agreement.mySharePct / 100).toLocaleString('nb-NO')} kr` : ''}
                          {agreement.myRole ? ` · ${agreement.myRole}` : ''}
                        </div>
                        <div style={{ fontSize: 11, color: ws.textFaint, marginTop: 2 }}>
                          {fmtDate(agreement.createdAt)}{agreement.mySigned ? ' · du har signert ✓' : ' · venter på din signatur'}
                        </div>
                      </div>
                      {agreement.viewUrl && (
                        <button
                          type="button"
                          onClick={() => navigate(`/signer/${agreement.accessCode}`)}
                          style={{
                            flexShrink: 0,
                            padding: '9px 16px',
                            borderRadius: 9,
                            border: agreement.mySigned ? `1px solid ${ws.border}` : 'none',
                            background: agreement.mySigned ? 'transparent' : ws.accent,
                            color: agreement.mySigned ? ws.text : ws.accentContrast,
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: 'pointer',
                          }}
                        >
                          {agreement.mySigned ? 'Se avtale' : 'Signer'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default MyAgreements;
