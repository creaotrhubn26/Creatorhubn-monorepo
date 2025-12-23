/**
 * AI-Powered Nodes
 * Nodes for AI suggestions, generation, and optimization
 */

import React, { memo, useState } from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Chip,
  Stack,
  Switch,
  FormControlLabel,
  Slider,
  Alert,
  LinearProgress,
  IconButton,
} from '@mui/material';
import {
  Psychology,
  AutoAwesome,
  Speed,
  Lightbulb,
  Code,
  Image,
  TextFields,
  SmartToy,
  Tune,
  Refresh,
} from '@mui/icons-material';
import { BaseNode, NodeConfig } from './BaseNode';

// AI Suggest Node
export const AISuggestNode = memo(function AISuggestNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: any) => void;
  [key: string]: any;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'AI Suggest',
        color: '#e91e63',
        icon: <Lightbulb sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Suggestion Type</InputLabel>
            <Select
              value={data.type || 'completion'}
              onChange={(e) => onChange('type', e.target.value)}
              label="Suggestion Type"
            >
              <MenuItem value="completion">Text Completion</MenuItem>
              <MenuItem value="improvement">Content Improvement</MenuItem>
              <MenuItem value="alternatives">Alternatives</MenuItem>
              <MenuItem value="summary">Summary</MenuItem>
              <MenuItem value="keywords">Keywords</MenuItem>
              <MenuItem value="translation">Translation Suggestion</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            size="small"
            label="Context/Prompt"
            value={data.prompt || ''}
            onChange={(e) => onChange('prompt', e.target.value)}
            placeholder="Describe what you want suggestions for..."
            multiline
            rows={2}
            sx={{ mb: 1 }}
          />

          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Model</InputLabel>
            <Select
              value={data.model || 'gpt-4'}
              onChange={(e) => onChange('model', e.target.value)}
              label="Model"
            >
              <MenuItem value="gpt-4">GPT-4 (Best quality)</MenuItem>
              <MenuItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Fast)</MenuItem>
              <MenuItem value="claude-3">Claude 3 (Balanced)</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="rgba(255,255,255,0.5)">
              Max Suggestions: {data.maxSuggestions || 3}
            </Typography>
            <Slider
              value={data.maxSuggestions || 3}
              onChange={(_, value) => onChange('maxSuggestions', value)}
              min={1}
              max={10}
              sx={{ color: '#e91e63' }}
            />
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={data.streaming !== false}
                onChange={(e) => onChange('streaming', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Stream results</Typography>}
          />
        </Box>
      )}
      {...props}
    />
  );
});

// AI Generate Node
export const AIGenerateNode = memo(function AIGenerateNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: any) => void;
  [key: string]: any;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'AI Generate',
        color: '#e91e63',
        icon: <AutoAwesome sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Generate</InputLabel>
            <Select
              value={data.generateType || 'text'}
              onChange={(e) => onChange('generateType', e.target.value)}
              label="Generate"
            >
              <MenuItem value="text">Text Content</MenuItem>
              <MenuItem value="code">Code</MenuItem>
              <MenuItem value="component">React Component</MenuItem>
              <MenuItem value="styles">CSS Styles</MenuItem>
              <MenuItem value="data">Mock Data</MenuItem>
              <MenuItem value="schema">Schema/Types</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            size="small"
            label="Prompt"
            value={data.prompt || ''}
            onChange={(e) => onChange('prompt', e.target.value)}
            placeholder="Describe what to generate..."
            multiline
            rows={3}
            sx={{ mb: 1 }}
          />

          {data.generateType === 'code' && (
            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
              <InputLabel>Language</InputLabel>
              <Select
                value={data.language || 'typescript'}
                onChange={(e) => onChange('language', e.target.value)}
                label="Language"
              >
                <MenuItem value="typescript">TypeScript</MenuItem>
                <MenuItem value="javascript">JavaScript</MenuItem>
                <MenuItem value="python">Python</MenuItem>
                <MenuItem value="sql">SQL</MenuItem>
                <MenuItem value="css">CSS</MenuItem>
              </Select>
            </FormControl>
          )}

          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="rgba(255,255,255,0.5)">
              Temperature: {data.temperature || 0.7}
            </Typography>
            <Slider
              value={data.temperature || 0.7}
              onChange={(_, value) => onChange('temperature', value)}
              min={0}
              max={1}
              step={0.1}
              sx={{ color: '#e91e63' }}
            />
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="caption" color="rgba(255,255,255,0.3)">Precise</Typography>
              <Typography variant="caption" color="rgba(255,255,255,0.3)">Creative</Typography>
            </Stack>
          </Box>

          <TextField
            fullWidth
            size="small"
            type="number"
            label="Max Tokens"
            value={data.maxTokens || 1000}
            onChange={(e) => onChange('maxTokens', parseInt(e.target.value))}
          />
        </Box>
      )}
      {...props}
    />
  );
});

