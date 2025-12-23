// client/src/components/notes/AIUtilitiesPanel.tsx
import { useTheming } from '../../utils/theming-helper';
import React from 'react';

type Props = {
  loading?: boolean;
  result?: string;
  onSummarize?: () => void;
  onImproveTone?: () => void;
  onCreateOutline?: () => void;
};

export default function AIUtilitiesPanel({
  loading = false,
  result,
  onSummarize,
  onImproveTone,
  onCreateOutline,
}: Props) {
  // Theming system
  const theming = useTheming('photographer');
  return (
    <section
      aria-label="AI verktøy for notat"
      style={{
        borderLeft: '1px solid rgba(0,0,0,0.08)',
        padding: 12,
        minWidth: 320,
        maxWidth: 420,
        display: 'flex',
        flexDirection: 'column',
        gap: 10}}
    >
      <h3 style={{ margin: 0 }}>AI-verktøy</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={onSummarize} disabled={loading} style={btn}>
          {loading ? 'Arbeider…' : 'Oppsummer'}
        </button>
        <button onClick={onImproveTone} disabled={loading} style={btn}>
          Forbedre tone
        </button>
        <button onClick={onCreateOutline} disabled={loading} style={btn}>
          Lag disposisjon
        </button>
      </div>
      <div
        style={{
          border: '1px dashed rgba(0,0,0,0.15)',
          borderRadius: 10,
          padding: 10,
          minHeight: 120,
          background: '#fff',
          whiteSpace: 'pre-wrap'}}
        aria-live="polite"
      >
        {result || 'AI-resultater vil vises her.'}
      </div>
    </section>
  );
}

const btn: React.CSSProperties = {
  cursor: 'pointer',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid rgba(0,0,0,0.1)',
  background: '#fff',
};
