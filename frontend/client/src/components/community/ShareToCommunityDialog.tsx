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
    label: 'Share Work',
    description: 'Share your work with the community',
    icon: <Image />,
  },
  {
    id: 'feedback',
    label: 'Request Feedback',
    description: 'Ask for constructive feedback',
    icon: <Feedback />,
  },
  {
    id: 'inspiration',
    label: 'Share Inspiration',
    description: 'Inspire others with your work',
    icon: <Lightbulb />,
  },
  {
    id: 'tutorial',
    label: 'Tutorial/Tips',
    description: 'Share how you created this',
    icon: <School />,
  },
  {
    id: 'discussion',
    label: 'Start Discussion',
    description: 'Open a discussion about techniques',
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
      let content = message || ', ';
      
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
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Shared Successfully!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your {selectedItems.length > 1 ? 'items have' : 'item has'} been shared to the community.
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {professionIcon && (
              <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
                {professionIcon}
              </Box>
            )}
            <Share color="primary" />
            {enhancedProfessionConfig?.displayName || professionConfig?.displayName
              ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Share to Community`
              : 'Share to Community'}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Item Preview */}
            {itemsToShare.length === 1 && item && (
              <Card sx={{ display: 'flex', maxHeight: 120 }}>
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
                    <Typography variant="body2" color="text.secondary" noWrap>
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
                  Select items to share ({selectedItems.length} selected)
                </Typography>
                <List dense sx={{ maxHeight: 200, overflow: 'auto', bgcolor: 'grey.50', borderRadius: 1 }}>
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
                How would you like to share?
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
                <InputLabel>Community Group</InputLabel>
                <Select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  label="Community Group"
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
                <InputLabel>Channel</InputLabel>
                <Select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  label="Channel"
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
              label={shareType === 'feedback' ? 'What feedback are you looking for?' : 'Add a message'}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                shareType === 'feedback'
                  ? 'Describe what specific aspects you want feedback on...'
                  : shareType === 'tutorial'
                  ? 'Share the story behind this work or techniques used...' : 'Add context or description for your share...'
              }
            />

            {/* Feedback Questions */}
            {shareType === 'feedback' && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Specific Questions (optional)
                </Typography>
                {feedbackQuestions.map((q, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      value={q}
                      onChange={(e) => updateFeedbackQuestion(index, e.target.value)}
                      placeholder={`Question ${index + 1}`}
                    />
                    <IconButton size="small" onClick={() => removeFeedbackQuestion(index)}>
                      <Close fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
                <Button size="small" onClick={addFeedbackQuestion}>
                  + Add Question
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
                  label="Tags"
                  placeholder="Add tags..."
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
                    <Typography variant="body2">Request Mentor Review</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Get feedback from experienced community mentors
                    </Typography>
                  </Box>
                }
              />
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleShare}
          disabled={!selectedChannel || selectedItems.length === 0 || sharing}
          startIcon={sharing ? <CircularProgress size={16} /> : <Send />}
          sx={{ bgcolor: '#FF8C00', '&:hover': { bgcolor: '#e67e00' } }}
        >
          {sharing ? 'Sharing...' : `Share ${selectedItems.length > 1 ? `${selectedItems.length} Items` : 'Item'}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export { ShareToCommunityDialog };