// AI Optimize Node
export const AIOptimizeNode = memo(function AIOptimizeNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: any) => void;
  [key: string]: any;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'AI Optimize',
        color: '#e91e63',
        icon: <Speed sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Optimize For</InputLabel>
            <Select
              value={data.optimizeFor || 'performance'}
              onChange={(e) => onChange('optimizeFor', e.target.value)}
              label="Optimize For"
            >
              <MenuItem value="performance">Performance</MenuItem>
              <MenuItem value="readability">Readability</MenuItem>
              <MenuItem value="seo">SEO</MenuItem>
              <MenuItem value="accessibility">Accessibility</MenuItem>
              <MenuItem value="conversion">Conversion</MenuItem>
              <MenuItem value="mobile">Mobile Experience</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Input Type</InputLabel>
            <Select
              value={data.inputType || 'text'}
              onChange={(e) => onChange('inputType', e.target.value)}
              label="Input Type"
            >
              <MenuItem value="text">Text Content</MenuItem>
              <MenuItem value="code">Code</MenuItem>
              <MenuItem value="component">React Component</MenuItem>
              <MenuItem value="layout">Layout/Structure</MenuItem>
              <MenuItem value="image">Image (description)</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={data.explainChanges !== false}
                onChange={(e) => onChange('explainChanges', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Explain changes</Typography>}
          />

          <FormControlLabel
            control={
              <Switch
                checked={data.preserveIntent !== false}
                onChange={(e) => onChange('preserveIntent', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Preserve original intent</Typography>}
          />

          <Alert severity="info" sx={{ mt: 1, py: 0 }}>
            <Typography variant="caption">
              Outputs optimized version + diff + suggestions
            </Typography>
          </Alert>
        </Box>
      )}
      {...props}
    />
  );
});

// AI Code Assistant Node
export const AICodeAssistantNode = memo(function AICodeAssistantNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: any) => void;
  [key: string]: any;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Code Assistant',
        color: '#e91e63',
        icon: <Code sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Action</InputLabel>
            <Select
              value={data.action || 'explain'}
              onChange={(e) => onChange('action', e.target.value)}
              label="Action"
            >
              <MenuItem value="explain">Explain Code</MenuItem>
              <MenuItem value="refactor">Refactor</MenuItem>
              <MenuItem value="debug">Debug/Fix</MenuItem>
              <MenuItem value="test">Generate Tests</MenuItem>
              <MenuItem value="document">Add Documentation</MenuItem>
              <MenuItem value="convert">Convert (e.g., JS → TS)</MenuItem>
            </Select>
          </FormControl>

          {data.action === 'convert' && (
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>From</InputLabel>
                <Select
                  value={data.fromLang || 'javascript'}
                  onChange={(e) => onChange('fromLang', e.target.value)}
                  label="From"
                >
                  <MenuItem value="javascript">JavaScript</MenuItem>
                  <MenuItem value="typescript">TypeScript</MenuItem>
                  <MenuItem value="python">Python</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>To</InputLabel>
                <Select
                  value={data.toLang || 'typescript'}
                  onChange={(e) => onChange('toLang', e.target.value)}
                  label="To"
                >
                  <MenuItem value="javascript">JavaScript</MenuItem>
                  <MenuItem value="typescript">TypeScript</MenuItem>
                  <MenuItem value="python">Python</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          )}

          <TextField
            fullWidth
            size="small"
            label="Additional Context"
            value={data.context || ''}
            onChange={(e) => onChange('context', e.target.value)}
            placeholder="Any specific requirements..."
            multiline
            rows={2}
          />
        </Box>
      )}
      {...props}
    />
  );
});

