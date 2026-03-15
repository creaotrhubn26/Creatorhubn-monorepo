import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add,
  DeleteOutline,
  Groups,
  PhotoCamera,
  Save,
  School,
  VideoLibrary,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import {
  type AcademyInstructor,
  useAcademy,
} from '@/contexts/AcademyContext';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import AcademyLeftSidebar from './AcademyLeftSidebar';
import AcademyLocaleSwitcher from './AcademyLocaleSwitcher';
import { useAcademyLocale } from './academyLocale';

type AcademyInstructorAdminStudioProps = {
  courseId?: string;
};

const shellPanelSx = {
  borderRadius: 1.25,
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
  background:
    'linear-gradient(150deg, rgba(19,23,35,0.92), rgba(10,12,20,0.96))',
};

const parseExpertiseList = (value: string): string[] => {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );
};

function AcademyInstructorAdminStudio({
  courseId,
}: AcademyInstructorAdminStudioProps) {
  const [location, setLocation] = useLocation();
  const {
    state,
    getCourse,
    getInstructor,
    setCurrentCourse,
    updateCourse,
    createInstructor,
    updateInstructor,
    deleteInstructor,
  } = useAcademy();
  const { analytics, debugging } = useEnhancedMasterIntegration();
  const { tt, navLabel } = useAcademyLocale();

  const routeCourseId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return String(params.get('courseId') || params.get('course_id') || '').trim();
  }, [location]);

  const [leftNav, setLeftNav] = useState('instructors');
  const [selectedCourseId, setSelectedCourseId] = useState(
    courseId || routeCourseId || '',
  );
  const [selectedLeadInstructorId, setSelectedLeadInstructorId] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [editorMode, setEditorMode] = useState<'new' | 'edit'>('new');
  const [selectedInstructorId, setSelectedInstructorId] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [bioInput, setBioInput] = useState('');
  const [avatarInput, setAvatarInput] = useState('');
  const [professionInput, setProfessionInput] = useState<AcademyInstructor['profession']>('videographer');
  const [expertiseInput, setExpertiseInput] = useState('');
  const [activeInput, setActiveInput] = useState(true);
  const [avatarMessage, setAvatarMessage] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const avatarUploadInputRef = useRef<HTMLInputElement | null>(null);

  const courseItems = useMemo(() => {
    if (Array.isArray(state.courses) && state.courses.length > 0) {
      return state.courses;
    }
    return [];
  }, [state.courses]);

  const instructorItems = useMemo(() => {
    return [...(state.instructors || [])].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  }, [state.instructors]);

  const activeCourse = useMemo(() => {
    if (selectedCourseId) {
      const fromSelected = getCourse(selectedCourseId);
      if (fromSelected) return fromSelected;
    }
    if (courseId) {
      const fromProp = getCourse(courseId);
      if (fromProp) return fromProp;
    }
    if (routeCourseId) {
      const fromRoute = getCourse(routeCourseId);
      if (fromRoute) return fromRoute;
    }
    return state.currentCourse || courseItems[0] || null;
  }, [courseId, courseItems, getCourse, routeCourseId, selectedCourseId, state.currentCourse]);

  const filteredInstructors = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return instructorItems;
    return instructorItems.filter((instructor) => {
      return (
        instructor.name.toLowerCase().includes(query) ||
        instructor.profession.toLowerCase().includes(query) ||
        instructor.expertise.join(' ').toLowerCase().includes(query)
      );
    });
  }, [instructorItems, searchValue]);

  const syncCourseIdInRoute = useCallback(
    (nextCourseId: string) => {
      const normalizedCourseId = String(nextCourseId || '').trim();
      const [pathname, rawQuery = ''] = location.split('?');
      const params = new URLSearchParams(rawQuery);

      if (normalizedCourseId) {
        params.set('courseId', normalizedCourseId);
      } else {
        params.delete('courseId');
      }
      params.delete('course_id');

      const suffix = params.toString();
      setLocation(suffix ? `${pathname}?${suffix}` : pathname);
    },
    [location, setLocation],
  );

  const instructorUsage = useMemo(() => {
    const usage = new Map<string, { leadCourses: number; lessonCount: number }>();

    const ensure = (instructorId: string) => {
      if (!usage.has(instructorId)) {
        usage.set(instructorId, { leadCourses: 0, lessonCount: 0 });
      }
      return usage.get(instructorId)!;
    };

    state.courses.forEach((course) => {
      const leadId = String(
        course.competencyLeadInstructorId || course.instructor?.id || '',
      ).trim();
      if (leadId) {
        const entry = ensure(leadId);
        entry.leadCourses += 1;
      }
      (course.lessons || []).forEach((lesson) => {
        const lessonInstructorId = String(lesson.videoInstructorId || '').trim();
        if (!lessonInstructorId) return;
        const entry = ensure(lessonInstructorId);
        entry.lessonCount += 1;
      });
    });

    return usage;
  }, [state.courses]);

  const selectedInstructor = useMemo(() => {
    if (!selectedInstructorId) return null;
    return getInstructor(selectedInstructorId);
  }, [getInstructor, selectedInstructorId]);

  useEffect(() => {
    const nextCourseId = String(courseId || routeCourseId || '').trim();
    if (!nextCourseId) return;
    setSelectedCourseId((previousCourseId) =>
      previousCourseId === nextCourseId ? previousCourseId : nextCourseId,
    );
  }, [courseId, routeCourseId]);

  useEffect(() => {
    const activeCourseId = String(activeCourse?.id || '').trim();
    if (!activeCourseId) return;
    if (activeCourseId === selectedCourseId) return;
    if (selectedCourseId) return;
    setSelectedCourseId(activeCourseId);
  }, [activeCourse?.id, selectedCourseId]);

  useEffect(() => {
    if (!activeCourse?.id) return;
    const inState = state.courses.some(
      (course) => String(course.id) === String(activeCourse.id),
    );
    if (!inState) return;
    if (String(state.currentCourse?.id || '') === String(activeCourse.id)) return;
    setCurrentCourse(activeCourse);
  }, [activeCourse, setCurrentCourse, state.courses, state.currentCourse?.id]);

  useEffect(() => {
    const nextLeadId = String(
      activeCourse?.competencyLeadInstructorId || activeCourse?.instructor?.id || '',
    ).trim();
    if (nextLeadId && nextLeadId !== selectedLeadInstructorId) {
      setSelectedLeadInstructorId(nextLeadId);
      return;
    }
    if (!nextLeadId && instructorItems[0]?.id) {
      setSelectedLeadInstructorId(String(instructorItems[0].id));
    }
  }, [
    activeCourse?.competencyLeadInstructorId,
    activeCourse?.instructor?.id,
    instructorItems,
    selectedLeadInstructorId,
  ]);

  useEffect(() => {
    if (editorMode === 'edit' && selectedInstructor) {
      setNameInput(selectedInstructor.name || '');
      setBioInput(selectedInstructor.bio || '');
      setAvatarInput(selectedInstructor.avatar || '');
      setProfessionInput(selectedInstructor.profession || 'videographer');
      setExpertiseInput((selectedInstructor.expertise || []).join(', '));
      setActiveInput(selectedInstructor.isActive !== false);
      setAvatarMessage('');
      return;
    }

    if (editorMode === 'new') {
      setNameInput('');
      setBioInput('');
      setAvatarInput('');
      setProfessionInput('videographer');
      setExpertiseInput('');
      setActiveInput(true);
      setAvatarMessage('');
    }
  }, [editorMode, selectedInstructor]);

  useEffect(() => {
    analytics.trackEvent('academy_instructor_admin_opened', {
      instructorCount: instructorItems.length,
      courseCount: courseItems.length,
      courseId: activeCourse?.id || null,
      timestamp: Date.now(),
    });
    debugging.logIntegration('info', 'AcademyInstructorAdminStudio opened', {
      instructorCount: instructorItems.length,
      courseCount: courseItems.length,
      courseId: activeCourse?.id || null,
    });
  }, [activeCourse?.id, analytics, courseItems.length, debugging, instructorItems.length]);

  const selectInstructorForEdit = useCallback((instructorId: string) => {
    setSelectedInstructorId(instructorId);
    setEditorMode('edit');
    setSaveMessage('');
  }, []);

  const startCreateInstructor = useCallback(() => {
    setEditorMode('new');
    setSelectedInstructorId('');
    setSaveMessage('');
  }, []);

  const handleAvatarFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] || null;
      if (!file) return;

      if (!String(file.type || '').startsWith('image/')) {
        setAvatarMessage(tt('Velg en bildefil.', 'Please choose an image file.'));
        event.target.value = '';
        return;
      }

      const maxBytes = 4 * 1024 * 1024;
      if (file.size > maxBytes) {
        setAvatarMessage(tt('Bildet må være under 4 MB.', 'Image must be under 4 MB.'));
        event.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (!result) {
          setAvatarMessage(tt('Kunne ikke lese bildefilen.', 'Could not read image file.'));
          return;
        }
        setAvatarInput(result);
        setAvatarMessage(
          tt('Bilde lastet opp. Husk å lagre instruktøren.', 'Image uploaded. Remember to save the instructor.'),
        );
      };
      reader.onerror = () => {
        setAvatarMessage(tt('Kunne ikke lese bildefilen.', 'Could not read image file.'));
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    },
    [tt],
  );

  const saveInstructor = useCallback(async () => {
    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      setSaveMessage(tt('Instruktørnavn mangler.', 'Instructor name is required.'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        bio: bioInput.trim(),
        avatar: avatarInput.trim(),
        profession: professionInput,
        expertise: parseExpertiseList(expertiseInput),
        isActive: activeInput,
      };

      if (editorMode === 'edit' && selectedInstructor) {
        await updateInstructor({
          ...selectedInstructor,
          ...payload,
          updatedAt: new Date().toISOString(),
        });
        setSaveMessage(tt('Instruktør oppdatert.', 'Instructor updated.'));
      } else {
        const created = await createInstructor(payload);
        setEditorMode('edit');
        setSelectedInstructorId(created.id);
        setSaveMessage(tt('Instruktør opprettet.', 'Instructor created.'));
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tt('Kunne ikke lagre instruktør.', 'Failed to save instructor.');
      setSaveMessage(message);
    } finally {
      setSaving(false);
    }
  }, [
    activeInput,
    avatarInput,
    bioInput,
    createInstructor,
    editorMode,
    expertiseInput,
    nameInput,
    professionInput,
    selectedInstructor,
    tt,
    updateInstructor,
  ]);

  const removeInstructor = useCallback(async () => {
    if (editorMode !== 'edit' || !selectedInstructor) return;

    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm(
            tt(
              'Slette denne instruktøren? Eventuelle tilknytninger flyttes automatisk til neste tilgjengelige instruktør.',
              'Delete this instructor? Any existing assignments will automatically move to the next available instructor.',
            ),
          );
    if (!confirmed) return;

    setSaving(true);
    try {
      await deleteInstructor(selectedInstructor.id);
      setEditorMode('new');
      setSelectedInstructorId('');
      setSaveMessage(tt('Instruktør slettet.', 'Instructor deleted.'));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tt('Kunne ikke slette instruktør.', 'Failed to delete instructor.');
      setSaveMessage(message);
    } finally {
      setSaving(false);
    }
  }, [deleteInstructor, editorMode, selectedInstructor, tt]);

  const assignCompetencyLead = useCallback(
    async (instructorId: string) => {
      if (!activeCourse) {
        setSaveMessage(tt('Velg en kompetanse først.', 'Select a competency first.'));
        return;
      }
      const instructor = getInstructor(instructorId);
      if (!instructor) {
        setSaveMessage(tt('Instruktør ble ikke funnet.', 'Instructor not found.'));
        return;
      }

      setSaving(true);
      try {
        const nextCourse = {
          ...activeCourse,
          competencyLeadInstructorId: instructor.id,
          instructor: {
            id: instructor.id,
            name: instructor.name,
            avatar: instructor.avatar,
            bio: instructor.bio,
            profession: instructor.profession,
          },
          updatedAt: new Date().toISOString(),
        };
        await updateCourse(nextCourse);
        setCurrentCourse(nextCourse);
        setSelectedLeadInstructorId(instructor.id);
        setSaveMessage(
          tt(
            'Fagansvarlig er oppdatert for kompetansen.',
            'Competency lead is updated for this competency.',
          ),
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : tt('Kunne ikke oppdatere fagansvarlig.', 'Failed to update competency lead.');
        setSaveMessage(message);
      } finally {
        setSaving(false);
      }
    },
    [activeCourse, getInstructor, setCurrentCourse, tt, updateCourse],
  );

  const assignLessonInstructor = useCallback(
    async (lessonId: string, instructorId: string) => {
      if (!activeCourse) return;
      const instructor = getInstructor(instructorId);
      if (!instructor) return;

      const nextLessons = activeCourse.lessons.map((lesson) => {
        if (String(lesson.id) !== String(lessonId)) return lesson;
        return {
          ...lesson,
          videoInstructorId: instructor.id,
        };
      });

      const nextCourse = {
        ...activeCourse,
        lessons: nextLessons,
        updatedAt: new Date().toISOString(),
      };

      setSaving(true);
      try {
        await updateCourse(nextCourse);
        setCurrentCourse(nextCourse);
        setSaveMessage(tt('Ferdighetsinstruktør oppdatert.', 'Skill instructor updated.'));
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : tt('Kunne ikke oppdatere ferdighetsinstruktør.', 'Failed to update skill instructor.');
        setSaveMessage(message);
      } finally {
        setSaving(false);
      }
    },
    [activeCourse, getInstructor, setCurrentCourse, tt, updateCourse],
  );

  const applyLeadToAllSkills = useCallback(async () => {
    if (!activeCourse?.id || !selectedLeadInstructorId) return;
    const instructor = getInstructor(selectedLeadInstructorId);
    if (!instructor) return;

    const nextCourse = {
      ...activeCourse,
      lessons: activeCourse.lessons.map((lesson) => ({
        ...lesson,
        videoInstructorId: selectedLeadInstructorId,
      })),
      updatedAt: new Date().toISOString(),
    };

    setSaving(true);
    try {
      await updateCourse(nextCourse);
      setCurrentCourse(nextCourse);
      setSaveMessage(
        tt(
          'Fagansvarlig er satt som instruktør for alle ferdigheter.',
          'Competency lead is now assigned to all skills.',
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tt('Kunne ikke oppdatere alle ferdigheter.', 'Failed to update all skills.');
      setSaveMessage(message);
    } finally {
      setSaving(false);
    }
  }, [
    activeCourse,
    getInstructor,
    selectedLeadInstructorId,
    setCurrentCourse,
    tt,
    updateCourse,
  ]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        color: '#edf0f7',
        background:
          'radial-gradient(circle at 72% 14%, rgba(248,179,33,0.19), rgba(5,8,13,0) 42%), radial-gradient(circle at 17% 84%, rgba(84,126,209,0.16), rgba(5,8,13,0) 44%), #05070c',
        fontFamily: '"Manrope", "Barlow", "Segoe UI", sans-serif',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '252px minmax(0, 1fr)' },
          minHeight: '100vh',
          width: 'min(100%, var(--academy-shell-max-width, 1920px))',
          mx: 'auto',
        }}
      >
        <AcademyLeftSidebar
          activeNav={leftNav}
          onNavigate={(navId, route) => {
            setLeftNav(navId);
            setLocation(route);
          }}
          onCreateCourse={() => {
            setLeftNav('curriculum');
            setLocation('/academy/curriculum?createCompetency=1');
          }}
          tt={tt}
          navLabel={navLabel}
          activeCourseId={activeCourse?.id || null}
        />

        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Box
            sx={{
              height: 76,
              px: 3,
              borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(180deg, rgba(14,18,28,0.94), rgba(10,13,20,0.9))',
            }}
          >
            <Stack direction="row" spacing={1.2} alignItems="center" sx={{ minWidth: 0 }}>
              <Groups sx={{ color: '#f8d56f' }} />
              <Typography sx={{ fontSize: 24, fontWeight: 700 }} noWrap>
                {tt('Instruktøradministrasjon', 'Instructor Administration')}
              </Typography>
              <Chip
                size="small"
                label={tt(
                  `${instructorItems.length} instruktører`,
                  `${instructorItems.length} instructors`,
                )}
                sx={{
                  color: '#fce3a1',
                  border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.36)',
                  bgcolor: 'rgba(248,179,33,0.08)',
                }}
              />
            </Stack>

            <AcademyLocaleSwitcher />
          </Box>

          <Box
            sx={{
              p: { xs: 1.4, md: 2.2 },
              display: 'grid',
              gap: 1.4,
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 420px' },
              minHeight: 0,
            }}
          >
            <Stack spacing={1.3} sx={{ minWidth: 0 }}>
              <Box sx={{ ...shellPanelSx, p: 1.2 }}>
                <Stack
                  direction={{ xs: 'column', lg: 'row' }}
                  spacing={1.1}
                  alignItems={{ xs: 'stretch', lg: 'center' }}
                >
                  <Select
                    size="small"
                    value={selectedCourseId}
                    onChange={(event) => {
                      const nextCourseId = String(event.target.value);
                      setSelectedCourseId(nextCourseId);
                      syncCourseIdInRoute(nextCourseId);
                    }}
                    disabled={saving}
                    sx={{
                      minWidth: { xs: '100%', lg: 240 },
                      color: '#edf0f7',
                      bgcolor: 'rgba(255,255,255,0.04)',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.16)',
                      },
                    }}
                    displayEmpty
                  >
                    <MenuItem value="">{tt('Velg kompetanse', 'Select competency')}</MenuItem>
                    {courseItems.map((course) => (
                      <MenuItem key={course.id} value={course.id}>
                        {course.title}
                      </MenuItem>
                    ))}
                  </Select>

                  <Select
                    size="small"
                    value={selectedLeadInstructorId}
                    onChange={(event) =>
                      setSelectedLeadInstructorId(String(event.target.value))
                    }
                    disabled={saving}
                    sx={{
                      minWidth: { xs: '100%', lg: 260 },
                      color: '#edf0f7',
                      bgcolor: 'rgba(255,255,255,0.04)',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.16)',
                      },
                    }}
                    displayEmpty
                  >
                    <MenuItem value="">
                      {tt('Velg fagansvarlig', 'Select competency lead')}
                    </MenuItem>
                    {instructorItems.map((instructor) => (
                      <MenuItem key={`lead-${instructor.id}`} value={instructor.id}>
                        {instructor.name}
                      </MenuItem>
                    ))}
                  </Select>

                  <Button
                    startIcon={<School />}
                    onClick={() => void assignCompetencyLead(selectedLeadInstructorId)}
                    disabled={!activeCourse?.id || !selectedLeadInstructorId || saving}
                    sx={{
                      textTransform: 'none',
                      color: '#0f0f0f',
                      fontWeight: 700,
                      background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tt('Lagre fagansvarlig', 'Save competency lead')}
                  </Button>
                </Stack>
              </Box>

              <Box sx={{ ...shellPanelSx, p: 1.2, minHeight: 0, overflow: 'hidden' }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={0.9}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                >
                  <Box>
                    <Typography sx={{ fontSize: 18, fontWeight: 700 }}>
                      {tt('Instruktører per ferdighet', 'Instructors Per Skill')}
                    </Typography>
                    <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 13 }}>
                      {tt(
                        'Velg instruktør for hver ferdighetsvideo i valgt kompetanse.',
                        'Assign an instructor for each skill video in the selected competency.',
                      )}
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={0.7}>
                    <Button
                      onClick={() => setLocation('/academy/lesson-editor')}
                      sx={{
                        textTransform: 'none',
                        color: '#edf0f7',
                        border:
                          'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                      }}
                    >
                      {tt('Åpne ferdighetseditor', 'Open lesson editor')}
                    </Button>
                    <Button
                      startIcon={<VideoLibrary />}
                      onClick={() => void applyLeadToAllSkills()}
                      disabled={!activeCourse?.lessons?.length || !selectedLeadInstructorId || saving}
                      sx={{
                        textTransform: 'none',
                        color: '#edf0f7',
                        border:
                          'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                      }}
                    >
                      {tt('Bruk fagansvarlig på alle', 'Apply lead to all')}
                    </Button>
                  </Stack>
                </Stack>

                <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 1 }} />

                <Stack spacing={0.7} sx={{ maxHeight: 320, overflow: 'auto', pr: 0.4 }}>
                  {(activeCourse?.lessons || []).length === 0 ? (
                    <Typography sx={{ color: 'rgba(237,240,247,0.66)' }}>
                      {tt('Ingen ferdigheter funnet i valgt kompetanse.', 'No skills found in selected competency.')}
                    </Typography>
                  ) : (
                    activeCourse?.lessons.map((lesson) => {
                      const lessonInstructorId = String(
                        lesson.videoInstructorId || selectedLeadInstructorId || '',
                      ).trim();

                      return (
                        <Stack
                          key={`lesson-instructor-${lesson.id}`}
                          direction={{ xs: 'column', md: 'row' }}
                          spacing={0.8}
                          alignItems={{ xs: 'stretch', md: 'center' }}
                          sx={{
                            p: 0.8,
                            borderRadius: 0.9,
                            border:
                              'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                            bgcolor: 'rgba(8,11,18,0.6)',
                          }}
                        >
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 600 }} noWrap>
                              {lesson.title || tt('Uten tittel', 'Untitled')}
                            </Typography>
                            <Typography sx={{ color: 'rgba(237,240,247,0.64)', fontSize: 12 }}>
                              {tt('Ferdighet', 'Skill')} #{lesson.order}
                            </Typography>
                          </Box>

                          <Select
                            size="small"
                            value={lessonInstructorId}
                            disabled={saving}
                            onChange={(event) =>
                              void assignLessonInstructor(
                                String(lesson.id),
                                String(event.target.value),
                              )
                            }
                            sx={{
                              minWidth: { xs: '100%', md: 240 },
                              color: '#edf0f7',
                              bgcolor: 'rgba(255,255,255,0.04)',
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(255,255,255,0.16)',
                              },
                            }}
                          >
                            {instructorItems.map((instructor) => (
                              <MenuItem
                                key={`lesson-option-${lesson.id}-${instructor.id}`}
                                value={instructor.id}
                              >
                                {instructor.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </Stack>
                      );
                    })
                  )}
                </Stack>
              </Box>

              <Box sx={{ ...shellPanelSx, p: 1.2 }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={0.8}
                  alignItems={{ xs: 'stretch', md: 'center' }}
                  justifyContent="space-between"
                >
                  <TextField
                    size="small"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder={tt('Søk instruktører...', 'Search instructors...')}
                    sx={{
                      flex: 1,
                      '& .MuiInputBase-root': {
                        color: '#edf0f7',
                        bgcolor: 'rgba(255,255,255,0.04)',
                      },
                    }}
                  />
                  <Button
                    startIcon={<Add />}
                    onClick={startCreateInstructor}
                    sx={{
                      textTransform: 'none',
                      color: '#edf0f7',
                      border:
                        'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tt('Ny instruktør', 'New instructor')}
                  </Button>
                </Stack>

                <Stack spacing={0.8} sx={{ mt: 1.1, maxHeight: 300, overflow: 'auto', pr: 0.4 }}>
                  {filteredInstructors.length === 0 ? (
                    <Typography sx={{ color: 'rgba(237,240,247,0.66)' }}>
                      {tt('Ingen instruktører matcher søket.', 'No instructors match the search.')}
                    </Typography>
                  ) : (
                    filteredInstructors.map((instructor) => {
                      const usage =
                        instructorUsage.get(String(instructor.id)) ||
                        ({ leadCourses: 0, lessonCount: 0 } as const);
                      const active =
                        editorMode === 'edit' &&
                        String(selectedInstructorId) === String(instructor.id);

                      return (
                        <Button
                          key={`instructor-list-${instructor.id}`}
                          onClick={() => selectInstructorForEdit(String(instructor.id))}
                          sx={{
                            justifyContent: 'flex-start',
                            textTransform: 'none',
                            color: '#edf0f7',
                            borderRadius: 1,
                            border: active
                              ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.56)'
                              : 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                            bgcolor: active
                              ? 'rgba(248,179,33,0.12)'
                              : 'rgba(255,255,255,0.02)',
                            p: 0.8,
                          }}
                        >
                          <Stack direction="row" spacing={0.8} alignItems="center" sx={{ width: '100%' }}>
                            <Avatar src={instructor.avatar || undefined} sx={{ width: 34, height: 34, bgcolor: '#f8b321', color: '#111' }}>
                              {String(instructor.name || 'N').charAt(0).toUpperCase()}
                            </Avatar>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography noWrap sx={{ fontWeight: 700 }}>
                                {instructor.name}
                              </Typography>
                              <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.7)' }} noWrap>
                                {instructor.profession} • {usage.leadCourses} {tt('kompetanser', 'competencies')} • {usage.lessonCount} {tt('ferdigheter', 'skills')}
                              </Typography>
                            </Box>
                            <Chip
                              size="small"
                              label={instructor.isActive ? tt('Aktiv', 'Active') : tt('Inaktiv', 'Inactive')}
                              sx={{
                                color: instructor.isActive ? '#d8f6dd' : 'rgba(237,240,247,0.78)',
                                bgcolor: instructor.isActive
                                  ? 'rgba(46,176,98,0.24)'
                                  : 'rgba(255,255,255,0.12)',
                              }}
                            />
                          </Stack>
                        </Button>
                      );
                    })
                  )}
                </Stack>
              </Box>
            </Stack>

            <Box sx={{ ...shellPanelSx, p: 1.2, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Stack direction="row" spacing={0.8} alignItems="center" justifyContent="space-between">
                <Typography sx={{ fontSize: 19, fontWeight: 700 }}>
                  {editorMode === 'edit'
                    ? tt('Rediger instruktør', 'Edit Instructor')
                    : tt('Opprett instruktør', 'Create Instructor')}
                </Typography>
                <Button
                  onClick={() => setLocation('/academy/curriculum')}
                  sx={{
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                  }}
                >
                  {tt('Til kompetansegrunnlag', 'Go to curriculum')}
                </Button>
              </Stack>

              {!!saveMessage && (
                <Typography
                  sx={{
                    px: 1,
                    py: 0.7,
                    borderRadius: 1,
                    border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.35)',
                    bgcolor: 'rgba(248,179,33,0.08)',
                    color: '#f8d56f',
                  }}
                >
                  {saveMessage}
                </Typography>
              )}

              <TextField
                label={tt('Navn', 'Name')}
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                size="small"
                sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
              />

              <TextField
                label={tt('Bio', 'Bio')}
                value={bioInput}
                onChange={(event) => setBioInput(event.target.value)}
                size="small"
                multiline
                minRows={3}
                sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
              />

              <TextField
                label={tt('Avatar URL', 'Avatar URL')}
                value={avatarInput}
                onChange={(event) => {
                  setAvatarInput(event.target.value);
                  if (avatarMessage) setAvatarMessage('');
                }}
                size="small"
                placeholder={tt(
                  'Lim inn bilde-URL eller last opp fil under',
                  'Paste image URL or upload a file below',
                )}
                sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
              />

              <input
                ref={avatarUploadInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileUpload}
                style={{ display: 'none' }}
              />

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} alignItems={{ xs: 'stretch', md: 'center' }}>
                <Avatar
                  src={avatarInput || undefined}
                  sx={{
                    width: 56,
                    height: 56,
                    bgcolor: '#f8b321',
                    color: '#111',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.22)',
                  }}
                >
                  {String(nameInput || 'N').charAt(0).toUpperCase()}
                </Avatar>
                <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                  <Button
                    startIcon={<PhotoCamera />}
                    onClick={() => avatarUploadInputRef.current?.click()}
                    sx={{
                      textTransform: 'none',
                      color: '#edf0f7',
                      border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tt('Last opp bilde', 'Upload image')}
                  </Button>
                  <Button
                    onClick={() => {
                      setAvatarInput('');
                      setAvatarMessage(tt('Profilbildet er fjernet. Husk å lagre.', 'Profile image removed. Remember to save.'));
                    }}
                    sx={{
                      textTransform: 'none',
                      color: 'rgba(237,240,247,0.86)',
                      border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tt('Fjern bilde', 'Remove image')}
                  </Button>
                </Stack>
              </Stack>

              {avatarMessage ? (
                <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 12.5 }}>
                  {avatarMessage}
                </Typography>
              ) : null}

              <Select
                value={professionInput}
                onChange={(event) =>
                  setProfessionInput(
                    String(event.target.value) as AcademyInstructor['profession'],
                  )
                }
                size="small"
                sx={{
                  color: '#edf0f7',
                  bgcolor: 'rgba(255,255,255,0.04)',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.16)',
                  },
                }}
              >
                <MenuItem value="photographer">Photographer</MenuItem>
                <MenuItem value="videographer">Videographer</MenuItem>
                <MenuItem value="music_producer">Music Producer</MenuItem>
                <MenuItem value="vendor">Vendor</MenuItem>
                <MenuItem value="enterprise">Enterprise</MenuItem>
              </Select>

              <TextField
                label={tt('Fagområder (kommaseparert)', 'Expertise (comma separated)')}
                value={expertiseInput}
                onChange={(event) => setExpertiseInput(event.target.value)}
                size="small"
                placeholder={tt(
                  'f.eks. lyssetting, redigering, storytelling',
                  'e.g. lighting, editing, storytelling',
                )}
                sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={activeInput}
                    onChange={(event) => setActiveInput(event.target.checked)}
                  />
                }
                label={tt('Aktiv instruktør', 'Active instructor')}
                sx={{ color: 'rgba(237,240,247,0.84)' }}
              />

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

              <Stack direction="row" spacing={0.8}>
                <Button
                  startIcon={<Save />}
                  onClick={() => void saveInstructor()}
                  disabled={saving}
                  sx={{
                    textTransform: 'none',
                    color: '#0f0f0f',
                    fontWeight: 700,
                    background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                  }}
                >
                  {editorMode === 'edit' ? tt('Lagre endringer', 'Save changes') : tt('Opprett instruktør', 'Create instructor')}
                </Button>

                {editorMode === 'edit' ? (
                  <Button
                    startIcon={<DeleteOutline />}
                    onClick={() => void removeInstructor()}
                    disabled={saving}
                    sx={{
                      textTransform: 'none',
                      color: '#ffb7b7',
                      border:
                        'var(--academy-hairline-width, 1px) solid rgba(255,128,128,0.35)',
                    }}
                  >
                    {tt('Slett', 'Delete')}
                  </Button>
                ) : null}
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(AcademyInstructorAdminStudio, {
  componentId: 'academy-instructor-admin-studio',
  componentName: 'Academy Instructor Admin Studio',
  componentType: 'admin',
  componentCategory: 'academy',
  featureIds: ['academy-instructor-admin', 'academy-role-assignment'],
});
