/**
 * RoleRoomIntelligence.tsx
 *
 * "Always Learning" — The Role Room forstår deg og teamet ditt.
 *
 * Seven tabs:
 *   1. Din Profil    — Creative DNA, work patterns, decision style
 *   2. Ditt Team     — Crew relationships, synergy, reliability
 *   3. Dine Mønstre  — Discovered production patterns
 *   4. Preferanser   — Auto-detected + confirmed preferences
 *   5. Crew-forslag  — Smart crew suggestions + Dream Team builder
 *   6. Teamkjemi     — Chemistry prediction for crew combinations
 *   7. Tidslinje     — Learning timeline + project setup intelligence
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  Groups as GroupsIcon,
  Insights as InsightsIcon,
  Tune as TuneIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  AutoFixHigh as AutoIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  AccessTime as ClockIcon,
  EmojiEvents as TrophyIcon,
  Star as StarIcon,
  Handshake as HandshakeIcon,
  Speed as SpeedIcon,
  WorkspacePremium as BadgeIcon,
  Lightbulb as LightbulbIcon,
  Info as InfoIcon,
  PersonSearch as PersonSearchIcon,
  Science as ScienceIcon,
  Timeline as TimelineIcon,
  AutoAwesome as AutoAwesomeIcon,
  Warning as WarningIcon,
  FiberManualRecord as DotIcon,
  Flag as FlagIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import {
  learningApi,
  type UserInsights,
  type TeamReport,
  type ProjectPattern,
  type LearnedPreference,
  type LearningSnapshot,
  type CrewSuggestion,
  type DreamTeam,
  type ChemistryPrediction,
  type LearningTimeline,
  type ProjectSetupSuggestion,
} from '../services/roleRoomLearningApi';

// ─── Props ───

interface RoleRoomIntelligenceProps {
  userId: string;
}

// ─── Tab panel helper ───

function TabPanel(props: { children: React.ReactNode; value: number; index: number }) {
  const { children, value, index } = props;
  if (value !== index) return null;
  return <Box sx={{ pt: 2 }}>{children}</Box>;
}

// ─── Confidence bar ───

function ConfidenceBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'success' : pct >= 40 ? 'warning' : 'info';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
      {label && <Typography variant="caption" sx={{ minWidth: 80, color: 'text.secondary' }}>{label}</Typography>}
      <LinearProgress
        variant="determinate"
        value={pct}
        color={color}
        sx={{ flex: 1, height: 6, borderRadius: 3 }}
      />
      <Typography variant="caption" sx={{ minWidth: 32, textAlign: 'right' }}>{pct}%</Typography>
    </Box>
  );
}

// ─── Trend icon ───

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'increasing' || trend === 'growing' || trend === 'voksende') return <TrendingUpIcon fontSize="small" color="success" />;
  if (trend === 'decreasing' || trend === 'shrinking' || trend === 'synkende') return <TrendingDownIcon fontSize="small" color="warning" />;
  return <TrendingFlatIcon fontSize="small" color="disabled" />;
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export default function RoleRoomIntelligence({ userId }: RoleRoomIntelligenceProps) {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [snapshot, setSnapshot] = useState<LearningSnapshot | null>(null);
  const [insights, setInsights] = useState<UserInsights | null>(null);
  const [teamReport, setTeamReport] = useState<TeamReport | null>(null);
  const [patterns, setPatterns] = useState<ProjectPattern[]>([]);
  const [preferences, setPreferences] = useState<LearnedPreference[]>([]);

  // New feature data
  const [crewSuggestions, setCrewSuggestions] = useState<CrewSuggestion[]>([]);
  const [dreamTeam, setDreamTeam] = useState<DreamTeam | null>(null);
  const [crewRoleFilter, setCrewRoleFilter] = useState('');
  const [chemistryNames, setChemistryNames] = useState('');
  const [chemistryResult, setChemistryResult] = useState<ChemistryPrediction | null>(null);
  const [timeline, setTimeline] = useState<LearningTimeline | null>(null);
  const [projectSetup, setProjectSetup] = useState<ProjectSetupSuggestion | null>(null);

  // ── Load snapshot on mount ──
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await learningApi.snapshot.get(userId);
      setSnapshot(snap);
      setInsights(snap.userInsights);
      setTeamReport(snap.teamReport);
      setPatterns(snap.patterns);
      setPreferences(snap.preferences);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Klarte ikke laste data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Recompute everything ──
  const handleRecompute = useCallback(async () => {
    setComputing(true);
    setError(null);
    try {
      const snap = await learningApi.snapshot.recompute(userId);
      setSnapshot(snap);
      setInsights(snap.userInsights);
      setTeamReport(snap.teamReport);
      setPatterns(snap.patterns);
      setPreferences(snap.preferences);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Recompute feilet';
      setError(msg);
    } finally {
      setComputing(false);
    }
  }, [userId]);

  // ── Confirm preference ──
  const handleConfirmPref = useCallback(async (key: string) => {
    try {
      await learningApi.preferences.confirm(userId, key);
      setPreferences((prev) =>
        prev.map((p) => p.preferenceKey === key ? { ...p, preferenceType: 'confirmed' as const, confidence: 1 } : p)
      );
    } catch {
      // silent fail
    }
  }, [userId]);

  // ── Loading state ──
  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
        <CircularProgress size={40} />
        <Typography sx={{ mt: 2, color: 'text.secondary' }}>Laster læringsdata...</Typography>
      </Box>
    );
  }

  return (
    <Paper elevation={0} sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PsychologyIcon color="primary" />
          <Typography variant="h6">Læringsmotor</Typography>
          <Chip
            label="Always Learning"
            size="small"
            variant="outlined"
            color="primary"
            sx={{ ml: 1 }}
          />
        </Box>
        <Tooltip title="Kjør full analyse på nytt">
          <IconButton onClick={handleRecompute} disabled={computing} size="small">
            <RefreshIcon sx={{ animation: computing ? 'spin 1s linear infinite' : 'none', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Greeting + nudges */}
      {snapshot && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body1" sx={{ fontWeight: 500, mb: 1 }}>
            {snapshot.greeting}
          </Typography>
          {snapshot.nudges.map((nudge, i) => (
            <Alert key={i} severity="info" icon={<LightbulbIcon />} sx={{ mb: 0.5, py: 0, '& .MuiAlert-message': { py: 0.5 } }}>
              {nudge}
            </Alert>
          ))}
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Feil</AlertTitle>
          {error}
        </Alert>
      )}

      {/* Confidence indicator */}
      {insights && (
        <Box sx={{ mb: 2 }}>
          <ConfidenceBar value={insights.confidenceScore} label="Datakvalitet" />
          <Typography variant="caption" color="text.secondary">
            Basert på {insights.totalEventsAnalyzed} hendelser og {insights.engagementMetrics.totalProjects} prosjekt(er)
          </Typography>
        </Box>
      )}

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}
      >
        <Tab icon={<PsychologyIcon />} label="Din Profil" iconPosition="start" />
        <Tab icon={<GroupsIcon />} label="Ditt Team" iconPosition="start" />
        <Tab icon={<InsightsIcon />} label="Dine Mønstre" iconPosition="start" />
        <Tab icon={<TuneIcon />} label="Preferanser" iconPosition="start" />
        <Tab icon={<PersonSearchIcon />} label="Crew-forslag" iconPosition="start" />
        <Tab icon={<ScienceIcon />} label="Teamkjemi" iconPosition="start" />
        <Tab icon={<TimelineIcon />} label="Tidslinje" iconPosition="start" />
      </Tabs>

      {/* ═══ TAB 1: DIN PROFIL ═══ */}
      <TabPanel value={tab} index={0}>
        {!insights ? (
          <Alert severity="info">Ingen innsikter ennå. Klikk oppdater-knappen for å analysere.</Alert>
        ) : (
          <Grid container spacing={2}>
            {/* Creative DNA */}
            <Grid item xs={12} sm={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <StarIcon fontSize="small" color="warning" /> Kreativt DNA
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Sjangre du foretrekker:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    {insights.creativeDna.preferredGenres.length > 0
                      ? insights.creativeDna.preferredGenres.map((g) => (
                          <Chip key={g} label={g} size="small" color="primary" variant="outlined" />
                        ))
                      : <Typography variant="caption" color="text.secondary">Ikke nok data ennå</Typography>}
                  </Box>
                  {Object.keys(insights.creativeDna.genreComfort).length > 0 && (
                    <>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        Sjangerkomfort:
                      </Typography>
                      {Object.entries(insights.creativeDna.genreComfort).map(([genre, score]) => (
                        <ConfidenceBar key={genre} value={score} label={genre} />
                      ))}
                    </>
                  )}
                  {insights.creativeDna.narrativeTendencies.length > 0 && (
                    <>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 0.5 }}>
                        Prosjekttyper:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {insights.creativeDna.narrativeTendencies.map((t) => (
                          <Chip key={t} label={t} size="small" variant="filled" />
                        ))}
                      </Box>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Work Patterns */}
            <Grid item xs={12} sm={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <ClockIcon fontSize="small" color="info" /> Arbeidsmønstre
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Gj.snitt økt</Typography>
                      <Typography variant="h6">{insights.workPatterns.avgSessionHours}t</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Foretrukken dag</Typography>
                      <Typography variant="h6">{insights.workPatterns.preferredDay}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Totalt økter</Typography>
                      <Typography variant="h6">{insights.workPatterns.totalSessions}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Plan vs utførelse</Typography>
                      <Typography variant="h6">
                        {Math.round(insights.workPatterns.planningToExecutionRatio * 100)}%
                      </Typography>
                    </Box>
                  </Box>
                  {insights.workPatterns.peakHours.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">Mest aktive timer:</Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                        {insights.workPatterns.peakHours.map((h) => (
                          <Chip key={h} label={`${String(h).padStart(2, '0')}:00`} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Decision Patterns */}
            <Grid item xs={12} sm={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <SpeedIcon fontSize="small" color="secondary" /> Beslutningsstil
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Revisjonshyppighet</Typography>
                      <Chip
                        label={insights.decisionPatterns.revisionFrequency === 'low' ? 'Lav' : insights.decisionPatterns.revisionFrequency === 'medium' ? 'Middels' : 'Høy'}
                        size="small"
                        color={insights.decisionPatterns.revisionFrequency === 'low' ? 'success' : insights.decisionPatterns.revisionFrequency === 'medium' ? 'warning' : 'error'}
                      />
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Godkjenningsfart</Typography>
                      <Chip
                        label={insights.decisionPatterns.approvalSpeed === 'fast' ? 'Rask' : insights.decisionPatterns.approvalSpeed === 'moderate' ? 'Moderat' : 'Grundig'}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                  </Box>
                  {insights.decisionPatterns.areasOfFocus.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">Fokusområder:</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {insights.decisionPatterns.areasOfFocus.map((a) => (
                          <Chip key={a} label={a} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Skill Trajectory */}
            <Grid item xs={12} sm={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <TrendingUpIcon fontSize="small" color="success" /> Vekst & Utvikling
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="body2">Prosjektkompleksitet:</Typography>
                    <TrendIcon trend={insights.skillTrajectory.projectComplexityTrend} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {insights.skillTrajectory.projectComplexityTrend === 'increasing' ? 'Økende' :
                       insights.skillTrajectory.projectComplexityTrend === 'decreasing' ? 'Synkende' : 'Stabil'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="body2">Teamstørrelse:</Typography>
                    <TrendIcon trend={insights.skillTrajectory.teamSizeTrend} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {insights.skillTrajectory.teamSizeTrend === 'growing' ? 'Vokser' :
                       insights.skillTrajectory.teamSizeTrend === 'shrinking' ? 'Krymper' : 'Stabil'}
                    </Typography>
                  </Box>
                  {insights.skillTrajectory.newCapabilities.length > 0 && (
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        Nye ferdigheter siste 90 dager:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {insights.skillTrajectory.newCapabilities.map((c) => (
                          <Chip key={c} label={c} size="small" color="success" variant="outlined" />
                        ))}
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Engagement stats */}
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <BadgeIcon fontSize="small" color="primary" /> Engasjement
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 2 }}>
                    <StatBox label="Totalt prosjekter" value={String(insights.engagementMetrics.totalProjects)} />
                    <StatBox label="Totalt økter" value={String(insights.engagementMetrics.totalSessions)} />
                    <StatBox label="Gj.snitt varighet" value={`${insights.engagementMetrics.avgProjectDurationDays}d`} />
                    <StatBox label="Medlem i" value={`${insights.engagementMetrics.memberSinceDays}d`} />
                  </Box>
                  {Object.keys(insights.engagementMetrics.featuresUsed).length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="caption" color="text.secondary">Mest brukte funksjoner:</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {Object.entries(insights.engagementMetrics.featuresUsed)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 8)
                          .map(([feature, count]) => (
                            <Chip key={feature} label={`${feature} (${count})`} size="small" variant="outlined" />
                          ))}
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      {/* ═══ TAB 2: DITT TEAM ═══ */}
      <TabPanel value={tab} index={1}>
        {!teamReport || teamReport.members.length === 0 ? (
          <Alert severity="info">
            <AlertTitle>Ingen teamdata ennå</AlertTitle>
            Legg til crew-medlemmer i prosjektene dine, så lærer jeg å kjenne teamet ditt.
          </Alert>
        ) : (
          <>
            {/* Team insights */}
            {teamReport.insights.length > 0 && (
              <Box sx={{ mb: 2 }}>
                {teamReport.insights.map((insight, i) => (
                  <Alert key={i} severity="success" icon={<HandshakeIcon />} sx={{ mb: 0.5, py: 0, '& .MuiAlert-message': { py: 0.5 } }}>
                    {insight}
                  </Alert>
                ))}
              </Box>
            )}

            {/* Reliability avg */}
            <Box sx={{ mb: 2 }}>
              <ConfidenceBar value={teamReport.reliabilityAvg} label="Team-pålitelighet" />
            </Box>

            {/* Top pairings */}
            {teamReport.topPairings.length > 0 && (
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TrophyIcon fontSize="small" color="warning" /> Beste teamkombinasjoner
                  </Typography>
                  {teamReport.topPairings.map((pair, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Chip label={pair.names.join(' + ')} size="small" color="primary" />
                      <Typography variant="caption">{pair.projects} felles prosjekter</Typography>
                      <ConfidenceBar value={pair.synergy} />
                    </Box>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Department coverage */}
            {Object.keys(teamReport.departmentCoverage).length > 0 && (
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Avdelingsdekning</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {Object.entries(teamReport.departmentCoverage).map(([dept, count]) => (
                      <Chip key={dept} label={`${dept}: ${count}`} size="small" variant="outlined" />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* Member cards */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Alle teammedlemmer ({teamReport.members.length})
            </Typography>
            <Grid container spacing={1}>
              {teamReport.members.map((member) => (
                <Grid item xs={12} sm={6} md={4} key={member.id || member.crewMemberName}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent sx={{ pb: '12px !important' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="subtitle2">{member.crewMemberName}</Typography>
                          <Typography variant="caption" color="text.secondary">{member.crewRole}</Typography>
                        </Box>
                        <Chip
                          label={`${member.collaborationCount} prosjekt`}
                          size="small"
                          color={member.collaborationCount >= 3 ? 'success' : 'default'}
                          variant="outlined"
                        />
                      </Box>
                      <Box sx={{ mt: 1 }}>
                        <ConfidenceBar value={member.synergyScore} label="Synergi" />
                        <ConfidenceBar value={member.reliabilityScore} label="Pålitelighet" />
                      </Box>
                      {member.strengths.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                          {member.strengths.map((s) => (
                            <Chip key={s} label={s} size="small" color="primary" variant="outlined"
                              sx={{ fontSize: '0.65rem', height: 20 }} />
                          ))}
                        </Box>
                      )}
                      {member.preferredPairing.length > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          Jobber godt med: {member.preferredPairing.slice(0, 3).join(', ')}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </>
        )}
      </TabPanel>

      {/* ═══ TAB 3: DINE MØNSTRE ═══ */}
      <TabPanel value={tab} index={2}>
        {patterns.length === 0 ? (
          <Alert severity="info">
            <AlertTitle>Ingen mønstre oppdaget ennå</AlertTitle>
            Jo mer du bruker The Role Room, desto flere mønstre finner jeg i måten du jobber på.
          </Alert>
        ) : (
          <Grid container spacing={1}>
            {patterns.map((pattern) => (
              <Grid item xs={12} sm={6} key={pattern.id || `${pattern.patternType}-${pattern.patternKey}`}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PatternIcon type={pattern.patternType} />
                        <Typography variant="subtitle2">
                          {patternTypeLabel(pattern.patternType)}
                        </Typography>
                      </Box>
                      <Chip
                        label={`${pattern.evidenceCount} bevis`}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>{pattern.description}</Typography>
                    <ConfidenceBar value={pattern.confidence} label="Sikkerhet" />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<InsightsIcon />}
            onClick={async () => {
              setComputing(true);
              try {
                const p = await learningApi.patterns.discover(userId);
                setPatterns(p);
              } catch { /* ignore */ }
              setComputing(false);
            }}
            disabled={computing}
          >
            Oppdag mønstre
          </Button>
        </Box>
      </TabPanel>

      {/* ═══ TAB 4: PREFERANSER ═══ */}
      <TabPanel value={tab} index={3}>
        {preferences.length === 0 ? (
          <Alert severity="info">
            <AlertTitle>Ingen preferanser oppdaget ennå</AlertTitle>
            The Role Room lærer dine preferanser fra hvordan du bruker systemet. Fortsett å jobbe!
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Preferanser som The Role Room har lært automatisk. Bekreft for å gjøre dem permanente.
            </Typography>
            <Grid container spacing={1}>
              {preferences.map((pref) => (
                <Grid item xs={12} sm={6} key={pref.id || pref.preferenceKey}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                        <Box>
                          <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {pref.preferenceType === 'confirmed' ? (
                              <CheckIcon fontSize="small" color="success" />
                            ) : (
                              <AutoIcon fontSize="small" color="warning" />
                            )}
                            {prefKeyLabel(pref.preferenceKey)}
                          </Typography>
                          <Chip label={pref.category} size="small" variant="outlined" sx={{ mt: 0.5 }} />
                        </Box>
                        {pref.preferenceType === 'auto' && (
                          <Tooltip title="Bekreft denne preferansen">
                            <Button
                              size="small"
                              variant="outlined"
                              color="success"
                              onClick={() => handleConfirmPref(pref.preferenceKey)}
                              sx={{ minWidth: 0, px: 1 }}
                            >
                              <CheckIcon fontSize="small" />
                            </Button>
                          </Tooltip>
                        )}
                      </Box>
                      <Typography variant="body1" sx={{ fontWeight: 500, my: 0.5 }}>
                        {pref.preferenceValue}
                      </Typography>
                      <ConfidenceBar value={pref.confidence} label="Sikkerhet" />
                      <Typography variant="caption" color="text.secondary">
                        {pref.evidenceCount} hendelse{pref.evidenceCount !== 1 ? 'r' : ''} analysert
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<TuneIcon />}
                onClick={async () => {
                  setComputing(true);
                  try {
                    const p = await learningApi.preferences.learn(userId);
                    setPreferences(p);
                  } catch { /* ignore */ }
                  setComputing(false);
                }}
                disabled={computing}
              >
                Lær preferanser
              </Button>
            </Box>
          </>
        )}
      </TabPanel>

      {/* ═══ TAB 5: CREW-FORSLAG ═══ */}
      <TabPanel value={tab} index={4}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Basert på hvem du har jobbet med tidligere, foreslår The Role Room de beste folkene for neste prosjekt.
        </Typography>

        {/* Role filter */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
          <Box
            component="input"
            placeholder="Filtrer på rolle (f.eks. Fotograf, Klipper...)"
            value={crewRoleFilter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCrewRoleFilter(e.target.value)}
            sx={{
              flex: 1, px: 1.5, py: 1, borderRadius: 1,
              border: '1px solid', borderColor: 'divider',
              bgcolor: 'background.paper', color: 'text.primary',
              fontSize: '0.875rem', outline: 'none',
              '&:focus': { borderColor: 'primary.main' },
            }}
          />
          <Button
            variant="outlined"
            startIcon={<PersonSearchIcon />}
            onClick={async () => {
              setComputing(true);
              try {
                const s = await learningApi.crewSuggest.suggest(userId, crewRoleFilter || undefined);
                setCrewSuggestions(s);
              } catch { /* ignore */ }
              setComputing(false);
            }}
            disabled={computing}
          >
            Søk
          </Button>
          <Button
            variant="contained"
            startIcon={<AutoAwesomeIcon />}
            onClick={async () => {
              setComputing(true);
              try {
                const dt = await learningApi.crewSuggest.dreamTeam(userId);
                setDreamTeam(dt);
              } catch { /* ignore */ }
              setComputing(false);
            }}
            disabled={computing}
            color="secondary"
          >
            Drømmeteam
          </Button>
        </Box>

        {/* Dream Team result */}
        {dreamTeam && (
          <Card variant="outlined" sx={{ mb: 2, borderColor: 'secondary.main', borderWidth: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <AutoAwesomeIcon color="secondary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Ditt Drømmeteam</Typography>
                <Chip
                  label={`Kjemi: ${Math.round(dreamTeam.overallChemistry * 100)}%`}
                  size="small"
                  color={dreamTeam.overallChemistry > 0.7 ? 'success' : 'warning'}
                />
              </Box>
              <Grid container spacing={1} sx={{ mb: 1 }}>
                {dreamTeam.members.map((m) => (
                  <Grid item xs={12} sm={6} md={4} key={m.name}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent sx={{ pb: '8px !important' }}>
                        <Typography variant="subtitle2">{m.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{m.role}{m.department ? ` · ${m.department}` : ''}</Typography>
                        <ConfidenceBar value={m.score} label="Score" />
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                          {m.reasons.slice(0, 2).map((r, i) => (
                            <Chip key={i} label={r} size="small" sx={{ fontSize: '0.6rem', height: 18 }} />
                          ))}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
              {dreamTeam.missingRoles.length > 0 && (
                <Alert severity="warning" sx={{ mb: 1, py: 0 }}>
                  Mangler: {dreamTeam.missingRoles.join(', ')}
                </Alert>
              )}
              {dreamTeam.insights.map((ins, i) => (
                <Alert key={i} severity="info" icon={<LightbulbIcon />} sx={{ mb: 0.5, py: 0, '& .MuiAlert-message': { py: 0.5 } }}>
                  {ins}
                </Alert>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Individual suggestions */}
        {crewSuggestions.length > 0 && (
          <Grid container spacing={1}>
            {crewSuggestions.map((s) => (
              <Grid item xs={12} sm={6} md={4} key={s.name}>
                <Card variant="outlined">
                  <CardContent sx={{ pb: '12px !important' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography variant="subtitle2">{s.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{s.role}</Typography>
                      </Box>
                      <Chip
                        label={`${Math.round(s.score * 100)}%`}
                        size="small"
                        color={s.score > 0.7 ? 'success' : s.score > 0.4 ? 'warning' : 'default'}
                      />
                    </Box>
                    <ConfidenceBar value={s.reliabilityScore} label="Pålitelighet" />
                    <Typography variant="caption" color="text.secondary">
                      {s.collaborationCount} tidl. samarbeid
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {s.reasons.map((r, i) => (
                        <Chip key={i} label={r} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
                      ))}
                    </Box>
                    {s.synergyWithOthers.length > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        God synergi med: {s.synergyWithOthers.slice(0, 3).map((x) => x.name).join(', ')}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {crewSuggestions.length === 0 && !dreamTeam && (
          <Alert severity="info" sx={{ mt: 1 }}>
            Klikk "Søk" for å få forslag, eller "Drømmeteam" for å la The Role Room sette sammen optimal crew.
          </Alert>
        )}
      </TabPanel>

      {/* ═══ TAB 6: TEAMKJEMI ═══ */}
      <TabPanel value={tab} index={5}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Skriv inn crew-navn (kommaseparert) for å predikere hvordan de vil fungere sammen.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
          <Box
            component="input"
            placeholder="Navn1, Navn2, Navn3..."
            value={chemistryNames}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChemistryNames(e.target.value)}
            sx={{
              flex: 1, px: 1.5, py: 1, borderRadius: 1,
              border: '1px solid', borderColor: 'divider',
              bgcolor: 'background.paper', color: 'text.primary',
              fontSize: '0.875rem', outline: 'none',
              '&:focus': { borderColor: 'primary.main' },
            }}
          />
          <Button
            variant="contained"
            startIcon={<ScienceIcon />}
            onClick={async () => {
              const names = chemistryNames.split(',').map((n) => n.trim()).filter(Boolean);
              if (names.length < 2) return;
              setComputing(true);
              try {
                const result = await learningApi.chemistry.predict(userId, names);
                setChemistryResult(result);
              } catch { /* ignore */ }
              setComputing(false);
            }}
            disabled={computing || chemistryNames.split(',').filter((n) => n.trim()).length < 2}
          >
            Analyser kjemi
          </Button>
        </Box>

        {chemistryResult && (
          <Box>
            {/* Overall score */}
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                  <ScienceIcon color={chemistryResult.overallScore > 0.7 ? 'success' : chemistryResult.overallScore > 0.4 ? 'warning' : 'error'} sx={{ fontSize: 32 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6">
                      Teamkjemi: {Math.round(chemistryResult.overallScore * 100)}%
                    </Typography>
                    <ConfidenceBar value={chemistryResult.overallScore} />
                  </Box>
                </Box>
                <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                  {chemistryResult.suggestion}
                </Typography>
              </CardContent>
            </Card>

            {/* Pair scores */}
            {chemistryResult.pairScores.length > 0 && (
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Par-analyser</Typography>
                  {chemistryResult.pairScores.map((p, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Chip label={`${p.a} + ${p.b}`} size="small" color="primary" variant="outlined" />
                      <Box sx={{ flex: 1 }}>
                        <ConfidenceBar value={p.score} />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {p.history} felles prosjekt{p.history !== 1 ? 'er' : ''}
                      </Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Strengths & risks */}
            <Grid container spacing={1}>
              {chemistryResult.strengths.length > 0 && (
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ borderColor: 'success.main' }}>
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                        <CheckIcon fontSize="small" color="success" /> Styrker
                      </Typography>
                      {chemistryResult.strengths.map((s, i) => (
                        <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>• {s}</Typography>
                      ))}
                    </CardContent>
                  </Card>
                </Grid>
              )}
              {chemistryResult.risks.length > 0 && (
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ borderColor: 'warning.main' }}>
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                        <WarningIcon fontSize="small" color="warning" /> Risiko
                      </Typography>
                      {chemistryResult.risks.map((r, i) => (
                        <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>• {r}</Typography>
                      ))}
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>

            {chemistryResult.unknownMembers.length > 0 && (
              <Alert severity="info" sx={{ mt: 1 }}>
                Ukjente medlemmer (ingen historikk): {chemistryResult.unknownMembers.join(', ')}
              </Alert>
            )}
          </Box>
        )}

        {!chemistryResult && (
          <Alert severity="info">
            Skriv inn minst 2 crew-navn for å predikere teamkjemi.
          </Alert>
        )}
      </TabPanel>

      {/* ═══ TAB 7: TIDSLINJE ═══ */}
      <TabPanel value={tab} index={6}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<TimelineIcon />}
            onClick={async () => {
              setComputing(true);
              try {
                const tl = await learningApi.timeline.get(userId);
                setTimeline(tl);
              } catch { /* ignore */ }
              setComputing(false);
            }}
            disabled={computing}
          >
            Last tidslinje
          </Button>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={async () => {
              setComputing(true);
              try {
                const ps = await learningApi.projectSetup.suggest(userId);
                setProjectSetup(ps);
              } catch { /* ignore */ }
              setComputing(false);
            }}
            disabled={computing}
          >
            Foreslå prosjektoppsett
          </Button>
        </Box>

        {/* Project setup suggestion */}
        {projectSetup && (
          <Card variant="outlined" sx={{ mb: 2, borderColor: 'info.main' }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
                <AutoAwesomeIcon fontSize="small" color="info" /> Intelligent prosjektoppsett
              </Typography>
              <Grid container spacing={1}>
                {projectSetup.suggestedGenre && (
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Sjanger</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{projectSetup.suggestedGenre}</Typography>
                  </Grid>
                )}
                {projectSetup.suggestedProjectType && (
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Prosjekttype</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{projectSetup.suggestedProjectType}</Typography>
                  </Grid>
                )}
                {projectSetup.suggestedBudget != null && (
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Budsjett</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {projectSetup.suggestedBudget.toLocaleString()} {projectSetup.suggestedCurrency || 'NOK'}
                    </Typography>
                  </Grid>
                )}
                {projectSetup.suggestedCallTime && (
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Oppmøtetid</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{projectSetup.suggestedCallTime}</Typography>
                  </Grid>
                )}
              </Grid>
              {projectSetup.suggestedCrewNames.length > 0 && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Foreslått crew:</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {projectSetup.suggestedCrewNames.map((c) => (
                      <Tooltip key={c.name} title={c.reason}>
                        <Chip label={`${c.name} (${c.role})`} size="small" variant="outlined" />
                      </Tooltip>
                    ))}
                  </Box>
                </Box>
              )}
              <ConfidenceBar value={projectSetup.confidence} label="Sikkerhet" />
              <Typography variant="caption" color="text.secondary">
                Basert på {projectSetup.basedOn} tidligere prosjekt(er)
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        {timeline ? (
          <Box>
            {timeline.growthSummary && (
              <Alert severity="success" icon={<TrendingUpIcon />} sx={{ mb: 2 }}>
                {timeline.growthSummary}
              </Alert>
            )}

            {/* Milestones */}
            {timeline.milestones.length > 0 && (
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <FlagIcon fontSize="small" color="warning" /> Milepæler
                  </Typography>
                  {timeline.milestones.map((m, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                      <FlagIcon fontSize="small" color="warning" sx={{ mt: 0.3 }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{m.title}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(m.date).toLocaleDateString('no-NO')} — {m.description}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Event timeline */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Hendelseslogg ({timeline.events.length})</Typography>
            <Box sx={{ borderLeft: '2px solid', borderColor: 'divider', pl: 2, ml: 1 }}>
              {timeline.events.slice(0, 30).map((event, i) => (
                <Box key={i} sx={{ mb: 1.5, position: 'relative' }}>
                  <DotIcon
                    sx={{
                      position: 'absolute', left: -27, top: 2,
                      fontSize: 12,
                      color: event.type === 'milestone' ? 'warning.main' :
                             event.type === 'project_created' ? 'success.main' :
                             event.type === 'pattern_discovered' ? 'info.main' : 'text.disabled',
                    }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{event.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(event.date).toLocaleDateString('no-NO')} — {event.description}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        ) : (
          <Alert severity="info" sx={{ mt: 1 }}>
            Klikk "Last tidslinje" for å se din utviklingshistorie som filmskaper.
          </Alert>
        )}
      </TabPanel>
    </Paper>
  );
}

// ─── Helper subcomponents ───

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ textAlign: 'center', p: 1 }}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Box>
  );
}

function PatternIcon({ type }: { type: string }) {
  switch (type) {
    case 'crew_preference': return <GroupsIcon fontSize="small" color="primary" />;
    case 'team_composition': return <HandshakeIcon fontSize="small" color="success" />;
    case 'budget_pattern': return <TrendingUpIcon fontSize="small" color="warning" />;
    case 'genre_tendency': return <StarIcon fontSize="small" color="secondary" />;
    case 'location_preference': return <InfoIcon fontSize="small" color="info" />;
    default: return <InsightsIcon fontSize="small" />;
  }
}

function patternTypeLabel(type: string): string {
  switch (type) {
    case 'crew_preference': return 'Crew-preferanse';
    case 'team_composition': return 'Teamsammensetning';
    case 'budget_pattern': return 'Budsjettmønster';
    case 'genre_tendency': return 'Sjangertendens';
    case 'location_preference': return 'Lokasjonspreferanse';
    default: return type;
  }
}

function prefKeyLabel(key: string): string {
  const labels: Record<string, string> = {
    default_call_time: 'Standard oppmøtetid',
    preferred_currency: 'Foretrukket valuta',
    preferred_project_type: 'Foretrukket prosjekttype',
    top_equipment_categories: 'Topp utstyrskategorier',
    core_departments: 'Kjerneavdelinger',
  };
  return labels[key] || key.replace(/_/g, ' ');
}
