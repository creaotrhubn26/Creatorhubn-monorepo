/**
 * EntityCrudPanel — generisk liste-+-skjema for de tabbene som er ren
 * CRUD over en enkelt ressurs. Brukes av classes/instructors/rooms/
 * movement-vocab og planlagt for grants/billing/union.
 *
 * Bidrar med:
 * - List + søk
 * - Opprett-knapp som åpner en form-dialog
 * - Klikk-rad åpner samme dialog i edit-modus
 * - Slett med confirm
 * - Konfigurerbart skjema via `fields`-prop
 */

import React from 'react';
import {
  Box,
  Stack,
  Typography,
  Button,
  IconButton,
  Tooltip,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Chip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
} from '@mui/icons-material';

const PURPLE = '#8b5cf6';
const PURPLE_LIGHT = '#a78bfa';
const BG = '#0a0a0a';
const CARD = '#111114';
const BORDER = 'rgba(139,92,246,0.25)';

export type FieldType =
  | { kind: 'text'; multiline?: boolean; placeholder?: string; required?: boolean }
  | { kind: 'number'; min?: number; max?: number; step?: number }
  | { kind: 'datetime' }
  | { kind: 'select'; options: ReadonlyArray<{ value: string; label: string }> }
  | { kind: 'boolean' }
  | { kind: 'string-array'; placeholder?: string };

export interface EntityField {
  key: string;
  label: string;
  type: FieldType;
  /** Vis bare i listen, ikke i form. */
  listOnly?: boolean;
  /** Vis bare i form, ikke i listen. */
  formOnly?: boolean;
  /** Render-override for listen. */
  renderInList?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

export interface EntityCrudPanelProps<T extends { id: string } & object> {
  title: string;
  description?: string;
  fields: EntityField[];
  /** Hvilket felt som vises som primær-overskrift i listen. */
  primaryField: string;
  /** Hvilket felt som filtreres ved søk. */
  searchableFields?: string[];

  list: () => Promise<T[]>;
  create: (input: Partial<T>) => Promise<T>;
  patch: (id: string, patch: Partial<T>) => Promise<T>;
  remove: (id: string) => Promise<void>;

