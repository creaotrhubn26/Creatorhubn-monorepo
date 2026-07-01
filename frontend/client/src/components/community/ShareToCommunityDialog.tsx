// @ts-nocheck
/**
 * Share to Community Dialog
 * 
 * Allows users to share showcase items, portfolio pieces, and project files
 * to community channels for feedback, discussion, or inspiration sharing
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Avatar,
  Card,
  CardMedia,
  CardContent,
  FormControlLabel,
  Switch,
  Autocomplete,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
} from '@mui/material';
import {
  Close,
  Image,
  VideoLibrary,
  MusicNote,
  Description,
  Group,
  Forum,
  School,
  Star,
  Send,
  Feedback,
  Lightbulb,
  ThumbUp,
  Share,
  CheckCircle,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useDynamicProfessions } from '@/components/universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import {
  COMMUNITY_DIALOG_ACTIONS_SX,
  COMMUNITY_DIALOG_CLOSE_BUTTON_SX,
  COMMUNITY_DIALOG_CONTENT_SX,
  COMMUNITY_DIALOG_FIELD_SX,
  COMMUNITY_DIALOG_MUTED,
  COMMUNITY_DIALOG_PAPER_SX,
  COMMUNITY_DIALOG_PRIMARY_BUTTON_SX,
  COMMUNITY_DIALOG_SECONDARY_BUTTON_SX,
  COMMUNITY_DIALOG_SURFACE_SUBTLE_SX,
  COMMUNITY_DIALOG_SWITCH_SX,
  COMMUNITY_DIALOG_SX,
  COMMUNITY_DIALOG_TEXT,
  COMMUNITY_DIALOG_TITLE_SX,
} from './communityDialogStyles';

// ============================================
// INTERFACES
// ============================================

interface ShareableItem {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  fileUrl?: string;
  fileType: 'video' | 'photo' | 'audio' | 'document' | 'design';
  tags?: string[];
}

interface CommunityGroup {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

interface CommunityChannel {
  id: string;
  name: string;
  display_name: string;
  group_id: string;
  channel_type: string;
}

interface ShareToCommunityDialogProps {
  open: boolean;
  onClose: () => void;
  item: ShareableItem | null;
  items?: ShareableItem[]; // For bulk sharing
  userId: string;
  profession: string;
  onShareSuccess?: (messageId: string, channelId: string) => void;
}

// ============================================
// SHARE TYPE CONFIG
// ============================================

const shareTypes = [
  {
    id: 'showcase',
    label: 'Del arbeid',
    description: 'Del arbeidet ditt med community',
    icon: <Image />,
  },
  {
    id: 'feedback',
    label: 'Be om tilbakemelding',
    description: 'Be om konkrete tilbakemeldinger',
    icon: <Feedback />,
  },
  {
    id: 'inspiration',
    label: 'Del inspirasjon',
    description: 'Inspirer andre med arbeidet ditt',
    icon: <Lightbulb />,
  },
  {
    id: 'tutorial',
    label: 'Guide og tips',
    description: 'Vis hvordan du lagde dette',
    icon: <School />,
  },
  {
    id: 'discussion',
    label: 'Start diskusjon',
    description: 'Åpne en diskusjon om teknikker',
    icon: <Forum />,
  },
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function ShareToCommunityDialog({
  open,
  onClose,
  item,
  items = [],
  userId,
  profession,
  onShareSuccess,
}: ShareToCommunityDialogProps) {
  const { communication } = useEnhancedMasterIntegration();
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor, getProfessionIcon } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  
  // State
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [channels, setChannels] = useState<CommunityChannel[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [shareType, setShareType] = useState('showcase');
  const [message, setMessage] = useState('');
  const [feedbackQuestions, setFeedbackQuestions] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [requestMentorReview, setRequestMentorReview] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  
  // Bulk share state
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const itemsToShare = items.length > 0 ? items : item ? [item] : [];

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiRequest(`/api/community/user/${userId}/groups`);
      if (response.success) {
        setGroups(response.groups || []);
        // Auto-select profession group if available
        const professionGroup = response.groups?.find(
          (g: CommunityGroup) => g.slug.includes(profession)
        );
        if (professionGroup) {
          setSelectedGroup(professionGroup.id);
        }
      }
    } catch (error) {
      console.error('Error fetching groups: ', error);
    } finally {
      setLoading(false);
    }
  }, [userId, profession]);

  const fetchChannels = useCallback(async (groupId: string) => {
    try {
      const response = await apiRequest(`/api/community/groups/${groupId}/channels`);
      if (response.success) {
        setChannels(response.channels || []);
        // Auto-select showcase or feedback channel based on share type
        const targetChannel = response.channels?.find((c: CommunityChannel) => {
          if (shareType === 'feedback') return c.channel_type === 'feedback' || c.name.includes('feedback');
          if (shareType === 'tutorial') return c.channel_type === 'learning' || c.name.includes('tutorial');
          return c.channel_type === 'showcase' || c.name.includes('showcase');
        });
        if (targetChannel) {
          setSelectedChannel(targetChannel.id);
        }
      }
    } catch (error) {
      console.error('Error fetching channels: ', error);
    }
  }, [shareType]);

  useEffect(() => {
    if (open) {
      fetchGroups();
      setShareSuccess(false);
      // Pre-populate with item tags
      if (item?.tags) {
        setTags(item.tags);
      }
      // Initialize selected items for bulk share
      if (items.length > 0) {
        setSelectedItems(items.map(i => i.id));
      } else if (item) {
        setSelectedItems([item.id]);
      }
    }
  }, [open, fetchGroups, item, items]);

  useEffect(() => {
    if (selectedGroup) {
      fetchChannels(selectedGroup);
    }
  }, [selectedGroup, fetchChannels]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleShare = async () => {
    if (!selectedChannel || selectedItems.length === 0) return;

    try {
      setSharing(true);

      const itemsData = itemsToShare.filter(i => selectedItems.includes(i.id));
      
      // Build message content
      let content = message || '';
      
      if (shareType === 'feedback' && feedbackQuestions.length > 0) {
        content += '\n\n**Feedback Questions:**\n';
        feedbackQuestions.forEach((q, i) => {
          content += `${i + 1}. ${q}\n`;
        });
      }

      // Create the post
      const response = await apiRequest('/api/community/showcase/share', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          channelId: selectedChannel,
          shareType,
          message: content,
          items: itemsData.map(i => ({
            id: i.id,
            title: i.title,
            description: i.description,
            thumbnailUrl: i.thumbnailUrl,
            fileUrl: i.fileUrl,
            fileType: i.fileType,
          })),
          tags,
          requestMentorReview,
        }),
      });

      if (response.success) {
        setShareSuccess(true);
        
        // Broadcast event
        communication.sendBroadcast('community:showcase-shared', {
          messageId: response.message?.id,
          channelId: selectedChannel,
          itemCount: itemsData.length,
          shareType,
          sharedBy: userId,
        });

        onShareSuccess?.(response.message?.id, selectedChannel);

        // Auto-close after success
        setTimeout(() => {
          onClose();
          resetForm();
        }, 2000);
      }
    } catch (error) {
      console.error('Error sharing to community:', error);
    } finally {
      setSharing(false);
    }
  };

  const resetForm = () => {
    setMessage('');
    setFeedbackQuestions([]);
    setTags([]);
    setRequestMentorReview(false);
    setShareSuccess(false);
    setSelectedItems([]);
    setActiveTab(0);
  };

  const addFeedbackQuestion = () => {
    setFeedbackQuestions([...feedbackQuestions, '']);
  };

  const updateFeedbackQuestion = (index: number, value: string) => {
    const updated = [...feedbackQuestions];
    updated[index] = value;
    setFeedbackQuestions(updated);
  };

  const removeFeedbackQuestion = (index: number) => {
    setFeedbackQuestions(feedbackQuestions.filter((_, i) => i !== index));
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'photo': return <Image />;
      case 'video': return <VideoLibrary />;
      case 'audio': return <MusicNote />;
      default: return <Description />;
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (shareSuccess) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        sx={COMMUNITY_DIALOG_SX}
        PaperProps={{ sx: COMMUNITY_DIALOG_PAPER_SX }}
      >
        <DialogContent sx={COMMUNITY_DIALOG_CONTENT_SX}>
          <Box sx={{ ...COMMUNITY_DIALOG_SURFACE_SUBTLE_SX, textAlign: 'center', py: 4 }}>
            <CheckCircle sx={{ fontSize: 64, color: '#78d6a3', mb: 2 }} />
            <Typography variant="h5" gutterBottom sx={{ color: COMMUNITY_DIALOG_TEXT }}>
              Shared Successfully!
            </Typography>
            <Typography variant="body2" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
              Your {selectedItems.length > 1 ? 'items have' : 'item has'} been shared to the community.
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      sx={COMMUNITY_DIALOG_SX}
      PaperProps={{ sx: COMMUNITY_DIALOG_PAPER_SX }}
    >
      <DialogTitle sx={COMMUNITY_DIALOG_TITLE_SX}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 800, color: COMMUNITY_DIALOG_TEXT }}>
            {professionIcon && (
              <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
                {professionIcon}
              </Box>
            )}
            <Share color="primary" />
            {enhancedProfessionConfig?.displayName || professionConfig?.displayName
              ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Del i community`
              : 'Del i community'}
          </Typography>
          <IconButton onClick={onClose} size="small" sx={COMMUNITY_DIALOG_CLOSE_BUTTON_SX}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent
        sx={{
          ...COMMUNITY_DIALOG_CONTENT_SX,
          '& .MuiFormControl-root': COMMUNITY_DIALOG_FIELD_SX,
          '& .MuiTextField-root': COMMUNITY_DIALOG_FIELD_SX,
          '& .MuiAutocomplete-root': COMMUNITY_DIALOG_FIELD_SX,
          '& .MuiSwitch-root': COMMUNITY_DIALOG_SWITCH_SX,
        }}
        dividers
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ color: '#ff8c00' }} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Item Preview */}
            {itemsToShare.length === 1 && item && (
              <Card sx={{ ...COMMUNITY_DIALOG_SURFACE_SUBTLE_SX, display: 'flex', maxHeight: 120 }}>
                {item.thumbnailUrl && (
                  <CardMedia
                    component="img"
                    sx={{ width: 160 }}
                    image={item.thumbnailUrl}
                    alt={item.title}
                  />
                )}
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    {getFileIcon(item.fileType)}
                    <Typography variant="subtitle1" fontWeight={600}>
                      {item.title}
                    </Typography>
                  </Box>
                  {item.description && (
                    <Typography variant="body2" sx={{ color: COMMUNITY_DIALOG_MUTED }} noWrap>
                      {item.description}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Bulk Item Selection */}
            {itemsToShare.length > 1 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Velg hva du vil dele ({selectedItems.length} valgt)
                </Typography>
                <List dense sx={{ ...COMMUNITY_DIALOG_SURFACE_SUBTLE_SX, maxHeight: 200, overflow: 'auto' }}>
                  {itemsToShare.map((i) => (
                    <ListItem key={i.id} dense>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Checkbox
                          checked={selectedItems.includes(i.id)}
                          onChange={() => toggleItemSelection(i.id)}
                          size="small"
                        />
                      </ListItemIcon>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        {i.thumbnailUrl ? (
                          <Avatar src={i.thumbnailUrl} variant="rounded" sx={{ width: 32, height: 32 }} />
                        ) : (
                          getFileIcon(i.fileType)
                        )}
                      </ListItemIcon>
                      <ListItemText 
                        primary={i.title} 
                        primaryTypographyProps={{ fontSize: 14 }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* Share Type Selection */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Hvordan vil du dele?
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {shareTypes.map((type) => (
                  <Chip
                    key={type.id}
                    icon={type.icon}
                    label={type.label}
                    onClick={() => setShareType(type.id)}
                    color={shareType === type.id ? 'primary' : 'default'}
                    variant={shareType === type.id ? 'filled' : 'outlined'}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </Box>

            {/* Group & Channel Selection */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Community-gruppe</InputLabel>
                <Select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  label="Community-gruppe"
                >
                  {groups.map((group) => (
                    <MenuItem key={group.id} value={group.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Group fontSize="small" />
                        {group.name}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel>Kanal</InputLabel>
                <Select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  label="Kanal"
                  disabled={!selectedGroup}
                >
                  {channels.map((channel) => (
                    <MenuItem key={channel.id} value={channel.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Forum fontSize="small" />
                        {channel.display_name || channel.name}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Message */}
            <TextField
              fullWidth
              multiline
              rows={3}
              label={shareType === 'feedback' ? 'Hva vil du ha tilbakemelding på?' : 'Legg til melding'}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                shareType === 'feedback'
                  ? 'Beskriv hvilke deler du vil ha tilbakemelding på...'
                  : shareType === 'tutorial'
                  ? 'Del historien bak dette eller teknikkene du brukte...'
                  : 'Legg til kontekst eller en kort beskrivelse av det du deler...'
              }
            />

            {/* Feedback Questions */}
            {shareType === 'feedback' && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Spesifikke spørsmål (valgfritt)
                </Typography>
                {feedbackQuestions.map((q, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      value={q}
                      onChange={(e) => updateFeedbackQuestion(index, e.target.value)}
                      placeholder={`Spørsmål ${index + 1}`}
                    />
                    <IconButton size="small" onClick={() => removeFeedbackQuestion(index)}>
                      <Close fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
                <Button size="small" onClick={addFeedbackQuestion}>
                  + Legg til spørsmål
                </Button>
              </Box>
            )}

            {/* Tags */}
            <Autocomplete
              multiple
              freeSolo
              options={[]}
              value={tags}
              onChange={(_, newValue) => setTags(newValue)}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant="outlined"
                    label={option}
                    size="small"
                    {...getTagProps({ index })}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label="Tagger"
                  placeholder="Legg til tagger..."
                />
              )}
            />

            {/* Mentor Review Option */}
            {shareType === 'feedback' && (
              <FormControlLabel
                control={
                  <Switch
                    checked={requestMentorReview}
                    onChange={(e) => setRequestMentorReview(e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Be om mentorvurdering</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Få tilbakemelding fra erfarne mentorer i community
                    </Typography>
                  </Box>
                }
              />
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={COMMUNITY_DIALOG_ACTIONS_SX}>
        <Button onClick={onClose} sx={COMMUNITY_DIALOG_SECONDARY_BUTTON_SX}>Avbryt</Button>
        <Button
          variant="contained"
          onClick={handleShare}
          disabled={!selectedChannel || selectedItems.length === 0 || sharing}
          startIcon={sharing ? <CircularProgress size={16} /> : <Send />}
          sx={COMMUNITY_DIALOG_PRIMARY_BUTTON_SX}
        >
          {sharing ? 'Deler...' : `Del ${selectedItems.length > 1 ? `${selectedItems.length} elementer` : 'element'}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export { ShareToCommunityDialog };
