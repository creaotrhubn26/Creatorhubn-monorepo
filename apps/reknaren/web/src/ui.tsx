/**
 * Delte UI-komponenter: ikoner, tilstander (tom/laster), toasts,
 * progressiv visning og statusmerker.
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { STATUS_LABELS } from './api';

/* ── Ikoner (inline SVG, arver farge) ──────────────────────────────────── */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export const Icons = {
  overview: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  ),
  inbox: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M3 13h4l2 3h6l2-3h4" />
      <path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  ),
  bank: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="m3 9 9-6 9 6" />
      <path d="M5 9v9m4.7-9v9m4.6-9v9M19 9v9M3 21h18" />
    </svg>
  ),
  percent: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M19 5 5 19" />
      <circle cx="7.5" cy="7.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3z" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M4 20V10m5.3 10V4m5.4 16v-7m5.3 7V8" />
    </svg>
  ),
} as const;

/* ── Statusmerke ───────────────────────────────────────────────────────── */

function badgeClass(status: string): string {
  if (['posted', 'approved', 'matched', 'valid', 'active'].includes(status)) return 'ok';
  if (['needs_review', 'duplicate', 'suggested', 'pending'].includes(status)) return 'warn';
  if (['quarantined', 'rejected', 'discrepancy', 'revoked', 'expired'].includes(status)) return 'danger';
  if (['extracted'].includes(status)) return 'accent';
  return 'neutral';
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${badgeClass(status)}`}>{STATUS_LABELS[status] ?? status}</span>;
}

/* ── Tom- og lastetilstander ───────────────────────────────────────────── */

export function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="empty">
      <div className="icon" aria-hidden>
        {icon}
      </div>
      <div className="title">{title}</div>
      <div className="desc">{desc}</div>
    </div>
  );
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="panel" role="status" aria-label="Laster innhold">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 18, margin: '12px 0', opacity: 1 - i * 0.18 }} />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="card" role="status" aria-label="Laster">
      <div className="skeleton" style={{ height: 12, width: '55%' }} />
      <div className="skeleton" style={{ height: 24, width: '40%', marginTop: 10 }} />
    </div>
  );
}

/* ── Progressiv visning ────────────────────────────────────────────────── */

export function Disclosure({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`disclosure${open ? ' open' : ''}`}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="chev" aria-hidden>
          ▸
        </span>
        {label}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

/* ── Toasts ────────────────────────────────────────────────────────────── */

interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'danger' | 'info';
}

const ToastContext = createContext<(text: string, kind?: Toast['kind']) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

let toastCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = ++toastCounter;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'info' ? '' : t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
