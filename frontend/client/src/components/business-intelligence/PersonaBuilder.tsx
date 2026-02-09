/**
 * PersonaBuilder Component
 * Comprehensive persona creation interface with personality traits, demographics, and preferences
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Slider,
  Button,
  Avatar,
  Chip,
  IconButton,
  Divider,
} from '@mui/material';
import Grid2 from '@mui/material/Grid2';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Person as PersonIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

export interface PersonaData {
  id?: string;
  name: string;
  age: number;
  location: string;
  occupation: string;
  family: string;
  income: string;
  bio: string;
  goals: string[];
  frustrations: string[];
  personality: {
    introvert: number;
    sensing: number;
    thinking: number;
    judging: number;
  };
  social: {
    growth: number;
    power: number;
    social: number;
  };
  preferredChannels: {
    traditionalAds: number;
    socialMedia: number;
    referral: number;
    email: number;
  };
  preferredBrands: string[];
  avatarColor?: string;
}

interface PersonaBuilderProps {
  persona?: PersonaData;
  onSave: (persona: PersonaData) => void;
  onCancel: () => void;
}

const AVATAR_COLORS = [
  '#ff6b6b','#4ecdc4','#45b7d1','#f9ca24','#6c5ce7','#a29bfe','#fd79a8','#fdcb6e','#e17055','#74b9ff'
];

export default function PersonaBuilder({ persona, onSave, onCancel }: PersonaBuilderProps) {
  const theming = useTheming('photographer');

  const [formData, setFormData] = useState<PersonaData>(persona || {
    name: '',
    age: 35,
    location: '',
    occupation: '',
    family: '',
    income: '',
    bio: '',
    goals: [''],
    frustrations: [''],
    personality: {
      introvert: 50,
      sensing: 50,
      thinking: 50,
      judging: 50,
    },
    social: {
      growth: 50,
      power: 50,
      social: 50,
    },
    preferredChannels: {
      traditionalAds: 30,
      socialMedia: 50,
      referral: 60,
      email: 40,
    },
    preferredBrands: [],
    avatarColor: AVATAR_COLORS[0],
  });

  const [newBrand, setNewBrand] = useState('');

  const handleChange = <K extends keyof PersonaData>(field: K, value: PersonaData[K]) => {
    setFormData({ ...formData, [field]: value });
  };

  const handlePersonalityChange = (trait: keyof PersonaData['personality'], value: number) => {
    setFormData({
      ...formData,
      personality: { ...formData.personality, [trait]: value },
    });
  };

  const handleSocialChange = (trait: keyof PersonaData['social'], value: number) => {
    setFormData({
      ...formData,
      social: { ...formData.social, [trait]: value },
    });
  };

  const handleChannelChange = (channel: keyof PersonaData['preferredChannels'], value: number) => {
    setFormData({
      ...formData,
      preferredChannels: { ...formData.preferredChannels, [channel]: value },
    });
  };

  const handleArrayChange = (field: 'goals' | 'frustrations', index: number, value: string) => {
    const newArray = [...formData[field]];
    newArray[index] = value;
    setFormData({ ...formData, [field]: newArray });
  };

  const addArrayItem = (field: 'goals' | 'frustrations') => {
    setFormData({ ...formData, [field]: [...formData[field], ''] });
  };

  const removeArrayItem = (field: 'goals' | 'frustrations', index: number) => {
    const newArray = formData[field].filter((_, i) => i !== index);
    setFormData({ ...formData, [field]: newArray });
  };

  const addBrand = () => {
    if (newBrand.trim()) {
      setFormData({
        ...formData,
        preferredBrands: [...formData.preferredBrands, newBrand.trim()],
      });
      setNewBrand('');
    }
  };

  const removeBrand = (brand: string) => {
    setFormData({
      ...formData,
      preferredBrands: formData.preferredBrands.filter(b => b !== brand),
    });
  };

  const handleSubmit = () => {
    onSave(formData);
  };

  return (
    <Box component="form" role="form" aria-label="Persona skjema" sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h1" sx={{ color: theming.colors.primary }}>
          {persona ? 'Rediger Persona' : 'Opprett Ny Persona'}
        </Typography>
        <Button
          variant="outlined"
          onClick={onCancel}
          startIcon={<CloseIcon aria-hidden="true" />}
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
      </Box>

      <Card sx={{ ...theming.getThemedCardSx(), mb: 3 }}>
        <CardContent>
          <Grid2 container spacing={3}>
            {/* Left Column - Avatar and Basic Info */}
            <Grid2 size={{ xs: 12, md: 4 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                <Avatar
                  aria-label={formData.name ? `Avatar for ${formData.name}` : 'Persona avatar'}
                  sx={{
                    width: 120,
                    height: 120,
                    bgcolor: formData.avatarColor,
                    fontSize: 48,
                    mb: 2}}
                >
                  {formData.name ? formData.name.charAt(0).toUpperCase() : <PersonIcon aria-hidden="true" fontSize="large" />}
                </Avatar>

                <TextField
                  label="PERSONA NAVN"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  fullWidth
                  required
                  sx={{ mb: 2 }}
                  inputProps={{
                    'aria-label':'Persona navn (påkrevd)','aria-required' : 'true'}}
                />

                {/* Avatar Color Picker */}
                <Box
                  role="radiogroup"
                  aria-label="Velg avatar farge"
                  sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center', mb: 2 }}
                >
                  {AVATAR_COLORS.map((color, index) => (
                    <Box
                      key={color}
                      role="radio"
                      aria-checked={formData.avatarColor === color}
                      aria-label={`Farge ${index + 1}`}
                      tabIndex={formData.avatarColor === color ? 0 : -1}
                      onClick={() => handleChange('avatarColor', color)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleChange('avatarColor', color);
                        }
                      }}
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        bgcolor: color,
                        cursor: 'pointer',
                        border: formData.avatarColor === color ? '3px solid #000' : '2px solid #ddd', '&:hover': { transform: 'scale(1.1)' }, '&:focus-visible': {
                          outline: '3px solid',
                          outlineColor: 'primary.main',
                          outlineOffset: '2px',
                        },
                        transition: 'all 0.2s'}}
                    />
                  ))}
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Demographics */}
              <Typography variant="subtitle2" component="h2" id="demographics-heading" sx={{ mb: 2, fontWeight: 'bold' }}>
                Demografi
              </Typography>

              <TextField
                label="ALDER"
                type="number"
                value={formData.age}
                onChange={(e) => handleChange('age', parseInt(e.target.value))}
                fullWidth
                sx={{ mb: 2 }}
                inputProps={{
                  'aria-label' : 'Alder',
                  min: 0,
                  max: 120}}
              />

              <TextField
                label="STED"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                fullWidth
                sx={{ mb: 2 }}
                inputProps={{
                  'aria-label' : 'Bosted'}}
              />

              <TextField
                label="YRKE"
                value={formData.occupation}
                onChange={(e) => handleChange('occupation', e.target.value)}
                fullWidth
                sx={{ mb: 2 }}
                inputProps={{
                  'aria-label' : 'Yrke'}}
              />

              <TextField
                label="FAMILIE"
                value={formData.family}
                onChange={(e) => handleChange('family', e.target.value)}
                fullWidth
                sx={{ mb: 2 }}
                placeholder="f.eks. Gift, 2 barn"
                inputProps={{
                  'aria-label' : 'Familiestatus'}}
              />

              <TextField
                label="INNTEKT"
                value={formData.income}
                onChange={(e) => handleChange('income', e.target.value)}
                fullWidth
                sx={{ mb: 2 }}
                placeholder="f.eks. 500 000 - 700 000 NOK"
                inputProps={{
                  'aria-label' : 'Inntektsnivå'}}
              />

              <TextField
                label="BIO"
                value={formData.bio}
                onChange={(e) => handleChange('bio', e.target.value)}
                fullWidth
                multiline
                rows={3}
                placeholder="Kort beskrivelse av denne personaen..."
                inputProps={{
                  'aria-label' : 'Biografi'}}
              />
            </Grid2>

            {/* Middle Column - Goals and Frustrations */}
            <Grid2 size={{ xs: 12, md: 4 }}>
              {/* Goals */}
              <Box sx={{ mb: 3 }} role="group" aria-labelledby="goals-heading">
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2" component="h2" id="goals-heading" sx={{ fontWeight: 'bold' }}>
                    Mål
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => addArrayItem('goals')}
                    color="primary"
                    aria-label="Legg til nytt mål"
                    sx={{
                      '&:focus-visible': {
                        outline: '3px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: '2px',
                      }}}
                  >
                    <AddIcon aria-hidden="true" />
                  </IconButton>
                </Box>
                {formData.goals.map((goal, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      value={goal}
                      onChange={(e) => handleArrayChange('goals', index, e.target.value)}
                      fullWidth
                      size="small"
                      placeholder="Skriv inn et mål..."
                      inputProps={{
                        'aria-label': `Mål ${index + 1}`}}
                    />
                    {formData.goals.length > 1 && (
                      <IconButton
                        size="small"
                        onClick={() => removeArrayItem('goals', index)}
                        aria-label={`Fjern mål ${index + 1}`}
                        sx={{
                          '&:focus-visible': {
                            outline: '3px solid',
                            outlineColor: 'error.main',
                            outlineOffset: '2px',
                          }}}
                      >
                        <RemoveIcon aria-hidden="true" />
                      </IconButton>
                    )}
                  </Box>
                ))}
              </Box>

              {/* Frustrations */}
              <Box sx={{ mb: 3 }} role="group" aria-labelledby="frustrations-heading">
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2" component="h2" id="frustrations-heading" sx={{ fontWeight: 'bold' }}>
                    Frustrasjoner
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => addArrayItem('frustrations')}
                    color="primary"
                    aria-label="Legg til ny frustrasjon"
                    sx={{
                      '&:focus-visible': {
                        outline: '3px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: '2px',
                      }}}
                  >
                    <AddIcon aria-hidden="true" />
                  </IconButton>
                </Box>
                {formData.frustrations.map((frustration, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      value={frustration}
                      onChange={(e) => handleArrayChange('frustrations', index, e.target.value)}
                      fullWidth
                      size="small"
                      placeholder="Skriv inn en frustrasjon..."
                      inputProps={{
                        'aria-label': `Frustrasjon ${index + 1}`}}
                    />
                    {formData.frustrations.length > 1 && (
                      <IconButton
                        size="small"
                        onClick={() => removeArrayItem('frustrations', index)}
                        aria-label={`Fjern frustrasjon ${index + 1}`}
                        sx={{
                          '&:focus-visible': {
                            outline: '3px solid',
                            outlineColor: 'error.main',
                            outlineOffset: '2px',
                          }}}
                      >
                        <RemoveIcon aria-hidden="true" />
                      </IconButton>
                    )}
                  </Box>
                ))}
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Personality Traits */}
              <Box role="group" aria-labelledby="personality-heading">
                <Typography variant="subtitle2" component="h2" id="personality-heading" sx={{ mb: 2, fontWeight: 'bold' }}>
                  Personlighet
                </Typography>

                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="caption" id="introvert-label">Introvert</Typography>
                    <Typography variant="caption">Ekstrovert</Typography>
                  </Box>
                  <Slider
                    value={formData.personality.introvert}
                    onChange={(_, value) => handlePersonalityChange('introvert', value as number)}
                    aria-labelledby="introvert-label"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={formData.personality.introvert}
                    sx={{ color: '#ff9800' }}
                  />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="caption" id="sensing-label">Sansing</Typography>
                    <Typography variant="caption">Intuisjon</Typography>
                  </Box>
                  <Slider
                    value={formData.personality.sensing}
                    onChange={(_, value) => handlePersonalityChange('sensing', value as number)}
                    aria-labelledby="sensing-label"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={formData.personality.sensing}
                    sx={{ color: '#ff9800' }}
                  />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="caption" id="thinking-label">Tenkning</Typography>
                    <Typography variant="caption">Følelse</Typography>
                  </Box>
                  <Slider
                    value={formData.personality.thinking}
                    onChange={(_, value) => handlePersonalityChange('thinking', value as number)}
                    aria-labelledby="thinking-label"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={formData.personality.thinking}
                    sx={{ color: '#ff9800' }}
                  />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="caption" id="judging-label">Vurderende</Typography>
                    <Typography variant="caption">Oppfattende</Typography>
                  </Box>
                  <Slider
                    value={formData.personality.judging}
                    onChange={(_, value) => handlePersonalityChange('judging', value as number)}
                    aria-labelledby="judging-label"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={formData.personality.judging}
                    sx={{ color: '#ff9800' }}
                  />
                </Box>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Social Traits */}
              <Box role="group" aria-labelledby="social-heading">
                <Typography variant="subtitle2" component="h2" id="social-heading" sx={{ mb: 2, fontWeight: 'bold' }}>
                  Sosiale egenskaper
                </Typography>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" id="growth-label" sx={{ mb: 1, display: 'block' }}>Vekst</Typography>
                  <Slider
                    value={formData.social.growth}
                    onChange={(_, value) => handleSocialChange('growth', value as number)}
                    aria-labelledby="growth-label"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={formData.social.growth}
                    sx={{ color: '#4caf50' }}
                  />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" id="power-label" sx={{ mb: 1, display: 'block' }}>Makt</Typography>
                  <Slider
                    value={formData.social.power}
                    onChange={(_, value) => handleSocialChange('power', value as number)}
                    aria-labelledby="power-label"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={formData.social.power}
                    sx={{ color: '#2196f3' }}
                  />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" id="social-label" sx={{ mb: 1, display: 'block' }}>Sosial</Typography>
                  <Slider
                    value={formData.social.social}
                    onChange={(_, value) => handleSocialChange('social', value as number)}
                    aria-labelledby="social-label"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={formData.social.social}
                    sx={{ color: '#ff9800' }}
                  />
                </Box>
              </Box>
            </Grid2>

            {/* Right Column - Preferred Channels and Brands */}
            <Grid2 size={{ xs: 12, md: 4 }}>
              {/* Preferred Channels */}
              <Box role="group" aria-labelledby="channels-heading">
                <Typography variant="subtitle2" component="h2" id="channels-heading" sx={{ mb: 2, fontWeight: 'bold' }}>
                  Foretrukne kanaler
                </Typography>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" id="traditional-ads-label" sx={{ mb: 1, display: 'block' }}>Tradisjonell reklame</Typography>
                  <Slider
                    value={formData.preferredChannels.traditionalAds}
                    onChange={(_, value) => handleChannelChange('traditionalAds', value as number)}
                    aria-labelledby="traditional-ads-label"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={formData.preferredChannels.traditionalAds}
                    sx={{ color: '#9c27b0' }}
                  />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" id="social-media-label" sx={{ mb: 1, display: 'block' }}>Sosiale medier</Typography>
                  <Slider
                    value={formData.preferredChannels.socialMedia}
                    onChange={(_, value) => handleChannelChange('socialMedia', value as number)}
                    aria-labelledby="social-media-label"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={formData.preferredChannels.socialMedia}
                    sx={{ color: '#2196f3' }}
                  />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" id="referral-label" sx={{ mb: 1, display: 'block' }}>Anbefaling</Typography>
                  <Slider
                    value={formData.preferredChannels.referral}
                    onChange={(_, value) => handleChannelChange('referral', value as number)}
                    aria-labelledby="referral-label"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={formData.preferredChannels.referral}
                    sx={{ color: '#4caf50' }}
                  />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" id="email-label" sx={{ mb: 1, display: 'block' }}>E-post</Typography>
                  <Slider
                    value={formData.preferredChannels.email}
                    onChange={(_, value) => handleChannelChange('email', value as number)}
                    aria-labelledby="email-label"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={formData.preferredChannels.email}
                    sx={{ color: '#ff9800' }}
                  />
                </Box>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Preferred Brands */}
              <Box role="group" aria-labelledby="brands-heading">
                <Typography variant="subtitle2" component="h2" id="brands-heading" sx={{ mb: 2, fontWeight: 'bold' }}>
                  Foretrukne merker
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <TextField
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    placeholder="Legg til et merke..."
                    size="small"
                    inputProps={{
                      'aria-label' : 'Skriv inn et merkenavn'}}
                    fullWidth
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addBrand();
                      }
                    }}
                  />
                  <Button
                    onClick={addBrand}
                    variant="contained"
                    size="small"
                    aria-label="Legg til merke"
                    sx={{
                      '&:focus-visible': {
                        outline: '3px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: '2px',
                      }}}
                  >
                    <AddIcon aria-hidden="true" />
                  </Button>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }} role="list" aria-label="Valgte merker">
                  {formData.preferredBrands.map((brand) => (
                    <Chip
                      key={brand}
                      label={brand}
                      onDelete={() => removeBrand(brand)}
                      color="primary"
                      variant="outlined"
                      aria-label={`${brand}, klikk for å fjerne`}
                      deleteIcon={<CloseIcon aria-hidden="true" />}
                    />
                  ))}
                </Box>
              </Box>
            </Grid2>
          </Grid2>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }} role="group" aria-label="Skjemahandlinger">
        <Button
          variant="outlined"
          onClick={onCancel}
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
          onClick={handleSubmit}
          disabled={!formData.name.trim()}
          aria-label={persona ? 'Oppdater persona' : 'Opprett persona'}
          sx={{
            bgcolor: theming.colors.primary, '&:hover': { bgcolor: theming.colors.primary, opacity: 0.9 }, '&:focus-visible': {
              outline: '3px solid',
              outlineColor: 'primary.main',
              outlineOffset: '2px',
            }}}
        >
          {persona ? 'Oppdater Persona' : 'Opprett Persona'}
        </Button>
      </Box>
    </Box>
  );
}
