/**
 * Branded Contract Template
 *
 * Automatically applies white-label branding to contract documents
 * - Custom logo in header
 * - Brand colors for headings and accents
 * - Business name and contact info
 */

import React from 'react';
import { Box, Typography, Paper, Divider, Grid } from '@mui/material';
import { useBrandedTheme } from '@/contexts/WhiteLabelThemeProvider';
import { useWhiteLabelBranding } from '@/contexts/WhiteLabelBrandingContext';

interface ContractData {
  contractNumber: string;
  clientName: string;
  projectDescription: string;
  amount: number;
  date: string;
  terms: string[];
}

interface BrandedContractTemplateProps {
  contractData: ContractData;
}

export const BrandedContractTemplate: React.FC<BrandedContractTemplateProps> = ({
  contractData,
}) => {
  const { brandColor, logoUrl, businessName, branding } = useBrandedTheme();
  const { getBusinessName, getLogoUrl } = useWhiteLabelBranding();

  return (
    <Paper
      sx={{
        p: 4,
        maxWidth: 800,
        mx: 'auto',
        bgcolor: 'background.paper'}}>
      {/* Header with Logo and Business Info */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 4,
          pb: 3,
          borderBottom: `3px solid ${brandColor}`}}
      >
        <Box>
          {logoUrl && (
            <img
              src={logoUrl}
              alt={businessName}
              style={{
                maxHeight: 80,
                maxWidth: 200,
                objectFit: 'contain',
                marginBottom: 16}} />
          )}
          <Typography variant="h4" sx={{ color: brandColor, fontWeight: 'bold' }}>
            {businessName}
          </Typography>
          {branding?.businessAddress && (
            <Typography variant="body2" color="text.secondary">
              {branding.businessAddress}
            </Typography>
          )}
          {branding?.email && (
            <Typography variant="body2" color="text.secondary">
              {branding.email}
            </Typography>
          )}
          {branding?.phone && (
            <Typography variant="body2" color="text.secondary">
              {branding.phone}
            </Typography>
          )}
        </Box>

        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="h5" sx={{ color: brandColor, fontWeight: 'bold' }}>
            KONTRAKT
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Kontraktnr: {contractData.contractNumber}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Dato: {contractData.date}
          </Typography>
        </Box>
      </Box>

      {/* Client Information */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ color: brandColor, mb: 2, fontWeight: 600}}>
          Klientinformasjon
        </Typography>
        <Typography variant="body1">
          <strong>Klient:</strong> {contractData.clientName}
        </Typography>
        <Typography variant="body1" sx={{ mt: 1 }}>
          <strong>Prosjekt:</strong> {contractData.projectDescription}
        </Typography>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Terms and Conditions */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ color: brandColor, mb: 2, fontWeight: 600}}>
          Vilkår og betingelser
        </Typography>
        <Box component="ol" sx={{ pl: 2 }}>
          {contractData.terms.map((term, index) => (
            <Typography
              key={index}
              component="li"
              variant="body2"
              sx={{ mb: 1, color: 'text.primary' }}>
              {term}
            </Typography>
          ))}
        </Box>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Payment Information */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ color: brandColor, mb: 2, fontWeight: 600}}>
          Betaling
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="body2" color="text.secondary">
              Total beløp: </Typography>
          </Grid>
          <Grid item xs={6} sx={{ textAlign: 'right' }}>
            <Typography variant="h6" sx={{ color: brandColor, fontWeight: 'bold' }}>
              {contractData.amount.toLocaleString('no-NO', {
                style: 'currency',
                currency: 'NOK',
              })}
            </Typography>
          </Grid>
        </Grid>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Signatures */}
      <Grid container spacing={4} sx={{ mt: 4 }}>
        <Grid item xs={6}>
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {businessName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Dato og signatur
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={6}>
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {contractData.clientName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Dato og signatur
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {/* Footer with Custom Domain */}
      {branding?.customDomain && (
        <Box
          sx={{ mt: 4, pt: 3, borderTop: `1px solid`, borderColor: 'divider', textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Dette dokumentet er generert av {businessName}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            {branding.customDomain}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default BrandedContractTemplate;
