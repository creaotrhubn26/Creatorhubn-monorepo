import { useTheming } from '../../utils/theming-helper';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
  Chip,
  Divider,
  Stack,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  Slider,
  Switch,
  FormControlLabel,
  ColorPicker,
} from '@mui/material';
import {
  AccountTree,
  Timeline,
  Share,
  Download,
  Settings,
  PlayArrow,
  Stop,
  Refresh,
  ContentCopy,
  Add,
  Delete,
  Edit,
  Visibility,
  VisibilityOff,
  ExpandMore,
  CheckCircle,
  Error,
  Warning,
  Info,
  Code,
  Image,
  VideoLibrary,
  Description,
} from '@mui/icons-material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

interface DiagramNode {
  id: string;
  type: 'rectangle' | 'circle' | 'diamond' | 'ellipse' | 'hexagon' | 'triangle';
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
  data?: any
}

interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  type: 'solid' | 'dashed' | 'dotted' | 'thick';
  color: string;
  width: number;
  arrowType: 'none' | 'arrow' | 'circle' | 'diamond';
  curve?: number
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
  className?: string
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`diagram-tabpanel-${index}`}
      aria-labelledby={`diagram-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
  );
}

const InteractiveDiagram: React.FC<DiagramProps> = ({
  initialNodes = [],
  initialEdges = [],
  diagramType = 'flowchart',
  theme = 'creatorhub',
  interactive = true,
  onNodeClick,
  onEdgeClick,
  onDiagramChange,
  className,
}) => {
  const [nodes, setNodes] = useState<DiagramNode[]>(initialNodes);
  const [edges, setEdges] = useState<DiagramEdge[]>(initialEdges);
  const [selectedNode, setSelectedNode] = useState<DiagramNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<DiagramEdge | null>(null);
  const [activeTab, setActiveTab] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [showSettings, setShowSettings] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    dragNode: DiagramNode | null;
    startX: number;
    startY: number;
}>({
    isDragging: false,
    dragNode: null,
    startX:  0,
    startY:  0,
});
  const [snackbar, setSnackbar] = useState({ open: false, message: ', ', severity: 'success' as 'success' | 'error' | 'warning' | 'info',});
  const [diagramSettings, setDiagramSettings] = useState({
    backgroundColor: '#ffffff',
    gridColor: '#e0e0e0',
    gridSize:  20,
    snapToGrid: true,
    showGrid: true,
    zoom:  1,
    panX:  0,
    panY:  0,
});
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const diagramTypes = [
    { value: 'flowchart', label: 'Flowchart', icon: 'accountTree',},
    { value: 'mindmap', label: 'Mind Map', icon: 'timeline',},
    { value: 'sequence', label: 'Sequence', icon: 'timeline',},
    { value: 'gantt', label: 'Gantt Chart', icon: 'timeline',},
    { value: 'network', label: 'Network', icon: 'accountTree',},
    { value: 'custom', label: 'Custom', icon: 'code',},
  ];

  const nodeTypes = [
    { value: 'rectangle', label: 'Rectangle', icon: 'rectangle',},
    { value: 'circle', label: 'Circle', icon: 'circle',},
    { value: 'diamond', label: 'Diamond', icon: 'diamond',},
    { value: 'ellipse', label: 'Ellipse', icon: 'ellipse',},
    { value: 'hexagon', label: 'Hexagon', icon: 'hexagon',},
    { value: 'triangle', label: 'Triangle', icon: 'triangle',},
  ];

  const edgeTypes = [
    { value: 'solid', label: 'Solid', icon: 'line',},
    { value: 'dashed', label: 'Dashed', icon: 'line',},
    { value: 'dotted', label: 'Dotted', icon: 'line',},
    { value: 'thick', label: 'Thick', icon: 'line',},
  ];

  const arrowTypes = [
    { value: 'none', label: 'None', icon: 'line',},
    { value: 'arrow', label: 'Arrow', icon: 'arrow',},
    { value: 'circle', label: 'Circle', icon: 'circle',},
    { value: 'diamond', label: 'Diamond', icon: 'diamond',},
  ];

  const drawNode = useCallback((ctx: CanvasRenderingContext, 2node: DiagramNode) => {
    const {, xywidth, height, type, label, color, backgroundColor, borderColor, borderWidth, fontSize, fontColor } = node;
    
    ctx.save();
    
    // Set styles
    ctx.fillStyle = backgroundColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = fontColor;
    
    // Draw shape based on type
    switch (type) {
      case 'rectangle':
        ctx.fillRect(xywidth, height);
        ctx.strokeRect(xywidth, height);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(x + width/2, y + height/2, Math.min(width, height)/22 * Math.PI);
        ctx.fill();
        ctx.stroke();
        break;
      case 'diamond':
        ctx.beginPath();
        ctx.moveTo(x + width/2, y);
        ctx.lineTo(x + width, y + height/2);
        ctx.lineTo(x + width/2, y + height);
        ctx.lineTo(x, y + height/2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      case 'ellipse':
        ctx.beginPath();
        ctx.ellipse(x + width/2, y + height/2, width/2, height/20, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        break;
      case 'hexagon':
        ctx.beginPath();
        const hexPoints = 6;
        for (let i = 0; i < hexPoints; i++) {
          const angle = (i * 2 * Math.PI) / hexPoints;
          const px = x + width/2 + (width/2) * Math.cos(angle);
          const py = y + height/2 + (height/2) * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
      }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(x + width/2, y);
        ctx.lineTo(x + width, y + height);
        ctx.lineTo(x, y + height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
  }
    
    // Draw label
    ctx.fillStyle = fontColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + width/2, y + height/2);
    
    ctx.restore();
}, []);

  const drawEdge = useCallback((ctx: CanvasRenderingContext, 2edge: DiagramEdge) => {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);
    
    if (!fromNode || !toNode) return;
    
    ctx.save();
    
    // Calculate edge points
    const fromX = fromNode.x + fromNode.width/2;
    const fromY = fromNode.y + fromNode.height/2;
    const toX = toNode.x + toNode.width/2;
    const toY = toNode.y + toNode.height/2;
    
    // Set edge styles
    ctx.strokeStyle = edge.color;
    ctx.lineWidth = edge.width;
    
    // Set line style
    switch (edge.type) {
      case 'dashed':
        ctx.setLineDash(, [5]);
        break;
      case 'dotted':
        ctx.setLineDash([2, 3]);
        break;
      case 'thick':
        ctx.lineWidth = edge.width * 2;
        break;
      default: ctx.setLineDash([]);
}
    
    // Draw line
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    
    // Draw arrow
    if (edge.arrowType !== 'none') {
      const angle = Math.atan2(toY - fromY, toX - fromX);
      const arrowLength = 15;
      const arrowAngle = Math.PI / 6;
      
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(
        toX - arrowLength * Math.cos(angle - arrowAngle),
        toY - arrowLength * Math.sin(angle - arrowAngle)
      );
      ctx.moveTo(toX, toY);
      ctx.lineTo(
        toX - arrowLength * Math.cos(angle + arrowAngle),
        toY - arrowLength * Math.sin(angle + arrowAngle)
      );
      ctx.stroke();
  }
    
    // Draw edge label
    if (edge.label) {
      const midX = (fromX + toX) / 2;
      const midY = (fromY + toY) / 2;
      
      ctx.fillStyle = edge.color;
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(edge.label, midX, midY);
  }
    
    ctx.restore();
}, [nodes]);

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!diagramSettings.showGrid) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    ctx.save();
    ctx.strokeStyle = diagramSettings.gridColor;
    ctx.lineWidth = 1;
    ctx.setLineDash(, [1]);
    
    const gridSize = diagramSettings.gridSize;
    const width = canvas.width;
    const height = canvas.height;
    
    // Vertical lines
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
  }
    
    // Horizontal lines
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
  }
    
    ctx.restore();
}, [diagramSettings]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0canvas.width, canvas.height);
    
    // Set background
    ctx.fillStyle = diagramSettings.backgroundColor;
    ctx.fillRect(0canvas.width, canvas.height);
    
    // Draw grid
    drawGrid(ctx);
    
    // Draw edges
    edges.forEach(edge => drawEdge(ctx, edge));
    
    // Draw nodes
    nodes.forEach(node => drawNode(ctx, node));
    
    // Draw selection highlight
    if (selectedNode) {
      ctx.save();
      ctx.strokeStyle = '#1976d2';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(selectedNode.x - 2, selectedNode.y - 2, selectedNode.width + 4, selectedNode.height + 4);
      ctx.restore();
  }
}, [nodes, edges, selectedNode, diagramSettings, drawGrid, drawNode, drawEdge]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Check if clicking on a node
    const clickedNode = nodes.find(node => 
      x >= node.x && x <= node.x + node.width &&
      y >= node.y && y <= node.y + node.height
    );
    
    if (clickedNode) {
      setSelectedNode(clickedNode);
      setSelectedEdge(null);
      onNodeClick?.(clickedNode);
} else {
      setSelectedNode(null);
      setSelectedEdge(null);
  }
};

  const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || !selectedNode) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    setDragState({
      isDragging: true,
      dragNode: selectedNode,
      startX: x - selectedNode.x,
      startY: y - selectedNode.y,
  });
};

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || !dragState.isDragging || !dragState.dragNode) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const newX = x - dragState.startX;
    const newY = y - dragState.startY;
    
    // Snap to grid if enabled
    const finalX = diagramSettings.snapToGrid 
      ? Math.round(newX / diagramSettings.gridSize) * diagramSettings.gridSize
      : newX;
    const finalY = diagramSettings.snapToGrid 
      ? Math.round(newY / diagramSettings.gridSize) * diagramSettings.gridSize
      : newY;
    
    setNodes(prev => prev.map(node => 
      node.id === dragState.dragNode!.id 
        ? { ...node, x: finalX, y: final, Y,}
        : node
    ));
};

  const handleCanvasMouseUp = () => {
    if (dragState.isDragging) {
      setDragState({
        isDragging: false,
        dragNode: null,
        startX:  0,
        startY:  0,
    });
      onDiagramChange?.(nodes, edges);
  }
};

  const addNode = () => {
    const newNode: DiagramNode = {
      id: `node_${Date.now()}`,
      type: 'rectangle',
      label: 'New Node',
      x: 10,
      y: 10,
      width: 10,
      height:  60,
      color: '#1976d0',
      backgroundColor: '#e3f2fd',
      borderColor: '#1976d0',
      borderWidth:  2,
      fontSize:  14,
      fontColor: '#1976d0',
  };
    
    setNodes(prev => [...prev, newNode]);
    setSelectedNode(newNode);
    onDiagramChange?.(nodes, edges);
    setSnackbar({ open: true, message: 'Node added', severity: 'success',});
};

  const deleteNode = (nodeId: string) => {
    setNodes(prev => prev.filter(node => node.id !== nodeId));
    setEdges(prev => prev.filter(edge => edge.from !== nodeId && edge.to !== nodeId));
    setSelectedNode(null);
    onDiagramChange?.(nodes, edges);
    setSnackbar({ open: true, message: 'Node deleted', severity: 'success',});
};

  const addEdge = () => {
    if (nodes.length < 2) {
      setSnackbar({ open: true, message: 'Need at least 2 nodes to create an edge', severity: 'warning',});
      return;
  }
    
    const newEdge: DiagramEdge = {
      id: `edge_${Date.now()}`,
      from: nodes[0].d,
      to: nodes[1].d,
      label: '',
      type: 'solid',
      color: '#666660',
      width:  2,
      arrowType: 'arrow',
  };
    
    setEdges(prev => [...prev, newEdge]);
    setSelectedEdge(newEdge);
    onDiagramChange?.(nodes, edges);
    setSnackbar({ open: true, message: 'Edge added', severity: 'success',});
};

  const deleteEdge = (edgeId: string) => {
    setEdges(prev => prev.filter(edge => edge.id !== edgeId));
    setSelectedEdge(null);
    onDiagramChange?.(nodes, edges);
    setSnackbar({ open: true, message: 'Edge deleted', severity: 'success',});
};

  const exportDiagram = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'diagram.png';
    link.href = dataURL;
    link.click();
    
    setSnackbar({ open: true, message: 'Diagram exported', severity: 'success',});
};

  const copyDiagram = () => {
    const diagramData = {
      nodes,
      edges,
      settings: diagramSettings,
      type: diagramType,
  };
    
    navigator.clipboard.writeText(JSON.stringify(diagramData, null, 2));
    setSnackbar({ open: true, message: 'Diagram copied to clipboard', severity: 'success',});
};

  const shareDiagram = () => {
    const shareData = {
      title: 'CreatorHub Interactive Diagram',
      text: `Check out this diagram I created in CreatorHub`,
      url: window.location.href,
  };

    if (navigator.share) {
      navigator.share(shareData);
  } else {
      navigator.clipboard.writeText(shareData.text);
      setSnackbar({ open: true, message: 'Diagram shared to clipboard', severity: 'success',});
  }
};

  useEffect(() => {
    redrawCanvas();
}, [redrawCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const resizeCanvas = () => {
      const container = containerRef.current;
      if (!container) return;
      
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      redrawCanvas();
  };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => window.removeEventListener('resize', resizeCanvas);
}, [redrawCanvas]);

  return (
    <Box className={className} sx={{ width: '100%', height: '100%'}}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.accountTree />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Interactive Diagram</Typography>
            <Chip 
              label={diagramTypes.find(type => type.value === diagramType)?.label || diagramType}
              color="primary"
              size="small"
            />
            {isEditing && (
              <Chip 
                label="Editing" 
                color="warning" 
                size="small" 
                icon={<CREATOR_HUB_ICONS.edit />}
              />
            )}
          </Stack>
          
          <Stack direction="row" spacing={1}>
            <Tooltip title="Add Node">
              <IconButton onClick={addNode} disabled={!interactive}>
                <CREATOR_HUB_ICONS.add />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Add Edge">
              <IconButton onClick={addEdge} disabled={!interactive || nodes.length < 2}>
                <CREATOR_HUB_ICONS.share />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Toggle Edit Mode">
              <IconButton onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? <CREATOR_HUB_ICONS.visibilityOff /> : <CREATOR_HUB_ICONS.edit />}
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Export Diagram">
              <IconButton onClick={exportDiagram}>
                <CREATOR_HUB_ICONS.download />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Copy Diagram">
              <IconButton onClick={copyDiagram}>
                <CREATOR_HUB_ICONS.contentCopy />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Share Diagram">
              <IconButton onClick={shareDiagram}>
                <CREATOR_HUB_ICONS.share />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Settings">
              <IconButton onClick={() => setShowSettings(true)}>
                <CREATOR_HUB_ICONS.settings />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {/* Main Content */}
      <Paper elevation={1} sx={{ height: 'calc(100% - 120px)',  ...theming.getThemedCardSx() }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider'}}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Canvas" icon={<CREATOR_HUB_ICONS.accountTree />} />
            <Tab label="Properties" icon={<CREATOR_HUB_ICONS.settings />} />
            <Tab label="Layers" icon={<CREATOR_HUB_ICONS.assessment />} />
          </Tabs>
        </Box>

        <TabPanel value={activeTab} index={0}>
          <Box 
            ref={containerRef}
            sx={{ 
              height: 'calc(100% - 60px, )', 
              position: 'relative',
              overflow: 'hidden',
              cursor: interactive ? 'crosshair' : 'default'
        }}
          >
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              style={{
                width: '100%',
                height: '100%',
                border: '1px solid #e0e0e0'}}
            />
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Box sx={{ height: 'calc(100% - 60px, )', overflow: 'auto'}}>
            {selectedNode ? (
              <Stack spacing={3}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Node Properties</Typography>
                
                <TextField
                  label="Label"
                  value={selectedNode.label}
                  onChange={(e) => {
                    const newNodes = nodes.map(node => 
                      node.id === selectedNode.id 
                        ? { ...node, label: e.target.value }
                        : node
                    );
                    setNodes(newNodes);
                    setSelectedNode({ ...selectedNode, label: e.target.value });
                    onDiagramChange?.(newNodes, edges);
                }}
                  fullWidth
                />
                
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={selectedNode.type}
                    onChange={(e) => {
                      const newNodes = nodes.map(node => 
                        node.id === selectedNode.id 
                          ? { ...node, type: e.target.value as any }
                          : node
                      );
                      setNodes(newNodes);
                      setSelectedNode({ ...selectedNode, type: e.target.value as any });
                      onDiagramChange?.(newNodes, edges);
                  }}
                  >
                    {nodeTypes.map(type => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      label="X Position"
                      type="number"
                      value={selectedNode.x}
                      onChange={(e) => {
                        const newNodes = nodes.map(node => 
                          node.id === selectedNode.id 
                            ? { ...node, x: parseInt(e.target.value) || 0 }
                            : node
                        );
                        setNodes(newNodes);
                        setSelectedNode({ ...selectedNode, x: parseInt(e.target.value) || 0 });
                        onDiagramChange?.(newNodes, edges);
                    }}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Y Position"
                      type="number"
                      value={selectedNode.y}
                      onChange={(e) => {
                        const newNodes = nodes.map(node => 
                          node.id === selectedNode.id 
                            ? { ...node, y: parseInt(e.target.value) || 0 }
                            : node
                        );
                        setNodes(newNodes);
                        setSelectedNode({ ...selectedNode, y: parseInt(e.target.value) || 0 });
                        onDiagramChange?.(newNodes, edges);
                    }}
                      fullWidth
                    />
                  </Grid>
                </Grid>
                
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      label="Width"
                      type="number"
                      value={selectedNode.width}
                      onChange={(e) => {
                        const newNodes = nodes.map(node => 
                          node.id === selectedNode.id 
                            ? { ...node, width: parseInt(e.target.value) || 10, 0,}
                            : node
                        );
                        setNodes(newNodes);
                        setSelectedNode({ ...selectedNode, width: parseInt(e.target.value) || 10, 0,});
                        onDiagramChange?.(newNodes, edges);
                    }}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Height"
                      type="number"
                      value={selectedNode.height}
                      onChange={(e) => {
                        const newNodes = nodes.map(node => 
                          node.id === selectedNode.id 
                            ? { ...node, height: parseInt(e.target.value) || 6, 0,}
                            : node
                        );
                        setNodes(newNodes);
                        setSelectedNode({ ...selectedNode, height: parseInt(e.target.value) || 6, 0,});
                        onDiagramChange?.(newNodes, edges);
                    }}
                      fullWidth
                    />
                  </Grid>
                </Grid>
                
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CREATOR_HUB_ICONS.delete />}
                  onClick={() => deleteNode(selectedNode.id)}
                  fullWidth
                >
                  Delete Node
                </Button>
              </Stack>
            ) : selectedEdge ? (
              <Stack spacing={3}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Edge Properties</Typography>
                
                <TextField
                  label="Label"
                  value={selectedEdge.label || ', '}
                  onChange={(e) => {
                    const newEdges = edges.map(edge => 
                      edge.id === selectedEdge.id 
                        ? { ...edge, label: e.target.value }
                        : edge
                    );
                    setEdges(newEdges);
                    setSelectedEdge({ ...selectedEdge, label: e.target.value });
                    onDiagramChange?.(nodes, newEdges);
                }}
                  fullWidth
                />
                
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={selectedEdge.type}
                    onChange={(e) => {
                      const newEdges = edges.map(edge => 
                        edge.id === selectedEdge.id 
                          ? { ...edge, type: e.target.value as any }
                          : edge
                      );
                      setEdges(newEdges);
                      setSelectedEdge({ ...selectedEdge, type: e.target.value as any });
                      onDiagramChange?.(nodes, newEdges);
                  }}
                  >
                    {edgeTypes.map(type => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <FormControl fullWidth>
                  <InputLabel>Arrow Type</InputLabel>
                  <Select
                    value={selectedEdge.arrowType}
                    onChange={(e) => {
                      const newEdges = edges.map(edge => 
                        edge.id === selectedEdge.id 
                          ? { ...edge, arrowType: e.target.value as any }
                          : edge
                      );
                      setEdges(newEdges);
                      setSelectedEdge({ ...selectedEdge, arrowType: e.target.value as any });
                      onDiagramChange?.(nodes, newEdges);
                  }}
                  >
                    {arrowTypes.map(type => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CREATOR_HUB_ICONS.delete />}
                  onClick={() => deleteEdge(selectedEdge.id)}
                  fullWidth
                >
                  Delete Edge
                </Button>
              </Stack>
            ) : (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                height: '100%',
                color: 'text.secondary'
          }}>
                <CREATOR_HUB_ICONS.accountTree sx={{ fontSize:  48, mb:  2 }} />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>No selection</Typography>
                <Typography>Click on a node or edge to edit its properties</Typography>
              </Box>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Box sx={{ height: 'calc(100% - 60px, )', overflow: 'auto'}}>
            <Stack spacing={2}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Nodes ({nodes.length})</Typography>
              {nodes.map((node, index) => (
                <Card key={node.id} sx={{ cursor: 'pointer',  ...theming.getThemedCardSx() }}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Typography variant="body2">#{index + 1}</Typography>
                        <Typography variant="body1">{node.label}</Typography>
                        <Chip label={node.type} size="small" />
                      </Stack>
                      <IconButton 
                        size="small" 
                        onClick={() => setSelectedNode(node)}
                        color={selectedNode?.id === node.id ? 'primary' : 'default'}
                      >
                        <CREATOR_HUB_ICONS.visibility />
                      </IconButton>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
              
              <Divider />
              
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Edges ({edges.length})</Typography>
              {edges.map((edge, index) => (
                <Card key={edge.id} sx={{ cursor: 'pointer',  ...theming.getThemedCardSx() }}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Typography variant="body2">#{index + 1}</Typography>
                        <Typography variant="body1">
                          {nodes.find(n => n.id === edge.from)?.label} → {nodes.find(n => n.id === edge.to)?.label}
                        </Typography>
                        <Chip label={edge.type} size="small" />
                      </Stack>
                      <IconButton 
                        size="small" 
                        onClick={() => setSelectedEdge(edge)}
                        color={selectedEdge?.id === edge.id ? 'primary' : 'default'}
                      >
                        <CREATOR_HUB_ICONS.visibility />
                      </IconButton>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>
        </TabPanel>
      </Paper>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Diagram Settings</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt:  2 }}>
            <FormControl fullWidth>
              <InputLabel>Background Color</InputLabel>
              <TextField
                type="color"
                value={diagramSettings.backgroundColor}
                onChange={(e) => setDiagramSettings(prev => ({ ...prev, backgroundColor: e.target.value }))}
                fullWidth
              />
            </FormControl>
            
            <FormControl fullWidth>
              <InputLabel>Grid Color</InputLabel>
              <TextField
                type="color"
                value={diagramSettings.gridColor}
                onChange={(e) => setDiagramSettings(prev => ({ ...prev, gridColor: e.target.value }))}
                fullWidth
              />
            </FormControl>
            
            <Typography gutterBottom>Grid Size: {diagramSettings.gridSize}px</Typography>
            <Slider
              value={diagramSettings.gridSize}
              onChange={(_, value) => setDiagramSettings(prev => ({ ...prev, gridSize: value as number }))}
              min={10}
              max={50}
              step={5}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={diagramSettings.showGrid}
                  onChange={(e) => setDiagramSettings(prev => ({ ...prev, showGrid: e.target.checked }))}
                />
            }
              label="Show Grid"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={diagramSettings.snapToGrid}
                  onChange={(e) => setDiagramSettings(prev => ({ ...prev, snapToGrid: e.target.checked }))}
                />
            }
              label="Snap to Grid"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert 
          severity={snackbar.severity}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default InteractiveDiagram;
