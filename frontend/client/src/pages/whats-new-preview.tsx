/**
 * What's New Preview Page
 * Demo/preview of the announcement system
 */

import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
} from '@mui/material';
import { Visibility as VisibilityIcon, Code as CodeIcon, Email as EmailIcon } from '@mui/icons-material';
import WhatsNewModal from '@/components/WhatsNewModal';

// Sample announcement data for preview
const sampleAnnouncements = [
  {
    id: '1',
    title: 'AI-Drevet Bildeforbedring',
    content: `Vi har lansert en helt ny AI-drevet bildeforbedringsfunksjon!

Funksjoner:
• Automatisk støyreduksjon
• Intelligente fargekorreksjoner
• Ett-klikk forbedring
• Batch-prosessering av flere bilder

Denne funksjonen er tilgjengelig for alle fotografer med Premium-abonnement.`,
    category: 'feature' as const,
    importance: 'high' as const,
    image_url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600',
    action_label: 'Prøv AI-Forbedring',
    action_url: '/features/ai-enhance',
    version: '2.1.0',
    release_date: new Date().toISOString(),
    is_read: false,
    feature_key: 'ai-photo-editor',
    auto_generated: false,
    featureInfo: {
      id: 'ai-photo-editor',
      enabled: false,
      plan: 'pro',
      description: 'AI-powered photo enhancement with intelligent corrections',
      impact: 'high',
      dependencies: ['photo-editor-basic'],
    },
  },
  {
    id: '2',
    title: 'Forbedret Ytelse og Stabilitet',
    content: `Vi har gjort betydelige forbedringer i plattformens ytelse og stabilitet.

Hva er nytt:
• 40% raskere sideinnlasting
• Forbedret håndtering av store bildefiler
• Redusert minnebruk
• Bedre feilhåndtering

Alle brukere vil merke forskjellen umiddelbart.`,
    category: 'update' as const,
    importance: 'medium' as const,
    release_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    is_read: false,
    auto_generated: false,
  },
  {
    id: '3',
    title: 'Tips: Optimaliser Bildekvalitet for Web',
    content: `Få de beste resultatene når du laster opp bilder: 1. Bruk JPEG for fotografier
2. Optimer filstørrelse (under 500KB)
3. Opprett thumbnails automatisk
4. Bruk riktig fargeprofilering

Vår plattform gjør dette automatisk, men du kan også justere innstillinger manuelt i Innstillinger > Bildeopplasting.`,
    category: 'tip' as const,
    importance: 'low' as const,
    action_label: 'Se Innstillinger',
    action_url: '/settings/image-upload',
    release_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    is_read: true,
    auto_generated: false,
  },
  {
    id: '4',
    title: 'Planlagt Vedlikehold 15. November',
    content: `Plattformen vil være utilgjengelig for vedlikehold: 📅 Dato: 15. november 2025
🕐 Tid: 02:00 - 04:00 (CET)
⏱️ Varighet: Ca. 2 timer

Vi beklager eventuelle ulemper dette måtte medføre.`,
    category: 'maintenance' as const,
    importance: 'high' as const,
    release_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    is_read: false,
    auto_generated: false,
  },
];

