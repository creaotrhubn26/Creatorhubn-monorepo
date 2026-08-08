/**
 * Anleggsmidler: register + saldoavskrivning per saldogruppe (a–j).
 * Viser årets avskrivning og lar deg bokføre den som ett bilag.
 */
import { useState } from 'react';
import { api, ApiError, kr, parseKrToMinor } from './api';
import { useLoad } from './App';
import { EmptyState, TableSkeleton, useToast } from './ui';

interface SaldoGroupInfo { name: string; ratePct: number }
interface Asset {
  id: string;
  name: string;
  saldoGroup: string;
  acquisitionDate: string;
  costMinor: string;
  ledgerAccount: string;
  status: 'active' | 'disposed' | 'expensed';
  disposalDate: string | null;
  disposalProceedsMinor: string | null;
}
interface Register { groups: Record<string, SaldoGroupInfo>; assets: Asset[] }
interface DepRow { year: number; basisMinor: string; ratePct: number; depreciationMinor: string; closingSaldoMinor: string; fullWriteOff: boolean }
interface DepGroup { group: string; name: string; ratePct: number; rows: DepRow[]; depreciationThisYearMinor: string; closingSaldoMinor: string }
interface Depreciation {
  year: number;
  groups: DepGroup[];
  totalDepreciationThisYearMinor: string;
  totalClosingSaldoMinor: string;
  smallAssets: { id: string; name: string; costMinor: string }[];
  notes: string[];
}

const STATUS_LABEL: Record<string, string> = { active: 'Aktiv', disposed: 'Utrangert', expensed: 'Direkte kostnadsført' };

