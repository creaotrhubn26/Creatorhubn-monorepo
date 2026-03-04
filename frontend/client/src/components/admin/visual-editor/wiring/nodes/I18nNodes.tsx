/**
 * i18n Nodes
 * Nodes for internationalization and translations
 */

import React, { memo } from 'react';
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
  IconButton,
  Alert,
} from '@mui/material';
import {
  Translate,
  Language,
  FormatListNumbered,
  DateRange,
  AttachMoney,
  TextFormat,
  Flag,
} from '@mui/icons-material';
import type { NodeConfig } from './BaseNode';
import { BaseNode } from './BaseNode';

const getBooleanValue = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

const getStringValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const getStringArrayValue = (value: unknown, fallback: string[] = []): string[] => {
  if (!Array.isArray(value)) {
    return fallback;
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
};

// Supported locales
const SUPPORTED_LOCALES = [
  { code: 'nb-NO', name: 'Norwegian Bokmål', flag: '🇳🇴' },
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
  { code: 'sv-SE', name: 'Swedish', flag: '🇸🇪' },
  { code: 'da-DK', name: 'Danish', flag: '🇩🇰' },
  { code: 'de-DE', name: 'German', flag: '🇩🇪' },
  { code: 'fr-FR', name: 'French', flag: '🇫🇷' },
  { code: 'es-ES', name: 'Spanish', flag: '🇪🇸' },
];

// Translation Key Node
export const TranslationKeyNode = memo(function TranslationKeyNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Translation',
        color: '#009688',
        icon: <Translate sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Translation Key"
            value={data.key || ''}
            onChange={(e) => onChange('key', e.target.value)}
            placeholder="common.buttons.submit"
            sx={{ mb: 1 }}
          />

          <TextField
            fullWidth
            size="small"
            label="Namespace"
            value={data.namespace || 'common'}
            onChange={(e) => onChange('namespace', e.target.value)}
            sx={{ mb: 1 }}
          />

          <TextField
            fullWidth
            size="small"
            label="Default Value (fallback)"
            value={data.defaultValue || ''}
            onChange={(e) => onChange('defaultValue', e.target.value)}
            placeholder="Submit"
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={getBooleanValue(data.returnKeyOnMissing)}
                onChange={(e) => onChange('returnKeyOnMissing', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Return key if missing</Typography>}
          />

          <Alert severity="info" sx={{ mt: 1, py: 0 }}>
            <Typography variant="caption">
              {`Uses i18next: t('${getStringValue(data.namespace, 'common')}:${getStringValue(data.key, 'key')}')`}
            </Typography>
          </Alert>
        </Box>
      )}
      {...props}
    />
  );
});

// Locale Node
export const LocaleNode = memo(function LocaleNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Locale',
        color: '#009688',
        icon: <Language sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Current Locale</InputLabel>
            <Select
              value={data.locale || 'nb-NO'}
              onChange={(e) => onChange('locale', e.target.value)}
              label="Current Locale"
            >
              {SUPPORTED_LOCALES.map((loc) => (
                <MenuItem key={loc.code} value={loc.code}>
                  {loc.flag} {loc.name} ({loc.code})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Source</InputLabel>
            <Select
              value={data.source || 'auto'}
              onChange={(e) => onChange('source', e.target.value)}
              label="Source"
            >
              <MenuItem value="auto">Auto-detect (browser)</MenuItem>
              <MenuItem value="localStorage">Local Storage</MenuItem>
              <MenuItem value="url">URL Parameter</MenuItem>
              <MenuItem value="cookie">Cookie</MenuItem>
              <MenuItem value="manual">Manual</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={data.persist !== false}
                onChange={(e) => onChange('persist', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Persist selection</Typography>}
          />

          <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap' }}>
            {SUPPORTED_LOCALES.slice(0, 4).map((loc) => (
              <Chip
                key={loc.code}
                size="small"
                label={loc.flag}
                onClick={() => onChange('locale', loc.code)}
                variant={data.locale === loc.code ? 'filled' : 'outlined'}
                sx={{
                  bgcolor: data.locale === loc.code ? 'rgba(0,150,136,0.2)' : 'transparent',
                  borderColor: '#009688',
                }}
              />
            ))}
          </Stack>
        </Box>
      )}
      {...props}
    />
  );
});

