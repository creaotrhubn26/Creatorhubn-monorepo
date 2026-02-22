/**
 * Data Flow Visualizer
 * Real-time visualization of data flow between nodes
 */

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Stack,
  Switch,
  FormControlLabel,
  Slider,
  Divider,
  Button,
  Collapse,
  Badge,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  SkipNext,
  Refresh,
  Timeline,
  Speed as Speed,
  BugReport,
  Visibility,
  VisibilityOff,
  ExpandMore,
  ExpandLess,
  FiberManualRecord,
  ArrowRightAlt,
  DataObject,
  Functions,
  Api,
  Storage,
  Check,
  Error,
  Warning,
  Schedule,
  Memory,
} from '@mui/icons-material';

// Data packet types
type PacketType = 'data' | 'event' | 'error' | 'loading' | 'success';

interface DataPacket {
  id: string;
  timestamp: number;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
  type: PacketType;
  data: unknown;
  size: number; // bytes
  latency: number; // ms
}

interface NodeStats {
  nodeId: string;
  nodeName: string;
  category: string;
  packetsReceived: number;
  packetsSent: number;
  errors: number;
  avgLatency: number;
  lastActivity: number;
  status: 'idle' | 'active' | 'error' | 'waiting';
}

interface DataFlowVisualizerProps {
  nodes: { id: string; name: string; category: string }[];
  connections: { id: string; sourceNodeId: string; targetNodeId: string }[];
  onPacketSelect?: (packet: DataPacket) => void;
  onNodeSelect?: (nodeId: string) => void;
  isRunning?: boolean;
}

