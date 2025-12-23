/**
 * Context Menu Component
 * 
 * Right-click context menu for objects
 */

import React, { useState, useEffect, useRef } from 'react';
import { Menu, MenuItem, Divider, ListItemIcon, ListItemText } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import InfoIcon from '@mui/icons-material/Info';
import GroupIcon from '@mui/icons-material/Group';
import UngroupIcon from '@mui/icons-material/Ungroup';
import { colors, spacing } from '../../styles/designTokens';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  divider?: boolean;
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ items, anchorEl, onClose }) => {
  const open = Boolean(anchorEl);

  const handleClick = (item: ContextMenuItem) => {
    if (!item.disabled) {
      item.onClick();
      onClose();
    }
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      PaperProps={{
        sx: {
          backgroundColor: colors.background.panel,
          border: `1px solid ${colors.border.default}`,
          minWidth: 200,
          '& .MuiMenuItem-root': {
            color: colors.text.primary,
            padding: `${spacing.sm}px ${spacing.md}px`,
            '&:hover': {
              backgroundColor: colors.background.elevated,
            },
            '&.Mui-disabled': {
              opacity: 0.5,
            },
          },
        },
      }}
    >
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          {item.divider && index > 0 && <Divider sx={{ borderColor: colors.border.divider }} />}
          <MenuItem
            onClick={() => handleClick(item)}
            disabled={item.disabled}
          >
            {item.icon && (
              <ListItemIcon
                sx={{
                  color: colors.text.secondary,
                  minWidth: 36,
                }}
              >
                {item.icon}
              </ListItemIcon>
            )}
            <ListItemText primary={item.label} />
          </MenuItem>
        </React.Fragment>
      ))}
    </Menu>
  );
};

/**
 * Hook for using context menu
 */
export function useContextMenu() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [items, setItems] = useState<ContextMenuItem[]>([]);

  const handleContextMenu = (event: React.MouseEvent<HTMLElement>, menuItems: ContextMenuItem[]) => {
    event.preventDefault();
    setAnchorEl(event.currentTarget);
    setItems(menuItems);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setItems([]);
  };

  return {
    anchorEl,
    items,
    handleContextMenu,
    handleClose,
  };
}


