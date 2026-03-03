import { memo, type ReactNode } from 'react';
import { AppBar, Box, Paper, Toolbar, Typography } from '@mui/material';

interface StoryArcTopBarProps {
  children: ReactNode;
}

function StoryArcTopBarComponent({ children }: StoryArcTopBarProps) {
  return (
    <AppBar position="static" elevation={0}>
      <Toolbar variant="dense" sx={{ minHeight: 48 }}>
        {children}
      </Toolbar>
    </AppBar>
  );
}
export const StoryArcTopBar = memo(StoryArcTopBarComponent);
StoryArcTopBar.displayName = 'StoryArcTopBar';

interface StoryArcSidePanelProps {
  title: string;
  width: number;
  borderSide: 'left' | 'right';
  children: ReactNode;
}

function StoryArcSidePanelComponent({
  title,
  width,
  borderSide,
  children,
}: StoryArcSidePanelProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        width,
        borderColor: 'divider',
        borderLeft: borderSide === 'left' ? 1 : 0,
        borderRight: borderSide === 'right' ? 1 : 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2" fontWeight={600}>
          {title}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>{children}</Box>
    </Paper>
  );
}
export const StoryArcSidePanel = memo(StoryArcSidePanelComponent);
StoryArcSidePanel.displayName = 'StoryArcSidePanel';

interface StoryArcTimelineSectionProps {
  children: ReactNode;
}

function StoryArcTimelineSectionComponent({ children }: StoryArcTimelineSectionProps) {
  return <>{children}</>;
}
export const StoryArcTimelineSection = memo(StoryArcTimelineSectionComponent);
StoryArcTimelineSection.displayName = 'StoryArcTimelineSection';

interface StoryArcMonitorSectionProps {
  children: ReactNode;
}

function StoryArcMonitorSectionComponent({ children }: StoryArcMonitorSectionProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        p: 1.25,
        bgcolor: 'background.paper',
        flexShrink: 0,
      }}
    >
      {children}
    </Paper>
  );
}
export const StoryArcMonitorSection = memo(StoryArcMonitorSectionComponent);
StoryArcMonitorSection.displayName = 'StoryArcMonitorSection';
