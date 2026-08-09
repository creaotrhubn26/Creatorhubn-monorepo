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
import globalTagService from '../../services/globalTagService';
import GlobalMentionHelper from './GlobalMentionHelper';
import { useT } from '../../../../i18n';

const NODE_TYPE_KEYS: Array<{ value: WarehouseNodeType; key: 'warehouse.nodeType.warehouse' | 'warehouse.nodeType.zone' | 'warehouse.nodeType.shelf' | 'warehouse.nodeType.bin' }> = [
  { value: 'warehouse', key: 'warehouse.nodeType.warehouse' },
  { value: 'zone', key: 'warehouse.nodeType.zone' },
  { value: 'shelf', key: 'warehouse.nodeType.shelf' },
  { value: 'bin', key: 'warehouse.nodeType.bin' },
];

const OPERATION_KEYS: Array<{ value: InventoryTransactionAction; key: 'warehouse.operation.move' | 'warehouse.operation.receive' | 'warehouse.operation.return' | 'warehouse.operation.adjust' | 'warehouse.operation.count' | 'warehouse.operation.reserve' }> = [
  { value: 'move', key: 'warehouse.operation.move' },
  { value: 'receive', key: 'warehouse.operation.receive' },
  { value: 'return', key: 'warehouse.operation.return' },
  { value: 'adjust', key: 'warehouse.operation.adjust' },
  { value: 'count', key: 'warehouse.operation.count' },
  { value: 'reserve', key: 'warehouse.operation.reserve' },
];

const severityOrder: Record<'high' | 'medium' | 'low', number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const WAREHOUSE_TAB_PANEL_SX = {
  p: 2,
  m: { xs: 1.5, md: 2 },
  borderRadius: 2,
  border: '1px solid rgba(148,163,184,0.22)',
  background: 'linear-gradient(150deg, rgba(2,6,23,0.74) 0%, rgba(15,23,42,0.68) 50%, rgba(30,41,59,0.56) 100%)',
  boxShadow: '0 12px 30px rgba(2,6,23,0.26)',
};

