import { useTheming } from '../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '@/components/universal/hooks/useDynamicProfessions';
import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'wouter';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Divider,
  Card,
  CardContent,
  Grid,
  Container,
  Chip,
} from '@mui/material';
import {
  CheckCircle,
  Create,
  EmailOutlined,
  Description,
  EventNote,
  LocationOn,
  EuroSymbol,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { CREATOR_HUB_BRANDING } from '../constants/CreatorHubBranding';


interface Contract {
  id: string;
  contractNumber: string;
  clientName: string;
  clientEmail: string;
  projectDescription: string;
  totalAmount: string;
  eventDate: string;
  eventLocation: string;
  status: 'draft' | 'sent' | 'signed' | 'completed' | 'cancelled';
  createdAt: string;
  digitalSignature?: string;
  signedDate?: string;
  signerName?: string; 
}

const ContractSigningPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { profession } = useProfessionAdapter();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureComplete, setSignatureComplete] = useState(false);

  // Fetch contract details
  const {
    data: contractData,
    isLoading: contractLoading,
    error: contractError,
} = useQuery({
    queryKey: [`/api/contracts/${d}`],
    enabled: !!d,
});

  // Fetch signature status
  const { data: signatureStatusData, refetch: refetchSignatureStatus } = useQuery({
    queryKey: [`/api/contracts/${d}/signature-status`],
    enabled: !!d,
});

  // Sign contract mutation
  const signContractMutation = useMutation({
    mutationFn: async (signatureData: {
      digitalSignature: string;
      signerName: string;
      signerEmail: string;
}) => {
      return apiRequest(`/api/contracts/${id}/sign`, {
        method: 'POS',
        body: JSON.stringify(signatureData),
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contracts/${d}`] });
      refetchSignatureStatus();
  },
});

  const contract: Contract | undefined = contractData?.contract;
  const signatureStatus = signatureStatusData?.signatureStatus;

  // Canvas drawing functions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = CREATOR_HUB_BRANDING.colors.PRIMARY;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Set canvas background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect, (0, canvas.width, canvas.height);
}, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo, (y);
  }
};

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineTo, (y);
      ctx.stroke();
  }
};

  const stopDrawing = () => {
    setIsDrawing(false);
    setSignatureComplete(true);
};

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
    setSignatureComplete(false);
};

  const handleSign = () => {
    if (!signatureComplete || !signerName || !signerEmail) {
      return;
  }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const digitalSignature = canvas.toDataURL();

    signContractMutation.mutate({
      digitalSignature,
      signerName,
      signerEmail,
  });
};

  // Pre-fill form with contract client info
  useEffect(() => {
    if (contract && !signerName && !signerEmail) {
      setSignerName(contract.clientName);
      setSignerEmail(contract.clientEmail);
  }
}, [contract, signerName, signerEmail]);

  if (contractLoading) {
    return (
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <Box textAlign="center">
            <CircularProgress size={60} />
            <Typography variant="h6" sx={{  mt:  2  }}>
              Laster kontraktinformasjon...
            </Typography>
          </Box>
        </Box>
      </Container>
    );
}

  if (contractError || !contract) {
    return (
      <Container maxWidth="lg">
        <Box py={4}>
          <Alert severity="error">
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Kontrakten ble ikke funnet
            </Typography>
            Kontroller lenken og prøv igjen, eller kontakt fotografen for ny lenke.
          </Alert>
        </Box>
      </Container>
    );
}

  if (signatureStatus?.isSigned) {
    return (
      <Container maxWidth="lg">
        <Box py={4}>
          <Paper elevation={3} sx={{ ...theming.getThemedCardSx(), p: 4, textAlign: 'center' }}>
            <CheckCircle color="success" sx={{ fontSize: 80, mb: 3 }} />
            <Typography variant="h3" gutterBottom color="success.main" sx={{ color: theming.colors.primary }}>
              Kontrakt Signert!
            </Typography>
            <Typography variant="h6" color="textSecondary" gutterBottom sx={{ color: theming.colors.primary }}>
              Takk for din signatur. Kontrakten er nå juridisk bindende.
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Signert: {', '}
              {signatureStatus.signedDate
                ? new Date(signatureStatus.signedDate).toLocaleDateString('no-NO', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Ukjent tid'}
            </Typography>

            <Divider sx={{ my: 4 }} />

            <Grid container spacing={3} justifyContent="center">
              <Grid item xs={12} sm={6}>
                <Card variant="outlined" sx={theming.getThemedCardSx()}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      Kontraktdetaljer
                    </Typography>
                    <Typography color="textSecondary">
                      <strong>Nummer: </strong> {contract.contractNumber}
                    </Typography>
                    <Typography color="textSecondary">
                      <strong>Kunde: </strong> {contract.clientName}
                    </Typography>
                    <Typography color="textSecondary">
                      <strong>Total: </strong> NOK {contract.totalAmount}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box py={4}>
        <Paper elevation={3} sx={{ ...theming.getThemedCardSx(), overflow: 'hidden' }}>
          {/* Header */}
          <Box
            sx={{
              background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
              color: 'white',
              p: 4,
              textAlign: 'center',
            }}
          >
            <Typography variant="h3" gutterBottom sx={{ color: theming.colors.primary }}>
              Digital Kontraktsignering
            </Typography>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>CreatorHub Norge - Profesjonell Fotografi</Typography>
          </Box>

          <Box p={4}>
            {/* Contract Details Card */}
            <Card sx={{ ...theming.getThemedCardSx(), mb: 4 }}>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <Description color="primary" sx={{ mr: 2 }} />
                  <Typography variant="h5" sx={{ color: theming.colors.primary }}>Kontraktdetaljer</Typography>
                  <Chip
                    label={`Status: ${contract.status.toUpperCase()}`}
                    color="primary"
                    size="small"
                    sx={{ ml: 'auto' }}
                  />
                </Box>

                <Divider sx={{ mb: 3 }} />

                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Box mb={2}>
                      <Typography variant="h6" color="primary" gutterBottom sx={{ color: theming.colors.primary }}>
                        {contract.contractNumber}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Kontraktnummer
                      </Typography>
                    </Box>

                    <Box mb={2}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        {contract.clientName}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Kunde
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Box mb={2} display="flex" alignItems="center">
                      <EuroSymbol color="success" sx={{ mr: 1 }} />
                      <Box>
                        <Typography variant="h6" color="success.main" sx={{ color: theming.colors.primary }}>
                          NOK {contract.totalAmount}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Total beløp (inkl. 25% MVA)
                        </Typography>
                      </Box>
                    </Box>

                    <Box mb={2} display="flex" alignItems="center">
                      <EventNote color="primary" sx={{ mr: 1 }} />
                      <Box>
                        <Typography variant="body1">
                          {contract.eventDate
                            ? new Date(contract.eventDate).toLocaleDateString('no-NO')
                            : 'Ikke satt'}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Dato for fotografering
                        </Typography>
                      </Box>
                    </Box>

                    {contract.eventLocation && (
                      <Box mb={2} display="flex" alignItems="center">
                        <LocationOn color="primary" sx={{ mr: 1 }} />
                        <Box>
                          <Typography variant="body1">{contract.eventLocation}</Typography>
                          <Typography variant="body2" color="textSecondary">
                            Lokasjon
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Grid>

                  <Grid item xs={12}>
                    <Box p={2} borderRadius={2} sx={{ backgroundColor: 'grey.50' }}>
                      <Typography variant="body1" fontWeight="medium" gutterBottom>
                        Prosjektbeskrivelse:
                      </Typography>
                      <Typography variant="body2">{contract.projectDescription}</Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Signer Information */}
            <Card sx={{ ...theming.getThemedCardSx(), mb: 4 }}>
              <CardContent>
                <Box display="flex" alignItems="center" mb={3}>
                  <EmailOutlined color="primary" sx={{ mr: 2 }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Dine opplysninger</Typography>
                </Box>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Fullt navn"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      required
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="E-postadresse"
                      type="email"
                      value={signerEmail}
                      onChange={(e) => setSignerEmail(e.target.value)}
                      required
                      variant="outlined"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Digital Signature Pad */}
            <Card sx={{ ...theming.getThemedCardSx(), mb: 4 }}>
              <CardContent>
                <Box display="flex" alignItems="center" mb={3}>
                  <Create color="primary" sx={{ mr: 2 }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Digital signatur</Typography>
                </Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Tegn din signatur i feltet nedenfor ved å dra musen (eller fingeren på mobil)
                </Typography>

                <Box
                  sx={{
                    border: '3px dashed',
                    borderColor: signatureComplete ? 'success.main' : 'grey.300',
                    borderRadius: 2,
                    p: 2,
                    mb: 2,
                    backgroundColor: signatureComplete ? 'success.50' : 'grey.50',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    width={800}
                    height={250}
                    style={{
                      width: '100%',
                      maxWidth: '800px',
                      height: 'auto',
                      cursor: 'crosshair',
                      backgroundColor: 'white',
                      borderRadius: 8,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                  />
                </Box>

                <Box display="flex" gap={2} justifyContent="space-between">
                  <Button variant="outlined" onClick={clearSignature} size="medium">
                    Slett signatur
                  </Button>
                  {signatureComplete && (
                    <Chip label="Signatur klar" color="success" icon={theming.getThemedIcon('checkCircle')} />
                  )}
                </Box>
              </CardContent>
            </Card>

            {/* Sign Button */}
            <Box textAlign="center" mb={3}>
              <Button
                variant="contained"
                size="large"
                onClick={handleSign}
                disabled={
                  !signatureComplete ||
                  !signerName ||
                  !signerEmail ||
                  signContractMutation.isPending
                }
                startIcon={
                  signContractMutation.isPending ? <CircularProgress size={20} sx={theming.getThemedButtonSx()} /> : <Create />
                }
                sx={{
                  px: 6,
                  py: 2,
                  fontSize: '1.2rem',
                  borderRadius: 3,
                  boxShadow: '0 4px 12px rgba(5, 118, 210, 0.3)'
                }}
              >
                {signContractMutation.isPending ? 'Signerer kontrakt...' : 'Signer kontrakt'}
              </Button>
            </Box>

            {signContractMutation.error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {signContractMutation.error.message || 'Feil ved signering av kontrakt'}
              </Alert>
            )}

            {signContractMutation.isSuccess && (
              <Alert severity="success" sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Kontrakten er signert!
                </Typography>
                Du vil motta en bekreftelse på e-post med kopi av den signerte kontrakten.
              </Alert>
            )}

            {/* Legal Notice */}
            <Paper variant="outlined" sx={{ ...theming.getThemedCardSx(), p: 3, backgroundColor: 'info.50' }}>
              <Typography variant="body2" color="textSecondary" align="center">
                <strong>Juridisk erklæring: </strong>
                <br />
                Ved å signere denne kontrakten aksepterer du alle vilkårene som er beskrevet. Denne
                digitale signaturen er juridisk bindende i henhold til norsk lov og EU
                eIDAS-forordningen.
                <br />
                <br />
                <strong>Personvern:</strong> Dine personopplysninger behandles i henhold til GDPR.
                Kontakten lagres sikkert og deles kun med relevante parter for gjennomføring av
                tjenesten.
              </Typography>
            </Paper>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}

export default ContractSigningPage;
