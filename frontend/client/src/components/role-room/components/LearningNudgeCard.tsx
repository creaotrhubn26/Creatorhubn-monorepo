/**
 * LearningNudgeCard.tsx
 *
 * A compact dashboard card that shows learning intelligence insights.
 * Self-manages userId via authSessionService — no props needed.
 * Displays greeting, top nudges, and key stats from the learning engine.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Typography,
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  Lightbulb as LightbulbIcon,
  TrendingUp as TrendingUpIcon,
  Groups as GroupsIcon,
} from '@mui/icons-material';
import { learningApi, type LearningSnapshot } from '../services/roleRoomLearningApi';
import { authSessionService } from '../services/authSessionService';

function getUserId(): string {
  const session = authSessionService.getSessionSync();
  if (session.currentUserId) return session.currentUserId;
  if (session.adminUser?.id !== undefined && session.adminUser?.id !== null) {
    return String(session.adminUser.id);
  }
  return 'default';
}

export function LearningNudgeCard() {
  const [snapshot, setSnapshot] = useState<LearningSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const uid = getUserId();
      if (uid === 'default') return;
      const snap = await learningApi.snapshot.get(uid);
      setSnapshot(snap);
    } catch {
      // silent — learning data is optional
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !snapshot) return null;

  const { userInsights, teamReport, nudges, greeting } = snapshot;
  const hasData = userInsights && userInsights.totalEventsAnalyzed > 0;

  if (!hasData && nudges.length === 0) return null;

  return (
    <Card sx={{
      bgcolor: 'rgba(168, 85, 247, 0.06)',
      border: '1px solid rgba(168, 85, 247, 0.25)',
      mb: { xs: 2, sm: 2.5 },
    }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <PsychologyIcon sx={{ color: '#a855f7', fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem' }}>
            Læringsmotor
          </Typography>
          <Chip label="Always Learning" size="small" variant="outlined"
            sx={{ ml: 'auto', borderColor: 'rgba(168,85,247,0.4)', color: '#a855f7', fontSize: '0.65rem', height: 20 }}
          />
        </Box>

        {/* Greeting */}
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1, fontSize: '0.8rem' }}>
          {greeting}
        </Typography>

        {/* Key stats row */}
        {userInsights && (
          <Box sx={{ display: 'flex', gap: 2, mb: 1, flexWrap: 'wrap' }}>
            <MiniStat icon={<TrendingUpIcon sx={{ fontSize: 14 }} />} label="Prosjekter" value={String(userInsights.engagementMetrics.totalProjects)} color="#10b981" />
            <MiniStat icon={<GroupsIcon sx={{ fontSize: 14 }} />} label="Teammedlemmer" value={String(teamReport.members.length)} color="#00d4ff" />
            <MiniStat icon={<PsychologyIcon sx={{ fontSize: 14 }} />} label="Hendelser" value={String(userInsights.totalEventsAnalyzed)} color="#a855f7" />
          </Box>
        )}

        {/* Confidence */}
        {userInsights && (
          <Box sx={{ mb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>
                Datakvalitet
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>
                {Math.round(userInsights.confidenceScore * 100)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.round(userInsights.confidenceScore * 100)}
              sx={{
                height: 4, borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.1)',
                '& .MuiLinearProgress-bar': { bgcolor: '#a855f7' },
              }}
            />
          </Box>
        )}

        {/* Nudges */}
        {nudges.slice(0, 2).map((nudge, i) => (
          <Alert
            key={i}
            severity="info"
            icon={<LightbulbIcon sx={{ fontSize: 16 }} />}
            sx={{
              mb: 0.5, py: 0, bgcolor: 'rgba(168,85,247,0.08)',
              border: '1px solid rgba(168,85,247,0.15)',
              '& .MuiAlert-message': { py: 0.5, fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)' },
              '& .MuiAlert-icon': { py: 0.5 },
            }}
          >
            {nudge}
          </Alert>
        ))}
      </CardContent>
    </Card>
  );
}

function MiniStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{ color, display: 'flex', alignItems: 'center' }}>{icon}</Box>
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>{label}:</Typography>
      <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, fontSize: '0.75rem' }}>{value}</Typography>
    </Box>
  );
}
