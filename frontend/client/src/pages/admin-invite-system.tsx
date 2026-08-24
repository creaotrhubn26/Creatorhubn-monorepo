import React, { useState } from 'react';
import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
  Chip,
  Box,
  Alert,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Tabs,
  Tab,
  Badge,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Visibility as ViewIcon,
  Flag as FlagIcon,
  Science as ScienceIcon,
  People as PeopleIcon,
  Email as EmailIcon,
  Payment as PaymentIcon,
} from '@mui/icons-material';
import PaymentMethodLogo from '../components/common/PaymentMethodLogo';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../utils/theming-helper';
import { useExternalData } from '../services/ExternalDataService';
import { useLocation } from 'wouter';
import { AdminCard } from '../components/admin/design-system/AdminCard';
import { AdminTableContainer } from '../components/admin/design-system/AdminTableContainer';
import { StatusChip } from '../components/admin/design-system/StatusChip';
import { adminTokens } from '../components/admin/design-system/adminTokens';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface InviteRequest {
  id: string;
  profession: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  business?: string;
  organizationNumber?: string;
  businessAddress?: string;
  website?: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestDate: string;
  processedDate?: string;
  processedBy?: string;
  selectedPlan?: string;
  planName?: string;
  planPrice?: number;
  paymentCompleted?: boolean;
  paymentTransactionId?: string;
  paymentAmount?: number;
  paymentTimestamp?: string;
  userJourneyStatus?: string | null;
  source?: string;
  proffAnalysisStatus?: 'completed' | 'failed' | null;
  proffRecommendation?: 'approve' | 'review' | 'reject' | null;
  proffRiskLevel?: 'low' | 'medium' | 'high' | 'critical' | null;
  proffRiskScore?: number | null;
  proffSummary?: string | null;
  proffLastScreenedAt?: string | null;
  proffScreeningSource?: string | null;
  proffBrregVerified?: boolean;
}

interface RoleRoomEducationInquiryMessage {
  kind: 'role_room_education_inquiry';
  version: 1;
  companyName: string;
  organizationNumber: string;
  contactName: string;
  contactEmail: string;
  contactRole: string;
  institutionType: string;
  institutionTypeLabel: string;
  programName: string;
  studentSeatRange: string;
  studentSeatLabel: string;
  staffSeatRange: string;
  staffSeatLabel: string;
  desiredStartWindow: string;
  desiredStartWindowLabel: string;
  useCase: string;
  taxMode: 'ex_vat';
}

interface PrototypeTesterRequest {
  id: number;
  name: string;
  email: string;
  company?: string;
  profession: string;
  testingAreas: string[];
  experience: string;
  feedback: string;
  availableTime: string;
  deviceInfo?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestDate: string;
  processedDate?: string;
  processedBy?: string;
}

function parseRoleRoomEducationInquiryMessage(raw?: string | null): RoleRoomEducationInquiryMessage | null {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<RoleRoomEducationInquiryMessage>;
    if (parsed.kind !== 'role_room_education_inquiry') {
      return null;
    }

    return {
      kind: 'role_room_education_inquiry',
      version: 1,
      companyName: String(parsed.companyName || ''),
      organizationNumber: String(parsed.organizationNumber || ''),
      contactName: String(parsed.contactName || ''),
      contactEmail: String(parsed.contactEmail || ''),
      contactRole: String(parsed.contactRole || ''),
      institutionType: String(parsed.institutionType || ''),
      institutionTypeLabel: String(parsed.institutionTypeLabel || ''),
      programName: String(parsed.programName || ''),
      studentSeatRange: String(parsed.studentSeatRange || ''),
      studentSeatLabel: String(parsed.studentSeatLabel || ''),
      staffSeatRange: String(parsed.staffSeatRange || ''),
      staffSeatLabel: String(parsed.staffSeatLabel || ''),
      desiredStartWindow: String(parsed.desiredStartWindow || ''),
      desiredStartWindowLabel: String(parsed.desiredStartWindowLabel || ''),
      useCase: String(parsed.useCase || ''),
      taxMode: 'ex_vat',
    };
  } catch {
    return null;
  }
}

const SOURCE_TONE: Record<string, { tone: 'brand' | 'info' | 'warning' | 'neutral'; label: string }> = {
  creatorhub: { tone: 'brand', label: 'Creatorhub' },
  evendi: { tone: 'info', label: 'Evendi' },
  role_room: { tone: 'warning', label: 'The Role Room' },
  role_room_education: { tone: 'warning', label: 'The Role Room' },
};

