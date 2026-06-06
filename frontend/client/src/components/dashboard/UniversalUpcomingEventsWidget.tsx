// @ts-nocheck
import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState, useEffect } from 'react';
import {
  Card as MuiCard,
  CardContent,
  CardHeader,
  Typography,
} from '@mui/material';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UpcomingEventsCountdownView } from './UpcomingEventsCountdownView';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Camera,
  Video,
  Music,
  AlertTriangle,
  CheckCircle,
  Package,
  Heart,
  Building,
  Timer,
  Bell,
  ChevronRight,
  Eye,
  Settings,
  Plus,
} from 'lucide-react';

// useDynamicProfessions dedupliseert — allerede importert øverst (linje 6)
import { useAuth } from '@/hooks/useAuth';

// Import enhanced loading components
import { LoadingWrapper, SkeletonLoader, ErrorState } from '../ui/enhanced-loading';

interface UpcomingEventsWidgetProps {
  profession?: string; // Made optional for dynamic profession system
  className?: string;
}

interface UpcomingEvent {
  id: string;
  title: string;
  type: 'meeting' | 'deadline' | 'wedding' | 'project' | 'shoot' | 'recording' | 'delivery';
  date: string;
  time?: string;
  location?: string;
  clientName?: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'upcoming' | 'today' | 'overdue' | 'completed';
  daysUntil: number;
  hoursUntil?: number;
  profession: string;
  projectId?: string;
  meetingId?: string;
  packingListRequired?: boolean;
  preparationTasks?: string[];
  estimatedDuration?: string;
  teamMembers?: string[];
  equipment?: string[];
  deliverables?: string[]
}

interface PreparationTask {
  id: string;
  task: string;
  norwegianTask: string;
  category: 'equipment' | 'documentation' | 'preparation' | 'logistics';
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  daysBeforeEvent: number
}

