// AdminProffAnalysis.tsx - Admin-only component for detailed business analysis with red flags
import { useTheming } from '../utils/theming-helper';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  Chip,
  Grid,
  Paper,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  AttachMoney as MoneyIcon,
  Flag as FlagIcon
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface ProffRiskIndicator {
  type: 'payment_default' | 'debt_collection' | 'forced_liquidation' | 'bankruptcy_history' | 'tax_debt';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  date?: string;
  amount?: number
}

interface ProffAnalysisData {
  organizationNumber: string;
  companyName: string;
  status: 'active' | 'inactive' | 'bankruptcy' | 'liquidation';
  revenue?: {
    year: number;
    amount: number;
    currency: string;
};
  employees?: number;
  riskIndicators: ProffRiskIndicator[];
  adminFlags: {
    highRisk: boolean;
    paymentIssues: boolean;
    bankruptcyHistory: boolean;
    debtCollection: boolean;
    taxDebt: boolean;
    liquidationRisk: boolean;
};
  approvalRecommendation: 'approve' | 'review' | 'reject';
  analysisTimestamp: string
}

interface AdminProffAnalysisProps {
  open: boolean;
  onClose: () => void;
  organizationNumber: string;
  onAnalysisComplete?: (data: ProffAnalysisData) => void
}

export const AdminProffAnalysis: React.FC<AdminProffAnalysisProps> = ({
  open,
  onClose,
  organizationNumber,
  onAnalysisComplete
}) => {
  const [loading, setLoading] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer, ');
  const [analysisData, setAnalysisData] = useState<ProffAnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const performAnalysis = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest(`/api/admin/proff/company/${organizationNumber}?adminUserId=user?.email`);
      
      if (response.success) {
        setAnalysisData(response.data);
        onAnalysisComplete?.(response.data);
    } else {
        setError(response.error || 'Feil ved henting av detaljert analyse');
    }
  } catch (err: any) {
      setError(err.message || 'Teknisk feil ved analyse');
} finally {
      setLoading(false);
  }
};

  React.useEffect(() => {
    if (open && organizationNumber) {
      performAnalysis();
  }
}, [open, organizationNumber]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
}
};

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'approve': return 'success';
      case 'review': return 'warning';
      case 'reject': return 'error';
      default: return 'default';
}
};

  const getRecommendationText = (recommendation: string) => {
    switch (recommendation) {
      case 'approve': return 'GODKJENN';
      case 'review': return 'GJENNOMGANG';
      case 'reject': return 'AVVIS';
      default: return 'UKJENT';
}
};

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <BusinessIcon />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Admin: Detaljert Bedriftsanalyse
          </Typography>
        </Box>
        <Typography variant="body2" color="textSecondary">
          Org.nr: {organizationNumber} | Kilde: Proff.no
        </Typography>
      </DialogTitle>

      <DialogContent>
        {loading && (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>Analyserer bedriftsinformasjon...</Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb:  2 }}>
            {error}
          </Alert>
        )}

        {analysisData && (
          <Box>
            {/* Company Basic Info */}
            <Paper sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                {analysisData.companyName}
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs:  6 }}>
                  <Typography variant="body2" color="textSecondary">Status</Typography>
                  <Chip 
                    label={analysisData.status.toUpperCase()}
                    color={analysisData.status === 'active' ? 'success' : 'error'}
                    size="small" 
                  />
                </Grid>
                <Grid size={{ xs:  6 }}>
                  <Typography variant="body2" color="textSecondary">Ansatte</Typography>
                  <Typography>{analysisData.employees || 'Ukjent'}</Typography>
                </Grid>
              </Grid>
            </Paper>

            {/* Admin Flags */}
            <Paper sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom color="error" sx={{ color: theming.colors.primary }}>
                <FlagIcon sx={{ mr:  1 }} />
                Administrative Røde Flagg
              </Typography>
              <Grid container spacing={1}>
                {Object.entries(analysisData.adminFlags).map(([key, value]) => (
                  <Grid size={{ xs:  6 }} key={key}>
                    <Box display="flex" alignItems="center">
                      {value ? <ErrorIcon color="error" /> : <CheckIcon color="success" />}
                      <Typography sx={{ ml:  1 }} variant="body2">
                        {key === 'highRisk' && 'Høy risiko'}
                        {key === 'paymentIssues' && 'Betalingsproblemer'}
                        {key === 'bankruptcyHistory' && 'Konkurshistorikk'}
                        {key === 'debtCollection' && 'Inkasso'}
                        {key === 'taxDebt' && 'Skattegjeld'}
                        {key === 'liquidationRisk' &&'Avviklingsrisiko'}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Paper>

            {/* Risk Indicators */}
            {analysisData.riskIndicators.length > 0 && (
              <Paper sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom color="warning.main" sx={{ color: theming.colors.primary }}>
                  <WarningIcon sx={{ mr:  1 }} />
                  Risikoindikatorer ({analysisData.riskIndicators.length})
                </Typography>
                <List dense>
                  {analysisData.riskIndicators.map((risk, index) => (
                    <React.Fragment key={index}>
                      <ListItem>
                        <ListItemIcon>
                          <Chip 
                            label={risk.severity}
                            color={getSeverityColor(risk.severity) as any}
                            size="small" 
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={risk.description}
                          secondary={
                            <>
                              Type: {risk.type}
                              {risk.date && ` | Dato: ${new Date(risk.date).toLocaleDateString(', ')}`}
                              {risk.amount && ` | Beløp: ${risk.amount.toLocaleString('')} NOK`}
                            </>
                        }
                        />
                      </ListItem>
                      {index < analysisData.riskIndicators.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              </Paper>
            )}

            {/* Approval Recommendation */}
            <Alert 
              severity={getRecommendationColor(analysisData.approvalRecommendation) as any}
              sx={{ mb:  2 }}
            >
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                Anbefaling: {getRecommendationText(analysisData.approvalRecommendation)}
              </Typography>
              <Typography variant="body2">
                Basert på {analysisData.riskIndicators.length} risikofaktorer og bedriftsstatus.
                Analyse utført: {new Date(analysisData.analysisTimestamp).toLocaleString(', ')}
              </Typography>
            </Alert>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Lukk
        </Button>
        {analysisData && (
          <Button variant="contained" 
            color={getRecommendationColor(analysisData.approvalRecommendation) as any}
            onClick={() => {
              // Handle approval decision
              console.log('Admin decision:', analysisData.approvalRecommendation);
              onClose();
          }}
          >
            {getRecommendationText(analysisData.approvalRecommendation)}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AdminProffAnalysis;