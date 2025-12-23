/**
 * EmailCRMBridge Component
 * Connects EmailDesigner with CRM user data for targeted email campaigns
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Email as EmailIcon,
  People as PeopleIcon,
  FilterList as FilterIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { apiRequest } from '@/lib/queryClient';

interface CRMCustomer {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profession?: string;
  businessName?: string;
  isActive: boolean;
  createdAt: string;
}

interface EmailCRMBridgeProps {
  onSendEmail: (recipients: CRMCustomer[], templateName: string) => void;
  availableTemplates?: string[];
}

export default function EmailCRMBridge({
  onSendEmail,
  availableTemplates = [],
}: EmailCRMBridgeProps) {
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [professionFilter, setProfessionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedTemplate, setSelectedTemplate] = useState(', ');
  const [previewOpen, setPreviewOpen] = useState(false);

  const queryClient = useQueryClient();
  const { communication } = useEnhancedMasterIntegration();

  // Fetch customers from CRM
  const { data: customersData, isLoading } = useQuery({
    queryKey: ['/api/admin/users', searchTerm, professionFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: '1',
        limit: '100', // Fetch more for campaign selection
        ...(searchTerm && { search: searchTerm }),
        ...(professionFilter !== 'all' && { profession: professionFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      });

      const response = await fetch(`/api/admin/users?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch customers');
      return response.json();
    },
    staleTime: 60000,
  });

  const customers = customersData?.users || [];

  // Handle customer selection
  const toggleCustomer = (customerId: string) => {
    setSelectedCustomers((prev) =>
      prev.includes(customerId) ? prev.filter((id) => id !== customerId) : [...prev, customerId],
    );
  };

  const toggleAll = () => {
    if (selectedCustomers.length === customers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(customers.map((c: CRMCustomer) => c.id));
    }
  };

  // Handle email campaign send
  const handleSendCampaign = () => {
    const recipients = customers.filter((c: CRMCustomer) => selectedCustomers.includes(c.id));

    onSendEmail(recipients, selectedTemplate);

    // Broadcast campaign event
    communication.sendBroadcast('email:campaign-initiated', {
      type: 'bulk_email',
      recipientCount: recipients.length,
      template: selectedTemplate,
      timestamp: Date.now(),
    });

    setPreviewOpen(false);
  };

  // Get unique professions for filter
  const professions = Array.from(
    new Set(customers.map((c: CRMCustomer) => c.profession).filter(Boolean))
  );

  return (
    <Box>
      <Card>
        <CardContent>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PeopleIcon />
            Velg Mottakere
          </Typography>

          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <TextField
              label="Søk"
              placeholder="Søk etter navn eller e-post..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
              sx={{ minWidth: 250 }} />

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Profesjon</InputLabel>
              <Select
                value={professionFilter}
                onChange={(e) => setProfessionFilter(e.target.value)}
                label="Profesjon"
              >
                <MenuItem value="all">Alle</MenuItem>
                {professions.map((prof: string) => (
                  <MenuItem key={prof} value={prof}>
                    {prof}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                label="Status"
              >
                <MenuItem value="all">Alle</MenuItem>
                <MenuItem value="active">Aktiv</MenuItem>
                <MenuItem value="inactive">Inaktiv</MenuItem>
              </Select>
            </FormControl>

            <Button variant="outlined" startIcon={<FilterIcon />} onClick={toggleAll}>
              {selectedCustomers.length === customers.length ? 'Fjern alle' : 'Velg alle'}
            </Button>
          </Box>

          {/* Selected count */}
          <Alert severity="info" sx={{ mb: 2 }}>
            {selectedCustomers.length} av {customers.length} kunder valgt
          </Alert>

          {/* Customer list */}
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : customers.length === 0 ? (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
              Ingen kunder funnet
            </Typography>
          ) : (
            <List
              sx={{
                maxHeight: 400,
                overflow: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1}}>
              {customers.map((customer: CRMCustomer) => (
                <ListItem
                  key={customer.id}
                  dense
                  button
                  onClick={() => toggleCustomer(customer.id)}
                >
                  <Checkbox
                    checked={selectedCustomers.includes(customer.id)}
                    onChange={() => toggleCustomer(customer.id)}
                  />
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2">
                          {customer.firstName && customer.lastName
                            ? `${customer.firstName} ${customer.lastName}`
                            : customer.email.split('@')[0]}
                        </Typography>
                        {customer.profession && (
                          <Chip label={customer.profession} size="small" variant="outlined" />
                        )}
                        {!customer.isActive && (
                          <Chip label="Inaktiv" size="small" color="error" variant="outlined" />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          {customer.email}
                        </Typography>
                        {customer.businessName && (
                          <Typography variant="caption" color="text.secondary">
                            {customer.businessName}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}

          <Divider sx={{ my: 3 }} />

          {/* Template Selection */}
          <Typography
            variant="h6"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmailIcon />
            Velg E-post Mal
          </Typography>

          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>E-post mal</InputLabel>
            <Select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              label="E-post mal"
            >
              <MenuItem value="">Velg mal...</MenuItem>
              <MenuItem value="user-welcome">Velkommen</MenuItem>
              <MenuItem value="gallery-ready">Galleri Klart</MenuItem>
              <MenuItem value="payment-reminder">Betalingspåminnelse</MenuItem>
              <MenuItem value="review-request">Be om Anmeldelse</MenuItem>
              <MenuItem value="follow-up">Oppfølging</MenuItem>
              {availableTemplates.map((template) => (
                <MenuItem key={template} value={template}>
                  {template}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Send Button */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              disabled={selectedCustomers.length === 0 || !selectedTemplate}
              onClick={() => setPreviewOpen(true)}
              sx={{ bgcolor: '#ff8c00','&:hover': { bgcolor: '#e67c00' } }}

            >
              Send til {selectedCustomers.length} kunder
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Bekreft E-postutsendelse</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Du er i ferd med å sende e-post til {selectedCustomers.length} kunder.
          </Alert>

          <Typography variant="body2" gutterBottom>
            <strong>Mal:</strong> {selectedTemplate}
          </Typography>

          <Typography variant="body2" gutterBottom>
            <strong>Mottakere:</strong>
          </Typography>
          <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
            {customers
              .filter((c: CRMCustomer) => selectedCustomers.includes(c.id)
              .map((customer: CRMCustomer) => (
                <ListItem key={customer.id}>
                  <ListItemText primary={customer.email} secondary={customer.firstName} />
                </ListItem>
              ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={handleSendCampaign}
            sx={{ bgcolor: '#ff8c00','&:hover': { bgcolor: '#e67c00' } }}

          >
            Bekreft og Send
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
