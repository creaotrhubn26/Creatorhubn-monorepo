/**
 * Rule Management Component
 * Admin interface for managing community rules
 */

import React, { useState, useEffect } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  IconButton,
  Alert,
} from '@mui/material';
import { Add, Edit, Delete, CheckCircle, Warning } from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface Rule {
  id: string;
  rule_code: string;
  rule_name: string;
  rule_description: string;
  default_severity: string;
  auto_enforce: boolean;
  first_violation_action: string;
  second_violation_action: string;
  third_violation_action: string;
  is_active: boolean;
}

export default function RuleManagement() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [formData, setFormData] = useState({
    ruleCode:  ',',
    ruleName: '',
    ruleDescription: '',
    defaultSeverity: 'medium',
    autoEnforce: false,
    firstViolationAction: 'warning',
    secondViolationAction: 'temp_ban',
    thirdViolationAction: 'permanent_ban',
    autoDetectKeywords: '',
    isActive: true,
  });

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const response = await apiRequest('/api/community/moderation/rules,', {
        method: 'GET',
      }) as { success: boolean; rules: Rule[] };

      if (response.success) {
        setRules(response.rules);
      }
    } catch (error) {
      console.error('Error loading rules: ', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (rule?: Rule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        ruleCode: rule.rule_code,
        ruleName: rule.rule_name,
        ruleDescription: rule.rule_description,
        defaultSeverity: rule.default_severity,
        autoEnforce: rule.auto_enforce,
        firstViolationAction: rule.first_violation_action,
        secondViolationAction: rule.second_violation_action,
        thirdViolationAction: rule.third_violation_action,
        autoDetectKeywords: Array.isArray((rule as any).auto_detect_keywords)
          ? (rule as any).auto_detect_keywords.join('')
          : ', ',
        isActive: rule.is_active,
      });
    } else {
      setEditingRule(null);
      setFormData({
        ruleCode: ', ',
        ruleName: ', ',
        ruleDescription: ', ',
        defaultSeverity: 'medium',
        autoEnforce: false,
        firstViolationAction: 'warning',
        secondViolationAction: 'temp_ban',
        thirdViolationAction: 'permanent_ban',
        autoDetectKeywords: ', ',
        isActive: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSaveRule = async () => {
    try {
      const autoDetectKeywords = formData.autoDetectKeywords
        ? formData.autoDetectKeywords.split(', ').map((k) => k.trim()).filter(Boolean)
        : null;

      if (editingRule) {
        // Update existing rule
        await apiRequest(`/api/community/moderation/rules/${editingRule.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            ...formData,
            autoDetectKeywords,
          }),
        });
      } else {
        // Create new rule
        await apiRequest('/api/community/moderation/rules', {
          method: 'POST',
          body: JSON.stringify({
            ...formData,
            autoDetectKeywords,
          }),
        });
      }

      setDialogOpen(false);
      loadRules();
    } catch (error) {
      console.error('Error saving rule:', error);
      alert('Kunne ikke lagre regel');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Er du sikker på at du vil deaktivere denne regelen?')) {
      return;
    }

    try {
      await apiRequest(`/api/community/moderation/rules/${ruleId}`, {
        method: 'DELETE',
      });
      loadRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
      alert('Kunne ikke slette regel');
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

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Community Regler</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
        >
          Ny Regel
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Regler definerer hva som er akseptabel oppførsel i community. Hver regel har konfigurerbare konsekvenser for 1., 2., og 3. overtredelse.
      </Alert>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Regel</strong></TableCell>
              <TableCell><strong>Beskrivelse</strong></TableCell>
              <TableCell><strong>Alvorlighetsgrad</strong></TableCell>
              <TableCell><strong>Konsekvenser</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Handlinger</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>
                  <Typography variant="body2" fontWeight="bold">
                    {rule.rule_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {rule.rule_code}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ maxWidth: 300 }}>
                    {rule.rule_description}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={rule.default_severity}
                    color={getSeverityColor(rule.default_severity) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" display="block">
                    1: {rule.first_violation_action}
                  </Typography>
                  <Typography variant="caption" display="block">
                    2: {rule.second_violation_action}
                  </Typography>
                  <Typography variant="caption" display="block">
                    3: {rule.third_violation_action}
                  </Typography>
                </TableCell>
                <TableCell>
                  {rule.is_active ? (
                    <Chip label="Aktiv" color="success" size="small" icon={<CheckCircle />} />
                  ) : (
                    <Chip label="Inaktiv" color="default" size="small" />
                  )}
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleOpenDialog(rule)}>
                    <Edit />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDeleteRule(rule.id)} color="error">
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Rule Dialog - will be added in next edit */}
      <RuleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        formData={formData}
        setFormData={setFormData}
        onSave={handleSaveRule}
        isEditing={!!editingRule}
      />
    </Box>
  );
}

function RuleDialog({ open, onClose, formData, setFormData, onSave, isEditing }: any) {
  const severityOptions = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  const actionOptions = [
    { value: 'warning', label: 'Warning' },
    { value: 'temp_ban', label: 'Temporary ban' },
    { value: 'permanent_ban', label: 'Permanent ban' },
    { value: 'message_delete', label: 'Delete message' },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEditing ? 'Rediger regel' : 'Ny regel'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Rule code"
            value={formData.ruleCode}
            onChange={(e) => setFormData({ ...formData, ruleCode: e.target.value })}
            fullWidth
            required
            helperText="Unique code (e.g., respect, spam)"
          />
          <TextField
            label="Rule name"
            value={formData.ruleName}
            onChange={(e) => setFormData({ ...formData, ruleName: e.target.value })}
            fullWidth
            required
          />
          <TextField
            label="Description"
            value={formData.ruleDescription}
            onChange={(e) => setFormData({ ...formData, ruleDescription: e.target.value })}
            fullWidth
            multiline
            rows={3}
          />

          <TextField
            label="Auto-detect keywords (comma separated)"
            value={formData.autoDetectKeywords}
            onChange={(e) => setFormData({ ...formData, autoDetectKeywords: e.target.value })}
            fullWidth
            helperText="Optional: used for automatic detection/enforcement"
          />

          <FormControl fullWidth>
            <InputLabel>Severity</InputLabel>
            <Select
              value={formData.defaultSeverity}
              label="Severity"
              onChange={(e) => setFormData({ ...formData, defaultSeverity: e.target.value })}
            >
              {severityOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={formData.autoEnforce}
                onChange={(e) => setFormData({ ...formData, autoEnforce: e.target.checked })}
              />
            }
            label="Auto-enforce"
          />

          <FormControl fullWidth>
            <InputLabel>First violation</InputLabel>
            <Select
              value={formData.firstViolationAction}
              label="First violation"
              onChange={(e) => setFormData({ ...formData, firstViolationAction: e.target.value })}
            >
              {actionOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Second violation</InputLabel>
            <Select
              value={formData.secondViolationAction}
              label="Second violation"
              onChange={(e) => setFormData({ ...formData, secondViolationAction: e.target.value })}
            >
              {actionOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Third violation</InputLabel>
            <Select
              value={formData.thirdViolationAction}
              label="Third violation"
              onChange={(e) => setFormData({ ...formData, thirdViolationAction: e.target.value })}
            >
              {actionOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
            }
            label="Active"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button variant="contained" onClick={onSave}>
          {isEditing ? 'Oppdater' : 'Opprett'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