export function FixedAssetsScreen({ orgId }: { orgId: string }) {
  const toast = useToast();
  const [year, setYear] = useState(new Date().getFullYear());
  const reg = useLoad(() => api<Register>('GET', `/api/organizations/${orgId}/fixed-assets`), [orgId]);
  const dep = useLoad(() => api<Depreciation>('GET', `/api/organizations/${orgId}/fixed-assets/depreciation?year=${year}`), [orgId, year]);

  const [name, setName] = useState('');
  const [group, setGroup] = useState('d');
  const [acqDate, setAcqDate] = useState('');
  const [cost, setCost] = useState('');
  const [account, setAccount] = useState('');
  const [busy, setBusy] = useState(false);

  const groups = reg.data?.groups ?? {};

  const addAsset = async () => {
    if (!name.trim() || !acqDate || !cost.trim()) { toast('Fyll inn navn, dato og kostpris.', 'danger'); return; }
    setBusy(true);
    try {
      await api('POST', `/api/organizations/${orgId}/fixed-assets`, {
        name: name.trim(), saldoGroup: group, acquisitionDate: acqDate, costMinor: parseKrToMinor(cost),
        ...(account.trim() ? { ledgerAccount: account.trim() } : {}),
      });
      toast('Anleggsmiddel lagt til ✓', 'ok');
      setName(''); setCost(''); setAccount('');
      reg.reload(); dep.reload();
    } catch (err) { toast(err instanceof ApiError ? err.message : 'Feilet', 'danger'); } finally { setBusy(false); }
  };

  const dispose = async (a: Asset) => {
    const date = window.prompt('Utrangeringsdato (ÅÅÅÅ-MM-DD):', `${year}-12-31`);
    if (!date) return;
    const proceeds = window.prompt('Salgssum / vederlag i kr (0 hvis kastet):', '0');
    if (proceeds === null) return;
    setBusy(true);
    try {
      await api('POST', `/api/organizations/${orgId}/fixed-assets/${a.id}/dispose`, { disposalDate: date, proceedsMinor: parseKrToMinor(proceeds || '0') });
      toast('Utrangert ✓', 'ok'); reg.reload(); dep.reload();
    } catch (err) { toast(err instanceof ApiError ? err.message : 'Feilet', 'danger'); } finally { setBusy(false); }
  };

  const book = async () => {
    if (!window.confirm(`Bokføre avskrivning for ${year} (${kr(dep.data?.totalDepreciationThisYearMinor ?? '0')})? Ett bilag: debet 6000, kredit 1290.`)) return;
    setBusy(true);
    try {
      const r = await api<{ entryNumber?: number; amountMinor?: string; skipped?: string }>('POST', `/api/organizations/${orgId}/fixed-assets/depreciation/${year}/book`, {});
      toast(r.skipped ? 'Ingen avskrivning å bokføre.' : `Avskrivning bokført som bilag nr. ${r.entryNumber} ✓`, 'ok');
      dep.reload();
    } catch (err) { toast(err instanceof ApiError ? err.message : 'Feilet', 'danger'); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="page-head">
        <h1>Anleggsmidler</h1>
        <p className="subtitle">Register over driftsmidler og saldoavskrivning (skatteloven §14-43). Utstyr over 15 000 kr aktiveres og avskrives; billigere kostnadsføres direkte.</p>
      </div>

      <div className="panel">
        <h2>Legg til anleggsmiddel</h2>
        <div className="row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div><label>Navn</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kamerapakke" /></div>
          <div><label>Saldogruppe</label>
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              {Object.entries(groups).map(([k, g]) => <option key={k} value={k}>{k} — {g.name} ({g.ratePct} %)</option>)}
            </select>
          </div>
          <div><label>Anskaffet</label><input type="date" value={acqDate} onChange={(e) => setAcqDate(e.target.value)} style={{ width: 160 }} /></div>
          <div><label>Kostpris (kr)</label><input value={cost} onChange={(e) => setCost(e.target.value)} placeholder="60 000" style={{ width: 110 }} /></div>
          <div><label>Konto</label><input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="1280" style={{ width: 80 }} /></div>
          <button className="primary" disabled={busy} onClick={addAsset}>Legg til</button>
        </div>
        <p className="hint">Kostpris under 15 000 kr registreres som «direkte kostnadsført» og inngår ikke i saldoavskrivningen.</p>
      </div>

      <h2>Register</h2>
      {reg.loading ? <TableSkeleton rows={3} /> : (reg.data?.assets ?? []).length === 0 ? (
        <EmptyState icon="🧰" title="Ingen anleggsmidler ennå" desc="Legg til utstyr, maskiner eller inventar over 15 000 kr som skal avskrives." />
      ) : (
        <div className="table-wrap"><table>
          <thead><tr><th>Navn</th><th>Gruppe</th><th>Anskaffet</th><th className="num">Kostpris</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {(reg.data?.assets ?? []).map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.saldoGroup} — {groups[a.saldoGroup]?.name ?? ''}</td>
                <td>{a.acquisitionDate}</td>
                <td className="num">{kr(a.costMinor)}</td>
                <td><span className={`badge ${a.status === 'active' ? 'accent' : a.status === 'disposed' ? 'neutral plain' : 'ok'}`}>{STATUS_LABEL[a.status]}</span></td>
                <td>{a.status === 'active' && <button className="secondary" disabled={busy} onClick={() => dispose(a)}>Utranger</button>}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}

      <div className="row" style={{ maxWidth: 200, marginTop: 18 }}>
        <div><label htmlFor="dep-year">Avskrivningsår</label>
          <input id="dep-year" inputMode="numeric" value={year} onChange={(e) => { const n = Number(e.target.value); if (n >= 2000 && n <= 2100) setYear(n); }} />
        </div>
      </div>

      {dep.data && dep.data.groups.length > 0 && (
        <div className="panel">
          <div className="threshold-head"><h2>Saldoavskrivning {year}</h2>
            <button className="primary" disabled={busy} onClick={book}>Bokfør avskrivning {year}</button>
          </div>
          <div className="table-wrap"><table>
            <thead><tr><th>Saldogruppe</th><th className="num">Sats</th><th className="num">Grunnlag</th><th className="num">Avskrivning</th><th className="num">Utg. saldo</th></tr></thead>
            <tbody>
              {dep.data.groups.map((g) => {
                const row = g.rows.find((r) => r.year === year);
                return (
                  <tr key={g.group}>
                    <td>{g.group} — {g.name}</td>
                    <td className="num">{g.ratePct} %{row?.fullWriteOff ? ' (restsaldo)' : ''}</td>
                    <td className="num">{kr(row?.basisMinor ?? '0')}</td>
                    <td className="num">{kr(g.depreciationThisYearMinor)}</td>
                    <td className="num">{kr(g.closingSaldoMinor)}</td>
                  </tr>
                );
              })}
              <tr className="total-row"><td><strong>Sum</strong></td><td></td><td></td>
                <td className="num"><strong>{kr(dep.data.totalDepreciationThisYearMinor)}</strong></td>
                <td className="num"><strong>{kr(dep.data.totalClosingSaldoMinor)}</strong></td>
              </tr>
            </tbody>
          </table></div>
          {dep.data.notes.map((n, i) => <p key={i} className="hint">{n}</p>)}
        </div>
      )}
      {dep.data && dep.data.smallAssets.length > 0 && (
        <p className="hint">Direkte kostnadsført (under 15 000 kr): {dep.data.smallAssets.map((s) => `${s.name} (${kr(s.costMinor)})`).join(', ')}.</p>
      )}
    </div>
  );
}
