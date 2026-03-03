import React from 'react';
import {
  Alert,
  AlertTitle,
  Avatar,
  Box,
  Button,
  Card as MuiCard,
  CardActions,
  CardContent,
  CardHeader,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  MenuList,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { useTheming } from '../../utils/theming-helper';

export {
  Alert,
  AlertTitle,
  Avatar,
  Box,
  Button,
  CardActions,
  CardContent,
  CardHeader,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  MenuList,
  Paper,
  Select,
  TextField,
  Typography,
};

export { MaterialBadge, Badge as CustomBadge } from './MaterialBadge';

export const Sheet: React.FC<{ children: React.ReactNode } & React.ComponentProps<typeof Paper>> = ({
  children,
  ...props
}) => {
  const theming = useTheming('photographer');
  return (
    <Paper {...props} sx={{ ...theming.getThemedCardSx(), ...(props.sx ?? {}) }}>
      {children}
    </Paper>
  );
};

export const SheetContent: React.FC<{ children: React.ReactNode } & React.ComponentProps<typeof Box>> = ({
  children,
  ...props
}) => (
  <Box sx={{ p: 2, ...(props.sx ?? {}) }} {...props}>
    {children}
  </Box>
);

export const SheetTrigger: React.FC<{ children: React.ReactNode } & React.ComponentProps<typeof Box>> = ({
  children,
  ...props
}) => <Box {...props}>{children}</Box>;

export const Separator: React.FC<React.ComponentProps<typeof Divider>> = (props) => <Divider {...props} />;

export const CardTitle: React.FC<{ children: React.ReactNode } & React.ComponentProps<typeof Typography>> = ({
  children,
  ...props
}) => {
  const theming = useTheming('photographer');
  return (
    <Typography variant="h6" component="h2" {...props} sx={{ color: theming.colors.primary, ...(props.sx ?? {}) }}>
      {children}
    </Typography>
  );
};

export const CardDescription: React.FC<{ children: React.ReactNode } & React.ComponentProps<typeof Typography>> = ({
  children,
  ...props
}) => (
  <Typography variant="body2" color="textSecondary" {...props}>
    {children}
  </Typography>
);

export const DialogDescription: React.FC<{ children: React.ReactNode } & React.ComponentProps<typeof Typography>> = ({
  children,
  ...props
}) => (
  <Typography variant="body2" color="textSecondary" sx={{ mt: 1, mb: 2, ...(props.sx ?? {}) }} {...props}>
    {children}
  </Typography>
);

export const DialogHeader: React.FC<{ children: React.ReactNode } & React.ComponentProps<typeof Box>> = ({
  children,
  ...props
}) => (
  <Box sx={{ p: 2, pb: 1, ...(props.sx ?? {}) }} {...props}>
    {children}
  </Box>
);

export const Input: React.FC<React.ComponentProps<typeof TextField>> = (props) => <TextField {...props} />;

export const Label: React.FC<{ children: React.ReactNode } & React.ComponentProps<typeof Typography>> = ({
  children,
  ...props
}) => (
  <Typography variant="body2" component="label" sx={{ fontWeight: 600, mb: 1, ...(props.sx ?? {}) }} {...props}>
    {children}
  </Typography>
);

export const Textarea: React.FC<React.ComponentProps<typeof TextField>> = (props) => (
  <TextField multiline rows={4} {...props} />
);

export const DropdownMenu: React.FC<{ children: React.ReactNode } & React.ComponentProps<typeof Box>> = ({
  children,
  ...props
}) => <Box {...props}>{children}</Box>;

export const DropdownMenuTrigger: React.FC<{ children: React.ReactNode } & React.ComponentProps<typeof Box>> = ({
  children,
  ...props
}) => <Box {...props}>{children}</Box>;

export const DropdownMenuContent: React.FC<{ children: React.ReactNode } & React.ComponentProps<typeof Menu>> = ({
  children,
  ...props
}) => <Menu {...props}>{children}</Menu>;

export const DropdownMenuItem: React.FC<{ children: React.ReactNode } & React.ComponentProps<typeof MenuItem>> = ({
  children,
  ...props
}) => <MenuItem {...props}>{children}</MenuItem>;

export const DropdownMenuSeparator: React.FC<React.ComponentProps<typeof Divider>> = (props) => <Divider {...props} />;

export const Card: React.FC<{ children: React.ReactNode } & React.ComponentProps<typeof MuiCard>> = ({
  children,
  ...props
}) => <MuiCard {...props}>{children}</MuiCard>;

export const SelectTrigger: React.FC<{ children: React.ReactNode } & React.ComponentProps<typeof Box>> = ({
  children,
  ...props
}) => <Box {...props}>{children}</Box>;
