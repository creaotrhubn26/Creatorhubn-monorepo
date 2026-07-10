import React from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowForward,
  AutoAwesome,
  CalendarMonth,
  Forum,
  HelpOutline,
  MenuBook,
  NotificationsActive,
  OndemandVideo,
  School,
  WorkspacePremium,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';
import { useCommunityLocale } from './communityLocale';

interface CommunityHomeQuestion {
  id: string;
  content: string;
  user_name: string;
  user_avatar?: string;
  channel_name: string;
  channel_id?: string;
  created_at: string;
  hours_waiting: number;
}

interface CommunityHomeMessage {
  id: string;
  channel_id: string;
  content: string;
  created_at: string;
  user_name: string;
  user_avatar?: string | null;
  is_solution?: boolean;
  thread_count?: number;
  message_type?: string;
  attachments?: any[];
}

interface CommunityHomeChannel {
  id: string;
  display_name: string;
  description: string;
  unread_count?: number;
}

interface CommunityHomeMentor {
  id: string;
  name: string;
  avatar?: string | null;
}

interface CommunityBadgeTrack {
  id: string;
  label: string;
  detail: string;
  current: number;
  target: number;
  accent: string;
}

interface CommunityUpcomingEvent {
  id: string;
  title: string;
  subtitle: string;
  dateLabel: string;
  type: string;
}

interface CommunityHomeDashboardProps {
  userName: string;
  interests: string[];
  stats: {
    messages: number;
    reactions: number;
    solutions: number;
  };
  needsHelp: CommunityHomeQuestion[];
  yourThreads: CommunityHomeMessage[];
  knowledgeFeed: CommunityHomeMessage[];
  academyAnnouncements: CommunityHomeMessage[];
  mentorsOnline: CommunityHomeMentor[];
  badgeTracks: CommunityBadgeTrack[];
  upcomingEvents: CommunityUpcomingEvent[];
  recommendedChannel?: CommunityHomeChannel | null;
  onOpenChannel: (channelId: string) => void;
  onOpenDiscussion: (channelId: string, messageId: string) => void;
  onSelectQuestion: (question: CommunityHomeQuestion) => void;
  onUsePrompt: (prompt: string, channelId?: string) => void;
  onOpenAcademy: () => void;
  onOpenNotifications: () => void;
  onOpenMentorDashboard: () => void;
  onBecomeMentor: () => void;
  onOpenPublishDialog: () => void;
  isMentor: boolean;
  mentorEligible: boolean;
}

const SHELL_TEXT = 'rgba(255, 255, 255, 0.92)';
const SHELL_MUTED = 'rgba(255, 255, 255, 0.64)';
const SHELL_BORDER = '1px solid rgba(255,255,255,0.08)';
const SHELL_PANEL =
  'linear-gradient(180deg, rgba(13, 18, 27, 0.94), rgba(8, 12, 18, 0.94))';
const SHELL_SHADOW = '0 24px 60px rgba(0, 0, 0, 0.36)';

const summarize = (value: string, max = 92) => {
  if (!value) return 'Ingen beskrivelse tilgjengelig.';
  if (value.length <= max) return value;
  return `${value.slice(0, max).trim()}...`;
};

const formatRelative = (value: string) =>
  formatDistanceToNow(new Date(value), {
    addSuffix: true,
    locale: nb,
  });

const metricCardSx = {
  p: 2,
  borderRadius: 3,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
} as const;

const surfaceCardSx = {
  borderRadius: 4,
  background: SHELL_PANEL,
  border: SHELL_BORDER,
  boxShadow: SHELL_SHADOW,
  color: SHELL_TEXT,
} as const;

