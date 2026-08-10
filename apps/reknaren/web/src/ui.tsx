/**
 * Delte UI-komponenter: ikoner, tilstander (tom/laster), toasts,
 * progressiv visning og statusmerker.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
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
  calendar: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3.5v3m8-3v3" />
    </svg>
  ),
  coins: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <ellipse cx="12" cy="6.5" rx="6.5" ry="2.8" />
      <path d="M5.5 6.5v5c0 1.55 2.9 2.8 6.5 2.8s6.5-1.25 6.5-2.8v-5" />
      <path d="M5.5 11.5v5c0 1.55 2.9 2.8 6.5 2.8s6.5-1.25 6.5-2.8v-5" />
    </svg>
  ),
  sparkles: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M12 3.5c.6 3.7 1.8 4.9 5.5 5.5-3.7.6-4.9 1.8-5.5 5.5-.6-3.7-1.8-4.9-5.5-5.5 3.7-.6 4.9-1.8 5.5-5.5z" />
      <path d="M18 15c.3 1.6.8 2.1 2.4 2.4-1.6.3-2.1.8-2.4 2.4-.3-1.6-.8-2.1-2.4-2.4 1.6-.3 2.1-.8 2.4-2.4z" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M12 6.5C10.5 5.2 8.3 4.7 4.5 4.7V17c3.8 0 6 .5 7.5 1.8 1.5-1.3 3.7-1.8 7.5-1.8V4.7c-3.8 0-6 .5-7.5 1.8z" />
      <path d="M12 6.5v12" />
    </svg>
  ),
  gear: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3m0 13v3m9.5-9.5h-3m-13 0h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1m13.4 0l-2.1-2.1M7.4 7.4L5.3 5.3" />
    </svg>
  ),
  receipt: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" />
      <path d="M9 8h6m-6 3.5h6" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M3.5 6.5a2 2 0 0 1 2-2h3.3l2 2.3H18.5a2 2 0 0 1 2 2v8.7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
    </svg>
  ),
  file: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M6 3.5h7l5 5v12H6z" />
      <path d="M13 3.5v5h5" />
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

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    // Flytt fokus inn i dialogen ved åpning.
    const focusables = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => !el.hasAttribute('disabled'));
    (focusables()[0] ?? dialogRef.current)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      // Felle Tab/Shift+Tab innenfor dialogen.
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prevFocus?.focus(); // gjenopprett fokus ved lukking
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="modal-close" aria-label="Lukk" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
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
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (text: string, kind: Toast['kind'] = 'info') => {
      const id = ++toastCounter;
      setToasts((t) => [...t, { id, text, kind }]);
      setTimeout(() => dismiss(id), 6000);
    },
    [dismiss],
  );
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`toast ${t.kind === 'info' ? '' : t.kind}`}
            onClick={() => dismiss(t.id)}
            title="Lukk"
          >
            {t.text}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
