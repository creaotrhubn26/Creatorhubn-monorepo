/**
 * Frister & forpliktelser: lovbestemte frister (MVA, forskuddsskatt, skattemelding,
 * årsregnskap, aksjonærregister) med nedtelling og hverdagsspråk — så en novise
 * ikke bommer på en frist. Deterministisk fra org-form/mva-status.
 */
import { api } from './api';
import { useLoad } from './App';
import { CardSkeleton } from './ui';

interface Deadline {
  kind: string;
  title: string;
  dueDate: string;
  daysUntil: number;
  severity: 'overdue' | 'due_soon' | 'upcoming';
  explanation: string;
  actionScreen?: string;
}

const KIND_ICON: Record<string, string> = { mva: '🧾', forskuddsskatt: '💰', skattemelding: '📄', aarsregnskap: '📚', aksjonaerregister: '👥' };

function countdown(d: Deadline): string {
  if (d.daysUntil === 0) return 'i dag';
  if (d.daysUntil < 0) return `forfalt for ${-d.daysUntil} dag${-d.daysUntil === 1 ? '' : 'er'} siden`;
  return `om ${d.daysUntil} dag${d.daysUntil === 1 ? '' : 'er'}`;
}

export function DeadlinesScreen({ orgId, onNavigate }: { orgId: string; onNavigate?: (s: string) => void }) {
  const load = useLoad(() => api<Deadline[]>('GET', `/api/organizations/${orgId}/deadlines`), [orgId]);
  const d = load.data ?? [];
  const overdue = d.filter((x) => x.severity === 'overdue');
  const soon = d.filter((x) => x.severity === 'due_soon');
  const upcoming = d.filter((x) => x.severity === 'upcoming');

  const row = (x: Deadline) => (
    <li key={`${x.kind}-${x.dueDate}`} className={`health-item ${x.severity === 'overdue' ? 'warning' : x.severity === 'due_soon' ? 'info' : ''}`}>
      <div className="health-dot" aria-hidden="true" />
      <div className="health-body">
        <div className="health-title">
          {KIND_ICON[x.kind] ?? '•'} {x.title}
          <span className={`badge ${x.severity === 'overdue' ? 'danger' : x.severity === 'due_soon' ? 'warn' : 'neutral plain'}`}>{countdown(x)}</span>
          <span className="code">{x.dueDate}</span>
        </div>
        <div className="health-detail">{x.explanation}</div>
      </div>
      {x.actionScreen && onNavigate && (
        <button className="secondary health-action" onClick={() => onNavigate(x.actionScreen!)}>Gå til</button>
      )}
    </li>
  );

  return (
    <div>
      <div className="page-head">
        <h1>Frister & forpliktelser</h1>
        <p className="subtitle">De lovbestemte fristene virksomheten din må overholde, med nedtelling. Ikke en kontantstrøm-prognose (det er «Framover») — dette er sjekklista så du ikke bommer på en frist.</p>
      </div>
      {load.error && <div className="error">{load.error}</div>}
      {load.loading ? (
        <div className="cards"><CardSkeleton /><CardSkeleton /></div>
      ) : d.length === 0 ? (
        <div className="panel"><p className="subtitle">Ingen frister i vinduet. (Sjekk at org-form og MVA-status er satt under Virksomhet.)</p></div>
      ) : (
        <>
          {overdue.length > 0 && (
            <div className="panel">
              <div className="panel-head"><h2>Forfalt</h2><span className="confidence low">{overdue.length}</span></div>
              <ul className="health-list">{overdue.map(row)}</ul>
            </div>
          )}
          {soon.length > 0 && (
            <div className="panel">
              <div className="panel-head"><h2>Snart (≤ 14 dager)</h2><span className="confidence medium">{soon.length}</span></div>
              <ul className="health-list">{soon.map(row)}</ul>
            </div>
          )}
          {upcoming.length > 0 && (
            <div className="panel">
              <div className="panel-head"><h2>Kommende</h2><span className="confidence">{upcoming.length}</span></div>
              <ul className="health-list">{upcoming.map(row)}</ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
