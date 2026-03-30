/**
 * Platform Exporter - Export to various platforms
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Typography,
  TextField,
} from '@mui/material';
import {
  CheckCircle,
  Cloud,
  Code,
  ContentCopy,
  GetApp,
  Launch,
} from '@mui/icons-material';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { deploymentService } from '@/services/DeploymentService';

interface PlatformExporterProps {
  open: boolean;
  onClose: () => void;
  code: {
    html?: string;
    react?: string;
    css?: string;
    javascript?: string;
    manifest?: string;
  };
  exportFormat: 'html' | 'react' | 'vue';
}

type ExportFiles = Record<string, string>;

const sanitizeProjectName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    || 'visual-editor-project';

const getStaticHtmlDocument = (
  projectName: string,
  markup: string,
  css: string,
  javascript: string,
): string => {
  const trimmedMarkup = markup.trim();
  if (/<!doctype html/i.test(trimmedMarkup)) {
    return trimmedMarkup;
  }

  const styleBlock = css.trim()
    ? `<link rel="stylesheet" href="./styles.css" />`
    : '';
  const scriptBlock = javascript.trim()
    ? `<script src="./script.js" defer></script>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${projectName}</title>
  ${styleBlock}
</head>
<body>
  ${trimmedMarkup || '<main><h1>Visual Editor Export</h1></main>'}
  ${scriptBlock}
</body>
</html>`;
};

const buildExportFiles = (
  projectName: string,
  exportFormat: 'html' | 'react' | 'vue',
  code: PlatformExporterProps['code'],
): ExportFiles => {
  const css = code.css ?? '';
  const javascript = code.javascript ?? '';
  const html = code.html ?? '';
  const react = code.react ?? `export default function App() {\n  return <div>${projectName}</div>;\n}\n`;
  const manifest = code.manifest?.trim() ?? '';
  const manifestFileName = exportFormat === 'html'
    ? 'component-manifest.json'
    : 'src/component-manifest.json';

  if (exportFormat === 'react') {
    return {
      'package.json': JSON.stringify(
        {
          name: projectName,
          private: true,
          version: '1.0.0',
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'vite build',
            preview: 'vite preview',
          },
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0',
          },
          devDependencies: {
            '@vitejs/plugin-react': '^4.2.1',
            vite: '^5.4.10',
          },
        },
        null,
        2,
      ),
      'vite.config.js': `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n});\n`,
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${projectName}</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>`,
      'src/main.jsx': `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App.jsx';\nimport './styles.css';\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n);\n`,
      'src/App.jsx': react,
      'src/styles.css': css,
      ...(manifest ? { [manifestFileName]: manifest } : {}),
      ...(javascript.trim() ? { 'src/runtime.js': javascript } : {}),
      'README.md': `# ${projectName}\n\nGenerated with CreatorHub Visual Editor.\n\n## Run locally\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`,
      '.gitignore': `node_modules\ndist\n.vite\n.DS_Store\n`,
    };
  }

  if (exportFormat === 'vue') {
    return {
      'package.json': JSON.stringify(
        {
          name: projectName,
          private: true,
          version: '1.0.0',
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'vite build',
            preview: 'vite preview',
          },
          dependencies: {
            vue: '^3.5.12',
          },
          devDependencies: {
            '@vitejs/plugin-vue': '^5.1.4',
            vite: '^5.4.10',
          },
        },
        null,
        2,
      ),
      'vite.config.js': `import { defineConfig } from 'vite';\nimport vue from '@vitejs/plugin-vue';\n\nexport default defineConfig({\n  plugins: [vue()],\n});\n`,
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${projectName}</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>`,
      'src/main.js': `import { createApp } from 'vue';\nimport App from './App.vue';\nimport './styles.css';\n\ncreateApp(App).mount('#app');\n`,
      'src/App.vue': `<template>\n${html.trim() || '<main><h1>Visual Editor Export</h1></main>'}\n</template>\n`,
      'src/styles.css': css,
      ...(manifest ? { [manifestFileName]: manifest } : {}),
      ...(javascript.trim() ? { 'src/runtime.js': javascript } : {}),
      'README.md': `# ${projectName}\n\nGenerated with CreatorHub Visual Editor.\n`,
      '.gitignore': `node_modules\ndist\n.vite\n.DS_Store\n`,
    };
  }

  return {
    'package.json': JSON.stringify(
      {
        name: projectName,
        private: true,
        version: '1.0.0',
        scripts: {
          start: 'npx serve .',
        },
      },
      null,
      2,
    ),
    'index.html': getStaticHtmlDocument(projectName, html, css, javascript),
    'styles.css': css,
    'script.js': javascript,
    ...(manifest ? { [manifestFileName]: manifest } : {}),
    'README.md': `# ${projectName}\n\nGenerated with CreatorHub Visual Editor.\n\nOpen \`index.html\` directly or run \`npm start\`.\n`,
    '.gitignore': `node_modules\n.DS_Store\n`,
  };
};

const openFormInNewTab = (action: string, fields: Record<string, string>) => {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  form.target = '_blank';

  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};

export const PlatformExporter: React.FC<PlatformExporterProps> = ({
  open,
  onClose,
  code,
  exportFormat,
}) => {
  const [projectName, setProjectName] = useState('my-project');
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [deploymentUrl, setDeploymentUrl] = useState('');

  const normalizedProjectName = useMemo(
    () => sanitizeProjectName(projectName),
    [projectName],
  );

  const exportFiles = useMemo(
    () => buildExportFiles(normalizedProjectName, exportFormat, code),
    [code, exportFormat, normalizedProjectName],
  );

  const exportToZip = async () => {
    setIsExporting(true);
    setExportStatus(null);

    try {
      const zip = new JSZip();

      Object.entries(exportFiles).forEach(([path, content]) => {
        zip.file(path, content);
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `${normalizedProjectName}.zip`);

      setExportStatus({
        type: 'success',
        message: `Exported ${Object.keys(exportFiles).length} files to ${normalizedProjectName}.zip`,
      });
    } catch (error) {
      setExportStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Export failed. Please try again.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToCodeSandbox = () => {
    setIsExporting(true);
    setExportStatus(null);

    try {
      openFormInNewTab('https://codesandbox.io/api/v1/sandboxes/define', {
        parameters: JSON.stringify({
          files: Object.fromEntries(
            Object.entries(exportFiles).map(([path, content]) => [path, { content }]),
          ),
        }),
      });

      setExportStatus({
        type: 'success',
        message: 'Opening project in CodeSandbox...',
      });
    } catch (error) {
      setExportStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to open in CodeSandbox',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToStackBlitz = () => {
    setIsExporting(true);
    setExportStatus(null);

    try {
      const fields = Object.entries(exportFiles).reduce<Record<string, string>>((acc, [path, content]) => {
        acc[`project[files][${path}]`] = content;
        return acc;
      }, {
        projectTitle: normalizedProjectName,
        projectDescription: 'Generated with CreatorHub Visual Editor',
        projectTemplate: exportFormat === 'react' ? 'react' : exportFormat === 'vue' ? 'vue' : 'javascript',
      });

      openFormInNewTab('https://stackblitz.com/run', fields);

      setExportStatus({
        type: 'success',
        message: 'Opening project in StackBlitz...',
      });
    } catch (error) {
      setExportStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to open in StackBlitz',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const copyToClipboard = async (content: string, label: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setExportStatus({
        type: 'success',
        message: `${label} copied to clipboard`,
      });
    } catch (error) {
      setExportStatus({
        type: 'error',
        message: error instanceof Error ? error.message : `Failed to copy ${label}`,
      });
    }
  };

  const deployToVercel = async () => {
    setIsExporting(true);
    setDeploymentUrl('');
    setExportStatus(null);

    try {
      const deploymentFiles = deploymentService.generateDeploymentFiles(
        code.html ?? '',
        code.css ?? '',
        code.javascript ?? '',
        exportFormat === 'react' ? 'react' : 'static',
      );

      const deployment = await deploymentService.deploy(
        normalizedProjectName,
        deploymentFiles,
        'production',
        {
          framework: exportFormat === 'react' ? 'react' : 'static',
          projectName: normalizedProjectName,
        },
      );

      if (deployment.status !== 'ready') {
        throw new Error(deployment.error || 'Deployment failed');
      }

      const nextUrl = deployment.url.startsWith('http')
        ? deployment.url
        : `https://${deployment.url}`;

      setDeploymentUrl(nextUrl);
      setExportStatus({
        type: 'success',
        message: 'Deployed successfully to Vercel',
      });
    } catch (error) {
      setExportStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Deployment failed',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const primaryCode = exportFormat === 'react'
    ? code.react ?? ''
    : exportFormat === 'vue'
      ? exportFiles['src/App.vue'] ?? ''
      : code.html ?? '';
  const componentManifest = code.manifest?.trim() ?? '';
  const componentManifestCount = useMemo(() => {
    if (!componentManifest) {
      return 0;
    }

    try {
      const parsed = JSON.parse(componentManifest);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }, [componentManifest]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Cloud color="primary" />
          <Typography variant="h6">Export Project</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {isExporting && <LinearProgress sx={{ mb: 2 }} />}

        {exportStatus && (
          <Alert severity={exportStatus.type} sx={{ mb: 2 }} onClose={() => setExportStatus(null)}>
            {exportStatus.message}
          </Alert>
        )}

        <TextField
          label="Project Name"
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          fullWidth
          margin="normal"
          helperText={`Slug: ${normalizedProjectName}`}
        />

        <Box sx={{ mt: 1, mb: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip label={`Format: ${exportFormat.toUpperCase()}`} color="primary" variant="outlined" />
          <Chip label={`${Object.keys(exportFiles).length} files`} variant="outlined" />
          {componentManifestCount > 0 && (
            <Chip label={`${componentManifestCount} component instances`} color="secondary" variant="outlined" />
          )}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2 }}>
          <Card variant="outlined">
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <GetApp color="primary" />
                <Typography variant="h6">Download ZIP</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Download a complete project bundle with the exact files shown above.
              </Typography>
            </CardContent>
            <CardActions>
              <Button variant="contained" fullWidth onClick={exportToZip} disabled={isExporting}>
                Download
              </Button>
            </CardActions>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Code color="primary" />
                <Typography variant="h6">CodeSandbox</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Open the current export package in a browser-based sandbox.
              </Typography>
            </CardContent>
            <CardActions>
              <Button
                variant="contained"
                fullWidth
                onClick={exportToCodeSandbox}
                disabled={isExporting}
                endIcon={<Launch />}
              >
                Open
              </Button>
            </CardActions>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Launch color="primary" />
                <Typography variant="h6">StackBlitz</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Open the exported files in StackBlitz for quick edits and previews.
              </Typography>
            </CardContent>
            <CardActions>
              <Button
                variant="contained"
                fullWidth
                onClick={exportToStackBlitz}
                disabled={isExporting}
                endIcon={<Launch />}
              >
                Open
              </Button>
            </CardActions>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <ContentCopy color="primary" />
                <Typography variant="h6">Copy Code</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Copy the generated source for manual use in another environment.
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={() => void copyToClipboard(primaryCode, exportFormat.toUpperCase())}>
                {exportFormat === 'react' ? 'JSX' : exportFormat === 'vue' ? 'Vue' : 'HTML'}
              </Button>
              <Button size="small" onClick={() => void copyToClipboard(code.css ?? '', 'CSS')}>
                CSS
              </Button>
              <Button size="small" onClick={() => void copyToClipboard(code.javascript ?? '', 'JS')}>
                JS
              </Button>
              {componentManifest && (
                <Button size="small" onClick={() => void copyToClipboard(componentManifest, 'Manifest')}>
                  Manifest
                </Button>
              )}
            </CardActions>
          </Card>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Deploy to Production
          </Typography>

          <Card variant="outlined" sx={{ bgcolor: 'primary.50', borderColor: 'primary.main' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Cloud color="primary" />
                <Typography variant="h6">Deploy to Vercel</Typography>
                <Chip label="One-Click" size="small" color="primary" />
              </Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Deploy the current project snapshot with one click.
              </Typography>

              {deploymentUrl && (
                <Alert severity="success" sx={{ mt: 2 }} icon={<CheckCircle />}>
                  <Typography variant="body2">Deployed successfully</Typography>
                  <Button
                    size="small"
                    href={deploymentUrl}
                    target="_blank"
                    rel="noreferrer"
                    endIcon={<Launch />}
                    sx={{ mt: 1 }}
                  >
                    Visit Site
                  </Button>
                </Alert>
              )}

              {!deploymentService.isConfigured() && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="caption">
                    Configure a Vercel token in settings to enable deployment.
                  </Typography>
                </Alert>
              )}
            </CardContent>
            <CardActions>
              <Button
                variant="contained"
                fullWidth
                onClick={deployToVercel}
                disabled={isExporting || !deploymentService.isConfigured()}
                startIcon={<Cloud />}
              >
                {isExporting ? 'Deploying...' : 'Deploy Now'}
              </Button>
            </CardActions>
          </Card>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PlatformExporter;
