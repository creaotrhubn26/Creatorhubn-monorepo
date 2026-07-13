import { useState } from 'react';
import { api, kr, STATUS_LABELS } from './api';
import { useLoad } from './App';

/* ── Delte typer (speiler API-svarene) ─────────────────────────────────── */

interface DocumentRow {
  id: string;
  source: string;
  filename: string;
  status: string;
  created_at: string;
}

interface Suggestion {
  suggestedAccountNumber: string;
  suggestedVatCode: string;
  businessUsePercentage: number;
  capitalizationAssessment: string;
  confidence: number;
}

interface Explanation {
  evidence: string[];
  assumptions: string[];
  missingInformation: string[];
  alternatives: { accountNumber: string; vatCode: string; whenApplicable: string }[];
  confidence: number;
  rules: {
    ruleId: string;
    shortName: string;
    plainExplanation: string;
    sources: { title: string; url: string; lastVerified: string }[];
  }[];
}

function badgeClass(status: string): string {
  if (['posted', 'approved', 'matched', 'valid'].includes(status)) return 'ok';
  if (['needs_review', 'duplicate', 'suggested'].includes(status)) return 'warn';
  if (['quarantined', 'rejected', 'discrepancy'].includes(status)) return 'danger';
  if (['extracted'].includes(status)) return 'accent';
  return 'neutral';
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${badgeClass(status)}`}>{STATUS_LABELS[status] ?? status}</span>;
}

function thisYear(): { from: string; to: string } {
  const year = new Date().getFullYear();
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/* ── Oversikt: operativt kontrollsenter ────────────────────────────────── */

export function OverviewScreen({
  orgId,
  onOpenDocument,
}: {
  orgId: string;
  onOpenDocument: (id: string) => void;
}) {
  const { from, to } = thisYear();
  const docs = useLoad(
    () => api<DocumentRow[]>('GET', `/api/organizations/${orgId}/documents`),
    [orgId],
  );
  const tax = useLoad(
    () =>
      api<{ estimatedTaxMinor: string; recommendedReserveMinor: string; vatNetPayableMinor: string }>(
        'GET',
        `/api/organizations/${orgId}/tax/estimate?from=${from}&to=${to}`,
      ),
    [orgId],
  );
  const bank = useLoad(
    () =>
      api<{ id: string }[]>('GET', `/api/organizations/${orgId}/bank/transactions?status=unmatched`),
    [orgId],
  );

  const all = docs.data ?? [];
  const needsAction = all.filter((d) => ['needs_review', 'quarantined', 'extracted'].includes(d.status));
  const count = (s: string) => all.filter((d) => d.status === s).length;

  return (
    <div>
      <h1>Oversikt</h1>
      <p className="subtitle">Det viktigste først: hva trenger oppmerksomhet nå.</p>
      <div className="cards">
        <div className="card">
          <div className="label">Klar til kontroll</div>
          <div className="value">{count('extracted')}</div>
          <div className="hint">Bilag med forslag som venter på godkjenning</div>
        </div>
        <div className="card">
          <div className="label">Trenger gjennomgang</div>
          <div className="value">{count('needs_review') + count('quarantined')}</div>
          <div className="hint">Avvik i summer eller sikkerhetskarantene</div>
        </div>
        <div className="card">
          <div className="label">Uavstemte banktransaksjoner</div>
          <div className="value">{bank.data?.length ?? '–'}</div>
          <div className="hint">Betalinger uten kobling til bilag</div>
        </div>
        <div className="card">
          <div className="label">Anbefalt reserve (skatt + MVA)</div>
          <div className="value">{tax.data ? kr(tax.data.recommendedReserveMinor) : '–'}</div>
          <div className="hint">Estimat — se «Skatt og reserver» for forutsetninger</div>
        </div>
      </div>

      <h2>Bilag som venter på deg</h2>
      {needsAction.length === 0 ? (
        <p className="subtitle">Ingenting venter. Godt jobbet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Fil</th>
              <th>Kilde</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {needsAction.map((d) => (
              <tr key={d.id} className="clickable" onClick={() => onOpenDocument(d.id)}>
                <td>{d.filename}</td>
                <td>{d.source}</td>
                <td>
                  <StatusBadge status={d.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {docs.error && <div className="error">{docs.error}</div>}
    </div>
  );
}

/* ── Bilagsinnboks ─────────────────────────────────────────────────────── */

export function DocumentsScreen({ orgId, onOpen }: { orgId: string; onOpen: (id: string) => void }) {
  const docs = useLoad(
    () => api<DocumentRow[]>('GET', `/api/organizations/${orgId}/documents`),
    [orgId],
  );
  return (
    <div>
      <h1>Bilagsinnboks</h1>
      <p className="subtitle">Alle mottatte dokumenter, uansett kilde.</p>
      {docs.error && <div className="error">{docs.error}</div>}
      <table>
        <thead>
          <tr>
            <th>Fil</th>
            <th>Kilde</th>
            <th>Status</th>
            <th>Mottatt</th>
          </tr>
        </thead>
        <tbody>
          {(docs.data ?? []).map((d) => (
            <tr key={d.id} className="clickable" onClick={() => onOpen(d.id)}>
              <td>{d.filename}</td>
              <td>{d.source}</td>
              <td>
                <StatusBadge status={d.status} />
              </td>
              <td>{d.created_at?.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Bilagsdetalj med forklarbart forslag og godkjenning ───────────────── */

export function DocumentDetailScreen({
  orgId,
  documentId,
  onBack,
}: {
  orgId: string;
  documentId: string;
  onBack: () => void;
}) {
  interface Detail {
    document: DocumentRow & { sha256: string };
    extraction: {
      vendor_name: string | null;
      invoice_number: string | null;
      invoice_date: string | null;
      currency: string | null;
      net_minor: string | null;
      vat_minor: string | null;
      gross_minor: string | null;
      validation_status: string;
      validation_issues: { message: string; severity: string }[] | null;
    } | null;
    suggestions: { id: string; suggestion: Suggestion; status: string }[];
    explanation: Explanation | null;
  }
  const detail = useLoad(
    () => api<Detail>('GET', `/api/organizations/${orgId}/documents/${documentId}`),
    [orgId, documentId],
  );
  const [showWhy, setShowWhy] = useState(false);
  const [account, setAccount] = useState('');
  const [vatCode, setVatCode] = useState('');
  const [businessUse, setBusinessUse] = useState('100');
  const [rate, setRate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState<{ entryNumber: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const d = detail.data;
  const suggestion = d?.suggestions.find((s) => s.status === 'proposed') ?? d?.suggestions[0];
  const needsRate = d?.extraction?.currency && d.extraction.currency !== 'NOK';

  const approve = async () => {
    if (!suggestion) return;
    setBusy(true);
    setError(null);
    try {
      const overrides: Record<string, unknown> = {};
      if (account) overrides['accountNumber'] = account;
      if (vatCode) overrides['vatCode'] = vatCode;
      if (businessUse !== '100') overrides['businessUsePercentage'] = Number(businessUse);
      const body: Record<string, unknown> = { suggestionId: suggestion.id };
      if (Object.keys(overrides).length) body['overrides'] = overrides;
      if (needsRate) body['exchangeRate'] = { rateDecimal: rate, source: 'manuell (bruker)' };
      const res = await api<{ entryNumber: number }>(
        'POST',
        `/api/organizations/${orgId}/documents/${documentId}/approve`,
        body,
      );
      setPosted(res);
      detail.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button className="secondary" onClick={onBack}>
        ← Tilbake
      </button>
      <h1 style={{ marginTop: 12 }}>{d?.document.filename ?? 'Laster…'}</h1>
      {d && <StatusBadge status={d.document.status} />}
      {detail.error && <div className="error">{detail.error}</div>}

      {d?.extraction && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Hva vi fant i dokumentet</h2>
          <dl className="kv">
            <dt>Leverandør</dt>
            <dd>{d.extraction.vendor_name ?? '–'}</dd>
            <dt>Fakturanummer</dt>
            <dd>{d.extraction.invoice_number ?? '–'}</dd>
            <dt>Fakturadato</dt>
            <dd>{d.extraction.invoice_date?.slice(0, 10) ?? '–'}</dd>
            <dt>Valuta</dt>
            <dd>{d.extraction.currency ?? '–'}</dd>
            <dt>Netto</dt>
            <dd>{d.extraction.net_minor ? kr(d.extraction.net_minor) : '–'}</dd>
            <dt>MVA</dt>
            <dd>{d.extraction.vat_minor ? kr(d.extraction.vat_minor) : '–'}</dd>
            <dt>Totalt</dt>
            <dd>{d.extraction.gross_minor ? kr(d.extraction.gross_minor) : '–'}</dd>
          </dl>
          {d.extraction.validation_issues && d.extraction.validation_issues.length > 0 && (
            <>
              <h2>Avvik som må vurderes</h2>
              <ul className="compact">
                {d.extraction.validation_issues.map((issue, i) => (
                  <li key={i}>
                    <span className={`badge ${issue.severity === 'error' ? 'danger' : 'warn'}`}>
                      {issue.severity === 'error' ? 'Feil' : 'Advarsel'}
                    </span>{' '}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {suggestion && d && d.document.status !== 'posted' && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Vårt forslag</h2>
          <dl className="kv">
            <dt>Kategori (konto)</dt>
            <dd>{suggestion.suggestion.suggestedAccountNumber}</dd>
            <dt>MVA-kode</dt>
            <dd>{suggestion.suggestion.suggestedVatCode}</dd>
            <dt>Næringsandel</dt>
            <dd>{suggestion.suggestion.businessUsePercentage} %</dd>
            <dt>Behandling</dt>
            <dd>
              {suggestion.suggestion.capitalizationAssessment === 'expense'
                ? 'Kostnadsføres direkte'
                : suggestion.suggestion.capitalizationAssessment === 'asset'
                  ? 'Bør vurderes som eiendel (avskrives)'
                  : 'Usikker — krever vurdering'}
            </dd>
            <dt>Sikkerhet</dt>
            <dd>{Math.round(suggestion.suggestion.confidence * 100)} %</dd>
          </dl>
          <div className="actions">
            <button className="secondary" onClick={() => setShowWhy(!showWhy)}>
              Hvorfor foreslår dere dette?
            </button>
          </div>
          {showWhy && d.explanation && (
            <div className="panel explain">
              <strong>Det vi fant:</strong>
              <ul className="compact">
                {d.explanation.evidence.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
              {d.explanation.assumptions.length > 0 && (
                <>
                  <strong>Forutsetninger:</strong>
                  <ul className="compact">
                    {d.explanation.assumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </>
              )}
              {d.explanation.missingInformation.length > 0 && (
                <>
                  <strong>Mangler:</strong>
                  <ul className="compact">
                    {d.explanation.missingInformation.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </>
              )}
              {d.explanation.alternatives.length > 0 && (
                <>
                  <strong>Alternativer:</strong>
                  <ul className="compact">
                    {d.explanation.alternatives.map((a, i) => (
                      <li key={i}>
                        Konto {a.accountNumber} / kode {a.vatCode}: {a.whenApplicable}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {d.explanation.rules.length > 0 && (
                <>
                  <strong>Regler og kilder:</strong>
                  <ul className="compact">
                    {d.explanation.rules.map((r) => (
                      <li key={r.ruleId}>
                        <em>{r.shortName}</em>: {r.plainExplanation}{' '}
                        {r.sources.map((s, i) => (
                          <a key={i} href={s.url} target="_blank" rel="noreferrer">
                            [{s.title.split(':')[0]}, kontrollert {s.lastVerified}]
                          </a>
                        ))}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          <h2>Kontroller og godkjenn</h2>
          <p className="subtitle">
            Du kan overstyre forslaget. Ingenting bokføres før du godkjenner.
          </p>
          <div className="row">
            <div>
              <label htmlFor="acc">Konto (overstyr)</label>
              <input
                id="acc"
                placeholder={suggestion.suggestion.suggestedAccountNumber}
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="vatc">MVA-kode (overstyr)</label>
              <input
                id="vatc"
                placeholder={suggestion.suggestion.suggestedVatCode}
                value={vatCode}
                onChange={(e) => setVatCode(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="bu">Næringsandel %</label>
              <input id="bu" value={businessUse} onChange={(e) => setBusinessUse(e.target.value)} />
            </div>
            {needsRate && (
              <div>
                <label htmlFor="rate">Valutakurs {d?.extraction?.currency}→NOK</label>
                <input id="rate" placeholder="f.eks. 11.50" value={rate} onChange={(e) => setRate(e.target.value)} />
              </div>
            )}
          </div>
          {error && <div className="error">{error}</div>}
          <div className="actions">
            <button className="primary" disabled={busy || (Boolean(needsRate) && !rate)} onClick={approve}>
              Godkjenn og bokfør
            </button>
          </div>
        </div>
      )}
      {posted && (
        <div className="success">
          Bokført som bilag nr. {posted.entryNumber}. Rapportene er oppdatert.
        </div>
      )}
      {d?.document.status === 'posted' && !posted && (
        <div className="success">Dette bilaget er bokført.</div>
      )}
    </div>
  );
}

/* ── Gmail-import (sandbox) ────────────────────────────────────────────── */

export function GmailScreen({
  orgId,
  onOpenDocument,
}: {
  orgId: string;
  onOpenDocument: (id: string) => void;
}) {
  const [labels, setLabels] = useState('Regnskap');
  const [afterDate, setAfterDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    scannedMessages: number;
    connectionState: string;
    integrationMode: string;
    importedDocuments: { documentId: string; filename: string; status: string }[];
  } | null>(null);

  const runImport = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        labels: labels.split(',').map((l) => l.trim()).filter(Boolean),
      };
      if (afterDate) body['afterDate'] = afterDate;
      setResult(await api('POST', `/api/organizations/${orgId}/gmail/import`, body));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1>Gmail-import</h1>
      <p className="subtitle">
        Vi leser kun e-post innenfor etikettene og perioden du velger — aldri hele postkassen.
      </p>
      <div className="panel">
        <span className="badge warn">Sandbox</span>{' '}
        <span className="subtitle">
          Ekte Gmail-tilkobling er ikke aktivert ennå (krever Google OAuth-oppsett). Importen under
          kjører mot et realistisk testdatasett.
        </span>
      </div>
      <div className="row">
        <div>
          <label htmlFor="labels">Etiketter (kommaseparert)</label>
          <input id="labels" value={labels} onChange={(e) => setLabels(e.target.value)} />
        </div>
        <div>
          <label htmlFor="after">Fra dato (valgfritt)</label>
          <input id="after" placeholder="ÅÅÅÅ-MM-DD" value={afterDate} onChange={(e) => setAfterDate(e.target.value)} />
        </div>
        <div>
          <button className="primary" disabled={busy} onClick={runImport}>
            Importer
          </button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {result && (
        <>
          <p style={{ marginTop: 16 }}>
            Skannet {result.scannedMessages} meldinger. Tilkobling: {result.connectionState} (
            {result.integrationMode}).
          </p>
          <table>
            <thead>
              <tr>
                <th>Fil</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.importedDocuments.map((doc) => (
                <tr key={doc.documentId} className="clickable" onClick={() => onOpenDocument(doc.documentId)}>
                  <td>{doc.filename}</td>
                  <td>
                    <StatusBadge status={doc.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/* ── Bank og avstemming ────────────────────────────────────────────────── */

export function BankScreen({ orgId }: { orgId: string }) {
  interface BankTx {
    id: string;
    booked_date: string;
    amount_minor: string;
    description: string;
    counterparty: string | null;
    status: string;
  }
  interface Match {
    id: string;
    match_type: string;
    matched_amount_minor: string;
    explanation: string;
    status: string;
  }
  const txs = useLoad(
    () => api<BankTx[]>('GET', `/api/organizations/${orgId}/bank/transactions`),
    [orgId],
  );
  const matches = useLoad(
    () => api<Match[]>('GET', `/api/organizations/${orgId}/bank/matches`),
    [orgId],
  );
  const [accountName, setAccountName] = useState('Driftskonto');
  const [accountNo, setAccountNo] = useState('');
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);
  const [csv, setCsv] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const createAccount = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ id: string }>('POST', `/api/organizations/${orgId}/bank-accounts`, {
        name: accountName,
        ibanOrAccount: accountNo,
      });
      setBankAccountId(res.id);
      setInfo('Bankkonto opprettet. Lim inn kontoutskrift (CSV) under.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const importCsv = async () => {
    if (!bankAccountId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ imported: number; skippedDuplicates: number; suggestions: unknown[] }>(
        'POST',
        `/api/organizations/${orgId}/bank-accounts/${bankAccountId}/import`,
        { csv },
      );
      setInfo(
        `Importerte ${res.imported} transaksjoner (${res.skippedDuplicates} duplikater hoppet over). ${res.suggestions.length} matchforslag.`,
      );
      txs.reload();
      matches.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const decide = async (matchId: string, approve: boolean) => {
    setError(null);
    try {
      if (approve) {
        await api('POST', `/api/organizations/${orgId}/bank/matches/${matchId}/approve`);
      } else {
        const reason = prompt('Hvorfor avvises treffet?');
        if (!reason) return;
        await api('POST', `/api/organizations/${orgId}/bank/matches/${matchId}/reject`, { reason });
      }
      txs.reload();
      matches.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div>
      <h1>Bank og avstemming</h1>
      <p className="subtitle">
        Import bokfører aldri noe alene — du godkjenner hvert treff, og forklaringen viser hvorfor
        det ble foreslått.
      </p>
      {error && <div className="error">{error}</div>}
      {info && <div className="success">{info}</div>}

      {!bankAccountId && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Koble til bankkonto (manuell import)</h2>
          <div className="row">
            <div>
              <label htmlFor="bn">Navn</label>
              <input id="bn" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="ba">Kontonummer/IBAN</label>
              <input id="ba" value={accountNo} onChange={(e) => setAccountNo(e.target.value)} />
            </div>
            <div>
              <button className="primary" disabled={busy || !accountNo} onClick={createAccount}>
                Opprett
              </button>
            </div>
          </div>
        </div>
      )}

      {bankAccountId && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Importer kontoutskrift (CSV)</h2>
          <p className="subtitle">Format: Dato;Beskrivelse;Beløp;Motpart;KID;Referanse</p>
          <textarea rows={6} value={csv} onChange={(e) => setCsv(e.target.value)} />
          <div className="actions">
            <button className="primary" disabled={busy || !csv} onClick={importCsv}>
              Importer og finn treff
            </button>
          </div>
        </div>
      )}

      <h2>Matchforslag</h2>
      {(matches.data ?? []).filter((m) => m.status === 'suggested').length === 0 ? (
        <p className="subtitle">Ingen åpne forslag.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Beløp</th>
              <th>Forklaring</th>
              <th>Type</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(matches.data ?? [])
              .filter((m) => m.status === 'suggested')
              .map((m) => (
                <tr key={m.id}>
                  <td className="num">{kr(m.matched_amount_minor)}</td>
                  <td>{m.explanation}</td>
                  <td>
                    <span className={`badge ${m.match_type === 'exact' ? 'ok' : 'accent'}`}>
                      {m.match_type === 'exact' ? 'KID-treff' : 'Regeltreff'}
                    </span>
                  </td>
                  <td>
                    <div className="actions" style={{ marginTop: 0 }}>
                      <button className="primary" onClick={() => decide(m.id, true)}>
                        Godkjenn
                      </button>
                      <button className="danger" onClick={() => decide(m.id, false)}>
                        Avvis
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}

      <h2>Transaksjoner</h2>
      <table>
        <thead>
          <tr>
            <th>Dato</th>
            <th>Beskrivelse</th>
            <th className="num">Beløp</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {(txs.data ?? []).map((t) => (
            <tr key={t.id}>
              <td>{t.booked_date}</td>
              <td>
                {t.description}
                {t.counterparty ? ` — ${t.counterparty}` : ''}
              </td>
              <td className="num">{kr(t.amount_minor)}</td>
              <td>
                <StatusBadge status={t.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Rapporter ─────────────────────────────────────────────────────────── */

export function ReportsScreen({ orgId }: { orgId: string }) {
  interface Pnl {
    revenueMinor: string;
    expenseMinor: string;
    resultMinor: string;
    byAccount: { accountNumber: string; accountName: string; balanceMinor: string; accountType: string }[];
  }
  interface TbRow {
    accountNumber: string;
    accountName: string;
    debitMinor: string;
    creditMinor: string;
    balanceMinor: string;
  }
  const pnl = useLoad(
    () => api<Pnl>('GET', `/api/organizations/${orgId}/reports/income-statement`),
    [orgId],
  );
  const tb = useLoad(
    () => api<TbRow[]>('GET', `/api/organizations/${orgId}/reports/trial-balance`),
    [orgId],
  );

  return (
    <div>
      <h1>Rapporter</h1>
      <p className="subtitle">Alle tall kommer fra hovedboken — aldri fra AI.</p>
      <div className="cards">
        <div className="card">
          <div className="label">Inntekter (alle perioder)</div>
          <div className="value">{pnl.data ? kr(pnl.data.revenueMinor) : '–'}</div>
        </div>
        <div className="card">
          <div className="label">Kostnader</div>
          <div className="value">{pnl.data ? kr(pnl.data.expenseMinor) : '–'}</div>
        </div>
        <div className="card">
          <div className="label">Resultat</div>
          <div className="value">{pnl.data ? kr(pnl.data.resultMinor) : '–'}</div>
        </div>
      </div>
      <h2>Saldobalanse</h2>
      {tb.error && <div className="error">{tb.error}</div>}
      <table>
        <thead>
          <tr>
            <th>Konto</th>
            <th>Navn</th>
            <th className="num">Debet</th>
            <th className="num">Kredit</th>
            <th className="num">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {(tb.data ?? []).map((r) => (
            <tr key={r.accountNumber}>
              <td>{r.accountNumber}</td>
              <td>{r.accountName}</td>
              <td className="num">{kr(r.debitMinor)}</td>
              <td className="num">{kr(r.creditMinor)}</td>
              <td className="num">{kr(r.balanceMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── MVA ───────────────────────────────────────────────────────────────── */

export function VatScreen({ orgId }: { orgId: string }) {
  const defaults = thisYear();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  interface VatReport {
    status: string;
    outputVatMinor: string;
    deductibleInputVatMinor: string;
    netPayableMinor: string;
    warnings: string[];
    lines: { vatCode: string; name: string; baseMinor: string; vatMinor: string }[];
  }
  const report = useLoad(
    () => api<VatReport>('GET', `/api/organizations/${orgId}/vat/report?from=${from}&to=${to}`),
    [orgId, from, to],
  );
  const r = report.data;
  return (
    <div>
      <h1>MVA</h1>
      <p className="subtitle">
        Foreløpig oversikt for valgt periode. Innsending til Skatteetaten krever egen
        signeringshandling og er ikke aktivert ennå.
      </p>
      <div className="row" style={{ maxWidth: 480 }}>
        <div>
          <label htmlFor="vfrom">Fra</label>
          <input id="vfrom" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label htmlFor="vto">Til</label>
          <input id="vto" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      {report.error && <div className="error">{report.error}</div>}
      {r && (
        <>
          <div className="cards">
            <div className="card">
              <div className="label">Utgående MVA (fra salg)</div>
              <div className="value">{kr(r.outputVatMinor)}</div>
            </div>
            <div className="card">
              <div className="label">Inngående MVA (fradrag)</div>
              <div className="value">{kr(r.deductibleInputVatMinor)}</div>
            </div>
            <div className="card">
              <div className="label">{BigInt(r.netPayableMinor) >= 0n ? 'Å betale' : 'Til gode'}</div>
              <div className="value">{kr(BigInt(r.netPayableMinor) < 0n ? (-BigInt(r.netPayableMinor)).toString() : r.netPayableMinor)}</div>
              <div className="hint">
                Status: <span className="badge neutral">Kladd</span>
              </div>
            </div>
          </div>
          {r.warnings.length > 0 && (
            <div className="error">
              <ul className="compact">
                {r.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <h2>Per MVA-kode</h2>
          <table>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Navn</th>
                <th className="num">Grunnlag</th>
                <th className="num">MVA</th>
              </tr>
            </thead>
            <tbody>
              {r.lines.map((line) => (
                <tr key={line.vatCode}>
                  <td>{line.vatCode}</td>
                  <td>{line.name}</td>
                  <td className="num">{kr(line.baseMinor)}</td>
                  <td className="num">{kr(line.vatMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/* ── Skatt og reserver ─────────────────────────────────────────────────── */

export function TaxScreen({ orgId }: { orgId: string }) {
  const defaults = thisYear();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  interface Estimate {
    accountingResultMinor: string;
    estimatedTaxableResultMinor: string;
    estimatedTaxMinor: string;
    recommendedReserveMinor: string;
    calculatedAt: string;
    components: { name: string; ratePct: string; amountMinor: string; ruleId: string; ruleVersion: number }[];
    scenarios: { label: string; estimatedTaxMinor: string }[];
    uncertaintyNotes: string[];
    notIncluded: string[];
    dataBasis: string;
  }
  const est = useLoad(
    () => api<Estimate>('GET', `/api/organizations/${orgId}/tax/estimate?from=${from}&to=${to}`),
    [orgId, from, to],
  );
  const e = est.data;
  const scenarioLabel: Record<string, string> = { low: 'Lavt', expected: 'Forventet', high: 'Høyt' };
  return (
    <div>
      <h1>Skatt og reserver</h1>
      <p className="subtitle">Et løpende estimat — ikke en garanti. Forutsetningene står nederst.</p>
      <div className="row" style={{ maxWidth: 480 }}>
        <div>
          <label htmlFor="tfrom">Fra</label>
          <input id="tfrom" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label htmlFor="tto">Til</label>
          <input id="tto" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      {est.error && <div className="error">{est.error}</div>}
      {e && (
        <>
          <div className="cards">
            <div className="card">
              <div className="label">Resultat hittil</div>
              <div className="value">{kr(e.accountingResultMinor)}</div>
            </div>
            <div className="card">
              <div className="label">Estimert skatt</div>
              <div className="value">{kr(e.estimatedTaxMinor)}</div>
            </div>
            <div className="card">
              <div className="label">Bør settes av (skatt + MVA)</div>
              <div className="value">{kr(e.recommendedReserveMinor)}</div>
            </div>
          </div>
          <h2>Slik er estimatet satt sammen</h2>
          <table>
            <thead>
              <tr>
                <th>Komponent</th>
                <th className="num">Sats</th>
                <th className="num">Beløp</th>
                <th>Regel</th>
              </tr>
            </thead>
            <tbody>
              {e.components.map((c) => (
                <tr key={c.ruleId}>
                  <td>{c.name}</td>
                  <td className="num">{c.ratePct} %</td>
                  <td className="num">{kr(c.amountMinor)}</td>
                  <td>
                    <span className="badge neutral">
                      {c.ruleId} v{c.ruleVersion}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2>Scenarioer</h2>
          <div className="cards">
            {e.scenarios.map((s) => (
              <div className="card" key={s.label}>
                <div className="label">{scenarioLabel[s.label] ?? s.label}</div>
                <div className="value">{kr(s.estimatedTaxMinor)}</div>
              </div>
            ))}
          </div>
          <div className="panel">
            <strong>Datagrunnlag:</strong> {e.dataBasis}
            <br />
            <strong>Beregnet:</strong> {e.calculatedAt.slice(0, 16).replace('T', ' ')}
            <h2>Usikkerhet</h2>
            <ul className="compact">
              {e.uncertaintyNotes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
            <h2>Ikke medregnet</h2>
            <ul className="compact">
              {e.notIncluded.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
