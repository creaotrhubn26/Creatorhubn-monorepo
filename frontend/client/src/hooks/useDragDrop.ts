/**
 * useDragDrop Hook
 * React hook for drag and drop functionality
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import type { 
  DragDropConfig, 
  DragDropState, 
  DragItem,
  DropZone
} from '../utils/dragDropManager';
import { 
  dragDropManager
} from'../utils/dragDropManager';

export interface UseDragDropOptions {
  config?: Partial<DragDropConfig>;
  onDragItemRegistered?: (data: { item: DragItem }) => void;
  onDropZoneRegistered?: (data: { zone: DropZone }) => void;
  onDragStarted?: (data: { item: DragItem; event: DragEvent | TouchEvent }) => void;
  onDragEnded?: (data: { item: DragItem; event: DragEvent | TouchEvent }) => void;
  onDragOver?: (data: { item: DragItem; zone: DropZone; event: DragEvent }) => void;
  onDropSuccessful?: (data: { item: DragItem; zone: DropZone; event: DragEvent }) => void;
  onDropRejected?: (data: { item: DragItem; zone: DropZone; event: DragEvent }) => void;
  onDropFailed?: (data: { item: DragItem; zone: DropZone; event: DragEvent; error: string }) => void;
  onError?: (error: string) => void;
  onInitialized?: () => void
}

export interface UseDragDropReturn {
  registerDragItem: (itemData: Partial<DragItem>) => Promise<DragItem>;
  registerDropZone: (zoneData: Partial<DropZone>) => Promise<DropZone>;
  startDrag: (itemId: string, event: DragEvent | TouchEvent) => Promise<void>;
  endDrag: (event: DragEvent | TouchEvent) => Promise<void>;
  state: DragDropState;
  config: DragDropConfig;
  updateConfig: (config: Partial<DragDropConfig>) => void;
  isEnabled: boolean;
  isInitialized: boolean;
  hasError: boolean;
  error: string | null;
  isDragging: boolean;
  isDropping: boolean;
  dragItem: DragItem | null;
  dropZone: DropZone | null;
  dragItems: DragItem[];
  dropZones: DropZone[];
  totalDrags: number;
  totalDrops: number;
  successfulDrops: number;
  failedDrops: number;
  averageDragTime: number;
  averageDropTime: number;
  averageAnimationTime: number;
  totalErrors: number;
  totalCollisions: number;
  totalValidations: number;
  getDragItems: () => DragItem[];
  getDropZones: () => DropZone[]
}

/**
 * Hook for drag and drop functionality
 */
