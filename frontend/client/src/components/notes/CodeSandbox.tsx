import { useTheming } from '../../utils/theming-helper';
import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
  Chip,
  Divider,
  Stack,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Refresh,
  Code,
  BugReport,
  CheckCircle,
  Error,
  Warning,
  Info,
  ExpandMore,
  ContentCopy,
  Download,
  Share,
  Settings,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

interface CodeSandboxProps {
  initialCode?: string;
  language?: string;
  theme?: 'light' | 'dark';
  showLineNumbers?: boolean;
  autoRun?: boolean;
  onCodeChange?: (code: string) => void;
  onRun?: (result: any) => void;
  onError?: (error: string) => void;
  className?: string
}

interface CodeResult {
  output: string;
  error?: string;
  executionTime: number;
  memoryUsage?: number
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`code-tabpanel-${index}`}
      aria-labelledby={`code-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
  );
}

const CodeSandbox: React.FC<CodeSandboxProps> = ({
  initialCode = '// Write your code here\nconsole.log("Hello, CreatorHub!");',
  language = 'javascript',
  theme = 'light',
  showLineNumbers = true,
  autoRun = false,
  onCodeChange,
  onRun,
  onError,
  className,
}) => {
  const [code, setCode] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');initialCode);
  const [result, setResult] = useState<CodeResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    fontSize:  14,
    tabSize:  2,
    wordWrap: true,
    minimap: true,
});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'warning' | 'info',});
  const [executionHistory, setExecutionHistory] = useState<CodeResult[]>([]);
  const [isCodeModified, setIsCodeModified] = useState(false);
  
  const codeRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const supportedLanguages = [
    { value: 'javascript', label: 'JavaScript', icon: 'code',},
    { value: 'typescript', label: 'TypeScript', icon: 'code',},
    { value: 'python', label: 'Python', icon: 'code',},
    { value: 'html', label: 'HTM', icon: 'code',},
    { value: 'css', label: 'CS', icon: 'code',},
    { value: 'json', label: 'JSO', icon: 'code',},
    { value: 'markdown', label: 'Markdown', icon: 'article',},
  ];

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    setIsCodeModified(true);
    onCodeChange?.(newCode);
};

  const executeCode = async () => {
    if (!code.trim()) return;

    setIsRunning(true);
    const startTime = Date.now();

    try {
      let output = '';
      let error = ', ';

      // Create a safe execution environment
      const iframe = iframeRef.current;
      if (iframe) {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(`
            <html>
              <head>
                <title>Code Execution</title>
                <style>
                  body { font-family: monospace; margin: 10px }
                  .output { background: #f5f5f5; padding: 10px; border-radius: 4px }
                  .error { background: #ffebee; color: #c62828; padding: 10px; border-radius: 4px }
                </style>
              </head>
              <body>
                <div id="output"></div>
                <script>
                  const originalConsole = console;
                  const output = document.getElementById('output');
                  
                  console.log = (...args) => {
                    const div = document.createElement('div');
                    div.textContent = args.join(', ');
                    div.className = 'output';
                    output.appendChild(div);
                };
                  
                  console.error = (...args) => {
                    const div = document.createElement('div');
                    div.textContent = args.join(', ');
                    div.className = 'error';
                    output.appendChild(div);
                };
                  
                  try {
                    ${language === 'javascript' ? code : `// Language: ${language}\n${code}`}
                } catch (e) {
                    console.error('Error: ', e.message);
                }
                </script>
              </body>
            </html>
          `);
          iframeDoc.close();
      }
    }

      // Simulate execution time
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

      const executionTime = Date.now() - startTime;
      const newResult: CodeResult = {
        output: output || 'Code executed successfully',
        error: error || undefined,
        executionTime,
        memoryUsage: Math.floor(Math.random() * 1000) + 10, // Simulated memory usage
    };

      setResult(newResult);
      setExecutionHistory(prev => [newResult, ...prev.slice(0, 9)]); // Keep last 10 executions
      setIsCodeModified(false);
      
      onRun?.(newResult);
      
      if (error) {
        onError?.(error);
        setSnackbar({ open: true, message: 'Code execution failed', severity: 'error',});
    } else {
        setSnackbar({ open: true, message: 'Code executed successfully', severity: 'success',});
    }

  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      const executionTime = Date.now() - startTime;
      
      const errorResult: CodeResult = {
        output:', ',
        error: errorMessage,
        executionTime,
    };

      setResult(errorResult);
      setExecutionHistory(prev => [errorResult, ...prev.slice(0, 9)]);
      
      onError?.(errorMessage);
      setSnackbar({ open: true, message: 'Code execution failed', severity: 'error',});
  } finally {
      setIsRunning(false);
  }
};

  const stopExecution = () => {
    setIsRunning(false);
    setSnackbar({ open: true, message: 'Execution stopped', severity: 'warning',});
};

  const resetCode = () => {
    setCode(initialCode);
    setResult(null);
    setIsCodeModified(false);
    setSnackbar({ open: true, message: 'Code reset', severity: 'info',});
};

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setSnackbar({ open: true, message: 'Code copied to clipboard', severity: 'success',});
};

  const downloadCode = () => {
    const blob = new Blob([code], { type: 'text/plain',});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${language}`;
    a.click();
    URL.revokeObjectURL(url);
    setSnackbar({ open: true, message: 'Code downloaded', severity: 'success',});
};

  const shareCode = () => {
    const shareData = {
      title: 'CreatorHub Code Sandbox',
      text: `Check out this code I wrote in CreatorHub:\n\n\`\`\`${language}\n${code}\n\`\`\``,
      url: window.location.href,
  };

    if (navigator.share) {
      navigator.share(shareData);
  } else {
      navigator.clipboard.writeText(shareData.text);
      setSnackbar({ open: true, message: 'Code shared to clipboard', severity: 'success',});
  }
};

  const getStatusIcon = () => {
    if (isRunning) return <CircularProgress size={20} />;
    if (result?.error) return <CREATOR_HUB_ICONS.error color="error" />;
    if (result && !result.error) return <CREATOR_HUB_ICONS.checkCircle color="success" />;
    return <CREATOR_HUB_ICONS.playArrow color="primary" />;
};

  const getStatusColor = () => {
    if (isRunning) return 'primary';
    if (result?.error) return 'error';
    if (result && !result.error) return 'success';
    return 'default';
};

  useEffect(() => {
    if (autoRun && code.trim()) {
      executeCode();
  }
}, [autoRun]);

  return (
    <Box className={className} sx={{ width: '100%', height: '100%'}}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.code />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Code Sandbox</Typography>
            <Chip 
              label={supportedLanguages.find(lang => lang.value === language)?.label || language}
              color="primary"
              size="small"
            />
            {isCodeModified && (
              <Chip 
                label="Modified" 
                color="warning" 
                size="small" 
                icon={<CREATOR_HUB_ICONS.warning />}
              />
            )}
          </Stack>
          
          <Stack direction="row" spacing={1}>
            <Tooltip title="Run Code">
              <IconButton 
                onClick={executeCode}
                disabled={isRunning || !code.trim()}
                color={getStatusColor()}
              >
                {getStatusIcon()}
              </IconButton>
            </Tooltip>
            
            {isRunning && (
              <Tooltip title="Stop Execution">
                <IconButton onClick={stopExecution} color="error">
                  <CREATOR_HUB_ICONS.stop />
                </IconButton>
              </Tooltip>
            )}
            
            <Tooltip title="Reset Code">
              <IconButton onClick={resetCode} disabled={isRunning}>
                <CREATOR_HUB_ICONS.refresh />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Copy Code">
              <IconButton onClick={copyCode} disabled={isRunning}>
                <CREATOR_HUB_ICONS.contentCopy />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Download Code">
              <IconButton onClick={downloadCode} disabled={isRunning}>
                <CREATOR_HUB_ICONS.download />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Share Code">
              <IconButton onClick={shareCode} disabled={isRunning}>
                <CREATOR_HUB_ICONS.share />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Settings">
              <IconButton onClick={() => setShowSettings(true)}>
                <CREATOR_HUB_ICONS.settings />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {/* Code Editor and Results */}
      <Paper elevation={1} sx={{ height: 'calc(100% - 120px)',  ...theming.getThemedCardSx() }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider'}}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Code Editor" icon={<CREATOR_HUB_ICONS.code />} />
            <Tab label="Output" icon={<CREATOR_HUB_ICONS.visibility />} />
            <Tab label="History" icon={<CREATOR_HUB_ICONS.assessment />} />
          </Tabs>
        </Box>

        <TabPanel value={activeTab} index={0}>
          <Box sx={{ height: 'calc(100% - 60px)'}}>
            <TextField
              ref={codeRef}
              multiline
              fullWidth
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="Write your code here..."
              variant="outlined"
              sx={{
                '& .MuiInputBase-root': {
                  fontFamily: 'monospace',
                  fontSize: settings.fontSize,
                  height: '100%',
              }, '& .MuiInputBase-input': {
                  height: '100% !important',
                  overflow: 'auto !important',
              }}}
              InputProps={{
                style: {
                  height: '100%',
                  alignItems: 'flex-start',
                  padding: '16px',
              }}}
            />
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Box sx={{ height: 'calc(100% - 60px, )', overflow: 'auto'}}>
            {result ? (
              <Box>
                {result.error ? (
                  <Alert severity="error" sx={{ mb:  2 }}>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>Execution Error</Typography>
                    <Typography>{result.error}</Typography>
                  </Alert>
                ) : (
                  <Alert severity="success" sx={{ mb:  2 }}>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>Execution Successful</Typography>
                    <Typography>Execution time: {result.executionTime}ms</Typography>
                    {result.memoryUsage && (
                      <Typography>Memory usage: {result.memoryUsage}KB</Typography>
                    )}
                  </Alert>
                )}
                
                <Paper sx={{ p: 2, bgcolor: 'grey.50',  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Output: </Typography>
                  <Box component="pre" sx={{ 
                    fontFamily: 'monospace', 
                    fontSize: '14px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'}}>
                    {result.output || 'No output generated'}
                  </Box>
                </Paper>
              </Box>
            ) : (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                height: '100%',
                color: 'text.secondary'
          }}>
                <CREATOR_HUB_ICONS.playArrow sx={{ fontSize:  48, mb:  2 }} />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>No output yet</Typography>
                <Typography>Click the run button to execute your code</Typography>
              </Box>
            )}
            
            {/* Hidden iframe for code execution */}
            <iframe
              ref={iframeRef}
              style={{ display: 'none'}}
              title="Code Execution"
            />
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Box sx={{ height: 'calc(100% - 60px, )', overflow: 'auto'}}>
            {executionHistory.length > 0 ? (
              <Stack spacing={2}>
                {executionHistory.map((execution, index) => (
                  <Accordion key={index}>
                    <AccordionSummary expandIcon={<CREATOR_HUB_ICONS.expandMore />}>
                      <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%'}}>
                        {execution.error ? (
                          <CREATOR_HUB_ICONS.error color="error" />
                        ) : (
                          <CREATOR_HUB_ICONS.checkCircle color="success" />
                        )}
                        <Typography variant="body2">
                          Execution #{executionHistory.length - index}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {execution.executionTime}ms
                        </Typography>
                        {execution.memoryUsage && (
                          <Typography variant="caption" color="text.secondary">
                            {execution.memoryUsage}KB
                          </Typography>
                        )}
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box>
                        {execution.error ? (
                          <Alert severity="error">
                            <Typography variant="body2">{execution.error}</Typography>
                          </Alert>
                        ) : (
                          <Box>
                            <Typography variant="body2" gutterBottom>Output: </Typography>
                            <Box component="pre" sx={{ 
                              fontFamily: 'monospace', 
                              fontSize: '12px',
                              bgcolor: 'grey.10',
                              p:  1,
                              borderRadius:  1,
                              whiteSpace: 'pre-wrap'}}>
                              {execution.output}
                            </Box>
                          </Box>
                        )}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Stack>
            ) : (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                height: '100%',
                color:'text.secondary'
          }}>
                <CREATOR_HUB_ICONS.assessment sx={{ fontSize:  48, mb:  2 }} />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>No execution history</Typography>
                <Typography>Run some code to see execution history</Typography>
              </Box>
            )}
          </Box>
        </TabPanel>
      </Paper>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Code Sandbox Settings</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt:  2 }}>
            <FormControl fullWidth>
              <InputLabel>Font Size</InputLabel>
              <Select
                value={settings.fontSize}
                onChange={(e) => setSettings(prev => ({ ...prev, fontSize: e.target.value as number }))}
              >
                <MenuItem value={12}>12px</MenuItem>
                <MenuItem value={14}>14px</MenuItem>
                <MenuItem value={16}>16px</MenuItem>
                <MenuItem value={18}>18px</MenuItem>
                <MenuItem value={20}>20px</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl fullWidth>
              <InputLabel>Tab Size</InputLabel>
              <Select
                value={settings.tabSize}
                onChange={(e) => setSettings(prev => ({ ...prev, tabSize: e.target.value as number }))}
              >
                <MenuItem value={2}>2 spaces</MenuItem>
                <MenuItem value={4}>4 spaces</MenuItem>
                <MenuItem value={8}>8 spaces</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert 
          severity={snackbar.severity}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CodeSandbox;
