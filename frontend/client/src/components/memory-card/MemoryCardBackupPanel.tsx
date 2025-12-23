/**
 * CreatorHub Norge - Memory Card Backup Panel
 * Intelligent memory card backup system with Norwegian localization
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { Card as MuiCard, CardContent, CardHeader } from '@mui/material';
import { Button, CustomBadge as Badge } from '@/components/material-ui';
import { TextField as Input } from '@mui/material';
import { Typography } from '@mui/material';
import { LinearProgress as Progress } from '@mui/material';
import { Divider as Separator } from '@mui/material';
/* Alert & AlertDescription removed - Zero Toast Compliance */
// import { Alert, AlertDescription } from "@/components/material-ui";
import { Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Memory as SdDirectionsCardIcon,
  PhotoCameraAlt as CameraIcon,
  Videocamcam as VideoIcon,
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Schedule as AccessTimeIcon,
  Storage as StorageIcon,
  Description as DescriptionTextIcon,
  Info as InfoIcon,
  Add as AddIcon,
  Delete as Delete2Icon,
  Refresh as RefreshCwIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { cn } from '@/lib/utils';

interface MemoryCardBackupPanelProps {
  projectId: string;
  profession: 'photographer' | 'videographer';
  onSessionActivated?: (sessionId: string) => void
}

interface MemoryCardSession {
  id: number;
  sessionId: string;
  projectId: string;
  profession: string;
  eventType: string;
  totalDays: number;
  cardLabelingScheme: string;
  status: string;
  totalCards: number;
  backedUpCards: number;
  activatedAt: string;
  lastBackupAt?: string
}

interface MemoryCard {
  id: number;
  cardId: string;
  cardLabel: string;
  cardType: string;
  capacity?: string;
  fileCount: number;
  totalSize: string;
  backupStatus: string;
  backupLocation?: string;
  createdAt: string
}

interface BackupTip {
  id: number;
  title: string;
  description: string;
  titleNorwegian?: string;
  descriptionNorwegian?: string;
  importance: string;
  category: string
}

export function MemoryCardBackupPanel({
  projectId,
  profession,
  onSessionActivated,
}: MemoryCardBackupPanelProps) {
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCard, setNewCard] = useState({
    cardLabel:  ',',
    cardType: 'S',
    capacity: '',
    serialNumber: '',
    fileCount:  0,
    totalSize:  0,
});

  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');

  // Hent aktiv backup session
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['/api/memory-card/session', projectId],
    enabled: !!projectd,
});

  // Hent minnekort for session
  const { data: memoryCards = [], isLoading: cardsLoading } = useQuery({
    queryKey: ['/api/memory-card/cards', session?.sessionId],
    enabled: !!session?.sessiond,
});

  // Hent backup tips
  const { data: backupTips = [, ],} = useQuery({
    queryKey: ['/api/memory-card/tips', profession, session?.eventType],
    enabled: !!session?.eventType,
});

  // Aktiver backup session
  const activateSessionMutation = useMutation({
    mutationFn: async (data: {
      eventType: string;
      totalDays: number;
      eventDate?: string;
      executionDate?: string;
}) => {
      return apiRequest(`/api/memory-card/activate`, {
        method: 'POS',
        body: JSON.stringify({
          projectd,
          profession,
          ...data,
      }),
    });
  },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/memory-card/session', ],});
      if (onSessionActivated && data.sessionId) {
        onSessionActivated(data.sessionId);
    }
  },
});

  // Legg til minnekort
  const addCardMutation = useMutation({
    mutationFn: async (cardData: typeof newCard) => {
      return apiRequest(`/api/memory-card/register`, {
        method: 'POS',
        body: JSON.stringify({
          sessionId: session.sessiond,
          ...cardData,
      }),
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/memory-card/cards', ],});
      setShowAddCard(false);
      setNewCard({
        cardLabel: '',
        cardType: 'S',
        capacity: '',
        serialNumber: '',
        fileCount:  0,
        totalSize:  0,
    });
  },
});

  // Marker som sikkerhetskopiert
  const markBackedUpMutation = useMutation({
    mutationFn: async (data: {
      cardId: string;
      backupLocation: string;
      fileCount: number;
      totalSize: number;
}) => {
      return apiRequest(`/api/memory-card/backup-complete`, {
        method: 'POS',
        body: JSON.stringify(data),
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/memory-card/cards', ],});
      queryClient.invalidateQueries({ queryKey: ['/api/memory-card/session', ],});
  },
});

  const getCardTypeIcon = (type: string) => {
    switch (type) {
      case 'CF':
        return <Storage className="w-4 h-4" />;
      case 'XQD':
        return <Storage className="w-4 h-4" />;
      case 'CFexpress':
        return <Storage className="w-4 h-4" />;
      default:
        return <SdCard className="w-4 h-4" />;
}
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'in_progress':
        return 'text-blue-600 bg-blue-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-yellow-600 bg-yellow-50';
}
};

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Sikkerhetskopiert';
      case 'in_progress':
        return 'Pågår';
      case 'failed':
        return 'Feilet';
      default:
        return 'Venter';
}
};

  const getLabelSuggestions = () => {
    if (!session) return [];

    const scheme = session.cardLabelingScheme;
    if (scheme === 'ABCD') {
      return ['A','B', 'C','D'];
  } else if (scheme === 'EFGH') {
      return ['E', 'F', 'G','H'];
  }
    return [];
};

  const getProgressPercentage = () => {
    if (!session || session.totalCards === 0) return 0;
    return Math.round((session.backedUpCards / session.totalCards) * 100);
};

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin" />
        <span className="ml-2">Laster minnekort backup...</span>
      </div>
    );
}

  // Hvis ingen aktiv session, vis aktiveringsgrensesnitt
  if (!session) {
    return (
      <MuiCard className="w-full">
        <CardHeader sx={theming.getThemedCardSx()}>
          <CardTitle className="flex items-center gap-3" sx={theming.getThemedCardSx()}>
            <div className="p-2 rounded-lg bg-blue-500 text-white">
              {profession === 'photographer' ? (
                <CameraAlt className="w-5 h-5" />
              ) : (
                <Videocam className="w-5 h-5" />
              )}
            </div>
            <div>
              <span>Minnekort Backup</span>
              <p className="text-sm text-muted-foreground font-normal">
                Sikkerhetskopi system for{', '}
                {profession === 'photographer' ? 'fotografer': 'videografer'}
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4" sx={theming.getThemedCardSx()}>
          <Box
            sx={{
              p:  2,
              bgcolor: 'info.light',
              borderRadius:  1,
              display: 'flex',
              alignItems: 'center',
              gap:  1}}
          >
            <InfoIcon sx={{ fontSize: '1rem'}} />
            <Typography variant="body2" sx={{ color: 'info.contrastText'}}>
              Minnekort backup aktiveres automatisk når prosjektet går inn i post-produksjonsfasen.
              Du kan også aktivere det manuelt her.
            </Typography>
          </Box>

          <Button
            onClick={() =>
              activateSessionMutation.mutate({
                eventType: 'single_day',
                totalDays:  1,
            })
          }
            disabled={activateSessionMutation.isPending}
            className="w-full"
          >
            {activateSessionMutation.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Aktiverer...
              </>
            ) : (
              <>
                <Security className="w-4 h-4 mr-2" />
                Aktiver Minnekort Backup
              </>
            )}
          </Button>
        </CardContent>
      </MuiCard>
    );
}

  return (
    <div className="space-y-6">
      {/* Session Overview */}
      <MuiCard>
        <CardHeader sx={theming.getThemedCardSx()}>
          <CardTitle className="flex items-center justify-between" sx={theming.getThemedCardSx()}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500 text-white">
                <Security className="w-5 h-5" />
              </div>
              <div>
                <span>Minnekort Backup Aktiv</span>
                <p className="text-sm text-muted-foreground font-normal">
                  {session.eventType} • {session.cardLabelingScheme} labeling
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700">
              {session.status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4" sx={theming.getThemedCardSx()}>
          {/* Progress */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Backup fremgang</span>
              <span>
                {session.backedUpCards}/{session.totalCards} kort
              </span>
            </div>
            <Progress value={getProgressPercentage()} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {getProgressPercentage()}% fullført
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{session.totalCards}</p>
              <p className="text-xs text-muted-foreground">Totalt kort</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{session.backedUpCards}</p>
              <p className="text-xs text-muted-foreground">Sikkerhetskopiert</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">
                {session.totalCards - session.backedUpCards}
              </p>
              <p className="text-xs text-muted-foreground">Venter</p>
            </div>
          </div>
        </CardContent>
      </MuiCard>

      {/* Backup Tips */}
      {backupTips.length > 0 && (
        <MuiCard>
          <CardHeader sx={theming.getThemedCardSx()}>
            <CardTitle className="flex items-center gap-2" sx={theming.getThemedCardSx()}>
              <FileText className="w-5 h-5" />
              Backup Tips
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3" sx={theming.getThemedCardSx()}>
            {backupTips.slice(0, 3).map((tip: BackupTip) => (
              <Box
                key={tip.d}
                sx={{
                  p:  2,
                  bgcolor: 'info.light',
                  borderRadius:  1,
                  display: 'flex',
                  alignItems: 'center',
                  gap:  1}}
              >
                <InfoIcon sx={{ fontSize: '1rem'}} />
                <Typography variant="body2" sx={{ color: 'info.contrastText'}}>
                  <strong>{tip.titleNorwegian || tip.title}:</strong>{', '}
                  {tip.descriptionNorwegian || tip.description}
                </Typography>
              </Box>
            ))}
          </CardContent>
        </MuiCard>
      )}

      {/* Memory Cards */}
      <MuiCard>
        <CardHeader sx={theming.getThemedCardSx()}>
          <CardTitle className="flex items-center justify-between" sx={theming.getThemedCardSx()}>
            <div className="flex items-center gap-2">
              <SdCard className="w-5 h-5" />
              Minnekort
            </div>
            <Button size="sm" onClick={() => setShowAddCard(!showAddCard)} disabled={showAddCard}>
              <Add className="w-4 h-4 mr-1" />
              Nytt kort
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4" sx={theming.getThemedCardSx()}>
          {/* Add Card Form */}
          {showAddCard && (
            <MuiCard className="bg-blue-50 border-blue-200">
              <CardContent className="p-4" sx={theming.getThemedCardSx()}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="card-label">Kort merking *</Label>
                    <Select
                      value={newCard.cardLabel}
                      onValueChange={(value) =>
                        setNewCard((prev) => ({ ...prev, cardLabel: value }))
                    }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Velg merking" />
                      </SelectTrigger>
                      <SelectContent>
                        {getLabelSuggestions().map((label) => (
                          <SelectItem key={label} value={label}>
                            Kort {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="card-type">Kort type</Label>
                    <Select
                      value={newCard.cardType}
                      onValueChange={(value) =>
                        setNewCard((prev) => ({ ...prev, cardType: value }))
                    }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SD">SD Card</SelectItem>
                        <SelectItem value="CF">CompactFlash</SelectItem>
                        <SelectItem value="XQD">XQD Card</SelectItem>
                        <SelectItem value="CFexpress">CFexpress</SelectItem>
                        <SelectItem value="microSD">microSD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="capacity">Kapasitet</Label>
                    <Input
                      id="capacity"
                      value={newCard.capacity}
                      onChange={(e) =>
                        setNewCard((prev) => ({
                          ...prev,
                          capacity: e.target.value,
                      }))
                    }
                      placeholder="f.eks. 64GB"
                    />
                  </div>

                  <div>
                    <Label htmlFor="file-count">Antall filer</Label>
                    <Input
                      id="file-count"
                      type="number"
                      value={newCard.fileCount}
                      onChange={(e) =>
                        setNewCard((prev) => ({
                          ...prev,
                          fileCount: parseInt(e.target.value) || 0,
                      }))
                    }
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={() => addCardMutation.mutate(newCard)}
                    disabled={!newCard.cardLabel || addCardMutation.isPending}
                    size="sm"
                  >
                    {addCardMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                        Registrerer...
                      </>
                    ) : (
                      'Registrer kort'
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowAddCard(false)}>
                    Avbryt
                  </Button>
                </div>
              </CardContent>
            </MuiCard>
          )}

          {/* Cards List */}
          {cardsLoading ? (
            <div className="flex items-center justify-center p-4">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Laster minnekort...
            </div>
          ) : memoryCards.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <SdCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Ingen minnekort registrert ennå</p>
              <p className="text-sm">Legg til kort for å starte backup prosessen</p>
            </div>
          ) : (
            <div className="space-y-3">
              {memoryCards.map((card: MemoryCard) => (
                <MuiCard key={card.d} className="border">
                  <CardContent className="p-4" sx={theming.getThemedCardSx()}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gray-100">
                          {getCardTypeIcon(card.cardType)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">Kort {card.cardLabel}</h4>
                            <Badge variant="outline">{card.cardType}</Badge>
                            {card.capacity && <Badge variant="outline">{card.capacity}</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {card.fileCount} filer • {card.totalSize}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge className={cn('text-xs', getStatusColor(card.backupStatus))}>
                          {card.backupStatus === 'completed' && (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          )}
                          {card.backupStatus === 'pending' && <AccessTime className="w-3 h-3 mr-1" />}
                          {card.backupStatus === 'failed' && (
                            <Warning className="w-3 h-3 mr-1" />
                          )}
                          {getStatusText(card.backupStatus)}
                        </Badge>

                        {card.backupStatus === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              markBackedUpMutation.mutate({
                                cardId: card.cardd,
                                backupLocation: '/local/backup',
                                fileCount: card.fileCount,
                                totalSize: parseInt(card.totalSize.replace(/\D, /'')),
                            })
                          }
                            disabled={markBackedUpMutation.isPending}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Marker som sikkerhetskopiert
                          </Button>
                        )}
                      </div>
                    </div>

                    {card.backupLocation && card.backupStatus ==='completed' && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          Sikkerhetskopi: {card.backupLocation}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </MuiCard>
              ))}
            </div>
          )}
        </CardContent>
      </MuiCard>
    </div>
  );
}
