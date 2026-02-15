import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  Stack,
  Card,
  CardContent,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Rating,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Assessment as ReportIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Schedule as TimeIcon,
  Videocam as CameraIcon,
  Movie as MovieIcon,
  People as PeopleIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  TrendingDown as TrendingDownIcon,
  AttachMoney as BudgetIcon,
  WbSunny as WeatherIcon,
  Note as NoteIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { TrendingIcon as TrendingUpIcon } from './icons/CastingIcons';
import { ProductionDay, SceneBreakdown } from '../models/casting';

interface WrapReportData {
  id: string;
  date: string;
  dayNumber: number;
  projectName: string;
  director: string;
  producer: string;
  firstAD: string;
  
  // Timing
  callTime: string;
  firstShotTime: string;
  lunchStart: string;
  lunchEnd: string;
  lastShotTime: string;
  wrapTime: string;
  plannedWrapTime: string;
  totalShootingHours: string;
  mealPenalty: boolean;
  
  // Progress
  scenesPlanned: number;
  scenesCompleted: number;
  scenesPartial: number;
  pagesPlanned: string;
  pagesCompleted: string;
  setupsPlanned: number;
  setupsCompleted: number;
  
  // Takes
  totalTakes: number;
  printTakes: number;
  ngTakes: number;
  
  // Crew & Cast
  crewPresent: number;
  crewAbsent: string[];
  castPresent: number;
  castNoShows: string[];
  
  // Notes
  productionNotes: string;
  safetyIncidents: string[];
  equipmentIssues: string[];
  weatherConditions: string;
  
  // Tomorrow
  tomorrowScenes: string[];
  tomorrowCall: string;
  tomorrowLocation: string;
  specialRequirements: string;
  
  // Signatures
  signatures: {
    role: string;
    name: string;
    signed: boolean;
  }[];
}

interface WrapReportProps {
  productionDay?: ProductionDay;
  scenes?: SceneBreakdown[];
  projectName?: string;
  onReportGenerate?: (report: WrapReportData) => void;
}

