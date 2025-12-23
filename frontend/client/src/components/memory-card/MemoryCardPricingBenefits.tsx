/**
 * CreatorHub Norge - Memory Card Pricing Benefits
 * Contextual information explaining why memory card pricing is beneficial
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Paper,
  Stack,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Memory,
  ExpandMore,
  CheckCircle,
  Warning,
  Info,
  Speed,
  Storage,
  Security,
  PriceCheck,
  TrendingUp,
  TrendingDown,
  Business,
  People,
  Assessment,
  Lightbulb,
  Close,
  Star,
  StarBorder,
} from '@mui/icons-material';
import {
  CONTEXTUAL_BENEFITS,
  getContextualBenefitById,
} from '../../data/memory-card-templates';
import { formatCurrency, convertCurrency } from '../../data/memory-card-database';

interface MemoryCardPricingBenefitsProps {
  showAsDialog?: boolean;
  onClose?: () => void;
}

const MemoryCardPricingBenefits: React.FC<MemoryCardPricingBenefitsProps> = (
  // Theming system
  const theming = useTheming('photographer');{
  showAsDialog = false,
  onClose
}) => {
  const [expandedBenefit, setExpandedBenefit] = useState<string | null>(null);

  const pricingBenefits = [
    'pricing_optimization','project_planning','client_transparency','equipment_justification','budget_scaling','market_competitiveness','risk_mitigation'
  ];

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
  }
};

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'critical': return theming.getThemedIcon(',');
      case 'high': return theming.getThemedIcon('trendingUp');
      case 'medium': return theming.getThemedIcon('info');
      case 'low': return theming.getThemedIcon('checkCircle');
      default: return theming.getThemedIcon(', ');
  }
};

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'performance': return theming.getThemedIcon(', ');
      case 'reliability': return theming.getThemedIcon('security');
      case 'workflow': return <Lightbulb />;
      case 'cost': return <PriceCheck />;
      case 'safety': return theming.getThemedIcon('storage');
      case 'professional': return theming.getThemedIcon('star');
      default: return theming.getThemedIcon(', ');
  }
};

  const content = (
    <Box sx={{ p: showAsDialog ? 0 : 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
        <Typography variant="h5" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
          <Memory />
          Why Memory Card Pricing is Beneficial
        </Typography>
        {showAsDialog && (
          <IconButton onClick={onClose}>
            {theming.getThemedIcon('close')}
          </IconButton>
        )}
      </Box>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Understanding memory card pricing isn't just about costs—it's about making informed decisions 
        that impact your business success, client relationships, and professional reputation.
      </Typography>

      {/* Key Benefits Overview */}
      <Grid container spacing={2} sx={{ mb:  3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ textAlign: 'center', p:  2 ,  ...theming.getThemedCardSx() }}>
            <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>20-40%</Typography>
            <Typography variant="body2" color="text.secondary">
              Cost Reduction with proper planning
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ textAlign: 'center', p:  2 ,  ...theming.getThemedCardSx() }}>
            <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>78%</Typography>
            <Typography variant="body2" color="text.secondary">
              Clients prefer detailed cost breakdowns
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ textAlign: 'center', p:  2 ,  ...theming.getThemedCardSx() }}>
            <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>$2,500</Typography>
            <Typography variant="body2" color="text.secondary">
              Average cost of data loss incidents
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ textAlign: 'center', p:  2 ,  ...theming.getThemedCardSx() }}>
            <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>15-25%</Typography>
            <Typography variant="body2" color="text.secondary">
              Equipment budget for memory cards
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Detailed Benefits */}
      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Key Benefits of Memory Card Pricing Knowledge
      </Typography>

      <Stack spacing={2}>
        {pricingBenefits.map((benefitId) => {
          const benefit = getContextualBenefitById(benefitId);
          if (!benefit) return null;

          return (
            <Accordion
              key={benefitId}
              expanded={expandedBenefit === benefitId}
              onChange={() => setExpandedBenefit(expandedBenefit === benefitId ? null : benefitId)}
            >
              <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%'}}>
                  <Box sx={{ fontSize: '1.5rem'}}>{benefit.icon}</Box>
                  <Box sx={{ flex:  1 }}>
                    <Typography variant="h6" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                      {benefit.title}
                      <Chip
                        icon={getImpactIcon(benefit.impact)}
                        label={benefit.impact}
                        size="small"
                        color={getImpactColor(benefit.impact)}
                      />
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {benefit.description}
                    </Typography>
                  </Box>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ pl:  4 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Real-world Examples: </Typography>
                  <List dense>
                    {benefit.examples.map((example, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <CheckCircle color="success" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={example} />
                      </ListItem>
                    ))}
                  </List>

                  {benefit.technicalDetails && (
                    <Alert severity="info" sx={{ mt:  2 }}>
                      <Typography variant="body2">
                        <strong>Technical Insight: </strong> {benefit.technicalDetails}
                      </Typography>
                    </Alert>
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>
          );
      })}
      </Stack>

      {/* Business Impact Section */}
      <Card sx={{ mt:  3, bgcolor: 'primary.light', color: 'primary.contrastText',  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
            {theming.getThemedIcon('business')}
            Business Impact
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Immediate Benefits: </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon><CheckCircle sx={{ color: 'white'}} /></ListItemIcon>
                  <ListItemText primary="Accurate project cost estimation" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircle sx={{ color: 'white'}} /></ListItemIcon>
                  <ListItemText primary="Professional client proposals" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircle sx={{ color: 'white'}} /></ListItemIcon>
                  <ListItemText primary="Reduced equipment waste" />
                </ListItem>
              </List>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Long-term Benefits: </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon><CheckCircle sx={{ color: 'white'}} /></ListItemIcon>
                  <ListItemText primary="Improved profit margins" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircle sx={{ color: 'white'}} /></ListItemIcon>
                  <ListItemText primary="Better client relationships" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircle sx={{ color: 'white'}} /></ListItemIcon>
                  <ListItemText primary="Competitive market positioning" />
                </ListItem>
              </List>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Cost Comparison Example */}
      <Card sx={{ mt:  3 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
            {theming.getThemedIcon('assessment')}
            Real Cost Comparison Example
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Wedding Photography Project - 1 Day, 2 Cameras
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: 'error.light', color: 'error.contrastText',  ...theming.getThemedCardSx() }}>
                <Typography variant="subtitle1" gutterBottom>
                  ❌ Without Proper Planning
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Oversized cards (1TB each)" 
                      secondary="Unnecessary cost:  2,100 NOK"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="No backup strategy" 
                      secondary="Risk of data loss"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Incompatible cards" 
                      secondary="Equipment issues during shoot"
                    />
                  </ListItem>
                </List>
                <Typography variant="h6" sx={{  mt:  2  }}>
                  Total:  8,400 NOK
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'success.contrastText',  ...theming.getThemedCardSx() }}>
                <Typography variant="subtitle1" gutterBottom>
                  ✅ With Intelligent Planning
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Right-sized cards (256GB each)" 
                      secondary="Optimal capacity:  1,680 NOK"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Backup strategy included" 
                      secondary="Data safety guaranteed"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Camera-compatible cards" 
                      secondary="Smooth operation"
                    />
                  </ListItem>
                </List>
                <Typography variant="h6" sx={{  mt:  2  }}>
                  Total:  5,040 NOK
                </Typography>
              </Paper>
            </Grid>
          </Grid>
          
          <Alert severity="success" sx={{ mt:  2 }}>
            <Typography variant="body2">
              <strong>Savings: </strong>, 3,360 NOK (40% reduction) + Peace of mind + Professional reliability
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    </Box>
  );

  if (showAsDialog) {
    return (
      <Dialog open={true} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>
          Why Memory Card Pricing is Beneficial
        </DialogTitle>
        <DialogContent>
          {content}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
}

  return content;
};

export default MemoryCardPricingBenefits;














