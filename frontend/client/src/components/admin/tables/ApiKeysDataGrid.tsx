/**
 * CreatorHub Norge - API Keys DataGrid
 * Enhanced table with search, sorting, filters, and actions
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback } from 'react';
import {
  DataGrid,
  GridColDef,
  GridActionsCellItem,
  GridRowSelectionModel,
  GridToolbar,
  GridValueGetterParams
} from '@mui/x-data-grid';
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  Key as KeyIcon,
  Refresh as RotateIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  VisibilityOff as HideIcon,
  ContentCopy as CopyIcon,
  CheckCircle as ActiveIcon,
  Error as ErrorIcon,
  Schedule as PendingIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import type { ApiKey } from '@/types/integrations';

interface ApiKeysDataGridProps {
  apiKeys: ApiKey[];
  loading?: boolean;
  onRotateKey: (keyId: string) => void;
  onDeleteKey: (keyId: string) => void;
  onViewKey: (keyId: string) => void;
  onCopyKey: (key: string) => void;
}

export default function ApiKeysDataGrid({
  apiKeys,
  loading = false,
  onRotateKey,
  onDeleteKey,
  onViewKey,
  onCopyKey
}: ApiKeysDataGridProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [keyToDelete, setKeyToDelete] = useState<ApiKey | null>(null);
  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>([]);

  const handleMenuClick = useCallback((event: React.MouseEvent<HTMLElement>, key: ApiKey) => {
    setAnchorEl(event.currentTarget);
    setSelectedKey(key);
}, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
    setSelectedKey(null);
}, []);

  const handleDeleteClick = useCallback((key: ApiKey) => {
    setKeyToDelete(key);
    setDeleteDialogOpen(true);
    handleMenuClose();
}, [handleMenuClose]);

  const handleDeleteConfirm = useCallback(() => {
    if (keyToDelete) {
      onDeleteKey(keyToDelete.id);
      setDeleteDialogOpen(false);
      setKeyToDelete(null);
  }
}, [keyToDelete, onDeleteKey]);

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'active':
        return <ActiveIcon color="success" fontSize="small" />;
      case 'inactive':
        return <PendingIcon color="warning" fontSize="small" />;
      case 'expired':
      case 'revoked':
        return <ErrorIcon color="error" fontSize="small" />;
      default:
        return <PendingIcon color="disabled" fontSize="small" />;
}
}, []);

  const getStatusColor = useCallback((status: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'warning';
      case 'expired':
      case 'revoked':
        return 'error';
      default:
        return 'default';
}
}, []);

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Navn',
      width: 20,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
          <KeyIcon fontSize="small" color="primary" />
          <Typography variant="body2" fontWeight="medium">
            {params.value}
          </Typography>
        </Box>
      ),
  },
    {
      field: 'service',
      headerName: 'Tjeneste',
      width: 10,
      renderCell: (params) => (
        <Chip label={params.value} size="small" variant="outlined" />
      ),
  },
    {
      field: 'status',
      headerName: 'Status',
      width: 10,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
          {getStatusIcon(params.value)}
          <Chip 
            label={params.value}
            size="small" 
            color={getStatusColor(params.value)}
            variant="filled"
          />
        </Box>
      ),
  },
    {
      field: 'environment',
      headerName: 'Milj, ø',
      width: 10,
      renderCell: (params) => (
        <Chip 
          label={params.value}
          size="small" 
          color={params.value === 'production' ? 'error' : params.value === 'staging' ? 'warning' : 'info'}
        />
      ),
  },
    {
      field: 'keyType',
      headerName: 'Type',
      width: 10,
  },
    {
      field: 'permissions',
      headerName: 'Tillatelser',
      width: 20,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0,flexWrap: 'wrap' }}>
          {params.value.slice(0, 2).map((permission: string) => (
            <Chip key={permission} label={permission} size="small" variant="outlined" />
          ))}
          {params.value.length > 2 && (
            <Chip label={`+${params.value.length - 2}`} size="small" color="default" />
          )}
        </Box>
      ),
  },
    {
      field: 'usageCount',
      headerName: 'Bruk',
      width: 10,
      type: 'number' },
    {
      field: 'monthlyQuota',
      headerName: 'Kvote',
      width: 10,
      type: 'number',
      valueGetter: (params: GridValueGetterParams) => 
        params.row.monthlyQuota === -1 ? '∞' : params.row.monthlyQuota,
  },
    {
      field: 'lastUsed',
      headerName: 'Sist brukt',
      width: 10,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {params.value 
            ? format(new Date(params.value)'dd.MM.yyyy HH: mm', { locale: nb })
            : 'Aldri'
        }
        </Typography>
      ),
  },
    {
      field: 'rotationDue',
      headerName: 'Rotasjon',
      width: 10,
      renderCell: (params) => {
        const dueDate = new Date(params.value);
        const isOverdue = dueDate < new Date();
        return (
          <Typography 
            variant="body2" 
            color={isOverdue ? 'error' : 'text.secondary'}
          >
            {format(dueDate'dd.MM.yyyy', { locale: nb })}
          </Typography>
        );
    },
  },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Handlinger',
      width: 10,
      getActions: (params) => [
        <GridActionsCellItem
          icon={
            <Tooltip title="Se detaljer">
              <ViewIcon />
            </Tooltip>
      }
          label="Se detaljer"
          onClick={() => onViewKey(params.row.id)}
        />,
        <GridActionsCellItem
          icon={
            <Tooltip title="Kopier nøkkel">
              <CopyIcon />
            </Tooltip>
        }
          label="Kopier nøkkel"
          onClick={() => onCopyKey(params.row.maskedKey)}
        />,
        <GridActionsCellItem
          icon={
            <IconButton
              size="small"
              onClick={(event) => handleMenuClick(event, params.row)}
            >
              <MoreIcon />
            </IconButton>
        }
          label="Flere handlinger"
          showInMenu={false}
        />,
      ],
  },
  ];

  return (
    <Box sx={{ height: 60, width: '100%' }}>
      <DataGrid
        rows={apiKeys}
        columns={columns}
        loading={loading}
        checkboxSelection
        disableRowSelectionOnClick
        rowSelectionModel={rowSelectionModel}
        onRowSelectionModelChange={setRowSelectionModel}
        slots={{ toolbar: GridToolbar }}
        slotProps={{
          toolbar: {
            showQuickFilter: true,
            quickFilterProps: { debounceMs: 500},
        }}}
        initialState={{
          pagination: {
            paginationModel: { page: 0, pageSize: 25},
        },
          sorting: {
            sortModel: [{ field: 'createdA', sort: 'desc' }],
        }}}
        pageSizeOptions={[102550, 100]}
        density="compact"
        sx={{
          '& .MuiDataGrid-cell: focus': { outline: 'none' }, '& .MuiDataGrid-row: hover': {
            backgroundColor: 'action.hover' }}}
      />

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => selectedKey && onViewKey(selectedKey.id)}>
          <ViewIcon sx={{ mr:  1 }} fontSize="small" />
          Se detaljer
        </MenuItem>
        <MenuItem onClick={() => selectedKey && onRotateKey(selectedKey.id)}>
          <RotateIcon sx={{ mr:  1 }} fontSize="small" />
          Roter nøkkel
        </MenuItem>
        <MenuItem 
          onClick={() => selectedKey && handleDeleteClick(selectedKey)}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr:  1 }} fontSize="small" />
          Slett nøkkel
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Bekreft sletting</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb:  2 }}>
            <Typography variant="body1" gutterBottom>
              Er du sikker på at du vil slette API-nøkkelen "{keyToDelete?.name}"?
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Denne handlingen kan ikke angres. Alle applikasjoner som bruker denne nøkkelen vil slutte å fungere.
            </Typography>
          </Alert>
          
          {keyToDelete && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Nøkkeldetaljer: </Typography>
              <Typography variant="body2">
                • Tjeneste: {keyToDelete.service}<br />
                • Miljø: {keyToDelete.environment}<br />
                • Sist brukt: {keyToDelete.lastUsed 
                  ? format(new Date(keyToDelete.lastUsed)'dd.MM.yyyy HH: mm', { locale: nb })
                  :'Aldri'
              }
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Avbryt
          </Button>
          <Button onClick={handleDeleteConfirm}
            color="error" 
            variant="contained"
           sx={theming.getThemedButtonSx()}>
            Slett nøkkel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}