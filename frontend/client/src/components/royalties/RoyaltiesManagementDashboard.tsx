import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card as MuiCard,
  CardContent,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
  Tabs,
  Tab,
  LinearProgress,
  Divider,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
} from '@mui/material';
import {
  AccountBalance,
  TrendingUp,
  AddCircle as Add,
  Edit,
  Download,
  MusicNote,
  AttachMoney,
  Analytics,
  CalendarToday as CalendarTodayToday,
  Payment,
  Receipt,
  Gavel,
  Business as DirectionsBusiness,
  Info,
  InfoOutlined,
  Close,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`royalties-tabpanel-${index}`}
      aria-labelledby={`royalties-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
  );
}

export default function RoyaltiesManagementDashboard() {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  const [tabValue, setTabValue] = useState(0);
  const [showAddRoyaltyDialog, setShowAddRoyaltyDialog] = useState(false);
  const [showTonoGramoInfoDialog, setShowTonoGramoInfoDialog] = useState(false);
  const [newRoyalty, setNewRoyalty] = useState({
    songTitle: ',',
    artistName: '',
    amount: '',
    source: 'TON',
    period: '',
    paymentDate: '',
});

  // Fetch royalties data
  const { data: royaltiesData = [], isLoading } = useQuery({
    queryKey: ['/api/royalties', ],
    queryFn: () => apiRequest('/api/royalties', ),
    retry: false,
});

  // Fetch TONO/GRAMO integration status
  const { data: integrationStatus } = useQuery({
    queryKey: ['/api/royalties/integration-status', ],
    queryFn: () => apiRequest('/api/royalties/integration-status', ),
    retry: false,
});

  // Fetch royalties summary
  const { data: royaltiesSummary } = useQuery({
    queryKey: ['/api/royalties/summary', ],
    queryFn: () => apiRequest('/api/royalties/summary', ),
    retry: false,
});

  // Add new royalty mutation
  const addRoyaltyMutation = useMutation({
    mutationFn: async (royalty: any) =>
      apiRequest('/api/royalties', {
        method: 'POS',
        body: JSON.stringify(royalty),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/royalties', ],});
      setShowAddRoyaltyDialog(false);
      setNewRoyalty({
        songTitle: ', ',
        artistName: ', ',
        amount: ', ',
        source: 'TON',
        period: ', ',
        paymentDate: ', ',
    });
  },
});

  const handleAddRoyalty = () => {
    addRoyaltyMutation.mutate(newRoyalty);
};

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('no-N', {
      style: 'currency',
      currency: 'NO' }).format(amount);
};

  return (
    <Box sx={{ p:  2 }}>
      {/* Header */}
      <MuiCard
        sx={{
          mb:  3,
          background: 'linear-gradient(135deg, #1db954 0%, #1ed760 100%)',
          color: 'white' }}
      >
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <AccountBalance sx={{ fontSize: 48}} />
            <Box sx={{ flex:  1 }}>
              <Typography variant="h4" sx={{  fontWeight: 600, mb:  1  }}>
                Royalties Management
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9}}>
                Administrer royalties fra TONO, GRAMO, Spotify og andre kilder
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap:  1 }}>
              <Button
                variant="outlined"
                startIcon={<InfoOutlined />}
                onClick={() => setShowTonoGramoInfoDialog(true)}
                sx={{
                  borderColor: 'rgba(25,255,255,0.5)',
                  color: 'white', '&:hover': {
                    borderColor: 'white',
                    bgcolor: 'rgba(25,255,255,0.1)' }}}
              >
                TONO/GRAMO Info
              </Button>
              <Button
                variant="outlined"
                startIcon={theming.getThemedIcon('add')}
                onClick={() => setShowAddRoyaltyDialog(true)}
                sx={{
                  borderColor: 'rgba(25,255,255,0.5)',
                  color: 'white','&:hover': {
                    borderColor: 'white',
                    bgcolor: 'rgba(25,255,255,0.1)' }}}
              >
                Legg til Royalty
              </Button>
            </Box>
          </Box>
        </CardContent>
      </MuiCard>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb:  3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MuiCard sx={{ height: '100%' }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <Avatar sx={{ bgcolor: '#1db950', width:  56, height: 56}}>
                  {theming.getThemedIcon('money')}
                </Avatar>
                <Box>
                  <Typography variant="h4" sx={{  fontWeight: 600, color: '#1db954'  }}>
                    {formatCurrency(royaltiesSummary?.totalEarnings || 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Totale Inntekter
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MuiCard sx={{ height: '100%' }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <Avatar sx={{ bgcolor: '#9b59b0', width:  56, height: 56}}>
                  {theming.getThemedIcon('calendar')}
                </Avatar>
                <Box>
                  <Typography variant="h4" sx={{  fontWeight: 600, color: '#9b59b6'  }}>
                    {formatCurrency(royaltiesSummary?.thisMonth || 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Denne Måneden
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MuiCard sx={{ height: '100%' }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <Avatar sx={{ bgcolor: '#e74c30', width:  56, height: 56}}>
                  <MusicNote />
                </Avatar>
                <Box>
                  <Typography variant="h4" sx={{  fontWeight: 600, color: '#e74c3c'  }}>
                    {royaltiesSummary?.activeTracks || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Aktive Spor
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MuiCard sx={{ height: '100%' }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <Avatar sx={{ bgcolor: '#f39c10', width:  56, height: 56}}>
                  {theming.getThemedIcon('trendingUp')}
                </Avatar>
                <Box>
                  <Typography variant="h4" sx={{  fontWeight: 600, color: '#f39c12'  }}>
                    +{royaltiesSummary?.growthPercentage || 0}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Vekst vs. forrige måned
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>
      </Grid>

      {/* Integration Status */}
      <MuiCard sx={{ mb:  3 }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
            {theming.getThemedIcon('business')}
            Integrasjons Status
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <Avatar
                  sx={{
                    bgcolor: integrationStatus?.tono ? '#4caf50' : '#f44330' }}
                >
                  <Gavel />
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600}>
                    TONO
                  </Typography>
                  <Chip
                    label={integrationStatus?.tono ? 'Tilkoblet' : 'Ikke tilkoblet'}
                    color={integrationStatus?.tono ? 'success' : 'error'}
                    size="small"
                  />
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <Avatar
                  sx={{
                    bgcolor: integrationStatus?.gramo ? '#4caf50' : '#f44330' }}
                >
                  <Receipt />
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600}>
                    GRAMO
                  </Typography>
                  <Chip
                    label={integrationStatus?.gramo ? 'Tilkoblet' : 'Ikke tilkoblet'}
                    color={integrationStatus?.gramo ? 'success' : 'error'}
                    size="small"
                  />
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <Avatar
                  sx={{
                    bgcolor: integrationStatus?.spotify ? '#4caf50' : '#f44330' }}
                >
                  <MusicNote />
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600}>
                    Spotify
                  </Typography>
                  <Chip
                    label={integrationStatus?.spotify ? 'Tilkoblet' : 'Ikke tilkoblet'}
                    color={integrationStatus?.spotify ? 'success' : 'error'}
                    size="small"
                  />
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </MuiCard>

      {/* Tabs */}
      <MuiCard sx={{ mb:  3 }}>
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 60
              fontSize: '1rem' }, '& .Mui-selected': {
              color: '#1db950' }, '& .MuiTabs-indicator': {
              backgroundColor: '#1db950' }}}
        >
          <Tab icon={theming.getThemedIcon('payment')}} label="Royalty Oversikt" />
          <Tab icon={theming.getThemedIcon('analytics')}} label="Analytikk" />
          <Tab icon={<Receipt />} label="Rapporter" />
          <Tab icon={theming.getThemedIcon('business')}} label="Innstillinger" />
        </Tabs>
      </MuiCard>

      {/* Tab Content */}
      <TabPanel value={tabValue} index={0}>
        <Typography variant="h6" sx={{  mb: 2, color: '#1db950', fontWeight: 600}}>
          💰 Royalty Oversikt
        </Typography>

        {isLoading ? (
          <LinearProgress sx={{ mb:  2 }} />
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Sang</TableCell>
                  <TableCell>Artist</TableCell>
                  <TableCell>Kilde</TableCell>
                  <TableCell>Periode</TableCell>
                  <TableCell align="right">Beløp</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Handlinger</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {royaltiesData.map((royalty: any) => (
                  <TableRow key={royalty.d}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                        <MusicNote sx={{ color: '#1db954' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 600}>
                          {royalty.songTitle}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{royalty.artistName}</TableCell>
                    <TableCell>
                      <Chip
                        label={royalty.source}
                        color={
                          royalty.source === 'TONO'
                            ? 'primary'
                            : royalty.source === 'GRAMO'
                              ? 'secondary'
                              : 'default'
                      }
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{royalty.period}</TableCell>
                    <TableCell align="right">
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1db954' }}>
                        {formatCurrency(royalty.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={royalty.status}
                        color={royalty.status === 'Betalt' ? 'success' : 'warning'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" color="primary">
                        {theming.getThemedIcon('edit')}
                      </IconButton>
                      <IconButton size="small" color="primary">
                        {theming.getThemedIcon('download')}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Typography variant="h6" sx={{  mb: 2, color: '#1db950', fontWeight: 600}}>
          📊 Royalty Analytikk
        </Typography>
        <Alert severity="info" sx={{ mb:  2 }}>
          Detaljert analytikk for royalty-trender, kildefordeling og prediksjon kommer snart.
        </Alert>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Typography variant="h6" sx={{  mb: 2, color: '#1db950', fontWeight: 600}}>
          📄 Royalty Rapporter
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <MuiCard>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" sx={{  mb:  2  }}>
                  Månedlig Rapport
                </Typography>
                <Button variant="outlined" startIcon={theming.getThemedIcon('download')} fullWidth>
                  Last ned PDF
                </Button>
              </CardContent>
            </MuiCard>
          </Grid>
          <Grid item xs={12} md={6}>
            <MuiCard>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" sx={{  mb:  2  }}>
                  Årlig Skatterapport
                </Typography>
                <Button variant="outlined" startIcon={theming.getThemedIcon('download')} fullWidth>
                  Last ned Excel
                </Button>
              </CardContent>
            </MuiCard>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Typography variant="h6" sx={{  mb: 2, color: '#1db950', fontWeight: 600}}>
          ⚙️ Royalty Innstillinger
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <MuiCard>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" sx={{  mb:  2  }}>
                  TONO Integrasjon
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                  Koble til din TONO-konto for automatisk synkronisering
                </Typography>
                <Button variant="contained" sx={{ bgcolor: '#1db954' ,  ...theming.getThemedButtonSx() }}>
                  Koble til TONO
                </Button>
              </CardContent>
            </MuiCard>
          </Grid>
          <Grid item xs={12} md={6}>
            <MuiCard>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" sx={{  mb:  2  }}>
                  GRAMO Integrasjon
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                  Koble til din GRAMO-konto for automatisk synkronisering
                </Typography>
                <Button variant="contained" sx={{ bgcolor: '#9b59b6' ,  ...theming.getThemedButtonSx() }}>
                  Koble til GRAMO
                </Button>
              </CardContent>
            </MuiCard>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Add Royalty Dialog */}
      <Dialog
        open={showAddRoyaltyDialog}
        onClose={() => setShowAddRoyaltyDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <Add sx={{ color: '#1db954' }} />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Legg til Royalty</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap:  3 }}>
            <TextField
              fullWidth
              label="Sangtittel"
              value={newRoyalty.songTitle}
              onChange={(e) => setNewRoyalty({ ...newRoyalty, songTitle: e.target.value })}
            />

            <TextField
              fullWidth
              label="Artist"
              value={newRoyalty.artistName}
              onChange={(e) => setNewRoyalty({ ...newRoyalty, artistName: e.target.value })}
            />

            <TextField
              fullWidth
              label="Beløp (NOK)"
              type="number"
              value={newRoyalty.amount}
              onChange={(e) => setNewRoyalty({ ...newRoyalty, amount: e.target.value })}
            />

            <FormControl fullWidth>
              <InputLabel>Kilde</InputLabel>
              <Select
                value={newRoyalty.source}
                onChange={(e) => setNewRoyalty({ ...newRoyalty, source: e.target.value })}
                label="Kilde"
              >
                <MenuItem value="TONO">TONO</MenuItem>
                <MenuItem value="GRAMO">GRAMO</MenuItem>
                <MenuItem value="Spotify">Spotify</MenuItem>
                <MenuItem value="Apple Music">Apple Music</MenuItem>
                <MenuItem value="YouTube">YouTube</MenuItem>
                <MenuItem value="Annet">Annet</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Periode"
              value={newRoyalty.period}
              onChange={(e) => setNewRoyalty({ ...newRoyalty, period: e.target.value })}
              placeholder="f.eks. Q1 2025"
            />

            <TextField
              fullWidth
              label="Betalingsdato"
              type="date"
              value={newRoyalty.paymentDate}
              onChange={(e) => setNewRoyalty({ ...newRoyalty, paymentDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />

            <Box
              sx={{
                display: 'flex',
                gap:  2,
                justifyContent: 'flex-end',
                mt:  3}}
            >
              <Button onClick={() => setShowAddRoyaltyDialog(false)}>Avbryt</Button>
              <Button variant="contained"
                onClick={handleAddRoyalty}
                disabled={addRoyaltyMutation.isPending}
                sx={{ bgcolor: '#1db950', '&:hover': { bgcolor: '#1ed760' } }}
               sx={theming.getThemedButtonSx()}>
                Legg til
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      {/* TONO/GRAMO Information Dialog */}
      <Dialog
        open={showTonoGramoInfoDialog}
        onClose={() => setShowTonoGramoInfoDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: '#1db950',
            color: 'white',
            pb:  2}}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <InfoOutlined />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>TONO/GRAMO Integrasjon</Typography>
          </Box>
          <IconButton onClick={() => setShowTonoGramoInfoDialog(false)} sx={{ color: 'white' }}>
            {theming.getThemedIcon('close')}
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p:  3 }}>
          <Alert
            severity="info"
            sx={{
              mb: 3'& .MuiAlert-icon': { color: '#1db950' }}}
          >
            <Typography variant="body1" sx={{ lineHeight: 1.8}}>
              Per nå har vi ikke direkte integrasjon opp mot TONO og GRAMO, men vi jobber alltid med
              å forbedre løsningene på CreatorHub Norge. Vi vet at denne delen av prosessen som
              music produsent er viktig. For at vi skal få til dette er vi avhengig av at både TONO
              og GRAMO ønsker å samarbeide med oss. Dersom vi får den muligheten vil vi oppdatere
              våre tjenester og tilby løsninger som gjør musikk produsentenes hverdag enklere.
            </Typography>
          </Alert>

          <Box sx={{ textAlign: 'center', mt:  2 }}>
            <Typography
              variant="body2"
              sx={{
                fontStyle: 'italic',
                color: 'text.secondary',
                mb:  2}}
            >
              Takk for forståelsen.
            </Typography>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 60
               , color: '#1db950' }}
            >
              CreatorHub Norge
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mt:  3,
              pt:  2,
              borderTop: '1px solid #e0e0e0' }}
          >
            <Button variant="contained"
              onClick={() => setShowTonoGramoInfoDialog(false)}
              sx={{
                bgcolor: '#1db950','&:hover': { bgcolor: '#1ed760' },
                px:  4}}
            >
              Forstått
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
