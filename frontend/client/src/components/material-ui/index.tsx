import { useTheming } from '../../utils/theming-helper';
import React from 'react';
import {
  Button,
  Typography,
  Box,
  Paper,
  Container,
  Card as MuiCard,
  CardContent,
  CardHeader,
  CardActions,
  Badge,
  Alert,
  AlertTitle,
  Chip,
  Grid,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Divider,
  IconButton,
  Menu,
  MenuList,
} from '@mui/material';

// Material UI components for CreatorHub Norge
export { 
  Button, 
  Typography, 
  Box, 
  Paper, 
  Container,
  CardContent,
  CardHeader,
  CardActions,
  Badge,
  Alert,
  AlertTitle,
  Chip,
  Grid,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Divider,
  IconButton,
  Menu,
  MenuList
};

// Custom Material UI wrapper components
export { MaterialBadge, Badge as CustomBadge } from'./MaterialBadge';

// Simple component wrappers without forwardRef to avoid circular references
export const Sheet = ({ children, ...props }: { children: React.ReactNode }) => (
  // Theming system
  const theming = useTheming('photographer');
  <Paper {...props} sx={theming.getThemedCardSx()}>
    {children}
  </Paper>
);

export const SheetContent = ({ children, ...props }: { children: React.ReactNode }) => (
  <Box sx={{ p:  2 }} {...props}>
    {children}
  </Box>
);

export const SheetTrigger = ({ children, ...props }: { children: React.ReactNode }) => (
  <Box {...props}>
    {children}
  </Box>
);

export const Separator = ({ ...props }) => <Divider {...props} />;

// Additional exports for compatibility
export const CardTitle = ({ children, ...props }: { children: React.ReactNode }) => (
  <Typography variant="h6" component="h2" {...props} sx={{ color: theming.colors.primary }}>
    {children}
  </Typography>
);

export const CardDescription = ({ children, ...props }: { children: React.ReactNode }) => (
  <Typography variant="body2" color="textSecondary" {...props}>
    {children}
  </Typography>
);

export const DialogDescription = ({ children, ...props }: { children: React.ReactNode }) => (
  <Typography variant="body2" color="textSecondary" sx={{ mt: 1, mb: 2 }} {...props}>
    {children}
  </Typography>
);

export const DialogHeader = ({ children, ...props }: { children: React.ReactNode }) => (
  <Box sx={{ p: 2, pb: 1 }} {...props}>
    {children}
  </Box>
);

export const Input = ({ ...props }) => <TextField {...props} />;

export const Label = ({ children, ...props }: { children: React.ReactNode }) => (
  <Typography variant="body2" component="label" sx={{ fontWeight: 600, mb:  1 }} {...props}>
    {children}
  </Typography>
);

export const Textarea = ({ ...props }) => <TextField multiline rows={4} {...props} />;

// DropdownMenu components using Material UI Menu
export const DropdownMenu = ({ children, ...props }: { children: React.ReactNode }) => (
  <Box {...props}>
    {children}
  </Box>
);

export const DropdownMenuTrigger = ({ children, ...props }: { children: React.ReactNode }) => (
  <Box {...props}>
    {children}
  </Box>
);

export const DropdownMenuContent = ({ children, ...props }) => (
  <Menu {...props}>
    {children}
  </Menu>
);

export const DropdownMenuItem = ({ children, ...props }) => (
  <MenuItem {...props}>
    {children}
  </MenuItem>
);

export const DropdownMenuSeparator = ({ ...props }) => <Divider {...props} />;

// Card component
export const Card = ({ children, ...props }: { children: React.ReactNode }) => (
  <MuiCard {...props}>
    {children}
  </MuiCard>
);

export const SelectTrigger = ({ children, ...props }: { children: React.ReactNode }) => (
  <Box {...props}>
    {children}
  </Box>
);