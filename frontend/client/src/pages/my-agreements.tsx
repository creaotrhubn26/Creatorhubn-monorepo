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
        <div style={{ fontSize: 13, color: ws.textDim, marginBottom: 24 }}>Split sheets du er bidragsyter på — royalty/honorar-fordelinger du har signert eller er del av.</div>

        {loading ? (
          <div style={{ color: ws.textDim }}>Laster …</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', background: ws.panel, borderRadius: 16, border: `1px solid ${ws.borderSoft}` }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Ingen avtaler ennå</div>
            <div style={{ fontSize: 13, color: ws.textDim, marginTop: 6 }}>Når noen legger deg til i en split sheet (på din e-post), dukker den opp her.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((a: any) => (
              <div key={a.id} style={{ background: ws.panel, borderRadius: 14, border: `1px solid ${a.mySigned ? ws.borderSoft : ws.accentBorder}`, padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{a.title || 'Split sheet'}</span>
                    {a.status === 'completed'
                      ? <span style={{ fontSize: 10.5, fontWeight: 700, color: ws.green, background: ws.greenSoft, padding: '2px 8px', borderRadius: 6 }}>Fullført</span>
                      : <span style={{ fontSize: 10.5, fontWeight: 700, color: ws.amber, background: ws.amberSoft, padding: '2px 8px', borderRadius: 6 }}>{a.signedCount}/{a.total} signert</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: ws.textDim, marginTop: 4 }}>
                    Din andel: <b style={{ color: ws.accent }}>{a.mySharePct}%</b>{a.amount ? ` · ${Math.round(a.amount * a.mySharePct / 100).toLocaleString('nb-NO')} kr` : ''}{a.myRole ? ` · ${a.myRole}` : ''}
                  </div>
                  <div style={{ fontSize: 11, color: ws.textFaint, marginTop: 2 }}>{fmtDate(a.createdAt)}{a.mySigned ? ' · du har signert ✓' : ' · venter på din signatur'}</div>
                </div>
                {a.viewUrl && (
                  <button onClick={() => navigate(`/signer/${a.accessCode}`)}
                    style={{ flexShrink: 0, padding: '9px 16px', borderRadius: 9, border: a.mySigned ? `1px solid ${ws.border}` : 'none', background: a.mySigned ? 'transparent' : ws.accent, color: a.mySigned ? ws.text : ws.accentContrast, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    {a.mySigned ? 'Se avtale' : 'Signer'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyAgreements;