export default function WhatsNewPreview() {
  const [modalOpen, setModalOpen] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);

  const getCategoryColor = (category: string) => {
    const colors = {
      feature: '#4caf50',
      update: '#2196f3',
      maintenance: '#ff9800',
      tip: '#9c27b0',
    };
    return colors[category as keyof typeof colors] || '#666';
  };

  const getCategoryLabel = (category: string) => {
    const labels = {
      feature: 'Ny Funksjon',
      update: 'Oppdatering',
      maintenance: 'Vedlikehold',
      tip: 'Tips',
    };
    return labels[category as keyof typeof labels] || category;
  };

  const getImportanceLabel = (importance: string) => {
    const labels = {
      critical: 'Kritisk',
      high: 'Viktig',
      medium: 'Middels',
      low: 'Lav',
    };
    return labels[importance as keyof typeof labels] || importance;
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, mb: 2 }}>
          🎉 What's New Preview
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Preview av hvordan kunngjøringer vises til brukere i CreatorHub Norge
        </Typography>

        <Box display="flex" gap={2}>
          <Button
            variant="contained"
            startIcon={<VisibilityIcon />}
            onClick={() => setModalOpen(true)}
            sx={{
              bgcolor: '#ff8c00','&:hover': { bgcolor: '#e67e00' },
            }}
          >
            Åpne Modal Forhåndsvisning
          </Button>

          <Button
            variant="outlined"
            startIcon={<EmailIcon />}
            onClick={() => setShowEmailPreview(!showEmailPreview)}
            sx={{
              borderColor: '#ff8c00',
              color: '#ff8c00','&:hover': { borderColor: '#e67e00', bgcolor: 'rgba(255,140,0,0.1)' },
            }}
          >
            {showEmailPreview ? 'Skjul' : 'Vis'} E-post Forhåndsvisning
          </Button>
        </Box>
      </Box>

      {/* Sample Announcements Cards */}
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
        Eksempel Kunngjøringer
      </Typography>

      <Grid container spacing={3}>
        {sampleAnnouncements.map((announcement) => (
          <Grid item xs={12} md={6} key={announcement.id}>
            <Card sx={{ height: '100%', position: 'relative' }}>
              {!announcement.is_read && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: '#ff8c00',
                  }} />
              )}
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <Chip
                    label={getCategoryLabel(announcement.category)}
                    size="small"
                    sx={{
                      bgcolor: getCategoryColor(announcement.category),
                      color: 'white',
                    }} />
                  <Chip
                    label={getImportanceLabel(announcement.importance)}
                    size="small"
                    variant="outlined"
                  />
                  {announcement.version && (
                    <Chip label={`v${announcement.version}`} size="small" variant="outlined" />
                  )}
                </Box>

                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  {announcement.title}
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mb: 2,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                  {announcement.content}
                </Typography>

                {announcement.featureInfo && (
                  <Card sx={{ bgcolor: 'grey.50', mb: 2 }}>
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                        Feature Info: </Typography>
                      <Box display="flex" gap={0.5} flexWrap="wrap">
                        <Chip
                          label={`Plan: ${announcement.featureInfo.plan.toUpperCase()}`}
                          size="small"
                        />
                        <Chip label={`Impact: ${announcement.featureInfo.impact}`} size="small" />
                        <Chip
                          label={announcement.featureInfo.enabled ? 'Aktivert' : 'Tilgjengelig'}
                          size="small"
                          color={announcement.featureInfo.enabled ? 'success' : 'default'}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                )}

                <Typography variant="caption" color="text.secondary">
                  {new Date(announcement.release_date).toLocaleDateString('nb-NO', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Email Preview */}
      {showEmailPreview && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
            E-post Forhåndsvisning
          </Typography>

          <Card>
            <CardContent>
              <Box
                sx={{
                  maxWidth: 600,
                  margin: '0 auto',
                  fontFamily: 'Arial, sans-serif',
                  p: 3,
                  bgcolor: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: 2,
                }}>
                <Typography variant="h4" sx={{ color: '#ff8c00', mb: 1, fontWeight: 700}}>
                  {sampleAnnouncements[0].title}
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {new Date().toLocaleDateString('nb-NO')}
                </Typography>

                <Box sx={{ mb: 3, whiteSpace: 'pre-line', lineHeight: 1.7 }}>
                  <Typography variant="body1">{sampleAnnouncements[0].content}</Typography>
                </Box>

                <Button
                  variant="contained"
                  sx={{
                    bgcolor: '#ff8c00',
                    color: 'white',
                    textTransform: 'none',
                    borderRadius: 1,
                    px: 3,
                    py: 1.5,
                    '&:hover': { bgcolor: '#e67e00' },
                  }}
                >
                  {sampleAnnouncements[0].action_label}
                </Button>

                <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid #e0e0e0' }}>
                  <Typography variant="caption" color="text.secondary">
                    CreatorHub Norge - creatorhubn.com
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Code Example */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
          <CodeIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Bruk i Koden
        </Typography>

        <Card sx={{ bgcolor: '#1e1e1e', color: '#d4d4d4' }}>
          <CardContent>
            <pre style={{ margin: 0, overflow: 'auto' }}>
              <code>{`import WhatsNewModal from '@/components/WhatsNewModal';
import { useAuth } from'@/hooks/useAuth';

function MyComponent() {
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const { user } = useAuth();

  return (
    <>
      <Button onClick={() => setShowWhatsNew(true)}>
        Hva er nytt?
      </Button>

      <WhatsNewModal
        open={showWhatsNew}
        onClose={() => setShowWhatsNew(false)}
        userProfession={user.profession}
      />
    </>
  );
}`}</code>
            </pre>
          </CardContent>
        </Card>
      </Box>

      {/* Actual Modal */}
      <WhatsNewModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        userProfession="photographer"
      />
    </Container>
  );
}
