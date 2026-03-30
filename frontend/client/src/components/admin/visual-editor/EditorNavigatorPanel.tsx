import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Checkbox,
  Chip,
  Collapse,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AccountTree,
  ArrowDownward,
  ArrowRight,
  ArrowUpward,
  DragIndicator,
  ExpandMore,
  Lock,
  LockOpen,
  Search as SearchIcon,
  TextFields,
  ViewQuilt,
  Visibility,
  VisibilityOff,
  Image as ImageIcon,
  SmartButton,
  ViewModule,
  Audiotrack,
  Videocam,
} from '@mui/icons-material';
import { useVisualEditor, type EditorElement } from './VisualEditorContext';
import { getElementDisplayName } from './visualEditorModel';

interface NavigatorNode {
  element: EditorElement;
  children: NavigatorNode[];
}

const getElementIcon = (type: EditorElement['type']) => {
  switch (type) {
    case 'text':
      return <TextFields fontSize="small" />;
    case 'button':
      return <SmartButton fontSize="small" />;
    case 'image':
      return <ImageIcon fontSize="small" />;
    case 'card':
      return <ViewModule fontSize="small" />;
    case 'grid':
      return <ViewQuilt fontSize="small" />;
    case 'audio':
      return <Audiotrack fontSize="small" />;
    case 'video':
      return <Videocam fontSize="small" />;
    case 'container':
    default:
      return <AccountTree fontSize="small" />;
  }
};

const matchesQuery = (element: EditorElement, query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return (
    getElementDisplayName(element).toLowerCase().includes(normalizedQuery) ||
    element.type.toLowerCase().includes(normalizedQuery) ||
    (element.className ?? '').toLowerCase().includes(normalizedQuery)
  );
};

