import React, { useCallback, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '@/utils/theming-helper';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  ArrowDownward,
  ArrowUpward,
  Code,
  Delete,
  Preview,
  Redo,
  Save,
  Settings,
  Undo,
} from '@mui/icons-material';

type ComponentType = 'header' | 'text' | 'button' | 'image' | 'divider' | 'footer' | 'social' | 'spacer';

interface EmailComponentStyles {
  color: string;
  backgroundColor: string;
  textAlign: 'left' | 'center' | 'right';
  fontWeight: 'normal' | 'bold';
  fontSize: number;
  padding: number;
  margin: number;
  borderRadius: number;
  width: string;
  height: number;
}

interface EmailComponentContent {
  text: string;
  src: string;
  alt: string;
  url: string;
}

interface EmailComponent {
  id: string;
  type: ComponentType;
  content: EmailComponentContent;
  styles: EmailComponentStyles;
}

interface GlobalStyles {
  backgroundColor: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  textColor: string;
  linkColor: string;
  containerWidth: number;
}

interface EmailTemplatePayload {
  name: string;
  category: string;
  subject: string;
  preheader: string;
  components: EmailComponent[];
  globalStyles: GlobalStyles;
}

interface TemplateVariable {
  key: string;
  label: string;
  description: string;
  category: 'user' | 'project' | 'business' | 'custom';
  defaultValue: string;
}

interface ComponentPreset {
  id: ComponentType;
  name: string;
  icon: string;
  description: string;
}

interface EmailDesignerImprovedProps {
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
}

const DEFAULT_GLOBAL_STYLES: GlobalStyles = {
  backgroundColor: '#f5f5f5',
  fontFamily: 'Arial, sans-serif',
  fontSize: 14,
  lineHeight: 1.6,
  textColor: '#333333',
  linkColor: '#1f6feb',
  containerWidth: 640,
};

const COMPONENT_PRESETS: ComponentPreset[] = [
  { id: 'header', name: 'Header', icon: '📝', description: 'Main title area' },
  { id: 'text', name: 'Text', icon: '📄', description: 'Body text block' },
  { id: 'button', name: 'Button', icon: '🔘', description: 'CTA button block' },
  { id: 'image', name: 'Image', icon: '🖼️', description: 'Image block' },
  { id: 'divider', name: 'Divider', icon: '➖', description: 'Section separator' },
  { id: 'social', name: 'Social', icon: '📱', description: 'Social links row' },
  { id: 'spacer', name: 'Spacer', icon: '⬜', description: 'Vertical spacing' },
  { id: 'footer', name: 'Footer', icon: '👣', description: 'Footer notes' },
];

const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: 'user_name', label: 'User Name', description: 'Full name', category: 'user', defaultValue: 'Customer Name' },
  { key: 'user_email', label: 'User Email', description: 'Email address', category: 'user', defaultValue: 'user@example.com' },
  { key: 'project_name', label: 'Project Name', description: 'Current project', category: 'project', defaultValue: 'Project X' },
  { key: 'project_date', label: 'Project Date', description: 'Project date', category: 'project', defaultValue: '2026-03-01' },
  { key: 'business_name', label: 'Business Name', description: 'Business display name', category: 'business', defaultValue: 'CreatorHub Studio' },
  { key: 'business_phone', label: 'Business Phone', description: 'Contact number', category: 'business', defaultValue: '+47 000 00 000' },
  { key: 'greeting', label: 'Greeting', description: 'Intro phrase', category: 'custom', defaultValue: 'Hello' },
  { key: 'closing', label: 'Closing', description: 'Closing phrase', category: 'custom', defaultValue: 'Best regards' },
];