const WAREHOUSE_CONTROL_SX = {
  '& .MuiInputBase-root': {
    color: '#e2e8f0',
    bgcolor: 'rgba(15,23,42,0.7)',
    borderRadius: 1.25,
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'rgba(148,163,184,0.34)',
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(226,232,240,0.7)',
  },
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
  title,
  items,
  locationSeeds,
  onRequestEditItem,
}: WarehouseInventoryDialogProps) {
  const { t } = useT();
  const resolvedTitle = title ?? t('warehouse.title');
  const NODE_TYPES = useMemo(
    () => NODE_TYPE_KEYS.map((entry) => ({ value: entry.value, label: t(entry.key) })),
    [t],
  );
  const OPERATIONS = useMemo(
    () => OPERATION_KEYS.map((entry) => ({ value: entry.value, label: t(entry.key) })),
    [t],
  );
  const getItemTypeLabel = (itemType: InventoryItemType): string =>
    t(itemType === 'equipment' ? 'warehouse.itemType.equipment' : 'warehouse.itemType.prop');
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
  const mentionCandidates = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...items.map((item) => item.name),
            ...snapshot.nodes.map((node) => node.name),
          ]
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim())
            .filter((value) => value.length >= 2),
        ),
      ),
    [items, snapshot.nodes],
  );
  const applyMentionSuggestion = (sourceText: string | undefined, name: string): string => {
    const current = typeof sourceText === 'string' ? sourceText : '';
    if (!current.trim()) return name;
    const replaced = current.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
    return replaced !== current ? replaced : `${current.trimEnd()} ${name}`;
  };
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
      setFeedback({ kind: 'error', message: t('warehouse.msg.nodeNameRequired') });
      return;
    }
    warehouseInventoryService.createNode(projectId, {
      name: newNodeName,
      type: newNodeType,
      parentId: newNodeParent || undefined,
    });
    setNewNodeName('');
    setFeedback({ kind: 'success', message: t('warehouse.msg.nodeCreated') });
    reloadSnapshot();
  };

  const handleDeleteNode = (nodeId: string) => {
    const result = warehouseInventoryService.deleteNode(projectId, nodeId);
    if (!result.ok) {
      setFeedback({ kind: 'error', message: result.reason || t('warehouse.msg.nodeDeleteFailed') });
      return;
    }
    setFeedback({ kind: 'success', message: t('warehouse.msg.nodeDeleted') });
    reloadSnapshot();
  };

  const handleSubmitOperation = () => {
    if (!selectedItemKey) {
      setFeedback({ kind: 'error', message: t('warehouse.msg.selectItemFirst') });
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setFeedback({ kind: 'error', message: t('warehouse.msg.quantityMustBePositive') });
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

    let result: { ok: boolean; reason?: string } = { ok: false, reason: t('warehouse.msg.invalidOperation') };
    switch (operation) {
      case 'move':
        if (!fromLocationId || !toLocationId) {
          setFeedback({ kind: 'error', message: t('warehouse.msg.selectFromAndTo') });
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
          setFeedback({ kind: 'error', message: t('warehouse.msg.selectReceiveLocation') });
          return;
        }
        result = warehouseInventoryService.receiveStock({
          ...payload,
          locationId: toLocationId,
        });
        break;
      case 'return':
        if (!toLocationId) {
          setFeedback({ kind: 'error', message: t('warehouse.msg.selectReturnLocation') });
          return;
        }
        result = warehouseInventoryService.returnStock({
          ...payload,
          locationId: toLocationId,
        });
        break;
      case 'adjust':
        if (!toLocationId) {
          setFeedback({ kind: 'error', message: t('warehouse.msg.selectAdjustLocation') });
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
          setFeedback({ kind: 'error', message: t('warehouse.msg.selectCountLocation') });
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
          setFeedback({ kind: 'error', message: t('warehouse.msg.selectReserveLocation') });
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
      setFeedback({ kind: 'error', message: result.reason || t('warehouse.msg.operationFailed') });
      return;
    }

    const mentionSeed = [
      selectedItem?.name,
      ...globalTagService.parseExplicitMentions(typeof operationNote === 'string' ? operationNote : ''),
    ]
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => value.length >= 2);
    if (mentionSeed.length > 0) {
      void globalTagService.add(mentionSeed).catch((error) => {
        // i18n-exempt: developer-facing console log, not user-facing UI
        console.warn('Kunne ikke oppdatere globalt mention-register fra lagernotat:', error);
      });
    }
    setFeedback({ kind: 'success', message: t('warehouse.msg.operationSaved') });
    reloadSnapshot();
  };

  const handlePickReservation = (reservation: InventoryReservation) => {
    const result = warehouseInventoryService.pickReservation(projectId, reservation.id);
    if (!result.ok) {
      setFeedback({ kind: 'error', message: result.reason || t('warehouse.msg.pickFailed') });
      return;
    }
    setFeedback({ kind: 'success', message: t('warehouse.msg.picked') });
    reloadSnapshot();
  };

  const handleReleaseReservation = (reservation: InventoryReservation) => {
    const result = warehouseInventoryService.releaseReservation(projectId, reservation.id);
    if (!result.ok) {
      setFeedback({ kind: 'error', message: result.reason || t('warehouse.msg.releaseFailed') });
      return;
    }
    setFeedback({ kind: 'success', message: t('warehouse.msg.released') });
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
      setFeedback({ kind: 'error', message: t('warehouse.msg.itemNotFoundForQr') });
      return;
    }
    setQrItemKey(itemKey);
    setQrLabelOpen(true);
  };

  const handleCopyQrValue = async (item: WarehouseDialogItem) => {
    try {
      await navigator.clipboard.writeText(getQrValue(item));
      setFeedback({ kind: 'success', message: t('warehouse.msg.qrDataCopied') });
    } catch {
      setFeedback({ kind: 'error', message: t('warehouse.msg.qrCopyFailed') });
    }
  };

  const handlePrintQrLabel = (item: WarehouseDialogItem) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setFeedback({ kind: 'error', message: t('warehouse.msg.printWindowFailed') });
      return;
    }

    const qrUrl = getQrImageUrl(item, 360);
    const qrPayload = getQrValue(item);
    // i18n-exempt: exported/printed label document content, not in-app UI
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
      setQrScanError(t('warehouse.msg.unknownQrFormat'));
      return;
    }
    if (parsed.projectId && parsed.projectId !== projectId) {
      setQrScanError(t('warehouse.msg.qrWrongProject'));
      return;
    }

    const matchKey = `${parsed.itemType}:${parsed.itemId}`;
    const item = itemsByKey.get(matchKey);
    if (!item) {
      setQrScanError(t('warehouse.msg.qrItemNotFound'));
      return;
    }

    setSelectedItemKey(matchKey);
    setTab(2);
    setQrScanInput('');
    setQrScanError(null);
    setQrScanOpen(false);
    setFeedback({ kind: 'success', message: t('warehouse.msg.qrFound', { name: item.name }) });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      PaperProps={{
        sx: {
          color: '#f8fafc',
          borderRadius: 3,
          overflow: 'hidden',
          border: '1px solid rgba(148,163,184,0.26)',
          background:
            'linear-gradient(160deg, rgba(2,6,23,0.95) 0%, rgba(15,23,42,0.92) 52%, rgba(30,41,59,0.86) 100%)',
          boxShadow: '0 26px 70px rgba(2,6,23,0.54)',
          backdropFilter: 'blur(18px)',
        },
      }}
    >
      <DialogTitle
        component="div"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(148,163,184,0.22)',
          py: 1.75,
          px: { xs: 2, md: 2.5 },
          background:
            'linear-gradient(120deg, rgba(147,51,234,0.18) 0%, rgba(59,130,246,0.1) 52%, rgba(15,23,42,0.2) 100%)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              background: 'linear-gradient(135deg, #a855f7, #7e22ce)',
              border: '1px solid rgba(233,213,255,0.36)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Inventory2Icon sx={{ color: '#fff', fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{resolvedTitle}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.72)' }}>
              {t('warehouse.subtitle')}
            </Typography>
          </Box>
          <Chip
            size="small"
            label={t('warehouse.availableChip', { n: totals.totalAvailable })}
            sx={{ bgcolor: 'rgba(76,175,80,0.2)', color: '#86efac', fontWeight: 700, border: '1px solid rgba(134,239,172,0.32)' }}
          />
        </Box>
        <IconButton onClick={onClose} aria-label={t('warehouse.close')} sx={{ color: 'rgba(226,232,240,0.8)' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 0, pb: 1 }}>
        {feedback && (
          <Alert
            severity={feedback.kind}
            onClose={() => setFeedback(null)}
            sx={{ mx: 2, mt: 2, borderRadius: 2, border: '1px solid rgba(148,163,184,0.24)', bgcolor: 'rgba(15,23,42,0.8)' }}
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
            pt: 1.5,
            pb: 1,
            minHeight: 44,
            '& .MuiTabs-indicator': { display: 'none' },
            '& .MuiTab-root': {
              minHeight: 38,
              textTransform: 'none',
              borderRadius: 1.25,
              border: '1px solid rgba(148,163,184,0.24)',
              color: 'rgba(203,213,225,0.75)',
              bgcolor: 'rgba(15,23,42,0.6)',
              mr: 1,
              '&.Mui-selected': {
                color: '#f5d0fe',
                borderColor: 'rgba(192,132,252,0.46)',
                bgcolor: 'rgba(147,51,234,0.24)',
                boxShadow: '0 8px 20px rgba(147,51,234,0.26)',
              },
            },
          }}
        >
          <Tab icon={<Inventory2Icon sx={{ fontSize: 16 }} />} iconPosition="start" label={t('warehouse.tab.overview')} />
          <Tab icon={<StructureIcon sx={{ fontSize: 16 }} />} iconPosition="start" label={t('warehouse.tab.structure')} />
          <Tab icon={<MoveIcon sx={{ fontSize: 16 }} />} iconPosition="start" label={t('warehouse.tab.operations')} />
          <Tab icon={<ReserveIcon sx={{ fontSize: 16 }} />} iconPosition="start" label={t('warehouse.tab.reservations')} />
          <Tab icon={<HistoryIcon sx={{ fontSize: 16 }} />} iconPosition="start" label={t('warehouse.tab.log')} />
          <Tab icon={<RuleIcon sx={{ fontSize: 16 }} />} iconPosition="start" label={t('warehouse.tab.consistency')} />
        </Tabs>

        <Divider sx={{ borderColor: 'rgba(148,163,184,0.2)' }} />

        {tab === 0 && (
          <Box sx={WAREHOUSE_TAB_PANEL_SX}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(6, minmax(0, 1fr))' },
                gap: 1.25,
                mb: 2,
              }}
            >
              {[
                { id: 'available', label: t('warehouse.metric.available'), value: totals.totalAvailable, color: '#81c784' },
                { id: 'reserved', label: t('warehouse.metric.reserved'), value: totals.totalReserved, color: '#ffb74d' },
                { id: 'total', label: t('warehouse.metric.total'), value: totals.totalQuantity, color: '#64b5f6' },
                { id: 'locations', label: t('warehouse.metric.locations'), value: totals.locations, color: '#c084fc' },
                { id: 'lowStock', label: t('warehouse.metric.lowStock'), value: totals.lowStock, color: '#ef5350' },
                { id: 'issues', label: t('warehouse.metric.issues'), value: totals.issues, color: '#fbc02d' },
              ].map((metric) => (
                <Box
                  key={metric.id}
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
              {t('warehouse.stockHeading')}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>{t('warehouse.column.item')}</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>{t('warehouse.column.type')}</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>{t('warehouse.column.location')}</TableCell>
                  <TableCell align="center" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    {t('warehouse.column.qr')}
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    {t('warehouse.metric.available')}
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    {t('warehouse.metric.reserved')}
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
                        label={getItemTypeLabel(row.itemType)}
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
                      <Tooltip title={t('warehouse.tooltip.viewQr')}>
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
          <Box sx={WAREHOUSE_TAB_PANEL_SX}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              {t('warehouse.createNodeHeading')}
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
                label={t('warehouse.field.name')}
                value={newNodeName}
                onChange={(event) => setNewNodeName(event.target.value)}
                size="small"
                sx={WAREHOUSE_CONTROL_SX}
              />
              <FormControl size="small" sx={WAREHOUSE_CONTROL_SX}>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.8)' }}>{t('warehouse.column.type')}</InputLabel>
                <Select
                  value={newNodeType}
                  onChange={(event) => setNewNodeType(event.target.value as WarehouseNodeType)}
                  label={t('warehouse.column.type')}
                  sx={{ color: '#fff' }}
                >
                  {NODE_TYPES.map((nodeType) => (
                    <MenuItem key={nodeType.value} value={nodeType.value}>
                      {nodeType.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={WAREHOUSE_CONTROL_SX}>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.8)' }}>{t('warehouse.field.parent')}</InputLabel>
                <Select
                  value={newNodeParent}
                  onChange={(event) => setNewNodeParent(event.target.value)}
                  label={t('warehouse.field.parent')}
                  sx={{ color: '#fff' }}
                >
                  <MenuItem value="">{t('warehouse.option.none')}</MenuItem>
                  {snapshot.nodes.map((node) => (
                    <MenuItem key={node.id} value={node.id}>
                      {node.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateNode} sx={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#050816', fontWeight: 700, '&:hover': { background: 'linear-gradient(135deg, #c084fc, #9333ea)' } }}>
                {t('warehouse.button.create')}
              </Button>
            </Box>

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              {t('warehouse.currentStructureHeading')}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>{t('warehouse.field.name')}</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>{t('warehouse.column.type')}</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>{t('warehouse.column.path')}</TableCell>
                  <TableCell align="right" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    {t('warehouse.column.action')}
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
                      <Tooltip title={t('warehouse.tooltip.deleteNode')}>
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
          <Box sx={WAREHOUSE_TAB_PANEL_SX}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              justifyContent="space-between"
              sx={{ mb: 1.5 }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {t('warehouse.operationsHeading')}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<QrCodeIcon />}
                  onClick={() => selectedItem && openQrLabel(`${selectedItem.itemType}:${selectedItem.id}`)}
                  disabled={!selectedItem}
                  sx={{ borderColor: 'rgba(147,197,253,0.52)', color: '#93c5fd', '&:hover': { borderColor: '#93c5fd', bgcolor: 'rgba(59,130,246,0.12)' } }}
                >
                  {t('warehouse.button.qrLabel')}
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
                  sx={{ borderColor: 'rgba(192,132,252,0.5)', color: '#d8b4fe', '&:hover': { borderColor: '#d8b4fe', bgcolor: 'rgba(147,51,234,0.12)' } }}
                >
                  {t('warehouse.button.scanQr')}
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
              <FormControl size="small" fullWidth sx={WAREHOUSE_CONTROL_SX}>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.8)' }}>{t('warehouse.column.item')}</InputLabel>
                <Select
                  value={selectedItemKey}
                  label={t('warehouse.column.item')}
                  onChange={(event) => setSelectedItemKey(event.target.value)}
                  sx={{ color: '#fff' }}
                >
                  {items.map((item) => (
                    <MenuItem key={`${item.itemType}:${item.id}`} value={`${item.itemType}:${item.id}`}>
                      {t('warehouse.itemOption', { name: item.name, type: getItemTypeLabel(item.itemType) })}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth sx={WAREHOUSE_CONTROL_SX}>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.8)' }}>{t('warehouse.field.operation')}</InputLabel>
                <Select
                  value={operation}
                  label={t('warehouse.field.operation')}
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
                label={t('warehouse.field.quantity')}
                type="number"
                size="small"
                value={quantity}
                onChange={(event) => setQuantity(Math.max(0, Number(event.target.value) || 0))}
                sx={WAREHOUSE_CONTROL_SX}
              />

              {operationNeedsSource(operation) && (
                <FormControl size="small" fullWidth sx={WAREHOUSE_CONTROL_SX}>
                  <InputLabel sx={{ color: 'rgba(255,255,255,0.8)' }}>{t('warehouse.field.fromLocation')}</InputLabel>
                  <Select
                    value={fromLocationId}
                    label={t('warehouse.field.fromLocation')}
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
                <FormControl size="small" fullWidth sx={WAREHOUSE_CONTROL_SX}>
                  <InputLabel sx={{ color: 'rgba(255,255,255,0.8)' }}>
                    {operation === 'move' ? t('warehouse.field.toLocation') : t('warehouse.field.location')}
                  </InputLabel>
                  <Select
                    value={toLocationId}
                    label={operation === 'move' ? t('warehouse.field.toLocation') : t('warehouse.field.location')}
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
                    label={t('warehouse.field.sceneId')}
                    size="small"
                    value={sceneId}
                    onChange={(event) => setSceneId(event.target.value)}
                    sx={WAREHOUSE_CONTROL_SX}
                  />
                  <TextField
                    label={t('warehouse.field.shotId')}
                    size="small"
                    value={shotId}
                    onChange={(event) => setShotId(event.target.value)}
                    sx={WAREHOUSE_CONTROL_SX}
                  />
                </>
              )}

              <TextField
                label={t('warehouse.field.note')}
                size="small"
                value={operationNote}
                onChange={(event) => setOperationNote(event.target.value)}
                sx={WAREHOUSE_CONTROL_SX}
              />
              <GlobalMentionHelper
                text={typeof operationNote === 'string' ? operationNote : ''}
                localCandidates={mentionCandidates}
                onApplySuggestion={(name) => setOperationNote((prev) => applyMentionSuggestion(prev, name))}
              />
            </Box>

            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
              <Button variant="contained" onClick={handleSubmitOperation} sx={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#050816', fontWeight: 700, '&:hover': { background: 'linear-gradient(135deg, #c084fc, #9333ea)' } }}>
                {t('warehouse.button.saveOperation')}
              </Button>
            </Stack>
          </Box>
        )}

        {tab === 3 && (
          <Box sx={WAREHOUSE_TAB_PANEL_SX}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              {t('warehouse.activeReservationsHeading')}
            </Typography>
            {activeReservations.length === 0 ? (
              <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>{t('warehouse.noActiveReservations')}</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>{t('warehouse.column.item')}</TableCell>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>{t('warehouse.field.quantity')}</TableCell>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>{t('warehouse.column.sceneShot')}</TableCell>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>{t('warehouse.field.location')}</TableCell>
                    <TableCell align="right" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      {t('warehouse.column.actions')}
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
                            <Tooltip title={t('warehouse.tooltip.pick')}>
                              <IconButton
                                size="small"
                                onClick={() => handlePickReservation(reservation)}
                                sx={{ color: '#81c784' }}
                              >
                                <PickIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('warehouse.tooltip.release')}>
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
          <Box sx={WAREHOUSE_TAB_PANEL_SX}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              {t('warehouse.transactionLogHeading')}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>{t('warehouse.column.time')}</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>{t('warehouse.column.action')}</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>{t('warehouse.column.item')}</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>{t('warehouse.field.quantity')}</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>{t('warehouse.column.fromTo')}</TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>{t('warehouse.field.note')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {snapshot.transactions.slice(0, 200).map((transaction) => {
                  const item = itemsByKey.get(`${transaction.itemType}:${transaction.itemId}`);
                  return (
                    <TableRow key={transaction.id}>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.8)' }}>
                        {/* i18n-exempt: fixed nb-NO locale for timestamp formatting, not translatable UI text */}
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
          <Box sx={WAREHOUSE_TAB_PANEL_SX}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              {t('warehouse.consistencyHeading')}
            </Typography>
            {consistencyIssues.length === 0 ? (
              <Alert severity="success" sx={{ borderRadius: 2 }}>
                {t('warehouse.noIssues')}
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
                          {t('warehouse.button.goTo')}
                        </Button>
                      }
                    >
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {item?.name || `${issue.itemType}:${issue.itemId}`}
                      </Typography>
                      {/* i18n-exempt: issue.message/suggestion are backend-generated consistency-check text */}
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
                {t('warehouse.qrLabelTitle')}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                {qrItem?.name || t('warehouse.column.item')}
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={() => setQrLabelOpen(false)} aria-label={t('warehouse.closeQrLabel')} sx={{ color: 'rgba(255,255,255,0.7)' }}>
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
                  alt={t('warehouse.qrAltText', { name: qrItem.name })}
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
                  label={t('warehouse.qrIdLabel', { id: qrItem.id })}
                  sx={{ bgcolor: 'rgba(147,51,234,0.15)', color: '#c084fc' }}
                />
                <Chip
                  label={t('warehouse.qrTypeLabel', { type: getItemTypeLabel(qrItem.itemType) })}
                  sx={{ bgcolor: 'rgba(100,181,246,0.15)', color: '#64b5f6' }}
                />
                <Chip
                  label={t('warehouse.qrQuantityLabel', { n: qrItem.quantity })}
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
            sx={{ borderColor: '#c084fc', color: '#c084fc' }}
          >
            {t('warehouse.button.copyData')}
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
            sx={{ borderColor: '#c084fc', color: '#c084fc', '&:hover': { borderColor: '#d8b4fe', bgcolor: 'rgba(147,51,234,0.12)' } }}
          >
            {t('warehouse.button.scan')}
          </Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={() => qrItem && handlePrintQrLabel(qrItem)}
            sx={{ bgcolor: '#9333ea', color: '#000', fontWeight: 700, '&:hover': { bgcolor: '#a855f7' } }}
          >
            {t('warehouse.button.printLabel')}
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
            background: 'linear-gradient(160deg, rgba(2,6,23,0.95) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)',
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
            <QrCodeScannerIcon sx={{ color: '#c084fc' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {t('warehouse.scanQrTitle')}
            </Typography>
          </Stack>
          <IconButton onClick={() => setQrScanOpen(false)} aria-label={t('warehouse.closeQrScan')} sx={{ color: 'rgba(255,255,255,0.7)' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 1.25, fontSize: '0.9rem' }}>
            {t('warehouse.scanQrHint')}
          </Typography>
          <QrCameraScanner
            active={qrScanOpen}
            // i18n-exempt: value flows into QrCameraScanner's own (non-migrated) Norwegian sentence text
            scanTargetLabel="lager-QR"
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
                '&:hover fieldset': { borderColor: 'rgba(192,132,252,0.45)' },
                '&.Mui-focused fieldset': { borderColor: '#c084fc' },
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
            {t('warehouse.button.cancel')}
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
                setQrScanError(t('warehouse.msg.clipboardReadFailed'));
              }
            }}
            sx={{ borderColor: '#c084fc', color: '#c084fc' }}
          >
            {t('warehouse.button.paste')}
          </Button>
          <Button
            variant="contained"
            startIcon={<QrCodeScannerIcon />}
            onClick={() => handleResolveScannedQr(qrScanInput)}
            sx={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#000', fontWeight: 700, '&:hover': { background: 'linear-gradient(135deg, #c084fc, #9333ea)' } }}
          >
            {t('warehouse.button.parseQr')}
          </Button>
        </Stack>
      </Dialog>
    </Dialog>
  );
}

export default WarehouseInventoryDialog;
