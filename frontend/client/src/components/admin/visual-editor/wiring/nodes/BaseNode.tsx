/**
 * Base Node Component
 * Foundation for all node types in the wiring system
 */

import React, { useState, useCallback, memo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Collapse,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Chip,
  Stack,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  Settings,
  Lock,
  LockOpen,
  Delete,
  ContentCopy,
  PlayArrow,
  BugReport,
} from '@mui/icons-material';

// Port types for data flow
export type PortDataType = 
  | 'any' 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'object' 
  | 'array' 
  | 'event' 
  | 'function'
  | 'date'
  | 'file';

// Port definition
export interface NodePort {
  id: string;
  name: string;
  type: 'input' | 'output';
  dataType: PortDataType;
  description?: string;
  required?: boolean;
  defaultValue?: any;
  connected?: boolean;
  connectedTo?: string[];
}

// Node configuration
export interface NodeConfig {
  id: string;
  type: string;
  category: string;
  name: string;
  description?: string;
  icon: React.ReactNode;
  color: string;
  inputs: NodePort[];
  outputs: NodePort[];
  data: Record<string, any>;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  isLocked?: boolean;
  isCollapsed?: boolean;
  isSelected?: boolean;
  isRunning?: boolean;
  hasError?: boolean;
  errorMessage?: string;
}

// Port colors by data type
export const PORT_COLORS: Record<PortDataType, string> = {
  any: '#9e9e9e',
  string: '#4caf50',
  number: '#2196f3',
  boolean: '#ff9800',
  object: '#9c27b0',
  array: '#00bcd4',
  event: '#f44336',
  function: '#e91e63',
  date: '#795548',
  file: '#607d8b',
};

interface BaseNodeProps {
  config: NodeConfig;
  onDataChange?: (key: string, value: any) => void;
  onPortClick?: (portId: string, isOutput: boolean) => void;
  onNodeClick?: (e: React.MouseEvent) => void;
  onNodeDragStart?: (e: React.MouseEvent) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onToggleLock?: () => void;
  onExecute?: () => void;
  children?: React.ReactNode;
  renderContent?: (data: Record<string, any>, onChange: (key: string, value: any) => void) => React.ReactNode;
}

