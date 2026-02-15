import { useState } from 'react';
import type { ChangeEvent, FC } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  LinearProgress,
  Stack,
  Paper,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import {
  FileUpload as FileUploadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { ManuscriptExport } from '../models/casting';
import { manuscriptService } from '../services/manuscriptService';
import { useToast } from './ToastStack';

interface ImportManuscriptDialogProps {
  open: boolean;
  onClose: () => void;
  onImportComplete?: (exportData: ManuscriptExport) => void;
}

type ImportStep = 'upload' | 'preview' | 'confirm' | 'importing';

export const ImportManuscriptDialog: FC<ImportManuscriptDialogProps> = ({
  open,
  onClose,
  onImportComplete,
}) => {
  const { showSuccess, showError, showWarning } = useToast();
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<ManuscriptExport | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setIsLoading(true);
    setErrors([]);

    const result = await manuscriptService.importManuscriptFromJSON(selectedFile);

    if (result.success && result.data) {
      setFile(selectedFile);
      setImportData(result.data);
      setStep('preview');
      showSuccess('Fil lastet inn - Kontroller data før import');
    } else {
      setErrors([result.error || 'Ukjent feil']);
      showError(result.error || 'Kunne ikke lese JSON-fil');
    }

    setIsLoading(false);
  };

  const handleImport = async () => {
    if (!importData) return;

    setStep('importing');
    setIsLoading(true);

    try {
      const restored = await manuscriptService.restoreFromExport(importData);
      
      // Update importData with restored IDs
      const updatedData: ManuscriptExport = {
        ...importData,
        manuscript: restored.manuscript,
        acts: restored.acts,
        scenes: restored.scenes,
        dialogueLines: restored.dialogueLines,
        revisions: restored.revisions,
      };

      setImportData(updatedData);
      setStep('confirm');
      showSuccess('Manuskript importert med nye ID-er');
      
      if (onImportComplete) {
        onImportComplete(updatedData);
      }

      setTimeout(() => {
        onClose();
        setStep('upload');
        setFile(null);
        setImportData(null);
      }, 1500);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Import feilet';
      setErrors([errorMsg]);
      showError(errorMsg);
      setStep('preview');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Importer Manuskript fra JSON</DialogTitle>
      <DialogContent>
        {/* Upload Step */}
        {step === 'upload' && (
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Alert severity="info" icon={<InfoIcon />}>
              Last opp en JSON-fil eksportert fra Manuskript-systemet.
            </Alert>

            <Paper
              sx={{
                p: 4,
                textAlign: 'center',
                border: '2px dashed',
                borderColor: 'divider',
                bgcolor: 'action.hover',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.selected',
                },
              }}
              component="label"
            >
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                disabled={isLoading}
              />
              <FileUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body1" sx={{ mb: 1 }}>
                Klikk for å velge fil eller dra fil hit
              </Typography>
              <Typography variant="caption" color="text.secondary">
                .json format (JSON)
              </Typography>
            </Paper>

            {isLoading && <LinearProgress />}
          </Stack>
        )}

        {/* Preview Step */}
        {step === 'preview' && importData && (
          <Stack spacing={3} sx={{ mt: 2 }}>
            {errors.length > 0 && (
              <Alert severity="error">
                <Typography variant="subtitle2">Feil ved validering:</Typography>
                <ul style={{ margin: '8px 0' }}>
                  {errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </Alert>
            )}

            {errors.length === 0 && (
              <>
                <Alert severity="success" icon={<CheckCircleIcon />}>
                  JSON-fil validert og klar for import
                </Alert>

                {/* Metadata */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Metadata
                    </Typography>
                    <Stack spacing={1}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Tittel:
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {importData.metadata.title}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Forfatter:
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {importData.metadata.author || '-'}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Format:
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {importData.metadata.format}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Eksportert:
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {new Date(importData.exportedAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>

                {/* Statistics */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Innhold
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell>Scener</TableCell>
                            <TableCell align="right">
                              <Chip label={importData.statistics.sceneCount} size="small" />
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Akter</TableCell>
                            <TableCell align="right">
                              <Chip label={importData.acts.length} size="small" />
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Karakterer</TableCell>
                            <TableCell align="right">
                              <Chip label={importData.statistics.characterCount} size="small" />
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Dialogue linjer</TableCell>
                            <TableCell align="right">
                              <Chip label={importData.dialogueLines.length} size="small" />
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Revisions</TableCell>
                            <TableCell align="right">
                              <Chip label={importData.revisions.length} size="small" />
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Estimert runtime</TableCell>
                            <TableCell align="right">
                              <Chip
                                label={`${Math.round(importData.statistics.estimatedRuntime)} min`}
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>

                <Alert severity="warning" icon={<InfoIcon />}>
                  Nye ID-er vil genereres for alle elementer for å unngå konflikter.
                  De originale ID-ene bevares i historikken.
                </Alert>
              </>
            )}

            {isLoading && <LinearProgress />}
          </Stack>
        )}

        {/* Importing Step */}
        {step === 'importing' && (
          <Stack spacing={2} sx={{ mt: 2, textAlign: 'center' }}>
            <LinearProgress />
            <Typography variant="body2" color="text.secondary">
              Importerer manuskript...
            </Typography>
          </Stack>
        )}

        {/* Confirm Step */}
        {step === 'confirm' && (
          <Stack spacing={2} sx={{ mt: 2, textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main' }} />
            <Typography variant="h6">Importering fullført!</Typography>
            <Typography variant="body2" color="text.secondary">
              Manuskriptet er klar for bruk. Lukk dialogen for å fortsette.
            </Typography>
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        {step === 'upload' && (
          <Button onClick={onClose}>Avbryt</Button>
        )}

        {step === 'preview' && errors.length === 0 && (
          <>
            <Button onClick={() => { setStep('upload'); setFile(null); setImportData(null); setErrors([]); }}>
              Velg annen fil
            </Button>
            <Button onClick={handleImport} variant="contained" disabled={isLoading}>
              Importer
            </Button>
          </>
        )}

        {step === 'preview' && errors.length > 0 && (
          <Button onClick={() => { setStep('upload'); setFile(null); setImportData(null); setErrors([]); }}>
            Avbryt
          </Button>
        )}

        {step === 'confirm' && (
          <Button onClick={onClose} variant="contained">
            Lukk
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ImportManuscriptDialog;
