/**
 * NarrativeCanvas — reactflow 11-lerret for ett brett.
 *
 * Elementer → noder (kind = nodetype), koblinger → kanter (sourceHandle =
 * connection.sourceOutputKey). Dra → batch-flytting via storen (debounced).
 * Koble → POST connection. Delete → sletter valgte elementer/koblinger.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
  type OnConnect,
  type OnEdgesDelete,
  type OnNodesDelete,
  type Viewport,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Box } from '@mui/material';
import { NARRATIVE_NODE_TYPES, type NarrativeNodeData } from './nodes';
import { canConnect } from '../state/graphOps';
import { htmlToText, type NarrativeConnection, type NarrativeElement, type NarrativeGraph } from '../narrativeTypes';
import { narrativeColors } from '../narrativeTheme';

export interface NarrativeCanvasProps {
  graph: NarrativeGraph;
  boardId: string;
  elements: NarrativeElement[];
  connections: NarrativeConnection[];
  selectedElementId: string | null;
  onSelectElement: (elementId: string | null) => void;
  onOpenElement: (elementId: string) => void;
  onMoveElements: (moves: Array<{ id: string; x: number; y: number }>) => void;
  onConnect: (input: { sourceId: string; targetId: string; sourceOutputKey: string }) => void;
  onDeleteElements: (elementIds: string[]) => void;
  onDeleteConnections: (connectionIds: string[]) => void;
  onSelectConnection: (connectionId: string | null) => void;
  onViewportChange?: (viewport: Viewport) => void;
  initialViewport?: Viewport | null;
  /** Kalles med en funksjon som gir midtpunktet i lerretet (for «nytt element»). */
  registerCenterResolver?: (resolver: () => { x: number; y: number }) => void;
}

function toNodes(
  graph: NarrativeGraph, elements: NarrativeElement[], selectedElementId: string | null,
): Node<NarrativeNodeData>[] {
  const titleById = new Map(graph.elements.map((e) => [e.id, htmlToText(e.titleHtml) || 'Uten tittel']));
  const componentName = new Map(graph.components.map((c) => [c.id, c.name]));
  const componentsByElement = new Map<string, string[]>();
  for (const ec of graph.elementComponents) {
    const list = componentsByElement.get(ec.elementId) ?? [];
    const name = componentName.get(ec.componentId);
    if (name) list.push(name);
    componentsByElement.set(ec.elementId, list);
  }
  return elements.map((element) => ({
    id: element.id,
    type: element.kind,
    position: { x: element.x, y: element.y },
    selected: element.id === selectedElementId,
    data: {
      element,
      isStart: graph.settings.startingElementId === element.id,
      jumperTargetTitle: element.jumperTargetId ? titleById.get(element.jumperTargetId) ?? null : null,
      componentNames: componentsByElement.get(element.id) ?? [],
    },
    draggable: true,
  }));
}

function toEdges(connections: NarrativeConnection[]): Edge[] {
  return connections.map((c) => {
    const label = htmlToText(c.labelHtml);
    return {
      id: c.id,
      source: c.sourceId,
      target: c.targetId,
      sourceHandle: c.sourceOutputKey || 'default',
      label: label || undefined,
      type: 'smoothstep',
      style: { stroke: narrativeColors.accent, strokeWidth: 2 },
      labelStyle: { fill: narrativeColors.text, fontSize: 11, fontWeight: 600 },
      labelBgStyle: { fill: narrativeColors.bgPanel },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 4,
      markerEnd: 'url(#narrative-arrow)',
    };
  });
}

