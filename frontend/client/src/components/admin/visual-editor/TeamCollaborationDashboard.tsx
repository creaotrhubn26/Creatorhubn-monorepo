// Team Collaboration Dashboard
import { useTheming } from '../../../utils/theming-helper';
import React, { useMemo, useState } from 'react';
import { useVisualEditor } from './VisualEditorContext';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Avatar,
  Badge,
} from '@mui/material';
import {
  Group,
  Assignment,
  VideoCall,
  Upload,
  Add,
  Edit,
  Delete,
  PersonAdd,
  Work,
} from '@mui/icons-material';
import { useTeamCollaboration } from '../../../hooks/useTeamCollaboration';

interface TeamCollaborationDashboardProps {
  onSettingsClick: () => void;
  onMembersClick: () => void;
  onWorkloadClick: () => void;
  onSessionsClick: () => void;
  onMobileClick: () => void;
  onAnalyticsClick: () => void
}

type TeamRole = 'photographer' | 'videographer' | 'editor' | 'assistant' | 'admin';
type TaskType = 'shooting' | 'editing' | 'client_meeting' | 'delivery' | 'admin';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
type TaskStatus = 'pending' | 'in_progress' | 'completed';
type SessionType = 'editing' | 'review' | 'planning' | 'client_meeting';
type SessionStatus = 'active' | 'ended' | 'scheduled';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  currentWorkload: number;
  skills: string[];
}

interface WorkloadAssignment {
  id: string;
  projectId: string;
  memberId: string;
  taskType: TaskType;
  estimatedHours: number;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
}

interface CollaborationSession {
  id: string;
  projectId: string;
  participants: string[];
  sessionType: SessionType;
  status: SessionStatus;
  startedAt: string;
}

interface NewMemberForm {
  name: string;
  email: string;
  role: TeamRole;
  skills: string[];
}

interface NewWorkloadForm {
  projectId: string;
  memberId: string;
  taskType: TaskType;
  estimatedHours: number;
  priority: TaskPriority;
  dueDate: string;
}

interface NewSessionForm {
  projectId: string;
  participants: string[];
  sessionType: SessionType;
}

const toString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const toNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const clampWorkload = (value: number): number => Math.max(0, Math.min(100, value));

const isTeamRole = (value: string): value is TeamRole =>
  ['photographer', 'videographer', 'editor', 'assistant', 'admin'].includes(value);

const isTaskType = (value: string): value is TaskType =>
  ['shooting', 'editing', 'client_meeting', 'delivery', 'admin'].includes(value);

const isTaskPriority = (value: string): value is TaskPriority =>
  ['low', 'medium', 'high', 'urgent'].includes(value);

const isSessionType = (value: string): value is SessionType =>
  ['editing', 'review', 'planning', 'client_meeting'].includes(value);

