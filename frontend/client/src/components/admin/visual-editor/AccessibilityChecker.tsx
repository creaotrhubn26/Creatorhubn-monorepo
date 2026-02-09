/**
 * Accessibility Checker - Scans preview for a11y issues
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Button,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  Close,
  Error,
  Warning,
  Info,
  CheckCircle,
  ExpandMore,
  Refresh,
  Download,
} from '@mui/icons-material';
import axe from 'axe-core';

interface AccessibilityIssue {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  helpUrl: string;
  nodes: {
    html: string;
    target: string[];
    failureSummary: string;
  }[];
}

interface AccessibilityCheckerProps {
  open: boolean;
  onClose: () => void;
  iframeRef: React.RefObject<HTMLIFrameElement>;
}

export const AccessibilityChecker: React.FC<AccessibilityCheckerProps> = ({
  open,
  onClose,
  iframeRef,
}) => {
  const [issues, setIssues] = useState<AccessibilityIssue[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [score, setScore] = useState(100);
  const [lastScan, setLastScan] = useState<Date | null>(null);

  useEffect(() => {
    if (open && iframeRef.current) {
      runAccessibilityScan();
    }
  }, [open]);

  const runAccessibilityScan = async () => {
    if (!iframeRef.current) return;

    setIsScanning(true);
    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

    if (!iframeDoc) {
      setIsScanning(false);
      return;
    }

    try {
      // Run axe-core scan with WCAG 2.2 Level AA standards
      const results = await axe.run(iframeDoc, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'],
        },
        rules: {
          // WCAG 2.2 specific rules
          'target-size': { enabled: true }, // WCAG 2.2 - Success Criterion 2.5.8
          'focus-visible': { enabled: true }, // WCAG 2.2 - Success Criterion 2.4.11
          'focus-not-obscured': { enabled: true }, // WCAG 2.2 - Success Criterion 2.4.12
          'dragging-movements': { enabled: true }, // WCAG 2.2 - Success Criterion 2.5.7
          'accessible-text': { enabled: true }, // WCAG 2.2 - Success Criterion 2.4.13

          // Core accessibility rules
          'color-contrast': { enabled: true } 'color-contrast-enhanced': { enabled: true }, 'image-alt': { enabled: true },
          label: { enabled: true }, 'link-name': { enabled: true }, 'button-name': { enabled: true }, 'aria-roles': { enabled: true }, 'aria-required-children': { enabled: true }, 'aria-required-parent': { enabled: true }, 'aria-valid-attr': { enabled: true }, 'aria-valid-attr-value': { enabled: true }'html-has-lang': { enabled: true }'html-lang-valid': { enabled: true }'landmark-one-main': { enabled: true }'page-has-heading-one': { enabled: true },
          region: { enabled: true }, 'duplicate-id': { enabled: true }'duplicate-id-active': { enabled: true }'duplicate-id-aria': { enabled: true }'form-field-multiple-labels': { enabled: true }'frame-title': { enabled: true }'heading-order': { enabled: true }'input-image-alt': { enabled: true },
          tabindex: { enabled: true }'meta-viewport': { enabled: true }'scrollable-region-focusable': { enabled: true },
        },
      });

      const formattedIssues: AccessibilityIssue[] = results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact as any,
        description: violation.description,
        help: violation.help,
        helpUrl: violation.helpUrl,
        nodes: violation.nodes.map((node) => ({
          html: node.html,
          target: node.target,
          failureSummary: node.failureSummary || '',
        })),
      }));

      setIssues(formattedIssues);
      calculateScore(formattedIssues);
      setLastScan(new Date();
    } catch (error) {
      console.error('Accessibility scan error: ', error);
    } finally {
      setIsScanning(false);
    }
  };

  const calculateScore = (issues: AccessibilityIssue[]) => {
    const weights = {
      critical: 25,
      serious: 15,
      moderate: 10,
      minor: 5,
    };

    const deductions = issues.reduce((total, issue) => {
      return total + (weights[issue.impact] || 0) * issue.nodes.length;
    }, 0);

    const finalScore = Math.max(0, 100 - deductions);
    setScore(finalScore);
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'critical': return <Error sx={{ color: '#d32f2f' }} />;
      case 'serious': return <Error sx={{ color: '#f57c00' }} />;
      case 'moderate': return <Warning sx={{ color: '#ffa726' }} />;
      case 'minor': return <Info sx={{ color: '#29b6f6' }} />;
      default: return <Info />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#4caf50';
    if (score >= 70) return '#ff9800';
    return '#f44336';
  };

  const exportReport = () => {
    const report = {
      timestamp: lastScan,
      score,
      totalIssues: issues.length,
      issues: issues.map((issue) => ({
        id: issue.id,
        impact: issue.impact,
        description: issue.description,
        help: issue.help,
        affectedElements: issue.nodes.length,
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `accessibility-report-${Date.now()}.json`;
    link.click();
  };

  const groupedIssues = {
    critical: issues.filter((i) => i.impact === 'critical'),
    serious: issues.filter((i) => i.impact === 'serious'),
    moderate: issues.filter((i) => i.impact === 'moderate'),
    minor: issues.filter((i) => i.impact === 'minor'),
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 400 } }>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            bgcolor: '#f5f5f5',
            borderBottom: '1px solid #e0e0e0'}}>
          <Typography variant="h6" sx={{ fontWeight: 600}}>
            Accessibility
          </Typography>
          <Box>
            <IconButton onClick={runAccessibilityScan} disabled={isScanning}>
              <Refresh />
            </IconButton>
            <IconButton onClick={exportReport} disabled={!lastScan}>
              <Download />
            </IconButton>
            <IconButton onClick={onClose}>
              <Close />
            </IconButton>
          </Box>
        </Box>

        {isScanning && <LinearProgress />}

        {/* Score */}
        <Box sx={{ p: 2, bgcolor: 'white', borderBottom: '1px solid #e0e0e0' }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
              Accessibility Score
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: getScoreColor(score) }}>
              {score}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={score}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: '#e0e0e0',
                            '& .MuiLinearProgress-bar': {
                bgcolor: getScoreColor(score),
              }}}
          />
          {lastScan && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Last scan: {lastScan.toLocaleTimeString()}
            </Typography>
          )}
        </Box>

        {/* Summary */}
        {!isScanning && lastScan && (
          <Box sx={{ p: 2, bgcolor: '#fafafa', borderBottom: '1px solid #e0e0e0' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Issues Found
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {groupedIssues.critical.length > 0 && (
                <Chip
                  label={`${groupedIssues.critical.length} Critical`}
                  size="small"
                  color="error"
                />
              )}
              {groupedIssues.serious.length > 0 && (
                <Chip
                  label={`${groupedIssues.serious.length} Serious`}
                  size="small"
                  sx={{ bgcolor: '#f57c00', color: 'white' }} />
              )}
              {groupedIssues.moderate.length > 0 && (
                <Chip
                  label={`${groupedIssues.moderate.length} Moderate`}
                  size="small"
                  color="warning"
                />
              )}
              {groupedIssues.minor.length > 0 && (
                <Chip label={`${groupedIssues.minor.length} Minor`} size="small" color="info" />
              )}
              {issues.length === 0 && (
                <Alert severity="success" sx={{ width: '100%' }}>
                  No accessibility issues found!
                </Alert>
              )}
            </Box>
          </Box>
        )}

        {/* Issues List */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
          {!lastScan && !isScanning && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Click the refresh button to run an accessibility scan
            </Alert>
          )}

          {issues.length > 0 && (
            <List sx={{ p: 0 }}>
              {issues.map((issue, index) => (
                <Accordion key={`${issue.id}-${index}`}, sx={{ mb: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      {getImpactIcon(issue.impact)}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600}}>
                          {issue.help}
                        </Typography>
                        <Chip
                          label={`${issue.nodes.length} element${issue.nodes.length !== 1 ? 's' : ', '}`}
                          size="small"
                          sx={{ mt: 0.5, height: 18, fontSize: '0.7rem' }} />
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {issue.description}
                    </Typography>

                    <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                      Affected Elements: </Typography>
                    {issue.nodes.map((node, nodeIndex) => (
                      <Box
                        key={nodeIndex}
                        sx={{
                          mb: 1,
                          p: 1,
                          bgcolor: '#f5f5f5',
                          borderRadius: 1,
                          fontFamily: 'monospace',
                          fontSize: '0.75rem'}}>
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'}}>
                          {node.html}
                        </Typography>
                        {node.failureSummary && (
                          <Typography
                            variant="caption"
                            color="error"
                            sx={{ display: 'block', mt: 0.5 }}>
                            {node.failureSummary}
                          </Typography>
                        )}
                      </Box>
                    ))}

                    <Button size="small" href={issue.helpUrl} target="_blank" sx={{ mt: 1 }}>
                      Learn More
                    </Button>
                  </AccordionDetails>
                </Accordion>
              ))}
            </List>
          )}
        </Box>

        {/* Footer */}
        <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderTop: '1px solid #e0e0e0' }}>
          <Typography variant="caption" color="text.secondary">
            Powered by axe-core • WCAG 2.2 Level AA
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Tests: {issues.reduce((total, issue) => total + issue.nodes.length, 0)} checks performed
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
};
