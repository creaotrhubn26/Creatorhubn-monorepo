/**
 * Reusable Skeleton Loader Components
 * Provides consistent loading states across the application
 */

import React, { memo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Skeleton,
  Stack,
  ListItem,
  ListItemAvatar,
  ListItemText,
  TableRow,
  TableCell,
} from '@mui/material';

// Card Skeleton - For course cards, asset cards, etc.
export const CardSkeleton = memo(({ height = 300 }: { height?: number }) => (
  <Card sx={{ height }}>
    <Skeleton variant="rectangular" height={height * 0.6} />
    <CardContent>
      <Skeleton variant="text" width="80%" height={28} />
      <Skeleton variant="text" width="60%" height={20} sx={{ mt: 1 }} />
      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Skeleton variant="circular" width={24} height={24} />
        <Skeleton variant="text" width="40%" height={20} />
      </Stack>
    </CardContent>
  </Card>
));

CardSkeleton.displayName = 'CardSkeleton';

// List Item Skeleton - For lists, communications, etc.
export const ListItemSkeleton = memo(() => (
  <ListItem>
    <ListItemAvatar>
      <Skeleton variant="circular" width={40} height={40} />
    </ListItemAvatar>
    <ListItemText
      primary={<Skeleton variant="text" width="60%" height={24} />}
      secondary={<Skeleton variant="text" width="80%" height={20} />}
    />
  </ListItem>
));

ListItemSkeleton.displayName = 'ListItemSkeleton';

// Table Row Skeleton - For data tables
export const TableRowSkeleton = memo(({ columns = 5 }: { columns?: number }) => (
  <TableRow>
    {[...Array(columns)].map((_, i) => (
      <TableCell key={i}>
        <Skeleton variant="text" width="90%" height={20} />
      </TableCell>
    ))}
  </TableRow>
));

TableRowSkeleton.displayName = 'TableRowSkeleton';

// Asset Card Skeleton - For media assets
export const AssetCardSkeleton = memo(() => (
  <Box sx={{ p: 1 }}>
    <Card>
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Skeleton variant="circular" width={48} height={48} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="40%" height={20} />
            <Skeleton variant="text" width="30%" height={16} />
          </Box>
          <Skeleton variant="circular" width={24} height={24} />
        </Stack>
      </CardContent>
    </Card>
  </Box>
));

AssetCardSkeleton.displayName = 'AssetCardSkeleton';

// Course Card Skeleton - For course listings
export const CourseCardSkeleton = memo(() => (
  <Card sx={{ height: '100%' }}>
    <Skeleton variant="rectangular" height={180} />
    <CardContent>
      <Skeleton variant="text" width="80%" height={28} />
      <Skeleton variant="text" width="100%" height={20} sx={{ mt: 1 }} />
      <Skeleton variant="text" width="90%" height={20} />
      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 1 }} />
        <Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: 1 }} />
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
        <Skeleton variant="circular" width={24} height={24} />
        <Skeleton variant="text" width="40%" height={20} />
      </Stack>
    </CardContent>
  </Card>
));

CourseCardSkeleton.displayName = 'CourseCardSkeleton';

// Lesson Item Skeleton - For lesson lists
export const LessonItemSkeleton = memo(() => (
  <ListItem>
    <ListItemText
      primary={<Skeleton variant="text" width="70%" height={24} />}
      secondary={<Skeleton variant="text" width="40%" height={20} />}
    />
    <Stack direction="row" spacing={1}>
      <Skeleton variant="circular" width={32} height={32} />
      <Skeleton variant="circular" width={32} height={32} />
    </Stack>
  </ListItem>
));

LessonItemSkeleton.displayName = 'LessonItemSkeleton';

// Student Progress Skeleton - For progress tracking
export const StudentProgressSkeleton = memo(() => (
  <ListItem>
    <ListItemText
      primary={<Skeleton variant="text" width="50%" height={24} />}
      secondary={
        <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
          <Skeleton variant="text" width={100} height={20} />
          <Skeleton variant="text" width={120} height={20} />
          <Skeleton variant="text" width={140} height={20} />
        </Stack>
      }
    />
    <Stack direction="row" spacing={1}>
      <Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: 1 }} />
      <Skeleton variant="rectangular" width={70} height={24} sx={{ borderRadius: 1 }} />
      <Skeleton variant="rectangular" width={70} height={24} sx={{ borderRadius: 1 }} />
    </Stack>
  </ListItem>
));

StudentProgressSkeleton.displayName = 'StudentProgressSkeleton';

// Communication Item Skeleton
export const CommunicationItemSkeleton = memo(() => (
  <ListItem>
    <ListItemAvatar>
      <Skeleton variant="circular" width={40} height={40} />
    </ListItemAvatar>
    <ListItemText
      primary={<Skeleton variant="text" width="70%" height={24} />}
      secondary={
        <Box>
          <Skeleton variant="text" width="50%" height={20} />
          <Skeleton variant="text" width="30%" height={16} />
        </Box>
      }
    />
  </ListItem>
));

CommunicationItemSkeleton.displayName = 'CommunicationItemSkeleton';

// Grid Skeleton - For grid layouts
export const GridSkeleton = memo(({ count = 6, height = 300 }: { count?: number; height?: number }) => (
  <>
    {[...Array(count)].map((_, i) => (
      <Box key={i} sx={{ p: 1 }}>
        <CardSkeleton height={height} />
      </Box>
    ))}
  </>
));

GridSkeleton.displayName ='GridSkeleton';