// AI Image Analysis Node
export const AIImageAnalysisNode = memo(function AIImageAnalysisNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: any) => void;
  [key: string]: any;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Image Analysis',
        color: '#e91e63',
        icon: <Image sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Analysis Type</InputLabel>
            <Select
              value={data.analysisType || 'describe'}
              onChange={(e) => onChange('analysisType', e.target.value)}
              label="Analysis Type"
            >
              <MenuItem value="describe">Describe Image</MenuItem>
              <MenuItem value="extractText">Extract Text (OCR)</MenuItem>
              <MenuItem value="detectObjects">Detect Objects</MenuItem>
              <MenuItem value="detectFaces">Detect Faces</MenuItem>
              <MenuItem value="generateAlt">Generate Alt Text</MenuItem>
              <MenuItem value="colorPalette">Extract Colors</MenuItem>
              <MenuItem value="quality">Quality Analysis</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Model</InputLabel>
            <Select
              value={data.model || 'gpt-4-vision'}
              onChange={(e) => onChange('model', e.target.value)}
              label="Model"
            >
              <MenuItem value="gpt-4-vision">GPT-4 Vision</MenuItem>
              <MenuItem value="claude-3-vision">Claude 3 Vision</MenuItem>
              <MenuItem value="local">Local (FaceXFormer)</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={data.detailed || false}
                onChange={(e) => onChange('detailed', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Detailed analysis</Typography>}
          />

          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mt: 1, display: 'block' }}>
            Connect image URL or base64 to input
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// AI Text Enhancement Node
export const AITextEnhancementNode = memo(function AITextEnhancementNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: any) => void;
  [key: string]: any;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Text Enhancement',
        color: '#e91e63',
        icon: <TextFields sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Enhancement</InputLabel>
            <Select
              value={data.enhancement || 'grammar'}
              onChange={(e) => onChange('enhancement', e.target.value)}
              label="Enhancement"
            >
              <MenuItem value="grammar">Fix Grammar</MenuItem>
              <MenuItem value="tone">Adjust Tone</MenuItem>
              <MenuItem value="simplify">Simplify</MenuItem>
              <MenuItem value="expand">Expand/Elaborate</MenuItem>
              <MenuItem value="shorten">Shorten/Summarize</MenuItem>
              <MenuItem value="professional">Make Professional</MenuItem>
              <MenuItem value="casual">Make Casual</MenuItem>
            </Select>
          </FormControl>

          {data.enhancement === 'tone' && (
            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
              <InputLabel>Target Tone</InputLabel>
              <Select
                value={data.targetTone || 'professional'}
                onChange={(e) => onChange('targetTone', e.target.value)}
                label="Target Tone"
              >
                <MenuItem value="professional">Professional</MenuItem>
                <MenuItem value="friendly">Friendly</MenuItem>
                <MenuItem value="formal">Formal</MenuItem>
                <MenuItem value="casual">Casual</MenuItem>
                <MenuItem value="enthusiastic">Enthusiastic</MenuItem>
                <MenuItem value="empathetic">Empathetic</MenuItem>
              </Select>
            </FormControl>
          )}

          <FormControlLabel
            control={
              <Switch
                checked={data.preserveMeaning !== false}
                onChange={(e) => onChange('preserveMeaning', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Preserve original meaning</Typography>}
          />

          <FormControlLabel
            control={
              <Switch
                checked={data.showDiff || false}
                onChange={(e) => onChange('showDiff', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Show changes diff</Typography>}
          />
        </Box>
      )}
      {...props}
    />
  );
});

// AI Chat Node
export const AIChatNode = memo(function AIChatNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: any) => void;
  [key: string]: any;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'AI Chat',
        color: '#e91e63',
        icon: <SmartToy sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="System Prompt"
            value={data.systemPrompt || ''}
            onChange={(e) => onChange('systemPrompt', e.target.value)}
            placeholder="You are a helpful assistant..."
            multiline
            rows={2}
            sx={{ mb: 1 }}
          />

          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Model</InputLabel>
            <Select
              value={data.model || 'gpt-4'}
              onChange={(e) => onChange('model', e.target.value)}
              label="Model"
            >
              <MenuItem value="gpt-4">GPT-4</MenuItem>
              <MenuItem value="gpt-3.5-turbo">GPT-3.5 Turbo</MenuItem>
              <MenuItem value="claude-3-opus">Claude 3 Opus</MenuItem>
              <MenuItem value="claude-3-sonnet">Claude 3 Sonnet</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={data.maintainHistory !== false}
                onChange={(e) => onChange('maintainHistory', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Maintain conversation history</Typography>}
          />

          <TextField
            fullWidth
            size="small"
            type="number"
            label="Max History Messages"
            value={data.maxHistory || 10}
            onChange={(e) => onChange('maxHistory', parseInt(e.target.value))}
            sx={{ mt: 1 }}
          />
        </Box>
      )}
      {...props}
    />
  );
});

