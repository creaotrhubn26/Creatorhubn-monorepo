/**
 * OppgaverTab — «Oppgaver»-flaten i AdminWorkspace.
 *
 * Var en EmptyState med TODO-en «aggregér crm_tasks + role_room_tasks +
 * leadgrid_tasks i én feed». Den datamodellen finnes ikke, men saker
 * (admin_workspace_cases) har allerede status, prioritet og due_date —
 * altså er en oppgave i praksis en sak sett gjennom forfallsbrillene.
 * Vi bygger derfor på workspaceCasesApi i stedet for å innføre en ny
 * tabell vi ikke vet at vi trenger.
 *
 * Forskjellen fra Saker-fanen: Saker er trådvisningen (kommentarer,
 * kobling, detalj). Oppgaver er arbeidskøen — sortert på forfall,
 * gruppert i Forfalt / I dag / Denne uka / Senere / Uten frist, med
 * ett-klikks «Ferdig».
 */

import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';

import {
  WORKSPACE_CASE_PRIORITY_COLORS,
  WORKSPACE_CASE_PRIORITY_LABELS,
  WORKSPACE_CASE_STATUS_LABELS,
  type WorkspaceCase,
  type WorkspaceCaseListFilter,
} from '../../services/adminRoomApi';
import { BRAND } from './brand';
import { queryError, useCompleteCase, useWorkspaceCases } from './useWorkspaceData';

type ProductFilterId = 'all' | 'role_room' | 'leadgrid' | 'internal';

const PRODUCT_FILTERS: Array<{ id: ProductFilterId; label: string }> = [
  { id: 'all', label: 'Alle produkter' },
  { id: 'role_room', label: 'Role Room' },
  { id: 'leadgrid', label: 'Leadgrid' },
  { id: 'internal', label: 'Intern' },
];

/** Bøtter i forfallsrekkefølge. Rekkefølgen her er visningsrekkefølgen. */
type BucketId = 'overdue' | 'today' | 'week' | 'later' | 'undated';

const BUCKET_LABELS: Record<BucketId, string> = {
  overdue: 'Forfalt',
  today: 'I dag',
  week: 'Denne uka',
  later: 'Senere',
  undated: 'Uten frist',
};

const BUCKET_ORDER: BucketId[] = ['overdue', 'today', 'week', 'later', 'undated'];

function osloDayKey(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(date);
}

function bucketFor(dueDate: string | null, todayKey: string, weekEndKey: string): BucketId {
  if (!dueDate) return 'undated';
  const key = dueDate.slice(0, 10);
  if (key < todayKey) return 'overdue';
  if (key === todayKey) return 'today';
  if (key <= weekEndKey) return 'week';
  return 'later';
}