export function UniversalUpcomingEventsWidget({
  profession,
  className,
}: UpcomingEventsWidgetProps) {
  // Dynamic profession system hooks
  const { user } = useAuth();
  
  // Theming system - use dynamic profession instead of hardcoded value
  const userProfession = user?.profession || profession || 'photographer';
  const theming = useTheming(userProfession);
  const {
    professions,
    loading: professionsLoading,
    error: professionsError,
    getProfessionConfig,
} = useDynamicProfessions();

  const professionConfig = getProfessionConfig(userProfession ||  ',');

  const [selectedEvent, setSelectedEvent] = useState<UpcomingEvent | null>(null);
  const [showPreparation, setShowPreparation] = useState(false);
  const [preparationTasks, setPreparationTasks] = useState<PreparationTask[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showCountdownView, setShowCountdownView] = useState(false);

  const queryClient = useQueryClient();

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
  }, 60000);
    return () => clearInterval(timer);
}, []);

  // Loading state for profession data
  if (professionsLoading) {
    return (
      <MuiCard className={className}>
        <CardContent sx={{ p:  3, textAlign: 'center',  ...theming.getThemedCardSx() }}>
          <Typography>
            Laster kommende hendelser for {professionConfig?.displayName || 'din profesjon'}...
          </Typography>
        </CardContent>
      </MuiCard>
    );
}

  // Fetch upcoming events based on profession
  const { data: upcomingEvents, isLoading } = useQuery({
    queryKey: ['/api/dashboard/upcoming-events', userProfession],
    refetchInterval: 5 * 60 * 100, // Refresh every 5 minutes
    enabled: !!userProfession && !professionsLoading,
});

  // Fetch preparation tasks for specific event
  const { data: eventPreparationTasks } = useQuery({
    queryKey: ['/api/dashboard/preparation-tasks', selectedEvent?.id],
    enabled: !!selectedEvent,
});

  // Mark preparation task as completed
  const completeTaskMutation = useMutation({
    mutationFn: async ({ eventd, taskId }: { eventId: string; taskId: string }) => {
      const response = await fetch(`/api/dashboard/complete-preparation-task`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json',},
        body: JSON.stringify({ eventd, taskId }),
    });
      if (!response.ok) throw new Error('Failed to complete task');
      return response.json();
  },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/dashboard/preparation-tasks', ],
    });
      queryClient.invalidateQueries({
        queryKey: ['/api/dashboard/upcoming-events', ],
    });
  },
});

  // Generate preparation checklist based on event type and profession
  const generatePreparationTasks = (event: UpcomingEvent): PreparationTask[] => {
    const baseTasks: PreparationTask[] = [];

    if (professionConfig?.id === 'photographer') {
      if (event.type === 'wedding' || event.type === 'shoot') {
        baseTasks.push(
          {
            id: '',
            task: 'Check and charge all camera batteries',
            norwegianTask: 'Sjekk og lad alle kamerabatterier',
            category: 'equipment',
            priority: 'high',
            completed: false,
            daysBeforeEvent:  2,
        },
          {
            id: '',
            task: 'Format memory cards and check capacity',
            norwegianTask: 'Formater minnekort og sjekk kapasitet',
            category: 'equipment',
            priority: 'high',
            completed: false,
            daysBeforeEvent:  2,
        },
          {
            id: '',
            task: 'Clean lenses and check equipment',
            norwegianTask: 'Rengjør objektiver og sjekk utstyr',
            category: 'equipment',
            priority: 'medium',
            completed: false,
            daysBeforeEvent:  1,
        },
          {
            id: '',
            task: 'Review shot list and timeline',
            norwegianTask: 'Gjennomgå bilder på ønskelisten og tidslinje',
            category: 'preparation',
            priority: 'high',
            completed: false,
            daysBeforeEvent:  3,
        },
          {
            id: '',
            task: 'Confirm location and travel details',
            norwegianTask: 'Bekreft lokasjon og reisedetaljer',
            category: 'logistics',
            priority: 'high',
            completed: false,
            daysBeforeEvent:  5,
        },
        );
    }
  } else if (professionConfig?.id === 'videographer') {
      if (event.type === 'wedding' || event.type === 'project') {
        baseTasks.push(
          {
            id: '',
            task: 'Check video equipment and batteries',
            norwegianTask: 'Sjekk videoutstyr og batterier',
            category: 'equipment',
            priority: 'high',
            completed: false,
            daysBeforeEvent:  2,
        },
          {
            id: '',
            task: 'Test microphones and audio equipment',
            norwegianTask: 'Test mikrofoner og lydutstyr',
            category: 'equipment',
            priority: 'high',
            completed: false,
            daysBeforeEvent:  2,
        },
          {
            id: '',
            task: 'Prepare extra storage media',
            norwegianTask: 'Forbered ekstra lagringsmedier',
            category: 'equipment',
            priority: 'medium',
            completed: false,
            daysBeforeEvent:  1,
        },
          {
            id: '',
            task: 'Review storyboard and shot sequence',
            norwegianTask: 'Gjennomgå storyboard og opptakssekvens',
            category: 'preparation',
            priority: 'high',
            completed: false,
            daysBeforeEvent:  3,
        },
        );
    }
  } else if (professionConfig?.id === 'music_producer') {
      if (event.type === 'recording' || event.type === 'project') {
        baseTasks.push(
          {
            id: '',
            task: 'Test recording equipment and interfaces',
            norwegianTask: 'Test opptaksutstyr og lydgrensesnitt',
            category: 'equipment',
            priority: 'high',
            completed: false,
            daysBeforeEvent:  2,
        },
          {
            id: '',
            task: 'Prepare session templates and presets',
            norwegianTask: 'Forbered øktmaler og forhåndsinnstillinger',
            category: 'preparation',
            priority: 'medium',
            completed: false,
            daysBeforeEvent:  3,
        },
          {
            id: ', ',
            task: 'Check studio acoustics and monitoring',
            norwegianTask: 'Sjekk studioakustikk og monitorering',
            category: 'equipment',
            priority: 'medium',
            completed: false,
            daysBeforeEvent:  1,
        },
        );
    }
  }

    // Universal tasks for all professions
    baseTasks.push(
      {
        id: 'universal-',
        task: 'Review contract and project details',
        norwegianTask: 'Gjennomgå kontrakt og prosjektdetaljer',
        category: 'documentation',
        priority: 'high',
        completed: false,
        daysBeforeEvent:  7,
    },
      {
        id: 'universal-',
        task: 'Confirm meeting details with client',
        norwegianTask: 'Bekreft møtedetaljer med klient',
        category: 'logistics',
        priority: 'high',
        completed: false,
        daysBeforeEvent:  2,
    },
    );

    return baseTasks;
};

  // Get priority color and icon
  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'critical':
        return {
          color: 'text-red-60',
          bg: 'bg-red-50 border-red-20',
          icon: AlertTriangle,
      };
      case 'high':
        return {
          color: 'text-orange-60',
          bg: 'bg-orange-50 border-orange-20',
          icon: Timer,
      };
      case 'medium':
        return {
          color: 'text-yellow-60',
          bg: 'bg-yellow-50 border-yellow-20',
          icon: Clock,
      };
      default: return {
          color: 'text-gray-60',
          bg: 'bg-gray-50 border-gray-20',
          icon: Clock,
      };
  }
};

  // Get profession-specific event icon
  const getEventIcon = (type: string, professionId: string) => {
    if (type === 'wedding') return Heart;
    if (type === 'meeting') return Users;
    if (type === 'deadline') return Timer;

    switch (professionId) {
      case 'photographer':
        return Camera;
      case 'videographer':
        return Video;
      case 'music_producer':
        return Music;
      case 'vendor':
        return Building;
      default:
        return Calendar;
}
};

  // Format countdown text
  const formatCountdown = (daysUntil: number, hoursUntil?: number) => {
    if (daysUntil === 0) {
      return hoursUntil ? `${hoursUntil}t igjen` : 'I dag';
  } else if (daysUntil === 1) {
      return 'I morgen';
  } else if (daysUntil < 7) {
      return `${daysUntil} dager`;
  } else if (daysUntil < 14) {
      return `${Math.ceil(daysUntil / 7)} uke`;
  } else {
      return `${Math.ceil(daysUntil / 7)} uker`;
  }
};

  // Get profession-specific terminology using dynamic config
  const getProfessionTerms = (professionId: string) => {
    switch (professionId) {
      case 'photographer':
        return {
          events: 'Oppdrag og Fotograferinger',
          nextEvent: 'Neste Fotografering',
          preparation: 'Fotografiutstyr',
          packing: 'Pakkeliste Kamera',
      };
      case 'videographer':
        return {
          events: 'Videoproduksjoner',
          nextEvent: 'Neste Videoproduksjon',
          preparation: 'Videoutstyr',
          packing: 'Pakkeliste Video',
      };
      case 'music_producer':
        return {
          events: 'Studioøkter og Innspillinger',
          nextEvent: 'Neste Studioøkt',
          preparation: 'Studioutstyr',
          packing: 'Utstyrsjekk',
      };
      case 'vendor':
        return {
          events: 'Leveranser og Møter',
          nextEvent: 'Neste Leveranse',
          preparation: 'Leveranseutstyr',
          packing: 'Sjekkliste',
      };
      default: return {
          events: `${professionConfig?.displayName || 'Kommende'} Hendelser`,
          nextEvent: `Neste ${professionConfig?.displayName || 'Hendelse'}`,
          preparation: `${professionConfig?.displayName ||', '} Forberedelser`,
          packing: 'Sjekkliste',
      };
  }
};

  const terms = getProfessionTerms(professionConfig?.id || ', ');

  return (
    <LoadingWrapper
      loading={isLoading || professionsLoading}
      error={professionsError}
      loadingComponent={
        <MuiCard className={className}>
          <CardHeader sx={theming.getThemedCardSx()}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap:  1 }} sx={{ ...{}, color: theming.colors.primary }}>
              <Timer sx={{ color: 'primary.main'}} />
              {terms.events}
            </Typography>
          </CardHeader>
          <CardContent sx={theming.getThemedCardSx()}>
            <SkeletonLoader
              rows={4}
              height={80}
              message={`Laster ${terms.events.toLowerCase()}...`}
            />
          </CardContent>
        </MuiCard>
    }
    >
      <MuiCard className={className}>
        <CardHeader sx={theming.getThemedCardSx()}>
          <Typography variant="h6"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'}}
           sx={{ ...{}, color: theming.colors.primary }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px'}}>
              <Timer sx={{ color: 'primary.main'}} />
              <span>{terms.events}</span>
            </div>
            <Button variant="ghost" size="sm">
              <Settings className="w-4 h-4" />
            </Button>
          </Typography>
        </CardHeader>
        <CardContent className="space-y-4" sx={theming.getThemedCardSx()}>
          {!upcomingEvents || upcomingEvents.length === 0 ? (
            <div className="text-center py-8">
              <CalendarToday className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">Ingen kommende hendelser</h3>
              <p className="text-gray-500 text-sm">
                Du har ingen planlagte møter eller deadlines akkurat nå.
              </p>
              <Button variant="outline" size="sm" className="mt-4">
                <Add className="w-4 h-4 mr-2" />
                Legg til hendelse
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.slice(0, 5).map((event: UpcomingEvent) => {
                const priorityStyles = getPriorityStyles(event.priority);
                const EventIcon = getEventIcon(event.type, professionConfig?.id || ', ');

                return (
                  <div
                    key={event.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover: shadow-md ${priorityStyles.g}`}
                    onClick={() => {
                      if (upcomingEvents.length <= 3) {
                        setSelectedEvent(event);
                    } else {
                        setShowCountdownView(true);
                    }
                  }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div
                          className={`p-2 rounded-full ${
                            priorityStyles.color === 'text-red-600'
                              ? 'bg-red-100'
                              : priorityStyles.color === 'text-orange-600'
                                ? 'bg-orange-100'
                                : priorityStyles.color === 'text-yellow-600'
                                  ? 'bg-yellow-100'
                                  : 'bg-gray-100'
                        }`}
                        >
                          <EventIcon className={`w-4 h-4 ${priorityStyles.color}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-semibold text-gray-900">{event.title}</h4>
                            <Badge
                              variant="secondary"
                              className={`text-xs ${priorityStyles.color}`}
                            >
                              {formatCountdown(event.daysUntil, event.hoursUntil)}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">{event.description}</p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            {event.clientName && (
                              <span className="flex items-center space-x-1">
                                <People className="w-3 h-3" />
                                <span>{event.clientName}</span>
                              </span>
                            )}
                            {event.time && (
                              <span className="flex items-center space-x-1">
                                <AccessTime className="w-3 h-3" />
                                <span>{event.time}</span>
                              </span>
                            )}
                            {event.location && (
                              <span className="flex items-center space-x-1">
                                <LocationOn className="w-3 h-3" />
                                <span>{event.location}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {event.packingListRequired && event.daysUntil <= 4 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreparationTasks(generatePreparationTasks(event));
                              setShowPreparation(true);
                          }}
                            className="text-xs"
                          >
                            <Inventory className="w-3 h-3 mr-1" />
                            {terms.packing}
                          </Button>
                        )}
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>

                    {/* Progress bar for deadlines */}
                    {event.type === 'deadline' && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Fremdrift</span>
                          <span>{Math.max(0, Math.min(100, 100 - event.daysUntil * 10))}%</span>
                        </div>
                        <Progress
                          value={Math.max(0, Math.min(100, 100 - event.daysUntil * 10))}
                          className="h-2"
                        />
                      </div>
                    )}
                  </div>
                );
            })}

              {upcomingEvents.length > 5 && (
                <Button
                  variant="ghost"
                  className="w-full text-sm"
                  onClick={() => setShowCountdownView(true)}
                >
                  Se alle {upcomingEvents.length} hendelser
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </MuiCard>

      {/* Event Details Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-3">
              {selectedEvent && (
                <>
                  <div
                    className={`p-2 rounded-full ${
                      getPriorityStyles(selectedEvent.priority).color === 'text-red-600'
                        ? 'bg-red-100'
                        : getPriorityStyles(selectedEvent.priority).color === 'text-orange-600'
                          ? 'bg-orange-100'
                          : getPriorityStyles(selectedEvent.priority).color === 'text-yellow-600'
                            ? 'bg-yellow-100'
                            : 'bg-gray-100'
                  }`}
                  >
                    {React.createElement(
                      getEventIcon(selectedEvent.type, professionConfig?.id || ', '),
                      {
                        className: `w-5 h-5 ${getPriorityStyles(selectedEvent.priority).color}`,
                    },
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{selectedEvent.title}</h2>
                    <p className="text-gray-600">
                      {formatCountdown(selectedEvent.daysUntil, selectedEvent.hoursUntil)} •{''}
                      {selectedEvent.date}
                    </p>
                  </div>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedEvent && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Detaljer</TabsTrigger>
                <TabsTrigger value="preparation">Forberedelser</TabsTrigger>
                <TabsTrigger value="checklist">{terms.packing}</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Klient</label>
                    <p className="text-lg">{selectedEvent.clientName || 'Ikke spesifisert'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Tid</label>
                    <p className="text-lg">{selectedEvent.time || 'TBA'}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-600">Lokasjon</label>
                    <p className="text-lg">{selectedEvent.location || 'Ikke spesifisert'}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-600">Beskrivelse</label>
                    <p className="text-gray-700">{selectedEvent.description}</p>
                  </div>
                </div>

                {selectedEvent.teamMembers && (
                  <div>
                    <label className="text-sm font-medium text-gray-600 block mb-2">
                      Teammedlemmer
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selectedEvent.teamMembers.map((member, index) => (
                        <Badge key={index} variant="outline">
                          {member}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="preparation" className="space-y-4">
                <div className="space-y-3">
                  <h3 className="font-semibold">Anbefalte forberedelser</h3>
                  {selectedEvent.preparationTasks?.map((task, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span>{task}</span>
                    </div>
                  )) || <p className="text-gray-600">Ingen spesifikke forberedelser påkrevd.</p>}
                </div>
              </TabsContent>

              <TabsContent value="checklist" className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{terms.packing}</h3>
                    <Badge variant="outline">
                      {preparationTasks.filter((t) => t.completed).length}/{preparationTasks.length}{''}
                      fullført
                    </Badge>
                  </div>

                  {preparationTasks.length === 0 && (
                    <div className="text-center py-8">
                      <Inventory className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <Button
                        onClick={() => setPreparationTasks(generatePreparationTasks(selectedEvent))}
                        variant="outline"
                      >
                        <Add className="w-4 h-4 mr-2" />
                        Generer pakkeliste
                      </Button>
                    </div>
                  )}

                  {preparationTasks.map((task) => (
                    <div key={task.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => {
                          setPreparationTasks((prev) =>
                            prev.map((t) =>
                              t.id === task.id ? { ...t, completed: !t.completed } : t,
                            ),
                          );
                          completeTaskMutation.mutate({
                            eventId: selectedEvent.d,
                            taskId: task.d,
                        });
                      }}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p
                          className={`font-medium ${task.completed ? 'line-through text-gray-500' : ','}`}
                        >
                          {task.norwegianTask}
                        </p>
                        <p
                          className={`text-sm text-gray-600 ${task.completed ? 'line-through' : ','}`}
                        >
                          {task.task}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              task.priority === 'high'
                                ? 'border-red-200 text-red-600'
                                : task.priority === 'medium'
                                  ? 'border-yellow-200 text-yellow-600'
                                  : 'border-gray-200'
                          }`}
                          >
                            {task.priority === 'high'
                              ? 'Høy'
                              : task.priority === 'medium'
                                ? 'Medium' : 'Lav'}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {task.daysBeforeEvent} dager før
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Preparation Dialog */}
      <Dialog open={showPreparation} onOpenChange={setShowPreparation}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Inventory className="w-5 h-5" />
              <span>{terms.packing}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Du har en viktig hendelse om {selectedEvent?.daysUntil} dager. Her er din sjekkliste: </p>
            <div className="space-y-2">
              {preparationTasks.map((task) => (
                <div key={task.d} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => {
                      setPreparationTasks((prev) =>
                        prev.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t)),
                      );
                  }}
                  />
                  <span className={task.completed ? 'line-through text-gray-500':','}>
                    {task.norwegianTask}
                  </span>
                </div>
              ))}
            </div>
            <Button onClick={() => setShowPreparation(false)} className="w-full">
              Lukk
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Countdown View Dialog */}
      <UpcomingEventsCountdownView
        profession={profession}
        isOpen={showCountdownView}
        onClose={() => setShowCountdownView(false)}
      />
    </LoadingWrapper>
  );
}
