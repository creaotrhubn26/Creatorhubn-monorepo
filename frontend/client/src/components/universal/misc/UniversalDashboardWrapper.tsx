import React, { useMemo, useState } from 'react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { useTheming } from '../../../utils/theming-helper';

interface DashboardWidgetConfig {
  id: string;
  name?: string;
  [key: string]: unknown;
}

interface DashboardLayoutTemplate {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  layout: {
    widgets: DashboardWidgetConfig[];
  };
}

interface UniversalDashboardWrapperProps {
  children: React.ReactNode;
  dashboardType: 'photographer' | 'videographer' | 'music_producer' | 'admin' | string;
  dashboardConfig: {
    widgets: DashboardWidgetConfig[];
    availableWidgets: DashboardWidgetConfig[];
    description?: string;
  };
}

interface UniversalWidgetWrapperProps {
  widget: DashboardWidgetConfig;
  index: number;
  children: React.ReactNode;
  className?: string;
}

const TEMPLATE_STORAGE_KEY = 'creatorhub.dashboard.templates';

function readSavedTemplates(): DashboardLayoutTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (template): template is DashboardLayoutTemplate =>
        typeof template === 'object' &&
        template !== null &&
        'id' in template &&
        'name' in template &&
        'layout' in template,
    );
  } catch {
    return [];
  }
}

export function UniversalDashboardWrapper({
  children,
  dashboardType,
  dashboardConfig,
}: UniversalDashboardWrapperProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: '100%' }}>
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Layout System: {dashboardType}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {dashboardConfig.description || 'Tilpass dashboard-oppsettet med widgets og maler.'}
        </Typography>
      </Paper>
      <Box>{children}</Box>
    </Box>
  );
}

export function LayoutModeOverlay({ isLayoutMode }: { isLayoutMode: boolean }) {
  if (!isLayoutMode) {
    return null;
  }

  return (
    <Paper sx={{ p: 2, border: '1px dashed', borderColor: 'primary.main', mb: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        Layout Edit Mode
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Dra widgets for å omorganisere dashboardet. Slipp dem i ønsket rekkefølge.
      </Typography>
    </Paper>
  );
}

export function UniversalWidgetWrapper({
  widget,
  index,
  children,
  className = '',
}: UniversalWidgetWrapperProps) {
  return (
    <Box className={className} data-widget-id={widget.id} data-widget-index={index} sx={{ height: '100%' }}>
      {children}
    </Box>
  );
}

export function DashboardLayoutSettings({ dashboardType }: { dashboardType: string }) {
  const theming = useTheming('photographer');
  const [templates] = useState<DashboardLayoutTemplate[]>(() => readSavedTemplates());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    templates[0]?.id || null,
  );

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [selectedTemplateId, templates],
  );

  return (
    <Paper sx={{ p: 2, ...theming.getThemedCardSx() }}>
      <Typography variant="h6" sx={{ mb: 1, color: theming.colors.primary }}>
        Dashboard Layout ({dashboardType})
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Velg en lagret mal for å raskt bytte paneloppsett.
      </Typography>

      {templates.length > 0 ? (
        <Stack spacing={1}>
          {templates.map((template) => (
            <Button
              key={template.id}
              variant={template.id === selectedTemplateId ? 'contained' : 'outlined'}
              onClick={() => setSelectedTemplateId(template.id)}
            >
              {template.name}
            </Button>
          ))}
          {selectedTemplate && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle2">{selectedTemplate.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedTemplate.layout.widgets.length} widgets •{' '}
                {new Date(selectedTemplate.createdAt).toLocaleDateString()}
              </Typography>
            </Box>
          )}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Ingen lagrede layout-maler funnet.
        </Typography>
      )}

      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Hvordan tilpasse oppsettet:
        </Typography>
        <Typography variant="body2" color="text.secondary">
          1. Aktiver layout-modus.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          2. Dra og slipp widgets.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          3. Lagre som ny mal.
        </Typography>
      </Box>
    </Paper>
  );
}

export default UniversalDashboardWrapper;