export const EditorNavigatorPanel: React.FC = () => {
  const {
    state,
    selectElement,
    selectElements,
    moveElement,
    reorderElement,
    toggleElementVisibility,
    toggleElementLock,
  } = useVisualEditor();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'before' | 'after' } | null>(null);
  const draggedIdRef = useRef<string | null>(null);

  const rootNodes = useMemo(() => {
    const orderedElements = state.elements;
    const elementsById = new Map(
      orderedElements.map((element) => [
        element.id,
        {
          element,
          children: [] as NavigatorNode[],
        },
      ]),
    );
    const roots: NavigatorNode[] = [];

    orderedElements.forEach((element) => {
      const node = elementsById.get(element.id);
      if (!node) {
        return;
      }

      if (element.parent) {
        const parentNode = elementsById.get(element.parent);
        if (parentNode) {
          parentNode.children.push(node);
          return;
        }
      }

      roots.push(node);
    });

    return roots;
  }, [state.elements]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const handleMultiSelectToggle = (elementId: string, checked: boolean) => {
    const selectedSet = new Set(state.selectedElements);
    if (checked) {
      selectedSet.add(elementId);
    } else {
      selectedSet.delete(elementId);
    }

    const nextIds = Array.from(selectedSet);
    if (nextIds.length === 0) {
      selectElement(null);
      return;
    }

    selectElements(nextIds);
  };

  const getSiblingIds = (parentId: string | undefined) =>
    state.elements
      .filter((element) => element.parent === parentId)
      .map((element) => element.id);

  const clearDragState = () => {
    draggedIdRef.current = null;
    setDraggedId(null);
    setDropTarget(null);
  };

  useEffect(() => {
    if (!draggedId) {
      return undefined;
    }

    const handlePointerMove = (event: MouseEvent) => {
      const activeDraggedId = draggedIdRef.current;
      if (!activeDraggedId) {
        return;
      }

      const activeElement = state.elements.find((element) => element.id === activeDraggedId);
      if (!activeElement) {
        setDropTarget(null);
        return;
      }

      const hoveredNode = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('[data-navigator-node-id]');

      if (!hoveredNode) {
        setDropTarget(null);
        return;
      }

      const hoveredId = hoveredNode.dataset.navigatorNodeId;
      const hoveredParentId = hoveredNode.dataset.navigatorParentId || undefined;

      if (!hoveredId || hoveredId === activeDraggedId || hoveredParentId !== activeElement.parent) {
        setDropTarget(null);
        return;
      }

      const bounds = hoveredNode.getBoundingClientRect();
      const position = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
      setDropTarget({ id: hoveredId, position });
    };

    const handlePointerUp = () => {
      const activeDraggedId = draggedIdRef.current;
      if (!activeDraggedId) {
        clearDragState();
        return;
      }

      const activeElement = state.elements.find((element) => element.id === activeDraggedId);
      if (!activeElement || !dropTarget) {
        clearDragState();
        return;
      }

      const siblingIds = getSiblingIds(activeElement.parent);
      const siblingIdsWithoutDragged = siblingIds.filter((siblingId) => siblingId !== activeDraggedId);
      const targetSiblingIndex = siblingIdsWithoutDragged.indexOf(dropTarget.id);

      if (targetSiblingIndex !== -1) {
        const targetIndex = dropTarget.position === 'after'
          ? targetSiblingIndex + 1
          : targetSiblingIndex;
        moveElement(activeDraggedId, activeElement.parent, targetIndex);
      }

      clearDragState();
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [draggedId, dropTarget, moveElement, state.elements]);

  const renderNode = (node: NavigatorNode, depth: number): React.ReactNode => {
    const { element, children } = node;
    const isExpanded = expandedIds.includes(element.id);
    const isSelected = state.selectedElement === element.id || state.selectedElements.includes(element.id);
    const isIncludedInMultiSelect = state.selectedElements.includes(element.id);
    const nodeMatchesQuery = matchesQuery(element, searchQuery);
    const visibleChildren = children
      .map((child) => renderNode(child, depth + 1))
      .filter(Boolean);

    if (!nodeMatchesQuery && visibleChildren.length === 0) {
      return null;
    }

    const displayName = getElementDisplayName(element);
    const isVisible = element.visible ?? true;
    const isLocked = element.locked ?? false;
    const showDropBefore = dropTarget?.id === element.id && dropTarget.position === 'before';
    const showDropAfter = dropTarget?.id === element.id && dropTarget.position === 'after';

    return (
      <React.Fragment key={element.id}>
        <ListItem disablePadding sx={{ display: 'block' }}>
          <Box
            data-testid={`visual-editor-navigator-node-${element.id}`}
            aria-label={`Navigator node ${displayName}`}
            data-navigator-node-id={element.id}
            data-navigator-parent-id={element.parent ?? ''}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', element.id);
              draggedIdRef.current = element.id;
              setDraggedId(element.id);
            }}
            onDragEnd={clearDragState}
            onDragOver={(event) => {
              const activeDraggedId = draggedIdRef.current || event.dataTransfer.getData('text/plain');
              if (!activeDraggedId || activeDraggedId === element.id) {
                return;
              }

              const draggedElement = state.elements.find((entry) => entry.id === activeDraggedId);
              if (!draggedElement || draggedElement.parent !== element.parent) {
                return;
              }

              event.preventDefault();
              const bounds = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
              const position = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
              setDropTarget({ id: element.id, position });
            }}
            onDragLeave={(event) => {
              if (!dropTarget || dropTarget.id !== element.id) {
                return;
              }

              const nextTarget = event.relatedTarget;
              if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
                return;
              }

              setDropTarget(null);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const activeDraggedId = draggedIdRef.current || event.dataTransfer.getData('text/plain');
              if (!activeDraggedId || activeDraggedId === element.id) {
                clearDragState();
                return;
              }

              const draggedElement = state.elements.find((entry) => entry.id === activeDraggedId);
              if (!draggedElement || draggedElement.parent !== element.parent) {
                clearDragState();
                return;
              }

              const siblingIds = getSiblingIds(element.parent);
              const siblingIdsWithoutDragged = siblingIds.filter((siblingId) => siblingId !== activeDraggedId);
              const targetSiblingIndex = siblingIdsWithoutDragged.indexOf(element.id);
              if (targetSiblingIndex === -1) {
                clearDragState();
                return;
              }

              const targetIndex =
                dropTarget?.id === element.id && dropTarget.position === 'after'
                  ? targetSiblingIndex + 1
                  : targetSiblingIndex;

              moveElement(activeDraggedId, element.parent, targetIndex);
              clearDragState();
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              pl: 0.5 + depth * 1.5,
              pr: 0.5,
              py: 0.25,
              borderRadius: 2.5,
              bgcolor: isSelected ? 'rgba(255, 107, 53, 0.1)' : 'transparent',
              borderTop: showDropBefore ? '2px solid var(--ve-accent, #ff6b35)' : '2px solid transparent',
              borderBottom: showDropAfter ? '2px solid var(--ve-accent, #ff6b35)' : '2px solid transparent',
              opacity: draggedId === element.id ? 0.65 : 1,
            }}
          >
            <Tooltip title="Drag to reorder within this layout group">
              <IconButton
                size="small"
                aria-label={`Drag ${displayName}`}
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  draggedIdRef.current = element.id;
                  setDraggedId(element.id);
                }}
                draggable
                onDragStart={(event) => {
                  event.stopPropagation();
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', element.id);
                  draggedIdRef.current = element.id;
                  setDraggedId(element.id);
                }}
                onDragEnd={(event) => {
                  event.stopPropagation();
                  clearDragState();
                }}
                sx={{ cursor: 'grab' }}
              >
                <DragIndicator fontSize="small" />
              </IconButton>
            </Tooltip>
            {children.length > 0 ? (
              <IconButton
                size="small"
                onClick={() => toggleExpanded(element.id)}
                aria-label={isExpanded ? `Collapse ${displayName}` : `Expand ${displayName}`}
              >
                {isExpanded ? <ExpandMore fontSize="small" /> : <ArrowRight fontSize="small" />}
              </IconButton>
            ) : (
              <Box sx={{ width: 32 }} />
            )}

            <Checkbox
              size="small"
              checked={isIncludedInMultiSelect}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => handleMultiSelectToggle(element.id, event.target.checked)}
              inputProps={{ 'aria-label': `Include ${displayName} in multi-select` }}
            />

            <ListItemButton
              onClick={() => selectElement(element.id)}
              selected={isSelected}
              sx={{
                py: 0.85,
                px: 1,
                borderRadius: 2.5,
                minHeight: 42,
              }}
            >
              <ListItemIcon sx={{ minWidth: 30, color: 'var(--ve-accent, #ff6b35)' }}>
                {getElementIcon(element.type)}
              </ListItemIcon>
              <ListItemText
                primary={displayName}
                secondary={element.className ? `.${element.className}` : element.type}
                primaryTypographyProps={{
                  sx: {
                    fontWeight: 600,
                    color: 'var(--ve-ink, #2b2016)',
                  },
                }}
                secondaryTypographyProps={{
                  sx: {
                    color: 'var(--ve-muted, #6f6358)',
                  },
                }}
              />
            </ListItemButton>

            <Tooltip title={isVisible ? 'Hide element' : 'Show element'}>
              <IconButton
                size="small"
                aria-label={isVisible ? `Hide ${displayName}` : `Show ${displayName}`}
                onClick={() => toggleElementVisibility(element.id)}
              >
                {isVisible ? <Visibility fontSize="small" /> : <VisibilityOff fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title={isLocked ? 'Unlock element' : 'Lock element'}>
              <IconButton
                size="small"
                aria-label={isLocked ? `Unlock ${displayName}` : `Lock ${displayName}`}
                onClick={() => toggleElementLock(element.id)}
              >
                {isLocked ? <Lock fontSize="small" /> : <LockOpen fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Move up">
              <IconButton
                size="small"
                aria-label={`Move ${displayName} up`}
                onClick={() => reorderElement(element.id, 'up')}
              >
                <ArrowUpward fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Move down">
              <IconButton
                size="small"
                aria-label={`Move ${displayName} down`}
                onClick={() => reorderElement(element.id, 'down')}
              >
                <ArrowDownward fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </ListItem>
        {children.length > 0 && (
          <Collapse in={isExpanded || searchQuery.trim().length > 0} timeout="auto" unmountOnExit>
            <List disablePadding>{visibleChildren}</List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  return (
    <Box sx={{ p: 1, display: 'grid', gap: 1 }}>
      <Box>
        <Typography variant="subtitle2" sx={{ color: 'var(--ve-ink, #2b2016)', fontWeight: 700 }}>
          Navigator
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--ve-muted, #6f6358)' }}>
          Hierarchy, selection and structure
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        <Chip
          size="small"
          label={`${state.elements.length} nodes`}
          sx={{ bgcolor: 'rgba(255,255,255,0.82)' }}
        />
        <Chip
          size="small"
          label={state.selectedElements.length > 1 ? `${state.selectedElements.length} multi-selected` : 'Single select ready'}
          sx={{ bgcolor: 'rgba(255,255,255,0.7)' }}
        />
      </Box>

      <TextField
        fullWidth
        size="small"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder="Search elements, types or classes"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: 'var(--ve-muted, #6f6358)' }} />
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 999,
            bgcolor: 'rgba(255,255,255,0.74)',
          },
        }}
      />

      <List
        dense
        sx={{
          display: 'grid',
          gap: 0.5,
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.54)',
          border: '1px solid rgba(113, 87, 59, 0.08)',
          p: 0.75,
          maxHeight: 'calc(100vh - 360px)',
          overflow: 'auto',
        }}
      >
        {rootNodes.map((node) => renderNode(node, 0))}
      </List>
    </Box>
  );
};
