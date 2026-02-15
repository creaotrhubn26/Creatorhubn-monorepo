// Revenue Optimization Dashboard
import { useTheming } from '../../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  AttachMoney,
  TrendingUp,
  Assessment,
  Lightbulb,
  Calculate
} from '@mui/icons-material';
import { useRevenueOptimizer } from '../../../hooks/useRevenueOptimizer';

interface RevenueOptimizationDashboardProps {
  onSettingsClick: () => void;
  onPricingClick: () => void;
  onUpsellingClick: () => void;
  onForecastingClick: () => void;
  onAnalysisClick: () => void;
  onMarketRatesClick: () => void; 
}

const RevenueOptimizationDashboard: React.FC<RevenueOptimizationDashboardProps> = ({
  onSettingsClick,
  onPricingClick,
  onUpsellingClick,
  onForecastingClick,
  onAnalysisClick,
  onMarketRatesClick
}) => {
  const {
    pricingTiers,
    upsellingSuggestions,
    marketRates,
    loading,
    calculatePricing,
    generateUpsellingSuggestions,
    generateRevenueForecast,
    calculateProfitAnalysis,
    getAnalytics
} = useRevenueOptimizer();

  const [selectedView, setSelectedView] = useState<string>('overview');
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [activeTab, setActiveTab] = useState('overview');
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false);
  const [pricingData, setPricingData] = useState({
    projectType: 'wedding',
    complexity: 'medium',
    duration:  8,
    imageCount: 50,
    location: 'major-city',
    equipment:  [],
    addOns: []
});

  const analytics = getAnalytics();

  const handleCalculatePricing = () => {
    calculatePricing(pricingData);
    setPricingDialogOpen(false);
};

  const renderOverview = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={3}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box display="flex" alignItems="center" mb={2}>
              <AttachMoney color="primary" />
              <Typography variant="h6" ml={1} sx={{ color: theming.colors.primary }}>
                Upselling Revenue
              </Typography>
            </Box>
            <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
              ${analytics.totalUpsellingRevenue.toLocaleString()}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Potential revenue
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box display="flex" alignItems="center" mb={2}>
              <TrendingUp color="success" />
              <Typography variant="h6" ml={1} sx={{ color: theming.colors.primary }}>
                Profit Margin
              </Typography>
            </Box>
            <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
              {analytics.averageProfitMargin.toFixed(1)}%
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Average margin
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box display="flex" alignItems="center" mb={2}>
              <Lightbulb color="warning" />
              <Typography variant="h6" ml={1} sx={{ color: theming.colors.primary }}>
                Suggestions
              </Typography>
            </Box>
            <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
              {analytics.activeSuggestions}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Active upselling
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box display="flex" alignItems="center" mb={2}>
              <Assessment color="info" />
              <Typography variant="h6" ml={1} sx={{ color: theming.colors.primary }}>
                Market Rates
              </Typography>
            </Box>
            <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
              {analytics.marketRates}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Tracked services
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Pricing Calculator</Typography>
              <Button
                startIcon={<Calculate />}
                variant="outlined"
                size="small"
                onClick={() => setPricingDialogOpen(true)}
              >
                Calculate
              </Button>
            </Box>
            <Typography variant="body2" color="textSecondary" mb={2}>
              Get instant pricing recommendations for your projects
            </Typography>
            <Button variant="contained"
              fullWidth
              onClick={() => setPricingDialogOpen(true)}
              sx={theming.getThemedButtonSx()}
            >
              Open Pricing Calculator
            </Button>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Upselling Suggestions</Typography>
              <Button
                startIcon={theming.getThemedIcon('add')}
                variant="outlined"
                size="small"
                onClick={onUpsellingClick}
              >
                Generate
              </Button>
            </Box>
            <List>
              {upsellingSuggestions.slice(0, 3).map((suggestion: Record<string, unknown>) => (
                <ListItem key={suggestion.id}>
                  <ListItemText
                    primary={suggestion.title}
                    secondary={`$${suggestion.potentialRevenue} potential`}
                  />
                  <Chip
                    label={suggestion.priority}
                    color={suggestion.priority === 'high' ? 'error' : 'default'}
                    size="small"
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderPricing = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" sx={{ color: theming.colors.primary }}>Pricing Calculator</Typography>
        <Button
          startIcon={<Calculate />}
          variant="contained"
          onClick={() => setPricingDialogOpen(true)}
        >
          Calculate Pricing
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" mb={2} sx={{ color: theming.colors.primary }}>Pricing Tiers</Typography>
              <List>
                {pricingTiers.map((tier: Record<string, unknown>) => (
                  <ListItem key={tier.d}>
                    <ListItemText
                      primary={tier.name}
                      secondary={`$${tier.basePrice} - $${tier.maximumPrice}`}
                    />
                    <Chip
                      label={tier.targetMarket}
                      color="primary"
                      size="small"
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" mb={2} sx={{ color: theming.colors.primary }}>Market Rates</Typography>
              <List>
                {marketRates.map((rate: Record<string, unknown>) => (
                  <ListItem key={rate.service}>
                    <ListItemText
                      primary={rate.service}
                      secondary={`$${rate.minRate} - $${rate.maxRate}`}
                    />
                    <Typography variant="body2" color="textSecondary">
                      Avg: ${rate.averageRate}
                    </Typography>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  const renderUpselling = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" sx={{ color: theming.colors.primary }}>Upselling Suggestions</Typography>
        <Button
          startIcon={theming.getThemedIcon('add')}
          variant="contained"
          onClick={() => generateUpsellingSuggestions('project-1', 'client-1', {})}
          sx={theming.getThemedButtonSx()}
        >
          Generate Suggestions
        </Button>
      </Box>

      <Grid container spacing={3}>
        {upsellingSuggestions.map((suggestion: Record<string, unknown>) => (
          <Grid item xs={12} md={6} lg={4} key={suggestion.id}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>{suggestion.title}</Typography>
                  <Chip
                    label={suggestion.priority}
                    color={suggestion.priority === 'high' ? 'error' : 'default'}
                    size="small"
                  />
                </Box>
                <Typography variant="body2" color="textSecondary" mb={2}>
                  {suggestion.description}
                </Typography>
                <Typography variant="h6" color="primary" mb={1} sx={{ color: theming.colors.primary }}>
                  ${suggestion.potentialRevenue}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Confidence: {(suggestion.confidence * 100).toFixed()}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  return (
    <Box sx={{ p:  3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ color: theming.colors.primary }}>Revenue Optimization</Typography>
        <Box>
          <Button
            startIcon={<Calculate />}
            onClick={onPricingClick}
            sx={{ mr:  1 }}
          >
            Pricing
          </Button>
          <Button
            startIcon={<Lightbulb />}
            onClick={onUpsellingClick}
            sx={{ mr:  1 }}
          >
            Upselling
          </Button>
          <Button
            startIcon={theming.getThemedIcon('trendingUp')}
            onClick={onForecastingClick}
            sx={{ mr: 1 }}
          >
            Forecasting
          </Button>
          <Button
            startIcon={theming.getThemedIcon('assessment')}
            onClick={onAnalysisClick}
          >
            Analysis
          </Button>
        </Box>
      </Box>

      <Box mb={3}>
        <Button
          variant={selectedView === 'overview' ? 'contained' : 'outlined'}
          onClick={() => setSelectedView('overview')}
          sx={{ mr:  1 }}
        >
          Overview
        </Button>
        <Button
          variant={selectedView === 'pricing' ? 'contained' : 'outlined'}
          onClick={() => setSelectedView('pricing')}
          sx={{ mr:  1 }}
        >
          Pricing
        </Button>
        <Button
          variant={selectedView === 'upselling' ? 'contained' : 'outlined'}
          onClick={() => setSelectedView('upselling')}
        >
          Upselling
        </Button>
      </Box>

      {selectedView === 'overview' && renderOverview()}
      {selectedView === 'pricing' && renderPricing()}
      {selectedView ==='upselling' && renderUpselling()}

      {/* Pricing Calculator Dialog */}
      <Dialog open={pricingDialogOpen} onClose={() => setPricingDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Pricing Calculator</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt:  1 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Project Type</InputLabel>
                <Select
                  value={pricingData.projectType}
                  onChange={(e) => setPricingData(prev => ({ ...prev, projectType: e.target.value }))}
                >
                  <MenuItem value="wedding">Wedding</MenuItem>
                  <MenuItem value="portrait">Portrait</MenuItem>
                  <MenuItem value="event">Event</MenuItem>
                  <MenuItem value="commercial">Commercial</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Complexity</InputLabel>
                <Select
                  value={pricingData.complexity}
                  onChange={(e) => setPricingData(prev => ({ ...prev, complexity: e.target.value }))}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography gutterBottom>Duration (hours)</Typography>
              <Slider
                value={pricingData.duration}
                onChange={(_, value) => setPricingData(prev => ({ ...prev, duration: value as number }))}
                min={1}
                max={24}
                step={1}
                marks
                valueLabelDisplay="auto"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography gutterBottom>Image Count</Typography>
              <Slider
                value={pricingData.imageCount}
                onChange={(_, value) => setPricingData(prev => ({ ...prev, imageCount: value as number }))}
                min={50}
                max={2000}
                step={50}
                marks
                valueLabelDisplay="auto"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Location</InputLabel>
                <Select
                  value={pricingData.location}
                  onChange={(e) => setPricingData(prev => ({ ...prev, location: e.target.value }))}
                >
                  <MenuItem value="major-city">Major City</MenuItem>
                  <MenuItem value="suburban">Suburban</MenuItem>
                  <MenuItem value="rural">Rural</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Equipment</InputLabel>
                <Select
                  multiple
                  value={pricingData.equipment}
                  onChange={(e) => setPricingData(prev => ({ ...prev, equipment: e.target.value as string[] }))}
                >
                  <MenuItem value="professional-camera">Professional Camera</MenuItem>
                  <MenuItem value="lighting-kit">Lighting Kit</MenuItem>
                  <MenuItem value="drone">Drone</MenuItem>
                  <MenuItem value="gimbal">Gimbal</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPricingDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCalculatePricing} variant="contained" sx={theming.getThemedButtonSx()}>
            Calculate Pricing
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RevenueOptimizationDashboard;




