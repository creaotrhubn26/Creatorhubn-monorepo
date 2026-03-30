/**
 * Smart Meeting Preparation System
 * Automatically prepares all related documents, contracts, and information for meetings
 */

import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card as MuiCard,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Grid,
  Alert,
  IconButton,
  Tooltip,
  Badge,
  LinearProgress,
} from '@mui/material';
import {
  Description as DocumentIcon,
  Assignment as ContractIcon,
  TrendingUp as TimelineIcon,
  Notes as NotesIcon,
  Photo as PhotoIcon,
  Videocam as VideoIcon,
  LibraryMusic as MusicIcon,
  Build as EquipmentIcon,
  ExpandMore as ExpandMoreIcon,
  Launch as LaunchIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  SmartToy as SmartIcon,
} from '@mui/icons-material';

interface MeetingPreparation {
  meetingId: string;
  meetingTitle: string;
  clientName: string;
  projectId?: string;
  profession: string;
  documents: PreparedDocument[];
  contracts: PreparedContract[];
  notes: PreparedNote[];
  timeline?: WeddingTimeline;
  mediaFiles: PreparedMedia[];
  equipmentList?: EquipmentItem[];
  preparation_status: 'preparing' | 'ready' | 'incomplete';
  completeness: number
}

interface PreparedDocument {
  id: string;
  name: string;
  type: 'google_doc' | 'pdf' | 'contract' | 'brief';
  url: string;
  lastModified: string;
  status: 'ready' | 'needs_update' | 'missing'
}

interface PreparedContract {
  id: string;
  name: string;
  type: string;
  status: 'signed' | 'pending' | 'draft';
  url: string;
  signedDate?: string
}

interface PreparedNote {
  id: string;
  title: string;
  content: string;
  category: 'client_preferences' | 'project_details' | 'technical_notes' | 'timeline_notes';
  lastUpdated: string
}

interface WeddingTimeline {
  id: string;
  eventDate: string;
  totalEvents: number;
  completedEvents: number;
  keyMoments: TimelineEvent[];
  status: 'draft' | 'approved' | 'in_progress'
}

interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  description: string;
  status: 'pending' | 'completed'
}

interface PreparedMedia {
  id: string;
  name: string;
  type: 'photo' | 'video' | 'audio';
  thumbnail?: string;
  url: string;
  size: string
}

interface EquipmentItem {
  id: string;
  name: string;
  status: 'available' | 'booked' | 'maintenance';
  category: string
}

interface SmartMeetingPreparationProps {
  meetingId: string;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  userId: string;
  compact?: boolean
}

