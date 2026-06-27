import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Grid,
  Button,
  Chip,
  Paper,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  PlayArrow,
  Science,
  BugReport,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Refresh,
  Info,
} from '@mui/icons-material';
import VerificationSystemDemo from './VerificationSystemDemo';
import LiveVerificationDemo from './LiveVerificationDemo';
import PrototypeFeedbackPanel from './PrototypeFeedbackPanel';
import CompleteDeploymentManager from './CompleteDeploymentManager';
import { adminTokens } from './design-system';

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
      id={`demo-tabpanel-${index}`}
      aria-labelledby={`demo-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export default function VerificationSystemDashboard() {
  const [activeTab, setActiveTab] = useState(0);
  const [demoStats, setDemoStats] = useState({
    totalDemos: 0,
    successfulDemos: 0,
    failedDemos: 0,
    averageTime: 0
});

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
};

  const getTabIcon = (index: number) => {
    switch (index) {
      case 0: return <PlayArrow />;
      case 1: return <Science />;
      case 2: return <BugReport />;
      case 3: return <CheckCircle />;
      default: return <Info />;
  }
};

  const getTabColor = (index: number) => {
    switch (index) {
      case 0: return adminTokens.color.brand;
      case 1: return '#2196f3';
      case 2: return adminTokens.color.error;
      case 3: return adminTokens.color.success;
      default: return '#757575';
  }
};

  return (
    <Box sx={{ width: '100%', bgcolor: '#0a0f1a', minHeight: '100vh', color: '#fff' }}>
      {/* Header */}
      <Box
        sx={{
          bgcolor: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 14px 40px rgba(0,0,0,0.35)',
          mb: 3,
          color: '#fff',
        }}
      >
        <Box sx={{ p: 3 }}>
          <Typography variant="h4" gutterBottom sx={{ color: adminTokens.color.brand, fontWeight: 'bold' }}>
            Verification System Testing Dashboard
          </Typography>
          <Typography variant="body1" sx={{ mb: 2, color: 'rgba(255,255,255,0.7)' }}>
            Test the complete "Fixing Things" verification system in real-time.
            Watch how problems reported through the chat widget flow through
            the entire verification workflow to ensure fixes actually work.
          </Typography>

          {/* Quick Stats */}
          <Grid container spacing={1.5} sx={{ mt: 2 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                sx={{
                  p: 2,
                  textAlign: 'center',
                  bgcolor: 'rgba(33,150,243,0.16)',
                  border: '1px solid rgba(33,150,243,0.32)',
                  color: '#fff',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <Typography variant="h5" sx={{ color: '#64b5f6' }}>{demoStats.totalDemos}</Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Total Demos Run</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                sx={{
                  p: 2,
                  textAlign: 'center',
                  bgcolor: 'rgba(76,175,80,0.16)',
                  border: '1px solid rgba(76,175,80,0.32)',
                  color: '#fff',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <Typography variant="h5" sx={{ color: '#81c784' }}>{demoStats.successfulDemos}</Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Successful</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                sx={{
                  p: 2,
                  textAlign: 'center',
                  bgcolor: 'rgba(244,67,54,0.16)',
                  border: '1px solid rgba(244,67,54,0.32)',
                  color: '#fff',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <Typography variant="h5" sx={{ color: '#e57373' }}>{demoStats.failedDemos}</Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Failed</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                sx={{
                  p: 2,
                  textAlign: 'center',
                  bgcolor: 'rgba(255,152,0,0.16)',
                  border: '1px solid rgba(255,152,0,0.32)',
                  color: '#fff',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <Typography variant="h5" sx={{ color: '#ffb74d' }}>{demoStats.averageTime}s</Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Avg. Time</Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </Box>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1 }}>
        <Box sx={{ borderBottom: `1px solid ${adminTokens.color.border}`, bgcolor: adminTokens.color.surface }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange} 
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                minHeight: 80,
                fontSize: '1rem',
                fontWeight: 600,
                textTransform: 'none'
            }
          }}
          >
            <Tab 
              icon={getTabIcon(0)} 
              label="Live Demo" 
              iconPosition="start"
              sx={{ 
                color: getTabColor(0),
                '&.Mui-selected': { color: getTabColor(0) }
            }}
            />
            <Tab 
              icon={getTabIcon(1)} 
              label="Step-by-Step Demo" 
              iconPosition="start"
              sx={{ 
                color: getTabColor(1),
                '&.Mui-selected': { color: getTabColor(1) }
            }}
            />
            <Tab 
              icon={getTabIcon(2)} 
              label="Feedback Panel" 
              iconPosition="start"
              sx={{ 
                color: getTabColor(2),
                '&.Mui-selected': { color: getTabColor(2) }
            }}
            />
            <Tab 
              icon={getTabIcon(3)} 
              label="Deployment Manager" 
              iconPosition="start"
              sx={{ 
                color: getTabColor(3),
                '&.Mui-selected': { color: getTabColor(3) }
            }}
            />
          </Tabs>
        </Box>

        {/* Tab Panels */}
        <TabPanel value={activeTab} index={0}>
          <LiveVerificationDemo />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <VerificationSystemDemo />
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <PrototypeFeedbackPanel />
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <CompleteDeploymentManager />
        </TabPanel>
      </Box>

      {/* Footer Info */}
      <Box
        sx={{
          bgcolor: adminTokens.color.surface,
          p: 3,
          mt: 3,
          borderTop: `1px solid ${adminTokens.color.border}`,
          color: '#fff',
        }}
      >
        <Alert
          severity="info"
          sx={{
            mb: 2,
            bgcolor: 'rgba(33,150,243,0.12)',
            border: '1px solid rgba(33,150,243,0.32)',
            color: '#fff',
            '& .MuiAlert-icon': { color: '#64b5f6' },
          }}
        >
          <Typography variant="body2">
            <strong>Verification System Overview:</strong> This dashboard demonstrates the complete "Fixing Things"
            verification system. Start with the Live Demo to see the full workflow in action, then explore
            individual components to understand how each part works.
          </Typography>
        </Alert>

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card
              sx={{
                height: '100%',
                bgcolor: 'rgba(255,255,255,0.06)',
                border: `1px solid ${adminTokens.color.border}`,
                backdropFilter: 'blur(8px)',
                color: '#fff',
                boxShadow: 'none',
              }}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#fff' }}>
                  <PlayArrow sx={{ color: '#64b5f6' }} />
                  Live Demo
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Watch the complete verification workflow in real-time. Simulates a real problem report
                  through the chat widget and shows the entire process.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card
              sx={{
                height: '100%',
                bgcolor: 'rgba(255,255,255,0.06)',
                border: `1px solid ${adminTokens.color.border}`,
                backdropFilter: 'blur(8px)',
                color: '#fff',
                boxShadow: 'none',
              }}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#fff' }}>
                  <Science sx={{ color: '#64b5f6' }} />
                  Step-by-Step Demo
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Interactive step-by-step demonstration of each verification phase.
                  Perfect for understanding the detailed workflow.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card
              sx={{
                height: '100%',
                bgcolor: 'rgba(255,255,255,0.06)',
                border: `1px solid ${adminTokens.color.border}`,
                backdropFilter: 'blur(8px)',
                color: '#fff',
                boxShadow: 'none',
              }}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#fff' }}>
                  <BugReport sx={{ color: '#64b5f6' }} />
                  Real Components
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Access the actual PrototypeFeedbackPanel and CompleteDeploymentManager
                  components with real data and functionality.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}


