/**
 * CreatorHub Norge - API Keys table
 * Searchable, selectable and actionable API keys list without external DataGrid dependency.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CheckCircle as ActiveIcon,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Error as ErrorIcon,
  Key as KeyIcon,
  MoreVert as MoreIcon,
  Refresh as RotateIcon,
  Schedule as PendingIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { useTheming } from '../../../utils/theming-helper';
import type { ApiKey } from '@/types/integrations';

interface ApiKeysDataGridProps {
  apiKeys: ApiKey[];
  loading?: boolean;
  onRotateKey: (keyId: string) => void;
  onDeleteKey: (keyId: string) => void;
  onViewKey: (keyId: string) => void;
  onCopyKey: (key: string) => void;
}

function getStatusColor(status: string): 'success' | 'warning' | 'error' | 'default' {
  if (status === 'active') return 'success';
  if (status === 'inactive') return 'warning';
  if (status === 'expired' || status === 'revoked') return 'error';
  return 'default';
}

function getStatusIcon(status: string) {
  if (status === 'active') return <ActiveIcon color="success" fontSize="small" />;
  if (status === 'inactive') return <PendingIcon color="warning" fontSize="small" />;
  if (status === 'expired' || status === 'revoked') return <ErrorIcon color="error" fontSize="small" />;
  return <PendingIcon color="disabled" fontSize="small" />;
}

function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return 'Aldri';
  try {
    return format(new Date(value), withTime ? 'dd.MM.yyyy HH:mm' : 'dd.MM.yyyy', { locale: nb });
  } catch {
    return 'Ukjent';
  }
}

export default function ApiKeysDataGrid({
  apiKeys,
  loading = false,
  onRotateKey,
  onDeleteKey,
  onViewKey,
  onCopyKey,
}: ApiKeysDataGridProps) {
  const theming = useTheming('prototype_tester');

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [activeRow, setActiveRow] = useState<ApiKey | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<ApiKey | null>(null);

  const filteredKeys = useMemo(() => {
    if (!query.trim()) return apiKeys;
    const normalized = query.trim().toLowerCase();
    return apiKeys.filter((key) => {
      const haystack = [
        key.name,
        key.service,
        key.status,
        key.environment ?? '',
        key.keyType,
        key.permissions.join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [apiKeys, query]);

  const pageRows = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredKeys.slice(start, start + rowsPerPage);
  }, [filteredKeys, page, rowsPerPage]);

  const allVisibleSelected = pageRows.length > 0 && pageRows.every((row) => selectedIds.has(row.id));
  const someVisibleSelected = pageRows.some((row) => selectedIds.has(row.id));

  const handleToggleSelectAllVisible = useCallback(
    (checked: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (checked) {
          pageRows.forEach((row) => next.add(row.id));
        } else {
          pageRows.forEach((row) => next.delete(row.id));
        }
        return next;
      });
    },
    [pageRows],
  );

  const handleToggleRow = useCallback((keyId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(keyId);
      } else {
        next.delete(keyId);
      }
      return next;
    });
  }, []);

  const handleOpenMenu = useCallback((event: React.MouseEvent<HTMLElement>, row: ApiKey) => {
    setAnchorEl(event.currentTarget);
    setActiveRow(row);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setAnchorEl(null);
    setActiveRow(null);
  }, []);

  const handleRequestDelete = useCallback(
    (row: ApiKey) => {
      setKeyToDelete(row);
      setDeleteDialogOpen(true);
      handleCloseMenu();
    },
    [handleCloseMenu],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!keyToDelete) return;
    onDeleteKey(keyToDelete.id);
    setDeleteDialogOpen(false);
    setKeyToDelete(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(keyToDelete.id);
      return next;
    });
  }, [keyToDelete, onDeleteKey]);

  const handleRotateSelected = useCallback(() => {
    selectedIds.forEach((id) => onRotateKey(id));
  }, [onRotateKey, selectedIds]);

  const handleDeleteSelected = useCallback(() => {
    selectedIds.forEach((id) => onDeleteKey(id));
    setSelectedIds(new Set());
  }, [onDeleteKey, selectedIds]);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
        <TextField
          fullWidth
          size="small"
          placeholder="Søk på navn, tjeneste, status eller tillatelser"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <Stack direction="row" spacing={1} alignItems="center">
          <Chip label={`${filteredKeys.length} nøkler`} size="small" />
          <Chip label={`${selectedIds.size} valgt`} size="small" color={selectedIds.size > 0 ? 'primary' : 'default'} />
          <Button disabled={selectedIds.size === 0} variant="outlined" onClick={handleRotateSelected} startIcon={<RotateIcon />}>
            Roter valgte
          </Button>
          <Button
            disabled={selectedIds.size === 0}
            color="error"
            variant="outlined"
            onClick={handleDeleteSelected}
            startIcon={<DeleteIcon />}
          >
            Slett valgte
          </Button>
        </Stack>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={someVisibleSelected && !allVisibleSelected}
                  checked={allVisibleSelected}
                  onChange={(event) => handleToggleSelectAllVisible(event.target.checked)}
                />
              </TableCell>
              <TableCell>Navn</TableCell>
              <TableCell>Tjeneste</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Miljø</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Tillatelser</TableCell>
              <TableCell align="right">Bruk</TableCell>
              <TableCell align="right">Kvote</TableCell>
              <TableCell>Sist brukt</TableCell>
              <TableCell>Rotasjon</TableCell>
              <TableCell align="right">Handlinger</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.map((row) => {
              const isSelected = selectedIds.has(row.id);
              const isOverdue = row.rotationDue ? new Date(row.rotationDue) < new Date() : false;

              return (
                <TableRow key={row.id} hover selected={isSelected}>
                  <TableCell padding="checkbox">
                    <Checkbox checked={isSelected} onChange={(event) => handleToggleRow(row.id, event.target.checked)} />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <KeyIcon fontSize="small" color="primary" />
                      <Typography variant="body2" fontWeight={600}>
                        {row.name}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip label={row.service} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {getStatusIcon(row.status)}
                      <Chip label={row.status} size="small" color={getStatusColor(row.status)} />
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={row.environment ?? 'unknown'}
                      size="small"
                      color={
                        row.environment === 'production'
                          ? 'error'
                          : row.environment === 'staging'
                            ? 'warning'
                            : 'info'
                      }
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{row.keyType}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {row.permissions.slice(0, 2).map((permission) => (
                        <Chip key={`${row.id}-${permission}`} label={permission} size="small" variant="outlined" />
                      ))}
                      {row.permissions.length > 2 ? (
                        <Chip label={`+${row.permissions.length - 2}`} size="small" variant="outlined" />
                      ) : null}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">{row.usageCount}</TableCell>
                  <TableCell align="right">{row.monthlyQuota === -1 ? '∞' : row.monthlyQuota}</TableCell>
                  <TableCell>{formatDate(row.lastUsed, true)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" color={isOverdue ? 'error' : 'text.secondary'}>
                      {formatDate(row.rotationDue)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="Se detaljer">
                        <IconButton size="small" onClick={() => onViewKey(row.id)}>
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Kopier nøkkel">
                        <IconButton size="small" onClick={() => onCopyKey(row.maskedKey)}>
                          <CopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Flere handlinger">
                        <IconButton size="small" onClick={(event) => handleOpenMenu(event, row)}>
                          <MoreIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}

            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12}>
                  <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>
                    {loading ? 'Laster API-nøkler...' : 'Ingen API-nøkler matcher filteret.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={filteredKeys.length}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={(_event, nextPage) => setPage(nextPage)}
        onRowsPerPageChange={(event) => {
          setRowsPerPage(Number(event.target.value));
          setPage(0);
        }}
        rowsPerPageOptions={[10, 25, 50, 100]}
      />

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleCloseMenu}>
        <MenuItem
          onClick={() => {
            if (activeRow) {
              onViewKey(activeRow.id);
            }
            handleCloseMenu();
          }}
        >
          <ViewIcon sx={{ mr: 1 }} fontSize="small" />
          Se detaljer
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (activeRow) {
              onRotateKey(activeRow.id);
            }
            handleCloseMenu();
          }}
        >
          <RotateIcon sx={{ mr: 1 }} fontSize="small" />
          Roter nøkkel
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (activeRow) {
              handleRequestDelete(activeRow);
            }
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
          Slett nøkkel
        </MenuItem>
      </Menu>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Bekreft sletting</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body1" gutterBottom>
              Er du sikker på at du vil slette API-nøkkelen "{keyToDelete?.name}"?
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Denne handlingen kan ikke angres. Integrasjoner som bruker nøkkelen vil slutte å fungere.
            </Typography>
          </Alert>

          {keyToDelete ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Nøkkeldetaljer
              </Typography>
              <Typography variant="body2">
                • Tjeneste: {keyToDelete.service}
                <br />• Miljø: {keyToDelete.environment ?? 'unknown'}
                <br />• Sist brukt: {formatDate(keyToDelete.lastUsed, true)}
              </Typography>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Avbryt</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" sx={theming.getThemedButtonSx()}>
            Slett nøkkel
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
