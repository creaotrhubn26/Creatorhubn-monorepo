import React, { useState } from 'react';
import { ContextualNudgeBanner } from './ContextualNudgeBanner';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Chip,
  Badge,
  Collapse,
} from '@mui/material';
import {
  Description as CallSheetIcon,
  Videocam as ShotIcon,
  Style as ContinuityIcon,
  AutoFixHigh as VfxIcon,
  Create as ScriptIcon,
  Assessment as WrapIcon,
  Close as CloseIcon,
  ExpandLess,
  ExpandMore,
  Movie as MovieIcon,
} from '@mui/icons-material';
import { CallSheetGenerator } from './CallSheetGenerator';
import { ShotProgressTracker } from './ShotProgressTracker';
import { ContinuityLogger } from './ContinuityLogger';
import { VfxNotes } from './VfxNotes';
import { ScriptSupervisorNotes } from './ScriptSupervisorNotes';
import { WrapReport } from './WrapReport';
import { SceneBreakdown, ProductionDay } from '../models/casting';

interface ProductionToolsPanelProps {
  productionDay?: ProductionDay;
  scenes?: SceneBreakdown[];
  projectName?: string;
  onClose?: () => void;
}

type ToolTab = 'callsheet' | 'shots' | 'continuity' | 'vfx' | 'script' | 'wrap';

interface TabConfig {
  id: ToolTab;
  label: string;
  icon: React.ReactElement;
  description: string;
  badge?: number;
  color: string;
}

export const ProductionToolsPanel: React.FC<ProductionToolsPanelProps> = ({
  productionDay,
  scenes = [],
  projectName = 'TROLL',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<ToolTab>('callsheet');
  const [minimized, setMinimized] = useState(false);

  // Calculate badges for each tab
  const pendingShots = 8; // Would be calculated from actual data
  const vfxShots = 4;
  const unsignedWrap = 1;

  const tabs: TabConfig[] = [
    {
      id: 'callsheet',
      label: 'Call Sheet',
      icon: <CallSheetIcon />,
      description: 'Generer call sheets med crew, cast og scener',
      color: '#8b5cf6',
    },
    {
      id: 'shots',
      label: 'Shot Tracking',
      icon: <ShotIcon />,
      description: 'Spor fremgang på shots med timer',
      badge: pendingShots,
      color: '#3b82f6',
    },
    {
      id: 'continuity',
      label: 'Kontinuitet',
      icon: <ContinuityIcon />,
      description: 'Logg kostyme, hår, sminke og rekvisitter',
      color: '#10b981',
    },
    {
      id: 'vfx',
      label: 'VFX Noter',
      icon: <VfxIcon />,
      description: 'Spor VFX-shots og krav',
      badge: vfxShots,
      color: '#f59e0b',
    },
    {
      id: 'script',
      label: 'Script Supervisor',
      icon: <ScriptIcon />,
      description: 'Take-logging med timekoder',
      color: '#ec4899',
    },
    {
      id: 'wrap',
      label: 'Wrap Report',
      icon: <WrapIcon />,
      description: 'Daglig wrap-rapport',
      badge: unsignedWrap,
      color: '#ef4444',
    },
  ];

  const activeTabConfig = tabs.find(t => t.id === activeTab);

  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      bgcolor: 'background.default',
    }}>
      <ContextualNudgeBanner context="production-tools" accentColor="#3b82f6" />
      {/* Header */}
      <Paper 
        sx={{ 
          p: 2, 
          mb: 2,
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          color: '#fff',
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <MovieIcon sx={{ color: '#a78bfa' }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Produksjonsverktøy
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {projectName} • {productionDay?.date ? new Date(productionDay.date).toLocaleDateString('nb-NO') : 'Dag 1'}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <IconButton size="small" sx={{ color: '#fff' }} onClick={() => setMinimized(!minimized)}>
              {minimized ? <ExpandMore /> : <ExpandLess />}
            </IconButton>
            {onClose && (
              <IconButton size="small" sx={{ color: '#fff' }} onClick={onClose}>
                <CloseIcon />
              </IconButton>
            )}
          </Stack>
        </Stack>

        <Collapse in={!minimized}>
          {/* Tab Navigation */}
          <Box sx={{ mt: 2 }}>
            <Tabs
              value={activeTab}
              onChange={(_, v) => setActiveTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                '& .MuiTab-root': {
                  color: 'rgba(255,255,255,0.87)',
                  minHeight: 48,
                  textTransform: 'none',
                  '&.Mui-selected': {
                    color: '#fff',
                  },
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: activeTabConfig?.color || '#8b5cf6',
                  height: 3,
                },
              }}
            >
              {tabs.map((tab) => (
                <Tab
                  key={tab.id}
                  value={tab.id}
                  label={
                    <Stack direction="row" spacing={1} alignItems="center">
                      {tab.badge ? (
                        <Badge badgeContent={tab.badge} color="error" sx={{ '& .MuiBadge-badge': { fontSize: 10 } }}>
                          {tab.icon}
                        </Badge>
                      ) : tab.icon}
                      <Typography variant="body2">{tab.label}</Typography>
                    </Stack>
                  }
                />
              ))}
            </Tabs>
          </Box>

          {/* Active Tab Description */}
          {activeTabConfig && (
            <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                size="small"
                label={activeTabConfig.label}
                sx={{
                  bgcolor: activeTabConfig.color,
                  color: '#fff',
                  fontWeight: 600,
                }}
              />
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {activeTabConfig.description}
              </Typography>
            </Box>
          )}
        </Collapse>
      </Paper>

      {/* Content Area */}
      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {activeTab === 'callsheet' && (
          <CallSheetGenerator
            projectId={projectName}
            productionDay={productionDay}
            scenes={scenes}
          />
        )}

        {activeTab === 'shots' && (
          <ShotProgressTracker
            scenes={scenes}
          />
        )}

        {activeTab === 'continuity' && (
          <ContinuityLogger
            scenes={scenes}
          />
        )}

        {activeTab === 'vfx' && (
          <VfxNotes
            scenes={scenes}
          />
        )}

        {activeTab === 'script' && (
          <ScriptSupervisorNotes
            scenes={scenes}
          />
        )}

        {activeTab === 'wrap' && (
          <WrapReport
            productionDay={productionDay}
            scenes={scenes}
            projectName={projectName}
          />
        )}
      </Box>
    </Box>
  );
};

export default ProductionToolsPanel;
