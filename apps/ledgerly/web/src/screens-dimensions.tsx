/**
 * Prosjekter og avdelinger: registeret + lønnsomhet per kostnadsbærer.
 * Tallene kommer fra hovedboken (dimension-result-rapporten) — aldri fra AI.
 */
import { useState } from 'react';
import { api, kr } from './api';
import { useLoad } from './App';
import { EmptyState, TableSkeleton, useToast } from './ui';

interface Dimension {
  id: string;
  code: string;
  name: string;
  status: string;
}

interface ResultRow {
  code: string;
  name: string;
  revenueMinor: string;
  expenseMinor: string;
  resultMinor: string;
}

export function useDimensions(orgId: string, kind: 'project' | 'department') {
  return useLoad(
    () => api<Dimension[]>('GET', `/api/organizations/${orgId}/dimensions/${kind}`),
    [orgId, kind],
  );
}

export function DimensionsScreen({ orgId }: { orgId: string }) {
  const [kind, setKind] = useState<'project' | 'department'>('project');
  const dims = useDimensions(orgId, kind);
  const report = useLoad(
    () =>
      api<ResultRow[]>('GET', `/api/organizations/${orgId}/reports/dimension-result?kind=${kind}`),
    [orgId, kind],
  );
  const toast = useToast();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kindLabel = kind === 'project' ? 'prosjekt' : 'avdeling';

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await api<{ code: string }>(
        'POST',
        `/api/organizations/${orgId}/dimensions/${kind}`,
        { code, name },
      );
      toast(`${kind === 'project' ? 'Prosjekt' : 'Avdeling'} ${created.code} opprettet`, 'ok');
      setCode('');
      setName('');
      dims.reload();
      report.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const resultByCode = new Map((report.data ?? []).map((r) => [r.code, r]));

  return (
    <div>
      <div className="page-head">
        <h1>Prosjekter og avdelinger</h1>
        <p className="subtitle">
          Merk bilag og fakturalinjer med kostnadsbærer, og se lønnsomhet per {kindLabel} — hver
          krone sporbar til posteringene.
        </p>
      </div>

      <div className="actions" style={{ marginBottom: 14 }}>
        <button className={kind === 'project' ? 'primary' : 'secondary'} onClick={() => setKind('project')}>
          Prosjekter
        </button>
        <button
          className={kind === 'department' ? 'primary' : 'secondary'}
          onClick={() => setKind('department')}
        >
          Avdelinger
        </button>
      </div>

      <div className="panel">
        <h2>Ny {kindLabel}</h2>
        {error && <div className="error">{error}</div>}
        <div className="row">
          <div>
            <label htmlFor="dimcode">Kode (kort og stabil)</label>
            <input
              id="dimcode"
              placeholder={kind === 'project' ? 'f.eks. BRYLLUP24' : 'f.eks. FOTO'}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div style={{ flex: 2 }}>
            <label htmlFor="dimname">Navn</label>
            <input id="dimname" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <button className="primary" disabled={busy || !code.trim() || !name.trim()} onClick={create}>
              Opprett
            </button>
          </div>
        </div>
      </div>

      <h2>Lønnsomhet per {kindLabel}</h2>
      {dims.loading || report.loading ? (
        <TableSkeleton rows={4} />
      ) : (dims.data ?? []).length === 0 ? (
        <EmptyState
          icon="📁"
          title={`Ingen ${kind === 'project' ? 'prosjekter' : 'avdelinger'} ennå`}
          desc={`Opprett en ${kindLabel} over, og velg den når du godkjenner bilag eller lager faktura — så bygges lønnsomheten opp her.`}
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Navn</th>
                <th className="num">Inntekter</th>
                <th className="num">Kostnader</th>
                <th className="num">Resultat</th>
              </tr>
            </thead>
            <tbody>
              {(dims.data ?? []).map((d) => {
                const r = resultByCode.get(d.code);
                return (
                  <tr key={d.id}>
                    <td className="num">{d.code}</td>
                    <td>{d.name}</td>
                    <td className="num">{r ? kr(r.revenueMinor) : kr('0')}</td>
                    <td className="num">{r ? kr(r.expenseMinor) : kr('0')}</td>
                    <td className="num">
                      <strong>{r ? kr(r.resultMinor) : kr('0')}</strong>
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

/** Gjenbrukbar dimensjonsvelger (brukes ved godkjenning og på faktura). */
export function DimensionSelect({
  orgId,
  kind,
  value,
  onChange,
  id,
}: {
  orgId: string;
  kind: 'project' | 'department';
  value: string;
  onChange: (code: string) => void;
  id: string;
}) {
  const dims = useDimensions(orgId, kind);
  if (!dims.data || dims.data.length === 0) return null;
  return (
    <div>
      <label htmlFor={id}>{kind === 'project' ? 'Prosjekt' : 'Avdeling'} (valgfritt)</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Ingen</option>
        {dims.data.map((d) => (
          <option key={d.id} value={d.code}>
            {d.code} — {d.name}
          </option>
        ))}
      </select>
    </div>
  );
}