function formatDue(dueDate: string | null): string {
  if (!dueDate) return '';
  const d = new Date(`${dueDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dueDate;
  return new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short' }).format(d);
}

interface OppgaverTabProps {
  /** Aktivt produkt fra topp-toggelen — brukes som default-filter. */
  parentProduct: 'roleroom' | 'leadgrid';
  /** Åpne saken i Saker-fanen (trådvisningen). */
  onOpenCase: (caseId: string) => void;
}

export function OppgaverTab({ parentProduct, onOpenCase }: OppgaverTabProps) {
  const [productFilter, setProductFilter] = useState<ProductFilterId>(
    parentProduct === 'leadgrid' ? 'leadgrid' : 'all',
  );
  const [completing, setCompleting] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Samme query-nøkkel som Saker-fanen når filteret matcher — ett kall,
  // og «Ferdig» her oppdaterer begge flatene.
  const listFilter = useMemo<WorkspaceCaseListFilter>(
    () => (productFilter === 'all' ? {} : { product: productFilter }),
    [productFilter],
  );
  const query = useWorkspaceCases(listFilter);
  const completeCase = useCompleteCase();

  // Arbeidskøen viser bare det som faktisk står igjen.
  const cases = useMemo(
    () => (query.data ?? []).filter((c) => c.status !== 'done' && c.status !== 'archived'),
    [query.data],
  );
  const loading = query.isPending;
  const error = actionError ?? queryError(query.error, 'Kunne ikke laste oppgaver');

  const handleComplete = useCallback(
    async (item: WorkspaceCase) => {
      setCompleting(item.id);
      setActionError(null);
      try {
        await completeCase.mutateAsync(item.id);
      } catch (err) {
        setActionError((err as Error).message || 'Kunne ikke markere oppgaven som ferdig');
      } finally {
        setCompleting(null);
      }
    },
    [completeCase],
  );

  const buckets = useMemo(() => {
    const now = new Date();
    const todayKey = osloDayKey(now);
    const weekEndKey = osloDayKey(new Date(now.getTime() + 7 * 86_400_000));

    const map = new Map<BucketId, WorkspaceCase[]>();
    for (const c of cases) {
      const bucket = bucketFor(c.due_date, todayKey, weekEndKey);
      const list = map.get(bucket);
      if (list) list.push(c);
      else map.set(bucket, [c]);
    }

    const priorityRank: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
    for (const list of map.values()) {
      list.sort((a, b) => {
        // Innenfor en bøtte: forfall først, så prioritet.
        if (a.due_date && b.due_date && a.due_date !== b.due_date) {
          return a.due_date.localeCompare(b.due_date);
        }
        return (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
      });
    }

    return BUCKET_ORDER.filter((id) => (map.get(id)?.length ?? 0) > 0).map((id) => ({
      id,
      items: map.get(id) as WorkspaceCase[],
    }));
  }, [cases]);

  const overdueCount = buckets.find((b) => b.id === 'overdue')?.items.length ?? 0;

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={productFilter}
          onChange={(_, v) => {
            if (v) setProductFilter(v as ProductFilterId);
          }}
          sx={{
            '& .MuiToggleButton-root': {
              color: BRAND.textMuted,
              borderColor: BRAND.border,
              fontSize: '0.72rem',
              py: 0.25,
              px: 1.25,
              textTransform: 'none',
              '&.Mui-selected': { bgcolor: BRAND.selectedBg, color: BRAND.text },
            },
          }}
        >
          {PRODUCT_FILTERS.map((f) => (
            <ToggleButton key={f.id} value={f.id}>
              {f.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Box sx={{ flex: 1 }} />

        {overdueCount > 0 ? (
          <Chip
            icon={<WarningAmberOutlinedIcon sx={{ fontSize: 14 }} />}
            label={`${overdueCount} forfalt`}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.72rem',
              fontWeight: 700,
              bgcolor: 'rgba(239, 68, 68, 0.16)',
              color: '#fca5a5',
            }}
          />
        ) : null}
      </Stack>

      {error ? (
        <Alert
          severity="error"
          onClose={() => setActionError(null)}
          sx={{
            bgcolor: 'rgba(220, 38, 38, 0.16)',
            color: '#fecaca',
            border: '1px solid rgba(220, 38, 38, 0.4)',
          }}
        >
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress sx={{ color: BRAND.accent }} />
        </Stack>
      ) : buckets.length === 0 ? (
        <Stack alignItems="center" spacing={1.5} sx={{ py: 8, textAlign: 'center' }}>
          <TaskAltOutlinedIcon sx={{ color: BRAND.accent, fontSize: 40, opacity: 0.6 }} />
          <Typography sx={{ color: BRAND.text, fontWeight: 700 }}>Ingenting står igjen</Typography>
          <Typography sx={{ color: BRAND.textMuted, fontSize: '0.84rem', maxWidth: 420 }}>
            Oppgaver er saker som ikke er ferdige. Opprett en sak under «Saker» — den dukker opp
            her så snart den har en frist eller en prioritet å jobbe etter.
          </Typography>
        </Stack>
      ) : (
        <Stack spacing={2.5}>
          {buckets.map((bucket) => (
            <Box key={bucket.id}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Typography
                  sx={{
                    color: bucket.id === 'overdue' ? '#fca5a5' : BRAND.textMuted,
                    fontWeight: 700,
                    fontSize: '0.76rem',
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                  }}
                >
                  {BUCKET_LABELS[bucket.id]}
                </Typography>
                <Typography sx={{ color: BRAND.textDim, fontSize: '0.74rem' }}>
                  {bucket.items.length}
                </Typography>
              </Stack>

              <Stack spacing={0.75}>
                {bucket.items.map((item) => (
                  <Stack
                    key={item.id}
                    direction="row"
                    alignItems="center"
                    spacing={1.25}
                    sx={{
                      p: 1.25,
                      borderRadius: 2,
                      bgcolor: BRAND.panelBg,
                      border: `1px solid ${BRAND.border}`,
                      borderLeft: `3px solid ${WORKSPACE_CASE_PRIORITY_COLORS[item.priority]}`,
                      '&:hover': { borderColor: BRAND.borderHover },
                    }}
                  >
                    <Tooltip title="Marker som ferdig">
                      <span>
                        <IconButton
                          size="small"
                          disabled={completing === item.id}
                          onClick={() => void handleComplete(item)}
                          sx={{ color: BRAND.textDim, '&:hover': { color: BRAND.success } }}
                        >
                          {completing === item.id ? (
                            <CircularProgress size={16} sx={{ color: BRAND.accent }} />
                          ) : (
                            <RadioButtonUncheckedIcon sx={{ fontSize: 18 }} />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Box
                      component="button"
                      type="button"
                      onClick={() => onOpenCase(item.id)}
                      aria-label={`Åpne saken «${item.title}»`}
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        cursor: 'pointer',
                        border: 'none',
                        bgcolor: 'transparent',
                        font: 'inherit',
                        textAlign: 'left',
                        p: 0,
                        '&:focus-visible': {
                          outline: `2px solid ${BRAND.accent}`,
                          outlineOffset: 2,
                          borderRadius: 4,
                        },
                      }}
                    >
                      <Typography
                        sx={{
                          color: BRAND.text,
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.title}
                      </Typography>
                      {item.body ? (
                        <Typography
                          sx={{
                            color: BRAND.textDim,
                            fontSize: '0.74rem',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.body}
                        </Typography>
                      ) : null}
                    </Box>

                    {item.due_date ? (
                      <Typography
                        sx={{
                          color: bucket.id === 'overdue' ? '#fca5a5' : BRAND.textDim,
                          fontSize: '0.74rem',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatDue(item.due_date)}
                      </Typography>
                    ) : null}

                    <Chip
                      label={WORKSPACE_CASE_PRIORITY_LABELS[item.priority]}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.64rem',
                        bgcolor: `${WORKSPACE_CASE_PRIORITY_COLORS[item.priority]}22`,
                        color: WORKSPACE_CASE_PRIORITY_COLORS[item.priority],
                      }}
                    />
                    <Chip
                      label={WORKSPACE_CASE_STATUS_LABELS[item.status]}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.64rem',
                        bgcolor: 'rgba(241, 245, 249, 0.08)',
                        color: BRAND.textMuted,
                      }}
                    />
                    <Tooltip title="Åpne saken">
                      <IconButton
                        size="small"
                        onClick={() => onOpenCase(item.id)}
                        sx={{ color: BRAND.textDim }}
                      >
                        <ChevronRightIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

export default OppgaverTab;
