// @ts-nocheck
import { useState, type ChangeEvent, type FC } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Alert, LinearProgress, Stack, Paper, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip } from "@mui/material";
import { FileUpload as FileUploadIcon, CheckCircle as CheckCircleIcon, Error as ErrorIcon, Info as InfoIcon } from "@mui/icons-material";
import type { ManuscriptExport } from "../models/casting";
import { manuscriptService } from "../services/manuscriptService";
import { useToast } from "./ToastStack";
import { useT } from '../../../i18n';

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
  const { t } = useT();
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
      showSuccess(t('importMs.fileLoadedToast'));
    } else {
      setErrors([result.error || t('importMs.unknownErrorFallback')]);
      showError(result.error || t('importMs.readJsonErrorFallback'));
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
      showSuccess(t('importMs.importSuccessToast'));
      
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
      const errorMsg = error instanceof Error ? error.message : t('importMs.importFailedFallback');
      setErrors([errorMsg]);
      showError(errorMsg);
      setStep('preview');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('importMs.dialogTitle')}</DialogTitle>
      <DialogContent>
        {/* Upload Step */}
        {step === 'upload' && (
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Alert severity="info" icon={<InfoIcon />}>
              {t('importMs.uploadInfo')}
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
                {t('importMs.dropzoneText')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('importMs.dropzoneFormat')}
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
                <Typography variant="subtitle2">{t('importMs.validationErrorsTitle')}</Typography>
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
                  {t('importMs.validSuccess')}
                </Alert>

                {/* Metadata */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      {t('importMs.metadataHeading')}
                    </Typography>
                    <Stack spacing={1}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          {t('importMs.titleLabel')}
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {importData.metadata.title}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          {t('importMs.authorLabel')}
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {importData.metadata.author || '-'}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          {t('importMs.formatLabel')}
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {importData.metadata.format}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          {t('importMs.exportedLabel')}
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
                      {t('importMs.contentHeading')}
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell>{t('importMs.scenesLabel')}</TableCell>
                            <TableCell align="right">
                              <Chip label={importData.statistics.sceneCount} size="small" />
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>{t('importMs.actsLabel')}</TableCell>
                            <TableCell align="right">
                              <Chip label={importData.acts.length} size="small" />
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>{t('importMs.charactersLabel')}</TableCell>
                            <TableCell align="right">
                              <Chip label={importData.statistics.characterCount} size="small" />
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>{t('importMs.dialogueLinesLabel')}</TableCell>
                            <TableCell align="right">
                              <Chip label={importData.dialogueLines.length} size="small" />
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>{t('importMs.revisionsLabel')}</TableCell>
                            <TableCell align="right">
                              <Chip label={importData.revisions.length} size="small" />
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>{t('importMs.estimatedRuntimeLabel')}</TableCell>
                            <TableCell align="right">
                              <Chip
                                label={t('importMs.runtimeMinutes', { minutes: Math.round(importData.statistics.estimatedRuntime) })}
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
                  {t('importMs.newIdsWarning')}
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
              {t('importMs.importingText')}
            </Typography>
          </Stack>
        )}

        {/* Confirm Step */}
        {step === 'confirm' && (
          <Stack spacing={2} sx={{ mt: 2, textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main' }} />
            <Typography variant="h6">{t('importMs.importCompleteHeading')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('importMs.importCompleteBody')}
            </Typography>
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        {step === 'upload' && (
          <Button onClick={onClose}>{t('importMs.cancelButton')}</Button>
        )}

        {step === 'preview' && errors.length === 0 && (
          <>
            <Button onClick={() => { setStep('upload'); setFile(null); setImportData(null); setErrors([]); }}>
              {t('importMs.chooseAnotherFile')}
            </Button>
            <Button onClick={handleImport} variant="contained" disabled={isLoading}>
              {t('importMs.importButton')}
            </Button>
          </>
        )}

        {step === 'preview' && errors.length > 0 && (
          <Button onClick={() => { setStep('upload'); setFile(null); setImportData(null); setErrors([]); }}>
            {t('importMs.cancelButton')}
          </Button>
        )}

        {step === 'confirm' && (
          <Button onClick={onClose} variant="contained">
            {t('importMs.closeButton')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ImportManuscriptDialog;