export default function AdminInviteSystem() {
  const [, setLocation] = useLocation();
  const [selectedRequest, setSelectedRequest] = useState<InviteRequest | null>(null);
  const [selectedPrototypeRequest, setSelectedPrototypeRequest] =
    useState<PrototypeTesterRequest | null>(null);
  const [proffAnalysisOpen, setProffAnalysisOpen] = useState(false);
  const [selectedOrgNumber, setSelectedOrgNumber] = useState<string>('');
  const [activeTab, setActiveTab] = useState(0);
  const queryClient = useQueryClient();

  const [businessProfileOpen, setBusinessProfileOpen] = useState(false);
  const [selectedBusinessProfile, setSelectedBusinessProfile] = useState<any>(null);
  const [businessProfileLoading, setBusinessProfileLoading] = useState(false);

  const theming = useTheming('prototype_tester');

  const { getProffCompanyData } = useExternalData();
  const [proffData, setProffData] = useState<any>(null);
  const [proffLoading, setProffLoading] = useState(false);

  const getProfessionChip = (profession: string) => {
    const branding = theming.getProfessionBranding(profession);
    const IconComponent = branding.icon;

    return {
      icon: <IconComponent sx={{ fontSize: 16, color: 'white' }} />,
      label: branding.label,
      color: branding.color
    };
  };

  const { data: inviteRequests = [], isLoading } = useQuery({
    queryKey: ['/api/invite-requests'],
    queryFn: () => apiRequest('/api/invite-requests'),
    select: (rows: any) => (Array.isArray(rows) ? rows : []),
  });

  const { data: prototypeTesterRequests = [], isLoading: isLoadingPrototype } = useQuery({
    queryKey: ['/api/prototype-tester-requests'],
    queryFn: () => apiRequest('/api/prototype-tester-requests'),
    select: (rows: any) =>
      (Array.isArray(rows) ? rows : []).map((r: any) => ({
        ...r,
        testingAreas: Array.isArray(r?.testingAreas)
          ? r.testingAreas.filter((s: unknown): s is string => typeof s === 'string')
          : typeof r?.testingAreas === 'string' && r.testingAreas.trim()
            ? (() => {
                try {
                  const p = JSON.parse(r.testingAreas);
                  return Array.isArray(p) ? p.filter((s: unknown): s is string => typeof s === 'string') : [];
                } catch {
                  return String(r.testingAreas).split(',').map((s: string) => s.trim()).filter(Boolean);
                }
              })()
            : [],
      })),
  });

  const processMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string | number; status: string; notes?: string }) => {
      return apiRequest(`/api/invite-requests/${id}/process`, {
        method: 'POST',
        body: JSON.stringify({ status, notes }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invite-requests'] });
      setSelectedRequest(null);
    },
  });

  const processPrototypeMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes?: string }) => {
      return apiRequest(`/api/prototype-tester-requests/${id}/process`, {
        method: 'POST',
        body: JSON.stringify({ status, notes }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prototype-tester-requests'] });
      setSelectedPrototypeRequest(null);
    },
  });

  const handleApprove = (request: InviteRequest) => {
    processMutation.mutate({
      id: request.id,
      status: 'approved',
      notes: `Godkjent av admin - ${new Date().toLocaleDateString('nb-NO')}`,
    });
  };

  const handleReject = (request: InviteRequest) => {
    processMutation.mutate({
      id: request.id,
      status: 'rejected',
      notes: `Avvist av admin - ${new Date().toLocaleDateString('nb-NO')}`,
    });
  };

  const handleApprovePrototype = (request: PrototypeTesterRequest) => {
    processPrototypeMutation.mutate({
      id: request.id,
      status: 'approved',
      notes: `Godkjent prototype tester - ${new Date().toLocaleDateString('nb-NO')}`,
    });
  };

  const handleRejectPrototype = (request: PrototypeTesterRequest) => {
    processPrototypeMutation.mutate({
      id: request.id,
      status: 'rejected',
      notes: `Avvist prototype tester - ${new Date().toLocaleDateString('nb-NO')}`,
    });
  };

  const handleCustomizeEmail = (request: PrototypeTesterRequest) => {
    const params = new URLSearchParams({
      action: 'send-invitation',
      type: 'prototype_tester',
      recipientEmail: request.email,
      recipientName: request.name,
      profession: request.profession,
      testingAreas: JSON.stringify(request.testingAreas),
      experience: request.experience,
      requestId: request.id.toString()
    });

    setLocation(`/admin/email-center?${params.toString()}`);
  };

  const openProffAnalysis = async (request: InviteRequest) => {
    if (request.organizationNumber) {
      setSelectedOrgNumber(request.organizationNumber);
      setProffAnalysisOpen(true);
      setProffLoading(true);

      try {
        const data = await getProffCompanyData(request.organizationNumber);
        setProffData(data);
      } catch (error) {
        console.error('Failed to load Proff.no data:', error);
      } finally {
        setProffLoading(false);
      }
    }
  };

  const openBusinessProfile = async (request: InviteRequest) => {
    setBusinessProfileOpen(true);
    setBusinessProfileLoading(true);

    try {
      const response = await apiRequest(`/api/business-lifecycle/profile-by-email/${request.email}`);

      if (response.success && response.profile) {
        setSelectedBusinessProfile(response.profile);

        if (response.profile.organizationNumber) {
          const proffResponse = await getProffCompanyData(response.profile.organizationNumber);
          setSelectedBusinessProfile((prev: any) => ({
            ...prev,
            proffData: proffResponse
          }));
        }
      } else {
        setSelectedBusinessProfile({ notFound: true, email: request.email });
      }
    } catch (error) {
      console.error('Failed to load business profile:', error);
      setSelectedBusinessProfile({ error: true, email: request.email });
    } finally {
      setBusinessProfileLoading(false);
    }
  };

  const getSourceTone = (source?: string): { tone: 'brand' | 'info' | 'warning' | 'neutral'; label: string } => {
    const normalized = (source || 'unknown').toLowerCase();
    return SOURCE_TONE[normalized] || { tone: 'neutral' as const, label: 'Ukjent' };
  };

  const getRequestSource = (request: InviteRequest) => {
    if (request.source) {
      return request.source;
    }

    const educationMessage = parseRoleRoomEducationInquiryMessage(request.message);
    if (educationMessage) {
      return 'role_room_education';
    }

    return 'unknown';
  };

  const getInviteDisplayPlan = (request: InviteRequest) => {
    const educationMessage = parseRoleRoomEducationInquiryMessage(request.message);
    if (educationMessage) {
      return {
        label: 'Institusjonssamtale',
        caption: `${educationMessage.institutionTypeLabel || 'Institusjon'} · ${educationMessage.programName || 'Program ikke satt'}`,
      };
    }

    if (request.selectedPlan || request.planName) {
      const normalizedJourneyStatus = String(request.userJourneyStatus || '').trim().toLowerCase();
      const paymentCaption = request.paymentCompleted ? 'Betalt' : 'Venter betaling';
      const activationCaption =
        normalizedJourneyStatus === 'role_room_activation_required'
          ? 'Venter kontogodkjenning'
          : normalizedJourneyStatus === 'role_room_access_activated' || normalizedJourneyStatus === 'active'
            ? 'Konto godkjent'
            : paymentCaption;
      return {
        label: request.planName || request.selectedPlan || 'Plan',
        caption: activationCaption,
      };
    }

    return null;
  };

  const getProffRecommendationTone = (request: InviteRequest): 'success' | 'warning' | 'error' | 'neutral' => {
    switch (request.proffRecommendation) {
      case 'approve': return 'success';
      case 'review': return 'warning';
      case 'reject': return 'error';
      default: return 'neutral';
    }
  };

  const getRiskTone = (riskLevel?: InviteRequest['proffRiskLevel']): 'success' | 'warning' | 'error' | 'neutral' => {
    switch (riskLevel) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high':
      case 'critical': return 'error';
      default: return 'neutral';
    }
  };

  const getProffRecommendationLabel = (request: InviteRequest) => {
    switch (request.proffRecommendation) {
      case 'approve': return 'Screening: Godkjenn';
      case 'review': return 'Screening: Gjennomgå';
      case 'reject': return 'Screening: Avvis';
      default: return 'Screening mangler';
    }
  };

  const getRiskLabel = (riskLevel?: InviteRequest['proffRiskLevel']) => {
    switch (riskLevel) {
      case 'low': return 'Lav risiko';
      case 'medium': return 'Medium risiko';
      case 'high': return 'Høy risiko';
      case 'critical': return 'Kritisk risiko';
      default: return 'Ikke screenet';
    }
  };

  const pendingRequests = inviteRequests.filter((req: InviteRequest) => req.status === 'pending');
  const processedRequests = inviteRequests.filter((req: InviteRequest) => req.status !== 'pending');
  const pendingPrototypeRequests = prototypeTesterRequests.filter((req: PrototypeTesterRequest) => req.status === 'pending');
  const processedPrototypeRequests = prototypeTesterRequests.filter((req: PrototypeTesterRequest) => req.status !== 'pending');

  const labelSx = { color: adminTokens.color.textMuted, fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.04em' } as const;
  const valueSx = { color: adminTokens.color.textSecondary } as const;

  return (
    <Box>
      {/* Tabs */}
      <Box sx={{ borderBottom: `1px solid ${adminTokens.color.border}`, mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{
            '& .MuiTab-root': {
              color: adminTokens.color.textMuted,
              textTransform: 'none',
              fontWeight: 600,
              '&.Mui-selected': { color: adminTokens.color.text },
            },
            '& .MuiTabs-indicator': { backgroundColor: adminTokens.color.brand },
          }}
        >
          <Tab
            icon={<Badge badgeContent={pendingRequests.length} color="warning"><PeopleIcon /></Badge>}
            label="Profesjonelle Brukere"
          />
          <Tab
            icon={<Badge badgeContent={pendingPrototypeRequests.length} color="info"><ScienceIcon /></Badge>}
            label="Prototype Testere"
          />
        </Tabs>
      </Box>

      {/* Tab 1: Professional Requests */}
      {activeTab === 0 && (
        <>
          <AdminCard
            title={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <span>Ventende profesjonelle forespørsler</span>
                <StatusChip status="pending" label={`${pendingRequests.length}`} />
              </Box>
            }
            disablePadding
            sx={{ mb: 3 }}
          >
            {pendingRequests.length === 0 ? (
              <Box sx={{ p: 3 }}>
                <Alert severity="info" sx={{ bgcolor: 'rgba(41,182,246,0.08)', border: '1px solid rgba(41,182,246,0.24)', color: adminTokens.color.info }}>
                  Ingen ventende profesjonelle forespørsler for øyeblikket
                </Alert>
              </Box>
            ) : (
              <AdminTableContainer ariaLabel="Ventende profesjonelle forespørsler">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Bedrift / Navn</TableCell>
                      <TableCell>Profesjon</TableCell>
                      <TableCell>Kilde</TableCell>
                      <TableCell>Kontakt</TableCell>
                      <TableCell>Org.nr</TableCell>
                      <TableCell>Screening</TableCell>
                      <TableCell>Abonnement</TableCell>
                      <TableCell>Dato</TableCell>
                      <TableCell>Handlinger</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendingRequests.map((request: InviteRequest) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: adminTokens.color.text }}>
                              {request.business || `${request.firstName} ${request.lastName}`}
                            </Typography>
                            {request.business && (
                              <Typography variant="caption" sx={{ color: adminTokens.color.textMuted }}>
                                {request.firstName} {request.lastName}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const profChip = getProfessionChip(request.profession);
                            return (
                              <Chip
                                icon={profChip.icon}
                                label={profChip.label}
                                size="small"
                                sx={{
                                  bgcolor: profChip.color,
                                  color: 'white', '& .MuiChip-icon': { color: 'white' }
                                }}
                              />
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const src = getSourceTone(getRequestSource(request));
                            return <StatusChip tone={src.tone} label={src.label} />;
                          })()}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={valueSx}>{request.email}</Typography>
                          {request.phone && <Typography variant="caption" sx={{ color: adminTokens.color.textMuted }}>{request.phone}</Typography>}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={valueSx}>{request.organizationNumber || 'Ikke oppgitt'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <StatusChip tone={getProffRecommendationTone(request)} label={getProffRecommendationLabel(request)} />
                            <StatusChip tone={getRiskTone(request.proffRiskLevel)} label={getRiskLabel(request.proffRiskLevel)} />
                            {request.proffSummary && (
                              <Typography variant="caption" sx={{ color: adminTokens.color.textMuted }}>
                                {request.proffSummary}
                              </Typography>
                            )}
                            {request.proffLastScreenedAt && (
                              <Typography variant="caption" sx={{ color: adminTokens.color.textMuted }}>
                                {new Date(request.proffLastScreenedAt).toLocaleString('nb-NO')}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {getInviteDisplayPlan(request) ? (
                            <Box>
                              <StatusChip
                                tone={request.paymentCompleted ? 'success' : 'warning'}
                                label={getInviteDisplayPlan(request)?.label}
                              />
                              <Typography
                                variant="caption"
                                display="block"
                                sx={{ color: request.paymentCompleted ? adminTokens.color.success : adminTokens.color.warning, mt: 0.5 }}
                              >
                                {getInviteDisplayPlan(request)?.caption}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="caption" sx={{ color: adminTokens.color.textMuted }}>
                              Ikke valgt
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={valueSx}>
                            {new Date(request.requestDate).toLocaleDateString('nb-NO')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box display="flex" gap={0.5}>
                            <Tooltip title="Se detaljer">
                              <IconButton size="small" onClick={() => setSelectedRequest(request)} sx={{ color: adminTokens.color.textSecondary }}>
                                <ViewIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Se full bedriftsprofil">
                              <IconButton size="small" onClick={() => openBusinessProfile(request)} sx={{ color: adminTokens.color.info }}>
                                <PeopleIcon />
                              </IconButton>
                            </Tooltip>
                            {request.organizationNumber && (
                              <Tooltip title="Proff.no risikoanalyse">
                                <IconButton size="small" onClick={() => openProffAnalysis(request)} sx={{ color: adminTokens.color.warning }}>
                                  <FlagIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Godkjenn">
                              <IconButton size="small" onClick={() => handleApprove(request)} disabled={processMutation.isPending} sx={{ color: adminTokens.color.success }}>
                                <ApproveIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Avvis">
                              <IconButton size="small" onClick={() => handleReject(request)} disabled={processMutation.isPending} sx={{ color: adminTokens.color.error }}>
                                <RejectIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AdminTableContainer>
            )}
          </AdminCard>

          {/* Processed */}
          <AdminCard
            title={`Behandlede profesjonelle forespørsler (${processedRequests.length})`}
            disablePadding
          >
            {processedRequests.length === 0 ? (
              <Box sx={{ p: 3 }}>
                <Alert severity="info" sx={{ bgcolor: 'rgba(41,182,246,0.08)', border: '1px solid rgba(41,182,246,0.24)', color: adminTokens.color.info }}>
                  Ingen behandlede forespørsler ennå
                </Alert>
              </Box>
            ) : (
              <AdminTableContainer ariaLabel="Behandlede profesjonelle forespørsler">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Bedrift / Navn</TableCell>
                      <TableCell>Kilde</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Screening</TableCell>
                      <TableCell>Behandlet dato</TableCell>
                      <TableCell>Handlinger</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {processedRequests.slice(0, 10).map((request: InviteRequest) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: adminTokens.color.text }}>
                            {request.business || `${request.firstName} ${request.lastName}`}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const src = getSourceTone(getRequestSource(request));
                            return <StatusChip tone={src.tone} label={src.label} />;
                          })()}
                        </TableCell>
                        <TableCell>
                          <StatusChip status={request.status} />
                        </TableCell>
                        <TableCell>
                          <StatusChip tone={getProffRecommendationTone(request)} label={getProffRecommendationLabel(request)} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={valueSx}>
                            {request.processedDate ? new Date(request.processedDate).toLocaleDateString('nb-NO') : 'Ukjent'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => setSelectedRequest(request)} sx={{ color: adminTokens.color.textSecondary }}>
                            <ViewIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AdminTableContainer>
            )}
          </AdminCard>
        </>
      )}

      {/* Tab 2: Prototype Testers */}
      {activeTab === 1 && (
        <>
          <AdminCard
            title={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <span>Ventende prototype tester forespørsler</span>
                <StatusChip status="pending" label={`${pendingPrototypeRequests.length}`} />
              </Box>
            }
            disablePadding
            sx={{ mb: 3 }}
          >
            {pendingPrototypeRequests.length === 0 ? (
              <Box sx={{ p: 3 }}>
                <Alert severity="info" sx={{ bgcolor: 'rgba(41,182,246,0.08)', border: '1px solid rgba(41,182,246,0.24)', color: adminTokens.color.info }}>
                  Ingen ventende prototype tester forespørsler for øyeblikket
                </Alert>
              </Box>
            ) : (
              <AdminTableContainer ariaLabel="Ventende prototype tester forespørsler">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Navn</TableCell>
                      <TableCell>Profesjon</TableCell>
                      <TableCell>Testing Områder</TableCell>
                      <TableCell>Erfaring</TableCell>
                      <TableCell>Dato</TableCell>
                      <TableCell>Handlinger</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendingPrototypeRequests.map((request: PrototypeTesterRequest) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: adminTokens.color.text }}>{request.name}</Typography>
                            <Typography variant="caption" sx={{ color: adminTokens.color.textMuted }}>{request.email}</Typography>
                            {request.status === 'approved' && (
                              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                                <StatusChip status="active" label="Account Active" sx={{ fontSize: '0.65rem', height: 18 }} />
                                {(request as any).paymentMethod && (
                                  <>
                                    <StatusChip tone="success" label="Paid" sx={{ fontSize: '0.65rem', height: 18 }} />
                                    <PaymentMethodLogo
                                      method={(request as any).paymentMethod}
                                      size="small"
                                      showTooltip={true}
                                    />
                                  </>
                                )}
                              </Box>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const profChip = getProfessionChip(request.profession);
                            return (
                              <Chip
                                icon={profChip.icon}
                                label={profChip.label}
                                size="small"
                                sx={{
                                  bgcolor: profChip.color,
                                  color: 'white', '& .MuiChip-icon': { color: 'white' }
                                }}
                              />
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {request.testingAreas.slice(0, 3).map((area: string, index: number) => (
                              <Chip key={index} label={area} size="small" variant="outlined"
                                sx={{ color: adminTokens.color.brand, borderColor: adminTokens.color.brand }}
                              />
                            ))}
                            {request.testingAreas.length > 3 && (
                              <Chip label={`+${request.testingAreas.length - 3}`} size="small"
                                sx={{ color: adminTokens.color.textMuted, borderColor: adminTokens.color.border }}
                              />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <StatusChip
                            tone={request.experience === 'expert' ? 'success' : 'neutral'}
                            label={request.experience}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={valueSx}>
                            {new Date(request.requestDate).toLocaleDateString('nb-NO')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box display="flex" gap={0.5}>
                            <Tooltip title="Se detaljer">
                              <IconButton size="small" onClick={() => setSelectedPrototypeRequest(request)} sx={{ color: adminTokens.color.textSecondary }}>
                                <ViewIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Customize invitation email">
                              <IconButton size="small" onClick={() => handleCustomizeEmail(request)} sx={{ color: adminTokens.color.info }}>
                                <EmailIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Godkjenn & Send Standard Email">
                              <IconButton size="small" onClick={() => handleApprovePrototype(request)} disabled={processPrototypeMutation.isPending} sx={{ color: adminTokens.color.success }}>
                                <ApproveIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Avvis">
                              <IconButton size="small" onClick={() => handleRejectPrototype(request)} disabled={processPrototypeMutation.isPending} sx={{ color: adminTokens.color.error }}>
                                <RejectIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AdminTableContainer>
            )}
          </AdminCard>

          {/* Processed Prototype Testers */}
          <AdminCard
            title={`Behandlede prototype tester forespørsler (${processedPrototypeRequests.length})`}
            disablePadding
          >
            {processedPrototypeRequests.length === 0 ? (
              <Box sx={{ p: 3 }}>
                <Alert severity="info" sx={{ bgcolor: 'rgba(41,182,246,0.08)', border: '1px solid rgba(41,182,246,0.24)', color: adminTokens.color.info }}>
                  Ingen behandlede prototype tester forespørsler ennå
                </Alert>
              </Box>
            ) : (
              <AdminTableContainer ariaLabel="Behandlede prototype tester forespørsler">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Navn</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Behandlet dato</TableCell>
                      <TableCell>Handlinger</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {processedPrototypeRequests.slice(0, 10).map((request: PrototypeTesterRequest) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: adminTokens.color.text }}>{request.name}</Typography>
                        </TableCell>
                        <TableCell>
                          <StatusChip status={request.status} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={valueSx}>
                            {request.processedDate ? new Date(request.processedDate).toLocaleDateString('nb-NO') : 'Ukjent'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => setSelectedPrototypeRequest(request)} sx={{ color: adminTokens.color.textSecondary }}>
                            <ViewIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AdminTableContainer>
            )}
          </AdminCard>
        </>
      )}

      {/* PROFF.NO BUSINESS ANALYSIS DIALOG */}
      <Dialog open={proffAnalysisOpen} onClose={() => setProffAnalysisOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ color: adminTokens.color.text, borderBottom: `1px solid ${adminTokens.color.border}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FlagIcon sx={{ color: adminTokens.color.danger }} />
            <span>Bedriftsanalyse</span>
            {selectedOrgNumber && (
              <StatusChip tone="brand" label={`Org.nr: ${selectedOrgNumber}`} />
            )}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: '20px !important' }}>
          {proffLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3 }}>
              <CircularProgress size={24} sx={{ color: adminTokens.color.brand }} />
              <Typography sx={{ color: adminTokens.color.textSecondary }}>Henter data fra BRREG og Regnskapsregisteret...</Typography>
            </Box>
          ) : proffData ? (
            <Box sx={{ p: 1 }}>
              <Typography variant="h6" gutterBottom sx={{ color: adminTokens.color.text }}>
                {proffData.companyName} ({proffData.organizationNumber})
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {proffData.creditRating && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ p: 2, textAlign: 'center', bgcolor: proffData.creditRating === 'C' ? 'rgba(244,67,54,0.12)' : proffData.creditRating === 'BB' ? 'rgba(255,152,0,0.12)' : 'rgba(76,175,80,0.12)', borderRadius: `${adminTokens.radius.md}px`, border: `1px solid ${proffData.creditRating === 'C' ? 'rgba(244,67,54,0.24)' : proffData.creditRating === 'BB' ? 'rgba(255,152,0,0.24)' : 'rgba(76,175,80,0.24)'}` }}>
                      <Typography variant="caption" sx={{ color: adminTokens.color.textMuted }}>Kredittkarakter</Typography>
                      <Typography variant="h4" sx={{ fontWeight: 'bold', color: proffData.creditRating === 'C' ? adminTokens.color.error : proffData.creditRating === 'BB' ? adminTokens.color.warning : adminTokens.color.success }}>{proffData.creditRating}</Typography>
                      <Typography variant="caption" sx={{ color: adminTokens.color.textMuted }}>
                        {proffData.creditRating === 'AAA' ? 'Utmerket' : proffData.creditRating === 'AA' ? 'God' : proffData.creditRating === 'A' ? 'Akseptabel' : proffData.creditRating === 'BB' ? 'Usikker' : 'Dårlig'}
                      </Typography>
                    </Box>
                  </Grid>
                )}
                {proffData.financials && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(41,182,246,0.12)', borderRadius: `${adminTokens.radius.md}px`, border: '1px solid rgba(41,182,246,0.24)' }}>
                      <Typography variant="caption" sx={{ color: adminTokens.color.textMuted }}>Omsetning ({proffData.financials.year})</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: adminTokens.color.info }}>
                        {proffData.financials.revenue != null ? `${(proffData.financials.revenue / 1000000).toFixed(1)}M kr` : 'N/A'}
                      </Typography>
                    </Box>
                  </Grid>
                )}
                {proffData.financials && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ p: 2, textAlign: 'center', bgcolor: (proffData.financials.netResult ?? 0) >= 0 ? 'rgba(76,175,80,0.12)' : 'rgba(244,67,54,0.12)', borderRadius: `${adminTokens.radius.md}px`, border: `1px solid ${(proffData.financials.netResult ?? 0) >= 0 ? 'rgba(76,175,80,0.24)' : 'rgba(244,67,54,0.24)'}` }}>
                      <Typography variant="caption" sx={{ color: adminTokens.color.textMuted }}>Resultat ({proffData.financials.year})</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: (proffData.financials.netResult ?? 0) >= 0 ? adminTokens.color.success : adminTokens.color.error }}>
                        {proffData.financials.netResult != null ? `${(proffData.financials.netResult / 1000).toFixed(0)} kNOK` : 'N/A'}
                      </Typography>
                    </Box>
                  </Grid>
                )}
                {proffData.financials && proffData.financials.equityRatio != null && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ p: 2, textAlign: 'center', bgcolor: proffData.financials.equityRatio >= 0.3 ? 'rgba(76,175,80,0.12)' : proffData.financials.equityRatio >= 0.15 ? 'rgba(255,152,0,0.12)' : 'rgba(244,67,54,0.12)', borderRadius: `${adminTokens.radius.md}px`, border: `1px solid ${proffData.financials.equityRatio >= 0.3 ? 'rgba(76,175,80,0.24)' : proffData.financials.equityRatio >= 0.15 ? 'rgba(255,152,0,0.24)' : 'rgba(244,67,54,0.24)'}` }}>
                      <Typography variant="caption" sx={{ color: adminTokens.color.textMuted }}>Soliditet</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: proffData.financials.equityRatio >= 0.3 ? adminTokens.color.success : proffData.financials.equityRatio >= 0.15 ? adminTokens.color.warning : adminTokens.color.error }}>
                        {(proffData.financials.equityRatio * 100).toFixed(0)}%
                      </Typography>
                    </Box>
                  </Grid>
                )}
                {proffData.employees != null && proffData.employees > 0 && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(255,152,0,0.12)', borderRadius: `${adminTokens.radius.md}px`, border: '1px solid rgba(255,152,0,0.24)' }}>
                      <Typography variant="caption" sx={{ color: adminTokens.color.textMuted }}>Ansatte</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: adminTokens.color.warning }}>{proffData.employees}</Typography>
                    </Box>
                  </Grid>
                )}
                {proffData.businessSegments && proffData.businessSegments.length > 0 && proffData.businessSegments[0] && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(168,85,247,0.12)', borderRadius: `${adminTokens.radius.md}px`, border: '1px solid rgba(168,85,247,0.24)' }}>
                      <Typography variant="caption" sx={{ color: adminTokens.color.textMuted }}>Bransje</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: adminTokens.color.brand, mt: 0.5 }}>
                        {proffData.businessSegments[0]}
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>

              {/* Kart over bedriftens lokasjon */}
              {proffData.latitude && proffData.longitude && (
                <Box sx={{ mt: 3, borderRadius: `${adminTokens.radius.md}px`, overflow: 'hidden', border: `1px solid ${adminTokens.color.border}` }}>
                  <MapContainer
                    center={[proffData.latitude, proffData.longitude]}
                    zoom={14}
                    style={{ height: 220, width: '100%' }}
                    scrollWheelZoom={false}
                    attributionControl={false}
                  >
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                      attribution='&copy; <a href="https://carto.com/">CARTO</a> · <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    <Marker
                      position={[proffData.latitude, proffData.longitude]}
                      icon={L.divIcon({
                        html: `<svg width="28" height="36" viewBox="0 0 24 32"><path d="M12 0.5C5.65 0.5 0.5 5.65 0.5 12c0 8.6 11.5 19.5 11.5 19.5S23.5 20.6 23.5 12c0-6.35-5.15-11.5-11.5-11.5z" fill="${adminTokens.color.brand}" stroke="#0a0a0f" stroke-width="1.2"/><circle cx="12" cy="12" r="4" fill="#fff"/></svg>`,
                        className: '',
                        iconSize: [28, 36],
                        iconAnchor: [14, 36],
                      })}
                    >
                      <Popup>
                        <div style={{ color: '#1a1a2e', fontWeight: 600 }}>{proffData.companyName}</div>
                        {proffData.address && <div style={{ color: '#555', fontSize: 12 }}>{proffData.address}</div>}
                      </Popup>
                    </Marker>
                  </MapContainer>
                </Box>
              )}
              {!proffData.latitude && proffData.address && (
                <Box sx={{ mt: 2, p: 1.5, bgcolor: 'rgba(168,85,247,0.06)', borderRadius: `${adminTokens.radius.md}px`, border: `1px solid ${adminTokens.color.border}` }}>
                  <Typography variant="caption" sx={{ color: adminTokens.color.textMuted }}>Adresse: {proffData.address}</Typography>
                </Box>
              )}

              {proffData.riskIndicators && proffData.riskIndicators.length === 0 && (
                <Alert severity="success" sx={{ mt: 3, bgcolor: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.24)', color: adminTokens.color.success }}>
                  Ingen risikoindikatorer funnet - God økonomisk helse
                </Alert>
              )}
              {proffData.riskIndicators && proffData.riskIndicators.length > 0 && (
                <Alert severity="error" sx={{ mt: 3, bgcolor: 'rgba(244,67,54,0.08)', border: '1px solid rgba(244,67,54,0.24)', color: adminTokens.color.error }}>
                  <Typography variant="body2" gutterBottom>{proffData.riskIndicators.length} risikoindikatorer funnet</Typography>
                  <List dense>
                    {proffData.riskIndicators.map((risk: any, idx: number) => (
                      <ListItem key={idx}>
                        <ListItemText
                          primary={<Typography sx={{ color: adminTokens.color.text }}>{risk.description}</Typography>}
                          secondary={<Typography sx={{ color: adminTokens.color.textMuted }}>Alvorlighet: {risk.severity.toUpperCase()}</Typography>}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Alert>
              )}
            </Box>
          ) : (
            <Alert severity="info" sx={{ m: 2, bgcolor: 'rgba(41,182,246,0.08)', border: '1px solid rgba(41,182,246,0.24)', color: adminTokens.color.info }}>
              Ingen data tilgjengelig
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: `1px solid ${adminTokens.color.border}`, p: 2 }}>
          <Button onClick={() => setProffAnalysisOpen(false)} sx={{ color: adminTokens.color.textSecondary }}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Request Details Dialog */}
      <Dialog open={!!selectedRequest} onClose={() => setSelectedRequest(null)} maxWidth="md" fullWidth>
        {selectedRequest && (
          <>
            <DialogTitle sx={{ color: adminTokens.color.text, borderBottom: `1px solid ${adminTokens.color.border}` }}>
              Forespørsel fra {selectedRequest.business || `${selectedRequest.firstName} ${selectedRequest.lastName}`}
            </DialogTitle>
            <DialogContent sx={{ pt: '20px !important' }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" sx={labelSx}>Navn</Typography>
                  <Typography variant="body2" sx={valueSx}>{selectedRequest.firstName} {selectedRequest.lastName}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" sx={labelSx}>Profesjon</Typography>
                  {(() => {
                    const profChip = getProfessionChip(selectedRequest.profession);
                    return (
                      <Chip
                        icon={profChip.icon}
                        label={profChip.label}
                        size="small"
                        sx={{
                          bgcolor: profChip.color,
                          color: 'white',
                          mt: 0.5,
                          '& .MuiChip-icon': { color: 'white' }
                        }}
                      />
                    );
                  })()}
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" sx={labelSx}>Kilde</Typography>
                  {(() => {
                    const src = getSourceTone(getRequestSource(selectedRequest));
                    return <StatusChip tone={src.tone} label={src.label} sx={{ mt: 0.5 }} />;
                  })()}
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" sx={labelSx}>E-post</Typography>
                  <Typography variant="body2" sx={valueSx}>{selectedRequest.email}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" sx={labelSx}>Telefon</Typography>
                  <Typography variant="body2" sx={valueSx}>{selectedRequest.phone || 'Ikke oppgitt'}</Typography>
                </Grid>

                {(() => {
                  const educationInquiry = parseRoleRoomEducationInquiryMessage(selectedRequest.message);
                  if (!educationInquiry) {
                    return null;
                  }

                  return (
                    <>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontWeight: 'bold', color: adminTokens.color.text }}>
                          Institusjonskvalifisering
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" sx={labelSx}>Institusjonstype</Typography>
                        <Typography variant="body2" sx={valueSx}>{educationInquiry.institutionTypeLabel || 'Ikke oppgitt'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" sx={labelSx}>Stilling / rolle</Typography>
                        <Typography variant="body2" sx={valueSx}>{educationInquiry.contactRole || 'Ikke oppgitt'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" sx={labelSx}>Studieprogram / fagområde</Typography>
                        <Typography variant="body2" sx={valueSx}>{educationInquiry.programName || 'Ikke oppgitt'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" sx={labelSx}>Ønsket oppstart</Typography>
                        <Typography variant="body2" sx={valueSx}>{educationInquiry.desiredStartWindowLabel || 'Ikke oppgitt'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" sx={labelSx}>Studentomfang</Typography>
                        <Typography variant="body2" sx={valueSx}>{educationInquiry.studentSeatLabel || 'Ikke oppgitt'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" sx={labelSx}>Faglærere / koordinatorer</Typography>
                        <Typography variant="body2" sx={valueSx}>{educationInquiry.staffSeatLabel || 'Ikke oppgitt'}</Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" sx={labelSx}>Bruksområde</Typography>
                        <Typography variant="body2" sx={{ ...valueSx, whiteSpace: 'pre-wrap' }}>
                          {educationInquiry.useCase || 'Ikke oppgitt'}
                        </Typography>
                      </Grid>
                    </>
                  );
                })()}

                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontWeight: 'bold', color: adminTokens.color.text }}>
                    Proff-screening
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                    <StatusChip tone={getProffRecommendationTone(selectedRequest)} label={getProffRecommendationLabel(selectedRequest)} />
                    <StatusChip tone={getRiskTone(selectedRequest.proffRiskLevel)} label={getRiskLabel(selectedRequest.proffRiskLevel)} />
                    {selectedRequest.proffBrregVerified && (
                      <StatusChip tone="info" label="BRREG-verifisert" />
                    )}
                  </Box>
                  {selectedRequest.proffSummary && (
                    <Alert
                      severity={selectedRequest.proffRecommendation === 'reject' ? 'error' : selectedRequest.proffRecommendation === 'review' ? 'warning' : 'success'}
                      sx={{
                        bgcolor: selectedRequest.proffRecommendation === 'reject'
                          ? 'rgba(244,67,54,0.08)' : selectedRequest.proffRecommendation === 'review'
                            ? 'rgba(255,152,0,0.08)' : 'rgba(76,175,80,0.08)',
                        border: `1px solid ${
                          selectedRequest.proffRecommendation === 'reject'
                            ? 'rgba(244,67,54,0.24)' : selectedRequest.proffRecommendation === 'review'
                              ? 'rgba(255,152,0,0.24)' : 'rgba(76,175,80,0.24)'
                        }`,
                        color: selectedRequest.proffRecommendation === 'reject'
                          ? adminTokens.color.error : selectedRequest.proffRecommendation === 'review'
                            ? adminTokens.color.warning : adminTokens.color.success,
                      }}
                    >
                      {selectedRequest.proffSummary}
                    </Alert>
                  )}
                </Grid>

                {selectedRequest.selectedPlan && (
                  <>
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontWeight: 'bold', color: adminTokens.color.text }}>
                        Abonnementsinformasjon
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" sx={labelSx}>Valgt plan</Typography>
                      <StatusChip tone="brand" label={selectedRequest.planName || selectedRequest.selectedPlan} sx={{ mt: 0.5 }} />
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" sx={labelSx}>Betalingsstatus</Typography>
                      <StatusChip
                        tone={selectedRequest.paymentCompleted ? 'success' : 'warning'}
                        label={selectedRequest.paymentCompleted ? "Betalt" : "Venter betaling"}
                        sx={{ mt: 0.5 }}
                      />
                    </Grid>
                    {selectedRequest.paymentCompleted && selectedRequest.paymentTransactionId && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" sx={labelSx}>Transaksjons-ID</Typography>
                        <Typography variant="caption" sx={{ color: adminTokens.color.textMuted }}>
                          {selectedRequest.paymentTransactionId}
                        </Typography>
                      </Grid>
                    )}
                    {selectedRequest.paymentAmount && (
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" sx={labelSx}>Beløp</Typography>
                        <Typography variant="body2" sx={valueSx}>
                          {selectedRequest.paymentAmount} NOK
                        </Typography>
                      </Grid>
                    )}
                    {selectedRequest.paymentTimestamp && (
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" sx={labelSx}>Betalingsdato</Typography>
                        <Typography variant="body2" sx={valueSx}>
                          {new Date(selectedRequest.paymentTimestamp).toLocaleDateString('nb-NO')}
                        </Typography>
                      </Grid>
                    )}
                  </>
                )}
              </Grid>
            </DialogContent>
            <DialogActions sx={{ borderTop: `1px solid ${adminTokens.color.border}`, p: 2 }}>
              <Button onClick={() => setSelectedRequest(null)} sx={{ color: adminTokens.color.textSecondary }}>Lukk</Button>
              {selectedRequest.organizationNumber && selectedRequest.status === 'pending' && (
                <Button variant="outlined" startIcon={<FlagIcon />} onClick={() => openProffAnalysis(selectedRequest)}
                  sx={{ color: adminTokens.color.brand, borderColor: adminTokens.color.brand, '&:hover': { borderColor: adminTokens.color.brandHover } }}>
                  Bedriftsanalyse
                </Button>
              )}
              {selectedRequest.status === 'pending' && (
                <>
                  <Button variant="contained" startIcon={<ApproveIcon />} onClick={() => handleApprove(selectedRequest)}
                    sx={{ bgcolor: adminTokens.color.success, '&:hover': { bgcolor: '#388e3c' } }}>
                    Godkjenn
                  </Button>
                  <Button variant="outlined" startIcon={<RejectIcon />} onClick={() => handleReject(selectedRequest)}
                    sx={{ color: adminTokens.color.error, borderColor: adminTokens.color.error, '&:hover': { borderColor: adminTokens.color.danger } }}>
                    Avvis
                  </Button>
                </>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Prototype Tester Details Dialog */}
      <Dialog open={!!selectedPrototypeRequest} onClose={() => setSelectedPrototypeRequest(null)} maxWidth="md" fullWidth>
        {selectedPrototypeRequest && (
          <>
            <DialogTitle sx={{ color: adminTokens.color.text, borderBottom: `1px solid ${adminTokens.color.border}` }}>
              Prototype Tester: {selectedPrototypeRequest.name}
            </DialogTitle>
            <DialogContent sx={{ pt: '20px !important' }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" sx={labelSx}>Navn</Typography>
                  <Typography variant="body2" sx={valueSx}>{selectedPrototypeRequest.name}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" sx={labelSx}>E-post</Typography>
                  <Typography variant="body2" sx={valueSx}>{selectedPrototypeRequest.email}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" sx={labelSx}>Profesjon</Typography>
                  {(() => {
                    const profChip = getProfessionChip(selectedPrototypeRequest.profession);
                    return (
                      <Chip
                        icon={profChip.icon}
                        label={profChip.label}
                        size="small"
                        sx={{
                          bgcolor: profChip.color,
                          color: 'white',
                          mt: 0.5,
                          '& .MuiChip-icon': { color: 'white' }
                        }}
                      />
                    );
                  })()}
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" sx={labelSx}>Erfaring</Typography>
                  <Typography variant="body2" sx={valueSx}>{selectedPrototypeRequest.experience}</Typography>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ borderTop: `1px solid ${adminTokens.color.border}`, p: 2 }}>
              <Button onClick={() => setSelectedPrototypeRequest(null)} sx={{ color: adminTokens.color.textSecondary }}>Lukk</Button>
              {selectedPrototypeRequest.status === 'pending' && (
                <>
                  <Button variant="contained" startIcon={<ApproveIcon />} onClick={() => handleApprovePrototype(selectedPrototypeRequest)}
                    sx={{ bgcolor: adminTokens.color.success, '&:hover': { bgcolor: '#388e3c' } }}>
                    Godkjenn
                  </Button>
                  <Button variant="outlined" startIcon={<RejectIcon />} onClick={() => handleRejectPrototype(selectedPrototypeRequest)}
                    sx={{ color: adminTokens.color.error, borderColor: adminTokens.color.error, '&:hover': { borderColor: adminTokens.color.danger } }}>
                    Avvis
                  </Button>
                </>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* FULL BUSINESS PROFILE DIALOG */}
      <Dialog open={businessProfileOpen} onClose={() => setBusinessProfileOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ color: adminTokens.color.text, borderBottom: `1px solid ${adminTokens.color.border}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PeopleIcon sx={{ color: adminTokens.color.brand }} />
              <span>Full Bedriftsprofil</span>
            </Box>
            {selectedBusinessProfile?.businessStatus && (
              <StatusChip
                status={selectedBusinessProfile.businessStatus === 'active' ? 'active' : selectedBusinessProfile.businessStatus === 'suspended' ? 'pending' : selectedBusinessProfile.businessStatus === 'bankrupt' ? 'failed' : 'inactive'}
                label={selectedBusinessProfile.businessStatus.toUpperCase()}
              />
            )}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: '20px !important' }}>
          {businessProfileLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3 }}>
              <CircularProgress size={24} sx={{ color: adminTokens.color.brand }} />
              <Typography sx={{ color: adminTokens.color.textSecondary }}>Laster bedriftsprofil...</Typography>
            </Box>
          ) : selectedBusinessProfile?.notFound ? (
            <Alert severity="info" sx={{ m: 2, bgcolor: 'rgba(41,182,246,0.08)', border: '1px solid rgba(41,182,246,0.24)', color: adminTokens.color.info }}>
              Denne brukeren har ikke fullført onboarding ennå.
              Profil vil være tilgjengelig etter at brukeren fullfører UniversalOnboarding.
            </Alert>
          ) : selectedBusinessProfile?.error ? (
            <Alert severity="error" sx={{ m: 2, bgcolor: 'rgba(244,67,54,0.08)', border: '1px solid rgba(244,67,54,0.24)', color: adminTokens.color.error }}>
              Kunne ikke laste bedriftsprofil. Prøv igjen senere.
            </Alert>
          ) : selectedBusinessProfile ? (
            <Box sx={{ p: 1 }}>
              {selectedBusinessProfile.businessStatus && selectedBusinessProfile.businessStatus !== 'active' && (
                <Alert
                  severity={
                    selectedBusinessProfile.businessStatus === 'bankrupt' ? 'error' :
                    selectedBusinessProfile.businessStatus === 'suspended' ? 'warning' :
                    'info'
                  }
                  sx={{
                    mb: 3,
                    bgcolor: selectedBusinessProfile.businessStatus === 'bankrupt'
                      ? 'rgba(244,67,54,0.08)' : selectedBusinessProfile.businessStatus === 'suspended'
                        ? 'rgba(255,152,0,0.08)' : 'rgba(41,182,246,0.08)',
                    border: `1px solid ${
                      selectedBusinessProfile.businessStatus === 'bankrupt'
                        ? 'rgba(244,67,54,0.24)' : selectedBusinessProfile.businessStatus === 'suspended'
                          ? 'rgba(255,152,0,0.24)' : 'rgba(41,182,246,0.24)'
                    }`,
                    color: selectedBusinessProfile.businessStatus === 'bankrupt'
                      ? adminTokens.color.error : selectedBusinessProfile.businessStatus === 'suspended'
                        ? adminTokens.color.warning : adminTokens.color.info,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {selectedBusinessProfile.businessStatus === 'bankrupt' && 'Bedrift registrert som konkurs'}
                    {selectedBusinessProfile.businessStatus === 'suspended' && 'Bedrift midlertidig suspendert'}
                    {selectedBusinessProfile.businessStatus === 'cancelled' && 'Bedrift avsluttet'}
                    {selectedBusinessProfile.businessStatus === 'pending_closure' && 'Under avslutning'}
                  </Typography>
                  {selectedBusinessProfile.businessStatusReason && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Årsak: {selectedBusinessProfile.businessStatusReason}
                    </Typography>
                  )}
                  {selectedBusinessProfile.dataRetentionUntil && (
                    <Typography variant="caption" display="block" sx={{ mt: 1, color: adminTokens.color.error }}>
                      Data slettes: {new Date(selectedBusinessProfile.dataRetentionUntil).toLocaleDateString('no-NO')}
                    </Typography>
                  )}
                </Alert>
              )}

              <Typography variant="h6" gutterBottom sx={{ color: adminTokens.color.brand }}>
                {selectedBusinessProfile.businessName || 'Ikke oppgitt'}
              </Typography>

              <Grid container spacing={3} sx={{ mt: 1 }}>
                <Grid item xs={12} md={6}>
                  <AdminCard title="Grunnleggende informasjon" disablePadding>
                    <List dense sx={{ px: 2, py: 1 }}>
                      <ListItem>
                        <ListItemText
                          primary={<Typography sx={labelSx}>Navn</Typography>}
                          secondary={<Typography sx={valueSx}>{`${selectedBusinessProfile.firstName || ''} ${selectedBusinessProfile.lastName || ''}`}</Typography>}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary={<Typography sx={labelSx}>E-post</Typography>}
                          secondary={<Typography sx={valueSx}>{selectedBusinessProfile.email}</Typography>}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary={<Typography sx={labelSx}>Telefon</Typography>}
                          secondary={<Typography sx={valueSx}>{selectedBusinessProfile.phone || 'Ikke oppgitt'}</Typography>}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary={<Typography sx={labelSx}>Profesjon</Typography>}
                          secondary={(() => {
                            const profChip = getProfessionChip(selectedBusinessProfile.userType || 'photographer');
                            return (
                              <Chip
                                icon={profChip.icon}
                                label={profChip.label}
                                size="small"
                                sx={{
                                  bgcolor: profChip.color,
                                  color: 'white',
                                  mt: 0.5,
                                  '& .MuiChip-icon': { color: 'white' }
                                }}
                              />
                            );
                          })()}
                        />
                      </ListItem>
                    </List>
                  </AdminCard>
                </Grid>

                <Grid item xs={12} md={6}>
                  <AdminCard title="Bedriftsdetaljer" disablePadding>
                    <List dense sx={{ px: 2, py: 1 }}>
                      <ListItem>
                        <ListItemText
                          primary={<Typography sx={labelSx}>Organisasjonsnummer</Typography>}
                          secondary={<Typography sx={valueSx}>{selectedBusinessProfile.organizationNumber || 'Ikke oppgitt'}</Typography>}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary={<Typography sx={labelSx}>Adresse</Typography>}
                          secondary={<Typography sx={valueSx}>{selectedBusinessProfile.businessAddress || 'Ikke oppgitt'}</Typography>}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary={<Typography sx={labelSx}>Nettside</Typography>}
                          secondary={<Typography sx={valueSx}>{selectedBusinessProfile.website || 'Ikke oppgitt'}</Typography>}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary={<Typography sx={labelSx}>Onboarding fullført</Typography>}
                          secondary={<Typography sx={valueSx}>{selectedBusinessProfile.onboardingCompleted ? 'Ja' : 'Nei'}</Typography>}
                        />
                      </ListItem>
                    </List>
                  </AdminCard>
                </Grid>

                {selectedBusinessProfile.proffData && (
                  <Grid item xs={12}>
                    <AdminCard
                      title="Proff.no Økonomisk Analyse"
                      sx={{ border: `1px solid ${adminTokens.color.brandSubtle}` }}
                    >
                      <Grid container spacing={2}>
                        {selectedBusinessProfile.proffData.creditRating && (
                          <Grid item xs={6} sm={3}>
                            <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'rgba(76,175,80,0.12)', borderRadius: 1 }}>
                              <Typography variant="caption" sx={{ color: adminTokens.color.textMuted }}>Kredittvurdering</Typography>
                              <Typography variant="h6" sx={{ fontWeight: 'bold', color: adminTokens.color.success }}>
                                {selectedBusinessProfile.proffData.creditRating}
                              </Typography>
                            </Box>
                          </Grid>
                        )}
                        {selectedBusinessProfile.proffData.revenue && (
                          <Grid item xs={6} sm={3}>
                            <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'rgba(41,182,246,0.12)', borderRadius: 1 }}>
                              <Typography variant="caption" sx={{ color: adminTokens.color.textMuted }}>Omsetning</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 'bold', color: adminTokens.color.info }}>
                                {(selectedBusinessProfile.proffData.revenue.amount / 1000000).toFixed(1)}M NOK
                              </Typography>
                            </Box>
                          </Grid>
                        )}
                        {selectedBusinessProfile.proffData.employees && (
                          <Grid item xs={6} sm={3}>
                            <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'rgba(255,152,0,0.12)', borderRadius: 1 }}>
                              <Typography variant="caption" sx={{ color: adminTokens.color.textMuted }}>Ansatte</Typography>
                              <Typography variant="h6" sx={{ fontWeight: 'bold', color: adminTokens.color.warning }}>
                                {selectedBusinessProfile.proffData.employees}
                              </Typography>
                            </Box>
                          </Grid>
                        )}
                        {selectedBusinessProfile.proffData.riskIndicators && (
                          <Grid item xs={6} sm={3}>
                            <Box sx={{
                              textAlign: 'center',
                              p: 1,
                              bgcolor: selectedBusinessProfile.proffData.riskIndicators.length > 0 ? 'rgba(244,67,54,0.12)' : 'rgba(76,175,80,0.12)',
                              borderRadius: 1
                            }}>
                              <Typography variant="caption" sx={{ color: adminTokens.color.textMuted }}>Risiko</Typography>
                              <Typography variant="h6" sx={{
                                fontWeight: 'bold',
                                color: selectedBusinessProfile.proffData.riskIndicators.length > 0 ? adminTokens.color.error : adminTokens.color.success
                              }}>
                                {selectedBusinessProfile.proffData.riskIndicators.length}
                              </Typography>
                            </Box>
                          </Grid>
                        )}
                      </Grid>
                    </AdminCard>
                  </Grid>
                )}

                {selectedBusinessProfile.businessStatusChangedAt && (
                  <Grid item xs={12}>
                    <AdminCard title="Hendelseslogg" disablePadding>
                      <List dense sx={{ px: 2, py: 1 }}>
                        <ListItem>
                          <ListItemText
                            primary={<Typography sx={labelSx}>Status endret</Typography>}
                            secondary={<Typography sx={valueSx}>{`${new Date(selectedBusinessProfile.businessStatusChangedAt).toLocaleDateString('no-NO')} av ${selectedBusinessProfile.businessStatusChangedBy || 'system'}`}</Typography>}
                          />
                        </ListItem>
                        {selectedBusinessProfile.lastFinancialCheck && (
                          <ListItem>
                            <ListItemText
                              primary={<Typography sx={labelSx}>Siste økonomisk sjekk</Typography>}
                              secondary={<Typography sx={valueSx}>{new Date(selectedBusinessProfile.lastFinancialCheck).toLocaleDateString('no-NO')}</Typography>}
                            />
                          </ListItem>
                        )}
                      </List>
                    </AdminCard>
                  </Grid>
                )}
              </Grid>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ borderTop: `1px solid ${adminTokens.color.border}`, p: 2 }}>
          <Button onClick={() => setBusinessProfileOpen(false)} sx={{ color: adminTokens.color.textSecondary }}>Lukk</Button>
          {selectedBusinessProfile && !selectedBusinessProfile.notFound && !selectedBusinessProfile.error && (
            <Button
              variant="outlined"
              startIcon={<FlagIcon />}
              onClick={() => {
                if (selectedBusinessProfile.organizationNumber) {
                  setBusinessProfileOpen(false);
                  const mockRequest: InviteRequest = {
                    id: '0',
                    profession: selectedBusinessProfile.userType || 'photographer',
                    firstName: selectedBusinessProfile.firstName || '',
                    lastName: selectedBusinessProfile.lastName || '',
                    email: selectedBusinessProfile.email,
                    organizationNumber: selectedBusinessProfile.organizationNumber,
                    status: 'approved',
                    requestDate: new Date().toISOString()
                  };
                  openProffAnalysis(mockRequest);
                }
              }}
              sx={{ color: adminTokens.color.brand, borderColor: adminTokens.color.brand, '&:hover': { borderColor: adminTokens.color.brandHover } }}
            >
              Bedriftsanalyse
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
