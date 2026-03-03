import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Inventory2 as Inventory2Icon,
  SyncAlt as MoveIcon,
  PlaylistAddCheck as ReserveIcon,
  PlaylistRemove as ReleaseIcon,
  TaskAlt as PickIcon,
  Rule as RuleIcon,
  History as HistoryIcon,
  AccountTree as StructureIcon,
  QrCode as QrCodeIcon,
  QrCodeScanner as QrCodeScannerIcon,
  ContentCopy as CopyIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import {
  type InventoryItemType,
  type InventoryReservation,
  type InventoryStockRecord,
  type InventoryTransactionAction,
  type WarehouseLocationSeed,
  type WarehouseNodeType,
  type WarehouseSnapshot,
  type WarehouseItemSeed,
  warehouseInventoryService,
} from '../../services/warehouseInventoryService';
import QrCameraScanner from './QrCameraScanner';

const NODE_TYPES: Array<{ value: WarehouseNodeType; label: string }> = [
  { value: 'warehouse', label: 'Lager' },
  { value: 'zone', label: 'Sone' },
  { value: 'shelf', label: 'Hylle' },
  { value: 'bin', label: 'Bin' },
];

const OPERATIONS: Array<{ value: InventoryTransactionAction; label: string }> = [
  { value: 'move', label: 'Flytt' },
  { value: 'receive', label: 'Motta inn' },
  { value: 'return', label: 'Retur inn' },
  { value: 'adjust', label: 'Juster antall' },
  { value: 'count', label: 'Inventurtelling' },
  { value: 'reserve', label: 'Reserver' },
];

const severityOrder: Record<'high' | 'medium' | 'low', number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export interface WarehouseDialogItem {
  id: string;
  itemType: InventoryItemType;
  name: string;
  quantity: number;
  primaryLocationId?: string;
  locationLabel?: string;
  category?: string;
}

interface WarehouseInventoryDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  title?: string;
  items: WarehouseDialogItem[];
  locationSeeds?: WarehouseLocationSeed[];
  onRequestEditItem?: (item: WarehouseDialogItem) => void;
}

const operationNeedsDestination = (operation: InventoryTransactionAction): boolean =>
  operation === 'move';

const operationNeedsSource = (operation: InventoryTransactionAction): boolean =>
  operation === 'move';

const operationNeedsScene = (operation: InventoryTransactionAction): boolean =>
  operation === 'reserve';

