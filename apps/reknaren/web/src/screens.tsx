import { useState } from 'react';
import { useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { api, ApiError, authHeaders, kr, loadCodeLibrary, type AccountInfo, type VatCodeInfo } from './api';
import { useLoad, type ViewMode } from './App';
import { DimensionSelect } from './screens-dimensions';
import { PostingLines } from './screens-pro';
import { CardSkeleton, Disclosure, EmptyState, Modal, StatusBadge, TableSkeleton, useToast } from './ui';

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
    version: number | null;
    lastReviewed: string;
    sources: { title: string; url: string; lastVerified: string }[];
  }[];
  impact: DocumentImpact | null;
  assessedBy?: { suggestionEngine: string; extractionEngine: string | null; aiModel: string | null };
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

interface BookkeepingError {
  code: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  detail: string;
  entryNumber?: number;
  documentId?: string;
  actionLabel: string;
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
  const dash = useLoad(() => api<Dashboard>('GET', `/api/organizations/${orgId}/dashboard`), [orgId]);
  const d = dash.data;
  const go = (s: string) => onNavigate?.(s);
  return (
    <div>
      <div className="page-head">
        <h1>Oversikt</h1>
        <p className="subtitle">Alt på ett sted — hva som er bra, og hva som trenger deg.</p>
      </div>
      {dash.error && <div className="error">{dash.error}</div>}
      {dash.loading || !d ? (
        <>
          <div className="panel"><TableSkeleton /></div>
          <div className="tile-grid">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="tile"><CardSkeleton /></div>)}</div>
        </>
      ) : (
        <>
          {/* Hero: månedsavslutning — den løpende statusen */}
          <div className="panel hero clickable" onClick={() => go('period-close')} role="button" tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && go('period-close')}>
            <div className="panel-head">
              <h2>{d.monthClose.monthName} — avstemming</h2>
              <span className={`confidence ${d.monthClose.blockerCount > 0 ? 'low' : d.monthClose.readinessPct >= 80 ? 'high' : 'medium'}`}>
                {d.monthClose.ready ? 'Klar til å låses' : `${d.monthClose.readinessPct} % ferdig`}
              </span>
            </div>
            <div className="progress">
              <div className={`progress-fill${d.monthClose.readinessPct >= 80 ? ' ok' : d.monthClose.readinessPct >= 50 ? ' warn' : ' low'}`} style={{ width: `${d.monthClose.readinessPct}%` }} />
            </div>
            <p className="subtitle" style={{ marginTop: 10, marginBottom: 0 }}>{d.monthClose.summary}</p>
          </div>

          {/* Signal-fliser — glanseløst overblikk, hver lenker til sin fane */}
          <div className="tile-grid">
            <Tile label="Likviditet 90 dager" value={kr(d.liquidity.endBalanceMinor)}
              sub={`laveste ${kr(d.liquidity.lowestBalanceMinor)}`} tone={d.liquidity.goesNegative ? 'alert' : 'ok'} onClick={() => go('planning')} />
            <Tile label="Dokumentjakt" value={`${d.documentHunt.gapsWithCandidates} treff`}
              sub={`${d.documentHunt.paymentsMissingDoc} betaling${d.documentHunt.paymentsMissingDoc === 1 ? '' : 'er'} uten bilag`}
              tone={d.documentHunt.gapsWithCandidates > 0 ? 'attention' : 'plain'} onClick={() => go('bank')} />
            <Tile label="Svindelkontroll" value={d.fraud.active === 0 ? 'Ingen varsler' : `${d.fraud.active} varsler`}
              sub={d.fraud.critical + d.fraud.high > 0 ? `${d.fraud.critical} kritiske · ${d.fraud.high} høye` : 'ingen alvorlige'}
              tone={d.fraud.critical > 0 ? 'alert' : d.fraud.high > 0 ? 'attention' : 'ok'} onClick={() => go('fraud')} />
            <Tile label="Faste utgifter" value={d.recurring.overdue === 0 ? 'à jour' : `${d.recurring.overdue} mangler`}
              sub={d.recurring.overdue > 0 ? `~${kr(d.recurring.overdueAmountMinor)} ubokført` : 'ingen uteblitte'}
              tone={d.recurring.overdue > 0 ? 'alert' : 'ok'} onClick={() => go('recurring')} />
            <Tile label="Skatteassistent" value={`${d.advisories.total} funn`}
              sub={`${d.advisories.risiko} risiko · ${d.advisories.mulighet} muligheter`}
              tone={d.advisories.risiko > 0 ? 'attention' : 'plain'} onClick={() => go('assistant')} />
            <Tile label="Sett av til skatt" value={kr(d.taxReserveMinor)}
              sub={`neste MVA-forfall ${nb(d.vat.dueDate)}`} tone="plain" onClick={() => go('tax')} />
            <Tile label="Bilag til behandling" value={String(d.counts.documentsWaiting)}
              sub="venter på godkjenning" tone={d.counts.documentsWaiting > 0 ? 'attention' : 'ok'} onClick={() => go('documents')} />
            <Tile label="Uavstemt bank" value={String(d.counts.bankUnmatched)}
              sub="betalinger uten kobling" tone={d.counts.bankUnmatched > 0 ? 'attention' : 'ok'} onClick={() => go('bank')} />
          </div>