export const WrapReport: React.FC<WrapReportProps> = ({
  productionDay,
  scenes = [],
  projectName = 'TROLL',
  onReportGenerate,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const [report, setReport] = useState<WrapReportData>({
    id: `wrap-${Date.now()}`,
    date: productionDay?.date || new Date().toISOString().split('T')[0],
    dayNumber: 1,
    projectName,
    director: 'Roar Uthaug',
    producer: 'Espen Horn',
    firstAD: 'Erik Poppe',
    
    callTime: productionDay?.callTime || '06:00',
    firstShotTime: '08:15',
    lunchStart: '12:00',
    lunchEnd: '12:30',
    lastShotTime: '17:45',
    wrapTime: '18:00',
    plannedWrapTime: productionDay?.wrapTime || '18:00',
    totalShootingHours: '9.5',
    mealPenalty: false,
    
    scenesPlanned: 4,
    scenesCompleted: 3,
    scenesPartial: 1,
    pagesPlanned: '5 2/8',
    pagesCompleted: '4 6/8',
    setupsPlanned: 12,
    setupsCompleted: 10,
    
    totalTakes: 47,
    printTakes: 12,
    ngTakes: 8,
    
    crewPresent: 45,
    crewAbsent: [],
    castPresent: 6,
    castNoShows: [],
    
    productionNotes: 'God produksjonsdag med effektiv fremdrift. Været holdt seg fint hele dagen. Scene 5 ble bare delvis fullført pga. lysforhold - fullføres i morgen.',
    safetyIncidents: [],
    equipmentIssues: ['Kamera B hadde kortvarig teknisk problem kl. 10:30 - løst på 15 min'],
    weatherConditions: 'Delvis skyet, 12°C, svak vind',
    
    tomorrowScenes: ['Scene 5 (fullføring)', 'Scene 8', 'Scene 12'],
    tomorrowCall: '06:00',
    tomorrowLocation: 'Trollstigen - Utsiktspunkt B',
    specialRequirements: 'Droner i bruk. Helikopter standby fra 10:00.',
    
    signatures: [
      { role: '1st AD', name: 'Erik Poppe', signed: true },
      { role: 'Produsent', name: 'Espen Horn', signed: false },
      { role: 'Regissør', name: 'Roar Uthaug', signed: true },
      { role: 'DOP', name: 'Jallo Faber', signed: true },
    ],
  });

  // Notify parent when report changes
  useEffect(() => {
    onReportGenerate?.(report);
  }, [report, onReportGenerate]);

  const handleSaveReport = () => {
    onReportGenerate?.(report);
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Wrap Report - ${report.projectName} - Day ${report.dayNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; line-height: 1.4; padding: 20px; }
            .header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 15px; margin-bottom: 15px; }
            .header h1 { font-size: 24px; font-weight: 800; }
            .section { margin-bottom: 15px; }
            .section-title { background: #333; color: #fff; padding: 5px 10px; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 6px; border: 1px solid #ccc; text-align: left; }
            th { background: #f0f0f0; }
            .highlight { background: #fffde7; }
            .warning { background: #fff3e0; }
            .success { background: #e8f5e9; }
            .error { background: #ffebee; }
            .stat-box { display: inline-block; text-align: center; padding: 10px; margin: 5px; border: 1px solid #ccc; min-width: 80px; }
            .signature-line { border-bottom: 1px solid #000; height: 30px; margin-top: 20px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const getProgressColor = (completed: number, planned: number): 'success' | 'warning' | 'error' => {
    const ratio = planned > 0 ? completed / planned : 0;
    if (ratio >= 1) return 'success';
    if (ratio >= 0.75) return 'warning';
    return 'error';
  };

  const progressPercentage = report.scenesPlanned > 0 
    ? ((report.scenesCompleted + report.scenesPartial * 0.5) / report.scenesPlanned) * 100 
    : 0;

  const isOnSchedule = report.wrapTime <= report.plannedWrapTime;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReportIcon color="primary" />
            Wrap Report / Dagrapport
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={handlePrint}
            >
              Skriv ut
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleSaveReport}
            >
              Lagre
            </Button>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handlePrint}
            >
              Eksporter PDF
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Quick Stats */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: isOnSchedule ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
              {isOnSchedule ? <TrendingUpIcon sx={{ color: '#10b981' }} /> : <TrendingDownIcon sx={{ color: '#ef4444' }} />}
              <Typography variant="h5" sx={{ color: isOnSchedule ? '#10b981' : '#ef4444' }}>
                {report.wrapTime}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Wrap Time (planlagt: {report.plannedWrapTime})
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h5">{report.scenesCompleted}/{report.scenesPlanned}</Typography>
            <Typography variant="caption" color="text.secondary">Scener fullført</Typography>
            <LinearProgress 
              variant="determinate" 
              value={progressPercentage}
              color={getProgressColor(report.scenesCompleted, report.scenesPlanned)}
              sx={{ mt: 1, height: 6, borderRadius: 1 }}
            />
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h5">{report.printTakes}/{report.totalTakes}</Typography>
            <Typography variant="caption" color="text.secondary">Print Takes</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h5">{report.totalShootingHours}t</Typography>
            <Typography variant="caption" color="text.secondary">Opptakstimer</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Report Content */}
      <Box sx={{ flex: 1, overflow: 'auto', bgcolor: '#fff', borderRadius: 2, p: 3 }} ref={printRef}>
        {/* Header */}
        <Box className="header" sx={{ textAlign: 'center', borderBottom: '3px solid #000', pb: 2, mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#000' }}>
            WRAP REPORT / DAGRAPPORT
          </Typography>
          <Typography variant="h5" sx={{ color: '#000' }}>
            {report.projectName}
          </Typography>
          <Typography variant="subtitle1" sx={{ color: '#666' }}>
            Dag {report.dayNumber} - {new Date(report.date).toLocaleDateString('nb-NO', { 
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
            })}
          </Typography>
        </Box>

        {/* Key Personnel */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 4 }}>
            <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: '#666' }}>Regissør</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, color: '#000' }}>{report.director}</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 4 }}>
            <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: '#666' }}>Produsent</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, color: '#000' }}>{report.producer}</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 4 }}>
            <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: '#666' }}>1st AD</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, color: '#000' }}>{report.firstAD}</Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Timing */}
        <Box className="section" sx={{ mb: 3 }}>
          <Typography sx={{ bgcolor: '#333', color: '#fff', p: 1, fontWeight: 700 }}>
            ⏱️ TIDSLOGG
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: '#000' }}>Crew Call</TableCell>
                  <TableCell sx={{ color: '#000' }}>{report.callTime}</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#000' }}>First Shot</TableCell>
                  <TableCell sx={{ color: '#000' }}>{report.firstShotTime}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: '#000' }}>Lunsj</TableCell>
                  <TableCell sx={{ color: '#000' }}>{report.lunchStart} - {report.lunchEnd}</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#000' }}>Last Shot</TableCell>
                  <TableCell sx={{ color: '#000' }}>{report.lastShotTime}</TableCell>
                </TableRow>
                <TableRow sx={{ bgcolor: isOnSchedule ? '#e8f5e9' : '#ffebee' }}>
                  <TableCell sx={{ fontWeight: 600, color: '#000' }}>Wrap</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#000' }}>{report.wrapTime}</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#000' }}>Planlagt Wrap</TableCell>
                  <TableCell sx={{ color: '#000' }}>{report.plannedWrapTime}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: '#000' }}>Totale opptakstimer</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#000' }}>{report.totalShootingHours} timer</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#000' }}>Meal Penalty</TableCell>
                  <TableCell sx={{ color: report.mealPenalty ? '#ef4444' : '#10b981' }}>
                    {report.mealPenalty ? 'JA' : 'NEI'}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* Progress */}
        <Box className="section" sx={{ mb: 3 }}>
          <Typography sx={{ bgcolor: '#333', color: '#fff', p: 1, fontWeight: 700 }}>
            📊 FREMGANG
          </Typography>
          <Grid container spacing={2} sx={{ p: 2 }}>
            <Grid size={{ xs: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: '#666' }}>Scener</Typography>
                <Typography variant="h4" sx={{ color: '#000' }}>
                  {report.scenesCompleted}<Typography component="span" variant="h6" sx={{ color: '#666' }}>/{report.scenesPlanned}</Typography>
                </Typography>
                {report.scenesPartial > 0 && (
                  <Typography variant="caption" sx={{ color: '#f59e0b' }}>
                    +{report.scenesPartial} delvis
                  </Typography>
                )}
              </Paper>
            </Grid>
            <Grid size={{ xs: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: '#666' }}>Sider</Typography>
                <Typography variant="h5" sx={{ color: '#000' }}>
                  {report.pagesCompleted}<Typography component="span" variant="body1" sx={{ color: '#666' }}>/{report.pagesPlanned}</Typography>
                </Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: '#666' }}>Setups</Typography>
                <Typography variant="h4" sx={{ color: '#000' }}>
                  {report.setupsCompleted}<Typography component="span" variant="h6" sx={{ color: '#666' }}>/{report.setupsPlanned}</Typography>
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>

        {/* Takes */}
        <Box className="section" sx={{ mb: 3 }}>
          <Typography sx={{ bgcolor: '#333', color: '#fff', p: 1, fontWeight: 700 }}>
            🎬 TAKES
          </Typography>
          <Stack direction="row" spacing={2} sx={{ p: 2 }}>
            <Paper variant="outlined" sx={{ p: 2, flex: 1, textAlign: 'center' }}>
              <Typography variant="h3" sx={{ color: '#000' }}>{report.totalTakes}</Typography>
              <Typography variant="caption" sx={{ color: '#666' }}>Totale Takes</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, flex: 1, textAlign: 'center', bgcolor: '#f3e8ff' }}>
              <Typography variant="h3" sx={{ color: '#8b5cf6' }}>{report.printTakes}</Typography>
              <Typography variant="caption" sx={{ color: '#666' }}>Print Takes</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, flex: 1, textAlign: 'center', bgcolor: '#fef2f2' }}>
              <Typography variant="h3" sx={{ color: '#ef4444' }}>{report.ngTakes}</Typography>
              <Typography variant="caption" sx={{ color: '#666' }}>NG Takes</Typography>
            </Paper>
          </Stack>
        </Box>

        {/* Weather */}
        <Box className="section" sx={{ mb: 3 }}>
          <Typography sx={{ bgcolor: '#333', color: '#fff', p: 1, fontWeight: 700 }}>
            🌤️ VÆRFORHOLD
          </Typography>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography sx={{ color: '#000' }}>{report.weatherConditions}</Typography>
          </Paper>
        </Box>

        {/* Notes */}
        <Box className="section" sx={{ mb: 3 }}>
          <Typography sx={{ bgcolor: '#333', color: '#fff', p: 1, fontWeight: 700 }}>
            📝 PRODUKSJONSNOTATER
          </Typography>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography sx={{ color: '#000', whiteSpace: 'pre-line' }}>{report.productionNotes}</Typography>
          </Paper>
        </Box>

        {/* Issues */}
        {(report.safetyIncidents.length > 0 || report.equipmentIssues.length > 0) && (
          <Box className="section" sx={{ mb: 3 }}>
            <Typography sx={{ bgcolor: '#f59e0b', color: '#000', p: 1, fontWeight: 700 }}>
              ⚠️ HENDELSER / PROBLEMER
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fff7ed' }}>
              {report.safetyIncidents.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ color: '#ef4444' }}>Sikkerhetshendelser:</Typography>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {report.safetyIncidents.map((incident, i) => (
                      <li key={i}><Typography variant="body2" sx={{ color: '#000' }}>{incident}</Typography></li>
                    ))}
                  </ul>
                </Box>
              )}
              {report.equipmentIssues.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#f59e0b' }}>Utstyrsproblemer:</Typography>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {report.equipmentIssues.map((issue, i) => (
                      <li key={i}><Typography variant="body2" sx={{ color: '#000' }}>{issue}</Typography></li>
                    ))}
                  </ul>
                </Box>
              )}
            </Paper>
          </Box>
        )}

        {/* Tomorrow */}
        <Box className="section" sx={{ mb: 3 }}>
          <Typography sx={{ bgcolor: '#10b981', color: '#fff', p: 1, fontWeight: 700 }}>
            📅 I MORGEN
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: '#ecfdf5' }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" sx={{ color: '#666' }}>Call Time</Typography>
                <Typography variant="h6" sx={{ color: '#000' }}>{report.tomorrowCall}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" sx={{ color: '#666' }}>Lokasjon</Typography>
                <Typography variant="body1" sx={{ color: '#000' }}>{report.tomorrowLocation}</Typography>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant="caption" sx={{ color: '#666' }}>Scener</Typography>
                <Typography variant="body1" sx={{ color: '#000' }}>{report.tomorrowScenes.join(', ')}</Typography>
              </Grid>
              {report.specialRequirements && (
                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" sx={{ color: '#666' }}>Spesielle krav</Typography>
                  <Typography variant="body1" sx={{ color: '#000' }}>{report.specialRequirements}</Typography>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Box>

        {/* Signatures */}
        <Box className="section" sx={{ mb: 3 }}>
          <Typography sx={{ bgcolor: '#333', color: '#fff', p: 1, fontWeight: 700 }}>
            ✍️ SIGNATURER
          </Typography>
          <Grid container spacing={2} sx={{ p: 2 }}>
            {report.signatures.map((sig, i) => (
              <Grid key={i} size={{ xs: 6, md: 3 }}>
                <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#666' }}>{sig.role}</Typography>
                  <Typography variant="body1" sx={{ color: '#000', fontWeight: 600 }}>{sig.name}</Typography>
                  <Box sx={{ 
                    borderBottom: '1px solid #000', 
                    height: 40, 
                    mt: 1,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    pb: 0.5,
                  }}>
                    {sig.signed && (
                      <Typography sx={{ fontStyle: 'italic', color: '#666' }}>
                        ✓ Signert
                      </Typography>
                    )}
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Footer */}
        <Divider sx={{ my: 2 }} />
        <Typography variant="caption" sx={{ color: '#666', textAlign: 'center', display: 'block' }}>
          Generert {new Date().toLocaleString('nb-NO')} • {report.projectName} • Konfidensielt
        </Typography>
      </Box>
    </Box>
  );
};

export default WrapReport;
