/**
 * SakerTab — «Saker»-modul i AdminWorkspace.
 *
 * En sak er en lett oppfølgings-tråd: «lead-X må ringes torsdag»,
 * «kunde-Y er misfornøyd med fakturaen», «intern: Stripe-Connect-test må
 * gjøres». Saker kan kobles til en lead/kunde, partner, investor,
 * outreach-template eller funding-app — eller stå alene som intern
 * påminnelse.
 *
 * Layout: liste til venstre (~360px) + drawer til høyre med tittel +
 * markdown-body + status/priority/due_date + linked-entity + tags +
 * kommentar-tråd nederst.
 *
 * Branding: Leadgrid deep purple + violet accent (samme palett som
 * resten av AdminWorkspace).
 *
 * IKKE bygd i denne PR (kommer separat):
 *   - Notifikasjoner / APNS-broadcast på due_date
 *   - Assignee-velger (single-bruker MVP)
 *   - Rich text-editor (markdown-textarea er nok)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LinkIcon from '@mui/icons-material/Link';
import CircleIcon from '@mui/icons-material/Circle';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';

import {
  workspaceCasesApi,
  WORKSPACE_CASE_STATUS_LABELS,
  WORKSPACE_CASE_PRIORITY_LABELS,
  WORKSPACE_CASE_PRIORITY_COLORS,
  WORKSPACE_CASE_LINKED_ENTITY_LABELS,
  type WorkspaceCase,
  type WorkspaceCaseComment,
  type WorkspaceCaseStatus,
  type WorkspaceCasePriority,
  type WorkspaceCaseLinkedEntityType,
  type WorkspaceCaseListFilter,
  type WorkspaceCaseProductKey,
} from '../../services/adminRoomApi';

// ─────────────────────────────────────────────────────────
// Brand (mirror av AdminWorkspace.tsx — holdt lokalt så denne
// komponenten ikke importerer fra parent og lager sirkel)
// ─────────────────────────────────────────────────────────

const BRAND = {
  panelBg: 'rgba(26, 10, 46, 0.72)',
  accent: '#a78bfa',
  accentStrong: '#7c3aed',
  border: 'rgba(167, 139, 250, 0.2)',
  borderHover: 'rgba(167, 139, 250, 0.4)',
  text: '#f1f5f9',
  textMuted: 'rgba(241, 245, 249, 0.78)',
  textDim: 'rgba(241, 245, 249, 0.55)',
  hoverBg: 'rgba(167, 139, 250, 0.08)',
  selectedBg: 'rgba(167, 139, 250, 0.16)',
};

const STATUS_FILTERS: Array<{ id: 'all' | WorkspaceCaseStatus; label: string }> = [
  { id: 'all', label: 'Alle' },
  { id: 'open', label: 'Åpne' },
  { id: 'in_progress', label: 'Pågår' },
  { id: 'blocked', label: 'Blokkert' },
  { id: 'done', label: 'Ferdig' },
];

const PRODUCT_FILTERS: Array<{
  id: 'all' | 'role_room' | 'leadgrid' | 'internal';
  label: string;
}> = [
  { id: 'all', label: 'Alle produkter' },
  { id: 'role_room', label: 'Role Room' },
  { id: 'leadgrid', label: 'Leadgrid' },
  { id: 'internal', label: 'Intern' },
];

const LINKED_ENTITY_OPTIONS: Array<{
  id: WorkspaceCaseLinkedEntityType | '';
  label: string;
}> = [
  { id: '', label: 'Ingen kobling' },
  { id: 'customer', label: WORKSPACE_CASE_LINKED_ENTITY_LABELS.customer },
  { id: 'partner', label: WORKSPACE_CASE_LINKED_ENTITY_LABELS.partner },
  { id: 'investor', label: WORKSPACE_CASE_LINKED_ENTITY_LABELS.investor },
  { id: 'outreach_template', label: WORKSPACE_CASE_LINKED_ENTITY_LABELS.outreach_template },
  { id: 'funding_app', label: WORKSPACE_CASE_LINKED_ENTITY_LABELS.funding_app },
];

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '—';
  const diffMs = Date.now() - then;
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return 'akkurat nå';
  if (diffMin < 60) return `${diffMin} min siden`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} t siden`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay} d siden`;
  return new Date(iso).toLocaleDateString('nb-NO');
}

function formatDueDate(date: string | null): string {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return date;
  }
}

function productLabel(key: WorkspaceCaseProductKey): string {
  if (key === 'role_room') return 'RR';
  if (key === 'leadgrid') return 'LG';
  return 'Intern';
}

function productColor(key: WorkspaceCaseProductKey): string {
  if (key === 'leadgrid') return '#22d3ee';
  if (key === 'role_room') return BRAND.accent;
  return '#64748b';
}

// ─────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────

interface SakerTabProps {
  // Produkt-velgeren fra parent (URL state). 'roleroom' eller 'leadgrid'.
  // Brukes som default-produkt på nye saker. SakerTab har sin egen lokale
  // produkt-filter som ikke nødvendigvis matcher parent.
  parentProduct: 'roleroom' | 'leadgrid';
}

// ─────────────────────────────────────────────────────────
// Komponent
// ─────────────────────────────────────────────────────────

export function SakerTab({ parentProduct }: SakerTabProps) {
  const [cases, setCases] = useState<WorkspaceCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]['id']>(
    () => readUrlParam('cases_status', 'open') as (typeof STATUS_FILTERS)[number]['id'],
  );
  const [productFilter, setProductFilter] = useState<(typeof PRODUCT_FILTERS)[number]['id']>(
    () => readUrlParam('cases_product', 'all') as (typeof PRODUCT_FILTERS)[number]['id'],
  );

  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<WorkspaceCase | null>(null);
  const [comments, setComments] = useState<WorkspaceCaseComment[]>([]);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [newComment, setNewComment] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newPriority, setNewPriority] = useState<WorkspaceCasePriority>('normal');
  const [creating, setCreating] = useState(false);

  // Sync URL state for filter
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.set('cases_status', statusFilter);
    params.set('cases_product', productFilter);
    const next = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', next);
  }, [statusFilter, productFilter]);

  const refreshList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter: WorkspaceCaseListFilter = {};
      if (statusFilter !== 'all') filter.status = statusFilter;
      if (productFilter !== 'all') filter.product = productFilter;
      const items = await workspaceCasesApi.list(filter);
      setCases(items);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke laste saker');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, productFilter]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  // Last detalj når valgt
  useEffect(() => {
    if (!selectedCaseId) {
      setSelectedCase(null);
      setComments([]);
      return;
    }
    let cancelled = false;
    setSelectedLoading(true);
    workspaceCasesApi
      .get(selectedCaseId)
      .then((data) => {
        if (cancelled) return;
        setSelectedCase(data.item);
        setComments(data.comments);
      })
      .catch((err) => {
        if (cancelled) return;
        setError((err as Error).message || 'Kunne ikke laste sak');
      })
      .finally(() => {
        if (cancelled) return;
        setSelectedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCaseId]);

  // Patch et felt på valgt sak (lokalt + server, optimistisk for tekst)
  const patchSelected = useCallback(
    async (
      patch: Parameters<typeof workspaceCasesApi.update>[1],
    ): Promise<void> => {
      if (!selectedCase) return;
      try {
        const updated = await workspaceCasesApi.update(selectedCase.id, patch);
        setSelectedCase(updated);
        setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } catch (err) {
        setError((err as Error).message || 'Kunne ikke oppdatere sak');
      }
    },
    [selectedCase],
  );

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const defaultProductKey: WorkspaceCaseProductKey =
        parentProduct === 'leadgrid' ? 'leadgrid' : 'role_room';
      const created = await workspaceCasesApi.create({
        title: newTitle.trim(),
        body: newBody.trim() || null,
        priority: newPriority,
        productKey: defaultProductKey,
        status: 'open',
      });
      setCases((prev) => [created, ...prev]);
      setSelectedCaseId(created.id);
      setCreateOpen(false);
      setNewTitle('');
      setNewBody('');
      setNewPriority('normal');
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke opprette sak');
    } finally {
      setCreating(false);
    }
  }, [newTitle, newBody, newPriority, parentProduct]);

  const handleDelete = useCallback(async () => {
    if (!selectedCase) return;
    if (!window.confirm(`Slette saken «${selectedCase.title}»? Alle kommentarer slettes også.`)) {
      return;
    }
    try {
      await workspaceCasesApi.delete(selectedCase.id);
      setCases((prev) => prev.filter((c) => c.id !== selectedCase.id));
      setSelectedCaseId(null);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke slette sak');
    }
  }, [selectedCase]);

  const handleAddComment = useCallback(async () => {
    if (!selectedCase || !newComment.trim()) return;
    try {
      const created = await workspaceCasesApi.addComment(selectedCase.id, newComment.trim());
      setComments((prev) => [...prev, created]);
      setNewComment('');
      // Refresh sak for å hente bumpet updated_at
      const fresh = await workspaceCasesApi.get(selectedCase.id);
      setSelectedCase(fresh.item);
      setCases((prev) => prev.map((c) => (c.id === fresh.item.id ? fresh.item : c)));
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke legge til kommentar');
    }
  }, [selectedCase, newComment]);

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      try {
        await workspaceCasesApi.deleteComment(commentId);
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      } catch (err) {
        setError((err as Error).message || 'Kunne ikke slette kommentar');
      }
    },
    [],
  );

  const linkedEntityValue = useMemo(() => selectedCase?.linked_entity_type ?? '', [selectedCase]);

  return (
    <Stack spacing={2} sx={{ height: '100%' }}>
      {/* Top-bar: filtre + ny sak */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {STATUS_FILTERS.map((f) => {
              const active = f.id === statusFilter;
              return (
                <Chip
                  key={f.id}
                  label={f.label}
                  onClick={() => setStatusFilter(f.id)}
                  size="small"
                  sx={{
                    bgcolor: active ? BRAND.accentStrong : 'transparent',
                    color: active ? '#fff' : BRAND.textMuted,
                    border: `1px solid ${active ? BRAND.accentStrong : BRAND.border}`,
                    fontWeight: 700,
                    '&:hover': {
                      bgcolor: active ? BRAND.accentStrong : BRAND.hoverBg,
                    },
                  }}
                />
              );
            })}
          </Stack>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {PRODUCT_FILTERS.map((f) => {
              const active = f.id === productFilter;
              return (
                <Chip
                  key={f.id}
                  label={f.label}
                  onClick={() => setProductFilter(f.id)}
                  size="small"
                  sx={{
                    bgcolor: active ? BRAND.accent : 'transparent',
                    color: active ? '#1a0a2e' : BRAND.textMuted,
                    border: `1px solid ${active ? BRAND.accent : BRAND.border}`,
                    fontWeight: 700,
                    '&:hover': {
                      bgcolor: active ? BRAND.accent : BRAND.hoverBg,
                    },
                  }}
                />
              );
            })}
          </Stack>
        </Stack>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
          sx={{
            bgcolor: BRAND.accentStrong,
            color: '#fff',
            fontWeight: 700,
            textTransform: 'none',
            '&:hover': { bgcolor: '#6d28d9' },
          }}
        >
          Ny sak
        </Button>
      </Stack>

      {error ? (
        <Alert
          severity="error"
          sx={{
            bgcolor: 'rgba(220, 38, 38, 0.16)',
            color: '#fecaca',
            border: '1px solid rgba(220, 38, 38, 0.4)',
          }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      ) : null}

      {/* Hovedlayout: liste + drawer */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ flex: 1, minHeight: 0 }}
      >
        {/* Liste */}
        <Box
          sx={{
            width: { xs: '100%', md: 360 },
            flexShrink: 0,
            borderRadius: 2,
            bgcolor: BRAND.panelBg,
            border: `1px solid ${BRAND.border}`,
            overflowY: 'auto',
            maxHeight: { xs: 360, md: 'calc(100vh - 240px)' },
          }}
        >
          {loading ? (
            <Stack alignItems="center" sx={{ py: 6 }}>
              <CircularProgress size={28} sx={{ color: BRAND.accent }} />
            </Stack>
          ) : cases.length === 0 ? (
            <Stack
              alignItems="center"
              justifyContent="center"
              spacing={1.5}
              sx={{ py: 6, px: 3, textAlign: 'center' }}
            >
              <GavelOutlinedIcon sx={{ color: BRAND.accent, fontSize: 36, opacity: 0.6 }} />
              <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.92rem' }}>
                Du har ingen åpne saker
              </Typography>
              <Typography sx={{ color: BRAND.textMuted, fontSize: '0.82rem' }}>
                Klikk «Ny sak» for å åpne den første.
              </Typography>
            </Stack>
          ) : (
            <Stack divider={<Divider sx={{ borderColor: BRAND.border }} />}>
              {cases.map((c) => {
                const isSelected = c.id === selectedCaseId;
                return (
                  <Stack
                    key={c.id}
                    onClick={() => setSelectedCaseId(c.id)}
                    spacing={0.75}
                    sx={{
                      px: 2,
                      py: 1.5,
                      cursor: 'pointer',
                      bgcolor: isSelected ? BRAND.selectedBg : 'transparent',
                      borderLeft: isSelected
                        ? `3px solid ${BRAND.accent}`
                        : '3px solid transparent',
                      '&:hover': {
                        bgcolor: isSelected ? BRAND.selectedBg : BRAND.hoverBg,
                      },
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Tooltip title={WORKSPACE_CASE_PRIORITY_LABELS[c.priority]} arrow>
                        <CircleIcon
                          sx={{
                            fontSize: 10,
                            color: WORKSPACE_CASE_PRIORITY_COLORS[c.priority],
                          }}
                        />
                      </Tooltip>
                      <Typography
                        sx={{
                          color: BRAND.text,
                          fontWeight: 700,
                          fontSize: '0.86rem',
                          flex: 1,
                          minWidth: 0,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {c.title}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Chip
                        label={WORKSPACE_CASE_STATUS_LABELS[c.status]}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          bgcolor: 'rgba(167, 139, 250, 0.12)',
                          color: '#ddd6fe',
                        }}
                      />
                      <Chip
                        label={productLabel(c.product_key)}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          bgcolor: `${productColor(c.product_key)}24`,
                          color: productColor(c.product_key),
                          border: `1px solid ${productColor(c.product_key)}55`,
                        }}
                      />
                      {c.due_date ? (
                        <Stack direction="row" spacing={0.25} alignItems="center">
                          <ScheduleOutlinedIcon sx={{ fontSize: 12, color: BRAND.textDim }} />
                          <Typography sx={{ fontSize: '0.7rem', color: BRAND.textDim }}>
                            {formatDueDate(c.due_date)}
                          </Typography>
                        </Stack>
                      ) : null}
                    </Stack>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </Box>

        {/* Drawer */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            borderRadius: 2,
            bgcolor: BRAND.panelBg,
            border: `1px solid ${BRAND.border}`,
            overflowY: 'auto',
            maxHeight: { md: 'calc(100vh - 240px)' },
          }}
        >
          {!selectedCase ? (
            <Stack
              alignItems="center"
              justifyContent="center"
              spacing={1.5}
              sx={{ py: 8, px: 4, textAlign: 'center', minHeight: 320 }}
            >
              <GavelOutlinedIcon sx={{ color: BRAND.accent, fontSize: 36, opacity: 0.6 }} />
              <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.96rem' }}>
                Velg en sak
              </Typography>
              <Typography sx={{ color: BRAND.textMuted, fontSize: '0.82rem', maxWidth: 400 }}>
                Klikk på en sak til venstre for å åpne tråden — eller opprett en ny sak fra knappen
                øverst.
              </Typography>
            </Stack>
          ) : selectedLoading ? (
            <Stack alignItems="center" sx={{ py: 8 }}>
              <CircularProgress sx={{ color: BRAND.accent }} />
            </Stack>
          ) : (
            <Stack spacing={2} sx={{ p: 3 }}>
              {/* Tittel + slett-knapp */}
              <Stack direction="row" alignItems="center" spacing={1}>
                <TextField
                  value={selectedCase.title}
                  onChange={(e) =>
                    setSelectedCase((prev) =>
                      prev ? { ...prev, title: e.target.value } : prev,
                    )
                  }
                  onBlur={() => {
                    if (selectedCase.title.trim()) {
                      void patchSelected({ title: selectedCase.title.trim() });
                    }
                  }}
                  variant="standard"
                  fullWidth
                  InputProps={{
                    disableUnderline: true,
                    sx: {
                      color: BRAND.text,
                      fontWeight: 800,
                      fontSize: '1.3rem',
                    },
                  }}
                />
                <IconButton
                  size="small"
                  onClick={handleDelete}
                  sx={{ color: BRAND.textDim, '&:hover': { color: '#fca5a5' } }}
                  aria-label="Slett sak"
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>

              {/* Status / priority / due / product / linked entity */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
                <TextField
                  select
                  label="Status"
                  value={selectedCase.status}
                  onChange={(e) =>
                    void patchSelected({ status: e.target.value as WorkspaceCaseStatus })
                  }
                  size="small"
                  sx={fieldSx}
                  SelectProps={{ MenuProps: menuSx }}
                >
                  {(Object.keys(WORKSPACE_CASE_STATUS_LABELS) as WorkspaceCaseStatus[]).map((s) => (
                    <MenuItem key={s} value={s}>
                      {WORKSPACE_CASE_STATUS_LABELS[s]}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Prioritet"
                  value={selectedCase.priority}
                  onChange={(e) =>
                    void patchSelected({ priority: e.target.value as WorkspaceCasePriority })
                  }
                  size="small"
                  sx={fieldSx}
                  SelectProps={{ MenuProps: menuSx }}
                >
                  {(Object.keys(WORKSPACE_CASE_PRIORITY_LABELS) as WorkspaceCasePriority[]).map(
                    (p) => (
                      <MenuItem key={p} value={p}>
                        {WORKSPACE_CASE_PRIORITY_LABELS[p]}
                      </MenuItem>
                    ),
                  )}
                </TextField>
                <TextField
                  type="date"
                  label="Frist"
                  value={selectedCase.due_date ?? ''}
                  onChange={(e) => void patchSelected({ dueDate: e.target.value || null })}
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  sx={fieldSx}
                />
                <TextField
                  select
                  label="Produkt"
                  value={selectedCase.product_key ?? 'internal'}
                  onChange={(e) =>
                    void patchSelected({
                      productKey:
                        e.target.value === 'internal'
                          ? 'internal'
                          : (e.target.value as 'role_room' | 'leadgrid'),
                    })
                  }
                  size="small"
                  sx={fieldSx}
                  SelectProps={{ MenuProps: menuSx }}
                >
                  <MenuItem value="internal">Intern</MenuItem>
                  <MenuItem value="role_room">Role Room</MenuItem>
                  <MenuItem value="leadgrid">Leadgrid</MenuItem>
                </TextField>
              </Stack>

              {/* Linked entity */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField
                  select
                  label="Koblet til"
                  value={linkedEntityValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    void patchSelected({
                      linkedEntityType: val
                        ? (val as WorkspaceCaseLinkedEntityType)
                        : null,
                    });
                  }}
                  size="small"
                  sx={{ ...fieldSx, minWidth: 220 }}
                  SelectProps={{ MenuProps: menuSx }}
                  InputProps={{ startAdornment: <LinkIcon sx={{ color: BRAND.textDim, fontSize: 16, mr: 0.5 }} /> }}
                >
                  {LINKED_ENTITY_OPTIONS.map((o) => (
                    <MenuItem key={o.id} value={o.id}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>
                {selectedCase.linked_entity_type ? (
                  <TextField
                    label="ID på koblet entitet"
                    value={selectedCase.linked_entity_id ?? ''}
                    onChange={(e) =>
                      setSelectedCase((prev) =>
                        prev ? { ...prev, linked_entity_id: e.target.value } : prev,
                      )
                    }
                    onBlur={() =>
                      void patchSelected({
                        linkedEntityId: selectedCase.linked_entity_id || null,
                      })
                    }
                    size="small"
                    placeholder="UUID / ID-streng"
                    sx={{ ...fieldSx, flex: 1 }}
                  />
                ) : null}
              </Stack>

              {/* Body (markdown) */}
              <TextField
                multiline
                minRows={6}
                placeholder="Beskriv saken… (markdown støttes)"
                value={selectedCase.body ?? ''}
                onChange={(e) =>
                  setSelectedCase((prev) =>
                    prev ? { ...prev, body: e.target.value } : prev,
                  )
                }
                onBlur={() => void patchSelected({ body: selectedCase.body ?? null })}
                sx={{
                  ...fieldSx,
                  '& .MuiInputBase-root': {
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize: '0.84rem',
                    lineHeight: 1.55,
                  },
                }}
              />

              {/* Tags */}
              <TextField
                label="Tags (kommaseparert)"
                value={(selectedCase.tags ?? []).join(', ')}
                onChange={(e) =>
                  setSelectedCase((prev) =>
                    prev
                      ? {
                          ...prev,
                          tags: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        }
                      : prev,
                  )
                }
                onBlur={() => void patchSelected({ tags: selectedCase.tags ?? [] })}
                size="small"
                sx={fieldSx}
              />

              {/* Sync-historikk */}
              <Stack direction="row" spacing={0.75} alignItems="center">
                <HistoryOutlinedIcon sx={{ color: BRAND.textDim, fontSize: 14 }} />
                <Typography sx={{ color: BRAND.textDim, fontSize: '0.72rem' }}>
                  Sist endret {formatRelativeTime(selectedCase.updated_at)}
                  {selectedCase.updated_by ? ` av ${selectedCase.updated_by}` : ''}
                </Typography>
              </Stack>

              <Divider sx={{ borderColor: BRAND.border }} />

              {/* Kommentar-tråd */}
              <Box>
                <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.92rem', mb: 1 }}>
                  Kommentarer ({comments.length})
                </Typography>
                {comments.length === 0 ? (
                  <Typography sx={{ color: BRAND.textDim, fontSize: '0.8rem', mb: 1.5 }}>
                    Ingen kommentarer ennå.
                  </Typography>
                ) : (
                  <Stack spacing={1} sx={{ mb: 1.5 }}>
                    {comments.map((c) => (
                      <Stack
                        key={c.id}
                        spacing={0.5}
                        sx={{
                          p: 1.25,
                          borderRadius: 1.5,
                          bgcolor: 'rgba(167, 139, 250, 0.06)',
                          border: `1px solid ${BRAND.border}`,
                        }}
                      >
                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          spacing={1}
                        >
                          <Typography sx={{ color: BRAND.textMuted, fontSize: '0.72rem' }}>
                            {formatRelativeTime(c.created_at)}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => void handleDeleteComment(c.id)}
                            sx={{ color: BRAND.textDim, '&:hover': { color: '#fca5a5' } }}
                            aria-label="Slett kommentar"
                          >
                            <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Stack>
                        <Typography
                          sx={{
                            color: BRAND.text,
                            fontSize: '0.84rem',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.5,
                          }}
                        >
                          {c.body}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <TextField
                    multiline
                    minRows={2}
                    placeholder="Legg til en kommentar…"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    sx={{ ...fieldSx, flex: 1 }}
                  />
                  <Button
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    variant="contained"
                    sx={{
                      bgcolor: BRAND.accentStrong,
                      color: '#fff',
                      fontWeight: 700,
                      textTransform: 'none',
                      '&:hover': { bgcolor: '#6d28d9' },
                      '&.Mui-disabled': {
                        bgcolor: 'rgba(167, 139, 250, 0.12)',
                        color: BRAND.textDim,
                      },
                    }}
                  >
                    Send
                  </Button>
                </Stack>
              </Box>
            </Stack>
          )}
        </Box>
      </Stack>

      {/* Ny-sak-dialog */}
      <Dialog
        open={createOpen}
        onClose={() => (creating ? undefined : setCreateOpen(false))}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            bgcolor: '#1a0a2e',
            color: BRAND.text,
            border: `1px solid ${BRAND.border}`,
            backgroundImage: 'none',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Ny sak</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Tittel"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              fullWidth
              autoFocus
              sx={fieldSx}
            />
            <TextField
              label="Beskrivelse (markdown)"
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              multiline
              minRows={4}
              fullWidth
              sx={fieldSx}
            />
            <TextField
              select
              label="Prioritet"
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as WorkspaceCasePriority)}
              size="small"
              fullWidth
              sx={fieldSx}
              SelectProps={{ MenuProps: menuSx }}
            >
              {(Object.keys(WORKSPACE_CASE_PRIORITY_LABELS) as WorkspaceCasePriority[]).map((p) => (
                <MenuItem key={p} value={p}>
                  {WORKSPACE_CASE_PRIORITY_LABELS[p]}
                </MenuItem>
              ))}
            </TextField>
            <Typography sx={{ color: BRAND.textDim, fontSize: '0.74rem' }}>
              Sak opprettes under produkt{' '}
              <strong style={{ color: BRAND.text }}>
                {parentProduct === 'leadgrid' ? 'Leadgrid' : 'Role Room'}
              </strong>{' '}
              (basert på aktivt produkt i sidebar — du kan endre etter opprettelse).
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setCreateOpen(false)}
            disabled={creating}
            sx={{ color: BRAND.textMuted, textTransform: 'none' }}
          >
            Avbryt
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!newTitle.trim() || creating}
            variant="contained"
            sx={{
              bgcolor: BRAND.accentStrong,
              color: '#fff',
              fontWeight: 700,
              textTransform: 'none',
              '&:hover': { bgcolor: '#6d28d9' },
            }}
          >
            {creating ? 'Oppretter…' : 'Opprett sak'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
// Styling helpers
// ─────────────────────────────────────────────────────────

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: BRAND.text,
    '& fieldset': { borderColor: BRAND.border },
    '&:hover fieldset': { borderColor: BRAND.borderHover },
    '&.Mui-focused fieldset': { borderColor: BRAND.accent },
  },
  '& .MuiInputLabel-root': { color: BRAND.textMuted },
  '& .MuiInputLabel-root.Mui-focused': { color: BRAND.accent },
  '& .MuiSelect-icon': { color: BRAND.textMuted },
};

const menuSx = {
  PaperProps: {
    sx: {
      bgcolor: '#1a0a2e',
      color: BRAND.text,
      border: `1px solid ${BRAND.border}`,
      '& .MuiMenuItem-root:hover': { bgcolor: BRAND.hoverBg },
      '& .MuiMenuItem-root.Mui-selected': { bgcolor: BRAND.selectedBg },
    },
  },
};

// ─────────────────────────────────────────────────────────
// URL state helper
// ─────────────────────────────────────────────────────────

function readUrlParam(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = new URLSearchParams(window.location.search).get(key);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
