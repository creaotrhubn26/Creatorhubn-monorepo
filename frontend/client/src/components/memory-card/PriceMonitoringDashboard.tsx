// @ts-nocheck
/**
 * CreatorHub Norge - Price Monitoring Dashboard
 * Real-time price monitoring and update management for memory cards.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  type ChipProps,
} from '@mui/material';
import {
  CheckCircle,
  Info,
  PlayArrow,
  Refresh,
  Settings,
  Stop,
  TrendingDown,
  TrendingUp,
  Warning,
  Close,
} from '@mui/icons-material';
import Grid from '@mui/material/Grid2';
import { useTheming } from '../../utils/theming-helper';
import {
  globalPriceUpdater,
  type PriceUpdateConfig,
  type PriceUpdateEvent,
} from '../../services/memory-card-price-updater';
import {
  useClientServicePricing,
  type Currency,
} from '../../services/ClientServicePricingService';

interface PriceMonitoringDashboardProps {
  onClose?: () => void;
}

const CURRENCIES: readonly Currency[] = ['NOK', 'SEK', 'DKK', 'USD'] as const;

function isCurrency(value: string): value is Currency {
  return CURRENCIES.includes(value as Currency);
}

function formatPercent(changePercent: number): string {
  const sign = changePercent > 0 ? '+' : '';
  return `${sign}${changePercent.toFixed(1)}%`;
}

const PriceMonitoringDashboard: React.FC<PriceMonitoringDashboardProps> = ({ onClose }) => {
  const theming = useTheming('photographer');
  const { formatCurrency } = useClientServicePricing();

  const [status, setStatus] = useState(globalPriceUpdater.getStatus());
  const [priceAlerts, setPriceAlerts] = useState(globalPriceUpdater.getPriceAlerts());
  const [recentUpdates, setRecentUpdates] = useState<PriceUpdateEvent[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<PriceUpdateConfig>(globalPriceUpdater.getStatus().config);

  useEffect(() => {
    const handlePriceUpdate = (event: PriceUpdateEvent): void => {
      setPriceAlerts(globalPriceUpdater.getPriceAlerts());
      setRecentUpdates((previous) => [event, ...previous].slice(0, 50));
    };

    globalPriceUpdater.addListener(handlePriceUpdate);

    const refreshStatus = (): void => {
      setStatus(globalPriceUpdater.getStatus());
      setPriceAlerts(globalPriceUpdater.getPriceAlerts());
    };

    refreshStatus();
    const interval = window.setInterval(refreshStatus, 3000);

    return () => {
      window.clearInterval(interval);
      globalPriceUpdater.removeListener(handlePriceUpdate);
    };
  }, []);

  const significantAlertCount = useMemo(
    () => priceAlerts.filter((alert) => Math.abs(alert.changePercent) >= config.significantChangeThreshold).length,
    [priceAlerts, config.significantChangeThreshold],
  );

  const handleStartMonitoring = (): void => {
    globalPriceUpdater.start();
    setStatus(globalPriceUpdater.getStatus());
  };

  const handleStopMonitoring = (): void => {
    globalPriceUpdater.stop();
    setStatus(globalPriceUpdater.getStatus());
  };

  const handleForceUpdate = async (): Promise<void> => {
    await globalPriceUpdater.forceUpdate();
    setStatus(globalPriceUpdater.getStatus());
    setPriceAlerts(globalPriceUpdater.getPriceAlerts());
  };

  const handleConfigUpdate = (): void => {
    globalPriceUpdater.updateConfig(config);
    setStatus(globalPriceUpdater.getStatus());
    setShowSettings(false);
  };

  const getChangeIcon = (changePercent: number): React.ReactNode => {
    if (changePercent > 0) return <TrendingUp color="error" fontSize="small" />;
    if (changePercent < 0) return <TrendingDown color="success" fontSize="small" />;
    return <Info color="info" fontSize="small" />;
  };

  const getChangeColor = (changePercent: number): ChipProps['color'] => {
    const absolute = Math.abs(changePercent);
    if (absolute >= 20) return 'error';
    if (absolute >= 10) return 'warning';
    return 'info';
  };

  const formatAmount = (amount: number, rawCurrency: string): string => {
    const currency = isCurrency(rawCurrency) ? rawCurrency : 'NOK';
    return formatCurrency(amount, currency);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" sx={{ color: theming.colors.primary, display: 'flex', gap: 1, alignItems: 'center' }}>
          <Warning fontSize="small" />
          Price Monitoring Dashboard
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Settings">
            <IconButton onClick={() => setShowSettings(true)}>
              <Settings />
            </IconButton>
          </Tooltip>
          {onClose ? (
            <Tooltip title="Close">
              <IconButton onClick={onClose}>
                <Close />
              </IconButton>
            </Tooltip>
          ) : null}
        </Stack>
      </Box>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Monitoring
              </Typography>
              <Typography variant="h6" color={status.isRunning ? 'success.main' : 'error.main'}>
                {status.isRunning ? 'Running' : 'Stopped'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Total Updates
              </Typography>
              <Typography variant="h6">{status.totalUpdates}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Significant Alerts
              </Typography>
              <Typography variant="h6">{significantAlertCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Last Update
              </Typography>
              <Typography variant="h6">
                {status.lastUpdate ? new Date(status.lastUpdate).toLocaleTimeString() : 'Never'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ ...theming.getThemedCardSx(), mb: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ color: theming.colors.primary, mb: 1 }}>
            Control Panel
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              color={status.isRunning ? 'error' : 'success'}
              onClick={status.isRunning ? handleStopMonitoring : handleStartMonitoring}
              startIcon={status.isRunning ? <Stop /> : <PlayArrow />}
              variant="contained"
              sx={theming.getThemedButtonSx()}
            >
              {status.isRunning ? 'Stop Monitoring' : 'Start Monitoring'}
            </Button>
            <Button
              disabled={!status.isRunning}
              onClick={handleForceUpdate}
              startIcon={<Refresh />}
              variant="outlined"
            >
              Force Update
            </Button>
            <Button onClick={() => setShowSettings(true)} startIcon={<Settings />} variant="outlined">
              Settings
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ ...theming.getThemedCardSx(), mb: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ color: theming.colors.primary, mb: 1 }}>
            Price Alerts ({priceAlerts.length})
          </Typography>
          {priceAlerts.length === 0 ? (
            <Alert severity="info">No significant price alerts yet.</Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Card Type</TableCell>
                    <TableCell>Capacity</TableCell>
                    <TableCell>Change</TableCell>
                    <TableCell>New Price</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Timestamp</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {priceAlerts.slice(0, 15).map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell>{alert.cardType}</TableCell>
                      <TableCell>{alert.capacity}</TableCell>
                      <TableCell>
                        <Chip
                          color={getChangeColor(alert.changePercent)}
                          icon={getChangeIcon(alert.changePercent)}
                          label={formatPercent(alert.changePercent)}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{formatAmount(alert.newPrice, alert.currency)}</TableCell>
                      <TableCell>{alert.source}</TableCell>
                      <TableCell>{new Date(alert.timestamp).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Card sx={theming.getThemedCardSx()}>
        <CardContent>
          <Typography variant="h6" sx={{ color: theming.colors.primary, mb: 1 }}>
            Recent Updates
          </Typography>
          {recentUpdates.length === 0 ? (
            <Alert severity="info">No updates yet. Start monitoring to collect events.</Alert>
          ) : (
            <List>
              {recentUpdates.map((update) => (
                <ListItem
                  key={update.id}
                  secondaryAction={
                    update.isSignificant ? <Chip size="small" color="warning" label="Significant" /> : undefined
                  }
                >
                  <ListItemIcon>{getChangeIcon(update.changePercent)}</ListItemIcon>
                  <ListItemText
                    primary={`${update.cardType} ${update.capacity} (${update.source})`}
                    secondary={
                      update.oldPrice > 0
                        ? `${formatAmount(update.oldPrice, update.currency)} → ${formatAmount(update.newPrice, update.currency)} • ${formatPercent(update.changePercent)}`
                        : `New baseline: ${formatAmount(update.newPrice, update.currency)}`
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Monitoring Settings</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.enableNotifications}
                  onChange={(event) => {
                    const enableNotifications = event.target.checked;
                    setConfig((previous) => ({ ...previous, enableNotifications }));
                  }}
                />
              }
              label="Enable notifications"
            />
            <TextField
              fullWidth
              label="Update interval (minutes)"
              onChange={(event) => {
                const parsed = Number(event.target.value);
                const updateInterval = Number.isFinite(parsed) ? Math.max(5, parsed) : 60;
                setConfig((previous) => ({ ...previous, updateInterval }));
              }}
              type="number"
              value={config.updateInterval}
            />
            <TextField
              fullWidth
              label="Significant change threshold (%)"
              onChange={(event) => {
                const parsed = Number(event.target.value);
                const significantChangeThreshold = Number.isFinite(parsed) ? Math.max(1, parsed) : 10;
                setConfig((previous) => ({ ...previous, significantChangeThreshold }));
              }}
              type="number"
              value={config.significantChangeThreshold}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Cancel</Button>
          <Button onClick={handleConfigUpdate} variant="contained" sx={theming.getThemedButtonSx()}>
            Save Settings
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PriceMonitoringDashboard;