          {/* Én samlet handlingsliste */}
          <div className="panel">
            <div className="panel-head">
              <h2>Å følge opp</h2>
              {d.followUp.length === 0 ? <span className="confidence high">Alt ser bra ut ✓</span> : <span className="confidence medium">{d.followUp.length}</span>}
            </div>
            {d.followUp.length === 0 ? (
              <p className="subtitle">Vi fant ingenting som haster. Vi kontrollerer regnskapet løpende, så du kan slappe av.</p>
            ) : (
              <ul className="health-list">
                {d.followUp.map((f) => (
                  <li key={f.id} className={`health-item ${f.severity}`}>
                    <div className="health-dot" aria-hidden="true" />
                    <div className="health-body">
                      <div className="health-title">{f.title}</div>
                      <div className="health-detail">{f.detail}</div>
                    </div>
                    {(f.documentId || f.actionScreen) && (
                      <button className="secondary health-action" onClick={() => (f.documentId ? onOpenDocument(f.documentId) : go(f.actionScreen!))}>
                        Åpne
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface Dashboard {
  monthClose: { monthName: string; readinessPct: number; ready: boolean; summary: string; blockerCount: number };
  liquidity: { cashNowMinor: string; endBalanceMinor: string; lowestBalanceMinor: string; goesNegative: boolean };
  vat: { netPayableMinor: string; dueDate: string };
  taxReserveMinor: string;
  advisories: { risiko: number; mulighet: number; kontrollpunkt: number; total: number };
  documentHunt: { paymentsMissingDoc: number; gapsWithCandidates: number };
  fraud: { active: number; critical: number; high: number; dismissed: number };
  recurring: { overdue: number; overdueAmountMinor: string };
  counts: { documentsWaiting: number; bankUnmatched: number };
  followUp: { id: string; severity: string; title: string; detail: string; actionScreen?: string; documentId?: string }[];
}

function Tile({ label, value, sub, tone, onClick }: { label: string; value: string; sub?: string; tone: 'ok' | 'attention' | 'alert' | 'plain'; onClick: () => void }) {
  return (
    <button className={`tile ${tone}`} onClick={onClick}>
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {sub && <div className="tile-sub">{sub}</div>}
    </button>
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
      extraction_engine: string | null;
    } | null;
    suggestions: {
      id: string;
      suggestion: Suggestion;
      engine: string;
      status: string;
      decided_at: string | null;
      decided_by_name: string | null;
      decided_by_email: string | null;
      decision_note: string | null;
    }[];
    explanation: Explanation | null;
    history: HistoryEvent[];
    fxRate: { currency: string; rateDecimal: string; forDate: string; source: string } | null;
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
  const [rateSource, setRateSource] = useState('manuell (bruker)');
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState<{ entryNumber: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const fx = detail.data?.fxRate ?? null;
  // Forhåndsutfyll Norges Bank-kursen når bilaget er i fremmed valuta.
  useEffect(() => {
    if (fx && !rate) {
      setRate(fx.rateDecimal);
      setRateSource(fx.source);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fx?.rateDecimal]);

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
  // Inline-nudge: ser leverandøren på bilaget gjentakende ut? (fyres når bilaget er postert/kan matches)
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [nudgeBusy, setNudgeBusy] = useState(false);
  const hint = useLoad(
    () =>
      api<{ looksRecurring: boolean; alreadyTracked: boolean; reason: string; vendorId: string | null }>(
        'GET',
        `/api/organizations/${orgId}/documents/${documentId}/recurring-hint`,
      ),
    [orgId, documentId, isPosted, posted?.entryNumber],
  );
  const addRecurring = async () => {
    setNudgeBusy(true);
    try {
      await api('POST', `/api/organizations/${orgId}/documents/${documentId}/recurring`, {});
      toast('Lagt til i faste utgifter — vaktposten følger den nå', 'ok');
      setNudgeDismissed(true);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Kunne ikke legge til', 'danger');
    } finally {
      setNudgeBusy(false);
    }
  };

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
      if (needsRate) body['exchangeRate'] = { rateDecimal: rate, source: rateSource };
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
          <div className="panel-head">
            <h2>Hva vi fant i dokumentet</h2>
            <ExtractionBadge engine={d.extraction.extraction_engine} />
          </div>
          {d.extraction.extraction_engine?.startsWith('claude') && (
            <p className="subtitle">Lest av kunstig intelligens — kontroller at tallene stemmer før du godkjenner.</p>
          )}
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

      {hint.data?.looksRecurring && !hint.data.alreadyTracked && !nudgeDismissed && (
        <div className="panel">
          <div className="health-title">🔁 Gjentakende betaling?</div>
          <p className="hint" style={{ marginTop: 4 }}>{hint.data.reason}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={nudgeBusy} onClick={addRecurring}>Ja, legg til i faste utgifter</button>
            <button className="secondary" disabled={nudgeBusy} onClick={() => setNudgeDismissed(true)}>Ikke nå</button>
          </div>
        </div>
      )}

      {suggestion && d && d.document.status !== 'posted' && (
        <div className="panel">
          <div className="panel-head">
            <h2>Vårt forslag</h2>
            <ConfidenceBadge confidence={suggestion.suggestion.confidence} />
          </div>
          <p className="subtitle">
            {suggestion.engine?.startsWith('ai')
              ? 'Forslag fra kunstig intelligens'
              : 'Regelbasert forslag'}{' '}
            — konto og MVA-kode må godkjennes av deg før bokføring.
          </p>
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
                        <em>{r.shortName}</em>
                        {r.version !== null && <span className="code">regelversjon {r.version}</span>}: {r.plainExplanation}{' '}
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
                  <dt>Vurdert av</dt>
                  <dd>
                    {d.explanation.assessedBy?.suggestionEngine?.startsWith('ai') ? 'KI-forslag' : 'Regelmotor'}
                    {d.explanation.assessedBy?.aiModel && (
                      <span className="code">lest av {d.explanation.assessedBy.aiModel}</span>
                    )}
                    {!d.explanation.assessedBy?.aiModel && d.explanation.assessedBy?.extractionEngine && (
                      <span className="code">{d.explanation.assessedBy.extractionEngine}</span>
                    )}
                  </dd>
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
                <input id="rate" placeholder="f.eks. 11.50" value={rate} onChange={(e) => { setRate(e.target.value); setRateSource('manuell (bruker)'); }} />
                {fx && (
                  <div className="hint" style={{ marginTop: 4 }}>Norges Bank-kurs for {fx.forDate} · kilde lagres på posteringen. Du kan overstyre.</div>
                )}
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

/** KI-transparens: hvordan dokumentet ble lest. */
function ExtractionBadge({ engine }: { engine: string | null }) {
  const ai = engine?.startsWith('claude');
  const ocr = engine?.includes('ocr') || engine?.includes('tesseract');
  const label = ai ? 'Lest av KI (Claude)' : ocr ? 'Lest med OCR' : 'Lest fra tekst';
  return (
    <span className={`confidence ${ai ? 'medium' : 'high'}`} title="Hvordan bilaget ble tolket">
      {label}
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

export function BankScreen({ orgId, onOpenDocument, onNavigate }: { orgId: string; onOpenDocument?: (id: string) => void; onNavigate?: (s: string) => void }) {
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

      {onOpenDocument && (
        <DocumentHuntScreen orgId={orgId} onOpenDocument={onOpenDocument} onNavigate={onNavigate} embedded />
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

interface ReplayPreview {
  periodStart: string | null;
  periodEnd: string | null;
  transactionCount: number;
  lineCount: number;
  unbalancedCount: number;
  suppliers: number;
  customers: number;
}
interface ReplayResult {
  periodStart: string | null;
  periodEnd: string | null;
  openingEntryNumber: number | null;
  accountsEnsured: number;
  suppliersCreated: number;
  customersCreated: number;
  transactionsPosted: number;
  transactionsSkipped: number;
  linesPosted: number;
  unbalanced: string[];
}

export function SaftImportScreen({ orgId }: { orgId: string }) {
  const [preview, setPreview] = useState<SaftPreview | null>(null);
  const [xml, setXml] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [asOfDate, setAsOfDate] = useState('');
  const [imported, setImported] = useState<{ entryNumber: number; accountsEnsured: number; customersCreated: number; suppliersCreated: number; openingLines: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replayPreview, setReplayPreview] = useState<ReplayPreview | null>(null);
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);
  const [progress, setProgress] = useState<{ posted: number; total: number; company: string | null; periodStart: string | null; periodEnd: string | null; includeOpening: boolean } | null>(null);
  const toast = useToast();

  // Full historikk via strømmende import (SSE) — gir ekte framdrift i %.
  const importFull = async () => {
    if (!xml) return;
    setError(null); setReplayResult(null); setProgress(null); setBusy(true);
    try {
      const resp = await fetch(`/api/organizations/${orgId}/saft-import/replay/stream`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ xml }),
      });
      if (!resp.ok || !resp.body) throw new Error('Kunne ikke starte importen.');
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const line = buf.slice(0, i);
          buf = buf.slice(i + 2);
          if (!line.startsWith('data: ')) continue;
          const ev = JSON.parse(line.slice(6));
          if (ev.phase === 'start') setProgress({ posted: 0, total: 0, company: ev.company, periodStart: ev.periodStart, periodEnd: ev.periodEnd, includeOpening: ev.includeOpening });
          else if (ev.phase === 'posting') setProgress((p) => (p ? { ...p, posted: ev.posted, total: ev.total } : p));
          else if (ev.phase === 'done') { setReplayResult(ev.result); toast(`${ev.result.transactionsPosted} bilag importert ✓`, 'ok'); }
          else if (ev.phase === 'error') setError(ev.message);
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setBusy(true);
    setError(null);
    setPreview(null);
    setImported(null);
    setReplayPreview(null);
    setReplayResult(null);
    try {
      const content = await f.text();
      const p = await api<SaftPreview>('POST', `/api/organizations/${orgId}/saft-import/preview`, { xml: content });
      setPreview(p);
      setXml(content);
      if (p.periodEnd) setAsOfDate(p.periodEnd);
      try {
        const rp = await api<ReplayPreview>('POST', `/api/organizations/${orgId}/saft-import/replay/preview`, { xml: content });
        setReplayPreview(rp);
      } catch { /* replay-forhåndsvisning er valgfri */ }
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
        <h2>Last opp SAF-T-filen</h2>
        <p className="subtitle">Vi leser filen og viser deg nøyaktig hva den inneholder før noe som helst importeres.</p>
        <input type="file" accept=".xml,text/xml,application/xml" onChange={onFile} disabled={busy || !!progress} aria-label="SAF-T-fil" />
        {fileName && <p className="hint">Valgt fil: {fileName}</p>}
        {busy && !progress && <p className="hint">Leser filen …</p>}
      </div>

      {preview && (
        <>
          <div className="panel threshold-panel">
            <div className="threshold-head">
              <h2>Dette fant vi i filen</h2>
              <span className={`badge ${preview.balanced ? 'ok' : 'accent'}`}>
                {preview.balanced ? 'Balanserer ✓' : 'Balanserer ikke'}
              </span>
            </div>
            <p className="subtitle">
              Regnskapet for <b>{preview.company ?? 'ukjent virksomhet'}</b>
              {preview.periodStart ? <>, perioden {preview.periodStart}–{preview.periodEnd}</> : null}
              {preview.software ? <>, eksportert fra {preview.software}</> : null}.
              {replayPreview ? <> Filen inneholder <b>{replayPreview.transactionCount} bilag</b>.</> : null}
            </p>
            <div className="cards">
              <div className="card"><div className="label">Kontoer</div><div className="value">{preview.counts.accounts}</div></div>
              <div className="card"><div className="label">Kunder</div><div className="value">{preview.counts.customers}</div></div>
              <div className="card"><div className="label">Leverandører</div><div className="value">{preview.counts.suppliers}</div></div>
              <div className="card">
                <div className="label">Sum debet / kredit</div>
                <div className="value">{kr(preview.totalDebitMinor)}</div>
                <div className="hint">Kredit: {kr(preview.totalCreditMinor)}</div>
              </div>
            </div>
          </div>

          {/* Framdrift under import (ekte %) */}
          {progress && (() => {
            const pct = progress.total ? Math.round((progress.posted / progress.total) * 100) : 0;
            return (
              <div className="panel">
                <h2>Henter inn regnskapet …</h2>
                <p className="subtitle">
                  {progress.company ? <>Fra <b>{progress.company}</b>{progress.periodStart ? ` · ${progress.periodStart}–${progress.periodEnd}` : ''}</> : 'Starter …'}
                </p>
                <div style={{ height: 14, borderRadius: 8, background: 'rgba(120,120,140,0.18)', overflow: 'hidden' }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent, #5b4bff)', transition: 'width .25s ease' }} />
                </div>
                <p className="hint" style={{ marginTop: 8 }}>
                  {progress.total ? <><b>{pct}%</b> · {progress.posted} av {progress.total} bilag ført</> : 'Klargjør kontoer og kontakter …'}
                  {progress.includeOpening ? ' · fører også inngående balanse' : ''}
                </p>
              </div>
            );
          })()}

          {/* Resultat: hele historikken */}
          {replayResult && (
            <div className="panel threshold-panel ok">
              <div className="threshold-head">
                <h2>Hele regnskapet er importert ✓</h2>
                <span className="badge ok">{replayResult.transactionsPosted} bilag</span>
              </div>
              <p className="subtitle">
                {replayResult.linesPosted} linjer ført · {replayResult.accountsEnsured} nye kontoer ·{' '}
                {replayResult.suppliersCreated} leverandører · {replayResult.customersCreated} kunder
                {replayResult.openingEntryNumber ? ` · inngående balanse som bilag nr. ${replayResult.openingEntryNumber}` : ''}
                {replayResult.transactionsSkipped > 0 ? ` · ${replayResult.transactionsSkipped} hoppet over (balanserte ikke)` : ''}.
                Hele historikken din finnes nå i Reknaren. Har du flere år, last opp neste fil — den legger seg oppå.
              </p>
            </div>
          )}

          {/* Resultat: bare startsaldo */}
          {imported && (
            <div className="panel threshold-panel ok">
              <div className="threshold-head">
                <h2>Startsaldo bokført ✓</h2>
                <span className="badge ok">Bilag nr. {imported.entryNumber}</span>
              </div>
              <p className="subtitle">
                {imported.openingLines} kontosaldoer ført · {imported.accountsEnsured} nye kontoer ·{' '}
                {imported.customersCreated} kunder · {imported.suppliersCreated} leverandører. Regnskapet starter nå fra tallene dine.
              </p>
            </div>
          )}

          {/* Valg: hva vil du importere? */}
          {!progress && !replayResult && !imported && preview.balanced && (
            <div className="panel">
              <h2>Hva vil du importere?</h2>
              <div className="cards">
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                  <span className="badge ok">Anbefalt</span>
                  <div className="value" style={{ fontSize: 18 }}>Hele regnskapet</div>
                  <p className="hint" style={{ margin: 0 }}>
                    Alle {replayPreview?.transactionCount ?? ''} bilag med dato, tekst og hvem de er fra — så Reknaren
                    kjenner hele historikken din og kan lære faste utgifter, avstemme og mer.
                  </p>
                  <button className="primary" disabled={busy || !replayPreview?.transactionCount} onClick={importFull}>Importer hele regnskapet</button>
                </div>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                  <span className="badge plain">Rask</span>
                  <div className="value" style={{ fontSize: 18 }}>Bare startsaldoen</div>
                  <p className="hint" style={{ margin: 0 }}>Dagens saldoer som ett åpningsbilag. Raskt å komme i gang, men uten bilagshistorikk.</p>
                  <input placeholder="Startdato ÅÅÅÅ-MM-DD" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} style={{ width: 'auto' }} />
                  <button className="secondary" disabled={busy} onClick={bookOpening}>{busy ? 'Bokfører …' : 'Bokfør bare startsaldo'}</button>
                </div>
              </div>
              <p className="hint" style={{ marginTop: 10 }}>
                Trygt å kjøre om igjen — hvert bilag føres nøyaktig én gang. Har du flere år, last opp eldste fil først;
                inngående balanse føres automatisk når regnskapet er tomt.
                {replayPreview && replayPreview.unbalancedCount > 0 ? ` ${replayPreview.unbalancedCount} bilag i filen balanserer ikke og hoppes over.` : ''}
              </p>
            </div>
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

/* ── Årsavslutning ──────────────────────────────────────────────────────── */

interface YearEndPlan {
  year: number;
  orgForm: string;
  accountingResultMinor: string;
  adjustmentsMinor: string;
  taxableResultMinor: string;
  taxRatePct: string | null;
  payableTaxMinor: string;
  resultAfterTaxMinor: string;
  taxEntry: { accountNumber: string; accountName: string; debitMinor: string; creditMinor: string }[] | null;
  periods: { month: number; status: 'open' | 'locked' | 'missing' }[];
  taxAlreadyPosted: boolean;
  dispositionAlreadyPosted: boolean;
  dispositionAccount: string;
  fullyLocked: boolean;
  warnings: string[];
}

interface SpecSection {
  name: string;
  poster: { accountNumber: string; accountName: string; amountMinor: string }[];
  sumMinor: string;
}
interface Naeringsspesifikasjon {
  year: number;
  resultat: {
    driftsinntekter: SpecSection;
    driftskostnader: SpecSection;
    driftsresultatMinor: string;
    finansinntekter: SpecSection;
    finanskostnader: SpecSection;
    ordinaertResultatForSkattMinor: string;
    skattekostnadMinor: string;
    aarsresultatMinor: string;
  };
  balanse: {
    anleggsmidler: SpecSection;
    omlopsmidler: SpecSection;
    sumEiendelerMinor: string;
    egenkapital: SpecSection;
    aarsresultatTilEgenkapitalMinor: string;
    langsiktigGjeld: SpecSection;
    kortsiktigGjeld: SpecSection;
    sumEgenkapitalOgGjeldMinor: string;
    balanserer: boolean;
    differanseMinor: string;
  };
  warnings: string[];
}

export function YearEndScreen({ orgId }: { orgId: string }) {
  const [year, setYear] = useState(Number(thisYear().to.slice(0, 4)) - 1);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const plan = useLoad(
    () => api<YearEndPlan>('GET', `/api/organizations/${orgId}/year-end/${year}`),
    [orgId, year],
  );
  const spec = useLoad(
    () => api<Naeringsspesifikasjon>('GET', `/api/organizations/${orgId}/year-end/${year}/naeringsspesifikasjon`),
    [orgId, year],
  );
  const p = plan.data;
  const lockedCount = p?.periods.filter((x) => x.status === 'locked').length ?? 0;
  const done = Boolean(p && p.fullyLocked);

  const close = async () => {
    if (!p) return;
    setBusy(true);
    try {
      const r = await api<{ payableTaxMinor: string; lockedMonths: number[]; taxPosted: boolean }>(
        'POST',
        `/api/organizations/${orgId}/year-end/${year}/close`,
        {},
      );
      toast(
        r.taxPosted
          ? `Årsavslutning ${year} gjennomført — skatt bokført og året låst.`
          : `Året ${year} er låst.`,
        'ok',
      );
      plan.reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Noe gikk galt', 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>Årsavslutning</h1>
        <p className="subtitle">
          Gjør regnskapsåret ferdig: beregn skatt, bokfør den, og lås året så tallene står fast.
        </p>
      </div>

      <div className="row" style={{ maxWidth: 220 }}>
        <div>
          <label htmlFor="ye-year">Regnskapsår</label>
          <input
            id="ye-year"
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || year)}
          />
        </div>
      </div>

      {plan.error && <div className="error">{plan.error}</div>}
      {plan.loading ? (
        <div className="cards">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        p && (
          <>
            {done && (
              <div className="success">
                Regnskapsåret {year} er avsluttet og låst{p.taxAlreadyPosted ? ', og skatten er bokført' : ''}.
              </div>
            )}
            <div className="cards">
              <div className="card">
                <div className="label">Resultat før skatt</div>
                <div className="value">{kr(p.accountingResultMinor)}</div>
                <div className="hint">Årets overskudd/underskudd fra hovedboken</div>
              </div>
              <div className="card">
                <div className="label">
                  Betalbar skatt{p.taxRatePct ? ` (${p.taxRatePct} %)` : ''}
                </div>
                <div className="value">{kr(p.payableTaxMinor)}</div>
                <div className="hint">
                  {p.orgForm === 'AS' || p.orgForm === 'NUF' || p.orgForm === 'SA'
                    ? 'Selskapsskatt av skattepliktig resultat'
                    : 'Enkeltpersonforetak skatter privat'}
                </div>
              </div>
              <div className="card">
                <div className="label">Resultat etter skatt</div>
                <div className="value">{kr(p.resultAfterTaxMinor)}</div>
                <div className="hint">Til egenkapitalen</div>
              </div>
              <div className="card">
                <div className="label">Perioder låst</div>
                <div className="value">{lockedCount} / 12</div>
                <div className="hint">Låste måneder kan ikke endres uten korrigering</div>
              </div>
            </div>

            {p.taxEntry && (
              <div className="panel">
                <h2>Skattepostering som bokføres</h2>
                <p className="subtitle">Bilaget dateres 31.12.{year}. Ingenting bokføres før du bekrefter.</p>
                <table className="lines">
                  <thead>
                    <tr>
                      <th>Konto</th>
                      <th className="num">Debet</th>
                      <th className="num">Kredit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.taxEntry.map((l) => (
                      <tr key={l.accountNumber}>
                        <td>
                          {l.accountNumber} {l.accountName}
                        </td>
                        <td className="num">{BigInt(l.debitMinor) > 0n ? kr(l.debitMinor) : ''}</td>
                        <td className="num">{BigInt(l.creditMinor) > 0n ? kr(l.creditMinor) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="panel">
              <div className="panel-head">
                <h2>Disponering av årsresultat</h2>
                {p.dispositionAlreadyPosted && <span className="confidence high">Disponert ✓</span>}
              </div>
              <p className="subtitle">
                Årsresultatet flyttes til egenkapitalen så den ruller riktig inn i neste år. Dette holdes
                utenfor resultatregnskapet, som fortsatt viser årets drift.
              </p>
              <dl className="kv">
                <dt>
                  {BigInt(p.resultAfterTaxMinor) < 0n ? 'Underskudd som reduserer egenkapital' : 'Årsresultat til egenkapital'}
                </dt>
                <dd>{kr(p.resultAfterTaxMinor)}</dd>
                <dt>Føres mot</dt>
                <dd>Annen egenkapital ({p.dispositionAccount})</dd>
              </dl>
            </div>

            {p.warnings.length > 0 && (
              <div className="panel explain">
                <strong>Verdt å vite:</strong>
                <ul className="compact">
                  {p.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {!done && (
              <div className="actions">
                <button className="primary" disabled={busy} onClick={close}>
                  {busy ? 'Gjennomfører …' : `Gjennomfør årsavslutning ${year}`}
                </button>
              </div>
            )}

            {spec.data && <NaeringsspecPanel spec={spec.data} year={year} orgId={orgId} />}

            <div className="panel explain">
              <strong>Neste steg: skattemeldingen</strong>
              <p className="hint">
                Når året er avsluttet, danner tallene grunnlaget for næringsspesifikasjonen til
                Skatteetaten. Selve innsendingen kommer så snart tilgangen er på plass — samme
                godkjenning som MVA-meldingen venter på.
              </p>
            </div>
          </>
        )
      )}
    </div>
  );
}

function SpecRow({ section }: { section: SpecSection }) {
  return (
    <Disclosure label={`${section.name}: ${kr(section.sumMinor)}`}>
      <dl className="kv" style={{ marginTop: 6 }}>
        {section.poster.map((p) => (
          <div key={p.accountNumber} style={{ display: 'contents' }}>
            <dt>
              {p.accountNumber} {p.accountName}
            </dt>
            <dd>{kr(p.amountMinor)}</dd>
          </div>
        ))}
        {section.poster.length === 0 && <dd className="hint">Ingen posteringer</dd>}
      </dl>
    </Disclosure>
  );
}

function NaeringsspecPanel({ spec, year, orgId }: { spec: Naeringsspesifikasjon; year: number; orgId: string }) {
  const r = spec.resultat;
  const b = spec.balanse;
  const download = () => {
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `naeringsspesifikasjon-${orgId.slice(0, 8)}-${year}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Næringsspesifikasjon (utkast)</h2>
        <span className={`confidence ${b.balanserer ? 'high' : 'medium'}`}>
          {b.balanserer ? 'Balansen går opp ✓' : `Avvik ${kr(b.differanseMinor)}`}
        </span>
      </div>
      <p className="subtitle">Grunnlaget for skattemeldingen — resultat og balanse mappet til standardposter.</p>

      <h3>Resultatregnskap</h3>
      <SpecRow section={r.driftsinntekter} />
      <SpecRow section={r.driftskostnader} />
      <dl className="kv total">
        <dt>Driftsresultat</dt>
        <dd>{kr(r.driftsresultatMinor)}</dd>
      </dl>
      <SpecRow section={r.finansinntekter} />
      <SpecRow section={r.finanskostnader} />
      <dl className="kv total">
        <dt>Ordinært resultat før skatt</dt>
        <dd>{kr(r.ordinaertResultatForSkattMinor)}</dd>
        <dt>Skattekostnad</dt>
        <dd>{kr(r.skattekostnadMinor)}</dd>
        <dt>
          <strong>Årsresultat</strong>
        </dt>
        <dd>
          <strong>{kr(r.aarsresultatMinor)}</strong>
        </dd>
      </dl>

      <h3>Balanse per 31.12.{year}</h3>
      <SpecRow section={b.anleggsmidler} />
      <SpecRow section={b.omlopsmidler} />
      <dl className="kv total">
        <dt>Sum eiendeler</dt>
        <dd>{kr(b.sumEiendelerMinor)}</dd>
      </dl>
      <SpecRow section={b.egenkapital} />
      <dl className="kv">
        <dt>Årsresultat (til egenkapital)</dt>
        <dd>{kr(b.aarsresultatTilEgenkapitalMinor)}</dd>
      </dl>
      <SpecRow section={b.langsiktigGjeld} />
      <SpecRow section={b.kortsiktigGjeld} />
      <dl className="kv total">
        <dt>Sum egenkapital og gjeld</dt>
        <dd>{kr(b.sumEgenkapitalOgGjeldMinor)}</dd>
      </dl>

      <div className="actions">
        <button className="secondary" onClick={download}>
          Last ned utkast (JSON)
        </button>
      </div>
    </div>
  );
}

/* ── Framover: planlegger ───────────────────────────────────────────────── */

interface Forecast {
  asOf: string;
  horizonDays: number;
  cashNowMinor: string;
  forventetMva: { fromDate: string; toDate: string; dueDate: string; netPayableMinor: string };
  skatt: {
    estimatedTaxMinor: string;
    recommendedReserveMinor: string;
    terminer: { dueDate: string; amountMinor: string }[];
  };
  ubetalteFakturaer: {
    totalMinor: string;
    overdueMinor: string;
    count: number;
    items: { invoiceNumber: string | null; customer: string; dueDate: string | null; outstandingMinor: string; overdue: boolean }[];
  };
  kommendeKostnader: {
    leverandorgjeldMinor: string;
    items: { vendor: string; dueDate: string; amountMinor: string }[];
  };
  gjentakendeKostnader: {
    vendor: string;
    amountMinor: string;
    cadence: 'monthly' | 'quarterly';
    occurrences: number;
    nextDates: string[];
    confidence: 'high' | 'assumed';
  }[];
  mangler: { bilagTilBehandling: number; uavstemteBanktransaksjoner: number };
  likviditet: {
    timeline: { weekStart: string; inflowMinor: string; outflowMinor: string; projectedBalanceMinor: string }[];
    endBalanceMinor: string;
    lowestBalanceMinor: string;
    lowestWeekStart: string;
    goesNegative: boolean;
  };
  warnings: string[];
}

const nb = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) : '–');

function LiquidityChart({ liq, cashNow }: { liq: Forecast['likviditet']; cashNow: string }) {
  const balances = [BigInt(cashNow), ...liq.timeline.map((w) => BigInt(w.projectedBalanceMinor))];
  const max = balances.reduce((a, b) => (b > a ? b : a), 1n);
  const min = balances.reduce((a, b) => (b < a ? b : a), 0n);
  const span = max - min > 0n ? max - min : 1n;
  const heightPct = (v: bigint) => Number(((v - min) * 100n) / span);
  return (
    <div className="liq-chart" role="img" aria-label="Likviditetsprognose 90 dager">
      {liq.timeline.map((w, i) => {
        const v = BigInt(w.projectedBalanceMinor);
        const neg = v < 0n;
        return (
          <div className="liq-bar-wrap" key={i} title={`${nb(w.weekStart)}: ${kr(w.projectedBalanceMinor)}`}>
            <div
              className={`liq-bar${neg ? ' neg' : ''}`}
              style={{ height: `${Math.max(4, heightPct(v))}%` }}
            />
            {i % 2 === 0 && <span className="liq-label">{nb(w.weekStart)}</span>}
          </div>
        );
      })}
    </div>
  );
}

export function PlanningScreen({ orgId, onNavigate }: { orgId: string; onNavigate?: (s: string) => void }) {
  const fc = useLoad(() => api<Forecast>('GET', `/api/organizations/${orgId}/planning`), [orgId]);
  const f = fc.data;
  return (
    <div>
      <div className="page-head">
        <h1>Framover</h1>
        <p className="subtitle">
          Hva som kommer: forventet MVA og skatt, likviditet, ubetalte fakturaer, kommende kostnader og hva som mangler.
        </p>
      </div>
      {fc.error && <div className="error">{fc.error}</div>}
      {fc.loading ? (
        <div className="cards">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        f && (
          <>
            <div className="panel">
              <div className="panel-head">
                <h2>Likviditet neste 90 dager</h2>
                <span className={`confidence ${f.likviditet.goesNegative ? 'low' : 'high'}`}>
                  {f.likviditet.goesNegative ? 'Kan gå i minus' : 'Positiv hele veien'}
                </span>
              </div>
              <LiquidityChart liq={f.likviditet} cashNow={f.cashNowMinor} />
              <div className="cards" style={{ marginTop: 14 }}>
                <div className="card">
                  <div className="label">På konto nå</div>
                  <div className="value">{kr(f.cashNowMinor)}</div>
                </div>
                <div className={`card${f.likviditet.goesNegative ? ' attention' : ''}`}>
                  <div className="label">Laveste punkt</div>
                  <div className="value">{kr(f.likviditet.lowestBalanceMinor)}</div>
                  <div className="hint">rundt {nb(f.likviditet.lowestWeekStart)}</div>
                </div>
                <div className="card">
                  <div className="label">Anslått saldo om 90 dager</div>
                  <div className="value">{kr(f.likviditet.endBalanceMinor)}</div>
                </div>
              </div>
            </div>

            <div className="cards">
              <div className="card">
                <div className="label">Forventet MVA</div>
                <div className="value">{kr(f.forventetMva.netPayableMinor)}</div>
                <div className="hint">
                  {BigInt(f.forventetMva.netPayableMinor) < 0n ? 'til gode' : 'å betale'} · forfall {nb(f.forventetMva.dueDate)}
                </div>
              </div>
              <div className="card">
                <div className="label">Skatt å sette av</div>
                <div className="value">{kr(f.skatt.recommendedReserveMinor)}</div>
                <div className="hint">
                  anbefalt reserve (skatt + mva)
                  {f.skatt.terminer.length > 0 && ` · neste termin ${nb(f.skatt.terminer[0]!.dueDate)}`}
                </div>
              </div>
              <div className={`card${f.mangler.bilagTilBehandling + f.mangler.uavstemteBanktransaksjoner > 0 ? ' attention' : ''}`}>
                <div className="label">Mangler oppfølging</div>
                <div className="value">{f.mangler.bilagTilBehandling + f.mangler.uavstemteBanktransaksjoner}</div>
                <div className="hint">
                  {f.mangler.bilagTilBehandling} bilag · {f.mangler.uavstemteBanktransaksjoner} banktransaksjoner
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h2>Venter på betaling (inn)</h2>
                <span className="badge accent">{kr(f.ubetalteFakturaer.totalMinor)}</span>
              </div>
              {f.ubetalteFakturaer.count === 0 ? (
                <p className="subtitle">Ingen utestående kundefakturaer.</p>
              ) : (
                <>
                  {BigInt(f.ubetalteFakturaer.overdueMinor) > 0n && (
                    <p className="subtitle">
                      Herav {kr(f.ubetalteFakturaer.overdueMinor)} forfalt.{' '}
                      {onNavigate && (
                        <button className="linklike" onClick={() => onNavigate('invoicing')}>
                          Send påminnelse
                        </button>
                      )}
                    </p>
                  )}
                  <ul className="health-list">
                    {f.ubetalteFakturaer.items.slice(0, 8).map((it, i) => (
                      <li key={i} className={`health-item ${it.overdue ? 'warning' : 'info'}`}>
                        <div className="health-dot" aria-hidden="true" />
                        <div className="health-body">
                          <div className="health-title">
                            Faktura {it.invoiceNumber ?? ''} · {it.customer}
                          </div>
                          <div className="health-detail">
                            {kr(it.outstandingMinor)} · forfall {nb(it.dueDate)}
                            {it.overdue ? ' (forfalt)' : ''}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="panel">
              <div className="panel-head">
                <h2>Kommende kostnader (ut)</h2>
                <span className="badge accent">{kr(f.kommendeKostnader.leverandorgjeldMinor)}</span>
              </div>
              <p className="subtitle">Leverandørgjeld du skylder. Kjente forfall innen 90 dager under.</p>
              {f.kommendeKostnader.items.length === 0 ? (
                <p className="hint">Ingen bilag med registrert forfallsdato i perioden.</p>
              ) : (
                <ul className="health-list">
                  {f.kommendeKostnader.items.slice(0, 8).map((it, i) => (
                    <li key={i} className="health-item info">
                      <div className="health-dot" aria-hidden="true" />
                      <div className="health-body">
                        <div className="health-title">{it.vendor}</div>
                        <div className="health-detail">
                          {kr(it.amountMinor)} · forfall {nb(it.dueDate)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {f.skatt.terminer.length > 0 && (
              <div className="panel">
                <div className="panel-head">
                  <h2>Skatteterminer (anslått)</h2>
                  <span className="confidence medium">Forskuddsskatt</span>
                </div>
                <p className="subtitle">
                  Anslåtte forskuddsskatt-terminer innen 90 dager, basert på resultatet hittil. Ikke Skatteetatens fastsatte beløp.
                </p>
                <ul className="health-list">
                  {f.skatt.terminer.map((t, i) => (
                    <li key={i} className="health-item info">
                      <div className="health-dot" aria-hidden="true" />
                      <div className="health-body">
                        <div className="health-title">Forskuddsskatt · {kr(t.amountMinor)}</div>
                        <div className="health-detail">forfall {nb(t.dueDate)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {f.gjentakendeKostnader.length > 0 && (
              <div className="panel">
                <div className="panel-head">
                  <h2>Faste kostnader (anslått)</h2>
                  <span className="confidence medium">Gjenkjent fra historikken</span>
                </div>
                <p className="subtitle">
                  Periodiske kostnader vi har oppdaget og projisert framover. Anslag — ikke bokførte forfall.
                </p>
                <ul className="health-list">
                  {f.gjentakendeKostnader.map((rc, i) => (
                    <li key={i} className="health-item info">
                      <div className="health-dot" aria-hidden="true" />
                      <div className="health-body">
                        <div className="health-title">
                          {rc.vendor} · {kr(rc.amountMinor)}{' '}
                          <span className="code">{rc.cadence === 'monthly' ? 'månedlig' : 'kvartalsvis'}</span>
                        </div>
                        <div className="health-detail">
                          {rc.nextDates.length} forfall innen 90 dager (neste {nb(rc.nextDates[0] ?? null)}) ·{' '}
                          {rc.confidence === 'high' ? 'tydelig mønster' : 'antatt'}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {f.warnings.length > 0 && (
              <div className="panel explain">
                <strong>Om prognosen:</strong>
                <ul className="compact">
                  {f.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}

/* ── Kunstig intelligens (transparens) ──────────────────────────────────── */

interface AiUse {
  id: string;
  feature: string;
  purpose: string;
  provider: string;
  model: string;
  active: boolean;
  humanControl: string;
  dataNote: string;
}
interface AiDisclosure {
  usesAi: boolean;
  headline: string;
  principles: { key: string; title: string; text: string }[];
  uses: AiUse[];
  humanOversight: string;
  limitations: string[];
}

export function AiScreen() {
  const d = useLoad(() => api<AiDisclosure>('GET', '/api/ai/disclosure'), []);
  const a = d.data;
  return (
    <div>
      <div className="page-head">
        <h1>Kunstig intelligens</h1>
        <p className="subtitle">Hvor og hvordan Reknaren bruker KI — og hvordan du beholder kontrollen.</p>
      </div>
      {d.loading ? (
        <div className="cards">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        a && (
          <>
            <div className={`panel${a.usesAi ? '' : ' explain'}`}>
              <p style={{ margin: 0, fontSize: 15.5 }}>{a.headline}</p>
            </div>

            <div className="cards">
              {a.principles.map((p) => (
                <div className="card" key={p.key} style={{ textAlign: 'left' }}>
                  <div className="label">{p.title}</div>
                  <div className="hint" style={{ fontSize: 13.5, marginTop: 6 }}>
                    {p.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="panel">
              <h2>Slik brukes KI i Reknaren</h2>
              {a.uses.map((u) => (
                <div key={u.id} className="ai-use">
                  <div className="panel-head">
                    <h3 style={{ margin: 0 }}>{u.feature}</h3>
                    <span className={`confidence ${u.active ? 'high' : 'medium'}`}>
                      {u.active ? 'Aktiv' : 'Ikke aktiv'}
                    </span>
                  </div>
                  <p className="subtitle" style={{ marginTop: 4 }}>{u.purpose}</p>
                  <dl className="kv">
                    <dt>Modell</dt>
                    <dd>
                      {u.provider} <span className="code">{u.model}</span>
                    </dd>
                    <dt>Menneskelig kontroll</dt>
                    <dd>{u.humanControl}</dd>
                    <dt>Data</dt>
                    <dd>{u.dataNote}</dd>
                  </dl>
                </div>
              ))}
            </div>

            <div className="panel explain">
              <strong>Menneskelig kontroll</strong>
              <p className="hint" style={{ marginTop: 6 }}>{a.humanOversight}</p>
              <strong>Begrensninger</strong>
              <ul className="compact">
                {a.limitations.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
          </>
        )
      )}
    </div>
  );
}

/* ── Månedsavslutning (kontinuerlig avslutning) ─────────────────────────── */

interface CloseItem {
  code: string;
  severity: 'blocker' | 'warning' | 'info';
  title: string;
  detail: string;
  count: number;
  actionScreen?: string;
}
interface PeriodClose {
  year: number;
  month: number;
  monthName: string;
  status: 'open' | 'locked';
  readinessPct: number;
  ready: boolean;
  items: CloseItem[];
  summary: string;
}

const MONTH_NAMES = ['Januar','Februar','Mars','April','Mai','Juni','Juli','August','September','Oktober','November','Desember'];

export function PeriodCloseScreen({ orgId, onNavigate }: { orgId: string; onNavigate?: (s: string) => void }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const pc = useLoad(
    () => api<PeriodClose>('GET', `/api/organizations/${orgId}/period-close/${year}/${month}`),
    [orgId, year, month],
  );
  const yearOverview = useLoad(
    () => api<{ months: { month: number; monthName: string; status: string; readinessPct: number; ready: boolean; blockerCount: number }[] }>(
      'GET', `/api/organizations/${orgId}/period-close/${year}`,
    ),
    [orgId, year, pc.data?.status],
  );
  const p = pc.data;

  const lock = async () => {
    setBusy(true);
    try {
      await api('POST', `/api/organizations/${orgId}/periods/${year}/${month}/lock`, {
        reason: `Månedsavslutning ${MONTH_NAMES[month - 1]} ${year}`,
      });
      toast(`${MONTH_NAMES[month - 1]} ${year} er låst.`, 'ok');
      pc.reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Kunne ikke låse', 'danger');
    } finally {
      setBusy(false);
    }
  };

  const sevClass: Record<string, string> = { blocker: 'error', warning: 'warning', info: 'info' };

  return (
    <div>
      <div className="page-head">
        <h1>Månedsavslutning</h1>
        <p className="subtitle">
          Reknaren kontrollerer regnskapet løpende — ikke bare ved månedsslutt. Her ser du hvor klar måneden er til å låses.
        </p>
      </div>

      <div className="row" style={{ maxWidth: 360 }}>
        <div>
          <label htmlFor="pc-month">Måned</label>
          <select id="pc-month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTH_NAMES.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pc-year">År</label>
          <input id="pc-year" inputMode="numeric" value={year} onChange={(e) => setYear(Number(e.target.value) || year)} />
        </div>
      </div>

      {yearOverview.data && (
        <div className="year-strip" role="tablist" aria-label={`Avstemming ${year}`}>
          {yearOverview.data.months.map((m) => {
            const lvl = m.status === 'locked' ? 'locked' : m.blockerCount > 0 ? 'low' : m.readinessPct >= 80 ? 'ok' : m.readinessPct >= 50 ? 'warn' : 'low';
            return (
              <button
                key={m.month}
                className={`year-chip ${lvl}${m.month === month ? ' active' : ''}`}
                onClick={() => setMonth(m.month)}
                title={`${m.monthName}: ${m.status === 'locked' ? 'låst' : m.readinessPct + ' % ferdig'}`}
              >
                <span className="year-chip-m">{m.monthName.slice(0, 3)}</span>
                <span className="year-chip-v">{m.status === 'locked' ? '🔒' : `${m.readinessPct}%`}</span>
              </button>
            );
          })}
        </div>
      )}

      {pc.error && <div className="error">{pc.error}</div>}
      {pc.loading ? (
        <div className="cards"><CardSkeleton /><CardSkeleton /></div>
      ) : (
        p && (
          <>
            <div className="panel">
              <div className="panel-head">
                <h2>{p.monthName} {p.year}</h2>
                <span className={`confidence ${p.status === 'locked' ? 'high' : p.ready ? 'high' : p.readinessPct >= 80 ? 'medium' : 'low'}`}>
                  {p.status === 'locked' ? 'Låst ✓' : p.ready ? 'Klar til å låses' : `${p.readinessPct} % ferdig`}
                </span>
              </div>
              <div className="progress" role="img" aria-label={`${p.readinessPct} prosent ferdig`}>
                <div className={`progress-fill${p.readinessPct >= 80 ? ' ok' : p.readinessPct >= 50 ? ' warn' : ' low'}`} style={{ width: `${p.readinessPct}%` }} />
              </div>
              <p className="subtitle" style={{ marginTop: 10 }}>{p.summary}</p>
              {p.status === 'open' && (
                <div className="actions">
                  <button className="primary" disabled={busy || !p.ready} onClick={lock} title={p.ready ? '' : 'Rydd blokkerende punkter først'}>
                    {busy ? 'Låser …' : 'Lås perioden'}
                  </button>
                  {!p.ready && <span className="hint">Løs de røde punktene under før du kan låse.</span>}
                </div>
              )}
            </div>

            {p.items.length > 0 && (
              <div className="panel">
                <h2>Gjenstår før låsing</h2>
                <ul className="health-list">
                  {p.items.map((it, i) => (
                    <li key={i} className={`health-item ${sevClass[it.severity]}`}>
                      <div className="health-dot" aria-hidden="true" />
                      <div className="health-body">
                        <div className="health-title">{it.title}</div>
                        <div className="health-detail">{it.detail}</div>
                      </div>
                      {it.actionScreen && onNavigate && (
                        <button className="secondary health-action" onClick={() => onNavigate(it.actionScreen!)}>
                          Åpne
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}

/* ── Proaktiv skatte- og MVA-assistent ──────────────────────────────────── */

interface Advisory {
  code: string;
  kind: 'mulighet' | 'kontrollpunkt' | 'risiko';
  title: string;
  detail: string;
  ruleReferences: string[];
  legalReference?: string;
  needsProfessional?: boolean;
  actionScreen?: string;
}
interface TaxAdvisories {
  advisories: Advisory[];
  disclaimer: string;
}

const KIND_META: Record<Advisory['kind'], { label: string; cls: string }> = {
  risiko: { label: 'Risiko', cls: 'low' },
  mulighet: { label: 'Muligheter', cls: 'high' },
  kontrollpunkt: { label: 'Kontrollpunkter', cls: 'medium' },
};

export function AssistantScreen({ orgId, onNavigate }: { orgId: string; onNavigate?: (s: string) => void }) {
  const a = useLoad(() => api<TaxAdvisories>('GET', `/api/organizations/${orgId}/tax-advisories`), [orgId]);
  const d = a.data;
  const groups: Advisory['kind'][] = ['risiko', 'mulighet', 'kontrollpunkt'];
  return (
    <div>
      <div className="page-head">
        <h1>Skatte- og MVA-assistent</h1>
        <p className="subtitle">
          Reknaren leter kontinuerlig etter forhold som fortjener oppmerksomhet — muligheter og kontrollpunkter, ikke løfter.
        </p>
      </div>
      {a.loading ? (
        <div className="cards"><CardSkeleton /><CardSkeleton /></div>
      ) : (
        d && (
          <>
            <div className="panel explain">
              <p className="hint" style={{ margin: 0 }}>{d.disclaimer}</p>
            </div>
            {d.advisories.length === 0 ? (
              <div className="panel"><p className="subtitle">Ingenting krever oppmerksomhet akkurat nå. Vi følger med fortløpende.</p></div>
            ) : (
              groups.map((k) => {
                const items = d.advisories.filter((x) => x.kind === k);
                if (items.length === 0) return null;
                return (
                  <div className="panel" key={k}>
                    <div className="panel-head">
                      <h2>{KIND_META[k].label}</h2>
                      <span className={`confidence ${KIND_META[k].cls}`}>{items.length}</span>
                    </div>
                    <ul className="health-list">
                      {items.map((it, i) => (
                        <li key={i} className={`health-item ${k === 'risiko' ? 'warning' : k === 'mulighet' ? 'info' : 'info'}`}>
                          <div className="health-dot" aria-hidden="true" />
                          <div className="health-body">
                            <div className="health-title">
                              {it.title}
                              {it.needsProfessional && <span className="code">regnskapsfører</span>}
                            </div>
                            <div className="health-detail">{it.detail}</div>
                            {it.legalReference && <div className="hint">Kilde: {it.legalReference}</div>}
                          </div>
                          {it.actionScreen && onNavigate && (
                            <button className="secondary health-action" onClick={() => onNavigate(it.actionScreen!)}>
                              Åpne
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
          </>
        )
      )}
    </div>
  );
}

/* ── Avviks- og svindeldeteksjon ────────────────────────────────────────── */

type FraudSeverity = 'critical' | 'high' | 'medium' | 'low';
interface FraudEvidence {
  type: string;
  label: string;
  documentId?: string;
  entryId?: string;
  entryNumber?: number;
}
interface FraudSignal {
  code: string;
  category: string;
  severity: FraudSeverity;
  title: string;
  detail: string;
  recommendation: string;
  evidence: FraudEvidence[];
  legalReference?: string;
  fingerprint: string;
  patternHints?: { type: string; value: string; sourceDocumentId?: string }[];
  reviewed?: { verdict: 'confirmed_fraud' | 'false_alarm' | 'resolved'; note?: string; at: string } | null;
}
interface FraudReport {
  checkedFrom: string;
  checkedTo: string;
  signals: FraudSignal[];
  activeCount: number;
  dismissedCount: number;
  bySeverity: Record<FraudSeverity, number>;
  settings: { significantThresholdMinor: string; requiredApprovers: number; businessHoursStart: number; businessHoursEnd: number };
}
interface ApprovalRequirement { source: 'significant' | 'vendor' | 'threshold'; requiredRole: string | null; reason: string; satisfied: boolean }
interface AwaitingApproval {
  requiredApprovers: number;
  significantThresholdMinor: string;
  items: { journalEntryId: string; entryNumber: number; entryDate: string; description: string; documentId: string | null; totalMinor: string; approvals: number; requiredApprovers: number; requirements: ApprovalRequirement[] }[];
}
interface FraudSettings {
  significantThresholdMinor: string;
  requiredApprovers: number;
  businessHoursStart: number;
  businessHoursEnd: number;
  isDefault: boolean;
}

const SEV_META: Record<FraudSeverity, { label: string; cls: string; hl: string }> = {
  critical: { label: 'Kritisk', cls: 'low', hl: 'warning' },
  high: { label: 'Høy', cls: 'low', hl: 'warning' },
  medium: { label: 'Middels', cls: 'medium', hl: 'info' },
  low: { label: 'Lav', cls: 'high', hl: 'info' },
};
const VERDICT_LABEL: Record<string, string> = { confirmed_fraud: 'Bekreftet svindel', false_alarm: 'Falsk alarm', resolved: 'Håndtert' };

export function FraudScreen({ orgId, onOpenDocument }: { orgId: string; onOpenDocument: (id: string) => void }) {
  const report = useLoad(() => api<FraudReport>('GET', `/api/organizations/${orgId}/fraud-signals`), [orgId]);
  const awaiting = useLoad(() => api<AwaitingApproval>('GET', `/api/organizations/${orgId}/payments/awaiting-approval`), [orgId]);
  const settings = useLoad(() => api<FraudSettings>('GET', `/api/organizations/${orgId}/fraud-settings`), [orgId]);
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const d = report.data;

  const review = async (s: FraudSignal, verdict: 'confirmed_fraud' | 'false_alarm' | 'resolved', learn: boolean) => {
    setBusy(s.fingerprint);
    try {
      await api('POST', `/api/organizations/${orgId}/fraud-signals/review`, {
        signalCode: s.code,
        fingerprint: s.fingerprint,
        verdict,
        ...(verdict === 'confirmed_fraud' && learn && s.patternHints?.length ? { patterns: s.patternHints } : {}),
      });
      toast(verdict === 'false_alarm' ? 'Markert som falsk alarm' : verdict === 'confirmed_fraud' ? 'Markert som bekreftet svindel' : 'Markert som håndtert', 'ok');
      report.reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Kunne ikke lagre vurderingen', 'danger');
    } finally {
      setBusy(null);
    }
  };

  const approve = async (entryId: string) => {
    setBusy(entryId);
    try {
      await api('POST', `/api/organizations/${orgId}/payments/${entryId}/approve`, {});
      toast('Betaling godkjent', 'ok');
      awaiting.reload();
      report.reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Kunne ikke godkjenne', 'danger');
    } finally {
      setBusy(null);
    }
  };

  const groups: FraudSeverity[] = ['critical', 'high', 'medium', 'low'];
  const active = d?.signals.filter((s) => s.reviewed?.verdict !== 'false_alarm') ?? [];
  const dismissed = d?.signals.filter((s) => s.reviewed?.verdict === 'false_alarm') ?? [];

  return (
    <div>
      <div className="page-head">
        <h1>Avviks- og svindelkontroll</h1>
        <p className="subtitle">
          Reknaren kontrollerer bilag og betalinger for kjente tegn på feil og svindel. Hvert varsel viser nøyaktig hvilke
          data det bygger på — ingen ugjennomsiktig score. Du bestemmer.
        </p>
      </div>
      {report.error && <div className="error">{report.error}</div>}

      {report.loading || !d ? (
        <div className="cards"><CardSkeleton /><CardSkeleton /></div>
      ) : (
        <>
          {/* Sammendrag */}
          <div className="panel">
            <div className="panel-head">
              <h2>Status</h2>
              <span className={`confidence ${d.bySeverity.critical > 0 ? 'low' : d.bySeverity.high > 0 ? 'medium' : 'high'}`}>
                {d.activeCount === 0 ? 'Ingen åpne varsler ✓' : `${d.activeCount} varsler`}
              </span>
            </div>
            <div className="chips">
              <span className="chip">{d.bySeverity.critical} kritiske</span>
              <span className="chip">{d.bySeverity.high} høye</span>
              <span className="chip">{d.bySeverity.medium} middels</span>
              <span className="chip">{d.bySeverity.low} lave</span>
              {d.dismissedCount > 0 && <span className="chip">{d.dismissedCount} avfeid</span>}
            </div>
          </div>

          {/* Vesentlige betalinger som venter på godkjenning */}
          {awaiting.data && awaiting.data.items.length > 0 && (
            <div className="panel">
              <div className="panel-head">
                <h2>Betalinger som venter på godkjenning</h2>
                <span className="confidence medium">{awaiting.data.items.length}</span>
              </div>
              <p className="hint" style={{ marginTop: 0 }}>
                Betalinger over {kr(awaiting.data.significantThresholdMinor)} krever {awaiting.data.requiredApprovers} godkjennere.
                Den som bokførte kan ikke godkjenne selv.
              </p>
              <ul className="health-list">
                {awaiting.data.items.map((it) => (
                  <li key={it.journalEntryId} className="health-item warning">
                    <div className="health-dot" aria-hidden="true" />
                    <div className="health-body">
                      <div className="health-title">Bilag {it.entryNumber}: {kr(it.totalMinor)}</div>
                      <div className="health-detail">{it.description} · {it.approvals} godkjenning{it.approvals === 1 ? '' : 'er'}</div>
                      {it.requirements.filter((r) => !r.satisfied).map((r, i) => (
                        <div key={i} className="hint" style={{ marginTop: 2 }}>• {r.reason}</div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {it.documentId && <button className="secondary health-action" onClick={() => onOpenDocument(it.documentId!)}>Åpne</button>}
                      <button className="health-action" disabled={busy === it.journalEntryId} onClick={() => approve(it.journalEntryId)}>Godkjenn</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Varsler gruppert på alvorsgrad */}
          {active.length === 0 ? (
            <div className="panel"><p className="subtitle">Ingen åpne varsler. Vi kontrollerer bilag og betalinger løpende.</p></div>
          ) : (
            groups.map((g) => {
              const items = active.filter((s) => s.severity === g);
              if (items.length === 0) return null;
              return (
                <div className="panel" key={g}>
                  <div className="panel-head">
                    <h2>{SEV_META[g].label}</h2>
                    <span className={`confidence ${SEV_META[g].cls}`}>{items.length}</span>
                  </div>
                  <ul className="health-list">
                    {items.map((s) => (
                      <li key={s.fingerprint} className={`health-item ${SEV_META[s.severity].hl}`}>
                        <div className="health-dot" aria-hidden="true" />
                        <div className="health-body">
                          <div className="health-title">
                            {s.title}
                            <span className="code">{s.category}</span>
                            {s.reviewed && <span className="code">{VERDICT_LABEL[s.reviewed.verdict]}</span>}
                          </div>
                          <div className="health-detail">{s.detail}</div>
                          <div className="hint" style={{ marginTop: 4 }}>Anbefaling: {s.recommendation}</div>
                          {s.legalReference && <div className="hint">Grunnlag: {s.legalReference}</div>}
                          <div className="chips" style={{ marginTop: 8 }}>
                            {s.evidence.filter((e) => e.documentId).map((e, i) => (
                              <button key={i} className="secondary" onClick={() => onOpenDocument(e.documentId!)}>{e.label || 'Åpne bilag'}</button>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <button className="secondary health-action" disabled={busy === s.fingerprint} onClick={() => review(s, 'false_alarm', false)}>Falsk alarm</button>
                          <button className="health-action" disabled={busy === s.fingerprint} onClick={() => review(s, 'confirmed_fraud', true)}>Bekreft svindel</button>
                          <button className="secondary health-action" disabled={busy === s.fingerprint} onClick={() => review(s, 'resolved', false)}>Håndtert</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}

          {/* Avfeide varsler */}
          {dismissed.length > 0 && (
            <div className="panel">
              <Disclosure label={`Avfeide varsler (${dismissed.length})`}>
                <ul className="health-list">
                  {dismissed.map((s) => (
                    <li key={s.fingerprint} className="health-item info">
                      <div className="health-dot" aria-hidden="true" />
                      <div className="health-body">
                        <div className="health-title">{s.title}</div>
                        <div className="health-detail">{s.reviewed?.note ?? 'Markert som falsk alarm.'}</div>
                      </div>
                      <button className="secondary health-action" disabled={busy === s.fingerprint} onClick={() => review(s, 'resolved', false)}>Angre</button>
                    </li>
                  ))}
                </ul>
              </Disclosure>
            </div>
          )}

          {/* Kontrollpolicy */}
          {settings.data && (
            <div className="panel">
              <Disclosure label="Kontrollpolicy">
                <FraudSettingsForm orgId={orgId} initial={settings.data} onSaved={() => { settings.reload(); report.reload(); awaiting.reload(); }} />
              </Disclosure>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FraudSettingsForm({ orgId, initial, onSaved }: { orgId: string; initial: FraudSettings; onSaved: () => void }) {
  const toast = useToast();
  const [thresholdKr, setThresholdKr] = useState(String(Math.round(Number(initial.significantThresholdMinor) / 100)));
  const [approvers, setApprovers] = useState(String(initial.requiredApprovers));
  const [start, setStart] = useState(String(initial.businessHoursStart));
  const [end, setEnd] = useState(String(initial.businessHoursEnd));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api('PUT', `/api/organizations/${orgId}/fraud-settings`, {
        significantThresholdMinor: String(Math.round(Number(thresholdKr) * 100)),
        requiredApprovers: Number(approvers),
        businessHoursStart: Number(start),
        businessHoursEnd: Number(end),
      });
      toast('Kontrollpolicy lagret', 'ok');
      onSaved();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Kunne ikke lagre', 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="form-grid">
      <p className="hint" style={{ gridColumn: '1 / -1', margin: 0 }}>
        Styrer hva som regnes som en vesentlig betaling (krever flergodkjenning) og hva som er normal arbeidstid.
        {initial.isDefault && ' Bruker foreløpig standardverdier.'}
      </p>
      <div>
        <label htmlFor="fs-threshold">Vesentlig betaling (kr)</label>
        <input id="fs-threshold" type="number" value={thresholdKr} onChange={(e) => setThresholdKr(e.target.value)} />
      </div>
      <div>
        <label htmlFor="fs-approvers">Antall godkjennere</label>
        <input id="fs-approvers" type="number" min={1} max={10} value={approvers} onChange={(e) => setApprovers(e.target.value)} />
      </div>
      <div>
        <label htmlFor="fs-start">Arbeidstid fra (time)</label>
        <input id="fs-start" type="number" min={0} max={23} value={start} onChange={(e) => setStart(e.target.value)} />
      </div>
      <div>
        <label htmlFor="fs-end">Arbeidstid til (time)</label>
        <input id="fs-end" type="number" min={1} max={24} value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <button disabled={busy} onClick={save}>Lagre kontrollpolicy</button>
      </div>
    </div>
  );
}

/* ── Lærende regnskapsmodell ─────────────────────────────────────────────── */

interface LearnedExample { entryNumber: number | null; documentId: string | null; description: string; occurredAt: string | null }
interface LearnedRule {
  id: string;
  ruleType: 'account_mapping' | 'project_mapping' | 'approver_requirement' | 'threshold_approval';
  scope: 'organization' | 'group';
  scopeLabel: string;
  subjectType: 'vendor' | 'customer' | 'amount';
  subjectKey: string | null;
  subjectLabel: string;
  target: Record<string, unknown>;
  targetLabel: string;
  status: 'suggested' | 'active' | 'dismissed' | 'superseded';
  supportCount: number;
  observationCount: number;
  rationale: string;
  origin: 'system' | 'manual';
  approvedBy: string | null;
  approvedAt: string | null;
  updatedAt: string;
  examples: LearnedExample[];
}
interface LearnedRulesResponse { groupId: string | null; groupName: string | null; rules: LearnedRule[] }

const RULE_TYPE_LABEL: Record<LearnedRule['ruleType'], string> = {
  account_mapping: 'Leverandør → konto',
  project_mapping: 'Kunde → prosjekt',
  approver_requirement: 'Godkjenningskrav (leverandør)',
  threshold_approval: 'Godkjenningskrav (beløp)',
};
const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'accounting_manager', label: 'Økonomiansvarlig' },
  { value: 'general_manager', label: 'Daglig leder' },
  { value: 'approver', label: 'Prosjektleder/godkjenner' },
  { value: 'attestant', label: 'Attestant' },
  { value: 'accountant', label: 'Regnskapsfører' },
  { value: 'admin', label: 'Administrator' },
  { value: 'owner', label: 'Eier' },
];

export function LearningScreen({ orgId, onOpenDocument }: { orgId: string; onOpenDocument: (id: string) => void }) {
  const load = useLoad(() => api<LearnedRulesResponse>('GET', `/api/organizations/${orgId}/learned-rules`), [orgId]);
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const d = load.data;

  const detect = async () => {
    setBusy('detect');
    try {
      const res = await api<{ proposed: number }>('POST', `/api/organizations/${orgId}/learned-rules/detect`, {});
      toast(res.proposed > 0 ? `Fant ${res.proposed} ny(e) mønstre å vurdere` : 'Ingen nye mønstre funnet', 'ok');
      load.reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Kunne ikke lære av historikken', 'danger');
    } finally {
      setBusy(null);
    }
  };
  const act = async (rule: LearnedRule, action: 'approve' | 'dismiss') => {
    setBusy(rule.id);
    try {
      await api('POST', `/api/organizations/${orgId}/learned-rules/${rule.id}/${action}`, {});
      toast(action === 'approve' ? 'Regel godkjent og aktiv' : 'Regel avslått', 'ok');
      load.reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Handlingen feilet', 'danger');
    } finally {
      setBusy(null);
    }
  };
  const setScope = async (rule: LearnedRule, scope: 'organization' | 'group') => {
    setBusy(rule.id);
    try {
      await api('PATCH', `/api/organizations/${orgId}/learned-rules/${rule.id}`, { scope });
      toast(scope === 'group' ? 'Regelen gjelder nå hele konsernet' : 'Regelen gjelder nå kun denne virksomheten', 'ok');
      load.reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Kunne ikke endre omfang', 'danger');
    } finally {
      setBusy(null);
    }
  };

  const suggested = d?.rules.filter((r) => r.status === 'suggested') ?? [];
  const active = d?.rules.filter((r) => r.status === 'active') ?? [];

  const RuleCard = ({ r, mode }: { r: LearnedRule; mode: 'suggested' | 'active' }) => (
    <li className={`health-item ${mode === 'suggested' ? 'info' : ''}`}>
      <div className="health-dot" aria-hidden="true" />
      <div className="health-body">
        <div className="health-title">
          {r.subjectLabel} → {r.targetLabel}
          <span className="code">{RULE_TYPE_LABEL[r.ruleType]}</span>
          <span className="code">{r.origin === 'system' ? 'lært av systemet' : 'manuell'}</span>
          <span className="code">{r.scopeLabel}</span>
        </div>
        <div className="health-detail">{r.rationale}</div>
        {r.examples.length > 0 && (
          <div className="hint" style={{ marginTop: 4 }}>
            Bygger på:{' '}
            {r.examples.map((e, i) => (
              <span key={i}>
                {e.documentId ? (
                  <button className="linklike" onClick={() => onOpenDocument(e.documentId!)}>{e.description}</button>
                ) : (
                  e.description
                )}
                {i < r.examples.length - 1 ? ', ' : ''}
              </span>
            ))}
          </div>
        )}
        {mode === 'active' && (
          <div className="hint" style={{ marginTop: 4 }}>
            {r.approvedBy ? `Godkjent av ${r.approvedBy}` : 'Godkjent'}
            {r.approvedAt ? ` ${nb(r.approvedAt.slice(0, 10))}` : ''} · Sist endret {nb(r.updatedAt.slice(0, 10))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {mode === 'suggested' ? (
          <>
            <button className="health-action" disabled={busy === r.id} onClick={() => act(r, 'approve')}>Godkjenn</button>
            <button className="secondary health-action" disabled={busy === r.id} onClick={() => act(r, 'dismiss')}>Avslå</button>
          </>
        ) : (
          <>
            {d?.groupId && (
              <button className="secondary health-action" disabled={busy === r.id}
                onClick={() => setScope(r, r.scope === 'group' ? 'organization' : 'group')}>
                {r.scope === 'group' ? 'Kun denne bedriften' : 'Gjelder konsernet'}
              </button>
            )}
            <button className="secondary health-action" disabled={busy === r.id} onClick={() => act(r, 'dismiss')}>Deaktiver</button>
          </>
        )}
      </div>
    </li>
  );

  return (
    <div>
      <div className="page-head">
        <h1>Lært praksis</h1>
        <p className="subtitle">
          Reknaren lærer bedriftens egen måte å bokføre på — men gjør den aldri til en universell regel. Alt er scopet til
          din virksomhet (eller ditt konsern), du godkjenner før noe brukes, og hver regel viser hva den bygger på.
        </p>
      </div>
      {load.error && <div className="error">{load.error}</div>}

      <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <p className="hint" style={{ margin: 0 }}>
          {d?.groupName ? `Konsern: ${d.groupName}.` : 'Ikke tilknyttet et konsern.'} Systemet kan foreslå regler ved å se
          etter mønstre i det du allerede har bokført.
        </p>
        <button disabled={busy === 'detect'} onClick={detect}>Lær av historikken</button>
      </div>

      {load.loading || !d ? (
        <div className="cards"><CardSkeleton /><CardSkeleton /></div>
      ) : (
        <>
          {suggested.length > 0 && (
            <div className="panel">
              <div className="panel-head">
                <h2>Foreslåtte regler</h2>
                <span className="confidence medium">{suggested.length}</span>
              </div>
              <p className="hint" style={{ marginTop: 0 }}>Systemet har sett et mønster. Godkjenn for å ta det i bruk, eller avslå.</p>
              <ul className="health-list">{suggested.map((r) => <RuleCard key={r.id} r={r} mode="suggested" />)}</ul>
            </div>
          )}

          <div className="panel">
            <div className="panel-head">
              <h2>Aktive regler</h2>
              <span className={`confidence ${active.length ? 'high' : 'medium'}`}>{active.length}</span>
            </div>
            {active.length === 0 ? (
              <p className="subtitle">Ingen aktive regler ennå. La systemet lære av historikken, eller legg til en regel manuelt nedenfor.</p>
            ) : (
              <ul className="health-list">{active.map((r) => <RuleCard key={r.id} r={r} mode="active" />)}</ul>
            )}
          </div>

          <div className="panel">
            <Disclosure label="Legg til regel manuelt">
              <ManualRuleForm orgId={orgId} onSaved={() => load.reload()} />
            </Disclosure>
          </div>

          {!d.groupId && (
            <div className="panel">
              <Disclosure label="Konsern">
                <GroupForm orgId={orgId} onSaved={() => load.reload()} />
              </Disclosure>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ManualRuleForm({ orgId, onSaved }: { orgId: string; onSaved: () => void }) {
  const toast = useToast();
  const [ruleType, setRuleType] = useState<LearnedRule['ruleType']>('account_mapping');
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [account, setAccount] = useState('');
  const [project, setProject] = useState('');
  const [role, setRole] = useState('accounting_manager');
  const [thresholdKr, setThresholdKr] = useState('20000');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { ruleType };
      if (ruleType === 'account_mapping') {
        body.subjectType = 'vendor'; body.subjectLabel = label; body.subjectKey = key || label.toLowerCase();
        body.target = { accountNumber: account };
      } else if (ruleType === 'project_mapping') {
        body.subjectType = 'customer'; body.subjectLabel = label; body.subjectKey = key || label.toLowerCase();
        body.target = { project: project.toUpperCase() };
      } else if (ruleType === 'approver_requirement') {
        body.subjectType = 'vendor'; body.subjectLabel = label; body.subjectKey = key || label.toLowerCase();
        body.target = { requiredRole: role };
      } else {
        body.subjectType = 'amount'; body.subjectLabel = `Kjøp over ${thresholdKr} kr`;
        body.target = { thresholdMinor: String(Math.round(Number(thresholdKr) * 100)), requiredRole: role };
      }
      await api('POST', `/api/organizations/${orgId}/learned-rules`, body);
      toast('Regel lagt til', 'ok');
      setLabel(''); setKey(''); setAccount(''); setProject('');
      onSaved();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Kunne ikke lagre', 'danger');
    } finally {
      setBusy(false);
    }
  };

  const needsSubject = ruleType !== 'threshold_approval';
  return (
    <div className="form-grid">
      <div>
        <label htmlFor="mr-type">Type</label>
        <select id="mr-type" value={ruleType} onChange={(e) => setRuleType(e.target.value as LearnedRule['ruleType'])}>
          {(Object.keys(RULE_TYPE_LABEL) as LearnedRule['ruleType'][]).map((t) => <option key={t} value={t}>{RULE_TYPE_LABEL[t]}</option>)}
        </select>
      </div>
      {needsSubject && (
        <>
          <div>
            <label htmlFor="mr-label">{ruleType === 'project_mapping' ? 'Kunde' : 'Leverandør'}</label>
            <input id="mr-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="f.eks. Telia" />
          </div>
          <div>
            <label htmlFor="mr-key">Nøkkel (org.nr eller navn)</label>
            <input id="mr-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="valgfritt — navn brukes ellers" />
          </div>
        </>
      )}
      {ruleType === 'account_mapping' && (
        <div>
          <label htmlFor="mr-account">Konto</label>
          <input id="mr-account" value={account} onChange={(e) => setAccount(e.target.value)} placeholder="f.eks. 6900" />
        </div>
      )}
      {ruleType === 'project_mapping' && (
        <div>
          <label htmlFor="mr-project">Prosjektkode</label>
          <input id="mr-project" value={project} onChange={(e) => setProject(e.target.value)} placeholder="f.eks. PROSJEKT-A" />
        </div>
      )}
      {ruleType === 'threshold_approval' && (
        <div>
          <label htmlFor="mr-threshold">Beløpsgrense (kr)</label>
          <input id="mr-threshold" type="number" value={thresholdKr} onChange={(e) => setThresholdKr(e.target.value)} />
        </div>
      )}
      {(ruleType === 'approver_requirement' || ruleType === 'threshold_approval') && (
        <div>
          <label htmlFor="mr-role">Må godkjennes av</label>
          <select id="mr-role" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )}
      <div style={{ gridColumn: '1 / -1' }}>
        <button disabled={busy} onClick={save}>Legg til regel</button>
      </div>
    </div>
  );
}

function GroupForm({ orgId, onSaved }: { orgId: string; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api('POST', `/api/organizations/${orgId}/organization-groups`, { name });
      toast('Konsern opprettet — denne virksomheten er tilknyttet', 'ok');
      onSaved();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Kunne ikke opprette konsern', 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <p className="hint" style={{ marginTop: 0 }}>
        Et konsern lar flere virksomheter dele lærte regler. Regler kan så settes til å gjelde hele konsernet eller kun én bedrift.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Konsernnavn, f.eks. Mediehuset AS" />
        <button disabled={busy || !name.trim()} onClick={save}>Opprett konsern</button>
      </div>
    </div>
  );
}

/* ── Faste utgifter / abonnementsvakt ───────────────────────────────────── */

interface RecurringItem {
  ruleId: string; vendor: string; cadence: string; channel: 'auto' | 'manual';
  accountNumber: string | null; minSideUrl: string | null; connectorId: string | null;
  expectedAmountMinor: string;
  overdue: { period: string; dueDate: string; inInbox: boolean }[];
  dueSoon: { period: string; dueDate: string }[];
  anomalies: { period: string; bookedMinor: string; expectedMinor: string }[];
}
interface RecurringResp {
  asOf: string; overdueCount: number; overdueAmountMinor: string;
  items: RecurringItem[];
  expectations: { id: string; subjectLabel: string; status: string; targetLabel: string; rationale: string; origin: string }[];
}

export function RecurringScreen({ orgId }: { orgId: string }) {
  const load = useLoad(() => api<RecurringResp>('GET', `/api/organizations/${orgId}/recurring`), [orgId]);
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const d = load.data;

  const detect = async () => {
    setBusy('detect');
    try {
      const r = await api<{ proposed: number }>('POST', `/api/organizations/${orgId}/recurring/detect`, {});
      toast(r.proposed > 0 ? `Fant ${r.proposed} ny(e) faste utgifter å bekrefte` : 'Ingen nye faste mønstre funnet', 'ok');
      load.reload();
    } catch (err) { toast(err instanceof ApiError ? err.message : 'Kunne ikke lære', 'danger'); } finally { setBusy(null); }
  };
  const approve = async (id: string) => {
    setBusy(id);
    try { await api('POST', `/api/organizations/${orgId}/learned-rules/${id}/approve`, {}); toast('Bekreftet — vaktposten overvåker den nå', 'ok'); load.reload(); }
    catch (err) { toast(err instanceof ApiError ? err.message : 'Feilet', 'danger'); } finally { setBusy(null); }
  };
  const resolve = async (ruleId: string, period: string, status: 'handled' | 'snoozed' | 'dismissed') => {
    setBusy(ruleId + period);
    try {
      const body: Record<string, unknown> = { period, status };
      if (status === 'snoozed') { const dt = new Date(); dt.setMonth(dt.getMonth() + 1); body.snoozeUntil = dt.toISOString().slice(0, 10); }
      await api('POST', `/api/organizations/${orgId}/recurring/${ruleId}/resolve`, body);
      toast(status === 'handled' ? 'Markert håndtert' : status === 'snoozed' ? 'Utsatt en måned' : 'Avvist for perioden', 'ok');
      load.reload();
    } catch (err) { toast(err instanceof ApiError ? err.message : 'Feilet', 'danger'); } finally { setBusy(null); }
  };
  const fetchInvoice = async (it: RecurringItem) => {
    if (it.minSideUrl) window.open(it.minSideUrl, '_blank');
    setBusy(it.ruleId + 'fetch');
    try {
      const r = await api<{ mode: string; message?: string; imported?: number }>('POST', `/api/organizations/${orgId}/recurring/${it.ruleId}/fetch`, {});
      toast(r.mode === 'connector' ? `Hentet automatisk: ${r.imported ?? 0} bilag` : (r.message ?? 'Hent fakturaen manuelt fra Min side'), 'ok');
      load.reload();
    } catch (err) { toast(err instanceof ApiError ? err.message : 'Feilet', 'danger'); } finally { setBusy(null); }
  };

  const deactivate = async (id: string, label: string) => {
    if (!window.confirm(`Skru av overvåking av «${label}»? Vaktposten slutter å minne deg om den. Du kan alltid lære den på nytt senere.`)) return;
    setBusy(id);
    try {
      await api('POST', `/api/organizations/${orgId}/learned-rules/${id}/dismiss`, {});
      toast(`Skrudd av — «${label}» overvåkes ikke lenger`, 'ok');
      load.reload();
    } catch (err) { toast(err instanceof ApiError ? err.message : 'Feilet', 'danger'); } finally { setBusy(null); }
  };

  const suggested = d?.expectations.filter((e) => e.status === 'suggested') ?? [];
  const active = d?.expectations.filter((e) => e.status === 'active') ?? [];
  const overdueItems = d?.items.filter((i) => i.overdue.length) ?? [];
  const dueSoonItems = d?.items.filter((i) => i.dueSoon.length && !i.overdue.length) ?? [];
  const anomalyItems = d?.items.filter((i) => i.anomalies.length) ?? [];

  return (
    <div>
      <div className="page-head">
        <h1>Faste utgifter</h1>
        <p className="subtitle">
          Vaktposten lærer de faste kostnadene dine (abonnementer, telefon, internett) og sier fra når en forventet
          faktura uteblir — så du ikke glemmer å hente og bokføre den. Bygger på den samme lærings-motoren.
        </p>
      </div>
      {load.error && <div className="error">{load.error}</div>}

      <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <p className="hint" style={{ margin: 0 }}>
          {d && d.overdueCount > 0 ? <><b>{d.overdueCount}</b> forventede faste utgifter mangler (~{kr(d.overdueAmountMinor)} ubokført).</> : 'Alt ser à jour ut.'}
        </p>
        <button disabled={busy === 'detect'} onClick={detect}>Lær faste utgifter</button>
      </div>

      {load.loading || !d ? (
        <div className="cards"><CardSkeleton /><CardSkeleton /></div>
      ) : (
        <>
          {suggested.length > 0 && (
            <div className="panel">
              <div className="panel-head"><h2>Foreslåtte faste utgifter</h2><span className="confidence medium">{suggested.length}</span></div>
              <p className="hint" style={{ marginTop: 0 }}>Bekreft for at vaktposten skal overvåke at de kommer hver periode.</p>
              <ul className="health-list">
                {suggested.map((e) => (
                  <li key={e.id} className="health-item info">
                    <div className="health-dot" aria-hidden="true" />
                    <div className="health-body">
                      <div className="health-title">{e.subjectLabel} <span className="code">{e.targetLabel}</span></div>
                      <div className="health-detail">{e.rationale}</div>
                    </div>
                    <button className="health-action" disabled={busy === e.id} onClick={() => approve(e.id)}>Bekreft</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {active.length > 0 && (
            <div className="panel">
              <Disclosure label={`Overvåkes nå (${active.length})`}>
                <p className="hint" style={{ marginTop: 0 }}>
                  Dette er de faste utgiftene vaktposten følger. Slutter du å bruke en leverandør, skru den av så du ikke får unødige påminnelser.
                </p>
                <ul className="health-list">
                  {active.map((e) => (
                    <li key={e.id} className="health-item">
                      <div className="health-dot" aria-hidden="true" />
                      <div className="health-body">
                        <div className="health-title">{e.subjectLabel} <span className="code">{e.targetLabel}</span></div>
                        <div className="health-detail">{e.rationale}</div>
                      </div>
                      <button className="secondary health-action" disabled={busy === e.id} onClick={() => deactivate(e.id, e.subjectLabel)}>Skru av</button>
                    </li>
                  ))}
                </ul>
              </Disclosure>
            </div>
          )}

          {overdueItems.length > 0 && (
            <div className="panel">
              <div className="panel-head"><h2>Mangler — forfalt</h2><span className="confidence low">{d.overdueCount}</span></div>
              <ul className="health-list">
                {overdueItems.map((it) => (
                  <li key={it.ruleId} className="health-item warning">
                    <div className="health-dot" aria-hidden="true" />
                    <div className="health-body">
                      <div className="health-title">
                        {it.vendor} <span className="code">{it.channel === 'manual' ? 'hent fra Min side' : 'kommer automatisk'}</span>
                        {it.accountNumber && <span className="code">konto {it.accountNumber}</span>}
                      </div>
                      <div className="health-detail">
                        Mangler: {it.overdue.map((o) => o.period).join(', ')} · forventet ~{kr(it.expectedAmountMinor)}/gang
                      </div>
                      <div className="chips" style={{ marginTop: 8 }}>
                        {it.overdue.slice(0, 6).map((o) => (
                          <span key={o.period} className="chip" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            {o.period}{o.inInbox ? ' (i innboks)' : ''}
                            <button className="linklike" onClick={() => resolve(it.ruleId, o.period, 'handled')} title="Håndtert">✓</button>
                            <button className="linklike" onClick={() => resolve(it.ruleId, o.period, 'snoozed')} title="Utsett 1 mnd">⏰</button>
                            <button className="linklike" onClick={() => resolve(it.ruleId, o.period, 'dismissed')} title="Ikke relevant">✕</button>
                          </span>
                        ))}
                      </div>
                    </div>
                    <button className="health-action" disabled={busy === it.ruleId + 'fetch'} onClick={() => fetchInvoice(it)}>
                      {it.connectorId ? 'Hent automatisk' : 'Hent faktura'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {anomalyItems.length > 0 && (
            <div className="panel">
              <div className="panel-head"><h2>Beløpsavvik</h2><span className="confidence medium">{anomalyItems.length}</span></div>
              <ul className="health-list">
                {anomalyItems.map((it) => (
                  <li key={it.ruleId} className="health-item info">
                    <div className="health-dot" aria-hidden="true" />
                    <div className="health-body">
                      <div className="health-title">{it.vendor}</div>
                      {it.anomalies.map((a) => (
                        <div key={a.period} className="health-detail">{a.period}: bokført {kr(a.bookedMinor)} vs. forventet ~{kr(a.expectedMinor)} — sjekk</div>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {dueSoonItems.length > 0 && (
            <div className="panel">
              <Disclosure label={`Kommer snart (${dueSoonItems.length})`}>
                <ul className="health-list">
                  {dueSoonItems.map((it) => (
                    <li key={it.ruleId} className="health-item">
                      <div className="health-dot" aria-hidden="true" />
                      <div className="health-body">
                        <div className="health-title">{it.vendor} <span className="code">{it.channel === 'manual' ? 'hent fra Min side' : 'auto'}</span></div>
                        <div className="health-detail">Neste: {it.dueSoon.map((s) => s.dueDate).join(', ')} · ~{kr(it.expectedAmountMinor)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Disclosure>
            </div>
          )}

          {overdueItems.length === 0 && suggested.length === 0 && anomalyItems.length === 0 && active.length === 0 && (
            <div className="panel"><p className="subtitle">Ingen faste utgifter registrert ennå. Trykk «Lær faste utgifter» for å oppdage mønstre i det du allerede har bokført.</p></div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Betalingskalender ──────────────────────────────────────────────────── */

interface CalEvent {
  date: string;
  kind: 'paid' | 'recurring' | 'vat' | 'tax' | 'invoice_in';
  direction: 'in' | 'out';
  label: string;
  amountMinor: string;
  status: 'paid' | 'expected' | 'overdue';
  vendor?: string;
}
interface CalResp { from: string; to: string; asOf: string; events: CalEvent[] }

const KIND_LABEL: Record<CalEvent['kind'], string> = {
  paid: 'Betalt/ført',
  recurring: 'Fast utgift',
  vat: 'MVA',
  tax: 'Skatt',
  invoice_in: 'Kundefaktura',
};
const MONTH_NB = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
function monthKey(iso: string) { return iso.slice(0, 7); }
function monthTitle(key: string) { const [y, m] = key.split('-'); return `${MONTH_NB[Number(m) - 1]} ${y}`; }

export function PaymentCalendarScreen({ orgId }: { orgId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(new Date(Date.parse(today + 'T00:00:00Z') + 120 * 86400000).toISOString().slice(0, 10));
  const load = useLoad(() => api<CalResp>('GET', `/api/organizations/${orgId}/payment-calendar?from=${from}&to=${to}`), [orgId, from, to]);
  const d = load.data;

  const events = d?.events ?? [];
  const paidOutMinor = events.filter((e) => e.status === 'paid').reduce((s, e) => s + BigInt(e.amountMinor), 0n);
  const expectedOutMinor = events.filter((e) => e.status !== 'paid' && e.direction === 'out').reduce((s, e) => s + BigInt(e.amountMinor), 0n);
  const overdue = events.filter((e) => e.status === 'overdue');

  // Grupper på måned, bevar sortering.
  const months: { key: string; events: CalEvent[] }[] = [];
  for (const e of events) {
    const k = monthKey(e.date);
    let g = months.find((m) => m.key === k);
    if (!g) { g = { key: k, events: [] }; months.push(g); }
    g.events.push(e);
  }

  const rowTone = (e: CalEvent) => (e.status === 'overdue' ? 'warning' : e.status === 'expected' ? 'info' : '');
  const nowKey = monthKey(today);

  return (
    <div>
      <div className="page-head">
        <h1>Betalingskalender</h1>
        <p className="subtitle">
          Én tidslinje over det som er betalt (bakover) og det som kommer (framover): faste utgifter, MVA- og
          skatteforfall, og forfalte kundefakturaer. De færreste regnskapssystemer viser deg dette samlet.
        </p>
      </div>
      {load.error && <div className="error">{load.error}</div>}

      <div className="panel" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Fra
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={{ width: 'auto' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Til
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} style={{ width: 'auto' }} />
        </label>
        <div className="spacer" style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 24 }}>
          <div><div className="hint" style={{ margin: 0 }}>Betalt i perioden</div><b>{kr(paidOutMinor.toString())}</b></div>
          <div><div className="hint" style={{ margin: 0 }}>Ventet framover</div><b>{kr(expectedOutMinor.toString())}</b></div>
          <div><div className="hint" style={{ margin: 0 }}>Forfalt</div><b className={overdue.length ? 'neg' : undefined}>{overdue.length}</b></div>
        </div>
      </div>

      {load.loading || !d ? (
        <div className="cards"><CardSkeleton /><CardSkeleton /></div>
      ) : events.length === 0 ? (
        <div className="panel"><p className="subtitle">Ingen hendelser i valgt periode. Bokfør kostnader eller bekreft faste utgifter for å fylle kalenderen.</p></div>
      ) : (
        months.map((g) => (
          <div className="panel" key={g.key}>
            <div className="panel-head">
              <h2>{monthTitle(g.key)}{g.key === nowKey && <span className="code" style={{ marginLeft: 8 }}>nå</span>}</h2>
            </div>
            <ul className="health-list">
              {g.events.map((e, i) => (
                <li key={`${e.date}-${i}`} className={`health-item ${rowTone(e)}`}>
                  <div className="health-dot" aria-hidden="true" />
                  <div className="health-body">
                    <div className="health-title">
                      <span className="code">{e.date.slice(8, 10)}.</span> {e.label}
                      <span className="code">{KIND_LABEL[e.kind]}</span>
                      {e.status === 'overdue' && <span className="code">forfalt</span>}
                      {e.status === 'expected' && <span className="code">forventet</span>}
                    </div>
                  </div>
                  <div className={`num ${e.direction === 'in' ? 'pos' : ''}`} style={{ fontWeight: 600 }}>
                    {e.direction === 'in' ? '+' : '−'}{kr(e.amountMinor)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

/* ── Åpent integrasjonslag (API-nøkler + webhooks) ──────────────────────── */

interface ApiKeyDto { id: string; name: string; keyPrefix: string; scopes: string[]; createdAt: string; lastUsedAt: string | null; revokedAt: string | null }
interface WebhookDto { id: string; url: string; events: string[]; description: string | null; active: boolean; createdAt: string }
interface DeliveryDto { id: string; event: string; status: string; attempts: number; url: string; responseStatus: number | null; createdAt: string; lastAttemptAt: string | null }

const API_SCOPES: { value: string; label: string }[] = [
  { value: 'reports.view', label: 'Lese regnskap/rapporter (konti, bilag, SAF-T)' },
  { value: 'invoices.view', label: 'Lese fakturaer' },
  { value: 'vat.view', label: 'Lese MVA-rapport' },
  { value: 'documents.view', label: 'Lese bilag' },
  { value: 'audit.view', label: 'Lese revisjonslogg' },
];
const WEBHOOK_EVENT_OPTS = ['invoice.issued', 'invoice.paid', 'journal_entry.posted', 'document.received', 'saft.exported', 'vat_report.ready'];

export function IntegrationsScreen({ orgId }: { orgId: string }) {
  const keys = useLoad(() => api<ApiKeyDto[]>('GET', `/api/organizations/${orgId}/api-keys`), [orgId]);
  const hooks = useLoad(() => api<WebhookDto[]>('GET', `/api/organizations/${orgId}/webhooks`), [orgId]);
  const deliveries = useLoad(() => api<DeliveryDto[]>('GET', `/api/organizations/${orgId}/webhook-deliveries`), [orgId]);
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<{ kind: 'key' | 'webhook'; value: string } | null>(null);

  // API-nøkkel-skjema
  const [keyName, setKeyName] = useState('');
  const [keyScopes, setKeyScopes] = useState<string[]>(['reports.view']);
  const toggleScope = (s: string) => setKeyScopes((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  const createKey = async () => {
    setBusy('key');
    try {
      const res = await api<{ secret: string }>('POST', `/api/organizations/${orgId}/api-keys`, { name: keyName, scopes: keyScopes });
      setNewSecret({ kind: 'key', value: res.secret });
      setKeyName('');
      keys.reload();
    } catch (err) { toast(err instanceof ApiError ? err.message : 'Kunne ikke opprette nøkkel', 'danger'); } finally { setBusy(null); }
  };
  const revokeKey = async (id: string) => {
    setBusy(id);
    try { await api('DELETE', `/api/organizations/${orgId}/api-keys/${id}`); toast('Nøkkel tilbakekalt', 'ok'); keys.reload(); }
    catch (err) { toast(err instanceof ApiError ? err.message : 'Feilet', 'danger'); } finally { setBusy(null); }
  };

  // Webhook-skjema
  const [hookUrl, setHookUrl] = useState('');
  const [hookEvents, setHookEvents] = useState<string[]>(['invoice.issued']);
  const toggleEvent = (e: string) => setHookEvents((p) => (p.includes(e) ? p.filter((x) => x !== e) : [...p, e]));
  const createHook = async () => {
    setBusy('hook');
    try {
      const res = await api<{ secret: string }>('POST', `/api/organizations/${orgId}/webhooks`, { url: hookUrl, events: hookEvents });
      setNewSecret({ kind: 'webhook', value: res.secret });
      setHookUrl('');
      hooks.reload();
    } catch (err) { toast(err instanceof ApiError ? err.message : 'Kunne ikke opprette webhook', 'danger'); } finally { setBusy(null); }
  };
  const testHook = async (id: string) => {
    setBusy(id);
    try { const r = await api<{ delivered: boolean }>('POST', `/api/organizations/${orgId}/webhooks/${id}/test`, {}); toast(r.delivered ? 'Testhendelse levert ✓' : 'Levering feilet — sjekk endepunktet', r.delivered ? 'ok' : 'danger'); deliveries.reload(); }
    catch (err) { toast(err instanceof ApiError ? err.message : 'Feilet', 'danger'); } finally { setBusy(null); }
  };
  const deleteHook = async (id: string) => {
    setBusy(id);
    try { await api('DELETE', `/api/organizations/${orgId}/webhooks/${id}`); toast('Webhook slettet', 'ok'); hooks.reload(); }
    catch (err) { toast(err instanceof ApiError ? err.message : 'Feilet', 'danger'); } finally { setBusy(null); }
  };

  const activeKeys = keys.data?.filter((k) => !k.revokedAt) ?? [];
  return (
    <div>
      <div className="page-head">
        <h1>API og integrasjoner</h1>
        <p className="subtitle">
          Åpent integrasjonslag: gi eksterne systemer scopet, tilbakekallbar tilgang til regnskapet, og få hendelser
          levert via webhooks. Standard eksportformater: SAF-T Financial 1.40 og EHF/PEPPOL.
        </p>
      </div>

      {newSecret && (
        <div className="panel" style={{ borderColor: 'var(--accent)' }}>
          <div className="panel-head"><h2>{newSecret.kind === 'key' ? 'Din nye API-nøkkel' : 'Webhook-hemmelighet'}</h2></div>
          <p className="hint" style={{ marginTop: 0 }}>Kopier den nå — den vises kun denne ene gangen og lagres aldri i klartekst.</p>
          <code className="secret-reveal">{newSecret.value}</code>
          <div style={{ marginTop: 10 }}><button className="secondary" onClick={() => setNewSecret(null)}>Jeg har kopiert den</button></div>
        </div>
      )}

      {/* API-nøkler */}
      <div className="panel">
        <div className="panel-head"><h2>API-nøkler</h2><span className="confidence medium">{activeKeys.length}</span></div>
        <div className="form-grid">
          <div>
            <label htmlFor="key-name">Navn</label>
            <input id="key-name" value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="f.eks. Power BI, egen portal" />
          </div>
          <div>
            <label>Tilgang (scope)</label>
            <div className="chips">
              {API_SCOPES.map((s) => (
                <label key={s.value} className={`chip${keyScopes.includes(s.value) ? ' active' : ''}`} style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={keyScopes.includes(s.value)} onChange={() => toggleScope(s.value)} style={{ marginRight: 6 }} />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <button disabled={busy === 'key' || !keyName.trim() || keyScopes.length === 0} onClick={createKey}>Opprett API-nøkkel</button>
          </div>
        </div>
        {activeKeys.length > 0 && (
          <ul className="health-list" style={{ marginTop: 12 }}>
            {activeKeys.map((k) => (
              <li key={k.id} className="health-item">
                <div className="health-dot" aria-hidden="true" />
                <div className="health-body">
                  <div className="health-title"><code>{k.keyPrefix}…</code> {k.name}</div>
                  <div className="health-detail">{k.scopes.join(', ')}</div>
                  <div className="hint">Sist brukt: {k.lastUsedAt ? nb(k.lastUsedAt.slice(0, 10)) : 'aldri'}</div>
                </div>
                <button className="secondary health-action" disabled={busy === k.id} onClick={() => revokeKey(k.id)}>Tilbakekall</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Webhooks */}
      <div className="panel">
        <div className="panel-head"><h2>Webhooks</h2><span className="confidence medium">{hooks.data?.length ?? 0}</span></div>
        <div className="form-grid">
          <div style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="hook-url">Endepunkt-URL (https)</label>
            <input id="hook-url" value={hookUrl} onChange={(e) => setHookUrl(e.target.value)} placeholder="https://ditt-system.no/webhooks/reknaren" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label>Hendelser</label>
            <div className="chips">
              {WEBHOOK_EVENT_OPTS.map((e) => (
                <label key={e} className={`chip${hookEvents.includes(e) ? ' active' : ''}`} style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={hookEvents.includes(e)} onChange={() => toggleEvent(e)} style={{ marginRight: 6 }} />
                  {e}
                </label>
              ))}
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <button disabled={busy === 'hook' || !hookUrl.trim() || hookEvents.length === 0} onClick={createHook}>Legg til webhook</button>
          </div>
        </div>
        {hooks.data && hooks.data.length > 0 && (
          <ul className="health-list" style={{ marginTop: 12 }}>
            {hooks.data.map((h) => (
              <li key={h.id} className="health-item">
                <div className="health-dot" aria-hidden="true" />
                <div className="health-body">
                  <div className="health-title">{h.url}</div>
                  <div className="health-detail">{h.events.join(', ')}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="secondary health-action" disabled={busy === h.id} onClick={() => testHook(h.id)}>Test</button>
                  <button className="secondary health-action" disabled={busy === h.id} onClick={() => deleteHook(h.id)}>Slett</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Kilder (inngående connectorer) */}
      <ConnectorsPanel orgId={orgId} />

      {/* Leveranselogg */}
      {deliveries.data && deliveries.data.length > 0 && (
        <div className="panel">
          <Disclosure label={`Leveranselogg (${deliveries.data.length})`}>
            <table className="data-table">
              <thead><tr><th>Hendelse</th><th>Status</th><th>Forsøk</th><th>Svar</th><th>Tid</th></tr></thead>
              <tbody>
                {deliveries.data.map((d) => (
                  <tr key={d.id}>
                    <td>{d.event}</td>
                    <td><span className={`confidence ${d.status === 'delivered' ? 'high' : d.status === 'failed' ? 'low' : 'medium'}`}>{d.status}</span></td>
                    <td>{d.attempts}</td>
                    <td>{d.responseStatus ?? '—'}</td>
                    <td>{nb(d.createdAt.slice(0, 10))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Disclosure>
        </div>
      )}

      {/* Oppdagelse / dokumentasjon */}
      <div className="panel">
        <Disclosure label="Slik bruker du API-et">
          <div className="hint">
            <p>Autentiser med <code>Authorization: Bearer rk_live_…</code>. Basis-URL: <code>/api/v1/organizations/&lt;orgId&gt;/…</code></p>
            <ul>
              <li><code>GET /accounts</code>, <code>/customers</code>, <code>/suppliers</code></li>
              <li><code>GET /journal-entries?from&amp;to&amp;limit&amp;offset</code></li>
              <li><code>GET /invoices</code>, <code>GET /vat-report?from&amp;to</code></li>
              <li><code>GET /saf-t?from&amp;to</code> → SAF-T Financial 1.40 (XML)</li>
            </ul>
            <p>Webhooks signeres med <code>X-Reknaren-Signature: sha256=&lt;HMAC av råkroppen med webhook-hemmeligheten&gt;</code>. Se <code>GET /api/v1</code> for full oppdagelse.</p>
            <p><strong>AI / MCP:</strong> AI-assistenter (Claude m.fl.) kan koble seg på <code>POST /mcp</code> (Model Context Protocol) med samme API-nøkkel og få scopede verktøy — les konti/bilag/rapporter/SAF-T og «spør virksomheten». Kun lesing og forslag; posteringer krever fortsatt godkjenning i appen.</p>
          </div>
        </Disclosure>
      </div>
    </div>
  );
}

interface ConnectorStatus { id: string; label: string; description: string; configured: boolean; connected: boolean; lastSyncAt: string | null }

function ConnectorsPanel({ orgId }: { orgId: string }) {
  const conns = useLoad(() => api<ConnectorStatus[]>('GET', `/api/organizations/${orgId}/connectors`), [orgId]);
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (id: string, action: 'connect' | 'sync' | 'disconnect') => {
    setBusy(id + action);
    try {
      const r = await api<{ imported?: number; skipped?: number }>('POST', `/api/organizations/${orgId}/connectors/${id}/${action}`, {});
      toast(
        action === 'sync' ? `Synk ferdig: ${r.imported ?? 0} nye bilag, ${r.skipped ?? 0} hoppet over` : action === 'connect' ? 'Kilde koblet på' : 'Kilde koblet fra',
        'ok',
      );
      conns.reload();
    } catch (err) { toast(err instanceof ApiError ? err.message : 'Handlingen feilet', 'danger'); } finally { setBusy(null); }
  };
  return (
    <div className="panel">
      <div className="panel-head"><h2>Kilder (inngående)</h2><span className="confidence medium">{conns.data?.filter((c) => c.connected).length ?? 0}</span></div>
      <p className="hint" style={{ marginTop: 0 }}>Hent transaksjoner/bilag fra eksterne kilder inn i bilagsinnboksen. Ingenting bokføres automatisk — det havner som bilag til godkjenning.</p>
      {conns.data && (
        <ul className="health-list">
          {conns.data.map((c) => (
            <li key={c.id} className="health-item">
              <div className="health-dot" aria-hidden="true" />
              <div className="health-body">
                <div className="health-title">{c.label}{!c.configured && <span className="code">ikke konfigurert</span>}{c.connected && <span className="code">tilkoblet</span>}</div>
                <div className="health-detail">{c.description}</div>
                {c.lastSyncAt && <div className="hint">Sist synket: {nb(c.lastSyncAt.slice(0, 10))}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {!c.connected ? (
                  <button className="health-action" disabled={!c.configured || busy === c.id + 'connect'} onClick={() => act(c.id, 'connect')}>Koble på</button>
                ) : (
                  <>
                    <button className="health-action" disabled={busy === c.id + 'sync'} onClick={() => act(c.id, 'sync')}>Synk nå</button>
                    <button className="secondary health-action" disabled={busy === c.id + 'disconnect'} onClick={() => act(c.id, 'disconnect')}>Koble fra</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Smart dokumentjakt ─────────────────────────────────────────────────── */

interface DocCandidate {
  documentId: string;
  vendor: string | null;
  dateText: string | null;
  grossMinor: string;
  score: number;
  reasons: string[];
}
interface PaymentGap {
  transactionId: string;
  bookedDate: string;
  amountMinor: string;
  description: string;
  counterparty: string | null;
  candidates: DocCandidate[];
}
interface DocumentHunt {
  paymentsMissingDoc: number;
  gapsWithCandidates: number;
  gaps: PaymentGap[];
}
interface LinkPreview {
  accountNumber: string;
  accountName: string;
  vatCode: string;
  vatCodeName: string;
  netMinor: string;
  vatMinor: string;
  grossMinor: string;
}

export function DocumentHuntScreen({ orgId, onOpenDocument, onNavigate, embedded }: { orgId: string; onOpenDocument: (id: string) => void; onNavigate?: (s: string) => void; embedded?: boolean }) {
  const h = useLoad(() => api<DocumentHunt>('GET', `/api/organizations/${orgId}/document-hunt`), [orgId]);
  const d = h.data;
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, LinkPreview | 'loading'>>({});
  const abs = (s: string) => s.replace('-', '');
  const forhaandsvis = async (transactionId: string, documentId: string) => {
    setPreviews((p) => ({ ...p, [documentId]: 'loading' }));
    try {
      const pv = await api<LinkPreview>(
        'GET',
        `/api/organizations/${orgId}/document-hunt/link-preview?transactionId=${transactionId}&documentId=${documentId}`,
      );
      setPreviews((p) => ({ ...p, [documentId]: pv }));
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Kunne ikke forhåndsvise', 'danger');
      setPreviews((p) => {
        const n = { ...p };
        delete n[documentId];
        return n;
      });
    }
  };
  const koble = async (transactionId: string, documentId: string) => {
    setBusy(documentId);
    try {
      const r = await api<{ entryNumber: number; accountNumber: string }>(
        'POST',
        `/api/organizations/${orgId}/document-hunt/link`,
        { transactionId, documentId },
      );
      toast(`Koblet og bokført som bilag nr. ${r.entryNumber} (konto ${r.accountNumber}).`, 'ok');
      h.reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Kunne ikke koble', 'danger');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div>
      {embedded ? (
        <>
          <h2 style={{ marginTop: 24 }}>Dokumentjakt</h2>
          <p className="subtitle" style={{ marginTop: 0 }}>Betalinger uten bilag koblet mot sannsynlige fakturaer vi allerede har hentet inn.</p>
        </>
      ) : (
        <div className="page-head">
          <h1>Dokumentjakt</h1>
          <p className="subtitle">
            Reknaren leter på tvers av kildene: betalinger uten bilag koblet mot sannsynlige fakturaer vi allerede har hentet inn.
          </p>
        </div>
      )}
      {h.loading ? (
        <div className="cards"><CardSkeleton /><CardSkeleton /></div>
      ) : (
        d && (
          <>
            {d.gaps.length === 0 ? (
              <div className="panel">
                <p className="subtitle">
                  {d.paymentsMissingDoc === 0
                    ? 'Alle betalinger har et bilag knyttet til seg. 🎉'
                    : `${d.paymentsMissingDoc} betaling(er) mangler bilag, men vi fant ingen sannsynlig faktura ennå. Skann e-post eller last opp bilaget.`}
                </p>
                {d.paymentsMissingDoc > 0 && onNavigate && (
                  <div className="actions">
                    <button className="secondary" onClick={() => onNavigate('gmail')}>Skann e-post</button>
                    <button className="secondary" onClick={() => onNavigate('bank')}>Se bank</button>
                  </div>
                )}
              </div>
            ) : (
              d.gaps.map((g) => {
                const top = g.candidates[0]!;
                return (
                  <div className="panel" key={g.transactionId}>
                    <div className="panel-head">
                      <h2>
                        Betaling til {g.counterparty ?? g.description} · {kr(abs(g.amountMinor))} kr
                      </h2>
                      <span className="confidence low">Mangler bilag</span>
                    </div>
                    <p className="subtitle">
                      Bokført {nb(g.bookedDate)} · «{g.description}». Vi fant en sannsynlig faktura — skal den kobles til betalingen?
                    </p>
                    {g.candidates.map((c, i) => (
                      <div key={i} className="panel impact" style={{ marginTop: 10 }}>
                        <div className="panel-head">
                          <strong>
                            {c.vendor ?? 'Bilag'} · {kr(c.grossMinor)} kr{c.dateText ? ` · ${nb(c.dateText)}` : ''}
                          </strong>
                          <span className={`confidence ${c.score >= 90 ? 'high' : 'medium'}`}>{c.score}% treff</span>
                        </div>
                        <ul className="compact">
                          {c.reasons.map((r, j) => (
                            <li key={j}>{r}</li>
                          ))}
                        </ul>
                        {(() => {
                          const pv = previews[c.documentId];
                          if (pv && pv !== 'loading') {
                            return (
                              <>
                                <dl className="kv" style={{ marginTop: 10 }}>
                                  <dt>Foreslått konto</dt>
                                  <dd>{pv.accountNumber} {pv.accountName}</dd>
                                  <dt>MVA-kode</dt>
                                  <dd>{pv.vatCodeName} <span className="code">kode {pv.vatCode}</span></dd>
                                  <dt>Kostnad</dt>
                                  <dd>{kr(pv.netMinor)} kr</dd>
                                  {BigInt(pv.vatMinor) > 0n && (
                                    <>
                                      <dt>Inngående MVA</dt>
                                      <dd className="pos">{kr(pv.vatMinor)} kr</dd>
                                    </>
                                  )}
                                </dl>
                                <p className="hint">Utledet av regelmotoren fra bilaget. Kontroller før du bekrefter — alt er reversibelt.</p>
                                <div className="actions">
                                  <button className="primary" disabled={busy === c.documentId} onClick={() => koble(g.transactionId, c.documentId)}>
                                    {busy === c.documentId ? 'Bokfører …' : 'Bekreft kobling'}
                                  </button>
                                  <button className="secondary" onClick={() => onOpenDocument(c.documentId)}>Se fakturaen</button>
                                </div>
                              </>
                            );
                          }
                          return (
                            <div className="actions">
                              <button className="primary" disabled={pv === 'loading'} onClick={() => forhaandsvis(g.transactionId, c.documentId)}>
                                {pv === 'loading' ? 'Henter …' : 'Forhåndsvis kobling'}
                              </button>
                              <button className="secondary" onClick={() => onOpenDocument(c.documentId)}>Se fakturaen</button>
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </>
        )
      )}
    </div>
  );
}

/* ── Avtaler / inntektsplaner ───────────────────────────────────────────── */

interface AgreementReview {
  agreement: {
    id: string; customerName: string; name: string; amountMinor: string; cadence: string;
    startDate: string; endDate: string | null; noticeMonths: number; status: string;
  };
  periodsDue: number;
  expectedInvoicedMinor: string;
  actualInvoicedMinor: string;
  gapMinor: string;
  nextInvoiceDates: string[];
  noticeDeadline: string | null;
  flags: string[];
}

const CADENCE_LABEL: Record<string, string> = { monthly: 'månedlig', quarterly: 'kvartalsvis', yearly: 'årlig', one_time: 'engangs' };
const FLAG_LABEL: Record<string, { label: string; cls: string }> = {
  ikke_fakturert: { label: 'Ikke fakturert', cls: 'low' },
  underfakturert: { label: 'Underfakturert', cls: 'medium' },
  overfakturert: { label: 'Overfakturert', cls: 'medium' },
  oppsigelse_naer: { label: 'Oppsigelsesfrist nær', cls: 'medium' },
  bor_periodiseres: { label: 'Bør periodiseres', cls: 'high' },
};

export function AgreementsScreen({ orgId }: { orgId: string }) {
  const review = useLoad(() => api<{ reviews: AgreementReview[]; totalGapMinor: string }>('GET', `/api/organizations/${orgId}/agreements/review`), [orgId]);
  const customers = useLoad(() => api<{ id: string; name: string; org_number: string | null }[]>('GET', `/api/organizations/${orgId}/customers`), [orgId]);
  const toast = useToast();
  const [show, setShow] = useState(false);
  const [riskOrg, setRiskOrg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ customerId: '', name: '', amountKr: '', cadence: 'monthly', startDate: '', endDate: '', noticeMonths: '0' });
  const d = review.data;

  const create = async () => {
    if (!f.customerId || !f.name || !f.amountKr || !f.startDate) {
      toast('Fyll ut kunde, navn, beløp og startdato.', 'info');
      return;
    }
    setBusy(true);
    try {
      const amountMinor = String(BigInt(Math.round(Number(f.amountKr.replace(',', '.')) * 100)));
      await api('POST', `/api/organizations/${orgId}/agreements`, {
        customerId: f.customerId, name: f.name, amountMinor, cadence: f.cadence,
        startDate: f.startDate, endDate: f.endDate || null, noticeMonths: Number(f.noticeMonths) || 0,
      });
      toast('Avtale opprettet.', 'ok');
      setShow(false);
      setF({ customerId: '', name: '', amountKr: '', cadence: 'monthly', startDate: '', endDate: '', noticeMonths: '0' });
      review.reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Kunne ikke opprette', 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>Avtaler</h1>
        <p className="subtitle">Løpende kundeavtaler: fakturaplan, kontroll av avtalt vs. fakturert, og deteksjon av tapte inntekter.</p>
      </div>

      <div className="actions" style={{ marginBottom: 12 }}>
        <button className="primary" onClick={() => setShow(!show)}>{show ? 'Avbryt' : 'Ny avtale'}</button>
      </div>

      {show && (
        <div className="panel">
          <h2>Ny avtale</h2>
          <div className="row">
            <div>
              <label htmlFor="a-cust">Kunde</label>
              <select id="a-cust" value={f.customerId} onChange={(e) => setF({ ...f, customerId: e.target.value })}>
                <option value="">Velg kunde …</option>
                {(customers.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {f.customerId && (
                <button
                  type="button"
                  className="linklike"
                  style={{ marginTop: 6 }}
                  onClick={() => setRiskOrg((customers.data ?? []).find((c) => c.id === f.customerId)?.org_number ?? '')}
                >
                  Sjekk kunde mot Enhetsregisteret
                </button>
              )}
            </div>
            <div>
              <label htmlFor="a-name">Navn</label>
              <input id="a-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="F.eks. Månedlig drift" />
            </div>
          </div>
          <div className="row">
            <div>
              <label htmlFor="a-amt">Avtalt beløp (kr/periode)</label>
              <input id="a-amt" inputMode="decimal" value={f.amountKr} onChange={(e) => setF({ ...f, amountKr: e.target.value })} placeholder="10 000" />
            </div>
            <div>
              <label htmlFor="a-cad">Kadens</label>
              <select id="a-cad" value={f.cadence} onChange={(e) => setF({ ...f, cadence: e.target.value })}>
                <option value="monthly">Månedlig</option>
                <option value="quarterly">Kvartalsvis</option>
                <option value="yearly">Årlig</option>
                <option value="one_time">Engangs</option>
              </select>
            </div>
          </div>
          <div className="row">
            <div>
              <label htmlFor="a-start">Startdato</label>
              <input id="a-start" placeholder="2025-01-01" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
            </div>
            <div>
              <label htmlFor="a-end">Sluttdato (valgfritt)</label>
              <input id="a-end" placeholder="løpende" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
            </div>
            <div>
              <label htmlFor="a-notice">Oppsigelsesfrist (mnd)</label>
              <input id="a-notice" inputMode="numeric" value={f.noticeMonths} onChange={(e) => setF({ ...f, noticeMonths: e.target.value })} />
            </div>
          </div>
          <div className="actions">
            <button className="primary" disabled={busy} onClick={create}>{busy ? 'Lagrer …' : 'Opprett avtale'}</button>
          </div>
        </div>
      )}

      {review.loading ? (
        <div className="cards"><CardSkeleton /><CardSkeleton /></div>
      ) : (
        d && (
          <>
            {BigInt(d.totalGapMinor) > 0n && (
              <div className="panel">
                <div className="panel-head">
                  <h2>Mulig tapt / ufakturert inntekt</h2>
                  <span className="confidence low">{kr(d.totalGapMinor)} kr</span>
                </div>
                <p className="subtitle">Summen av avtalt beløp som ennå ikke er fakturert til kundene. Kontroller og fakturer.</p>
              </div>
            )}
            {d.reviews.length === 0 ? (
              <div className="panel"><p className="subtitle">Ingen aktive avtaler ennå. Opprett en for å få fakturaplan og inntektskontroll.</p></div>
            ) : (
              d.reviews.map((rv) => (
                <div className="panel" key={rv.agreement.id}>
                  <div className="panel-head">
                    <h2>{rv.agreement.name} · {rv.agreement.customerName}</h2>
                    <span className="code">{kr(rv.agreement.amountMinor)} kr {CADENCE_LABEL[rv.agreement.cadence]}</span>
                  </div>
                  {rv.flags.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0 10px' }}>
                      {rv.flags.map((fl) => (
                        <span key={fl} className={`confidence ${FLAG_LABEL[fl]?.cls ?? 'medium'}`}>{FLAG_LABEL[fl]?.label ?? fl}</span>
                      ))}
                    </div>
                  )}
                  <dl className="kv">
                    <dt>Forventet fakturert ({rv.periodsDue} perioder)</dt>
                    <dd>{kr(rv.expectedInvoicedMinor)} kr</dd>
                    <dt>Faktisk fakturert</dt>
                    <dd>{kr(rv.actualInvoicedMinor)} kr</dd>
                    <dt>Manglende</dt>
                    <dd className={BigInt(rv.gapMinor) > 0n ? 'neg' : ''}>{kr(rv.gapMinor)} kr</dd>
                    {rv.noticeDeadline && (
                      <>
                        <dt>Oppsigelsesfrist</dt>
                        <dd>{nb(rv.noticeDeadline)}{rv.agreement.endDate ? ` (utløp ${nb(rv.agreement.endDate)})` : ''}</dd>
                      </>
                    )}
                  </dl>
                  {rv.nextInvoiceDates.length > 0 && (
                    <p className="hint">Fakturaplan framover: {rv.nextInvoiceDates.map((x) => nb(x)).join(' · ')}</p>
                  )}
                </div>
              ))
            )}
          </>
        )
      )}
      {riskOrg !== null && (
        <CompanyRiskModal orgId={orgId} initialOrgNr={riskOrg || undefined} onClose={() => setRiskOrg(null)} />
      )}
    </div>
  );
}

/* ── Kunde- og leverandørrisiko ─────────────────────────────────────────── */

interface CompanyRisk {
  orgNumber: string;
  found: boolean;
  name: string | null;
  orgForm: string | null;
  overall: 'ok' | 'attention' | 'risk';
  signals: { code: string; severity: 'ok' | 'attention' | 'risk'; title: string; detail: string; source: string }[];
  profile: { registeredInVatRegister: boolean | null; foundedDate: string | null; address: { street?: string; postalCode?: string; city?: string } | null };
  ehf: { status: string; note: string };
  creditNote: string;
  checkedAt: string;
  disclaimer: string;
}

const OVERALL_META: Record<string, { label: string; cls: string }> = {
  ok: { label: 'Ser bra ut', cls: 'high' },
  attention: { label: 'Følg med', cls: 'medium' },
  risk: { label: 'Risiko', cls: 'low' },
};

function CompanyRiskCheck({ orgId, initialOrgNr }: { orgId: string; initialOrgNr?: string }) {
  const [orgNr, setOrgNr] = useState(initialOrgNr ?? '');
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<CompanyRisk | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const check = async () => {
    const n = orgNr.replace(/\s/g, '');
    if (!/^\d{9}$/.test(n)) {
      setErr('Organisasjonsnummer må være 9 sifre.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await api<CompanyRisk>('GET', `/api/organizations/${orgId}/company-risk?orgNumber=${n}`);
      setR(res);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Oppslag feilet');
      setR(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <p className="subtitle" style={{ marginTop: 0 }}>Sjekk en virksomhet mot Enhetsregisteret. Hver observasjon vises med kilde — ingen automatisk score.</p>
      <div className="row" style={{ maxWidth: 460 }}>
        <div>
          <label htmlFor="cr-org">Organisasjonsnummer</label>
          <input id="cr-org" inputMode="numeric" placeholder="9 sifre" value={orgNr}
            onChange={(e) => setOrgNr(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && check()} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button className="primary" disabled={busy} onClick={check}>{busy ? 'Sjekker …' : 'Sjekk'}</button>
        </div>
      </div>
      {err && <div className="error">{err}</div>}

      {r && (
        <>
          <div className="panel">
            <div className="panel-head">
              <h2>{r.found ? (r.name ?? 'Ukjent navn') : 'Ikke funnet'} {r.orgForm && <span className="code">{r.orgForm}</span>}</h2>
              <span className={`confidence ${OVERALL_META[r.overall]?.cls ?? 'medium'}`}>{OVERALL_META[r.overall]?.label ?? r.overall}</span>
            </div>
            <dl className="kv">
              <dt>Org.nr</dt>
              <dd>{r.orgNumber}</dd>
              {r.profile.registeredInVatRegister !== null && (
                <>
                  <dt>MVA-registeret</dt>
                  <dd>{r.profile.registeredInVatRegister ? 'Registrert' : 'Ikke registrert'}</dd>
                </>
              )}
              {r.profile.foundedDate && (<><dt>Stiftet</dt><dd>{r.profile.foundedDate}</dd></>)}
              {r.profile.address && (
                <>
                  <dt>Adresse</dt>
                  <dd>{[r.profile.address.street, r.profile.address.postalCode, r.profile.address.city].filter(Boolean).join(', ')}</dd>
                </>
              )}
            </dl>
          </div>

          <div className="panel">
            <h2>Signaler</h2>
            <ul className="health-list">
              {r.signals.map((s, i) => (
                <li key={i} className={`health-item ${s.severity === 'risk' ? 'error' : s.severity === 'attention' ? 'warning' : 'info'}`}>
                  <div className="health-dot" aria-hidden="true" />
                  <div className="health-body">
                    <div className="health-title">{s.title}</div>
                    <div className="health-detail">{s.detail}</div>
                    <div className="hint">Kilde: {s.source}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel explain">
            <dl className="kv">
              <dt>EHF-mottak</dt>
              <dd>{r.ehf.note}</dd>
              <dt>Kredittgrense</dt>
              <dd>{r.creditNote}</dd>
            </dl>
            <p className="hint" style={{ marginTop: 8 }}>{r.disclaimer} Kontrollert {r.checkedAt}.</p>
          </div>
        </>
      )}
    </div>
  );
}

/** Kunderisiko som modal — for faktura-/avtale-flyten. */
export function CompanyRiskModal({ orgId, initialOrgNr, onClose }: { orgId: string; initialOrgNr?: string; onClose: () => void }) {
  return (
    <Modal title="Kunderisiko" onClose={onClose}>
      <CompanyRiskCheck orgId={orgId} initialOrgNr={initialOrgNr} />
    </Modal>
  );
}

/* ── Spør virksomheten ──────────────────────────────────────────────────── */

interface AskEvidence { type: string; label: string; amountMinor?: string; documentId?: string; entryNumber?: number; customerId?: string; account?: string }
interface AskAnswer {
  understood: boolean;
  intent: string;
  question: string;
  headline: string;
  figures: { label: string; value: string }[];
  calculation: string;
  evidence: AskEvidence[];
  followUps: string[];
}

const ASK_SUGGESTIONS = [
  'Hva bruker vi på programvare?',
  'Hva har vi kjøpt fra utlandet?',
  'Hvilke fakturaer mangler bilag?',
  'Hvor mye MVA må vi sannsynligvis betale?',
  'Hva har endret seg siden forrige måned?',
  'Hvilke kunder har aldri betalt innen fristen?',
  'Hvilke kunder er mest lønnsomme?',
];

export function AskScreen({ orgId, onOpenDocument }: { orgId: string; onOpenDocument: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [a, setA] = useState<AskAnswer | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async (question: string) => {
    const text = question.trim();
    if (!text) return;
    setQ(text);
    setBusy(true);
    setErr(null);
    try {
      const res = await api<AskAnswer>('GET', `/api/organizations/${orgId}/ask?q=${encodeURIComponent(text)}`);
      setA(res);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Noe gikk galt');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <div className="page-head">
        <h1>Spør virksomheten</h1>
        <p className="subtitle">Spør med vanlig språk. Svaret er alltid forankret i tallene — klikk deg fra forklaringen til bevisene.</p>
      </div>
      <div className="row" style={{ maxWidth: 720 }}>
        <div style={{ flex: 3 }}>
          <label htmlFor="ask-q">Spørsmål</label>
          <input id="ask-q" value={q} placeholder="F.eks. Hva bruker vi på programvare?" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run(q)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button className="primary" disabled={busy} onClick={() => run(q)}>{busy ? 'Tenker …' : 'Spør'}</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
        {(a?.followUps ?? ASK_SUGGESTIONS).slice(0, 7).map((s) => (
          <button key={s} className="chip" onClick={() => run(s)}>{s}</button>
        ))}
      </div>
      {err && <div className="error">{err}</div>}

      {a && (
        <div className="panel" style={{ marginTop: 16 }}>
          <h2 style={{ marginTop: 0 }}>{a.headline}</h2>
          {a.figures.length > 0 && (
            <div className="cards" style={{ marginTop: 8 }}>
              {a.figures.map((f, i) => (
                <div className="card" key={i}>
                  <div className="label">{f.label}</div>
                  <div className="value" style={{ fontSize: 20 }}>{f.value}</div>
                </div>
              ))}
            </div>
          )}
          {a.evidence.length > 0 && (
            <>
              <h3>Bevis</h3>
              <ul className="health-list">
                {a.evidence.map((ev, i) => (
                  <li key={i} className="health-item info">
                    <div className="health-dot" aria-hidden="true" />
                    <div className="health-body">
                      <div className="health-title">{ev.label}</div>
                      {ev.amountMinor && <div className="health-detail">{kr(ev.amountMinor)}</div>}
                    </div>
                    {ev.documentId && (
                      <button className="secondary health-action" onClick={() => onOpenDocument(ev.documentId!)}>Se bilaget</button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {a.calculation && <p className="hint" style={{ marginTop: 10 }}>Slik er det regnet ut: {a.calculation}</p>}
        </div>
      )}
    </div>
  );
}