const TeamCollaborationDashboard: React.FC<TeamCollaborationDashboardProps> = ({
  onSettingsClick,
  onMembersClick,
  onWorkloadClick,
  onSessionsClick,
  onMobileClick,
  onAnalyticsClick
}) => {
  // Get context from visual editor
  const {
    state,
    addNotification
} = useVisualEditor();

  const {
    teamMembers,
    workloadAssignments,
    collaborativeSessions,
    loading,
    addTeamMember,
    assignWorkload,
    startCollaborativeSession,
    processMobileUpload
} = useTeamCollaboration();

  const [selectedView, setSelectedView] = useState<string>('overview');

  // Theming system
  const theming = useTheming('prototype_tester');
  const [activeTab, setActiveTab] = useState('overview');
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [workloadDialogOpen, setWorkloadDialogOpen] = useState(false);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [newMember, setNewMember] = useState<NewMemberForm>({
    name: '',
    email: '',
    role: 'photographer',
    skills: [],
  });
  const [newWorkload, setNewWorkload] = useState<NewWorkloadForm>({
    projectId: '',
    memberId: '',
    taskType: 'shooting',
    estimatedHours: 8,
    priority: 'medium',
    dueDate: new Date().toISOString().split('T')[0],
  });
  const [newSession, setNewSession] = useState<NewSessionForm>({
    projectId: '',
    participants: [],
    sessionType: 'editing',
  });

  const normalizedTeamMembers = useMemo<TeamMember[]>(
    () =>
      teamMembers.map((member: unknown, index: number) => {
        const candidate = member as Record<string, unknown>;
        const roleValue = toString(candidate.role, 'assistant');
        return {
          id: toString(candidate.id, `member-${index}`),
          name: toString(candidate.name, 'Unknown member'),
          email: toString(candidate.email),
          role: isTeamRole(roleValue) ? roleValue : 'assistant',
          currentWorkload: clampWorkload(toNumber(candidate.currentWorkload)),
          skills: toStringArray(candidate.skills),
        };
      }),
    [teamMembers],
  );

  const normalizedAssignments = useMemo<WorkloadAssignment[]>(
    () =>
      workloadAssignments.map((assignment: unknown, index: number) => {
        const candidate = assignment as Record<string, unknown>;
        const taskTypeValue = toString(candidate.taskType, 'shooting');
        const priorityValue = toString(candidate.priority, 'medium');
        const statusValue = toString(candidate.status, 'pending');

        return {
          id: toString(candidate.id, `assignment-${index}`),
          projectId: toString(candidate.projectId),
          memberId: toString(candidate.memberId),
          taskType: isTaskType(taskTypeValue) ? taskTypeValue : 'shooting',
          estimatedHours: toNumber(candidate.estimatedHours, 0),
          priority: isTaskPriority(priorityValue) ? priorityValue : 'medium',
          status:
            statusValue === 'in_progress' || statusValue === 'completed' || statusValue === 'pending'
              ? statusValue
              : 'pending',
          dueDate: toString(candidate.dueDate, new Date().toISOString().split('T')[0]),
        };
      }),
    [workloadAssignments],
  );

  const normalizedSessions = useMemo<CollaborationSession[]>(
    () =>
      collaborativeSessions.map((session: unknown, index: number) => {
        const candidate = session as Record<string, unknown>;
        const sessionTypeValue = toString(candidate.sessionType, 'editing');
        const statusValue = toString(candidate.status, 'active');
        return {
          id: toString(candidate.id, `session-${index}`),
          projectId: toString(candidate.projectId),
          participants: toStringArray(candidate.participants),
          sessionType: isSessionType(sessionTypeValue) ? sessionTypeValue : 'editing',
          status:
            statusValue === 'active' || statusValue === 'ended' || statusValue === 'scheduled'
              ? statusValue
              : 'active',
          startedAt: toString(candidate.startedAt, new Date().toISOString()),
        };
      }),
    [collaborativeSessions],
  );

  const handleAddMember = () => {
    addTeamMember(newMember);
    setMemberDialogOpen(false);
    setNewMember({ name: '', email: '', role: 'photographer', skills: [] });
};

  const handleAssignWorkload = () => {
    assignWorkload(newWorkload);
    setWorkloadDialogOpen(false);
    setNewWorkload({
      projectId: '',
      memberId: '',
      taskType: 'shooting',
      estimatedHours: 8,
      priority: 'medium',
      dueDate: new Date().toISOString().split('T')[0],
});
};

  const handleStartSession = () => {
    startCollaborativeSession(newSession);
    setSessionDialogOpen(false);
    setNewSession({ projectId: '', participants: [], sessionType: 'editing' });
  };

  const handleMobileUpload = async (file: File) => {
    await processMobileUpload(file, 'project-1', 'member-1');
  };

  const renderOverview = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={3}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box display="flex" alignItems="center" mb={2}>
              <Group color="primary" />
              <Typography variant="h6" ml={1} sx={{ color: theming.colors.primary }}>
                Team Members
              </Typography>
            </Box>
            <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
              {normalizedTeamMembers.length}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Active members
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box display="flex" alignItems="center" mb={2}>
              <Assignment color="success" />
              <Typography variant="h6" ml={1} sx={{ color: theming.colors.primary }}>
                Active Tasks
              </Typography>
            </Box>
            <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
              {normalizedAssignments.filter((a) => a.status === 'in_progress').length}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              In progress
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box display="flex" alignItems="center" mb={2}>
              <VideoCall color="warning" />
              <Typography variant="h6" ml={1} sx={{ color: theming.colors.primary }}>
                Active Sessions
              </Typography>
            </Box>
            <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
              {normalizedSessions.filter((s) => s.status === 'active').length}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Collaborative
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box display="flex" alignItems="center" mb={2}>
              <Upload color="info" />
              <Typography variant="h6" ml={1} sx={{ color: theming.colors.primary }}>
                Mobile Uploads
              </Typography>
            </Box>
            <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
              24
            </Typography>
            <Typography variant="body2" color="textSecondary">
              This week
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Team Members</Typography>
              <Button
                startIcon={<PersonAdd />}
                variant="outlined"
                size="small"
                onClick={() => setMemberDialogOpen(true)}
              >
                Add Member
              </Button>
            </Box>
            <List>
              {normalizedTeamMembers.map((member) => (
                <ListItem key={member.id}>
                  <Avatar sx={{ mr: 2 }}>
                    {member.name.charAt(0)}
                  </Avatar>
                  <ListItemText
                    primary={member.name}
                    secondary={`${member.role} • ${member.currentWorkload}% workload`}
                  />
                  <Chip
                    label={member.role}
                    color="primary"
                    size="small"
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Workload Assignments</Typography>
              <Button
                startIcon={<Work />}
                variant="outlined"
                size="small"
                onClick={() => setWorkloadDialogOpen(true)}
              >
                Assign Task
              </Button>
            </Box>
            <List>
              {normalizedAssignments.slice(0, 5).map((assignment) => (
                <ListItem key={assignment.id}>
                  <ListItemText
                    primary={assignment.taskType}
                    secondary={`${assignment.estimatedHours}h • ${assignment.priority} priority`}
                  />
                  <Chip
                    label={assignment.status}
                    color={assignment.status === 'completed' ? 'success' : 'default'}
                    size="small"
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderMembers = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" sx={{ color: theming.colors.primary }}>Team Members</Typography>
        <Button
          startIcon={<PersonAdd />}
          variant="contained"
          onClick={() => setMemberDialogOpen(true)}
        >
          Add Member
        </Button>
      </Box>

      <Grid container spacing={3}>
        {normalizedTeamMembers.map((member) => (
          <Grid item xs={2} md={6} lg={4} key={member.id}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box display="flex" alignItems="center" mb={2}>
                  <Avatar sx={{ mr: 2, width:  48, height: 48}}>
                    {member.name.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{member.name}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {member.email}
                    </Typography>
                  </Box>
                </Box>
                <Chip
                  label={member.role}
                  color="primary"
                  size="small"
                  sx={{ mb:  2 }}
                />
                <Box mb={2}>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Workload: {member.currentWorkload}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={member.currentWorkload}
                    color={member.currentWorkload > 90 ? 'error' : 'primary'}
                  />
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <IconButton size="small">
                    {theming.getThemedIcon('edit')}
                  </IconButton>
                  <IconButton size="small" color="error">
                    {theming.getThemedIcon('delete')}
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderWorkload = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" sx={{ color: theming.colors.primary }}>Workload Management</Typography>
        <Button
          startIcon={<Work />}
          variant="contained"
          onClick={() => setWorkloadDialogOpen(true)}
        >
          Assign Task
        </Button>
      </Box>

      <Grid container spacing={3}>
        {normalizedAssignments.map((assignment) => (
          <Grid item xs={2} md={6} lg={4} key={assignment.id}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>{assignment.taskType}</Typography>
                  <Chip
                    label={assignment.priority}
                    color={assignment.priority === 'high' ? 'error' : 'default'}
                    size="small"
                  />
                </Box>
                <Typography variant="body2" color="textSecondary" mb={2}>
                  Project: {assignment.projectId}
                </Typography>
                <Typography variant="body2" color="textSecondary" mb={2}>
                  Hours: {assignment.estimatedHours}h
                </Typography>
                <Typography variant="body2" color="textSecondary" mb={2}>
                  Due: {new Date(assignment.dueDate).toLocaleDateString()}
                </Typography>
                <Chip
                  label={assignment.status}
                  color={assignment.status === 'completed' ? 'success' : 'default'}
                  size="small"
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderSessions = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" sx={{ color: theming.colors.primary }}>Collaborative Sessions</Typography>
        <Button
          startIcon={theming.getThemedIcon('videoCall')}
          variant="contained"
          onClick={() => setSessionDialogOpen(true)}
          sx={theming.getThemedButtonSx()}
        >
          Start Session
        </Button>
      </Box>

      <Grid container spacing={3}>
        {normalizedSessions.map((session) => (
          <Grid item xs={2} md={6} lg={4} key={session.id}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>{session.sessionType}</Typography>
                  <Chip
                    label={session.status}
                    color={session.status === 'active' ? 'success' : 'default'}
                    size="small"
                  />
                </Box>
                <Typography variant="body2" color="textSecondary" mb={2}>
                  Project: {session.projectId}
                </Typography>
                <Typography variant="body2" color="textSecondary" mb={2}>
                  Participants: {session.participants.length}
                </Typography>
                <Typography variant="body2" color="textSecondary" mb={2}>
                  Started: {new Date(session.startedAt).toLocaleString()}
                </Typography>
                <Box display="flex" justifyContent="space-between">
                  <IconButton size="small">
                    {theming.getThemedIcon('edit')}
                  </IconButton>
                  <IconButton size="small" color="error">
                    {theming.getThemedIcon('delete')}
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  return (
    <Box sx={{ p:  3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ color: theming.colors.primary }}>Team Collaboration</Typography>
        <Box>
          <Button
            startIcon={theming.getThemedIcon('group')}
            onClick={onMembersClick}
            sx={{ mr: 1 }}
          >
            Members
          </Button>
          <Button
            startIcon={theming.getThemedIcon('assignment')}
            onClick={onWorkloadClick}
            sx={{ mr: 1 }}
          >
            Workload
          </Button>
          <Button
            startIcon={theming.getThemedIcon('videoCall')}
            onClick={onSessionsClick}
            sx={{ mr: 1 }}
          >
            Sessions
          </Button>
          <Button
            startIcon={theming.getThemedIcon('upload')}
            onClick={onMobileClick}
          >
            Mobile
          </Button>
        </Box>
      </Box>

      <Box mb={3}>
        <Button
          variant={selectedView === 'overview' ? 'contained' : 'outlined'}
          onClick={() => setSelectedView('overview')}
          sx={{ mr:  1 }}
        >
          Overview
        </Button>
        <Button
          variant={selectedView === 'members' ? 'contained' : 'outlined'}
          onClick={() => setSelectedView('members')}
          sx={{ mr:  1 }}
        >
          Members
        </Button>
        <Button
          variant={selectedView === 'workload' ? 'contained' : 'outlined'}
          onClick={() => setSelectedView('workload')}
          sx={{ mr:  1 }}
        >
          Workload
        </Button>
        <Button
          variant={selectedView === 'sessions' ? 'contained' : 'outlined'}
          onClick={() => setSelectedView('sessions')}
        >
          Sessions
        </Button>
      </Box>

      {selectedView === 'overview' && renderOverview()}
      {selectedView === 'members' && renderMembers()}
      {selectedView === 'workload' && renderWorkload()}
      {selectedView ==='sessions' && renderSessions()}

      {/* Member Dialog */}
      <Dialog open={memberDialogOpen} onClose={() => setMemberDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Team Member</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:  1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Name"
                value={newMember.name}
                onChange={(e) => setNewMember(prev => ({ ...prev, name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                value={newMember.email}
                onChange={(e) => setNewMember(prev => ({ ...prev, email: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={newMember.role}
                  onChange={(e) => {
                    const roleValue = String(e.target.value);
                    setNewMember((prev) => ({
                      ...prev,
                      role: isTeamRole(roleValue) ? roleValue : 'assistant',
                    }));
                  }}
                >
                  <MenuItem value="photographer">Photographer</MenuItem>
                  <MenuItem value="videographer">Videographer</MenuItem>
                  <MenuItem value="editor">Editor</MenuItem>
                  <MenuItem value="assistant">Assistant</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMemberDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddMember} variant="contained" sx={theming.getThemedButtonSx()}>
            Add Member
          </Button>
        </DialogActions>
      </Dialog>

      {/* Workload Dialog */}
      <Dialog open={workloadDialogOpen} onClose={() => setWorkloadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Workload</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:  1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Project ID"
                value={newWorkload.projectId}
                onChange={(e) => setNewWorkload(prev => ({ ...prev, projectId: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Member</InputLabel>
                <Select
                  value={newWorkload.memberId}
                  onChange={(e) =>
                    setNewWorkload((prev) => ({ ...prev, memberId: String(e.target.value) }))
                  }
                >
                  {normalizedTeamMembers.map((member) => (
                    <MenuItem key={member.id} value={member.id}>
                      {member.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Task Type</InputLabel>
                <Select
                  value={newWorkload.taskType}
                  onChange={(e) => {
                    const taskTypeValue = String(e.target.value);
                    setNewWorkload((prev) => ({
                      ...prev,
                      taskType: isTaskType(taskTypeValue) ? taskTypeValue : 'shooting',
                    }));
                  }}
                >
                  <MenuItem value="shooting">Shooting</MenuItem>
                  <MenuItem value="editing">Editing</MenuItem>
                  <MenuItem value="client_meeting">Client Meeting</MenuItem>
                  <MenuItem value="delivery">Delivery</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Estimated Hours"
                type="number"
                value={newWorkload.estimatedHours}
                onChange={(e) => setNewWorkload(prev => ({ ...prev, estimatedHours: parseInt(e.target.value, 10) }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={newWorkload.priority}
                  onChange={(e) => {
                    const priorityValue = String(e.target.value);
                    setNewWorkload((prev) => ({
                      ...prev,
                      priority: isTaskPriority(priorityValue) ? priorityValue : 'medium',
                    }));
                  }}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Due Date"
                type="date"
                value={newWorkload.dueDate}
                onChange={(e) => setNewWorkload(prev => ({ ...prev, dueDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWorkloadDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAssignWorkload} variant="contained" sx={theming.getThemedButtonSx()}>
            Assign Task
          </Button>
        </DialogActions>
      </Dialog>

      {/* Session Dialog */}
      <Dialog open={sessionDialogOpen} onClose={() => setSessionDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Start Collaborative Session</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:  1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Project ID"
                value={newSession.projectId}
                onChange={(e) => setNewSession(prev => ({ ...prev, projectId: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Session Type</InputLabel>
                <Select
                  value={newSession.sessionType}
                  onChange={(e) => {
                    const sessionTypeValue = String(e.target.value);
                    setNewSession((prev) => ({
                      ...prev,
                      sessionType: isSessionType(sessionTypeValue) ? sessionTypeValue : 'editing',
                    }));
                  }}
                >
                  <MenuItem value="editing">Editing</MenuItem>
                  <MenuItem value="review">Review</MenuItem>
                  <MenuItem value="planning">Planning</MenuItem>
                  <MenuItem value="client_meeting">Client Meeting</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Participants</InputLabel>
                <Select
                  multiple
                  value={newSession.participants}
                  onChange={(e) => {
                    const value = e.target.value;
                    const participants = Array.isArray(value) ? value.map(String) : [String(value)];
                    setNewSession((prev) => ({ ...prev, participants }));
                  }}
                >
                  {normalizedTeamMembers.map((member) => (
                    <MenuItem key={member.id} value={member.id}>
                      {member.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSessionDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleStartSession} variant="contained" sx={theming.getThemedButtonSx()}>
            Start Session
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TeamCollaborationDashboard;
