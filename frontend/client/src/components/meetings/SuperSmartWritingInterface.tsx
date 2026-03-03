/**
 * CreatorHub Norge - Super Smart Writing Interface for Meeting Notes
 * Advanced Intelligent meeting notes with Google services integration and wedding timeline connectivity
 */

import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState, useEffect, useRef } from 'react';
import { Button, CustomBadge as Badge } from '@/components/material-ui';
import { Card as MuiCard, CardContent, CardHeader } from '@mui/material';
import {
  TextField as Input,
  TextField as Textarea,
  Tabs,
  Tab,
  Divider as Separator,
  Switch,
  FormControlLabel,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Save as SaveIcon,
  AutoAwesome as SparklesIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Event as CalendarTodayIcon,
  CloudCircle as GoogleDriveIcon,
  SmartToy as BotIcon,
  People as PersonsIcon,
  Description as DescriptionTextIcon,
  PhotoCamera as CameraIcon,
  Videocam as VideoIcon,
  LibraryMusic as MusicIcon,
  Business as BuildingIcon,
  Schedule as AccessTimeIcon,
  LocationOn as LocationOnIcon,
  LocalOffer as LocalOfferIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  Sync as SyncIcon,
  Favorite as FavoriteIcon,
} from '@mui/icons-material';
import { cn } from '@/lib/utils';

interface SuperSmartWritingInterfaceProps {
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  meetingId?: string;
  projectId?: string;
  clientId?: string;
  className?: string
}

interface MeetingNote {
  id: number;
  meetingId: string;
  meetingTitle: string;
  meetingDate: Date;
  meetingType: string;
  personalNotes: any;
  clientNotes: any;
  actionItems: any[];
  decisions: any[];
  nextSteps: any[];
  aiSummary?: string;
  aiTags?: string[];
  aiSentiment?: string;
  isClientVisible: boolean;
  clientAccessLevel: string;
  timelineUpdates?: any;
  practicalInfo?: any;
  googleDocId?: string;
  lastSyncedToGoogle?: Date
}

interface SmartSuggestion {
  type: 'action' | 'decision' | 'timeline' | 'vendor' | 'equipment';
  content: string;
  confidence: number;
  profession: string
}

