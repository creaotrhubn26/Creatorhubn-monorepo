/**
 * SIDE PANELS
 * Lightroom-style left and right side panels for photo editing tools
 */

import React, { useState } from 'react';
import {
  Box,
  Drawer,
  IconButton,
  Stack,
  Divider,
  Typography,
  Tooltip,
  Collapse,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Settings,
  Tune,
  Palette,
  Crop,
  AutoFixHigh,
  History,
  FilterVintage,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

interface SidePanelSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  defaultExpanded?: boolean;
}

interface SidePanelsProps {
  leftPanelSections?: SidePanelSection[];
  rightPanelSections?: SidePanelSection[];
  leftPanelWidth?: number;
  rightPanelWidth?: number;
  children: React.ReactNode; // Main content area
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
}

export default function SidePanels({
  leftPanelSections = [],
  rightPanelSections = [],
  leftPanelWidth = 280,
  rightPanelWidth = 320,
  children,
  profession = 'photographer',
}: SidePanelsProps) {
  const theming = useTheming(profession);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const leftExpanded = new Set(leftPanelSections.filter(s => s.defaultExpanded).map(s => s.id));
    const rightExpanded = new Set(rightPanelSections.filter(s => s.defaultExpanded).map(s => s.id));
    return new Set([...leftExpanded, ...rightExpanded]);
  });

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const renderPanel = (sections: SidePanelSection[], side: 'left' | 'right') => (
    <Box
      sx={{
        width: side === 'left' ? leftPanelWidth : rightPanelWidth,
        height: '100%',
        bgcolor: '#252525',
        borderRight: side === 'left' ? '1px solid #3a3a3a' : 'none',
        borderLeft: side === 'right' ? '1px solid #3a3a3a' : 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'}}
    >
      {/* Panel Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid #3a3a3a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'}}
      >
        <Typography variant="caption" sx={{ color: '#999', fontSize: '11px', textTransform: 'uppercase' }}>
          {side === 'left' ? 'Tools' : 'Adjustments'}
        </Typography>
        <IconButton
          size="small"
          onClick={() => side === 'left' ? setLeftOpen(false) : setRightOpen(false)}
          sx={{ color: '#999' }}
        >
          {side === 'left' ? <ChevronLeft /> : <ChevronRight />}
        </IconButton>
      </Box>

      {/* Panel Sections */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: '#4a4a4a #252525', '&::-webkit-scrollbar': {
            width: '8px',
          }, '&::-webkit-scrollbar-track': {
            background: '#252525',
          }, '&::-webkit-scrollbar-thumb': {
            background: '#4a4a4a',
            borderRadius: '4px',
          }}}
      >
        {sections.map((section, index) => {
          const isExpanded = expandedSections.has(section.id);

          return (
            <Box key={section.id}>
              <Box
                onClick={() => toggleSection(section.id)}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  bgcolor: isExpanded ? '#2a2a2a' : 'transparent',
                  transition: 'background 0.2s','&:hover': {
                    bgcolor: '#2a2a2a',
                  }}}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ color: '#4a9eff', display: 'flex', alignItems: 'center' }}>
                    {section.icon}
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{
                      color: '#e6e6e6',
                      fontSize: '13px',
                      fontWeight: 500}}
                  >
                    {section.title}
                  </Typography>
                </Stack>
                <IconButton
                  size="small"
                  sx={{
                    color: '#999',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'}}
                >
                  <ChevronRight />
                </IconButton>
              </Box>
              <Collapse in={isExpanded}>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: '#1f1f1f',
                    borderTop: '1px solid #3a3a3a'}}
                >
                  {section.content}
                </Box>
              </Collapse>
              {index < sections.length - 1 && <Divider sx={{ borderColor: '#3a3a3a' }} />}
            </Box>
          );
        })}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100%', position: 'relative' }}>
      {/* Left Panel */}
      {leftOpen ? (
        renderPanel(leftPanelSections, 'left')
      ) : (
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10}}
        >
          <Tooltip title="Show Tools">
            <IconButton
              onClick={() => setLeftOpen(true)}
              sx={{
                bgcolor: '#252525',
                border: '1px solid #3a3a3a',
                borderLeft: 'none',
                borderRadius: '0 4px 4px 0',
                color: '#999',
                '&:hover': {
                  bgcolor: '#2a2a2a',
                  color: '#4a9eff',
                }
              }}
            >
              <ChevronRight />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          overflow: 'hidden',
          marginLeft: leftOpen ? 0 : 0,
          marginRight: rightOpen ? 0 : 0}}
      >
        {children}
      </Box>

      {/* Right Panel */}
      {rightOpen ? (
        renderPanel(rightPanelSections, 'right')
      ) : (
        <Box
          sx={{
            position: 'absolute',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10}}
        >
          <Tooltip title="Show Adjustments">
            <IconButton
              onClick={() => setRightOpen(true)}
              sx={{
                bgcolor: '#252525',
                border: '1px solid #3a3a3a',
                borderRight: 'none',
                borderRadius: '4px 0 0 4px',
                color: '#999',
                '&:hover': {
                  bgcolor: '#2a2a2a',
                  color: '#4a9eff',
                }
              }}
            >
              <ChevronLeft />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
}

