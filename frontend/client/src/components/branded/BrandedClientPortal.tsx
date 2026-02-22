/**
 * Branded Client Portal
 *
 * Fully white-labeled client portal with custom branding
 * - Custom domain support
 * - Brand colors and logo throughout
 * - Hides CreatorHub branding if configured
 */

import React from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Card,
  CardContent,
  Button,
  Grid,
  Avatar,
  Chip,
} from '@mui/material';
import { Download as DownloadIcon, Visibility as ViewIcon, AccountBalance as SplitSheetIcon } from '@mui/icons-material';
import { useBrandedTheme } from '@/contexts/WhiteLabelThemeProvider';
import { useWhiteLabelBranding } from '@/contexts/WhiteLabelBrandingContext';
import SplitSheetPortalView from '../universal/split-sheets/SplitSheetPortalView';
import { Tabs, Tab } from '@mui/material';

interface GalleryItem {
  id: string;
  title: string;
  thumbnail: string;
  type: 'photo' | 'video';
  downloadUrl: string;
}

interface BrandedClientPortalProps {
  clientName: string;
  projectTitle: string;
  galleryItems: GalleryItem[];
  message?: string;
  contributorEmail?: string;
  contributorId?: string;
  accessToken?: string;
  showSplitSheets?: boolean;
}

export const BrandedClientPortal: React.FC<BrandedClientPortalProps> = ({
  clientName,
  projectTitle,
  galleryItems,
  message,
  contributorEmail,
  contributorId,
  accessToken,
  showSplitSheets = false,
}) => {
  const { brandColor, logoUrl, businessName, getBrandedBackground, getBrandedGradient } =
    useBrandedTheme();
  const { branding, shouldHideCreatorHub } = useWhiteLabelBranding();
  const [activeTab, setActiveTab] = React.useState(0);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Branded Header */}
      <AppBar position="static" sx={{ background: getBrandedGradient() }}>
        <Toolbar>
          {logoUrl && (
            <Box sx={{ mr: 2 }}>
              <img
                src={logoUrl}
                alt={businessName}
                style={{
                  height: 40,
                  maxWidth: 150,
                  objectFit: 'contain' }} />
            </Box>
          )}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, color: 'white' }}>
            {businessName}
          </Typography>
          {branding?.customDomain && (
            <Chip
              label={branding.customDomain}
              size="small"
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                color: 'white' }} />
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Welcome Section */}
        <Card sx={{ mb: 4, borderTop: `4px solid ${brandColor}` }>
          <CardContent>
            <Typography variant="h4" gutterBottom sx={{ color: brandColor }}>
              Hei, {clientName}! 👋
            </Typography>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {projectTitle}
            </Typography>
            {message && (
              <Typography variant="body1" sx={{ mt: 2 }}>
                {message}}
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* Tabs for Gallery and Split Sheets */}
        {(showSplitSheets || contributorEmail || contributorId) && (
          <Box sx={{ mb: 3 }}>
            <Tabs
              value={activeTab}
              onChange={(_, newValue) => setActiveTab(newValue)}
              sx={{
                borderBottom: 1,
                borderColor: 'divider', '& .MuiTab-root': {
                  color: 'text.secondary','&.Mui-selected': {
                    color: brandColor,
                  },
                }, '& .MuiTabs-indicator': {
                  bgcolor: brandColor,
                }}}
            >
              <Tab label="Dine filer" icon={<ViewIcon />} iconPosition="start" />
              <Tab label="Split Sheets" icon={<SplitSheetIcon />} iconPosition="start" />
            </Tabs>
          </Box>
        )}

        {/* Gallery Tab */}
        {activeTab === 0 && (
          <>
            <Typography variant="h5" gutterBottom sx={{ mb: 3, color: brandColor }}>
              Dine filer
            </Typography>

            <Grid container spacing={3}>
              {galleryItems.map((item) => (
                <Grid item xs={12} sm={6} md={4} key={item.id}>
                  <Card
                    sx={{
                      height: '100%',
                      transition: 'transform 0.2s','&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: `0 8px 24px ${getBrandedBackground(0.2)}`,
                      }}}
                  >
                    <Box
                      sx={{
                        position: 'relative',
                        paddingTop: '75%',
                        bgcolor: 'grey.200',
                        backgroundImage: `url(${item.thumbnail})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center' }
                    >
                      <Chip
                        label={item.type}
                        size="small"
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          bgcolor: brandColor,
                          color: 'white' }} />
                    </Box>
                    <CardContent>
                      <Typography variant="h6" gutterBottom noWrap>
                        {item.title}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<ViewIcon />}
                          sx={{ borderColor: brandColor, color: brandColor }
                          fullWidth
                        >
                          Vis
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<DownloadIcon />}}
                          sx={{ bgcolor: brandColor'&:hover': { bgcolor: brandColor } }
                          fullWidth
                          href={item.downloadUrl}
                          download
                        >
                          Last ned
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </>
        )}

        {/* Split Sheets Tab */}
        {activeTab === 1 && (showSplitSheets || contributorEmail || contributorId) && (
          <SplitSheetPortalView
            contributorEmail={contributorEmail}
            contributorId={contributorId}
            accessToken={accessToken}
            onSigned={() => {
              // Optionally refresh or show success message
            }}
          />
        )}

        {/* Footer */}
        <Box
          sx={{ mt: 6, pt: 4, borderTop: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
          {!shouldHideCreatorHub() && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Powered by CreatorHub Norge
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {businessName}
          </Typography>
          {branding?.email && (
            <Typography variant="caption" color="text.secondary" display="block">
              {branding.email}
            </Typography>
          )}
          {branding?.phone && (
            <Typography variant="caption" color="text.secondary" display="block">
              {branding.phone}
            </Typography>
          )}
          {branding?.customDomain && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              {branding.customDomain}
            </Typography>
          )}
        </Box>
      </Container>
    </Box>
  );
};

export default BrandedClientPortal;
