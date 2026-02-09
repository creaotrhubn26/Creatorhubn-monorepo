/**
 * CreatorHub Norge - ATS-Friendly Resume Templates
 * Professional, modern resume templates optimized for ATS systems
 */

import React from 'react';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../../universal/hooks/useDynamicProfessions';
import { Box, Typography, Divider, Grid, Stack } from '@mui/material';

// ============================================================================
// TEMPLATE INTERFACES
// ============================================================================

export interface ResumeTemplateProps {
  resume: any;
  preview?: boolean;
}

// ============================================================================
// TEMPLATE 1: MODERN ATS (Anbefalt - Høyest ATS-score)
// ============================================================================

export const ModernATSTemplate: React.FC<ResumeTemplateProps> = ({ resume, preview = false }) => {
  const styles = {
    container: {
      maxWidth: '8.5in',
      minHeight: '11in',
      bgcolor: 'white',
      p: preview ? 2 : 4,
      fontFamily: '"Helvetica""Arial", sans-serif',
    },
    header: {
      textAlign: 'center' as const,
      mb: 3,
      borderBottom: '2px solid #2c3e50',
      pb: 2,
    },
    section: {
      mb: 3,
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: 700,
      color: '#2c3e50',
      borderBottom: '1px solid #bdc3c7',
      pb: 1,
      mb: 2,
      textTransform: 'uppercase' as const,
    },
  };

  return (
    <Box sx={styles.container}>
      {/* Header */}
      <Box sx={styles.header}>
        <Typography variant="h3" sx={{ fontWeight: 700, fontSize: '32px', color: '#2c3e50' }}>
          {resume.personalInfo.fullName}
        </Typography>
        {resume.personalInfo.professionalTitle && (
          <Typography variant="h6" sx={{ fontSize: '16px', color: '#7f8c8d', mt: 1 }}>
            {resume.personalInfo.professionalTitle}
          </Typography>
        )}
        <Typography variant="body2" sx={{ mt: 2, fontSize: '12px' }}>
          {resume.personalInfo.email} | {resume.personalInfo.phone} | {resume.personalInfo.location}
        </Typography>
      </Box>

      {/* Professional Summary */}
      {resume.personalInfo.summary && (
        <Box sx={styles.section}>
          <Typography sx={styles.sectionTitle}>Profesjonelt sammendrag</Typography>
          <Typography variant="body2" sx={{ fontSize: '12px', lineHeight: 1.6 }}>
            {resume.personalInfo.summary}
          </Typography>
        </Box>
      )}

      {/* Experience */}
      {resume.experiences?.length > 0 && (
        <Box sx={styles.section}>
          <Typography sx={styles.sectionTitle}>Arbeidserfaring</Typography>
          {resume.experiences.map((exp: any) => (
            <Box key={exp.id} sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>
                  {exp.jobTitle}
                </Typography>
                <Typography sx={{ fontSize: '12px', color: '#7f8c8d' }}>
                  {new Date(exp.startDate).toLocaleDateString('no-NO,', { year: 'numeric', month: 'short' })} - {exp.isCurrent ? 'Nå' : new Date(exp.endDate).toLocaleDateString('no-NO,', { year: 'numeric', month: 'short' })}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '13px', fontStyle: 'italic', color: '#34495e' }}>
                {exp.company} | {exp.location}
              </Typography>
              {exp.description && (
                <Typography variant="body2" sx={{ mt: 1, fontSize: '12px', lineHeight: 1.5 }}>
                  {exp.description}
                </Typography>
              )}
              {exp.achievements?.length > 0 && (
                <Box component="ul" sx={{ mt: 1, pl: 2, fontSize: '12px' }}>
                  {exp.achievements.map((achievement: string, index: number) => (
                    <li key={index}>{achievement}</li>
                  ))}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Skills */}
      {resume.skills?.length > 0 && (
        <Box sx={styles.section}>
          <Typography sx={styles.sectionTitle}>Ferdigheter</Typography>
          <Typography variant="body2" sx={{ fontSize: '12px' }}>
            {resume.skills.map((skill: any) => skill.name).join(' • , ')}
          </Typography>
        </Box>
      )}

      {/* Education */}
      {resume.education?.length > 0 && (
        <Box sx={styles.section}>
          <Typography sx={styles.sectionTitle}>Utdanning</Typography>
          {resume.education.map((edu: any) => (
            <Box key={edu.id} sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>
                  {edu.degree}
                </Typography>
                <Typography sx={{ fontSize: '12px', color: '#7f8c8d' }}>
                  {new Date(edu.startDate).getFullYear()} - {edu.isCurrent ? 'Nå' : new Date(edu.endDate).getFullYear()}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '13px', fontStyle: 'italic', color: '#34495e' }}>
                {edu.institution}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

// ============================================================================
// TEMPLATE 2: PROFESSIONAL TWO-COLUMN
// ============================================================================

export const ProfessionalTwoColumnTemplate: React.FC<ResumeTemplateProps> = ({ resume, preview = false }) => {
  return (
    <Box sx={{ maxWidth: '8.5in', minHeight: '11in', bgcolor: 'white', p: preview ? 2 : 4 }}>
      <Grid container spacing={3}>
        {/* Left Column */}
        <Grid item xs={4}>
          <Box sx={{ bgcolor: '#34495e', color: 'white', p: 3, height: '100%' }}>
            {/* Personal Info */}
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
              {resume.personalInfo.fullName}
            </Typography>
            {resume.personalInfo.professionalTitle && (
              <Typography variant="body2" sx={{ mb: 3, opacity: 0.9 }}>
                {resume.personalInfo.professionalTitle}
              </Typography>
            )}

            {/* Contact */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, fontSize: '14px' }}>
              KONTAKT
            </Typography>
            <Stack spacing={1} sx={{ mb: 3, fontSize: '12px' }}>
              <Typography variant="body2">{resume.personalInfo.email}</Typography>
              <Typography variant="body2">{resume.personalInfo.phone}</Typography>
              <Typography variant="body2">{resume.personalInfo.location}</Typography>
            </Stack>

            {/* Skills */}
            {resume.skills?.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, fontSize: '14px' }}>
                  FERDIGHETER
                </Typography>
                <Stack spacing={1} sx={{ fontSize: '12px' }}>
                  {resume.skills.map((skill: any) => (
                    <Typography key={skill.id} variant="body2">
                      • {skill.name}
                    </Typography>
                  ))}
                </Stack>
              </>
            )}
          </Box>
        </Grid>

        {/* Right Column */}
        <Grid item xs={8}>
          {/* Summary */}
          {resume.personalInfo.summary && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: '#34495e' }}>
                OM MEG
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '12px', lineHeight: 1.6 }}>
                {resume.personalInfo.summary}
              </Typography>
            </Box>
          )}

          {/* Experience */}
          {resume.experiences?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#34495e' }}>
                ERFARING
              </Typography>
              {resume.experiences.map((exp: any) => (
                <Box key={exp.id} sx={{ mb: 2 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>
                    {exp.jobTitle}
                  </Typography>
                  <Typography sx={{ fontSize: '12px', color: '#7f8c8d' }}>
                    {exp.company} | {new Date(exp.startDate).getFullYear()} - {exp.isCurrent ? 'Nå' : new Date(exp.endDate).getFullYear()}
                  </Typography>
                  {exp.description && (
                    <Typography variant="body2" sx={{ mt: 0.5, fontSize: '11px' }}>
                      {exp.description}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          )}

          {/* Education */}
          {resume.education?.length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#34495e' }}>
                UTDANNING
              </Typography>
              {resume.education.map((edu: any) => (
                <Box key={edu.id} sx={{ mb: 2 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>
                    {edu.degree}
                  </Typography>
                  <Typography sx={{ fontSize: '12px', color: '#7f8c8d' }}>
                    {edu.institution} | {new Date(edu.startDate).getFullYear()}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

// ============================================================================
// TEMPLATE 3: MINIMAL CLEAN
// ============================================================================

export const MinimalCleanTemplate: React.FC<ResumeTemplateProps> = ({ resume, preview = false }) => {
  return (
    <Box sx={{ maxWidth: '8.5in', minHeight: '11in', bgcolor: 'white', p: preview ? 2 : 4 }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h2" sx={{ fontWeight: 300, fontSize: '36px', letterSpacing: 2 }}>
          {resume.personalInfo.fullName.toUpperCase()}
        </Typography>
        {resume.personalInfo.professionalTitle && (
          <Typography variant="body1" sx={{ mt: 1, fontWeight: 300, letterSpacing: 1 }}>
            {resume.personalInfo.professionalTitle}
          </Typography>
        )}
        <Typography variant="body2" sx={{ mt: 2, color: '#7f8c8d' }}>
          {resume.personalInfo.email} • {resume.personalInfo.phone} • {resume.personalInfo.location}
        </Typography>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* Content sections follow similar pattern to Modern ATS */}
      {/* (Implementation similar to Template 1 but with minimal styling) */}
    </Box>
  );
};

// ============================================================================
// TEMPLATE 4: NORWEGIAN TWO-COLUMN (Inspired by the example)
// ============================================================================

export const NorwegianTwoColumnTemplate: React.FC<ResumeTemplateProps> = ({ resume, preview = false }) => {
  const styles = {
    container: {
      maxWidth: '8.5in',
      minHeight: '11in',
      bgcolor: 'white',
      fontFamily: ', "Helvetica","Arial", sans-serif',
      display: 'flex',
    },
    leftColumn: {
      flex: 2,
      p: preview ? 2 : 4,
    },
    rightColumn: {
      flex: 1,
      bgcolor: '#2c3e50',
      color: 'white',
      p: preview ? 2 : 3,
    },
    profileImage: {
      width: 80,
      height: 80,
      borderRadius: '50%',
      mb: 2,
      border: '3px solid white',
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: 700,
      color: '#2c3e50',
      mb: 2,
      textTransform: 'uppercase' as const,
    },
    rightSectionTitle: {
      fontSize: '16px',
      fontWeight: 700,
      color: 'white',
      mb: 1.5,
      textTransform: 'uppercase' as const,
    },
  };

  return (
    <Box sx={styles.container}>
      {/* Left Column */}
      <Box sx={styles.leftColumn}>
        {/* Header with Image */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Avatar
            src={resume.personalInfo.profilePhoto}
            sx={styles.profileImage}
          >
            {resume.personalInfo.fullName.charAt(0)}
          </Avatar>
          <Box sx={{ ml: 2 }}>
            <Typography variant="h3" sx={{ fontWeight: 700, fontSize: '32px', color: '#2c3e50' }}>
              {resume.personalInfo.fullName}
            </Typography>
            {resume.personalInfo.professionalTitle && (
              <Typography variant="h6" sx={{ fontSize: '16px', color: '#7f8c8d', mt: 0.5 }}>
                {resume.personalInfo.professionalTitle.toUpperCase()}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Profile */}
        {resume.personalInfo.summary && (
          <Box sx={{ mb: 3 }}>
            <Typography sx={styles.sectionTitle}>Profil</Typography>
            <Typography variant="body2" sx={{ fontSize: '12px', lineHeight: 1.6 }}>
              {resume.personalInfo.summary}
            </Typography>
          </Box>
        )}

        {/* Experience */}
        {resume.experiences?.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography sx={styles.sectionTitle}>Arbeidshistorikk</Typography>
            {resume.experiences.map((exp: any) => (
              <Box key={exp.id} sx={{ mb: 2 }}>
                <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>
                  {exp.jobTitle}
                </Typography>
                <Typography sx={{ fontSize: '12px', color: '#2c3e50', fontWeight: 600}}>
                  {exp.company}, {exp.location}
                </Typography>
                <Typography sx={{ fontSize: '11px', color: '#7f8c8d', mb: 1 }}>
                  {new Date(exp.startDate).toLocaleDateString('no-NO, ', { year: 'numeric', month: 'long' })} – {exp.isCurrent ? 'DAGS DATO' : new Date(exp.endDate).toLocaleDateString('no-NO', { year: 'numeric', month: 'long' })}
                </Typography>
                {exp.description && (
                  <Typography variant="body2" sx={{ fontSize: '11px', lineHeight: 1.5 }}>
                    {exp.description}
                  </Typography>
                )}
                {exp.achievements?.length > 0 && (
                  <Box component="ul" sx={{ mt: 1, pl: 2, fontSize: '11px' }}>
                    {exp.achievements.map((achievement: string, index: number) => (
                      <li key={index}>{achievement}</li>
                    ))}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        )}

        {/* Education */}
        {resume.education?.length > 0 && (
          <Box>
            <Typography sx={styles.sectionTitle}>Utdanning</Typography>
            {resume.education.map((edu: any) => (
              <Box key={edu.id} sx={{ mb: 2 }}>
                <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>
                  {edu.degree}
                </Typography>
                <Typography sx={{ fontSize: '12px', color: '#2c3e50' }}>
                  {edu.institution}
                </Typography>
                <Typography sx={{ fontSize: '11px', color: '#7f8c8d' }}>
                  {new Date(edu.startDate).getFullYear()} - {edu.isCurrent ? 'Nå' : new Date(edu.endDate).getFullYear()}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Right Column */}
      <Box sx={styles.rightColumn}>
        {/* Details */}
        <Box sx={{ mb: 3 }}>
          <Typography sx={styles.rightSectionTitle}>Detaljer</Typography>
          <Stack spacing={1} sx={{ fontSize: '12px' }}>
            <Typography variant="body2">{resume.personalInfo.location}</Typography>
            <Typography variant="body2">Norge</Typography>
            <Typography variant="body2">{resume.personalInfo.phone}</Typography>
            <Typography variant="body2">{resume.personalInfo.email}</Typography>
          </Stack>
        </Box>

        {/* Links */}
        {(resume.personalInfo.linkedin || resume.personalInfo.website) && (
          <Box sx={{ mb: 3 }}>
            <Typography sx={styles.rightSectionTitle}>Link</Typography>
            <Stack spacing={1} sx={{ fontSize: '12px' }}>
              {resume.personalInfo.linkedin && (
                <Typography variant="body2" sx={{ textDecoration: 'underline' }}>
                  Linkedin-profil
                </Typography>
              )}
              {resume.personalInfo.website && (
                <Typography variant="body2" sx={{ textDecoration: 'underline' }}>
                  Portfolio
                </Typography>
              )}
            </Stack>
          </Box>
        )}

        {/* Skills */}
        {resume.skills?.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography sx={styles.rightSectionTitle}>Ferdigheter</Typography>
            <Stack spacing={1}>
              {resume.skills.map((skill: any) => (
                <Box key={skill.id}>
                  <Typography variant="body2" sx={{ fontSize: '12px', mb: 0.5 }}>
                    {skill.name}
                  </Typography>
                  <Box sx={{ width: '100%', height: 4, bgcolor: 'rgba(255,255,255,0.3)', borderRadius: 2 }}>
                    <Box
                      sx={{
                        width: `${skill.proficiencyLevel || 80}%`,
                        height: '100%',
                        bgcolor: 'white',
                        borderRadius: 2}}
                    />
                  </Box>
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        {/* Languages */}
        <Box>
          <Typography sx={styles.rightSectionTitle}>Språk</Typography>
          <Stack spacing={1}>
            <Box>
              <Typography variant="body2" sx={{ fontSize: '12px', mb: 0.5 }}>
                Norsk
              </Typography>
              <Box sx={{ width: '100%', height: 4, bgcolor: 'rgba(255,255,255,0.3)', borderRadius: 2 }}>
                <Box sx={{ width: '100%', height: '100%', bgcolor: 'white', borderRadius: 2 }} />
              </Box>
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontSize: '12px', mb: 0.5 }}>
                Engelsk
              </Typography>
              <Box sx={{ width: '100%', height: 4, bgcolor: 'rgba(255,255,255,0.3)', borderRadius: 2 }}>
                <Box sx={{ width: '90%', height: '100%', bgcolor: 'white', borderRadius: 2 }} />
              </Box>
            </Box>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
};

// ============================================================================
// TEMPLATE 5: CREATIVE PHOTOGRAPHER
// ============================================================================

export const CreativePhotographerTemplate: React.FC<ResumeTemplateProps> = ({ resume, preview = false }) => {
  return (
    <Box sx={{ maxWidth: '8.5in', minHeight: '11in', bgcolor: '#f8f9fa', p: preview ? 2 : 4 }}>
      {/* Header with large photo area */}
      <Box sx={{ display: 'flex', mb: 4 }}>
        <Box sx={{ width: '200px', height: '250px', bgcolor: '#2c3e50', mr: 3, borderRadius: 2 }}>
          {resume.personalInfo.profilePhoto && (
            <Box
              component="img"
              src={resume.personalInfo.profilePhoto}
              sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 2 }}
            />
          )}
        </Box>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Typography variant="h2" sx={{ fontWeight: 700, fontSize: '42px', color: '#2c3e50', mb: 1 }}>
            {resume.personalInfo.fullName}
          </Typography>
          <Typography variant="h4" sx={{ fontSize: '20px', color: '#e74c3c', mb: 2, fontWeight: 300}}>
            {resume.personalInfo.professionalTitle}
          </Typography>
          <Stack spacing={1}>
            <Typography variant="body2" sx={{ fontSize: '14px', color: '#34495e' }}>
              📧 {resume.personalInfo.email}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '14px', color: '#34495e' }}>
              📱 {resume.personalInfo.phone}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '14px', color: '#34495e' }}>
              📍 {resume.personalInfo.location}
            </Typography>
          </Stack>
        </Box>
      </Box>

      {/* Two column layout for content */}
      <Grid container spacing={4}>
        <Grid item xs={8}>
          {/* Summary */}
          {resume.personalInfo.summary && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#2c3e50', mb: 2 }}>
                Om meg
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '13px', lineHeight: 1.7 }}>
                {resume.personalInfo.summary}
              </Typography>
            </Box>
          )}

          {/* Experience */}
          {resume.experiences?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#2c3e50', mb: 2 }}>
                Arbeidserfaring
              </Typography>
              {resume.experiences.map((exp: any) => (
                <Box key={exp.id} sx={{ mb: 2, pl: 2, borderLeft: '3px solid #e74c3c' }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '15px', color: '#2c3e50' }}>
                    {exp.jobTitle}
                  </Typography>
                  <Typography sx={{ fontSize: '13px', color: '#e74c3c', fontWeight: 600}}>
                    {exp.company}
                  </Typography>
                  <Typography sx={{ fontSize: '12px', color: '#7f8c8d', mb: 1 }}>
                    {new Date(exp.startDate).getFullYear()} - {exp.isCurrent ? 'Nå' : new Date(exp.endDate).getFullYear()}
                  </Typography>
                  {exp.description && (
                    <Typography variant="body2" sx={{ fontSize: '12px', lineHeight: 1.5 }}>
                      {exp.description}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Grid>

        <Grid item xs={4}>
          {/* Skills with icons */}
          {resume.skills?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#2c3e50', mb: 2 }}>
                Kompetanse
              </Typography>
              <Stack spacing={1}>
                {resume.skills.map((skill: any) => (
                  <Box key={skill.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, bgcolor: '#e74c3c', borderRadius: '50%' }} />
                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                      {skill.name}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* Portfolio highlights */}
          {resume.projects?.length > 0 && (
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#2c3e50', mb: 2 }}>
                Portefølje
              </Typography>
              <Stack spacing={1}>
                {resume.projects.slice(0, 5).map((project: any) => (
                  <Typography key={project.id} variant="body2" sx={{ fontSize: '12px' }}>
                    • {project.title}
                  </Typography>
                ))}
              </Stack>
            </Box>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

// ============================================================================
// TEMPLATE 6: MODERN TECH
// ============================================================================

export const ModernTechTemplate: React.FC<ResumeTemplateProps> = ({ resume, preview = false }) => {
  return (
    <Box sx={{ maxWidth: '8.5in', minHeight: '11in', bgcolor: 'white', p: preview ? 2 : 4 }}>
      {/* Header with gradient */}
      <Box sx={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        p: 3,
        borderRadius: 2,
        mb: 3,
        textAlign: 'center'
      }}>
        <Typography variant="h3" sx={{ fontWeight: 700, fontSize: '36px', mb: 1 }}>
          {resume.personalInfo.fullName}
        </Typography>
        <Typography variant="h6" sx={{ fontSize: '18px', opacity: 0.9, mb: 2 }}>
          {resume.personalInfo.professionalTitle}
        </Typography>
        <Stack direction="row" spacing={3} justifyContent="center">
          <Typography variant="body2">📧 {resume.personalInfo.email}</Typography>
          <Typography variant="body2">📱 {resume.personalInfo.phone}</Typography>
          <Typography variant="body2">📍 {resume.personalInfo.location}</Typography>
        </Stack>
      </Box>

      {/* Grid layout */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          {/* Summary */}
          {resume.personalInfo.summary && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#667eea', mb: 1 }}>
                📋 Profil
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '13px', lineHeight: 1.6 }}>
                {resume.personalInfo.summary}
              </Typography>
            </Box>
          )}

          {/* Experience */}
          {resume.experiences?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#667eea', mb: 2 }}>
                💼 Arbeidserfaring
              </Typography>
              {resume.experiences.map((exp: any, index: number) => (
                <Box key={exp.id} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>
                        {exp.jobTitle}
                      </Typography>
                      <Typography sx={{ fontSize: '13px', color: '#667eea', fontWeight: 600}}>
                        {exp.company}
                      </Typography>
                      <Typography sx={{ fontSize: '12px', color: '#7f8c8d' }}>
                        {exp.location}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '11px', color: '#7f8c8d', fontWeight: 600}}>
                      {new Date(exp.startDate).getFullYear()} - {exp.isCurrent ? 'Nå' : new Date(exp.endDate).getFullYear()}
                    </Typography>
                  </Box>
                  {exp.description && (
                    <Typography variant="body2" sx={{ mt: 1, fontSize: '12px', lineHeight: 1.5 }}>
                      {exp.description}
                    </Typography>
                  )}
                  {exp.achievements?.length > 0 && (
                    <Box component="ul" sx={{ mt: 1, pl: 2, fontSize: '12px' }}>
                      {exp.achievements.slice(0, 3).map((achievement: string, i: number) => (
                        <li key={i}>{achievement}</li>
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          {/* Skills with progress bars */}
          {resume.skills?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#667eea', mb: 2 }}>
                🛠️ Teknologier
              </Typography>
              <Stack spacing={2}>
                {resume.skills.map((skill: any) => (
                  <Box key={skill.id}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontSize: '12px' }}>
                        {skill.name}
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '11px', color: '#7f8c8d' }}>
                        {skill.proficiencyLevel || 85}%
                      </Typography>
                    </Box>
                    <Box sx={{ width: '100%', height: 6, bgcolor: '#f0f0f0', borderRadius: 3 }}>
                      <Box
                        sx={{
                          width: `${skill.proficiencyLevel || 85}%`,
                          height: '100%',
                          bgcolor: '#667eea',
                          borderRadius: 3}}
                      />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* Education */}
          {resume.education?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#667eea', mb: 2 }}>
                🎓 Utdanning
              </Typography>
              {resume.education.map((edu: any) => (
                <Box key={edu.id} sx={{ mb: 2 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '13px' }}>
                    {edu.degree}
                  </Typography>
                  <Typography sx={{ fontSize: '12px', color: '#667eea' }}>
                    {edu.institution}
                  </Typography>
                  <Typography sx={{ fontSize: '11px', color: '#7f8c8d' }}>
                    {new Date(edu.startDate).getFullYear()} - {edu.isCurrent ? 'Nå' : new Date(edu.endDate).getFullYear()}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {/* Certifications */}
          {resume.certifications?.length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#667eea', mb: 2 }}>
                🏆 Sertifiseringer
              </Typography>
              <Stack spacing={1}>
                {resume.certifications.map((cert: any) => (
                  <Box key={cert.id}>
                    <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600}}>
                      {cert.name}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '11px', color: '#7f8c8d' }}>
                      {cert.issuer}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

// ============================================================================
// TEMPLATE 7: HEALTHCARE PROFESSIONAL
// ============================================================================

export const HealthcareProfessionalTemplate: React.FC<ResumeTemplateProps> = ({ resume, preview = false }) => {
  return (
    <Box sx={{ maxWidth: '8.5in', minHeight: '11in', bgcolor: 'white', p: preview ? 2 : 4 }}>
      {/* Header with medical theme */}
      <Box sx={{ 
        bgcolor: '#e8f5e8', 
        p: 3, 
        borderRadius: 2, 
        mb: 3, 
        borderLeft: '5px solid #4caf50',
        display: 'flex',
        alignItems: 'center'
      }}>
        <Box sx={{ 
          width: 80, 
          height: 80, 
          borderRadius: '50%', 
          bgcolor: '#4caf50', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          mr: 3,
          color: 'white',
          fontSize: '24px',
          fontWeight: 'bold'
        }}>
          {resume.personalInfo.fullName.split(', ').map((n: string) => n[0]).join(',')}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#2e7d32', mb: 1 }}>
            {resume.personalInfo.fullName}
          </Typography>
          <Typography variant="h6" sx={{ fontSize: '18px', color: '#4caf50', mb: 2 }}>
            {resume.personalInfo.professionalTitle}
          </Typography>
          <Stack direction="row" spacing={3}>
            <Typography variant="body2" sx={{ fontSize: '13px', color: '#2e7d32' }}>
              🏥 {resume.personalInfo.email}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '13px', color: '#2e7d32' }}>
              📞 {resume.personalInfo.phone}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '13px', color: '#2e7d32' }}>
              📍 {resume.personalInfo.location}
            </Typography>
          </Stack>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          {/* Professional Summary */}
          {resume.personalInfo.summary && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32', mb: 1 }}>
                🩺 Profesjonell Profil
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '13px', lineHeight: 1.7, color: '#424242' }}>
                {resume.personalInfo.summary}
              </Typography>
            </Box>
          )}

          {/* Clinical Experience */}
          {resume.experiences?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32', mb: 2 }}>
                🏥 Klinisk Erfaring
              </Typography>
              {resume.experiences.map((exp: any) => (
                <Box key={exp.id} sx={{ mb: 2, p: 2, bgcolor: '#f8fff8', borderRadius: 1, borderLeft: '3px solid #4caf50' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: '15px', color: '#2e7d32' }}>
                        {exp.jobTitle}
                      </Typography>
                      <Typography sx={{ fontSize: '13px', color: '#4caf50', fontWeight: 600}}>
                        {exp.company}
                      </Typography>
                      <Typography sx={{ fontSize: '12px', color: '#757575' }}>
                        {exp.location}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '11px', color: '#757575', fontWeight: 600}}>
                      {new Date(exp.startDate).toLocaleDateString('no-NO', { year: 'numeric', month: 'short' })} - {exp.isCurrent ? 'Nå' : new Date(exp.endDate).toLocaleDateString('no-NO', { year: 'numeric', month: 'short' })}
                    </Typography>
                  </Box>
                  {exp.description && (
                    <Typography variant="body2" sx={{ fontSize: '12px', lineHeight: 1.6 }}>
                      {exp.description}
                    </Typography>
                  )}
                  {exp.achievements?.length > 0 && (
                    <Box component="ul" sx={{ mt: 1, pl: 2, fontSize: '12px' }}>
                      {exp.achievements.map((achievement: string, i: number) => (
                        <li key={i} style={{ marginBottom: '2px' }}>{achievement}</li>
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          )}

          {/* Education */}
          {resume.education?.length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32', mb: 2 }}>
                🎓 Utdanning & Sertifiseringer
              </Typography>
              {resume.education.map((edu: any) => (
                <Box key={edu.id} sx={{ mb: 2 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '14px', color: '#2e7d32' }}>
                    {edu.degree}
                  </Typography>
                  <Typography sx={{ fontSize: '13px', color: '#4caf50' }}>
                    {edu.institution}
                  </Typography>
                  <Typography sx={{ fontSize: '12px', color: '#757575' }}>
                    {new Date(edu.startDate).getFullYear()} - {edu.isCurrent ? 'Nå' : new Date(edu.endDate).getFullYear()}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          {/* Specializations */}
          {resume.skills?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32', mb: 2 }}>
                🔬 Spesialiseringer
              </Typography>
              <Stack spacing={1}>
                {resume.skills.map((skill: any) => (
                  <Box key={skill.id} sx={{ 
                    p: 1.5, 
                    bgcolor: '#f1f8e9', 
                    borderRadius: 1, 
                    borderLeft: '3px solid #4caf50',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <Box sx={{ width: 6, height: 6, bgcolor: '#4caf50', borderRadius: '50%', mr: 1 }} />
                    <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500}}>
                      {skill.name}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* Licenses */}
          {resume.certifications?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32', mb: 2 }}>
                📜 Lisenser & Godkjenninger
              </Typography>
              <Stack spacing={1}>
                {resume.certifications.map((cert: any) => (
                  <Box key={cert.id} sx={{ p: 1.5, bgcolor: '#f8fff8', borderRadius: 1 }}>
                    <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600}}>
                      {cert.name}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '11px', color: '#757575' }}>
                      {cert.issuer}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* Languages */}
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32', mb: 2 }}>
              🌍 Språk
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontSize: '12px' }}>Norsk</Typography>
                <Typography variant="body2" sx={{ fontSize: '11px', color: '#4caf50', fontWeight: 600}}>Morsmål</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontSize: '12px' }}>Engelsk</Typography>
                <Typography variant="body2" sx={{ fontSize: '11px', color: '#4caf50', fontWeight: 600}}>Flytende</Typography>
              </Box>
            </Stack>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

// ============================================================================
// TEMPLATE 8: ACADEMIC RESEARCHER
// ============================================================================

export const AcademicResearcherTemplate: React.FC<ResumeTemplateProps> = ({ resume, preview = false }) => {
  return (
    <Box sx={{ maxWidth: '8.5in', minHeight: '11in', bgcolor: 'white', p: preview ? 2 : 4 }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 4, borderBottom: '2px solid #1976d2', pb: 3 }}>
        <Typography variant="h3" sx={{ fontWeight: 300, fontSize: '32px', color: '#1976d2', mb: 1 }}>
          {resume.personalInfo.fullName.toUpperCase()}
        </Typography>
        <Typography variant="h5" sx={{ fontSize: '18px', color: '#424242', fontWeight: 300, mb: 2 }}>
          {resume.personalInfo.professionalTitle}
        </Typography>
        <Stack direction="row" spacing={4} justifyContent="center" sx={{ fontSize: '13px', color: '#757575' }}>
          <Typography variant="body2">📧 {resume.personalInfo.email}</Typography>
          <Typography variant="body2">📱 {resume.personalInfo.phone}</Typography>
          <Typography variant="body2">📍 {resume.personalInfo.location}</Typography>
          {resume.personalInfo.website && <Typography variant="body2">🌐 Portfolio</Typography>}
        </Stack>
      </Box>

      <Grid container spacing={4}>
        <Grid item xs={12} md={8}>
          {/* Research Interests */}
          {resume.personalInfo.summary && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#1976d2', mb: 1, borderBottom: '1px solid #e3f2fd', pb: 0.5 }}>
                Forskningsinteresser
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '13px', lineHeight: 1.7, fontStyle: 'italic' }}>
                {resume.personalInfo.summary}
              </Typography>
            </Box>
          )}

          {/* Education */}
          {resume.education?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#1976d2', mb: 2, borderBottom: '1px solid #e3f2fd', pb: 0.5 }}>
                Utdanning
              </Typography>
              {resume.education.map((edu: any) => (
                <Box key={edu.id} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>
                        {edu.degree}
                      </Typography>
                      <Typography sx={{ fontSize: '13px', color: '#1976d2', fontWeight: 500}}>
                        {edu.institution}
                      </Typography>
                      {edu.gpa && (
                        <Typography sx={{ fontSize: '12px', color: '#757575' }}>
                          GPA: {edu.gpa}
                        </Typography>
                      )}
                    </Box>
                    <Typography sx={{ fontSize: '11px', color: '#757575', fontWeight: 600}}>
                      {new Date(edu.startDate).getFullYear()} - {edu.isCurrent ? 'Pågående' : new Date(edu.endDate).getFullYear()}
                    </Typography>
                  </Box>
                  {edu.description && (
                    <Typography variant="body2" sx={{ mt: 1, fontSize: '12px', lineHeight: 1.5, fontStyle: 'italic' }}>
                      {edu.description}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          )}

          {/* Research Experience */}
          {resume.experiences?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#1976d2', mb: 2, borderBottom: '1px solid #e3f2fd', pb: 0.5 }}>
                Forskningserfaring
              </Typography>
              {resume.experiences.map((exp: any) => (
                <Box key={exp.id} sx={{ mb: 2 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>
                    {exp.jobTitle}
                  </Typography>
                  <Typography sx={{ fontSize: '13px', color: '#1976d2', fontWeight: 500}}>
                    {exp.company}
                  </Typography>
                  <Typography sx={{ fontSize: '12px', color: '#757575', mb: 1 }}>
                    {new Date(exp.startDate).toLocaleDateString('no-NO', { year: 'numeric', month: 'long' })} - {exp.isCurrent ? 'Pågående' : new Date(exp.endDate).toLocaleDateString('no-NO', { year: 'numeric', month: 'long' })}
                  </Typography>
                  {exp.description && (
                    <Typography variant="body2" sx={{ fontSize: '12px', lineHeight: 1.6 }}>
                      {exp.description}
                    </Typography>
                  )}
                  {exp.achievements?.length > 0 && (
                    <Box component="ul" sx={{ mt: 1, pl: 2, fontSize: '12px' }}>
                      {exp.achievements.map((achievement: string, i: number) => (
                        <li key={i} style={{ marginBottom: '2px' }}>{achievement}</li>
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          )}

          {/* Publications */}
          {resume.projects?.length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#1976d2', mb: 2, borderBottom: '1px solid #e3f2fd', pb: 0.5 }}>
                Publikasjoner & Prosjekter
              </Typography>
              {resume.projects.map((project: any) => (
                <Box key={project.id} sx={{ mb: 1.5, fontSize: '12px' }}>
                  <Typography sx={{ fontWeight: 500}}>
                    {project.title}
                  </Typography>
                  <Typography sx={{ color: '#757575', fontStyle: 'italic' }}>
                    {project.description}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          {/* Skills */}
          {resume.skills?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#1976d2', mb: 2, borderBottom: '1px solid #e3f2fd', pb: 0.5 }}>
                Tekniske Ferdigheter
              </Typography>
              <Stack spacing={1}>
                {resume.skills.map((skill: any) => (
                  <Typography key={skill.id} variant="body2" sx={{ fontSize: '12px' }}>
                    • {skill.name}
                  </Typography>
                ))}
              </Stack>
            </Box>
          )}

          {/* Awards */}
          {resume.certifications?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#1976d2', mb: 2, borderBottom: '1px solid #e3f2fd', pb: 0.5 }}>
                Priser & Anerkjennelser
              </Typography>
              <Stack spacing={1}>
                {resume.certifications.map((cert: any) => (
                  <Box key={cert.id}>
                    <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500}}>
                      {cert.name}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '11px', color: '#757575' }}>
                      {cert.issuer}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* Languages */}
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1976d2', mb: 2, borderBottom: '1px solid #e3f2fd', pb: 0.5 }}>
              Språk
            </Typography>
            <Stack spacing={0.5}>
              <Typography variant="body2" sx={{ fontSize: '12px' }}>Norsk (Morsmål)</Typography>
              <Typography variant="body2" sx={{ fontSize: '12px' }}>Engelsk (Flytende)</Typography>
              <Typography variant="body2" sx={{ fontSize: '12px' }}>Tysk (God)</Typography>
            </Stack>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

// ============================================================================
// TEMPLATE 9: EXECUTIVE LEADERSHIP
// ============================================================================

export const ExecutiveLeadershipTemplate: React.FC<ResumeTemplateProps> = ({ resume, preview = false }) => {
  return (
    <Box sx={{ maxWidth: '8.5in', minHeight: '11in', bgcolor: 'white', p: preview ? 2 : 4 }}>
      {/* Header with executive styling */}
      <Box sx={{ 
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
        color: 'white',
        p: 4,
        borderRadius: 2,
        mb: 3,
        textAlign: 'center'
      }}>
        <Typography variant="h2" sx={{ fontWeight: 700, fontSize: '40px', mb: 1, letterSpacing: 2 }}>
          {resume.personalInfo.fullName}
        </Typography>
        <Typography variant="h5" sx={{ fontSize: '20px', opacity: 0.9, mb: 3, fontWeight: 300}}>
          {resume.personalInfo.professionalTitle}
        </Typography>
        <Stack direction="row" spacing={4} justifyContent="center" sx={{ fontSize: '14px' }}>
          <Typography variant="body2">📧 {resume.personalInfo.email}</Typography>
          <Typography variant="body2">📱 {resume.personalInfo.phone}</Typography>
          <Typography variant="body2">📍 {resume.personalInfo.location}</Typography>
        </Stack>
      </Box>

      {/* Executive Summary */}
      {resume.personalInfo.summary && (
        <Box sx={{ mb: 4, p: 3, bgcolor: '#f8f9fa', borderRadius: 2, borderLeft: '4px solid #1a1a1a' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1a1a1a', mb: 2 }}>
            Lederskapsprofil
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '14px', lineHeight: 1.7, color: '#424242' }}>
            {resume.personalInfo.summary}
          </Typography>
        </Box>
      )}

      <Grid container spacing={4}>
        <Grid item xs={12} md={8}>
          {/* Leadership Experience */}
          {resume.experiences?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#1a1a1a', mb: 3, borderBottom: '2px solid #1a1a1a', pb: 1 }}>
                Ledelseserfaring
              </Typography>
              {resume.experiences.map((exp: any, index: number) => (
                <Box key={exp.id} sx={{ mb: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '16px', color: '#1a1a1a' }}>
                        {exp.jobTitle}
                      </Typography>
                      <Typography sx={{ fontSize: '14px', color: '#666', fontWeight: 600}}>
                        {exp.company}
                      </Typography>
                      <Typography sx={{ fontSize: '13px', color: '#888' }}>
                        {exp.location}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '12px', color: '#666', fontWeight: 600, bgcolor: '#f0f0f0', px: 2, py: 0.5, borderRadius: 1 }}>
                      {new Date(exp.startDate).toLocaleDateString('no-NO', { year: 'numeric', month: 'short' })} - {exp.isCurrent ? 'Nå' : new Date(exp.endDate).toLocaleDateString('no-NO', { year: 'numeric', month: 'short' })}
                    </Typography>
                  </Box>
                  {exp.description && (
                    <Typography variant="body2" sx={{ fontSize: '13px', lineHeight: 1.6, mb: 2 }}>
                      {exp.description}
                    </Typography>
                  )}
                  {exp.achievements?.length > 0 && (
                    <Box component="ul" sx={{ mt: 1, pl: 2, fontSize: '13px' }}>
                      {exp.achievements.map((achievement: string, i: number) => (
                        <li key={i} style={{ marginBottom: '4px', fontWeight: 500}}>{achievement}</li>
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          )}

          {/* Education */}
          {resume.education?.length > 0 && (
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#1a1a1a', mb: 2, borderBottom: '2px solid #1a1a1a', pb: 1 }}>
                Utdanning
              </Typography>
              {resume.education.map((edu: any) => (
                <Box key={edu.id} sx={{ mb: 2, p: 2, bgcolor: '#f8f9fa', borderRadius: 1 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '14px', color: '#1a1a1a' }}>
                    {edu.degree}
                  </Typography>
                  <Typography sx={{ fontSize: '13px', color: '#666' }}>
                    {edu.institution}
                  </Typography>
                  <Typography sx={{ fontSize: '12px', color: '#888' }}>
                    {new Date(edu.startDate).getFullYear()} - {edu.isCurrent ? 'Pågående' : new Date(edu.endDate).getFullYear()}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          {/* Core Competencies */}
          {resume.skills?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1a1a1a', mb: 2 }}>
                Kjernkompetanser
              </Typography>
              <Stack spacing={1}>
                {resume.skills.map((skill: any) => (
                  <Box key={skill.id} sx={{ 
                    p: 1.5, 
                    bgcolor: '#f0f0f0', 
                    borderRadius: 1,
                    borderLeft: '3px solid #1a1a1a'
                  }}>
                    <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500}}>
                      {skill.name}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* Board Positions */}
          {resume.certifications?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1a1a1a', mb: 2 }}>
                Styreverv & Roller
              </Typography>
              <Stack spacing={1}>
                {resume.certifications.map((cert: any) => (
                  <Box key={cert.id} sx={{ p: 1.5, bgcolor: '#f8f9fa', borderRadius: 1 }}>
                    <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600}}>
                      {cert.name}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '11px', color: '#666' }}>
                      {cert.issuer}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* Languages */}
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1a1a1a', mb: 2 }}>
              Språk
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ fontSize: '12px' }}>Norsk</Typography>
                <Typography variant="body2" sx={{ fontSize: '11px', color: '#666' }}>Morsmål</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ fontSize: '12px' }}>Engelsk</Typography>
                <Typography variant="body2" sx={{ fontSize: '11px', color: '#666' }}>Flytende</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ fontSize: '12px' }}>Tysk</Typography>
                <Typography variant="body2" sx={{ fontSize: '11px', color: '#666' }}>God</Typography>
              </Box>
            </Stack>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

// ============================================================================
// TEMPLATE 10: SALES PROFESSIONAL
// ============================================================================

export const SalesProfessionalTemplate: React.FC<ResumeTemplateProps> = ({ resume, preview = false }) => {
  return (
    <Box sx={{ maxWidth: '8.5in', minHeight: '11in', bgcolor: 'white', p: preview ? 2 : 4 }}>
      {/* Header with sales theme */}
      <Box sx={{ 
        background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
        color: 'white',
        p: 3,
        borderRadius: 2,
        mb: 3,
        textAlign: 'center'
      }}>
        <Typography variant="h3" sx={{ fontWeight: 700, fontSize: '36px', mb: 1 }}>
          {resume.personalInfo.fullName}
        </Typography>
        <Typography variant="h5" sx={{ fontSize: '18px', opacity: 0.9, mb: 2 }}>
          {resume.personalInfo.professionalTitle}
        </Typography>
        <Stack direction="row" spacing={3} justifyContent="center">
          <Typography variant="body2">📧 {resume.personalInfo.email}</Typography>
          <Typography variant="body2">📱 {resume.personalInfo.phone}</Typography>
          <Typography variant="body2">📍 {resume.personalInfo.location}</Typography>
        </Stack>
      </Box>

      {/* Sales Performance Summary */}
      {resume.personalInfo.summary && (
        <Box sx={{ mb: 3, p: 2, bgcolor: '#fff3e0', borderRadius: 2, borderLeft: '4px solid #ff6b35' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#e65100', mb: 1 }}>
            Salgsprofil
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '13px', lineHeight: 1.7 }}>
            {resume.personalInfo.summary}
          </Typography>
        </Box>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          {/* Sales Experience */}
          {resume.experiences?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#e65100', mb: 2 }}>
                💼 Salgserfaring
              </Typography>
              {resume.experiences.map((exp: any) => (
                <Box key={exp.id} sx={{ mb: 2, p: 2, border: '1px solid #ffcc80', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>
                        {exp.jobTitle}
                      </Typography>
                      <Typography sx={{ fontSize: '13px', color: '#e65100', fontWeight: 600}}>
                        {exp.company}
                      </Typography>
                      <Typography sx={{ fontSize: '12px', color: '#757575' }}>
                        {exp.location}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '11px', color: '#757575', fontWeight: 600}}>
                      {new Date(exp.startDate).getFullYear()} - {exp.isCurrent ? 'Nå' : new Date(exp.endDate).getFullYear()}
                    </Typography>
                  </Box>
                  {exp.description && (
                    <Typography variant="body2" sx={{ fontSize: '12px', lineHeight: 1.5 }}>
                      {exp.description}
                    </Typography>
                  )}
                  {exp.achievements?.length > 0 && (
                    <Box component="ul" sx={{ mt: 1, pl: 2, fontSize: '12px' }}>
                      {exp.achievements.map((achievement: string, i: number) => (
                        <li key={i} style={{ marginBottom: '2px' }}>{achievement}</li>
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          )}

          {/* Education */}
          {resume.education?.length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#e65100', mb: 2 }}>
                🎓 Utdanning
              </Typography>
              {resume.education.map((edu: any) => (
                <Box key={edu.id} sx={{ mb: 2 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>
                    {edu.degree}
                  </Typography>
                  <Typography sx={{ fontSize: '13px', color: '#e65100' }}>
                    {edu.institution}
                  </Typography>
                  <Typography sx={{ fontSize: '12px', color: '#757575' }}>
                    {new Date(edu.startDate).getFullYear()} - {edu.isCurrent ? 'Nå' : new Date(edu.endDate).getFullYear()}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          {/* Sales Skills */}
          {resume.skills?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#e65100', mb: 2 }}>
                🎯 Salgsferdigheter
              </Typography>
              <Stack spacing={1}>
                {resume.skills.map((skill: any) => (
                  <Box key={skill.id} sx={{ 
                    p: 1.5, 
                    bgcolor: '#fff8e1', 
                    borderRadius: 1,
                    borderLeft: '3px solid #ff6b35'
                  }}>
                    <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500}}>
                      {skill.name}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* Achievements */}
          {resume.certifications?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#e65100', mb: 2 }}>
                🏆 Prestasjoner
              </Typography>
              <Stack spacing={1}>
                {resume.certifications.map((cert: any) => (
                  <Box key={cert.id} sx={{ p: 1.5, bgcolor: '#fff3e0', borderRadius: 1 }}>
                    <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600}}>
                      {cert.name}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '11px', color: '#757575' }}>
                      {cert.issuer}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* Languages */}
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#e65100', mb: 2 }}>
              🌍 Språk
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ fontSize: '12px' }}>Norsk</Typography>
                <Typography variant="body2" sx={{ fontSize: '11px', color: '#e65100', fontWeight: 600}}>Morsmål</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ fontSize: '12px' }}>Engelsk</Typography>
                <Typography variant="body2" sx={{ fontSize: '11px', color: '#e65100', fontWeight: 600}}>Flytende</Typography>
              </Box>
            </Stack>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

// ============================================================================
// TEMPLATE REGISTRY
// ============================================================================

export const RESUME_TEMPLATES = {
  'modern-ats': {
    id: 'modern-ats',
    name: 'Modern ATS',
    description: 'Optimal for ATS-systemer med profesjonelt utseende',
    component: ModernATSTemplate,
    atsScore: 100,
    category: 'professional',
    layout: 'single-column',
    isPremium: false,
  } 'professional-two-column': {
    id: 'professional-two-column',
    name: 'Profesjonell to-kolonne',
    description: 'Moderne design med farget sidebar',
    component: ProfessionalTwoColumnTemplate,
    atsScore: 85,
    category: 'professional',
    layout: 'two-column',
    isPremium: false,
  }, 'norwegian-two-column': {
    id: 'norwegian-two-column',
    name: 'Norsk To-kolonne',
    description: 'Inspirert av norske CV-standarder med profilbilde og ferdighetsindikatorer',
    component: NorwegianTwoColumnTemplate,
    atsScore: 90,
    category: 'professional',
    layout: 'two-column',
    isPremium: false,
  }, 'minimal-clean': {
    id: 'minimal-clean',
    name: 'Minimalistisk & Ren',
    description: 'Enkel, elegant og profesjonell',
    component: MinimalCleanTemplate,
    atsScore: 95,
    category: 'minimal',
    layout: 'single-column',
    isPremium: false,
  }, 'creative-photographer': {
    id: 'creative-photographer',
    name: 'Kreativ Fotograf',
    description: 'Perfekt for fotografer og kreative profesjonelle med stort bildeområde',
    component: CreativePhotographerTemplate,
    atsScore: 80,
    category: 'creative',
    layout: 'modern-split',
    isPremium: false,
  }, 'modern-tech': {
    id: 'modern-tech',
    name: 'Modern Tech',
    description: 'Moderne design med gradienter og teknologi-fokus',
    component: ModernTechTemplate,
    atsScore: 95,
    category: 'technology',
    layout: 'single-column',
    isPremium: false,
  }, 'healthcare-professional': {
    id: 'healthcare-professional',
    name: 'Helsepersonell',
    description: 'Spesialisert mal for leger, sykepleiere og helsepersonell',
    component: HealthcareProfessionalTemplate,
    atsScore: 90,
    category: 'healthcare',
    layout: 'single-column',
    isPremium: false,
  }, 'academic-researcher': {
    id: 'academic-researcher',
    name: 'Akademisk Forsker',
    description: 'Profesjonell mal for forskere og akademikere',
    component: AcademicResearcherTemplate,
    atsScore: 95,
    category: 'academic',
    layout: 'single-column',
    isPremium: false,
  }, 'executive-leadership': {
    id: 'executive-leadership',
    name: 'Toppledelse',
    description: 'Elegant mal for direktører og ledere',
    component: ExecutiveLeadershipTemplate,
    atsScore: 85,
    category: 'executive',
    layout: 'single-column',
    isPremium: false,
  }'sales-professional': {
    id: 'sales-professional',
    name: 'Salgsprofil',
    description: 'Dynamisk mal for salgsrepresentanter og -ledere',
    component: SalesProfessionalTemplate,
    atsScore: 90,
    category: 'sales',
    layout: 'single-column',
    isPremium: false,
  },
};

// ============================================================================
// TEMPLATE SEED DATA FOR DATABASE
// ============================================================================

export const RESUME_TEMPLATE_SEED_DATA = [
  {
    id: 'modern-ats',
    name: 'Modern ATS',
    description: 'Optimal for ATS-systemer med profesjonelt utseende. Enkel struktur som sikrer at informasjonen din blir riktig lest av automatiserte systemer.',
    category: 'professional',
    atsScore: 100,
    isAtsOptimized: true,
    layout: 'single-column',
    sections: ['summary','experience','education','skills','certifications','projects'],
    previewImage: '/templates/modern-ats-preview.png',
    colorSchemes: ['professional-blue','classic-black','modern-navy'],
    fonts: { heading: 'Helvetica', body: 'Arial' },
    isPremium: false,
    isActive: true,
  },
  {
    id: 'professional-two-column',
    name: 'Profesjonell to-kolonne',
    description: 'Moderne design med farget sidebar. God balanse mellom visuelt og ATS-vennlighet.',
    category: 'professional',
    atsScore: 85,
    isAtsOptimized: true,
    layout: 'two-column',
    sections: ['summary','experience','education','skills','certifications'],
    previewImage: '/templates/professional-two-column-preview.png',
    colorSchemes: ['blue-sidebar','green-sidebar','purple-sidebar'],
    fonts: { heading: 'Helvetica', body: 'Arial' },
    isPremium: false,
    isActive: true,
  },
  {
    id: 'minimal-clean',
    name: 'Minimalistisk & Ren',
    description: 'Enkel, elegant og profesjonell. Perfekt for kreative yrker.',
    category: 'minimal',
    atsScore: 95,
    isAtsOptimized: true,
    layout: 'single-column',
    sections: ['summary','experience','education','skills','projects'],
    previewImage: '/templates/minimal-clean-preview.png',
    colorSchemes: ['minimal-gray','minimal-blue','minimal-black'],
    fonts: { heading: 'Helvetica Neue', body: 'Helvetica' },
    isPremium: false,
    isActive: true,
  },
  {
    id: 'creative-bold',
    name: 'Kreativ & Modig',
    description: 'For kreative profesjonelle som vil skille seg ut. God ATS-score med moderne design.',
    category: 'creative',
    atsScore: 80,
    isAtsOptimized: true,
    layout: 'modern-split',
    sections: ['summary','experience','skills','projects','education'],
    previewImage: '/templates/creative-bold-preview.png',
    colorSchemes: ['vibrant-orange','bold-red','creative-teal'],
    fonts: { heading: 'Montserrat', body: 'Open Sans' },
    isPremium: true,
    isActive: true,
  },
  {
    id: 'executive',
    name: 'Executive',
    description: 'For lederstillinger og senior roller. Elegant og profesjonell.',
    category: 'executive',
    atsScore: 90,
    isAtsOptimized: true,
    layout: 'single-column',
    sections: ['summary','experience','education','skills','certifications'],
    previewImage: '/templates/executive-preview.png',
    colorSchemes: ['executive-navy','executive-charcoal','executive-burgundy'],
    fonts: { heading: 'Georgia', body: 'Times New Roman' },
    isPremium: true,
    isActive: true,
  },
  {
    id: 'tech-modern',
    name: 'Tech Modern',
    description: 'For teknologi-profesjonelle. Ren kode-inspirert design med høy ATS-score.',
    category: 'technology',
    atsScore: 95,
    isAtsOptimized: true,
    layout: 'single-column',
    sections: ['summary','experience','skills','projects','education','certifications'],
    previewImage: '/templates/tech-modern-preview.png',
    colorSchemes: ['tech-blue','tech-green','tech-purple'],
    fonts: { heading: 'Roboto', body: 'Source Sans Pro' },
    isPremium: false,
    isActive: true,
  },
  {
    id: 'academic',
    name: 'Academic',
    description: 'For akademiske stillinger og forskere. Tradisjonell og respektert layout.',
    category: 'academic',
    atsScore: 100,
    isAtsOptimized: true,
    layout: 'single-column',
    sections: ['summary','education','experience','publications','certifications','skills'],
    previewImage: '/templates/academic-preview.png',
    colorSchemes: ['academic-black','academic-navy','academic-burgundy'],
    fonts: { heading: 'Times New Roman', body: 'Times New Roman' },
    isPremium: false,
    isActive: true,
  },
  {
    id: 'creative-portfolio',
    name: 'Creative Portfolio',
    description: 'Vis frem ditt kreative arbeid. Perfekt for designere og kunstnere.',
    category: 'creative',
    atsScore: 75,
    isAtsOptimized: false,
    layout: 'modern-split',
    sections: ['summary','projects','experience','skills','education'],
    previewImage: '/templates/creative-portfolio-preview.png',
    colorSchemes: ['creative-vibrant','creative-pastel','creative-monochrome'],
    fonts: { heading: 'Playfair Display', body: 'Lato' },
    isPremium: true,
    isActive: true,
  },
  {
    id: 'simple-classic',
    name: 'Simple Classic',
    description: 'Tidløs klassisk design. Fungerer for alle bransjer og stillinger.',
    category: 'classic',
    atsScore: 100,
    isAtsOptimized: true,
    layout: 'single-column',
    sections: ['summary','experience','education','skills'],
    previewImage: '/templates/simple-classic-preview.png',
    colorSchemes: ['classic-black','classic-navy','classic-gray'],
    fonts: { heading: 'Times New Roman', body: 'Times New Roman' },
    isPremium: false,
    isActive: true,
  },
  {
    id: 'modern-gradient',
    name: 'Modern Gradient',
    description: 'Moderne design med subtile gradienter. Skiller seg ut samtidig som den er ATS-vennlig.',
    category: 'modern',
    atsScore: 85,
    isAtsOptimized: true,
    layout: 'single-column',
    sections: ['summary','experience','skills','education','projects'],
    previewImage: '/templates/modern-gradient-preview.png',
    colorSchemes: ['gradient-blue-purple','gradient-green-teal','gradient-orange-red'],
    fonts: { heading: 'Inter', body: 'Inter' },
    isPremium: true,
    isActive: true,
  },
  {
    id: 'norwegian-two-column',
    name: 'Norsk To-kolonne',
    description: 'Inspirert av norske CV-standarder med profilbilde, ferdighetsindikatorer og mørk sidebar.',
    category: 'professional',
    atsScore: 90,
    isAtsOptimized: true,
    layout: 'two-column',
    sections: ['summary','experience','education','skills','certifications'],
    previewImage: '/templates/norwegian-two-column-preview.png',
    colorSchemes: ['norwegian-blue','norwegian-navy','norwegian-charcoal'],
    fonts: { heading: 'Helvetica', body: 'Arial' },
    isPremium: false,
    isActive: true,
  },
  {
    id: 'creative-photographer',
    name: 'Kreativ Fotograf',
    description: 'Perfekt for fotografer og kreative profesjonelle med stort bildeområde og moderne layout.',
    category: 'creative',
    atsScore: 80,
    isAtsOptimized: true,
    layout: 'modern-split',
    sections: ['summary','experience','skills','projects','education'],
    previewImage: '/templates/creative-photographer-preview.png',
    colorSchemes: ['photographer-gray','photographer-blue','photographer-red'],
    fonts: { heading: 'Montserrat', body: 'Open Sans' },
    isPremium: false,
    isActive: true,
  },
  {
    id: 'modern-tech',
    name: 'Modern Tech',
    description: 'Moderne design med gradienter, ikoner og teknologi-fokus. Perfekt for IT-profesjonelle.',
    category: 'technology',
    atsScore: 95,
    isAtsOptimized: true,
    layout: 'single-column',
    sections: ['summary','experience','skills','education','certifications','projects'],
    previewImage: '/templates/modern-tech-preview.png',
    colorSchemes: ['tech-gradient-blue','tech-gradient-purple','tech-gradient-green'],
    fonts: { heading: 'Roboto', body: 'Source Sans Pro' },
    isPremium: false,
    isActive: true,
  },
  {
    id: 'healthcare-professional',
    name: 'Helsepersonell',
    description: 'Spesialisert mal for leger, sykepleiere og helsepersonell med grønn tema og medisinske ikoner.',
    category: 'healthcare',
    atsScore: 90,
    isAtsOptimized: true,
    layout: 'single-column',
    sections: ['summary','experience','education','skills','certifications'],
    previewImage: '/templates/healthcare-professional-preview.png',
    colorSchemes: ['healthcare-green','healthcare-teal','healthcare-blue'],
    fonts: { heading: 'Arial', body: 'Arial' },
    isPremium: false,
    isActive: true,
  },
  {
    id: 'academic-researcher',
    name: 'Akademisk Forsker',
    description: 'Profesjonell mal for forskere, professorer og akademikere med fokus på publikasjoner og forskning.',
    category: 'academic',
    atsScore: 95,
    isAtsOptimized: true,
    layout: 'single-column',
    sections: ['summary','experience','education','skills','certifications','projects'],
    previewImage: '/templates/academic-researcher-preview.png',
    colorSchemes: ['academic-blue','academic-navy','academic-gray'],
    fonts: { heading: 'Times New Roman', body: 'Times New Roman' },
    isPremium: false,
    isActive: true,
  },
  {
    id: 'executive-leadership',
    name: 'Toppledelse',
    description: 'Elegant mal for direktører, ledere og toppledelse med sofistikert design og fokus på lederskap.',
    category: 'executive',
    atsScore: 85,
    isAtsOptimized: true,
    layout: 'single-column',
    sections: ['summary','experience','education','skills','certifications'],
    previewImage: '/templates/executive-leadership-preview.png',
    colorSchemes: ['executive-black','executive-navy','executive-charcoal'],
    fonts: { heading: 'Helvetica', body: 'Helvetica' },
    isPremium: false,
    isActive: true,
  },
  {
    id: 'sales-professional',
    name: 'Salgsprofil',
    description: 'Dynamisk mal for salgsrepresentanter og -ledere med oransje tema og fokus på prestasjoner.',
    category: 'sales',
    atsScore: 90,
    isAtsOptimized: true,
    layout: 'single-column',
    sections: ['summary','experience','education','skills','certifications'],
    previewImage: '/templates/sales-professional-preview.png',
    colorSchemes: ['sales-orange','sales-red', 'sales-yellow'],
    fonts: { heading: 'Arial', body: 'Arial' },
    isPremium: false,
    isActive: true,
  },
];

