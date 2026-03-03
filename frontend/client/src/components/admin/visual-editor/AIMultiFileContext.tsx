/**
 * AI Multi-File Context Manager
 * Project-wide code understanding for better suggestions
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  Chip,
  Alert,
  Stack,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Divider,
  LinearProgress,
  Collapse,
  Tooltip,
  Badge,
  CircularProgress,
} from '@mui/material';
import {
  Folder,
  InsertDriveFile,
  Psychology,
  Refresh,
  Close,
  ExpandMore,
  ExpandLess,
  Search,
  CheckCircle,
  Code,
  Link as LinkIcon,
  Memory,
} from '@mui/icons-material';

export interface FileContext {
  path: string;
  content: string;
  language: string;
  size: number;
  imports: string[];
  exports: string[];
  dependencies: string[];
  lastModified: number;
}

export interface ProjectContext {
  files: FileContext[];
  totalFiles: number;
  totalSize: number;
  projectRoot: string;
  dependencies: Record<string, string[]>;
  importGraph: Map<string, string[]>;
}

interface FileTreeFileNode {
  type: 'file';
  path: string;
  name: string;
  language: string;
}

interface FileTreeFolderNode {
  type: 'folder';
  path: string;
  name: string;
  children: FileTreeNode[];
}

type FileTreeNode = FileTreeFileNode | FileTreeFolderNode;

interface AIMultiFileContextProps {
  open: boolean;
  onClose: () => void;
  projectRoot?: string;
  onContextUpdated: (context: ProjectContext) => void;
  currentFile?: string;
}

export default function AIMultiFileContext({
  open,
  onClose,
  projectRoot = '/src',
  onContextUpdated,
  currentFile,
}: AIMultiFileContextProps) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [projectContext, setProjectContext] = useState<ProjectContext | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set([projectRoot]));
  const [searchQuery, setSearchQuery] = useState('');
  const [autoInclude, setAutoInclude] = useState({
    imports: true,
    dependencies: true,
    relatedFiles: true,
  });

  useEffect(() => {
    if (open) {
      scanProject();
    }
  }, [open, projectRoot]);

  const updateProjectContext = useCallback(
    async (filePaths: string[]) => {
      const contexts: FileContext[] = [];
      const dependencyMap: Record<string, string[]> = {};
      const importGraph = new Map<string, string[]>();

      for (const path of filePaths) {
        try {
          const content = await readFile(path);
          const analysis = analyzeFile(path, content);

          contexts.push({
            path,
            content,
            language: getLanguage(path),
            size: content.length,
            imports: analysis.imports,
            exports: analysis.exports,
            dependencies: analysis.dependencies,
            lastModified: Date.now(),
          });

          dependencyMap[path] = analysis.dependencies;
          importGraph.set(path, analysis.imports);
        } catch (error) {
          console.error(`Failed to analyze ${path}:`, error);
        }
      }

      const context: ProjectContext = {
        files: contexts,
        totalFiles: contexts.length,
        totalSize: contexts.reduce((sum, f) => sum + f.size, 0),
        projectRoot,
        dependencies: dependencyMap,
        importGraph,
      };

      setProjectContext(context);
      onContextUpdated(context);
    },
    [projectRoot, onContextUpdated],
  );

  const scanProject = useCallback(async () => {
    setIsScanning(true);

    try {
      // Scan project files
      const files = await discoverProjectFiles(projectRoot);
      const tree = buildFileTree(files);
      setFileTree(tree);

      const initialSelection = new Set(files.map((file) => file.path));

      // Auto-select current file and its dependencies
      if (currentFile) {
        const related = findRelatedFiles(currentFile, files);
        initialSelection.add(currentFile);
        related.forEach((path) => initialSelection.add(path));
      }

      setSelectedFiles(initialSelection);

      // Build project context
      await updateProjectContext(Array.from(initialSelection));
    } catch (error) {
      console.error('Project scan failed: ', error);
    } finally {
      setIsScanning(false);
    }
  }, [projectRoot, currentFile, updateProjectContext]);

  const handleFileToggle = useCallback(
    (filePath: string) => {
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        if (next.has(filePath)) {
          next.delete(filePath);
        } else {
          next.add(filePath);

          // Auto-include related files if enabled
          if (autoInclude.imports || autoInclude.dependencies) {
            const related = findRelatedFiles(filePath, getAllFiles(fileTree));
            related.forEach((r) => next.add(r));
          }
        }
        return next;
      });
    },
    [autoInclude, fileTree],
  );

  const handleFolderToggle = useCallback((folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allFiles = getAllFiles(fileTree);
    setSelectedFiles(new Set(allFiles.map((f) => f.path)));
  }, [fileTree]);

  const handleClearAll = useCallback(() => {
    setSelectedFiles(new Set());
  }, []);

  const handleApplyContext = useCallback(() => {
    updateProjectContext(Array.from(selectedFiles));
    onClose();
  }, [selectedFiles, updateProjectContext, onClose]);

  const filteredTree = searchQuery ? filterFileTree(fileTree, searchQuery) : fileTree;

  if (!open) return null;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        right: 16,
        top: 80,
        width: 450,
        maxHeight: 'calc(100vh - 100px)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 140,
        borderRadius: 2,
        overflow: 'hidden'}}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          bgcolor: 'primary.main',
          color: 'white'}}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Folder />
          <Typography variant="h6" fontWeight={600}>
            Project Context
          </Typography>
          <Badge badgeContent={selectedFiles.size} color="secondary">
            <InsertDriveFile />
          </Badge>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </Box>

      {/* Search & Actions */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <Search fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />}}

          sx={{ mb: 1 }} />
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={handleSelectAll}>
            Select All
          </Button>
          <Button size="small" onClick={handleClearAll}>
            Clear
          </Button>
          <Button size="small" startIcon={<Refresh />} onClick={scanProject} disabled={isScanning}>
            Rescan
          </Button>
        </Stack>
      </Box>

      {/* Context Stats */}
      {projectContext && (
        <Alert severity="info" sx={{ m: 2, mb: 0 }} icon={<Memory />}>
          <Typography variant="caption" display="block">
            <strong>{projectContext.totalFiles} files</strong> •{' '}
            {formatBytes(projectContext.totalSize)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            AI will use this context for smarter suggestions
          </Typography>
        </Alert>
      )}

      {/* File Tree */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {isScanning ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Scanning project files...
            </Typography>
          </Box>
        ) : (
          <List dense>{renderFileTree(filteredTree, 0)}</List>
        )}
      </Box>

      {/* Footer */}
      <Divider />
      <Box sx={{ p: 2, display: 'flex', gap: 1, justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
          {selectedFiles.size} files selected
        </Typography>
        <Button
          variant="contained"
          startIcon={<Psychology />}
          onClick={handleApplyContext}
          disabled={selectedFiles.size === 0}
        >
          Use Context
        </Button>
      </Box>
    </Paper>
  );

  function renderFileTree(nodes: FileTreeNode[], depth: number): React.ReactNode {
    return nodes.map((node) => {
      if (node.type === 'folder') {
        const isExpanded = expandedFolders.has(node.path);
        return (
          <React.Fragment key={node.path}>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleFolderToggle(node.path)} sx={{ pl: depth * 2 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {isExpanded ? <ExpandLess /> : <ExpandMore />}
                </ListItemIcon>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Folder fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={node.name} primaryTypographyProps={{ variant: 'body2' }} />
              </ListItemButton>
            </ListItem>
            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
              {renderFileTree(node.children, depth + 1)}
            </Collapse>
          </React.Fragment>
        );
      } else {
        const isSelected = selectedFiles.has(node.path);
        const isCurrent = node.path === currentFile;
        return (
          <ListItem key={node.path} disablePadding>
            <ListItemButton
              onClick={() => handleFileToggle(node.path)}
              sx={{
                pl: depth * 2,
                bgcolor: isCurrent ? 'action.selected' : undefined}}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Checkbox edge="start" checked={isSelected} size="small" />
              </ListItemIcon>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Code fontSize="small" color={isSelected ? 'primary' : 'action'} />
              </ListItemIcon>
              <ListItemText
                primary={node.name}
                secondary={isCurrent ? 'Current file' : undefined}
                primaryTypographyProps={{ variant: 'body2' }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
              <Chip label={node.language} size="small" variant="outlined" />
            </ListItemButton>
          </ListItem>
        );
      }
    });
  }
}

// Helper functions
async function discoverProjectFiles(root: string): Promise<FileTreeFileNode[]> {
  // In production, this would use File System API or backend endpoint
  // Mock implementation
  void root;
  return [
    { path: '/src/App.tsx', name: 'App.tsx', type: 'file', language: 'tsx' },
    { path: '/src/components/Button.tsx', name: 'Button.tsx', type: 'file', language: 'tsx' },
    { path: '/src/utils/helpers.ts', name: 'helpers.ts', type: 'file', language: 'ts' },
  ];
}

function buildFileTree(files: FileTreeFileNode[]): FileTreeNode[] {
  const tree: FileTreeNode[] = [];
  const folderMap = new Map<string, FileTreeFolderNode>();

  files.forEach((file) => {
    const parts = file.path.split('/').filter(Boolean);
    let currentLevel = tree;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath += '/' + part;

      if (i === parts.length - 1) {
        // File
        currentLevel.push({
          ...file,
          type: 'file',
        });
      } else {
        // Folder
        let folder = folderMap.get(currentPath);
        if (!folder) {
          folder = {
            name: part,
            path: currentPath,
            type: 'folder',
            children: [],
          };
          currentLevel.push(folder);
          folderMap.set(currentPath, folder);
        }
        currentLevel = folder.children;
      }
    }
  });

  return tree;
}

async function readFile(path: string): Promise<string> {
  // Mock implementation - in production, use File System API
  return `// Mock content of ${path}`;
}

function analyzeFile(
  path: string,
  content: string,
): {
  imports: string[];
  exports: string[];
  dependencies: string[];
} {
  // Simple regex-based analysis
  const imports = Array.from(content.matchAll(/import .+ from [', "](.+)['"]/g)).map((m) => m[1]);

  const exports = Array.from(
    content.matchAll(/export (default |const |function |class )(\w+)/g),
  ).map((m) => m[2]);

  const dependencies = imports.filter((imp) => !imp.startsWith('.'));

  return { imports, exports, dependencies };
}

function getLanguage(path: string): string {
  const ext = path.split('.').pop() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    css: 'css',
    scss: 'scss',
    json: 'json',
  };
  return langMap[ext] || 'text';
}

function findRelatedFiles(filePath: string, files: FileTreeFileNode[]): string[] {
  // Find files that import or are imported by this file
  // Mock implementation
  void filePath;
  void files;
  return [];
}

function getAllFiles(tree: FileTreeNode[]): FileTreeFileNode[] {
  const files: FileTreeFileNode[] = [];
  tree.forEach((node) => {
    if (node.type === 'file') {
      files.push(node);
    } else {
      files.push(...getAllFiles(node.children));
    }
  });
  return files;
}

function filterFileTree(tree: FileTreeNode[], query: string): FileTreeNode[] {
  const lowerQuery = query.toLowerCase();
  return tree
    .map((node) => {
    if (node.type === 'file') {
      return node.name.toLowerCase().includes(lowerQuery) ? node : null;
    } else {
      const filtered = filterFileTree(node.children, query);
      if (filtered.length > 0 || node.name.toLowerCase().includes(lowerQuery)) {
        return { ...node, children: filtered };
      }
      return null;
    }
    })
    .filter((node): node is FileTreeNode => node !== null);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B','KB','MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + '' + sizes[i];
}