// Plural Node
export const PluralNode = memo(function PluralNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Plural',
        color: '#009688',
        icon: <FormatListNumbered sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Singular"
            value={data.singular || ''}
            onChange={(e) => onChange('singular', e.target.value)}
            placeholder="{{count}} item"
            sx={{ mb: 1 }}
          />

          <TextField
            fullWidth
            size="small"
            label="Plural"
            value={data.plural || ''}
            onChange={(e) => onChange('plural', e.target.value)}
            placeholder="{{count}} items"
            sx={{ mb: 1 }}
          />

          <TextField
            fullWidth
            size="small"
            label="Zero (optional)"
            value={data.zero || ''}
            onChange={(e) => onChange('zero', e.target.value)}
            placeholder="No items"
            sx={{ mb: 1 }}
          />

          <Typography variant="caption" color="rgba(255,255,255,0.5)">
            Connect count to input for automatic selection
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Format Date Node
export const FormatDateNode = memo(function FormatDateNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Format Date',
        color: '#009688',
        icon: <DateRange sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Format</InputLabel>
            <Select
              value={data.format || 'short'}
              onChange={(e) => onChange('format', e.target.value)}
              label="Format"
            >
              <MenuItem value="short">Short (01/15/24)</MenuItem>
              <MenuItem value="medium">Medium (Jan 15, 2024)</MenuItem>
              <MenuItem value="long">Long (January 15, 2024)</MenuItem>
              <MenuItem value="full">Full (Monday, January 15, 2024)</MenuItem>
              <MenuItem value="relative">Relative (2 days ago)</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </Select>
          </FormControl>

          {data.format === 'custom' && (
            <TextField
              fullWidth
              size="small"
              label="Custom Format"
              value={data.customFormat || ''}
              onChange={(e) => onChange('customFormat', e.target.value)}
              placeholder="dd.MM.yyyy HH:mm"
              sx={{ mb: 1 }}
            />
          )}

          <FormControlLabel
            control={
              <Switch
                checked={getBooleanValue(data.includeTime)}
                onChange={(e) => onChange('includeTime', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Include time</Typography>}
          />

          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mt: 1, display: 'block' }}>
            {`Formats using current locale: ${getStringValue(data.locale, 'nb-NO')}`}
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Format Currency Node
export const FormatCurrencyNode = memo(function FormatCurrencyNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Format Currency',
        color: '#009688',
        icon: <AttachMoney sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Currency</InputLabel>
            <Select
              value={data.currency || 'NOK'}
              onChange={(e) => onChange('currency', e.target.value)}
              label="Currency"
            >
              <MenuItem value="NOK">🇳🇴 NOK (Norwegian Krone)</MenuItem>
              <MenuItem value="USD">🇺🇸 USD (US Dollar)</MenuItem>
              <MenuItem value="EUR">🇪🇺 EUR (Euro)</MenuItem>
              <MenuItem value="GBP">🇬🇧 GBP (British Pound)</MenuItem>
              <MenuItem value="SEK">🇸🇪 SEK (Swedish Krona)</MenuItem>
              <MenuItem value="DKK">🇩🇰 DKK (Danish Krone)</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Display</InputLabel>
            <Select
              value={data.display || 'symbol'}
              onChange={(e) => onChange('display', e.target.value)}
              label="Display"
            >
              <MenuItem value="symbol">Symbol (kr, $, €)</MenuItem>
              <MenuItem value="code">Code (NOK, USD)</MenuItem>
              <MenuItem value="name">Name (Norwegian kroner)</MenuItem>
              <MenuItem value="narrowSymbol">Narrow Symbol</MenuItem>
            </Select>
          </FormControl>

          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              type="number"
              label="Min Decimals"
              value={data.minDecimals ?? 0}
              onChange={(e) => onChange('minDecimals', parseInt(e.target.value))}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              type="number"
              label="Max Decimals"
              value={data.maxDecimals ?? 2}
              onChange={(e) => onChange('maxDecimals', parseInt(e.target.value))}
              sx={{ flex: 1 }}
            />
          </Stack>
        </Box>
      )}
      {...props}
    />
  );
});

// Format Number Node
export const FormatNumberNode = memo(function FormatNumberNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Format Number',
        color: '#009688',
        icon: <TextFormat sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Style</InputLabel>
            <Select
              value={data.style || 'decimal'}
              onChange={(e) => onChange('style', e.target.value)}
              label="Style"
            >
              <MenuItem value="decimal">Decimal (1,234.56)</MenuItem>
              <MenuItem value="percent">Percent (12.3%)</MenuItem>
              <MenuItem value="unit">Unit (12 kg)</MenuItem>
              <MenuItem value="compact">Compact (1.2K)</MenuItem>
            </Select>
          </FormControl>

          {data.style === 'unit' && (
            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
              <InputLabel>Unit</InputLabel>
              <Select
                value={data.unit || 'kilogram'}
                onChange={(e) => onChange('unit', e.target.value)}
                label="Unit"
              >
                <MenuItem value="kilogram">Kilogram (kg)</MenuItem>
                <MenuItem value="meter">Meter (m)</MenuItem>
                <MenuItem value="kilometer">Kilometer (km)</MenuItem>
                <MenuItem value="liter">Liter (L)</MenuItem>
                <MenuItem value="celsius">Celsius (°C)</MenuItem>
                <MenuItem value="percent">Percent (%)</MenuItem>
              </Select>
            </FormControl>
          )}

          <FormControlLabel
            control={
              <Switch
                checked={data.useGrouping !== false}
                onChange={(e) => onChange('useGrouping', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Use grouping (1,000)</Typography>}
          />
        </Box>
      )}
      {...props}
    />
  );
});

