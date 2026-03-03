export type WarehouseNodeType = 'warehouse' | 'zone' | 'shelf' | 'bin';
export type InventoryItemType = 'equipment' | 'prop';
export type InventoryTransactionAction =
  | 'receive'
  | 'move'
  | 'reserve'
  | 'pick'
  | 'release'
  | 'return'
  | 'adjust'
  | 'count';

export interface WarehouseNode {
  id: string;
  projectId: string;
  name: string;
  type: WarehouseNodeType;
  parentId?: string;
  externalLocationId?: string;
  code?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryStockRecord {
  id: string;
  projectId: string;
  itemType: InventoryItemType;
  itemId: string;
  locationId: string;
  quantity: number;
  reservedQuantity: number;
  minQuantity?: number;
  updatedAt: string;
}

export interface InventoryReservation {
  id: string;
  projectId: string;
  itemType: InventoryItemType;
  itemId: string;
  locationId: string;
  quantity: number;
  status: 'reserved' | 'picked' | 'released' | 'cancelled';
  sceneId?: string;
  shotId?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: string;
  projectId: string;
  itemType: InventoryItemType;
  itemId: string;
  action: InventoryTransactionAction;
  quantity: number;
  fromLocationId?: string;
  toLocationId?: string;
  reservationId?: string;
  sceneId?: string;
  shotId?: string;
  note?: string;
  createdAt: string;
}

export interface WarehouseSnapshot {
  nodes: WarehouseNode[];
  stock: InventoryStockRecord[];
  reservations: InventoryReservation[];
  transactions: InventoryTransaction[];
}

export interface WarehouseLocationSeed {
  id: string;
  name: string;
}

export interface WarehouseItemSeed {
  id: string;
  itemType: InventoryItemType;
  name: string;
  quantity: number;
  primaryLocationId?: string;
  locationLabel?: string;
  category?: string;
}

export interface InventoryConsistencyIssue {
  id: string;
  severity: 'high' | 'medium' | 'low';
  type:
    | 'missing_stock'
    | 'missing_location'
    | 'over_reserved'
    | 'quantity_mismatch'
    | 'out_of_stock';
  itemType: InventoryItemType;
  itemId: string;
  message: string;
  suggestion: string;
}

export interface WarehouseQrPayload {
  version: 1;
  projectId: string;
  itemType: InventoryItemType;
  itemId: string;
  itemName?: string;
  serialNumber?: string;
}

interface PersistedWarehouseState {
  nodes: WarehouseNode[];
  stock: InventoryStockRecord[];
  reservations: InventoryReservation[];
  transactions: InventoryTransaction[];
}

const STORAGE_PREFIX = 'role-room-warehouse';
const QR_PREFIX = 'role-room://warehouse/v1/';

const nowIso = (): string => new Date().toISOString();
const makeId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const safeParse = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed as T;
  } catch {
    return fallback;
  }
};

const base64UrlEncode = (value: string): string => {
  let base64 = '';
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    base64 = window.btoa(unescape(encodeURIComponent(value)));
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const base64UrlDecode = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const base64 = normalized + padding;
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    return decodeURIComponent(escape(window.atob(base64)));
  }
  return '';
};

const buildKey = (projectId: string): string => `${STORAGE_PREFIX}:${projectId}`;

const readState = (projectId: string): PersistedWarehouseState => {
  if (typeof window === 'undefined') {
    return { nodes: [], stock: [], reservations: [], transactions: [] };
  }
  return safeParse<PersistedWarehouseState>(localStorage.getItem(buildKey(projectId)), {
    nodes: [],
    stock: [],
    reservations: [],
    transactions: [],
  });
};

const writeState = (projectId: string, state: PersistedWarehouseState): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(buildKey(projectId), JSON.stringify(state));
};

const normalizeLabel = (value?: string): string => (value || '').trim().toLowerCase();

