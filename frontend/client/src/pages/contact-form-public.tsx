// @ts-nocheck
/**
 * contact-form-public.tsx — OFFENTLIG hostet kontaktskjema (/skjema/:token).
 *
 * Det kunden ser når de fyller ut produsentens egendefinerte skjema. Henter
 * definisjonen fra /api/public/contact-form/:token, rendrer feltene, og sender
 * inn → blir en forespørsel i produsentens innboks. Lys, brandet, ingen
 * workspace-chrome (kan embeddes på kundens nettside via iframe).
 */
import React, { useEffect, useState } from 'react';
import { useRoute } from 'wouter';

const API = (import.meta as any).env?.VITE_API_URL || '';

const ContactFormPublic: React.FC = () => {
  const [, params] = useRoute('/skjema/:token');
  const token = params?.token || '';
  const [def, setDef] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/public/contact-form/${encodeURIComponent(token)}`)
      .then((r) => { if (!r.ok) throw new Error('not_found'); return r.json(); })
      .then((d) => setDef(d))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const accent = def?.branding?.accent || '#ff8c00';
  const set = (id: string, v: any) => setValues((p) => ({ ...p, [id]: v }));

  const submit = async (e: any) => {
    e.preventDefault();
    setErr(''); setSending(true);
    try {
      const r = await fetch(`${API}/api/public/contact-form/${encodeURIComponent(token)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: values }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j?.field ? `Feltet «${j.field}» er påkrevd.` : (j?.error === 'email_required' ? 'E-post er påkrevd.' : 'Noe gikk galt. Prøv igjen.')); return; }
      setDone(j?.message || 'Takk! Vi tar kontakt snart.');
    } catch { setErr('Kunne ikke sende. Sjekk nettforbindelsen.'); }
    finally { setSending(false); }
  };

  const wrap: React.CSSProperties = { minHeight: '100vh', background: '#f5f6f8', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' };
  const card: React.CSSProperties = { background: '#fff', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.08)', maxWidth: 560, width: '100%', padding: 32 };
  const inputStyle: React.CSSProperties = { width: '100%', padding: '11px 13px', borderRadius: 9, border: '1px solid #d7dbe0', fontSize: 15, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', background: '#fff' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13.5, fontWeight: 600, color: '#2c3340', marginBottom: 6 };

  if (loading) return <div style={wrap}><div style={{ color: '#888', marginTop: 80 }}>Laster …</div></div>;
  if (notFound) return <div style={wrap}><div style={card}><h2 style={{ margin: 0, color: '#2c3340' }}>Skjemaet finnes ikke</h2><p style={{ color: '#888' }}>Lenken er ugyldig eller skjemaet er deaktivert.</p></div></div>;

  if (done) return (
    <div style={wrap}><div style={{ ...card, textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '8px auto 18px' }}>✓</div>
      <h2 style={{ margin: '0 0 8px', color: '#1a1f29' }}>Sendt!</h2>
      <p style={{ color: '#5a6472', fontSize: 15, lineHeight: 1.6 }}>{done}</p>
    </div></div>
  );

  return (
    <div style={wrap}>
      <div style={card}>
        {def?.branding?.logoUrl && <img src={def.branding.logoUrl} alt="" style={{ maxHeight: 48, marginBottom: 18 }} />}
        <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, color: '#1a1f29' }}>{def?.title || 'Kontakt oss'}</h1>
        {def?.intro && <p style={{ margin: '0 0 22px', color: '#5a6472', fontSize: 14.5, lineHeight: 1.55 }}>{def.intro}</p>}
        <form onSubmit={submit}>
          {(def?.fields || []).map((f: any) => (
            <div key={f.id} style={{ marginBottom: 16 }}>
              {f.type !== 'checkbox' && <label style={labelStyle}>{f.label}{f.required && <span style={{ color: accent }}> *</span>}</label>}
              {f.type === 'textarea' ? (
                <textarea required={f.required} placeholder={f.placeholder || ''} value={values[f.id] || ''} onChange={(e) => set(f.id, e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
              ) : f.type === 'select' ? (
                <select required={f.required} value={values[f.id] || ''} onChange={(e) => set(f.id, e.target.value)} style={inputStyle}>
                  <option value="">Velg …</option>
                  {(f.options || []).map((o: string, i: number) => <option key={i} value={o}>{o}</option>)}
                </select>
              ) : f.type === 'radio' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {(f.options || []).map((o: string, i: number) => (
                    <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14.5, color: '#2c3340' }}>
                      <input type="radio" name={f.id} value={o} checked={values[f.id] === o} onChange={() => set(f.id, o)} required={f.required} /> {o}
                    </label>
                  ))}
                </div>
              ) : f.type === 'checkbox' ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14.5, color: '#2c3340' }}>
                  <input type="checkbox" checked={!!values[f.id]} onChange={(e) => set(f.id, e.target.checked ? 'Ja' : '')} required={f.required} /> {f.label}{f.required && <span style={{ color: accent }}> *</span>}
                </label>
              ) : (
                <input type={f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                  required={f.required} placeholder={f.placeholder || ''} value={values[f.id] || ''} onChange={(e) => set(f.id, e.target.value)} style={inputStyle} />
              )}
            </div>
          ))}
          {err && <div style={{ background: '#fdecec', color: '#c0392b', padding: '10px 13px', borderRadius: 9, fontSize: 13.5, marginBottom: 14 }}>{err}</div>}
          <button type="submit" disabled={sending} style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: accent, color: '#fff', fontSize: 15.5, fontWeight: 700, cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.7 : 1, fontFamily: 'inherit' }}>
            {sending ? 'Sender …' : (def?.branding?.submitLabel || 'Send forespørsel')}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 18, fontSize: 11, color: '#aab2bd' }}>Drevet av CreatorHub</p>
      </div>
    </div>
  );
};

export default ContactFormPublic;
