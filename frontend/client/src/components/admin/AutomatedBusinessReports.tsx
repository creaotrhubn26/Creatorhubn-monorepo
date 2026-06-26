/**
 * CreatorHub Norge - Automated Business Reports System
 * Phase 14: Advanced Analytics & Business Intelligence
 *
 * Comprehensive automated reporting system with:
 * - PDF report generation
 * - Norwegian compliance reports
 * - Scheduled report delivery
 * - Custom report templates
 * - Financial and operational analytics
 * - Integration performance summaries
 * - Tax and VAT reporting (Norwegian standards)
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import { useGoogleSSO } from '../../hooks/useGoogleSSO';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Divider,
  Badge,
  LinearProgress,
  DialogContentText,
  Checkbox,
  FormGroup,
} from '@mui/material';
import {
  Assessment as ReportIcon,
  PictureAsPdf as PdfIcon,
  Schedule as ScheduleIcon,
  Send as SendIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Email as EmailIcon,
  Event as EventIcon,
  TrendingUp as TrendingUpIcon,
  MonetizationOn as MoneyIcon,
  Business as BusinessIcon,
  Analytics as AnalyticsIcon,
  Security as SecurityIcon,
  CloudDownload as CloudIcon,
  Autorenew as AutorenewIcon,
  NotificationImportant as AlertIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  ContentCopy as CopyIcon,
  History as HistoryIcon,
  LocalShipping as BringIcon,
  AccountBalance as TaxIcon,
  Gavel as ComplianceIcon,
  Email as ContactIcon,
  Group as GroupIcon,
  TableChart as TableChartIcon,
  AccountBalance as SplitSheetIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { nb } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: 'financial' | 'operational' | 'compliance' | 'analytics' | 'custom';
  sections: string[];
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'manual';
  format: 'pdf' | 'excel' | 'csv';
  recipients: string[];
  norwegianCompliance: boolean;
  vatIncluded: boolean;
  lastGenerated?: string;
  nextScheduled?: string;
  status: 'active' | 'draft' | 'archived';
}

interface GeneratedReport {
  id: string;
  templateId: string;
  templateName: string;
  generatedAt: string;
  period: string;
  format: string;
  fileSize: string;
  downloadUrl: string;
  recipients: string[];
  status: 'generating' | 'ready' | 'sent' | 'failed';
  pages?: number;
}

interface ReportSchedule {
  id: string;
  templateId: string;
  name: string;
  frequency: string;
  nextRun: string;
  lastRun?: string;
  enabled: boolean;
  recipients: string[];
}

const AutomatedBusinessReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [reportTemplates, setReportTemplates] = useState<ReportTemplate[]>([]);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [reportSchedules, setReportSchedules] = useState<ReportSchedule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [createDialogOpen, setCreateDialogOpen] = useState<boolean>(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState<boolean>(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({ start: null, end: null });
  const [customRecipients, setCustomRecipients] = useState<string[]>([]);
  const [generatingReport, setGeneratingReport] = useState<boolean>(false);
  const [selectedReport, setSelectedReport] = useState<GeneratedReport | null>(null);

  const { toast } = useToast();

  // Theming system
  const theming = useTheming('prototype_tester');

  // Google SSO integration
  const googleSSO = useGoogleSSO();

  // Enhanced Master Integration - for auth, analytics, Google Drive, Google Sheets
  const masterIntegration = useEnhancedMasterIntegration();
  const userEmail =
    masterIntegration.auth.state.user?.email || googleSSO.user?.email || 'daniel@creatorhubn.com';
  const profession = (masterIntegration.auth.state.user as any)?.profession || 'photographer';
  const isMusicProducer = profession === 'music_producer';

  // Fetch split sheet statistics for reports (only for music producers)
  const { data: splitSheetStats } = useQuery({
    queryKey: ['split-sheets-report-stats', userEmail],
    queryFn: async () => {
      const authHeaders = await masterIntegration.auth.getAuthHeader();
      const response = await fetch(`/api/split-sheets/stats?profession=${profession}`, {
        headers: { 'x-user-email': userEmail, ...authHeaders },
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: isMusicProducer,
  });

  // Fetch report data
  const fetchReportData = async () => {
    try {
      setLoading(true);
      const authHeaders = await masterIntegration.auth.getAuthHeader();
      const [templatesRes, reportsRes, schedulesRes] = await Promise.all([
        fetch('/api/admin/business-reports/templates', {
          headers: { 'x-user-email': userEmail, ...authHeaders },
        }),
        fetch('/api/admin/business-reports/generated', {
          headers: { 'x-user-email': userEmail, ...authHeaders },
        }),
        fetch('/api/admin/business-reports/schedules', {
          headers: { 'x-user-email': userEmail, ...authHeaders },
        }),
      ]);

      const [templates, reports, schedules] = await Promise.all([
        templatesRes.json(),
        reportsRes.json(),
        schedulesRes.json(),
      ]);

      setReportTemplates(Array.isArray(templates) ? templates : []);
      setGeneratedReports(Array.isArray(reports) ? reports : []);
      setReportSchedules(Array.isArray(schedules) ? schedules : []);
    } catch (error) {
      console.error('❌ Error fetching report data: ', error);
      toast({
        title: '❌ Feil ved lasting av rapporter',
        description: 'Kunne ikke laste rapportdata',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  // Generate report
  const generateReport = async (template: ReportTemplate, customSettings?: any) => {
    try {
      setGeneratingReport(true);

      const authHeaders = await masterIntegration.auth.getAuthHeader();
      const response = await fetch('/api/admin/business-reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','x-user-email': userEmail,
          ...authHeaders,
        },
        body: JSON.stringify({
          templateId: template.id,
          dateRange: selectedDateRange,
          recipients: customRecipients.length > 0 ? customRecipients : template.recipients,
          ...customSettings,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const result = await response.json();

      toast({
        title: '✅ Rapport Generert',
        description: `${template.name} er generert og klar for nedlasting`,
        variant: 'default',
      });

      // Track report generation
      masterIntegration.analytics.trackEvent('business_report_generated', {
        templateId: template.id,
        templateName: template.name,
        category: template.category,
        period: selectedDateRange,
      });

      setGenerateDialogOpen(false);
      fetchReportData(); // Refresh the list
    } catch (error) {
      console.error('❌ Error generating report:', error);
      toast({
        title: '❌ Rapport Feil',
        description: 'Kunne ikke generere rapport',
        variant: 'destructive',
      });
    } finally {
      setGeneratingReport(false);
    }
  };

  // Download report
  const downloadReport = async (report: GeneratedReport) => {
    try {
      const authHeaders = await masterIntegration.auth.getAuthHeader();
      const response = await fetch(report.downloadUrl, {
        headers: { 'x-user-email': userEmail, ...authHeaders },
      });

      if (!response.ok) {
        throw new Error('Failed to download report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.templateName}_${report.period}.${report.format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: '📄 Rapport Lastet Ned',
        description: `${report.templateName} er lastet ned`,
        variant: 'default',
      });
    } catch (error) {
      console.error('❌ Error downloading report:', error);
      toast({
        title: '❌ Nedlasting Feil',
        description: 'Kunne ikke laste ned rapport',
        variant: 'destructive',
      });
    }
  };

  // Export report to Google Sheets
  const exportToGoogleSheets = async (report: GeneratedReport) => {
    try {
      const authHeaders = await masterIntegration.auth.getAuthHeader();
      const response = await fetch('/api/google-sheets/export-quotes', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','x-user-email': userEmail,
          ...authHeaders,
        },
        body: JSON.stringify({
          sheetName: `${report.templateName} - ${report.period}`,
          headers: ['Report Name','Period','Generated At','Status','Pages','File Size'],
          data: [
            [
              report.templateName,
              report.period,
              new Date(report.generatedAt).toLocaleString('nb-NO'),
              report.status,
              report.pages?.toString() || 'N/A',
              report.fileSize,
            ],
          ],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to export to Google Sheets');
      }

      const result = await response.json();

      toast({
        title: '✅ Eksportert til Google Sheets',
        description: `Rapport eksportert. Åpne: ${result.spreadsheetUrl}`,
        variant: 'default',
      });

      // Track export
      masterIntegration.analytics.trackEvent('report_exported_to_sheets', {
        reportId: report.id,
        templateName: report.templateName,
        spreadsheetId: result.spreadsheetId,
      });
    } catch (error) {
      console.error('❌ Error exporting to Google Sheets:', error);
      toast({
        title: '❌ Google Sheets Eksport Feil',
        description: 'Kunne ikke eksportere til Google Sheets',
        variant: 'destructive',
      });
    }
  };

  // Generate PDF using jsPDF
  const generatePDFReport = async (template: ReportTemplate) => {
    try {
      const doc = new jsPDF();

      // Header
      doc.setFontSize(20);
      doc.text(template.name, 20, 20);

      // Description
      doc.setFontSize(12);
      doc.text(template.description, 20, 35);

      // Sections
      let yPos = 50;
      doc.setFontSize(14);
      doc.text('Rapport Seksjoner:', 20, yPos);
      yPos += 10;

      doc.setFontSize(10);
      template.sections.forEach((section, index) => {
        doc.text(`${index + 1}. ${section}`, 25, yPos);
        yPos += 7;
      });

      // Add Split Sheet Statistics (only for music producers)
      if (isMusicProducer && splitSheetStats?.data) {
        yPos += 10;
        doc.setFontSize(14);
        doc.text('Split Sheet Statistikk:', 20, yPos);
        yPos += 10;
        doc.setFontSize(10);
        const stats = splitSheetStats.data;
        doc.text(`Totalt antall split sheets: ${stats.total || 0}`, 25, yPos);
        yPos += 7;
        doc.text(`Fullførte: ${stats.completed || 0}`, 25, yPos);
        yPos += 7;
        doc.text(`Venter signaturer: ${stats.pendingSignatures || 0}`, 25, yPos);
        yPos += 7;
        doc.text(`Total inntekt: ${(stats.totalRevenue || 0).toLocaleString('nb-NO')} kr`, 25, yPos);
        yPos += 7;
        doc.text(`Prosjekter med split sheets: ${stats.projectsWithSplitSheets || 0}`, 25, yPos);
      }

      // Footer
      yPos += 10;
      doc.setFontSize(8);
      doc.text(`Generert: ${new Date().toLocaleString('nb-NO')}`, 20, yPos);
      doc.text(`Frekvens: ${template.frequency}`, 20, yPos + 5);
      doc.text(`Format: ${template.format.toUpperCase()}`, 20, yPos + 10);

      if (template.norwegianCompliance) {
        doc.text('🇳🇴 Norsk Compliance: Ja', 20, yPos + 15);
      }

      // Save PDF
      doc.save(
        `${template.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
      );

      toast({
        title: '✅ PDF Generert',
        description: `${template.name} er lastet ned som PDF`,
        variant: 'default',
      });

      // Track PDF generation
      masterIntegration.analytics.trackEvent('pdf_report_generated', {
        templateId: template.id,
        templateName: template.name,
      });
    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      toast({
        title: '❌ PDF Generering Feil',
        description: 'Kunne ikke generere PDF',
        variant: 'destructive',
      });
    }
  };

  // Save report to Google Drive
  const saveToGoogleDrive = async (report: GeneratedReport) => {
    try {
      const authHeaders = await masterIntegration.auth.getAuthHeader();
      const response = await fetch('/api/google-drive/save-report', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','x-user-email': userEmail,
          ...authHeaders,
        },
        body: JSON.stringify({
          reportId: report.id,
          reportName: report.templateName,
          period: report.period,
          downloadUrl: report.downloadUrl,
          folderPath: 'CreatorHub/Business Reports',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save to Google Drive');
      }

      const result = await response.json();

      toast({
        title: '✅ Lagret til Google Drive',
        description: `Rapport lagret. Åpne: ${result.webViewLink}`,
        variant: 'default',
      });

      // Track Drive save
      masterIntegration.analytics.trackEvent('report_saved_to_drive', {
        reportId: report.id,
        templateName: report.templateName,
        driveFileId: result.fileId,
      });
    } catch (error) {
      console.error('❌ Error saving to Google Drive:', error);
      toast({
        title: '❌ Google Drive Lagring Feil',
        description: 'Kunne ikke lagre til Google Drive',
        variant: 'destructive',
      });
    }
  };

  // Email report
  const emailReport = async (report: GeneratedReport) => {
    try {
      const authHeaders = await masterIntegration.auth.getAuthHeader();
      const response = await fetch('/api/admin/business-reports/email', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','x-user-email': userEmail,
          ...authHeaders,
        },
        body: JSON.stringify({
          reportId: report.id,
          recipients: report.recipients,
          subject: `${report.templateName} - ${report.period}`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to email report');
      }

      toast({
        title: '✅ Rapport Sendt',
        description: `${report.templateName} sendt til ${report.recipients.length} mottaker(e)`,
        variant: 'default',
      });

      // Track email send
      masterIntegration.analytics.trackEvent('report_emailed', {
        reportId: report.id,
        templateName: report.templateName,
        recipientCount: report.recipients.length,
      });
    } catch (error) {
      console.error('❌ Error emailing report:', error);
      toast({
        title: '❌ E-post Feil',
        description: 'Kunne ikke sende rapport',
        variant: 'destructive',
      });
    }
  };

  // Toggle schedule enabled/disabled
  const toggleSchedule = async (templateId: string, enabled: boolean) => {
    try {
      const authHeaders = await masterIntegration.auth.getAuthHeader();
      const response = await fetch(`/api/admin/business-reports/schedules/${templateId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type' : 'application/json','x-user-email': userEmail,
          ...authHeaders,
        },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle schedule');
      }

      // Update local state
      setReportTemplates((prev) =>
        prev.map((t) => (t.id === templateId ? { ...t, status: enabled ? 'active' : 'draft' } : t)),
      );

      toast({
        title: enabled ? '✅ Planlegging Aktivert' : '⏸️ Planlegging Deaktivert',
        description: `Automatisk generering er ${enabled ? 'aktivert' : 'deaktivert'}`,
        variant: 'default',
      });

      // Track schedule toggle
      masterIntegration.analytics.trackEvent('report_schedule_toggled', {
        templateId,
        enabled,
      });
    } catch (error) {
      console.error('❌ Error toggling schedule:', error);
      toast({
        title: '❌ Planlegging Feil',
        description: 'Kunne ikke endre planlegging',
        variant: 'destructive',
      });
    }
  };

  // Default report templates
  const defaultTemplates: ReportTemplate[] = [
    {
      id: 'monthly-financial',
      name: 'Månedlig Finansrapport',
      description: 'Omfattende finansiell oversikt med norske regnskapsregler',
      category: 'financial',
      sections: [
        'Revenue Analysis','Cost Breakdown','Profit/Loss','Tax Calculations','VAT Summary',
        ...(isMusicProducer ? ['Split Sheet Revenue','Split Sheet Payments'] : []),
      ],
      frequency: 'monthly',
      format: 'pdf',
      recipients: ['daniel@creatorhubn.com'],
      norwegianCompliance: true,
      vatIncluded: true,
      status: 'active',
    },
    ...(isMusicProducer ? [{
      id: 'split-sheet-report',
      name: 'Split Sheet Rapport',
      description: 'Detaljert rapport over split sheets, inntekter og betalinger',
      category: 'financial' as const,
      sections: [
        'Split Sheet Oversikt','Inntektsanalyse','Betalingstatus','Bidragsyterstatistikk','Revenue Trends',
      ],
      frequency: 'monthly' as const,
      format: 'pdf' as const,
      recipients: ['daniel@creatorhubn.com'],
      norwegianCompliance: true,
      vatIncluded: true,
      status: 'active' as const,
    }] : []),
    {
      id: 'integration-performance',
      name: 'Integrasjonsytelse Rapport',
      description: 'Detaljert analyse av alle API-integrasjoner og ytelse',
      category: 'analytics',
      sections: [
        'API Usage','Performance Metrics','Cost Analysis','Error Reports','Recommendations',
      ],
      frequency: 'weekly',
      format: 'pdf',
      recipients: ['daniel@creatorhubn.com'],
      norwegianCompliance: false,
      vatIncluded: false,
      status: 'active',
    },
    {
      id: 'tax-compliance',
      name: 'Norsk Skattedata Rapport',
      description: 'Skatterapport tilpasset norske krav og MVA-regler',
      category: 'compliance',
      sections: [
        'Income Summary','Deductible Expenses','VAT Calculations','Equipment Depreciation','Travel Expenses',
      ],
      frequency: 'quarterly',
      format: 'pdf',
      recipients: ['daniel@creatorhubn.com'],
      norwegianCompliance: true,
      vatIncluded: true,
      status: 'active',
    },
    {
      id: 'client-analytics',
      name: 'Kundeanalyse Rapport',
      description: 'Omfattende analyse av kundedata og markedstrender',
      category: 'analytics',
      sections: [
        'Client Demographics','Revenue per Client','Project Types','Seasonal Trends','Growth Opportunities',
      ],
      frequency: 'monthly',
      format: 'pdf',
      recipients: ['daniel@creatorhubn.com'],
      norwegianCompliance: true,
      vatIncluded: false,
      status: 'active',
    },
    {
      id: 'operational-summary',
      name: 'Operasjonell Sammendrag',
      description: 'Månedlig oversikt over drift, prosjekter og ressursbruk',
      category: 'operational',
      sections: [
        'Project Status','Resource Utilization','Equipment Usage','Time Tracking','Productivity Metrics',
      ],
      frequency: 'monthly',
      format: 'pdf',
      recipients: ['daniel@creatorhubn.com'],
      norwegianCompliance: true,
      vatIncluded: false,
      status: 'active',
    },
  ];

  // Mock generated reports
  const mockGeneratedReports: GeneratedReport[] = [
    {
      id: 'report-',
      templateId: 'monthly-financial',
      templateName: 'Månedlig Finansrapport',
      generatedAt: new Date(Date.now() - 3600000).toISOString(),
      period: 'Januar 202',
      format: 'pdf',
      fileSize: '2.4 M',
      downloadUrl: '/api/admin/reports/monthly-financial-jan-2025.pdf',
      recipients: ['daniel@creatorhubn.com'],
      status: 'ready',
      pages: 24,
    },
    {
      id: 'report-',
      templateId: 'integration-performance',
      templateName: 'Integrasjonsytelse Rapport',
      generatedAt: new Date(Date.now() - 7200000).toISOString(),
      period: 'Uke,  42025',
      format: 'pdf',
      fileSize: '1.8 M',
      downloadUrl: '/api/admin/reports/integration-performance-w4-2025.pdf',
      recipients: ['daniel@creatorhubn.com'],
      status: 'ready',
      pages: 16,
    },
    {
      id: 'report-',
      templateId: 'tax-compliance',
      templateName: 'Norsk Skattedata Rapport',
      generatedAt: new Date(Date.now() - 14400000).toISOString(),
      period: 'Q4 202',
      format: 'pdf',
      fileSize: '3.1 M',
      downloadUrl: '/api/admin/reports/tax-compliance-q4-2024.pdf',
      recipients: ['daniel@creatorhubn.com'],
      status: 'sent',
      pages: 32,
    },
  ];

  // Initialize with default data if empty
  useEffect(() => {
    if (reportTemplates.length === 0 && !loading) {
      setReportTemplates(defaultTemplates);
      setGeneratedReports(mockGeneratedReports);
    }
  }, [loading, reportTemplates.length]);

  // Category colors and icons
  const getCategoryInfo = (category: string) => {
    const categoryMap: {
      [key: string]: { color: string; icon: JSX.Element; label: string };
    } = {
      financial: { color: '#4caf50', icon: <MoneyIcon />, label: 'Finansiell' },
      operational: {
        color: '#2196f0',
        icon: <BusinessIcon />,
        label: 'Operasjonell',
      },
      compliance: {
        color: '#ff9800',
        icon: <ComplianceIcon />,
        label: 'Compliance',
      },
      analytics: {
        color: '#ce93d8',
        icon: <AnalyticsIcon />,
        label: 'Analytics',
      },
      custom: { color: '#607d80', icon: <SettingsIcon />, label: 'Tilpasset' },
    };
    return categoryMap[category] || categoryMap['custom'];
  };

  // Status colors
  const getStatusColor = (status: string) => {
    const statusMap: { [key: string]: string } = {
      ready: 'success',
      generating: 'info',
      sent: 'primary',
      failed: 'error',
      active: 'success',
      draft: 'warning',
      archived: 'default',
    };
    return statusMap[status] || 'default';
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 40}}
      >
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ ml: 2, color: theming.colors.primary }}>
          Laster rapportsystem...
        </Typography>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={nb}>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3}}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600, mb: 1, color: theming.colors.primary }}>
              📊 Automatiserte Forretningsrapporter
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Phase 14: Avansert PDF-rapportering med norske compliance-standarder
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              startIcon={<AddIcon />}
              variant="contained"
              color="primary"
            >
              Ny Rapport mal
            </Button>
            <Button
              onClick={() => setGenerateDialogOpen(true)}
              startIcon={<PdfIcon />}
              variant="outlined"
            >
              Generer Rapport
            </Button>
          </Box>
        </Box>

        {/* Status Overview Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={{ textAlign: 'center', py: 2, ...theming.getThemedCardSx() }}>
                <Typography
                  variant="h4"
                  sx={{ fontWeight: 600, color: theming.colors.primary }}
                >
                  {reportTemplates.filter((t) => t.status === 'active').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Aktive Maler
                </Typography>
                <ReportIcon sx={{ color: 'primary.main', mt: 1 }} />
              </CardContent>
            </Card>
          </Grid>

          <Grid xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={{ textAlign: 'center', py: 2, ...theming.getThemedCardSx() }}>
                <Typography
                  variant="h4"
                  sx={{ fontWeight: 600, color: theming.colors.primary }}
                >
                  {generatedReports.filter((r) => r.status === 'ready').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Klare Rapporter
                </Typography>
                <CheckIcon sx={{ color: 'success.main', mt: 1 }} />
              </CardContent>
            </Card>
          </Grid>

          <Grid xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={{ textAlign: 'center', py: 2, ...theming.getThemedCardSx() }}>
                <Typography
                  variant="h4"
                  sx={{ fontWeight: 600, color: theming.colors.primary }}
                >
                  {reportSchedules.filter((s) => s.enabled).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Planlagte Rapporter
                </Typography>
                <ScheduleIcon sx={{ color: 'info.main', mt: 1 }} />
              </CardContent>
            </Card>
          </Grid>

          <Grid xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={{ textAlign: 'center', py: 2, ...theming.getThemedCardSx() }}>
                <Typography
                  variant="h4"
                  sx={{ fontWeight: 600, color: theming.colors.primary }}
                >
                  {reportTemplates.filter((t) => t.norwegianCompliance).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Norske Compliance
                </Typography>
                <ComplianceIcon sx={{ color: 'secondary.main', mt: 1 }} />
              </CardContent>
            </Card>
          </Grid>

          {/* Split Sheet Statistics - Only for Music Producers */}
          {isMusicProducer && splitSheetStats?.data && (
            <Grid xs={12} sm={6} md={3}>
              <Card sx={{ ...theming.getThemedCardSx(), border: '1px solid', borderColor: '#9f7aea30' }}>
                <CardContent sx={{ textAlign: 'center', py: 2, ...theming.getThemedCardSx() }}>
                  <Typography
                    variant="h4"
                    sx={{ fontWeight: 600, color: '#9f7aea' }}
                  >
                    {splitSheetStats.data.total || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Split Sheets
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    {splitSheetStats.data.totalRevenue ? `${splitSheetStats.data.totalRevenue.toLocaleString('nb-NO')} kr` : '0 kr'} inntekt
                  </Typography>
                  <SplitSheetIcon sx={{ color: '#9f7aea', mt: 1 }} />
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>

        {/* Main Tabs */}
        <Card sx={theming.getThemedCardSx()}>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="📋 Rapportmaler" icon={<ReportIcon />} iconPosition="start" />
            <Tab label="📄 Genererte Rapporter" icon={<PdfIcon />} iconPosition="start" />
            <Tab label="⏰ Planlagte Rapporter" icon={<ScheduleIcon />} iconPosition="start" />
            <Tab label="🇳🇴 Compliance" icon={<ComplianceIcon />} iconPosition="start" />
            <Tab label="⚙️ Innstillinger" icon={<SettingsIcon />} iconPosition="start" />
          </Tabs>

          <CardContent sx={{ p: 0,...theming.getThemedCardSx() }}>
            {/* Tab 0: Report Templates */}
            {activeTab === 0 && (
              <Box sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 3, color: theming.colors.primary }}>
                  Tilgjengelige Rapportmaler
                </Typography>

                <Grid container spacing={3}>
                  {reportTemplates.map((template) => {
                    const categoryInfo = getCategoryInfo(template.category);

                    return (
                      <Grid xs={12} md={6} lg={4} key={template.id}>
                        <Card sx={{ height: '100%', ...theming.getThemedCardSx() }}>
                          <CardContent sx={theming.getThemedCardSx()}>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                mb: 2}}
                            >
                              <Avatar sx={{ bgcolor: categoryInfo.color, mr: 2 }}>
                                {categoryInfo.icon}
                              </Avatar>
                              <Box sx={{ flex: 1 }}>
                                <Typography
                                  variant="h6"
                                  sx={{ fontSize: '1rem', color: theming.colors.primary }}
                                >
                                  {template.name}
                                </Typography>
                                <Chip
                                  size="small"
                                  label={categoryInfo.label}
                                  sx={{
                                    bgcolor: categoryInfo.color + '2',
                                    color: categoryInfo.color}}
                                />
                              </Box>
                            </Box>

                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              {template.description}
                            </Typography>

                            <Box
                              sx={{
                                display: 'flex',
                                gap: 1,
                                mb: 2,
                                flexWrap: 'wrap'}}
                            >
                              <Chip
                                size="small"
                                label={template.frequency}
                                color="primary"
                                variant="outlined"
                              />
                              <Chip
                                size="small"
                                label={template.format.toUpperCase()}
                                color="secondary"
                                variant="outlined"
                              />
                              {template.norwegianCompliance && (
                                <Chip
                                  size="small"
                                  label="🇳🇴 Norsk"
                                  color="success"
                                  variant="outlined"
                                />
                              )}
                              {template.vatIncluded && (
                                <Chip size="small" label="MVA" color="info" variant="outlined" />
                              )}
                            </Box>

                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'}}
                            >
                              <Chip
                                size="small"
                                label={template.status}
                                color={getStatusColor(template.status) as any}
                              />
                              <Box>
                                <Tooltip title="Generer rapport (API)">
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setSelectedTemplate(template);
                                      setGenerateDialogOpen(true);
                                    }}
                                  >
                                    <PdfIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Generer PDF (Lokal)">
                                  <IconButton
                                    size="small"
                                    onClick={() => generatePDFReport(template)}
                                  >
                                    <DownloadIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Rediger mal">
                                  <IconButton size="small">
                                    <EditIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Se detaljer">
                                  <IconButton size="small">
                                    <ViewIcon />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
            )}

            {/* Tab 1: Generated Reports */}
            {activeTab === 1 && (
              <Box sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 3, color: theming.colors.primary }}>
                  Genererte Rapporter
                </Typography>

                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Rapport</TableCell>
                        <TableCell>Periode</TableCell>
                        <TableCell>Generert</TableCell>
                        <TableCell>Format</TableCell>
                        <TableCell>Størrelse</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Handlinger</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {generatedReports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <PdfIcon sx={{ mr: 1, color: 'error.main' }} />
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 500}}>
                                  {report.templateName}
                                </Typography>
                                {report.pages && (
                                  <Typography variant="caption" color="text.secondary">
                                    {report.pages} sider
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>{report.period}</TableCell>
                          <TableCell>
                            {new Date(report.generatedAt).toLocaleDateString('no-NO')}
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={report.format.toUpperCase()} />
                          </TableCell>
                          <TableCell>{report.fileSize}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={report.status}
                              color={getStatusColor(report.status) as any}
                            />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              {report.status === 'ready' && (
                                <>
                                  <Tooltip title="Last ned">
                                    <IconButton size="small" onClick={() => downloadReport(report)}>
                                      <DownloadIcon />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Send på e-post">
                                    <IconButton size="small" onClick={() => emailReport(report)}>
                                      <EmailIcon />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Lagre til Google Drive">
                                    <IconButton
                                      size="small"
                                      onClick={() => saveToGoogleDrive(report)}
                                    >
                                      <CloudIcon />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Eksporter til Google Sheets">
                                    <IconButton
                                      size="small"
                                      onClick={() => exportToGoogleSheets(report)}
                                    >
                                      <TableChartIcon />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Kopier link">
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        navigator.clipboard.writeText(report.downloadUrl);
                                        toast({
                                          title: '✅ Link Kopiert',
                                          description: 'Nedlastningslink kopiert til utklippstavle',
                                          variant: 'default',
                                        });
                                      }}
                                    >
                                      <CopyIcon />
                                    </IconButton>
                                  </Tooltip>
                                </>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* Tab 2: Scheduled Reports */}
            {activeTab === 2 && (
              <Box sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 3, color: theming.colors.primary }}>
                  Planlagte Rapporter
                </Typography>

                <Alert severity="info" sx={{ mb: 3 }}>
                  Automatisk rapportgenerering kjører hver natt kl. 02: 00. Rapporter sendes til
                  angitte mottakere.
                </Alert>

                <List>
                  {reportTemplates
                    .filter((t) => t.frequency !== 'manual')
                    .map((template) => {
                      const categoryInfo = getCategoryInfo(template.category);

                      return (
                        <ListItem
                          key={template.id}
                          sx={{
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 1,
                            mb: 2}}
                        >
                          <ListItemIcon>
                            <Avatar sx={{ bgcolor: categoryInfo.color }}>
                              {categoryInfo.icon}
                            </Avatar>
                          </ListItemIcon>
                          <ListItemText
                            primary={template.name}
                            secondary={
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  Frekvens: {template.frequency} | Neste: {', '}
                                  {template.nextScheduled || 'Beregnes...'}
                                </Typography>
                                <br />
                                <Typography variant="caption">
                                  Mottakere: {template.recipients.join(', ')}
                                </Typography>
                              </Box>
                            }
                          />
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2}}
                          >
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={template.status === 'active'}
                                  onChange={(e) => toggleSchedule(template.id, e.target.checked)}
                                />
                              }
                              label="Aktivert"
                            />
                            <Tooltip title="Rediger planlegging">
                              <IconButton onClick={() => setSelectedTemplate(template)}>
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </ListItem>
                      );
                    })}
                </List>
              </Box>
            )}

            {/* Tab 3: Norwegian Compliance */}
            {activeTab === 3 && (
              <Box sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 3, color: theming.colors.primary }}>
                  🇳🇴 Norsk Compliance og Skatterapporter
                </Typography>

                <Grid container spacing={3}>
                  {/* Tax Compliance Card */}
                  <Grid xs={12} md={6}>
                    <Card sx={theming.getThemedCardSx()}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <TaxIcon sx={{ mr: 2, color: 'warning.main' }} />
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                            Skattemyndigheter
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Rapporter tilpasset norske skatteregler og MVA-krav
                        </Typography>
                        <List dense>
                          <ListItem>
                            <ListItemText
                              primary="Kvartalsvise MVA-rapporter"
                              secondary="Automatisk beregning av merverdiavgift"
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText
                              primary="Årlig selvangivelse-data"
                              secondary="Strukturert data for skattemelding"
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText
                              primary="Fradragsberettigede utgifter"
                              secondary="Kategorisert etter skattereglene"
                            />
                          </ListItem>
                        </List>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Business Registry Card */}
                  <Grid xs={12} md={6}>
                    <Card sx={theming.getThemedCardSx()}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <BusinessIcon sx={{ mr: 2, color: 'primary.main' }} />
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                            Brønnøysundregistrene
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Compliance med norske registreringsforhold
                        </Typography>
                        <List dense>
                          <ListItem>
                            <ListItemText
                              primary="Foretaksregister-oppdateringer"
                              secondary="Endringer i bedriftsinformasjon"
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText
                              primary="MVA-registeret compliance"
                              secondary="Påkrevde rapporter til MVA-registeret"
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText
                              primary="Årsregnskap-forberedelser"
                              secondary="Data for regnskapsrapportering"
                            />
                          </ListItem>
                        </List>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* GDPR Compliance Card */}
                  <Grid xs={12} md={6}>
                    <Card sx={theming.getThemedCardSx()}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <SecurityIcon sx={{ mr: 2, color: 'error.main' }} />
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                            GDPR og Personvern
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Personvernrapporter etter norsk og EU-lovgivning
                        </Typography>
                        <List dense>
                          <ListItem>
                            <ListItemText
                              primary="Persondata-behandling"
                              secondary="Oversikt over databehandling"
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText
                              primary="Samtykke-dokumentasjon"
                              secondary="Dokumenterte samtykker fra klienter"
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText
                              primary="Datasletting-rapporter"
                              secondary="Dokumentasjon av dataslett"
                            />
                          </ListItem>
                        </List>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Creative Industry Specific */}
                  <Grid xs={12} md={6}>
                    <Card sx={theming.getThemedCardSx()}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <ContactIcon sx={{ mr: 2, color: 'success.main' }} />
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                            Kreativ Næring Spesifikt
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Spesialtilpassede rapporter for kreative yrker
                        </Typography>
                        <List dense>
                          <ListItem>
                            <ListItemText
                              primary="Opphavsrett og lisensiering"
                              secondary="Dokumentasjon av rettighetsbruk"
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText
                              primary="Kunstnerisk fradrag"
                              secondary="Kreativ næring skattefradrag"
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText
                              primary="Utstyr og avskrivninger"
                              secondary="Profesjonelt utstyr avskrivninger"
                            />
                          </ListItem>
                        </List>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* Tab 4: Settings */}
            {activeTab === 4 && (
              <Box sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 3, color: theming.colors.primary }}>
                  Rapport Innstillinger
                </Typography>

                <Grid container spacing={3}>
                  <Grid xs={12} md={6}>
                    <Card sx={theming.getThemedCardSx()}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
                          Standard Innstillinger
                        </Typography>
                        <FormGroup>
                          <FormControlLabel
                            control={<Checkbox defaultChecked />}
                            label="Automatisk PDF-generering"
                          />
                          <FormControlLabel
                            control={<Checkbox defaultChecked />}
                            label="E-post varsling ved feil"
                          />
                          <FormControlLabel
                            control={<Checkbox defaultChecked />}
                            label="Norsk MVA-beregning"
                          />
                          <FormControlLabel
                            control={<Checkbox />}
                            label="Excel-eksport tilgjengelig"
                          />
                          <FormControlLabel
                            control={<Checkbox defaultChecked />}
                            label="Lagre rapporter i 2 år"
                          />
                          <FormControlLabel
                            control={<Checkbox defaultChecked />}
                            label="GDPR-kompatibel lagring"
                          />
                        </FormGroup>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid xs={12} md={6}>
                    <Card sx={theming.getThemedCardSx()}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
                          E-post Innstillinger
                        </Typography>
                        <TextField
                          fullWidth
                          label="Standard mottaker"
                          defaultValue="daniel@creatorhubn.com"
                          margin="normal"
                        />
                        <TextField
                          fullWidth
                          label="Ekstra CC mottakere"
                          placeholder="kommaseparert liste"
                          margin="normal"
                        />
                        <TextField
                          fullWidth
                          label="E-post emne prefiks"
                          defaultValue="[CreatorHub] Rapport: "
                          margin="normal"
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Generate Report Dialog */}
        <Dialog
          open={generateDialogOpen}
          onClose={() => setGenerateDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>📊 Generer Forretningsrapport</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 3 }}>
              Velg parametere for rapportgenerering. Rapporten vil bli generert som PDF med norske
              standarder.
            </DialogContentText>

            {selectedTemplate && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 1, color: theming.colors.primary }}>
                  {selectedTemplate.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedTemplate.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                  <Chip size="small" label={getCategoryInfo(selectedTemplate.category).label} />
                  {selectedTemplate.norwegianCompliance && (
                    <Chip size="small" label="🇳🇴 Norsk Compliance" color="success" />
                  )}
                  {selectedTemplate.vatIncluded && (
                    <Chip size="small" label="MVA inkludert" color="info" />
                  )}
                </Box>
              </Box>
            )}

            <Grid container spacing={3}>
              <Grid xs={12} md={6}>
                <DatePicker
                  label="Fra dato"
                  value={selectedDateRange.start}
                  onChange={(date) => setSelectedDateRange((prev) => ({ ...prev, start: date }))}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid xs={12} md={6}>
                <DatePicker
                  label="Til dato"
                  value={selectedDateRange.end}
                  onChange={(date) => setSelectedDateRange((prev) => ({ ...prev, end: date }))}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid xs={12}>
                <TextField
                  fullWidth
                  label="Ekstra mottakere (kommaseparert)"
                  value={customRecipients.join(', ')}
                  onChange={(e) =>
                    setCustomRecipients(
                      e.target.value
                        .split(',')
                        .map((email) => email.trim())
                        .filter(Boolean),
                    )
                  }
                  helperText="La stå tom for å bruke standardmottakere"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setGenerateDialogOpen(false)}>Avbryt</Button>
            <Button
              onClick={() => selectedTemplate && generateReport(selectedTemplate)}
              variant="contained"
              startIcon={generatingReport ? <CircularProgress size={20} /> : <PdfIcon />}
              disabled={generatingReport}
            >
              {generatingReport ? 'Genererer...' : 'Generer Rapport'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Create Template Dialog */}
        <Dialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>➕ Opprett Ny Rapportmal</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 3 }}>
              Opprett en tilpasset rapportmal med egne innstillinger og seksjoner.
            </DialogContentText>

            <Grid container spacing={3}>
              <Grid xs={12} md={6}>
                <TextField fullWidth label="Mal navn" margin="normal" />
              </Grid>
              <Grid xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Kategori</InputLabel>
                  <Select>
                    <MenuItem value="financial">Finansiell</MenuItem>
                    <MenuItem value="operational">Operasjonell</MenuItem>
                    <MenuItem value="compliance">Compliance</MenuItem>
                    <MenuItem value="analytics">Analytics</MenuItem>
                    <MenuItem value="custom">Tilpasset</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid xs={12}>
                <TextField fullWidth label="Beskrivelse" multiline rows={3} margin="normal" />
              </Grid>
              <Grid xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Frekvens</InputLabel>
                  <Select>
                    <MenuItem value="daily">Daglig</MenuItem>
                    <MenuItem value="weekly">Ukentlig</MenuItem>
                    <MenuItem value="monthly">Månedlig</MenuItem>
                    <MenuItem value="quarterly">Kvartalsvis</MenuItem>
                    <MenuItem value="yearly">Årlig</MenuItem>
                    <MenuItem value="manual">Manuell</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Format</InputLabel>
                  <Select>
                    <MenuItem value="pdf">PDF</MenuItem>
                    <MenuItem value="excel">Excel</MenuItem>
                    <MenuItem value="csv">CSV</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid xs={12}>
                <FormGroup row>
                  <FormControlLabel control={<Checkbox />} label="Norsk compliance" />
                  <FormControlLabel control={<Checkbox />} label="MVA inkludert" />
                  <FormControlLabel control={<Checkbox />} label="Automatisk sending" />
                </FormGroup>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)}>Avbryt</Button>
            <Button variant="contained" startIcon={<AddIcon />}>
              Opprett Mal
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default AutomatedBusinessReports;
