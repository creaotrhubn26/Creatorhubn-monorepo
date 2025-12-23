/**
 * Class Photo Panel
 * 
 * UI for setting up and managing school/class photography sessions.
 * 
 * Features:
 * - Student count and age group configuration
 * - Height distribution settings
 * - Row arrangement controls
 * - Visibility checker
 * - Prop management
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
  Switch,
  FormControlLabel,
  Slider,
  Divider,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  LinearProgress,
  Badge,
  Collapse,
  ToggleButton,
  ToggleButtonGroup,
  CardMedia,
} from '@mui/material';
import {
  Groups,
  Person,
  Height,
  Shuffle,
  AutoFixHigh,
  Visibility,
  VisibilityOff,
  Warning,
  CheckCircle,
  Add,
  Remove,
  SwapVert,
  ViewModule,
  Straighten,
  Chair,
  ExpandMore,
  ExpandLess,
  School,
  Face,
  ArrowUpward,
  ArrowDownward,
  Lightbulb,
} from '@mui/icons-material';
import {
  classPhotoService,
  ClassPhotoSession,
  ClassPhotoSetup,
  Student,
  AgeGroup,
  HeightDistribution,
  VisibilityIssue,
  PropType,
  TeacherPosition,
  TeacherRole,
  TeacherConfig,
  PROP_DEFINITIONS,
  HEIGHT_RANGES,
  TEACHER_HEIGHT,
  TEACHER_COLORS,
  TEACHER_ROLE_LABELS,
} from '../../core/services/classPhotoService';
import { classPhotoSceneService, SCHOOL_HDRI_PRESETS, SchoolHDRIPreset } from '../../core/services/classPhotoSceneService';

// =============================================================================
// Guide Settings Type
// =============================================================================

export interface ClassPhotoGuideSettings {
  showHeadLines: boolean;
  showFOV: boolean;
  showEdgeWarnings: boolean;
  showSpacingRulers: boolean;
  showCenterLine: boolean;
  showHeightGaps: boolean;
  showEyeLine: boolean;
  showDOFPreview: boolean;
  showAspectRatioFrame: boolean;
  aspectRatio: '4x6' | '5x7' | '8x10' | '8.5x11';
}

// =============================================================================
// Types
// =============================================================================

interface ClassPhotoPanelProps {
  onSessionChange?: (session: ClassPhotoSession | null) => void;
  onStudentSelect?: (studentId: string | null) => void;
  onGuideSettingsChange?: (settings: ClassPhotoGuideSettings) => void;
  guideSettings?: ClassPhotoGuideSettings;
}

// =============================================================================
// Sub-Components
// =============================================================================

const StudentHeightBar: React.FC<{
  student: Student;
  maxHeight: number;
  minHeight: number;
  onSelect: () => void;
  selected: boolean;
}> = ({ student, maxHeight, minHeight, onSelect, selected }) => {
  const heightPercent = ((student.height - minHeight) / (maxHeight - minHeight)) * 100;
  
  const getVisibilityColor = () => {
    if (student.visibilityScore >= 80) return '#4caf50';
    if (student.visibilityScore >= 50) return '#ff9800';
    return '#f44336';
  };
  
  return (
    <Tooltip title={`${student.name}: ${Math.round(student.height)}cm - Row ${student.assignedRow + 1}`}>
      <Box
        onClick={onSelect}
        sx={{
          width: 20,
          height: 100,
          bgcolor: '#2a2a2a',
          borderRadius: 1,
          position: 'relative',
          cursor: 'pointer',
          border: selected ? '2px solid #2196f3' : '1px solid #444',
          overflow: 'hidden', '&:hover': { borderColor: '#2196f3' }}}
      >
        {/* Height bar */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${heightPercent}%`,
            bgcolor: getVisibilityColor(),
            opacity: 0.7}}
        />
        {/* Row indicator */}
        <Box
          sx={{
            position: 'absolute',
            top: 2,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 8,
            color: '#fff',
            fontWeight: 'bold'}}
        >
          {student.assignedRow + 1}
        </Box>
      </Box>
    </Tooltip>
  );
};

const RowVisualization: React.FC<{
  session: ClassPhotoSession;
  selectedStudentId: string | null;
  onStudentSelect: (id: string) => void;
}> = ({ session, selectedStudentId, onStudentSelect }) => {
  return (
    <Box sx={{ p: 2, bgcolor: '#1a1a1a', borderRadius: 1 }}>
      {session.rows.map((row, rowIdx) => {
        const people = row.studentIds.map(id => session.students.get(id)).filter(Boolean) as Student[];
        const teacherCount = people.filter(p => p.isTeacher).length;
        const studentCount = people.length - teacherCount;
        
        return (
          <Box key={rowIdx} sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Row {rowIdx + 1}
              </Typography>
              {row.baseHeight > 0 && (
                <Chip label={`+${Math.round(row.baseHeight * 100)}cm`} size="small" color="info" />
              )}
              <Typography variant="caption" color="text.secondary">
                ({studentCount} students{teacherCount > 0 ? `, ${teacherCount} teacher${teacherCount > 1 ? 's' : ','}` : ', '})
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} flexWrap="wrap">
              {people.map(person => (
                <Chip
                  key={person.id}
                  label={person.isTeacher ? 'T,' : `${person.index + 1}`}
                  size="small"
                  onClick={() => onStudentSelect(person.id)}
                  icon={person.isTeacher ? <Person sx={{ fontSize: 14 }} /> : undefined}
                  sx={{
                    bgcolor: person.isTeacher 
                      ? (person.color || '#1565c0')
                      : person.visibilityScore >= 80 ? '#2e7d32' : 
                        person.visibilityScore >= 50 ? '#ed6c02' : '#d32f2f',
                    color: '#fff',
                    border: selectedStudentId === person.id ? '2px solid #2196f3' : 
                            person.isTeacher ? '2px solid rgba(255,255,255,0.3)' : 'none',
                    fontWeight: erson.isTeacher ? 'bold' : 'normal'}}
                />
              ))}
            </Stack>
          </Box>
        );
      }).reverse()}
      
      {/* Camera indicator */}
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Chip icon={<Face />} label="Camera" variant="outlined" size="small" />
      </Box>
    </Box>
  );
};

// =============================================================================
// Main Component
// =============================================================================

const DEFAULT_GUIDE_SETTINGS: ClassPhotoGuideSettings = {
  showHeadLines: true,
  showFOV: true,
  showEdgeWarnings: true,
  showSpacingRulers: true,
  showCenterLine: true,
  showHeightGaps: false,
  showEyeLine: false,
  showDOFPreview: false,
  showAspectRatioFrame: false,
  aspectRatio: '4x6',
};

export const ClassPhotoPanel: React.FC<ClassPhotoPanelProps> = ({
  onSessionChange,
  onStudentSelect,
  onGuideSettingsChange,
  guideSettings: externalGuideSettings,
}) => {
  // Setup state
  const [studentCount, setStudentCount] = useState(24);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('elementary');
  const [heightDistribution, setHeightDistribution] = useState<HeightDistribution>('bell_curve');
  const [includeTeacher, setIncludeTeacher] = useState(true);
  const [rowCount, setRowCount] = useState(3);
  const [arrangementStyle, setArrangementStyle] = useState<'tiered' | 'flat' | 'semi_circle'>('tiered');
  const [staggerPositions, setStaggerPositions] = useState(true);
  
  // Teacher configuration
  const [teachers, setTeachers] = useState<TeacherConfig[]>([
    { role: 'head_teacher', name: 'Teacher', height: TEACHER_HEIGHT.avg, position: 'center_back' },
  ]);
  
  // Session state
  const [session, setSession] = useState<ClassPhotoSession | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [visibilityIssues, setVisibilityIssues] = useState<VisibilityIssue[]>([]);
  
  // UI state
  const [expandedSection, setExpandedSection] = useState<string | null>('setup');
  
  // Guide settings
  const [guideSettings, setGuideSettings] = useState<ClassPhotoGuideSettings>(
    externalGuideSettings || DEFAULT_GUIDE_SETTINGS
  );
  
  // Update guide settings
  const handleGuideToggle = useCallback((key: keyof ClassPhotoGuideSettings) => {
    setGuideSettings(prev => {
      const newSettings = { ...prev, [key]: !prev[key] };
      onGuideSettingsChange?.(newSettings);
      return newSettings;
    });
  }, [onGuideSettingsChange]);
  
  const handleAspectRatioChange = useCallback((ratio: ClassPhotoGuideSettings['aspectRatio,']) => {
    setGuideSettings(prev => {
      const newSettings = { ...prev, aspectRatio: ratio };
      onGuideSettingsChange?.(newSettings);
      return newSettings;
    });
  }, [onGuideSettingsChange]);
  
  // Height range for current age group
  const heightRange = useMemo(() => HEIGHT_RANGES[ageGroup], [ageGroup]);
  
  // Create session
  const handleCreateSession = useCallback(() => {
    const setup: ClassPhotoSetup = {
      studentCount,
      ageGroup,
      heightDistribution,
      includeTeacher,
      teachers: includeTeacher ? teachers : [],
      rowCount,
      arrangementStyle,
      staggerPositions,
    };
    
    const newSession = classPhotoService.createSession(setup);
    setSession(newSession);
    onSessionChange?.(newSession);
    
    // Check visibility
    const issues = classPhotoService.checkVisibility();
    setVisibilityIssues(issues);
    
    // Add actors to the main Virtual Studio scene
    classPhotoSceneService.addActorsToScene(newSession, ageGroup);
  }, [studentCount, ageGroup, heightDistribution, includeTeacher, teachers, rowCount, arrangementStyle, staggerPositions, onSessionChange]);
  
  // Randomize heights
  const handleRandomize = useCallback(() => {
    classPhotoService.randomizeHeights();
    const updatedSession = classPhotoService.getSession();
    setSession(updatedSession ? { ...updatedSession } : null);
    
    const issues = classPhotoService.checkVisibility();
    setVisibilityIssues(issues);
    
    // Update actors in scene
    if (updatedSession) {
      classPhotoSceneService.addActorsToScene(updatedSession, ageGroup);
    }
  }, [ageGroup]);
  
  // Auto-optimize
  const handleOptimize = useCallback(() => {
    const result = classPhotoService.optimizeVisibility();
    const updatedSession = classPhotoService.getSession();
    setSession(updatedSession ? { ...updatedSession } : null);
    setVisibilityIssues(result.issues);
    
    // Update actors in scene
    if (updatedSession) {
      classPhotoSceneService.addActorsToScene(updatedSession, ageGroup);
    }
  }, [ageGroup]);
  
  // Add riser to row
  const handleAddRiser = useCallback((rowIndex: number) => {
    classPhotoService.addRiserForRow(rowIndex);
    const updatedSession = classPhotoService.getSession();
    setSession(updatedSession ? { ...updatedSession } : null);
    
    const issues = classPhotoService.checkVisibility();
    setVisibilityIssues(issues);
    
    // Update scene with new positions
    if (updatedSession) {
      classPhotoSceneService.addActorsToScene(updatedSession, ageGroup);
    }
  }, [ageGroup]);
  
  // Select student
  const handleSelectStudent = useCallback((studentId: string) => {
    setSelectedStudentId(studentId);
    onStudentSelect?.(studentId);
  }, [onStudentSelect]);
  
  // Move student
  const handleMoveStudent = useCallback((direction: 'up' | 'down') => {
    if (!selectedStudentId || !session) return;
    
    const student = session.students.get(selectedStudentId);
    if (!student) return;
    
    const targetRow = direction === 'up' ? student.assignedRow + 1 : student.assignedRow - 1;
    if (targetRow >= 0 && targetRow < session.rows.length) {
      classPhotoService.moveStudentToRow(selectedStudentId, targetRow);
      const updatedSession = classPhotoService.getSession();
      setSession(updatedSession ? { ...updatedSession } : null);
      
      const issues = classPhotoService.checkVisibility();
      setVisibilityIssues(issues);
    }
  }, [selectedStudentId, session]);
  
  // Add teacher
  const handleAddTeacher = useCallback(() => {
    const newTeacher: TeacherConfig = {
      role: 'assistant',
      name: `Teacher ${teachers.length + 1}`,
      height: TEACHER_HEIGHT.avg,
      position: teachers.length === 0 ? 'center_back' : 
                teachers.length === 1 ? 'left_end' : 'right_end',
    };
    setTeachers(prev => [...prev, newTeacher]);
  }, [teachers.length]);
  
  // Remove teacher
  const handleRemoveTeacher = useCallback((index: number) => {
    setTeachers(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  // Update teacher config
  const handleUpdateTeacher = useCallback((index: number, update: Partial<TeacherConfig>) => {
    setTeachers(prev => prev.map((t, i) => i === index ? { ...t, ...update } : t));
  }, []);
  
  // Students array
  const students = useMemo(() => {
    if (!session) return [];
    return classPhotoService.getStudentsArray();
  }, [session]);
  
  // Visibility score
  const overallVisibility = useMemo(() => {
    if (students.length === 0) return 100;
    return Math.round(students.reduce((sum, s) => sum + s.visibilityScore, 0) / students.length);
  }, [students]);

  // Open school photography setup dialog
  const handleOpenSchoolSetup = useCallback(() => {
    window.dispatchEvent(new CustomEvent('vs-open-school-setup', {}));
  }, []);

  return (
    <Paper elevation={3} sx={{ p: 2, bgcolor: '#1a1a1a', color: '#fff', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <School color="primary" />
          <Typography variant="h6">Class Photo Setup</Typography>
        </Stack>
        <Tooltip title="Re-configure school photography environment">
          <Button
            size="small"
            variant="outlined"
            startIcon={<Lightbulb />}
            onClick={handleOpenSchoolSetup}
            sx={{ textTransform: 'none' }}
          >
            Quick Setup
          </Button>
        </Tooltip>
      </Stack>

      {/* Setup Section */}
      <Box sx={{ mb: 2 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          onClick={() => setExpandedSection(expandedSection === 'setup' ? null : 'setup')}
          sx={{ cursor: 'pointer', py: 1 }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Groups fontSize="small" />
            <Typography variant="subtitle2">Class Configuration</Typography>
          </Stack>
          {expandedSection === 'setup' ? <ExpandLess /> : <ExpandMore />}
        </Stack>
        
        <Collapse in={expandedSection === 'setup'}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* Student Count */}
            <Box>
              <Typography variant="caption" color="text.secondary">
                Number of Students: {studentCount}
              </Typography>
              <Slider
                value={studentCount}
                onChange={(_, v) => setStudentCount(v as number)}
                min={5}
                max={50}
                marks={[
                  { value: 5, label: '5' },
                  { value: 25, label: '25' },
                  { value: 50, label: '50' },
                ]}
              />
            </Box>

            {/* Age Group */}
            <FormControl fullWidth size="small">
              <InputLabel>Age Group</InputLabel>
              <Select
                value={ageGroup}
                label="Age Group"
                onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}
              >
                <MenuItem value="kindergarten">Kindergarten (95-115cm)</MenuItem>
                <MenuItem value="elementary">Elementary (110-145cm)</MenuItem>
                <MenuItem value="middle_school">Middle School (140-175cm)</MenuItem>
                <MenuItem value="high_school">High School (155-190cm)</MenuItem>
              </Select>
            </FormControl>

            {/* Height Distribution */}
            <FormControl fullWidth size="small">
              <InputLabel>Height Distribution</InputLabel>
              <Select
                value={heightDistribution}
                label="Height Distribution"
                onChange={(e) => setHeightDistribution(e.target.value as HeightDistribution)}
              >
                <MenuItem value="bell_curve">Bell Curve (Realistic)</MenuItem>
                <MenuItem value="random">Random</MenuItem>
                <MenuItem value="uniform">Uniform (Same Height)</MenuItem>
              </Select>
            </FormControl>

            {/* Row Count */}
            <Box>
              <Typography variant="caption" color="text.secondary">
                Number of Rows: {rowCount}
              </Typography>
              <Slider
                value={rowCount}
                onChange={(_, v) => setRowCount(v as number)}
                min={1}
                max={5}
                step={1}
                marks
              />
            </Box>

            {/* Arrangement Style */}
            <ToggleButtonGroup
              value={arrangementStyle}
              exclusive
              onChange={(_, v) => v && setArrangementStyle(v)}
              size="small"
              fullWidth
            >
              <ToggleButton value="tiered">Tiered</ToggleButton>
              <ToggleButton value="flat">Flat</ToggleButton>
              <ToggleButton value="semi_circle">Semi-Circle</ToggleButton>
            </ToggleButtonGroup>

            {/* Options */}
            <Stack direction="row" spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={includeTeacher}
                    onChange={(e) => setIncludeTeacher(e.target.checked)}
                    size="small"
                  />
                }
                label="Include Teacher"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={staggerPositions}
                    onChange={(e) => setStaggerPositions(e.target.checked)}
                    size="small"
                  />
                }
                label="Stagger Positions"
              />
            </Stack>

            {/* Teacher Configuration */}
            {includeTeacher && (
              <Box sx={{ mt: 2, p: 1.5, bgcolor: '#2a2a2a', borderRadius: 1 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Person fontSize="small" />
                    Teachers ({teachers.length})
                  </Typography>
                  <IconButton size="small" onClick={handleAddTeacher} disabled={teachers.length >= 4}>
                    <Add fontSize="small" />
                  </IconButton>
                </Stack>
                
                <Stack spacing={1.5}>
                  {teachers.map((teacher, idx) => (
                    <Card key={idx} sx={{ bgcolor: '#1a1a1a', p: 1 }}>
                      <Stack spacing={1}>
                        {/* Name and Remove */}
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: TEACHER_COLORS[teacher.role]}}
                          />
                          <TextField
                            size="small"
                            value={teacher.name}
                            onChange={(e) => handleUpdateTeacher(idx, { name: e.target.value })}
                            variant="standard"
                            sx={{ flex: 1 }}
                            InputProps={{ sx: { fontSize: '0.85rem' } }}
                          />
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveTeacher(idx)}
                            disabled={teachers.length <= 1}
                          >
                            <Remove fontSize="small" />
                          </IconButton>
                        </Stack>
                        
                        {/* Role and Position */}
                        <Grid container spacing={1}>
                          <Grid item xs={6}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Role</InputLabel>
                              <Select
                                value={teacher.role}
                                label="Role"
                                onChange={(e) => handleUpdateTeacher(idx, { role: e.target.value as TeacherRole })}
                              >
                                <MenuItem value="head_teacher">Head Teacher</MenuItem>
                                <MenuItem value="assistant">Assistant</MenuItem>
                                <MenuItem value="aide">Aide</MenuItem>
                                <MenuItem value="principal">Principal</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={6}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Position</InputLabel>
                              <Select
                                value={teacher.position}
                                label="Position"
                                onChange={(e) => handleUpdateTeacher(idx, { position: e.target.value as TeacherPosition })}
                              >
                                <MenuItem value="center_back">Center (Back)</MenuItem>
                                <MenuItem value="left_end">Left End</MenuItem>
                                <MenuItem value="right_end">Right End</MenuItem>
                                <MenuItem value="center_front">Center (Front)</MenuItem>
                                <MenuItem value="seated_center">Seated (Center)</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                        </Grid>
                        
                        {/* Height */}
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Height: {teacher.height}cm
                          </Typography>
                          <Slider
                            value={teacher.height}
                            onChange={(_, v) => handleUpdateTeacher(idx, { height: v as number })}
                            min={150}
                            max={200}
                            size="small"
                            valueLabelDisplay="auto"
                          />
                        </Box>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              </Box>
            )}

            {/* Generate Button */}
            <Button
              variant="contained"
              startIcon={<Groups />}
              onClick={handleCreateSession}
              fullWidth
            >
              Generate Class ({studentCount + (includeTeacher ? 1 : 0)} people)
            </Button>
          </Stack>
        </Collapse>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Session Active */}
      {session && (
        <>
          {/* Visibility Score */}
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="subtitle2">Visibility Score</Typography>
              <Chip
                icon={overallVisibility >= 80 ? <CheckCircle /> : <Warning />}
                label={`${overallVisibility}%`}
                color={overallVisibility >= 80 ? 'success' : overallVisibility >= 50 ? 'warning' : 'error'}
                size="small"
              />
            </Stack>
            <LinearProgress
              variant="determinate"
              value={overallVisibility}
              color={overallVisibility >= 80 ? 'success' : overallVisibility >= 50 ? 'warning' : 'error'}
              sx={{ height: 8, borderRadius: 4 }}
            />
            {visibilityIssues.length > 0 && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {visibilityIssues.length} student(s) may have visibility issues
              </Alert>
            )}
          </Box>

          {/* Quick Actions */}
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Shuffle />}
              onClick={handleRandomize}
            >
              Randomize
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AutoFixHigh />}
              onClick={handleOptimize}
            >
              Optimize
            </Button>
          </Stack>

          {/* Row Visualization */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Arrangement (Front to Back)
            </Typography>
            <RowVisualization
              session={session}
              selectedStudentId={selectedStudentId}
              onStudentSelect={handleSelectStudent}
            />
          </Box>

          {/* Selected Person (Student or Teacher) */}
          {selectedStudentId && session.students.get(selectedStudentId) && (() => {
            const selectedPerson = session.students.get(selectedStudentId)!;
            const isTeacher = selectedPerson.isTeacher;
            
            return (
              <Card sx={{ 
                bgcolor: isTeacher ? (selectedPerson.color || '#1565c0') : '#2a2a2a', 
                mb: 2,
                border: isTeacher ? '2px solid rgba(255,255,255,0.3)' : 'none'}}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    {isTeacher && <Person fontSize="small" />}
                    <Typography variant="subtitle2">
                      {selectedPerson.name}
                    </Typography>
                    {isTeacher && (
                      <Chip 
                        label={TEACHER_ROLE_LABELS[selectedPerson.teacherRole!]} 
                        size="small" 
                        sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}
                      />
                    )}
                  </Stack>
                  
                  <Stack spacing={1}>
                    <Typography variant="body2">
                      Height: {Math.round(selectedPerson.height)}cm
                    </Typography>
                    <Typography variant="body2">
                      Row: {selectedPerson.assignedRow + 1}
                    </Typography>
                    {!isTeacher && (
                      <Typography variant="body2">
                        Visibility: {selectedPerson.visibilityScore}%
                      </Typography>
                    )}
                    {isTeacher && (
                      <Typography variant="body2">
                        Position: {selectedPerson.teacherPosition?.replace('_',', ')}
                      </Typography>
                    )}
                    
                    {/* Teacher-specific controls */}
                    {isTeacher && (
                      <Stack spacing={1} sx={{ mt: 1 }}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Change Position</InputLabel>
                          <Select
                            value={selectedPerson.teacherPosition || 'center_back'}
                            label="Change Position"
                            onChange={(e) => {
                              classPhotoService.updateTeacher(selectedStudentId, { 
                                position: e.target.value as TeacherPosition 
                              });
                              const updatedSession = classPhotoService.getSession();
                              setSession(updatedSession ? { ...updatedSession } : null);
                              const issues = classPhotoService.checkVisibility();
                              setVisibilityIssues(issues);
                            }}
                          >
                            <MenuItem value="center_back">Center (Back)</MenuItem>
                            <MenuItem value="left_end">Left End</MenuItem>
                            <MenuItem value="right_end">Right End</MenuItem>
                            <MenuItem value="center_front">Center (Front)</MenuItem>
                            <MenuItem value="seated_center">Seated (Center)</MenuItem>
                          </Select>
                        </FormControl>
                        
                        <FormControl fullWidth size="small">
                          <InputLabel>Change Role</InputLabel>
                          <Select
                            value={selectedPerson.teacherRole || 'head_teacher'}
                            label="Change Role"
                            onChange={(e) => {
                              classPhotoService.updateTeacher(selectedStudentId, { 
                                role: e.target.value as TeacherRole 
                              });
                              const updatedSession = classPhotoService.getSession();
                              setSession(updatedSession ? { ...updatedSession } : null);
                            }}
                          >
                            <MenuItem value="head_teacher">Head Teacher</MenuItem>
                            <MenuItem value="assistant">Assistant</MenuItem>
                            <MenuItem value="aide">Aide</MenuItem>
                            <MenuItem value="principal">Principal</MenuItem>
                          </Select>
                        </FormControl>
                      </Stack>
                    )}
                    
                    {/* Student row controls */}
                    {!isTeacher && (
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          startIcon={<ArrowUpward />}
                          onClick={() => handleMoveStudent('up')}
                          disabled={selectedPerson.assignedRow >= session.rows.length - 1}
                        >
                          Back Row
                        </Button>
                        <Button
                          size="small"
                          startIcon={<ArrowDownward />}
                          onClick={() => handleMoveStudent('down')}
                          disabled={selectedPerson.assignedRow <= 0}
                        >
                          Front Row
                        </Button>
                      </Stack>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            );
          })()}

          {/* Active Teachers Section */}
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Person fontSize="small" />
                Teachers in Photo
              </Typography>
              <Tooltip title="Add Teacher">
                <IconButton
                  size="small"
                  onClick={() => {
                    const teacherCount = classPhotoService.getTeachersArray().length;
                    classPhotoService.addTeacher({
                      role: teacherCount === 0 ? 'head_teacher' : 'assistant',
                      name: `Teacher ${teacherCount + 1}`,
                      height: TEACHER_HEIGHT.avg,
                      position: teacherCount === 0 ? 'center_back' : 
                                teacherCount === 1 ? 'left_end' : 'right_end',
                    });
                    const updatedSession = classPhotoService.getSession();
                    setSession(updatedSession ? { ...updatedSession } : null);
                    const issues = classPhotoService.checkVisibility();
                    setVisibilityIssues(issues);
                    
                    // Add teacher actor to scene
                    if (updatedSession) {
                      classPhotoSceneService.addActorsToScene(updatedSession, ageGroup);
                    }
                  }}
                  disabled={classPhotoService.getTeachersArray().length >= 4}
                >
                  <Add fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            <Stack spacing={0.5}>
              {classPhotoService.getTeachersArray().map((teacher) => (
                <Stack 
                  key={teacher.id} 
                  direction="row" 
                  alignItems="center" 
                  spacing={1}
                  sx={{ 
                    p: 0.5, 
                    borderRadius: 1, 
                    bgcolor: teacher.color || '#1565c0',
                    cursor: 'pointer','&:hover': { opacity: 0.9 }}}
                  onClick={() => handleSelectStudent(teacher.id)}
                >
                  <Person sx={{ fontSize: 16 }} />
                  <Typography variant="body2" sx={{ flex: 1, fontSize: '0.8rem' }}>
                    {teacher.name}
                  </Typography>
                  <Chip 
                    label={teacher.teacherPosition?.replace('_', ', ')} 
                    size="small" 
                    sx={{ fontSize: '0.65rem', height: 18, bgcolor: 'rgba(255,255,255,0.2)' }}
                  />
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      
                      // Remove teacher actor from scene
                      classPhotoSceneService.removeActorFromScene(teacher.id);
                      
                      classPhotoService.removeTeacher(teacher.id);
                      const updatedSession = classPhotoService.getSession();
                      setSession(updatedSession ? { ...updatedSession } : null);
                      if (selectedStudentId === teacher.id) {
                        setSelectedStudentId(null);
                      }
                      const issues = classPhotoService.checkVisibility();
                      setVisibilityIssues(issues);
                      
                      // Update scene
                      if (updatedSession) {
                        classPhotoSceneService.addActorsToScene(updatedSession, ageGroup);
                      }
                    }}
                    sx={{ p: 0.25 }}
                  >
                    <Remove sx={{ fontSize: 14 }} />
                  </IconButton>
                </Stack>
              ))}
              {classPhotoService.getTeachersArray().length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No teachers added. Click + to add.
                </Typography>
              )}
            </Stack>
          </Box>

          {/* Props Section */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Add Risers & Props
            </Typography>
            <Stack spacing={1}>
              {session.rows.map((row, idx) => (
                <Stack key={idx} direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="body2">Row {idx + 1}</Typography>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Add 30cm Riser">
                      <IconButton
                        size="small"
                        onClick={() => handleAddRiser(idx)}
                        disabled={row.baseHeight > 0}
                      >
                        <Add fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {row.baseHeight > 0 && (
                      <Chip label={`+${Math.round(row.baseHeight * 100)}cm`} size="small" />
                    )}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </Box>

          {/* HDRI Environment Section */}
          <Divider sx={{ my: 2 }} />
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Straighten fontSize="small" />
              Environment Lighting
            </Typography>
            <Grid container spacing={0.5}>
              {classPhotoSceneService.getRecommendedHDRIs().map((hdri) => (
                <Grid item xs={6} key={hdri.id}>
                  <Tooltip title={hdri.description}>
                    <Button
                      size="small"
                      variant="outlined"
                      fullWidth
                      onClick={() => classPhotoSceneService.setClassPhotoHDRI(hdri.id)}
                      sx={{ 
                        fontSize: '0.7rem', 
                        py: 0.5,
                        textTransform: 'none'}}
                    >
                      {hdri.name}
                    </Button>
                  </Tooltip>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Environment / HDRI Section */}
          <Divider sx={{ my: 2 }} />
          <Box>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              onClick={() => setExpandedSection(expandedSection === 'environment' ? null : 'environment')}
              sx={{ cursor: 'pointer', py: 1 }}
            >
              <Stack direction="row" alignItems="center" spacing={1}>
                <Lightbulb fontSize="small" />
                <Typography variant="subtitle2">Environment Lighting</Typography>
              </Stack>
              {expandedSection === 'environment' ? <ExpandLess /> : <ExpandMore />}
            </Stack>
            
            <Collapse in={expandedSection === 'environment'}>
              <Stack spacing={1.5} sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Select lighting environment for your class photo
                </Typography>
                
                {/* Recommended HDRIs */}
                <Box>
                  <Typography variant="caption" color="primary" sx={{ fontWeight: 'bold' }}>
                    Recommended for Class Photos
                  </Typography>
                  <Grid container spacing={1} sx={{ mt: 0.5 }}>
                    {SCHOOL_HDRI_PRESETS.filter(h => h.recommended).map((hdri) => (
                      <Grid item xs={6} key={hdri.id}>
                        <Card
                          sx={{
                            cursor: 'pointer',
                            bgcolor: '#2a2a2a','&:hover': { bgcolor: '#3a3a3a' }}}
                          onClick={() => classPhotoSceneService.setClassPhotoHDRI(hdri.id)}
                        >
                          <CardMedia
                            component="img"
                            height="60"
                            image={hdri.thumbnail}
                            alt={hdri.name}
                            sx={{ objectFit: 'cover' }}
                          />
                          <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                            <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block' }}>
                              {hdri.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                              {hdri.indoorOutdoor === 'indoor' ? 'Indoor' : 'Outdoor'}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>

                {/* Other HDRIs */}
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Other Options
                  </Typography>
                  <Grid container spacing={1} sx={{ mt: 0.5 }}>
                    {SCHOOL_HDRI_PRESETS.filter(h => !h.recommended).map((hdri) => (
                      <Grid item xs={6} key={hdri.id}>
                        <Card
                          sx={{
                            cursor: 'pointer',
                            bgcolor: '#1a1a1a', '&:hover': { bgcolor: '#2a2a2a' }}}
                          onClick={() => classPhotoSceneService.setClassPhotoHDRI(hdri.id)}
                        >
                          <CardMedia
                            component="img"
                            height="50"
                            image={hdri.thumbnail}
                            alt={hdri.name}
                            sx={{ objectFit: 'cover', opacity: 0.8 }}
                          />
                          <CardContent sx={{ p: 0.5, '&:last-child': { pb: 0.5 } }}>
                            <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                              {hdri.name}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              </Stack>
            </Collapse>
          </Box>

          {/* Visual Guides Section */}
          <Divider sx={{ my: 2 }} />
          <Box>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              onClick={() => setExpandedSection(expandedSection === 'guides' ? null : 'guides')}
              sx={{ cursor: 'pointer', py: 1 }}
            >
              <Stack direction="row" alignItems="center" spacing={1}>
                <Visibility fontSize="small" />
                <Typography variant="subtitle2">Visual Guides</Typography>
              </Stack>
              {expandedSection === 'guides' ? <ExpandLess /> : <ExpandMore />}
            </Stack>
            
            <Collapse in={expandedSection === 'guides'}>
              <Stack spacing={1} sx={{ mt: 1 }}>
                {/* High Priority Guides */}
                <Typography variant="caption" color="text.secondary">
                  Essential Guides
                </Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={guideSettings.showHeadLines}
                          onChange={() => handleGuideToggle('showHeadLines')}
                        />
                      }
                      label={<Typography variant="caption">Head Lines</Typography>}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={guideSettings.showFOV}
                          onChange={() => handleGuideToggle('showFOV')}
                        />
                      }
                      label={<Typography variant="caption">Camera FOV</Typography>}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={guideSettings.showEdgeWarnings}
                          onChange={() => handleGuideToggle('showEdgeWarnings')}
                        />
                      }
                      label={<Typography variant="caption">Edge Zones</Typography>}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={guideSettings.showSpacingRulers}
                          onChange={() => handleGuideToggle('showSpacingRulers')}
                        />
                      }
                      label={<Typography variant="caption">Spacing</Typography>}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={guideSettings.showCenterLine}
                          onChange={() => handleGuideToggle('showCenterLine')}
                        />
                      }
                      label={<Typography variant="caption">Center Line</Typography>}
                    />
                  </Grid>
                </Grid>

                {/* Advanced Guides */}
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  Advanced Guides
                </Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={guideSettings.showHeightGaps}
                          onChange={() => handleGuideToggle('showHeightGaps')}
                        />
                      }
                      label={<Typography variant="caption">Height Gaps</Typography>}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={guideSettings.showEyeLine}
                          onChange={() => handleGuideToggle('showEyeLine')}
                        />
                      }
                      label={<Typography variant="caption">Eye Line</Typography>}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={guideSettings.showDOFPreview}
                          onChange={() => handleGuideToggle('showDOFPreview')}
                        />
                      }
                      label={<Typography variant="caption">DOF Preview</Typography>}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={guideSettings.showAspectRatioFrame}
                          onChange={() => handleGuideToggle('showAspectRatioFrame')}
                        />
                      }
                      label={<Typography variant="caption">Frame</Typography>}
                    />
                  </Grid>
                </Grid>

                {/* Aspect Ratio Selector */}
                {guideSettings.showAspectRatioFrame && (
                  <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                    <InputLabel>Aspect Ratio</InputLabel>
                    <Select
                      value={guideSettings.aspectRatio}
                      label="Aspect Ratio"
                      onChange={(e) => handleAspectRatioChange(e.target.value as ClassPhotoGuideSettings['aspectRatio'])}
                    >
                      <MenuItem value="4x6">4x6 (Standard Print)</MenuItem>
                      <MenuItem value="5x7">5x7</MenuItem>
                      <MenuItem value="8x10">8x10</MenuItem>
                      <MenuItem value="8.5x11">8.5x11 (Letter)</MenuItem>
                    </Select>
                  </FormControl>
                )}
              </Stack>
            </Collapse>
          </Box>

          {/* Height Distribution Chart */}
          <Divider sx={{ my: 2 }} />
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Height Distribution
            </Typography>
            <Stack direction="row" spacing={0.25} alignItems="flex-end" sx={{ height: 120, overflow: 'auto' }}>
              {students.map(student => (
                <StudentHeightBar
                  key={student.id}
                  student={student}
                  maxHeight={heightRange.max}
                  minHeight={heightRange.min}
                  onSelect={() => handleSelectStudent(student.id)}
                  selected={selectedStudentId === student.id}
                />
              ))}
            </Stack>
          </Box>
        </>
      )}

      {/* No Session */}
      {!session && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Configure the class settings above and click"Generate Class" to begin.
        </Alert>
      )}
    </Paper>
  );
};

export default ClassPhotoPanel;

