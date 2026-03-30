import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  Headset,
  PhotoCamera,
  Videocam,
} from '@mui/icons-material';
import { useTheming } from '../utils/theming-helper';
import { apiRequest } from '@/lib/queryClient';

interface CreatorNavigationProps {
  onNavigate: (path: string) => void;
}

interface CreatorRoleCard {
  id: 'photographer' | 'videographer' | 'music_producer';
  title: string;
  description: string;
  path: string;
  icon: React.ReactElement;
  features: string[];
}

interface NavigationAnalyticsResponse {
  lastVisitedRole?: string;
}

const ROLE_CARDS: CreatorRoleCard[] = [
  {
    id: 'photographer',
    title: 'Photographers',
    description: 'Manage photo delivery, client galleries, and booking workflows for weddings and events.',
    path: '/photographer-dashboard',
    icon: <PhotoCamera sx={{ fontSize: 32, color: '#2563eb' }} />,
    features: ['Share photo galleries', 'Book appointments', 'Show your best work'],
  },
  {
    id: 'videographer',
    title: 'Videographers',
    description: 'Plan shoots, deliver edits, and collaborate with couples and vendors from one workspace.',
    path: '/videographer-dashboard',
    icon: <Videocam sx={{ fontSize: 32, color: '#7c3aed' }} />,
    features: ['Video editing workflows', 'Live event delivery', 'Client review links'],
  },
  {
    id: 'music_producer',
    title: 'Music Producers',
    description: 'Produce, review, and share wedding music with couples and creative collaborators.',
    path: '/music-producer-dashboard',
    icon: <Headset sx={{ fontSize: 32, color: '#ea580c' }} />,
    features: ['Music creation tools', 'Artist collaboration', 'Share mixes with couples'],
  },
];

export default function CreatorNavigation({ onNavigate }: CreatorNavigationProps) {
  const queryClient = useQueryClient();
  const theming = useTheming('photographer');

  const { data, isLoading } = useQuery<NavigationAnalyticsResponse>({
    queryKey: ['/api/component/user-data'],
    queryFn: async () => {
      const response = (await apiRequest('/api/component/user-data')) as Partial<NavigationAnalyticsResponse>;
      return {
        lastVisitedRole:
          response.lastVisitedRole === 'photographer' ||
          response.lastVisitedRole === 'videographer' ||
          response.lastVisitedRole === 'music_producer'
            ? response.lastVisitedRole
            : undefined,
      };
    },
    retry: false,
  });

  const updateCreatorNavigation = useMutation({
    mutationFn: async (payload: { lastVisitedRole: CreatorRoleCard['id'] }) =>
      apiRequest('/api/component/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/component/user-data'] });
    },
  });

  return (
    <Box
      component="section"
      sx={{
        py: 10,
        px: { xs: 2, md: 4 },
        background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
      }}
    >
      <Box sx={{ maxWidth: 1180, mx: 'auto' }}>
        <Stack spacing={2} sx={{ textAlign: 'center', mb: 5 }}>
          <Typography variant="h3" sx={{ fontWeight: 700, color: theming.colors.primary }}>
            For Wedding Professionals
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 760, mx: 'auto' }}>
            Easy-to-use tools for photographers, videographers, and music producers who help create memorable weddings.
          </Typography>
          {data?.lastVisitedRole && (
            <Box>
              <Chip label={`Sist åpnet: ${data.lastVisitedRole}`} color="primary" variant="outlined" />
            </Box>
          )}
        </Stack>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
              gap: 3,
            }}
          >
            {ROLE_CARDS.map((role) => (
              <Card
                key={role.id}
                sx={{
                  height: '100%',
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  ...theming.getThemedCardSx(),
                }}
              >
                <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'center' }}>{role.icon}</Box>
                  <Typography variant="h5" align="center" sx={{ fontWeight: 700 }}>
                    {role.title}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" align="center">
                    {role.description}
                  </Typography>

                  <Stack spacing={1.25} sx={{ flex: 1 }}>
                    {role.features.map((feature) => (
                      <Box key={feature} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircle sx={{ fontSize: 18, color: 'success.main' }} />
                        <Typography variant="body2">{feature}</Typography>
                      </Box>
                    ))}
                  </Stack>

                  <Button
                    variant="contained"
                    onClick={() => {
                      updateCreatorNavigation.mutate({ lastVisitedRole: role.id });
                      onNavigate(role.path);
                    }}
                    disabled={updateCreatorNavigation.isPending}
                  >
                    Join as {role.title.slice(0, -1)}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