const getOrCreateStockRecord = (
  state: PersistedWarehouseState,
  projectId: string,
  itemType: InventoryItemType,
  itemId: string,
  locationId: string
): InventoryStockRecord => {
  let record = state.stock.find(
    (entry) =>
      entry.projectId === projectId &&
      entry.itemType === itemType &&
      entry.itemId === itemId &&
      entry.locationId === locationId
  );

  if (!record) {
    record = {
      id: makeId('stock'),
      projectId,
      itemType,
      itemId,
      locationId,
      quantity: 0,
      reservedQuantity: 0,
      updatedAt: nowIso(),
    };
    state.stock.push(record);
  }

  return record;
};

const ensureMainWarehouse = (state: PersistedWarehouseState, projectId: string): WarehouseNode => {
  let root = state.nodes.find(
    (node) => node.projectId === projectId && node.type === 'warehouse' && node.parentId == null
  );

  if (!root) {
    root = {
      id: 'warehouse-main',
      projectId,
      name: 'Hovedlager',
      type: 'warehouse',
      code: 'MAIN',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.nodes.push(root);
  }

  return root;
};

const addTransaction = (
  state: PersistedWarehouseState,
  tx: Omit<InventoryTransaction, 'id' | 'createdAt'>
): InventoryTransaction => {
  const transaction: InventoryTransaction = {
    id: makeId('tx'),
    createdAt: nowIso(),
    ...tx,
  };
  state.transactions.unshift(transaction);
  if (state.transactions.length > 2000) {
    state.transactions = state.transactions.slice(0, 2000);
  }
  return transaction;
};

const sumItemQuantity = (
  stock: InventoryStockRecord[],
  projectId: string,
  itemType: InventoryItemType,
  itemId: string
): number =>
  stock
    .filter((entry) => entry.projectId === projectId && entry.itemType === itemType && entry.itemId === itemId)
    .reduce((sum, entry) => sum + Math.max(0, entry.quantity || 0), 0);

const sumItemReserved = (
  stock: InventoryStockRecord[],
  projectId: string,
  itemType: InventoryItemType,
  itemId: string
): number =>
  stock
    .filter((entry) => entry.projectId === projectId && entry.itemType === itemType && entry.itemId === itemId)
    .reduce((sum, entry) => sum + Math.max(0, entry.reservedQuantity || 0), 0);

export const warehouseInventoryService = {
  buildQrValue(payload: Omit<WarehouseQrPayload, 'version'>): string {
    const encoded = base64UrlEncode(
      JSON.stringify({
        version: 1 as const,
        projectId: payload.projectId,
        itemType: payload.itemType,
        itemId: payload.itemId,
        itemName: payload.itemName,
        serialNumber: payload.serialNumber,
      } satisfies WarehouseQrPayload)
    );
    return `${QR_PREFIX}${encoded}`;
  },

  parseQrValue(value: string): WarehouseQrPayload | null {
    const raw = (value || '').trim();
    if (!raw) return null;

    try {
      if (raw.startsWith(QR_PREFIX)) {
        const encoded = raw.slice(QR_PREFIX.length);
        const decoded = base64UrlDecode(encoded);
        const parsed = JSON.parse(decoded) as Partial<WarehouseQrPayload>;
        if (
          parsed.version === 1 &&
          typeof parsed.projectId === 'string' &&
          (parsed.itemType === 'equipment' || parsed.itemType === 'prop') &&
          typeof parsed.itemId === 'string'
        ) {
          return {
            version: 1,
            projectId: parsed.projectId,
            itemType: parsed.itemType,
            itemId: parsed.itemId,
            itemName: typeof parsed.itemName === 'string' ? parsed.itemName : undefined,
            serialNumber:
              typeof parsed.serialNumber === 'string' ? parsed.serialNumber : undefined,
          };
        }
      }

      // Legacy payload support: plain JSON with id/name/serial
      const legacy = JSON.parse(raw) as { id?: string; name?: string; serial?: string };
      if (typeof legacy.id === 'string') {
        return {
          version: 1,
          projectId: '',
          itemType: 'equipment',
          itemId: legacy.id,
          itemName: typeof legacy.name === 'string' ? legacy.name : undefined,
          serialNumber: typeof legacy.serial === 'string' ? legacy.serial : undefined,
        };
      }
    } catch {
      return null;
    }

    return null;
  },

  buildQrImageUrl(qrValue: string, size = 280): string {
    const safeSize = Number.isFinite(size) ? Math.max(128, Math.min(800, Math.floor(size))) : 280;
    return `https://api.qrserver.com/v1/create-qr-code/?size=${safeSize}x${safeSize}&data=${encodeURIComponent(
      qrValue
    )}`;
  },

  getSnapshot(projectId: string): WarehouseSnapshot {
    const state = readState(projectId);
    return {
      nodes: [...state.nodes],
      stock: [...state.stock],
      reservations: [...state.reservations],
      transactions: [...state.transactions],
    };
  },

  bootstrapProject(
    projectId: string,
    options: {
      locations?: WarehouseLocationSeed[];
      items?: WarehouseItemSeed[];
    }
  ): WarehouseSnapshot {
    const state = readState(projectId);
    const root = ensureMainWarehouse(state, projectId);
    const locations = options.locations || [];
    const items = options.items || [];
    const now = nowIso();

    const nodeByExternalId = new Map(
      state.nodes
        .filter((node) => node.projectId === projectId && node.externalLocationId)
        .map((node) => [node.externalLocationId as string, node])
    );
    const nodeByName = new Map(
      state.nodes
        .filter((node) => node.projectId === projectId)
        .map((node) => [normalizeLabel(node.name), node])
    );

    locations.forEach((location) => {
      if (nodeByExternalId.has(location.id)) return;
      const existingByName = nodeByName.get(normalizeLabel(location.name));
      if (existingByName) {
        existingByName.externalLocationId = location.id;
        existingByName.updatedAt = now;
        nodeByExternalId.set(location.id, existingByName);
        return;
      }
      const node: WarehouseNode = {
        id: `warehouse-${location.id}`,
        projectId,
        name: location.name,
        type: 'warehouse',
        parentId: root.id,
        externalLocationId: location.id,
        createdAt: now,
        updatedAt: now,
      };
      state.nodes.push(node);
      nodeByExternalId.set(location.id, node);
      nodeByName.set(normalizeLabel(node.name), node);
    });

    items.forEach((item) => {
      if (item.locationLabel) {
        const normalized = normalizeLabel(item.locationLabel);
        if (normalized && !nodeByName.has(normalized)) {
          const node: WarehouseNode = {
            id: makeId('warehouse-custom'),
            projectId,
            name: item.locationLabel.trim(),
            type: 'warehouse',
            parentId: root.id,
            createdAt: now,
            updatedAt: now,
          };
          state.nodes.push(node);
          nodeByName.set(normalized, node);
        }
      }
    });

    items.forEach((item) => {
      const existing = state.stock.filter(
        (entry) =>
          entry.projectId === projectId && entry.itemType === item.itemType && entry.itemId === item.id
      );
      if (existing.length > 0) return;

      let locationId = root.id;
      if (item.primaryLocationId && nodeByExternalId.has(item.primaryLocationId)) {
        locationId = nodeByExternalId.get(item.primaryLocationId)!.id;
      } else if (item.locationLabel) {
        const byName = nodeByName.get(normalizeLabel(item.locationLabel));
        if (byName) locationId = byName.id;
      }

      const seedQuantity = Math.max(0, Number.isFinite(item.quantity) ? item.quantity : 0);
      if (seedQuantity <= 0) return;

      state.stock.push({
        id: makeId('stock'),
        projectId,
        itemType: item.itemType,
        itemId: item.id,
        locationId,
        quantity: seedQuantity,
        reservedQuantity: 0,
        updatedAt: now,
      });

      addTransaction(state, {
        projectId,
        itemType: item.itemType,
        itemId: item.id,
        action: 'receive',
        quantity: seedQuantity,
        toLocationId: locationId,
        note: 'Initial synk fra panel',
      });
    });

    writeState(projectId, state);
    return this.getSnapshot(projectId);
  },

  createNode(
    projectId: string,
    payload: {
      name: string;
      type: WarehouseNodeType;
      parentId?: string;
      code?: string;
      notes?: string;
    }
  ): WarehouseNode {
    const state = readState(projectId);
    ensureMainWarehouse(state, projectId);
    const node: WarehouseNode = {
      id: makeId('warehouse-node'),
      projectId,
      name: payload.name.trim(),
      type: payload.type,
      parentId: payload.parentId,
      code: payload.code?.trim() || undefined,
      notes: payload.notes?.trim() || undefined,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.nodes.push(node);
    writeState(projectId, state);
    return node;
  },

  updateNode(
    projectId: string,
    nodeId: string,
    patch: Partial<Pick<WarehouseNode, 'name' | 'code' | 'notes' | 'parentId' | 'type'>>
  ): WarehouseNode | null {
    const state = readState(projectId);
    const node = state.nodes.find((entry) => entry.projectId === projectId && entry.id === nodeId);
    if (!node) return null;

    if (patch.name != null) node.name = patch.name.trim();
    if (patch.code !== undefined) node.code = patch.code?.trim() || undefined;
    if (patch.notes !== undefined) node.notes = patch.notes?.trim() || undefined;
    if (patch.parentId !== undefined) node.parentId = patch.parentId;
    if (patch.type !== undefined) node.type = patch.type;
    node.updatedAt = nowIso();

    writeState(projectId, state);
    return node;
  },

  deleteNode(projectId: string, nodeId: string): { ok: boolean; reason?: string } {
    const state = readState(projectId);
    const node = state.nodes.find((entry) => entry.projectId === projectId && entry.id === nodeId);
    if (!node) return { ok: false, reason: 'Lagernode finnes ikke' };
    if (node.id === 'warehouse-main') return { ok: false, reason: 'Hovedlager kan ikke slettes' };

    const hasChildren = state.nodes.some(
      (entry) => entry.projectId === projectId && entry.parentId === nodeId
    );
    if (hasChildren) return { ok: false, reason: 'Noden har undernivå. Flytt/slett disse først.' };

    const hasStock = state.stock.some(
      (entry) => entry.projectId === projectId && entry.locationId === nodeId && entry.quantity > 0
    );
    if (hasStock) return { ok: false, reason: 'Noden har beholdning. Flytt beholdning først.' };

    state.nodes = state.nodes.filter((entry) => !(entry.projectId === projectId && entry.id === nodeId));
    writeState(projectId, state);
    return { ok: true };
  },

  moveStock(input: {
    projectId: string;
    itemType: InventoryItemType;
    itemId: string;
    fromLocationId: string;
    toLocationId: string;
    quantity: number;
    note?: string;
  }): { ok: boolean; reason?: string } {
    const { projectId, itemType, itemId, fromLocationId, toLocationId, note } = input;
    const quantity = Math.max(0, Math.floor(input.quantity));
    if (!quantity) return { ok: false, reason: 'Antall må være større enn 0' };
    if (fromLocationId === toLocationId) return { ok: false, reason: 'Fra/til lager kan ikke være lik' };

    const state = readState(projectId);
    const source = state.stock.find(
      (entry) =>
        entry.projectId === projectId &&
        entry.itemType === itemType &&
        entry.itemId === itemId &&
        entry.locationId === fromLocationId
    );

    if (!source) return { ok: false, reason: 'Fant ikke beholdning i valgt fra-lager' };
    const available = Math.max(0, source.quantity - source.reservedQuantity);
    if (available < quantity) return { ok: false, reason: 'Ikke nok tilgjengelig beholdning å flytte' };

    const destination = getOrCreateStockRecord(state, projectId, itemType, itemId, toLocationId);
    source.quantity -= quantity;
    source.updatedAt = nowIso();
    destination.quantity += quantity;
    destination.updatedAt = nowIso();

    addTransaction(state, {
      projectId,
      itemType,
      itemId,
      action: 'move',
      quantity,
      fromLocationId,
      toLocationId,
      note: note?.trim() || undefined,
    });

    writeState(projectId, state);
    return { ok: true };
  },

  receiveStock(input: {
    projectId: string;
    itemType: InventoryItemType;
    itemId: string;
    locationId: string;
    quantity: number;
    note?: string;
  }): { ok: boolean; reason?: string } {
    const { projectId, itemType, itemId, locationId, note } = input;
    const quantity = Math.max(0, Math.floor(input.quantity));
    if (!quantity) return { ok: false, reason: 'Antall må være større enn 0' };

    const state = readState(projectId);
    const record = getOrCreateStockRecord(state, projectId, itemType, itemId, locationId);
    record.quantity += quantity;
    record.updatedAt = nowIso();

    addTransaction(state, {
      projectId,
      itemType,
      itemId,
      action: 'receive',
      quantity,
      toLocationId: locationId,
      note: note?.trim() || undefined,
    });

    writeState(projectId, state);
    return { ok: true };
  },

  returnStock(input: {
    projectId: string;
    itemType: InventoryItemType;
    itemId: string;
    locationId: string;
    quantity: number;
    note?: string;
  }): { ok: boolean; reason?: string } {
    const { projectId, itemType, itemId, locationId, note } = input;
    const quantity = Math.max(0, Math.floor(input.quantity));
    if (!quantity) return { ok: false, reason: 'Antall må være større enn 0' };

    const state = readState(projectId);
    const record = getOrCreateStockRecord(state, projectId, itemType, itemId, locationId);
    record.quantity += quantity;
    record.updatedAt = nowIso();

    addTransaction(state, {
      projectId,
      itemType,
      itemId,
      action: 'return',
      quantity,
      toLocationId: locationId,
      note: note?.trim() || undefined,
    });

    writeState(projectId, state);
    return { ok: true };
  },

  adjustStock(input: {
    projectId: string;
    itemType: InventoryItemType;
    itemId: string;
    locationId: string;
    quantity: number;
    note?: string;
    mode?: 'adjust' | 'count';
  }): { ok: boolean; reason?: string } {
    const { projectId, itemType, itemId, locationId, note } = input;
    const quantity = Math.max(0, Math.floor(input.quantity));
    const mode = input.mode || 'adjust';

    const state = readState(projectId);
    const record = getOrCreateStockRecord(state, projectId, itemType, itemId, locationId);
    record.quantity = quantity;
    if (record.reservedQuantity > record.quantity) {
      record.reservedQuantity = record.quantity;
    }
    record.updatedAt = nowIso();

    addTransaction(state, {
      projectId,
      itemType,
      itemId,
      action: mode === 'count' ? 'count' : 'adjust',
      quantity,
      toLocationId: locationId,
      note: note?.trim() || undefined,
    });

    writeState(projectId, state);
    return { ok: true };
  },

  reserveStock(input: {
    projectId: string;
    itemType: InventoryItemType;
    itemId: string;
    locationId: string;
    quantity: number;
    sceneId?: string;
    shotId?: string;
    note?: string;
  }): { ok: boolean; reason?: string; reservation?: InventoryReservation } {
    const { projectId, itemType, itemId, locationId, sceneId, shotId, note } = input;
    const quantity = Math.max(0, Math.floor(input.quantity));
    if (!quantity) return { ok: false, reason: 'Antall må være større enn 0' };

    const state = readState(projectId);
    const record = state.stock.find(
      (entry) =>
        entry.projectId === projectId &&
        entry.itemType === itemType &&
        entry.itemId === itemId &&
        entry.locationId === locationId
    );

    if (!record) return { ok: false, reason: 'Ingen beholdning registrert i valgt lager' };
    const available = Math.max(0, record.quantity - record.reservedQuantity);
    if (available < quantity) return { ok: false, reason: 'Ikke nok tilgjengelig beholdning' };

    record.reservedQuantity += quantity;
    record.updatedAt = nowIso();

    const reservation: InventoryReservation = {
      id: makeId('res'),
      projectId,
      itemType,
      itemId,
      locationId,
      quantity,
      status: 'reserved',
      sceneId: sceneId?.trim() || undefined,
      shotId: shotId?.trim() || undefined,
      note: note?.trim() || undefined,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.reservations.unshift(reservation);

    addTransaction(state, {
      projectId,
      itemType,
      itemId,
      action: 'reserve',
      quantity,
      toLocationId: locationId,
      reservationId: reservation.id,
      sceneId: reservation.sceneId,
      shotId: reservation.shotId,
      note: reservation.note,
    });

    writeState(projectId, state);
    return { ok: true, reservation };
  },

  pickReservation(projectId: string, reservationId: string): { ok: boolean; reason?: string } {
    const state = readState(projectId);
    const reservation = state.reservations.find(
      (entry) => entry.projectId === projectId && entry.id === reservationId
    );
    if (!reservation) return { ok: false, reason: 'Reservasjonen finnes ikke' };
    if (reservation.status !== 'reserved') {
      return { ok: false, reason: 'Bare aktive reservasjoner kan plukkes' };
    }

    const record = state.stock.find(
      (entry) =>
        entry.projectId === projectId &&
        entry.itemType === reservation.itemType &&
        entry.itemId === reservation.itemId &&
        entry.locationId === reservation.locationId
    );
    if (!record) return { ok: false, reason: 'Beholdning mangler for reservasjonen' };
    if (record.reservedQuantity < reservation.quantity) {
      return { ok: false, reason: 'Reservert antall er ugyldig for denne beholdningen' };
    }
    if (record.quantity < reservation.quantity) {
      return { ok: false, reason: 'Ikke nok beholdning til plukk' };
    }

    record.reservedQuantity -= reservation.quantity;
    record.quantity -= reservation.quantity;
    record.updatedAt = nowIso();

    reservation.status = 'picked';
    reservation.updatedAt = nowIso();

    addTransaction(state, {
      projectId,
      itemType: reservation.itemType,
      itemId: reservation.itemId,
      action: 'pick',
      quantity: reservation.quantity,
      fromLocationId: reservation.locationId,
      reservationId: reservation.id,
      sceneId: reservation.sceneId,
      shotId: reservation.shotId,
      note: reservation.note,
    });

    writeState(projectId, state);
    return { ok: true };
  },

  releaseReservation(projectId: string, reservationId: string): { ok: boolean; reason?: string } {
    const state = readState(projectId);
    const reservation = state.reservations.find(
      (entry) => entry.projectId === projectId && entry.id === reservationId
    );
    if (!reservation) return { ok: false, reason: 'Reservasjonen finnes ikke' };
    if (reservation.status !== 'reserved') {
      return { ok: false, reason: 'Bare aktive reservasjoner kan frigjøres' };
    }

    const record = state.stock.find(
      (entry) =>
        entry.projectId === projectId &&
        entry.itemType === reservation.itemType &&
        entry.itemId === reservation.itemId &&
        entry.locationId === reservation.locationId
    );
    if (!record) return { ok: false, reason: 'Beholdning mangler for reservasjonen' };
    if (record.reservedQuantity < reservation.quantity) {
      return { ok: false, reason: 'Reservert antall er ugyldig for denne beholdningen' };
    }

    record.reservedQuantity -= reservation.quantity;
    record.updatedAt = nowIso();
    reservation.status = 'released';
    reservation.updatedAt = nowIso();

    addTransaction(state, {
      projectId,
      itemType: reservation.itemType,
      itemId: reservation.itemId,
      action: 'release',
      quantity: reservation.quantity,
      toLocationId: reservation.locationId,
      reservationId: reservation.id,
      sceneId: reservation.sceneId,
      shotId: reservation.shotId,
      note: reservation.note,
    });

    writeState(projectId, state);
    return { ok: true };
  },

  getLocationPath(projectId: string, locationId?: string): string {
    if (!locationId) return 'Uspesifisert';
    const state = readState(projectId);
    const nodeMap = new Map(
      state.nodes.filter((node) => node.projectId === projectId).map((node) => [node.id, node])
    );
    const parts: string[] = [];
    const guard = new Set<string>();
    let current = nodeMap.get(locationId);
    while (current && !guard.has(current.id)) {
      parts.unshift(current.name);
      guard.add(current.id);
      current = current.parentId ? nodeMap.get(current.parentId) : undefined;
    }
    return parts.length ? parts.join(' / ') : 'Uspesifisert';
  },

  listConsistencyIssues(
    projectId: string,
    items: WarehouseItemSeed[]
  ): InventoryConsistencyIssue[] {
    const state = readState(projectId);
    const issues: InventoryConsistencyIssue[] = [];

    const nodesById = new Map(
      state.nodes.filter((node) => node.projectId === projectId).map((node) => [node.id, node])
    );

    items.forEach((item) => {
      const relevantStock = state.stock.filter(
        (entry) =>
          entry.projectId === projectId &&
          entry.itemType === item.itemType &&
          entry.itemId === item.id
      );

      if (relevantStock.length === 0) {
        issues.push({
          id: `missing-stock-${item.itemType}-${item.id}`,
          severity: 'high',
          type: 'missing_stock',
          itemType: item.itemType,
          itemId: item.id,
          message: `${item.name} mangler lagerpost`,
          suggestion: 'Opprett lagerpost via Lager-operasjoner',
        });
        return;
      }

      const totalQuantity = relevantStock.reduce((sum, entry) => sum + Math.max(0, entry.quantity), 0);
      const totalReserved = relevantStock.reduce(
        (sum, entry) => sum + Math.max(0, entry.reservedQuantity),
        0
      );

      if (totalReserved > totalQuantity) {
        issues.push({
          id: `over-reserved-${item.itemType}-${item.id}`,
          severity: 'high',
          type: 'over_reserved',
          itemType: item.itemType,
          itemId: item.id,
          message: `${item.name} har mer reservert enn beholdning`,
          suggestion: 'Frigi reservasjon eller juster beholdning',
        });
      }

      if (totalQuantity <= 0) {
        issues.push({
          id: `out-of-stock-${item.itemType}-${item.id}`,
          severity: 'medium',
          type: 'out_of_stock',
          itemType: item.itemType,
          itemId: item.id,
          message: `${item.name} er tom på lager`,
          suggestion: 'Motta nytt antall eller flytt fra annet lager',
        });
      }

      if (Math.max(0, item.quantity || 0) !== totalQuantity) {
        issues.push({
          id: `quantity-mismatch-${item.itemType}-${item.id}`,
          severity: 'low',
          type: 'quantity_mismatch',
          itemType: item.itemType,
          itemId: item.id,
          message: `${item.name} har avvik mellom panel-antall (${item.quantity}) og lager (${totalQuantity})`,
          suggestion: 'Kjør telling eller oppdater panelantall',
        });
      }

      const missingNode = relevantStock.some((entry) => !nodesById.has(entry.locationId));
      if (missingNode) {
        issues.push({
          id: `missing-location-${item.itemType}-${item.id}`,
          severity: 'medium',
          type: 'missing_location',
          itemType: item.itemType,
          itemId: item.id,
          message: `${item.name} peker til ugyldig lagerplass`,
          suggestion: 'Flytt beholdning til gyldig lagernode',
        });
      }
    });

    return issues;
  },

  getItemTotals(
    projectId: string,
    itemType: InventoryItemType,
    itemId: string
  ): { quantity: number; reserved: number; available: number } {
    const state = readState(projectId);
    const quantity = sumItemQuantity(state.stock, projectId, itemType, itemId);
    const reserved = sumItemReserved(state.stock, projectId, itemType, itemId);
    return {
      quantity,
      reserved,
      available: Math.max(0, quantity - reserved),
    };
  },
};

export default warehouseInventoryService;
