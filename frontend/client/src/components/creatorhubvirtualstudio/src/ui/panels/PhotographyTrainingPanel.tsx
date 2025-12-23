/**
 * Photography Training Panel
 * 
 * Interactive educational panel for learning photography fundamentals:
 * - White Balance
 * - Exposure Triangle
 * - Metering Modes
 * - Focus Modes
 * - Composition
 * - School Photography Tips
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  Grid,
  Slider,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Button,
  LinearProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Stack,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
} from '@mui/material';
import {
  WbSunny,
  Cloud,
  Lightbulb,
  FlashOn,
  Tune,
  ExpandMore,
  CheckCircle,
  Cancel,
  School,
  CameraAlt,
  Aperture,
  ShutterSpeed,
  Iso,
  GridView,
  CenterFocusStrong,
  Timeline,
  Layers,
  Quiz,
  PlayArrow,
  Refresh,
  EmojiEvents,
  TipsAndUpdates,
  HelpOutline,
  Park,
  FlashlightOn,
  AutoMode,
  CameraRoll,
  Straighten,
  Groups,
  Settings,
  Face,
  Landscape,
  PhotoCamera,
  Portrait,
  Panorama,
  Warning,
  Info,
} from '@mui/icons-material';
import {
  WHITE_BALANCE_PRESETS,
  COLOR_TEMPERATURE_SCALE,
  EXPOSURE_LESSONS,
  METERING_MODES,
  FOCUS_MODES,
  COMPOSITION_RULES,
  SCHOOL_PHOTOGRAPHY_TIPS,
  QUIZ_QUESTIONS,
  FOCAL_LENGTH_GUIDE,
  LIGHT_ANGLES,
  LIGHT_HEIGHTS,
  DISTANCE_GUIDELINES,
  EQUIPMENT_SETUPS,
  kelvinToHex,
  getColorTemperatureRange,
  QuizQuestion,
} from '../../core/data/photographyEducation';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`training-tabpanel-${index}`}
      aria-labelledby={`training-tab-${index}`}
      style={{ height: '100%', overflow: 'auto' }}
      {...other}
    >
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

// Icon mapping
const ICON_MAP: Record<string, React.ReactNode> = {
  WbSunny: <WbSunny />,
  Cloud: <Cloud />,
  Park: <Park />,
  Lightbulb: <Lightbulb />,
  FlashlightOn: <FlashlightOn />,
  FlashOn: <FlashOn />,
  Tune: <Tune />,
  AutoMode: <AutoMode />,
  Aperture: <Aperture />,
  ShutterSpeed: <ShutterSpeed />,
  Iso: <Iso />,
  GridView: <GridView />,
  CenterFocusStrong: <CenterFocusStrong />,
  CenterFocusWeak: <CenterFocusStrong />,
  Adjust: <Tune />,
  Highlight: <WbSunny />,
  TouchApp: <CameraAlt />,
  Grid3x3: <GridView />,
  Timeline: <Timeline />,
  CropFree: <CameraAlt />,
  ViewQuilt: <GridView />,
  Layers: <Layers />,
  Crop: <CameraAlt />,
};

export const PhotographyTrainingPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [kelvinValue, setKelvinValue] = useState(5500);
  const [quizOpen, setQuizOpen] = useState(false);
  const [currentQuizQuestion, setCurrentQuizQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const currentRange = getColorTemperatureRange(kelvinValue);

  // Quiz handlers
  const startQuiz = useCallback(() => {
    setQuizOpen(true);
    setCurrentQuizQuestion(0);
    setSelectedAnswer(null);
    setQuizScore(0);
    setQuizComplete(false);
    setShowExplanation(false);
  }, []);

  const handleAnswerSelect = useCallback((answerIndex: number) => {
    setSelectedAnswer(answerIndex);
  }, []);

  const handleSubmitAnswer = useCallback(() => {
    if (selectedAnswer === null) return;
    
    const currentQ = QUIZ_QUESTIONS[currentQuizQuestion];
    if (selectedAnswer === currentQ.correctAnswer) {
      setQuizScore(prev => prev + 1);
    }
    setShowExplanation(true);
  }, [selectedAnswer, currentQuizQuestion]);

  const handleNextQuestion = useCallback(() => {
    if (currentQuizQuestion < QUIZ_QUESTIONS.length - 1) {
      setCurrentQuizQuestion(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setQuizComplete(true);
    }
  }, [currentQuizQuestion]);

  const currentQuestion = QUIZ_QUESTIONS[currentQuizQuestion];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Typography variant="h6" sx={{ p: 2, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <School /> Photography Training
        </Typography>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="White Balance" icon={<WbSunny />} iconPosition="start" />
          <Tab label="Focal Length" icon={<CameraRoll />} iconPosition="start" />
          <Tab label="Light Placement" icon={<Lightbulb />} iconPosition="start" />
          <Tab label="Distances" icon={<Straighten />} iconPosition="start" />
          <Tab label="Equipment" icon={<Settings />} iconPosition="start" />
          <Tab label="Exposure" icon={<CameraAlt />} iconPosition="start" />
          <Tab label="Composition" icon={<Layers />} iconPosition="start" />
          <Tab label="School Photo" icon={<School />} iconPosition="start" />
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* WHITE BALANCE TAB */}
        <TabPanel value={activeTab} index={0}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Understanding White Balance
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            White balance ensures that white objects appear white in your photos, regardless of
            the color temperature of your light source.
          </Typography>

          {/* Interactive Kelvin Slider */}
          <Card sx={{ mb: 3, bgcolor: 'background.default' }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Interactive Color Temperature
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Box
                  sx={{
                    width: 60,
                    height: 60,
                    borderRadius: 2,
                    bgcolor: kelvinToHex(kelvinValue),
                    border: '2px solid',
                    borderColor: 'divider'}}
                />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h5" fontWeight={700}>
                    {kelvinValue}K
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {currentRange?.name || 'Custom'}
                  </Typography>
                </Box>
              </Box>
              <Slider
                value={kelvinValue}
                onChange={(_, v) => setKelvinValue(v as number)}
                min={1500}
                max={12000}
                step={100}
                marks={[
                  { value: 2000, label: '2000K' },
                  { value: 3200, label: '3200K' },
                  { value: 5500, label: '5500K' },
                  { value: 7500, label: '7500K' },
                  { value: 10000, label: '10000K' },
                ]}
                sx={{
                  '& .MuiSlider-track': {
                    background: 'linear-gradient(90deg, #ff6b00, #fff4e6, #b8d4ff)',
                  }}}
              />
              {currentRange && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Examples: {currentRange.examples.join('')}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Color Temperature Scale */}
          <Typography variant="subtitle2" gutterBottom>
            Color Temperature Scale (Kelvin)
          </Typography>
          <Box sx={{ display: 'flex', mb: 3, borderRadius: 1, overflow: 'hidden' }}>
            {COLOR_TEMPERATURE_SCALE.map((range) => (
              <Tooltip key={range.name} title={`${range.min}-${range.max}K: ${range.examples.join(', ')}`}>
                <Box
                  sx={{
                    flex: 1,
                    height: 40,
                    bgcolor: range.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer', '&:hover': { opacity: 0.8 }}}
                  onClick={() => setKelvinValue(Math.round((range.min + range.max) / 2))}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: range.min < 4000 ? 'white' : 'black',
                      fontWeight: 600,
                      fontSize: '0.65rem',
                      writingMode: 'vertical-rl',
                      textOrientation: 'mixed'}}
                  >
                    {range.name}
                  </Typography>
                </Box>
              </Tooltip>
            ))}
          </Box>

          {/* White Balance Presets */}
          <Typography variant="subtitle2" gutterBottom>
            Camera White Balance Presets
          </Typography>
          <Grid container spacing={2}>
            {WHITE_BALANCE_PRESETS.map((preset) => (
              <Grid item xs={12} sm={6} key={preset.id}>
                <Card
                  sx={{
                    cursor: 'pointer','&:hover': { bgcolor: 'action.hover' }}}
                  onClick={() => setKelvinValue(preset.kelvin)}
                >
                  <CardContent sx={{ py: 1.5 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 1,
                          bgcolor: kelvinToHex(preset.kelvin),
                          color: preset.kelvin < 4000 ? 'white' : 'black'}}
                      >
                        {ICON_MAP[preset.icon] || <WbSunny />}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2">{preset.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {preset.kelvin}K
                        </Typography>
                      </Box>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      {preset.description}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                      {preset.scenarios.slice(0, 3).map((s) => (
                        <Chip key={s} label={s} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* FOCAL LENGTH TAB */}
        <TabPanel value={activeTab} index={1}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Focal Length Guide
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Different focal lengths create different perspectives. Choose the right one for your shot.
          </Typography>

          {FOCAL_LENGTH_GUIDE.map((fl) => (
            <Accordion key={fl.id}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                  <Chip label={fl.range} color="primary" />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {fl.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      FOV: {fl.fieldOfView}
                    </Typography>
                  </Box>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="success.main" gutterBottom>
                      Best For:
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.5}>
                      {fl.bestFor.map((item) => (
                        <Chip key={item} label={item} size="small" variant="outlined" color="success" />
                      ))}
                    </Stack>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Characteristics:
                    </Typography>
                    <List dense>
                      {fl.characteristics.map((c, i) => (
                        <ListItem key={i} sx={{ py: 0 }}>
                          <ListItemIcon sx={{ minWidth: 24 }}>
                            <CheckCircle fontSize="small" color="primary" />
                          </ListItemIcon>
                          <ListItemText primary={c} primaryTypographyProps={{ variant: 'body2' }} />
                        </ListItem>
                      ))}
                    </List>
                  </Grid>
                </Grid>
                <Divider sx={{ my: 2 }} />
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Paper sx={{ p: 1.5, bgcolor: 'action.hover' }}>
                      <Typography variant="caption" color="text.secondary">Distortion</Typography>
                      <Typography variant="body2">{fl.distortion}</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6}>
                    <Paper sx={{ p: 1.5, bgcolor: 'action.hover' }}>
                      <Typography variant="caption" color="text.secondary">Subject Distance</Typography>
                      <Typography variant="body2">{fl.subjectDistance}</Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          ))}

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Portrait Rule:</strong> Use 85-135mm for the most flattering facial compression. 
              Avoid wide angles (&lt;50mm) for headshots as they distort facial features.
            </Typography>
          </Alert>
        </TabPanel>

        {/* LIGHT PLACEMENT TAB */}
        <TabPanel value={activeTab} index={2}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Light Angle & Placement
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            The position of your light dramatically affects the mood and dimension of your portrait.
          </Typography>

          <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
            Horizontal Light Positions
          </Typography>
          {LIGHT_ANGLES.map((angle) => (
            <Card key={angle.id} sx={{ mb: 2 }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                  <Chip 
                    label={`${angle.angle}°`} 
                    color={angle.angle <= 30 ? 'success' : angle.angle <= 60 ? 'warning' : 'error'}
                    size="small"
                  />
                  <Typography variant="subtitle1" fontWeight={600}>
                    {angle.name}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" paragraph>
                  <strong>Height:</strong> {angle.height}
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>Effect:</strong> {angle.effect}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="success.main" fontWeight={600}>Best For:</Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                      {angle.bestFor.map((item) => (
                        <Chip key={item} label={item} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="error.main" fontWeight={600}>Avoid:</Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                      {angle.avoid.map((item) => (
                        <Chip key={item} label={item} size="small" variant="outlined" color="error" />
                      ))}
                    </Stack>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          ))}

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle2" gutterBottom>
            Light Height Positions
          </Typography>
          <Paper sx={{ p: 2 }}>
            {LIGHT_HEIGHTS.map((height, index) => (
              <Box key={height.position} sx={{ mb: index < LIGHT_HEIGHTS.length - 1 ? 2 : 0 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Chip 
                    label={`${height.degrees}°`} 
                    size="small"
                    color={height.degrees >= 15 && height.degrees <= 45 ? 'success' : 'default'}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2">{height.position}</Typography>
                    <Typography variant="body2" color="text.secondary">{height.effect}</Typography>
                    <Typography variant="caption" color="primary">Catchlights: {height.catchlights}</Typography>
                  </Box>
                </Stack>
                {index < LIGHT_HEIGHTS.length - 1 && <Divider sx={{ mt: 2 }} />}
              </Box>
            ))}
          </Paper>

          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Sweet Spot:</strong> 15-45 degrees above eye level creates the most natural, flattering light 
              that mimics sunlight and produces attractive catchlights.
            </Typography>
          </Alert>
        </TabPanel>

        {/* DISTANCES TAB */}
        <TabPanel value={activeTab} index={3}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Distance Guidelines
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Proper distances between subject, background, lights, and camera are crucial for professional results.
          </Typography>

          {DISTANCE_GUIDELINES.map((guide) => (
            <Accordion key={guide.id} defaultExpanded={guide.id === 'headshot'}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Stack direction="row" spacing={2} alignItems="center">
                  {guide.id.includes('class,') || guide.id.includes('group,') ? <Groups /> : <Face />}
                  <Typography variant="subtitle1" fontWeight={600}>
                    {guide.scenario}
                  </Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {/* Subject to Background */}
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2, bgcolor: 'primary.dark', color: 'white' }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Subject to Background
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="caption">Minimum</Typography>
                          <Typography variant="h6">{guide.subjectToBackground.minimum}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption">Recommended</Typography>
                          <Typography variant="h6" color="success.light">{guide.subjectToBackground.recommended}</Typography>
                        </Grid>
                      </Grid>
                      <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
                        {guide.subjectToBackground.reason}
                      </Typography>
                    </Paper>
                  </Grid>

                  {/* Light to Subject */}
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, bgcolor: 'warning.dark', color: 'white' }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Key Light to Subject
                      </Typography>
                      <Typography variant="h6">{guide.lightToSubject.keyLight}</Typography>
                      <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.3)' }} />
                      <Typography variant="subtitle2" gutterBottom>
                        Fill Light/Reflector
                      </Typography>
                      <Typography variant="body2">{guide.lightToSubject.fillLight}</Typography>
                    </Paper>
                  </Grid>

                  {/* Camera to Subject */}
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, bgcolor: 'info.dark', color: 'white' }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Camera to Subject
                      </Typography>
                      <Typography variant="h6">{guide.cameraToSubject}</Typography>
                      <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.9 }}>
                        {guide.lightToSubject.reason}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                {/* Tips */}
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    <TipsAndUpdates sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                    Pro Tips
                  </Typography>
                  <List dense>
                    {guide.tips.map((tip, i) => (
                      <ListItem key={i} sx={{ py: 0 }}>
                        <ListItemIcon sx={{ minWidth: 24 }}>
                          <CheckCircle fontSize="small" color="success" />
                        </ListItemIcon>
                        <ListItemText primary={tip} primaryTypographyProps={{ variant: 'body2' }} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </TabPanel>

        {/* EQUIPMENT SETUPS TAB */}
        <TabPanel value={activeTab} index={4}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Equipment Setup Recommendations
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Work with what you have! Here's how to get professional results with different equipment combinations.
          </Typography>

          {EQUIPMENT_SETUPS.map((setup) => (
            <Accordion key={setup.id} defaultExpanded={setup.id === 'one_light_reflector'}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Lightbulb color={setup.equipment.length <= 2 ? 'success' : 'warning'} />
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {setup.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {setup.equipment.join(' + ')}
                    </Typography>
                  </Box>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" paragraph>
                  {setup.description}
                </Typography>

                <Paper sx={{ p: 2, mb: 2, bgcolor: 'action.hover' }}>
                  <Typography variant="subtitle2" gutterBottom>Equipment Needed:</Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.5}>
                    {setup.equipment.map((eq) => (
                      <Chip key={eq} label={eq} size="small" color="primary" />
                    ))}
                  </Stack>
                </Paper>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, height: '100%' }}>
                      <Typography variant="subtitle2" color="warning.main" gutterBottom>
                        Key Light Position
                      </Typography>
                      <Typography variant="body2">{setup.setup.keyPosition}</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, height: '100%' }}>
                      <Typography variant="subtitle2" color="info.main" gutterBottom>
                        Fill Position
                      </Typography>
                      <Typography variant="body2">{setup.setup.fillPosition}</Typography>
                    </Paper>
                  </Grid>
                  {setup.setup.rimLight && (
                    <Grid item xs={12}>
                      <Paper sx={{ p: 2 }}>
                        <Typography variant="subtitle2" color="secondary.main" gutterBottom>
                          Rim/Hair Light
                        </Typography>
                        <Typography variant="body2">{setup.setup.rimLight}</Typography>
                      </Paper>
                    </Grid>
                  )}
                </Grid>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="success.main" gutterBottom>Best For:</Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.5}>
                      {setup.bestFor.map((item) => (
                        <Chip key={item} label={item} size="small" variant="outlined" color="success" />
                      ))}
                    </Stack>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="error.main" gutterBottom>Limitations:</Typography>
                    <List dense>
                      {setup.limitations.map((item, i) => (
                        <ListItem key={i} sx={{ py: 0 }}>
                          <ListItemIcon sx={{ minWidth: 20 }}>
                            <Warning fontSize="small" color="error" />
                          </ListItemIcon>
                          <ListItemText primary={item} primaryTypographyProps={{ variant: 'caption' }} />
                        </ListItem>
                      ))}
                    </List>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>
                  <TipsAndUpdates sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                  Pro Tips
                </Typography>
                <List dense>
                  {setup.tips.map((tip, i) => (
                    <ListItem key={i} sx={{ py: 0 }}>
                      <ListItemIcon sx={{ minWidth: 24 }}>
                        <CheckCircle fontSize="small" color="primary" />
                      </ListItemIcon>
                      <ListItemText primary={tip} primaryTypographyProps={{ variant: 'body2' }} />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          ))}

          <Alert severity="success" icon={<Info />} sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Remember:</strong> One light with a reflector can create beautiful portraits! 
              Don't let limited equipment stop you. Master the basics before adding complexity.
            </Typography>
          </Alert>
        </TabPanel>

        {/* EXPOSURE TAB */}
        <TabPanel value={activeTab} index={5}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            The Exposure Triangle
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Master the relationship between Aperture, Shutter Speed, and ISO to control
            how light affects your images.
          </Typography>

          {EXPOSURE_LESSONS.map((lesson) => (
            <Accordion key={lesson.id} defaultExpanded={lesson.id === 'aperture'}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Stack direction="row" spacing={2} alignItems="center">
                  {ICON_MAP[lesson.icon] || <CameraAlt />}
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {lesson.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {lesson.settings.range}
                    </Typography>
                  </Box>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" paragraph>
                  {lesson.description}
                </Typography>

                <Paper sx={{ p: 2, mb: 2, bgcolor: 'action.hover' }}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Effect</Typography>
                      <Typography variant="body2">{lesson.settings.effect}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Trade-off</Typography>
                      <Typography variant="body2">{lesson.settings.tradeoff}</Typography>
                    </Grid>
                  </Grid>
                </Paper>

                <Typography variant="subtitle2" gutterBottom>
                  <TipsAndUpdates sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                  Tips
                </Typography>
                <List dense>
                  {lesson.tips.map((tip, i) => (
                    <ListItem key={i} sx={{ py: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <CheckCircle color="success" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={tip} primaryTypographyProps={{ variant: 'body2' }} />
                    </ListItem>
                  ))}
                </List>

                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                  <PlayArrow sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                  Practice Exercises
                </Typography>
                <List dense>
                  {lesson.exercises.map((ex, i) => (
                    <ListItem key={i} sx={{ py: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <Typography variant="body2" color="primary" fontWeight={700}>
                          {i + 1}.
                        </Typography>
                      </ListItemIcon>
                      <ListItemText primary={ex} primaryTypographyProps={{ variant: 'body2' }} />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          ))}
        </TabPanel>

        {/* COMPOSITION TAB */}
        <TabPanel value={activeTab} index={6}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Composition Rules
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Master these composition techniques to create more engaging images.
          </Typography>

          {COMPOSITION_RULES.map((rule) => (
            <Accordion key={rule.id}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Stack direction="row" spacing={2} alignItems="center">
                  {ICON_MAP[rule.icon] || <Layers />}
                  <Typography variant="subtitle1" fontWeight={600}>
                    {rule.name}
                  </Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" paragraph>
                  {rule.description}
                </Typography>
                <Typography variant="subtitle2" gutterBottom>
                  How to apply:
                </Typography>
                <List dense>
                  {rule.howTo.map((item, i) => (
                    <ListItem key={i} sx={{ py: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <CheckCircle color="primary" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={item} primaryTypographyProps={{ variant: 'body2' }} />
                    </ListItem>
                  ))}
                </List>
                <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                  {rule.examples.map((ex) => (
                    <Chip key={ex} label={ex} size="small" variant="outlined" />
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </TabPanel>

        {/* SCHOOL PHOTOGRAPHY TAB */}
        <TabPanel value={activeTab} index={7}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            School Photography Training
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Professional tips for high-volume school portrait sessions.
          </Typography>

          {SCHOOL_PHOTOGRAPHY_TIPS.map((section) => (
            <Accordion key={section.id}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Chip
                    label={section.category}
                    size="small"
                    color={
                      section.category === 'technical' ? 'primary' :
                      section.category === 'workflow' ? 'success' :
                      section.category === 'lighting' ? 'warning' :
                      section.category === 'posing' ? 'info' :
                      'default'
                    }
                  />
                  <Typography variant="subtitle1" fontWeight={600}>
                    {section.title}
                  </Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {section.description}
                </Typography>
                <List dense>
                  {section.tips.map((tip, i) => (
                    <ListItem key={i} sx={{ py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <CheckCircle color="success" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={tip} primaryTypographyProps={{ variant: 'body2' }} />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          ))}

          <Alert severity="info" sx={{ mt: 3 }}>
            <Typography variant="body2">
              <strong>Pro Tip:</strong> Consistency is key in school photography. 
              Set your lighting, camera, and workflow once, then stick with it for the entire session.
            </Typography>
          </Alert>
        </TabPanel>
      </Box>

      {/* Quiz Button */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button
          variant="contained"
          fullWidth
          startIcon={<Quiz />}
          onClick={startQuiz}
        >
          Test Your Knowledge
        </Button>
      </Box>

      {/* Quiz Dialog */}
      <Dialog open={quizOpen} onClose={() => setQuizOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Photography Quiz</Typography>
            {!quizComplete && (
              <Chip
                label={`Question ${currentQuizQuestion + 1}/${QUIZ_QUESTIONS.length}`}
                size="small"
              />
            )}
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {quizComplete ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <EmojiEvents sx={{ fontSize: 80, color: quizScore >= 7 ? 'gold' : 'silver', mb: 2 }} />
              <Typography variant="h4" fontWeight={700} gutterBottom>
                {quizScore}/{QUIZ_QUESTIONS.length}
              </Typography>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {quizScore >= 8 ? 'Excellent!' : quizScore >= 6 ? 'Good job!' : 'Keep practicing!'}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(quizScore / QUIZ_QUESTIONS.length) * 100}
                sx={{ height: 10, borderRadius: 5, mt: 2 }}
                color={quizScore >= 7 ? 'success' : quizScore >= 5 ? 'warning' : 'error'}
              />
            </Box>
          ) : (
            <>
              <Chip
                label={currentQuestion.topic.replace('_', ', ')}
                size="small"
                sx={{ mb: 2 }}
              />
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                {currentQuestion.question}
              </Typography>

              <FormControl component="fieldset" sx={{ width: '100%', mt: 2 }}>
                <RadioGroup
                  value={selectedAnswer}
                  onChange={(e) => handleAnswerSelect(parseInt(e.target.value))}
                >
                  {currentQuestion.options.map((option, index) => (
                    <FormControlLabel
                      key={index}
                      value={index}
                      disabled={showExplanation}
                      control={<Radio />}
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {option}
                          {showExplanation && index === currentQuestion.correctAnswer && (
                            <CheckCircle color="success" fontSize="small" />
                          )}
                          {showExplanation && selectedAnswer === index && index !== currentQuestion.correctAnswer && (
                            <Cancel color="error" fontSize="small" />
                          )}
                        </Box>
                      }
                      sx={{
                        mb: 1,
                        p: 1,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: showExplanation
                          ? index === currentQuestion.correctAnswer
                            ? 'success.main'
                            : selectedAnswer === index
                            ? 'error.main'
                            : 'divider'
                          : 'divider',
                        bgcolor: showExplanation
                          ? index === currentQuestion.correctAnswer
                            ? 'success.light'
                            : selectedAnswer === index
                            ? 'error.light'
                            : 'transparent'
                          : 'transparent'}}
                    />
                  ))}
                </RadioGroup>
              </FormControl>

              {showExplanation && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">{currentQuestion.explanation}</Typography>
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuizOpen(false)}>Close</Button>
          {!quizComplete && (
            <>
              {!showExplanation ? (
                <Button
                  variant="contained"
                  onClick={handleSubmitAnswer}
                  disabled={selectedAnswer === null}
                >
                  Submit Answer
                </Button>
              ) : (
                <Button variant="contained" onClick={handleNextQuestion}>
                  {currentQuizQuestion < QUIZ_QUESTIONS.length - 1 ? 'Next Question' : 'See Results'}
                </Button>
              )}
            </>
          )}
          {quizComplete && (
            <Button variant="contained" startIcon={<Refresh />} onClick={startQuiz}>
              Try Again
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PhotographyTrainingPanel;