// Node definitions
export const AI_NODE_DEFINITIONS = [
  {
    type: 'AISuggestNode',
    name: 'AI Suggest',
    category: 'ai',
    description: 'Get AI-powered suggestions',
    icon: <Lightbulb />,
    color: '#e91e63',
    inputs: [
      { id: 'context', name: 'context', type: 'input' as const, dataType: 'any' as const },
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
    ],
    outputs: [
      { id: 'suggestions', name: 'suggestions', type: 'output' as const, dataType: 'array' as const },
      { id: 'loading', name: 'loading', type: 'output' as const, dataType: 'boolean' as const },
    ],
    defaultData: { type: 'completion', model: 'gpt-4', maxSuggestions: 3, streaming: true },
    component: AISuggestNode,
  },
  {
    type: 'AIGenerateNode',
    name: 'AI Generate',
    category: 'ai',
    description: 'Generate content with AI',
    icon: <AutoAwesome />,
    color: '#e91e63',
    inputs: [
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
      { id: 'context', name: 'context', type: 'input' as const, dataType: 'any' as const },
    ],
    outputs: [
      { id: 'result', name: 'result', type: 'output' as const, dataType: 'string' as const },
      { id: 'loading', name: 'loading', type: 'output' as const, dataType: 'boolean' as const },
      { id: 'error', name: 'error', type: 'output' as const, dataType: 'object' as const },
    ],
    defaultData: { generateType: 'text', temperature: 0.7, maxTokens: 1000 },
    component: AIGenerateNode,
  },
  {
    type: 'AIOptimizeNode',
    name: 'AI Optimize',
    category: 'ai',
    description: 'AI-powered optimization',
    icon: <Speed />,
    color: '#e91e63',
    inputs: [
      { id: 'input', name: 'input', type: 'input' as const, dataType: 'any' as const },
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
    ],
    outputs: [
      { id: 'optimized', name: 'optimized', type: 'output' as const, dataType: 'any' as const },
      { id: 'suggestions', name: 'suggestions', type: 'output' as const, dataType: 'array' as const },
      { id: 'diff', name: 'diff', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { optimizeFor: 'performance', inputType: 'text', explainChanges: true },
    component: AIOptimizeNode,
  },
  {
    type: 'AICodeAssistantNode',
    name: 'Code Assistant',
    category: 'ai',
    description: 'AI code assistant',
    icon: <Code />,
    color: '#e91e63',
    inputs: [
      { id: 'code', name: 'code', type: 'input' as const, dataType: 'string' as const },
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
    ],
    outputs: [
      { id: 'result', name: 'result', type: 'output' as const, dataType: 'string' as const },
      { id: 'explanation', name: 'explanation', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { action: 'explain' },
    component: AICodeAssistantNode,
  },
  {
    type: 'AIImageAnalysisNode',
    name: 'Image Analysis',
    category: 'ai',
    description: 'AI image analysis',
    icon: <Image />,
    color: '#e91e63',
    inputs: [
      { id: 'image', name: 'image', type: 'input' as const, dataType: 'any' as const },
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
    ],
    outputs: [
      { id: 'analysis', name: 'analysis', type: 'output' as const, dataType: 'object' as const },
      { id: 'description', name: 'description', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { analysisType: 'describe', model: 'gpt-4-vision', detailed: false },
    component: AIImageAnalysisNode,
  },
  {
    type: 'AITextEnhancementNode',
    name: 'Text Enhancement',
    category: 'ai',
    description: 'AI text enhancement',
    icon: <TextFields />,
    color: '#e91e63',
    inputs: [
      { id: 'text', name: 'text', type: 'input' as const, dataType: 'string' as const },
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
    ],
    outputs: [
      { id: 'enhanced', name: 'enhanced', type: 'output' as const, dataType: 'string' as const },
      { id: 'diff', name: 'diff', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { enhancement: 'grammar', preserveMeaning: true, showDiff: false },
    component: AITextEnhancementNode,
  },
  {
    type: 'AIChatNode',
    name: 'AI Chat',
    category: 'ai',
    description: 'Conversational AI',
    icon: <SmartToy />,
    color: '#e91e63',
    inputs: [
      { id: 'message', name: 'message', type: 'input' as const, dataType: 'string' as const },
      { id: 'send', name: 'send', type: 'input' as const, dataType: 'event' as const },
    ],
    outputs: [
      { id: 'response', name: 'response', type: 'output' as const, dataType: 'string' as const },
      { id: 'history', name: 'history', type: 'output' as const, dataType: 'array' as const },
      { id: 'loading', name: 'loading', type: 'output' as const, dataType: 'boolean' as const },
    ],
    defaultData: { model: 'gpt-4', maintainHistory: true, maxHistory: 10, systemPrompt: '' },
    component: AIChatNode,
  },
];

export default AI_NODE_DEFINITIONS;

