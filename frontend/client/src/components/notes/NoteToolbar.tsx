// client/src/components/notes/NoteToolbar.tsx
import { useTheming } from '../../utils/theming-helper';
import React from 'react';

type Props = {
  title: string;
  onTitleChange: (next: string) => void;
  onSave: () => void;
  onDelete?: () => void;
  status?: 'idle' | 'saving' | 'saved' | 'error';
  rightExtra?: React.ReactNode; // e.g., export/share buttons or view toggles
};

export default function NoteToolbar({
  title,
  onTitleChange,
  onSave,
  onDelete,
  status = 'idle',
  rightExtra,
}: Props) {
  // Theming system
  const theming = useTheming('photographer');
  const statusLabel =
    status === 'saving' ? 'Lagrer …' :
    status === 'saved' ? 'Autolagret' :
    status === 'error' ? 'Feil ved lagring' : 'Klar';

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        background: 'var(--toolbar-bg, rgba(255,255,255,0.8))',
        backdropFilter: 'blur(6px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)'}}
      role="toolbar"
      aria-label="Notatverktøylinje"
    >
      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Tittel"
        aria-label="Notattittel"
        style={{
          flex: 1,
          fontSize: 18,
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid rgba(0,0,0,0.15)',
          outline: 'none'}}
      />
      <div aria-live="polite" style={{ fontSize: 12, opacity: 0.8, minWidth: 90, textAlign: 'right' }}>
        {statusLabel}
      </div>
      <button onClick={onSave} style={btn('primary')} aria-label="Lagre notat">Lagre</button>
      {onDelete && (
        <button onClick={onDelete} style={btn('danger')} aria-label="Slett notat">Slett</button>
      )}
      {rightExtra}
    </div>
  );
}

function btn(kind: 'primary' | 'danger') {
  const base = {
    cursor: 'pointer',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid rgba(0,0,0,0.1)',
    background: '#fff',
} as React.CSSProperties;

  if (kind === 'primary') return { ...base, background: '#2563EB', color: '#fff', borderColor: '#2563EB' };
  if (kind === 'danger') return { ...base, background: '#DC2626', color: '#fff', borderColor: '#DC2626' };
  return base;
}
