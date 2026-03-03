import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add,
  Delete,
  Download,
  Edit,
  Settings,
  Visibility,
} from '@mui/icons-material';

export type DiagramNodeType =
  | 'rectangle'
  | 'circle'
  | 'diamond'
  | 'ellipse'
  | 'hexagon'
  | 'triangle';

export interface DiagramNode {
  id: string;
  type: DiagramNodeType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  fontSize: number;
  fontColor: string;
  shape: string;
  data?: Record<string, unknown>;
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  type: 'solid' | 'dashed' | 'dotted' | 'thick';
  color: string;
  width: number;
  arrowType: 'none' | 'arrow' | 'circle' | 'diamond';
  curve?: number;
}

interface DiagramProps {
  initialNodes?: DiagramNode[];
  initialEdges?: DiagramEdge[];
  diagramType?: 'flowchart' | 'mindmap' | 'sequence' | 'gantt' | 'network' | 'custom';
  theme?: 'light' | 'dark' | 'creatorhub';
  interactive?: boolean;
  onNodeClick?: (node: DiagramNode) => void;
  onEdgeClick?: (edge: DiagramEdge) => void;
  onDiagramChange?: (nodes: DiagramNode[], edges: DiagramEdge[]) => void;
  className?: string;
}

interface DragInfo {
  nodeId: string;
  offsetX: number;
  offsetY: number;
}

const SVG_WIDTH = 1100;
const SVG_HEIGHT = 560;

const DEFAULT_NODES: DiagramNode[] = [
  {
    id: 'node-1',
    type: 'rectangle',
    label: 'Start',
    x: 120,
    y: 120,
    width: 140,
    height: 70,
    color: '#111827',
    backgroundColor: '#f59e0b',
    borderColor: '#b45309',
    borderWidth: 2,
    fontSize: 14,
    fontColor: '#111827',
    shape: 'rectangle',
  },
  {
    id: 'node-2',
    type: 'rectangle',
    label: 'Decision',
    x: 380,
    y: 120,
    width: 160,
    height: 70,
    color: '#111827',
    backgroundColor: '#93c5fd',
    borderColor: '#1d4ed8',
    borderWidth: 2,
    fontSize: 14,
    fontColor: '#111827',
    shape: 'rectangle',
  },
];

const DEFAULT_EDGES: DiagramEdge[] = [
  {
    id: 'edge-1',
    from: 'node-1',
    to: 'node-2',
    type: 'solid',
    color: '#9ca3af',
    width: 2,
    arrowType: 'arrow',
    curve: 0,
    label: 'flow',
  },
];

const getNodeCenter = (node: DiagramNode): { x: number; y: number } => ({
  x: node.x + node.width / 2,
  y: node.y + node.height / 2,
});

const getPolygonPoints = (node: DiagramNode): string => {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;

  if (node.type === 'diamond') {
    return `${cx},${node.y} ${node.x + node.width},${cy} ${cx},${node.y + node.height} ${node.x},${cy}`;
  }

  if (node.type === 'triangle') {
    return `${cx},${node.y} ${node.x + node.width},${node.y + node.height} ${node.x},${node.y + node.height}`;
  }

  const sides = 6;
  const points: string[] = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = (Math.PI * 2 * i) / sides;
    const px = cx + (node.width / 2) * Math.cos(angle);
    const py = cy + (node.height / 2) * Math.sin(angle);
    points.push(`${px},${py}`);
  }
  return points.join(' ');
};

const renderNodeShape = (
  node: DiagramNode,
  isSelected: boolean,
  onMouseDown: (event: React.MouseEvent<SVGElement>, nodeId: string) => void,
): React.ReactElement => {
  const commonProps = {
    fill: node.backgroundColor,
    stroke: isSelected ? '#f97316' : node.borderColor,
    strokeWidth: isSelected ? node.borderWidth + 1 : node.borderWidth,
    onMouseDown: (event: React.MouseEvent<SVGElement>) => onMouseDown(event, node.id),
    style: { cursor: 'move' as const },
  };

  switch (node.type) {
    case 'circle':
      return (
        <ellipse
          cx={node.x + node.width / 2}
          cy={node.y + node.height / 2}
          rx={node.width / 2}
          ry={node.height / 2}
          {...commonProps}
        />
      );
    case 'ellipse':
      return (
        <ellipse
          cx={node.x + node.width / 2}
          cy={node.y + node.height / 2}
          rx={node.width / 2}
          ry={node.height / 2}
          {...commonProps}
        />
      );
    case 'diamond':
    case 'triangle':
    case 'hexagon':
      return <polygon points={getPolygonPoints(node)} {...commonProps} />;
    case 'rectangle':
    default:
      return <rect x={node.x} y={node.y} width={node.width} height={node.height} rx={8} {...commonProps} />;
  }
};

