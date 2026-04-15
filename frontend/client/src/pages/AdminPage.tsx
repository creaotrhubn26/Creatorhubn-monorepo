// @ts-nocheck
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Breadcrumbs,
  Card,
  CardContent,
  Container,
  FormControlLabel,
  Grid,
  Link,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  Dashboard as DashboardIcon,
  Inventory as InventoryIcon,
  Memory as MemoryIcon,
  PhotoLibrary as PhotoLibraryIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import ProductManager from '../components/admin/ProductManager';
import PricingManagement from '../components/pricing/PricingManagement';
import { useTheming } from '../utils/theming-helper';

interface TabPanelProps {
  value: number;
  index: number;
  children: React.ReactNode;
}

function TabPanel({ value, index, children }: TabPanelProps) {
  if (value !== index) {
    return null;
  }
  return <Box sx={{ py: 3 }}>{children}</Box>;
}

function tabA11yProps(index: number) {
  return {
    id: `admin-tab-${index}`,
    'aria-controls': `admin-tabpanel-${index}`,
  };
}

export default function AdminPage() {
  const [tabValue, setTabValue] = useState(0);
  const [importSource, setImportSource] = useState('');
  const [imports, setImports] = useState<string[]>([]);
  const [settings, setSettings] = useState({
    autoSync: true,
    strictValidation: true,
    analyticsEnabled: true,
  });

  const theming = useTheming('photographer');

  const dashboardStats = useMemo(() => {
    return [
      { label: 'Totale produkter', value: '120+', icon: <DashboardIcon color="primary" /> },
      { label: 'Autentiske bilder', value: '95%', icon: <PhotoLibraryIcon color="success" /> },
      { label: 'Firmware status', value: 'Aktiv', icon: <MemoryIcon color="warning" /> },
      { label: 'System status', value: 'Operativ', icon: <AnalyticsIcon color="info" /> },
    ];
  }, []);

  const analyticsSummary = useMemo(() => {
    const totalImports = imports.length;
    const syncState = settings.autoSync ? 'Aktiv' : 'Av';
    return [
      `Importer registrert: ${totalImports}`,
      `Auto-sync: ${syncState}`,
      `Validering: ${settings.strictValidation ? 'Streng' : 'Normal'}`,
      `Analytics: ${settings.analyticsEnabled ? 'Aktiv' : 'Av'}`,
    ];
  }, [imports.length, settings.analyticsEnabled, settings.autoSync, settings.strictValidation]);

  const addImportSource = () => {
    const trimmed = importSource.trim();
    if (!trimmed) {
      return;
    }
    setImports((prev) => [trimmed, ...prev]);
    setImportSource('');
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link color="inherit" href="/">
            CreatorHub Norge
          </Link>
          <Link color="inherit" href="/admin">
            Admin Dashboard
          </Link>
          <Typography color="text.primary">Utstyrsdatabase</Typography>
        </Breadcrumbs>

        <Typography variant="h3" component="h1" gutterBottom sx={{ color: theming.colors.primary }}>
          Utstyrsdatabase Administrasjon
        </Typography>

        <Typography variant="subtitle1" color="text.secondary">
          Administrer produkter, priser, importflyt og plattforminnstillinger.
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Systemet er konfigurert for aktiv drift med produkt- og prisforvaltning i sanntid.
      </Alert>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {dashboardStats.map((stat) => (
          <Grid item xs={12} md={3} key={stat.label}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  {stat.icon}
                  <Box>
                    <Typography color="text.secondary">{stat.label}</Typography>
                    <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                      {stat.value}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ width: '100%', ...theming.getThemedCardSx() }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={(_, newValue: number) => setTabValue(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab icon={<InventoryIcon />} label="Produkter" {...tabA11yProps(0)} />
            <Tab icon={<PhotoLibraryIcon />} label="Priser" {...tabA11yProps(1)} />
            <Tab icon={<MemoryIcon />} label="Import" {...tabA11yProps(2)} />
            <Tab icon={<AnalyticsIcon />} label="Analyser" {...tabA11yProps(3)} />
            <Tab icon={<SettingsIcon />} label="Innstillinger" {...tabA11yProps(4)} />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <ProductManager />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <PricingManagement />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ mb: 2, color: theming.colors.primary }}>
              Masseimport av data
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
              <TextField
                label="Importkilde (URL eller filreferanse)"
                fullWidth
                value={importSource}
                onChange={(event) => setImportSource(event.target.value)}
              />
              <Button variant="contained" onClick={addImportSource}>
                Legg til import
              </Button>
            </Stack>
            <List dense>
              {imports.map((entry, index) => (
                <ListItem key={`${entry}-${index}`} divider>
                  <ListItemText
                    primary={entry}
                    secondary={`Registrert ${new Date().toLocaleString('nb-NO')}`}
                  />
                </ListItem>
              ))}
            </List>
            {imports.length === 0 ? (
              <Alert severity="info">Ingen importkilder registrert enda.</Alert>
            ) : null}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ mb: 2, color: theming.colors.primary }}>
              System-analyser
            </Typography>
            <List>
              {analyticsSummary.map((line) => (
                <ListItem key={line} disableGutters>
                  <ListItemText primary={line} />
                </ListItem>
              ))}
            </List>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ mb: 2, color: theming.colors.primary }}>
              Systeminnstillinger
            </Typography>
            <Stack spacing={1.5}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.autoSync}
                    onChange={(event) =>
                      setSettings((prev) => ({ ...prev, autoSync: event.target.checked }))
                    }
                  />
                }
                label="Auto-sync mot eksterne kilder"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.strictValidation}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        strictValidation: event.target.checked,
                      }))
                    }
                  />
                }
                label="Streng validering ved import"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.analyticsEnabled}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        analyticsEnabled: event.target.checked,
                      }))
                    }
                  />
                }
                label="Aktiver analytics-logging"
              />
            </Stack>
          </Box>
        </TabPanel>
      </Paper>
    </Container>
  );
}

