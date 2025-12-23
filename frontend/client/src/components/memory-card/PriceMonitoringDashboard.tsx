/**
 * CreatorHub Norge - Price Monitoring Dashboard
 * Real-time price monitoring and update management
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { useClientServicePricing } from '../../services/ClientServicePricingService';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Alert,
  LinearProgress,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Memory,
  Refresh,
  TrendingUp,
  TrendingDown,
  Warning,
  CheckCircle,
  Info,
  Settings,
  Notifications,
  NotificationsOff,
  PlayArrow,
  Stop,
  Assessment,
  Timeline,
  Close,
} from '@mui/icons-material';
import {
  globalPriceUpdater,
  PriceUpdateEvent,
  PriceUpdateConfig,
} from '../../services/memory-card-price-updater';
import { formatCurrency } from '../../data/memory-card-database';

interface PriceMonitoringDashboardProps {
  onClose?: () => void;
}

const PriceMonitoringDashboard: React.FC<PriceMonitoringDashboardProps> = ({
  onClose
}) => {
  const [status, setStatus] = useState(globalPriceUpdater.getStatus());
  
  // Theming system
  const theming = useTheming('photographer');

  // Client service pricing service integration
  const { 
    formatCurrency: formatCurrencyService,
    convertCurrency,
    isLoading: pricingLoading 
} = useClientServicePricing();
  const [priceAlerts, setPriceAlerts] = useState(globalPriceUpdater.getPriceAlerts());
  const [recentUpdates, setRecentUpdates] = useState<PriceUpdateEvent[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<PriceUpdateConfig>(status.config);

  useEffect(() => {
    // Set up price update listener
    const handlePriceUpdate = (event: PriceUpdateEvent) => {
      setPriceAlerts(globalPriceUpdater.getPriceAlerts());
      setRecentUpdates(prev => [event, ...prev.slice(0, 49)]); // Keep last 50 };

    globalPriceUpdater.addListener(handlePriceUpdate);

    // Update status periodically
    const statusInterval = setInterval(() => {
      setStatus(globalPriceUpdater.getStatus());
  }, 5000);

    return () => {
      globalPriceUpdater.removeListener(handlePriceUpdate);
      clearInterval(statusInterval);
  };
}, []);

  const handleStartMonitoring = () => {
    globalPriceUpdater.start();
    setStatus(globalPriceUpdater.getStatus());
};

  const handleStopMonitoring = () => {
    globalPriceUpdater.stop();
    setStatus(globalPriceUpdater.getStatus());
};

  const handleForceUpdate = async () => {
    await globalPriceUpdater.forceUpdate();
    setStatus(globalPriceUpdater.getStatus());
};

  const handleConfigUpdate = () => {
    globalPriceUpdater.updateConfig(config);
    setStatus(globalPriceUpdater.getStatus());
    setShowSettings(false);
};

  const getChangeIcon = (changePercent: number) => {
    if (changePercent > 0) return <TrendingUp color="error" />;
    if (changePercent < 0) return <TrendingDown color="success" />;
    return <Info color="info" />;
,};

  const getChangeColor = (changePercent: number) => {
    if (Math.abs(changePercent) > 20) return 'error';
    if (Math.abs(changePercent) > 10) return 'warning';
    return 'info';
,};

  return (
    <Box sx={{ p:  2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
        <Typography variant="h5" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
          <Memory />
          Price Monitoring Dashboard
        </Typography>
        <Box sx={{ display: 'flex', gap:  1 }}>
          <IconButton onClick={() => setShowSettings(true)}>
            {theming.getThemedIcon('settings')}
          </IconButton>
          {onClose && (
            <IconButton onClick={onClose}>
              {theming.getThemedIcon('close')}
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Status Overview */}
      <Grid container spacing={2} sx={{ mb:  3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color={status.isRunning ? 'success.main' : 'error.main'} sx={{ color: theming.colors.primary }}>
                {status.isRunning ? '🟢' : '🔴'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {status.isRunning ? 'Running' : 'Stopped'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {status.totalUpdates}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Updates
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                {status.significantChanges}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Significant Changes
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                {status.lastUpdate ? 
                  new Date(status.lastUpdate).toLocaleTimeString() : 
                  'Never'
              }
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Last Update
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Control Panel */}
      <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Control Panel
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap'}}>
            <Button variant="contained"
              startIcon={status.isRunning ? theming.getThemedIcon('stop') : theming.getThemedIcon('play')}
              onClick={status.isRunning ? handleStopMonitoring : handleStartMonitoring}
              color={status.isRunning ? 'error' : 'success'}
             sx={theming.getThemedButtonSx()}>
              {status.isRunning ? 'Stop Monitoring' : 'Start Monitoring'}
            </Button>
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('refresh')}
              onClick={handleForceUpdate}
              disabled={!status.isRunning}
            >
              Force Update
            </Button>
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('settings')}
              onClick={() => setShowSettings(true)}
            >
              Settings
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Price Alerts */}
      {priceAlerts.length > 0 && (
        <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
              {theming.getThemedIcon('warning')}
              Price Alerts ({priceAlerts.length})
            </Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Card Type</TableCell>
                    <TableCell>Capacity</TableCell>
                    <TableCell>Change</TableCell>
                    <TableCell>New Price</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {priceAlerts.slice(0, 10).map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell>{alert.cardType}</TableCell>
                      <TableCell>{alert.capacity}</TableCell>
                      <TableCell>
                        <Chip
                          icon={getChangeIcon(alert.changePercent)}
                          label={`${alert.changePercent > 0 ? '+' : ','}${alert.changePercent.toFixed(1)}%`}
                          color={getChangeColor(alert.changePercent)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {formatCurrency(alert.newPrice, alert.currency as any)}
                      </TableCell>
                      <TableCell>{alert.source}</TableCell>
                      <TableCell>
                        {new Date(alert.timestamp).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent Updates */}
      <Card sx={theming.getThemedCardSx()}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Recent Price Updates
          </Typography>
          {recentUpdates.length > 0 ? (
            <List>
              {recentUpdates.slice(0, 20).map((update) => (
                <ListItem key={update.id} divider>
                  <ListItemIcon>
                    {getChangeIcon(update.changePercent)}
                  </ListItemIcon>
                  <ListItemText
                    primary={`${update.cardType} ${update.capacity} - ${update.source}`}
                    secondary={
                      <Box>
                        <Typography variant="body2">
                          {update.oldPrice > 0 ? 
                            `${formatCurrency(update.oldPrice, update.currency as any)} → ${formatCurrency(update.newPrice, update.currency as any)}` :
                            `New: ${formatCurrency(update.newPrice, update.currency as any)}`
                        }
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {update.changePercent > 0 ? '+' : ', '}{update.changePercent.toFixed(1)}% • {new Date(update.timestamp).toLocaleString()}
                        </Typography>
                      </Box>
                  }
                  />
                  {update.isSignificant && (
                    <Chip
                      label="Significant"
                      color="warning"
                      size="small"
                    />
                  )}
                </ListItem>
              ))}
            </List>
          ) : (
            <Alert severity="info">
              No recent price updates. Start monitoring to see updates here.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="md" fullWidth>
        <DialogTitle>Price Monitoring Settings</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:  1 }}>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableNotifications}
                    onChange={(e) => setConfig(prev => ({ ...prev, enableNotifications: e.target.checked }))}
                  />
              }
                label="Enable Notifications"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={status.isRunning}
                    onChange={(e) => e.target.checked ? handleStartMonitoring() : handleStopMonitoring()}
                  />
              }
                label="Auto-start on load"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" gutterBottom>
                Update Interval (minutes)
              </Typography>
              <input
                type="number"
                value={config.updateInterval}
                onChange={(e) => setConfig(prev => ({ ...prev, updateInterval: Number(e.target.value, ),}))}
                min="5"
                max="1440"
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px'}}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" gutterBottom>
                Significant Change Threshold (%)
              </Typography>
              <input
                type="number"
                value={config.significantChangeThreshold}
                onChange={(e) => setConfig(prev => ({ ...prev, significantChangeThreshold: Number(e.target.value, ),}))}
                min="1"
                max="50"
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px'}}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Cancel</Button>
          <Button onClick={handleConfigUpdate} variant="contained" sx={theming.getThemedButtonSx()}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PriceMonitoringDashboard;