export const useDragDrop = (options: UseDragDropOptions = {}): UseDragDropReturn => {
  const {
    config: optionConfig = {},
    onDragItemRegistered,
    onDropZoneRegistered,
    onDragStarted,
    onDragEnded,
    onDragOver,
    onDropSuccessful,
    onDropRejected,
    onDropFailed,
    onError,
    onInitialized
} = options;

  const [state, setState] = useState<DragDropState>({
    isEnabled: false,
    isInitialized: false,
    hasError: false,
    error: null,
    isDragging: false,
    isDropping: false,
    dragItem: null,
    dropZone: null,
    dragItems: new Map(),
    dropZones: new Map(),
    lastUpdate:  0,
    totalDrags:  0,
    totalDrops:  0,
    successfulDrops:  0,
    failedDrops:  0,
    averageDragTime:  0,
    averageDropTime:  0,
    averageAnimationTime:  0,
    totalErrors:  0,
    totalCollisions:  0,
    totalValidations: 0
});

  const stateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventHandlersRef = useRef<Map<string, Function>>(new Map());

  // Initialize drag drop manager
  useEffect(() => {
    // Update configuration
    if (Object.keys(optionConfig).length > 0) {
      dragDropManager.updateConfig(optionConfig);
  }

    // Setup event handlers
    const handleDragItemRegistered = (data: { item: DragItem }) => {
      if (onDragItemRegistered) {
        onDragItemRegistered(data);
    }
  };

    const handleDropZoneRegistered = (data: { zone: DropZone }) => {
      if (onDropZoneRegistered) {
        onDropZoneRegistered(data);
    }
  };

    const handleDragStarted = (data: { item: DragItem; event: DragEvent | TouchEvent }) => {
      if (onDragStarted) {
        onDragStarted(data);
    }
  };

    const handleDragEnded = (data: { item: DragItem; event: DragEvent | TouchEvent }) => {
      if (onDragEnded) {
        onDragEnded(data);
    }
  };

    const handleDragOver = (data: { item: DragItem; zone: DropZone; event: DragEvent }) => {
      if (onDragOver) {
        onDragOver(data);
    }
  };

    const handleDropSuccessful = (data: { item: DragItem; zone: DropZone; event: DragEvent }) => {
      if (onDropSuccessful) {
        onDropSuccessful(data);
    }
  };

    const handleDropRejected = (data: { item: DragItem; zone: DropZone; event: DragEvent }) => {
      if (onDropRejected) {
        onDropRejected(data);
    }
  };

    const handleDropFailed = (data: { item: DragItem; zone: DropZone; event: DragEvent; error: string }) => {
      if (onDropFailed) {
        onDropFailed(data);
    }
  };

    const handleError = (data: { error: string }) => {
      if (onError) {
        onError(data.error);
    }
  };

    const handleInitialized = () => {
      if (onInitialized) {
        onInitialized();
    }
  };

    // Store event handlers
    eventHandlersRef.current.set('drag_item_registered', handleDragItemRegistered);
    eventHandlersRef.current.set('drop_zone_registered', handleDropZoneRegistered);
    eventHandlersRef.current.set('drag_started', handleDragStarted);
    eventHandlersRef.current.set('drag_ended', handleDragEnded);
    eventHandlersRef.current.set('drag_over', handleDragOver);
    eventHandlersRef.current.set('drop_successful', handleDropSuccessful);
    eventHandlersRef.current.set('drop_rejected', handleDropRejected);
    eventHandlersRef.current.set('drop_failed', handleDropFailed);
    eventHandlersRef.current.set('error', handleError);
    eventHandlersRef.current.set('initialized', handleInitialized);

    // Add event listeners
    dragDropManager.on('drag_item_registered', handleDragItemRegistered);
    dragDropManager.on('drop_zone_registered', handleDropZoneRegistered);
    dragDropManager.on('drag_started', handleDragStarted);
    dragDropManager.on('drag_ended', handleDragEnded);
    dragDropManager.on('drag_over', handleDragOver);
    dragDropManager.on('drop_successful', handleDropSuccessful);
    dragDropManager.on('drop_rejected', handleDropRejected);
    dragDropManager.on('drop_failed', handleDropFailed);
    dragDropManager.on('error', handleError);
    dragDropManager.on('initialized', handleInitialized);

    // Update initial state
    setState(dragDropManager.getState());

    return () => {
      // Remove event listeners
      eventHandlersRef.current.forEach((handler, event) => {
        dragDropManager.off(event, handler);
    });
      eventHandlersRef.current.clear();
  };
}, [optionConfig, onDragItemRegistered, onDropZoneRegistered, onDragStarted, onDragEnded, onDragOver, onDropSuccessful, onDropRejected, onDropFailed, onError, onInitialized]);

  // Setup state monitoring
  useEffect(() => {
    stateIntervalRef.current = setInterval(() => {
      const currentState = dragDropManager.getState();
      setState(currentState);
  }, 100);

    return () => {
      if (stateIntervalRef.current) {
        clearInterval(stateIntervalRef.current);
    }
  };
}, []);

  // Register drag item
  const registerDragItem = useCallback(async (itemData: Partial<DragItem>) => {
    return await dragDropManager.registerDragItem(itemData);
}, []);

  // Register drop zone
  const registerDropZone = useCallback(async (zoneData: Partial<DropZone>) => {
    return await dragDropManager.registerDropZone(zoneData);
}, []);

  // Start drag
  const startDrag = useCallback(async (itemId: string, event: DragEvent | TouchEvent) => {
    await dragDropManager.startDrag(itemId, event);
}, []);

  // End drag
  const endDrag = useCallback(async (event: DragEvent | TouchEvent) => {
    await dragDropManager.endDrag(event);
}, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<DragDropConfig>) => {
    dragDropManager.updateConfig(newConfig);
}, []);

  // Get configuration
  const currentConfig = useMemo(() => {
    return dragDropManager.getConfig();
}, []);

  // Get drag items
  const getDragItems = useCallback(() => {
    return dragDropManager.getDragItems();
}, []);

  // Get drop zones
  const getDropZones = useCallback(() => {
    return dragDropManager.getDropZones();
}, []);

  // Memoized return value
  const returnValue = useMemo(() => ({
    registerDragItem,
    registerDropZone,
    startDrag,
    endDrag,
    state,
    config: currentConfig,
    updateConfig,
    isEnabled: state.isEnabled,
    isInitialized: state.isInitialized,
    hasError: state.hasError,
    error: state.error,
    isDragging: state.isDragging,
    isDropping: state.isDropping,
    dragItem: state.dragItem,
    dropZone: state.dropZone,
    dragItems: Array.from(state.dragItems.values()),
    dropZones: Array.from(state.dropZones.values()),
    totalDrags: state.totalDrags,
    totalDrops: state.totalDrops,
    successfulDrops: state.successfulDrops,
    failedDrops: state.failedDrops,
    averageDragTime: state.averageDragTime,
    averageDropTime: state.averageDropTime,
    averageAnimationTime: state.averageAnimationTime,
    totalErrors: state.totalErrors,
    totalCollisions: state.totalCollisions,
    totalValidations: state.totalValidations,
    getDragItems,
    getDropZones
}), [
    registerDragItem,
    registerDropZone,
    startDrag,
    endDrag,
    state,
    currentConfig,
    updateConfig,
    getDragItems,
    getDropZones
  ]);

  return returnValue;
};

export default useDragDrop;




