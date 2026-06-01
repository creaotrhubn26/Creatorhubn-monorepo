/**
 * DeckLayoutEditor — dynamisk redigerings-form for én slide. Speiler
 * fields-listen i `deckLayouts.ts` så vi får riktige inputs per layout.
 *
 * Patches sendes via `onPatch(nextContent)`. Selve auto-save-debouncing
 * og persistens er DeckEditors ansvar; denne komponenten holder lokal
 * state for snappig UI og sender oppdaterte content-objekter opp.
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { getLayout, type FieldSpec, type LayoutDef } from './deckLayouts';

interface DeckLayoutEditorProps {
  layout: string;
  content: Record<string, unknown>;
  onPatch: (nextContent: Record<string, unknown>) => void;
}

export const DeckLayoutEditor: React.FC<DeckLayoutEditorProps> = ({
  layout,
  content,
  onPatch,
}) => {
  const def: LayoutDef = getLayout(layout);
  const [local, setLocal] = useState<Record<string, unknown>>(content);

  useEffect(() => {
    setLocal(content);
  }, [content, layout]);

  const update = (key: string, value: unknown): void => {
    const next = { ...local, [key]: value };
    setLocal(next);
    onPatch(next);
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.55)', fontWeight: 700, letterSpacing: 0.5 }}>
          LAYOUT: {def.label.toUpperCase()}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', color: 'rgba(226,232,240,0.45)' }}>
          {def.shortDescription}
        </Typography>
      </Box>
      {def.fields.map((f) => (
        <FieldEditor key={f.key} field={f} value={local[f.key]} onChange={(v) => update(f.key, v)} />
      ))}
    </Stack>
  );
};

// ─────────────────────────────────────────────────────────────────────

interface FieldEditorProps {
  field: FieldSpec;
  value: unknown;
  onChange: (next: unknown) => void;
}

function FieldEditor({ field, value, onChange }: FieldEditorProps): JSX.Element {
  switch (field.kind) {
    case 'text':
      return (
        <TextField
          size="small"
          label={field.label}
          placeholder={field.placeholder}
          helperText={field.helper}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          fullWidth
        />
      );
    case 'textarea':
      return (
        <TextField
          size="small"
          multiline
          minRows={2}
          label={field.label}
          placeholder={field.placeholder}
          helperText={field.helper}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          fullWidth
        />
      );
    case 'string_list':
      return <StringListEditor field={field} value={value} onChange={onChange} />;
    case 'pillars':
      return <PillarsEditor field={field} value={value} onChange={onChange} />;
    case 'stats':
      return <StatsEditor field={field} value={value} onChange={onChange} />;
    case 'team_members':
      return <TeamMembersEditor field={field} value={value} onChange={onChange} />;
    case 'use_of_funds':
      return <UseOfFundsEditor field={field} value={value} onChange={onChange} />;
    default:
      return <></>;
  }
}

function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

// ─── String list ─────────────────────────────────────────────────────
function StringListEditor({ field, value, onChange }: FieldEditorProps): JSX.Element {
  const items = asArray<string>(value);
  return (
    <Stack spacing={1}>
      <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.7)', fontWeight: 600 }}>{field.label}</Typography>
      {items.map((item, i) => (
        <Stack key={i} direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            fullWidth
          />
          <IconButton size="small" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={() => onChange([...items, ''])}>
        Legg til
      </Button>
    </Stack>
  );
}

// ─── Pillars (max 3) ─────────────────────────────────────────────────
const PILLAR_ICONS = ['verified', 'team', 'lock', 'trending', 'star'];
function PillarsEditor({ field, value, onChange }: FieldEditorProps): JSX.Element {
  const items = asArray<{ icon?: string; title?: string; subtitle?: string }>(value);
  return (
    <Stack spacing={1}>
      <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.7)', fontWeight: 600 }}>{field.label}</Typography>
      {items.map((p, i) => (
        <Stack key={i} direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            select
            SelectProps={{ native: true }}
            label="Ikon"
            value={p.icon ?? 'star'}
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...p, icon: e.target.value };
              onChange(next);
            }}
            sx={{ minWidth: 110 }}
          >
            {PILLAR_ICONS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Tittel"
            value={p.title ?? ''}
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...p, title: e.target.value };
              onChange(next);
            }}
          />
          <TextField
            size="small"
            label="Undertittel"
            value={p.subtitle ?? ''}
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...p, subtitle: e.target.value };
              onChange(next);
            }}
          />
          <IconButton size="small" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      {items.length < 3 && (
        <Button size="small" startIcon={<AddIcon />} onClick={() => onChange([...items, { icon: 'star', title: '', subtitle: '' }])}>
          Legg til pillar
        </Button>
      )}
    </Stack>
  );
}

// ─── Stats ───────────────────────────────────────────────────────────
function StatsEditor({ field, value, onChange }: FieldEditorProps): JSX.Element {
  const items = asArray<{ value?: string; label?: string }>(value);
  return (
    <Stack spacing={1}>
      <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.7)', fontWeight: 600 }}>{field.label}</Typography>
      {items.map((s, i) => (
        <Stack key={i} direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            label="Verdi"
            value={s.value ?? ''}
            placeholder="12K+"
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...s, value: e.target.value };
              onChange(next);
            }}
            sx={{ minWidth: 110 }}
          />
          <TextField
            size="small"
            label="Etikett"
            value={s.label ?? ''}
            placeholder="Verified talent"
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...s, label: e.target.value };
              onChange(next);
            }}
            fullWidth
          />
          <IconButton size="small" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      {items.length < 6 && (
        <Button size="small" startIcon={<AddIcon />} onClick={() => onChange([...items, { value: '', label: '' }])}>
          Legg til stat
        </Button>
      )}
    </Stack>
  );
}

// ─── Team members ────────────────────────────────────────────────────
function TeamMembersEditor({ field, value, onChange }: FieldEditorProps): JSX.Element {
  const items = asArray<{ name?: string; role?: string; bio?: string }>(value);
  return (
    <Stack spacing={1}>
      <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.7)', fontWeight: 600 }}>{field.label}</Typography>
      {items.map((m, i) => (
        <Box
          key={i}
          sx={{
            p: 1.5,
            border: '1px solid rgba(167,139,250,0.18)',
            borderRadius: 1,
            bgcolor: 'rgba(167,139,250,0.04)',
          }}
        >
          <Stack spacing={1}>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Navn"
                value={m.name ?? ''}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = { ...m, name: e.target.value };
                  onChange(next);
                }}
                fullWidth
              />
              <TextField
                size="small"
                label="Rolle"
                value={m.role ?? ''}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = { ...m, role: e.target.value };
                  onChange(next);
                }}
                fullWidth
              />
              <IconButton size="small" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
            <TextField
              size="small"
              multiline
              minRows={2}
              label="Bio (kort)"
              value={m.bio ?? ''}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...m, bio: e.target.value };
                onChange(next);
              }}
              fullWidth
            />
          </Stack>
        </Box>
      ))}
      {items.length < 4 && (
        <Button size="small" startIcon={<AddIcon />} onClick={() => onChange([...items, { name: '', role: '', bio: '' }])}>
          Legg til medlem
        </Button>
      )}
    </Stack>
  );
}

// ─── Use of funds ─────────────────────────────────────────────────────
function UseOfFundsEditor({ field, value, onChange }: FieldEditorProps): JSX.Element {
  const items = asArray<{ label?: string; percent?: number }>(value);
  const total = items.reduce((sum, u) => sum + Number(u.percent ?? 0), 0);
  return (
    <Stack spacing={1}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline">
        <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.7)', fontWeight: 600 }}>{field.label}</Typography>
        <Typography
          variant="caption"
          sx={{
            color: total === 100 ? '#86efac' : total === 0 ? 'rgba(226,232,240,0.4)' : '#fbbf24',
            fontWeight: 700,
          }}
        >
          Sum: {total}%
        </Typography>
      </Stack>
      {items.map((u, i) => (
        <Stack key={i} direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            label="Kategori"
            value={u.label ?? ''}
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...u, label: e.target.value };
              onChange(next);
            }}
            fullWidth
          />
          <TextField
            size="small"
            type="number"
            label="%"
            value={u.percent ?? ''}
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...u, percent: Number.parseInt(e.target.value, 10) || 0 };
              onChange(next);
            }}
            sx={{ width: 90 }}
            inputProps={{ min: 0, max: 100 }}
          />
          <IconButton size="small" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={() => onChange([...items, { label: '', percent: 0 }])}>
        Legg til
      </Button>
    </Stack>
  );
}

export default DeckLayoutEditor;
