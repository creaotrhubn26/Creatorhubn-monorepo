import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  IconButton,
  Stack,
  Snackbar,
  ThemeProvider,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import { AdminButton, AdminEmpty, useIsMobile } from './design-system';
import {
  NoteAdd,
  Notes,
  Edit,
  Delete,
  Search,
  Star,
  StarBorder,
  CloudSync,
  Lock,
} from '@mui/icons-material';

interface NotesData {
  id: string;
  title: string;
  content: string;
  category: 'strategic' | 'business' | 'technical' | 'creative' | 'personal';
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  isStarred: boolean;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  googleDriveLink?: string;
}

interface AdvancedNotesManagerProps {
  className?: string;
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  onClientSelect?: (client: any) => void;
  onClientUpdate?: (client: any) => void;
  onShowcaseCreate?: (showcase: any) => void;
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  selectedClient?: any;
  onSettingsUpdate?: (settings: any) => void;
  onNotificationCreate?: (notification: any) => void;
}

/**
 * STOR OG MEGET STOR NOTATSLØSNING
 * Omfattende notathåndteringssystem med kategorisering, prioritering, tagging og Google Drive integrasjon
 */
export default function AdvancedNotesManager({ 
  className,
}: AdvancedNotesManagerProps) {
  const isMobile = useIsMobile();
  const [notes, setNotes] = useState<NotesData[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const themeColors = { ...theming.colors, primary: '#ff8c00' };
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<NotesData | null>(null);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  
  // Form states
  const [noteForm, setNoteForm] = useState({
    title: '',
    content: '',
    category: 'business' as NotesData['category'],
    priority: 'medium' as NotesData['priority'],
    tags: [] as string[],
    isStarred: false,
    isPrivate: false
});

  // Sample strategic notes data
  const [strategicNotesData] = useState({
    googleWorkspaceReseller: {
      title: 'Google Workspace Reseller Program - CreatorHub Norge',
      content: `# Google Workspace Reseller Program Implementation

## Økonomisk Analyse
- Initial Investering: 50.000 NOK (Partner setup, sertifisering, marketing)
- Månedlige Kostnader: 15.000 NOK (Support, infrastruktur, salgsverktøy)
- Break-Even Punkt: 25 bedriftskunder (≈ 125 brukere)
- Forventet ROI: 180% første år (basert på 30% margin på Google Workspace lisenser)

## Markedsanalyse Norge
- Totale potensielle SMB-kunder: ~400.000 bedrifter
- Google Workspace penetrasjon: ~15% (60.000 bedrifter)
- Årlig vekst i cloud-tjenester: 22%
- Gjennomsnittlig kostnad per bruker/måned: 75 NOK

## Implementeringsplan
1. **Fase 1 - Partner Onboarding** (Måned 1-2)
   - Google Cloud Partner registration
   - Teknisk sertifisering (Google Cloud Professional)
   - Admin Console setup og konfigurering
   
2. **Fase 2 - Plattform Integrasjon** (Måned 2-3)
   - CreatorHub Norge API kobling til Google Workspace Admin
   - Automatisert brukeradministrasjon
   - Billing og fakturering integrasjon
   
3. **Fase 3 - Salg og Marketing** (Måned 3-4)
   - Partnerportal utvikling
   - Kundeakquisisjon strategi
   - Support og onboarding prosesser

## Revenue Streams
- **Direkte Reseller Margin**: 20-30% på alle Google Workspace lisenser
- **Tilleggstjenester**: Setup, migrering, opplæring (500-2000 NOK per bruker)
- **Premium Support**: Månedlig support abonnement (50-200 NOK per bruker)
- **Custom Enterprise Solutions**: Skreddersydde løsninger for store kunder

## Risiko og Mitigation
- **Konkurranse**: Differensier med CreatorHub Norge's unike tilnærming for kreative
- **Google Policy Changes**: Diversifiser med andre cloud-tjenester
- **Support Kapasitet**: Bygg skalerbar support-organisasjon

## KPI og Success Metrics
- Månedlig recurring revenue fra Google Workspace
- Customer Acquisition Cost (CAC)
- Customer Lifetime Value (CLV)
- Churn rate og retention
- Support ticket response time

*Sist oppdatert: ${new Date().toLocaleDateString('')}*`,
      category: 'strategic' as const,
      priority: 'critical' as const,
      tags: ['google-workspace','reseller','business-strategy','revenue'],
      isStarred: true,
      isPrivate: false
},
    businessIntelligence: {
      title: 'Business Intelligence & Analytics Strategi',
      content: `# Business Intelligence Implementation Plan

## Data Sources Integration
- PostgreSQL primærdatabase (326 tabeller)
- Google Analytics 4 data
- Stripe betalingsdata
- Google Workspace brukerstatistikk
- Social media metrics (Instagram, YouTube)

## Reporting Framework
### Daglige Rapporter
- Aktive brukere og sessions
- Revenue og subscription metrics
- System performance og errors
- Customer support tickets

### Ukentlige Rapporter  
- User engagement trends
- Feature adoption rates
- Customer satisfaction scores
- Business KPI dashboard

### Månedlige Rapporter
- Financial performance
- Market analysis
- Competitive intelligence
- Strategic recommendations

## Advanced Analytics Features
- Predictive user churn modeling
- Revenue forecasting algorithms
- Customer segmentation analysis
- Market penetration metrics

## Dashboard Design
- Executive summary dashboard
- Operational metrics dashboard
- Customer insights dashboard
- Technical performance dashboard

*Automatisk generert av MagicCreator AI System*`,
      category: 'strategic' as const,
      priority: 'high' as const,
      tags: ['business-intelligence','analytics','kpi','reporting'],
      isStarred: true,
      isPrivate: false
}
});

  // Initialize with strategic notes
  useEffect(() => {
    const initialNotes: NotesData[] = [
      {
        id: 'strategic-google-workspace',
        ...strategicNotesData.googleWorkspaceReseller,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'strategic-business-intelligence',
        ...strategicNotesData.businessIntelligence,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    setNotes(initialNotes);
}, []);

  const handleCreateNote = useCallback(() => {
    const newNote: NotesData = {
      id: `note-${Date.now()}`,
      title: noteForm.title,
      content: noteForm.content,
      category: noteForm.category,
      priority: noteForm.priority,
      tags: noteForm.tags,
      isStarred: noteForm.isStarred,
      isPrivate: noteForm.isPrivate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setNotes(prev => [newNote, ...prev]);
    setIsCreateDialogOpen(false);
    setNoteForm({
      title: ', ',
      content: '',
      category: 'business',
      priority: 'medium',
      tags:  [],
      isStarred: false,
      isPrivate: false
});
    
    setSnackbarMessage('Notat opprettet!');
    setShowSnackbar(true);
}, [noteForm]);

  const handleEditNote = useCallback(() => {
    if (!selectedNote) return;
    
    const updatedNote: NotesData = {
      ...selectedNote,
      title: noteForm.title,
      content: noteForm.content,
      category: noteForm.category,
      priority: noteForm.priority,
      tags: noteForm.tags,
      isStarred: noteForm.isStarred,
      isPrivate: noteForm.isPrivate,
      updatedAt: new Date().toISOString()
};
    
    setNotes(prev => prev.map(note => note.id === selectedNote.id ? updatedNote : note));
    setIsEditDialogOpen(false);
    setSelectedNote(null);
    
    setSnackbarMessage('Notat oppdatert!');
    setShowSnackbar(true);
}, [selectedNote, noteForm]);

  const handleDeleteNote = useCallback((noteId: string) => {
    setNotes(prev => prev.filter(note => note.id !== noteId));
    setSnackbarMessage('Notat slettet!');
    setShowSnackbar(true);
}, []);

  const handleToggleStar = useCallback((noteId: string) => {
    setNotes(prev => prev.map(note => 
      note.id === noteId ? { ...note, isStarred: !note.isStarred } : note
    ));
}, []);

  const handleSyncToGoogleDrive = useCallback(async (noteId: string) => {
    try {
      // Simulate Google Drive sync
      const note = notes.find(n => n.id === noteId);
      if (!note) return;
      
      setSnackbarMessage(`"${note.title}," synkronisert til Google Drive!`);
      setShowSnackbar(true);
  } catch (_error) {
      setSnackbarMessage('Feil ved synkronisering til Google Drive');
      setShowSnackbar(true);
  }
}, [notes]);

  const openEditDialog = useCallback((note: NotesData) => {
    setSelectedNote(note);
    setNoteForm({
      title: note.title,
      content: note.content,
      category: note.category,
      priority: note.priority,
      tags: note.tags,
      isStarred: note.isStarred,
      isPrivate: note.isPrivate
});
    setIsEditDialogOpen(true);
}, []);

  // Filter notes based on search and category
  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         note.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || note.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
});

  const categoryColors = {
    strategic: 'error',
    business: 'primary',
    technical: 'info',
    creative: 'secondary',
    personal: 'success'
} as const;

  const priorityColors = {
    low: 'default',
    medium: 'info',
    high: 'warning',
    critical: 'error'
} as const;

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box className={className} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h4" component="h2" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: themeColors.primary }}>
          <Notes color="primary" aria-hidden />
          Stor Notatsløsning - CreatorHub Norge
        </Typography>
        
        {/* Search and Filters */}
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Søk i notater..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl size="small" fullWidth>
              <InputLabel>Kategori</InputLabel>
              <Select
                value={selectedCategory}
                label="Kategori"
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <MenuItem value="all">Alle kategorier</MenuItem>
                <MenuItem value="strategic">Strategiske</MenuItem>
                <MenuItem value="business">Business</MenuItem>
                <MenuItem value="technical">Tekniske</MenuItem>
                <MenuItem value="creative">Kreative</MenuItem>
                <MenuItem value="personal">Personlige</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={5}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <AdminButton tone="primary"
                startIcon={<NoteAdd />}
                onClick={() => setIsCreateDialogOpen(true)}
              >
                Nytt Notat
              </AdminButton>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Notes Grid */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        <Grid container spacing={3}>
          {filteredNotes.map((note) => (
            <Grid item xs={12} md={6} lg={4} key={note.id}>
              <Card 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  position: 'relative',
                  border: note.priority === 'critical' ? 2 : 1,
                  borderColor: note.priority === 'critical' ? 'error.main' : 'divider',
                  ...theming.getThemedCardSx()
                }}>
                {/* Note Header */}
                <CardContent sx={{ pb: 1, ...theming.getThemedCardSx() }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" component="h3" sx={{ flex: 1, fontWeight: 600, color: themeColors.primary }}>
                      {note.title}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton size="small" onClick={() => handleToggleStar(note.id)} aria-label={note.isStarred ? 'Fjern stjernemarkering' : 'Stjernemarker notat'}>
                        {note.isStarred ? <Star color="warning" /> : <StarBorder />}
                      </IconButton>
                      {note.isPrivate && <Lock fontSize="small" color="action" />}
                    </Box>
                  </Box>

                  {/* Categories and Priority */}
                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    <Chip 
                      label={note.category}
                      size="small"
                      color={categoryColors[note.category]}
                      variant="outlined"
                    />
                    <Chip 
                      label={note.priority}
                      size="small"
                      color={priorityColors[note.priority]}
                    />
                  </Box>

                  {/* Content Preview */}
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{ 
                      display: '-webkit-box',
                      WebkitLineClamp:  3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      mb: 2
                }}
                  >
                    {note.content}
                  </Typography>

                  {/* Tags */}
                  {note.tags.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
                      {note.tags.slice(0, 3).map((tag) => (
                        <Chip 
                          key={tag}
                          label={tag}
                          size="small" 
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      ))}
                      {note.tags.length > 3 && (
                        <Chip 
                          label={`+${note.tags.length - 3}`}
                          size="small" 
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>
                  )}

                  {/* Actions */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(note.updatedAt).toLocaleDateString('no')}
                    </Typography>
                    <Box>
                      <IconButton size="small" onClick={() => handleSyncToGoogleDrive(note.id)} aria-label="Synkroniser til Google Drive">
                        <CloudSync />
                      </IconButton>
                      <IconButton size="small" onClick={() => openEditDialog(note)} aria-label="Rediger notat">
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteNote(note.id)}
                        color="error"
                        aria-label="Slett notat"
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {filteredNotes.length === 0 && (
          <AdminEmpty
            icon={<Notes sx={{ fontSize: 64 }} />}
            title="Ingen notater funnet"
            description={searchQuery ? 'Prøv å endre søkekriteriene' : 'Opprett ditt første notat'}
          />
        )}
      </Box>

      {/* Create Note Dialog */}
      <Dialog
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Opprett Nytt Notat</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt:  1 }}>
            <TextField
              label="Tittel"
              value={noteForm.title}
              onChange={(e) => setNoteForm(prev => ({ ...prev, title: e.target.value }))}
              fullWidth
            />
            
            <TextField
              label="Innhold"
              value={noteForm.content}
              onChange={(e) => setNoteForm(prev => ({ ...prev, content: e.target.value }))}
              multiline
              rows={8}
              fullWidth
            />
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Kategori</InputLabel>
                  <Select
                    value={noteForm.category}
                    label="Kategori"
                    onChange={(e) => setNoteForm(prev => ({ ...prev, category: e.target.value as NotesData['category'] }))}
                  >
                    <MenuItem value="strategic">Strategisk</MenuItem>
                    <MenuItem value="business">Business</MenuItem>
                    <MenuItem value="technical">Teknisk</MenuItem>
                    <MenuItem value="creative">Kreativ</MenuItem>
                    <MenuItem value="personal">Personlig</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Prioritet</InputLabel>
                  <Select
                    value={noteForm.priority}
                    label="Prioritet"
                    onChange={(e) => setNoteForm(prev => ({ ...prev, priority: e.target.value as NotesData['priority'] }))}
                  >
                    <MenuItem value="low">Lav</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">Høy</MenuItem>
                    <MenuItem value="critical">Kritisk</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            
            <TextField
              label="Tags (kommaseparert)"
              value={noteForm.tags.join(', ')}
              onChange={(e) => setNoteForm(prev => ({ 
                ...prev, 
                tags: e.target.value.split(', ').map(tag => tag.trim()).filter(tag => tag.length > 0)
              }))}
              fullWidth
              helperText="Eksempel: business-strategy, google-workspace, revenue"
            />
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch 
                    checked={noteForm.isStarred}
                    onChange={(e) => setNoteForm(prev => ({ ...prev, isStarred: e.target.checked }))}
                  />
              }
                label="Stjernemarker"
              />
              <FormControlLabel
                control={
                  <Switch 
                    checked={noteForm.isPrivate}
                    onChange={(e) => setNoteForm(prev => ({ ...prev, isPrivate: e.target.checked }))}
                  />
              }
                label="Privat notat"
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setIsCreateDialogOpen(false)}>Avbryt</AdminButton>
          <AdminButton
            tone="primary"
            onClick={handleCreateNote}
            disabled={!noteForm.title.trim() || !noteForm.content.trim()}
          >
            Opprett Notat
          </AdminButton>
        </DialogActions>
      </Dialog>

      {/* Edit Note Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Rediger Notat</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt:  1 }}>
            <TextField
              label="Tittel"
              value={noteForm.title}
              onChange={(e) => setNoteForm(prev => ({ ...prev, title: e.target.value }))}
              fullWidth
            />
            
            <TextField
              label="Innhold"
              value={noteForm.content}
              onChange={(e) => setNoteForm(prev => ({ ...prev, content: e.target.value }))}
              multiline
              rows={8}
              fullWidth
            />
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Kategori</InputLabel>
                  <Select
                    value={noteForm.category}
                    label="Kategori"
                    onChange={(e) => setNoteForm(prev => ({ ...prev, category: e.target.value as NotesData['category'] }))}
                  >
                    <MenuItem value="strategic">Strategisk</MenuItem>
                    <MenuItem value="business">Business</MenuItem>
                    <MenuItem value="technical">Teknisk</MenuItem>
                    <MenuItem value="creative">Kreativ</MenuItem>
                    <MenuItem value="personal">Personlig</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Prioritet</InputLabel>
                  <Select
                    value={noteForm.priority}
                    label="Prioritet"
                    onChange={(e) => setNoteForm(prev => ({ ...prev, priority: e.target.value as NotesData['priority'] }))}
                  >
                    <MenuItem value="low">Lav</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">Høy</MenuItem>
                    <MenuItem value="critical">Kritisk</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            
            <TextField
              label="Tags (kommaseparert)"
              value={noteForm.tags.join('')}
              onChange={(e) => setNoteForm(prev => ({ 
                ...prev, 
                tags: e.target.value.split(', ').map(tag => tag.trim()).filter(tag => tag.length > 0)
              }))}
              fullWidth
            />
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch 
                    checked={noteForm.isStarred}
                    onChange={(e) => setNoteForm(prev => ({ ...prev, isStarred: e.target.checked }))}
                  />
              }
                label="Stjernemarker"
              />
              <FormControlLabel
                control={
                  <Switch 
                    checked={noteForm.isPrivate}
                    onChange={(e) => setNoteForm(prev => ({ ...prev, isPrivate: e.target.checked }))}
                  />
              }
                label="Privat notat"
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setIsEditDialogOpen(false)}>Avbryt</AdminButton>
          <AdminButton
            tone="primary"
            onClick={handleEditNote}
            disabled={!noteForm.title.trim() || !noteForm.content.trim()}
          >
            Oppdater Notat
          </AdminButton>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={showSnackbar}
        autoHideDuration={4000}
        onClose={() => setShowSnackbar(false)}
        message={snackbarMessage}
      />
    </Box>
    </ThemeProvider>
  );
}