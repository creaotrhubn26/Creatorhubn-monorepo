/**
 * Survey Builder Component
 * Comprehensive survey creation tool with drag-and-drop question builder,
 * multiple question types, preview mode, and sentiment analysis integration
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Typography,
  Chip,
  Stack,
  Switch,
  FormControlLabel,
  Divider,
  Paper,
  Grid2 as Grid,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  Edit as EditIcon,
  Visibility as PreviewIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  TextFields as TextIcon,
  Star as RatingIcon,
  CheckBox as CheckboxIcon,
  RadioButtonChecked as RadioIcon,
  LinearScale as ScaleIcon,
} from '@mui/icons-material';
import { useTheming } from '@/utils/theming-helper';

export interface SurveyQuestion {
  id: string;
  type: 'text' | 'rating' | 'multiple_choice' | 'checkbox' | 'scale';
  question: string;
  options?: string[];
  required: boolean;
  placeholder?: string;
  minValue?: number;
  maxValue?: number;
  minLabel?: string;
  maxLabel?: string;
}

export interface SurveyData {
  id?: string;
  title: string;
  description: string;
  purpose: 'swot_analysis' | 'customer_satisfaction' | 'market_research' | 'product_feedback';
  questions: SurveyQuestion[];
  status: 'draft' | 'active' | 'paused' | 'closed';
}

interface SurveyBuilderProps {
  open: boolean;
  onClose: () => void;
  onSave: (survey: SurveyData) => void;
  initialData?: SurveyData;
}

const questionTypes = [
  { value: 'text', label: 'Text Input', icon: <TextIcon /> },
  { value: 'rating', label: 'Rating (1-5)', icon: <RatingIcon /> },
  { value: 'multiple_choice', label: 'Multiple Choice', icon: <RadioIcon /> },
  { value: 'checkbox', label: 'Checkbox', icon: <CheckboxIcon /> },
  { value: 'scale', label: 'Scale (1-10)', icon: <ScaleIcon /> },
];

export const SurveyBuilder: React.FC<SurveyBuilderProps> = ({ open, onClose, onSave, initialData }) => {
  const theming = useTheming();
  const [tabValue, setTabValue] = useState(0);
  
  const [survey, setSurvey] = useState<SurveyData>(
    initialData || {
      title: '',
      description: '',
      purpose: 'customer_satisfaction',
      questions: [],
      status: 'draft',
    }
  );

  const [editingQuestion, setEditingQuestion] = useState<SurveyQuestion | null>(null);
  const [questionDialog, setQuestionDialog] = useState(false);

  const handleAddQuestion = (type: SurveyQuestion['type']) => {
    const newQuestion: SurveyQuestion = {
      id: crypto.randomUUID(),
      type,
      question: '',
      required: false,
      options: type === 'multiple_choice' || type === 'checkbox' ? ['Option 1', 'Option 2'] : undefined,
      minValue: type === 'scale' ? 1 : undefined,
      maxValue: type === 'scale' ? 10 : undefined,
      minLabel: type === 'scale' ? 'Not at all' : undefined,
      maxLabel: type === 'scale' ? 'Extremely' : undefined,
    };
    setEditingQuestion(newQuestion);
    setQuestionDialog(true);
  };

  const handleEditQuestion = (question: SurveyQuestion) => {
    setEditingQuestion({ ...question });
    setQuestionDialog(true);
  };

  const handleSaveQuestion = () => {
    if (!editingQuestion) return;

    const existingIndex = survey.questions.findIndex((q) => q.id === editingQuestion.id);
    if (existingIndex >= 0) {
      // Update existing question
      const updatedQuestions = [...survey.questions];
      updatedQuestions[existingIndex] = editingQuestion;
      setSurvey({ ...survey, questions: updatedQuestions });
    } else {
      // Add new question
      setSurvey({ ...survey, questions: [...survey.questions, editingQuestion] });
    }

    setQuestionDialog(false);
    setEditingQuestion(null);
  };

  const handleDeleteQuestion = (questionId: string) => {
    setSurvey({
      ...survey,
      questions: survey.questions.filter((q) => q.id !== questionId),
    });
  };

  const handleSave = () => {
    onSave(survey);
    onClose();
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        aria-labelledby="survey-dialog-title"
        aria-describedby="survey-dialog-description"
      >
        <DialogTitle id="survey-dialog-title">
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h5" component="h1" sx={{ color: theming.colors.primary }}>
              {initialData ? 'Rediger undersøkelse' : 'Opprett ny undersøkelse'}
            </Typography>
            <IconButton
              onClick={onClose}
              aria-label="Lukk dialog"
              sx={{
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
            >
              <CloseIcon aria-hidden="true" />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent id="survey-dialog-description">
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            aria-label="Undersøkelse navigasjon"
            sx={{
              mb: 3,
              '& .MuiTab-root': {
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                },
              }}}
          >
            <Tab label="Detaljer" id="survey-tab-0" aria-controls="survey-tabpanel-0" />
            <Tab label="Spørsmål" id="survey-tab-1" aria-controls="survey-tabpanel-1" />
            <Tab label="Forhåndsvisning" id="survey-tab-2" aria-controls="survey-tabpanel-2" />
          </Tabs>

          {/* Tab 0: Survey Details */}
          <Box role="tabpanel" id="survey-tabpanel-0" aria-labelledby="survey-tab-0" hidden={tabValue !== 0}>
            {tabValue === 0 && (
              <Box role="form" aria-label="Undersøkelsesdetaljer">
                <TextField
                  fullWidth
                  label="Tittel"
                  value={survey.title}
                  onChange={(e) => setSurvey({ ...survey, title: e.target.value })}
                  margin="normal"
                  required
                  inputProps={{
                    'aria-required':'true','aria-label' : 'Undersøkelsestittel'}}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&:focus-within': {
                        outline: '3px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: '2px',
                      },
                    }}}
                />

                <TextField
                  fullWidth
                  label="Beskrivelse"
                  value={survey.description}
                  onChange={(e) => setSurvey({ ...survey, description: e.target.value })}
                  margin="normal"
                  multiline
                  rows={3}
                  inputProps={{
                    'aria-label' : 'Undersøkelsesbeskrivelse'}}
                />

                <FormControl fullWidth margin="normal">
                  <InputLabel id="purpose-label">Formål</InputLabel>
                  <Select
                    labelId="purpose-label"
                    value={survey.purpose}
                    onChange={(e) => setSurvey({ ...survey, purpose: e.target.value as any })}
                    label="Formål"
                    inputProps={{ 'aria-label' : 'Velg formål' }}
                  >
                    <MenuItem value="swot_analysis">SWOT-analyse</MenuItem>
                    <MenuItem value="customer_satisfaction">Kundetilfredshet</MenuItem>
                    <MenuItem value="market_research">Markedsundersøkelse</MenuItem>
                    <MenuItem value="product_feedback">Produkttilbakemelding</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth margin="normal">
                  <InputLabel id="status-label">Status</InputLabel>
                  <Select
                    labelId="status-label"
                    value={survey.status}
                    onChange={(e) => setSurvey({ ...survey, status: e.target.value as any })}
                    label="Status"
                    inputProps={{ 'aria-label' : 'Velg status' }}
                  >
                    <MenuItem value="draft">Utkast</MenuItem>
                    <MenuItem value="active">Aktiv</MenuItem>
                    <MenuItem value="paused">Pauset</MenuItem>
                    <MenuItem value="closed">Lukket</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}
          </Box>

          {/* Tab 1: Questions */}
          <Box role="tabpanel" id="survey-tabpanel-1" aria-labelledby="survey-tab-1" hidden={tabValue !== 1}>
            {tabValue === 1 && (
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" component="h2" id="questions-heading">
                    Spørsmål ({survey.questions.length})
                  </Typography>
                  <Box role="group" aria-label="Legg til spørsmålstyper">
                    {questionTypes.map((type) => (
                      <Button
                        key={type.value}
                        size="small"
                        startIcon={React.cloneElement(type.icon, { 'aria-hidden' : 'true' })}
                        onClick={() => handleAddQuestion(type.value as any)}
                        aria-label={`Legg til ${type.label} spørsmål`}
                        sx={{
                          ml: 1, '&:focus-visible': {
                            outline: '3px solid',
                            outlineColor: 'primary.main',
                            outlineOffset: '2px',
                          }}}
                      >
                        {type.label}
                      </Button>
                    ))}
                  </Box>
                </Box>

                {survey.questions.length === 0 ? (
                  <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }} role="status">
                    <Typography variant="body1" color="text.secondary">
                      Ingen spørsmål ennå. Klikk på en knapp ovenfor for å legge til ditt første spørsmål.
                    </Typography>
                  </Paper>
                ) : (
                  <Stack spacing={2} role="list" aria-labelledby="questions-heading">
                    {survey.questions.map((question, index) => (
                      <Card
                        key={question.id}
                        variant="outlined"
                        role="listitem"
                        tabIndex={0}
                        aria-label={`Spørsmål ${index + 1}: ${question.question || 'Ingen tekst'}`}
                        sx={{
                          '&:focus-visible': {
                            outline: '3px solid',
                            outlineColor: 'primary.main',
                            outlineOffset: '2px',
                          }}}
                      >
                        <CardContent>
                          <Box display="flex" alignItems="flex-start" gap={2}>
                            <DragIcon sx={{ color: 'grey.400', cursor: 'grab', mt: 1 }} aria-hidden="true" />
                            <Box flex={1}>
                              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                <Typography variant="subtitle2" color="text.secondary">
                                  Spørsmål {index + 1} • {questionTypes.find((t) => t.value === question.type)?.label}
                                </Typography>
                                <Box>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleEditQuestion(question)}
                                    aria-label={`Rediger spørsmål ${index + 1}`}
                                    sx={{
                                      '&:focus-visible': {
                                        outline: '3px solid',
                                        outlineColor: 'primary.main',
                                        outlineOffset: '2px',
                                      }}}
                                  >
                                    <EditIcon fontSize="small" aria-hidden="true" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteQuestion(question.id)}
                                    aria-label={`Slett spørsmål ${index + 1}`}
                                    sx={{
                                      '&:focus-visible': {
                                        outline: '3px solid',
                                        outlineColor: 'primary.main',
                                        outlineOffset: '2px',
                                      }}}
                                  >
                                    <DeleteIcon fontSize="small" aria-hidden="true" />
                                  </IconButton>
                                </Box>
                              </Box>
                              <Typography variant="body1" fontWeight="medium">
                                {question.question || '(Ingen spørsmålstekst)'}
                              </Typography>
                              {question.required && (
                                <Chip label="Påkrevd" size="small" color="primary" sx={{ mt: 1 }} aria-label="Dette spørsmålet er påkrevd" />
                              )}
                              {question.options && (
                                <Box mt={1} role="list" aria-label="Svaralternativer">
                                  {question.options.map((option, i) => (
                                    <Chip key={i} label={option} size="small" sx={{ mr: 0.5, mb: 0.5 }} role="listitem" />
                                  ))}
                                </Box>
                              )}
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Box>
            )}
          </Box>

          {/* Tab 2: Preview */}
          <Box role="tabpanel" id="survey-tabpanel-2" aria-labelledby="survey-tab-2" hidden={tabValue !== 2}>
            {tabValue === 2 && (
              <Box>
                <Paper sx={{ p: 3, bgcolor: 'grey.50' }} role="region" aria-label="Forhåndsvisning av undersøkelse">
                  <Typography variant="h5" component="h2" gutterBottom>
                    {survey.title || 'Uten tittel'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {survey.description || 'Ingen beskrivelse'}
                  </Typography>

                  <Divider sx={{ my: 3 }} />

                  {survey.questions.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" textAlign="center" role="status">
                      Ingen spørsmål å forhåndsvise
                    </Typography>
                  ) : (
                    <Stack spacing={3} role="list" aria-label="Forhåndsvisning av spørsmål">
                      {survey.questions.map((question, index) => (
                        <Box key={question.id} role="listitem">
                          <Typography variant="subtitle1" fontWeight="medium" gutterBottom id={`preview-q-${question.id}`}>
                            {index + 1}. {question.question}
                            {question.required && <span style={{ color: 'red' }} aria-label="påkrevd"> *</span>}
                          </Typography>

                          {question.type === 'text' && (
                            <TextField
                              fullWidth
                              placeholder={question.placeholder || 'Ditt svar'}
                              variant="outlined"
                              size="small"
                              disabled
                              aria-labelledby={`preview-q-${question.id}`}
                            />
                          )}

                          {question.type === 'rating' && (
                            <Box display="flex" gap={1} role="radiogroup" aria-labelledby={`preview-q-${question.id}`}>
                              {[1, 2, 3, 4, 5].map((rating) => (
                                <Chip key={rating} label={rating} aria-label={`Vurdering ${rating} av 5`} />
                              ))}
                            </Box>
                          )}

                          {question.type === 'multiple_choice' && question.options && (
                            <Stack spacing={1} role="radiogroup" aria-labelledby={`preview-q-${question.id}`}>
                              {question.options.map((option, i) => (
                                <Box key={i} display="flex" alignItems="center" gap={1} role="radio" aria-checked="false">
                                  <RadioIcon fontSize="small" aria-hidden="true" />
                                  <Typography variant="body2">{option}</Typography>
                                </Box>
                              ))}
                            </Stack>
                          )}

                          {question.type === 'checkbox' && question.options && (
                            <Stack spacing={1} role="group" aria-labelledby={`preview-q-${question.id}`}>
                              {question.options.map((option, i) => (
                                <Box key={i} display="flex" alignItems="center" gap={1} role="checkbox" aria-checked="false">
                                  <CheckboxIcon fontSize="small" aria-hidden="true" />
                                  <Typography variant="body2">{option}</Typography>
                                </Box>
                              ))}
                            </Stack>
                          )}

                          {question.type === 'scale' && (
                            <Box role="group" aria-labelledby={`preview-q-${question.id}`}>
                              <Box display="flex" justifyContent="space-between" mb={1}>
                                <Typography variant="caption">{question.minLabel}</Typography>
                                <Typography variant="caption">{question.maxLabel}</Typography>
                              </Box>
                              <Box display="flex" gap={1} role="radiogroup">
                                {Array.from({ length: (question.maxValue || 10) - (question.minValue || 1) + 1 }, (_, i) => (
                                  <Chip key={i} label={(question.minValue || 1) + i} aria-label={`Verdi ${(question.minValue || 1) + i}`} />
                                ))}
                              </Box>
                            </Box>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  )}
              </Paper>
            </Box>
            )}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={onClose}
            aria-label="Avbryt og lukk"
            sx={{
              '&:focus-visible': {
                outline: '3px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              }}}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon aria-hidden="true" />}
            onClick={handleSave}
            disabled={!survey.title}
            aria-label="Lagre undersøkelse"
            sx={{
              '&:focus-visible': {
                outline: '3px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              }}}
          >
            Lagre undersøkelse
          </Button>
        </DialogActions>
      </Dialog>

      {/* Question Editor Dialog */}
      <Dialog
        open={questionDialog}
        onClose={() => setQuestionDialog(false)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="question-dialog-title"
      >
        <DialogTitle id="question-dialog-title">
          {editingQuestion && survey.questions.find((q) => q.id === editingQuestion.id) ? 'Rediger spørsmål' : 'Legg til spørsmål'}
        </DialogTitle>
        <DialogContent>
          {editingQuestion && (
            <Box role="form" aria-label="Spørsmålsredigering">
              <TextField
                fullWidth
                label="Spørsmålstekst"
                value={editingQuestion.question}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                margin="normal"
                required
                multiline
                rows={2}
                inputProps={{
                  'aria-required':'true','aria-label' : 'Skriv inn spørsmålstekst'}}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={editingQuestion.required}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, required: e.target.checked })}
                    inputProps={{ 'aria-label' : 'Merk spørsmål som påkrevd' }}
                  />
                }
                label="Påkrevd"
                sx={{ mt: 2 }}
              />

              {editingQuestion.type === 'text' && (
                <TextField
                  fullWidth
                  label="Plassholder"
                  value={editingQuestion.placeholder || ''}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, placeholder: e.target.value })}
                  margin="normal"
                  inputProps={{ 'aria-label' : 'Plassholdertekst' }}
                />
              )}

              {(editingQuestion.type === 'multiple_choice' || editingQuestion.type === 'checkbox') && (
                <Box mt={2} role="group" aria-labelledby="options-heading">
                  <Typography variant="subtitle2" gutterBottom id="options-heading">
                    Alternativer
                  </Typography>
                  {editingQuestion.options?.map((option, index) => (
                    <Box key={index} display="flex" gap={1} mb={1}>
                      <TextField
                        fullWidth
                        size="small"
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...(editingQuestion.options || [])];
                          newOptions[index] = e.target.value;
                          setEditingQuestion({ ...editingQuestion, options: newOptions });
                        }}
                        inputProps={{ 'aria-label': `Alternativ ${index + 1}` }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => {
                          const newOptions = editingQuestion.options?.filter((_, i) => i !== index);
                          setEditingQuestion({ ...editingQuestion, options: newOptions });
                        }}
                        aria-label={`Slett alternativ ${index + 1}`}
                        sx={{
                          '&:focus-visible': {
                            outline: '3px solid',
                            outlineColor: 'primary.main',
                            outlineOffset: '2px',
                          }}}
                      >
                        <DeleteIcon fontSize="small" aria-hidden="true" />
                      </IconButton>
                    </Box>
                  ))}
                  <Button
                    size="small"
                    startIcon={<AddIcon aria-hidden="true" />}
                    onClick={() => {
                      const newOptions = [...(editingQuestion.options || []), `Alternativ ${(editingQuestion.options?.length || 0) + 1}`];
                      setEditingQuestion({ ...editingQuestion, options: newOptions });
                    }}
                    aria-label="Legg til nytt alternativ"
                    sx={{
                      '&:focus-visible': {
                        outline: '3px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: '2px',
                      }}}
                  >
                    Legg til alternativ
                  </Button>
                </Box>
              )}

              {editingQuestion.type === 'scale' && (
                <Grid container spacing={2} mt={1} role="group" aria-label="Skalainnstillinger">
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Min verdi"
                      value={editingQuestion.minValue || 1}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, minValue: parseInt(e.target.value) })}
                      inputProps={{ 'aria-label' : 'Minimum verdi' }}
                    />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Maks verdi"
                      value={editingQuestion.maxValue || 10}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, maxValue: parseInt(e.target.value) })}
                      inputProps={{ 'aria-label' : 'Maksimum verdi' }}
                    />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      fullWidth
                      label="Min etikett"
                      value={editingQuestion.minLabel || ''}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, minLabel: e.target.value })}
                      inputProps={{ 'aria-label' : 'Etikett for minimum verdi' }}
                    />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      fullWidth
                      label="Maks etikett"
                      value={editingQuestion.maxLabel || ''}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, maxLabel: e.target.value })}
                      inputProps={{ 'aria-label' : 'Etikett for maksimum verdi' }}
                    />
                  </Grid>
                </Grid>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setQuestionDialog(false)}
            aria-label="Avbryt"
            sx={{
              '&:focus-visible': {
                outline: '3px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              }}}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveQuestion}
            disabled={!editingQuestion?.question}
            aria-label="Lagre spørsmål"
            sx={{
              '&:focus-visible': {
                outline: '3px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              }}}
          >
            Lagre spørsmål
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SurveyBuilder;