function uniqueId(): string {
  return `component-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function defaultContent(type: ComponentType): EmailComponentContent {
  switch (type) {
    case 'header':
      return { text: 'Email title', src: '', alt: '', url: '' };
    case 'text':
      return { text: 'Write your email content here.', src: '', alt: '', url: '' };
    case 'button':
      return { text: 'Call To Action', src: '', alt: '', url: 'https://example.com' };
    case 'image':
      return { text: '', src: 'https://via.placeholder.com/1200x500?text=Email+Banner', alt: 'Banner', url: '' };
    case 'divider':
      return { text: '', src: '', alt: '', url: '' };
    case 'social':
      return { text: 'Instagram | Facebook | YouTube', src: '', alt: '', url: '' };
    case 'spacer':
      return { text: '', src: '', alt: '', url: '' };
    case 'footer':
      return { text: 'You are receiving this email because you subscribed to updates.', src: '', alt: '', url: '' };
    default:
      return { text: '', src: '', alt: '', url: '' };
  }
}

function defaultStyles(type: ComponentType): EmailComponentStyles {
  switch (type) {
    case 'header':
      return {
        color: '#111827',
        backgroundColor: 'transparent',
        textAlign: 'left',
        fontWeight: 'bold',
        fontSize: 32,
        padding: 8,
        margin: 8,
        borderRadius: 0,
        width: '100%',
        height: 0,
      };
    case 'button':
      return {
        color: '#ffffff',
        backgroundColor: '#1f6feb',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: 16,
        padding: 12,
        margin: 10,
        borderRadius: 8,
        width: 'auto',
        height: 0,
      };
    case 'image':
      return {
        color: '#111827',
        backgroundColor: 'transparent',
        textAlign: 'center',
        fontWeight: 'normal',
        fontSize: 14,
        padding: 0,
        margin: 8,
        borderRadius: 10,
        width: '100%',
        height: 260,
      };
    case 'divider':
      return {
        color: '#d1d5db',
        backgroundColor: '#d1d5db',
        textAlign: 'left',
        fontWeight: 'normal',
        fontSize: 1,
        padding: 0,
        margin: 16,
        borderRadius: 0,
        width: '100%',
        height: 1,
      };
    case 'spacer':
      return {
        color: 'transparent',
        backgroundColor: 'transparent',
        textAlign: 'left',
        fontWeight: 'normal',
        fontSize: 1,
        padding: 0,
        margin: 0,
        borderRadius: 0,
        width: '100%',
        height: 32,
      };
    case 'footer':
      return {
        color: '#6b7280',
        backgroundColor: 'transparent',
        textAlign: 'left',
        fontWeight: 'normal',
        fontSize: 12,
        padding: 8,
        margin: 8,
        borderRadius: 0,
        width: '100%',
        height: 0,
      };
    default:
      return {
        color: '#111827',
        backgroundColor: 'transparent',
        textAlign: 'left',
        fontWeight: 'normal',
        fontSize: 14,
        padding: 8,
        margin: 8,
        borderRadius: 0,
        width: '100%',
        height: 0,
      };
  }
}

function replaceVariables(input: string, values: Record<string, string>): string {
  return TEMPLATE_VARIABLES.reduce((output, variable) => {
    const replacement = values[variable.key] || variable.defaultValue;
    return output.replaceAll(`{{${variable.key}}}`, replacement);
  }, input);
}

function generateHTML(
  templateName: string,
  subject: string,
  preheader: string,
  components: EmailComponent[],
  globalStyles: GlobalStyles,
  values: Record<string, string>
): string {
  const style = `
    body { margin: 0; padding: 0; background: ${globalStyles.backgroundColor}; font-family: ${globalStyles.fontFamily}; }
    .wrapper { width: 100%; padding: 24px 0; }
    .container { width: ${globalStyles.containerWidth}px; margin: 0 auto; background: #ffffff; }
    .block { box-sizing: border-box; }
  `;

  const blocks = components
    .map((component) => {
      const text = replaceVariables(component.content.text, values);
      const inlineBase = `
        color:${component.styles.color};
        background:${component.styles.backgroundColor};
        text-align:${component.styles.textAlign};
        font-weight:${component.styles.fontWeight};
        font-size:${component.styles.fontSize}px;
        padding:${component.styles.padding}px;
        margin:${component.styles.margin}px;
        border-radius:${component.styles.borderRadius}px;
      `.replace(/\s+/g, ' ');

      if (component.type === 'header') {
        return `<h1 class="block" style="${inlineBase}">${text}</h1>`;
      }

      if (component.type === 'text') {
        return `<p class="block" style="${inlineBase}; line-height:${globalStyles.lineHeight};">${text}</p>`;
      }

      if (component.type === 'button') {
        const href = component.content.url || '#';
        return `<div style="text-align:${component.styles.textAlign}; margin:${component.styles.margin}px;"><a href="${href}" style="${inlineBase}; text-decoration:none; display:inline-block;">${text}</a></div>`;
      }

      if (component.type === 'image') {
        const height = component.styles.height > 0 ? `height:${component.styles.height}px;` : '';
        return `<img class="block" src="${component.content.src}" alt="${component.content.alt}" style="${inlineBase}; width:${component.styles.width}; ${height} object-fit:cover; display:block;" />`;
      }

      if (component.type === 'divider') {
        return `<hr class="block" style="border:0; border-top:1px solid ${component.styles.backgroundColor}; margin:${component.styles.margin}px 0;" />`;
      }

      if (component.type === 'social') {
        return `<p class="block" style="${inlineBase}">${text}</p>`;
      }

      if (component.type === 'spacer') {
        return `<div class="block" style="height:${component.styles.height}px"></div>`;
      }

      return `<p class="block" style="${inlineBase}">${text}</p>`;
    })
    .join('\n');

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${templateName}</title>
    <style>${style}</style>
  </head>
  <body>
    <span style="display:none;color:transparent;opacity:0;height:0;width:0;">${preheader}</span>
    <div class="wrapper">
      <div class="container" aria-label="${subject}">
        ${blocks}
      </div>
    </div>
  </body>
</html>`;
}

function renderComponentPreview(component: EmailComponent): JSX.Element {
  const style: React.CSSProperties = {
    color: component.styles.color,
    backgroundColor: component.styles.backgroundColor,
    textAlign: component.styles.textAlign,
    fontWeight: component.styles.fontWeight,
    fontSize: component.styles.fontSize,
    padding: component.styles.padding,
    margin: component.styles.margin,
    borderRadius: component.styles.borderRadius,
  };

  if (component.type === 'header') {
    return <Typography sx={style}>{component.content.text}</Typography>;
  }

  if (component.type === 'text') {
    return <Typography sx={style}>{component.content.text}</Typography>;
  }

  if (component.type === 'button') {
    return (
      <Button href={component.content.url} sx={style} variant="contained">
        {component.content.text}
      </Button>
    );
  }

  if (component.type === 'image') {
    return (
      <Box
        component="img"
        src={component.content.src}
        alt={component.content.alt}
        sx={{
          ...style,
          width: component.styles.width,
          height: component.styles.height || 'auto',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    );
  }

  if (component.type === 'divider') {
    return <Divider sx={{ borderColor: component.styles.backgroundColor, my: component.styles.margin / 8 }} />;
  }

  if (component.type === 'spacer') {
    return <Box sx={{ height: component.styles.height }} />;
  }

  return <Typography sx={style}>{component.content.text}</Typography>;
}

export default function EmailDesignerImproved({ profession = 'photographer' }: EmailDesignerImprovedProps): JSX.Element {
  const queryClient = useQueryClient();
  const theming = useTheming(profession);

  const [components, setComponents] = useState<EmailComponent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<EmailComponent[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [globalStyles, setGlobalStyles] = useState<GlobalStyles>(DEFAULT_GLOBAL_STYLES);
  const [templateName, setTemplateName] = useState('New Email Template');
  const [subject, setSubject] = useState('');
  const [preheader, setPreheader] = useState('');
  const [customVariables, setCustomVariables] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [showVariablesPanel, setShowVariablesPanel] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const selectedComponent = useMemo(
    () => components.find((component) => component.id === selectedId) ?? null,
    [components, selectedId]
  );

  const pushHistory = useCallback((nextComponents: EmailComponent[]) => {
    setHistory((previous) => [...previous.slice(0, historyIndex + 1), nextComponents]);
    setHistoryIndex((previous) => previous + 1);
  }, [historyIndex]);

  const updateComponents = useCallback(
    (nextComponents: EmailComponent[]) => {
      setComponents(nextComponents);
      pushHistory(nextComponents);
    },
    [pushHistory]
  );

  const addComponent = useCallback(
    (type: ComponentType) => {
      const next = [
        ...components,
        {
          id: uniqueId(),
          type,
          content: defaultContent(type),
          styles: defaultStyles(type),
        },
      ];
      updateComponents(next);
      setSelectedId(next[next.length - 1].id);
    },
    [components, updateComponents]
  );

  const updateComponent = useCallback(
    (componentId: string, updater: (component: EmailComponent) => EmailComponent) => {
      const next = components.map((component) => (component.id === componentId ? updater(component) : component));
      updateComponents(next);
    },
    [components, updateComponents]
  );

  const deleteComponent = useCallback(
    (componentId: string) => {
      const next = components.filter((component) => component.id !== componentId);
      updateComponents(next);
      if (selectedId === componentId) {
        setSelectedId(next[0]?.id ?? null);
      }
    },
    [components, selectedId, updateComponents]
  );

  const moveComponent = useCallback(
    (componentId: string, direction: -1 | 1) => {
      const index = components.findIndex((component) => component.id === componentId);
      if (index < 0) {
        return;
      }

      const target = index + direction;
      if (target < 0 || target >= components.length) {
        return;
      }

      const next = [...components];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      updateComponents(next);
    },
    [components, updateComponents]
  );

  const undo = useCallback(() => {
    if (historyIndex <= 0) {
      return;
    }
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    setComponents(history[nextIndex]);
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) {
      return;
    }
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    setComponents(history[nextIndex]);
  }, [history, historyIndex]);

  const saveMutation = useMutation<unknown, Error, EmailTemplatePayload>({
    mutationFn: async (payload) => {
      return apiRequest('/api/email-templates', {
        method: 'POST',
        body: payload,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/email-templates'] });
      setStatusMessage('Template saved successfully.');
    },
    onError: () => {
      setStatusMessage('Save failed. Template kept locally.');
    },
  });

  const previewHtml = useMemo(
    () => generateHTML(templateName, subject, preheader, components, globalStyles, customVariables),
    [components, customVariables, globalStyles, preheader, subject, templateName]
  );

  const saveTemplate = () => {
    saveMutation.mutate({
      name: templateName,
      category: 'custom',
      subject,
      preheader,
      components,
      globalStyles,
    });
  };

  const exportHtml = () => {
    const blob = new Blob([previewHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${templateName.replace(/\s+/g, '-').toLowerCase() || 'email-template'}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const insertVariable = (variableKey: string) => {
    if (!selectedComponent) {
      setStatusMessage('Select a component before inserting variables.');
      return;
    }

    if (selectedComponent.type === 'image' || selectedComponent.type === 'divider' || selectedComponent.type === 'spacer') {
      setStatusMessage('Selected component does not support text variables.');
      return;
    }

    updateComponent(selectedComponent.id, (component) => ({
      ...component,
      content: {
        ...component.content,
        text: `${component.content.text} {{${variableKey}}}`.trim(),
      },
    }));
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f6f7f9' }}>
      <Paper elevation={2} sx={{ borderRadius: 0, p: 1.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: theming.colors.primary }}>
              Email Designer
            </Typography>
            <Chip size="small" label={`${components.length} block(s)`} />
          </Stack>

          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Tooltip title="Undo">
              <span>
                <IconButton onClick={undo} disabled={historyIndex <= 0}>
                  <Undo />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Redo">
              <span>
                <IconButton onClick={redo} disabled={historyIndex >= history.length - 1}>
                  <Redo />
                </IconButton>
              </span>
            </Tooltip>

            <Divider orientation="vertical" flexItem />

            <Button size="small" startIcon={<Code />} onClick={() => setShowVariablesPanel((previous) => !previous)}>
              Variables
            </Button>
            <Button size="small" startIcon={<Preview />} onClick={() => setShowPreview(true)}>
              Preview
            </Button>
            <Button size="small" startIcon={<Save />} variant="contained" onClick={saveTemplate}>
              Save
            </Button>
            <Button size="small" variant="outlined" onClick={exportHtml}>
              Export HTML
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {statusMessage ? (
        <Alert severity={statusMessage.includes('failed') ? 'error' : 'success'} onClose={() => setStatusMessage('')}>
          {statusMessage}
        </Alert>
      ) : null}

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Paper sx={{ width: 240, borderRadius: 0, p: 1.5, overflow: 'auto' }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Components
          </Typography>
          <Stack spacing={1}>
            {COMPONENT_PRESETS.map((preset) => (
              <Tooltip key={preset.id} title={preset.description} placement="right">
                <Button
                  variant="outlined"
                  startIcon={<span>{preset.icon}</span>}
                  onClick={() => addComponent(preset.id)}
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                >
                  {preset.name}
                </Button>
              </Tooltip>
            ))}
          </Stack>

          <Divider sx={{ my: 1.5 }} />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Template Meta
          </Typography>
          <Stack spacing={1}>
            <TextField size="small" label="Template Name" value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
            <TextField size="small" label="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
            <TextField size="small" label="Preheader" value={preheader} onChange={(event) => setPreheader(event.target.value)} />
          </Stack>

          <Divider sx={{ my: 1.5 }} />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Global Styles
          </Typography>
          <Stack spacing={1}>
            <TextField
              size="small"
              label="Container Width"
              type="number"
              value={globalStyles.containerWidth}
              onChange={(event) =>
                setGlobalStyles((previous) => ({
                  ...previous,
                  containerWidth: Number.parseInt(event.target.value, 10) || 640,
                }))
              }
            />
            <TextField
              size="small"
              label="Font Family"
              value={globalStyles.fontFamily}
              onChange={(event) => setGlobalStyles((previous) => ({ ...previous, fontFamily: event.target.value }))}
            />
            <TextField
              size="small"
              label="Background"
              value={globalStyles.backgroundColor}
              onChange={(event) =>
                setGlobalStyles((previous) => ({
                  ...previous,
                  backgroundColor: event.target.value,
                }))
              }
            />
          </Stack>
        </Paper>

        <Box sx={{ flex: 1, p: 2, overflow: 'auto', bgcolor: '#dde2ea' }}>
          <Paper sx={{ width: globalStyles.containerWidth, mx: 'auto', p: 2, minHeight: 520, bgcolor: '#ffffff' }}>
            {components.length === 0 ? (
              <Box sx={{ p: 4, border: '2px dashed #c2c7d0', textAlign: 'center', borderRadius: 2 }}>
                <Typography color="text.secondary">Add components from the left panel.</Typography>
              </Box>
            ) : (
              components.map((component) => (
                <Paper
                  key={component.id}
                  variant="outlined"
                  sx={{
                    mb: 1,
                    p: 1,
                    borderColor: selectedId === component.id ? 'primary.main' : '#d1d5db',
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
                    <Chip size="small" label={component.type} />
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Move Up">
                        <span>
                          <IconButton size="small" onClick={() => moveComponent(component.id, -1)}>
                            <ArrowUpward fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Move Down">
                        <span>
                          <IconButton size="small" onClick={() => moveComponent(component.id, 1)}>
                            <ArrowDownward fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => setSelectedId(component.id)}>
                          <Settings fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => deleteComponent(component.id)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>

                  {renderComponentPreview(component)}
                </Paper>
              ))
            )}
          </Paper>
        </Box>

        {selectedComponent ? (
          <Paper sx={{ width: 320, borderRadius: 0, p: 1.5, overflow: 'auto' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Component Properties
            </Typography>

            <Stack spacing={1}>
              {selectedComponent.type !== 'image' && selectedComponent.type !== 'divider' && selectedComponent.type !== 'spacer' ? (
                <TextField
                  label="Text"
                  multiline
                  minRows={3}
                  value={selectedComponent.content.text}
                  onChange={(event) =>
                    updateComponent(selectedComponent.id, (component) => ({
                      ...component,
                      content: { ...component.content, text: event.target.value },
                    }))
                  }
                />
              ) : null}

              {selectedComponent.type === 'image' ? (
                <>
                  <TextField
                    label="Image URL"
                    value={selectedComponent.content.src}
                    onChange={(event) =>
                      updateComponent(selectedComponent.id, (component) => ({
                        ...component,
                        content: { ...component.content, src: event.target.value },
                      }))
                    }
                  />
                  <TextField
                    label="Alt text"
                    value={selectedComponent.content.alt}
                    onChange={(event) =>
                      updateComponent(selectedComponent.id, (component) => ({
                        ...component,
                        content: { ...component.content, alt: event.target.value },
                      }))
                    }
                  />
                </>
              ) : null}

              {selectedComponent.type === 'button' ? (
                <TextField
                  label="Button URL"
                  value={selectedComponent.content.url}
                  onChange={(event) =>
                    updateComponent(selectedComponent.id, (component) => ({
                      ...component,
                      content: { ...component.content, url: event.target.value },
                    }))
                  }
                />
              ) : null}

              <TextField
                label="Text Color"
                value={selectedComponent.styles.color}
                onChange={(event) =>
                  updateComponent(selectedComponent.id, (component) => ({
                    ...component,
                    styles: { ...component.styles, color: event.target.value },
                  }))
                }
              />
              <TextField
                label="Background"
                value={selectedComponent.styles.backgroundColor}
                onChange={(event) =>
                  updateComponent(selectedComponent.id, (component) => ({
                    ...component,
                    styles: { ...component.styles, backgroundColor: event.target.value },
                  }))
                }
              />
              <TextField
                label="Font Size"
                type="number"
                value={selectedComponent.styles.fontSize}
                onChange={(event) =>
                  updateComponent(selectedComponent.id, (component) => ({
                    ...component,
                    styles: {
                      ...component.styles,
                      fontSize: Number.parseInt(event.target.value, 10) || 14,
                    },
                  }))
                }
              />
              <TextField
                label="Padding"
                type="number"
                value={selectedComponent.styles.padding}
                onChange={(event) =>
                  updateComponent(selectedComponent.id, (component) => ({
                    ...component,
                    styles: {
                      ...component.styles,
                      padding: Number.parseInt(event.target.value, 10) || 0,
                    },
                  }))
                }
              />
              <TextField
                label="Margin"
                type="number"
                value={selectedComponent.styles.margin}
                onChange={(event) =>
                  updateComponent(selectedComponent.id, (component) => ({
                    ...component,
                    styles: {
                      ...component.styles,
                      margin: Number.parseInt(event.target.value, 10) || 0,
                    },
                  }))
                }
              />
              <TextField
                label="Border Radius"
                type="number"
                value={selectedComponent.styles.borderRadius}
                onChange={(event) =>
                  updateComponent(selectedComponent.id, (component) => ({
                    ...component,
                    styles: {
                      ...component.styles,
                      borderRadius: Number.parseInt(event.target.value, 10) || 0,
                    },
                  }))
                }
              />
            </Stack>
          </Paper>
        ) : null}

        {showVariablesPanel ? (
          <Paper sx={{ width: 330, borderRadius: 0, p: 1.5, overflow: 'auto' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Variables
            </Typography>
            <Alert severity="info" sx={{ mb: 1 }}>
              Insert tokens like {'{{user_name}}'} into text components.
            </Alert>

            {(['user', 'project', 'business', 'custom'] as const).map((category) => (
              <Box key={category} sx={{ mb: 1.5 }}>
                <Typography variant="caption" sx={{ textTransform: 'uppercase', color: 'text.secondary' }}>
                  {category}
                </Typography>
                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                  {TEMPLATE_VARIABLES.filter((item) => item.category === category).map((variable) => (
                    <Button
                      key={variable.key}
                      size="small"
                      variant="outlined"
                      onClick={() => insertVariable(variable.key)}
                      sx={{ justifyContent: 'space-between', textTransform: 'none' }}
                      endIcon={<Add />}
                    >
                      {variable.label}
                    </Button>
                  ))}
                </Stack>
              </Box>
            ))}

            <Divider sx={{ my: 1 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Preview Values
            </Typography>
            <Stack spacing={1}>
              {TEMPLATE_VARIABLES.map((variable) => (
                <TextField
                  key={`value-${variable.key}`}
                  size="small"
                  label={variable.label}
                  value={customVariables[variable.key] ?? ''}
                  onChange={(event) =>
                    setCustomVariables((previous) => ({
                      ...previous,
                      [variable.key]: event.target.value,
                    }))
                  }
                  placeholder={variable.defaultValue}
                />
              ))}
            </Stack>
          </Paper>
        ) : null}
      </Box>

      <Dialog open={showPreview} onClose={() => setShowPreview(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Email Preview</DialogTitle>
        <DialogContent>
          <Paper sx={{ p: 1.5, bgcolor: '#f2f4f7' }}>
            <iframe
              title="email-preview"
              srcDoc={previewHtml}
              style={{ width: '100%', height: '70vh', border: '1px solid #d0d7de', borderRadius: 8 }}
            />
          </Paper>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