  /** Default-verdier for nye rader (utenom feltene som har default på server). */
  newDefaults?: Partial<T>;
  /** Render et ekstra panel per rad (e.g. enrollments-listen for en class). */
  rowExpansion?: (row: T) => React.ReactNode;
  /** Tom-tilstand-melding. */
  emptyText?: string;
  /** Eksplisitt testid for panel-root (default: undefined). Lar specs scope-e til ett panel. */
  panelTestId?: string;
}

export function EntityCrudPanel<T extends { id: string } & object>({
  title,
  description,
  fields,
  primaryField,
  searchableFields = [],
  list,
  create,
  patch,
  remove,
  newDefaults = {},
  rowExpansion,
  emptyText = 'Ingen oppføringer ennå.',
  panelTestId,
}: EntityCrudPanelProps<T>): React.ReactElement {
  const [items, setItems] = React.useState<T[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<T | null>(null);
  const [draft, setDraft] = React.useState<Record<string, unknown>>({});
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const refresh = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      setItems(await list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke laste liste');
    } finally {
      setLoading(false);
    }
  }, [list]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const filtered = React.useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      const checkFields = searchableFields.length > 0 ? searchableFields : [primaryField];
      return checkFields.some((f) => {
        const v = (it as unknown as Record<string, unknown>)[f];
        if (typeof v !== 'string') return false;
        return v.toLowerCase().includes(q);
      });
    });
  }, [items, search, searchableFields, primaryField]);

  const openCreate = (): void => {
    setEditing(null);
    setDraft({ ...newDefaults });
    setSaveError(null);
    setDialogOpen(true);
  };

  const openEdit = (row: T): void => {
    setEditing(row);
    setDraft({ ...row });
    setSaveError(null);
    setDialogOpen(true);
  };

  const submitDraft = async (): Promise<void> => {
    setSaving(true);
    setSaveError(null);
    try {
      // Trim only fields that exist in `fields` so we don't send unknown props.
      const payload: Record<string, unknown> = {};
      for (const f of fields) {
        if (f.listOnly) continue;
        if (draft[f.key] !== undefined) payload[f.key] = draft[f.key];
      }
      // Always include id-passthrough refs that came in as defaults (e.g.
      // projectId, parent ids).
      for (const k of Object.keys(newDefaults)) {
        if (payload[k] === undefined && (newDefaults as Record<string, unknown>)[k] !== undefined) {
          payload[k] = (newDefaults as Record<string, unknown>)[k];
        }
      }
      if (editing) {
        await patch(editing.id, payload as Partial<T>);
      } else {
        await create(payload as Partial<T>);
      }
      setDialogOpen(false);
      setEditing(null);
      setDraft({});
      await refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Lagring feilet');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: T): Promise<void> => {
    const label = ((row as unknown as Record<string, unknown>)[primaryField] as string) ?? row.id;
    if (!window.confirm(`Slett "${label}"?`)) return;
    try {
      await remove(row.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sletting feilet');
    }
  };

  const toggleExpansion = (id: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Box data-testid={panelTestId} sx={{ bgcolor: BG, color: '#e5e7eb', minHeight: '100%', p: { xs: 2, md: 3 } }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        sx={{ mb: 2 }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 10, letterSpacing: 2, color: PURPLE_LIGHT, fontWeight: 700 }}>
            {title.toUpperCase()}
          </Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
            {items.length} oppføringer
          </Typography>
          {description ? (
            <Typography sx={{ fontSize: 11, color: 'rgba(229,231,235,0.6)', mt: 0.5 }}>
              {description}
            </Typography>
          ) : null}
        </Box>
        <TextField
          size="small"
          placeholder="Søk…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ fontSize: 16, color: 'rgba(229,231,235,0.5)', mr: 0.5 }} />,
          }}
          sx={{
            minWidth: 200,
            '& .MuiInputBase-root': { bgcolor: CARD, color: '#e5e7eb', fontSize: 12 },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER },
          }}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          sx={{ bgcolor: PURPLE, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 600 }}
          data-testid={`crud-new-${primaryField}`}
        >
          Ny
        </Button>
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      {loading && items.length === 0 ? (
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress size={24} sx={{ color: PURPLE }} />
        </Stack>
      ) : null}

      {!loading && filtered.length === 0 ? (
        <Typography sx={{ color: 'rgba(229,231,235,0.5)', fontStyle: 'italic', py: 4, textAlign: 'center' }}>
          {emptyText}
        </Typography>
      ) : null}

      <Stack spacing={1}>
        {filtered.map((row) => {
          const isExpanded = expanded.has(row.id);
          return (
            <Box
              key={row.id}
              data-testid={`crud-row-${row.id}`}
              sx={{
                p: 1.5,
                bgcolor: CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 1.5,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Box
                  sx={{ flex: 1, cursor: rowExpansion ? 'pointer' : 'default' }}
                  onClick={() => rowExpansion && toggleExpansion(row.id)}
                >
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                    {String((row as unknown as Record<string, unknown>)[primaryField] ?? row.id)}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    {fields
                      .filter((f) => !f.formOnly && f.key !== primaryField)
                      .map((f) => {
                        const value = (row as unknown as Record<string, unknown>)[f.key];
                        if (value == null || value === '') return null;
                        const display = f.renderInList
                          ? f.renderInList(value, row as unknown as Record<string, unknown>)
                          : formatFieldValue(value, f.type);
                        return display ? (
                          <Chip
                            key={f.key}
                            size="small"
                            label={
                              <Box component="span">
                                <Box component="span" sx={{ color: 'rgba(229,231,235,0.5)', mr: 0.5 }}>
                                  {f.label}:
                                </Box>
                                {display}
                              </Box>
                            }
                            sx={{
                              height: 22,
                              fontSize: 11,
                              bgcolor: 'rgba(139,92,246,0.10)',
                              color: '#e5e7eb',
                              maxWidth: 320,
                              '& .MuiChip-label': { display: 'flex', alignItems: 'center' },
                            }}
                          />
                        ) : null;
                      })}
                  </Stack>
                </Box>
                <Tooltip title="Rediger">
                  <IconButton size="small" onClick={() => openEdit(row)} data-testid={`crud-edit-${row.id}`} sx={{ color: PURPLE_LIGHT }}>
                    <EditIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Slett">
                  <IconButton size="small" onClick={() => void handleDelete(row)} data-testid={`crud-delete-${row.id}`} sx={{ color: 'rgba(229,231,235,0.4)' }}>
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
              {isExpanded && rowExpansion ? (
                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${BORDER}` }}>
                  {rowExpansion(row)}
                </Box>
              ) : null}
            </Box>
          );
        })}
      </Stack>

      {/* Form dialog */}
      <Dialog
        open={dialogOpen}
        onClose={saving ? undefined : () => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editing
            ? `Rediger: ${String((editing as unknown as Record<string, unknown>)[primaryField] ?? editing.id)}`
            : `Ny ${title.toLowerCase()}`}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {fields
              .filter((f) => !f.listOnly)
              .map((f) => (
                <FieldEditor
                  key={f.key}
                  field={f}
                  value={draft[f.key]}
                  onChange={(v) => setDraft((prev) => ({ ...prev, [f.key]: v }))}
                />
              ))}
            {saveError ? <Alert severity="error">{saveError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => void submitDraft()}
            disabled={saving}
            sx={{ bgcolor: PURPLE, '&:hover': { bgcolor: '#7c3aed' } }}
            data-testid="crud-submit"
          >
            {saving ? 'Lagrer…' : editing ? 'Lagre' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function formatFieldValue(value: unknown, type: FieldType): string {
  if (value == null) return '';
  if (type.kind === 'datetime' && typeof value === 'string') {
    try {
      return new Date(value).toLocaleString('nb-NO', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return String(value); }
  }
  if (type.kind === 'boolean') return value ? 'Ja' : 'Nei';
  if (type.kind === 'select' && typeof value === 'string') {
    return type.options.find((o) => o.value === value)?.label ?? value;
  }
  if (type.kind === 'string-array' && Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

interface FieldEditorProps {
  field: EntityField;
  value: unknown;
  onChange: (value: unknown) => void;
}

const FieldEditor: React.FC<FieldEditorProps> = ({ field, value, onChange }) => {
  if (field.type.kind === 'select') {
    return (
      <TextField
        select
        size="small"
        label={field.label}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        fullWidth
      >
        {field.type.options.map((o) => (
          <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
        ))}
      </TextField>
    );
  }
  if (field.type.kind === 'boolean') {
    return (
      <FormControlLabel
        control={
          <Switch
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            sx={{ '& .Mui-checked': { color: PURPLE } }}
          />
        }
        label={field.label}
      />
    );
  }
  if (field.type.kind === 'number') {
    return (
      <TextField
        type="number"
        size="small"
        label={field.label}
        value={typeof value === 'number' ? value : value === '' ? '' : ''}
        onChange={(e) => {
          const n = e.target.value === '' ? null : Number(e.target.value);
          onChange(n);
        }}
        inputProps={{
          min: field.type.min, max: field.type.max, step: field.type.step ?? 1,
        }}
        fullWidth
      />
    );
  }
  if (field.type.kind === 'datetime') {
    // Local-datetime input; value should be ISO. Convert for display.
    const localValue = typeof value === 'string' && value.length > 0
      ? new Date(value).toISOString().slice(0, 16)
      : '';
    return (
      <TextField
        type="datetime-local"
        size="small"
        label={field.label}
        value={localValue}
        onChange={(e) => {
          if (!e.target.value) onChange(null);
          else onChange(new Date(e.target.value).toISOString());
        }}
        InputLabelProps={{ shrink: true }}
        fullWidth
      />
    );
  }
  if (field.type.kind === 'string-array') {
    const text = Array.isArray(value) ? value.join(', ') : '';
    return (
      <TextField
        size="small"
        label={field.label}
        placeholder={field.type.placeholder ?? 'komma-separert'}
        value={text}
        onChange={(e) => {
          const parts = e.target.value.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
          onChange(parts);
        }}
        fullWidth
      />
    );
  }
  // text
  return (
    <TextField
      size="small"
      label={field.label}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value || (field.type.kind === 'text' && field.type.required ? '' : null))}
      placeholder={field.type.kind === 'text' ? field.type.placeholder : undefined}
      multiline={field.type.kind === 'text' && field.type.multiline}
      minRows={field.type.kind === 'text' && field.type.multiline ? 2 : undefined}
      maxRows={field.type.kind === 'text' && field.type.multiline ? 6 : undefined}
      fullWidth
    />
  );
};

export default EntityCrudPanel;
