import { useState } from 'react';
import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { api, ApiError, kr, loadCodeLibrary, type AccountInfo, type VatCodeInfo } from './api';
import { useLoad, type ViewMode } from './App';
import { DimensionSelect } from './screens-dimensions';
import { PostingLines } from './screens-pro';
import { CardSkeleton, Disclosure, EmptyState, StatusBadge, TableSkeleton, useToast } from './ui';

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

interface DocumentImpact {
  computable: boolean;
  reason?: string;
  businessGrossMinor: string;
  privateGrossMinor: string;
  costToResultMinor: string;
  deductibleInputVatMinor: string;
  nonDeductibleVatMinor: string;
  reverseChargeOutputVatMinor: string;
  capitalized: boolean;
  taxEffect: {
    combinedRateLabel: string;
    reducesTaxByMinor: string;
    components: { name: string; ratePct: string; amountMinor: string }[];
  } | null;
  notes: string[];
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
  impact: DocumentImpact | null;
}

interface HistoryEvent {
  action: string;
  occurred_at: string;
  reason: string | null;
  new_value: Record<string, unknown> | null;
  actor_role: string | null;
  actor_name: string | null;
  actor_email: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  gmail: 'Gmail',
  upload: 'Opplasting',
  mobile: 'Mobil',
  forward: 'Videresendt',
  integration: 'Integrasjon',
};

function thisYear(): { from: string; to: string } {
  const year = new Date().getFullYear();
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/** Kodebiblioteket: vennlige navn foran tekniske koder, i hele UI-et. */
function useCodeLibrary(orgId: string) {
  const lib = useLoad(() => loadCodeLibrary(orgId), [orgId]);
  return {
    account: (num: string | null | undefined): AccountInfo | undefined =>
      num ? lib.data?.accounts.get(num) : undefined,
    vatCode: (code: string | null | undefined): VatCodeInfo | undefined =>
      code ? lib.data?.vatCodes.get(code) : undefined,
  };
}

function AccountLabel({ number, info }: { number: string; info: AccountInfo | undefined }) {
  if (!info) return <>{number}</>;
  return (
    <>
      {info.friendlyName}
      <span className="code">({number})</span>
    </>
  );
}

/* ── Oversikt: operativt kontrollsenter ────────────────────────────────── */

interface HealthIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  detail: string;
  actionLabel?: string;
  actionScreen?: string;
}