// Simulated data flow for demo
function generateMockPacket(
  connections: { id: string; sourceNodeId: string; targetNodeId: string }[]
): DataPacket | null {
  if (connections.length === 0) return null;
  const conn = connections[Math.floor(Math.random() * connections.length)];
  const types: PacketType[] = ['data', 'event', 'data', 'data', 'success', 'error'];
  const type = types[Math.floor(Math.random() * types.length)];

  return {
    id: `pkt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    sourceNodeId: conn.sourceNodeId,
    sourcePort: 'output',
    targetNodeId: conn.targetNodeId,
    targetPort: 'input',
    type,
    data: type === 'error' ? { message: 'Mock error' } : { value: Math.random() * 100 },
    size: Math.floor(Math.random() * 1000) + 50,
    latency: Math.floor(Math.random() * 100) + 5,
  };
}

export const DataFlowVisualizer = memo(function DataFlowVisualizer({
  nodes,
  connections,
  onPacketSelect,
  onNodeSelect,
  isRunning: externalIsRunning,
}: DataFlowVisualizerProps) {
  const [isRunning, setIsRunning] = useState(externalIsRunning ?? false);
  const [packets, setPackets] = useState<DataPacket[]>([]);
  const [nodeStats, setNodeStats] = useState<Map<string, NodeStats>>(new Map());
  const [speed, setSpeed] = useState(1);
  const [showDataPreview, setShowDataPreview] = useState(true);
  const [filterType, setFilterType] = useState<PacketType | 'all'>('all');
  const [selectedPacket, setSelectedPacket] = useState<DataPacket | null>(null);
  const [statsExpanded, setStatsExpanded] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const maxPackets = 100;

  // Initialize node stats
  useEffect(() => {
    const stats = new Map<string, NodeStats>();
    nodes.forEach((node) => {
      stats.set(node.id, {
        nodeId: node.id,
        nodeName: node.name,
        category: node.category,
        packetsReceived: 0,
        packetsSent: 0,
        errors: 0,
        avgLatency: 0,
        lastActivity: 0,
        status: 'idle',
      });
    });
    setNodeStats(stats);
  }, [nodes]);

  // Simulation loop
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        const packet = generateMockPacket(connections);
        if (packet) {
          setPackets((prev) => {
            const updated = [packet, ...prev].slice(0, maxPackets);
            return updated;
          });

          // Update stats
          setNodeStats((prev) => {
            const newStats = new Map(prev);

            // Source node
            const sourceStats = newStats.get(packet.sourceNodeId);
            if (sourceStats) {
              newStats.set(packet.sourceNodeId, {
                ...sourceStats,
                packetsSent: sourceStats.packetsSent + 1,
                lastActivity: Date.now(),
                status: 'active',
              });
            }

            // Target node
            const targetStats = newStats.get(packet.targetNodeId);
            if (targetStats) {
              const newLatency =
                (targetStats.avgLatency * targetStats.packetsReceived + packet.latency) /
                (targetStats.packetsReceived + 1);
              newStats.set(packet.targetNodeId, {
                ...targetStats,
                packetsReceived: targetStats.packetsReceived + 1,
                errors: packet.type === 'error' ? targetStats.errors + 1 : targetStats.errors,
                avgLatency: Math.round(newLatency),
                lastActivity: Date.now(),
                status: packet.type === 'error' ? 'error' : 'active',
              });
            }

            return newStats;
          });
        }
      }, 1000 / speed);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, connections, speed]);

  // Reset statuses to idle after inactivity
  useEffect(() => {
    const idleTimer = setInterval(() => {
      const now = Date.now();
      setNodeStats((prev) => {
        const newStats = new Map(prev);
        newStats.forEach((stat, nodeId) => {
          if (stat.lastActivity && now - stat.lastActivity > 2000 && stat.status === 'active') {
            newStats.set(nodeId, { ...stat, status: 'idle' });
          }
        });
        return newStats;
      });
    }, 1000);

    return () => clearInterval(idleTimer);
  }, []);

  const handleClear = useCallback(() => {
    setPackets([]);
    setNodeStats((prev) => {
      const newStats = new Map(prev);
      newStats.forEach((stat, nodeId) => {
        newStats.set(nodeId, {
          ...stat,
          packetsReceived: 0,
          packetsSent: 0,
          errors: 0,
          avgLatency: 0,
          status: 'idle',
        });
      });
      return newStats;
    });
  }, []);

  const handlePacketClick = useCallback(
    (packet: DataPacket) => {
      setSelectedPacket(packet);
      onPacketSelect?.(packet);
    },
    [onPacketSelect]
  );

  const filteredPackets = filterType === 'all' ? packets : packets.filter((p) => p.type === filterType);

  const getTypeIcon = (type: PacketType) => {
    switch (type) {
      case 'data':
        return <DataObject sx={{ fontSize: 14 }} />;
      case 'event':
        return <Functions sx={{ fontSize: 14 }} />;
      case 'error':
        return <Error sx={{ fontSize: 14, color: '#f44336' }} />;
      case 'loading':
        return <Schedule sx={{ fontSize: 14 }} />;
      case 'success':
        return <Check sx={{ fontSize: 14, color: '#4caf50' }} />;
      default:
        return <FiberManualRecord sx={{ fontSize: 14 }} />;
    }
  };

  const getTypeColor = (type: PacketType) => {
    switch (type) {
      case 'data':
        return '#2196f3';
      case 'event':
        return '#4caf50';
      case 'error':
        return '#f44336';
      case 'loading':
        return '#ff9800';
      case 'success':
        return '#4caf50';
      default:
        return '#9e9e9e';
    }
  };

  const getStatusColor = (status: NodeStats['status']) => {
    switch (status) {
      case 'active':
        return '#4caf50';
      case 'error':
        return '#f44336';
      case 'waiting':
        return '#ff9800';
      default:
        return '#9e9e9e';
    }
  };

  // Calculate totals
  const totalPackets = packets.length;
  const totalErrors = packets.filter((p) => p.type === 'error').length;
  const avgLatency =
    packets.length > 0
      ? Math.round(packets.reduce((sum, p) => sum + p.latency, 0) / packets.length)
      : 0;

  return (
    <Paper
      sx={{
        height: '100%',
        bgcolor: 'rgba(20,20,30,0.98)',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6" color="white">
            Data Flow Monitor
          </Typography>
          <Stack direction="row" spacing={1}>
            <Chip
              size="small"
              icon={<FiberManualRecord sx={{ fontSize: 10, color: isRunning ? '#4caf50' : '#9e9e9e' }} />}
              label={isRunning ? 'Live' : 'Paused'}
              sx={{ bgcolor: isRunning ? 'rgba(76,175,80,0.2)' : 'rgba(158,158,158,0.2)' }}
            />
          </Stack>
        </Box>

        {/* Controls */}
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title={isRunning ? 'Pause' : 'Start'}>
            <IconButton
              onClick={() => setIsRunning(!isRunning)}
              sx={{ color: isRunning ? '#ff9800' : '#4caf50' }}
            >
              {isRunning ? <Pause /> : <PlayArrow />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Step (next packet)">
            <IconButton
              onClick={() => {
                const packet = generateMockPacket(connections);
                if (packet) setPackets((prev) => [packet, ...prev].slice(0, maxPackets));
              }}
              sx={{ color: 'white' }}
            >
              <SkipNext />
            </IconButton>
          </Tooltip>
          <Tooltip title="Clear">
            <IconButton onClick={handleClear} sx={{ color: 'white' }}>
              <Refresh />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

          <Speed sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 18 }} />
          <Slider
            value={speed}
            onChange={(_, value) => setSpeed(value as number)}
            min={0.5}
            max={5}
            step={0.5}
            sx={{ width: 80, color: '#ff6b00' }}
          />
          <Typography variant="caption" color="rgba(255,255,255,0.5)">
            {speed}x
          </Typography>

          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

          <FormControlLabel
            control={
              <Switch
                checked={showDataPreview}
                onChange={(e) => setShowDataPreview(e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption" color="rgba(255,255,255,0.7)">Preview</Typography>}
          />
        </Stack>
      </Box>

      {/* Summary stats */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(0,0,0,0.2)' }}>
        <Stack direction="row" spacing={3}>
          <Box>
            <Typography variant="caption" color="rgba(255,255,255,0.5)">
              Packets
            </Typography>
            <Typography variant="h6" color="white">
              {totalPackets}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="rgba(255,255,255,0.5)">
              Errors
            </Typography>
            <Typography variant="h6" color={totalErrors > 0 ? '#f44336' : 'white'}>
              {totalErrors}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="rgba(255,255,255,0.5)">
              Avg Latency
            </Typography>
            <Typography variant="h6" color="white">
              {avgLatency}ms
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="rgba(255,255,255,0.5)">
              Active Nodes
            </Typography>
            <Typography variant="h6" color="white">
              {[...nodeStats.values()].filter((s) => s.status === 'active').length}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Node stats */}
      <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Box
          onClick={() => setStatsExpanded(!statsExpanded)}
          sx={{
            p: 1,
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
          }}
        >
          <Memory sx={{ color: '#ff6b00', mr: 1, fontSize: 18 }} />
          <Typography variant="subtitle2" color="white" sx={{ flex: 1 }}>
            Node Activity
          </Typography>
          {statsExpanded ? <ExpandLess /> : <ExpandMore />}
        </Box>
        <Collapse in={statsExpanded}>
          <Box sx={{ px: 1, pb: 1, maxHeight: 150, overflow: 'auto' }}>
            <Stack spacing={0.5}>
              {[...nodeStats.values()].map((stat) => (
                <Box
                  key={stat.nodeId}
                  onClick={() => onNodeSelect?.(stat.nodeId)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 0.5,
                    borderRadius: 1,
                    bgcolor: 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(255,107,0,0.1)' },
                  }}
                >
                  <FiberManualRecord
                    sx={{ fontSize: 8, color: getStatusColor(stat.status) }}
                  />
                  <Typography variant="caption" color="white" sx={{ flex: 1, minWidth: 80 }}>
                    {stat.nodeName}
                  </Typography>
                  <Chip size="small" label={`↓${stat.packetsReceived}`} sx={{ height: 18, fontSize: '0.65rem' }} />
                  <Chip size="small" label={`↑${stat.packetsSent}`} sx={{ height: 18, fontSize: '0.65rem' }} />
                  {stat.errors > 0 && (
                    <Chip
                      size="small"
                      label={`⚠${stat.errors}`}
                      sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(244,67,54,0.2)', color: '#f44336' }}
                    />
                  )}
                  <Typography variant="caption" color="rgba(255,255,255,0.5)">
                    {stat.avgLatency}ms
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        </Collapse>
      </Box>

      {/* Filter */}
      <Box sx={{ p: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Stack direction="row" spacing={0.5}>
          {(['all', 'data', 'event', 'success', 'error'] as const).map((type) => (
            <Chip
              key={type}
              size="small"
              label={type}
              icon={type !== 'all' ? getTypeIcon(type) : undefined}
              onClick={() => setFilterType(type)}
              variant={filterType === type ? 'filled' : 'outlined'}
              sx={{
                bgcolor: filterType === type ? `${getTypeColor(type as PacketType)}30` : 'transparent',
                borderColor: type !== 'all' ? getTypeColor(type as PacketType) : 'rgba(255,255,255,0.3)',
                color: type !== 'all' ? getTypeColor(type as PacketType) : 'white',
              }}
            />
          ))}
        </Stack>
      </Box>

      {/* Packet list */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <List dense disablePadding>
          {filteredPackets.map((packet) => (
            <ListItem
              key={packet.id}
              onClick={() => handlePacketClick(packet)}
              sx={{
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                cursor: 'pointer',
                bgcolor: selectedPacket?.id === packet.id ? 'rgba(255,107,0,0.1)' : 'transparent',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 30 }}>
                {getTypeIcon(packet.type)}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" color="rgba(255,255,255,0.7)">
                      {nodes.find((n) => n.id === packet.sourceNodeId)?.name || packet.sourceNodeId}
                    </Typography>
                    <ArrowRightAlt sx={{ fontSize: 14, color: getTypeColor(packet.type) }} />
                    <Typography variant="caption" color="rgba(255,255,255,0.7)">
                      {nodes.find((n) => n.id === packet.targetNodeId)?.name || packet.targetNodeId}
                    </Typography>
                  </Box>
                }
                secondary={
                  showDataPreview && (
                    <Typography
                      variant="caption"
                      color="rgba(255,255,255,0.4)"
                      sx={{
                        display: 'block',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 200,
                        fontFamily: 'monospace',
                        fontSize: '0.65rem',
                      }}
                    >
                      {JSON.stringify(packet.data)}
                    </Typography>
                  )
                }
              />
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="caption" color="rgba(255,255,255,0.3)">
                  {packet.latency}ms
                </Typography>
                <Typography variant="caption" color="rgba(255,255,255,0.3)">
                  {packet.size}b
                </Typography>
              </Stack>
            </ListItem>
          ))}
        </List>

        {filteredPackets.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="rgba(255,255,255,0.3)">
              {isRunning ? 'Waiting for data...' : 'Press play to start monitoring'}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Selected packet details */}
      {selectedPacket && (
        <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(0,0,0,0.3)' }}>
          <Typography variant="subtitle2" color="white" gutterBottom>
            Packet Details
          </Typography>
          <Box
            sx={{
              bgcolor: 'rgba(0,0,0,0.3)',
              p: 1,
              borderRadius: 1,
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.7)',
              maxHeight: 100,
              overflow: 'auto',
            }}
          >
            <pre style={{ margin: 0 }}>{JSON.stringify(selectedPacket, null, 2)}</pre>
          </Box>
        </Box>
      )}
    </Paper>
  );
});

export default DataFlowVisualizer;