export default function CommunityHomeDashboard({
  userName,
  interests,
  stats,
  needsHelp,
  yourThreads,
  knowledgeFeed,
  academyAnnouncements,
  mentorsOnline,
  badgeTracks,
  upcomingEvents,
  recommendedChannel,
  onOpenChannel,
  onOpenDiscussion,
  onSelectQuestion,
  onUsePrompt,
  onOpenAcademy,
  onOpenNotifications,
  onOpenMentorDashboard,
  onBecomeMentor,
  onOpenPublishDialog,
  isMentor,
  mentorEligible,
}: CommunityHomeDashboardProps) {
  const { tt } = useCommunityLocale();
  return (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      <Card sx={surfaceCardSx}>
        <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.25fr) minmax(320px, 0.75fr)' },
              gap: 3,
              alignItems: 'start',
            }}
          >
            <Box>
              <Chip
                label={tt('Community-hjem', 'Community home')}
                size="small"
                sx={{
                  mb: 1.5,
                  bgcolor: 'rgba(255, 140, 0, 0.14)',
                  color: '#ff8c00',
                  border: '1px solid rgba(255, 140, 0, 0.2)',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              />
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  maxWidth: '12ch',
                  color: SHELL_TEXT,
                }}
              >
                {tt(`Hei ${userName.split(' ')[0]}, her er pulsen i community.`, `Hi ${userName.split(' ')[0]}, here is the pulse of the community.`)}
              </Typography>
              <Typography
                variant="body1"
                sx={{ mt: 1.4, maxWidth: 680, color: SHELL_MUTED, lineHeight: 1.7 }}
              >
                {tt('Prioriter svar, bygg kunnskap, og koble Academy tettere til fellesskapet uten å miste oversikten.', 'Prioritize answers, build knowledge, and connect Academy more closely to the community without losing the overview.')}
              </Typography>
              {interests.length > 0 && (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
                  {interests.map((interest) => (
                    <Chip
                      key={interest}
                      label={interest}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.05)',
                        color: SHELL_TEXT,
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    />
                  ))}
                </Stack>
              )}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mt: 2.5 }}>
                {recommendedChannel && (
                  <Button
                    variant="contained"
                    endIcon={<ArrowForward />}
                    onClick={() => onOpenChannel(recommendedChannel.id)}
                    sx={{
                      borderRadius: 999,
                      bgcolor: '#ff8c00',
                      color: '#0a0f1a',
                      fontWeight: 700,
                      '&:hover': {
                        bgcolor: '#ffcd73',
                      },
                    }}
                  >
                    {tt(`Gå til #${recommendedChannel.display_name}`, `Go to #${recommendedChannel.display_name}`)}
                  </Button>
                )}
                <Button
                  variant="outlined"
                  startIcon={<NotificationsActive />}
                  onClick={onOpenNotifications}
                  sx={{
                    borderRadius: 999,
                    color: SHELL_TEXT,
                    borderColor: 'rgba(255,255,255,0.12)',
                    '&:hover': {
                      borderColor: 'rgba(255, 140, 0, 0.24)',
                      bgcolor: 'rgba(255, 140, 0, 0.08)',
                    },
                  }}
                >
                  {tt('Varslingsregler', 'Notification rules')}
                </Button>
                <Button
                  variant="text"
                  startIcon={<OndemandVideo />}
                  onClick={onOpenAcademy}
                  sx={{ color: SHELL_MUTED, justifyContent: 'flex-start' }}
                >
                  {tt('Åpne Academy', 'Open Academy')}
                </Button>
              </Stack>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 1.2,
              }}
            >
              <Box sx={metricCardSx}>
                <Typography variant="caption" sx={{ color: SHELL_MUTED }}>
                  {tt('Dine innlegg', 'Your posts')}
                </Typography>
                <Typography variant="h4" sx={{ mt: 0.6, fontWeight: 800 }}>
                  {stats.messages}
                </Typography>
              </Box>
              <Box sx={metricCardSx}>
                <Typography variant="caption" sx={{ color: SHELL_MUTED }}>
                  {tt('Løste tråder', 'Solved threads')}
                </Typography>
                <Typography variant="h4" sx={{ mt: 0.6, fontWeight: 800 }}>
                  {stats.solutions}
                </Typography>
              </Box>
              <Box sx={metricCardSx}>
                <Typography variant="caption" sx={{ color: SHELL_MUTED }}>
                  {tt('Trenger svar', 'Needs answers')}
                </Typography>
                <Typography variant="h4" sx={{ mt: 0.6, fontWeight: 800 }}>
                  {needsHelp.length}
                </Typography>
              </Box>
              <Box sx={metricCardSx}>
                <Typography variant="caption" sx={{ color: SHELL_MUTED }}>
                  {tt('Mentorer tilgjengelig', 'Mentors available')}
                </Typography>
                <Typography variant="h4" sx={{ mt: 0.6, fontWeight: 800 }}>
                  {mentorsOnline.length}
                </Typography>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.25fr) minmax(320px, 0.75fr)' },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        <Box sx={{ display: 'grid', gap: 2.5 }}>
          <Card sx={surfaceCardSx}>
            <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {tt('Spørsmål som trenger hjelp', 'Questions that need help')}
                  </Typography>
                  <Typography variant="body2" sx={{ color: SHELL_MUTED, mt: 0.4 }}>
                    {tt('Gjør community mer nyttig ved å svare der behovet er størst.', 'Make the community more useful by answering where the need is greatest.')}
                  </Typography>
                </Box>
                <Chip
                  label={needsHelp.length === 0 ? tt('Innboks ryddet', 'Inbox cleared') : tt(`${needsHelp.length} åpne`, `${needsHelp.length} open`)}
                  sx={{
                    bgcolor: needsHelp.length === 0 ? 'rgba(84, 181, 125, 0.14)' : 'rgba(255, 140, 0, 0.14)',
                    color: needsHelp.length === 0 ? '#78df9c' : '#ff8c00',
                    border: needsHelp.length === 0
                      ? '1px solid rgba(84, 181, 125, 0.2)'
                      : '1px solid rgba(255, 140, 0, 0.2)',
                  }}
                />
              </Box>

              {needsHelp.length === 0 ? (
                <Box
                  sx={{
                    p: 2.5,
                    borderRadius: 3,
                    bgcolor: 'rgba(84, 181, 125, 0.1)',
                    border: '1px solid rgba(84, 181, 125, 0.16)',
                  }}
                >
                  <Typography sx={{ color: '#d8f8e4', fontWeight: 600 }}>
                    {tt('🎉 Alle spørsmål har fått svar!', '🎉 All questions have been answered!')}
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={1.2}>
                  {needsHelp.slice(0, 4).map((question) => (
                    <Box
                      key={question.id}
                      sx={{
                        p: 2,
                        borderRadius: 3,
                        bgcolor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                        <Avatar
                          src={question.user_avatar}
                          sx={{
                            width: 40,
                            height: 40,
                            bgcolor: 'rgba(255, 140, 0, 0.18)',
                            color: '#ff8c00',
                          }}
                        >
                          {question.user_name?.[0]}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700, color: SHELL_TEXT }}>
                            {summarize(question.content)}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.4, color: SHELL_MUTED }}>
                            {question.user_name} {tt('i', 'in')} #{question.channel_name} • {formatRelative(question.created_at)}
                          </Typography>
                        </Box>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => onSelectQuestion(question)}
                          sx={{
                            borderRadius: 999,
                            borderColor: 'rgba(255, 140, 0, 0.22)',
                            color: '#ff8c00',
                            flexShrink: 0,
                          }}
                        >
                          {tt('Svar nå', 'Answer now')}
                        </Button>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
              gap: 2.5,
            }}
          >
            <Card sx={surfaceCardSx}>
              <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {tt('Dine tråder', 'Your threads')}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, color: SHELL_MUTED }}>
                  {tt('Hold oversikt over spørsmål du har startet og diskusjoner du eier.', 'Keep track of questions you have started and discussions you own.')}
                </Typography>
                <Stack spacing={1.2} sx={{ mt: 2 }}>
                  {yourThreads.length === 0 ? (
                    <Box sx={{ p: 2, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <Typography sx={{ color: SHELL_MUTED }}>
                        {tt('Ingen egne tråder ennå. Start med en introduksjon eller et konkret fagspørsmål.', 'No threads of your own yet. Start with an introduction or a specific topic question.')}
                      </Typography>
                      <Button
                        variant="text"
                        sx={{ mt: 1, color: '#ff8c00' }}
                        onClick={() =>
                          onUsePrompt(
                            tt('Hei! Jeg er ny i community. Dette jobber jeg med akkurat nå, og dette vil jeg gjerne lære mer om: ', 'Hi! I am new to the community. This is what I am working on right now, and this is what I would love to learn more about: '),
                            recommendedChannel?.id,
                          )
                        }
                      >
                        {tt('Start en intro', 'Start an intro')}
                      </Button>
                    </Box>
                  ) : (
                    yourThreads.slice(0, 4).map((thread) => (
                      <Box
                        key={thread.id}
                        sx={{
                          p: 1.7,
                          borderRadius: 3,
                          bgcolor: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <Typography sx={{ fontWeight: 700, color: SHELL_TEXT }}>
                          {summarize(thread.content, 84)}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.45, color: SHELL_MUTED }}>
                          {formatRelative(thread.created_at)}
                        </Typography>
                        <Button
                          size="small"
                          sx={{ mt: 1, color: '#ff8c00' }}
                          onClick={() => onOpenDiscussion(thread.channel_id, thread.id)}
                        >
                          {tt('Åpne tråd', 'Open thread')}
                        </Button>
                      </Box>
                    ))
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Card sx={surfaceCardSx}>
              <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {tt('Kunnskapsstrøm', 'Knowledge stream')}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, color: SHELL_MUTED }}>
                  {tt('Løste tråder og svar som bør bli til gjenbrukbar kunnskap.', 'Solved threads and answers that should become reusable knowledge.')}
                </Typography>
                <Stack spacing={1.2} sx={{ mt: 2 }}>
                  {knowledgeFeed.length === 0 ? (
                    <Box sx={{ p: 2, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <Typography sx={{ color: SHELL_MUTED }}>
                        {tt('Ingen løste diskusjoner enda. Marker nyttige svar som løsning for å bygge kunnskapsbasen.', 'No solved discussions yet. Mark useful answers as the solution to build the knowledge base.')}
                      </Typography>
                    </Box>
                  ) : (
                    knowledgeFeed.slice(0, 4).map((item) => (
                      <Box
                        key={item.id}
                        sx={{
                          p: 1.7,
                          borderRadius: 3,
                          bgcolor: item.is_solution ? 'rgba(84, 181, 125, 0.08)' : 'rgba(255,255,255,0.03)',
                          border: item.is_solution
                            ? '1px solid rgba(84, 181, 125, 0.14)'
                            : '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.7 }}>
                          <Chip
                            label={item.is_solution ? tt('Løsning', 'Solution') : tt(`${item.thread_count || 0} svar`, `${item.thread_count || 0} replies`)}
                            size="small"
                            sx={{
                              bgcolor: item.is_solution ? 'rgba(84, 181, 125, 0.14)' : 'rgba(255, 140, 0, 0.14)',
                              color: item.is_solution ? '#78df9c' : '#ff8c00',
                            }}
                          />
                          <Typography variant="caption" sx={{ color: SHELL_MUTED }}>
                            {item.user_name}
                          </Typography>
                        </Stack>
                        <Typography sx={{ fontWeight: 700, color: SHELL_TEXT }}>
                          {summarize(item.content, 86)}
                        </Typography>
                        <Button
                          size="small"
                          sx={{ mt: 1, color: '#ff8c00' }}
                          onClick={() => onOpenDiscussion(item.channel_id, item.id)}
                        >
                          {tt('Les svar', 'Read answer')}
                        </Button>
                      </Box>
                    ))
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gap: 2.5 }}>
          <Card sx={surfaceCardSx}>
            <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
              <Stack direction="row" spacing={1.2} alignItems="center">
                <School sx={{ color: '#ff8c00' }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {tt('Mentorer pålogget', 'Mentors online')}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ mt: 0.5, color: SHELL_MUTED }}>
                {tt('Send spørsmål dit ekspertisen faktisk finnes.', 'Send questions where the expertise actually is.')}
              </Typography>
              <Stack spacing={1.1} sx={{ mt: 2 }}>
                {mentorsOnline.length === 0 ? (
                  <Typography sx={{ color: SHELL_MUTED }}>
                    {tt('Ingen mentorer er synlige akkurat nå. Bruk hjelpekøen eller send SOS når noe haster.', 'No mentors are visible right now. Use the help queue or send an SOS when something is urgent.')}
                  </Typography>
                ) : (
                  mentorsOnline.slice(0, 5).map((mentor) => (
                    <Box key={mentor.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                      <Avatar src={mentor.avatar || undefined} sx={{ width: 34, height: 34 }}>
                        {mentor.name?.[0]}
                      </Avatar>
                      <Typography sx={{ color: SHELL_TEXT }}>{mentor.name}</Typography>
                    </Box>
                  ))
                )}
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={onOpenMentorDashboard}
                  sx={{
                    borderRadius: 999,
                    borderColor: 'rgba(255,255,255,0.12)',
                    color: SHELL_TEXT,
                  }}
                >
                  {tt('Åpne mentorflyt', 'Open mentor flow')}
                </Button>
                {!isMentor && mentorEligible && (
                  <Button
                    variant="contained"
                    onClick={onBecomeMentor}
                    sx={{
                      borderRadius: 999,
                      bgcolor: '#ff8c00',
                      color: '#0a0f1a',
                    }}
                  >
                    {tt('Bli mentor', 'Become a mentor')}
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card sx={surfaceCardSx}>
            <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
              <Stack direction="row" spacing={1.2} alignItems="center">
                <WorkspacePremium sx={{ color: '#ff8c00' }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {tt('Merkeprogresjon', 'Badge progress')}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ mt: 0.5, color: SHELL_MUTED }}>
                {tt('Gjør merker nyttige ved å koble dem til konkret verdi og progresjon.', 'Make badges useful by connecting them to concrete value and progress.')}
              </Typography>
              <Stack spacing={1.4} sx={{ mt: 2 }}>
                {badgeTracks.map((track) => {
                  const progress = Math.min(100, Math.round((track.current / track.target) * 100));
                  return (
                    <Box key={track.id}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                        <Typography sx={{ color: SHELL_TEXT, fontWeight: 700 }}>
                          {track.label}
                        </Typography>
                        <Typography variant="caption" sx={{ color: SHELL_MUTED }}>
                          {track.current}/{track.target}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ mt: 0.3, color: SHELL_MUTED }}>
                        {track.detail}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{
                          mt: 1,
                          height: 8,
                          borderRadius: 999,
                          bgcolor: 'rgba(255,255,255,0.08)',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 999,
                            background: `linear-gradient(90deg, ${track.accent}, #ff8c00)`,
                          },
                        }}
                      />
                    </Box>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>

          <Card sx={surfaceCardSx}>
            <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
              <Stack direction="row" spacing={1.2} alignItems="center">
                <CalendarMonth sx={{ color: '#ff8c00' }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {tt('Kommende økter', 'Upcoming sessions')}
                </Typography>
              </Stack>
              <Stack spacing={1.2} sx={{ mt: 2 }}>
                {upcomingEvents.map((event) => (
                  <Box
                    key={event.id}
                    sx={{
                      p: 1.8,
                      borderRadius: 3,
                      bgcolor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <Chip
                      label={event.type}
                      size="small"
                      sx={{
                        mb: 1,
                        bgcolor: 'rgba(255, 140, 0, 0.14)',
                        color: '#ff8c00',
                      }}
                    />
                    <Typography sx={{ color: SHELL_TEXT, fontWeight: 700 }}>
                      {event.title}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.3, color: SHELL_MUTED }}>
                      {event.subtitle}
                    </Typography>
                    <Typography variant="caption" sx={{ mt: 0.8, display: 'block', color: SHELL_MUTED }}>
                      {event.dateLabel}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card sx={surfaceCardSx}>
            <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
              <Stack direction="row" spacing={1.2} alignItems="center">
                <MenuBook sx={{ color: '#ff8c00' }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {tt('Academy + fellesskapet', 'Academy + the community')}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ mt: 0.5, color: SHELL_MUTED }}>
                {tt('Flytt læring ut av video og inn i praktiske diskusjoner.', 'Move learning out of video and into practical discussions.')}
              </Typography>
              <Stack spacing={1.1} sx={{ mt: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<Forum />}
                  onClick={() =>
                    onUsePrompt(
                      tt('Jeg jobber med en Academy-leksjon akkurat nå og trenger sparring på dette punktet: ', 'I am working on an Academy lesson right now and need sparring on this point: '),
                      recommendedChannel?.id,
                    )
                  }
                  sx={{
                    justifyContent: 'flex-start',
                    borderRadius: 999,
                    borderColor: 'rgba(255,255,255,0.12)',
                    color: SHELL_TEXT,
                  }}
                >
                  {tt('Spør community om leksjon', 'Ask the community about a lesson')}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<AutoAwesome />}
                  onClick={() =>
                    onUsePrompt(
                      tt('Dette er min viktigste takeaway fra Academy i dag. Hvordan ville dere brukt dette i praksis? ', 'This is my most important takeaway from Academy today. How would you use this in practice? '),
                      recommendedChannel?.id,
                    )
                  }
                  sx={{
                    justifyContent: 'flex-start',
                    borderRadius: 999,
                    borderColor: 'rgba(255,255,255,0.12)',
                    color: SHELL_TEXT,
                  }}
                >
                  {tt('Del takeaway', 'Share takeaway')}
                </Button>
                {isMentor && (
                  <Button
                    variant="contained"
                    startIcon={<OndemandVideo />}
                    onClick={onOpenPublishDialog}
                    sx={{
                      borderRadius: 999,
                      bgcolor: '#ff8c00',
                      color: '#0a0f1a',
                      '&:hover': {
                        bgcolor: '#ffcd73',
                      },
                    }}
                  >
                    {tt('Publiser Academy-kurs', 'Publish Academy course')}
                  </Button>
                )}
              </Stack>
              {academyAnnouncements.length > 0 && (
                <>
                  <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.08)' }} />
                  <Stack spacing={1}>
                    {academyAnnouncements.slice(0, 2).map((announcement) => {
                      const attachment = announcement.attachments?.[0];
                      return (
                        <Box key={announcement.id} sx={{ p: 1.6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.03)' }}>
                          <Typography sx={{ color: SHELL_TEXT, fontWeight: 700 }}>
                            {attachment?.title || summarize(announcement.content, 72)}
                          </Typography>
                          <Button
                            size="small"
                            sx={{ mt: 0.8, color: '#ff8c00' }}
                            onClick={() => onOpenDiscussion(announcement.channel_id, announcement.id)}
                          >
                            {tt('Åpne diskusjon', 'Open discussion')}
                          </Button>
                        </Box>
                      );
                    })}
                  </Stack>
                </>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
