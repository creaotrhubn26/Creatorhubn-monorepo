/**
 * Moderation Management Component
 * Admin interface for managing community moderation, warnings, bans, and reports
 */

import React, { useState, useEffect } from 'react';
import RuleManagement from './RuleManagement';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Warning,
  Block,
  Report,
  CheckCircle,
  Delete,
  Visibility,
  Gavel,
  TrendingUp,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

interface ModerationAction {
  id: string;
  user_id: string;
  moderator_id: string;
  action_type: string;
  severity: string;
  rule_violated: string;
  violation_description: string;
  created_at: string;
  ban_end_date?: string;
}

interface ModerationReport {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  report_reason: string;
  report_description: string;
  status: string;
  created_at: string;
  message_content?: string;
  channel_name?: string;
}

interface ModerationStats {
  total_warnings: number;
  total_temp_bans: number;
  total_permanent_bans: number;
  total_message_deletes: number;
  actions_last_7_days: number;
  actions_last_30_days: number;
  pending_reports: number;
  currently_banned_users: number;
}

export default function ModerationManagement() {
  const [tabValue, setTabValue] = useState(0);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [actions, setActions] = useState<ModerationAction[]>([]);
  const [stats, setStats] = useState<ModerationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionsSupported, setActionsSupported] = useState<boolean | null>(null);
  
  // Dialog states
  const [warnDialogOpen, setWarnDialogOpen] = useState(false);
  const [actionForm, setActionForm] = useState({
    userId:  ',',
    ruleViolated: 'respect',
    violationDescription: '',
    moderatorNotes: '',
  });

  useEffect(() => {
    loadData();
  }, [tabValue]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load stats
      const statsData = await apiRequest('/api/community/moderation/stats,', {
        method: 'GET',
      }) as { success: boolean; stats: ModerationStats };
      
      if (statsData.success) {
        setStats(statsData.stats);
      }

      // Load reports
      const reportsData = await apiRequest('/api/community/moderation/reports?status=pending', {
        method: 'GET',
      }) as { success: boolean; reports: ModerationReport[] };
      
      if (reportsData.success) {
        setReports(reportsData.reports);
      }

      // Load recent actions if endpoint exists
      try {
        const actionsData = await apiRequest('/api/community/moderation/actions', {
          method: 'GET',
        }) as { success: boolean; actions: ModerationAction[] };

        if (actionsData.success) {
          setActions(actionsData.actions);
          setActionsSupported(true);
        } else {
          setActionsSupported(false);
        }
      } catch (err) {
        setActionsSupported(false);
        setActions([]);
      }

    } catch (error) {
      console.error('Error loading moderation data: ', error);
    } finally {
      setLoading(false);
    }
  };

  const handleIssueWarning = async () => {
    try {
      const response = await apiRequest('/api/community/moderation/warn', {
        method: 'POST',
        body: JSON.stringify({
          ...actionForm,
          moderatorId: 'current-admin-id', // TODO: Get from auth context
        }),
      }) as { success: boolean; message: string };

      if (response.success) {
        alert(response.message);
        setWarnDialogOpen(false);
        loadData();
      }
    } catch (error) {
      console.error('Error issuing warning:', error);
      alert('Failed to issue warning');
    }
  };

  const handleResolveReport = async (reportId: string, resolutionNotes?: string) => {
    try {
      await apiRequest(`/api/community/moderation/reports/${reportId}/resolve`, {
        method: 'PUT',
        body: JSON.stringify({
          reviewedBy: 'current-admin-id', // TODO: Get from auth context
          resolutionNotes: resolutionNotes || ', ',
        }),
      });
      
      loadData();
    } catch (error) {
      console.error('Error resolving report:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const getActionTypeLabel = (actionType: string) => {
    switch (actionType) {
      case 'warning': return 'Advarsel';
      case 'temp_ban': return '7-dagers suspensjon';
      case 'permanent_ban': return 'Permanent utestengelse';
      case 'message_delete': return 'Melding slettet';
      default: return actionType;
    }
  };

  if (loading) {
    return (
      <Alert severity="info">
        Laster moderasjonsdata...
      </Alert>
    );
  }

  return (
    <Box>
      {/* Stats Overview */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #FFA726 0%, #FB8C00 100%)', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h4">{stats.pending_reports}</Typography>
                    <Typography variant="body2">Ventende Rapporter</Typography>
                  </Box>
                  <Report sx={{ fontSize: 40, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #EF5350 0%, #E53935 100%)', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h4">{stats.currently_banned_users}</Typography>
                    <Typography variant="body2">Utestengte Brukere</Typography>
                  </Box>
                  <Block sx={{ fontSize: 40, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #FFCA28 0%, #FFB300 100%)', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h4">{stats.total_warnings}</Typography>
                    <Typography variant="body2">Totale Advarsler</Typography>
                  </Box>
                  <Warning sx={{ fontSize: 40, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #66BB6A 0%, #43A047 100%)', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h4">{stats.actions_last_7_days}</Typography>
                    <Typography variant="body2">Handlinger (7 dager)</Typography>
                  </Box>
                  <TrendingUp sx={{ fontSize: 40, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Card>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Rapporter" icon={<Report />} />
          <Tab label="Handlinger" icon={<Gavel />} />
          <Tab label="Regler" icon={<CheckCircle />} />
        </Tabs>

        <CardContent>
          {/* Reports Tab */}
          {tabValue === 0 && (
            <ReportsTab
              reports={reports}
              onResolve={handleResolveReport}
              onIssueWarning={(userId) => {
                setActionForm({ ...actionForm, userId });
                setWarnDialogOpen(true);
              }}
            />
          )}

          {/* Actions Tab */}
          {tabValue === 1 && (
            <ActionsTab actions={actions} actionsSupported={actionsSupported} />
          )}

          {/* Rules Tab */}
          {tabValue === 2 && (
            <RulesTab />
          )}
        </CardContent>
      </Card>

      {/* Warning Dialog */}
      <WarnDialog
        open={warnDialogOpen}
        onClose={() => setWarnDialogOpen(false)}
        actionForm={actionForm}
        setActionForm={setActionForm}
        onSubmit={handleIssueWarning}
      />
    </Box>
  );
}

// Reports Tab Component
function ReportsTab({ reports, onResolve, onIssueWarning }: any) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'resolved': return 'success';
      case 'dismissed': return 'default';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Venter';
      case 'resolved': return 'Løst';
      case 'dismissed': return 'Avvist';
      default: return status;
    }
  };

  if (reports.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Report sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          Ingen rapporter
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Alle rapporter vil vises her
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Dato</TableCell>
            <TableCell>Rapportert Bruker</TableCell>
            <TableCell>Grunn</TableCell>
            <TableCell>Beskrivelse</TableCell>
            <TableCell>Kanal</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Handlinger</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {reports.map((report: ModerationReport) => (
            <TableRow key={report.id}>
              <TableCell>
                {format(new Date(report.created_at), 'dd.MM.yyyy HH:mm', { locale: nb })}
              </TableCell>
              <TableCell>{report.reported_user_id}</TableCell>
              <TableCell>
                <Chip label={report.report_reason} size="small" />
              </TableCell>
              <TableCell>
                <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                  {report.report_description}
                </Typography>
              </TableCell>
              <TableCell>{report.channel_name || 'N/A'}</TableCell>
              <TableCell>
                <Chip
                  label={getStatusLabel(report.status)}
                  color={getStatusColor(report.status) as any}
                  size="small"
                />
              </TableCell>
              <TableCell>
                {report.status === 'pending' && (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Gi advarsel">
                      <IconButton
                        size="small"
                        color="warning"
                        onClick={() => onIssueWarning(report.reported_user_id)}
                      >
                        <Warning />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Merk som løst">
                      <IconButton
                        size="small"
                        color="success"
                        onClick={() => onResolve(report.id, 'Resolved')}
                      >
                        <CheckCircle />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Avvis (markeres som løst)">
                      <IconButton
                        size="small"
                        onClick={() => onResolve(report.id, 'Dismissed')}
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// Actions Tab Component
function ActionsTab({ actions, actionsSupported }: any) {
  if (actionsSupported === false) {
    return (
      <Alert severity="info">
        Backend does not expose a global moderation actions feed. Use user-specific status endpoint instead.
      </Alert>
    );
  }

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'warning': return 'warning';
      case 'temp_ban': return 'error';
      case 'permanent_ban': return 'error';
      case 'message_delete': return 'default';
      default: return 'default';
    }
  };

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'warning': return 'Advarsel';
      case 'temp_ban': return 'Midlertidig Utestengelse';
      case 'permanent_ban': return 'Permanent Utestengelse';
      case 'message_delete': return 'Melding Slettet';
      default: return actionType;
    }
  };

  if (!actions.length) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Gavel sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          Ingen moderasjonshandlinger
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Alle moderasjonshandlinger vil vises her
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Dato</TableCell>
            <TableCell>Bruker</TableCell>
            <TableCell>Handling</TableCell>
            <TableCell>Alvorlighetsgrad</TableCell>
            <TableCell>Regel Brutt</TableCell>
            <TableCell>Beskrivelse</TableCell>
            <TableCell>Moderator</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {actions.map((action: ModerationAction) => (
            <TableRow key={action.id}>
              <TableCell>
                {format(new Date(action.created_at), 'dd.MM.yyyy HH:mm', { locale: nb })}
              </TableCell>
              <TableCell>{action.user_id}</TableCell>
              <TableCell>
                <Chip
                  label={getActionLabel(action.action_type)}
                  color={getActionColor(action.action_type) as any}
                  size="small"
                />
              </TableCell>
              <TableCell>
                <Chip label={action.severity} size="small" />
              </TableCell>
              <TableCell>{action.rule_violated}</TableCell>
              <TableCell>
                <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                  {action.violation_description}
                </Typography>
              </TableCell>
              <TableCell>{action.moderator_id}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// Rules Tab Component - Uses existing RuleManagement
function RulesTab() {
  return <RuleManagement />;
}

// Warn Dialog Component
function WarnDialog({ open, onClose, actionForm, setActionForm, onSubmit }: any) {
  const rules = [
    { value: 'respect', label: 'Respekt og Profesjonalitet' },
    { value: 'quality', label: 'Kvalitetsinnhold' },
    { value: 'spam', label: 'Spam' },
    { value: 'copyright', label: 'Opphavsrett' },
    { value: 'confidentiality', label: 'Konfidensialitet' },
    { value: 'feedback', label: 'Konstruktiv Tilbakemelding' },
    { value: 'channel', label: 'Riktig Kanalbruk' },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="warning" />
          <Typography variant="h6">Gi Advarsel</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection:'column', gap: 2, mt: 2 }}>
          <TextField
            label="Bruker ID"
            value={actionForm.userId}
            onChange={(e) => setActionForm({ ...actionForm, userId: e.target.value })}
            fullWidth
            disabled
          />

          <FormControl fullWidth>
            <InputLabel>Regel Brutt</InputLabel>
            <Select
              value={actionForm.ruleViolated}
              onChange={(e) => setActionForm({ ...actionForm, ruleViolated: e.target.value })}
              label="Regel Brutt"
            >
              {rules.map((rule) => (
                <MenuItem key={rule.value} value={rule.value}>
                  {rule.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Beskrivelse av Brudd"
            value={actionForm.violationDescription}
            onChange={(e) => setActionForm({ ...actionForm, violationDescription: e.target.value })}
            multiline
            rows={3}
            fullWidth
            required
            helperText="Beskriv hva brukeren gjorde galt"
          />

          <TextField
            label="Moderator Notater (Valgfritt)"
            value={actionForm.moderatorNotes}
            onChange={(e) => setActionForm({ ...actionForm, moderatorNotes: e.target.value })}
            multiline
            rows={2}
            fullWidth
            helperText="Interne notater (vises ikke til brukeren)"
          />

          <Alert severity="info">
            Brukeren vil motta en e-post med advarselen. Dette er deres første advarsel i 3-strike systemet.
          </Alert>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button
          onClick={onSubmit}
          variant="contained"
          color="warning"
          disabled={!actionForm.violationDescription.trim()}
          startIcon={<Warning />}
        >
          Send Advarsel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