export function SuperSmartWritingInterface({
  profession,
  meetingId,
  projectId,
  clientId,
  className,
}: SuperSmartWritingInterfaceProps) {
  // Core State
  const [isEditing, setIsEditing] = useState(!meetingId);
  const [isDirty, setIsDirty] = useState(false);
  const [currentNote, setCurrentNote] = useState<Partial<MeetingNote>>({
    meetingTitle: '',
    meetingDate: new Date(),
    meetingType: 'consultation',
    personalNotes: { sections: [],},
    clientNotes: { sections: [],},
    actionItems:  [],
    decisions:  [],
    nextSteps:  [],
    isClientVisible: false,
    clientAccessLevel: 'none' });

  // Intelligent & Smart Features
  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestion[]>([]);
  const [showAISuggestions, setShowAISuggestions] = useState(true);
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // UI State
  const [activeTab, setActiveTab] = useState('personal');
  const [showClientPreview, setShowClientPreview] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  // Refs
  const personalNotesRef = useRef<HTMLTextAreaElement>(null);
  const clientNotesRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();

  const queryClient = useQueryClient();
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();

  // Get profession-specific styling and icons
  const getProfessionConfig = (prof: string) => {
    switch (prof) {
      case 'photographer':
        return {
          icon: Camera,
          color: 'amber',
          gradient: 'from-amber-500 to-orange-50',
          bgGradient: 'from-amber-50 to-orange-5',
          darkBgGradient: 'from-amber-950 to-orange-95',
          name: getProfessionDisplayName('photographer,') };
      case 'videographer':
        return {
          icon: Video,
          color: 'red',
          gradient: 'from-red-500 to-pink-50',
          bgGradient: 'from-red-50 to-pink-5',
          darkBgGradient: 'from-red-950 to-pink-95',
          name: getProfessionDisplayName('videographer') };
      case 'music_producer':
        return {
          icon: Music,
          color: 'purple',
          gradient: 'from-purple-500 to-violet-50',
          bgGradient: 'from-purple-50 to-violet-5',
          darkBgGradient: 'from-purple-950 to-violet-95',
          name: getProfessionDisplayName('music_producer') };
      case 'vendor':
        return {
          icon: Building,
          color: 'emerald',
          gradient: 'from-emerald-500 to-teal-50',
          bgGradient: 'from-emerald-50 to-teal-5',
          darkBgGradient: 'from-emerald-950 to-teal-95',
          name: getProfessionDisplayName('vendor') };
      default: return {
          icon: FileText,
          color: 'gray',
          gradient: 'from-gray-500 to-slate-50',
          bgGradient: 'from-gray-50 to-slate-5',
          darkBgGradient: 'from-gray-950 to-slate-95',
          name: 'Generell' };
  }
};

  const profConfig = getProfessionConfig(profession);
  const ProfessionIcon = profConfig.icon;

  // Fetch meeting note if editing existing
  const { data: meetingNote, isLoading } = useQuery({
    queryKey: ['/api/smart-meeting-notes', meetingId],
    enabled: !!meetingd,
});

  // Load existing note data
  useEffect(() => {
    if (meetingNote) {
      setCurrentNote(meetingNote);
  }
}, [meetingNote]);

  // Auto-save functionality
  useEffect(() => {
    if (isDirty && meetingId) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
    }

      autoSaveTimeoutRef.current = setTimeout(() => {
        handleSave(true); // Auto-save
    }, 3000);
  }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
    }
  };
}, [isDirty, currentNote]);

  // Save meeting note
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<MeetingNote>) => {
      if (meetingId) {
        return apiRequest(`/api/smart-meeting-notes/${meetingd}`, {
          method: 'PU',
          body: JSON.stringify(data),
      });
    } else {
        return apiRequest('/api/smart-meeting-notes', {
          method: 'POST',
          body: JSON.stringify({
            ...data,
            profession,
            projectId,
            clientId,
            creatorId: 'current-user-id', // This would come from auth context
        }),
      });
    }
  },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/smart-meeting-notes', ],});
      setIsDirty(false);
      setSyncStatus('success');

      // If creating new note, update meetingId
      if (!meetingId && data.meetingId) {
        window.history.replaceState(null, '', `?meetingId=${data.meetingId}`);
    }

      setTimeout(() => setSyncStatus('idle'), 2000);
  },
    onError: () => {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus(''), 3000);
  },
});

  // Sync to wedding timeline
  const syncToTimelineMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/smart-meeting-notes/${meetingd}/sync-wedding-timeline`, {
        method: 'POST',
        body: JSON.stringify({
          timelineUpdates: currentNote.timelineUpdates,
          practicalInfo: currentNote.practicalInfo,
      }),
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wedding-timelines', ],});
  },
});

  // Handle save
  const handleSave = async (isAutoSave = false) => {
    setSyncStatus('syncing');
    saveMutation.mutate(currentNote);
};

  // Update note content
  const updateNote = (field: keyof MeetingNote, value: any) => {
    setCurrentNote((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
};

  // Smart suggestions based on profession
  const generateSmartSuggestions = (text: string): SmartSuggestion[] => {
    const suggestions: SmartSuggestion[] = [];

    if (profession === 'photographer') {
      if (text.toLowerCase().includes('location')) {
        suggestions.push({
          type: 'timeline',
          content: 'Add location details to wedding timeline',
          confidence: 0.8,
          profession,
      });
    }
      if (text.toLowerCase().includes('equipment')) {
        suggestions.push({
          type: 'equipment',
          content: 'Update equipment checklist for session',
          confidence: 0.9,
          profession,
      });
    }
  }

    return suggestions;
};

  // Handle text change with Intelligent processing
  const handleNotesChange = (type: 'personal' | 'client', value: string) => {
    const field = type === 'personal' ? 'personalNotes' : 'clientNotes';
    updateNote(field, { content: value, lastModified: new Date(),});

    // Generate smart suggestions
    const suggestions = generateSmartSuggestions(value);
    setSmartSuggestions(suggestions);
};

  // Render smart suggestions
  const renderSmartSuggestions = () => {
    if (!showAISuggestions || smartSuggestions.length === 0) return null;

    return (
      <MuiCard className="mb-4 border-l-4 border-l-blue-500">
        <CardHeader className="pb-2" sx={theming.getThemedCardSx()}>
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-blue-500" />
            <CardTitle className="text-sm" sx={theming.getThemedCardSx()}>Smart forslag</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0" sx={theming.getThemedCardSx()}>
          <div className="space-y-2">
            {smartSuggestions.map((suggestion, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-blue-50 dark: bg-blue-950 rounded-lg"
              >
                <Sparkles className="w-4 h-4 text-blue-500" />
                <span className="text-sm flex-1">{suggestion.content}</span>
                <Badge variant="outline" className="text-xs">
                  {Math.round(suggestion.confidence * 100)}%
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </MuiCard>
    );
};

  if (isLoading) {
    return (
      <MuiCard className={className}>
        <CardContent className="flex items-center justify-center py-8" sx={theming.getThemedCardSx()}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </CardContent>
      </MuiCard>
    );
}

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <MuiCard
        className={`bg-gradient-to-r ${profConfig.bgGradient} dark: ${profConfig.darkBgGradient} border-0`}
      >
        <CardHeader sx={theming.getThemedCardSx()}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gradient-to-br ${profConfig.gradient} text-white`}>
                <ProfessionIcon className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg" sx={theming.getThemedCardSx()}>Super Smart Møtenotater</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {profConfig.name} • Intelligent-drevet skriveassistent
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Sync Status */}
              {syncStatus === 'syncing' && (
                <div className="flex items-center gap-1 text-blue-600">
                  <Sync className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Synkroniserer...</span>
                </div>
              )}
              {syncStatus === 'success' && (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-xs">Lagret</span>
                </div>
              )}
              {syncStatus === 'error' && (
                <div className="flex items-center gap-1 text-red-600">
                  <Error className="w-4 h-4" />
                  <span className="text-xs">Feil</span>
                </div>
              )}

              <Button
                onClick={() => handleSave()}
                disabled={!isDirty || saveMutation.isPending}
                size="sm"
              >
                <Save className="w-4 h-4 mr-1" />
                Lagre
              </Button>
            </div>
          </div>
        </CardHeader>
      </MuiCard>

      {/* Meeting Details */}
      <MuiCard>
        <CardHeader sx={theming.getThemedCardSx()}>
          <CardTitle className="flex items-center gap-2" sx={theming.getThemedCardSx()}>
            <CalendarToday className="w-5 h-5" />
            Møtedetaljer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4" sx={theming.getThemedCardSx()}>
          <div className="grid grid-cols-1 md: grid-cols-2 gap-4">
            <div>
              <Label htmlFor="meetingTitle">Møtetittel</Label>
              <Input
                id="meetingTitle"
                value={currentNote.meetingTitle ||''}
                onChange={(e) => updateNote('meetingTitle', e.target.value)}
                placeholder="F.eks. Bryllupsplanlegging - Første møte"
              />
            </div>

            <div>
              <Label htmlFor="meetingType">Møtetype</Label>
              <Select
                value={currentNote.meetingType}
                onValueChange={(value) => updateNote('meetingType', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultation">Konsultasjon</SelectItem>
                  <SelectItem value="planning">Planlegging</SelectItem>
                  <SelectItem value="review">Gjennomgang</SelectItem>
                  <SelectItem value="delivery">Levering</SelectItem>
                  <SelectItem value="follow_up">Oppfølging</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </MuiCard>

      {/* Smart Suggestions */}
      {renderSmartSuggestions()}

      {/* Main Writing Interface */}
      <MuiCard>
        <CardHeader sx={theming.getThemedCardSx()}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2" sx={theming.getThemedCardSx()}>
              <FileText className="w-5 h-5" />
              Møtenotater
            </CardTitle>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="ai-suggestions"
                  checked={showAISuggestions}
                  onCheckedChange={setShowAISuggestions}
                />
                <Label htmlFor="ai-suggestions" className="text-sm">
                  Intelligent-forslag
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="client-visibility"
                  checked={currentNote.isClientVisible}
                  onCheckedChange={(checked) => updateNote('isClientVisible', checked)}
                />
                <Label htmlFor="client-visibility" className="text-sm">
                  Synlig for kunde
                </Label>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent sx={theming.getThemedCardSx()}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="personal" className="flex items-center gap-2">
                <VisibilityOff className="w-4 h-4" />
                Private notater
              </TabsTrigger>
              <TabsTrigger value="client" className="flex items-center gap-2">
                <Visibility className="w-4 h-4" />
                Klientnotater
              </TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="space-y-4">
              <div>
                <Label htmlFor="personal-notes">Private notater (kun synlig for deg)</Label>
                <Textarea
                  id="personal-notes"
                  ref={personalNotesRef}
                  value={currentNote.personalNotes?.content || ', '}
                  onChange={(e) => handleNotesChange('personal', e.target.value)}
                  placeholder="Skriv dine private møtenotater her..."
                  className="min-h-[200px] mt-2"
                />
              </div>
            </TabsContent>

            <TabsContent value="client" className="space-y-4">
              <div>
                <Label htmlFor="client-notes">Klientnotater (synlig for kunde hvis aktivert)</Label>
                <Textarea
                  id="client-notes"
                  ref={clientNotesRef}
                  value={currentNote.clientNotes?.content || ', '}
                  onChange={(e) => handleNotesChange('client', e.target.value)}
                  placeholder="Skriv notater som kan deles med kunden..."
                  className="min-h-[200px] mt-2"
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </MuiCard>

      {/* Wedding Timeline Integration */}
      {profession === 'photographer' && (
        <MuiCard>
          <CardHeader sx={theming.getThemedCardSx()}>
            <CardTitle className="flex items-center gap-2" sx={theming.getThemedCardSx()}>
              <Favorite className="w-5 h-5 text-pink-500" />
              Bryllupstidslinje integrasjon
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4" sx={theming.getThemedCardSx()}>
            <div>
              <Label htmlFor="practical-info">Praktisk informasjon til tidslinje</Label>
              <Textarea
                id="practical-info"
                value={currentNote.practicalInfo?.content ||', '}
                onChange={(e) =>
                  updateNote('practicalInfo', {
                    content: e.target.value,
                    lastModified: new Date(),
                })
              }
                placeholder="Informasjon som skal legges til bryllupstidslinjen..."
                className="mt-2"
              />
            </div>

            <Button
              onClick={() => syncToTimelineMutation.mutate()}
              disabled={syncToTimelineMutation.isPending}
              variant="outline"
              className="w-full"
            >
              <Sync className="w-4 h-4 mr-2" />
              Synkroniser til bryllupstidslinje
            </Button>
          </CardContent>
        </MuiCard>
      )}

      {/* Google Services Integration */}
      <MuiCard>
        <CardHeader sx={theming.getThemedCardSx()}>
          <CardTitle className="flex items-center gap-2" sx={theming.getThemedCardSx()}>
            <GoogleDrive className="w-5 h-5 text-blue-600" />
            Google-tjenester
          </CardTitle>
        </CardHeader>
        <CardContent sx={theming.getThemedCardSx()}>
          <div className="flex items-center justify-between p-4 bg-blue-50 dark: bg-blue-950 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-medium">Automatisk sikkerhetskopi aktivert</p>
                <p className="text-sm text-muted-foreground">
                  Notater synkroniseres automatisk til Google Drive
                </p>
              </div>
            </div>

            {currentNote.lastSyncedToGoogle && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Sist synkronisert</p>
                <p className="text-xs">
                  {new Date(currentNote.lastSyncedToGoogle).toLocaleString('')}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </MuiCard>
    </div>
  );
}