const InteractiveDiagram: React.FC<DiagramProps> = ({
  initialNodes = [],
  initialEdges = [],
  diagramType = 'flowchart',
  interactive = true,
  onNodeClick,
  onEdgeClick,
  onDiagramChange,
  className,
}) => {
  const [nodes, setNodes] = useState<DiagramNode[]>(
    initialNodes.length > 0 ? initialNodes : DEFAULT_NODES,
  );
  const [edges, setEdges] = useState<DiagramEdge[]>(
    initialEdges.length > 0 ? initialEdges : DEFAULT_EDGES,
  );
  const [activeTab, setActiveTab] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20);
  const [zoom, setZoom] = useState(1);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId],
  );

  useEffect(() => {
    onDiagramChange?.(nodes, edges);
  }, [nodes, edges, onDiagramChange]);

  const updateNode = (nodeId: string, patch: Partial<DiagramNode>): void => {
    setNodes((prev) =>
      prev.map((node) => (node.id === nodeId ? { ...node, ...patch, shape: patch.type ?? node.type } : node)),
    );
  };

  const addNode = (): void => {
    const id = `node-${Date.now()}`;
    const newNode: DiagramNode = {
      id,
      type: 'rectangle',
      label: `Node ${nodes.length + 1}`,
      x: 120 + nodes.length * 40,
      y: 280,
      width: 140,
      height: 70,
      color: '#111827',
      backgroundColor: '#fde68a',
      borderColor: '#ca8a04',
      borderWidth: 2,
      fontSize: 14,
      fontColor: '#111827',
      shape: 'rectangle',
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(id);
    setActiveTab(1);
  };

  const addEdge = (): void => {
    if (nodes.length < 2) {
      setSnackbarMessage('Need at least two nodes to create an edge.');
      return;
    }

    const sourceNodeId = selectedNodeId ?? nodes[0].id;
    const targetNodeId = nodes.find((node) => node.id !== sourceNodeId)?.id ?? nodes[1].id;

    const newEdge: DiagramEdge = {
      id: `edge-${Date.now()}`,
      from: sourceNodeId,
      to: targetNodeId,
      label: 'link',
      type: 'solid',
      color: '#9ca3af',
      width: 2,
      arrowType: 'arrow',
      curve: 0,
    };

    setEdges((prev) => [...prev, newEdge]);
    setSelectedEdgeId(newEdge.id);
    setActiveTab(1);
  };

  const removeSelection = (): void => {
    if (selectedNodeId) {
      setNodes((prev) => prev.filter((node) => node.id !== selectedNodeId));
      setEdges((prev) =>
        prev.filter((edge) => edge.from !== selectedNodeId && edge.to !== selectedNodeId),
      );
      setSelectedNodeId(null);
      return;
    }

    if (selectedEdgeId) {
      setEdges((prev) => prev.filter((edge) => edge.id !== selectedEdgeId));
      setSelectedEdgeId(null);
    }
  };

  const onNodeMouseDown = (event: React.MouseEvent<SVGElement>, nodeId: string): void => {
    if (!interactive) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) {
      return;
    }

    const svgRect = (event.currentTarget.ownerSVGElement ?? event.currentTarget).getBoundingClientRect();
    setDragInfo({
      nodeId,
      offsetX: event.clientX - svgRect.left - node.x,
      offsetY: event.clientY - svgRect.top - node.y,
    });
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    onNodeClick?.(node);
  };

  const onSvgMouseMove = (event: React.MouseEvent<SVGSVGElement>): void => {
    if (!dragInfo || !interactive) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    let x = event.clientX - rect.left - dragInfo.offsetX;
    let y = event.clientY - rect.top - dragInfo.offsetY;

    if (snapToGrid) {
      x = Math.round(x / gridSize) * gridSize;
      y = Math.round(y / gridSize) * gridSize;
    }

    updateNode(dragInfo.nodeId, {
      x: Math.max(0, Math.min(SVG_WIDTH - 100, x)),
      y: Math.max(0, Math.min(SVG_HEIGHT - 60, y)),
    });
  };

  const onSvgMouseUp = (): void => {
    setDragInfo(null);
  };

  const onCanvasClick = (): void => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };

  const exportDiagram = (): void => {
    const payload = JSON.stringify({ nodes, edges, diagramType }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `diagram-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box className={className}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" mb={1.5}>
          <Stack direction="row" spacing={1}>
            <Button startIcon={<Add />} variant="contained" onClick={addNode}>
              Add Node
            </Button>
            <Button startIcon={<Edit />} variant="outlined" onClick={addEdge}>
              Add Edge
            </Button>
            <Button startIcon={<Delete />} color="error" variant="outlined" onClick={removeSelection}>
              Delete Selected
            </Button>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button startIcon={<Download />} variant="outlined" onClick={exportDiagram}>
              Export
            </Button>
            <Button startIcon={<Settings />} variant="outlined" onClick={() => setShowSettings(true)}>
              Settings
            </Button>
          </Stack>
        </Stack>

        <Tabs value={activeTab} onChange={(_event, value: number) => setActiveTab(value)}>
          <Tab label="Canvas" />
          <Tab label="Inspector" />
          <Tab label="Structure" />
        </Tabs>

        {activeTab === 0 && (
          <Paper variant="outlined" sx={{ mt: 1.5, overflow: 'auto' }}>
            <svg
              width={SVG_WIDTH * zoom}
              height={SVG_HEIGHT * zoom}
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              onMouseMove={onSvgMouseMove}
              onMouseUp={onSvgMouseUp}
              onMouseLeave={onSvgMouseUp}
              onClick={onCanvasClick}
              style={{ display: 'block', background: '#0b1220' }}
              aria-label="interactive diagram canvas"
            >
              {showGrid &&
                Array.from({ length: Math.floor(SVG_WIDTH / gridSize) + 1 }).map((_, index) => (
                  <line
                    key={`vx-${index}`}
                    x1={index * gridSize}
                    y1={0}
                    x2={index * gridSize}
                    y2={SVG_HEIGHT}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={1}
                  />
                ))}
              {showGrid &&
                Array.from({ length: Math.floor(SVG_HEIGHT / gridSize) + 1 }).map((_, index) => (
                  <line
                    key={`hy-${index}`}
                    x1={0}
                    y1={index * gridSize}
                    x2={SVG_WIDTH}
                    y2={index * gridSize}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={1}
                  />
                ))}

              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#9ca3af" />
                </marker>
              </defs>

              {edges.map((edge) => {
                const from = nodes.find((node) => node.id === edge.from);
                const to = nodes.find((node) => node.id === edge.to);
                if (!from || !to) {
                  return null;
                }

                const start = getNodeCenter(from);
                const end = getNodeCenter(to);
                const isSelected = selectedEdgeId === edge.id;
                const dashArray =
                  edge.type === 'dashed' ? '8 6' : edge.type === 'dotted' ? '3 4' : undefined;

                return (
                  <g key={edge.id} onClick={(event) => {
                    event.stopPropagation();
                    setSelectedEdgeId(edge.id);
                    setSelectedNodeId(null);
                    onEdgeClick?.(edge);
                  }}>
                    <line
                      x1={start.x}
                      y1={start.y}
                      x2={end.x}
                      y2={end.y}
                      stroke={isSelected ? '#f97316' : edge.color}
                      strokeWidth={isSelected ? edge.width + 1 : edge.width}
                      strokeDasharray={dashArray}
                      markerEnd={edge.arrowType === 'arrow' ? 'url(#arrow)' : undefined}
                      style={{ cursor: 'pointer' }}
                    />
                    {edge.label ? (
                      <text
                        x={(start.x + end.x) / 2}
                        y={(start.y + end.y) / 2 - 8}
                        fill="#cbd5e1"
                        fontSize={12}
                        textAnchor="middle"
                      >
                        {edge.label}
                      </text>
                    ) : null}
                  </g>
                );
              })}

              {nodes.map((node) => {
                const isSelected = selectedNodeId === node.id;
                return (
                  <g key={node.id} onClick={(event) => {
                    event.stopPropagation();
                    setSelectedNodeId(node.id);
                    setSelectedEdgeId(null);
                    onNodeClick?.(node);
                  }}>
                    {renderNodeShape(node, isSelected, onNodeMouseDown)}
                    <text
                      x={node.x + node.width / 2}
                      y={node.y + node.height / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={node.fontColor}
                      fontSize={node.fontSize}
                      style={{ userSelect: 'none' }}
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </Paper>
        )}

        {activeTab === 1 && (
          <Paper variant="outlined" sx={{ mt: 1.5, p: 2 }}>
            {selectedNode ? (
              <Stack spacing={2}>
                <Typography variant="h6">Node Inspector</Typography>
                <TextField
                  label="Label"
                  value={selectedNode.label}
                  onChange={(event) =>
                    updateNode(selectedNode.id, { label: event.target.value })
                  }
                  fullWidth
                />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel id="node-type-label">Type</InputLabel>
                      <Select
                        labelId="node-type-label"
                        label="Type"
                        value={selectedNode.type}
                        onChange={(event) =>
                          updateNode(selectedNode.id, {
                            type: event.target.value as DiagramNodeType,
                          })
                        }
                      >
                        {['rectangle', 'circle', 'diamond', 'ellipse', 'hexagon', 'triangle'].map((type) => (
                          <MenuItem key={type} value={type}>
                            {type}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Background"
                      type="color"
                      value={selectedNode.backgroundColor}
                      onChange={(event) =>
                        updateNode(selectedNode.id, { backgroundColor: event.target.value })
                      }
                      fullWidth
                    />
                  </Grid>
                </Grid>
                <Typography variant="body2">Width {selectedNode.width}px</Typography>
                <Slider
                  value={selectedNode.width}
                  min={80}
                  max={280}
                  onChange={(_event, value) =>
                    updateNode(selectedNode.id, {
                      width: Array.isArray(value) ? value[0] ?? selectedNode.width : value,
                    })
                  }
                />
                <Typography variant="body2">Height {selectedNode.height}px</Typography>
                <Slider
                  value={selectedNode.height}
                  min={50}
                  max={220}
                  onChange={(_event, value) =>
                    updateNode(selectedNode.id, {
                      height: Array.isArray(value) ? value[0] ?? selectedNode.height : value,
                    })
                  }
                />
              </Stack>
            ) : selectedEdge ? (
              <Stack spacing={2}>
                <Typography variant="h6">Edge Inspector</Typography>
                <TextField
                  label="Label"
                  value={selectedEdge.label ?? ''}
                  onChange={(event) =>
                    setEdges((prev) =>
                      prev.map((edge) =>
                        edge.id === selectedEdge.id ? { ...edge, label: event.target.value } : edge,
                      ),
                    )
                  }
                />
                <FormControl fullWidth>
                  <InputLabel id="edge-style-label">Line style</InputLabel>
                  <Select
                    labelId="edge-style-label"
                    label="Line style"
                    value={selectedEdge.type}
                    onChange={(event) =>
                      setEdges((prev) =>
                        prev.map((edge) =>
                          edge.id === selectedEdge.id
                            ? {
                                ...edge,
                                type: event.target.value as DiagramEdge['type'],
                              }
                            : edge,
                        ),
                      )
                    }
                  >
                    <MenuItem value="solid">solid</MenuItem>
                    <MenuItem value="dashed">dashed</MenuItem>
                    <MenuItem value="dotted">dotted</MenuItem>
                    <MenuItem value="thick">thick</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            ) : (
              <Alert severity="info">Select a node or edge to inspect and edit.</Alert>
            )}
          </Paper>
        )}

        {activeTab === 2 && (
          <Paper variant="outlined" sx={{ mt: 1.5, p: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  Nodes ({nodes.length})
                </Typography>
                <Stack spacing={1}>
                  {nodes.map((node) => (
                    <Card key={node.id} variant="outlined">
                      <CardContent sx={{ py: 1.25 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip label={node.type} size="small" />
                            <Typography variant="body2">{node.label}</Typography>
                          </Stack>
                          <IconButton size="small" onClick={() => setSelectedNodeId(node.id)}>
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  Edges ({edges.length})
                </Typography>
                <Stack spacing={1}>
                  {edges.map((edge) => (
                    <Card key={edge.id} variant="outlined">
                      <CardContent sx={{ py: 1.25 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Typography variant="body2">
                            {edge.from} → {edge.to}
                          </Typography>
                          <Chip size="small" label={edge.type} />
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </Grid>
            </Grid>
          </Paper>
        )}
      </Paper>

      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Diagram Settings</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2">Zoom ({zoom.toFixed(2)}x)</Typography>
            <Slider
              value={zoom}
              min={0.6}
              max={1.8}
              step={0.05}
              onChange={(_event, value) =>
                setZoom(Array.isArray(value) ? value[0] ?? zoom : value)
              }
            />
            <Typography variant="body2">Grid Size ({gridSize}px)</Typography>
            <Slider
              value={gridSize}
              min={10}
              max={60}
              step={2}
              onChange={(_event, value) =>
                setGridSize(Array.isArray(value) ? value[0] ?? gridSize : value)
              }
            />
            <Divider />
            <FormControlLabel
              control={<Switch checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />}
              label="Show Grid"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={snapToGrid}
                  onChange={(event) => setSnapToGrid(event.target.checked)}
                />
              }
              label="Snap To Grid"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={2500}
        onClose={() => setSnackbarMessage(null)}
        message={snackbarMessage ?? ''}
      />
    </Box>
  );
};

export default InteractiveDiagram;
