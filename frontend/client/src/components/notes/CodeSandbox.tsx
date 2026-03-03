import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  BugReport,
  CheckCircle,
  ContentCopy,
  Download,
  PlayArrow,
  Refresh,
  Settings,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

interface CodeSandboxProps {
  initialCode?: string;
  language?: string;
  theme?: 'light' | 'dark';
  showLineNumbers?: boolean;
  autoRun?: boolean;
  onCodeChange?: (code: string) => void;
  onRun?: (result: CodeResult) => void;
  onError?: (error: string) => void;
  className?: string;
}

interface CodeResult {
  output: string;
  error?: string;
  executionTime: number;
  memoryUsage?: number;
}

export default function CodeSandbox({
  initialCode = '// Write your code here\nconsole.log("Hello, CreatorHub!");',
  language = 'javascript',
  theme = 'light',
  showLineNumbers = true,
  autoRun = false,
  onCodeChange,
  onRun,
  onError,
  className,
}: CodeSandboxProps): React.ReactElement {
  const theming = useTheming('photographer');

  const [code, setCode] = useState(initialCode);
  const [selectedLanguage, setSelectedLanguage] = useState(language);
  const [activeTab, setActiveTab] = useState(0);
  const [result, setResult] = useState<CodeResult | null>(null);
  const [history, setHistory] = useState<CodeResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');

  const availableLanguages = useMemo(
    () => [
      { value: 'javascript', label: 'JavaScript' },
      { value: 'typescript', label: 'TypeScript' },
      { value: 'python', label: 'Python' },
      { value: 'html', label: 'HTML' },
      { value: 'css', label: 'CSS' },
      { value: 'json', label: 'JSON' },
      { value: 'markdown', label: 'Markdown' },
    ],
    [],
  );

  const runCode = (): void => {
    if (!code.trim()) {
      return;
    }

    setIsRunning(true);
    const start = performance.now();

    window.setTimeout(() => {
      let output = '';
      let errorMessage = '';

      if (selectedLanguage === 'javascript' || selectedLanguage === 'typescript') {
        try {
          const logs: string[] = [];
          const sandboxConsole = {
            log: (...args: unknown[]) => {
              logs.push(args.map((entry) => String(entry)).join(' '));
            },
          };

          const executor = new Function('console', code);
          executor(sandboxConsole);
          output = logs.join('\n') || 'Execution completed with no console output.';
        } catch (error) {
          errorMessage = error instanceof Error ? error.message : 'Unknown execution error';
          onError?.(errorMessage);
        }
      } else {
        output = `Execution preview for ${selectedLanguage}:\n${code.slice(0, 500)}`;
      }

      const resultData: CodeResult = {
        output,
        error: errorMessage || undefined,
        executionTime: Math.round(performance.now() - start),
      };

      setResult(resultData);
      setHistory((previous) => [resultData, ...previous].slice(0, 20));
      onRun?.(resultData);
      setIsRunning(false);
    }, 200);
  };

  const resetCode = (): void => {
    setCode(initialCode);
    setResult(null);
    setSnackbarMessage('Code reset to initial template');
  };

  const copyCode = async (): Promise<void> => {
    await navigator.clipboard.writeText(code);
    setSnackbarMessage('Code copied to clipboard');
  };

  return (
    <Box className={className} sx={{ width: '100%' }}>
      <Paper sx={{ ...theming.getThemedCardSx(), mb: 2, p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Code Sandbox
            </Typography>
            <Chip size="small" label={selectedLanguage} />
            <Chip size="small" label={theme} />
          </Stack>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Run">
              <Button size="small" startIcon={<PlayArrow />} variant="contained" onClick={runCode} disabled={isRunning}>
                Run
              </Button>
            </Tooltip>
            <Tooltip title="Copy code">
              <Button size="small" startIcon={<ContentCopy />} variant="outlined" onClick={() => void copyCode()}>
                Copy
              </Button>
            </Tooltip>
            <Tooltip title="Reset code">
              <Button size="small" startIcon={<Refresh />} variant="outlined" onClick={resetCode}>
                Reset
              </Button>
            </Tooltip>
            <Tooltip title="Settings">
              <Button size="small" startIcon={<Settings />} variant="outlined" onClick={() => setShowSettings(true)}>
                Settings
              </Button>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 1, mb: 2 }}>
        <Tabs value={activeTab} onChange={(_event, value) => setActiveTab(value)}>
          <Tab label="Editor" />
          <Tab label="Output" />
          <Tab label="History" />
        </Tabs>
      </Paper>

      {activeTab === 0 ? (
        <Stack spacing={1}>
          <FormControl size="small" sx={{ maxWidth: 220 }}>
            <InputLabel id="sandbox-language">Language</InputLabel>
            <Select
              labelId="sandbox-language"
              label="Language"
              value={selectedLanguage}
              onChange={(event) => setSelectedLanguage(String(event.target.value))}
            >
              {availableLanguages.map((langOption) => (
                <MenuItem key={langOption.value} value={langOption.value}>
                  {langOption.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            multiline
            minRows={14}
            value={code}
            onChange={(event) => {
              const nextCode = event.target.value;
              setCode(nextCode);
              onCodeChange?.(nextCode);
              if (autoRun && (selectedLanguage === 'javascript' || selectedLanguage === 'typescript')) {
                runCode();
              }
            }}
            InputProps={{
              sx: {
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize,
              },
            }}
          />

          {showLineNumbers ? (
            <Typography variant="caption" color="text.secondary">
              Line count: {code.split('\n').length}
            </Typography>
          ) : null}

          {isRunning ? <LinearProgress /> : null}
        </Stack>
      ) : null}

      {activeTab === 1 ? (
        <Paper sx={{ p: 2 }}>
          {!result ? (
            <Alert severity="info">No output yet. Run code to see execution results.</Alert>
          ) : result.error ? (
            <Alert severity="error" icon={<BugReport />}>
              <Typography variant="subtitle2">Execution error</Typography>
              <Typography variant="body2">{result.error}</Typography>
            </Alert>
          ) : (
            <Alert severity="success" icon={<CheckCircle />}>
              <Typography variant="subtitle2">Execution successful</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {result.output || 'No output'}
              </Typography>
            </Alert>
          )}

          {result ? (
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip size="small" label={`Execution ${result.executionTime}ms`} />
              {result.memoryUsage ? <Chip size="small" label={`Memory ${result.memoryUsage}MB`} /> : null}
            </Stack>
          ) : null}
        </Paper>
      ) : null}

      {activeTab === 2 ? (
        <Paper sx={{ p: 2 }}>
          {history.length === 0 ? (
            <Alert severity="info">No execution history yet.</Alert>
          ) : (
            <Stack spacing={1}>
              {history.map((entry, index) => (
                <Paper key={`history-${index}`} variant="outlined" sx={{ p: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Run {history.length - index} • {entry.executionTime}ms
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {entry.error ? `Error: ${entry.error}` : entry.output || 'No output'}
                  </Typography>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>
      ) : null}

      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Editor Settings</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Font size"
              type="number"
              value={fontSize}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                setFontSize(Number.isFinite(parsed) ? Math.max(10, Math.min(28, parsed)) : 14);
              }}
            />
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={() => {
                const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = `sandbox.${selectedLanguage === 'typescript' ? 'ts' : 'txt'}`;
                anchor.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download Source
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={1500}
        onClose={() => setSnackbarMessage('')}
        message={snackbarMessage}
      />
    </Box>
  );
}
