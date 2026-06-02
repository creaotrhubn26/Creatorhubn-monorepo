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
      case 0: return '#ff8c00';
      case 1: return '#2196f3';
      case 2: return '#f44336';
      case 3: return '#4caf50';
      default: return '#757575';
  }
};

  return (
    <Box sx={{ width: '100%', bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ bgcolor: 'white', boxShadow: 1, mb: 3 }}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h4" gutterBottom sx={{ color: '#ff8c00', fontWeight: 'bold' }}>
            🔍 Verification System Testing Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            Test the complete "Fixing Things" verification system in real-time. 
            Watch how problems reported through the chat widget flow through 
            the entire verification workflow to ensure fixes actually work.
          </Typography>
          
          {/* Quick Stats */}
          <Grid container spacing={1.5} sx={{ mt: 2 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#e3f2fd' }}>
                <Typography variant="h5" color="primary">{demoStats.totalDemos}</Typography>
                <Typography variant="caption">Total Demos Run</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#e8f5e8' }}>
                <Typography variant="h5" color="success.main">{demoStats.successfulDemos}</Typography>
                <Typography variant="caption">Successful</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#ffebee' }}>
                <Typography variant="h5" color="error.main">{demoStats.failedDemos}</Typography>
                <Typography variant="caption">Failed</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fff3e0' }}>
                <Typography variant="h5" color="warning.main">{demoStats.averageTime}s</Typography>
                <Typography variant="caption">Avg. Time</Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </Box>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'white' }}>
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
      <Box sx={{ bgcolor: 'white', p: 3, mt: 3, borderTop: 1, borderColor: 'divider' }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>🔍 Verification System Overview:</strong> This dashboard demonstrates the complete "Fixing Things" 
            verification system. Start with the Live Demo to see the full workflow in action, then explore 
            individual components to understand how each part works.
          </Typography>
        </Alert>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PlayArrow color="primary" />
                  Live Demo
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Watch the complete verification workflow in real-time. Simulates a real problem report 
                  through the chat widget and shows the entire process.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Science color="primary" />
                  Step-by-Step Demo
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Interactive step-by-step demonstration of each verification phase. 
                  Perfect for understanding the detailed workflow.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BugReport color="primary" />
                  Real Components
                </Typography>
                <Typography variant="body2" color="text.secondary">
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


