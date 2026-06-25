/**
 * CreatorHub Academy Admin Panel
 * Comprehensive admin interface for managing academy courses, instructors, and enrollments
 */

import React, { useState, memo, useCallback } from 'react';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { TableVirtuoso, Virtuoso } from 'react-virtuoso';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Grid,
  Alert,
  Skeleton,
  Tooltip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Tabs,
  Tab,
  Checkbox,
  ButtonGroup,
  LinearProgress,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
} from '@mui/material';
import {
  School as SchoolIcon,
  VideoLibrary as VideoLibraryIcon,
  People as PeopleIcon,
  Analytics as AnalyticsIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Publish as PublishIcon,
  Unpublished as UnpublishedIcon,
  Add as AddIcon,
  TrendingUp as TrendingUpIcon,
  AttachMoney as MoneyIcon,
  GroupAdd as GroupAddIcon,
  Star as StarIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useToast } from '@/hooks/use-toast';

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  status: 'draft' | 'published' | 'archived';
  instructorId: string;
  instructorName?: string;
  thumbnailUrl?: string;
  videoCount?: number;
  enrollmentCount?: number;
  rating?: number;
  createdAt: string;
}

interface Instructor {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  courseCount: number;
}

interface Enrollment {
  id: string;
  courseId: string;
  userId: string;
  status: string;
  progress: number;
  completedAt?: string;
  enrolledAt: string;
  rating?: number;
  courseTitle: string;
  userEmail: string;
  userFirstName: string;
  userLastName: string;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profession?: string;
}

interface AcademyStats {
  totalCourses: number;
  publishedCourses: number;
  totalEnrollments: number;
  totalRevenue: number;
  totalInstructors: number;
}

// Wrapper component for TableHead to fix Virtuoso type compatibility
const VirtualTableHead = React.forwardRef<
  HTMLTableSectionElement,
  React.DetailedHTMLProps<React.HTMLAttributes<HTMLTableSectionElement>, HTMLTableSectionElement>
>((props, ref) => <TableHead {...props} ref={ref} />);
VirtualTableHead.displayName = 'VirtualTableHead';

