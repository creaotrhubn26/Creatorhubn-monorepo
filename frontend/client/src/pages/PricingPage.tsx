/**
 * CreatorHub Norge - Comprehensive Pricing Page
 * Central pricing management interface
 */

import { useTheming } from '../utils/theming-helper';
import React, { useState, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Breadcrumbs,
  Link,
  Tabs,
  Tab,
  Paper,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Switch,
  FormControlLabel,
  Divider,
  Stack,
  Alert,
  IconButton,
  Tooltip,
  InputAdornment,
  alpha,
} from '@mui/material';
import {
  Home as HomeIcon,
  LocalOffer as PriceIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Calculate as CalculateIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Percent as PercentIcon,
  AttachMoney as MoneyIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import PricingManagement from '@/components/pricing/PricingManagement';
import PricingDashboardWidget from '@/components/pricing/PricingDashboardWidget';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number; 
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

// Price Calculator Component
interface CalculatorItem {
  id: string;
  name: string;
  basePrice: number;
  quantity: number;
  discount: number;
}

function PriceCalculator({ theming }: { theming: any }) {
  const [items, setItems] = useState<CalculatorItem[]>([
    { id: '1', name: 'Fotografering (timer)', basePrice: 2500, quantity: 4, discount: 0 }
  ]);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [includeVAT, setIncludeVAT] = useState(true);
  const [currency] = useState('NOK');
  
  const addItem = () => {
    setItems([...items, {
      id: Date.now().toString(),
      name: '',
      basePrice: 0,
      quantity: 1,
      discount: 0
    }]);
  };
  
  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };
  
  const updateItem = (id: string, field: keyof CalculatorItem, value: string | number) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };
  
  const calculations = useMemo(() => {
    const subtotal = items.reduce((sum, item) => {
      const itemTotal = item.basePrice * item.quantity;
      const itemDiscount = itemTotal * (item.discount / 100);
      return sum + (itemTotal - itemDiscount);
    }, 0);
    
    const globalDiscountAmount = subtotal * (globalDiscount / 100);
    const netTotal = subtotal - globalDiscountAmount;
    const vatAmount = includeVAT ? netTotal * 0.25 : 0;
    const total = netTotal + vatAmount;
    
    return { subtotal, globalDiscountAmount, netTotal, vatAmount, total };
  }, [items, globalDiscount, includeVAT]);
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', { style: 'currency', currency }).format(amount);
  };
  
  const copyToClipboard = () => {
    const text = `Pristilbud:\n${items.map(i => `- ${i.name}: ${formatCurrency(i.basePrice)} x ${i.quantity}`).join('\n')}\n\nSubtotal: ${formatCurrency(calculations.subtotal)}\nRabatt: ${formatCurrency(calculations.globalDiscountAmount)}\nMVA (25%): ${formatCurrency(calculations.vatAmount)}\nTOTALT: ${formatCurrency(calculations.total)}`;
    navigator.clipboard.writeText(text);
  };
  
  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        {/* Calculator Items */}
        <Grid item xs={12} md={8}>
          <Card sx={{ ...theming.getThemedCardSx(), mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Tilbudslinjer
                </Typography>
                <Button 
                  startIcon={<AddIcon />} 
                  onClick={addItem}
                  variant="outlined"
                  size="small"
                  sx={{ borderColor: theming.colors.primary, color: theming.colors.primary }}
                >
                  Legg til linje
                </Button>
              </Box>
              
              <Stack spacing={2}>
                {items.map((item, index) => (
                  <Paper key={item.id} sx={{ p: 2, bgcolor: alpha(theming.colors.primary, 0.02) }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Beskrivelse"
                          value={item.name}
                          onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                          placeholder="F.eks. Fotografering, Redigering..."
                        />
                      </Grid>
                      <Grid item xs={6} sm={2}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Enhetspris"
                          type="number"
                          value={item.basePrice}
                          onChange={(e) => updateItem(item.id, 'basePrice', parseFloat(e.target.value) || 0)}
                          InputProps={{
                            endAdornment: <InputAdornment position="end">kr</InputAdornment>
                          }}
                        />
                      </Grid>
                      <Grid item xs={6} sm={2}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Antall"
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                        />
                      </Grid>
                      <Grid item xs={6} sm={2}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Rabatt"
                          type="number"
                          value={item.discount}
                          onChange={(e) => updateItem(item.id, 'discount', parseFloat(e.target.value) || 0)}
                          InputProps={{
                            endAdornment: <InputAdornment position="end">%</InputAdornment>
                          }}
                        />
                      </Grid>
                      <Grid item xs={6} sm={2}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {formatCurrency(item.basePrice * item.quantity * (1 - item.discount / 100))}
                          </Typography>
                          {items.length > 1 && (
                            <IconButton size="small" onClick={() => removeItem(item.id)} color="error">
                              <RemoveIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      </Grid>
                    </Grid>
                  </Paper>
                ))}
              </Stack>
            </CardContent>
          </Card>
          
          {/* Quick Add Presets */}
          <Card sx={{ ...theming.getThemedCardSx() }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom sx={{ color: theming.colors.primary }}>
                Hurtigvalg
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {[
                  { name: 'Fotografering (time)', price: 2500 },
                  { name: 'Redigering (time)', price: 1500 },
                  { name: 'Reisekostnader', price: 500 },
                  { name: 'Ekstra bilder (10 stk)', price: 1000 },
                  { name: 'Utskrift A4', price: 350 },
                  { name: 'Digital levering', price: 0 },
                ].map((preset) => (
                  <Chip
                    key={preset.name}
                    label={`${preset.name} (${formatCurrency(preset.price)})`}
                    onClick={() => setItems([...items, {
                      id: Date.now().toString(),
                      name: preset.name,
                      basePrice: preset.price,
                      quantity: 1,
                      discount: 0
                    }])}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Summary */}
        <Grid item xs={12} md={4}>
          <Card sx={{ ...theming.getThemedCardSx(), position: 'sticky', top: 20 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Sammendrag
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Global rabatt
                </Typography>
                <Slider
                  value={globalDiscount}
                  onChange={(_, value) => setGlobalDiscount(value as number)}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v}%`}
                  max={50}
                  sx={{ color: theming.colors.primary }}
                />
              </Box>
              
              <FormControlLabel
                control={
                  <Switch 
                    checked={includeVAT} 
                    onChange={(e) => setIncludeVAT(e.target.checked)}
                    sx={{ '& .Mui-checked': { color: theming.colors.primary } }}
                  />
                }
                label="Inkluder MVA (25%)"
              />
              
              <Divider sx={{ my: 2 }} />
              
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Subtotal:</Typography>
                  <Typography variant="body2">{formatCurrency(calculations.subtotal)}</Typography>
                </Box>
                {globalDiscount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'success.main' }}>
                    <Typography variant="body2">Rabatt ({globalDiscount}%):</Typography>
                    <Typography variant="body2">-{formatCurrency(calculations.globalDiscountAmount)}</Typography>
                  </Box>
                )}
                {includeVAT && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">MVA (25%):</Typography>
                    <Typography variant="body2">{formatCurrency(calculations.vatAmount)}</Typography>
                  </Box>
                )}
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>TOTALT:</Typography>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>{formatCurrency(calculations.total)}</Typography>
                </Box>
              </Stack>
              
              <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
                <Tooltip title="Kopier til utklippstavle">
                  <Button 
                    variant="outlined" 
                    startIcon={<CopyIcon />}
                    onClick={copyToClipboard}
                    fullWidth
                    sx={{ borderColor: theming.colors.primary, color: theming.colors.primary }}
                  >
                    Kopier
                  </Button>
                </Tooltip>
                <Button 
                  variant="contained" 
                  startIcon={<DownloadIcon />}
                  fullWidth
                  sx={{ bgcolor: theming.colors.primary }}
                >
                  Eksporter
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

// Price Settings Component
function PriceSettings({ theming }: { theming: any }) {
  const [settings, setSettings] = useState({
    defaultVAT: 25,
    defaultCurrency: 'NOK',
    roundPrices: true,
    roundTo: 50,
    autoDiscountThreshold: 10000,
    autoDiscountPercent: 5,
    enableSeasonalPricing: false,
    highSeasonMultiplier: 1.2,
    lowSeasonMultiplier: 0.9,
    defaultPaymentTerms: 14,
    latePaymentFee: 50,
    enableQuoteExpiry: true,
    quoteExpiryDays: 30,
  });
  
  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };
  
  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        {/* General Settings */}
        <Grid item xs={12} md={6}>
          <Card sx={{ ...theming.getThemedCardSx(), height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <MoneyIcon sx={{ color: theming.colors.primary }} />
                <Typography variant="h6">Generelle innstillinger</Typography>
              </Box>
              
              <Stack spacing={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Standard valuta</InputLabel>
                  <Select
                    value={settings.defaultCurrency}
                    label="Standard valuta"
                    onChange={(e) => updateSetting('defaultCurrency', e.target.value)}
                  >
                    <MenuItem value="NOK">NOK - Norske kroner</MenuItem>
                    <MenuItem value="SEK">SEK - Svenske kroner</MenuItem>
                    <MenuItem value="DKK">DKK - Danske kroner</MenuItem>
                    <MenuItem value="EUR">EUR - Euro</MenuItem>
                    <MenuItem value="USD">USD - US Dollar</MenuItem>
                  </Select>
                </FormControl>
                
                <TextField
                  fullWidth
                  size="small"
                  label="Standard MVA-sats (%)"
                  type="number"
                  value={settings.defaultVAT}
                  onChange={(e) => updateSetting('defaultVAT', parseFloat(e.target.value))}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>
                  }}
                />
                
                <Box>
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={settings.roundPrices} 
                        onChange={(e) => updateSetting('roundPrices', e.target.checked)}
                      />
                    }
                    label="Avrund priser automatisk"
                  />
                  {settings.roundPrices && (
                    <TextField
                      fullWidth
                      size="small"
                      label="Avrund til nærmeste"
                      type="number"
                      value={settings.roundTo}
                      onChange={(e) => updateSetting('roundTo', parseInt(e.target.value))}
                      sx={{ mt: 1 }}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">kr</InputAdornment>
                      }}
                    />
                  )}
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Auto Discount Settings */}
        <Grid item xs={12} md={6}>
          <Card sx={{ ...theming.getThemedCardSx(), height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <PercentIcon sx={{ color: theming.colors.primary }} />
                <Typography variant="h6">Automatiske rabatter</Typography>
              </Box>
              
              <Stack spacing={3}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Rabatter gis automatisk når ordreverdien overstiger terskelen
                </Alert>
                
                <TextField
                  fullWidth
                  size="small"
                  label="Rabatterskel (ordresum)"
                  type="number"
                  value={settings.autoDiscountThreshold}
                  onChange={(e) => updateSetting('autoDiscountThreshold', parseFloat(e.target.value))}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">kr</InputAdornment>
                  }}
                />
                
                <TextField
                  fullWidth
                  size="small"
                  label="Automatisk rabatt"
                  type="number"
                  value={settings.autoDiscountPercent}
                  onChange={(e) => updateSetting('autoDiscountPercent', parseFloat(e.target.value))}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>
                  }}
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Seasonal Pricing */}
        <Grid item xs={12} md={6}>
          <Card sx={{ ...theming.getThemedCardSx(), height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <ScheduleIcon sx={{ color: theming.colors.primary }} />
                <Typography variant="h6">Sesongpriser</Typography>
              </Box>
              
              <Stack spacing={3}>
                <FormControlLabel
                  control={
                    <Switch 
                      checked={settings.enableSeasonalPricing} 
                      onChange={(e) => updateSetting('enableSeasonalPricing', e.target.checked)}
                    />
                  }
                  label="Aktiver sesongpriser"
                />
                
                {settings.enableSeasonalPricing && (
                  <>
                    <Box>
                      <Typography variant="body2" gutterBottom>
                        Høysesong multiplikator: {settings.highSeasonMultiplier}x
                      </Typography>
                      <Slider
                        value={settings.highSeasonMultiplier}
                        onChange={(_, value) => updateSetting('highSeasonMultiplier', value)}
                        min={1}
                        max={2}
                        step={0.1}
                        valueLabelDisplay="auto"
                        sx={{ color: theming.colors.primary }}
                      />
                    </Box>
                    
                    <Box>
                      <Typography variant="body2" gutterBottom>
                        Lavsesong multiplikator: {settings.lowSeasonMultiplier}x
                      </Typography>
                      <Slider
                        value={settings.lowSeasonMultiplier}
                        onChange={(_, value) => updateSetting('lowSeasonMultiplier', value)}
                        min={0.5}
                        max={1}
                        step={0.1}
                        valueLabelDisplay="auto"
                        sx={{ color: theming.colors.primary }}
                      />
                    </Box>
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Payment Terms */}
        <Grid item xs={12} md={6}>
          <Card sx={{ ...theming.getThemedCardSx(), height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <PersonIcon sx={{ color: theming.colors.primary }} />
                <Typography variant="h6">Betalingsbetingelser</Typography>
              </Box>
              
              <Stack spacing={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Standard betalingsfrist"
                  type="number"
                  value={settings.defaultPaymentTerms}
                  onChange={(e) => updateSetting('defaultPaymentTerms', parseInt(e.target.value))}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">dager</InputAdornment>
                  }}
                />
                
                <TextField
                  fullWidth
                  size="small"
                  label="Purregebyr"
                  type="number"
                  value={settings.latePaymentFee}
                  onChange={(e) => updateSetting('latePaymentFee', parseFloat(e.target.value))}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">kr</InputAdornment>
                  }}
                />
                
                <Box>
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={settings.enableQuoteExpiry} 
                        onChange={(e) => updateSetting('enableQuoteExpiry', e.target.checked)}
                      />
                    }
                    label="Tilbud utløper automatisk"
                  />
                  {settings.enableQuoteExpiry && (
                    <TextField
                      fullWidth
                      size="small"
                      label="Tilbud gyldig i"
                      type="number"
                      value={settings.quoteExpiryDays}
                      onChange={(e) => updateSetting('quoteExpiryDays', parseInt(e.target.value))}
                      sx={{ mt: 1 }}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">dager</InputAdornment>
                      }}
                    />
                  )}
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button 
          variant="contained" 
          sx={{ bgcolor: theming.colors.primary }}
        >
          Lagre innstillinger
        </Button>
      </Box>
    </Box>
  );
}

export default function PricingPage() {
  const [, setLocation] = useLocation();
  
  // Theming system
  const theming = useTheming('photographer');
  const [tabValue, setTabValue] = useState(0);

  // Mock user data - in real app this would come from auth context
  const userId = 'demo-user';
  const profession = 'photographer';

  const handlePricingUpdate = () => {
    // Refresh pricing data or show success message
    console.log('Pricing updated');
};

  return (
    <Container maxWidth="xl" sx={{ py:  3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb:  3 }}>
        <Link
          color="inherit"
          onClick={() => setLocation('/')}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer',}}
        >
          <HomeIcon sx={{ mr: 0.5,}} fontSize="inherit" />
          Dashbord
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center',}}>
          <PriceIcon sx={{ mr: 0.5,}} fontSize="inherit" />
          Prissystem
        </Typography>
      </Breadcrumbs>

      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" sx={{ mb: 2, color: theming.colors.primary }}>
          Prissystem
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
          Administrer tjenester, pakkepriser og kunderabatter
        </Typography>
      </Box>

      {/* Tabs Navigation */}
      <Paper
        sx={{
          ...theming.getThemedCardSx(),
          background: 'rgba(25, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(25, 107, 53, 0.2)',
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            sx={{
                '& .MuiTab-root': {
                  color: '#666', '&.Mui-selected': {
                    color: '#ff6b30'
                  }
              }, '& .MuiTabs-indicator': {
                backgroundColor: '#ff6b30'
              }
            }}
          >
            <Tab icon={<AnalyticsIcon />} label="Oversikt" iconPosition="start" />
            <Tab icon={<PriceIcon />} label="Administrer priser" iconPosition="start" />
            <Tab icon={<CalculateIcon />} label="Priskalulator" iconPosition="start" />
            <Tab icon={<SettingsIcon />} label="Innstillinger" iconPosition="start" />
          </Tabs>
        </Box>

        {/* Overview Tab */}
        <TabPanel value={tabValue} index={0}>
          <PricingDashboardWidget
            userId={userId}
            profession={profession}
            variant="detailed"
            onManagePricing={() => setTabValue(1)}
          />
        </TabPanel>

        {/* Management Tab */}
        <TabPanel value={tabValue} index={1}>
          <PricingManagement
            userId={userId}
            profession={profession}
            onPricingUpdate={handlePricingUpdate}
          />
        </TabPanel>

        {/* Calculator Tab */}
        <TabPanel value={tabValue} index={2}>
          <PriceCalculator theming={theming} />
        </TabPanel>

        {/* Settings Tab */}
        <TabPanel value={tabValue} index={3}>
          <PriceSettings theming={theming} />
        </TabPanel>
      </Paper>
    </Container>
  );
}