export function WarehouseInventoryDialog({
  open,
  onClose,
  projectId,
  title = 'Lagersystem',
  items,
  locationSeeds,
  onRequestEditItem,
}: WarehouseInventoryDialogProps) {
  const [tab, setTab] = useState(0);
  const [snapshot, setSnapshot] = useState<WarehouseSnapshot>({
    nodes: [],
    stock: [],
    reservations: [],
    transactions: [],
  });
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeType, setNewNodeType] = useState<WarehouseNodeType>('zone');
  const [newNodeParent, setNewNodeParent] = useState('');

  const [selectedItemKey, setSelectedItemKey] = useState('');
  const [operation, setOperation] = useState<InventoryTransactionAction>('move');
  const [quantity, setQuantity] = useState(1);
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [sceneId, setSceneId] = useState('');
  const [shotId, setShotId] = useState('');
  const [operationNote, setOperationNote] = useState('');
  const [qrLabelOpen, setQrLabelOpen] = useState(false);
  const [qrScanOpen, setQrScanOpen] = useState(false);
  const [qrItemKey, setQrItemKey] = useState('');
  const [qrScanInput, setQrScanInput] = useState('');
  const [qrScanError, setQrScanError] = useState<string | null>(null);

  const itemsByKey = useMemo(() => {
    return new Map(items.map((item) => [`${item.itemType}:${item.id}`, item]));
  }, [items]);

  const selectedItem = useMemo(
    () => itemsByKey.get(selectedItemKey) || null,
    [itemsByKey, selectedItemKey]
  );

  const qrItem = useMemo(() => itemsByKey.get(qrItemKey) || null, [itemsByKey, qrItemKey]);

  const consistencyIssues = useMemo(() => {
    const issues = warehouseInventoryService.listConsistencyIssues(
      projectId,
      items.map<WarehouseItemSeed>((item) => ({
        id: item.id,
        itemType: item.itemType,
        name: item.name,
        quantity: item.quantity,
        primaryLocationId: item.primaryLocationId,
        locationLabel: item.locationLabel,
        category: item.category,
      }))
    );
    return issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }, [items, projectId, snapshot.stock, snapshot.reservations]);

  const activeReservations = useMemo(
    () => snapshot.reservations.filter((reservation) => reservation.status === 'reserved'),
    [snapshot.reservations]
  );

  const stockRows = useMemo(() => {
    return snapshot.stock
      .map((record) => {
        const item = itemsByKey.get(`${record.itemType}:${record.itemId}`);
        return {
          ...record,
          itemName: item?.name || `${record.itemType}:${record.itemId}`,
          available: Math.max(0, (record.quantity || 0) - (record.reservedQuantity || 0)),
          locationPath: warehouseInventoryService.getLocationPath(projectId, record.locationId),
        };
      })
      .sort((a, b) => a.itemName.localeCompare(b.itemName, 'nb'));
  }, [itemsByKey, projectId, snapshot.stock]);

  const totals = useMemo(() => {
    const totalQuantity = stockRows.reduce((sum, row) => sum + row.quantity, 0);
    const totalReserved = stockRows.reduce((sum, row) => sum + row.reservedQuantity, 0);
    const totalAvailable = Math.max(0, totalQuantity - totalReserved);
    const lowStock = stockRows.filter((row) => row.available <= 1).length;
    return {
      totalQuantity,
      totalReserved,
      totalAvailable,
      lowStock,
      locations: snapshot.nodes.length,
      issues: consistencyIssues.length,
    };
  }, [consistencyIssues.length, snapshot.nodes.length, stockRows]);

  const reloadSnapshot = () => {
    const seeded = warehouseInventoryService.bootstrapProject(projectId, {
      locations: locationSeeds,
      items: items.map<WarehouseItemSeed>((item) => ({
        id: item.id,
        itemType: item.itemType,
        name: item.name,
        quantity: item.quantity,
        primaryLocationId: item.primaryLocationId,
        locationLabel: item.locationLabel,
        category: item.category,
      })),
    });
    setSnapshot(seeded);
  };

  useEffect(() => {
    if (!open) return;
    reloadSnapshot();
    if (!selectedItemKey && items.length > 0) {
      const initial = items[0];
      setSelectedItemKey(`${initial.itemType}:${initial.id}`);
    }
  }, [open, projectId, items, locationSeeds]);

  const handleCreateNode = () => {
    if (!newNodeName.trim()) {
      setFeedback({ kind: 'error', message: 'Navn på lagernode er påkrevd' });
      return;
    }
    warehouseInventoryService.createNode(projectId, {
      name: newNodeName,
      type: newNodeType,
      parentId: newNodeParent || undefined,
    });
    setNewNodeName('');
    setFeedback({ kind: 'success', message: 'Lagernode opprettet' });
    reloadSnapshot();
  };

  const handleDeleteNode = (nodeId: string) => {
    const result = warehouseInventoryService.deleteNode(projectId, nodeId);
    if (!result.ok) {
      setFeedback({ kind: 'error', message: result.reason || 'Kunne ikke slette node' });
      return;
    }
    setFeedback({ kind: 'success', message: 'Lagernode slettet' });
    reloadSnapshot();
  };

  const handleSubmitOperation = () => {
    if (!selectedItemKey) {
      setFeedback({ kind: 'error', message: 'Velg en post først' });
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setFeedback({ kind: 'error', message: 'Antall må være større enn 0' });
      return;
    }
    const [itemType, itemId] = selectedItemKey.split(':') as [InventoryItemType, string];
    const payload = {
      projectId,
      itemType,
      itemId,
      quantity,
      note: operationNote,
    };

    let result: { ok: boolean; reason?: string } = { ok: false, reason: 'Ugyldig operasjon' };
    switch (operation) {
      case 'move':
        if (!fromLocationId || !toLocationId) {
          setFeedback({ kind: 'error', message: 'Velg både fra-lager og til-lager' });
          return;
        }
        result = warehouseInventoryService.moveStock({
          ...payload,
          fromLocationId,
          toLocationId,
        });
        break;
      case 'receive':
        if (!toLocationId) {
          setFeedback({ kind: 'error', message: 'Velg lager for mottak' });
          return;
        }
        result = warehouseInventoryService.receiveStock({
          ...payload,
          locationId: toLocationId,
        });
        break;
      case 'return':
        if (!toLocationId) {
          setFeedback({ kind: 'error', message: 'Velg lager for retur' });
          return;
        }
        result = warehouseInventoryService.returnStock({
          ...payload,
          locationId: toLocationId,
        });
        break;
      case 'adjust':
        if (!toLocationId) {
          setFeedback({ kind: 'error', message: 'Velg lager som skal justeres' });
          return;
        }
        result = warehouseInventoryService.adjustStock({
          ...payload,
          locationId: toLocationId,
          mode: 'adjust',
        });
        break;
      case 'count':
        if (!toLocationId) {
          setFeedback({ kind: 'error', message: 'Velg lager som ble telt' });
          return;
        }
        result = warehouseInventoryService.adjustStock({
          ...payload,
          locationId: toLocationId,
          mode: 'count',
        });
        break;
      case 'reserve':
        if (!toLocationId) {
          setFeedback({ kind: 'error', message: 'Velg lager for reservasjon' });
          return;
        }
        result = warehouseInventoryService.reserveStock({
          ...payload,
          locationId: toLocationId,
          sceneId,
          shotId,
        });
        break;
      default:
        break;
    }

    if (!result.ok) {
      setFeedback({ kind: 'error', message: result.reason || 'Operasjonen feilet' });
      return;
    }

    setFeedback({ kind: 'success', message: 'Lageroperasjon lagret' });
    reloadSnapshot();
  };

  const handlePickReservation = (reservation: InventoryReservation) => {
    const result = warehouseInventoryService.pickReservation(projectId, reservation.id);
    if (!result.ok) {
      setFeedback({ kind: 'error', message: result.reason || 'Kunne ikke plukke reservasjon' });
      return;
    }
    setFeedback({ kind: 'success', message: 'Reservasjon plukket' });
    reloadSnapshot();
  };

  const handleReleaseReservation = (reservation: InventoryReservation) => {
    const result = warehouseInventoryService.releaseReservation(projectId, reservation.id);
    if (!result.ok) {
      setFeedback({ kind: 'error', message: result.reason || 'Kunne ikke frigi reservasjon' });
      return;
    }
    setFeedback({ kind: 'success', message: 'Reservasjon frigitt' });
    reloadSnapshot();
  };

  const handleIssueAction = (issue: { itemType: InventoryItemType; itemId: string }) => {
    const item = items.find((entry) => entry.itemType === issue.itemType && entry.id === issue.itemId);
    if (!item) return;
    if (onRequestEditItem) {
      onRequestEditItem(item);
      return;
    }
    setSelectedItemKey(`${item.itemType}:${item.id}`);
    setTab(2);
  };

  const getQrValue = (item: WarehouseDialogItem): string =>
    warehouseInventoryService.buildQrValue({
      projectId,
      itemType: item.itemType,
      itemId: item.id,
      itemName: item.name,
    });

  const getQrImageUrl = (item: WarehouseDialogItem, size = 280): string =>
    warehouseInventoryService.buildQrImageUrl(getQrValue(item), size);

  const openQrLabel = (itemKey: string) => {
    const item = itemsByKey.get(itemKey);
    if (!item) {
      setFeedback({ kind: 'error', message: 'Fant ikke post for QR-etikett' });
      return;
    }
    setQrItemKey(itemKey);
    setQrLabelOpen(true);
  };

  const handleCopyQrValue = async (item: WarehouseDialogItem) => {
    try {
      await navigator.clipboard.writeText(getQrValue(item));
      setFeedback({ kind: 'success', message: 'QR-data kopiert' });
    } catch {
      setFeedback({ kind: 'error', message: 'Kunne ikke kopiere QR-data' });
    }
  };

  const handlePrintQrLabel = (item: WarehouseDialogItem) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setFeedback({ kind: 'error', message: 'Kunne ikke åpne utskriftsvindu' });
      return;
    }

    const qrUrl = getQrImageUrl(item, 360);
    const qrPayload = getQrValue(item);
    printWindow.document.write(`
      <html>
        <head>
          <title>QR-etikett: ${item.name}</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: grid;
              place-items: center;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: #111421;
              color: #fff;
            }
            .label {
              width: 420px;
              border: 2px solid #9333ea;
              border-radius: 16px;
              background: #171a2b;
              padding: 20px;
              box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
            }
            h2 {
              margin: 0 0 8px 0;
              font-size: 24px;
              color: #c084fc;
            }
            .meta {
              margin: 0 0 12px 0;
              color: #cbd5e1;
              font-size: 13px;
            }
            .qr-wrap {
              padding: 12px;
              border-radius: 12px;
              border: 1px solid rgba(255,255,255,0.15);
              background: #0f1220;
              display: grid;
              place-items: center;
            }
            img {
              width: 300px;
              height: 300px;
            }
            .payload {
              margin-top: 12px;
              font-size: 11px;
              color: #94a3b8;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          <section class="label">
            <h2>${item.name}</h2>
            <p class="meta">
              Type: ${item.itemType === 'equipment' ? 'Utstyr' : 'Rekvisitt'} • Antall: ${item.quantity}
            </p>
            <div class="qr-wrap">
              <img src="${qrUrl}" alt="QR-kode for ${item.name}" />
            </div>
            <p class="payload">${qrPayload}</p>
          </section>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 400);
  };

  const handleResolveScannedQr = (rawValue: string) => {
    const parsed = warehouseInventoryService.parseQrValue(rawValue);
    if (!parsed) {
      setQrScanError('Ukjent QR-format. Bruk en Role Room lager-QR.');
      return;
    }
    if (parsed.projectId && parsed.projectId !== projectId) {
      setQrScanError('QR-koden tilhører et annet prosjekt.');
      return;
    }

    const matchKey = `${parsed.itemType}:${parsed.itemId}`;
    const item = itemsByKey.get(matchKey);
    if (!item) {
      setQrScanError('Fant ikke post for denne QR-koden i prosjektet.');
      return;
    }

    setSelectedItemKey(matchKey);
    setTab(2);
    setQrScanInput('');
    setQrScanError(null);
    setQrScanOpen(false);
    setFeedback({ kind: 'success', message: `QR funnet: ${item.name}` });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl" PaperProps={{ sx: { bgcolor: '#111421', color: '#fff' } }}>
      <DialogTitle
        component="div"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          py: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Inventory2Icon sx={{ color: '#c084fc' }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          <Chip
            size="small"
            label={`${totals.totalAvailable} tilgjengelig`}
            sx={{ bgcolor: 'rgba(76,175,80,0.2)', color: '#81c784', fontWeight: 700 }}
          />
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.75)' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 0 }}>
        {feedback && (
          <Alert
            severity={feedback.kind}
            onClose={() => setFeedback(null)}
            sx={{ mx: 2, mt: 2, borderRadius: 2 }}
          >
            {feedback.message}
          </Alert>
        )}

        <Tabs
          value={tab}
          onChange={(_, next) => setTab(next)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 2,
            minHeight: 44,
            '& .MuiTabs-indicator': { backgroundColor: '#9333ea' },
          }}
        >
          <Tab icon={<Inventory2Icon sx={{ fontSize: 16 }} />} iconPosition="start" label="Oversikt" />
          <Tab icon={<StructureIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Lagerstruktur" />
          <Tab icon={<MoveIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Operasjoner" />
          <Tab icon={<ReserveIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Reservasjoner" />
          <Tab icon={<HistoryIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Logg" />
          <Tab icon={<RuleIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Konsistens" />
        </Tabs>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

        {tab === 0 && (
          <Box sx={{ p: 2 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(6, minmax(0, 1fr))' },
                gap: 1.25,
                mb: 2,
              }}
            >
              {[
                { label: 'Tilgjengelig', value: totals.totalAvailable, color: '#81c784' },
                { label: 'Reservert', value: totals.totalReserved, color: '#ffb74d' },
                { label: 'Totalt', value: totals.totalQuantity, color: '#64b5f6' },
                { label: 'Lagernoder', value: totals.locations, color: '#c084fc' },
                { label: 'Lav beholdning', value: totals.lowStock, color: '#ef5350' },
                { label: 'Avvik', value: totals.issues, color: '#fbc02d' },
              ].map((metric) => (
                <Box
                  key={metric.label}
                  sx={{
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 2,
                    p: 1.5,
                    bgcolor: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    {metric.label}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: metric.color }}>
                    {metric.value}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Lagerbeholdning per post
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>Post</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>Type</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>Lagerplass</TableCell>
                  <TableCell align="center" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    QR
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Tilgjengelig
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Reservert
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stockRows.slice(0, 20).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell sx={{ color: '#fff' }}>{row.itemName}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={row.itemType === 'equipment' ? 'Utstyr' : 'Rekvisitt'}
                        sx={{
                          bgcolor:
                            row.itemType === 'equipment'
                              ? 'rgba(33,150,243,0.2)'
                              : 'rgba(192,132,252,0.2)',
                          color: row.itemType === 'equipment' ? '#64b5f6' : '#c084fc',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.8)' }}>{row.locationPath}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="Vis QR-etikett">
                        <IconButton
                          size="small"
                          onClick={() => openQrLabel(`${row.itemType}:${row.itemId}`)}
                          sx={{ color: '#64b5f6' }}
                        >
                          <QrCodeIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right" sx={{ color: '#81c784', fontWeight: 700 }}>
                      {row.available}
                    </TableCell>
                    <TableCell align="right" sx={{ color: '#ffb74d', fontWeight: 700 }}>
                      {row.reservedQuantity}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {tab === 1 && (
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Opprett lagernode
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr auto' },
                gap: 1,
                alignItems: 'end',
                mb: 2,
              }}
            >
              <TextField
                label="Navn"
                value={newNodeName}
                onChange={(event) => setNewNodeName(event.target.value)}
                size="small"
                sx={{ '& .MuiOutlinedInput-root': { color: '#fff' } }}
              />
              <FormControl size="small">
                <InputLabel sx={{ color: 'rgba(255,255,255,0.8)' }}>Type</InputLabel>
                <Select
                  value={newNodeType}
                  onChange={(event) => setNewNodeType(event.target.value as WarehouseNodeType)}
                  label="Type"
                  sx={{ color: '#fff' }}
                >
                  {NODE_TYPES.map((nodeType) => (
                    <MenuItem key={nodeType.value} value={nodeType.value}>
                      {nodeType.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small">
                <InputLabel sx={{ color: 'rgba(255,255,255,0.8)' }}>Overordnet</InputLabel>
                <Select
                  value={newNodeParent}
                  onChange={(event) => setNewNodeParent(event.target.value)}
                  label="Overordnet"
                  sx={{ color: '#fff' }}
                >
                  <MenuItem value="">Ingen</MenuItem>
                  {snapshot.nodes.map((node) => (
                    <MenuItem key={node.id} value={node.id}>
                      {node.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateNode}>
                Opprett
              </Button>
            </Box>

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Nåværende lagerstruktur
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>Navn</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>Type</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>Sti</TableCell>
                  <TableCell align="right" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Handling
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {snapshot.nodes.map((node) => (
                  <TableRow key={node.id}>
                    <TableCell sx={{ color: '#fff' }}>{node.name}</TableCell>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.8)' }}>
                      {NODE_TYPES.find((entry) => entry.value === node.type)?.label || node.type}
                    </TableCell>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.8)' }}>
                      {warehouseInventoryService.getLocationPath(projectId, node.id)}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Slett node">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteNode(node.id)}
                            sx={{ color: '#ef5350' }}
                            disabled={node.id === 'warehouse-main'}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {tab === 2 && (
          <Box sx={{ p: 2 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              justifyContent="space-between"
              sx={{ mb: 1.5 }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Lageroperasjoner
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<QrCodeIcon />}
                  onClick={() => selectedItem && openQrLabel(`${selectedItem.itemType}:${selectedItem.id}`)}
                  disabled={!selectedItem}
                >
                  QR-etikett
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<QrCodeScannerIcon />}
                  onClick={() => {
                    setQrScanInput('');
                    setQrScanError(null);
                    setQrScanOpen(true);
                  }}
                >
                  Skann QR
                </Button>
              </Stack>
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                gap: 1,
              }}
            >
              <FormControl size="small" fullWidth>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.8)' }}>Post</InputLabel>
                <Select
                  value={selectedItemKey}
                  label="Post"
                  onChange={(event) => setSelectedItemKey(event.target.value)}
                  sx={{ color: '#fff' }}
                >
                  {items.map((item) => (
                    <MenuItem key={`${item.itemType}:${item.id}`} value={`${item.itemType}:${item.id}`}>
                      {item.name} ({item.itemType === 'equipment' ? 'Utstyr' : 'Rekvisitt'})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.8)' }}>Operasjon</InputLabel>
                <Select
                  value={operation}
                  label="Operasjon"
                  onChange={(event) => setOperation(event.target.value as InventoryTransactionAction)}
                  sx={{ color: '#fff' }}
                >
                  {OPERATIONS.map((entry) => (
                    <MenuItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Antall"
                type="number"
                size="small"
                value={quantity}
                onChange={(event) => setQuantity(Math.max(0, Number(event.target.value) || 0))}
                sx={{ '& .MuiOutlinedInput-root': { color: '#fff' } }}
              />

              {operationNeedsSource(operation) && (
                <FormControl size="small" fullWidth>
                  <InputLabel sx={{ color: 'rgba(255,255,255,0.8)' }}>Fra lager</InputLabel>
                  <Select
                    value={fromLocationId}
                    label="Fra lager"
                    onChange={(event) => setFromLocationId(event.target.value)}
                    sx={{ color: '#fff' }}
                  >
                    {snapshot.nodes.map((node) => (
                      <MenuItem key={`from-${node.id}`} value={node.id}>
                        {warehouseInventoryService.getLocationPath(projectId, node.id)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {operationNeedsDestination(operation) || operation !== 'move' ? (
                <FormControl size="small" fullWidth>
                  <InputLabel sx={{ color: 'rgba(255,255,255,0.8)' }}>
                    {operation === 'move' ? 'Til lager' : 'Lager'}
                  </InputLabel>
                  <Select
                    value={toLocationId}
                    label={operation === 'move' ? 'Til lager' : 'Lager'}
                    onChange={(event) => setToLocationId(event.target.value)}
                    sx={{ color: '#fff' }}
                  >
                    {snapshot.nodes.map((node) => (
                      <MenuItem key={`to-${node.id}`} value={node.id}>
                        {warehouseInventoryService.getLocationPath(projectId, node.id)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : null}

              {operationNeedsScene(operation) && (
                <>
                  <TextField
                    label="Scene-ID"
                    size="small"
                    value={sceneId}
                    onChange={(event) => setSceneId(event.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { color: '#fff' } }}
                  />
                  <TextField
                    label="Shot-ID"
                    size="small"
                    value={shotId}
                    onChange={(event) => setShotId(event.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { color: '#fff' } }}
                  />
                </>
              )}

              <TextField
                label="Notat"
                size="small"
                value={operationNote}
                onChange={(event) => setOperationNote(event.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { color: '#fff' } }}
              />
            </Box>

            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
              <Button variant="contained" onClick={handleSubmitOperation}>
                Lagre operasjon
              </Button>
            </Stack>
          </Box>
        )}

        {tab === 3 && (
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Aktive reservasjoner
            </Typography>
            {activeReservations.length === 0 ? (
              <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>Ingen aktive reservasjoner.</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>Post</TableCell>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>Antall</TableCell>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>Scene/Shot</TableCell>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>Lager</TableCell>
                    <TableCell align="right" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      Handlinger
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activeReservations.map((reservation) => {
                    const item = itemsByKey.get(`${reservation.itemType}:${reservation.itemId}`);
                    return (
                      <TableRow key={reservation.id}>
                        <TableCell sx={{ color: '#fff' }}>{item?.name || reservation.itemId}</TableCell>
                        <TableCell sx={{ color: '#fff', fontWeight: 700 }}>{reservation.quantity}</TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.8)' }}>
                          {reservation.sceneId || '-'} / {reservation.shotId || '-'}
                        </TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.8)' }}>
                          {warehouseInventoryService.getLocationPath(projectId, reservation.locationId)}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Plukk">
                              <IconButton
                                size="small"
                                onClick={() => handlePickReservation(reservation)}
                                sx={{ color: '#81c784' }}
                              >
                                <PickIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Frigi">
                              <IconButton
                                size="small"
                                onClick={() => handleReleaseReservation(reservation)}
                                sx={{ color: '#ffb74d' }}
                              >
                                <ReleaseIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Box>
        )}

        {tab === 4 && (
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Transaksjonslogg
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>Tid</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>Handling</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>Post</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>Antall</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>Fra/Til</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>Notat</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {snapshot.transactions.slice(0, 200).map((transaction) => {
                  const item = itemsByKey.get(`${transaction.itemType}:${transaction.itemId}`);
                  return (
                    <TableRow key={transaction.id}>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.8)' }}>
                        {new Date(transaction.createdAt).toLocaleString('nb-NO')}
                      </TableCell>
                      <TableCell sx={{ color: '#fff' }}>{transaction.action}</TableCell>
                      <TableCell sx={{ color: '#fff' }}>{item?.name || transaction.itemId}</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 700 }}>{transaction.quantity}</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.8)' }}>
                        {transaction.fromLocationId
                          ? warehouseInventoryService.getLocationPath(projectId, transaction.fromLocationId)
                          : '-'}
                        {' -> '}
                        {transaction.toLocationId
                          ? warehouseInventoryService.getLocationPath(projectId, transaction.toLocationId)
                          : '-'}
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.8)' }}>{transaction.note || '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}

        {tab === 5 && (
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Konsistenssjekk
            </Typography>
            {consistencyIssues.length === 0 ? (
              <Alert severity="success" sx={{ borderRadius: 2 }}>
                Ingen avvik funnet.
              </Alert>
            ) : (
              <Stack spacing={1}>
                {consistencyIssues.map((issue) => {
                  const item = items.find(
                    (entry) => entry.itemType === issue.itemType && entry.id === issue.itemId
                  );
                  return (
                    <Alert
                      key={issue.id}
                      severity={
                        issue.severity === 'high'
                          ? 'error'
                          : issue.severity === 'medium'
                            ? 'warning'
                            : 'info'
                      }
                      sx={{ borderRadius: 2 }}
                      action={
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleIssueAction(issue)}
                        >
                          Gå til
                        </Button>
                      }
                    >
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {item?.name || `${issue.itemType}:${issue.itemId}`}
                      </Typography>
                      <Typography variant="body2">{issue.message}</Typography>
                      <Typography variant="caption">{issue.suggestion}</Typography>
                    </Alert>
                  );
                })}
              </Stack>
            )}
          </Box>
        )}
      </DialogContent>

      <Dialog
        open={qrLabelOpen}
        onClose={() => setQrLabelOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1b2030',
            color: '#fff',
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 70px rgba(0,0,0,0.45)',
          },
        }}
      >
        <DialogTitle
          component="div"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            py: 1.5,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <QrCodeIcon sx={{ color: '#64b5f6' }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Lager-QR etikett
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                {qrItem?.name || 'Post'}
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={() => setQrLabelOpen(false)} sx={{ color: 'rgba(255,255,255,0.7)' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          {qrItem && (
            <Stack spacing={1.5}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: '1px solid rgba(255,255,255,0.1)',
                  bgcolor: 'rgba(255,255,255,0.02)',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <Box
                  component="img"
                  src={getQrImageUrl(qrItem)}
                  alt={`QR for ${qrItem.name}`}
                  sx={{
                    width: { xs: 220, sm: 260 },
                    height: { xs: 220, sm: 260 },
                    borderRadius: 1,
                    bgcolor: '#fff',
                    p: 1,
                  }}
                />
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip
                  label={`ID: ${qrItem.id}`}
                  sx={{ bgcolor: 'rgba(147,51,234,0.15)', color: '#c084fc' }}
                />
                <Chip
                  label={`Type: ${qrItem.itemType === 'equipment' ? 'Utstyr' : 'Rekvisitt'}`}
                  sx={{ bgcolor: 'rgba(100,181,246,0.15)', color: '#64b5f6' }}
                />
                <Chip
                  label={`Antall: ${qrItem.quantity}`}
                  sx={{ bgcolor: 'rgba(129,199,132,0.15)', color: '#81c784' }}
                />
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <Stack
          direction="row"
          spacing={1}
          justifyContent="flex-end"
          sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2 }}
        >
          <Button
            variant="outlined"
            startIcon={<CopyIcon />}
            onClick={() => qrItem && handleCopyQrValue(qrItem)}
            sx={{ borderColor: '#64b5f6', color: '#64b5f6' }}
          >
            Kopier data
          </Button>
          <Button
            variant="outlined"
            startIcon={<QrCodeScannerIcon />}
            onClick={() => {
              setQrLabelOpen(false);
              setQrScanInput('');
              setQrScanError(null);
              setQrScanOpen(true);
            }}
            sx={{ borderColor: '#81c784', color: '#81c784' }}
          >
            Skann
          </Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={() => qrItem && handlePrintQrLabel(qrItem)}
            sx={{ bgcolor: '#9333ea', color: '#000', fontWeight: 700, '&:hover': { bgcolor: '#a855f7' } }}
          >
            Skriv ut etikett
          </Button>
        </Stack>
      </Dialog>

      <Dialog
        open={qrScanOpen}
        onClose={() => setQrScanOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1b2030',
            color: '#fff',
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
          },
        }}
      >
        <DialogTitle
          component="div"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            py: 1.5,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <QrCodeScannerIcon sx={{ color: '#64b5f6' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Skann lager-QR
            </Typography>
          </Stack>
          <IconButton onClick={() => setQrScanOpen(false)} sx={{ color: 'rgba(255,255,255,0.7)' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 1.25, fontSize: '0.9rem' }}>
            Lim inn skannet QR-tekst fra scanner eller mobilkamera.
          </Typography>
          <QrCameraScanner
            active={qrScanOpen}
            onDetected={(value) => {
              setQrScanInput(value);
              setQrScanError(null);
              handleResolveScannedQr(value);
            }}
          />
          <TextField
            fullWidth
            multiline
            minRows={4}
            value={qrScanInput}
            onChange={(event) => {
              setQrScanInput(event.target.value);
              if (qrScanError) setQrScanError(null);
            }}
            placeholder="role-room://warehouse/v1/..."
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                bgcolor: 'rgba(0,0,0,0.2)',
                borderRadius: 2,
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(100,181,246,0.4)' },
                '&.Mui-focused fieldset': { borderColor: '#64b5f6' },
              },
            }}
          />
          {qrScanError && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              {qrScanError}
            </Alert>
          )}
        </DialogContent>
        <Stack
          direction="row"
          spacing={1}
          justifyContent="flex-end"
          sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2 }}
        >
          <Button onClick={() => setQrScanOpen(false)} sx={{ color: 'rgba(255,255,255,0.8)' }}>
            Avbryt
          </Button>
          <Button
            variant="outlined"
            startIcon={<CopyIcon />}
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                setQrScanInput(text);
                setQrScanError(null);
              } catch {
                setQrScanError('Kunne ikke lese fra utklippstavle.');
              }
            }}
            sx={{ borderColor: '#64b5f6', color: '#64b5f6' }}
          >
            Lim inn
          </Button>
          <Button
            variant="contained"
            startIcon={<QrCodeScannerIcon />}
            onClick={() => handleResolveScannedQr(qrScanInput)}
            sx={{ bgcolor: '#64b5f6', color: '#000', fontWeight: 700, '&:hover': { bgcolor: '#90caf9' } }}
          >
            Tolk QR
          </Button>
        </Stack>
      </Dialog>
    </Dialog>
  );
}

export default WarehouseInventoryDialog;
