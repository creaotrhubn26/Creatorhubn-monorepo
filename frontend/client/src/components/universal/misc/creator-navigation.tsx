import { useTheming } from '../../../utils/theming-helper';
import React from 'react';
import {
  Button,
  Card as MuiCard,
  CardContent,
  Box,
} from '@mui/material';
import {
  PhotoCamera,
  Videocam,
  Headset,
  CheckCircle,
} from '@mui/icons-material';

interface CreatorNavigationProps { 
  onNavigate: (path: string) => void; 
}

export default function CreatorNavigation({ onNavigate }: CreatorNavigationProps) {
  // Theming system
  const theming = useTheming('photographer');
  return (
    <Box sx={{ py:  8, background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh'}}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', mb:  6 }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 700, color: '#1e2930', marginBottom: '1rem'}}>
            For Wedding Professionals
          </h2>
          <p style={{ fontSize: '1.125rem', color: '#647480', maxWidth: '32rem', margin: '0 auto'}}>
            Easy-to-use tools for photographers, videographers, and music artists who help create amazing weddings
          </p>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap:  4, width: '100%', maxWidth: '24rem'}}>
          {/* Photographers Card */}
          <MuiCard sx={{ 
            background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)', 
            border: '1px solid rgba(21, 191, 36, 0.3)',
            borderRadius:  2,
            boxShadow: 2 }}>
            <CardContent sx={{ p:  4 ,  ...theming.getThemedCardSx() }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb:  2 }}>
                <PhotoCamera sx={{ fontSize:  32, color: '#2563eb', mb:  1 }} />
              </Box>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', marginBottom: '1rem'}}>Photographers</h3>
              <p style={{ color: '#374150', textAlign: 'center', marginBottom: '1.5rem'}}>
                Manage your photos, share with clients, and book more weddings
              </p>
              <Box component="ul" sx={{ listStyle: 'none', p: 0, mb: 4 }}>
                <Box component="li" sx={{ display: 'flex', alignItems: 'center', mb: 1, fontSize: '0.875rem'}}>
                  <CheckCircle sx={{ fontSize:  20, color: '#10b980', mr:  1 }} />
                  Share Photos with Couples
                </Box>
                <Box component="li" sx={{ display: 'flex', alignItems: 'center', mb: 1, fontSize: '0.875rem'}}>
                  <CheckCircle sx={{ fontSize:  20, color: '#10b980', mr:  1 }} />
                  Schedule Appointments
                </Box>
                <Box component="li" sx={{ display: 'flex', alignItems: 'center', mb: 1, fontSize: '0.875rem'}}>
                  <CheckCircle sx={{ fontSize:  20, color: '#10b980', mr:  1 }} />
                  Showcase Your Best Work
                </Box>
              </Box>
              <Button fullWidth
                variant="contained"
                sx={{ 
                  bgcolor: '#1e2930',
                  color: 'white','&:hover': { bgcolor: '#334155',}
              }}
                onClick={() => onNavigate("/photographer-dashboard")}
              >
                Join as Photographer
              </Button>
            </CardContent>
          </MuiCard>

          {/* Videographers Card */}
          <MuiCard sx={{ 
            background: 'linear-gradient(135deg, #f3e8ff 0%, #ffffff 100%)', 
            border: '1px solid rgba(21, 191, 36, 0.3)',
            borderRadius:  2,
            boxShadow: 2 }}>
            <CardContent sx={{ p:  4 ,  ...theming.getThemedCardSx() }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb:  2 }}>
                <Videocam sx={{ fontSize:  32, color: '#f59e00', mb:  1 }} />
              </Box>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', marginBottom: '1rem'}}>Videographers</h3>
              <p style={{ color: '#374150', textAlign: 'center', marginBottom: '1.5rem'}}>
                Create amazing wedding videos and share them easily with couples
              </p>
              <Box component="ul" sx={{ listStyle: 'none', p: 0, mb: 4 }}>
                <Box component="li" sx={{ display: 'flex', alignItems: 'center', mb: 1, fontSize: '0.875rem'}}>
                  <CheckCircle sx={{ fontSize:  20, color: '#10b980', mr:  1 }} />
                  Video Editing Tools
                </Box>
                <Box component="li" sx={{ display: 'flex', alignItems: 'center', mb: 1, fontSize: '0.875rem'}}>
                  <CheckCircle sx={{ fontSize:  20, color: '#10b980', mr:  1 }} />
                  Live Wedding Streaming
                </Box>
                <Box component="li" sx={{ display: 'flex', alignItems: 'center', mb: 1, fontSize: '0.875rem'}}>
                  <CheckCircle sx={{ fontSize:  20, color: '#10b980', mr:  1 }} />
                  Easy Video Sharing
                </Box>
              </Box>
              <Button fullWidth
                variant="contained"
                sx={{ 
                  bgcolor: '#1e2930',
                  color: 'white','&:hover': { bgcolor: '#334155',}
              }}
                onClick={() => onNavigate("/videographer-dashboard")}
              >
                Join as Videographer
              </Button>
            </CardContent>
          </MuiCard>

          {/* Music Producers Card */}
          <MuiCard sx={{ 
            background: 'linear-gradient(135deg, #fef3e2 0%, #ffffff 100%)', 
            border: '1px solid rgba(21, 191, 36, 0.3)',
            borderRadius:  2,
            boxShadow: 2 }}>
            <CardContent sx={{ p:  4 ,  ...theming.getThemedCardSx() }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb:  2 }}>
                <Headset sx={{ fontSize:  32, color: '#ea5800', mb:  1 }} />
              </Box>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', marginBottom: '1rem'}}>Music Producers</h3>
              <p style={{ color: '#374150', textAlign: 'center', marginBottom: '1.5rem'}}>
                Create perfect wedding music and work together with other professionals
              </p>
              <Box component="ul" sx={{ listStyle: 'none', p: 0, mb: 4 }}>
                <Box component="li" sx={{ display: 'flex', alignItems: 'center', mb: 1, fontSize: '0.875rem'}}>
                  <CheckCircle sx={{ fontSize:  20, color: '#10b980', mr:  1 }} />
                  Music Creation Tools
                </Box>
                <Box component="li" sx={{ display: 'flex', alignItems: 'center', mb: 1, fontSize: '0.875rem'}}>
                  <CheckCircle sx={{ fontSize:  20, color: '#10b980', mr:  1 }} />
                  Work with Other Artists
                </Box>
                <Box component="li" sx={{ display: 'flex', alignItems: 'center', mb: 1, fontSize: '0.875rem'}}>
                  <CheckCircle sx={{ fontSize:  20, color: '#10b980', mr:  1 }} />
                  Share Music with Couples
                </Box>
              </Box>
              <Button fullWidth
                variant="contained"
                sx={{ 
                  bgcolor: '#1e2930',
                  color: 'white', '&:hover': { bgcolor: '#334155',}
              }}
                onClick={() => onNavigate("/music-producer-dashboard")}
              >
                Join as Music Producer
              </Button>
            </CardContent>
          </MuiCard>
        </Box>
      </Box>
    </Box>
  );
}
