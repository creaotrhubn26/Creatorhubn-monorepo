/**
 * Quick Message Templates for Wedding Day
 * One-tap messaging for team coordination
 * quick messaging
 */
import React, { useState } from 'react';
import { useTheming } from '../../utils/theming-helper';
import {
  Box,
  Paper,
  Chip,
  Typography,
  Grid,
  Collapse,
  IconButton
} from '@mui/material';
import {
  Schedule,
  LocationOn,
  Camera,
  Group,
  Restaurant,
  Warning,
  CheckCircle,
  ExpandMore,
  ExpandLess,
  Send
} from '@mui/icons-material';

interface QuickTemplate {
  id: string;
  label: string;
  message: string;
  icon: React.ReactNode;
  color: string;
  category: 'status' | 'location' | 'timing' | 'coordination';
}

interface QuickMessageTemplatesProps {
  onSelectTemplate: (message: string) => void;
  profession?: 'photographer' | 'videographer';
  currentEvent?: string; // Current timeline event
}

const WEDDING_DAY_TEMPLATES: QuickTemplate[] = [
  // Status Updates
  {
    id: 'ceremony-starting',
    label: 'Ceremony Starting',
    message: '🎊 Ceremony starting now!',
    icon: <Schedule />,
    color: '#E91E63',
    category: 'status'
  },
  {
    id: 'photos-ready',
    label: 'Ready for Photos',
    message: '📸 Ready for group photos at garden',
    icon: <Camera />,
    color: '#2196F3',
    category: 'coordination'
  },
  {
    id: 'reception-entrance',
    label: 'Reception Entrance',
    message: '🎉 Couple entering reception hall now',
    icon: <Restaurant />,
    color: '#FF9800',
    category: 'status'
  },
  
  // Timing Updates
  {
    id: 'delay-15',
    label: 'Delayed 15 min',
    message: '⏰ Running 15 minutes behind schedule',
    icon: <Warning />,
    color: '#FF9800',
    category: 'timing'
  },
  {
    id: 'delay-30',
    label: 'Delayed 30 min',
    message: '⚠️ Running 30 minutes behind schedule',
    icon: <Warning />,
    color: '#F44336',
    category: 'timing'
  },
  {
    id: 'back-on-schedule',
    label: 'Back on Schedule',
    message: '✅ Back on schedule!',
    icon: <CheckCircle />,
    color: '#4CAF50',
    category: 'timing'
  },
  
  // Location Updates
  {
    id: 'moving-garden',
    label: 'Moving to Garden',
    message: '🌳 Moving to garden for portraits',
    icon: <LocationOn />,
    color: '#4CAF50',
    category: 'location'
  },
  {
    id: 'moving-venue',
    label: 'Moving to Venue',
    message: '🚗 Moving to ceremony venue',
    icon: <LocationOn />,
    color: '#2196F3',
    category: 'location'
  },
  {
    id: 'at-location',
    label: 'At Location',
    message: '📍 At location - ready to shoot',
    icon: <LocationOn />,
    color: '#9C27B0',
    category: 'location'
  },
  
  // Coordination
  {
    id: 'need-second-shooter',
    label: 'Need Second Shooter',
    message: '🎥 Need second shooter at reception hall',
    icon: <Group />,
    color: '#FF5722',
    category: 'coordination'
  },
  {
    id: 'break-time',
    label: 'Taking Break',
    message: '☕ Taking a 15 min break',
    icon: <Schedule />,
    color: '#795548',
    category: 'status'
  },
  {
    id: 'shots-complete',
    label: 'Shots Complete',
    message: '✅ All shots for this section complete!',
    icon: <CheckCircle />,
    color: '#4CAF50',
    category: 'status'
  },
];

export default function QuickMessageTemplates({
  onSelectTemplate,
  profession = 'photographer',
  currentEvent
}: QuickMessageTemplatesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { value: 'all', label: 'All' },
    { value: 'status', label: 'Status' },
    { value: 'timing', label: 'Timing' },
    { value: 'location', label: 'Location' },
    { value: 'coordination', label: 'Team' }
  ];

  const filteredTemplates = selectedCategory === 'all' 
    ? WEDDING_DAY_TEMPLATES 
    : WEDDING_DAY_TEMPLATES.filter(t => t.category === selectedCategory);

  return (
    <Paper 
      elevation={2}
      sx={{ 
        mb: 1,
        overflow: 'hidden',
        borderRadius: 2,
        ...{ color: theming.colors.primary }}}
    >
      {/* Header - Click to Expand */}
      <Box
        onClick={() => setIsExpanded(!isExpanded)}
        sx={{
          p: 1.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          bgcolor: '#F5F5F5','&:hover': { bgcolor: '#EEEEEE' }
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, color: '#757575' }}>
          ⚡ Quick Messages (Wedding Day)
        </Typography>
        <IconButton size="small">
          {isExpanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>

      {/* Templates - Collapsible */}
      <Collapse in={isExpanded}>
        <Box sx={{ p: 2, bgcolor: 'white' }}>
          {/* Category Filters */}
          <Box sx={{ display: 'flex', gap: 0.5, mb: 2, flexWrap: 'wrap' }}>
            {categories.map((cat) => (
              <Chip
                key={cat.value}
                label={cat.label}
                size="small"
                onClick={() => setSelectedCategory(cat.value)}
                color={selectedCategory === cat.value ? 'primary' : 'default'}
                sx={{ fontSize: '0.75rem' }}
              />
            ))}
          </Box>

          {/* Template Chips */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1}} sx={{ ...{ color: theming.colors.primary }}}>
            {filteredTemplates.map((template) => (
              <Chip
                key={template.id}
                icon={template.icon as any}
                label={template.label}
                onClick={() => {
                  onSelectTemplate(template.message);
                  setIsExpanded(false); // Collapse after selection
                }}
                sx={{
                  cursor: 'pointer',
                  bgcolor: `${template.color}15`,
                  border: `1px solid ${template.color}`,
                  color: template.color,
                  fontWeight: 500, '&:hover': {
                    bgcolor: `${template.color}30`
                  }
                }}
              />
            ))}
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2}} sx={{ ...{ color: theming.colors.primary }}}>
            💡 Tip: Tap a template to instantly send the message to your team
          </Typography>
        </Box>
      </Collapse>
    </Paper>
  );
}