export const BaseNode = memo(function BaseNode({
  config,
  onDataChange,
  onPortClick,
  onNodeClick,
  onNodeDragStart,
  onDelete,
  onDuplicate,
  onToggleLock,
  onExecute,
  children,
  renderContent,
}: BaseNodeProps) {
  const [isExpanded, setIsExpanded] = useState(!config.isCollapsed);
  const [showSettings, setShowSettings] = useState(false);

  const handleDataChange = useCallback((key: string, value: any) => {
    onDataChange?.(key, value);
  }, [onDataChange]);

  const handlePortClick = useCallback((portId: string, isOutput: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    onPortClick?.(portId, isOutput);
  }, [onPortClick]);

  // Render a port
  const renderPort = (port: NodePort, isOutput: boolean) => (
    <Box
      key={port.id}
      onClick={(e) => handlePortClick(port.id, isOutput, e)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: isOutput ? 'flex-end' : 'flex-start',
        gap: 1,
        py: 0.5,
        px: 1,
        cursor: 'pointer',
        '&:hover': {
          bgcolor: 'rgba(255,255,255,0.05)',
        },
      }}
    >
      {!isOutput && (
        <Tooltip title={`${port.dataType}${port.required ? ' (required)' : ''}`}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: port.connected ? PORT_COLORS[port.dataType] : 'transparent',
              border: `2px solid ${PORT_COLORS[port.dataType]}`,
              ml: -2,
              transition: 'all 0.2s',
              '&:hover': {
                transform: 'scale(1.3)',
                bgcolor: PORT_COLORS[port.dataType],
              },
            }}
          />
        </Tooltip>
      )}
      <Typography
        variant="caption"
        sx={{
          color: 'rgba(255,255,255,0.7)',
          fontSize: '0.7rem',
        }}
      >
        {port.name}
        {port.required && <span style={{ color: '#f44336' }}>*</span>}
      </Typography>
      {isOutput && (
        <Tooltip title={port.dataType}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: port.connected ? PORT_COLORS[port.dataType] : 'transparent',
              border: `2px solid ${PORT_COLORS[port.dataType]}`,
              mr: -2,
              transition: 'all 0.2s',
              '&:hover': {
                transform: 'scale(1.3)',
                bgcolor: PORT_COLORS[port.dataType],
              },
            }}
          />
        </Tooltip>
      )}
    </Box>
  );

  return (
    <Paper
      onClick={onNodeClick}
      onMouseDown={onNodeDragStart}
      elevation={config.isSelected ? 8 : 2}
      sx={{
        minWidth: config.width || 200,
        maxWidth: 400,
        bgcolor: 'rgba(25,25,35,0.95)',
        border: config.isSelected
          ? `2px solid ${config.color}`
          : config.hasError
          ? '2px solid #f44336'
          : '1px solid rgba(255,255,255,0.1)',
        borderRadius: 2,
        overflow: 'hidden',
        cursor: config.isLocked ? 'not-allowed' : 'grab',
        transition: 'all 0.2s',
        '&:hover': {
          boxShadow: `0 0 20px ${config.color}40`,
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1,
          bgcolor: config.color,
          borderBottom: '1px solid rgba(0,0,0,0.2)',
        }}
      >
        {config.icon}
        <Typography
          variant="caption"
          fontWeight="bold"
          color="white"
          sx={{ flex: 1, fontSize: '0.8rem' }}
        >
          {config.name}
        </Typography>
        
        {config.isRunning && (
          <CircularProgress size={16} sx={{ color: 'white' }} />
        )}
        
        <Stack direction="row" spacing={0.5}>
          {onExecute && (
            <Tooltip title="Execute">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onExecute(); }}>
                <PlayArrow sx={{ fontSize: 16, color: 'white' }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={isExpanded ? 'Collapse' : 'Expand'}>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>
              {isExpanded ? (
                <ExpandLess sx={{ fontSize: 16, color: 'white' }} />
              ) : (
                <ExpandMore sx={{ fontSize: 16, color: 'white' }} />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}>
              <Settings sx={{ fontSize: 16, color: showSettings ? '#fff' : 'rgba(255,255,255,0.7)' }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Error Message */}
      {config.hasError && config.errorMessage && (
        <Box sx={{ p: 1, bgcolor: 'rgba(244,67,54,0.1)' }}>
          <Typography variant="caption" color="#f44336">
            {config.errorMessage}
          </Typography>
        </Box>
      )}

      {/* Ports and Content */}
      <Collapse in={isExpanded}>
        {/* Input Ports */}
        {config.inputs.length > 0 && (
          <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            {config.inputs.map((port) => renderPort(port, false))}
          </Box>
        )}

        {/* Node Content */}
        <Box sx={{ p: 1.5 }}>
          {renderContent ? (
            renderContent(config.data, handleDataChange)
          ) : (
            children
          )}
        </Box>

        {/* Output Ports */}
        {config.outputs.length > 0 && (
          <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {config.outputs.map((port) => renderPort(port, true))}
          </Box>
        )}
      </Collapse>

      {/* Settings Panel */}
      <Collapse in={showSettings}>
        <Box sx={{ p: 1.5, bgcolor: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <Stack spacing={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Tooltip title={config.isLocked ? 'Unlock' : 'Lock'}>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggleLock?.(); }}>
                  {config.isLocked ? (
                    <Lock sx={{ fontSize: 16, color: '#ff9800' }} />
                  ) : (
                    <LockOpen sx={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }} />
                  )}
                </IconButton>
              </Tooltip>
              <Tooltip title="Duplicate">
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDuplicate?.(); }}>
                  <ContentCopy sx={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete?.(); }}>
                  <Delete sx={{ fontSize: 16, color: '#f44336' }} />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography variant="caption" color="rgba(255,255,255,0.4)">
              ID: {config.id.slice(0, 8)}...
            </Typography>
            {config.description && (
              <Typography variant="caption" color="rgba(255,255,255,0.5)">
                {config.description}
              </Typography>
            )}
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
});

// Import CircularProgress
import { CircularProgress } from '@mui/material';

export default BaseNode;

