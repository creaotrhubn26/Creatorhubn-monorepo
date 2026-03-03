import { useTheming } from '../../utils/theming-helper';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Grid from '@mui/material/Grid2';
import { apiRequest } from '@/lib/queryClient';
import {
  Alert,
  Box,
  Typography,
  Card as MuiCard,
  CardContent,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Chip,
  IconButton,
  Menu,
  MenuList,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Assessment,
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart,
  Timeline,
  Download,
  Refresh,
  DateRange,
  Business,
  Person,
  CameraAlt,
  Videocam,
  MusicNote,
  Store,
  FileDownload,
  PictureAsPdf,
  TableChart,
} from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`reports-tabpanel-${index}`}
      aria-labelledby={`reports-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py:  3 }}>{children}</Box>}
    </div>
  );
}

interface ReportsPanelProps {
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
  onNotificationCreate?: (notification: any) => void
}

interface OverviewData {
  totalRevenue: number;
  totalProjects: number;
  totalUsers: number;
  averageProjectValue: number;
  growthRate: number;
  topProfession: string;
}

interface ProfessionStat {
  profession: string;
  users: number;
  projects: number;
  revenue: number;
  growthRate: number;
}

interface MonthlyStat {
  month: string;
  revenue: number;
  projects: number;
  users: number;
}

interface ReportsResponse {
  overview?: OverviewData;
  monthlyData?: MonthlyStat[];
}

interface BiResponse {
  professionStats?: ProfessionStat[];
}

export default function ReportsPanel({
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  onClientSelect,
  onClientUpdate,
  onShowcaseCreate,
  onFileUpload,
  onFileDownload,
  selectedProject,
  onProjectSelect,
  selectedClient,
  onSettingsUpdate,
  onNotificationCreate
}: ReportsPanelProps) {
  const [tabValue, setTabValue] = useState(0);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();
  const [timeRange, setTimeRange] = useState('30d');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Fetch real reports data
  const { data: reportsData, isLoading } = useQuery<ReportsResponse>({
    queryKey: ['/api/admin/reports', timeRange],
    queryFn: () => apiRequest(`/api/admin/reports?range=${timeRange}`) as Promise<ReportsResponse>,
    retry:  1,
});

  // Fetch business intelligence data
  const { data: biData } = useQuery<BiResponse>({
    queryKey: ['/api/admin/business-intelligence', timeRange],
    queryFn: () => apiRequest(`/api/admin/business-intelligence?range=${timeRange}`) as Promise<BiResponse>,
    retry:  1,
});

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleExportClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
};

  const handleExportClose = () => {
    setAnchorEl(null);
};

  if (isLoading) {
    return (
      <Box sx={{ p:  3 }}>
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>Laster rapporter...</Typography>
      </Box>
    );
}

  // Use real data or fallback to basic structure
  const overview = reportsData?.overview || {
    totalRevenue:  0,
    totalProjects:  0,
    totalUsers:  1,
    averageProjectValue:  0,
    growthRate:  0,
    topProfession: 'admin'
};

  const professionStats: ProfessionStat[] = biData?.professionStats || [
    { profession: 'photographer', users: 0, projects: 0, revenue: 0, growthRate: 0 },
    { profession: 'videographer', users: 0, projects: 0, revenue: 0, growthRate: 0 },
    { profession: 'musicproducer', users: 0, projects: 0, revenue: 0, growthRate: 0 },
    { profession: 'vendor', users: 0, projects: 0, revenue: 0, growthRate: 0 },
    { profession: 'admin', users: 1, projects: 0, revenue: 0, growthRate: 0 }
  ];

  const monthlyData: MonthlyStat[] = reportsData?.monthlyData || [
    { month: 'Jan 2025', revenue: 0, projects: 0, users:  1 },
    { month: 'Des 2024', revenue: 0, projects: 0, users:  0 },
    { month: 'Nov 2024', revenue: 0, projects: 0, users:  0 }
  ];

  const getProfessionIcon = (profession: string) => {
    switch (profession) {
      case 'photographer': return <CameraAlt />;
      case 'videographer': return <Videocam />;
      case 'musicproducer': return <MusicNote />;
      case 'vendor': return <Store />;
      default: return <Business />;
  }
};

  const getProfessionLabel = (profession: string) => {
    if (profession === 'admin') return 'Administrator';
    return getProfessionDisplayName(profession);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
          <Assessment color="primary" sx={{ fontSize: 32}} />
          <Typography variant="h5" sx={{  fontWeight: 600}}>
            Rapporter & Analytics
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
          <FormControl size="small" sx={{ minWidth: 120}}>
            <InputLabel>Periode</InputLabel>
            <Select
              value={timeRange}
              label="Periode"
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <MenuItem value="7d">7 dager</MenuItem>
              <MenuItem value="30d">30 dager</MenuItem>
              <MenuItem value="90d">3 måneder</MenuItem>
              <MenuItem value="1y">1 år</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={theming.getThemedIcon('download')}
            onClick={handleExportClick}
          >
            Eksporter
          </Button>
        </Box>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb:  4 }}>
        <Grid size={12}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <TrendingUp color="success" />
                <Box>
                  <Typography variant="h4" sx={{  fontWeight: 600}}>
                    {overview.totalRevenue.toLocaleString('no-NO')} kr
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Omsetning
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    {overview.growthRate >= 0 ? (
                      <TrendingUp color="success" fontSize="small" />
                    ) : (
                      <TrendingDown color="error" fontSize="small" />
                    )}
                    <Typography variant="caption" color={overview.growthRate >= 0 ? 'success.main' : 'error.main'}>
                      {overview.growthRate}% fra forrige periode
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid size={12}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <Business color="primary" />
                <Box>
                  <Typography variant="h4" sx={{  fontWeight: 600}}>
                    {overview.totalProjects}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Totale Prosjekter
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid size={12}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <Person color="info" />
                <Box>
                  <Typography variant="h4" sx={{  fontWeight: 600}}>
                    {overview.totalUsers}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Registrerte Brukere
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid size={12}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <BarChart color="warning" />
                <Box>
                  <Typography variant="h4" sx={{  fontWeight: 600}}>
                    {overview.averageProjectValue.toLocaleString('no-NO')} kr
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Gj.snitt Prosjektverdi
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>
      </Grid>

      {/* Tabs */}
      <MuiCard>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue}
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root': {
                color: 'text.secondary',
                '&.Mui-selected': {
                  color: '#ff8c00',
                  fontWeight: 600
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#ff8c00'
              }
            }}
          >
            <Tab icon={<PieChart />} label="Profesjoner" />
            <Tab icon={<Timeline />} label="Trender" />
            <Tab icon={<BarChart />} label="Ytelse" />
          </Tabs>
        </Box>

        <CardContent sx={theming.getThemedCardSx()}>
          <TabPanel value={tabValue} index={0}>
            <Typography variant="h6" sx={{  mb:  3  }}>
              Profesjonsfordeling og ytelse
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Profesjon</strong></TableCell>
                    <TableCell><strong>Brukere</strong></TableCell>
                    <TableCell><strong>Prosjekter</strong></TableCell>
                    <TableCell><strong>Omsetning</strong></TableCell>
                    <TableCell><strong>Vekst</strong></TableCell>
                    <TableCell><strong>Markedsandel</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {professionStats.map((stat, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                          {getProfessionIcon(stat.profession)}
                          {getProfessionLabel(stat.profession)}
                        </Box>
                      </TableCell>
                      <TableCell>{stat.users}</TableCell>
                      <TableCell>{stat.projects}</TableCell>
                      <TableCell>{stat.revenue.toLocaleString('no-NO')} kr</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                          {stat.growthRate >= 0 ? (
                            <TrendingUp color="success" fontSize="small" />
                          ) : (
                            <TrendingDown color="error" fontSize="small" />
                          )}
                          <Typography variant="body2" color={stat.growthRate >= 0 ? 'success.main' : 'error.main'}>
                            {stat.growthRate}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={(stat.users / overview.totalUsers) * 100}
                            sx={{ flexGrow:  1 }}
                          />
                          <Typography variant="caption">
                            {Math.round((stat.users / overview.totalUsers) * 100)}%
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Typography variant="h6" sx={{  mb:  3  }}>
              Månedlige trender
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Måned</strong></TableCell>
                    <TableCell><strong>Omsetning</strong></TableCell>
                    <TableCell><strong>Nye Prosjekter</strong></TableCell>
                    <TableCell><strong>Nye Brukere</strong></TableCell>
                    <TableCell><strong>Trend</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {monthlyData.map((data, index) => (
                    <TableRow key={index}>
                      <TableCell>{data.month}</TableCell>
                      <TableCell>{data.revenue.toLocaleString('no-NO')} kr</TableCell>
                      <TableCell>{data.projects}</TableCell>
                      <TableCell>{data.users}</TableCell>
                      <TableCell>
                        <Chip 
                          label={index === 0 ? 'Nåværende' : 'Historisk'}
                          color={index === 0 ? 'primary' : 'default'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Grid container spacing={3}>
              {/* KPI Cards */}
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.50' }}>
                  <Typography variant="overline" color="text.secondary">Konverteringsrate</Typography>
                  <Typography variant="h4" color="success.main">24.8%</Typography>
                  <Typography variant="caption" color="success.main">+3.2% fra forrige måned</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.50' }}>
                  <Typography variant="overline" color="text.secondary">Gjennomsnittlig ordrestørrelse</Typography>
                  <Typography variant="h4" color="info.main">12,450 kr</Typography>
                  <Typography variant="caption" color="info.main">+8% fra forrige måned</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.50' }}>
                  <Typography variant="overline" color="text.secondary">Kundetilfredshet</Typography>
                  <Typography variant="h4" color="warning.main">4.7/5</Typography>
                  <Typography variant="caption" color="warning.main">Basert på 156 vurderinger</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.50' }}>
                  <Typography variant="overline" color="text.secondary">Gjentakende kunder</Typography>
                  <Typography variant="h4" color="primary.main">67%</Typography>
                  <Typography variant="caption" color="primary.main">+5% fra forrige kvartal</Typography>
                </Paper>
              </Grid>

              {/* Benchmarking */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Ytelse vs. bransjegjennomsnitt
                  </Typography>
                  {[
                    { label: 'Responstid', your: 85, avg: 70 },
                    { label: 'Prosjektfullføring', your: 92, avg: 78 },
                    { label: 'Kundelojalitet', your: 78, avg: 65 },
                    { label: 'Priskonkurranseevne', your: 72, avg: 60 },
                  ].map((metric) => (
                    <Box key={metric.label} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">{metric.label}</Typography>
                        <Typography variant="body2" fontWeight="bold">{metric.your}%</Typography>
                      </Box>
                      <Box sx={{ position: 'relative', height: 8, bgcolor: 'grey.200', borderRadius: 1 }}>
                        <Box sx={{ 
                          position: 'absolute', 
                          height: '100%', 
                          width: `${metric.your}%`, 
                          bgcolor: 'primary.main',
                          borderRadius: 1,
                        }} />
                        <Box sx={{ 
                          position: 'absolute', 
                          height: '100%', 
                          width: 2, 
                          left: `${metric.avg}%`, 
                          bgcolor: 'error.main',
                        }} />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        Bransjegjennomsnitt: {metric.avg}%
                      </Typography>
                    </Box>
                  ))}
                </Paper>
              </Grid>

              {/* Performance Trends */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Ytelsestrender (siste 6 måneder)
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Metrikk</TableCell>
                          <TableCell align="right">Jan</TableCell>
                          <TableCell align="right">Feb</TableCell>
                          <TableCell align="right">Mar</TableCell>
                          <TableCell align="right">Apr</TableCell>
                          <TableCell align="right">Mai</TableCell>
                          <TableCell align="right">Jun</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell>Omsetning (k)</TableCell>
                          <TableCell align="right">45</TableCell>
                          <TableCell align="right">52</TableCell>
                          <TableCell align="right">48</TableCell>
                          <TableCell align="right">61</TableCell>
                          <TableCell align="right">58</TableCell>
                          <TableCell align="right">72</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Prosjekter</TableCell>
                          <TableCell align="right">12</TableCell>
                          <TableCell align="right">15</TableCell>
                          <TableCell align="right">14</TableCell>
                          <TableCell align="right">18</TableCell>
                          <TableCell align="right">16</TableCell>
                          <TableCell align="right">21</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Nye kunder</TableCell>
                          <TableCell align="right">8</TableCell>
                          <TableCell align="right">11</TableCell>
                          <TableCell align="right">9</TableCell>
                          <TableCell align="right">14</TableCell>
                          <TableCell align="right">12</TableCell>
                          <TableCell align="right">17</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>

              {/* Action Recommendations */}
              <Grid size={{ xs: 12 }}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Anbefalte tiltak basert på analyse
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Alert severity="success" sx={{ height: '100%' }}>
                        <Typography variant="body2" fontWeight="bold">Øk priser med 5-10%</Typography>
                        <Typography variant="caption">
                          Din kundetilfredshet er høy nok til å tåle en prisøkning uten kundetap.
                        </Typography>
                      </Alert>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Alert severity="info" sx={{ height: '100%' }}>
                        <Typography variant="body2" fontWeight="bold">Fokuser på gjentakende kunder</Typography>
                        <Typography variant="caption">
                          67% gjentakelsesrate er bra - tilby lojalitetsprogram for å nå 75%+.
                        </Typography>
                      </Alert>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Alert severity="warning" sx={{ height: '100%' }}>
                        <Typography variant="body2" fontWeight="bold">Forbedre responstid</Typography>
                        <Typography variant="caption">
                          Raskere respons på henvendelser kan øke konverteringsraten med 10%+.
                        </Typography>
                      </Alert>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          </TabPanel>
        </CardContent>
      </MuiCard>

      {/* Export Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleExportClose}
      >
        <MenuList>
          <MenuItem onClick={handleExportClose}>
            <ListItemIcon>
              <PictureAsPdf fontSize="small" />
            </ListItemIcon>
            <ListItemText>PDF Rapport</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleExportClose}>
            <ListItemIcon>
              <TableChart fontSize="small" />
            </ListItemIcon>
            <ListItemText>Excel Fil</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleExportClose}>
            <ListItemIcon>
              <FileDownload fontSize="small" />
            </ListItemIcon>
            <ListItemText>CSV Data</ListItemText>
          </MenuItem>
        </MenuList>
      </Menu>
    </Box>
  );
}
