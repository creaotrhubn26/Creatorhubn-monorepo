/**
 * «Kan jeg trekke fra dette?» — kildekritisk fradragshjelper. Verdiktet kommer
 * fra kontoplanens regler (vises som kilde), ikke fra AI. AI formulerer bare
 * forklaringen. Alltid med kilde + ansvarsfraskrivelse.
 */
import { useState } from 'react';
import { api, ApiError } from './api';
import { useToast } from './ui';

interface Answer {
  verdict: 'yes' | 'no' | 'depends' | 'unknown';
  summary: string;
  source: { accountNumber: string; accountName: string; taxDeductible: string | null; plainExplanation: string; whenToUse: string; whenNotToUse: string | null; commonMistakes: string[] } | null;
  alternatives: { accountNumber: string; accountName: string; taxDeductible: string | null }[];
  aiUsed: boolean;
  disclaimer: string;
}

const VERDICT: Record<string, { label: string; badge: string }> = {
  yes: { label: 'Fradragsberettiget', badge: 'ok' },
  no: { label: 'Ikke fradragsberettiget', badge: 'danger' },
  depends: { label: 'Avhenger', badge: 'warn' },
  unknown: { label: 'Usikker', badge: 'neutral plain' },
};

export function DeductionScreen({ orgId }: { orgId: string }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [ans, setAns] = useState<Answer | null>(null);

  const ask = async () => {
    if (q.trim().length < 2) return;
    setBusy(true);
    try {
      setAns(await api<Answer>('POST', `/api/organizations/${orgId}/deduction/ask`, { question: q.trim() }));
    } catch (err) { toast(err instanceof ApiError ? err.message : 'Feilet', 'danger'); } finally { setBusy(false); }
  };

  const suggestions = ['Ny laptop til jobb', 'Middag med kunde', 'Kontorrekvisita', 'Reise med fly', 'Kamera til opptak'];

  return (
    <div>
      <div className="page-head">
        <h1>Kan jeg trekke fra dette?</h1>
        <p className="subtitle">
          Beskriv en utgift, så finner vi riktig konto og hva kontoplanens regler sier om skattefradrag.
          <b> Svaret er kildekritisk:</b> verdiktet kommer fra reglene (vist som kilde), ikke fra AI-en — den formulerer bare forklaringen.
        </p>
      </div>

      <div className="panel">
        <div className="row" style={{ gap: 10 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} placeholder="F.eks. «ny laptop til jobb» eller «middag med kunde»" style={{ flex: 1 }} />
          <button className="primary" disabled={busy} onClick={ask}>{busy ? 'Sjekker…' : 'Sjekk'}</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {suggestions.map((s) => <button key={s} className="ghost" onClick={() => { setQ(s); }}>{s}</button>)}
        </div>
      </div>

      {ans && (
        <div className={`panel threshold-panel ${ans.verdict === 'yes' ? 'ok' : ans.verdict === 'no' ? 'danger' : 'accent'}`}>
          <div className="threshold-head">
            <h2>{VERDICT[ans.verdict]?.label ?? 'Usikker'}</h2>
            <span className={`badge ${VERDICT[ans.verdict]?.badge ?? 'neutral plain'}`}>{ans.aiUsed ? 'AI-formulert' : 'fra kontoplanen'}</span>
          </div>
          <p className="subtitle" style={{ marginTop: 0 }}>{ans.summary}</p>

          {ans.source && (
            <>
              <h3>Kilde: konto {ans.source.accountNumber} — {ans.source.accountName}</h3>
              <dl className="kv">
                <dt>Skattefradrag (regel)</dt>
                <dd><b>{VERDICT[ans.source.taxDeductible ?? 'unknown']?.label ?? ans.source.taxDeductible ?? 'ikke angitt'}</b></dd>
                <dt>Forklaring</dt><dd>{ans.source.plainExplanation}</dd>
                <dt>Brukes når</dt><dd>{ans.source.whenToUse}</dd>
                {ans.source.whenNotToUse && (<><dt>IKKE når</dt><dd>{ans.source.whenNotToUse}</dd></>)}
              </dl>
              {ans.source.commonMistakes.length > 0 && (
                <p className="hint">Vanlige feil: {ans.source.commonMistakes.join(' · ')}</p>
              )}
            </>
          )}

          {ans.alternatives.length > 0 && (
            <p className="hint">Andre mulige kontoer: {ans.alternatives.map((a) => `${a.accountNumber} ${a.accountName} (${VERDICT[a.taxDeductible ?? 'unknown']?.label ?? a.taxDeductible ?? '?'})`).join(' · ')}</p>
          )}

          <p className="hint" style={{ marginTop: 10 }}>ℹ️ {ans.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
