// @ts-nocheck
import { useTheming } from '../utils/theming-helper';
import { useQueryClient } from "/react-query";
1import { Box, Typography } from '@mui/material';
import { apiRequest } from '@/lib/queryClient';
// Import dynamic profession system
import { useDynamicProfessions } from './universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';

// Import enhanced loading components
import { LoadingWrapper, SkeletonLoader, ErrorState } from './ui/enhanced-loading';

export default function PerformanceAnalyticsDashboard() {
  // Get user and profession context
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const userProfession = user?.profession || 'photographer';
  
  // Use dynamic profession system
  const { professionConfigs, isLoading: professionsLoading } = useDynamicProfessions();
  const professionConfig = professionConfigs?.[userProfession];

  const queryClient = useQueryClient();
  
  // Database connection for PerformanceAnalyticsDashboard with profession context
  const { data: dashboardData = [], isLoading } = useQuery({
    queryKey: ['/api/performance', 'user-data', userProfession],
    queryFn: () => apiRequest(`/api/performance/user-data?profession=${userProfession}`),
    retry: false,
});

  // Mutation for updating dashboard data
  const updatePerformanceAnalyticsDashboard = useMutation({
    mutationFn: async (data: any) => 
      apiRequest('/api/dashboard/update', {
        method: 'POST',
        body: JSON.stringify(data)
  }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard', ],});
  }
});

  return (
    <LoadingWrapper
      loading={isLoading || professionsLoading}
      loadingComponent={
        <Box sx={{ p:  2 }}>
          <Typography variant="h6" sx={{  mb:  2  }}>
            {professionConfig ? `${professionConfig.displayName} - Performance Analytics` : 'Performance Analytics Dashboard'}
          </Typography>
          <SkeletonLoader 
            rows={5}
            height={60}
            message="Laster ytelsesdata og statistikk..."
          />
        </Box>
    }
    >
      <Box sx={{ p:  2 }}>
        <Typography variant="h4" sx={{  mb: 1, fontWeight: 'bold' }}>
          {professionConfig ? `${professionConfig.displayName} - Performance Analytics` : 'Performance Analytics Dashboard'}
        </Typography>
        {professionConfig && (
          <Typography variant="body1" color="text.secondary" sx={{ mb:  3 }}>
            Ytelsesanalyse og benchmarking for {professionConfig.displayName.toLowerCase()}
          </Typography>
        )}
        
        {/* Dashboard Content */}
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: '1fr 1fr 1fr',},
          gap:  2,
          mt: 3 }}>
          <Box sx={{ 
            p:  3, 
            borderRadius: 2
           , bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider'
      }}>
            <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
              Månedlig Ytelse
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Statistikk for inneværende måned
            </Typography>
          </Box>
          
          <Box sx={{ 
            p:  3, 
            borderRadius: 2
           , bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider'
      }}>
            <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
              Prosjektoversikt
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Status på pågående prosjekter
            </Typography>
          </Box>
          
          <Box sx={{ 
            p:  3, 
            borderRadius: 2
           , bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider'
      }}>
            <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
              Kvalitetsmålinger
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Kundetilfredshet og leveringskvalitet
            </Typography>
          </Box>
        </Box>
      </Box>
    </LoadingWrapper>
  );
}