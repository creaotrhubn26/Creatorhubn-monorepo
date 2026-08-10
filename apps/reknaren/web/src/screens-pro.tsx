/**
 * Regnskapsførervisningen: hovedbok, bilagsjournal og revisjonslogg.
 * Her vises tekniske detaljer (kontonumre, SAF-T-koder, hasher) direkte —
 * målgruppen er profesjonelle brukere.
 */
import { useState } from 'react';
import { api, kr } from './api';
import { useLoad } from './App';
import { EmptyState, StatusBadge, TableSkeleton } from './ui';

interface JournalLine {
  line_number: number;
  account_number: string;
  vat_code: string | null;
  debit_minor: string;
  credit_minor: string;
  description: string | null;
  original_currency: string | null;
  original_amount_minor: string | null;
  exchange_rate: string | null;
}

/* ── Hovedbok ──────────────────────────────────────────────────────────── */

export function LedgerScreen({ orgId }: { orgId: string }) {
  const [account, setAccount] = useState('');
  interface GlLine {
    entryNumber: number;
    entryDate: string;
    entryStatus: string;
    description: string | null;
    accountNumber: string;
    vatCode: string | null;
    debitMinor: string;
    creditMinor: string;
    sourceDocumentId: string | null;
  }
  const gl = useLoad(
    () =>
      api<GlLine[]>(
        'GET',
        `/api/organizations/${orgId}/reports/general-ledger${account ? `?account=${account}` : ''}`,
      ),
    [orgId, account],
  );
  return (
    <div>
      <div className="page-head">
        <h1>Hovedbok</h1>
        <p className="subtitle">Alle bevegelser per konto, med spor til bilag og dokument.</p>
      </div>
      <div className="row" style={{ maxWidth: 300 }}>
        <div>
          <label htmlFor="glacc">Konto (firesifret, tom = alle)</label>
          <input
            id="glacc"
            inputMode="numeric"
            placeholder="f.eks. 6551"
            value={account}
            onChange={(e) => setAccount(/^\d{4}$/.test(e.target.value) || e.target.value === '' ? e.target.value : account)}
          />
        </div>
      </div>
      {gl.error && <div className="error">{gl.error}</div>}
      {gl.loading ? (
        <TableSkeleton rows={8} />
      ) : (gl.data ?? []).length === 0 ? (
        <EmptyState icon="📒" title="Ingen bevegelser" desc="Ingen posteringslinjer for valget." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Konto</th>
                <th className="num">Bilag</th>
                <th>Dato</th>
                <th>Tekst</th>
                <th>MVA</th>
                <th className="num">Debet</th>
                <th className="num">Kredit</th>
              </tr>
            </thead>
            <tbody>
              {(gl.data ?? []).map((l, i) => (
                <tr key={i}>
                  <td className="num">{l.accountNumber}</td>
                  <td className="num">{l.entryNumber}</td>
                  <td>{l.entryDate}</td>
                  <td>
                    {l.description}
                    {l.entryStatus === 'reversed' && (
                      <>
                        {' '}
                        <span className="badge warn plain">Reversert</span>
                      </>
                    )}
                  </td>
                  <td className="num">{l.vatCode ?? ''}</td>
                  <td className="num">{BigInt(l.debitMinor) !== 0n ? kr(l.debitMinor) : ''}</td>
                  <td className="num">{BigInt(l.creditMinor) !== 0n ? kr(l.creditMinor) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Bilagsjournal ─────────────────────────────────────────────────────── */

export function JournalScreen({ orgId }: { orgId: string }) {
  interface Entry {
    id: string;
    entry_number: string;
    entry_date: string;
    description: string;
    status: string;
    source_document_id: string | null;
    posted_by_role: string;
    lines: JournalLine[];
  }
  const entries = useLoad(
    () => api<Entry[]>('GET', `/api/organizations/${orgId}/journal-entries`),
    [orgId],
  );
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div>
      <div className="page-head">
        <h1>Bilagsjournal</h1>
        <p className="subtitle">
          Alle bokførte bilag i nummerrekkefølge. Klikk en rad for posteringslinjene.
        </p>
      </div>
      {entries.error && <div className="error">{entries.error}</div>}
      {entries.loading ? (
        <TableSkeleton rows={6} />
      ) : (entries.data ?? []).length === 0 ? (
        <EmptyState icon="📓" title="Ingen bilag bokført" desc="Journalen fylles når bilag godkjennes." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="num">Nr.</th>
                <th>Dato</th>
                <th>Beskrivelse</th>
                <th>Status</th>
                <th>Rolle</th>
              </tr>
            </thead>
            <tbody>
              {(entries.data ?? []).map((e) => (
                <>
                  <tr
                    key={e.id}
                    className="clickable"
                    tabIndex={0}
                    onClick={() => setOpen(open === e.id ? null : e.id)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        setOpen(open === e.id ? null : e.id);
                      }
                    }}
                  >
                    <td className="num">{e.entry_number}</td>
                    <td>{e.entry_date}</td>
                    <td>{e.description}</td>
                    <td>
                      <StatusBadge status={e.status} />
                    </td>
                    <td>{e.posted_by_role}</td>
                  </tr>
                  {open === e.id && (
                    <tr key={`${e.id}-lines`}>
                      <td colSpan={5} style={{ padding: 0 }}>
                        <PostingLines lines={e.lines} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Posteringslinjer — gjenbrukes i bilagsjournalen og på bilagsdetaljen. */
export function PostingLines({ lines }: { lines: JournalLine[] }) {
  return (
    <table style={{ background: 'transparent' }}>
      <thead>
        <tr>
          <th className="num">Linje</th>
          <th>Konto</th>
          <th>MVA-kode</th>
          <th>Tekst</th>
          <th className="num">Debet</th>
          <th className="num">Kredit</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.line_number}>
            <td className="num">{l.line_number}</td>
            <td className="num">{l.account_number}</td>
            <td className="num">{l.vat_code ?? ''}</td>
            <td>
              {l.description ?? ''}
              {l.original_currency && (
                <span className="secondary-line">
                  {' '}
                  ({kr(l.original_amount_minor)} {l.original_currency} à {l.exchange_rate})
                </span>
              )}
            </td>
            <td className="num">{BigInt(l.debit_minor) !== 0n ? kr(l.debit_minor) : ''}</td>
            <td className="num">{BigInt(l.credit_minor) !== 0n ? kr(l.credit_minor) : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── Revisjonslogg ─────────────────────────────────────────────────────── */

export function AuditScreen({ orgId }: { orgId: string }) {
  interface AuditEvent {
    id: string;
    actor_role: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    reason: string | null;
    occurred_at: string;
  }
  const events = useLoad(
    () => api<AuditEvent[]>('GET', `/api/organizations/${orgId}/audit-events`),
    [orgId],
  );
  return (
    <div>
      <div className="page-head">
        <h1>Revisjonslogg</h1>
        <p className="subtitle">
          Uforanderlig logg over alle vesentlige hendelser — hvem, hva, når og hvorfor.
        </p>
      </div>
      {events.error && <div className="error">{events.error}</div>}
      {events.loading ? (
        <TableSkeleton rows={8} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tidspunkt</th>
                <th>Hendelse</th>
                <th>Entitet</th>
                <th>Rolle</th>
                <th>Begrunnelse</th>
              </tr>
            </thead>
            <tbody>
              {(events.data ?? []).map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{e.occurred_at.slice(0, 19).replace('T', ' ')}</td>
                  <td>
                    <span className="badge neutral plain">{e.action}</span>
                  </td>
                  <td>{e.entity_type}</td>
                  <td>{e.actor_role ?? 'system'}</td>
                  <td>{e.reason ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