function CanvasInner(props: NarrativeCanvasProps) {
  const {
    graph, boardId, elements, connections, selectedElementId,
    onSelectElement, onOpenElement, onMoveElements, onConnect, onDeleteElements, onDeleteConnections,
    onSelectConnection, onViewportChange, initialViewport, registerCenterResolver,
  } = props;

  const flow = useReactFlow();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [nodes, setNodes] = useState<Node<NarrativeNodeData>[]>(() => toNodes(graph, elements, selectedElementId));
  const dragging = useRef(false);

  // Synk fra graf → noder, men ikke midt i et drag (ellers hopper noden tilbake).
  useEffect(() => {
    if (dragging.current) return;
    setNodes(toNodes(graph, elements, selectedElementId));
  }, [graph, elements, selectedElementId]);

  const edges = useMemo(() => toEdges(connections), [connections]);

  useEffect(() => {
    registerCenterResolver?.(() => {
      const el = containerRef.current;
      const rect = el?.getBoundingClientRect();
      const center = rect
        ? flow.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
        : { x: 0, y: 0 };
      return { x: Math.round(center.x - 130), y: Math.round(center.y - 60) };
    });
  }, [flow, registerCenterResolver]);

  useEffect(() => {
    if (initialViewport) flow.setViewport(initialViewport, { duration: 0 });
    else flow.fitView({ padding: 0.2, duration: 0 });
    // Kun ved bytte av brett.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds) as Node<NarrativeNodeData>[]);
    for (const ch of changes) {
      if (ch.type === 'select') {
        if (ch.selected) onSelectElement(ch.id);
      }
    }
  }, [onSelectElement]);

  const onNodeDragStart = useCallback(() => { dragging.current = true; }, []);
  const onNodeDragStop = useCallback((_e: React.MouseEvent, _node: Node, draggedNodes: Node[]) => {
    dragging.current = false;
    const moved = (draggedNodes.length ? draggedNodes : [_node]).map((n) => ({
      id: n.id, x: Math.round(n.position.x), y: Math.round(n.position.y),
    }));
    onMoveElements(moved);
  }, [onMoveElements]);

  const elementById = useMemo(() => new Map(elements.map((e) => [e.id, e])), [elements]);

  const isValidConnection = useCallback((c: Connection) =>
    canConnect(elementById.get(c.source ?? ''), elementById.get(c.target ?? '')), [elementById]);

  const handleConnect: OnConnect = useCallback((c) => {
    if (!c.source || !c.target) return;
    if (!isValidConnection(c)) return;
    onConnect({ sourceId: c.source, targetId: c.target, sourceOutputKey: c.sourceHandle ?? 'default' });
  }, [isValidConnection, onConnect]);

  const handleNodesDelete: OnNodesDelete = useCallback((deleted) => {
    onDeleteElements(deleted.map((n) => n.id));
  }, [onDeleteElements]);

  const handleEdgesDelete: OnEdgesDelete = useCallback((deleted) => {
    onDeleteConnections(deleted.map((e) => e.id));
  }, [onDeleteConnections]);

  const handleNodeDoubleClick: NodeMouseHandler = useCallback((_e, node) => onOpenElement(node.id), [onOpenElement]);

  return (
    <Box
      ref={containerRef}
      className="narrative-canvas"
      data-testid="narrative-canvas"
      sx={{
        position: 'relative', width: '100%', height: '100%', minHeight: 480,
        bgcolor: narrativeColors.bgBase,
        '& .react-flow__attribution': { display: 'none' },
        '& .react-flow__controls': { bgcolor: narrativeColors.bgPanel, borderRadius: 1, overflow: 'hidden' },
        '& .react-flow__controls-button': { bgcolor: narrativeColors.bgPanel, borderBottom: `1px solid ${narrativeColors.borderStrong}`, '& svg': { fill: narrativeColors.text } },
        '& .react-flow__minimap': { bgcolor: narrativeColors.bgPanel },
        '& .react-flow__edge-path': { strokeWidth: 2 },
        '& .react-flow__edge.selected .react-flow__edge-path': { stroke: '#fff' },
      }}
    >
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <marker id="narrative-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={narrativeColors.accent} />
          </marker>
        </defs>
      </svg>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NARRATIVE_NODE_TYPES}
        onNodesChange={onNodesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onNodeDoubleClick={handleNodeDoubleClick}
        onConnect={handleConnect}
        isValidConnection={isValidConnection}
        onNodesDelete={handleNodesDelete}
        onEdgesDelete={handleEdgesDelete}
        onEdgeClick={(_e, edge) => onSelectConnection(edge.id)}
        onPaneClick={() => { onSelectElement(null); onSelectConnection(null); }}
        onMoveEnd={(_e, viewport) => onViewportChange?.(viewport)}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode={['Meta', 'Control']}
        selectionKeyCode="Shift"
        minZoom={0.1}
        maxZoom={2.5}
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
        fitView={!initialViewport}
      >
        <Background color="#1f2937" gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => {
            const kind = (n.data as NarrativeNodeData | undefined)?.element.kind;
            if (kind === 'branch') return narrativeColors.warning;
            if (kind === 'jumper') return '#60a5fa';
            if (kind === 'note') return '#6b7280';
            return narrativeColors.accent;
          }}
          maskColor="rgba(0,0,0,0.6)"
        />
      </ReactFlow>
    </Box>
  );
}

export function NarrativeCanvas(props: NarrativeCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