export default function SmartMeetingPreparation({
  meetingId,
  profession,
  userId,
  compact = false
}: SmartMeetingPreparationProps) {
  const queryClient = useQueryClient();
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();
  
  // Database connection for SmartMeetingPreparation
  const { data: meetingData = [], isLoading } = useQuery({
    queryKey: ['/api/meeting', 'user-data'],
    queryFn: () => apiRequest('/api/meeting/user-data', ),
    retry: false,
});

  // Mutation for updating meeting data
  const updateSmartMeetingPreparation = useMutation({
    mutationFn: async (data: any) => 
      apiRequest('/api/meeting/update', {
        method: 'POST',
        body: JSON.stringify(data)
  }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meeting', ],});
  }
});

  const [preparation, setPreparation] = useState<MeetingPreparation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    prepareMeetingData();
}, [meetingId, profession]);

  const prepareMeetingData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/google-meet/prepare/${meetingId}`, {
        headers: {
          'Authorization': `Bearer ${userId}`
      }
    });

      if (response.ok) {
        const data = await response.json();
        setPreparation(data.preparation);
    } else {
        // Generate mock preparation data for demo
        const mockPreparation = generateMockPreparation(meetingId, profession);
        setPreparation(mockPreparation);
    }
  } catch (error) {
      console.error('Error preparing meeting data: ', error);
      // Fallback to mock data
      const mockPreparation = generateMockPreparation(meetingId, profession);
      setPreparation(mockPreparation);
  } finally {
      setLoading(false);
  }
};

  const refreshPreparation = async () => {
    setRefreshing(true);
    await prepareMeetingData();
    setRefreshing(false);
};

  const openDocument = (document: PreparedDocument) => {
    window.open(document.url, '_blank');
  };

  const openContract = (contract: PreparedContract) => {
    window.open(contract.url, '_blank');
  };

  const getProfessionIcon = () => {
    switch (profession) {
      case 'photographer': return <PhotoIcon />;
      case 'videographer': return <VideoIcon />;
      case 'music_producer': return <MusicIcon />;
      case 'vendor': return <EquipmentIcon />;
      default: return <SmartIcon />;
}
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': case 'signed': case 'approved': case 'completed': return 'success';
      case 'pending': case 'draft': case 'in_progress': return 'warning';
      case 'missing': case 'needs_update': return 'error';
      default: return 'default';
}
};

  if (loading) {
    return (
      <MuiCard>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <SmartIcon />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Forbereder møtet...</Typography>
          </Box>
          <LinearProgress />
        </CardContent>
      </MuiCard>
    );
}

  if (!preparation) {
    return (
      <Alert severity="error">
        Kunne ikke forberede møtedata. Prøv igjen senere.
      </Alert>
    );
}

  if (compact) {
    return (
      <MuiCard sx={{ mb:  2 }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
              <Badge
                badgeContent={preparation.preparation_status === 'ready' ? '✓' : '!'}
                color={preparation.preparation_status === 'ready' ? 'success' : 'warning'}
              >
                <SmartIcon />
              </Badge>
              <Typography variant="subtitle1">
                Møteforberedelser
              </Typography>
            </Box>
            <Chip
              label={`${Math.round(preparation.completeness)}% klar`}
              color={preparation.completeness >= 90 ? 'success' : 'warning'}
              size="small"
            />
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={6} >
              <Typography variant="body2" color="text.secondary">
                Dokumenter: {preparation.documents.filter(d => d.status === 'ready').length}/{preparation.documents.length}
              </Typography>
            </Grid>
            <Grid item xs={6} >
              <Typography variant="body2" color="text.secondary">
                Kontrakter: {preparation.contracts.filter(c => c.status === 'signed').length}/{preparation.contracts.length}
              </Typography>
            </Grid>
          </Grid>

          {preparation.timeline && (
            <Box sx={{ mt:  2 }}>
              <Chip
                label={`Bryllupstidslinje: ${preparation.timeline.completedEvents}/${preparation.timeline.totalEvents} hendelser`}
                variant="outlined"
                size="small"
                icon={<TimelineIcon />}
              />
            </Box>
          )}
        </CardContent>
      </MuiCard>
    );
}

  return (
    <Box>
      <Paper elevation={2} sx={{ p:  3, mb:  3 ,  ...theming.getThemedCardSx() }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            {getProfessionIcon()}
            <Box>
              <Typography variant="h5" sx={{ color: theming.colors.primary }}>
                Smart Møteforberedelse
              </Typography>
              <Typography variant="subtitle2" color="text.secondary">
                {preparation.meetingTitle} - {preparation.clientName}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <Chip
              label={`${Math.round(preparation.completeness)}% fullført`}
              color={preparation.completeness >= 90 ? 'success' : 'warning'}
              icon={preparation.preparation_status === 'ready' ? <CheckIcon /> : <WarningIcon />}
            />
            <Tooltip title="Oppdater forberedelser">
              <IconButton onClick={refreshPreparation} disabled={refreshing}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {preparation.preparation_status === 'ready' ? (
          <Alert severity="success" sx={{ mb:  3 }}>
            Alle møteforberedelser er klare! Alle relevante dokumenter, kontrakter og notater er tilgjengelige.
          </Alert>
        ) : (
          <Alert severity="warning" sx={{ mb:  3 }}>
            Noen elementer mangler eller trenger oppdatering før møtet.
          </Alert>
        )}

        {/* Documents Section */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
              <DocumentIcon />
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                Dokumenter ({preparation.documents.filter(d => d.status === 'ready').length}/{preparation.documents.length})
              </Typography>
              <Chip
                size="small"
                label={preparation.documents.filter(d => d.status === 'ready').length === preparation.documents.length ? 'Komplett' : 'Ufullstendig'}
                color={preparation.documents.filter(d => d.status === 'ready').length === preparation.documents.length ? 'success' : 'warning'}
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <List>
              {preparation.documents.map(document => (
                <ListItem
                  key={document.id}
                  sx={{ backgroundColor: 'grey.5', borderRadius: 1, mb:  1 }}
                  secondaryAction={
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<LaunchIcon />}
                      onClick={() => openDocument(document)}
                    >
                      Åpne
                    </Button>
                }
                >
                  <ListItemIcon>
                    <DocumentIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={document.name}
                    secondary={
                      <Box>
                        <Typography variant="body2">
                          Type: {document.type} • Sist endret: {formatDate(document.lastModified)}
                        </Typography>
                        <Chip
                          size="small"
                          label={getStatusLabel(document.status)}
                          color={getStatusColor(document.status)}
                        />
                      </Box>
                  }
                  />
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>

        {/* Contracts Section */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
              <ContractIcon />
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                Kontrakter ({preparation.contracts.filter(c => c.status === 'signed').length}/{preparation.contracts.length})
              </Typography>
              <Chip
                size="small"
                label={preparation.contracts.filter(c => c.status === 'signed').length === preparation.contracts.length ? 'Signert' : 'Pending'}
                color={preparation.contracts.filter(c => c.status === 'signed').length === preparation.contracts.length ? 'success' : 'warning'}
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <List>
              {preparation.contracts.map(contract => (
                <ListItem
                  key={contract.id}
                  sx={{ backgroundColor: 'grey.5', borderRadius: 1, mb:  1 }}
                  secondaryAction={
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<LaunchIcon />}
                      onClick={() => openContract(contract)}
                    >
                      Se kontrakt
                    </Button>
                }
                >
                  <ListItemIcon>
                    <ContractIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={contract.name}
                    secondary={
                      <Box>
                        <Typography variant="body2">
                          Type: {contract.type}
                          {contract.signedDate && ` • Signert: ${formatDate(contract.signedDate)}`}
                        </Typography>
                        <Chip
                          size="small"
                          label={getStatusLabel(contract.status)}
                          color={getStatusColor(contract.status)}
                        />
                      </Box>
                  }
                  />
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>

        {/* Wedding Timeline Section (for photographers) */}
        {preparation.timeline && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <TimelineIcon />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Bryllupstidslinje ({preparation.timeline.completedEvents}/{preparation.timeline.totalEvents})
                </Typography>
                <Chip
                  size="small"
                  label={preparation.timeline.status}
                  color={getStatusColor(preparation.timeline.status)}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Arrangementsdato: {formatDate(preparation.timeline.eventDate)}
              </Typography>
              <List>
                {preparation.timeline.keyMoments.slice(0, 5).map(event => (
                  <ListItem key={event.id} sx={{ backgroundColor: 'grey.5', borderRadius: 1, mb:  1 }}>
                    <ListItemIcon>
                      <CheckIcon color={event.status === 'completed' ? 'success' : 'disabled'} />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${event.time} - ${event.title}`}
                      secondary={event.description}
                    />
                    <Chip
                      size="small"
                      label={event.status}
                      color={getStatusColor(event.status)}
                      variant="outlined"
                    />
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Notes Section */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
              <NotesIcon />
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                Notater og preferanser ({preparation.notes.length})
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <List>
              {preparation.notes.map(note => (
                <ListItem key={note.id} sx={{ backgroundColor: 'grey.5', borderRadius: 1, mb:  1 }}>
                  <ListItemText
                    primary={note.title}
                    secondary={
                      <Box>
                        <Typography variant="body2" sx={{ mb:  1 }}>
                          {note.content.substring(0, 100)}...
                        </Typography>
                        <Chip
                          size="small"
                          label={getCategoryLabel(note.category)}
                          variant="outlined"
                        />
                        <Typography variant="caption" sx={{ ml:  1 }}>
                          • Sist oppdatert: {formatDate(note.lastUpdated)}
                        </Typography>
                      </Box>
                  }
                  />
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>

        {/* Equipment Section (for vendors) */}
        {preparation.equipmentList && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <EquipmentIcon />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Utstyr ({preparation.equipmentList.filter(e => e.status === 'available').length} tilgjengelig)
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                {preparation.equipmentList.map(equipment => (
                  <ListItem key={equipment.id} sx={{ backgroundColor: 'grey.5', borderRadius: 1, mb:  1 }}>
                    <ListItemIcon>
                      <EquipmentIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={equipment.name}
                      secondary={equipment.category}
                    />
                    <Chip
                      size="small"
                      label={equipment.status}
                      color={getStatusColor(equipment.status)}
                    />
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        )}
      </Paper>
    </Box>
  );
}

// Helper functions
function generateMockPreparation(meetingId: string, profession: string): MeetingPreparation {
  const basePreparation = {
    meetingd,
    meetingTitle: `${getProfessionDisplayName(profession)} konsultasjon`,
    clientName: 'Kari og Ole Hansen',
    projectId: 'project_123',
    profession,
    preparation_status: 'ready' as const,
    completeness: 95 };

  if (profession === 'photographer') {
    return {
      ...basePreparation,
      documents: [
        {
          id: 'doc_',
          name: 'Bryllupsfotograferingskontrakt',
          type: 'contract',
          url: 'https://docs.google.com/document/d/abc12',
          lastModified: new Date().toISOString(),
          status: 'ready'
    },
        {
          id: 'doc_',
          name: 'Fotoshoot brief - Kari og Ole',
          type: 'google_doc',
          url: 'https://docs.google.com/document/d/def45',
          lastModified: new Date().toISOString(),
          status: 'ready'
    }
      ],
      contracts: [
        {
          id: 'contract_',
          name: 'Bryllupsfotografering - Hovedkontrakt',
          type: 'Bryllupsfotografering',
          status: 'signed',
          url: 'https://contracts.creatorhubn.com/contract_123',
          signedDate: '2025-08-01'
    }
      ],
      notes: [
        {
          id: 'note_',
          title: 'Klientpreferanser',
          content: 'Ønsker naturlig lys, utendørs fotografering, fokus på familiebilder',
          category: 'client_preferences',
          lastUpdated: new Date().toISOString()
    }
      ],
      timeline: {
        id: 'timeline_',
        eventDate: '2025-08-1',
        totalEvents:  12,
        completedEvents:  8,
        keyMoments: [
          {
            id: 'event_',
            time: '14:0',
            title: 'Vielsesseremoni',
            description: 'I kirken - 45 minutter',
            status: 'pending'
      },
          {
            id: 'event_',
            time: '15:3',
            title: 'Fotoshoot i parken',
            description: 'Naturlig lys fotografering',
            status: 'pending'
      }
        ],
        status: 'approved'
  },
      mediaFiles:  [],
      equipmentList: undefined
};
}

  return {
    ...basePreparation,
    documents:  [],
    contracts:  [],
    notes:  [],
    mediaFiles:  [],
    equipmentList: undefined
};
}

// getProfessionDisplayName is now provided by useDynamicProfessions hook

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('no-NO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
});
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'ready': return 'Klar';
    case 'signed': return 'Signert';
    case 'pending': return 'Venter';
    case 'draft': return 'Utkast';
    case 'approved': return 'Godkjent';
    case 'completed': return 'Fullført';
    case 'available': return 'Tilgjengelig';
    case 'booked': return 'Reservert';
    case 'maintenance': return 'Vedlikehold';
    case 'needs_update': return 'Trenger oppdatering';
    case 'missing': return 'Mangler';
    default: return status;
}
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case 'client_preferences': return 'Klientpreferanser';
    case 'project_details': return 'Prosjektdetaljer';
    case 'technical_notes': return 'Tekniske notater';
    case 'timeline_notes': return'Tidslinjenotater';
    default: return category;
}
}