// Language Switcher Node
export const LanguageSwitcherNode = memo(function LanguageSwitcherNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Language Switcher',
        color: '#009688',
        icon: <Flag sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mb: 1, display: 'block' }}>
            Available Languages:
          </Typography>

          <Stack spacing={0.5} sx={{ mb: 1 }}>
            {SUPPORTED_LOCALES.map((loc) => (
              <FormControlLabel
                key={loc.code}
                control={
                  <Switch
                    checked={getStringArrayValue(data.enabledLocales, ['nb-NO', 'en-US']).includes(loc.code)}
                    onChange={(e) => {
                      const current = getStringArrayValue(data.enabledLocales, ['nb-NO', 'en-US']);
                      const updated = e.target.checked
                        ? [...current, loc.code]
                        : current.filter((c) => c !== loc.code);
                      onChange('enabledLocales', updated);
                    }}
                    size="small"
                  />
                }
                label={
                  <Typography variant="caption">
                    {loc.flag} {loc.name}
                  </Typography>
                }
              />
            ))}
          </Stack>

          <FormControl fullWidth size="small">
            <InputLabel>Display Style</InputLabel>
            <Select
              value={data.displayStyle || 'flag'}
              onChange={(e) => onChange('displayStyle', e.target.value)}
              label="Display Style"
            >
              <MenuItem value="flag">Flag Only</MenuItem>
              <MenuItem value="code">Code (NO, EN)</MenuItem>
              <MenuItem value="name">Full Name</MenuItem>
              <MenuItem value="flagCode">Flag + Code</MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}
      {...props}
    />
  );
});

// Node definitions
export const I18N_NODE_DEFINITIONS = [
  {
    type: 'TranslationKeyNode',
    name: 'Translation',
    category: 'i18n',
    description: 'Get translated text',
    icon: <Translate />,
    color: '#009688',
    inputs: [
      { id: 'variables', name: 'variables', type: 'input' as const, dataType: 'object' as const },
    ],
    outputs: [
      { id: 'text', name: 'text', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { key: '', namespace: 'common', defaultValue: '' },
    component: TranslationKeyNode,
  },
  {
    type: 'LocaleNode',
    name: 'Locale',
    category: 'i18n',
    description: 'Current locale/language',
    icon: <Language />,
    color: '#009688',
    inputs: [
      { id: 'setLocale', name: 'setLocale', type: 'input' as const, dataType: 'string' as const },
    ],
    outputs: [
      { id: 'locale', name: 'locale', type: 'output' as const, dataType: 'string' as const },
      { id: 'language', name: 'language', type: 'output' as const, dataType: 'string' as const },
      { id: 'region', name: 'region', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { locale: 'nb-NO', source: 'auto', persist: true },
    component: LocaleNode,
  },
  {
    type: 'PluralNode',
    name: 'Plural',
    category: 'i18n',
    description: 'Pluralization rules',
    icon: <FormatListNumbered />,
    color: '#009688',
    inputs: [
      { id: 'count', name: 'count', type: 'input' as const, dataType: 'number' as const },
    ],
    outputs: [
      { id: 'text', name: 'text', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { singular: '', plural: ', ', zero: '' },
    component: PluralNode,
  },
  {
    type: 'FormatDateNode',
    name: 'Format Date',
    category: 'i18n',
    description: 'Locale-aware date formatting',
    icon: <DateRange />,
    color: '#009688',
    inputs: [
      { id: 'date', name: 'date', type: 'input' as const, dataType: 'date' as const },
    ],
    outputs: [
      { id: 'formatted', name: 'formatted', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { format: 'medium', includeTime: false },
    component: FormatDateNode,
  },
  {
    type: 'FormatCurrencyNode',
    name: 'Format Currency',
    category: 'i18n',
    description: 'Locale-aware currency formatting',
    icon: <AttachMoney />,
    color: '#009688',
    inputs: [
      { id: 'amount', name: 'amount', type: 'input' as const, dataType: 'number' as const },
    ],
    outputs: [
      { id: 'formatted', name: 'formatted', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { currency: 'NOK', display: 'symbol', minDecimals: 0, maxDecimals: 2 },
    component: FormatCurrencyNode,
  },
  {
    type: 'FormatNumberNode',
    name: 'Format Number',
    category: 'i18n',
    description: 'Locale-aware number formatting',
    icon: <TextFormat />,
    color: '#009688',
    inputs: [
      { id: 'number', name: 'number', type: 'input' as const, dataType: 'number' as const },
    ],
    outputs: [
      { id: 'formatted', name: 'formatted', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { style: 'decimal', useGrouping: true },
    component: FormatNumberNode,
  },
  {
    type: 'LanguageSwitcherNode',
    name: 'Language Switcher',
    category: 'i18n',
    description: 'UI component for switching languages',
    icon: <Flag />,
    color: '#009688',
    inputs: [],
    outputs: [
      { id: 'component', name: 'component', type: 'output' as const, dataType: 'any' as const },
      { id: 'selectedLocale', name: 'selectedLocale', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { enabledLocales: ['nb-NO', 'en-US'], displayStyle: 'flag' },
    component: LanguageSwitcherNode,
  },
];

export default I18N_NODE_DEFINITIONS;
