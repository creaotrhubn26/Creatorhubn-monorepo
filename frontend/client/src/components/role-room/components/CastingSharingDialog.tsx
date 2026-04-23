import { useState, useEffect, Fragment, type ChangeEvent, type ReactElement } from 'react';
import { useToast } from './ToastStack';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Grow,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Share as ShareIcon,
  Movie as MovieIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  SupervisorAccount as SupervisorAccountIcon,
  Videocam as VideocamIcon,
  FactCheck as FactCheckIcon,
  Cancel as CancelIcon,
  FileDownload as FileDownloadIcon,
} from '@mui/icons-material';
import type { UserRole, UserRoleType, CastingProject } from '../models/casting';
import { sharingService } from '../services/sharingService';
import { castingAuthService } from '../services/castingAuthService';
import { castingService } from '../services/castingService';
import { Z_INDEX } from '../config/zIndex';
import { useBrandingSettings } from '../hooks/useBrandingSettings';

interface CastingSharingDialogProps {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onUpdate?: () => void;
}

export function CastingSharingDialog({ open, projectId, onClose, onUpdate }: CastingSharingDialogProps) {
  const toast = useToast();
  const branding = useBrandingSettings();
  const [sharedUsers, setSharedUsers] = useState<UserRole[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRoleType>('agency');
  
  // Load shared users when dialog opens or projectId changes
  useEffect(() => {
    const loadSharedUsers = async () => {
      if (open && projectId) {
        try {
          const users = await sharingService.getSharedUsers(projectId);
          setSharedUsers(Array.isArray(users) ? users : []);
        } catch (error) {
          console.error('Error loading shared users:', error);
          setSharedUsers([]);
        }
      }
    };
    loadSharedUsers();
  }, [open, projectId]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [emailHelperText, setEmailHelperText] = useState('');
  const [confirmRemoveUserId, setConfirmRemoveUserId] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    includeSummary: true,
    includeRoles: true,
    includeCandidates: true,
    includeSchedules: true,
    includeCrew: true,
    includeLocations: true,
    includeProps: true,
    includeSharedUsers: true,
  });
  const [exportTitle, setExportTitle] = useState('');
  const [projectName, setProjectName] = useState('');
  const [exportCounts, setExportCounts] = useState({
    roles: 0,
    candidates: 0,
    schedules: 0,
    crew: 0,
    locations: 0,
    props: 0,
  });
  
  // Load project data and counts when export dialog opens
  useEffect(() => {
    const loadExportData = async () => {
      if (exportDialogOpen && projectId) {
        try {
          const [project, roles, candidates, schedules, crew, locations, props] = await Promise.all([
            castingService.getProject(projectId),
            castingService.getRoles(projectId),
            castingService.getCandidates(projectId),
            castingService.getSchedules(projectId),
            castingService.getCrew(projectId),
            castingService.getLocations(projectId),
            castingService.getProps(projectId),
          ]);
          setProjectName(project?.name || 'Prosjekt tittel');
          setExportCounts({
            roles: roles.length,
            candidates: candidates.length,
            schedules: schedules.length,
            crew: crew.length,
            locations: locations.length,
            props: props.length,
          });
        } catch (error) {
          console.error('Error loading export data:', error);
        }
      }
    };
    loadExportData();
  }, [exportDialogOpen, projectId]);

  // MenuProps for Select components to ensure proper rendering within Dialog
  // Use container: document.body with higher z-index than Dialog (100000) to fix modal stacking issues
  const selectMenuProps = {
    container: document.body,
    sx: {
      zIndex: Z_INDEX.dialogSelect,
    },
    PaperProps: {
      sx: {
        bgcolor: '#1c2128',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        mt: 0.5,
        maxHeight: 300,
        '& .MuiMenuItem-root': {
          fontSize: '1rem',
          minHeight: 44,
          '&:hover': {
            bgcolor: 'rgba(255,255,255,0.1)',
          },
          '&.Mui-selected': {
            bgcolor: 'rgba(156,39,176,0.2)',
            '&:hover': {
              bgcolor: 'rgba(156,39,176,0.3)',
            },
          },
        },
      },
    },
  };

  const roleTypes: UserRoleType[] = [
    'director',
    'producer',
    'content_producer',
    'client_reviewer',
    'casting_director',
    'production_manager',
    'camera_team',
    'agency',
  ];

  const getRoleLabel = (role: string): string => {
    const labels: Record<string, string> = {
      director: 'Regissør',
      producer: 'Produsent',
      content_producer: 'Innholdsprodusent',
      client_reviewer: 'Klient-revisor',
      casting_director: 'Casting-ansvarlig',
      production_manager: 'Produksjonsleder',
      camera_team: 'Kamera-team',
      camera_operator: 'Kameramann',
      camera_assistant: 'Kamera-assistent',
      gaffer: 'Lysansvarlig',
      grip: 'Grip',
      sound_engineer: 'Lydtekniker',
      makeup_artist: 'Sminkør',
      wardrobe: 'Kostyme',
      other: 'Annet',
      agency: 'Byrå',
    };
    return labels[role] || role;
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewUserEmail(value);
    
    if (value.trim() === '') {
      setEmailError(false);
      setEmailHelperText('');
    } else if (!validateEmail(value)) {
      setEmailError(true);
      setEmailHelperText('Ugyldig e-post format');
    } else {
      setEmailError(false);
      setEmailHelperText('');
    }
  };

  const handleAddUser = async () => {
    if (!newUserEmail.trim()) {
      setEmailError(true);
      setEmailHelperText('E-post er påkrevd');
      return;
    }

    if (!validateEmail(newUserEmail)) {
      setEmailError(true);
      setEmailHelperText('Ugyldig e-post format');
      return;
    }

    try {
      const permissions = castingAuthService.getDefaultPermissions(newUserRole);
      await sharingService.shareProject(projectId, newUserEmail, newUserRole, permissions);
      const users = await sharingService.getSharedUsers(projectId);
      setSharedUsers(Array.isArray(users) ? users : []);
      setNewUserEmail('');
      setEmailError(false);
      setEmailHelperText('');
      setShowAddForm(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error adding user:', error);
      setEmailError(true);
      setEmailHelperText('Feil ved deling med bruker');
    }
  };

  const handleRemoveUser = (userRoleId: string) => {
    setConfirmRemoveUserId(userRoleId);
  };

  const executeRemoveUser = async () => {
    if (!confirmRemoveUserId) return;
    const userRoleId = confirmRemoveUserId;
    setConfirmRemoveUserId(null);
    try {
      await sharingService.removeUser(projectId, userRoleId);
      const users = await sharingService.getSharedUsers(projectId);
      setSharedUsers(Array.isArray(users) ? users : []);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error removing user:', error);
      toast.showError(branding.tokens.labels.removeUserErrorLabel || 'Feil ved fjerning av bruker');
    }
  };

  const handleExport = async () => {
    // Reset export title to project name when opening dialog
    try {
      const project = await castingService.getProject(projectId);
      setExportTitle(project?.name || '');
      setExportDialogOpen(true);
    } catch (error) {
      console.error('Error loading project:', error);
      setExportTitle('');
      setExportDialogOpen(true);
    }
  };

  const handleConfirmExport = async () => {
    try {
      const project = await castingService.getProject(projectId);
      if (!project) {
        toast.showError('Prosjekt ikke funnet');
        return;
      }

      // Get all related data
      const roles = await castingService.getRoles(projectId);
      const candidates = await castingService.getCandidates(projectId);
      const schedules = await castingService.getSchedules(projectId);
      const crew = await castingService.getCrew(projectId);
      const locations = await castingService.getLocations(projectId);
      const props = await castingService.getProps(projectId);

      // Generate HTML content for PDF
      const htmlContent = generatePDFHTML(project, roles, candidates, schedules, crew, locations, props, sharedUsers, exportOptions, exportTitle.trim() || undefined);

      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.showError('Kunne ikke åpne print-vindu. Vennligst tillat popups.');
        return;
      }

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Wait for content to load, then trigger print (which allows saving as PDF)
      setTimeout(() => {
        printWindow.print();
      }, 250);

      setExportDialogOpen(false);
    } catch (error) {
      console.error('Error exporting project:', error);
      toast.showError('Kunne ikke eksportere prosjekt');
    }
  };

  const handleToggleExportOption = (option: keyof typeof exportOptions) => {
    setExportOptions(prev => ({
      ...prev,
      [option]: !prev[option],
    }));
  };

  const handleSelectAllExportOptions = () => {
    setExportOptions({
      includeSummary: true,
      includeRoles: true,
      includeCandidates: true,
      includeSchedules: true,
      includeCrew: true,
      includeLocations: true,
      includeProps: true,
      includeSharedUsers: true,
    });
  };

  const handleDeselectAllExportOptions = () => {
    setExportOptions({
      includeSummary: false,
      includeRoles: false,
      includeCandidates: false,
      includeSchedules: false,
      includeCrew: false,
      includeLocations: false,
      includeProps: false,
      includeSharedUsers: false,
    });
  };

  const getStatusLabel = (status: string, type: 'role' | 'candidate' | 'schedule'): string => {
    const labels: Record<string, Record<string, string>> = {
      role: {
        draft: 'Utkast',
        open: 'Åpen',
        casting: 'Casting',
        filled: 'Fylt',
        cancelled: 'Avlyst',
      },
      candidate: {
        pending: 'Venter',
        requested: 'Forespurt',
        shortlist: 'Shortlist',
        selected: 'Valgt',
        confirmed: 'Bekreftet',
        rejected: 'Avvist',
      },
      schedule: {
        scheduled: 'Planlagt',
        completed: 'Fullført',
        cancelled: 'Avlyst',
      },
    };
    return labels[type]?.[status] || status;
  };

  const generatePDFHTML = (
    project: CastingProject,
    roles: any[],
    candidates: any[],
    schedules: any[],
    crew: any[],
    locations: any[],
    props: any[],
    sharedUsers: UserRole[],
    options: typeof exportOptions,
    customTitle?: string
  ): string => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Calculate summary statistics
    const totalRoles = roles.length;
    const openRoles = roles.filter(r => r.status === 'open' || r.status === 'casting').length;
    const filledRoles = roles.filter(r => r.status === 'filled').length;
    const totalCandidates = candidates.length;
    const confirmedCandidates = candidates.filter(c => c.status === 'confirmed').length;
    const totalSchedules = schedules.length;
    const completedSchedules = schedules.filter(s => s.status === 'completed').length;
    
    // Calculate percentages
    const rolesFilledPercent = totalRoles > 0 ? Math.round((filledRoles / totalRoles) * 100) : 0;
    const candidatesConfirmedPercent = totalCandidates > 0 ? Math.round((confirmedCandidates / totalCandidates) * 100) : 0;
    const schedulesCompletedPercent = totalSchedules > 0 ? Math.round((completedSchedules / totalSchedules) * 100) : 0;

    // SVG Icon helpers
    const getIconSVG = (iconName: string, size: number = 24, color: string = '#00d4ff'): string => {
      const icons: Record<string, string> = {
        // Assignment/Clipboard icon for Roles
        assignment: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>`,
        // Person icon for Candidates
        person: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>`,
        // Calendar icon for Schedule
        calendar: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>`,
        // Users/Group icon for Crew
        users: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>`,
        // MapPin icon for Locations
        location: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>`,
        // Package icon for Props
        package: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>`,
        // Share icon for Shared Users
        share: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="18" cy="5" r="3"/>
          <circle cx="6" cy="12" r="3"/>
          <circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>`,
      };
      return icons[iconName] || '';
    };

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${customTitle || project.name} - Casting Prosjekt</title>
  <style>
    @page {
      margin: 0;
      counter-increment: page;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #1a1a1a;
      line-height: 1.7;
      padding: 0;
      background: #fff;
      font-size: 14px;
    }
    .page {
      padding: 50px 60px 80px 60px;
      max-width: 210mm;
      margin: 0 auto;
      min-height: 297mm;
      position: relative;
    }
    .header {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-bottom: 5px solid #00d4ff;
      padding: 30px 35px;
      margin: -50px -60px 40px -60px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .title {
      font-size: 36px;
      font-weight: 800;
      color: #00d4ff;
      margin-bottom: 10px;
      letter-spacing: -1px;
      line-height: 1.2;
    }
    .subtitle {
      color: #64748b;
      font-size: 15px;
      font-weight: 500;
      margin-top: 5px;
    }
    .summary {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-left: 6px solid #00d4ff;
      padding: 30px;
      margin-bottom: 45px;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    .summary-title {
      font-size: 20px;
      font-weight: 700;
      color: #00d4ff;
      margin-bottom: 25px;
      letter-spacing: -0.3px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 25px;
    }
    .summary-item {
      background: white;
      padding: 25px 20px;
      border-radius: 10px;
      text-align: center;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      border: 1px solid #e2e8f0;
      transition: transform 0.2s ease;
    }
    .summary-item-icon {
      display: flex;
      justify-content: center;
      margin-bottom: 12px;
    }
    .summary-item-icon svg {
      opacity: 0.9;
    }
    .summary-number {
      font-size: 36px;
      font-weight: 800;
      color: #00d4ff;
      display: block;
      margin-bottom: 8px;
      line-height: 1;
    }
    .summary-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      font-weight: 600;
      margin-bottom: 12px;
      display: block;
    }
    .progress-bar {
      width: 100%;
      height: 6px;
      background: #e2e8f0;
      border-radius: 10px;
      margin-top: 10px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #00d4ff 0%, #00b8e6 100%);
      border-radius: 10px;
      transition: width 0.3s ease;
    }
    .section {
      margin-bottom: 50px;
      page-break-inside: avoid;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 22px;
      padding-bottom: 15px;
      border-bottom: 3px solid #e2e8f0;
    }
    .section-title {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 12px;
      letter-spacing: -0.4px;
    }
    .section-icon {
      display: inline-flex;
      align-items: center;
    }
    .section-icon svg {
      flex-shrink: 0;
    }
    .section-count {
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      background: #f1f5f9;
      padding: 6px 14px;
      border-radius: 20px;
      border: 1px solid #e2e8f0;
    }
    .section-content {
      background: #fafbfc;
      padding: 0;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: linear-gradient(135deg, #00d4ff 0%, #00b8e6 100%);
      color: white;
      font-weight: 700;
      padding: 18px 20px;
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      border: none;
    }
    th:first-child {
      border-top-left-radius: 10px;
    }
    th:last-child {
      border-top-right-radius: 10px;
    }
    td {
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
      font-size: 14px;
      font-weight: 400;
    }
    tr:last-child td {
      border-bottom: none;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    tr:hover {
      background-color: #f1f7ff;
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-draft { background: #94a3b8; color: white; }
    .badge-open { background: #00d4ff; color: white; }
    .badge-casting { background: #3b82f6; color: white; }
    .badge-filled { background: #10b981; color: white; }
    .badge-cancelled { background: #ef4444; color: white; }
    .badge-pending { background: #f59e0b; color: white; }
    .badge-requested { background: #00d4ff; color: white; }
    .badge-shortlist { background: #8b5cf6; color: white; }
    .badge-selected { background: #10b981; color: white; }
    .badge-confirmed { background: #10b981; color: white; }
    .badge-rejected { background: #ef4444; color: white; }
    .badge-scheduled { background: #00d4ff; color: white; }
    .badge-completed { background: #10b981; color: white; }
    .empty-state {
      padding: 50px;
      text-align: center;
      color: #94a3b8;
      font-style: italic;
      font-size: 15px;
    }
    .description {
      background: #f8fafc;
      padding: 25px 30px;
      border-radius: 10px;
      border-left: 5px solid #00d4ff;
      color: #475569;
      line-height: 1.9;
      margin-bottom: 40px;
      font-size: 15px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    }
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 15px 60px;
      border-top: 2px solid #e2e8f0;
      background: #fafbfc;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }
    .footer-left {
      display: flex;
      gap: 20px;
    }
    .footer-right {
      display: flex;
      gap: 20px;
    }
    .page-number {
      font-weight: 600;
    }
    .page-number::after {
      content: counter(page);
    }
    @media print {
      .page {
        padding: 30px 40px 70px 40px;
      }
      .section {
        page-break-inside: avoid;
        margin-bottom: 35px;
      }
      .summary {
        page-break-inside: avoid;
      }
      .footer {
        padding: 12px 40px;
      }
      .header {
        margin: -30px -40px 35px -40px;
        padding: 25px 30px;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="title">${customTitle || project.name}</div>
      <div class="subtitle">Eksportert: ${dateStr}</div>
    </div>

    ${project.description ? `<div class="description">${project.description}</div>` : ''}

    <div class="summary">
      <div class="summary-title">Prosjekt Oversikt</div>
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-item-icon">${getIconSVG('assignment', 32)}</div>
          <span class="summary-number">${totalRoles}</span>
          <span class="summary-label">Roller totalt</span>
          ${totalRoles > 0 ? `<div class="progress-bar"><div class="progress-fill" style="width: ${rolesFilledPercent}%"></div></div>` : ''}
        </div>
        <div class="summary-item">
          <div class="summary-item-icon">${getIconSVG('assignment', 32)}</div>
          <span class="summary-number">${openRoles}</span>
          <span class="summary-label">Åpne roller</span>
        </div>
        <div class="summary-item">
          <div class="summary-item-icon">${getIconSVG('assignment', 32)}</div>
          <span class="summary-number">${filledRoles}</span>
          <span class="summary-label">Fylte roller</span>
        </div>
        <div class="summary-item">
          <div class="summary-item-icon">${getIconSVG('person', 32)}</div>
          <span class="summary-number">${totalCandidates}</span>
          <span class="summary-label">Kandidater</span>
          ${totalCandidates > 0 ? `<div class="progress-bar"><div class="progress-fill" style="width: ${candidatesConfirmedPercent}%"></div></div>` : ''}
        </div>
        <div class="summary-item">
          <div class="summary-item-icon">${getIconSVG('person', 32)}</div>
          <span class="summary-number">${confirmedCandidates}</span>
          <span class="summary-label">Bekreftet</span>
        </div>
        <div class="summary-item">
          <div class="summary-item-icon">${getIconSVG('calendar', 32)}</div>
          <span class="summary-number">${totalSchedules}</span>
          <span class="summary-label">Planlagte møter</span>
          ${totalSchedules > 0 ? `<div class="progress-bar"><div class="progress-fill" style="width: ${schedulesCompletedPercent}%"></div></div>` : ''}
        </div>
      </div>
    </div>

    ${options.includeRoles ? `
    <div class="section">
      <div class="section-header">
        <div class="section-title">
          <span class="section-icon">${getIconSVG('assignment', 24)}</span>
          Roller
        </div>
        <div class="section-count">${roles.length}</div>
      </div>
      ${roles.length > 0 ? `
        <div class="section-content">
          <table>
            <thead>
              <tr>
                <th>Navn</th>
                <th>Status</th>
                <th>Beskrivelse</th>
              </tr>
            </thead>
            <tbody>
              ${roles.map(role => {
                const statusClass = `badge-${role.status || 'draft'}`;
                return `
                <tr>
                  <td><strong>${role.name || 'N/A'}</strong></td>
                  <td><span class="badge ${statusClass}">${getStatusLabel(role.status, 'role')}</span></td>
                  <td>${(role.description || '').substring(0, 80)}${role.description && role.description.length > 80 ? '...' : ''}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="section-content"><div class="empty-state">Ingen roller registrert</div></div>'}
    </div>
    ` : ''}

    ${options.includeCandidates ? `
    <div class="section">
      <div class="section-header">
        <div class="section-title">
          <span class="section-icon">${getIconSVG('person', 24)}</span>
          Kandidater
        </div>
        <div class="section-count">${candidates.length}</div>
      </div>
      ${candidates.length > 0 ? `
        <div class="section-content">
          <table>
            <thead>
              <tr>
                <th>Navn</th>
                <th>E-post</th>
                <th>Telefon</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${candidates.map(candidate => {
                const statusClass = `badge-${candidate.status || 'pending'}`;
                return `
                <tr>
                  <td><strong>${candidate.name || 'N/A'}</strong></td>
                  <td>${candidate.contactInfo?.email || '—'}</td>
                  <td>${candidate.contactInfo?.phone || '—'}</td>
                  <td><span class="badge ${statusClass}">${getStatusLabel(candidate.status, 'candidate')}</span></td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="section-content"><div class="empty-state">Ingen kandidater registrert</div></div>'}
    </div>
    ` : ''}

    ${options.includeSchedules ? `
    <div class="section">
      <div class="section-header">
        <div class="section-title">
          <span class="section-icon">${getIconSVG('calendar', 24)}</span>
          Timeplan
        </div>
        <div class="section-count">${schedules.length}</div>
      </div>
      ${schedules.length > 0 ? `
        <div class="section-content">
          <table>
            <thead>
              <tr>
                <th>Dato</th>
                <th>Tid</th>
                <th>Lokasjon</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${schedules.map(schedule => {
                const statusClass = `badge-${schedule.status || 'scheduled'}`;
                return `
                <tr>
                  <td><strong>${schedule.date || '—'}</strong></td>
                  <td>${schedule.time || '—'}</td>
                  <td>${schedule.location || '—'}</td>
                  <td><span class="badge ${statusClass}">${getStatusLabel(schedule.status, 'schedule')}</span></td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="section-content"><div class="empty-state">Ingen timeplaner registrert</div></div>'}
    </div>
    ` : ''}

    ${options.includeCrew ? `
    <div class="section">
      <div class="section-header">
        <div class="section-title">
          <span class="section-icon">${getIconSVG('users', 24)}</span>
          Crew
        </div>
        <div class="section-count">${crew.length}</div>
      </div>
      ${crew.length > 0 ? `
        <div class="section-content">
          <table>
            <thead>
              <tr>
                <th>Navn</th>
                <th>Rolle</th>
                <th>E-post</th>
                <th>Telefon</th>
              </tr>
            </thead>
            <tbody>
              ${crew.map(member => `
                <tr>
                  <td><strong>${member.name || 'N/A'}</strong></td>
                  <td>${getRoleLabel(member.role)}</td>
                  <td>${member.contactInfo?.email || '—'}</td>
                  <td>${member.contactInfo?.phone || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="section-content"><div class="empty-state">Ingen crew-medlemmer registrert</div></div>'}
    </div>
    ` : ''}

    ${options.includeLocations && locations.length > 0 ? `
      <div class="section">
        <div class="section-header">
          <div class="section-title">
            <span class="section-icon">${getIconSVG('location', 24)}</span>
            Lokasjoner
          </div>
          <div class="section-count">${locations.length}</div>
        </div>
        <div class="section-content">
          <table>
            <thead>
              <tr>
                <th>Navn</th>
                <th>Adresse</th>
              </tr>
            </thead>
            <tbody>
              ${locations.map(location => `
                <tr>
                  <td><strong>${location.name || 'N/A'}</strong></td>
                  <td>${location.address || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}

    ${options.includeProps && props.length > 0 ? `
      <div class="section">
        <div class="section-header">
          <div class="section-title">
            <span class="section-icon">${getIconSVG('package', 24)}</span>
            Rekvisitter
          </div>
          <div class="section-count">${props.length}</div>
        </div>
        <div class="section-content">
          <table>
            <thead>
              <tr>
                <th>Navn</th>
                <th>Beskrivelse</th>
              </tr>
            </thead>
            <tbody>
              ${props.map(prop => `
                <tr>
                  <td><strong>${prop.name || 'N/A'}</strong></td>
                  <td>${(prop.description || '').substring(0, 100)}${prop.description && prop.description.length > 100 ? '...' : ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}

    ${options.includeSharedUsers && sharedUsers.length > 0 ? `
      <div class="section">
        <div class="section-header">
          <div class="section-title">
            <span class="section-icon">${getIconSVG('share', 24)}</span>
            Delte brukere
          </div>
          <div class="section-count">${sharedUsers.length}</div>
        </div>
        <div class="section-content">
          <table>
            <thead>
              <tr>
                <th>Bruker</th>
                <th>Rolle</th>
              </tr>
            </thead>
            <tbody>
              ${sharedUsers.map(user => `
                <tr>
                  <td><strong>${user.userId || 'N/A'}</strong></td>
                  <td>${getRoleLabel(user.role)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  </div>
  
  <div class="footer">
    <div class="footer-left">
      <span>${customTitle || project.name}</span>
      <span>|</span>
      <span>ID: ${project.id.substring(0, 8)}</span>
    </div>
    <div class="footer-right">
      <span class="page-number">Side </span>
      <span>|</span>
      <span>${dateStr}</span>
    </div>
  </div>
</body>
</html>
    `;
  };

  return (
    <>
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      container={() => document.body}
      TransitionComponent={Grow}
      TransitionProps={{
        timeout: { enter: 225, exit: 150 },
        enter: true,
        exit: true,
      }}
      PaperProps={{
        sx: {
          bgcolor: '#1c2128',
          color: '#fff',
          width: '100%',
          maxWidth: '90vw',
          zIndex: Z_INDEX.dialog,
          willChange: 'transform, opacity',
          transformOrigin: 'center center',
        },
      }}
      sx={{
        zIndex: Z_INDEX.dialog,
        '& .MuiBackdrop-root': {
          zIndex: Z_INDEX.backdrop,
          bgcolor: 'rgba(0,0,0,0.8)',
          willChange: 'opacity',
        },
      }}
    >
      <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ShareIcon sx={{ fontSize: '1.5rem', color: '#00d4ff' }} />
            <Typography variant="h6">Del prosjekt</Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="Lukk" sx={{ color: 'rgba(255,255,255,0.87)' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 3, overflow: 'visible' }}>
        <Stack spacing={3}>
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600 }}>
                Delte brukere ({sharedUsers.length})
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setShowAddForm(true)}
                sx={{
                  borderColor: '#00d4ff',
                  color: '#00d4ff',
                  '&:hover': { borderColor: '#00b8e6', bgcolor: 'rgba(0,212,255,0.1)' },
                }}
              >
                Legg til bruker
              </Button>
            </Box>

            {showAddForm && (
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 2,
                  mb: 2,
                }}
              >
                <Stack spacing={2}>
                  <TextField
                    label="E-post"
                    fullWidth
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={newUserEmail}
                    onChange={handleEmailChange}
                    placeholder="bruker@example.com"
                    error={emailError}
                    helperText={emailHelperText}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: '#fff',
                        '& fieldset': { borderColor: emailError ? '#f44336' : 'rgba(255,255,255,0.3)' },
                        '&:hover fieldset': { borderColor: emailError ? '#f44336' : 'rgba(255,255,255,0.5)' },
                        '&.Mui-focused fieldset': { borderColor: emailError ? '#f44336' : '#00d4ff' },
                      },
                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                      '& .MuiFormHelperText-root': {
                        color: emailError ? '#f44336' : 'rgba(255,255,255,0.5)',
                      },
                    }}
                  />
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Rolle</InputLabel>
                    <Select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as UserRoleType)}
                      label="Rolle"
                      MenuProps={selectMenuProps}
                      sx={{
                        color: '#fff',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                      }}
                    >
                      {roleTypes.map((role) => {
                        const getRoleIcon = (r: UserRoleType) => {
                          const icons: Record<UserRoleType, ReactElement> = {
                            director: <MovieIcon sx={{ fontSize: '1rem' }} />,
                            producer: <BusinessIcon sx={{ fontSize: '1rem' }} />,
                            content_producer: <VideocamIcon sx={{ fontSize: '1rem' }} />,
                            client_reviewer: <FactCheckIcon sx={{ fontSize: '1rem' }} />,
                            casting_director: <PeopleIcon sx={{ fontSize: '1rem' }} />,
                            production_manager: <SupervisorAccountIcon sx={{ fontSize: '1rem' }} />,
                            camera_team: <VideocamIcon sx={{ fontSize: '1rem' }} />,
                            agency: <BusinessIcon sx={{ fontSize: '1rem' }} />,
                            writer: <PersonIcon sx={{ fontSize: '1rem' }} />,
                            script_editor: <PersonIcon sx={{ fontSize: '1rem' }} />,
                            reader: <PersonIcon sx={{ fontSize: '1rem' }} />,
                          };
                          return icons[r] || <PersonIcon sx={{ fontSize: '1rem' }} />;
                        };
                        return (
                          <MenuItem key={role} value={role}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {getRoleIcon(role)}
                              <span>{getRoleLabel(role)}</span>
                            </Box>
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      onClick={handleAddUser}
                      startIcon={<AddIcon />}
                      sx={{
                        bgcolor: '#00d4ff',
                        color: '#000',
                        fontWeight: 600,
                        '&:hover': { bgcolor: '#00b8e6' },
                      }}
                    >
                      Legg til
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setShowAddForm(false);
                        setNewUserEmail('');
                        setEmailError(false);
                        setEmailHelperText('');
                      }}
                      startIcon={<CancelIcon />}
                      sx={{
                        borderColor: 'rgba(255,255,255,0.3)',
                        color: 'rgba(255,255,255,0.87)',
                      }}
                    >
                      Avbryt
                    </Button>
                  </Box>
                </Stack>
              </Box>
            )}

            {sharedUsers.length === 0 ? (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 4,
                  color: 'rgba(255,255,255,0.87)',
                }}
              >
                <PersonIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                <Typography variant="body2">Ingen delte brukere ennå</Typography>
              </Box>
            ) : (
              <List sx={{ bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>
                {sharedUsers.map((userRole, index) => (
                  <Fragment key={userRole.id}>
                    <ListItem>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                        <EmailIcon sx={{ color: 'rgba(255,255,255,0.87)' }} />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body1" sx={{ color: '#fff' }}>
                            {userRole.userId}
                          </Typography>
                          <Chip
                            label={getRoleLabel(userRole.role)}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(0,212,255,0.2)',
                              color: '#00d4ff',
                              fontWeight: 600,
                              mt: 0.5,
                            }}
                          />
                        </Box>
                      </Box>
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          aria-label="Remove user"
                          onClick={() => handleRemoveUser(userRole.id)}
                          sx={{ color: '#ff4444' }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < sharedUsers.length - 1 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />}
                  </Fragment>
                ))}
              </List>
            )}
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

          <Box>
            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600, mb: 2 }}>
              Eksport
            </Typography>
            <Button
              variant="outlined"
              onClick={handleExport}
              startIcon={<FileDownloadIcon />}
              sx={{
                borderColor: '#00d4ff',
                color: '#00d4ff',
                '&:hover': { borderColor: '#00b8e6', bgcolor: 'rgba(0,212,255,0.1)' },
              }}
            >
              Eksporter prosjekt (PDF)
            </Button>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2 }}>
        <Button onClick={onClose} startIcon={<CloseIcon />} sx={{ color: 'rgba(255,255,255,0.87)' }}>
          Lukk
        </Button>
      </DialogActions>

      {/* Export Options Dialog */}
      {exportDialogOpen && (
          <Dialog
            open={exportDialogOpen}
            onClose={() => setExportDialogOpen(false)}
            maxWidth="sm"
            fullWidth
            container={() => document.body}
            TransitionComponent={Grow}
            TransitionProps={{
              timeout: { enter: 225, exit: 150 },
              enter: true,
              exit: true,
            }}
            PaperProps={{
              sx: {
                bgcolor: '#1c2128',
                color: '#fff',
                zIndex: Z_INDEX.dialog + 1,
                willChange: 'transform, opacity',
                transformOrigin: 'center center',
              },
            }}
            sx={{
              zIndex: Z_INDEX.dialog + 1,
              '& .MuiBackdrop-root': {
                zIndex: Z_INDEX.dialog,
                bgcolor: 'rgba(0,0,0,0.8)',
                willChange: 'opacity',
              },
            }}
          >
            <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <FileDownloadIcon sx={{ fontSize: '1.5rem', color: '#00d4ff' }} />
                <Typography variant="h6">Velg elementer for eksport</Typography>
              </Box>
            </DialogTitle>
            <DialogContent sx={{ pt: 3, overflow: 'visible' }}>
              <Stack spacing={3}>
                <TextField
                  label="Tittel (valgfri)"
                  placeholder={projectName || 'Prosjekt tittel'}
                  value={exportTitle}
                  onChange={(e) => setExportTitle(e.target.value)}
                  fullWidth
                  sx={{
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255,255,255,0.87)',
                    },
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      '& fieldset': {
                        borderColor: 'rgba(255,255,255,0.2)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255,255,255,0.3)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#00d4ff',
                      },
                    },
                  }}
                />
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <Button
                    size="small"
                    onClick={handleSelectAllExportOptions}
                    sx={{
                      color: '#00d4ff',
                      borderColor: '#00d4ff',
                      '&:hover': { borderColor: '#00b8e6', bgcolor: 'rgba(0,212,255,0.1)' },
                    }}
                    variant="outlined"
                  >
                    Velg alle
                  </Button>
                  <Button
                    size="small"
                    onClick={handleDeselectAllExportOptions}
                    sx={{
                      color: 'rgba(255,255,255,0.87)',
                      borderColor: 'rgba(255,255,255,0.3)',
                      '&:hover': { borderColor: 'rgba(255,255,255,0.5)', bgcolor: 'rgba(255,255,255,0.05)' },
                    }}
                    variant="outlined"
                  >
                    Fjern alle
                  </Button>
                </Box>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={exportOptions.includeSummary}
                        onChange={() => handleToggleExportOption('includeSummary')}
                        sx={{
                          color: '#00d4ff',
                          '&.Mui-checked': { color: '#00d4ff' },
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ color: '#fff' }}>Prosjekt Oversikt</Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={exportOptions.includeRoles}
                        onChange={() => handleToggleExportOption('includeRoles')}
                        sx={{
                          color: '#00d4ff',
                          '&.Mui-checked': { color: '#00d4ff' },
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ color: '#fff' }}>Roller ({exportCounts.roles})</Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={exportOptions.includeCandidates}
                        onChange={() => handleToggleExportOption('includeCandidates')}
                        sx={{
                          color: '#00d4ff',
                          '&.Mui-checked': { color: '#00d4ff' },
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ color: '#fff' }}>Kandidater ({exportCounts.candidates})</Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={exportOptions.includeSchedules}
                        onChange={() => handleToggleExportOption('includeSchedules')}
                        sx={{
                          color: '#00d4ff',
                          '&.Mui-checked': { color: '#00d4ff' },
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ color: '#fff' }}>Timeplan ({exportCounts.schedules})</Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={exportOptions.includeCrew}
                        onChange={() => handleToggleExportOption('includeCrew')}
                        sx={{
                          color: '#00d4ff',
                          '&.Mui-checked': { color: '#00d4ff' },
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ color: '#fff' }}>Crew ({exportCounts.crew})</Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={exportOptions.includeLocations}
                        onChange={() => handleToggleExportOption('includeLocations')}
                        sx={{
                          color: '#00d4ff',
                          '&.Mui-checked': { color: '#00d4ff' },
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ color: '#fff' }}>Lokasjoner ({exportCounts.locations})</Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={exportOptions.includeProps}
                        onChange={() => handleToggleExportOption('includeProps')}
                        sx={{
                          color: '#00d4ff',
                          '&.Mui-checked': { color: '#00d4ff' },
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ color: '#fff' }}>Rekvisitter ({exportCounts.props})</Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={exportOptions.includeSharedUsers}
                        onChange={() => handleToggleExportOption('includeSharedUsers')}
                        sx={{
                          color: '#00d4ff',
                          '&.Mui-checked': { color: '#00d4ff' },
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ color: '#fff' }}>Delte brukere ({sharedUsers.length})</Typography>
                      </Box>
                    }
                  />
                </FormGroup>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2 }}>
              <Button
                onClick={() => setExportDialogOpen(false)}
                startIcon={<CancelIcon />}
                sx={{ color: 'rgba(255,255,255,0.87)' }}
              >
                Avbryt
              </Button>
              <Button
                onClick={handleConfirmExport}
                variant="contained"
                startIcon={<FileDownloadIcon />}
                disabled={Object.values(exportOptions).every(v => !v)}
                sx={{
                  bgcolor: '#00d4ff',
                  color: '#000',
                  fontWeight: 600,
                  '&:hover': { bgcolor: '#00b8e6' },
                  '&.Mui-disabled': {
                    bgcolor: 'rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.87)',
                  },
                }}
              >
                Eksporter
              </Button>
            </DialogActions>
          </Dialog>
      )}
    </Dialog>

      {/* Remove User Confirmation Dialog */}
      <Dialog
        open={!!confirmRemoveUserId}
        onClose={() => setConfirmRemoveUserId(null)}
        maxWidth="sm"
        PaperProps={{
          sx: {
            bgcolor: '#1c2128',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 3,
          },
        }}
        sx={{ zIndex: Z_INDEX.dialog + 1 }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 40, height: 40, borderRadius: '50%',
            bgcolor: 'rgba(255,68,68,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <DeleteIcon sx={{ fontSize: 24, color: '#ff4444' }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {branding.tokens.labels.removeUserLabel || 'Fjern bruker'}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255,255,255,0.85)' }}>
            {branding.tokens.labels.confirmRemoveUserLabel || 'Er du sikker på at du vil fjerne denne brukeren?'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setConfirmRemoveUserId(null)} variant="outlined"
            sx={{ color: 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.2)', textTransform: 'none' }}>
            {branding.tokens.labels.cancelLabel || 'Avbryt'}
          </Button>
          <Button onClick={executeRemoveUser} variant="contained" startIcon={<DeleteIcon />}
            sx={{ bgcolor: '#ff4444', color: '#fff', textTransform: 'none', fontWeight: 600, '&:hover': { bgcolor: '#ff3333' } }}>
            {branding.tokens.labels.removeUserLabel || 'Fjern'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
