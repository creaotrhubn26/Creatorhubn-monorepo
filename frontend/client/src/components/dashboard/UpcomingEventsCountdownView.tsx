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
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  ArrowLeft,
  Eye,
  Settings,
  Plus,
  Filter,
  Search,
  SortAsc,
  SortDesc,
  ChevronDown,
  ChevronRight,
  Zap,
  Star,
  TrendingUp,
  Target,
  Award,
  Layers,
} from 'lucide-react';

interface UpcomingEventsCountdownViewProps {
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  isOpen: boolean;
  onClose: () => void
}

interface CountdownEvent {
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
  minutesUntil?: number;
  profession: string;
  category: 'thisWeek' | 'nextWeek' | 'thisMonth' | 'upcoming';
  estimatedDuration?: string;
  teamMembers?: string[];
  preparationRequired?: boolean
}

export function UpcomingEventsCountdownView({
  profession,
  isOpen,
  onClose,
}: UpcomingEventsCountdownViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['thisWeek']));

  const queryClient = useQueryClient();
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);

  // Update current time every minute for accurate countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
  }, 60000);
    return () => clearInterval(timer);
}, []);

  // Fetch all upcoming events
  const { data: allEvents, isLoading } = useQuery({
    queryKey: ['/api/dashboard/upcoming-events', profession],
    refetchInterval: 2 * 60 * 100, // Refresh every 2 minutes
});

  // Calculate real-time countdown
  const calculateDetailedCountdown = (eventDate: string, eventTime?: string) => {
    const now = new Date();
    const event = new Date(`${eventDate}${eventTime ? ` ${eventTime}` : ', '}`);
    const diffMs = event.getTime() - now.getTime();

    if (diffMs <= 0) {
      return { expired: true, text: 'Utløpt', className: 'text-red-600',};
  }

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return {
        expired: false,
        text: `${days}d ${hours}t`,
        className: days <= 1
            ? 'text-red-600 font-bold'
            : days <= 7
              ? 'text-orange-600 font-semibold'
              : 'text-blue-60',
        urgency: days <= 1 ? 'critical' : days <= 7 ? 'high' : 'normal',
    };
  } else if (hours > 0) {
      return {
        expired: false,
        text: `${hours}t ${minutes}m`,
        className: hours <= 2 ? 'text-red-600 font-bold animate-pulse' : 'text-orange-600 font-semibold',
        urgency: 'critical',
    };
  } else {
      return {
        expired: false,
        text: `${minutes}m`,
        className: 'text-red-600 font-bold animate-pulse',
        urgency: 'critical',
    };
  }
};

   // Categorize events by timeline
   const categorizeEvents = (events: CountdownEvent[]) => {
    // Simple bucket logic based on daysUntil
    return {
      today: events.filter((e) => e.daysUntil === 0),
      thisWeek: events.filter((e) => e.daysUntil > 0 && e.daysUntil <= 7),
      nextWeek: events.filter((e) => e.daysUntil > 7 && e.daysUntil <= 14),
      thisMonth: events.filter((e) => e.daysUntil > 14 && e.daysUntil <= 30),
      upcoming: events.filter((e) => e.daysUntil > 30),
    };
  };


  // Get profession-specific terminology
  const getProfessionTerms = (profession: string) => {
    switch (profession) {
      case 'photographer':
        return {
          title: 'Fotografi Nedtelling',
          subtitle: 'Alle dine kommende fotograferinger og møter',
          todayLabel: 'I dag',
          thisWeekLabel: 'Denne uken',
          nextWeekLabel: 'Neste uke',
          thisMonthLabel: 'Denne måneden',
          upcomingLabel: 'Kommende',
          noEventsMessage: 'Ingen planlagte fotograferinger',
      };
      case 'videographer':
        return {
          title: 'Video Nedtelling',
          subtitle: 'Alle dine kommende videoproduksjoner og møter',
          todayLabel: 'I dag',
          thisWeekLabel: 'Denne uken',
          nextWeekLabel: 'Neste uke',
          thisMonthLabel: 'Denne måneden',
          upcomingLabel: 'Kommende',
          noEventsMessage: 'Ingen planlagte videoproduksjoner',
      };
      case 'music_producer':
        return {
          title: 'Studio Nedtelling',
          subtitle: 'Alle dine kommende studioøkter og møter',
          todayLabel: 'I dag',
          thisWeekLabel: 'Denne uken',
          nextWeekLabel: 'Neste uke',
          thisMonthLabel: 'Denne måneden',
          upcomingLabel: 'Kommende',
          noEventsMessage: 'Ingen planlagte studioøkter',
      };
      case 'vendor':
        return {
          title: 'Leveranse Nedtelling',
          subtitle: 'Alle dine kommende leveranser og møter',
          todayLabel: 'I dag',
          thisWeekLabel: 'Denne uken',
          nextWeekLabel: 'Neste uke',
          thisMonthLabel: 'Denne måneden',
          upcomingLabel: 'Kommende',
          noEventsMessage: 'Ingen planlagte leveranser',
      };
      default: return {
          title: 'Hendelse Nedtelling',
          subtitle: 'Alle dine kommende hendelser og møter',
          todayLabel: 'I dag',
          thisWeekLabel: 'Denne uken',
          nextWeekLabel: 'Neste uke',
          thisMonthLabel: 'Denne måneden',
          upcomingLabel: 'Kommende',
          noEventsMessage: 'Ingen planlagte hendelser',
      };
  }
};

  // Get event icon based on type and profession
  const getEventIcon = (type: string, profession: string) => {
    if (type === 'wedding') return Heart;
    if (type === 'meeting') return Users;
    if (type === 'deadline') return Timer;

    switch (profession) {
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

  // Get priority styling
  const getPriorityStyles = (priority: string, urgency?: string) => {
    if (urgency === 'critical') {
      return {
        color: 'text-red-60',
        bg: 'bg-red-50 border-red-200 shadow-red-10',
        badge: 'bg-red-100 text-red-70',
    };
  }

    switch (priority) {
      case 'critical':
        return {
          color: 'text-red-60',
          bg: 'bg-red-50 border-red-200 shadow-red-10',
          badge: 'bg-red-100 text-red-70',
      };
      case 'high':
        return {
          color: 'text-orange-60',
          bg: 'bg-orange-50 border-orange-200 shadow-orange-10',
          badge: 'bg-orange-100 text-orange-70',
      };
      case 'medium':
        return {
          color: 'text-yellow-60',
          bg: 'bg-yellow-50 border-yellow-200 shadow-yellow-10',
          badge: 'bg-yellow-100 text-yellow-70',
      };
      default: return {
          color: 'text-gray-60',
          bg: 'bg-gray-50 border-gray-200 shadow-gray-10',
          badge: 'bg-gray-100 text-gray-70',
      };
  }
};

  // Toggle group expansion
  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
  } else {
        newSet.add(groupName);
    }
      return newSet;
  });
};

  const terms = getProfessionTerms(profession);

  if (!isOpen) return null;

  const filteredEvents =
    allEvents?.filter((event) => {
      const matchesSearch =
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || event.type === filterType;
      return matchesSearch && matchesType;
  }) || [];

  const categorizedEvents = categorizeEvents(filteredEvents);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <DialogTitle className="text-2xl font-bold">{terms.title}</DialogTitle>
                <p className="text-gray-600 mt-1">{terms.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="px-3 py-1">
                {filteredEvents.length} hendelser
              </Badge>
              <Button variant="outline" size="sm">
                <Add className="w-4 h-4 mr-2" />
                Ny hendelse
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Filters and Search */}
        <div className="flex flex-wrap gap-4 pb-4 border-b">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Søk i hendelser..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">Alle typer</option>
            <option value="meeting">Møter</option>
            <option value="wedding">Bryllup</option>
            <option value="deadline">Deadlines</option>
            <option value="project">Prosjekter</option>
          </select>

          <Button variant="outline" size="sm">
            <FilterList className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>

        {/* Events Content */}
        <div className="flex-1 overflow-y-auto space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Laster hendelser...</span>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-12">
              <CalendarToday className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">{terms.noEventsMessage}</h3>
              <p className="text-gray-500">
                {searchTerm
                  ? 'Ingen hendelser matcher søket ditt' : 'Du har ingen planlagte hendelser akkurat nå'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Today's Events */}
              {categorizedEvents.today.length > 0 && (
                <div className="space-y-3">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleGroup('today')}
                  >
                    <h3 className="text-lg font-semibold text-red-600 flex items-center space-x-2">
                      <Warning className="w-5 h-5" />
                      <span>{terms.todayLabel}</span>
                      <Badge variant="destructive" className="ml-2">
                        {categorizedEvents.today.length}
                      </Badge>
                    </h3>
                    {expandedGroups.has('today') ? (
                      <ExpandMore className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </div>

                  {expandedGroups.has('today') && (
                    <div className="space-y-3">
                      {categorizedEvents.today.map((event) => {
                        const countdown = calculateDetailedCountdown(event.date, event.time);
                        const EventIcon = getEventIcon(event.type, event.profession);
                        const styles = getPriorityStyles(event.priority, countdown.urgency);

                        return (
                          <MuiCard key={event.id} className={`${styles.bg} border-2 shadow-md`}>
                            <CardContent className="p-4" sx={theming.getThemedCardSx()}>
                              <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-3 flex-1">
                                  <div className={`p-2 rounded-full bg-white shadow-sm`}>
                                    <EventIcon className={`w-5 h-5 ${styles.color}`} />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-2">
                                      <h4 className="font-semibold text-gray-900">{event.title}</h4>
                                      <Badge className={styles.badge}>
                                        {event.type === 'wedding'
                                          ? 'Bryllup'
                                          : event.type === 'meeting'
                                            ? 'Møte'
                                            : event.type === 'deadline'
                                              ?'Deadline'
                                              : event.type}
                                      </Badge>
                                    </div>
                                    <p className="text-gray-700 mb-2">{event.description}</p>
                                    <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                                      {event.time && (
                                        <span className="flex items-center space-x-1">
                                          <AccessTime className="w-4 h-4" />
                                          <span>{event.time}</span>
                                        </span>
                                      )}
                                      {event.clientName && (
                                        <span className="flex items-center space-x-1">
                                          <People className="w-4 h-4" />
                                          <span>{event.clientName}</span>
                                        </span>
                                      )}
                                      {event.location && (
                                        <span className="flex items-center space-x-1">
                                          <LocationOn className="w-4 h-4" />
                                          <span>{event.location}</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-2xl font-bold ${countdown.className}`}>
                                    {countdown.text}
                                  </div>
                                  {event.preparationRequired && (
                                    <Button variant="outline" size="sm" className="mt-2">
                                      <Inventory className="w-4 h-4 mr-1" />
                                      Forberedelser
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </MuiCard>
                        );
                    })}
                    </div>
                  )}
                </div>
              )}

              {/* This Week */}
              {categorizedEvents.thisWeek.length > 0 && (
                <div className="space-y-3">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleGroup('thisWeek')}
                  >
                    <h3 className="text-lg font-semibold text-orange-600 flex items-center space-x-2">
                      <Timer className="w-5 h-5" />
                      <span>{terms.thisWeekLabel}</span>
                      <Badge variant="outline" className="ml-2 border-orange-200 text-orange-700">
                        {categorizedEvents.thisWeek.length}
                      </Badge>
                    </h3>
                    {expandedGroups.has('thisWeek') ? (
                      <ExpandMore className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </div>

                  {expandedGroups.has('thisWeek') && (
                    <div className="grid grid-cols-1 lg: grid-cols-2 gap-4">
                      {categorizedEvents.thisWeek.map((event) => {
                        const countdown = calculateDetailedCountdown(event.date, event.time);
                        const EventIcon = getEventIcon(event.type, event.profession);
                        const styles = getPriorityStyles(event.priority, countdown.urgency);

                        return (
                          <MuiCard key={event.id} className={`${styles.bg} border`}>
                            <CardContent className="p-4" sx={theming.getThemedCardSx()}>
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                  <EventIcon className={`w-4 h-4 ${styles.color}`} />
                                  <h4 className="font-medium text-gray-900">{event.title}</h4>
                                </div>
                                <div className={`text-lg font-semibold ${countdown.className}`}>
                                  {countdown.text}
                                </div>
                              </div>
                              <div className="space-y-1 text-sm text-gray-600">
                                <div>
                                  {event.date} {event.time && `• ${event.time}`}
                                </div>
                                {event.clientName && <div>Klient: {event.clientName}</div>}
                                {event.location && <div>📍 {event.location}</div>}
                              </div>
                            </CardContent>
                          </MuiCard>
                        );
                    })}
                    </div>
                  )}
                </div>
              )}

              {/* Next Week */}
              {categorizedEvents.nextWeek.length > 0 && (
                <div className="space-y-3">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleGroup('nextWeek')}
                  >
                    <h3 className="text-lg font-semibold text-blue-600 flex items-center space-x-2">
                      <CalendarToday className="w-5 h-5" />
                      <span>{terms.nextWeekLabel}</span>
                      <Badge variant="outline" className="ml-2 border-blue-200 text-blue-700">
                        {categorizedEvents.nextWeek.length}
                      </Badge>
                    </h3>
                    {expandedGroups.has('nextWeek') ? (
                      <ExpandMore className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </div>

                  {expandedGroups.has('nextWeek') && (
                    <div className="grid grid-cols-1 lg: grid-cols-3 gap-3">
                      {categorizedEvents.nextWeek.map((event) => {
                        const countdown = calculateDetailedCountdown(event.date, event.time);
                        const EventIcon = getEventIcon(event.type, event.profession);

                        return (
                          <MuiCard key={event.id} className="border">
                            <CardContent className="p-3" sx={theming.getThemedCardSx()}>
                              <div className="flex items-center space-x-2 mb-2">
                                <EventIcon className="w-4 h-4 text-blue-600" />
                                <h4 className="font-medium text-sm">{event.title}</h4>
                              </div>
                              <div className="text-sm text-gray-600 mb-2">
                                {event.date} • {countdown.text}
                              </div>
                              {event.clientName && (
                                <div className="text-xs text-gray-500">{event.clientName}</div>
                              )}
                            </CardContent>
                          </MuiCard>
                        );
                    })}
                    </div>
                  )}
                </div>
              )}

              {/* This Month */}
              {categorizedEvents.thisMonth.length > 0 && (
                <div className="space-y-3">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleGroup('thisMonth')}
                  >
                    <h3 className="text-lg font-semibold text-gray-600 flex items-center space-x-2">
                      <CalendarToday className="w-5 h-5" />
                      <span>{terms.thisMonthLabel}</span>
                      <Badge variant="outline" className="ml-2">
                        {categorizedEvents.thisMonth.length}
                      </Badge>
                    </h3>
                    {expandedGroups.has('thisMonth') ? (
                      <ExpandMore className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </div>

                  {expandedGroups.has('thisMonth') && (
                    <div className="space-y-2">
                      {categorizedEvents.thisMonth.map((event) => {
                        const EventIcon = getEventIcon(event.type, event.profession);

                        return (
                          <div
                            key={event.id}
                            className="flex items-center justify-between p-3 border rounded-lg hover: bg-gray-50"
                          >
                            <div className="flex items-center space-x-3">
                              <EventIcon className="w-4 h-4 text-gray-500" />
                              <div>
                                <h4 className="font-medium">{event.title}</h4>
                                <div className="text-sm text-gray-600">
                                  {event.date} • {event.clientName}
                                </div>
                              </div>
                            </div>
                            <div className="text-sm text-gray-500">{event.daysUntil} dager</div>
                          </div>
                        );
                    })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
