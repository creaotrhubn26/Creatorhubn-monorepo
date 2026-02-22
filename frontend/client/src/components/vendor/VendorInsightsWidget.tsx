import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Chip,
  Alert,
  LinearProgress,
  Divider,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Lightbulb,
  TrendingUp,
  Warning,
  Visibility,
  Edit,
  Inventory,
  LocalShipping,
  AttachMoney,
  Star,
  ArrowForward,
  CheckCircle,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { apiRequest } from '@/lib/queryClient';
import { getVendorTypeConfig } from '@shared/vendor-type-registry';

interface VendorInsightsWidgetProps {
  vendorType: string;
  vendorName: string;
  userId: string;
  onInsightAction?: (action: string, data: any) => void;
}

interface Insight {
  id: string;
  type: 'warning' | 'opportunity' | 'action' | 'success';
  priority: 'high' | 'medium' | 'low';
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    handler: string;
    data?: any;
  };
  metrics?: {
    label: string;
    value: string | number;
  }[];
}

export default function VendorInsightsWidget({
  vendorType,
  vendorName,
  userId,
  onInsightAction
}: VendorInsightsWidgetProps) {
  const theme = useTheme();
  const vendorConfig = getVendorTypeConfig(vendorType);

  // Fetch insights
  const { data: insightsData, isLoading } = useQuery({
    queryKey: ['/api/vendor-insights', vendorType, vendorName, userId],
    queryFn: () => apiRequest(`/api/vendor-insights/${vendorType}/${vendorName}/${userId}`),
    refetchInterval: 60000 // Refresh every minute
  });

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'warning':
        return '#ff9800';
      case 'opportunity':
        return '#4caf50';
      case 'action':
        return '#2196f3';
      case 'success':
        return '#9c27b0';
      default:
        return '#9e9e9e';
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <Warning />;
      case 'opportunity':
        return <TrendingUp />;
      case 'action':
        return <Edit />;
      case 'success':
        return <CheckCircle />;
      default:
        return <Lightbulb />;
    }
  };

  // Generate insights based on vendor data
  const insights: Insight[] = insightsData?.insights || [];

  // Add default insights for demo/fallback
  const defaultInsights: Insight[] = [
    {
      id: 'bestseller_low_stock',
      type: 'warning',
      priority: 'high',
      icon: <Inventory />,
      title: 'Din bestselger er lav på lager',
      description: `"${insightsData?.bestsellerName || 'Premium Package'}" har bare ${insightsData?.bestsellerStock || 5} enheter igjen og selger i gjennomsnitt ${insightsData?.bestsellerAvgSales || 12}/uke.`,
      action: {
        label: 'Bestill mer',
        handler: 'reorder_bestseller',
        data: { productId: insightsData?.bestsellerId }
      },
      metrics: [
        { label: 'Nåværende lager', value: insightsData?.bestsellerStock || 5 },
        { label: 'Avg. salg/uke', value: insightsData?.bestsellerAvgSales || 12 },
        { label: 'Dager igjen', value: Math.floor((insightsData?.bestsellerStock || 5) / ((insightsData?.bestsellerAvgSales || 12) / 7)) }
      ]
    },
    {
      id: 'high_views_low_sales',
      type: 'opportunity',
      priority: 'high',
      icon: <Visibility />,
      title: 'Produkter med høye visninger men lave salg',
      description: `${insightsData?.highViewsLowSalesCount || 3} produkter får mye oppmerksomhet men konverterer dårlig. Dette kan indikere pris- eller beskrivelsesproblemer.`,
      action: {
        label: 'Se produkter',
        handler: 'view_high_views_low_sales',
        data: { productIds: insightsData?.highViewsLowSalesProducts }
      },
      metrics: [
        { label: 'Produkter', value: insightsData?.highViewsLowSalesCount || 3 },
        { label: 'Avg. visninger', value: insightsData?.avgViews || 245 },
        { label: 'Avg. konvertering', value: `${insightsData?.avgConversion || 1.2}%` }
      ]
    },
    {
      id: 'improve_descriptions',
      type: 'action',
      priority: 'medium',
      icon: <Edit />,
      title: 'Forbedre produktbeskrivelser for 2 produkter',
      description: `${insightsData?.poorDescriptionCount || 2} produkter har beskrivelser under 50 ord. Detaljerte beskrivelser øker salg med opptil 30%.`,
      action: {
        label: 'Rediger beskrivelser',
        handler: 'edit_descriptions',
        data: { productIds: insightsData?.poorDescriptionProducts }
      },
      metrics: [
        { label: 'Produkter', value: insightsData?.poorDescriptionCount || 2 },
        { label: 'Avg. ord', value: insightsData?.avgWords || 32 },
        { label: 'Anbefalt', value: '150+' }
      ]
    },
    {
      id: 'shipping_costs',
      type: 'opportunity',
      priority: 'medium',
      icon: <LocalShipping />,
      title: 'Optimaliser fraktkostnader',
      description: 'Bring-integrasjonen kan spare deg opptil 15% på frakt ved å automatisk velge beste løsning for hver ordre.',
      action: {
        label: 'Aktiver Bring',
        handler: 'setup_bring_shipping',
        data: {}
      },
      metrics: [
        { label: 'Potensiell besparelse', value: `${insightsData?.shippingSavings || 1250} kr/mnd` },
        { label: 'Ordre siste mnd', value: insightsData?.monthlyOrders || 34 }
      ]
    },
    {
      id: 'pricing_optimization',
      type: 'opportunity',
      priority: 'low',
      icon: <AttachMoney />,
      title: 'Pris-optimeringsmuligheter',
      description: `${insightsData?.pricingOpportunitiesCount || 4} produkter kan potensielt prises høyere basert på etterspørsel og konkurranse.`,
      action: {
        label: 'Se anbefalinger',
        handler: 'view_pricing_recommendations',
        data: { productIds: insightsData?.pricingOpportunityProducts }
      },
      metrics: [
        { label: 'Produkter', value: insightsData?.pricingOpportunitiesCount || 4 },
        { label: 'Potensiell økning', value: `${insightsData?.potentialRevenue || 8500} kr/mnd` }
      ]
    },
    {
      id: 'top_performer',
      type: 'success',
      priority: 'low',
      icon: <Star />,
      title: 'Toppytelse denne uken',
      description: `Gratulerer! Du har økt salget med ${insightsData?.salesIncrease || 23}% sammenlignet med forrige uke. Fortsett det gode arbeidet!`,
      metrics: [
        { label: 'Salg denne uke', value: insightsData?.weekSales || 18 },
        { label: 'Vs. forrige uke', value: `+${insightsData?.salesIncrease || 23}%` }
      ]
    }
  ];

  const allInsights = [...insights, ...defaultInsights];

  // Sort by priority
  const sortedInsights = allInsights.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const handleInsightAction = (insight: Insight) => {
    if (insight.action && onInsightAction) {
      onInsightAction(insight.action.handler, insight.action.data);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <LinearProgress />
          <Typography sx={{ mt: 2, textAlign: 'center' }}>Analyserer data...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card component="section" aria-labelledby="insights-heading">
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Lightbulb sx={{ color: '#ffc107', fontSize: 28 }} aria-hidden="true" />
          <Typography variant="h6" component="h2" id="insights-heading" sx={{ fontWeight: 600 }}>
            Smart Innsikt & Anbefalinger
          </Typography>
          <Chip
            label={`${sortedInsights.filter(i => i.priority === 'high').length} høy prioritet`}
            size="small"
            aria-label={`${sortedInsights.filter(i => i.priority === 'high').length} innsikter med høy prioritet`}
            sx={{
              ml: 'auto',
              bgcolor: alpha('#ff9800', 0.2),
              color: '#ff9800',
              fontWeight: 600
            }}
          />
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          AI-drevne anbefalinger for å øke salg og effektivitet
        </Typography>

        {/* Insights list */}
        <List sx={{ p: 0 }}>
          <AnimatePresence>
            {sortedInsights.map((insight, index) => (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.1 }}
              >
                <ListItem
                  sx={{
                    mb: 2,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 2,
                    borderLeft: `4px solid ${getInsightColor(insight.type)}`,
                    bgcolor: alpha(getInsightColor(insight.type), 0.05),
                    '&:hover': {
                      bgcolor: alpha(getInsightColor(insight.type), 0.1)
                    },
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    p: 2
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', width: '100%', mb: 1 }}>
                    <ListItemIcon sx={{ minWidth: 40, mt: 0.5 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          bgcolor: alpha(getInsightColor(insight.type), 0.2),
                          color: getInsightColor(insight.type)
                        }}
                      >
                        {insight.icon}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {insight.title}
                          </Typography>
                          <Chip
                            label={insight.priority === 'high' ? 'Høy' : insight.priority === 'medium' ? 'Medium' : 'Lav'}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              bgcolor: alpha(
                                insight.priority === 'high' ? '#f44336' : insight.priority === 'medium' ? '#ff9800' : '#4caf50',
                                0.2
                              ),
                              color: insight.priority === 'high' ? '#f44336' : insight.priority === 'medium' ? '#ff9800' : '#4caf50',
                              fontWeight: 600
                            }}
                          />
                        </Box>
                      }
                      secondary={
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {insight.description}
                        </Typography>
                      }
                    />
                  </Box>

                  {/* Metrics */}
                  {insight.metrics && insight.metrics.length > 0 && (
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 2,
                        flexWrap: 'wrap',
                        ml: 5,
                        mb: 1.5,
                        p: 1.5,
                        bgcolor: 'background.paper',
                        borderRadius: 1,
                        width: 'calc(100% - 40px)'
                      }}
                    >
                      {insight.metrics.map((metric, idx) => (
                        <Box key={idx} sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Typography variant="caption" color="text.secondary">
                            {metric.label}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: getInsightColor(insight.type) }}>
                            {metric.value}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* Action button */}
                  {insight.action && (
                    <Box sx={{ ml: 5, mt: 1 }}>
                      <Button
                        size="small"
                        variant="contained"
                        endIcon={<ArrowForward />}
                        onClick={() => handleInsightAction(insight)}
                        sx={{
                          bgcolor: getInsightColor(insight.type),
                          '&:hover': {
                            bgcolor: alpha(getInsightColor(insight.type), 0.8)
                          }
                        }}
                      >
                        {insight.action.label}
                      </Button>
                    </Box>
                  )}
                </ListItem>
              </motion.div>
            ))}
          </AnimatePresence>
        </List>

        {/* Summary */}
        <Divider sx={{ my: 2 }} />
        <Alert severity="info" icon={<Lightbulb />}>
          <Typography variant="caption">
            <strong>Tips:</strong> Følg høy-prioritets anbefalinger først for raskest effekt på salget.
          </Typography>
        </Alert>
      </CardContent>
    </Card>
  );
}


