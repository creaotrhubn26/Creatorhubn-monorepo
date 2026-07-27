/**
 * Salg og faktura: kunder, fakturabygger, utstedelse og kreditnota.
 * Nummer og KID tildeles av serveren ved utstedelse — aldri i UI-et.
 */
import { useState } from 'react';
import { api, ApiError, apiText, kr, parseKrToMinor } from './api';
import { useLoad } from './App';
import { DimensionSelect } from './screens-dimensions';
import { EmptyState, Modal, StatusBadge, TableSkeleton, useToast } from './ui';
import { CompanyRiskModal } from './screens';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  org_number: string | null;
}

interface InvoiceRow {
  id: string;
  invoice_number: string | null;
  kind: string;
  status: string;
  invoice_date: string | null;
  due_date: string | null;
  kid: string | null;
  net_minor: string;
  vat_minor: string;
  gross_minor: string;
  paid_minor: string;
  customer_name: string;
}

interface LineDraft {
  description: string;
  quantity: string; // "2,5"
  unitPriceKr: string; // "1 200,00"
  vatCode: string;
}

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Kladd',
  issued: 'Utstedt',
  paid: 'Betalt',
  credited: 'Kreditert',
  cancelled: 'Annullert',
};

const OUTPUT_VAT_OPTIONS = [
  { code: '3', label: '25 % (vanlig sats)' },
  { code: '31', label: '15 % (næringsmidler)' },
  { code: '33', label: '12 % (lav sats)' },
  { code: '5', label: '0 % (fritatt)' },
  { code: '52', label: '0 % (eksport)' },
  { code: '6', label: 'Unntatt mva' },
];

function emptyLine(): LineDraft {
  return { description: '', quantity: '1', unitPriceKr: '', vatCode: '3' };
}

