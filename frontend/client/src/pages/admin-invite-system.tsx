import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
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
  Card,
  CardContent,
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
  // Payment tracking fields
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

export default function AdminInviteSystem() {
  const [, setLocation] = useLocation();
  const [selectedRequest, setSelectedRequest] = useState<InviteRequest | null>(null);
  const [selectedPrototypeRequest, setSelectedPrototypeRequest] =
    useState<PrototypeTesterRequest | null>(null);
  const [proffAnalysisOpen, setProffAnalysisOpen] = useState(false);
  const [selectedOrgNumber, setSelectedOrgNumber] = useState<string>('');
  const [activeTab, setActiveTab] = useState(0);
  const queryClient = useQueryClient();
  
  // ⭐ Business profile viewing
  const [businessProfileOpen, setBusinessProfileOpen] = useState(false);
  const [selectedBusinessProfile, setSelectedBusinessProfile] = useState<any>(null);
  const [businessProfileLoading, setBusinessProfileLoading] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  
  // ⭐ External data service for Proff.no
  const { getProffCompanyData } = useExternalData();
  const [proffData, setProffData] = useState<any>(null);
  const [proffLoading, setProffLoading] = useState(false);
  
  // Helper to get profession branding
  const getProfessionChip = (profession: string) => {
    const branding = theming.getProfessionBranding(profession);
    const IconComponent = branding.icon;
    
    return {
      icon: <IconComponent sx={{ fontSize: 16, color: 'white' }} />,
      label: branding.label,
      color: branding.color
    };
  };

  // Fetch pending invite requests
  const { data: inviteRequests = [], isLoading } = useQuery({
    queryKey: ['/api/invite-requests'],
    queryFn: () => apiRequest('/api/invite-requests'),
  });

  // Fetch prototype tester requests
  const { data: prototypeTesterRequests = [], isLoading: isLoadingPrototype } = useQuery({
    queryKey: ['/api/prototype-tester-requests'],
    queryFn: () => apiRequest('/api/prototype-tester-requests'),
  });

  // Process invite request mutation
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

  // Process prototype tester mutation
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
    // Navigate to AdminEmailCenter with invitation data
    // Use query params to pass data
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
      
      // ⭐ Fetch Proff.no data
      try {
        const data = await getProffCompanyData(request.organizationNumber);
        setProffData(data);
        console.log('✅ Proff.no data loaded: ', data);
      } catch (error) {
        console.error('Failed to load Proff.no data:', error);
      } finally {
        setProffLoading(false);
      }
    }
  };
  
  // ⭐ Open full business profile from invite request
  const openBusinessProfile = async (request: InviteRequest) => {
    setBusinessProfileOpen(true);
    setBusinessProfileLoading(true);
    
    try {
      // Search for user's full onboarding profile by email or org number
      const response = await apiRequest(`/api/business-lifecycle/profile-by-email/${request.email}`);
      
      if (response.success && response.profile) {
        setSelectedBusinessProfile(response.profile);
        
        // Also fetch Proff.no data if org number exists
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Venter';
      case 'approved': return 'Godkjent';
      case 'rejected': return 'Avvist';
      default: return status;
    }
  };

  const getSourceChip = (source?: string) => {
    const normalized = (source || 'unknown').toLowerCase();
    if (normalized === 'creatorhub') {
      return { label: 'Creatorhub', color: 'primary' as const };
    }
    if (normalized === 'evendi') {
      return { label: 'Evendi', color: 'secondary' as const };
    }
    if (normalized === 'role_room' || normalized === 'role_room_education') {
      return { label: 'The Role Room', color: 'warning' as const };
    }
    return { label: 'Ukjent', color: 'default' as const };
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

  const getProffRecommendationChip = (request: InviteRequest) => {
    switch (request.proffRecommendation) {
      case 'approve':
        return { label: 'Screening: Godkjenn', color: 'success' as const };
      case 'review':
        return { label: 'Screening: Gjennomgå', color: 'warning' as const };
      case 'reject':
        return { label: 'Screening: Avvis', color: 'error' as const };
      default:
        return { label: 'Screening mangler', color: 'default' as const };
    }
  };

  const getRiskChip = (riskLevel?: InviteRequest['proffRiskLevel']) => {
    switch (riskLevel) {
      case 'low':
        return { label: 'Lav risiko', color: 'success' as const };
      case 'medium':
        return { label: 'Medium risiko', color: 'warning' as const };
      case 'high':
        return { label: 'Høy risiko', color: 'error' as const };
      case 'critical':
        return { label: 'Kritisk risiko', color: 'error' as const };
      default:
        return { label: 'Ikke screenet', color: 'default' as const };
    }
  };

  const pendingRequests = inviteRequests.filter((req: InviteRequest) => req.status === 'pending');
  const processedRequests = inviteRequests.filter((req: InviteRequest) => req.status !== 'pending');
  const pendingPrototypeRequests = prototypeTesterRequests.filter((req: PrototypeTesterRequest) => req.status === 'pending');
  const processedPrototypeRequests = prototypeTesterRequests.filter((req: PrototypeTesterRequest) => req.status !== 'pending');

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
          Admin: Invite System Dashboard
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Administrer tilgangsforespørsler med BRREG-validering og Proff.no risikoanalyse
        </Typography>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab
            icon={<Badge badgeContent={pendingRequests.length} color="warning"><PeopleIcon /></Badge>}
            label="Profesjonelle Brukere"
            sx={{ textTransform: 'none' }}
          />
          <Tab
            icon={<Badge badgeContent={pendingPrototypeRequests.length} color="info"><ScienceIcon /></Badge>}
            label="Prototype Testere"
            sx={{ textTransform: 'none' }}
          />
        </Tabs>
      </Box>

      {/* Tab 1: Professional Requests */}
      {activeTab === 0 && (
        <>
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Ventende profesjonelle forespørsler ({pendingRequests.length})
                </Typography>
                {pendingRequests.length > 0 && <Chip label={`${pendingRequests.length} nye`} color="warning" />}
              </Box>

              {pendingRequests.length === 0 ? (
                <Alert severity="info">Ingen ventende profesjonelle forespørsler for øyeblikket</Alert>
              ) : (
                <TableContainer component={Paper}>
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
                              <Typography variant="body2" fontWeight="bold">
                                {request.business || `${request.firstName} ${request.lastName}`}
                              </Typography>
                              {request.business && (
                                <Typography variant="caption" color="textSecondary">
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
                              const sourceChip = getSourceChip(getRequestSource(request));
                              return <Chip label={sourceChip.label} size="small" color={sourceChip.color} />;
                            })()}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{request.email}</Typography>
                            {request.phone && <Typography variant="caption" color="textSecondary">{request.phone}</Typography>}
                          </TableCell>
                          <TableCell>{request.organizationNumber || 'Ikke oppgitt'}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              <Chip
                                {...getProffRecommendationChip(request)}
                                size="small"
                              />
                              <Chip
                                {...getRiskChip(request.proffRiskLevel)}
                                size="small"
                                variant="outlined"
                              />
                              {request.proffSummary && (
                                <Typography variant="caption" color="textSecondary">
                                  {request.proffSummary}
                                </Typography>
                              )}
                              {request.proffLastScreenedAt && (
                                <Typography variant="caption" color="textSecondary">
                                  {new Date(request.proffLastScreenedAt).toLocaleString('nb-NO')}
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            {getInviteDisplayPlan(request) ? (
                              <Box>
                                <Chip
                                  label={getInviteDisplayPlan(request)?.label}
                                  size="small"
                                  color={request.paymentCompleted ? "success" : "warning"}
                                  icon={<PaymentIcon />}
                                />
                                <Typography
                                  variant="caption"
                                  display="block"
                                  color={request.paymentCompleted ? "success.main" : "warning.main"}
                                >
                                  {getInviteDisplayPlan(request)?.caption}
                                </Typography>
                              </Box>
                            ) : (
                              <Typography variant="caption" color="textSecondary">
                                Ikke valgt
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>{new Date(request.requestDate).toLocaleDateString('nb-NO')}</TableCell>
                          <TableCell>
                            <Box display="flex" gap={1}>
                              <Tooltip title="Se detaljer">
                                <IconButton size="small" onClick={() => setSelectedRequest(request)}>
                                  <ViewIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Se full bedriftsprofil">
                                <IconButton size="small" color="info" onClick={() => openBusinessProfile(request)}>
                                  <PeopleIcon />
                                </IconButton>
                              </Tooltip>
                              {request.organizationNumber && (
                                <Tooltip title="Proff.no risikoanalyse">
                                  <IconButton size="small" color="warning" onClick={() => openProffAnalysis(request)}>
                                    <FlagIcon />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="Godkjenn">
                                <IconButton size="small" color="success" onClick={() => handleApprove(request)} disabled={processMutation.isPending}>
                                  <ApproveIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Avvis">
                                <IconButton size="small" color="error" onClick={() => handleReject(request)} disabled={processMutation.isPending}>
                                  <RejectIcon />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>

          {/* Processed */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Behandlede profesjonelle forespørsler ({processedRequests.length})
              </Typography>
              {processedRequests.length === 0 ? (
                <Alert severity="info">Ingen behandlede forespørsler ennå</Alert>
              ) : (
                <TableContainer component={Paper}>
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
                          <TableCell>{request.business || `${request.firstName} ${request.lastName}`}</TableCell>
                          <TableCell>
                            {(() => {
                              const sourceChip = getSourceChip(getRequestSource(request));
                              return <Chip label={sourceChip.label} size="small" color={sourceChip.color} />;
                            })()}
                          </TableCell>
                          <TableCell><Chip label={getStatusText(request.status)} color={getStatusColor(request.status) as any} size="small" /></TableCell>
                          <TableCell>
                            <Chip
                              {...getProffRecommendationChip(request)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{request.processedDate ? new Date(request.processedDate).toLocaleDateString('nb-NO') : 'Ukjent'}</TableCell>
                          <TableCell>
                            <IconButton size="small" onClick={() => setSelectedRequest(request)}><ViewIcon /></IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Tab 2: Prototype Testers */}
      {activeTab === 1 && (
        <>
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Ventende prototype tester forespørsler ({pendingPrototypeRequests.length})
                </Typography>
                {pendingPrototypeRequests.length > 0 && <Chip label={`${pendingPrototypeRequests.length} nye`} color="info" />}
              </Box>
              {pendingPrototypeRequests.length === 0 ? (
                <Alert severity="info">Ingen ventende prototype tester forespørsler for øyeblikket</Alert>
              ) : (
                <TableContainer component={Paper}>
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
                              <Typography variant="body2" fontWeight="bold">{request.name}</Typography>
                              <Typography variant="caption" color="textSecondary">{request.email}</Typography>
                              {request.status === 'approved' && (
                                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                                  <Chip label="Account Active" size="small" color="success" sx={{ fontSize: '0.65rem', height: 18 }} />
                                  {/* Show payment status if available */}
                                  {(request as any).paymentMethod && (
                                    <>
                                      <Chip label="Paid" size="small" color="success" sx={{ fontSize: '0.65rem', height: 18 }} />
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
                                    color: 'white','& .MuiChip-icon': { color: 'white' }
                                  }}
                                />
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {request.testingAreas.slice(0, 3).map((area: string, index: number) => (
                                <Chip key={index} label={area} size="small" color="primary" variant="outlined" />
                              ))}
                              {request.testingAreas.length > 3 && <Chip label={`+${request.testingAreas.length - 3}`} size="small" />}
                            </Box>
                          </TableCell>
                          <TableCell><Chip label={request.experience} size="small" color={request.experience === 'expert' ? 'success' : 'default'} /></TableCell>
                          <TableCell>{new Date(request.requestDate).toLocaleDateString('nb-NO')}</TableCell>
                          <TableCell>
                            <Box display="flex" gap={1}>
                              <Tooltip title="Se detaljer">
                                <IconButton size="small" onClick={() => setSelectedPrototypeRequest(request)}><ViewIcon /></IconButton>
                              </Tooltip>
                              <Tooltip title="Customize invitation email">
                                <IconButton size="small" color="info" onClick={() => handleCustomizeEmail(request)}>
                                  <EmailIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Godkjenn & Send Standard Email">
                                <IconButton size="small" color="success" onClick={() => handleApprovePrototype(request)} disabled={processPrototypeMutation.isPending}>
                                  <ApproveIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Avvis">
                                <IconButton size="small" color="error" onClick={() => handleRejectPrototype(request)} disabled={processPrototypeMutation.isPending}>
                                  <RejectIcon />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>

          {/* Processed Prototype Testers */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Behandlede prototype tester forespørsler ({processedPrototypeRequests.length})
              </Typography>
              {processedPrototypeRequests.length === 0 ? (
                <Alert severity="info">Ingen behandlede prototype tester forespørsler ennå</Alert>
              ) : (
                <TableContainer component={Paper}>
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
                          <TableCell>{request.name}</TableCell>
                          <TableCell><Chip label={getStatusText(request.status)} color={getStatusColor(request.status) as any} size="small" /></TableCell>
                          <TableCell>{request.processedDate ? new Date(request.processedDate).toLocaleDateString('nb-NO') : 'Ukjent'}</TableCell>
                          <TableCell>
                            <IconButton size="small" onClick={() => setSelectedPrototypeRequest(request)}><ViewIcon /></IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ⭐ PROFF.NO BUSINESS ANALYSIS DIALOG */}
      <Dialog open={proffAnalysisOpen} onClose={() => setProffAnalysisOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FlagIcon sx={{ color: '#d32f2f' }} />
            Proff.no Business Analysis
            {selectedOrgNumber && <Chip label={`Org.nr: ${selectedOrgNumber}`} size="small" color="primary" variant="outlined" />}
          </Box>
        </DialogTitle>
        <DialogContent>
          {proffLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3 }}>
              <CircularProgress size={24} />
              <Typography>Henter Proff.no data...</Typography>
            </Box>
          ) : proffData ? (
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>{proffData.companyName} ({proffData.organizationNumber})</Typography>
              <Grid container spacing={2} sx={{ mt: 2 }}>
                {proffData.creditRating && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light' }}>
                      <Typography variant="caption">Kredittvurdering</Typography>
                      <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.dark' }}>{proffData.creditRating}</Typography>
                      <Typography variant="caption">{proffData.creditRating === 'AAA' ? 'Utmerket' : 'God'}</Typography>
                    </Card>
                  </Grid>
                )}
                {proffData.revenue && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ p: 2, textAlign: 'center', bgcolor: 'info.light' }}>
                      <Typography variant="caption">Omsetning ({proffData.revenue.year})</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'info.dark' }}>
                        {(proffData.revenue.amount / 1000000).toFixed(1)}M NOK
                      </Typography>
                    </Card>
                  </Grid>
                )}
                {proffData.employees && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light' }}>
                      <Typography variant="caption">Ansatte</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'warning.dark' }}>{proffData.employees}</Typography>
                    </Card>
                  </Grid>
                )}
                {proffData.marketIntelligence && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ p: 2, textAlign: 'center', bgcolor: 'secondary.light' }}>
                      <Typography variant="caption">Markedsposisjon</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'secondary.dark', mt: 1 }}>
                        {proffData.marketIntelligence.marketPosition === 'leader' ? 'Leder' : 'Utfordrer'}
                      </Typography>
                    </Card>
                  </Grid>
                )}
              </Grid>
              {proffData.riskIndicators && proffData.riskIndicators.length === 0 && (
                <Alert severity="success" sx={{ mt: 3 }}>Ingen betalingsanmerkninger - God økonomisk helse</Alert>
              )}
              {proffData.riskIndicators && proffData.riskIndicators.length > 0 && (
                <Alert severity="error" sx={{ mt: 3 }}>
                  <Typography variant="body2" gutterBottom>{proffData.riskIndicators.length} risikoindikatorer funnet</Typography>
                  <List dense>
                    {proffData.riskIndicators.map((risk: any, idx: number) => (
                      <ListItem key={idx}>
                        <ListItemText primary={risk.description} secondary={`Alvorlighet: ${risk.severity.toUpperCase()}`} />
                      </ListItem>
                    ))}
                  </List>
                </Alert>
              )}
            </Box>
          ) : (
            <Alert severity="info" sx={{ m: 2 }}>Ingen Proff.no data tilgjengelig</Alert>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setProffAnalysisOpen(false)}>Lukk</Button></DialogActions>
      </Dialog>

      {/* Details Dialogs */}
      <Dialog open={!!selectedRequest} onClose={() => setSelectedRequest(null)} maxWidth="md" fullWidth>
        {selectedRequest && (
          <>
            <DialogTitle>Forespørsel fra {selectedRequest.business || `${selectedRequest.firstName} ${selectedRequest.lastName}`}</DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={6}><Typography variant="subtitle2">Navn</Typography><Typography variant="body2">{selectedRequest.firstName} {selectedRequest.lastName}</Typography></Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Profesjon</Typography>
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
                  <Typography variant="subtitle2">Kilde</Typography>
                  {(() => {
                    const sourceChip = getSourceChip(getRequestSource(selectedRequest));
                    return (
                      <Chip
                        label={sourceChip.label}
                        size="small"
                        color={sourceChip.color}
                        sx={{ mt: 0.5 }}
                      />
                    );
                  })()}
                </Grid>
                <Grid item xs={6}><Typography variant="subtitle2">E-post</Typography><Typography variant="body2">{selectedRequest.email}</Typography></Grid>
                <Grid item xs={6}><Typography variant="subtitle2">Telefon</Typography><Typography variant="body2">{selectedRequest.phone || 'Ikke oppgitt'}</Typography></Grid>

                {(() => {
                  const educationInquiry = parseRoleRoomEducationInquiryMessage(selectedRequest.message);
                  if (!educationInquiry) {
                    return null;
                  }

                  return (
                    <>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
                          Institusjonskvalifisering
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2">Institusjonstype</Typography>
                        <Typography variant="body2">{educationInquiry.institutionTypeLabel || 'Ikke oppgitt'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2">Stilling / rolle</Typography>
                        <Typography variant="body2">{educationInquiry.contactRole || 'Ikke oppgitt'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2">Studieprogram / fagområde</Typography>
                        <Typography variant="body2">{educationInquiry.programName || 'Ikke oppgitt'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2">Ønsket oppstart</Typography>
                        <Typography variant="body2">{educationInquiry.desiredStartWindowLabel || 'Ikke oppgitt'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2">Studentomfang</Typography>
                        <Typography variant="body2">{educationInquiry.studentSeatLabel || 'Ikke oppgitt'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2">Faglærere / koordinatorer</Typography>
                        <Typography variant="body2">{educationInquiry.staffSeatLabel || 'Ikke oppgitt'}</Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2">Bruksområde</Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {educationInquiry.useCase || 'Ikke oppgitt'}
                        </Typography>
                      </Grid>
                    </>
                  );
                })()}

                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
                    Proff-screening
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                    <Chip {...getProffRecommendationChip(selectedRequest)} size="small" />
                    <Chip {...getRiskChip(selectedRequest.proffRiskLevel)} size="small" variant="outlined" />
                    {selectedRequest.proffBrregVerified && (
                      <Chip label="BRREG-verifisert" size="small" color="info" variant="outlined" />
                    )}
                  </Box>
                  {selectedRequest.proffSummary && (
                    <Alert severity={selectedRequest.proffRecommendation === 'reject' ? 'error' : selectedRequest.proffRecommendation === 'review' ? 'warning' : 'success'}>
                      {selectedRequest.proffSummary}
                    </Alert>
                  )}
                </Grid>

                {/* Payment Information */}
                {selectedRequest.selectedPlan && (
                  <>
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
                        💳 Abonnementsinformasjon
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2">Valgt plan</Typography>
                      <Chip
                        label={selectedRequest.planName || selectedRequest.selectedPlan}
                        size="small"
                        color="primary"
                        sx={{ mt: 0.5 }}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2">Betalingsstatus</Typography>
                      <Chip
                        label={selectedRequest.paymentCompleted ? "Betalt" : "Venter betaling"}
                        size="small"
                        color={selectedRequest.paymentCompleted ? "success" : "warning"}
                        icon={<PaymentIcon />}
                        sx={{ mt: 0.5 }}
                      />
                    </Grid>
                    {selectedRequest.paymentCompleted && selectedRequest.paymentTransactionId && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2">Transaksjons-ID</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {selectedRequest.paymentTransactionId}
                        </Typography>
                      </Grid>
                    )}
                    {selectedRequest.paymentAmount && (
                      <Grid item xs={6}>
                        <Typography variant="subtitle2">Beløp</Typography>
                        <Typography variant="body2">
                          {selectedRequest.paymentAmount} NOK
                        </Typography>
                      </Grid>
                    )}
                    {selectedRequest.paymentTimestamp && (
                      <Grid item xs={6}>
                        <Typography variant="subtitle2">Betalingsdato</Typography>
                        <Typography variant="body2">
                          {new Date(selectedRequest.paymentTimestamp).toLocaleDateString('nb-NO')}
                        </Typography>
                      </Grid>
                    )}
                  </>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedRequest(null)}>Lukk</Button>
              {selectedRequest.organizationNumber && selectedRequest.status === 'pending' && (
                <Button variant="outlined" startIcon={<FlagIcon />} onClick={() => openProffAnalysis(selectedRequest)}>Proff.no Analyse</Button>
              )}
              {selectedRequest.status === 'pending' && (
                <>
                  <Button color="success" variant="contained" startIcon={<ApproveIcon />} onClick={() => handleApprove(selectedRequest)}>Godkjenn</Button>
                  <Button color="error" variant="outlined" startIcon={<RejectIcon />} onClick={() => handleReject(selectedRequest)}>Avvis</Button>
                </>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog open={!!selectedPrototypeRequest} onClose={() => setSelectedPrototypeRequest(null)} maxWidth="md" fullWidth>
        {selectedPrototypeRequest && (
          <>
            <DialogTitle>Prototype Tester: {selectedPrototypeRequest.name}</DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={6}><Typography variant="subtitle2">Navn</Typography><Typography variant="body2">{selectedPrototypeRequest.name}</Typography></Grid>
                <Grid item xs={6}><Typography variant="subtitle2">E-post</Typography><Typography variant="body2">{selectedPrototypeRequest.email}</Typography></Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Profesjon</Typography>
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
                <Grid item xs={6}><Typography variant="subtitle2">Erfaring</Typography><Typography variant="body2">{selectedPrototypeRequest.experience}</Typography></Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedPrototypeRequest(null)}>Lukk</Button>
              {selectedPrototypeRequest.status === 'pending' && (
                <>
                  <Button color="success" variant="contained" startIcon={<ApproveIcon />} onClick={() => handleApprovePrototype(selectedPrototypeRequest)}>Godkjenn</Button>
                  <Button color="error" variant="outlined" startIcon={<RejectIcon />} onClick={() => handleRejectPrototype(selectedPrototypeRequest)}>Avvis</Button>
                </>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
      
      {/* ⭐ FULL BUSINESS PROFILE DIALOG (Cross-Reference) */}
      <Dialog open={businessProfileOpen} onClose={() => setBusinessProfileOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PeopleIcon sx={{ color: theming.colors.primary }} />
              Full Bedriftsprofil
            </Box>
            {selectedBusinessProfile?.businessStatus && (
              <Chip 
                label={selectedBusinessProfile.businessStatus.toUpperCase()}
                color={
                  selectedBusinessProfile.businessStatus === 'active' ? 'success' :
                  selectedBusinessProfile.businessStatus === 'suspended' ? 'warning' :
                  selectedBusinessProfile.businessStatus === 'bankrupt' ? 'error' :
                  'info'
                }
                size="small"
              />
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {businessProfileLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3 }}>
              <CircularProgress size={24} />
              <Typography>Laster bedriftsprofil...</Typography>
            </Box>
          ) : selectedBusinessProfile?.notFound ? (
            <Alert severity="info" sx={{ m: 2 }}>
              Denne brukeren har ikke fullført onboarding ennå. 
              Profil vil være tilgjengelig etter at brukeren fullfører UniversalOnboarding.
            </Alert>
          ) : selectedBusinessProfile?.error ? (
            <Alert severity="error" sx={{ m: 2 }}>
              Kunne ikke laste bedriftsprofil. Prøv igjen senere.
            </Alert>
          ) : selectedBusinessProfile ? (
            <Box sx={{ p: 2 }}>
              {/* Business Status Alert */}
              {selectedBusinessProfile.businessStatus && selectedBusinessProfile.businessStatus !== 'active' && (
                <Alert 
                  severity={
                    selectedBusinessProfile.businessStatus === 'bankrupt' ? 'error' :
                    selectedBusinessProfile.businessStatus === 'suspended' ? 'warning' :
                    'info'
                  }
                  sx={{ mb: 3 }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600}}>
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
                    <Typography variant="caption" display="block" sx={{ mt: 1, color: 'error.main' }}>
                      Data slettes: {new Date(selectedBusinessProfile.dataRetentionUntil).toLocaleDateString('no-NO')}
                    </Typography>
                  )}
                </Alert>
              )}
              
              {/* Business Information */}
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                {selectedBusinessProfile.businessName || 'Ikke oppgitt'}
              </Typography>
              
              <Grid container spacing={3} sx={{ mt: 1 }}>
                {/* Basic Info */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
                      Grunnleggende informasjon
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemText 
                          primary="Navn" 
                          secondary={`${selectedBusinessProfile.firstName || ', '} ${selectedBusinessProfile.lastName || ', '}`}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="E-post" 
                          secondary={selectedBusinessProfile.email}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Telefon" 
                          secondary={selectedBusinessProfile.phone || 'Ikke oppgitt'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Profesjon" 
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
                                    mt: 0.5, '& .MuiChip-icon': { color: 'white' }
                                }}
                              />
                            );
                          })()}
                        />
                      </ListItem>
                    </List>
                  </Card>
                </Grid>
                
                {/* Business Details */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
                      Bedriftsdetaljer
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemText 
                          primary="Organisasjonsnummer" 
                          secondary={selectedBusinessProfile.organizationNumber || 'Ikke oppgitt'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Adresse" 
                          secondary={selectedBusinessProfile.businessAddress || 'Ikke oppgitt'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Nettside" 
                          secondary={selectedBusinessProfile.website || 'Ikke oppgitt'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Onboarding fullført" 
                          secondary={selectedBusinessProfile.onboardingCompleted ? 'Ja' : 'Nei'}
                        />
                      </ListItem>
                    </List>
                  </Card>
                </Grid>
                
                {/* Proff.no Data */}
                {selectedBusinessProfile.proffData && (
                  <Grid item xs={12}>
                    <Card sx={{ p: 2, bgcolor: 'primary.light' }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: 'primary.dark' }}>
                        Proff.no Økonomisk Analyse
                      </Typography>
                      <Grid container spacing={2} sx={{ mt: 1 }}>
                        {selectedBusinessProfile.proffData.creditRating && (
                          <Grid item xs={6} sm={3}>
                            <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'success.light', borderRadius: 1 }}>
                              <Typography variant="caption">Kredittvurdering</Typography>
                              <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'success.dark' }}>
                                {selectedBusinessProfile.proffData.creditRating}
                              </Typography>
                            </Box>
                          </Grid>
                        )}
                        {selectedBusinessProfile.proffData.revenue && (
                          <Grid item xs={6} sm={3}>
                            <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'info.light', borderRadius: 1 }}>
                              <Typography variant="caption">Omsetning</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'info.dark' }}>
                                {(selectedBusinessProfile.proffData.revenue.amount / 1000000).toFixed(1)}M NOK
                              </Typography>
                            </Box>
                          </Grid>
                        )}
                        {selectedBusinessProfile.proffData.employees && (
                          <Grid item xs={6} sm={3}>
                            <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'warning.light', borderRadius: 1 }}>
                              <Typography variant="caption">Ansatte</Typography>
                              <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'warning.dark' }}>
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
                              bgcolor: selectedBusinessProfile.proffData.riskIndicators.length > 0 ? 'error.light' : 'success.light', 
                              borderRadius: 1 
                            }}>
                              <Typography variant="caption">Risiko</Typography>
                              <Typography variant="h6" sx={{ 
                                fontWeight: 'bold', 
                                color: selectedBusinessProfile.proffData.riskIndicators.length > 0 ? 'error.dark' : 'success.dark' 
                              }}>
                                {selectedBusinessProfile.proffData.riskIndicators.length}
                              </Typography>
                            </Box>
                          </Grid>
                        )}
                      </Grid>
                    </Card>
                  </Grid>
                )}
                
                {/* Lifecycle Events */}
                {selectedBusinessProfile.businessStatusChangedAt && (
                  <Grid item xs={12}>
                    <Card sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
                        Hendelseslogg
                      </Typography>
                      <List dense>
                        <ListItem>
                          <ListItemText 
                            primary="Status endret"
                            secondary={`${new Date(selectedBusinessProfile.businessStatusChangedAt).toLocaleDateString('no-NO')} av ${selectedBusinessProfile.businessStatusChangedBy || 'system'}`}
                          />
                        </ListItem>
                        {selectedBusinessProfile.lastFinancialCheck && (
                          <ListItem>
                            <ListItemText 
                              primary="Siste økonomisk sjekk"
                              secondary={new Date(selectedBusinessProfile.lastFinancialCheck).toLocaleDateString('no-NO')}
                            />
                          </ListItem>
                        )}
                      </List>
                    </Card>
                  </Grid>
                )}
              </Grid>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBusinessProfileOpen(false)}>Lukk</Button>
          {selectedBusinessProfile && !selectedBusinessProfile.notFound && !selectedBusinessProfile.error && (
            <Button 
              variant="outlined" 
              startIcon={<FlagIcon />}
              onClick={() => {
                if (selectedBusinessProfile.organizationNumber) {
                  setBusinessProfileOpen(false);
                  // Open Proff analysis
                  const mockRequest: InviteRequest = {
                    id: '0',
                    profession: selectedBusinessProfile.userType || 'photographer',
                    firstName: selectedBusinessProfile.firstName || '',
                    lastName: selectedBusinessProfile.lastName || ', ',
                    email: selectedBusinessProfile.email,
                    organizationNumber: selectedBusinessProfile.organizationNumber,
                    status:'approved',
                    requestDate: new Date().toISOString()
                  };
                  openProffAnalysis(mockRequest);
                }
              }}
            >
              Proff.no Analyse
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
}