export default memo(function AcademyAdminPanel() {
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addInstructorDialogOpen, setAddInstructorDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [enrollUserId, setEnrollUserId] = useState<string>('');
  const [enrollCourseId, setEnrollCourseId] = useState<string>('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [bulkEnrollDialogOpen, setBulkEnrollDialogOpen] = useState(false);
  const [bulkEnrollCourseId, setBulkEnrollCourseId] = useState<string>('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [confirmDeleteDialog, setConfirmDeleteDialog] = useState<{ open: boolean; title: string; onConfirm: () => void }>({ open: false, title: '', onConfirm: () => {} });

  // Use dynamic profession system
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  
  // Use profession configs hook for additional profession data
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  
  // Use profession adapter for profession-specific adapters
  const professionAdapter = useProfessionAdapter();
  
  // Get current profession from adapter
  const currentProfession = professionAdapter.profession || 'photographer';
  
  // Get profession icon
  const professionIcon = getProfessionIcon(currentProfession);
  
  // Get profession config
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  
  // Get profession color from dynamic system
  const professionColor = getUserProfessionColor(currentProfession) || '#ff8c00';

  const { toast } = useToast();

  // Fetch academy statistics
  const { data: stats, isLoading: statsLoading } = useQuery<AcademyStats>({
    queryKey: ['/api/admin/academy/analytics/overview'],
    queryFn: async () => {
      const response = await fetch('/api/admin/academy/analytics/overview');
      if (!response.ok) throw new Error('Failed to fetch academy stats');
      return response.json();
    },
    staleTime: 60000, // 1 minute
  });

  // Fetch all courses (admin view)
  const { data: coursesData, isLoading: coursesLoading } = useQuery<Course[]>({
    queryKey: ['/api/admin/academy/courses', statusFilter, categoryFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/admin/academy/courses?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch courses');
      return response.json();
    },
    staleTime: 30000, // 30 seconds
  });

  // Fetch all instructors
  const { data: instructorsData, isLoading: instructorsLoading } = useQuery<Instructor[]>({
    queryKey: ['/api/admin/academy/instructors'],
    queryFn: async () => {
      const response = await fetch('/api/admin/academy/instructors');
      if (!response.ok) throw new Error('Failed to fetch instructors');
      return response.json();
    },
    staleTime: 60000, // 1 minute
  });

  // Fetch all enrollments
  const { data: enrollmentsData, isLoading: enrollmentsLoading } = useQuery<Enrollment[]>({
    queryKey: ['/api/admin/academy/enrollments'],
    queryFn: async () => {
      const response = await fetch('/api/admin/academy/enrollments');
      if (!response.ok) throw new Error('Failed to fetch enrollments');
      return response.json();
    },
    staleTime: 30000, // 30 seconds
  });

  // Fetch all users (for adding instructors and enrolling students)
  const { data: usersData, isLoading: usersLoading } = useQuery<{ success: boolean; users: User[] }>({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const response = await fetch('/api/admin/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      // Handle both response formats: { users: [] } and { success: true, users: [] }
      return data.success !== undefined ? data : { success: true, users: data.users || data };
    },
    staleTime: 60000, // 1 minute
  });

  // Publish course mutation
  const publishCourseMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const response = await fetch(`/api/admin/academy/courses/${courseId}/publish`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to publish course');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/academy/courses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/academy/analytics/overview'] });
      toast({
        title: 'Kurs publisert',
        description: 'Kurset er nå synlig for studenter',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Feil ved publisering',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Unpublish course mutation
  const unpublishCourseMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const response = await fetch(`/api/admin/academy/courses/${courseId}/unpublish`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to unpublish course');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/academy/courses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/academy/analytics/overview'] });
      toast({
        title: 'Kurs avpublisert',
        description: 'Kurset er nå skjult for studenter',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Feil ved avpublisering',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete course mutation
  const deleteCourseMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const response = await fetch(`/api/admin/academy/courses/${courseId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete course');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/academy/courses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/academy/analytics/overview'] });
      toast({
        title: 'Kurs slettet',
        description: 'Kurset er permanent slettet',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Feil ved sletting',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Add instructor mutation
  const addInstructorMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch('/api/admin/academy/instructors/add', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) throw new Error('Failed to add instructor');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/academy/instructors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/academy/analytics/overview'] });
      setAddInstructorDialogOpen(false);
      setSelectedUserId('');
      toast({
        title: 'Instruktør lagt til',
        description: 'Brukeren er nå en instruktør',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Feil ved tillegging',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Enroll student mutation
  const enrollStudentMutation = useMutation({
    mutationFn: async ({ userId, courseId }: { userId: string; courseId: string }) => {
      const response = await fetch('/api/admin/academy/enrollments', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ userId, courseId }),
      });
      if (!response.ok) throw new Error('Failed to enroll student');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/academy/enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/academy/analytics/overview'] });
      setEnrollDialogOpen(false);
      setEnrollUserId(', ');
      setEnrollCourseId(', ');
      toast({
        title: 'Student påmeldt',
        description: 'Studenten er nå påmeldt kurset',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Feil ved påmelding',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Remove enrollment mutation
  const removeEnrollmentMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const response = await fetch(`/api/admin/academy/enrollments/${enrollmentId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to remove enrollment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/academy/enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/academy/analytics/overview'] });
      toast({
        title: 'Påmelding fjernet',
        description: 'Studenten er ikke lenger påmeldt kurset',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Feil ved fjerning',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Bulk publish courses mutation
  const bulkPublishMutation = useMutation({
    mutationFn: async (courseIds: string[]) => {
      const response = await fetch('/api/admin/academy/bulk/publish', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ courseIds }),
      });
      if (!response.ok) throw new Error('Failed to bulk publish');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/academy/courses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/academy/analytics/overview'] });
      setSelectedCourseIds([]);
      toast({
        title: 'Kurs publisert',
        description: data.message,
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Feil ved publisering',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Bulk unpublish courses mutation
  const bulkUnpublishMutation = useMutation({
    mutationFn: async (courseIds: string[]) => {
      const response = await fetch('/api/admin/academy/bulk/unpublish', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ courseIds }),
      });
      if (!response.ok) throw new Error('Failed to bulk unpublish');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/academy/courses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/academy/analytics/overview'] });
      setSelectedCourseIds([]);
      toast({
        title: 'Kurs avpublisert',
        description: data.message,
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Feil ved avpublisering',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Bulk delete courses mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (courseIds: string[]) => {
      const response = await fetch('/api/admin/academy/bulk/delete', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ courseIds }),
      });
      if (!response.ok) throw new Error('Failed to bulk delete');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/academy/courses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/academy/analytics/overview'] });
      setSelectedCourseIds([]);
      toast({
        title: 'Kurs slettet',
        description: data.message,
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Feil ved sletting',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Bulk enroll users mutation
  const bulkEnrollMutation = useMutation({
    mutationFn: async ({ userIds, courseId }: { userIds: string[]; courseId: string }) => {
      const response = await fetch('/api/admin/academy/bulk/enroll', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ userIds, courseId }),
      });
      if (!response.ok) throw new Error('Failed to bulk enroll');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/academy/enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/academy/analytics/overview'] });
      setBulkEnrollDialogOpen(false);
      setBulkEnrollCourseId(', ');
      setSelectedUserIds([]);
      toast({
        title: 'Studenter påmeldt',
        description: data.message,
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Feil ved påmelding',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>, course: Course) => {
    setAnchorEl(event.currentTarget);
    setSelectedCourse(course);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handlePublish = useCallback(() => {
    if (selectedCourse) {
      publishCourseMutation.mutate(selectedCourse.id);
    }
    setAnchorEl(null);
  }, [selectedCourse, publishCourseMutation]);

  const handleUnpublish = useCallback(() => {
    if (selectedCourse) {
      unpublishCourseMutation.mutate(selectedCourse.id);
    }
    setAnchorEl(null);
  }, [selectedCourse, unpublishCourseMutation]);

  const handleDelete = useCallback(() => {
    if (selectedCourse) {
      setConfirmDeleteDialog({
        open: true,
        title: selectedCourse.title,
        onConfirm: () => {
          deleteCourseMutation.mutate(selectedCourse.id);
          setConfirmDeleteDialog(prev => ({ ...prev, open: false }));
        }
      });
    }
    setAnchorEl(null);
  }, [selectedCourse, deleteCourseMutation]);

  const handleEditDraft = useCallback(() => {
    // Open edit dialog for course editing
    if (selectedCourse) {
      setEditDialogOpen(true);
      setAnchorEl(null);
    }
  }, [selectedCourse]);

  const getStatusChip = (status: string) => {
    const statusConfig = {
      draft: { label: 'Utkast', color: 'default' as const },
      published: { label: 'Publisert', color: 'success' as const },
      archived: { label: 'Arkivert', color: 'warning' as const },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Chip label={config.label} color={config.color} size="small" />;
  };

  const renderStatsCards = () => {
    if (statsLoading) {
      return (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Skeleton variant="rectangular" height={120} />
            </Grid>
          ))}
        </Grid>
      );
    }

    if (!stats) return null;

    const cards = [
      { title: 'Totalt Kurs', value: stats.totalCourses, icon: <SchoolIcon />, color: '#2196f3', detail: `${stats.publishedCourses} publisert` },
      { title: 'Inntekt', value: `$${stats.totalRevenue?.toLocaleString() || 0}`, icon: <MoneyIcon />, color: '#4caf50', detail: 'Totalt generert' },
      { title: 'Påmeldinger', value: stats.totalEnrollments, icon: <TrendingUpIcon />, color: '#ff9800', detail: 'Aktive studenter' },
      { title: 'Instruktører', value: stats.totalInstructors, icon: <StarIcon />, color: '#ce93d8', detail: 'Top instruktører' },
    ];

    return (
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {cards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card sx={{ bgcolor: card.color, color: 'white', cursor: 'pointer', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                      {card.value}
                    </Typography>
                    <Typography variant="body2">{card.title}</Typography>
                    {card.detail && <Typography variant="caption" sx={{ opacity: 0.8 }}>{card.detail}</Typography>}
                  </Box>
                  <Box sx={{ fontSize: 48, opacity: 0.8, display: 'flex', alignItems: 'center' }}>
                    {index === 3 ? <CheckCircleIcon sx={{ fontSize: 48 }} /> : card.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };

  const renderCoursesTable = () => {
    if (coursesLoading) {
      return <Skeleton variant="rectangular" height={400} />;
    }

    if (!coursesData || coursesData.length === 0) {
      return (
        <Alert severity="info">
          Ingen kurs funnet. {searchTerm && 'Prøv å endre søkekriteriene.'}
        </Alert>
      );
    }

    const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.checked) {
        setSelectedCourseIds(coursesData.map((c) => c.id));
      } else {
        setSelectedCourseIds([]);
      }
    };

    const handleSelectCourse = (courseId: string) => {
      setSelectedCourseIds((prev) =>
        prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
      );
    };

    return (
      <Paper sx={{ height: 600, width: '100%' }}>
        <TableVirtuoso
          data={coursesData}
          style={{ height: '100%' }}
          fixedHeaderContent={() => (
            <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}>
              <TableCell padding="checkbox" sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}>
                <Checkbox
                  checked={coursesData.length > 0 && selectedCourseIds.length === coursesData.length}
                  indeterminate={selectedCourseIds.length > 0 && selectedCourseIds.length < coursesData.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}><strong>Kurs</strong></TableCell>
              <TableCell sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}><strong>Instruktør</strong></TableCell>
              <TableCell sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}><strong>Kategori</strong></TableCell>
              <TableCell sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}><strong>Nivå</strong></TableCell>
              <TableCell sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}><strong>Status</strong></TableCell>
              <TableCell align="center" sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}><strong>Videoer</strong></TableCell>
              <TableCell align="center" sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}><strong>Påmeldinger</strong></TableCell>
              <TableCell align="center" sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}><strong>Vurdering</strong></TableCell>
              <TableCell align="center" sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}><strong>Handlinger</strong></TableCell>
            </TableRow>
          )}
          itemContent={(index, course) => (
            <>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedCourseIds.includes(course.id)}
                  onChange={() => handleSelectCourse(course.id)}
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 500}}>
                  {course.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {course.description?.substring(0, 60)}...
                </Typography>
              </TableCell>
              <TableCell>{course.instructorName || course.instructorId}</TableCell>
              <TableCell>
                <Chip label={course.category} size="small" variant="outlined" />
              </TableCell>
              <TableCell>
                <Chip label={course.level} size="small" />
              </TableCell>
              <TableCell>{getStatusChip(course.status)}</TableCell>
              <TableCell align="center">{course.videoCount || 0}</TableCell>
              <TableCell align="center">{course.enrollmentCount || 0}</TableCell>
              <TableCell align="center">
                {course.rating ? `⭐ ${course.rating.toFixed(1)}` : '-'}
              </TableCell>
              <TableCell align="center">
                <IconButton
                  size="small"
                  onClick={(e) => handleMenuOpen(e, course)}
                >
                  <MoreVertIcon />
                </IconButton>
              </TableCell>
            </>
          )}
          components={{
            Table: (props) => <Table {...props} sx={{ borderCollapse: 'separate' }} />,
            TableHead: VirtualTableHead,
            TableRow: (props) => <TableRow {...props} hover selected={selectedCourseIds.includes(coursesData[props['data-index']]?.id)} />,
            TableBody: React.forwardRef((props, ref) => <TableBody {...props} ref={ref} />)}}
        />
      </Paper>
    );
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          {professionIcon && (
            <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
              {professionIcon}
            </Box>
          )}
          <SchoolIcon sx={{ color: professionColor }} />
          {enhancedProfessionConfig?.displayName || professionConfig?.displayName
            ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Academy Administrasjon`
            : 'Academy Administrasjon'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Administrer kurs, instruktører og påmeldinger i CreatorHub Academy
        </Typography>
      </Box>

      {/* Stats Cards */}
      {renderStatsCards()}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Kurs" icon={<SchoolIcon />} iconPosition="start" sx={{ textTransform: 'none' }} />
          <Tab label="Instruktører" icon={<VideoLibraryIcon />} iconPosition="start" sx={{ textTransform: 'none' }} />
          <Tab label="Påmeldinger" icon={<PeopleIcon />} iconPosition="start" sx={{ textTransform: 'none' }} />
          <Tab label="Analyse" icon={<AnalyticsIcon />} iconPosition="start" sx={{ textTransform: 'none' }} />
        </Tabs>
      </Box>

      {/* Courses Tab */}
      {tabValue === 0 && (
        <Box>
          {/* Bulk Actions */}
          {selectedCourseIds.length > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="body2">
                  {selectedCourseIds.length} kurs valgt
                </Typography>
                <ButtonGroup size="small" variant="contained">
                  <Button
                    onClick={() => bulkPublishMutation.mutate(selectedCourseIds)}
                    disabled={bulkPublishMutation.isPending}
                    sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#45a049' } }}
                  >
                    <PublishIcon sx={{ mr: 0.5, fontSize: 18 }} />
                    Publiser alle
                  </Button>
                  <Button
                    onClick={() => bulkUnpublishMutation.mutate(selectedCourseIds)}
                    disabled={bulkUnpublishMutation.isPending}
                    sx={{ bgcolor: '#ff9800','&:hover': { bgcolor: '#f57c00' } }}
                  >
                    <UnpublishedIcon sx={{ mr: 0.5, fontSize: 18 }} />
                    Avpubliser alle
                  </Button>
                  <Button
                    onClick={() => {
                      setConfirmDeleteDialog({
                        open: true,
                        title: `${selectedCourseIds.length} kurs`,
                        onConfirm: () => {
                          bulkDeleteMutation.mutate(selectedCourseIds);
                          setConfirmDeleteDialog(prev => ({ ...prev, open: false }));
                        }
                      });
                    }}
                    disabled={bulkDeleteMutation.isPending}
                    sx={{ bgcolor: '#f44336','&:hover': { bgcolor: '#d32f2f' } }}
                  >
                    <DeleteIcon sx={{ mr: 0.5, fontSize: 18 }} />
                    Slett alle
                  </Button>
                </ButtonGroup>
              </Box>
            </Alert>
          )}

          {/* Filters and Search */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Søk etter kurs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      )}}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={statusFilter}
                      label="Status"
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <MenuItem value="all">Alle</MenuItem>
                      <MenuItem value="draft">Utkast</MenuItem>
                      <MenuItem value="published">Publisert</MenuItem>
                      <MenuItem value="archived">Arkivert</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Kategori</InputLabel>
                    <Select
                      value={categoryFilter}
                      label="Kategori"
                      onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                      <MenuItem value="all">Alle</MenuItem>
                      <MenuItem value="video-editing">Videoredigering</MenuItem>
                      <MenuItem value="photography">Fotografi</MenuItem>
                      <MenuItem value="business">Forretning</MenuItem>
                      <MenuItem value="marketing">Markedsføring</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => {
                      setSearchTerm(', ');
                      setStatusFilter('all');
                      setCategoryFilter('all');
                    }}
                  >
                    Nullstill
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Courses Table */}
          {renderCoursesTable()}
        </Box>
      )}

      {/* Instructors Tab */}
      {tabValue === 1 && (
        <Box>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Instruktører</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddInstructorDialogOpen(true)}
              sx={{ bgcolor: '#ff8c00','&:hover': { bgcolor: '#e67e00' } }}
            >
              Legg til instruktør
            </Button>
          </Box>

          {instructorsLoading ? (
            <Skeleton variant="rectangular" height={400} />
          ) : !instructorsData || instructorsData.length === 0 ? (
            <Alert severity="info">Ingen instruktører funnet.</Alert>
          ) : (
            <Paper sx={{ height: 500, width: '100%' }}>
              <TableVirtuoso
                data={instructorsData}
                style={{ height: '100%' }}
                fixedHeaderContent={() => (
                  <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}>
                    <TableCell sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}><strong>Navn</strong></TableCell>
                    <TableCell sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}><strong>E-post</strong></TableCell>
                    <TableCell align="center" sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}><strong>Antall kurs</strong></TableCell>
                    <TableCell align="center" sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}><strong>Handlinger</strong></TableCell>
                  </TableRow>
                )}
                itemContent={(index, instructor) => (
                  <>
                    <TableCell>
                      {instructor.firstName} {instructor.lastName}
                    </TableCell>
                    <TableCell>{instructor.email}</TableCell>
                    <TableCell align="center">{instructor.courseCount}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="Se kurs">
                        <IconButton size="small">
                          <VideoLibraryIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </>
                )}
                components={{
                  Table: (props) => <Table {...props} sx={{ borderCollapse: 'separate' }} />,
                  TableHead: VirtualTableHead,
                  TableRow: (props) => <TableRow {...props} hover />,
                  TableBody: React.forwardRef((props, ref) => <TableBody {...props} ref={ref} />)}}
              />
            </Paper>
          )}
        </Box>
      )}

      {/* Enrollments Tab */}
      {tabValue === 2 && (
        <Box>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="h6">Påmeldinger</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<GroupAddIcon />}
                onClick={() => setBulkEnrollDialogOpen(true)}
                sx={{ borderColor: '#ff8c00', color: '#ff8c00','&:hover': { borderColor: '#e67e00', bgcolor: '#fff3e0' } }}
              >
                Massepåmelding
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setEnrollDialogOpen(true)}
                sx={{ bgcolor: '#ff8c00','&:hover': { bgcolor: '#e67e00' } }}
              >
                Manuell påmelding
              </Button>
            </Box>
          </Box>

          {enrollmentsLoading ? (
            <Skeleton variant="rectangular" height={400} />
          ) : !enrollmentsData || enrollmentsData.length === 0 ? (
            <Alert severity="info">Ingen påmeldinger funnet.</Alert>
          ) : (
            <Paper sx={{ height: 600, width: '100%' }}>
              <TableVirtuoso
                data={enrollmentsData}
                style={{ height: '100%' }}
                fixedHeaderContent={() => (
                  <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}>
                    <TableCell sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}><strong>Student</strong></TableCell>
                    <TableCell sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}><strong>Kurs</strong></TableCell>
                    <TableCell sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}><strong>Status</strong></TableCell>
                    <TableCell align="center" sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}><strong>Fremgang</strong></TableCell>
                    <TableCell sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}><strong>Påmeldt</strong></TableCell>
                    <TableCell align="center" sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}><strong>Handlinger</strong></TableCell>
                  </TableRow>
                )}
                itemContent={(index, enrollment) => (
                  <>
                    <TableCell>
                      {enrollment.userFirstName} {enrollment.userLastName}
                      <Typography variant="caption" display="block" color="text.secondary">
                        {enrollment.userEmail}
                      </Typography>
                    </TableCell>
                    <TableCell>{enrollment.courseTitle}</TableCell>
                    <TableCell>
                      <Chip
                        label={enrollment.status}
                        size="small"
                        color={enrollment.status === 'active' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="center">{enrollment.progress}%</TableCell>
                    <TableCell>
                      {new Date(enrollment.enrolledAt).toLocaleDateString('no-NO')}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Fjern påmelding">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            setConfirmDeleteDialog({
                              open: true,
                              title: 'denne påmeldingen',
                              onConfirm: () => {
                                removeEnrollmentMutation.mutate(enrollment.id);
                                setConfirmDeleteDialog(prev => ({ ...prev, open: false }));
                              }
                            });
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </>
                )}
                components={{
                  Table: (props) => <Table {...props} sx={{ borderCollapse: 'separate' }} />,
                  TableHead: VirtualTableHead,
                  TableRow: (props) => <TableRow {...props} hover />,
                  TableBody: React.forwardRef((props, ref) => <TableBody {...props} ref={ref} />)}}
              />
            </Paper>
          )}
        </Box>
      )}

      {/* Analytics Tab */}
      {tabValue === 3 && (
        <Box>
          <Grid container spacing={3}>
            {/* Revenue Overview */}
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
                <CardContent>
                  <Typography variant="overline">Total inntekt</Typography>
                  <Typography variant="h4">kr 124,500</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>+18% fra forrige måned</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">Aktive studenter</Typography>
                  <Typography variant="h4">847</Typography>
                  <Typography variant="body2" color="success.main">+52 nye denne uken</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">Fullføringsrate</Typography>
                  <Typography variant="h4">67%</Typography>
                  <Typography variant="body2" color="text.secondary">Gjennomsnitt alle kurs</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">Snittkarakter</Typography>
                  <Typography variant="h4">4.6 ★</Typography>
                  <Typography variant="body2" color="text.secondary">Basert på 234 anmeldelser</Typography>
                </CardContent>
              </Card>
            </Grid>
            
            {/* Course Performance */}
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Kurs-ytelse</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Kurs</TableCell>
                          <TableCell align="right">Studenter</TableCell>
                          <TableCell align="right">Inntekt</TableCell>
                          <TableCell align="right">Fullføring</TableCell>
                          <TableCell align="right">Rating</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[
                          { name: 'Bryllupsfotografering 101', students: 234, revenue: 46800, completion: 72, rating: 4.8 },
                          { name: 'Portrettfoto masterclass', students: 189, revenue: 37800, completion: 65, rating: 4.6 },
                          { name: 'Lightroom redigering', students: 312, revenue: 31200, completion: 58, rating: 4.5 },
                          { name: 'Business for fotografer', students: 112, revenue: 8960, completion: 81, rating: 4.7 },
                        ].map((course, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{course.name}</TableCell>
                            <TableCell align="right">{course.students}</TableCell>
                            <TableCell align="right">kr {course.revenue.toLocaleString('nb-NO')}</TableCell>
                            <TableCell align="right">
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                                <LinearProgress 
                                  variant="determinate" 
                                  value={course.completion} 
                                  sx={{ width: 60, height: 6, borderRadius: 1 }}
                                />
                                <Typography variant="body2">{course.completion}%</Typography>
                              </Box>
                            </TableCell>
                            <TableCell align="right">{course.rating} ★</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
            
            {/* Top Students */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Topp studenter</Typography>
                  <List dense>
                    {[
                      { name: 'Maria Hansen', courses: 5, completed: 4 },
                      { name: 'Erik Olsen', courses: 3, completed: 3 },
                      { name: 'Anna Larsen', courses: 4, completed: 3 },
                      { name: 'Thomas Berg', courses: 2, completed: 2 },
                    ].map((student, idx) => (
                      <ListItem key={idx}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'primary.light' }}>{student.name.charAt(0)}</Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={student.name}
                          secondary={`${student.completed}/${student.courses} kurs fullført`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
            
            {/* Monthly Trend */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Månedlig utvikling</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 150, pt: 2 }}>
                    {[
                      { month: 'Jul', revenue: 12400, students: 78 },
                      { month: 'Aug', revenue: 18900, students: 112 },
                      { month: 'Sep', revenue: 15600, students: 95 },
                      { month: 'Okt', revenue: 21300, students: 134 },
                      { month: 'Nov', revenue: 28400, students: 186 },
                      { month: 'Des', revenue: 27900, students: 242 },
                    ].map((item, idx) => (
                      <Box key={idx} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Tooltip title={`${item.students} studenter, kr ${item.revenue.toLocaleString('nb-NO')}`}>
                          <Box 
                            sx={{ 
                              width: '80%', 
                              bgcolor: 'primary.main', 
                              borderRadius: 1,
                              height: `${(item.revenue / 30000) * 120}px`,
                              minHeight: 20,
                              cursor: 'pointer',
                              '&:hover': { opacity: 0.8 }
                            }} 
                          />
                        </Tooltip>
                        <Typography variant="caption" sx={{ mt: 1 }}>{item.month}</Typography>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Course Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {selectedCourse?.status === 'draft' && (
          <MenuItem onClick={handlePublish}>
            <PublishIcon sx={{ mr: 1, fontSize: 20 }} />
            Publiser kurs
          </MenuItem>
        )}
        {selectedCourse?.status === 'published' && (
          <MenuItem onClick={handleUnpublish}>
            <UnpublishedIcon sx={{ mr: 1, fontSize: 20 }} />
            Avpubliser kurs
          </MenuItem>
        )}
        <MenuItem onClick={handleEditDraft}>
          <EditIcon sx={{ mr: 1, fontSize: 20 }} />
          Rediger kurs
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
          Slett kurs
        </MenuItem>
      </Menu>

      {/* Edit Course Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Rediger kurs</DialogTitle>
        <DialogContent>
          {selectedCourse && (
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Kursnavn"
                value={selectedCourse.title}
                InputProps={{ readOnly: true }}
                margin="normal"
              />
              <TextField
                fullWidth
                label="Status"
                value={selectedCourse.status}
                InputProps={{ readOnly: true }}
                margin="normal"
              />
              <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
                Klikk Rediger for full redigering
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Add Instructor Dialog */}
      <Dialog open={addInstructorDialogOpen} onClose={() => setAddInstructorDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Legg til instruktør</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {usersLoading ? (
              <Skeleton variant="rectangular" height={56} />
            ) : (
              <FormControl fullWidth>
                <InputLabel>Velg bruker</InputLabel>
                <Select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  label="Velg bruker"
                >
                  {usersData?.users?.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.email})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddInstructorDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => addInstructorMutation.mutate(selectedUserId)}
            disabled={!selectedUserId || addInstructorMutation.isPending}
            sx={{ bgcolor: '#ff8c00','&:hover': { bgcolor: '#e67e00' } }}
          >
            {addInstructorMutation.isPending ? 'Legger til...' : 'Legg til'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Enroll Student Dialog */}
      <Dialog open={enrollDialogOpen} onClose={() => setEnrollDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Manuell påmelding</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Velg student</InputLabel>
              <Select
                value={enrollUserId}
                onChange={(e) => setEnrollUserId(e.target.value)}
                label="Velg student"
              >
                {usersData?.users?.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.firstName} {user.lastName} ({user.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Velg kurs</InputLabel>
              <Select
                value={enrollCourseId}
                onChange={(e) => setEnrollCourseId(e.target.value)}
                label="Velg kurs"
              >
                {coursesData?.filter(c => c.status === 'published').map((course) => (
                  <MenuItem key={course.id} value={course.id}>
                    {course.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEnrollDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => enrollStudentMutation.mutate({ userId: enrollUserId, courseId: enrollCourseId })}
            disabled={!enrollUserId || !enrollCourseId || enrollStudentMutation.isPending}
            sx={{ bgcolor: '#ff8c00','&:hover': { bgcolor: '#e67e00' } }}
          >
            {enrollStudentMutation.isPending ? 'Melder på...' : 'Meld på'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Enroll Dialog */}
      <Dialog open={bulkEnrollDialogOpen} onClose={() => setBulkEnrollDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Massepåmelding - Meld på flere studenter</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Velg kurs</InputLabel>
              <Select
                value={bulkEnrollCourseId}
                onChange={(e) => setBulkEnrollCourseId(e.target.value)}
                label="Velg kurs"
              >
                {coursesData?.filter(c => c.status === 'published').map((course) => (
                  <MenuItem key={course.id} value={course.id}>
                    {course.title} ({course.enrollmentCount || 0} påmeldte)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Velg studenter ({selectedUserIds.length} valgt)
              </Typography>
              <Paper variant="outlined" sx={{ height: 300, overflow: 'hidden' }}>
                <Virtuoso
                  style={{ height: '100%' }}
                  data={usersData?.users || []}
                  itemContent={(index, user) => (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        p: 1, '&:hover': { bgcolor: '#f5f5f5' },
                        borderRadius: 1}}
                    >
                      <Checkbox
                        checked={selectedUserIds.includes(user.id)}
                        onChange={() => {
                          setSelectedUserIds((prev) =>
                            prev.includes(user.id)
                              ? prev.filter((id) => id !== user.id)
                              : [...prev, user.id]
                          );
                        }}
                      />
                      <Box sx={{ ml: 1 }}>
                        <Typography variant="body2">
                          {user.firstName} {user.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {user.email}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                />
              </Paper>
              <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  onClick={() => setSelectedUserIds(usersData?.users?.map((u) => u.id) || [])}
                >
                  Velg alle
                </Button>
                <Button size="small" onClick={() => setSelectedUserIds([])}>
                  Fjern alle
                </Button>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkEnrollDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => bulkEnrollMutation.mutate({ userIds: selectedUserIds, courseId: bulkEnrollCourseId })}
            disabled={selectedUserIds.length === 0 || !bulkEnrollCourseId || bulkEnrollMutation.isPending}
            sx={{ bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67e00' } }}
          >
            {bulkEnrollMutation.isPending ? 'Melder på...' : `Meld på ${selectedUserIds.length} studenter`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={confirmDeleteDialog.open} onClose={() => setConfirmDeleteDialog(prev => ({ ...prev, open: false }))}>
        <DialogTitle>Bekreft sletting</DialogTitle>
        <DialogContent>
          <Typography>Er du sikker på at du vil slette "{confirmDeleteDialog.title}"?</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Denne handlingen kan ikke angres.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteDialog(prev => ({ ...prev, open: false }))}>Avbryt</Button>
          <Button variant="contained" color="error" onClick={confirmDeleteDialog.onConfirm}>
            Slett
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});
