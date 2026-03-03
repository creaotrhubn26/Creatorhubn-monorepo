/**
 * Component Wiring System
 * Main node-based canvas for visual component connections
 * Uses a custom implementation inspired by React Flow
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Button,
  Chip,
  Stack,
  Drawer,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Collapse,
  Divider,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Fab,
  Badge,
} from '@mui/material';
import {
  Add,
  Delete,
  ZoomIn,
  ZoomOut,
  FitScreen,
  Undo,
  Redo,
  Save,
  PlayArrow,
  Stop,
  Search,
  ExpandMore,
  ExpandLess,
  ContentCopy,
  ContentPaste,
  GridOn,
  GridOff,
  Lock,
  LockOpen,
  Visibility,
  VisibilityOff,
  Code,
  BugReport,
  Settings,
  Palette,
  DataObject,
  Functions,
  Api,
  Storage,
  Psychology,
  Description,
  TouchApp,
  Schedule,
  FilterList,
  Transform,
  Check,
  Close,
  Edit,
  DragIndicator,
  MoreVert,
} from '@mui/icons-material';
import { usePageNodes, usePageConnections } from '@/hooks/usePageCustomizations';
import type { WiringConnection as ApiWiringConnection } from '@/hooks/usePageCustomizations';

// Node types enum
export type NodeCategory = 
  | 'events' 
  | 'logic' 
  | 'data' 
  | 'api' 
  | 'database' 
  | 'env' 
  | 'docs' 
  | 'animation'
  | 'validation'
  | 'state'
  | 'utility'
  | 'theme'
  | 'i18n'
  | 'ai'
  | 'component';

// Node interface
export interface WiringNode {
  id: string;
  type: string;
  category: NodeCategory;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  inputs: NodePort[];
  outputs: NodePort[];
  isSelected?: boolean;
  isLocked?: boolean;
  width?: number;
  height?: number;
}

// Port interface
export interface NodePort {
  id: string;
  name: string;
  type: 'input' | 'output';
  dataType: 'any' | 'string' | 'number' | 'boolean' | 'object' | 'array' | 'event' | 'function';
  connected?: boolean;
  value?: unknown;
}

// Connection interface
export interface NodeConnection {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  type: 'data' | 'event' | 'hook' | 'style';
  animated?: boolean;
  label?: string;
}

// Node library definition
interface NodeDefinition {
  type: string;
  name: string;
  category: NodeCategory;
  description: string;
  icon: React.ReactNode;
  inputs: Omit<NodePort, 'id'>[];
  outputs: Omit<NodePort, 'id'>[];
  defaultData: Record<string, unknown>;
  color: string;
}

// Node library - all available node types
const NODE_LIBRARY: NodeDefinition[] = [
  // Event Nodes
  {
    type: 'OnClickNode',
    name: 'On Click',
    category: 'events',
    description: 'Triggers when element is clicked',
    icon: <TouchApp />,
    inputs: [{ name: 'element', type: 'input', dataType: 'any' }],
    outputs: [{ name: 'event', type: 'output', dataType: 'event' }],
    defaultData: { elementId: '' },
    color: '#4caf50',
  },
  {
    type: 'OnHoverNode',
    name: 'On Hover',
    category: 'events',
    description: 'Triggers on mouse enter/leave',
    icon: <TouchApp />,
    inputs: [{ name: 'element', type: 'input', dataType: 'any' }],
    outputs: [
      { name: 'onEnter', type: 'output', dataType: 'event' },
      { name: 'onLeave', type: 'output', dataType: 'event' },
    ],
    defaultData: {},
    color: '#4caf50',
  },
  {
    type: 'OnSubmitNode',
    name: 'On Submit',
    category: 'events',
    description: 'Triggers on form submission',
    icon: <TouchApp />,
    inputs: [{ name: 'form', type: 'input', dataType: 'any' }],
    outputs: [
      { name: 'event', type: 'output', dataType: 'event' },
      { name: 'formData', type: 'output', dataType: 'object' },
    ],
    defaultData: {},
    color: '#4caf50',
  },
  {
    type: 'OnLoadNode',
    name: 'On Load',
    category: 'events',
    description: 'Triggers when component mounts',
    icon: <Schedule />,
    inputs: [],
    outputs: [{ name: 'trigger', type: 'output', dataType: 'event' }],
    defaultData: {},
    color: '#4caf50',
  },
  
  // Logic Nodes
  {
    type: 'IfElseNode',
    name: 'If/Else',
    category: 'logic',
    description: 'Conditional branching',
    icon: <Functions />,
    inputs: [
      { name: 'condition', type: 'input', dataType: 'boolean' },
      { name: 'trigger', type: 'input', dataType: 'event' },
    ],
    outputs: [
      { name: 'true', type: 'output', dataType: 'event' },
      { name: 'false', type: 'output', dataType: 'event' },
    ],
    defaultData: {},
    color: '#9c27b0',
  },
  {
    type: 'SwitchNode',
    name: 'Switch',
    category: 'logic',
    description: 'Multi-way branching',
    icon: <Functions />,
    inputs: [
      { name: 'value', type: 'input', dataType: 'any' },
      { name: 'trigger', type: 'input', dataType: 'event' },
    ],
    outputs: [
      { name: 'case1', type: 'output', dataType: 'event' },
      { name: 'case2', type: 'output', dataType: 'event' },
      { name: 'default', type: 'output', dataType: 'event' },
    ],
    defaultData: { cases: ['case1', 'case2'] },
    color: '#9c27b0',
  },
  {
    type: 'CompareNode',
    name: 'Compare',
    category: 'logic',
    description: 'Compare two values',
    icon: <Functions />,
    inputs: [
      { name: 'a', type: 'input', dataType: 'any' },
      { name: 'b', type: 'input', dataType: 'any' },
    ],
    outputs: [{ name: 'result', type: 'output', dataType: 'boolean' }],
    defaultData: { operator: '==' },
    color: '#9c27b0',
  },
  
  // Data Transform Nodes
  {
    type: 'MapNode',
    name: 'Map',
    category: 'data',
    description: 'Transform array items',
    icon: <Transform />,
    inputs: [
      { name: 'array', type: 'input', dataType: 'array' },
      { name: 'transform', type: 'input', dataType: 'function' },
    ],
    outputs: [{ name: 'result', type: 'output', dataType: 'array' }],
    defaultData: { expression: 'item => item' },
    color: '#2196f3',
  },
  {
    type: 'FilterNode',
    name: 'Filter',
    category: 'data',
    description: 'Filter array by condition',
    icon: <FilterList />,
    inputs: [
      { name: 'array', type: 'input', dataType: 'array' },
      { name: 'condition', type: 'input', dataType: 'function' },
    ],
    outputs: [{ name: 'result', type: 'output', dataType: 'array' }],
    defaultData: { expression: 'item => true' },
    color: '#2196f3',
  },
  {
    type: 'FormatNode',
    name: 'Format',
    category: 'data',
    description: 'Format data (date, currency, etc.)',
    icon: <DataObject />,
    inputs: [{ name: 'value', type: 'input', dataType: 'any' }],
    outputs: [{ name: 'formatted', type: 'output', dataType: 'string' }],
    defaultData: { format: 'string', template: ', ' },
    color: '#2196f3',
  },
  
  // API Nodes
  {
    type: 'RESTNode',
    name: 'REST API',
    category: 'api',
    description: 'Make REST API calls',
    icon: <Api />,
    inputs: [
      { name: 'trigger', type: 'input', dataType: 'event' },
      { name: 'body', type: 'input', dataType: 'object' },
    ],
    outputs: [
      { name: 'response', type: 'output', dataType: 'object' },
      { name: 'error', type: 'output', dataType: 'object' },
      { name: 'loading', type: 'output', dataType: 'boolean' },
    ],
    defaultData: { method: 'GET', url: ', ', headers: {} },
    color: '#ff9800',
  },
  {
    type: 'GraphQLNode',
    name: 'GraphQL',
    category: 'api',
    description: 'Execute GraphQL queries',
    icon: <Api />,
    inputs: [
      { name: 'trigger', type: 'input', dataType: 'event' },
      { name: 'variables', type: 'input', dataType: 'object' },
    ],
    outputs: [
      { name: 'data', type: 'output', dataType: 'object' },
      { name: 'error', type: 'output', dataType: 'object' },
    ],
    defaultData: { query: '', endpoint: '' },
    color: '#ff9800',
  },
  
  // Database Nodes
  {
    type: 'SelectNode',
    name: 'SELECT',
    category: 'database',
    description: 'Query database',
    icon: <Storage />,
    inputs: [
      { name: 'trigger', type: 'input', dataType: 'event' },
      { name: 'where', type: 'input', dataType: 'object' },
    ],
    outputs: [
      { name: 'rows', type: 'output', dataType: 'array' },
      { name: 'error', type: 'output', dataType: 'object' },
    ],
    defaultData: { table: '', columns: ['*'] },
    color: '#00bcd4',
  },
  {
    type: 'InsertNode',
    name: 'INSERT',
    category: 'database',
    description: 'Insert into database',
    icon: <Storage />,
    inputs: [
      { name: 'trigger', type: 'input', dataType: 'event' },
      { name: 'data', type: 'input', dataType: 'object' },
    ],
    outputs: [
      { name: 'result', type: 'output', dataType: 'object' },
      { name: 'error', type: 'output', dataType: 'object' },
    ],
    defaultData: { table: ', ' },
    color: '#00bcd4',
  },
  
  // AI Nodes
  {
    type: 'AISuggestNode',
    name: 'AI Suggest',
    category: 'ai',
    description: 'Get AI-powered suggestions',
    icon: <Psychology />,
    inputs: [
      { name: 'context', type: 'input', dataType: 'object' },
      { name: 'trigger', type: 'input', dataType: 'event' },
    ],
    outputs: [{ name: 'suggestions', type: 'output', dataType: 'array' }],
    defaultData: { model: 'gpt-4', temperature: 0.7 },
    color: '#e91e63',
  },
  
  // Documentation Nodes
  {
    type: 'ComponentDocNode',
    name: 'Component Doc',
    category: 'docs',
    description: 'Auto-generate component docs',
    icon: <Description />,
    inputs: [{ name: 'component', type: 'input', dataType: 'any' }],
    outputs: [{ name: 'documentation', type: 'output', dataType: 'string' }],
    defaultData: { format: 'markdown', includeProps: true },
    color: '#795548',
  },
];

// Category icons and colors
const CATEGORY_CONFIG: Record<NodeCategory, { icon: React.ReactNode; color: string; name: string }> = {
  events: { icon: <TouchApp />, color: '#4caf50', name: 'Events' },
  logic: { icon: <Functions />, color: '#9c27b0', name: 'Logic' },
  data: { icon: <DataObject />, color: '#2196f3', name: 'Data Transform' },
  api: { icon: <Api />, color: '#ff9800', name: 'API' },
  database: { icon: <Storage />, color: '#00bcd4', name: 'Database' },
  env: { icon: <Settings />, color: '#607d8b', name: 'Environment' },
  docs: { icon: <Description />, color: '#795548', name: 'Documentation' },
  animation: { icon: <PlayArrow />, color: '#f44336', name: 'Animation' },
  validation: { icon: <Check />, color: '#8bc34a', name: 'Validation' },
  state: { icon: <DataObject />, color: '#3f51b5', name: 'State' },
  utility: { icon: <Settings />, color: '#9e9e9e', name: 'Utility' },
  theme: { icon: <Palette />, color: '#ff5722', name: 'Theme' },
  i18n: { icon: <Description />, color: '#009688', name: 'i18n' },
  ai: { icon: <Psychology />, color: '#e91e63', name: 'AI' },
  component: { icon: <Code />, color: '#673ab7', name: 'Component' },
};

interface ComponentWiringSystemProps {
  pageId: string;
  onSave?: (nodes: WiringNode[], connections: NodeConnection[]) => void;
  initialNodes?: WiringNode[];
  initialConnections?: NodeConnection[];
  readOnly?: boolean;
}

export function ComponentWiringSystem({
  pageId,
  onSave,
  initialNodes = [],
  initialConnections = [],
  readOnly = false,
}: ComponentWiringSystemProps) {
  // State
  const [nodes, setNodes] = useState<WiringNode[]>(initialNodes);
  const [connections, setConnections] = useState<NodeConnection[]>(initialConnections);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; portId: string } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<NodeCategory[]>(['events', 'logic']);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId?: string } | null>(null);
  const [history, setHistory] = useState<{ nodes: WiringNode[]; connections: NodeConnection[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [nodeSettingsDialog, setNodeSettingsDialog] = useState<WiringNode | null>(null);
  const [connectionDetailsDialog, setConnectionDetailsDialog] = useState<NodeConnection | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [clipboard, setClipboard] = useState<WiringNode[]>([]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const draggedNode = useRef<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Get nodes and connections from API
  const { nodes: apiNodes, isLoading: nodesLoading } = usePageNodes(pageId);
  const { connections: apiConnections, isLoading: connectionsLoading } = usePageConnections(pageId);

  const nodeCategories: NodeCategory[] = [
    'events',
    'logic',
    'data',
    'api',
    'database',
    'env',
    'docs',
    'animation',
    'validation',
    'state',
    'utility',
    'theme',
    'i18n',
    'ai',
    'component',
  ];

  const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
  };

  const toStringValue = (value: unknown, fallback = ''): string => {
    return typeof value === 'string' ? value : fallback;
  };

  const toBooleanValue = (value: unknown, fallback = false): boolean => {
    return typeof value === 'boolean' ? value : fallback;
  };

  const toNodeCategory = (value: unknown): NodeCategory => {
    return typeof value === 'string' && nodeCategories.includes(value as NodeCategory)
      ? (value as NodeCategory)
      : 'logic';
  };

  const toPosition = (value: unknown): { x: number; y: number } => {
    if (isRecord(value)) {
      const x = typeof value.x === 'number' ? value.x : 100;
      const y = typeof value.y === 'number' ? value.y : 100;
      return { x, y };
    }
    return { x: 100, y: 100 };
  };

  const toPorts = (value: unknown, portType: 'input' | 'output'): NodePort[] => {
    if (!Array.isArray(value)) return [];
    const parsedPorts: NodePort[] = [];
    value.forEach((port, index) => {
      if (!isRecord(port)) {
        return;
      }
        const dataType = toStringValue(port.dataType, 'any');
        const validDataType =
          dataType === 'any' ||
          dataType === 'string' ||
          dataType === 'number' ||
          dataType === 'boolean' ||
          dataType === 'object' ||
          dataType === 'array' ||
          dataType === 'event' ||
          dataType === 'function'
            ? dataType
            : 'any';
        parsedPorts.push({
          id: toStringValue(port.id, `${portType}-${index}`),
          name: toStringValue(port.name, `${portType}-${index}`),
          type: portType,
          dataType: validDataType,
          connected: toBooleanValue(port.connected, false),
          value: port.value,
        });
      });
    return parsedPorts;
  };

  const toConnectionType = (value: ApiWiringConnection['type']): NodeConnection['type'] => {
    if (value === 'event') return 'event';
    if (value === 'style') return 'style';
    return 'data';
  };

  // Initialize from API data
  useEffect(() => {
    if (apiNodes.length > 0 && nodes.length === 0) {
      // Transform API nodes to WiringNode format
      const transformedNodes: WiringNode[] = [];
      apiNodes.forEach((n, index) => {
          if (!isRecord(n)) {
            return;
          }
          const id = toStringValue(n.nodeId, toStringValue(n.id, `node-${index}`));
          const type = toStringValue(n.nodeType, toStringValue(n.type, 'CustomNode'));
          const data = isRecord(n.config) ? n.config : {};
          const width = typeof n.width === 'number' ? n.width : undefined;
          const height = typeof n.height === 'number' ? n.height : undefined;
          transformedNodes.push({
            id,
            type,
            category: toNodeCategory(n.category),
            position: toPosition(n.position),
            data,
            inputs: toPorts(n.inputs, 'input'),
            outputs: toPorts(n.outputs, 'output'),
            isSelected: false,
            isLocked: toBooleanValue(n.isLocked, false),
            width,
            height,
          });
        });
      setNodes(transformedNodes);
    }
  }, [apiNodes, nodes.length]);

  // Initialize connections from API
  useEffect(() => {
    if (apiConnections && apiConnections.length > 0 && connections.length === 0) {
      const transformedConnections: NodeConnection[] = apiConnections.map((c: ApiWiringConnection) => {
        const config = isRecord(c.config) ? c.config : {};
        const animated = typeof config.animated === 'boolean' ? config.animated : false;
        const label = typeof config.label === 'string' ? config.label : undefined;
        return {
          id: c.id,
          sourceNodeId: c.from.nodeId,
          sourcePortId: c.from.port || 'output-0',
          targetNodeId: c.to.nodeId,
          targetPortId: c.to.port || 'input-0',
          type: toConnectionType(c.type),
          animated,
          label,
        };
      });
      setConnections(transformedConnections);
    }
  }, [apiConnections, connections.length]);

  // Filter nodes by search
  const filteredLibrary = useMemo(() => {
    if (!searchQuery) return NODE_LIBRARY;
    const query = searchQuery.toLowerCase();
    return NODE_LIBRARY.filter(
      (node) =>
        node.name.toLowerCase().includes(query) ||
        node.type.toLowerCase().includes(query) ||
        node.description.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Group nodes by category
  const nodesByCategory = useMemo(() => {
    const grouped: Partial<Record<NodeCategory, NodeDefinition[]>> = {};
    filteredLibrary.forEach((node) => {
      const categoryNodes = grouped[node.category] ?? [];
      categoryNodes.push(node);
      grouped[node.category] = categoryNodes;
    });
    return grouped;
  }, [filteredLibrary]);

  // Add node to canvas
  const addNode = useCallback((definition: NodeDefinition, position?: { x: number; y: number }) => {
    const newNode: WiringNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: definition.type,
      category: definition.category,
      position: position || { x: 200 + Math.random() * 100, y: 200 + Math.random() * 100 },
      data: { ...definition.defaultData },
      inputs: definition.inputs.map((p, i) => ({ ...p, id: `input-${i}` })),
      outputs: definition.outputs.map((p, i) => ({ ...p, id: `output-${i}` })),
      isSelected: false,
      isLocked: false,
    };
    setNodes((prev) => [...prev, newNode]);
    setHasChanges(true);
    saveToHistory();
  }, []);

  // Delete selected nodes
  const deleteSelectedNodes = useCallback(() => {
    if (selectedNodes.length === 0) return;
    setNodes((prev) => prev.filter((n) => !selectedNodes.includes(n.id)));
    setConnections((prev) =>
      prev.filter(
        (c) => !selectedNodes.includes(c.sourceNodeId) && !selectedNodes.includes(c.targetNodeId)
      )
    );
    setSelectedNodes([]);
    setHasChanges(true);
    saveToHistory();
  }, [selectedNodes]);

  // Save to history for undo/redo
  const saveToHistory = useCallback(() => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({ nodes: [...nodes], connections: [...connections] });
      return newHistory.slice(-50); // Keep last 50 states
    });
    setHistoryIndex((prev) => prev + 1);
  }, [nodes, connections, historyIndex]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setNodes(prevState.nodes);
      setConnections(prevState.connections);
      setHistoryIndex((prev) => prev - 1);
    }
  }, [history, historyIndex]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setNodes(nextState.nodes);
      setConnections(nextState.connections);
      setHistoryIndex((prev) => prev + 1);
    }
  }, [history, historyIndex]);

  // Handle canvas mouse events
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setSelectedNodes([]);
      setSelectedConnection(null);
    }
  }, []);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;
      setMousePos({ x, y });
    }

    if (isDragging.current && draggedNode.current) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left - pan.x) / zoom - dragOffset.current.x;
        const y = (e.clientY - rect.top - pan.y) / zoom - dragOffset.current.y;
        setNodes((prev) =>
          prev.map((n) =>
            n.id === draggedNode.current ? { ...n, position: { x, y } } : n
          )
        );
      }
    }
  }, [pan, zoom]);

  const handleCanvasMouseUp = useCallback(() => {
    if (isDragging.current) {
      isDragging.current = false;
      draggedNode.current = null;
      setHasChanges(true);
    }
  }, []);

  // Handle node selection
  const handleNodeClick = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      setSelectedNodes((prev) =>
        prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]
      );
    } else {
      setSelectedNodes([nodeId]);
    }
  }, []);

  // Handle node drag start
  const handleNodeDragStart = useCallback((nodeId: string, e: React.MouseEvent) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node && !node.isLocked) {
      isDragging.current = true;
      draggedNode.current = nodeId;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left - pan.x) / zoom;
        const y = (e.clientY - rect.top - pan.y) / zoom;
        dragOffset.current = { x: x - node.position.x, y: y - node.position.y };
      }
    }
  }, [nodes, pan, zoom]);

  // Handle port click for connecting
  const handlePortClick = useCallback((nodeId: string, portId: string, isOutput: boolean) => {
    if (readOnly) return;

    if (!isConnecting) {
      if (isOutput) {
        setIsConnecting(true);
        setConnectingFrom({ nodeId, portId });
      }
    } else {
      if (!isOutput && connectingFrom) {
        // Create connection
        const newConnection: NodeConnection = {
          id: `conn-${Date.now()}`,
          sourceNodeId: connectingFrom.nodeId,
          sourcePortId: connectingFrom.portId,
          targetNodeId: nodeId,
          targetPortId: portId,
          type: 'data',
        };
        setConnections((prev) => [...prev, newConnection]);
        setHasChanges(true);
        saveToHistory();
      }
      setIsConnecting(false);
      setConnectingFrom(null);
    }
  }, [isConnecting, connectingFrom, readOnly, saveToHistory]);

  // Cancel connecting
  const cancelConnecting = useCallback(() => {
    setIsConnecting(false);
    setConnectingFrom(null);
  }, []);

  // Save changes
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave?.(nodes, connections);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  }, [nodes, connections, onSave]);

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.2, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.2, 0.3));
  const handleFitView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Run/Execute flow
  const handleRun = useCallback(() => {
    setIsRunning(true);
    // Simulate execution
    setTimeout(() => setIsRunning(false), 2000);
  }, []);

  // Handle right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, nodeId?: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
  }, []);

  // Close context menu
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Copy selected nodes
  const handleCopy = useCallback(() => {
    const nodesToCopy = nodes.filter((n) => selectedNodes.includes(n.id));
    setClipboard(nodesToCopy);
    handleCloseContextMenu();
  }, [nodes, selectedNodes]);

  // Paste copied nodes
  const handlePaste = useCallback(() => {
    if (clipboard.length === 0) return;
    const offset = { x: 50, y: 50 };
    const pastedNodes = clipboard.map((node) => ({
      ...node,
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      position: { x: node.position.x + offset.x, y: node.position.y + offset.y },
      isSelected: true,
    }));
    setNodes((prev) => [...prev.map((n) => ({ ...n, isSelected: false })), ...pastedNodes]);
    setSelectedNodes(pastedNodes.map((n) => n.id));
    setHasChanges(true);
    saveToHistory();
    handleCloseContextMenu();
  }, [clipboard, saveToHistory]);

  // Duplicate node
  const handleDuplicateNode = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const duplicated: WiringNode = {
      ...node,
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      position: { x: node.position.x + 30, y: node.position.y + 30 },
      isSelected: false,
    };
    setNodes((prev) => [...prev, duplicated]);
    setHasChanges(true);
    saveToHistory();
    handleCloseContextMenu();
  }, [nodes, saveToHistory]);

  // Lock/unlock node
  const handleToggleLock = useCallback((nodeId: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, isLocked: !n.isLocked } : n))
    );
    setHasChanges(true);
    handleCloseContextMenu();
  }, []);

  // Open node settings
  const handleOpenNodeSettings = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      setNodeSettingsDialog(node);
    }
    handleCloseContextMenu();
  }, [nodes]);

  // Handle connection click
  const handleConnectionClick = useCallback((connectionId: string) => {
    setSelectedConnection(connectionId);
    const conn = connections.find((c) => c.id === connectionId);
    if (conn) {
      setConnectionDetailsDialog(conn);
    }
  }, [connections]);

  // Delete connection
  const handleDeleteConnection = useCallback((connectionId: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== connectionId));
    setSelectedConnection(null);
    setConnectionDetailsDialog(null);
    setHasChanges(true);
    saveToHistory();
  }, [saveToHistory]);

  // Update node data from settings dialog
  const handleUpdateNodeData = useCallback((nodeId: string, newData: Record<string, unknown>) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n))
    );
    setHasChanges(true);
  }, []);

  // Delete single node from context menu
  const handleDeleteSingleNode = useCallback((nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setConnections((prev) =>
      prev.filter((c) => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId)
    );
    setSelectedNodes((prev) => prev.filter((id) => id !== nodeId));
    setHasChanges(true);
    saveToHistory();
    handleCloseContextMenu();
  }, [saveToHistory]);

  // Render a single node
  const renderNode = (node: WiringNode) => {
    const definition = NODE_LIBRARY.find((d) => d.type === node.type);
    const categoryConfig = CATEGORY_CONFIG[node.category];
    const isSelected = selectedNodes.includes(node.id);
    const nodeConnections = connections.filter(
      (c) => c.sourceNodeId === node.id || c.targetNodeId === node.id
    );

    return (
      <Paper
        key={node.id}
        elevation={isSelected ? 8 : 2}
        onClick={(e) => handleNodeClick(node.id, e)}
        onMouseDown={(e) => handleNodeDragStart(node.id, e)}
        onContextMenu={(e) => {
          e.stopPropagation();
          handleContextMenu(e, node.id);
        }}
        sx={{
          position: 'absolute',
          left: node.position.x * zoom + pan.x,
          top: node.position.y * zoom + pan.y,
          minWidth: 180,
          bgcolor: 'rgba(30,30,40,0.95)',
          border: isSelected ? `2px solid ${categoryConfig.color}` : '1px solid rgba(255,255,255,0.1)',
          borderRadius: 2,
          cursor: node.isLocked ? 'not-allowed' : 'grab',
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
          transition: 'box-shadow 0.2s',
          '&:hover': {
            boxShadow: `0 0 20px ${categoryConfig.color}40`,
          },
        }}
      >
        {/* Node Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1,
            bgcolor: categoryConfig.color,
            borderRadius: '8px 8px 0 0',
          }}
        >
          <DragIndicator sx={{ fontSize: 16, opacity: 0.7 }} />
          {definition?.icon || categoryConfig.icon}
          <Typography variant="caption" fontWeight="bold" color="white" sx={{ flex: 1 }}>
            {definition?.name || node.type}
          </Typography>
          {node.isLocked && <Lock fontSize="small" sx={{ color: 'rgba(255,255,255,0.7)' }} />}
          <Tooltip title="More options">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleContextMenu(e as unknown as React.MouseEvent, node.id);
              }}
              sx={{ p: 0.25, color: 'rgba(255,255,255,0.7)' }}
            >
              <MoreVert sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Debug info */}
        {debugMode && (
          <Box sx={{ px: 1, py: 0.5, bgcolor: 'rgba(156,39,176,0.1)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <Typography variant="caption" color="#9c27b0" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>
              {node.id.slice(0, 20)}...
            </Typography>
            <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ display: 'block', fontSize: '0.6rem' }}>
              Connections: {nodeConnections.length}
            </Typography>
          </Box>
        )}

        {/* Input Ports */}
        <Box sx={{ p: 1 }}>
          {node.inputs.map((port) => {
            const isPortConnected = connections.some(
              (c) => c.targetNodeId === node.id && c.targetPortId === port.id
            );
            return (
              <Box
                key={port.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePortClick(node.id, port.id, false);
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: 0.5,
                  cursor: 'pointer',
                  '&:hover .port-dot': { transform: 'scale(1.3)' },
                }}
              >
                <Box
                  className="port-dot"
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: isPortConnected ? categoryConfig.color : 'rgba(255,255,255,0.3)',
                    border: '2px solid',
                    borderColor: categoryConfig.color,
                    ml: -2,
                    transition: 'transform 0.2s, background-color 0.2s',
                    '&:hover': { bgcolor: categoryConfig.color },
                  }}
                />
                <Typography variant="caption" color="rgba(255,255,255,0.7)">
                  {port.name}
                </Typography>
                {debugMode && (
                  <Typography variant="caption" color="rgba(255,255,255,0.3)" sx={{ fontSize: '0.6rem' }}>
                    ({port.dataType})
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>

        {/* Output Ports */}
        <Box sx={{ p: 1 }}>
          {node.outputs.map((port) => {
            const isPortConnected = connections.some(
              (c) => c.sourceNodeId === node.id && c.sourcePortId === port.id
            );
            return (
              <Box
                key={port.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePortClick(node.id, port.id, true);
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 1,
                  mb: 0.5,
                  cursor: 'pointer',
                  '&:hover .port-dot': { transform: 'scale(1.3)' },
                }}
              >
                {debugMode && (
                  <Typography variant="caption" color="rgba(255,255,255,0.3)" sx={{ fontSize: '0.6rem' }}>
                    ({port.dataType})
                  </Typography>
                )}
                <Typography variant="caption" color="rgba(255,255,255,0.7)">
                  {port.name}
                </Typography>
                <Box
                  className="port-dot"
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: isPortConnected ? categoryConfig.color : 'rgba(255,255,255,0.3)',
                    border: '2px solid',
                    borderColor: categoryConfig.color,
                    mr: -2,
                    transition: 'transform 0.2s, background-color 0.2s',
                    '&:hover': { bgcolor: categoryConfig.color },
                  }}
                />
              </Box>
            );
          })}
        </Box>
      </Paper>
    );
  };

  // Render connections as SVG paths
  const renderConnections = () => (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#ff6b00" />
        </marker>
      </defs>
      {connections.map((conn) => {
        const sourceNode = nodes.find((n) => n.id === conn.sourceNodeId);
        const targetNode = nodes.find((n) => n.id === conn.targetNodeId);
        if (!sourceNode || !targetNode) return null;

        const sx = (sourceNode.position.x + 180) * zoom + pan.x;
        const sy = (sourceNode.position.y + 40) * zoom + pan.y;
        const tx = targetNode.position.x * zoom + pan.x;
        const ty = (targetNode.position.y + 40) * zoom + pan.y;
        const cx = (sx + tx) / 2;
        const isSelected = selectedConnection === conn.id;

        return (
          <g key={conn.id}>
            {/* Invisible wider path for easier clicking */}
            <path
              d={`M ${sx} ${sy} C ${cx} ${sy}, ${cx} ${ty}, ${tx} ${ty}`}
              stroke="transparent"
              strokeWidth={20}
              fill="none"
              style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
              onClick={() => handleConnectionClick(conn.id)}
            />
            {/* Visible path */}
            <path
              d={`M ${sx} ${sy} C ${cx} ${sy}, ${cx} ${ty}, ${tx} ${ty}`}
              stroke={isSelected ? '#2196f3' : '#ff6b00'}
              strokeWidth={isSelected ? 3 : 2}
              fill="none"
              markerEnd="url(#arrowhead)"
              style={{
                strokeDasharray: conn.animated ? '5,5' : 'none',
                animation: conn.animated ? 'dash 0.5s linear infinite' : 'none',
                pointerEvents: 'none',
              }}
            />
            {/* Debug label */}
            {debugMode && (
              <text
                x={(sx + tx) / 2}
                y={(sy + ty) / 2 - 10}
                fill="rgba(255,255,255,0.5)"
                fontSize="10"
                textAnchor="middle"
              >
                {conn.type}
              </text>
            )}
          </g>
        );
      })}
      {/* Connecting line preview */}
      {isConnecting && connectingFrom && (
        <path
          d={`M ${(nodes.find((n) => n.id === connectingFrom.nodeId)?.position.x || 0) * zoom + pan.x + 180} ${
            (nodes.find((n) => n.id === connectingFrom.nodeId)?.position.y || 0) * zoom + pan.y + 40
          } L ${mousePos.x * zoom + pan.x} ${mousePos.y * zoom + pan.y}`}
          stroke="#ff6b00"
          strokeWidth={2}
          strokeDasharray="5,5"
          fill="none"
        />
      )}
    </svg>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#0f0f1a' }}>
      {/* Node Library Drawer */}
      <Drawer
        variant="persistent"
        open={drawerOpen}
        sx={{
          width: 280,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 280,
            bgcolor: 'rgba(20,20,30,0.98)',
            borderRight: '1px solid rgba(255,255,255,0.1)',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" color="white" gutterBottom>
            Node Library
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: 'rgba(255,255,255,0.5)' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255,255,255,0.05)',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
              },
              '& input': { color: 'white' },
            }}
          />

          <List dense>
            {Object.entries(nodesByCategory).map(([category, categoryNodes]) => (
              <React.Fragment key={category}>
                <ListItemButton
                  onClick={() =>
                    setExpandedCategories((prev) =>
                      prev.includes(category as NodeCategory)
                        ? prev.filter((c) => c !== category)
                        : [...prev, category as NodeCategory]
                    )
                  }
                >
                  <ListItemIcon sx={{ color: CATEGORY_CONFIG[category as NodeCategory].color }}>
                    {CATEGORY_CONFIG[category as NodeCategory].icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={CATEGORY_CONFIG[category as NodeCategory].name}
                    primaryTypographyProps={{ color: 'white', fontWeight: 'bold' }}
                  />
                  <Chip size="small" label={categoryNodes.length} sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
                  {expandedCategories.includes(category as NodeCategory) ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
                <Collapse in={expandedCategories.includes(category as NodeCategory)}>
                  <List component="div" disablePadding>
                    {categoryNodes.map((nodeDef) => (
                      <ListItemButton
                        key={nodeDef.type}
                        sx={{ pl: 4 }}
                        onClick={() => addNode(nodeDef)}
                        disabled={readOnly}
                      >
                        <ListItemIcon sx={{ color: nodeDef.color, minWidth: 36 }}>
                          {nodeDef.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={nodeDef.name}
                          secondary={nodeDef.description}
                          primaryTypographyProps={{ color: 'white', fontSize: '0.875rem' }}
                          secondaryTypographyProps={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              </React.Fragment>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* Main Canvas Area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <Paper
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1,
            bgcolor: 'rgba(20,20,30,0.98)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <IconButton onClick={() => setDrawerOpen(!drawerOpen)} sx={{ color: 'white' }}>
            <Add />
          </IconButton>
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          
          <Tooltip title="Undo">
            <span>
              <IconButton onClick={undo} disabled={historyIndex <= 0} sx={{ color: 'white' }}>
                <Undo />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo">
            <span>
              <IconButton onClick={redo} disabled={historyIndex >= history.length - 1} sx={{ color: 'white' }}>
                <Redo />
              </IconButton>
            </span>
          </Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          
          <Tooltip title="Zoom In">
            <IconButton onClick={handleZoomIn} sx={{ color: 'white' }}>
              <ZoomIn />
            </IconButton>
          </Tooltip>
          <Typography color="white" sx={{ minWidth: 50, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </Typography>
          <Tooltip title="Zoom Out">
            <IconButton onClick={handleZoomOut} sx={{ color: 'white' }}>
              <ZoomOut />
            </IconButton>
          </Tooltip>
          <Tooltip title="Fit View">
            <IconButton onClick={handleFitView} sx={{ color: 'white' }}>
              <FitScreen />
            </IconButton>
          </Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          
          <Tooltip title="Toggle Grid">
            <IconButton onClick={() => setShowGrid(!showGrid)} sx={{ color: showGrid ? '#ff6b00' : 'white' }}>
              {showGrid ? <GridOn /> : <GridOff />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Debug Mode">
            <IconButton onClick={() => setDebugMode(!debugMode)} sx={{ color: debugMode ? '#9c27b0' : 'white' }}>
              <BugReport />
            </IconButton>
          </Tooltip>
          <Tooltip title="Toggle Minimap">
            <IconButton onClick={() => setShowMinimap(!showMinimap)} sx={{ color: showMinimap ? '#ff6b00' : 'white' }}>
              {showMinimap ? <Visibility /> : <VisibilityOff />}
            </IconButton>
          </Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          
          <Tooltip title="Delete Selected">
            <span>
              <IconButton
                onClick={deleteSelectedNodes}
                disabled={selectedNodes.length === 0 || readOnly}
                sx={{ color: 'white' }}
              >
                <Delete />
              </IconButton>
            </span>
          </Tooltip>
          
          <Box sx={{ flex: 1 }} />
          
          <Tooltip title={isRunning ? 'Stop' : 'Run Flow'}>
            <IconButton
              onClick={isRunning ? () => setIsRunning(false) : handleRun}
              sx={{ color: isRunning ? '#f44336' : '#4caf50' }}
            >
              {isRunning ? <Stop /> : <PlayArrow />}
            </IconButton>
          </Tooltip>
          
          <Badge color="warning" variant="dot" invisible={!hasChanges}>
            <Button
              variant="contained"
              startIcon={isSaving ? <CircularProgress size={16} /> : <Save />}
              onClick={handleSave}
              disabled={!hasChanges || isSaving || readOnly}
              sx={{
                bgcolor: '#ff6b00',
                '&:hover': { bgcolor: '#e55a00' },
                '&:disabled': { bgcolor: 'rgba(255,107,0,0.3)' },
              }}
            >
              Save
            </Button>
          </Badge>
        </Paper>

        {/* Canvas */}
        <Box
          ref={canvasRef}
          onClick={cancelConnecting}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onContextMenu={(e) => handleContextMenu(e)}
          sx={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            bgcolor: '#0a0a12',
            backgroundImage: showGrid
              ? `
                linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
              `
              : 'none',
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
            cursor: isConnecting ? 'crosshair' : 'default',
          }}
        >
          {/* Loading state */}
          {(nodesLoading || connectionsLoading) && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            >
              <CircularProgress sx={{ color: '#ff6b00' }} />
            </Box>
          )}

          {/* Render connections */}
          {renderConnections()}

          {/* Render nodes */}
          {nodes.map(renderNode)}

          {/* Empty state */}
          {nodes.length === 0 && !nodesLoading && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
              }}
            >
              <Typography variant="h5" color="rgba(255,255,255,0.3)" gutterBottom>
                No nodes yet
              </Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.2)" sx={{ mb: 2 }}>
                Drag nodes from the library or click to add
              </Typography>
              <Button
                variant="outlined"
                startIcon={<Add />}
                onClick={() => addNode(NODE_LIBRARY[0])}
                sx={{
                  borderColor: 'rgba(255,107,0,0.5)',
                  color: '#ff6b00',
                  '&:hover': { borderColor: '#ff6b00' },
                }}
              >
                Add First Node
              </Button>
            </Box>
          )}
        </Box>

        {/* Status Bar */}
        <Paper
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 1,
            bgcolor: 'rgba(20,20,30,0.98)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Typography variant="caption" color="rgba(255,255,255,0.5)">
            Nodes: {nodes.length}
          </Typography>
          <Typography variant="caption" color="rgba(255,255,255,0.5)">
            Connections: {connections.length}
          </Typography>
          <Typography variant="caption" color="rgba(255,255,255,0.5)">
            Selected: {selectedNodes.length}
          </Typography>
          {clipboard.length > 0 && (
            <Chip
              size="small"
              icon={<ContentCopy sx={{ fontSize: 12 }} />}
              label={`${clipboard.length} copied`}
              sx={{ bgcolor: 'rgba(33,150,243,0.2)', color: '#2196f3' }}
            />
          )}
          <Box sx={{ flex: 1 }} />
          {debugMode && (
            <Chip
              size="small"
              icon={<BugReport sx={{ fontSize: 12 }} />}
              label="Debug Mode"
              sx={{ bgcolor: 'rgba(156,39,176,0.2)', color: '#9c27b0' }}
            />
          )}
          {isConnecting && (
            <Chip
              size="small"
              label="Connecting... Click target port or press Escape"
              sx={{ bgcolor: 'rgba(255,107,0,0.2)', color: '#ff6b00' }}
            />
          )}
          {isRunning && (
            <Chip
              size="small"
              icon={<CircularProgress size={12} sx={{ color: '#4caf50' }} />}
              label="Running..."
              sx={{ bgcolor: 'rgba(76,175,80,0.2)', color: '#4caf50' }}
            />
          )}
        </Paper>
      </Box>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.y, left: contextMenu.x } : undefined}
        sx={{
          '& .MuiPaper-root': {
            bgcolor: 'rgba(30,30,40,0.98)',
            border: '1px solid rgba(255,255,255,0.1)',
          },
        }}
      >
        {contextMenu?.nodeId ? (
          <>
            <MenuItem onClick={() => handleOpenNodeSettings(contextMenu.nodeId!)}>
              <ListItemIcon><Settings sx={{ color: 'white' }} /></ListItemIcon>
              <ListItemText primary="Settings" primaryTypographyProps={{ color: 'white' }} />
            </MenuItem>
            <MenuItem onClick={() => handleDuplicateNode(contextMenu.nodeId!)}>
              <ListItemIcon><ContentCopy sx={{ color: 'white' }} /></ListItemIcon>
              <ListItemText primary="Duplicate" primaryTypographyProps={{ color: 'white' }} />
            </MenuItem>
            <MenuItem onClick={() => handleToggleLock(contextMenu.nodeId!)}>
              <ListItemIcon>
                {nodes.find((n) => n.id === contextMenu.nodeId)?.isLocked ? (
                  <LockOpen sx={{ color: 'white' }} />
                ) : (
                  <Lock sx={{ color: 'white' }} />
                )}
              </ListItemIcon>
              <ListItemText
                primary={nodes.find((n) => n.id === contextMenu.nodeId)?.isLocked ? 'Unlock' : 'Lock'}
                primaryTypographyProps={{ color: 'white' }}
              />
            </MenuItem>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            <MenuItem onClick={() => handleDeleteSingleNode(contextMenu.nodeId!)} sx={{ color: '#f44336' }}>
              <ListItemIcon><Delete sx={{ color: '#f44336' }} /></ListItemIcon>
              <ListItemText primary="Delete" primaryTypographyProps={{ color: '#f44336' }} />
            </MenuItem>
          </>
        ) : (
          <>
            <MenuItem onClick={handleCopy} disabled={selectedNodes.length === 0}>
              <ListItemIcon><ContentCopy sx={{ color: 'white' }} /></ListItemIcon>
              <ListItemText primary="Copy" primaryTypographyProps={{ color: 'white' }} />
            </MenuItem>
            <MenuItem onClick={handlePaste} disabled={clipboard.length === 0}>
              <ListItemIcon><ContentPaste sx={{ color: 'white' }} /></ListItemIcon>
              <ListItemText primary="Paste" primaryTypographyProps={{ color: 'white' }} />
            </MenuItem>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            <MenuItem onClick={() => { setDebugMode(!debugMode); handleCloseContextMenu(); }}>
              <ListItemIcon><BugReport sx={{ color: debugMode ? '#9c27b0' : 'white' }} /></ListItemIcon>
              <ListItemText primary={debugMode ? 'Disable Debug' : 'Enable Debug'} primaryTypographyProps={{ color: 'white' }} />
            </MenuItem>
            <MenuItem onClick={() => { setShowMinimap(!showMinimap); handleCloseContextMenu(); }}>
              <ListItemIcon>{showMinimap ? <VisibilityOff sx={{ color: 'white' }} /> : <Visibility sx={{ color: 'white' }} />}</ListItemIcon>
              <ListItemText primary={showMinimap ? 'Hide Minimap' : 'Show Minimap'} primaryTypographyProps={{ color: 'white' }} />
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Node Settings Dialog */}
      <Dialog
        open={nodeSettingsDialog !== null}
        onClose={() => setNodeSettingsDialog(null)}
        maxWidth="sm"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            bgcolor: 'rgba(30,30,40,0.98)',
            border: '1px solid rgba(255,255,255,0.1)',
          },
        }}
      >
        <DialogTitle sx={{ color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Edit sx={{ color: '#ff6b00' }} />
          Node Settings: {nodeSettingsDialog?.type}
          <Box sx={{ flex: 1 }} />
          <IconButton onClick={() => setNodeSettingsDialog(null)} sx={{ color: 'rgba(255,255,255,0.7)' }}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {nodeSettingsDialog && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="info" sx={{ bgcolor: 'rgba(33,150,243,0.1)' }}>
                Node ID: {nodeSettingsDialog.id}
              </Alert>
              <TextField
                fullWidth
                label="Position X"
                type="number"
                value={nodeSettingsDialog.position.x}
                onChange={(e) =>
                  setNodeSettingsDialog({
                    ...nodeSettingsDialog,
                    position: { ...nodeSettingsDialog.position, x: parseFloat(e.target.value) || 0 },
                  })
                }
                sx={{
                  '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)' },
                  '& input': { color: 'white' },
                  '& label': { color: 'rgba(255,255,255,0.7)' },
                }}
              />
              <TextField
                fullWidth
                label="Position Y"
                type="number"
                value={nodeSettingsDialog.position.y}
                onChange={(e) =>
                  setNodeSettingsDialog({
                    ...nodeSettingsDialog,
                    position: { ...nodeSettingsDialog.position, y: parseFloat(e.target.value) || 0 },
                  })
                }
                sx={{
                  '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)' },
                  '& input': { color: 'white' },
                  '& label': { color: 'rgba(255,255,255,0.7)' },
                }}
              />
              <Typography variant="subtitle2" color="white">Node Data (JSON)</Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                value={JSON.stringify(nodeSettingsDialog.data, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setNodeSettingsDialog({ ...nodeSettingsDialog, data: parsed });
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', fontFamily: 'monospace' },
                  '& textarea': { color: 'white' },
                }}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setNodeSettingsDialog(null)} sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<Check />}
            onClick={() => {
              if (nodeSettingsDialog) {
                handleUpdateNodeData(nodeSettingsDialog.id, nodeSettingsDialog.data);
                setNodes((prev) =>
                  prev.map((n) =>
                    n.id === nodeSettingsDialog.id ? { ...n, position: nodeSettingsDialog.position } : n
                  )
                );
              }
              setNodeSettingsDialog(null);
            }}
            sx={{ bgcolor: '#ff6b00', '&:hover': { bgcolor: '#e55a00' } }}
          >
            Apply
          </Button>
        </DialogActions>
      </Dialog>

      {/* Connection Details Dialog */}
      <Dialog
        open={connectionDetailsDialog !== null}
        onClose={() => setConnectionDetailsDialog(null)}
        maxWidth="xs"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            bgcolor: 'rgba(30,30,40,0.98)',
            border: '1px solid rgba(255,255,255,0.1)',
          },
        }}
      >
        <DialogTitle sx={{ color: 'white' }}>Connection Details</DialogTitle>
        <DialogContent>
          {connectionDetailsDialog && (
            <List>
              <ListItem>
                <ListItemText
                  primary="Source"
                  secondary={`${nodes.find((n) => n.id === connectionDetailsDialog.sourceNodeId)?.type || 'Unknown'} → ${connectionDetailsDialog.sourcePortId}`}
                  primaryTypographyProps={{ color: 'rgba(255,255,255,0.7)', variant: 'caption' }}
                  secondaryTypographyProps={{ color: 'white' }}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Target"
                  secondary={`${nodes.find((n) => n.id === connectionDetailsDialog.targetNodeId)?.type || 'Unknown'} → ${connectionDetailsDialog.targetPortId}`}
                  primaryTypographyProps={{ color: 'rgba(255,255,255,0.7)', variant: 'caption' }}
                  secondaryTypographyProps={{ color: 'white' }}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Type"
                  secondary={connectionDetailsDialog.type}
                  primaryTypographyProps={{ color: 'rgba(255,255,255,0.7)', variant: 'caption' }}
                  secondaryTypographyProps={{ color: 'white' }}
                />
              </ListItem>
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConnectionDetailsDialog(null)} sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Close
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<Delete />}
            onClick={() => connectionDetailsDialog && handleDeleteConnection(connectionDetailsDialog.id)}
          >
            Delete Connection
          </Button>
        </DialogActions>
      </Dialog>

      {/* Minimap */}
      {showMinimap && nodes.length > 0 && (
        <Paper
          sx={{
            position: 'absolute',
            bottom: 60,
            right: 16,
            width: 200,
            height: 150,
            bgcolor: 'rgba(20,20,30,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 1,
            overflow: 'hidden',
            p: 1,
          }}
        >
          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mb: 0.5, display: 'block' }}>
            Minimap
          </Typography>
          <Box sx={{ position: 'relative', width: '100%', height: 'calc(100% - 20px)', bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 0.5 }}>
            {nodes.map((node) => {
              const scale = 0.05;
              return (
                <Box
                  key={node.id}
                  sx={{
                    position: 'absolute',
                    left: node.position.x * scale,
                    top: node.position.y * scale,
                    width: 8,
                    height: 6,
                    bgcolor: CATEGORY_CONFIG[node.category].color,
                    borderRadius: 0.5,
                    opacity: selectedNodes.includes(node.id) ? 1 : 0.6,
                  }}
                />
              );
            })}
          </Box>
        </Paper>
      )}

      {/* Floating Action Button for adding nodes */}
      <Fab
        color="primary"
        onClick={() => setDrawerOpen(!drawerOpen)}
        sx={{
          position: 'absolute',
          bottom: 80,
          left: drawerOpen ? 296 : 16,
          bgcolor: '#ff6b00',
          '&:hover': { bgcolor: '#e55a00' },
          transition: 'left 0.3s',
        }}
      >
        <Add />
      </Fab>
    </Box>
  );
}

export default ComponentWiringSystem;
