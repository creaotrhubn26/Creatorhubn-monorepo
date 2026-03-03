/**
 * Tutorial Selection Notification System - Automatisk beskjed til den som laget beste tutorial
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Chip,
  Divider,
  LinearProgress,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  Star as StarIcon,
  TrendingUp as ScoreIcon,
  VideoLibrary as VideoIcon,
  PhotoLibrary as PhotoIcon,
  CheckCircle as SelectedIcon,
  Cancel as NotSelectedIcon,
  Quiz as FAQIcon,
  Person as PersonIcon,
  Chat as ChatIcon,
  Notifications as NotificationIcon,
} from '@mui/icons-material';

interface TutorialComparison {
  id: string;
  title: string;
  submitterName: string;
  submitterId: string;
  type: 'video' | 'mixed';
  qualityScore: number;
  steps: number;
  userRating: number;
  submittedAt: string;
  selected: boolean;
  competitorCount: number
}

interface TutorialSelectionNotificationSystemProps {
  open: boolean;
  onClose: () => void;
  selectedTutorialId?: string;
  competingTutorials?: TutorialComparison[];
  onSendNotification?: (userId: string, message: string) => void
}

export const TutorialSelectionNotificationSystem: React.FC<
  TutorialSelectionNotificationSystemProps
> = ({ open, onClose, selectedTutorialId, competingTutorials = [], onSendNotification }) => {
  const [showCelebration, setShowCelebration] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [notificationSent, setNotificationSent] = useState(false);

  // Mock data for demonstration
  const mockCompetingTutorials: TutorialComparison[] = [
    {
      id: 'tutorial_001',
      title: 'ProjectCreationWithMemoryCards Advanced Tutorial',
      submitterName: 'Erik Andersen',
      submitterId: 'user_001',
      type: 'video',
      qualityScore:  92,
      steps:  12,
      userRating: 4.8,
      submittedAt: '2025-01-28T14:30:00',
      selected: true,
      competitorCount:  3,
  },
    {
      id: 'tutorial_002',
      title: 'ProjectCreation Quick Guide',
      submitterName: 'Maria Olsen',
      submitterId: 'user_002',
      type: 'mixed',
      qualityScore:  78,
      steps:  6,
      userRating: 4.2,
      submittedAt: '2025-01-28T16:45:00',
      selected: false,
      competitorCount:  3,
  },
    {
      id: 'tutorial_003',
      title: 'Basic Project Setup Tutorial',
      submitterName: 'Lars Hansen',
      submitterId: 'user_003',
      type: 'video',
      qualityScore:  85,
      steps:  8,
      userRating: 4.5,
      submittedAt: '2025-01-27T10:20:00',
      selected: false,
      competitorCount:  3,
  },
  ];

  const tutorials = competingTutorials.length > 0 ? competingTutorials : mockCompetingTutorials;
  const selectedTutorial = tutorials.find((t) => t.selected);
  const nonSelectedTutorials = tutorials.filter((t) => !t.selected);

  // Calculate final score
  const calculateFinalScore = (tutorial: TutorialComparison): number => {
    const qualityWeight = 0.4;
    const typeBonus = tutorial.type === 'video' ? 10 : 0;
    const stepsBonus = Math.min(tutorial.steps * 2, 20);
    const ratingBonus = tutorial.userRating * 10;

    return Math.round(tutorial.qualityScore * qualityWeight + typeBonus + stepsBonus + ratingBonus);
};

  // Calculate points earned
  const calculatePointsEarned = (tutorial: TutorialComparison): number => {
    const basePoints = 100;
    const qualityMultiplier = tutorial.qualityScore / 100;
    const typeMultiplier = tutorial.type === 'video' ? 1.5 : 1.0;
    const competitionBonus = tutorial.competitorCount * 25; // Bonus for beating competition
    const selectionBonus = 150; // Extra bonus for being selected as best

    return Math.round(
      basePoints * qualityMultiplier * typeMultiplier + competitionBonus + selectionBonus,
    );
};

  const sendAutomaticNotifications = async () => {
    if (!selectedTutorial || notificationSent) return;

    try {
      const pointsEarned = calculatePointsEarned(selectedTutorial);
      const finalScore = calculateFinalScore(selectedTutorial);

      // Message for winner
      const winnerMessage = `🎉 GRATULERER! Din tutorial ble valgt som den beste!

🏆 "${selectedTutorial.title}" ble valgt av admin som den beste veiledningen blant ${selectedTutorial.competitorCount} konkurrerende tutorials!

📊 SCORE RESULTAT: • Kvalitetsscore: ${selectedTutorial.qualityScore}%
• Type bonus: ${selectedTutorial.type === 'video' ? '+10 (Video)' : '+0 (Mixed)'}
• Steg bonus: +${Math.min(selectedTutorial.steps * 2, 20)}
• Rating bonus: +${selectedTutorial.userRating * 10}
• Konkurranse bonus: +${selectedTutorial.competitorCount * 25}
• Utvalgt bonus: +150
─────────────────
🎯 TOTAL SCORE: ${finalScore} poeng
💰 POENG OPPTJENT: ${pointsEarned} CreatorHub Verified poeng!

🙏 Tusen takk for ditt fantastiske bidrag til CreatorHub Norge!
Din tutorial er nå publisert i FAQ-systemet og hjelper hele fellesskapet.`;

      // Send notification to winner
      if (onSendNotification) {
        onSendNotification(selectedTutorial.submitterId, winnerMessage);
    }

      // Send notifications to non-winners
      for (const tutorial of nonSelectedTutorials) {
        const runnerUpMessage = `📝 Tutorial Oppdatering

Din tutorial "${tutorial.title}" ble vurdert av admin.

Selv om den ikke ble valgt denne gangen, setter CreatorHub Norge stor pris på ditt bidrag!

📊 Din Score: ${calculateFinalScore(tutorial)} poeng
🏆 Vinnende tutorial: "${selectedTutorial.title}" (${calculateFinalScore(selectedTutorial)} poeng)

💡 Tips for neste gang: • Video-tutorials får høyere score enn mixed media
• Grundigere tutorials (flere steg) belønnes
• Høy kvalitetsscore øker sjansene

Fortsett å bidra - din neste tutorial kan være den neste vinneren! 🚀`;

        if (onSendNotification) {
          onSendNotification(tutorial.submitterd, runnerUpMessage);
      }
    }

      setNotificationSent(true);
      setShowCelebration(true);

      console.log('📧 Automatic notifications sent to all tutorial submitters');
  } catch (error) {
      console.error('❌ Failed to send notifications: ', error);
  }
};

  useEffect(() => {
    if (open && selectedTutorial && !notificationSent) {
      // Send notifications automatically when dialog opens
      setTimeout(sendAutomaticNotifications, 1000);
  }
}, [open, selectedTutorial, notificationSent]);

  if (!selectedTutorial) {
    return (
      <Dialog open={open} onClose={onClose}>
        <DialogContent>
          <Alert severity="error">❌ Ingen tutorial er valgt som vinner enda.</Alert>
        </DialogContent>
      </Dialog>
    );
}

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ textAlign: 'center', bgcolor: 'rgba(25,193,7,0.1)' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap:  2}}
          >
            <TrophyIcon sx={{ fontSize:  40, color: 'gold'}} />
            <Typography variant="h4" sx={{  color: 'gold', fontWeight: 'bold' }}>
              🏆 VINNER VALGT!
            </Typography>
            <TrophyIcon sx={{ fontSize:  40, color: 'gold'}} />
          </Box>
        </DialogTitle>

        <DialogContent sx={{ bgcolor: 'rgba(25,255,255,0.95)' }}>
          {/* Winner Announcement */}
          <Card
            sx={{
              mb:  3,
              border: '3px solid gold',
              bgcolor: 'rgba(25,215,0,0.1)'}}
           sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ textAlign: 'center', mb:  3 }}>
                <Avatar
                  sx={{
                    width:  80,
                    height:  80,
                    bgcolor: 'gold',
                    color: 'white',
                    mx: 'auto',
                    mb:  2,
                    fontSize: '2rem'}}
                >
                  <TrophyIcon sx={{ fontSize: '3rem'}} />
                </Avatar>
                <Typography variant="h5" sx={{  fontWeight: 'bold', color: 'gold', mb:  1  }}>
                  "{selectedTutorial.title}"
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
                  av {selectedTutorial.submitterName}
                </Typography>
              </Box>

              {/* Score Breakdown */}
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    📊 Score Oppbygning
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <ScoreIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Kvalitetsscore"
                        secondary={`${selectedTutorial.qualityScore}% (×0.4 = ${(selectedTutorial.qualityScore * 0.4).toFixed(1)})`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        {selectedTutorial.type === 'video' ? <VideoIcon /> : <PhotoIcon />}
                      </ListItemIcon>
                      <ListItemText
                        primary="Type Bonus"
                        secondary={selectedTutorial.type === 'video' ? '+10 (Video)' : '+0 (Mixed)'}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <StarIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Steg Bonus"
                        secondary={`${selectedTutorial.steps} steg = +${Math.min(selectedTutorial.steps * 2, 20)}`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <StarIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Rating Bonus"
                        secondary={`${selectedTutorial.userRating}⭐ = +${selectedTutorial.userRating * 10}`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <TrophyIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Konkurranse Bonus"
                        secondary={`${selectedTutorial.competitorCount} konkurrenter = +${selectedTutorial.competitorCount * 25}`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <SelectedIcon />
                      </ListItemIcon>
                      <ListItemText primary="Utvalgt Bonus" secondary="+150 (Valgt som beste)" />
                    </ListItem>
                  </List>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    🎯 Resultat
                  </Typography>
                  <Box
                    sx={{
                      textAlign: 'center',
                      p:  3,
                      bgcolor: 'rgba(6,175,80,0.1)',
                      borderRadius:  2}}
                  >
                    <Typography variant="h3"
                      sx={{  color: 'success.main', fontWeight: 'bold', mb:  1  }}>
                      {calculateFinalScore(selectedTutorial)}
                    </Typography>
                    <Typography variant="h6" color="text.secondary" sx={{  mb:  2  }}>
                      Total Score
                    </Typography>

                    <Divider sx={{ my:  2 }} />

                    <Typography variant="h4" sx={{  color: 'gold', fontWeight: 'bold' }}>
                      +{calculatePointsEarned(selectedTutorial)}
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary">
                      CreatorHub Verified Poeng
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Competition Results */}
          <Typography variant="h6"
            gutterBottom
            sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
            <TrophyIcon color="warning" />
            Konkurranse Resultater ({tutorials.length} deltakere)
          </Typography>

          <Grid container spacing={2}>
            {tutorials
              .sort((a, b) => calculateFinalScore(b) - calculateFinalScore(a))
              .map((tutorial, index) => (
                <Grid item xs={12} md={6} key={tutorial.id}>
                  <Card
                    sx={{
                      border: tutorial.selected ? '2px solid gold' : '1px solid #ddd',
                      bgcolor: tutorial.selected ? 'rgba(25,215,0,0.1)' : 'white'}}
                   sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap:  2,
                          mb:  2}}
                      >
                        <Typography variant="h6"
                          sx={{ 
                            color: index === 0
                                ? 'gold'
                                : index === 1
                                  ? 'silver'
                                  : index === 2
                                    ? '#CD7F32'
                                    : 'text.primary',
                            fontWeight: 'bold' }}>
                          #{index + 1}
                        </Typography>
                        <Avatar
                          sx={{
                            bgcolor: tutorial.selected ? 'gold' : 'grey.30'}}
                        >
                          {tutorial.selected ? <SelectedIcon /> : <NotSelectedIcon />}
                        </Avatar>
                        <Box sx={{ flex:  1 }}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {tutorial.submitterName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {tutorial.title}
                          </Typography>
                        </Box>
                        <Typography variant="h6" fontWeight="bold" sx={{ color: theming.colors.primary }}>
                          {calculateFinalScore(tutorial)}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap'}}>
                        <Chip label={`${tutorial.qualityScore}%`} size="small" color="primary" />
                        <Chip
                          label={tutorial.type === 'video' ? '🎥 Video' : '📸 Mixed'}
                          size="small"
                          color={tutorial.type === 'video' ? 'success' : 'secondary'}
                        />
                        <Chip label={`${tutorial.steps} steg`} size="small" />
                        <Chip label={`${tutorial.userRating}⭐`} size="small" color="warning" />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
          </Grid>

          {/* Notification Status */}
          <Alert
            severity={notificationSent ? 'success' : 'info'}
            sx={{ mt:  3 }}
            icon={notificationSent ? theming.getThemedIcon('checkCircle') : <NotificationIcon />}
          >
            {notificationSent ? (
              <>
                ✅ <strong>Automatiske notifikasjoner sendt!</strong>
                <br />
                📧 Vinneren har fått detaljert score-rapport via chat
                <br />
                📝 Andre deltakere har fått oppmuntrende tilbakemelding
              </>
            ) : (
              <>
                ⏳ <strong>Sender automatiske notifikasjoner...</strong>
                <br />
                💬 Chat-meldinger sendes til alle deltakere med score-resultater
              </>
            )}
          </Alert>

          {/* CreatorHub Norge Message */}
          <Box
            sx={{
              mt:  3,
              p:  2,
              bgcolor: 'rgba(5,118,210,0.1)',
              borderRadius:  1}}
          >
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic'}}>
              🙏 <strong>CreatorHub Norge takker alle som bidro!</strong>
              <br />
              Kun den beste tutorialen får poeng, men alle bidrag styrker fellesskapet.
              <br />
              💡 Fortsett å lage tutorials - din neste kan være vinneren!
            </Typography>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} variant="contained" color="primary" sx={theming.getThemedButtonSx()}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      {/* Celebration Effect */}
      {showCelebration && (
        <Box
          sx={{
            position: 'fixed',
            top:  0,
            left:  0,
            width: '100vw',
            height: '100vh',
            pointerEvents:'none',
            zIndex: 99}}
        >
          {/* Confetti animation could be added here */}
        </Box>
      )}
    </>
  );
};