export function OverviewScreen({
  orgId,
  onOpenDocument,
  onNavigate,
}: {
  orgId: string;
  onOpenDocument: (id: string) => void;
  onNavigate?: (screen: string) => void;
}) {
  const { from, to } = thisYear();
  const health = useLoad(
    () => api<{ issues: HealthIssue[]; okCount: number }>('GET', `/api/organizations/${orgId}/health-check`),
    [orgId],
  );
  const docs = useLoad(() => api<DocumentRow[]>('GET', `/api/organizations/${orgId}/documents`), [orgId]);
  const tax = useLoad(
    () =>
      api<{ recommendedReserveMinor: string }>(
        'GET',
        `/api/organizations/${orgId}/tax/estimate?from=${from}&to=${to}`,
      ),
    [orgId],
  );
  const bank = useLoad(
    () => api<{ id: string }[]>('GET', `/api/organizations/${orgId}/bank/transactions?status=unmatched`),
    [orgId],
  );

  const all = docs.data ?? [];
  const needsAction = all.filter((d) => ['needs_review', 'quarantined', 'extracted'].includes(d.status));
  const count = (s: string) => all.filter((d) => d.status === s).length;
  const reviewCount = count('needs_review') + count('quarantined');

  return (
    <div>
      <div className="page-head">
        <h1>Oversikt</h1>
        <p className="subtitle">Det viktigste først: hva trenger oppmerksomhet nå.</p>
      </div>

      {!health.loading && health.data && (
        <div className="panel health-panel">
          <div className="threshold-head">
            <h2>Regnskapshelse</h2>
            {health.data.issues.length === 0 ? (
              <span className="badge ok">Alt ser bra ut ✓</span>
            ) : (
              <span className="badge accent">{health.data.issues.length} ting å se på</span>
            )}
          </div>
          {health.data.issues.length === 0 ? (
            <p className="subtitle">
              Vi fant ingenting som haster. Vi sjekker fortløpende om noe ser feil ut, så du kan slappe av.
            </p>
          ) : (
            <ul className="health-list">
              {health.data.issues.map((iss) => (
                <li key={iss.id} className={`health-item ${iss.severity}`}>
                  <div className="health-dot" aria-hidden="true" />
                  <div className="health-body">
                    <div className="health-title">{iss.title}</div>
                    <div className="health-detail">{iss.detail}</div>
                  </div>
                  {iss.actionLabel && iss.actionScreen && onNavigate && (
                    <button className="primary health-action" onClick={() => onNavigate(iss.actionScreen!)}>
                      {iss.actionLabel}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {docs.loading ? (
        <div className="cards">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="cards">
          <div className={`card${count('extracted') > 0 ? ' attention' : ''}`}>
            <div className="label">Klar til kontroll</div>
            <div className="value">{count('extracted')}</div>
            <div className="hint">Bilag med forslag som venter på din godkjenning</div>
          </div>
          <div className={`card${reviewCount > 0 ? ' attention' : ''}`}>
            <div className="label">Trenger gjennomgang</div>
            <div className="value">{reviewCount}</div>
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
            <div className="hint">Estimat — se «Skatt og reserver» for forutsetningene</div>
          </div>
        </div>
      )}

      <h2>Bilag som venter på deg</h2>
      {docs.loading ? (
        <TableSkeleton />
      ) : needsAction.length === 0 ? (
        <EmptyState
          icon="✓"
          title="Ingenting venter"
          desc="Alle mottatte bilag er behandlet. Nye dokumenter dukker opp her når de kommer inn via Gmail, mobil eller opplasting."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dokument</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {needsAction.map((d) => (
                <tr
                  key={d.id}
                  className="clickable"
                  tabIndex={0}
                  onClick={() => onOpenDocument(d.id)}
                  onKeyDown={(e) => e.key === 'Enter' && onOpenDocument(d.id)}
                >
                  <td>
                    <div className="primary-line">{d.filename}</div>
                    <div className="secondary-line">
                      {SOURCE_LABELS[d.source] ?? d.source} · {d.created_at?.slice(0, 10)}
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={d.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {docs.error && <div className="error">{docs.error}</div>}
    </div>
  );
}

/* ── Bilagsinnboks ─────────────────────────────────────────────────────── */

const INBOX_FILTERS: { key: string | null; label: string }[] = [
  { key: null, label: 'Alle' },
  { key: 'extracted', label: 'Klar til kontroll' },
  { key: 'needs_review', label: 'Trenger gjennomgang' },
  { key: 'posted', label: 'Bokført' },
  { key: 'duplicate', label: 'Duplikater' },
  { key: 'quarantined', label: 'Karantene' },
];

export function DocumentsScreen({ orgId, onOpen }: { orgId: string; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState<string | null>(null);
  const docs = useLoad(
    () =>
      api<DocumentRow[]>(
        'GET',
        `/api/organizations/${orgId}/documents${filter ? `?status=${filter}` : ''}`,
      ),
    [orgId, filter],
  );
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const contentBase64 = btoa(
        Array.from(new Uint8Array(buffer), (b) => String.fromCharCode(b)).join(''),
      );
      const res = await api<{ documentId: string; status: string }>(
        'POST',
        `/api/organizations/${orgId}/documents`,
        {
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          contentBase64,
          // Bilder kommer typisk fra mobilkamera; PDF-er fra filvelger.
          source: file.type.startsWith('image/') ? 'mobile' : 'upload',
        },
      );
      toast(
        res.status === 'duplicate'
          ? 'Dokumentet er allerede registrert (duplikat)'
          : res.status === 'quarantined'
            ? 'Dokumentet ble satt i sikkerhetskarantene'
            : 'Dokument mottatt og tolket',
        res.status === 'quarantined' ? 'danger' : 'ok',
      );
      docs.reload();
      if (res.status === 'extracted') onOpen(res.documentId);
    } catch (err) {
      toast((err as Error).message, 'danger');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>Bilagsinnboks</h1>
        <p className="subtitle">Alle mottatte dokumenter, uansett kilde.</p>
      </div>
      <div className="panel">
        <div className="row">
          <div>
            <strong>Nytt bilag</strong>
            <p className="subtitle">
              Ta bilde av kvitteringen med mobilen eller velg en PDF — vi tolker den og foreslår
              bokføring.
            </p>
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,image/*"
              capture="environment"
              style={{ display: 'none' }}
              aria-label="Last opp bilag"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadFile(file);
              }}
            />
            <button className="primary" disabled={uploading} onClick={() => fileInput.current?.click()}>
              {uploading ? 'Laster opp…' : 'Last opp bilag'}
            </button>
          </div>
        </div>
      </div>
      <div className="actions" style={{ marginBottom: 14 }}>
        {INBOX_FILTERS.map((f) => (
          <button
            key={f.label}
            className={filter === f.key ? 'primary' : 'secondary'}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {docs.error && <div className="error">{docs.error}</div>}
      {docs.loading ? (
        <TableSkeleton rows={6} />
      ) : (docs.data ?? []).length === 0 ? (
        <EmptyState
          icon="📄"
          title={filter ? 'Ingen bilag i denne kategorien' : 'Ingen bilag ennå'}
          desc="Importer fra Gmail eller last opp en kvittering eller faktura, så tolker vi den og foreslår bokføring."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dokument</th>
                <th>Kilde</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(docs.data ?? []).map((d) => (
                <tr
                  key={d.id}
                  className="clickable"
                  tabIndex={0}
                  onClick={() => onOpen(d.id)}
                  onKeyDown={(e) => e.key === 'Enter' && onOpen(d.id)}
                >
                  <td>
                    <div className="primary-line">{d.filename}</div>
                    <div className="secondary-line">{d.created_at?.slice(0, 10)}</div>
                  </td>
                  <td>{SOURCE_LABELS[d.source] ?? d.source}</td>
                  <td>
                    <StatusBadge status={d.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Bilagsdetalj: forklarbart forslag og godkjenning ──────────────────── */

export function DocumentDetailScreen({
  orgId,
  documentId,
  viewMode,
  onBack,
}: {
  orgId: string;
  documentId: string;
  viewMode: ViewMode;
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
    suggestions: {
      id: string;
      suggestion: Suggestion;
      status: string;
      decided_at: string | null;
      decided_by_name: string | null;
      decided_by_email: string | null;
      decision_note: string | null;
    }[];
    explanation: Explanation | null;
    history: HistoryEvent[];
  }
  const detail = useLoad(
    () => api<Detail>('GET', `/api/organizations/${orgId}/documents/${documentId}`),
    [orgId, documentId],
  );
  const lib = useCodeLibrary(orgId);
  const toast = useToast();
  const [showWhy, setShowWhy] = useState(false);
  const [account, setAccount] = useState('');
  const [vatCode, setVatCode] = useState('');
  const [businessUse, setBusinessUse] = useState('100');
  const [project, setProject] = useState('');
  const [department, setDepartment] = useState('');
  const [rate, setRate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState<{ entryNumber: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const d = detail.data;
  const isPosted = d?.document.status === 'posted';
  const showTechnical = viewMode !== 'simple';
  const entry = useLoad(
    () =>
      isPosted && showTechnical
        ? api<{
            entry_number: string;
            entry_date: string;
            lines: Parameters<typeof PostingLines>[0]['lines'];
          }>('GET', `/api/organizations/${orgId}/documents/${documentId}/journal-entry`)
        : Promise.resolve(null),
    [orgId, documentId, isPosted, showTechnical],
  );
  const suggestion = d?.suggestions.find((s) => s.status === 'proposed') ?? d?.suggestions[0];
  const decidedBy = d?.suggestions.find((s) => s.decided_at) ?? null;
  const needsRate = d?.extraction?.currency && d.extraction.currency !== 'NOK';
  const sugAccount = suggestion?.suggestion.suggestedAccountNumber;
  const sugVat = suggestion?.suggestion.suggestedVatCode;

  const approve = async () => {
    if (!suggestion) return;
    setBusy(true);
    setError(null);
    try {
      const overrides: Record<string, unknown> = {};
      if (account) overrides['accountNumber'] = account;
      if (vatCode) overrides['vatCode'] = vatCode;
      if (businessUse !== '100') overrides['businessUsePercentage'] = Number(businessUse);
      if (project) overrides['project'] = project;
      if (department) overrides['department'] = department;
      const body: Record<string, unknown> = { suggestionId: suggestion.id };
      if (Object.keys(overrides).length) body['overrides'] = overrides;
      if (needsRate) body['exchangeRate'] = { rateDecimal: rate, source: 'manuell (bruker)' };
      const res = await api<{ entryNumber: number }>(
        'POST',
        `/api/organizations/${orgId}/documents/${documentId}/approve`,
        body,
      );
      setPosted(res);
      toast(`Bokført som bilag nr. ${res.entryNumber}`, 'ok');
      detail.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (detail.loading) return <TableSkeleton rows={6} />;

  return (
    <div>
      <button className="secondary" onClick={onBack}>
        ← Tilbake
      </button>
      <div className="page-head" style={{ marginTop: 14 }}>
        <h1>{d?.document.filename ?? 'Ukjent dokument'}</h1>
        {d && <StatusBadge status={d.document.status} />}
      </div>
      {detail.error && <div className="error">{detail.error}</div>}

      {d?.document.status === 'quarantined' && (
        <div className="notice">
          Dokumentet er satt i sikkerhetskarantene fordi innholdet ligner et manipulasjonsforsøk.
          En person med dokumentansvar må vurdere det manuelt. Ingenting er bokført.
        </div>
      )}

      {d?.extraction && (
        <div className="panel">
          <h2>Hva vi fant i dokumentet</h2>
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
            <dd>
              <strong>{d.extraction.gross_minor ? kr(d.extraction.gross_minor) : '–'}</strong>
            </dd>
          </dl>
          {d.extraction.validation_issues && d.extraction.validation_issues.length > 0 && (
            <>
              <h2>Avvik som må vurderes</h2>
              <ul className="compact">
                {d.extraction.validation_issues.map((issue, i) => (
                  <li key={i}>
                    <span className={`badge plain ${issue.severity === 'error' ? 'danger' : 'warn'}`}>
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
          <div className="panel-head">
            <h2>Vårt forslag</h2>
            <ConfidenceBadge confidence={suggestion.suggestion.confidence} />
          </div>
          <dl className="kv">
            <dt>Kategori</dt>
            <dd>
              <AccountLabel number={sugAccount!} info={lib.account(sugAccount)} />
            </dd>
            <dt>MVA-behandling</dt>
            <dd>
              {lib.vatCode(sugVat)?.name ?? sugVat}
              <span className="code">(kode {sugVat})</span>
            </dd>
            <dt>Næringsandel</dt>
            <dd>{suggestion.suggestion.businessUsePercentage} %</dd>
            <dt>Behandling</dt>
            <dd>
              {suggestion.suggestion.capitalizationAssessment === 'expense'
                ? 'Kostnadsføres direkte'
                : suggestion.suggestion.capitalizationAssessment === 'asset'
                  ? 'Bør vurderes som eiendel (avskrives over flere år)'
                  : 'Usikker — krever din vurdering'}
            </dd>
          </dl>
          {d.explanation?.impact && <ImpactSummary impact={d.explanation.impact} />}
          <div className="actions">
            <button className="secondary" aria-expanded={showWhy} onClick={() => setShowWhy(!showWhy)}>
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
                        <AccountLabel number={a.accountNumber} info={lib.account(a.accountNumber)} />:{' '}
                        {a.whenApplicable}
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
              <Disclosure label="Vis tekniske detaljer">
                <dl className="kv" style={{ marginTop: 8 }}>
                  <dt>Kontonummer</dt>
                  <dd>{sugAccount}</dd>
                  <dt>SAF-T MVA-kode</dt>
                  <dd>{sugVat}</dd>
                  <dt>Modellsikkerhet</dt>
                  <dd>{Math.round((d.explanation.confidence ?? 0) * 100)} %</dd>
                  <dt>Dokument-hash (SHA-256)</dt>
                  <dd style={{ wordBreak: 'break-all', fontSize: 12.5 }}>{d.document.sha256}</dd>
                </dl>
              </Disclosure>
            </div>
          )}

          <h2>Kontroller og godkjenn</h2>
          <p className="subtitle">Du kan overstyre forslaget. Ingenting bokføres før du godkjenner.</p>
          <div className="row">
            <div>
              <label htmlFor="acc">Konto (overstyr)</label>
              <input id="acc" placeholder={sugAccount} value={account} onChange={(e) => setAccount(e.target.value)} />
            </div>
            <div>
              <label htmlFor="vatc">MVA-kode (overstyr)</label>
              <input id="vatc" placeholder={sugVat} value={vatCode} onChange={(e) => setVatCode(e.target.value)} />
            </div>
            <div>
              <label htmlFor="bu">Næringsandel %</label>
              <input id="bu" inputMode="numeric" value={businessUse} onChange={(e) => setBusinessUse(e.target.value)} />
            </div>
            {needsRate && (
              <div>
                <label htmlFor="rate">Valutakurs {d?.extraction?.currency}→NOK</label>
                <input id="rate" placeholder="f.eks. 11.50" value={rate} onChange={(e) => setRate(e.target.value)} />
              </div>
            )}
            <DimensionSelect orgId={orgId} kind="project" value={project} onChange={setProject} id="dim-project" />
            <DimensionSelect orgId={orgId} kind="department" value={department} onChange={setDepartment} id="dim-department" />
          </div>
          {error && <div className="error">{error}</div>}
          <div className="actions">
            <button className="primary" disabled={busy || (Boolean(needsRate) && !rate)} onClick={approve}>
              {busy ? 'Bokfører…' : 'Godkjenn og bokfør'}
            </button>
          </div>
        </div>
      )}
      {posted && (
        <div className="success">Bokført som bilag nr. {posted.entryNumber}. Rapportene er oppdatert.</div>
      )}
      {d?.document.status === 'posted' && !posted && (
        <div className="success">Dette bilaget er bokført.</div>
      )}
      {showTechnical && entry.data && (
        <div className="panel">
          <h2>
            Postering — bilag nr. {entry.data.entry_number}{' '}
            <span className="badge neutral plain">{entry.data.entry_date}</span>
          </h2>
          <PostingLines lines={entry.data.lines} />
        </div>
      )}
      {decidedBy && (
        <div className="panel">
          <h2>Godkjenning</h2>
          <dl className="kv">
            <dt>Godkjent/endret av</dt>
            <dd>
              {decidedBy.decided_by_name ?? decidedBy.decided_by_email ?? 'Ukjent bruker'}
              {decidedBy.decided_at && (
                <span className="code">{new Date(decidedBy.decided_at).toLocaleString('nb-NO')}</span>
              )}
            </dd>
            {decidedBy.decision_note && (
              <>
                <dt>Merknad</dt>
                <dd>{decidedBy.decision_note}</dd>
              </>
            )}
          </dl>
        </div>
      )}
      {d && d.history.length > 0 && <HistoryPanel history={d.history} />}
    </div>
  );
}

const AUDIT_LABELS: Record<string, string> = {
  'posting_suggestion.created': 'Systemet foreslo konto og mva-kode',
  'document.approved_and_posted': 'Godkjent og bokført',
  'document.status_changed': 'Status endret',
  'extraction.stored': 'Data lest fra dokumentet',
};

function actorLabel(e: HistoryEvent): string {
  if (e.actor_name) return e.actor_name;
  if (e.actor_email) return e.actor_email;
  return 'Reknaren (automatisk)';
}

/** Krav 7: full, uforanderlig endringslogg for bilaget. */
function HistoryPanel({ history }: { history: HistoryEvent[] }) {
  return (
    <div className="panel">
      <h2>Historikk</h2>
      <p className="subtitle">Alle endringer er sporet i en uforanderlig revisjonslogg.</p>
      <ol className="timeline">
        {history.map((e, i) => {
          const entryNo = e.new_value && typeof e.new_value['entryNumber'] === 'number' ? e.new_value['entryNumber'] : null;
          return (
            <li key={i}>
              <div className="timeline-when">{new Date(e.occurred_at).toLocaleString('nb-NO')}</div>
              <div className="timeline-what">
                <strong>{AUDIT_LABELS[e.action] ?? e.action}</strong>
                {entryNo !== null && <> — bilag nr. {String(entryNo)}</>}
                <div className="timeline-who">
                  {actorLabel(e)}
                  {e.actor_role && <span className="code">{e.actor_role}</span>}
                </div>
                {e.reason && <div className="hint">{e.reason}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Krav 5: modellsikkerhet som tydelig overskrift, fargekodet. */
function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round((confidence ?? 0) * 100);
  const level = pct >= 80 ? 'high' : pct >= 50 ? 'medium' : 'low';
  const label = level === 'high' ? 'Høy sikkerhet' : level === 'medium' ? 'Bør sjekkes' : 'Usikkert';
  return (
    <span className={`confidence ${level}`} title="Hvor sikkert forslaget er">
      {pct} % · {label}
    </span>
  );
}

/** Krav 4: hva forslaget betyr for mva, resultat og skatt — i kroner. */
function ImpactSummary({ impact }: { impact: DocumentImpact }) {
  if (!impact.computable) {
    return (
      <div className="panel impact">
        <strong>Konsekvens</strong>
        <p className="hint">{impact.reason}</p>
      </div>
    );
  }
  return (
    <div className="panel impact">
      <strong>Hva dette betyr</strong>
      <dl className="kv">
        {BigInt(impact.deductibleInputVatMinor) > 0n && (
          <>
            <dt>Fradragsberettiget inngående MVA</dt>
            <dd className="pos">{kr(impact.deductibleInputVatMinor)}</dd>
          </>
        )}
        {BigInt(impact.nonDeductibleVatMinor) > 0n && (
          <>
            <dt>MVA uten fradrag (blir kostnad)</dt>
            <dd>{kr(impact.nonDeductibleVatMinor)}</dd>
          </>
        )}
        {BigInt(impact.reverseChargeOutputVatMinor) > 0n && (
          <>
            <dt>Utgående MVA (omvendt avgiftsplikt)</dt>
            <dd>{kr(impact.reverseChargeOutputVatMinor)}</dd>
          </>
        )}
        <dt>{impact.capitalized ? 'Aktiveres (avskrives over år)' : 'Kostnad i resultatet'}</dt>
        <dd>{kr(impact.costToResultMinor)}</dd>
        {impact.taxEffect && (
          <>
            <dt>Anslått redusert skatt ({impact.taxEffect.combinedRateLabel})</dt>
            <dd className="pos">≈ {kr(impact.taxEffect.reducesTaxByMinor)}</dd>
          </>
        )}
      </dl>
      {impact.notes.length > 0 && (
        <ul className="compact hint">
          {impact.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Gmail-import (sandbox) ────────────────────────────────────────────── */

interface ScanCandidate {
  messageId: string;
  from: string;
  subject: string;
  date: string;
  attachments: { filename: string; mimeType: string }[];
  decision: 'import' | 'review';
  confidence: number;
  documentType: string;
  vendorGuess: string | null;
  reason: string;
  source: 'heuristic' | 'ai';
}
interface ScanResult {
  scanned: number;
  candidates: ScanCandidate[];
  skipped: number;
  mode: string;
  aiFilter: boolean;
}

export function GmailScreen({ orgId, onOpenDocument }: { orgId: string; onOpenDocument: (id: string) => void }) {
  const [labels, setLabels] = useState('INBOX');
  const [afterDate, setAfterDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [imported, setImported] = useState<{ documentId: string; filename: string; status: string }[] | null>(null);
  const toast = useToast();

  const labelList = () => labels.split(',').map((l) => l.trim()).filter(Boolean);

  const runScan = async () => {
    setBusy(true);
    setError(null);
    setImported(null);
    try {
      const body: Record<string, unknown> = { labels: labelList() };
      if (afterDate) body['afterDate'] = afterDate;
      const res = await api<ScanResult>('POST', `/api/organizations/${orgId}/gmail/scan`, body);
      setScan(res);
      // forhåndsvelg alt filteret er sikker på (import)
      const pre: Record<string, boolean> = {};
      for (const c of res.candidates) pre[c.messageId] = c.decision === 'import';
      setSelected(pre);
      toast(`Skannet ${res.scanned} e-poster · ${res.candidates.length} mulige bilag`, 'ok');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const importSelected = async () => {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (ids.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { labels: labelList(), messageIds: ids };
      if (afterDate) body['afterDate'] = afterDate;
      const res = await api<{ importedDocuments: { documentId: string; filename: string; status: string }[] }>(
        'POST',
        `/api/organizations/${orgId}/gmail/import-selected`,
        body,
      );
      setImported(res.importedDocuments);
      toast(`${res.importedDocuments.length} bilag hentet inn — klare til kontroll`, 'ok');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div>
      <div className="page-head">
        <h1>Skann e-post</h1>
        <p className="subtitle">
          Reknaren leser innboksen din og finner selv hvilke e-poster som er fakturaer og kvitteringer
          — resten (nyhetsbrev, varsler) lukes ut. Du bekrefter hva som skal hentes inn.
        </p>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="panel">
        <div className="row">
          <div>
            <label htmlFor="labels">Etiketter/mapper</label>
            <input id="labels" value={labels} onChange={(e) => setLabels(e.target.value)} />
          </div>
          <div>
            <label htmlFor="after">Fra dato (valgfritt)</label>
            <input id="after" placeholder="ÅÅÅÅ-MM-DD" value={afterDate} onChange={(e) => setAfterDate(e.target.value)} />
          </div>
          <div>
            <button className="primary" disabled={busy} onClick={runScan}>
              {busy ? 'Skanner…' : 'Skann e-post'}
            </button>
          </div>
        </div>
      </div>

      {scan && (
        <>
          <div className="threshold-head">
            <h2>Fant {scan.candidates.length} mulige bilag</h2>
            <span className="badge accent">
              {scan.aiFilter ? 'Smart AI-filter' : 'Filter'} · {scan.skipped} luket ut
            </span>
          </div>
          {scan.candidates.length === 0 ? (
            <EmptyState icon="📭" title="Ingen bilag funnet" desc="Prøv en annen etikett eller datoperiode." />
          ) : (
            <>
              <div className="actions" style={{ marginTop: 0 }}>
                <button className="primary" disabled={busy || selectedCount === 0} onClick={importSelected}>
                  {busy ? 'Henter inn…' : `Hent inn valgte (${selectedCount})`}
                </button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th></th>
                      <th>Avsender / bilag</th>
                      <th>Reknaren mener</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scan.candidates.map((c) => (
                      <tr key={c.messageId}>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!selected[c.messageId]}
                            onChange={(e) => setSelected((p) => ({ ...p, [c.messageId]: e.target.checked }))}
                            aria-label="Velg bilag"
                          />
                        </td>
                        <td>
                          <div className="primary-line">{c.vendorGuess ?? c.subject}</div>
                          <div className="secondary-line">{c.subject}</div>
                          <div className="secondary-line">{c.attachments.map((a) => a.filename).join(', ')}</div>
                        </td>
                        <td>
                          <span className={`badge ${c.decision === 'import' ? 'ok' : 'accent'}`}>
                            {c.decision === 'import' ? 'Bilag' : 'Usikker'} · {(c.confidence * 100) | 0}%
                          </span>
                          <div className="secondary-line" style={{ maxWidth: 420 }}>
                            {c.reason}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {imported && imported.length > 0 && (
        <>
          <h2>Hentet inn</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fil</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {imported.map((doc) => (
                  <tr
                    key={doc.documentId}
                    className="clickable"
                    tabIndex={0}
                    onClick={() => onOpenDocument(doc.documentId)}
                    onKeyDown={(e) => e.key === 'Enter' && onOpenDocument(doc.documentId)}
                  >
                    <td>{doc.filename}</td>
                    <td>
                      <StatusBadge status={doc.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  interface Account {
    id: string;
    name: string;
    ibanOrAccount: string;
    status: string;
    feedLinked: boolean;
    feedPending: boolean;
  }
  interface Institution {
    id: string;
    name: string;
    bic?: string;
  }
  interface Recon {
    accounts: {
      bankAccountId: string;
      name: string;
      total: number;
      matched: number;
      unmatched: number;
      pendingSuggestions: number;
      done: boolean;
    }[];
    allDone: boolean;
  }
  const accounts = useLoad(() => api<Account[]>('GET', `/api/organizations/${orgId}/bank-accounts`), [orgId]);
  const txs = useLoad(() => api<BankTx[]>('GET', `/api/organizations/${orgId}/bank/transactions`), [orgId]);
  const matches = useLoad(() => api<Match[]>('GET', `/api/organizations/${orgId}/bank/matches`), [orgId]);
  const recon = useLoad(() => api<Recon>('GET', `/api/organizations/${orgId}/bank/reconciliation-status`), [orgId]);
  interface BankCategory {
    key: string;
    label: string;
    direction: 'in' | 'out';
  }
  const cats = useLoad(() => api<BankCategory[]>('GET', `/api/organizations/${orgId}/bank/categories`), [orgId]);
  const [catChoice, setCatChoice] = useState<Record<string, string>>({});
  // Bank-feed: last institusjoner, men fang 503 (feed ikke konfigurert) ærlig.
  const feed = useLoad(async () => {
    try {
      return { available: true, institutions: await api<Institution[]>('GET', `/api/organizations/${orgId}/bank-feed/institutions?country=NO`) };
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) return { available: false, institutions: [] as Institution[] };
      throw err;
    }
  }, [orgId]);
  const toast = useToast();
  const [accountName, setAccountName] = useState('Driftskonto');
  const [accountNo, setAccountNo] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [institutionId, setInstitutionId] = useState('');
  const [csv, setCsv] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const accountList = accounts.data ?? [];
  const bankAccountId = selectedId ?? accountList[0]?.id ?? null;
  const activeAccount = accountList.find((a) => a.id === bankAccountId) ?? null;

  const createAccount = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ id: string }>('POST', `/api/organizations/${orgId}/bank-accounts`, {
        name: accountName,
        ibanOrAccount: accountNo,
      });
      setSelectedId(res.id);
      setAccountNo('');
      await accounts.reload();
      toast('Bankkonto opprettet', 'ok');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const connectBank = async () => {
    if (!bankAccountId || !institutionId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ link: string; requisitionId: string }>(
        'POST',
        `/api/organizations/${orgId}/bank-accounts/${bankAccountId}/feed/connect`,
        { institutionId },
      );
      window.open(res.link, '_blank', 'noopener');
      toast('Logg inn i banken i den nye fanen. Kom tilbake hit og trykk «Fullfør kobling».', 'info');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const completeLink = async () => {
    if (!bankAccountId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ linked: boolean; status: string }>(
        'POST',
        `/api/organizations/${orgId}/bank-accounts/${bankAccountId}/feed/link`,
        {},
      );
      toast(res.linked ? 'Banken er koblet ✓' : `Samtykke ikke fullført (${res.status})`, res.linked ? 'ok' : 'info');
      await accounts.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const syncFeed = async () => {
    if (!bankAccountId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ imported: number; skippedDuplicates: number; fetched: number; suggestions: unknown[] }>(
        'POST',
        `/api/organizations/${orgId}/bank-accounts/${bankAccountId}/feed/sync`,
        {},
      );
      toast(
        `Hentet ${res.fetched} — importerte ${res.imported} (${res.skippedDuplicates} duplikater), ${res.suggestions.length} matchforslag`,
        'ok',
      );
      txs.reload();
      matches.reload();
      recon.reload();
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
      toast(
        `Importerte ${res.imported} transaksjoner (${res.skippedDuplicates} duplikater hoppet over) — ${res.suggestions.length} matchforslag`,
        'ok',
      );
      txs.reload();
      matches.reload();
      recon.reload();
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
        const entry = await api<{ entryNumber: number }>(
          'POST',
          `/api/organizations/${orgId}/bank/matches/${matchId}/approve`,
        );
        toast(`Betaling bokført som bilag nr. ${entry.entryNumber}`, 'ok');
      } else {
        const reason = prompt('Hvorfor avvises treffet?');
        if (!reason) return;
        await api('POST', `/api/organizations/${orgId}/bank/matches/${matchId}/reject`, { reason });
        toast('Treffet ble avvist', 'info');
      }
      txs.reload();
      matches.reload();
      recon.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const categorize = async (txId: string, category: string) => {
    if (!category) return;
    setError(null);
    try {
      const r = await api<{ entryNumber: number }>(
        'POST',
        `/api/organizations/${orgId}/bank/transactions/${txId}/categorize`,
        { category },
      );
      toast(`Bokført som bilag nr. ${r.entryNumber}`, 'ok');
      setCatChoice((prev) => {
        const next = { ...prev };
        delete next[txId];
        return next;
      });
      txs.reload();
      recon.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const openMatches = (matches.data ?? []).filter((m) => m.status === 'suggested');

  return (
    <div>
      <div className="page-head">
        <h1>Bank og avstemming</h1>
        <p className="subtitle">
          Import bokfører aldri noe alene — du godkjenner hvert treff, og forklaringen viser hvorfor
          det ble foreslått.
        </p>
      </div>
      {error && <div className="error">{error}</div>}

      {recon.data &&
        (() => {
          const st = recon.data.accounts.find((a) => a.bankAccountId === bankAccountId);
          if (!st || st.total === 0) return null;
          const pct = st.total > 0 ? Math.round((st.matched / st.total) * 100) : 0;
          const remaining = st.unmatched;
          return (
            <div className={`panel threshold-panel ${st.done ? 'ok' : remaining > 0 ? 'warn' : 'accent'}`}>
              <div className="threshold-head">
                <h2>Bankavstemming</h2>
                <span className={`badge ${st.done ? 'ok' : 'accent'}`}>
                  {st.done ? 'Ferdig ✓' : `${remaining + st.pendingSuggestions} igjen`}
                </span>
              </div>
              {st.done ? (
                <p className="subtitle">
                  Alt som har skjedd i banken er ført i regnskapet. Perioden er avstemt — du er ferdig! 🎉
                </p>
              ) : (
                <>
                  <div className="threshold-bar">
                    <div className={`threshold-fill ${remaining > 0 ? 'warn' : 'ok'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="threshold-nums">
                    <strong>
                      {st.matched} av {st.total}
                    </strong>{' '}
                    transaksjoner avstemt · {pct}%
                  </div>
                  <p className="subtitle">
                    {remaining > 0 && `${remaining} transaksjon${remaining > 1 ? 'er' : ''} er ikke avstemt ennå. `}
                    {st.pendingSuggestions > 0 &&
                      `${st.pendingSuggestions} forslag venter på din godkjenning nedenfor. `}
                    Når alt er koblet og bekreftet, sier vi ifra at du er ferdig.
                  </p>
                </>
              )}
            </div>
          );
        })()}

      <div className="panel">
        <h2>Bankkontoer</h2>
        <div className="row">
          {accountList.length > 0 && (
            <div>
              <label htmlFor="bacc">Aktiv konto</label>
              <select id="bacc" value={bankAccountId ?? ''} onChange={(e) => setSelectedId(e.target.value)}>
                {accountList.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.ibanOrAccount}
                    {a.feedLinked ? ' — tilkoblet' : a.feedPending ? ' — venter fullføring' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="bn">Nytt kontonavn</label>
            <input id="bn" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="ba">Kontonummer/IBAN</label>
            <input id="ba" value={accountNo} onChange={(e) => setAccountNo(e.target.value)} />
          </div>
          <div>
            <button className="primary" disabled={busy || !accountNo} onClick={createAccount}>
              Legg til konto
            </button>
          </div>
        </div>
      </div>

      {bankAccountId && feed.data?.available && (
        <div className="panel">
          <h2>Automatisk bank-feed (PSD2)</h2>
          {activeAccount?.feedLinked ? (
            <>
              <p className="subtitle">
                Denne kontoen er koblet til banken. Hent nye transaksjoner — de kjøres gjennom samme
                avstemming og godkjenning som import.
              </p>
              <div className="actions">
                <button className="primary" disabled={busy} onClick={syncFeed}>
                  {busy ? 'Henter…' : 'Synk nå'}
                </button>
              </div>
            </>
          ) : activeAccount?.feedPending ? (
            <>
              <p className="subtitle">
                Samtykke mottatt fra banken. Trykk «Fullfør kobling» for å lagre koblingen, så kan du synke.
              </p>
              <div className="actions">
                <button className="primary" disabled={busy} onClick={completeLink}>
                  {busy ? 'Fullfører…' : 'Fullfør kobling'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="subtitle">
                Velg banken din, logg inn og gi samtykke — så henter Reknaren transaksjonene automatisk.
                Ingenting bokføres uten din godkjenning.
              </p>
              <div className="row">
                <div>
                  <label htmlFor="inst">Bank</label>
                  <select id="inst" value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}>
                    <option value="">Velg bank…</option>
                    {(feed.data?.institutions ?? []).map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                        {i.bic ? ` (${i.bic})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <button className="primary" disabled={busy || !institutionId} onClick={connectBank}>
                    Koble bank
                  </button>
                </div>
                <div>
                  <button disabled={busy} onClick={completeLink} title="Trykk her etter at du har logget inn i banken">
                    Fullfør kobling
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {bankAccountId && feed.data && !feed.data.available && (
        <div className="panel">
          <h2>Automatisk bank-feed</h2>
          <p className="subtitle">
            Automatisk banktilkobling (PSD2) er ikke aktivert i dette miljøet. Du kan importere
            kontoutskrift som CSV under.
          </p>
        </div>
      )}

      {bankAccountId && (
        <div className="panel">
          <h2>Importer kontoutskrift (CSV)</h2>
          <p className="subtitle">Format: Dato;Beskrivelse;Beløp;Motpart;KID;Referanse</p>
          <textarea rows={6} value={csv} onChange={(e) => setCsv(e.target.value)} aria-label="CSV-innhold" />
          <div className="actions">
            <button className="primary" disabled={busy || !csv} onClick={importCsv}>
              {busy ? 'Importerer…' : 'Importer og finn treff'}
            </button>
          </div>
        </div>
      )}

      <h2>Matchforslag</h2>
      {matches.loading ? (
        <TableSkeleton rows={2} />
      ) : openMatches.length === 0 ? (
        <EmptyState
          icon="🔗"
          title="Ingen åpne forslag"
          desc="Når en betaling ligner på et bokført bilag (KID, beløp og dato), foreslår vi koblingen her."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="num">Beløp</th>
                <th>Hvorfor foreslått</th>
                <th>Type</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {openMatches.map((m) => (
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
        </div>
      )}

      <h2>Transaksjoner</h2>
      {txs.loading ? (
        <TableSkeleton rows={4} />
      ) : (txs.data ?? []).length === 0 ? (
        <EmptyState
          icon="🏦"
          title="Ingen transaksjoner importert"
          desc="Opprett en bankkonto og importer kontoutskriften for å komme i gang med avstemming."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dato</th>
                <th>Beskrivelse</th>
                <th className="num">Beløp</th>
                <th>Status</th>
                <th>Kategoriser (uten bilag)</th>
              </tr>
            </thead>
            <tbody>
              {(txs.data ?? []).map((t) => {
                const dir = BigInt(t.amount_minor) >= 0n ? 'in' : 'out';
                const options = (cats.data ?? []).filter((c) => c.direction === dir);
                return (
                  <tr key={t.id}>
                    <td>{t.booked_date}</td>
                    <td>
                      <div className="primary-line">{t.description}</div>
                      {t.counterparty && <div className="secondary-line">{t.counterparty}</div>}
                    </td>
                    <td className="num">{kr(t.amount_minor)}</td>
                    <td>
                      <StatusBadge status={t.status} />
                    </td>
                    <td>
                      {t.status === 'unmatched' ? (
                        <div className="actions" style={{ marginTop: 0 }}>
                          <select
                            value={catChoice[t.id] ?? ''}
                            onChange={(e) => setCatChoice((p) => ({ ...p, [t.id]: e.target.value }))}
                            aria-label="Velg kategori"
                          >
                            <option value="">Velg …</option>
                            {options.map((c) => (
                              <option key={c.key} value={c.key}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                          <button
                            className="primary"
                            disabled={!catChoice[t.id]}
                            onClick={() => categorize(t.id, catChoice[t.id] ?? '')}
                          >
                            Bokfør
                          </button>
                        </div>
                      ) : (
                        <span className="secondary-line">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Rapporter ─────────────────────────────────────────────────────────── */

export function ReportsScreen({ orgId }: { orgId: string }) {
  const defaults = thisYear();
  const [saftFrom, setSaftFrom] = useState(defaults.from);
  const [saftTo, setSaftTo] = useState(defaults.to);
  const [saftBusy, setSaftBusy] = useState(false);
  const toast = useToast();

  const downloadSafT = async () => {
    setSaftBusy(true);
    try {
      const res = await fetch(
        `/api/organizations/${orgId}/saf-t?from=${saftFrom}&to=${saftTo}`,
        { headers: { authorization: `Bearer ${sessionStorage.getItem('reknaren.token')}` } },
      );
      if (!res.ok) throw new Error(`Eksporten feilet (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `saf-t_${saftFrom}_${saftTo}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      toast('SAF-T-fil lastet ned', 'ok');
    } catch (err) {
      toast((err as Error).message, 'danger');
    } finally {
      setSaftBusy(false);
    }
  };
  interface Pnl {
    revenueMinor: string;
    expenseMinor: string;
    resultMinor: string;
  }
  interface TbRow {
    accountNumber: string;
    accountName: string;
    debitMinor: string;
    creditMinor: string;
    balanceMinor: string;
  }
  const lib = useCodeLibrary(orgId);
  const pnl = useLoad(() => api<Pnl>('GET', `/api/organizations/${orgId}/reports/income-statement`), [orgId]);
  const tb = useLoad(() => api<TbRow[]>('GET', `/api/organizations/${orgId}/reports/trial-balance`), [orgId]);

  return (
    <div>
      <div className="page-head">
        <h1>Rapporter</h1>
        <p className="subtitle">Alle tall kommer fra hovedboken — aldri fra AI.</p>
      </div>
      {pnl.loading ? (
        <div className="cards">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
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
      )}
      <div className="panel">
        <h2>SAF-T-eksport</h2>
        <p className="subtitle">
          Standardformatet Skatteetaten ber om ved bokettersyn. Filen valideres mot offisielt
          skjema, og hver eksport logges i revisjonsloggen.
        </p>
        <div className="row" style={{ maxWidth: 560 }}>
          <div>
            <label htmlFor="sfrom">Fra</label>
            <input id="sfrom" value={saftFrom} onChange={(e) => setSaftFrom(e.target.value)} />
          </div>
          <div>
            <label htmlFor="sto">Til</label>
            <input id="sto" value={saftTo} onChange={(e) => setSaftTo(e.target.value)} />
          </div>
          <div>
            <button className="secondary" disabled={saftBusy} onClick={downloadSafT}>
              {saftBusy ? 'Genererer…' : 'Last ned SAF-T (XML)'}
            </button>
          </div>
        </div>
      </div>

      <h2>Saldobalanse</h2>
      {tb.error && <div className="error">{tb.error}</div>}
      {tb.loading ? (
        <TableSkeleton rows={6} />
      ) : (tb.data ?? []).length === 0 ? (
        <EmptyState
          icon="📊"
          title="Ingen bokførte posteringer ennå"
          desc="Når du godkjenner ditt første bilag, dukker tallene opp her — med komplett spor tilbake til dokumentet."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Konto</th>
                <th className="num">Debet</th>
                <th className="num">Kredit</th>
                <th className="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {(tb.data ?? []).map((r) => (
                <tr key={r.accountNumber}>
                  <td>
                    <div className="primary-line">
                      {lib.account(r.accountNumber)?.friendlyName ?? r.accountName}
                    </div>
                    <div className="secondary-line">
                      {r.accountNumber} · {r.accountName}
                    </div>
                  </td>
                  <td className="num">{kr(r.debitMinor)}</td>
                  <td className="num">{kr(r.creditMinor)}</td>
                  <td className="num">{kr(r.balanceMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
  interface Threshold {
    taxableTurnoverMinor: string;
    thresholdMinor: string;
    remainingMinor: string;
    pct: number;
    crossed: boolean;
    windowFrom: string;
    asOf: string;
    vatStatus: string;
    altinnActive: boolean;
  }
  const threshold = useLoad(() => api<Threshold>('GET', `/api/organizations/${orgId}/vat/threshold`), [orgId]);
  const [meldBusy, setMeldBusy] = useState(false);
  const [meldMsg, setMeldMsg] = useState<string | null>(null);
  const meldToast = useToast();

  const downloadMvaMelding = async () => {
    setMeldMsg(null);
    try {
      const res = await fetch(`/api/organizations/${orgId}/vat/mva-melding/xml?from=${from}&to=${to}`, {
        headers: { authorization: `Bearer ${sessionStorage.getItem('reknaren.token')}` },
      });
      if (!res.ok) throw new Error('Klarte ikke å lage MVA-meldingen.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mva-melding_${from}_${to}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMeldMsg((err as Error).message);
    }
  };

  const validateMvaMelding = async () => {
    setMeldBusy(true);
    setMeldMsg(null);
    try {
      const res = await api<{ valid: boolean; messages: string[] }>(
        'POST',
        `/api/organizations/${orgId}/vat/mva-melding/validate`,
        { from, to },
      );
      if (res.valid) meldToast('MVA-meldingen er gyldig hos Skatteetaten ✓', 'ok');
      else setMeldMsg(`Skatteetaten fant ${res.messages.length} merknad(er): ${res.messages.slice(0, 5).join(' · ')}`);
    } catch (err) {
      setMeldMsg((err as Error).message);
    } finally {
      setMeldBusy(false);
    }
  };

  const r = report.data;
  return (
    <div>
      <div className="page-head">
        <h1>MVA</h1>
        <p className="subtitle">
          Foreløpig oversikt for valgt periode. Innsending til Skatteetaten krever egen
          signeringshandling og er ikke aktivert ennå.
        </p>
      </div>

      {threshold.data && (() => {
        const t = threshold.data;
        const registered = t.vatStatus === 'registered';
        const pct = Math.min(100, t.pct);
        const kind = registered ? 'ok' : t.crossed ? 'danger' : t.pct >= 75 ? 'warn' : 'accent';
        const headline = registered
          ? 'Virksomheten er MVA-registrert'
          : t.crossed
            ? 'Registreringsplikt inntruffet'
            : t.pct >= 75
              ? 'Nærmer deg terskelen'
              : 'Under registreringsterskelen';
        const body = registered
          ? 'Du fører utgående mva på salg og sender MVA-melding. Terskelen er ikke lenger relevant.'
          : t.crossed
            ? `Du har passert 50 000 kr avgiftspliktig omsetning siste 12 måneder. Du er pliktig å registrere virksomheten i MVA-registeret (Samordnet registermelding i Altinn) og beregne mva fra og med det salget som brakte deg over.`
            : `${kr(t.remainingMinor)} igjen til registreringsplikt (50 000 kr avgiftspliktig omsetning siste 12 mnd). Du kan også registrere deg frivillig.`;
        return (
          <div className={`panel threshold-panel ${kind}`}>
            <div className="threshold-head">
              <h2>MVA-registreringsterskel</h2>
              <span className={`badge ${kind}`}>{headline}</span>
            </div>
            <div className="threshold-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className={`threshold-fill ${kind}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="threshold-nums">
              <strong>{kr(t.taxableTurnoverMinor)}</strong> av {kr(t.thresholdMinor)} · {t.pct}%
              <span className="threshold-window"> (siden {t.windowFrom})</span>
            </div>
            <p className="subtitle">{body}</p>
            {!registered && (
              <p className="hint">
                Vi summerer salgsinntekt (konto 3000–3799) siste 12 måneder. Terskelen gjelder
                avgiftspliktig omsetning — er noe av salget unntatt mva (helse, undervisning, finans),
                teller det ikke med.
              </p>
            )}
          </div>
        );
      })()}
      <div className="row" style={{ maxWidth: 460 }}>
        <div>
          <label htmlFor="vfrom">Fra</label>
          <input id="vfrom" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label htmlFor="vto">Til</label>
          <input id="vto" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="panel">
        <div className="threshold-head">
          <h2>MVA-melding</h2>
          <span className={`badge ${threshold.data?.altinnActive ? 'ok' : 'neutral plain'}`}>
            {threshold.data?.altinnActive ? 'Innsending aktiv' : 'Innsending ikke aktivert'}
          </span>
        </div>
        <p className="subtitle">
          Meldingen bygges automatisk fra tallene i valgt periode, i Skatteetatens format.
        </p>
        {meldMsg && <div className="error">{meldMsg}</div>}
        <div className="actions">
          <button onClick={downloadMvaMelding}>Last ned MVA-melding (XML)</button>
          {threshold.data?.altinnActive ? (
            <button className="primary" disabled={meldBusy} onClick={validateMvaMelding}>
              {meldBusy ? 'Validerer…' : 'Valider hos Skatteetaten'}
            </button>
          ) : null}
        </div>
        {!threshold.data?.altinnActive && (
          <p className="hint">
            Automatisk innsending og validering aktiveres når Maskinporten-tilgangen fra Skatteetaten er
            på plass. I mellomtiden kan du laste ned XML-en og laste den opp i Altinn.
          </p>
        )}
      </div>

      {report.error && <div className="error">{report.error}</div>}
      {report.loading ? (
        <div className="cards">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        r && (
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
                <div className="value">
                  {kr(BigInt(r.netPayableMinor) < 0n ? (-BigInt(r.netPayableMinor)).toString() : r.netPayableMinor)}
                </div>
                <div className="hint">
                  Status: <span className="badge neutral plain">Kladd</span>
                </div>
              </div>
            </div>
            {r.warnings.length > 0 && (
              <div className="notice">
                <ul className="compact">
                  {r.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            <h2>Per MVA-kode</h2>
            {r.lines.length === 0 ? (
              <EmptyState
                icon="％"
                title="Ingen MVA-bevegelser i perioden"
                desc="Bokfør bilag med MVA-koder, så bygges spesifikasjonen opp her — sporbar tilbake til hver postering."
              />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Kode</th>
                      <th>Beskrivelse</th>
                      <th className="num">Grunnlag</th>
                      <th className="num">MVA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.lines.map((line) => (
                      <tr key={line.vatCode}>
                        <td className="num">{line.vatCode}</td>
                        <td>{line.name}</td>
                        <td className="num">{kr(line.baseMinor)}</td>
                        <td className="num">{kr(line.vatMinor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}

/* ── Skatt og reserver ─────────────────────────────────────────────────── */

/* ── Importer fra Fiken (SAF-T) ─────────────────────────────────────────── */

interface SaftParty {
  name: string;
  orgNumber: string | null;
  closingMinor: string;
}
interface SaftPreview {
  company: string | null;
  companyOrgNumber: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  software: string | null;
  counts: { accounts: number; customers: number; suppliers: number };
  totalDebitMinor: string;
  totalCreditMinor: string;
  balanced: boolean;
  accountsSample: { number: string; name: string; closingMinor: string }[];
  customers: SaftParty[];
  suppliers: SaftParty[];
}

export function SaftImportScreen({ orgId }: { orgId: string }) {
  const [preview, setPreview] = useState<SaftPreview | null>(null);
  const [xml, setXml] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [asOfDate, setAsOfDate] = useState('');
  const [imported, setImported] = useState<{ entryNumber: number; accountsEnsured: number; customersCreated: number; suppliersCreated: number; openingLines: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setBusy(true);
    setError(null);
    setPreview(null);
    setImported(null);
    try {
      const content = await f.text();
      const p = await api<SaftPreview>('POST', `/api/organizations/${orgId}/saft-import/preview`, { xml: content });
      setPreview(p);
      setXml(content);
      if (p.periodEnd) setAsOfDate(p.periodEnd);
      toast('Fila ble lest ✓', 'ok');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const bookOpening = async () => {
    if (!xml || !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
      setError('Velg en gyldig dato (ÅÅÅÅ-MM-DD) for åpningsbalansen.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<NonNullable<typeof imported>>('POST', `/api/organizations/${orgId}/saft-import`, {
        xml,
        asOfDate,
      });
      setImported(res);
      toast(`Åpningsbalanse bokført som bilag nr. ${res.entryNumber} ✓`, 'ok');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>Importer fra Fiken</h1>
        <p className="subtitle">
          Flytt regnskapet uten å slette noe hos Fiken. Eksporter en SAF-T-fil i Fiken (Regnskap →
          eksport → SAF-T) — den er gratis og inneholder hele regnskapet — og last den opp her.
        </p>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="panel">
        <h2>1. Last opp SAF-T-fila</h2>
        <p className="subtitle">Vi leser fila og viser deg hva som finnes før noe importeres.</p>
        <input type="file" accept=".xml,text/xml,application/xml" onChange={onFile} disabled={busy} aria-label="SAF-T-fil" />
        {fileName && <p className="hint">Valgt fil: {fileName}</p>}
        {busy && <p className="hint">Leser fila …</p>}
      </div>

      {preview && (
        <>
          <div className="panel threshold-panel">
            <div className="threshold-head">
              <h2>2. Forhåndsvisning</h2>
              <span className={`badge ${preview.balanced ? 'ok' : 'accent'}`}>
                {preview.balanced ? 'Balanserer ✓' : 'Balanserer ikke'}
              </span>
            </div>
            <p className="subtitle">
              {preview.company ?? 'Ukjent virksomhet'}
              {preview.companyOrgNumber ? ` · ${preview.companyOrgNumber}` : ''}
              {preview.software ? ` · fra ${preview.software}` : ''}
              {preview.periodStart ? ` · periode ${preview.periodStart}–${preview.periodEnd}` : ''}
            </p>
            <div className="cards">
              <div className="card">
                <div className="label">Kontoer</div>
                <div className="value">{preview.counts.accounts}</div>
              </div>
              <div className="card">
                <div className="label">Kunder</div>
                <div className="value">{preview.counts.customers}</div>
              </div>
              <div className="card">
                <div className="label">Leverandører</div>
                <div className="value">{preview.counts.suppliers}</div>
              </div>
              <div className="card">
                <div className="label">Sum debet / kredit</div>
                <div className="value">{kr(preview.totalDebitMinor)}</div>
                <div className="hint">Kredit: {kr(preview.totalCreditMinor)}</div>
              </div>
            </div>
          </div>

          {imported ? (
            <div className="panel threshold-panel ok">
              <div className="threshold-head">
                <h2>Åpningsbalanse bokført ✓</h2>
                <span className="badge ok">Bilag nr. {imported.entryNumber}</span>
              </div>
              <p className="subtitle">
                {imported.openingLines} kontosaldoer ført · {imported.accountsEnsured} nye kontoer opprettet ·{' '}
                {imported.customersCreated} kunder · {imported.suppliersCreated} leverandører. Regnskapet i
                Reknaren starter nå fra Fiken-tallene dine.
              </p>
            </div>
          ) : (
            preview.balanced && (
              <div className="panel">
                <h2>3. Bokfør åpningsbalanse</h2>
                <p className="subtitle">
                  Vi fører saldoene over som én åpningspostering på datoen du velger. Du kan ikke føre
                  samme dato to ganger. Kontoer som mangler opprettes automatisk.
                </p>
                <div className="row">
                  <div>
                    <label htmlFor="asof">Åpningsdato</label>
                    <input id="asof" placeholder="ÅÅÅÅ-MM-DD" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
                  </div>
                  <div>
                    <button className="primary" disabled={busy} onClick={bookOpening}>
                      {busy ? 'Bokfører…' : 'Bokfør åpningsbalanse'}
                    </button>
                  </div>
                </div>
              </div>
            )
          )}

          <h2>Kontoplan med saldo</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Konto</th>
                  <th>Navn</th>
                  <th className="num">Sluttsaldo</th>
                </tr>
              </thead>
              <tbody>
                {preview.accountsSample
                  .filter((a) => a.closingMinor !== '0')
                  .map((a) => (
                    <tr key={a.number}>
                      <td>{a.number}</td>
                      <td>{a.name}</td>
                      <td className="num">{kr(a.closingMinor)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {preview.customers.length > 0 && (
            <>
              <h2>Kunder</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Navn</th>
                      <th>Org.nr</th>
                      <th className="num">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.customers.map((c, i) => (
                      <tr key={i}>
                        <td>{c.name}</td>
                        <td>{c.orgNumber ?? '–'}</td>
                        <td className="num">{kr(c.closingMinor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export function TaxScreen({ orgId }: { orgId: string }) {
  const defaults = thisYear();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  interface Estimate {
    accountingResultMinor: string;
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
      <div className="page-head">
        <h1>Skatt og reserver</h1>
        <p className="subtitle">Et løpende estimat — ikke en garanti. Forutsetningene står nederst.</p>
      </div>
      <div className="row" style={{ maxWidth: 460 }}>
        <div>
          <label htmlFor="tfrom">Fra</label>
          <input id="tfrom" value={from} onChange={(e2) => setFrom(e2.target.value)} />
        </div>
        <div>
          <label htmlFor="tto">Til</label>
          <input id="tto" value={to} onChange={(e2) => setTo(e2.target.value)} />
        </div>
      </div>
      {est.error && <div className="error">{est.error}</div>}
      {est.loading ? (
        <div className="cards">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        e && (
          <>
            <div className="cards">
              <div className="card">
                <div className="label">Resultat i perioden</div>
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
            <div className="table-wrap">
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
                        <span className="badge neutral plain">
                          {c.ruleId} v{c.ruleVersion}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
        )
      )}
    </div>
  );
}
