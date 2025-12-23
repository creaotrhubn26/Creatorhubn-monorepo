/**
 * Receipt Template Manager
 * Manages email receipt templates with EmailDesigner integration
 * Syncs pricing from profession-feature-matrix for marketplace features
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Alert,
  Tabs,
  Tab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  FormControlLabel,
  Divider,
  Stack,
} from '@mui/material';
import {
  Email as EmailIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Preview as PreviewIcon,
  Send as SendIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  Settings as SettingsIcon,
  Business as BusinessIcon,
  AttachMoney as MoneyIcon,
  Gavel,
  Policy,
  Info,
  Image as ImageIcon,
  Save as SaveIcon,
  CardMembership,
  ShoppingCart,
} from '@mui/icons-material';
import { EmailDesigner } from '../EmailDesigner/EmailDesigner';
import { PROFESSION_FEATURE_MATRIX } from '@/../../shared/profession-feature-matrix';

interface ReceiptTemplate {
  id: string;
  name: string;
  type: 'subscription' | 'marketplace-addon' | 'invoice' | 'refund';
  category: string;
  subject: string;
  htmlTemplate: string;
  variables: string[];
  isActive: boolean;
  autoSend: boolean; // Auto-send on payment completion
  sendTrigger?: 'payment-success' | 'subscription-created' | 'addon-purchased' | 'manual';
  profession?: string;
  createdAt: string;
  updatedAt: string;
}

interface BusinessSettings {
  companyName: string;
  orgNumber: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
  primaryColor: string;
  termsUrl: string;
  privacyUrl: string;
}

interface MarketplaceFeature {
  featureId: string;
  name: string;
  price: number;
  category: string;
  description: string;
  profession: string;
}

export default function ReceiptTemplateManager() {
  const queryClient = useQueryClient();
  const { auth } = useEnhancedMasterIntegration();
  const [tabValue, setTabValue] = useState(0);
  const [showDesigner, setShowDesigner] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReceiptTemplate | null>(null);
  const [showBusinessSettings, setShowBusinessSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<unknown>(null);

  // Fetch receipt templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/admin/receipt-templates,'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/receipt-templates,', { headers });
    },
  });

  // Fetch business settings
  const { data: businessSettings, isLoading: settingsLoading } = useQuery<BusinessSettings>({
    queryKey: ['/api/admin/business-settings'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/business-settings, ', { headers });
    },
  });

  // Extract marketplace features from profession-feature-matrix
  const marketplaceFeatures: MarketplaceFeature[] = React.useMemo(() => {
    const features: MarketplaceFeature[] = [];

    Object.entries(PROFESSION_FEATURE_MATRIX).forEach(([profession, config]) => {
      Object.entries(config.availableFeatures).forEach(([featureId, feature]) => {
        if (feature.plan === 'marketplace' && feature.marketplacePrice) {
          features.push({
            featureId,
            name: featureId
              .split('-')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1)
              .join(''),
            price: feature.marketplacePrice,
            category: feature.marketplaceCategory || 'advanced-features',
            description: feature.description,
            profession,
          });
        }
      });
    });

    return features;
  }, []);

  // Create/Update template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (template: Partial<ReceiptTemplate>) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/receipt-templates', {
        method: template.id ? 'PUT' : 'POST',
        headers: {
          ...headers, , 'Content-Type': 'application/json'
        },
        body: JSON.stringify(template),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/receipt-templates'] });
      setShowDesigner(false);
      setSelectedTemplate(null);
    },
  });

  // Update business settings mutation
  const updateBusinessSettingsMutation = useMutation({
    mutationFn: async (settings: BusinessSettings) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/business-settings', {
        method: 'PUT',
        headers: {
          ...headers, , 'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/business-settings'] });
      setShowBusinessSettings(false);
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/receipt-templates/${templateId}`, {
        method: 'DELETE',
        headers
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/receipt-templates'] });
    },
  });

  // Send test email mutation
  const sendTestEmailMutation = useMutation({
    mutationFn: async ({ templateId, testEmail }: { templateId: string; testEmail: string }) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/receipt-templates/test-send', {
        method: 'POST',
        headers: {
          ...headers, , 'Content-Type': 'application/json'
        },
        body: JSON.stringify({ templateId, testEmail }),
      });
    },
  });

  const handleCreateTemplate = (type: string) => {
    const newTemplate: Partial<ReceiptTemplate> = {
      name: `New ${type} Template`,
      type: type as any,
      category: type,
      subject: 'Receipt - {{planName} Subscription',
      htmlTemplate: '',
      variables: ['customerName','transactionId','planName','totalAmount'],
      isActive: false,
      autoSend: false,
      sendTrigger: 'payment-success',
    };
    setSelectedTemplate(newTemplate as ReceiptTemplate);
    setShowDesigner(true);
  };

  const handlePreview = (template: ReceiptTemplate) => {
    // Generate mock preview data
    const mockData = {
      customerName: 'John Doe',
      businessName: businessSettings?.companyName || 'CreatorHub AS',
      transactionId: 'TXN-' + Date.now(),
      planName: 'Pro Plan',
      planPrice: 299,
      addons: [
        { name: 'Nettside-bygger', price: 199 },
        { name: 'Nettside Hosting', price: 99 },
      ],
      totalAmount: 597,
      currency: 'NOK',
      subscriptionStartDate: new Date().toISOString(),
    };
    setPreviewData(mockData);
    setSelectedTemplate(template);
    setShowPreview(true);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600}}>
          <EmailIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Receipt Template Manager
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setShowBusinessSettings(true)}
          >
            Business Settings
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleCreateTemplate('subscription')}
          >
            Create Template
          </Button>
        </Box>
      </Box>

      <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}, sx={{ mb: 3 }}>
        <Tab label="Templates" />
        <Tab label="Marketplace Pricing" />
        <Tab label="Template Variables" />
        <Tab label="Sent Receipts" />
      </Tabs>

      {/* Templates Tab */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          {['subscription','marketplace-addon','invoice','refund'].map((type) => (
            <Grid item xs={12} md={6} key={type}>
              <Card>
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 2}}>
                    <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                      {type.replace('-', ',')} Templates
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => handleCreateTemplate(type)}
                    >
                      Create
                    </Button>
                  </Box>

                  <List>
                    {templates
                      .filter((t: ReceiptTemplate) => t.type === type)
                      .map((template: ReceiptTemplate) => (
                        <ListItem key={template.id} divider>
                          <ListItemText
                            primary={template.name}
                            secondary={
                              <Box>
                                <Typography variant="caption" display="block">
                                  {template.subject}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 flexWrap: 'wrap' }}>
                                  <Chip
                                    label={template.isActive ? 'Active' : 'Inactive'}
                                    size="small"
                                    color={template.isActive ? 'success' : 'default'}
                                  />
                                  {template.autoSend && (
                                    <Chip
                                      label="Auto-Send"
                                      size="small"
                                      color="primary"
                                      icon={<SendIcon fontSize="small" />}
                                    />
                                  )}
                                </Box>
                              </Box>
                            }
                          />
                          <ListItemSecondaryAction>
                            <IconButton size="small" onClick={() => handlePreview(template)}>
                              <PreviewIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedTemplate(template);
                                setShowDesigner(true);
                              }}
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => deleteTemplateMutation.mutate(template.id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Marketplace Pricing Tab */}
      {tabValue === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Marketplace Features & Pricing
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              Pricing automatically synced from profession-feature-matrix.ts
            </Alert>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Feature</TableCell>
                    <TableCell>Profession</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell align="right">Price (NOK/month)</TableCell>
                    <TableCell>Description</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {marketplaceFeatures.map((feature) => (
                    <TableRow key={`${feature.profession}-${feature.featureId}`}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600}}>
                          {feature.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={feature.profession} size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={feature.category}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 600}}>
                          {feature.price} kr
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {feature.description}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Template Variables Tab */}
      {tabValue === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Available Template Variables
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              Use these variables in your email templates with double curly braces:{', '}
              {`{{variableName}`}
            </Alert>
            <Grid container spacing={2}>
              {[
                { name: 'customerName', desc: 'Customer full name' },
                { name: 'businessName', desc: 'Customer business name' },
                { name: 'transactionId', desc: 'Unique transaction ID' },
                { name: 'planName', desc: 'Subscription plan name' },
                { name: 'planPrice', desc: 'Base plan price' },
                { name: 'totalAmount', desc: 'Total amount including add-ons' },
                { name: 'currency', desc: 'Currency code (NOK)' },
                { name: 'subscriptionStartDate', desc: 'Subscription start date' },
                { name: 'companyName', desc: 'Your company name' },
                { name: 'companyOrgNumber', desc: 'Organization number' },
                { name: 'companyPhone', desc: 'Support phone' },
                { name: 'companyEmail', desc: 'Support email' },
                { name: 'websiteUrl', desc: 'Company website' },
              ].map((variable) => (
                <Grid item xs={12} sm={6} md={4} key={variable.name}>
                  <Paper sx={{ p: 2 }}>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: 'monospace', fontWeight: 600, mb: 0.5 }}>
                      {`{{${variable.name}}`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {variable.desc}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Email Designer Dialog */}
      <Dialog open={showDesigner} onClose={() => setShowDesigner(false)} maxWidth="xl" fullWidth>
        <DialogTitle>{selectedTemplate?.id ? 'Edit' : 'Create'} Receipt Template</DialogTitle>
        <DialogContent>
          {/* Template Settings */}
          <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
              Template Settings
            </Typography>
            <Grid container spacing={2}, sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Template Name"
                  value={selectedTemplate?.name || ', '}
                  onChange={(e) =>
                    setSelectedTemplate((prev) => (prev ? { ...prev, name: e.target.value } : null))
                  }
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email Subject"
                  value={selectedTemplate?.subject || ', '}
                  onChange={(e) =>
                    setSelectedTemplate((prev) =>
                      prev ? { ...prev, subject: e.target.value } : null,
                    )
                  }
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={selectedTemplate?.isActive || false}
                      onChange={(e) =>
                        setSelectedTemplate((prev) =>
                          prev ? { ...prev, isActive: e.target.checked } : null,
                        )
                      }
                      color="success"
                    />
                  }
                  label="Active Template"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={selectedTemplate?.autoSend || false}
                      onChange={(e) =>
                        setSelectedTemplate((prev) =>
                          prev ? { ...prev, autoSend: e.target.checked } : null,
                        )
                      }
                      color="primary"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <SendIcon fontSize="small" />
                      <Typography variant="body2">Auto-Send on Payment</Typography>
                    </Box>
                  }
                />
              </Grid>
              {selectedTemplate?.autoSend && (
                <Grid item xs={12}>
                  <Alert severity="info" icon={<Info />}>
                    <Typography variant="body2">
                      <strong>Auto-Send Enabled:</strong> This template will automatically be sent
                      when a payment is completed. The receipt will be generated and emailed to the
                      customer immediately after successful payment.
                    </Typography>
                  </Alert>
                </Grid>
              )}
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Send Trigger</InputLabel>
                  <Select
                    value={selectedTemplate?.sendTrigger || 'payment-success'}
                    label="Send Trigger"
                    onChange={(e) =>
                      setSelectedTemplate((prev) =>
                        prev ? { ...prev, sendTrigger: e.target.value as any } : null,
                      )
                    }
                  >
                    <MenuItem value="payment-success">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Check fontSize="small" />
                        Payment Success
                      </Box>
                    </MenuItem>
                    <MenuItem value="subscription-created">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CardMembership fontSize="small" />
                        Subscription Created
                      </Box>
                    </MenuItem>
                    <MenuItem value="addon-purchased">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ShoppingCart fontSize="small" />
                        Add-on Purchased
                      </Box>
                    </MenuItem>
                    <MenuItem value="manual">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Edit fontSize="small" />
                        Manual Only
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>

          {/* Email Designer */}
          <EmailDesigner
            context="general"
            onSave={(template) => {
              saveTemplateMutation.mutate({
                ...selectedTemplate,
                htmlTemplate: JSON.stringify(template),
              });
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDesigner(false)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={() => saveTemplateMutation.mutate(selectedTemplate!)}
          >
            Save Template
          </Button>
        </DialogActions>
      </Dialog>

      {/* Business Settings Dialog */}
      <Dialog
        open={showBusinessSettings}
        onClose={() => setShowBusinessSettings(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <BusinessIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Business Settings
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2}, sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Company Name"
                value={businessSettings?.companyName || ', '}
                onChange={(e) => {}}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Organization Number"
                value={businessSettings?.orgNumber || ', '}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Phone" value={businessSettings?.phone || ', '} />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Support Email"
                value={businessSettings?.email || 'support@creatorhubn.com'}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Website"
                value={businessSettings?.website || 'https://creatorhubn.com'}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Company Logo</InputLabel>
                <Select
                  value={businessSettings?.logoUrl || '/creatorhub-logo-amber.svg'}
                  label="Company Logo"
                >
                  <MenuItem value="/creatorhub-logo-amber.svg">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <img
                        src="/creatorhub-logo-amber.svg"
                        alt="CreatorHub Logo"
                        style={{ height: 24, width: 'auto' }} />
                      <Box>
                        <Typography variant="body2">CreatorHub Logo (Amber)</Typography>
                        <Typography variant="caption" color="text.secondary">
                          /creatorhub-logo-amber.svg
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                  <MenuItem value="custom">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ImageIcon fontSize="small" />
                      Custom Logo URL
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
              <Alert severity="info" sx={{ mt: 1 } icon={<Info />}>
                <Typography variant="caption">
                  Logo will automatically appear in all email receipts and templates
                </Typography>
              </Alert>
            </Grid>
            <Grid item xs={12}>
              <Alert severity="info" icon={<Info />}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  🔗 Quick Links til dine eksisterende sider: </Typography>
                <Stack direction="row" spacing={1}, sx={{ mt: 1 }}>
                  <Chip
                    label="Vilår (terms-and-conditions)"
                    size="small"
                    clickable
                    onClick={() => window.open('/terms-and-conditions', ','_blank')}
                    icon={<Gavel />}
                  />
                  <Chip
                    label="Personvern (privacy-policy)"
                    size="small"
                    clickable
                    onClick={() => window.open('/privacy-policy', ', '_blank')}
                    icon={<Policy />}
                  />
                </Stack>
              </Alert>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Terms & Conditions Page</InputLabel>
                <Select
                  value={businessSettings?.termsUrl || '/terms-and-conditions'}
                  label="Terms & Conditions Page"
                >
                  <MenuItem value="/terms-and-conditions">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Gavel fontSize="small" />
                      <Box>
                        <Typography variant="body2">Vilår og Betingelser</Typography>
                        <Typography variant="caption" color="text.secondary">
                          /terms-and-conditions
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                  <MenuItem value="custom">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Edit fontSize="small" />
                      Custom URL
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Privacy Policy Page</InputLabel>
                <Select
                  value={businessSettings?.privacyUrl || '/privacy-policy'}
                  label="Privacy Policy Page"
                >
                  <MenuItem value="/privacy-policy">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Policy fontSize="small" />
                      <Box>
                        <Typography variant="body2">Personvernerklæring</Typography>
                        <Typography variant="caption" color="text.secondary">
                          /privacy-policy
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                  <MenuItem value="custom">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Edit fontSize="small" />
                      Custom URL
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBusinessSettings(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => {}>
            Save Settings
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onClose={() => setShowPreview(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <PreviewIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Template Preview
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Preview with sample data
          </Alert>
          {/* Render preview HTML here */}
          <Box
            sx={{ border: '1px solid #ddd', borderRadius: 1, p: 2, bgcolor: '#f5f5f5' }
            dangerouslySetInnerHTML={{
              __html: selectedTemplate?.htmlTemplate ||'<p>No template content</p>'}} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>Close</Button>
          <Button variant="outlined" startIcon={<SendIcon />}>
            Send Test Email
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}}