export function InvoicingScreen({ orgId }: { orgId: string }) {
  const toast = useToast();
  const customers = useLoad(
    () => api<Customer[]>('GET', `/api/organizations/${orgId}/customers`),
    [orgId],
  );
  const invoices = useLoad(
    () => api<InvoiceRow[]>('GET', `/api/organizations/${orgId}/invoices`),
    [orgId],
  );

  const [showBuilder, setShowBuilder] = useState(false);
  const [riskOrg, setRiskOrg] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerStreet, setNewCustomerStreet] = useState('');
  const [newCustomerPostal, setNewCustomerPostal] = useState('');
  const [newCustomerCity, setNewCustomerCity] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [project, setProject] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // EHF/PEPPOL-sending
  interface PeppolCap { registered: boolean; supportsEhfInvoice: boolean; name: string | null; note: string }
  const [ehfInv, setEhfInv] = useState<{ id: string; number: string | null } | null>(null);
  const [ehfCap, setEhfCap] = useState<PeppolCap | null>(null);
  const [ehfBusy, setEhfBusy] = useState(false);

  const openEhf = async (inv: InvoiceRow) => {
    setEhfInv({ id: inv.id, number: inv.invoice_number });
    setEhfCap(null);
    setEhfBusy(true);
    try {
      setEhfCap(await api<PeppolCap>('GET', `/api/organizations/${orgId}/invoices/${inv.id}/peppol-capability`));
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Kunne ikke sjekke EHF-mottak', 'danger');
    } finally {
      setEhfBusy(false);
    }
  };
  const downloadEhf = async () => {
    if (!ehfInv) return;
    try {
      const xml = await apiText(`/api/organizations/${orgId}/invoices/${ehfInv.id}/ehf`);
      const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `EHF-${ehfInv.number ?? ehfInv.id}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Kunne ikke laste ned', 'danger');
    }
  };
  const sendEhf = async () => {
    if (!ehfInv) return;
    setEhfBusy(true);
    try {
      await api('POST', `/api/organizations/${orgId}/invoices/${ehfInv.id}/ehf/send`, {});
      toast('EHF-faktura sendt via PEPPOL ✓', 'ok');
      setEhfInv(null);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Sending feilet', 'danger');
    } finally {
      setEhfBusy(false);
    }
  };

  const setLine = (index: number, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const createCustomer = async () => {
    if (!newCustomerName.trim()) return;
    try {
      const res = await api<{ id: string }>('POST', `/api/organizations/${orgId}/customers`, {
        name: newCustomerName.trim(),
        ...(newCustomerStreet.trim() ? { streetAddress: newCustomerStreet.trim() } : {}),
        ...(newCustomerPostal.trim() ? { postalCode: newCustomerPostal.trim() } : {}),
        ...(newCustomerCity.trim() ? { city: newCustomerCity.trim() } : {}),
      });
      toast('Kunde opprettet', 'ok');
      setNewCustomerName('');
      setNewCustomerStreet('');
      setNewCustomerPostal('');
      setNewCustomerCity('');
      setCustomerId(res.id);
      customers.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  /** Åpner salgsdokumentet (HTML) i egen fane — hentet med auth-header. */
  const openDocument = async (invoiceId: string) => {
    try {
      const html = await apiText(`/api/organizations/${orgId}/invoices/${invoiceId}/document`);
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      }
    } catch (err) {
      toast((err as Error).message, 'danger');
    }
  };

  const createAndIssue = async (issueNow: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        customerId,
        ...(invoiceDate ? { invoiceDate } : {}),
        ...(dueDate ? { dueDate } : {}),
        lines: lines
          .filter((l) => l.description.trim())
          .map((l) => ({
            description: l.description,
            quantityThousandths: String(
              Math.round(Number(l.quantity.replace(',', '.')) * 1000),
            ),
            unitPriceMinor: parseKrToMinor(l.unitPriceKr),
            vatCode: l.vatCode,
            ...(project ? { project } : {}),
          })),
      };
      const draft = await api<{ id: string; grossMinor: string }>(
        'POST',
        `/api/organizations/${orgId}/invoices`,
        body,
      );
      if (issueNow) {
        const issued = await api<{ invoiceNumber: string; kid: string }>(
          'POST',
          `/api/organizations/${orgId}/invoices/${draft.id}/issue`,
          {},
        );
        toast(`Faktura ${issued.invoiceNumber} utstedt og bokført (KID ${issued.kid})`, 'ok');
      } else {
        toast(`Fakturakladd opprettet (${kr(draft.grossMinor)})`, 'ok');
      }
      setLines([emptyLine()]);
      setShowBuilder(false);
      invoices.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const issueDraft = async (invoiceId: string) => {
    try {
      const issued = await api<{ invoiceNumber: string; kid: string }>(
        'POST',
        `/api/organizations/${orgId}/invoices/${invoiceId}/issue`,
        {},
      );
      toast(`Faktura ${issued.invoiceNumber} utstedt og bokført`, 'ok');
      invoices.reload();
    } catch (err) {
      toast((err as Error).message, 'danger');
    }
  };

  const creditInvoice = async (invoiceId: string) => {
    const reason = prompt('Hvorfor krediteres fakturaen?');
    if (!reason) return;
    try {
      const credit = await api<{ creditNoteNumber: string }>(
        'POST',
        `/api/organizations/${orgId}/invoices/${invoiceId}/credit`,
        { reason },
      );
      toast(`Kreditnota ${credit.creditNoteNumber} opprettet og bokført`, 'ok');
      invoices.reload();
    } catch (err) {
      toast((err as Error).message, 'danger');
    }
  };

  const canSubmit =
    customerId &&
    lines.some((l) => l.description.trim()) &&
    lines.filter((l) => l.description.trim()).every((l) => {
      try {
        parseKrToMinor(l.unitPriceKr);
        return Number(l.quantity.replace(',', '.')) > 0;
      } catch {
        return false;
      }
    });

  return (
    <div>
      <div className="page-head">
        <h1>Salg og faktura</h1>
        <p className="subtitle">
          Fakturanummer og KID tildeles ved utstedelse, og fakturaen bokføres automatisk med
          komplett kontrollspor. Utstedte fakturaer rettes med kreditnota.
        </p>
      </div>

      {!showBuilder && (
        <div className="actions" style={{ marginBottom: 14 }}>
          <button className="primary" onClick={() => setShowBuilder(true)}>
            Ny faktura
          </button>
          <button
            className="secondary"
            onClick={() => setRiskOrg((customers.data ?? []).find((c) => c.id === customerId)?.org_number ?? '')}
          >
            Sjekk kunde (risiko)
          </button>
        </div>
      )}

      {showBuilder && (
        <div className="panel">
          <h2>Ny faktura</h2>
          {error && <div className="error">{error}</div>}
          <div className="row">
            <div>
              <label htmlFor="cust">Kunde</label>
              <select id="cust" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Velg kunde…</option>
                {(customers.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 2 }}>
              <label htmlFor="newcust">…eller opprett ny (adresse anbefales på fakturaen)</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  id="newcust"
                  placeholder="Kundenavn"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  style={{ flex: '1 1 160px' }}
                />
                <input
                  id="newcust-street"
                  placeholder="Gateadresse"
                  value={newCustomerStreet}
                  onChange={(e) => setNewCustomerStreet(e.target.value)}
                  style={{ flex: '1 1 160px' }}
                />
                <input
                  id="newcust-postal"
                  placeholder="Postnr."
                  inputMode="numeric"
                  value={newCustomerPostal}
                  onChange={(e) => setNewCustomerPostal(e.target.value)}
                  style={{ flex: '0 1 80px' }}
                />
                <input
                  id="newcust-city"
                  placeholder="Sted"
                  value={newCustomerCity}
                  onChange={(e) => setNewCustomerCity(e.target.value)}
                  style={{ flex: '1 1 110px' }}
                />
                <button className="secondary" onClick={createCustomer} disabled={!newCustomerName.trim()}>
                  Opprett
                </button>
              </div>
            </div>
          </div>
          <div className="row">
            <div>
              <label htmlFor="idate">Fakturadato (valgfri, i dag hvis tom)</label>
              <input id="idate" placeholder="ÅÅÅÅ-MM-DD" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
            <div>
              <label htmlFor="ddate">Forfallsdato</label>
              <input id="ddate" placeholder="ÅÅÅÅ-MM-DD" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <DimensionSelect orgId={orgId} kind="project" value={project} onChange={setProject} id="inv-project" />
          </div>

          <h2>Linjer</h2>
          {lines.map((line, i) => (
            <div className="row" key={i} style={{ marginBottom: 8 }}>
              <div style={{ flex: 3 }}>
                <label htmlFor={`desc${i}`}>Beskrivelse</label>
                <input
                  id={`desc${i}`}
                  value={line.description}
                  onChange={(e) => setLine(i, { description: e.target.value })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor={`qty${i}`}>Antall</label>
                <input id={`qty${i}`} inputMode="decimal" value={line.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor={`price${i}`}>Pris eks. mva (kr)</label>
                <input id={`price${i}`} inputMode="decimal" value={line.unitPriceKr} onChange={(e) => setLine(i, { unitPriceKr: e.target.value })} />
              </div>
              <div style={{ flex: 2 }}>
                <label htmlFor={`vat${i}`}>MVA</label>
                <select id={`vat${i}`} value={line.vatCode} onChange={(e) => setLine(i, { vatCode: e.target.value })}>
                  {OUTPUT_VAT_OPTIONS.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          <div className="actions">
            <button className="secondary" onClick={() => setLines((l) => [...l, emptyLine()])}>
              + Legg til linje
            </button>
          </div>

          <div className="actions" style={{ marginTop: 20 }}>
            <button className="primary" disabled={busy || !canSubmit} onClick={() => createAndIssue(true)}>
              {busy ? 'Utsteder…' : 'Utsted og bokfør'}
            </button>
            <button className="secondary" disabled={busy || !canSubmit} onClick={() => createAndIssue(false)}>
              Lagre som kladd
            </button>
            <button className="ghost" onClick={() => setShowBuilder(false)}>
              Avbryt
            </button>
          </div>
        </div>
      )}

      <h2>Fakturaer</h2>
      {invoices.loading ? (
        <TableSkeleton rows={4} />
      ) : (invoices.data ?? []).length === 0 ? (
        <EmptyState
          icon="🧾"
          title="Ingen fakturaer ennå"
          desc="Opprett din første faktura — den bokføres automatisk ved utstedelse, og innbetalinger matches mot KID i bankmodulen."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="num">Nr.</th>
                <th>Kunde</th>
                <th>Dato</th>
                <th className="num">Beløp</th>
                <th>KID</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(invoices.data ?? []).map((inv) => (
                <tr key={inv.id}>
                  <td className="num">
                    {inv.invoice_number ?? '–'}
                    {inv.kind === 'credit_note' && (
                      <div className="secondary-line">kreditnota</div>
                    )}
                  </td>
                  <td>{inv.customer_name}</td>
                  <td>{inv.invoice_date ?? '–'}</td>
                  <td className="num">{kr(inv.gross_minor)}</td>
                  <td className="num">{inv.kid ?? '–'}</td>
                  <td>
                    <span
                      className={`badge ${
                        inv.status === 'paid'
                          ? 'ok'
                          : inv.status === 'issued'
                            ? 'accent'
                            : inv.status === 'credited'
                              ? 'warn'
                              : 'neutral'
                      }`}
                    >
                      {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                    </span>
                  </td>
                  <td>
                    <div className="actions" style={{ marginTop: 0 }}>
                      {inv.status === 'draft' && (
                        <button className="primary" onClick={() => issueDraft(inv.id)}>
                          Utsted
                        </button>
                      )}
                      {inv.status !== 'draft' && (
                        <button className="secondary" onClick={() => openDocument(inv.id)}>
                          Vis
                        </button>
                      )}
                      {(inv.status === 'issued' || inv.status === 'paid') && inv.kind === 'invoice' && (
                        <button className="secondary" onClick={() => openEhf(inv)}>
                          EHF
                        </button>
                      )}
                      {(inv.status === 'issued' || inv.status === 'paid') && inv.kind === 'invoice' && (
                        <button className="danger" onClick={() => creditInvoice(inv.id)}>
                          Krediter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {riskOrg !== null && (
        <CompanyRiskModal orgId={orgId} initialOrgNr={riskOrg || undefined} onClose={() => setRiskOrg(null)} />
      )}
      {ehfInv && (
        <Modal title={`EHF-faktura ${ehfInv.number ?? ''}`} onClose={() => setEhfInv(null)}>
          <p className="subtitle">
            EHF er den elektroniske fakturaen offentlig sektor krever. Vi sjekker i PEPPOL-katalogen om
            mottakeren kan ta imot den — så vet du at den når frem før du sender.
          </p>
          {ehfBusy && !ehfCap ? (
            <p className="hint">Sjekker PEPPOL-mottak …</p>
          ) : ehfCap ? (
            <div className={`panel threshold-panel ${ehfCap.supportsEhfInvoice ? 'ok' : 'accent'}`} style={{ marginTop: 4 }}>
              <div className="threshold-head">
                <h2>{ehfCap.name ?? 'Mottaker'}</h2>
                <span className={`badge ${ehfCap.supportsEhfInvoice ? 'ok' : 'neutral plain'}`}>
                  {ehfCap.supportsEhfInvoice ? 'Kan motta EHF ✓' : ehfCap.registered ? 'Ingen EHF-tjeneste' : 'Ikke i PEPPOL'}
                </span>
              </div>
              <p className="subtitle" style={{ margin: 0 }}>{ehfCap.note}</p>
            </div>
          ) : null}
          <div className="actions" style={{ marginTop: 14 }}>
            <button className="secondary" onClick={downloadEhf}>Last ned EHF (XML)</button>
            <button className="primary" disabled={ehfBusy} onClick={sendEhf}>
              {ehfBusy ? 'Sender …' : 'Send via PEPPOL'}
            </button>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>
            Uten aksesspunkt-avtale er automatisk sending ikke aktiv ennå — da laster du ned XML-en og
            sender den via ditt aksesspunkt. Sjekken over virker uansett.
          </p>
        </Modal>
      )}
    </div>
  );
}
