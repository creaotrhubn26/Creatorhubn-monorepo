import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Chip,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  ExpandMore,
  ChevronRight,
  Add,
  Home,
  Description,
  ViewModule,
  Image as ImageIcon,
  TextFields,
  Title,
  Group,
  Search,
  MoreVert,
  Visibility,
  VisibilityOff,
  Delete,
  Edit,
  Refresh,
  ContentCopy,
  DriveFileMove,
} from '@mui/icons-material';
import { scanPages, getPageStats } from './pageScanner';

// Page tree node structure
export interface PageTreeNode {
  id: string;
  name: string;
  type: 'page' | 'section' | 'component';
  icon?: React.ReactNode;
  children?: PageTreeNode[];
  visible?: boolean;
  locked?: boolean;
  parent?: string;
}

// Mock data - Replace with actual page data from your system
const INITIAL_PAGE_TREE: PageTreeNode[] = [
  {
    id: 'home',
    name: 'Home',
    type: 'page',
    icon: <Home fontSize="small" />,
    visible: true,
    children: [
      {
        id: 'home-hero',
        name: 'Hero',
        type: 'section',
        icon: <Description fontSize="small" />,
        visible: true,
      },
      {
        id: 'home-category',
        name: 'Category',
        type: 'section',
        icon: <ViewModule fontSize="small" />,
        visible: true,
      },
      {
        id: 'home-cta',
        name: 'CTA',
        type: 'section',
        icon: <TextFields fontSize="small" />,
        visible: true,
      },
      {
        id: 'home-sections',
        name: 'Sections',
        type: 'section',
        icon: <ViewModule fontSize="small" />,
        visible: true,
        children: [
          {
            id: 'section-heading',
            name: 'Heading',
            type: 'component',
            icon: <Title fontSize="small" />,
            visible: true,
          },
          {
            id: 'section-paragraph',
            name: 'Paragraph',
            type: 'component',
            icon: <TextFields fontSize="small" />,
            visible: true,
          },
          {
            id: 'section-image',
            name: 'Image',
            type: 'component',
            icon: <ImageIcon fontSize="small" />,
            visible: true,
          },
        ],
      },
    ],
  },
  {
    id: 'about',
    name: 'About',
    type: 'page',
    icon: <Description fontSize="small" />,
    visible: true,
  },
  {
    id: 'services',
    name: 'Services',
    type: 'page',
    icon: <ViewModule fontSize="small" />,
    visible: true,
    children: [
      {
        id: 'services-hero',
        name: 'Hero',
        type: 'section',
        icon: <Description fontSize="small" />,
        visible: true,
      },
    ],
  },
  {
    id: 'community',
    name: 'Community',
    type: 'page',
    icon: <Group fontSize="small" />,
    visible: true,
  },
  {
    id: 'contact',
    name: 'Contact',
    type: 'page',
    icon: <TextFields fontSize="small" />,
    visible: true,
  },
];

interface PageTreeNavigatorProps {
  onPageSelect?: (pageId: string) => void;
  onSectionSelect?: (sectionId: string) => void;
}

