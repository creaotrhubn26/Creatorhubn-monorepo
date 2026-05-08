/**
 * BudgetCategoryPicker
 *
 * Grouped Select-picker for budsjett-kategorier — system + per-prosjekt.
 * Lar brukeren velge fra standard chart-of-accounts (ATL/PRE/PROD/LOG/
 * POST/OH) eller legge til egne kategorier inline. Verdien som returneres
 * er kategori-navnet (string) for å holde bakover-kompat med
 * role_room_budget_items.category-tekstkolonnen.
 */

import { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  budgetCategoriesApi,
  groupCategories,
  PARENT_GROUP_ORDER,
  type BudgetCategory,
} from '../../services/budgetCategoriesApi';

interface BudgetCategoryPickerProps {
  projectId: string;
  value: string;
  onChange: (categoryName: string) => void;
  size?: 'small' | 'medium';
  disabled?: boolean;
  fullWidth?: boolean;
  minWidth?: number | string;
}

const NEW_CATEGORY_VALUE = '__add_new_category__';

export default function BudgetCategoryPicker({
  projectId,
  value,
  onChange,
  size = 'small',
  disabled = false,
  fullWidth = false,
  minWidth = 200,
}: BudgetCategoryPickerProps) {
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftGroup, setDraftGroup] = useState<string>(PARENT_GROUP_ORDER[0]?.key ?? 'PROD');
  const [draftName, setDraftName] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    budgetCategoriesApi
      .list(projectId)
      .then((rows) => {
        if (!cancelled) setCategories(rows);
      })
      .catch((err) => {
        console.warn('[BudgetCategoryPicker] failed to load categories', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const groups = useMemo(() => {
    const grouped = groupCategories(categories);
    const orderedKeys = PARENT_GROUP_ORDER.map((g) => g.key);
    return [...grouped].sort(
      (a, b) => orderedKeys.indexOf(a.parent_group) - orderedKeys.indexOf(b.parent_group),
    );
  }, [categories]);

  // Custom-kategorier brukeren kan slette (kun ikke-system fra dette prosjektet)
  const projectCustomIds = useMemo(
    () => new Set(categories.filter((c) => !c.is_system && c.project_id === projectId).map((c) => c.id)),
    [categories, projectId],
  );

  function handleSelectChange(nextValue: string) {
    if (nextValue === NEW_CATEGORY_VALUE) {
      setDraftName('');
      setDraftError(null);
      setDialogOpen(true);
      return;
    }
    onChange(nextValue);
  }

  async function handleCreateCategory() {
    if (!draftName.trim()) {
      setDraftError('Skriv inn et kategori-navn');
      return;
    }
    setSaving(true);
    setDraftError(null);
    try {
      const groupMeta = PARENT_GROUP_ORDER.find((g) => g.key === draftGroup);
      const created = await budgetCategoriesApi.create(projectId, {
        parentGroup: draftGroup,
        parentGroupLabel: groupMeta?.label ?? draftGroup,
        categoryName: draftName.trim(),
      });
      setCategories((prev) => [...prev, created]);
      onChange(created.category_name);
      setDialogOpen(false);
    } catch (err) {
      setDraftError((err as Error).message || 'Kunne ikke opprette kategori');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCategory(category: BudgetCategory, event: React.MouseEvent) {
    event.stopPropagation();
    if (category.is_system || category.project_id !== projectId) return;
    if (!window.confirm(`Slette "${category.category_name}"? Eksisterende budsjett-linjer beholder navnet som tekst.`)) {
      return;
    }
    try {
      await budgetCategoriesApi.remove(projectId, category.id);
      setCategories((prev) => prev.filter((c) => c.id !== category.id));
      if (value === category.category_name) {
        onChange('');
      }
    } catch (err) {
      console.warn('[BudgetCategoryPicker] delete failed', err);
    }
  }

  return (
    <>
      <FormControl size={size} fullWidth={fullWidth} sx={{ minWidth }}>
        <InputLabel sx={{ color: 'rgba(226,232,240,0.82)' }}>Kategori</InputLabel>
        <Select
          label="Kategori"
          value={value}
          disabled={disabled || loading}
          onChange={(e) => handleSelectChange(String(e.target.value))}
          MenuProps={{ PaperProps: { sx: { maxHeight: 480 } } }}
        >
          {value && !categories.some((c) => c.category_name === value) ? (
            <MenuItem value={value} disabled>
              {value} (utgått)
            </MenuItem>
          ) : null}
          {groups.map((group) => [
            <ListSubheader key={`hdr-${group.parent_group}`} sx={{ bgcolor: 'rgba(15,23,42,0.92)', color: '#a78bfa', fontWeight: 800, lineHeight: '32px' }}>
              {group.parent_group_label}
            </ListSubheader>,
            ...group.categories.map((cat) => (
              <MenuItem key={cat.id} value={cat.category_name} sx={{ pl: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: '100%' }}>
                  <span>{cat.category_name}</span>
                  {!cat.is_system && projectCustomIds.has(cat.id) ? (
                    <Tooltip title="Slett egen kategori">
                      <IconButton
                        size="small"
                        edge="end"
                        onClick={(e) => { void handleDeleteCategory(cat, e); }}
                        sx={{ ml: 1 }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </Stack>
              </MenuItem>
            )),
          ])}
          <ListSubheader sx={{ bgcolor: 'rgba(15,23,42,0.92)' }} />
          <MenuItem value={NEW_CATEGORY_VALUE} sx={{ color: '#a78bfa', fontWeight: 700 }}>
            <AddIcon fontSize="small" sx={{ mr: 1 }} />
            Legg til egen kategori…
          </MenuItem>
        </Select>
      </FormControl>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Legg til egen budsjett-kategori</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ color: 'rgba(0,0,0,0.66)' }}>
              Kategorien blir lagret på dette prosjektet og er kun synlig her.
              Bruk standard chart-of-accounts hvor mulig.
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Tilhører gruppe</InputLabel>
              <Select
                label="Tilhører gruppe"
                value={draftGroup}
                onChange={(e) => setDraftGroup(String(e.target.value))}
              >
                {PARENT_GROUP_ORDER.map((g) => (
                  <MenuItem key={g.key} value={g.key}>{g.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Kategori-navn"
              value={draftName}
              onChange={(e) => { setDraftName(e.target.value); setDraftError(null); }}
              fullWidth
              autoFocus
              error={Boolean(draftError)}
              helperText={draftError ?? 'F.eks. Drone-operatør, Spesialeffekter, Timelapse-rigg.'}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => { void handleCreateCategory(); }}
            disabled={saving || !draftName.trim()}
          >
            {saving ? 'Lagrer…' : 'Legg til'}
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ display: 'none' }} aria-hidden>
        {/* keep loading state from being unused — BudgetCategoryPicker er
            ofte montert i tette form-rader uten plass til en spinner */}
        {loading ? '' : ''}
      </Box>
    </>
  );
}
