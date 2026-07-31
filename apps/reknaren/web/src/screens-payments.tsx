/**
 * Betal leverandører: velg leste leverandørfakturaer → lag en betalingsfil
 * (ISO 20022 pain.001) du laster opp i nettbanken. Reknaren flytter ingen penger.
 */
import { useMemo, useState } from 'react';
import { api, ApiError, authHeaders, kr } from './api';
import { useLoad } from './App';
import { EmptyState, TableSkeleton, useToast } from './ui';

interface Payable {
  documentId: string;
  vendorName: string | null;
  bankAccount: string | null;
  kid: string | null;
  invoiceNumber: string | null;
  amountMinor: string;
  currency: string;
  invoiceDate: string | null;
  dueDate: string | null;
  payable: boolean;
}

export function PaymentsScreen({ orgId }: { orgId: string }) {
  const toast = useToast();
  const list = useLoad(() => api<Payable[]>('GET', `/api/organizations/${orgId}/payments/payable`), [orgId]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const payable = (list.data ?? []).filter((p) => p.payable);
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = payable.length > 0 && payable.every((p) => selected.has(p.documentId));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(payable.map((p) => p.documentId)));
  const totalMinor = useMemo(() => (list.data ?? []).filter((p) => selected.has(p.documentId)).reduce((s, p) => s + BigInt(p.amountMinor), 0n), [list.data, selected]);

  const makeFile = async () => {
    const ids = [...selected];
    if (ids.length === 0) { toast('Velg minst én faktura.', 'danger'); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/payments/file`, {
        method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders() }, body: JSON.stringify({ documentIds: ids }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new ApiError(e?.error?.message ?? 'Kunne ikke lage betalingsfil', res.status); }
      const xml = await res.text();
      const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }));
      const a = document.createElement('a');
      a.href = url; a.download = `betaling_${new Date().toISOString().slice(0, 10)}.xml`; a.click();
      URL.revokeObjectURL(url);
      toast(`Betalingsfil for ${ids.length} faktura(er) laget — last den opp i nettbanken ✓`, 'ok');
      setSelected(new Set());
      list.reload();
    } catch (err) { toast(err instanceof ApiError ? err.message : 'Feilet', 'danger'); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="page-head">
        <h1>Betal leverandører</h1>
        <p className="subtitle">
          Velg leverandørfakturaene du vil betale, og lag en betalingsfil (ISO 20022) du laster opp i nettbanken.
          Kontonummer, beløp og KID er alt hentet fra bilagene — du slipper å taste. Reknaren flytter ingen penger.
        </p>
      </div>
      {list.error && <div className="error">{list.error}</div>}

      {list.loading ? <TableSkeleton rows={4} /> : (list.data ?? []).length === 0 ? (
        <EmptyState icon="🧾" title="Ingen leverandørfakturaer å betale" desc="Leste fakturaer med kontonummer dukker opp her. Skann e-post eller last opp bilag først." />
      ) : (
        <>
          <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div><b>{selected.size}</b> valgt · sum <b>{kr(totalMinor.toString())}</b></div>
            <button className="primary" disabled={busy || selected.size === 0} onClick={makeFile}>{busy ? 'Lager…' : 'Lag betalingsfil (til nettbank)'}</button>
          </div>
          <div className="table-wrap"><table>
            <thead><tr>
              <th><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Velg alle" /></th>
              <th>Leverandør</th><th>Faktura</th><th>Forfall</th><th>Konto</th><th>KID</th><th className="num">Beløp</th>
            </tr></thead>
            <tbody>
              {(list.data ?? []).map((p) => (
                <tr key={p.documentId} style={p.payable ? undefined : { opacity: 0.55 }}>
                  <td>{p.payable ? <input type="checkbox" checked={selected.has(p.documentId)} onChange={() => toggle(p.documentId)} /> : ''}</td>
                  <td>{p.vendorName ?? '–'}</td>
                  <td>{p.invoiceNumber ?? '–'}</td>
                  <td>{p.dueDate ?? '–'}</td>
                  <td>{p.bankAccount ?? <span className="badge warn">mangler konto</span>}</td>
                  <td>{p.kid ?? '–'}</td>
                  <td className="num">{kr(p.amountMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <p className="hint">
            Betalingsdato settes til i dag i fila — du kan endre forfallsdato per betaling i nettbanken. Første gang bør
            du sjekke at nettbanken godtar fila (bankene varierer litt på pain.001-varianter).
          </p>
        </>
      )}
    </div>
  );
}