export const PageTreeNavigator: React.FC<PageTreeNavigatorProps> = ({
  onPageSelect,
  onSectionSelect,
}) => {
  const [pageTree, setPageTree] = useState<PageTreeNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageStats, setPageStats] = useState({ totalPages: 0, categories: 0, withSections: 0 });
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; nodeId: string } | null>(null);

  // Load actual pages from your pages folder
  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = () => {
    setIsLoading(true);
    try {
      // Scan all pages from the pages folder
      const scannedPages = scanPages();
      // Use scanned pages or fallback to initial tree
      const pagesToUse = scannedPages.length > 0 ? scannedPages : INITIAL_PAGE_TREE;
      setPageTree(pagesToUse);

      // Expand first category by default
      if (pagesToUse.length > 0 && pagesToUse[0].children) {
        setExpandedNodes([pagesToUse[0].id]);
        // Select first page if available
        if (pagesToUse[0].children.length > 0) {
          setSelectedNode(pagesToUse[0].children[0].id);
        }
      }

      // Get page statistics
      const stats = getPageStats();
      setPageStats(stats);

      console.log('✅ Loaded', stats.totalPages, 'pages in', stats.categories, 'categories');
    } catch (error) {
      console.error('❌ Failed to load pages: ', error);
      // Fallback to initial tree on error
      setPageTree(INITIAL_PAGE_TREE);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId],
    );
  };

  const handleNodeClick = (node: PageTreeNode) => {
    setSelectedNode(node.id);
    if (node.type === 'page' && onPageSelect) {
      onPageSelect(node.id);
    } else if (node.type === 'section' && onSectionSelect) {
      onSectionSelect(node.id);
    }
  };

  const toggleVisibility = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updateVisibility = (nodes: PageTreeNode[]): PageTreeNode[] => {
      return nodes.map((node) => {
        if (node.id === nodeId) {
          return { ...node, visible: !node.visible };
        }
        if (node.children) {
          return { ...node, children: updateVisibility(node.children) };
        }
        return node;
      });
    };
    setPageTree(updateVisibility(pageTree));
  };

  const addNewPage = () => {
    const newPage: PageTreeNode = {
      id: `page-${Date.now()}`,
      name: 'New Page',
      type: 'page',
      icon: <Description fontSize="small" />,
      visible: true,
      children: [],
    };
    setPageTree([...pageTree, newPage]);
  };

  // Context menu handlers
  const handleContextMenu = (event: React.MouseEvent, nodeId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      mouseX: event.clientX,
      mouseY: event.clientY,
      nodeId,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleDeleteNode = (nodeId: string) => {
    const deleteFromTree = (nodes: PageTreeNode[]): PageTreeNode[] => {
      return nodes.filter((node) => {
        if (node.id === nodeId) return false;
        if (node.children) {
          node.children = deleteFromTree(node.children);
        }
        return true;
      });
    };
    setPageTree(deleteFromTree(pageTree));
    handleCloseContextMenu();
  };

  const handleDuplicateNode = (nodeId: string) => {
    const findAndDuplicate = (nodes: PageTreeNode[]): PageTreeNode[] => {
      const result: PageTreeNode[] = [];
      for (const node of nodes) {
        result.push(node);
        if (node.id === nodeId) {
          result.push({
            ...node,
            id: `${node.id}-copy-${Date.now()}`,
            name: `${node.name} (Copy)`,
            children: node.children ? [...node.children] : undefined,
          });
        }
        if (node.children) {
          node.children = findAndDuplicate(node.children);
        }
      }
      return result;
    };
    setPageTree(findAndDuplicate(pageTree));
    handleCloseContextMenu();
  };

  const renderTreeNode = (node: PageTreeNode, depth: number = 0): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.includes(node.id);
    const isSelected = selectedNode === node.id;
    const isHovered = hoveredNode === node.id;

    // Filter by search query
    if (searchQuery && !node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return null;
    }

    return (
      <Box key={node.id}>
        <ListItemButton
          selected={isSelected}
          onClick={() => handleNodeClick(node)}
          onContextMenu={(e) => handleContextMenu(e, node.id)}
          onMouseEnter={() => setHoveredNode(node.id)}
          onMouseLeave={() => setHoveredNode(null)}
          sx={{
            py: 0.5,
            pl: 1 + depth * 2,
            pr: 1,
            borderRadius: 1,
            mb: 0.25,
            '&.Mui-selected': {
              bgcolor: '#E3F2FD',
              '&:hover': {
                bgcolor: '#BBDEFB',
              },
            },
            '&:hover': {
              bgcolor: depth === 0 ? 'action.hover' : 'rgba(0, 0, 0, 0.02)',
            },
          }}
        >
          {/* Expand/Collapse Icon */}
          {hasChildren ? (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
              sx={{ mr: 0.5, p: 0.25 }}
            >
              {isExpanded ? (
                <ExpandMore fontSize="small" sx={{ fontSize: 16 }} />
              ) : (
                <ChevronRight fontSize="small" sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          ) : (
            <Box sx={{ width: 20, mr: 0.5 }} />
          )}

          {/* Node Icon */}
          <ListItemIcon sx={{ minWidth: 32 }}>{node.icon}</ListItemIcon>

          {/* Node Name */}
          <ListItemText
            primary={node.name}
            primaryTypographyProps={{
              fontSize: '0.875rem',
              fontWeight: isSelected ? 600 : 400,
              color: !node.visible ? 'text.disabled' : 'text.primary',
            }}
          />

          {/* Actions (visible on hover) */}
          {isHovered && (
            <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
              <Tooltip title={node.visible ? 'Hide' : 'Show'}>
                <IconButton
                  size="small"
                  onClick={(e) => toggleVisibility(node.id, e)}
                  sx={{ p: 0.25 }}>
                  {node.visible ? (
                    <Visibility sx={{ fontSize: 16 }} />
                  ) : (
                    <VisibilityOff sx={{ fontSize: 16 }} />
                  )}
                </IconButton>
              </Tooltip>

              {node.type === 'page' && (
                <>
                  <Tooltip title="Edit">
                    <IconButton size="small" sx={{ p: 0.25 }}>
                      <Edit sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="More">
                    <IconButton size="small" sx={{ p: 0.25 }}>
                      <MoreVert sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Box>
          )}

          {/* Type indicator */}
          <Typography
            variant="caption"
            sx={{
              ml: 1,
              px: 0.75,
              py: 0.25,
              bgcolor: node.type === 'page' ? '#E8F5E9' : node.type === 'section' ? '#FFF3E0' : '#F3E5F5',
              color: node.type === 'page' ? '#2E7D32' : node.type === 'section' ? '#E65100' : '#6A1B9A',
              borderRadius: 0.5,
              fontSize: '0.65rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {node.type === 'page' ? 'P' : node.type === 'section' ? 'S' : 'C'}
          </Typography>
        </ListItemButton>

        {/* Render children */}
        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto">
            <List disablePadding>
              {node.children?.map((child) => renderTreeNode(child, depth + 1))}
            </List>
          </Collapse>
        )}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        width: 300,
        bgcolor: '#FAFAFA',
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'}}>
      {/* Header */}
      <Box sx={{ p: 2, bgcolor: 'white', borderBottom: 1, borderColor: 'divider' }}>
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
              Pages
            </Typography>
            <Chip
              label={pageStats.totalPages}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.75rem',
                bgcolor: '#E3F2FD',
                color: '#1976D2'}} />
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Refresh Pages">
              <IconButton size="small" onClick={loadPages}>
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Add New Page">
              <IconButton size="small" onClick={addNewPage}>
                <Add fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Search */}
        <TextField
          size="small"
          placeholder="Search pages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            )}}
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: '0.875rem',
              bgcolor: '#F5F5F5',
            }}}
        />
      </Box>

      {/* Page Tree */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
        {isLoading ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 4}}>
            <Typography variant="body2" color="text.secondary">
              Loading pages...
            </Typography>
          </Box>
        ) : pageTree.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 4}}>
            <Description sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              No pages found
            </Typography>
          </Box>
        ) : (
          <List disablePadding>{pageTree.map((node) => renderTreeNode(node))}</List>
        )}
      </Box>

      {/* Stats Footer */}
      <Box sx={{ p: 1.5, bgcolor: 'white', borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          {pageStats.totalPages} total pages • {pageStats.categories} categories
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {selectedNode ? '✓ 1 selected' : 'No selection'}
        </Typography>
      </Box>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <ListItem dense>
          <Typography variant="caption" color="text.secondary">
            Page Actions
          </Typography>
        </ListItem>
        <Divider />
        <MenuItem onClick={() => contextMenu && handleDuplicateNode(contextMenu.nodeId)}>
          <ListItemIcon>
            <ContentCopy fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Duplicate" />
        </MenuItem>
        <MenuItem onClick={() => contextMenu && onPageSelect?.(contextMenu.nodeId)}>
          <ListItemIcon>
            <DriveFileMove fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Move to..." />
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => contextMenu && handleDeleteNode(contextMenu.nodeId)} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <Delete fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText primary="Delete" />
        </MenuItem>
      </Menu>
    </Box>
  );
};
