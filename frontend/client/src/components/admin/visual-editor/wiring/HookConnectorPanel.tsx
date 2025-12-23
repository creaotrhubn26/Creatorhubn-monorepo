/**
 * Hook Connector Panel
 * Visual interface for connecting React hooks to components
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Collapse,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Divider,
  Badge,
  Alert,
} from '@mui/material';
import {
  Search,
  ExpandMore,
  ExpandLess,
  Link,
  LinkOff,
  DataObject,
  Functions,
  Cached,
  Memory,
  Storage,
  Api,
  Psychology,
  Schedule,
  Layers,
  ContentCopy,
  Check,
  Info,
} from '@mui/icons-material';

// Hook definitions with types and descriptions
interface HookDefinition {
  name: string;
  category: string;
  description: string;
  returns: { name: string; type: string }[];
  params?: { name: string; type: string; optional?: boolean }[];
  example: string;
  source: 'react' | 'custom' | 'tanstack' | 'zustand';
}

const AVAILABLE_HOOKS: HookDefinition[] = [
  // React Core Hooks
  {
    name: 'useState',
    category: 'State',
    description: 'Declare a state variable',
    returns: [
      { name: 'state', type: 'T' },
      { name: 'setState', type: '(value: T) => void' },
    ],
    params: [{ name: 'initialValue', type: 'T', optional: true }],
    example: 'const [count, setCount] = useState(0)',
    source: 'react',
  },
  {
    name: 'useEffect',
    category: 'Effects',
    description: 'Perform side effects in components',
    returns: [],
    params: [
      { name: 'effect', type: '() => void | (() => void)' },
      { name: 'deps', type: 'any[]', optional: true },
    ],
    example: 'useEffect(() => { ... }, [deps])',
    source: 'react',
  },
  {
    name: 'useContext',
    category: 'Context',
    description: 'Subscribe to React context',
    returns: [{ name: 'value', type: 'T' }],
    params: [{ name: 'context', type: 'Context<T>' }],
    example: 'const theme = useContext(ThemeContext)',
    source: 'react',
  },
  {
    name: 'useRef',
    category: 'Refs',
    description: 'Create a mutable ref object',
    returns: [{ name: 'ref', type: 'MutableRefObject<T>' }],
    params: [{ name: 'initialValue', type: 'T' }],
    example: 'const inputRef = useRef<HTMLInputElement>(null)',
    source: 'react',
  },
  {
    name: 'useMemo',
    category: 'Performance',
    description: 'Memoize expensive calculations',
    returns: [{ name: 'value', type: 'T' }],
    params: [
      { name: 'factory', type: '() => T' },
      { name: 'deps', type: 'any[]' },
    ],
    example: 'const memoized = useMemo(() => compute(a, b), [a, b])',
    source: 'react',
  },
  {
    name: 'useCallback',
    category: 'Performance',
    description: 'Memoize callback functions',
    returns: [{ name: 'callback', type: 'T' }],
    params: [
      { name: 'callback', type: 'T' },
      { name: 'deps', type: 'any[]' },
    ],
    example: 'const handleClick = useCallback(() => {}, [deps])',
    source: 'react',
  },
  {
    name: 'useReducer',
    category: 'State',
    description: 'Manage complex state with reducer',
    returns: [
      { name: 'state', type: 'S' },
      { name: 'dispatch', type: '(action: A) => void' },
    ],
    params: [
      { name: 'reducer', type: '(state: S, action: A) => S' },
      { name: 'initialState', type: 'S' },
    ],
    example: 'const [state, dispatch] = useReducer(reducer, initialState)',
    source: 'react',
  },

  // TanStack Query Hooks
  {
    name: 'useQuery',
    category: 'Data Fetching',
    description: 'Fetch and cache data',
    returns: [
      { name: 'data', type: 'T | undefined' },
      { name: 'isLoading', type: 'boolean' },
      { name: 'error', type: 'Error | null' },
      { name: 'refetch', type: '() => void' },
    ],
    params: [{ name: 'options', type: 'UseQueryOptions' }],
    example: 'const { data, isLoading } = useQuery({ queryKey: [...], queryFn })',
    source: 'tanstack',
  },
  {
    name: 'useMutation',
    category: 'Data Fetching',
    description: 'Create/update/delete data',
    returns: [
      { name: 'mutate', type: '(variables: V) => void' },
      { name: 'isLoading', type: 'boolean' },
      { name: 'error', type: 'Error | null' },
      { name: 'data', type: 'T | undefined' },
    ],
    params: [{ name: 'options', type: 'UseMutationOptions' }],
    example: 'const { mutate } = useMutation({ mutationFn })',
    source: 'tanstack',
  },

  // Custom CreatorHub Hooks
  {
    name: 'useAuth',
    category: 'Authentication',
    description: 'Access authentication state',
    returns: [
      { name: 'user', type: 'User | null' },
      { name: 'isAuthenticated', type: 'boolean' },
      { name: 'login', type: '(credentials) => Promise<void>' },
      { name: 'logout', type: '() => Promise<void>' },
    ],
    example: 'const { user, isAuthenticated } = useAuth()',
    source: 'custom',
  },
  {
    name: 'usePageCustomizations',
    category: 'Visual Editor',
    description: 'Get page customizations',
    returns: [
      { name: 'sections', type: 'Record<string, PageSection>' },
      { name: 'styles', type: 'PageStyles' },
      { name: 'isLoading', type: 'boolean' },
    ],
    params: [{ name: 'pageId', type: 'string' }],
    example: 'const { sections } = usePageCustomizations("landing")',
    source: 'custom',
  },
  {
    name: 'useTheme',
    category: 'Theme',
    description: 'Access MUI theme',
    returns: [{ name: 'theme', type: 'Theme' }],
    example: 'const theme = useTheme()',
    source: 'custom',
  },
  {
    name: 'useMediaQuery',
    category: 'Responsive',
    description: 'Check media query match',
    returns: [{ name: 'matches', type: 'boolean' }],
    params: [{ name: 'query', type: 'string' }],
    example: 'const isMobile = useMediaQuery("(max-width: 600px)")',
    source: 'custom',
  },
  {
    name: 'useLocation',
    category: 'Routing',
    description: 'Access current location',
    returns: [{ name: 'location', type: 'string' }],
    example: 'const [location] = useLocation()',
    source: 'custom',
  },
];

// Category icons
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  State: <Memory />,
  Effects: <Schedule />,
  Context: <Layers />,
  Refs: <DataObject />,
  Performance: <Cached />,
  'Data Fetching': <Api />,
  Authentication: <Functions />,
  'Visual Editor': <Psychology />,
  Theme: <Storage />,
  Responsive: <Storage />,
  Routing: <Storage />,
};

interface HookConnectorPanelProps {
  onConnect: (hook: HookDefinition, returnValue: string) => void;
  connectedHooks?: { hookName: string; returnValue: string }[];
  targetComponent?: string;
}

export function HookConnectorPanel({
  onConnect,
  connectedHooks = [],
  targetComponent,
}: HookConnectorPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['State', 'Data Fetching']);
  const [copiedHook, setCopiedHook] = useState<string | null>(null);

  // Group hooks by category
  const hooksByCategory = useMemo(() => {
    const filtered = searchQuery
      ? AVAILABLE_HOOKS.filter(
          (h) =>
            h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            h.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : AVAILABLE_HOOKS;

    const grouped: Record<string, HookDefinition[]> = {};
    filtered.forEach((hook) => {
      if (!grouped[hook.category]) {
        grouped[hook.category] = [];
      }
      grouped[hook.category].push(hook);
    });
    return grouped;
  }, [searchQuery]);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  }, []);

  const isConnected = useCallback(
    (hookName: string, returnValue: string) => {
      return connectedHooks.some((c) => c.hookName === hookName && c.returnValue === returnValue);
    },
    [connectedHooks]
  );

  const handleCopyExample = useCallback((example: string, hookName: string) => {
    navigator.clipboard.writeText(example);
    setCopiedHook(hookName);
    setTimeout(() => setCopiedHook(null), 2000);
  }, []);

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'react':
        return '#61dafb';
      case 'tanstack':
        return '#ff4154';
      case 'zustand':
        return '#433e38';
      case 'custom':
        return '#ff6b00';
      default:
        return '#9e9e9e';
    }
  };

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
        <Typography variant="h6" color="white" gutterBottom>
          Hook Connector
        </Typography>
        {targetComponent && (
          <Chip
            size="small"
            label={`Target: ${targetComponent}`}
            sx={{ bgcolor: 'rgba(255,107,0,0.2)', color: '#ff6b00', mb: 1 }}
          />
        )}
        <TextField
          fullWidth
          size="small"
          placeholder="Search hooks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: 'rgba(255,255,255,0.5)' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.05)',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
            },
            '& input': { color: 'white' },
          }}
        />
      </Box>

      {/* Hook List */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        <List dense disablePadding>
          {Object.entries(hooksByCategory).map(([category, hooks]) => (
            <React.Fragment key={category}>
              <ListItemButton onClick={() => toggleCategory(category)} sx={{ borderRadius: 1 }}>
                <ListItemIcon sx={{ color: '#ff6b00', minWidth: 36 }}>
                  {CATEGORY_ICONS[category] || <Functions />}
                </ListItemIcon>
                <ListItemText
                  primary={category}
                  primaryTypographyProps={{ color: 'white', fontWeight: 'bold' }}
                />
                <Badge badgeContent={hooks.length} color="primary" sx={{ mr: 1 }} />
                {expandedCategories.includes(category) ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>

              <Collapse in={expandedCategories.includes(category)}>
                <List dense disablePadding sx={{ pl: 2 }}>
                  {hooks.map((hook) => (
                    <Paper
                      key={hook.name}
                      sx={{
                        mb: 1,
                        bgcolor: 'rgba(255,255,255,0.03)',
                        borderRadius: 1,
                        overflow: 'hidden',
                      }}
                    >
                      <ListItem
                        sx={{ flexDirection: 'column', alignItems: 'stretch', py: 1 }}
                      >
                        {/* Hook Header */}
                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 0.5 }}>
                          <Typography
                            variant="subtitle2"
                            color="white"
                            sx={{ fontFamily: 'monospace', flex: 1 }}
                          >
                            {hook.name}
                          </Typography>
                          <Chip
                            size="small"
                            label={hook.source}
                            sx={{
                              bgcolor: `${getSourceColor(hook.source)}20`,
                              color: getSourceColor(hook.source),
                              fontSize: '0.65rem',
                              height: 18,
                            }}
                          />
                          <Tooltip title="Copy example">
                            <IconButton
                              size="small"
                              onClick={() => handleCopyExample(hook.example, hook.name)}
                              sx={{ ml: 0.5 }}
                            >
                              {copiedHook === hook.name ? (
                                <Check sx={{ fontSize: 14, color: '#4caf50' }} />
                              ) : (
                                <ContentCopy sx={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }} />
                              )}
                            </IconButton>
                          </Tooltip>
                        </Box>

                        {/* Description */}
                        <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mb: 1 }}>
                          {hook.description}
                        </Typography>

                        {/* Parameters info */}
                        {hook.params && hook.params.length > 0 && (
                          <Box sx={{ mb: 0.5 }}>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Info sx={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }} />
                              <Typography variant="caption" color="rgba(255,255,255,0.3)">
                                Params: {hook.params.map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ')}
                              </Typography>
                            </Stack>
                          </Box>
                        )}

                        <Divider sx={{ my: 0.5, borderColor: 'rgba(255,255,255,0.05)' }} />

                        {/* Returns - Connectable outputs */}
                        {hook.returns.length > 0 && (
                          <Box sx={{ mb: 0.5 }}>
                            <Typography variant="caption" color="rgba(255,255,255,0.3)">
                              Returns:
                            </Typography>
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                              {hook.returns.map((ret) => (
                                <Tooltip key={ret.name} title={`Type: ${ret.type}`} placement="top">
                                  <Chip
                                    size="small"
                                    icon={
                                      isConnected(hook.name, ret.name) ? (
                                        <Link sx={{ fontSize: 12 }} />
                                      ) : (
                                        <LinkOff sx={{ fontSize: 12 }} />
                                      )
                                    }
                                    label={ret.name}
                                    onClick={() => onConnect(hook, ret.name)}
                                    sx={{
                                      bgcolor: isConnected(hook.name, ret.name)
                                        ? 'rgba(76,175,80,0.2)'
                                        : 'rgba(255,255,255,0.05)',
                                      color: isConnected(hook.name, ret.name) ? '#4caf50' : 'white',
                                      borderColor: isConnected(hook.name, ret.name)
                                        ? '#4caf50'
                                        : 'transparent',
                                      border: '1px solid',
                                      cursor: 'pointer',
                                      '&:hover': {
                                        bgcolor: 'rgba(255,107,0,0.2)',
                                        borderColor: '#ff6b00',
                                      },
                                    }}
                                  />
                                </Tooltip>
                              ))}
                            </Stack>
                          </Box>
                        )}

                        {/* Example */}
                        <Box
                          sx={{
                            bgcolor: 'rgba(0,0,0,0.3)',
                            p: 0.5,
                            borderRadius: 0.5,
                            fontFamily: 'monospace',
                            fontSize: '0.7rem',
                            color: 'rgba(255,255,255,0.6)',
                            overflow: 'auto',
                          }}
                        >
                          {hook.example}
                        </Box>
                      </ListItem>
                    </Paper>
                  ))}
                </List>
              </Collapse>
            </React.Fragment>
          ))}
        </List>

        {Object.keys(hooksByCategory).length === 0 && (
          <Alert severity="info" sx={{ bgcolor: 'rgba(33,150,243,0.1)' }}>
            No hooks found matching "{searchQuery}"
          </Alert>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ p: 1, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <Typography variant="caption" color="rgba(255,255,255,0.3)">
          Click on a return value to connect it to a component prop
        </Typography>
      </Box>
    </Paper>
  );
}

export default HookConnectorPanel;

