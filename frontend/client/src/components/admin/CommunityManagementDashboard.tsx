/**
 * Community Management Dashboard
 * 
 * Comprehensive admin interface for managing:
 * - Community groups and channels
 * - Onboarding experience with videos
 * - Channel rules and moderation
 * - Light pattern promotion system
 * - User roles and badges
 */

import React, { useState } from 'react';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useTheming } from '@/utils/theming-helper';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  Grid,
  IconButton,
  Alert,
  ThemeProvider,
  Paper,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import { adminTokens } from './design-system';
import {
  Group,
  Settings,
  School,
  Lightbulb,
  EmojiEvents,
  Add,
  Edit,
  Delete,
  Visibility,
  Gavel,
} from '@mui/icons-material';

import GroupManagement from './community/GroupManagement';
import ChannelManagement from './community/ChannelManagement';
import OnboardingEditor from './community/OnboardingEditor';
import LightPatternPromotion from './community/LightPatternPromotion';
import RolesAndBadges from './community/RolesAndBadges';
import CommunityAnalytics from './community/CommunityAnalytics';
import ModerationManagement from './community/ModerationManagement';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`community-tabpanel-${index}`}
      aria-labelledby={`community-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function CommunityManagementDashboard() {
  const [tabValue, setTabValue] = useState(0);
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  const theming = useTheming(currentProfession);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const communityTabs = [
    { id: 'groups', label: 'Groups & Channels', icon: Group },
    { id: 'onboarding', label: 'Onboarding Experience', icon: School },
    { id: 'light-patterns', label: 'Light Pattern Promotion', icon: Lightbulb },
    { id: 'roles-badges', label: 'Roles & Badges', icon: EmojiEvents },
    { id: 'moderation', label: 'Moderation', icon: Gavel },
    { id: 'analytics', label: 'Analytics', icon: Settings },
  ];

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Container maxWidth="xl" sx={{ py: 0 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {professionIcon && (
            <Box aria-hidden="true" sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
              {professionIcon}
            </Box>
          )}
          <Group aria-hidden="true" sx={{ fontSize: 40, color: adminTokens.color.brand }} />
          {enhancedProfessionConfig?.displayName || professionConfig?.displayName
            ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Community Management`
            : 'Community Management'}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage community groups, channels, onboarding experience, and light pattern promotion
        </Typography>
      </Box>

      {/* Quick Stats */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <CardContent>
              <Typography variant="h6">Total Groups</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, my: 1 }}>
                4
              </Typography>
              <Typography variant="body2">Active profession groups</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
            <CardContent>
              <Typography variant="h6">Total Channels</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, my: 1 }}>
                12
              </Typography>
              <Typography variant="body2">Across all groups</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
            <CardContent>
              <Typography variant="h6">Active Members</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, my: 1 }}>
                156
              </Typography>
              <Typography variant="body2">Community members</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: 'white' }}>
            <CardContent>
              <Typography variant="h6">Pending Patterns</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, my: 1 }}>
                8
              </Typography>
              <Typography variant="body2">Awaiting promotion</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTabs-indicator': {
              backgroundColor: adminTokens.color.brand,
            }
          }}
        >
          {communityTabs.map((tab, index) => {
            const IconComponent = tab.icon;
            return (
              <Tab
                key={tab.id}
                icon={<IconComponent />}
                label={tab.label}
                iconPosition="start"
                  sx={{
                    textTransform: 'none',
                    minHeight: 64,
                    '&.Mui-selected': {
                      color: adminTokens.color.brand,
                    }}}
              />
            );
          })}
        </Tabs>
      </Paper>

      {/* Tab Panels */}
      <TabPanel value={tabValue} index={0}>
        <GroupManagement />
        <Box sx={{ mt: 4 }}>
          <ChannelManagement />
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <OnboardingEditor />
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <LightPatternPromotion />
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <RolesAndBadges />
      </TabPanel>

      <TabPanel value={tabValue} index={4}>
        <ModerationManagement />
      </TabPanel>

      <TabPanel value={tabValue} index={5}>
        <CommunityAnalytics />
      </TabPanel>
    </Container>
    </ThemeProvider>
  );
}

