// @ts-nocheck
/**
 * CreatorHub Norge - ATS-Friendly Resume Templates
 * Professional, modern resume templates optimized for ATS systems
 */

import React from 'react';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../../universal/hooks/useDynamicProfessions';
import {
  Box,
  Typography,
  Divider,
  Grid,
  Stack,
} from '@mui/material';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PublicIcon from '@mui/icons-material/Public';
import LanguageIcon from '@mui/icons-material/Language';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import SchoolIcon from '@mui/icons-material/School';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import BuildIcon from '@mui/icons-material/Build';
import DescriptionIcon from '@mui/icons-material/Description';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import ScienceIcon from '@mui/icons-material/Science';
import VerifiedIcon from '@mui/icons-material/Verified';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';

// Small helpers so contact-rows and section-headers render with a
// CreatorHub MUI-ikon i stedet for emojis. Holder lest-rytmen i ATS-
// templatene siden ATS-parsing leser tekstinnholdet rundt ikonet.
const ContactLine: React.FC<{ icon: React.ReactNode; children: React.ReactNode; sx?: object }> = ({ icon, children, sx }) => (
  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, ...sx }}>
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', '& svg': { fontSize: '1em' } }}>
      {icon}
    </Box>
    <span>{children}</span>
  </Box>
);

const SectionHeading: React.FC<{ icon: React.ReactNode; label: string; sx?: object }> = ({ icon, label, sx }) => (
  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, ...sx }}>
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', '& svg': { fontSize: '1em' } }}>
      {icon}
    </Box>
    <span>{label}</span>
  </Box>
);

// ============================================================================
// TEMPLATE INTERFACES
// ============================================================================

export interface ResumeTemplateProps {
  resume: any;
  preview?: boolean;
}

// ============================================================================
// COLOR SCHEMES — globalt sett brukere kan velge mellom.
// ============================================================================
//
// Hver template har en `defaultAccent`-farge, men brukeren kan
// overstyre med `resume.colorScheme` (en av nøklene under) og
// dermed gi alle templates et felles fargeuttrykk.

export interface ColorScheme {
  id: string;
  name: string;
  accent: string;
  accentDark: string;
  bgSoft: string;
  textOnAccent: string;
}

export const RESUME_COLOR_SCHEMES: Record<string, ColorScheme> = {
  'creator-orange': {
    id: 'creator-orange', name: 'CreatorHub Orange',
    accent: '#FF6B35', accentDark: '#E85A24', bgSoft: '#FFF0E8', textOnAccent: '#FFFFFF',
  },
  'nordic-navy': {
    id: 'nordic-navy', name: 'Nordic Navy',
    accent: '#1F2937', accentDark: '#0F172A', bgSoft: '#F3F4F6', textOnAccent: '#FFFFFF',
  },
  'tan-bronze': {
    id: 'tan-bronze', name: 'Modern Tan',
    accent: '#C09464', accentDark: '#A37947', bgSoft: '#F3F1ED', textOnAccent: '#FFFFFF',
  },
  'forest-green': {
    id: 'forest-green', name: 'Forest Green',
    accent: '#10B981', accentDark: '#059669', bgSoft: '#ECFDF5', textOnAccent: '#FFFFFF',
  },
  'royal-purple': {
    id: 'royal-purple', name: 'Royal Purple',
    accent: '#6366F1', accentDark: '#4F46E5', bgSoft: '#EEF2FF', textOnAccent: '#FFFFFF',
  },
  'crimson-red': {
    id: 'crimson-red', name: 'Crimson Red',
    accent: '#DC2626', accentDark: '#B91C1C', bgSoft: '#FEF2F2', textOnAccent: '#FFFFFF',
  },
  'ocean-blue': {
    id: 'ocean-blue', name: 'Ocean Blue',
    accent: '#0EA5E9', accentDark: '#0284C7', bgSoft: '#E0F2FE', textOnAccent: '#FFFFFF',
  },
  'monochrome-black': {
    id: 'monochrome-black', name: 'Monochrome',
    accent: '#111111', accentDark: '#000000', bgSoft: '#F5F5F5', textOnAccent: '#FFFFFF',
  },
};

/** Hjelp templates med å hente "current accent" — bruker valgt skjema
 *  hvis satt, ellers templatens default. */
export function resolveAccent(resume: any, fallback: string): string {
  const schemeId = resume?.colorScheme as string | undefined;
  if (schemeId && RESUME_COLOR_SCHEMES[schemeId]) {
    return RESUME_COLOR_SCHEMES[schemeId].accent;
  }
  return fallback;
}

// ============================================================================
// SHARED RENDER HELPERS
// ============================================================================
//
// Etter migrasjon 0132 har resume også `languages` og hver experience
// kan ha `experienceGroups` (Array<{category, items[]}>) for sub-roller.
// Disse helperne brukes av ALLE templates så vi får konsistent rendering
// uten å duplisere logikken i hver komponent.

/** Splitter experiences i vanlige stillinger vs praksis-/internship. */
function splitExperiencesByType(experiences: any[] = []) {
  const regular: any[] = [];
  const internships: any[] = [];
  for (const e of experiences) {
    if (e?.employmentType === 'internship') internships.push(e);
    else regular.push(e);
  }
  return { regular, internships };
}

/**
 * Returnerer bullet-grupper for én erfaring. Hvis experienceGroups er
 * satt brukes den strukturerte gruppe-formen ("Produsent:\n  • ..."),
 * ellers faller vi tilbake på flat achievements-array.
 */
function getExperienceBullets(
  exp: any,
): Array<{ category?: string; items: string[] }> {
  const groups: any[] = Array.isArray(exp?.experienceGroups) ? exp.experienceGroups : [];
  if (groups.length > 0) {
    return groups
      .filter((g) => Array.isArray(g?.items) && g.items.length > 0)
      .map((g) => ({
        category: typeof g.category === 'string' ? g.category : undefined,
        items: (g.items as unknown[])
          .map((it) => (typeof it === 'string' ? it.trim() : ''))
          .filter(Boolean),
      }));
  }
  const ach = Array.isArray(exp?.achievements) ? exp.achievements : [];
  return ach.length ? [{ items: ach }] : [];
}

/** Generic språk-render — mottar styling-config så hver template kan
 *  bestemme farge + variant (bar/dot/text). */
interface LanguageRenderConfig {
  accent: string;
  bgTrack?: string;
  variant?: 'bar' | 'text';
  fontSize?: number;
  labelSize?: number;
}

function renderLanguageList(
  languages: any[] = [],
  cfg: LanguageRenderConfig,
): React.ReactNode {
  if (!languages?.length) return null;
  const fontSize = cfg.fontSize ?? 12;
  const labelSize = cfg.labelSize ?? 11;
  return (
    <Stack spacing={1}>
      {languages.map((l: any) => (
        <Box key={l.id}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.3 }}>
            <Typography sx={{ fontSize, fontWeight: 600 }}>{l.name}</Typography>
            {l.levelLabel && (
              <Typography sx={{ fontSize: labelSize, color: cfg.accent, fontWeight: 600 }}>
                {l.levelLabel}
              </Typography>
            )}
          </Stack>
          {cfg.variant !== 'text' && (
            <Box
              sx={{
                height: 4,
                bgcolor: cfg.bgTrack ?? '#E5E7EB',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  width: `${Math.max(20, Math.min(100, l.proficiencyLevel ?? 80))}%`,
                  height: '100%',
                  bgcolor: cfg.accent,
                }}
              />
            </Box>
          )}
        </Box>
      ))}
    </Stack>
  );
}

/** Render én experience-blokks bullet-innhold (description + groups/achievements).
 *  Hver template kaller dette inni sin egen wrapper. */
function renderExperienceContent(
  exp: any,
  opts: { bulletSize?: number; categoryBold?: boolean; bullet?: string } = {},
): React.ReactNode {
  const bulletSize = opts.bulletSize ?? 12;
  const bulletChar = opts.bullet ?? '•';
  const groups = getExperienceBullets(exp);
  return (
    <>
      {exp.description && (
        <Typography sx={{ fontSize: bulletSize, lineHeight: 1.55, mb: 0.5 }}>
          {exp.description}
        </Typography>
      )}
      {groups.map((g, gi) => (
        <Box key={gi} sx={{ mt: g.category ? 0.5 : 0 }}>
          {g.category && (
            <Typography sx={{ fontWeight: opts.categoryBold ?? true ? 700 : 500, fontSize: bulletSize }}>
              {g.category}:
            </Typography>
          )}
          {g.items.map((it, ii) => (
            <Typography key={ii} sx={{ fontSize: bulletSize, ml: 1.5 }}>
              {bulletChar} {it}
            </Typography>
          ))}
        </Box>
      ))}
    </>
  );
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

      {(() => {
        const { regular, internships } = splitExperiencesByType(resume.experiences ?? []);
        const renderExp = (exp: any) => (
          <Box key={exp.id} sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>{exp.jobTitle}</Typography>
              <Typography sx={{ fontSize: '12px', color: '#7f8c8d' }}>
                {new Date(exp.startDate).toLocaleDateString('no-NO', { year: 'numeric', month: 'short' })} - {exp.isCurrent ? 'Nå' : (exp.endDate ? new Date(exp.endDate).toLocaleDateString('no-NO', { year: 'numeric', month: 'short' }) : '')}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '13px', fontStyle: 'italic', color: '#34495e' }}>
              {exp.company}{exp.location ? ` | ${exp.location}` : ''}
            </Typography>
            <Box sx={{ mt: 1 }}>
              {renderExperienceContent(exp, { bulletSize: 12 })}
            </Box>
          </Box>
        );
        return (
          <>
            {regular.length > 0 && (
              <Box sx={styles.section}>
                <Typography sx={styles.sectionTitle}>Arbeidserfaring</Typography>
                {regular.map(renderExp)}
              </Box>
            )}
            {internships.length > 0 && (
              <Box sx={styles.section}>
                <Typography sx={styles.sectionTitle}>Praksisplasser</Typography>
                {internships.map(renderExp)}
              </Box>
            )}
          </>
        );
      })()}

      {/* Skills */}
      {resume.skills?.length > 0 && (
        <Box sx={styles.section}>
          <Typography sx={styles.sectionTitle}>Ferdigheter</Typography>
          <Typography variant="body2" sx={{ fontSize: '12px' }}>
            {resume.skills.map((skill: any) => skill.name).join(' • ')}
          </Typography>
        </Box>
      )}

      {/* Languages */}
      {resume.languages?.length > 0 && (
        <Box sx={styles.section}>
          <Typography sx={styles.sectionTitle}>Språk</Typography>
          {renderLanguageList(resume.languages, { accent: '#2c3e50', variant: 'text', fontSize: 12 })}
        </Box>
      )}

      {/* Education */}
      {resume.education?.length > 0 && (
        <Box sx={styles.section}>
          <Typography sx={styles.sectionTitle}>Utdanning</Typography>
          {resume.education.map((edu: any) => (
            <Box key={edu.id} sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>{edu.degree}</Typography>
                <Typography sx={{ fontSize: '12px', color: '#7f8c8d' }}>
                  {new Date(edu.startDate).getFullYear()} - {edu.isCurrent ? 'Nå' : (edu.endDate ? new Date(edu.endDate).getFullYear() : '')}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '13px', fontStyle: 'italic', color: '#34495e' }}>
                {edu.institution}
              </Typography>
              {edu.description && (
                <Typography sx={{ fontSize: 12, lineHeight: 1.55, mt: 0.5 }}>{edu.description}</Typography>
              )}
              {(edu.achievements ?? []).map((a: string, i: number) => (
                <Typography key={i} sx={{ fontSize: 12, ml: 1.5 }}>• {a}</Typography>
              ))}
            </Box>
          ))}
        </Box>
      )}

      {/* Certifications */}
      {resume.certifications?.length > 0 && (
        <Box sx={styles.section}>
          <Typography sx={styles.sectionTitle}>Sertifiseringer</Typography>
          {resume.certifications.map((c: any) => (
            <Box key={c.id} sx={{ mb: 0.5 }}>
              <Typography sx={{ fontSize: 13 }}>
                <Box component="span" sx={{ fontWeight: 600 }}>{c.name}</Box>
                {' — '}{c.issuer}
                {c.issueDate && (
                  <Box component="span" sx={{ color: '#7f8c8d', ml: 1 }}>
                    ({new Date(c.issueDate).toLocaleDateString('no-NO', { year: 'numeric', month: 'short' })})
                  </Box>
                )}
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
                <Stack spacing={1} sx={{ fontSize: '12px', mb: 2 }}>
                  {resume.skills.map((skill: any) => (
                    <Typography key={skill.id} variant="body2">
                      • {skill.name}
                    </Typography>
                  ))}
                </Stack>
              </>
            )}

            {resume.languages?.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, fontSize: '14px' }}>
                  SPRÅK
                </Typography>
                {renderLanguageList(resume.languages, { accent: '#34495e', bgTrack: 'rgba(255,255,255,0.2)', fontSize: 12 })}
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

          {(() => {
            const { regular, internships } = splitExperiencesByType(resume.experiences ?? []);
            const renderExp = (exp: any) => (
              <Box key={exp.id} sx={{ mb: 2 }}>
                <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>{exp.jobTitle}</Typography>
                <Typography sx={{ fontSize: '12px', color: '#7f8c8d' }}>
                  {exp.company}{exp.location ? `, ${exp.location}` : ''} | {new Date(exp.startDate).getFullYear()} - {exp.isCurrent ? 'Nå' : (exp.endDate ? new Date(exp.endDate).getFullYear() : '')}
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  {renderExperienceContent(exp, { bulletSize: 11 })}
                </Box>
              </Box>
            );
            return (
              <>
                {regular.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#34495e' }}>ERFARING</Typography>
                    {regular.map(renderExp)}
                  </Box>
                )}
                {internships.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#34495e' }}>PRAKSISPLASSER</Typography>
                    {internships.map(renderExp)}
                  </Box>
                )}
              </>
            );
          })()}

          {/* Education */}
          {resume.education?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#34495e' }}>
                UTDANNING
              </Typography>
              {resume.education.map((edu: any) => (
                <Box key={edu.id} sx={{ mb: 2 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>{edu.degree}</Typography>
                  <Typography sx={{ fontSize: '12px', color: '#7f8c8d' }}>
                    {edu.institution} | {new Date(edu.startDate).getFullYear()}
                    {edu.endDate ? `-${new Date(edu.endDate).getFullYear()}` : ''}
                  </Typography>
                  {edu.description && (
                    <Typography sx={{ fontSize: 11, lineHeight: 1.55, mt: 0.4 }}>{edu.description}</Typography>
                  )}
                  {(edu.achievements ?? []).map((a: string, i: number) => (
                    <Typography key={i} sx={{ fontSize: 11, ml: 1.5 }}>• {a}</Typography>
                  ))}
                </Box>
              ))}
            </Box>
          )}

          {/* Certifications */}
          {resume.certifications?.length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#34495e' }}>
                SERTIFISERINGER
              </Typography>
              {resume.certifications.map((c: any) => (
                <Box key={c.id} sx={{ mb: 0.5 }}>
                  <Typography sx={{ fontSize: 12 }}>
                    <Box component="span" sx={{ fontWeight: 600 }}>{c.name}</Box>
                    {' — '}{c.issuer}
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
  const head = (label: string) => (
    <Typography sx={{ fontSize: 13, fontWeight: 300, letterSpacing: 4, color: '#111', mt: 3, mb: 1.5 }}>
      {label.toUpperCase()}
    </Typography>
  );
  const { regular, internships } = splitExperiencesByType(resume.experiences ?? []);
  const renderExp = (exp: any) => (
    <Box key={exp.id} sx={{ mb: 2.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline">
        <Typography sx={{ fontWeight: 500, fontSize: 13 }}>
          {exp.jobTitle} <Box component="span" sx={{ color: '#9CA3AF' }}>·</Box> {exp.company}
        </Typography>
        <Typography sx={{ fontSize: 11, color: '#9CA3AF', fontWeight: 300 }}>
          {new Date(exp.startDate).getFullYear()}–{exp.isCurrent ? 'nå' : (exp.endDate ? new Date(exp.endDate).getFullYear() : '')}
        </Typography>
      </Stack>
      {exp.location && (
        <Typography sx={{ fontSize: 11, color: '#9CA3AF', mb: 0.4 }}>{exp.location}</Typography>
      )}
      {renderExperienceContent(exp, { bulletSize: 11.5, bullet: '–' })}
    </Box>
  );
  return (
    <Box sx={{ maxWidth: '8.5in', minHeight: '11in', bgcolor: 'white', p: preview ? 2 : 4, fontFamily: 'Inter, sans-serif' }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h2" sx={{ fontWeight: 300, fontSize: '36px', letterSpacing: 2 }}>
          {(resume.personalInfo?.fullName ?? '').toUpperCase()}
        </Typography>
        {resume.personalInfo?.professionalTitle && (
          <Typography variant="body1" sx={{ mt: 1, fontWeight: 300, letterSpacing: 1, color: '#374151' }}>
            {resume.personalInfo.professionalTitle}
          </Typography>
        )}
        <Typography variant="body2" sx={{ mt: 2, color: '#9CA3AF', fontSize: 12 }}>
          {[resume.personalInfo?.email, resume.personalInfo?.phone, resume.personalInfo?.location].filter(Boolean).join(' • ')}
        </Typography>
      </Box>
      <Divider sx={{ mb: 2 }} />

      {resume.personalInfo?.summary && (
        <>
          {head('Profil')}
          <Typography sx={{ fontSize: 12, lineHeight: 1.7 }}>{resume.personalInfo.summary}</Typography>
        </>
      )}
      {regular.length > 0 && (<>{head('Erfaring')}{regular.map(renderExp)}</>)}
      {resume.education?.length > 0 && (
        <>
          {head('Utdanning')}
          {resume.education.map((e: any) => (
            <Box key={e.id} sx={{ mb: 1.5 }}>
              <Stack direction="row" justifyContent="space-between">
                <Typography sx={{ fontSize: 12.5, fontWeight: 500 }}>
                  {e.degree} <Box component="span" sx={{ color: '#9CA3AF' }}>·</Box> {e.institution}
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#9CA3AF', fontWeight: 300 }}>
                  {new Date(e.startDate).getFullYear()}–{e.isCurrent ? 'nå' : (e.endDate ? new Date(e.endDate).getFullYear() : '')}
                </Typography>
              </Stack>
              {e.description && <Typography sx={{ fontSize: 11.5, lineHeight: 1.6 }}>{e.description}</Typography>}
            </Box>
          ))}
        </>
      )}
      {resume.skills?.length > 0 && (
        <>
          {head('Ferdigheter')}
          <Typography sx={{ fontSize: 12, lineHeight: 1.8 }}>
            {resume.skills.map((s: any) => s.name).join(' · ')}
          </Typography>
        </>
      )}
      {resume.languages?.length > 0 && (
        <>
          {head('Språk')}
          {renderLanguageList(resume.languages, { accent: '#111', variant: 'text', fontSize: 12 })}
        </>
      )}
      {resume.certifications?.length > 0 && (
        <>
          {head('Sertifiseringer')}
          {resume.certifications.map((c: any) => (
            <Stack key={c.id} direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
              <Typography sx={{ fontSize: 12 }}>
                <Box component="span" sx={{ fontWeight: 500 }}>{c.name}</Box> · {c.issuer}
              </Typography>
              {c.issueDate && (
                <Typography sx={{ fontSize: 11, color: '#9CA3AF', fontWeight: 300 }}>
                  {new Date(c.issueDate).getFullYear()}
                </Typography>
              )}
            </Stack>
          ))}
        </>
      )}
      {internships.length > 0 && (<>{head('Praksisplasser')}{internships.map(renderExp)}</>)}
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

        {(() => {
          const { regular, internships } = splitExperiencesByType(resume.experiences ?? []);
          const renderExp = (exp: any) => (
            <Box key={exp.id} sx={{ mb: 2 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>{exp.jobTitle}</Typography>
              <Typography sx={{ fontSize: '12px', color: '#2c3e50', fontWeight: 600 }}>
                {exp.company}{exp.location ? `, ${exp.location}` : ''}
              </Typography>
              <Typography sx={{ fontSize: '11px', color: '#7f8c8d', mb: 1 }}>
                {new Date(exp.startDate).toLocaleDateString('no-NO', { year: 'numeric', month: 'long' })}
                {' – '}
                {exp.isCurrent ? 'DAGS DATO' : (exp.endDate ? new Date(exp.endDate).toLocaleDateString('no-NO', { year: 'numeric', month: 'long' }) : '')}
              </Typography>
              {renderExperienceContent(exp, { bulletSize: 11 })}
            </Box>
          );
          return (
            <>
              {regular.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography sx={styles.sectionTitle}>Arbeidshistorikk</Typography>
                  {regular.map(renderExp)}
                </Box>
              )}
              {internships.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography sx={styles.sectionTitle}>Praksisplasser</Typography>
                  {internships.map(renderExp)}
                </Box>
              )}
            </>
          );
        })()}

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

        {/* Languages — bruker faktisk resume.languages-data nå (ikke hardkodet) */}
        {resume.languages?.length > 0 && (
          <Box>
            <Typography sx={styles.rightSectionTitle}>Språk</Typography>
            {renderLanguageList(resume.languages, {
              accent: 'white',
              bgTrack: 'rgba(255,255,255,0.3)',
              fontSize: 12,
              labelSize: 10,
            })}
          </Box>
        )}
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
              <ContactLine icon={<MailOutlineIcon />}>{resume.personalInfo.email}</ContactLine>
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '14px', color: '#34495e' }}>
              <ContactLine icon={<PhoneIphoneIcon />}>{resume.personalInfo.phone}</ContactLine>
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '14px', color: '#34495e' }}>
              <ContactLine icon={<LocationOnIcon />}>{resume.personalInfo.location}</ContactLine>
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

          {resume.languages?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#2c3e50', mb: 2 }}>
                Språk
              </Typography>
              {renderLanguageList(resume.languages, { accent: '#e74c3c', fontSize: 12 })}
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
          <Typography variant="body2"><ContactLine icon={<MailOutlineIcon />}>{resume.personalInfo.email}</ContactLine></Typography>
          <Typography variant="body2"><ContactLine icon={<PhoneIphoneIcon />}>{resume.personalInfo.phone}</ContactLine></Typography>
          <Typography variant="body2"><ContactLine icon={<LocationOnIcon />}>{resume.personalInfo.location}</ContactLine></Typography>
        </Stack>
      </Box>

      {/* Grid layout */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          {/* Summary */}
          {resume.personalInfo.summary && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#667eea', mb: 1 }}>
                <SectionHeading icon={<DescriptionIcon />} label="Profil" />
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
                <SectionHeading icon={<WorkOutlineIcon />} label="Arbeidserfaring" />
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
                  <Box sx={{ mt: 1 }}>
                    {renderExperienceContent(exp, { bulletSize: 12 })}
                  </Box>
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
                <SectionHeading icon={<BuildIcon />} label="Teknologier" />
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

          {resume.languages?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#667eea', mb: 2 }}>
                <SectionHeading icon={<PublicIcon />} label="Språk" />
              </Typography>
              {renderLanguageList(resume.languages, { accent: '#667eea', fontSize: 12 })}
            </Box>
          )}

          {/* Education */}
          {resume.education?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#667eea', mb: 2 }}>
                <SectionHeading icon={<SchoolIcon />} label="Utdanning" />
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
                <SectionHeading icon={<EmojiEventsIcon />} label="Sertifiseringer" />
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
              <ContactLine icon={<MailOutlineIcon />}>{resume.personalInfo.email}</ContactLine>
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '13px', color: '#2e7d32' }}>
              <ContactLine icon={<PhoneIphoneIcon />}>{resume.personalInfo.phone}</ContactLine>
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '13px', color: '#2e7d32' }}>
              <ContactLine icon={<LocationOnIcon />}>{resume.personalInfo.location}</ContactLine>
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
                <SectionHeading icon={<MedicalServicesIcon />} label="Profesjonell profil" />
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
                <SectionHeading icon={<LocalHospitalIcon />} label="Klinisk erfaring" />
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
                  <Box sx={{ mt: 1 }}>
                    {renderExperienceContent(exp, { bulletSize: 12 })}
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          {/* Education */}
          {resume.education?.length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32', mb: 2 }}>
                <SectionHeading icon={<SchoolIcon />} label="Utdanning & sertifiseringer" />
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
                <SectionHeading icon={<ScienceIcon />} label="Spesialiseringer" />
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
                <SectionHeading icon={<VerifiedIcon />} label="Lisenser & godkjenninger" />
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

          {/* Languages — bruker resume.languages-data (ikke hardkodet lenger) */}
          {resume.languages?.length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32', mb: 2 }}>
                <SectionHeading icon={<PublicIcon />} label="Språk" />
              </Typography>
              {renderLanguageList(resume.languages, { accent: '#4caf50', fontSize: 12 })}
            </Box>
          )}
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
          <Typography variant="body2"><ContactLine icon={<MailOutlineIcon />}>{resume.personalInfo.email}</ContactLine></Typography>
          <Typography variant="body2"><ContactLine icon={<PhoneIphoneIcon />}>{resume.personalInfo.phone}</ContactLine></Typography>
          <Typography variant="body2"><ContactLine icon={<LocationOnIcon />}>{resume.personalInfo.location}</ContactLine></Typography>
          {resume.personalInfo.website && <Typography variant="body2"><ContactLine icon={<PublicIcon />}>Portfolio</ContactLine></Typography>}
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
                  <Box sx={{ mt: 1 }}>
                    {renderExperienceContent(exp, { bulletSize: 12 })}
                  </Box>
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

          {resume.languages?.length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#1976d2', mb: 2, borderBottom: '1px solid #e3f2fd', pb: 0.5 }}>
                Språk
              </Typography>
              {renderLanguageList(resume.languages, { accent: '#1976d2', fontSize: 12 })}
            </Box>
          )}
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
          <Typography variant="body2"><ContactLine icon={<MailOutlineIcon />}>{resume.personalInfo.email}</ContactLine></Typography>
          <Typography variant="body2"><ContactLine icon={<PhoneIphoneIcon />}>{resume.personalInfo.phone}</ContactLine></Typography>
          <Typography variant="body2"><ContactLine icon={<LocationOnIcon />}>{resume.personalInfo.location}</ContactLine></Typography>
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
                  <Box sx={{ mt: 1 }}>
                    {renderExperienceContent(exp, { bulletSize: 13 })}
                  </Box>
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

          {resume.languages?.length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1a1a1a', mb: 2 }}>
                Språk
              </Typography>
              {renderLanguageList(resume.languages, { accent: '#1a1a1a', fontSize: 12 })}
            </Box>
          )}
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
          <Typography variant="body2"><ContactLine icon={<MailOutlineIcon />}>{resume.personalInfo.email}</ContactLine></Typography>
          <Typography variant="body2"><ContactLine icon={<PhoneIphoneIcon />}>{resume.personalInfo.phone}</ContactLine></Typography>
          <Typography variant="body2"><ContactLine icon={<LocationOnIcon />}>{resume.personalInfo.location}</ContactLine></Typography>
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
                <SectionHeading icon={<WorkOutlineIcon />} label="Salgserfaring" />
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
                  <Box sx={{ mt: 1 }}>
                    {renderExperienceContent(exp, { bulletSize: 12 })}
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          {/* Education */}
          {resume.education?.length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#e65100', mb: 2 }}>
                <SectionHeading icon={<SchoolIcon />} label="Utdanning" />
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
                <SectionHeading icon={<TrackChangesIcon />} label="Salgsferdigheter" />
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
                <SectionHeading icon={<EmojiEventsIcon />} label="Prestasjoner" />
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

          {/* Languages — bruker resume.languages-data (ikke hardkodet) */}
          {resume.languages?.length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#e65100', mb: 2 }}>
                <SectionHeading icon={<PublicIcon />} label="Språk" />
              </Typography>
              {renderLanguageList(resume.languages, { accent: '#e65100', fontSize: 12 })}
            </Box>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

// ============================================================================
// TEMPLATE 11: NORDIC DARK SIDEBAR (klassisk norsk creator-CV)
// ============================================================================

export const NordicDarkSidebarTemplate: React.FC<ResumeTemplateProps> = ({ resume, preview = false }) => {
  const accent = '#1f2937'; // mørk navy
  const accentText = '#FFFFFF';
  const muted = '#6B7280';
  const sectionTitle = (label: string) => (
    <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 14, mb: 1.2, color: accent, letterSpacing: 0.4 }}>
      {label.toUpperCase()}
    </Typography>
  );
  const sidebarTitle = (label: string) => (
    <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 12, mb: 1, color: '#9CA3AF', letterSpacing: 1.5 }}>
      {label.toUpperCase()}
    </Typography>
  );
  return (
    <Box sx={{
      maxWidth: '8.5in', minHeight: '11in', bgcolor: 'white',
      display: 'flex', fontFamily: 'Inter, "Segoe UI", sans-serif',
      boxShadow: preview ? 1 : 0,
    }}>
      {/* Main column */}
      <Box sx={{ flex: 1, p: preview ? 2.5 : 5 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          {resume.personalInfo?.profilePhoto && (
            <Box sx={{
              width: 64, height: 64, borderRadius: '50%', overflow: 'hidden',
              backgroundImage: `url(${resume.personalInfo.profilePhoto})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
              flexShrink: 0,
            }} />
          )}
          <Box>
            <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 30, lineHeight: 1.1 }}>
              {resume.personalInfo?.fullName}
            </Typography>
            <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 11, letterSpacing: 3, color: muted, mt: 0.5 }}>
              {(resume.personalInfo?.professionalTitle ?? '').toUpperCase()}
            </Typography>
          </Box>
        </Stack>

        {resume.personalInfo?.summary && (
          <Box sx={{ mb: 3 }}>
            {sectionTitle('Profil')}
            <Typography sx={{ fontSize: 12, lineHeight: 1.6, color: '#374151' }}>
              {resume.personalInfo.summary}
            </Typography>
          </Box>
        )}

        {(() => {
          const regular = (resume.experiences ?? []).filter((e: any) => e.employmentType !== 'internship');
          if (!regular.length) return null;
          return (
            <Box sx={{ mb: 3 }}>
              {sectionTitle('Arbeidshistorikk')}
              {regular.map((exp: any) => (
                <Box key={exp.id} sx={{ mb: 2 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
                    {exp.jobTitle}, {exp.company}{exp.location ? `, ${exp.location}` : ''}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: muted, letterSpacing: 1.2, mt: 0.2, mb: 0.6 }}>
                    {new Date(exp.startDate).toLocaleDateString('no-NO', { month: 'long', year: 'numeric' }).toUpperCase()}
                    {' — '}
                    {exp.isCurrent ? 'DAGS DATO' : (exp.endDate ? new Date(exp.endDate).toLocaleDateString('no-NO', { month: 'long', year: 'numeric' }).toUpperCase() : '')}
                  </Typography>
                  {exp.description && (
                    <Typography sx={{ fontSize: 12, lineHeight: 1.5, mb: 0.5 }}>{exp.description}</Typography>
                  )}
                  {Array.isArray(exp.experienceGroups) && exp.experienceGroups.length > 0 ? (
                    exp.experienceGroups.map((g: any, i: number) => (
                      <Box key={i} sx={{ mt: 0.5 }}>
                        {g.category && (
                          <Typography sx={{ fontWeight: 700, fontSize: 12 }}>{g.category}:</Typography>
                        )}
                        {(g.items ?? []).map((it: string, j: number) => (
                          <Typography key={j} sx={{ fontSize: 11.5, ml: 1.5 }}>- {it}</Typography>
                        ))}
                      </Box>
                    ))
                  ) : (exp.achievements ?? []).length > 0 ? (
                    (exp.achievements as string[]).map((a, i) => (
                      <Typography key={i} sx={{ fontSize: 11.5, ml: 1.5 }}>- {a}</Typography>
                    ))
                  ) : null}
                </Box>
              ))}
            </Box>
          );
        })()}

        {(resume.education ?? []).length > 0 && (
          <Box sx={{ mb: 3 }}>
            {sectionTitle('Utdanning')}
            {resume.education.map((e: any) => (
              <Box key={e.id} sx={{ mb: 1.5 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
                  {e.degree}{e.institution ? `, ${e.institution}` : ''}{e.location ? `, ${e.location}` : ''}
                </Typography>
                <Typography sx={{ fontSize: 10, color: muted, letterSpacing: 1.2, mt: 0.2 }}>
                  {new Date(e.startDate).toLocaleDateString('no-NO', { month: 'long', year: 'numeric' }).toUpperCase()}
                  {' — '}
                  {e.isCurrent ? 'NÅ' : (e.endDate ? new Date(e.endDate).toLocaleDateString('no-NO', { month: 'long', year: 'numeric' }).toUpperCase() : '')}
                </Typography>
                {e.fieldOfStudy && <Typography sx={{ fontSize: 12, mt: 0.4 }}>{e.fieldOfStudy}</Typography>}
                {e.description && <Typography sx={{ fontSize: 11.5, mt: 0.4, lineHeight: 1.5 }}>{e.description}</Typography>}
                {(e.achievements ?? []).map((a: string, i: number) => (
                  <Typography key={i} sx={{ fontSize: 11.5, ml: 1.5 }}>• {a}</Typography>
                ))}
              </Box>
            ))}
          </Box>
        )}

        {(resume.certifications ?? []).length > 0 && (
          <Box sx={{ mb: 3 }}>
            {sectionTitle('Sertifiseringer')}
            {resume.certifications.map((c: any) => (
              <Box key={c.id} sx={{ mb: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 12 }}>{c.name}, {c.issuer}</Typography>
                <Typography sx={{ fontSize: 10, color: muted, letterSpacing: 1.2 }}>
                  {new Date(c.issueDate).toLocaleDateString('no-NO', { month: 'long', year: 'numeric' }).toUpperCase()}
                  {c.expiryDate && ` — ${new Date(c.expiryDate).toLocaleDateString('no-NO', { month: 'long', year: 'numeric' }).toUpperCase()}`}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {(() => {
          const interns = (resume.experiences ?? []).filter((e: any) => e.employmentType === 'internship');
          if (!interns.length) return null;
          return (
            <Box sx={{ mb: 3 }}>
              {sectionTitle('Praksisplasser')}
              {interns.map((exp: any) => (
                <Box key={exp.id} sx={{ mb: 1.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
                    {exp.jobTitle}, {exp.company}{exp.location ? `, ${exp.location}` : ''}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: muted, letterSpacing: 1.2, mt: 0.2, mb: 0.5 }}>
                    {new Date(exp.startDate).toLocaleDateString('no-NO', { month: 'long', year: 'numeric' }).toUpperCase()}
                    {' — '}
                    {exp.isCurrent ? 'NÅ' : (exp.endDate ? new Date(exp.endDate).toLocaleDateString('no-NO', { month: 'long', year: 'numeric' }).toUpperCase() : '')}
                  </Typography>
                  {exp.description && (
                    <Typography sx={{ fontSize: 11.5, lineHeight: 1.5 }}>{exp.description}</Typography>
                  )}
                </Box>
              ))}
            </Box>
          );
        })()}
      </Box>

      {/* Right dark sidebar */}
      <Box sx={{
        width: '34%', bgcolor: accent, color: accentText, p: preview ? 2 : 4,
      }}>
        {sidebarTitle('Detaljer')}
        <Stack spacing={0.4} sx={{ mb: 3 }}>
          {resume.personalInfo?.location && (
            <Typography sx={{ fontSize: 12 }}>{resume.personalInfo.location}</Typography>
          )}
          {resume.personalInfo?.phone && (
            <Typography sx={{ fontSize: 12 }}>{resume.personalInfo.phone}</Typography>
          )}
          {resume.personalInfo?.email && (
            <Typography sx={{ fontSize: 12, wordBreak: 'break-all' }}>{resume.personalInfo.email}</Typography>
          )}
        </Stack>

        {resume.personalInfo?.linkedin && (
          <>
            {sidebarTitle('Lenker')}
            <Typography sx={{ fontSize: 12, color: '#93C5FD', textDecoration: 'underline', mb: 3 }}>
              Linkedin-profil
            </Typography>
          </>
        )}

        {(resume.skills ?? []).length > 0 && (
          <>
            {sidebarTitle('Ferdigheter')}
            <Stack spacing={1.5} sx={{ mb: 3 }}>
              {resume.skills.map((s: any) => (
                <Box key={s.id}>
                  <Typography sx={{ fontSize: 12, mb: 0.5 }}>{s.name}</Typography>
                  <Box sx={{ height: 3, bgcolor: 'rgba(255,255,255,0.18)', borderRadius: 1, overflow: 'hidden' }}>
                    <Box sx={{ width: `${Math.max(20, Math.min(100, s.proficiencyLevel ?? 80))}%`, height: '100%', bgcolor: '#fff' }} />
                  </Box>
                </Box>
              ))}
            </Stack>
          </>
        )}

        {(resume.languages ?? []).length > 0 && (
          <>
            {sidebarTitle('Språk')}
            <Stack spacing={1.5}>
              {resume.languages.map((l: any) => (
                <Box key={l.id}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.3 }}>
                    <Typography sx={{ fontSize: 12 }}>{l.name}</Typography>
                    {l.levelLabel && (
                      <Typography sx={{ fontSize: 10, color: '#D1D5DB' }}>{l.levelLabel}</Typography>
                    )}
                  </Stack>
                  <Box sx={{ height: 3, bgcolor: 'rgba(255,255,255,0.18)', borderRadius: 1, overflow: 'hidden' }}>
                    <Box sx={{ width: `${Math.max(20, Math.min(100, l.proficiencyLevel ?? 80))}%`, height: '100%', bgcolor: '#fff' }} />
                  </Box>
                </Box>
              ))}
            </Stack>
          </>
        )}
      </Box>
    </Box>
  );
};


// ============================================================================
// TEMPLATE 12: MODERN TAN SIDEBAR (matcher referansebildet, audio-engineer-stil)
// ============================================================================

export const ModernTanSidebarTemplate: React.FC<ResumeTemplateProps> = ({ resume, preview = false }) => {
  const tan = '#C09464';
  const tanLight = '#D9B79A';
  const sidebarBg = '#F3F1ED';
  const dark = '#1A1A1A';
  const muted = '#666666';
  const chip = (label: string, bg: string = tan, color: string = '#fff') => (
    <Box sx={{
      display: 'inline-block', bgcolor: bg, color, px: 2.5, py: 0.6, mb: 1.5,
      fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: 2,
    }}>
      {label.toUpperCase()}
    </Box>
  );
  const round = (children: React.ReactNode) => (
    <Box sx={{
      width: 26, height: 26, borderRadius: '50%', bgcolor: tan, color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, flexShrink: 0,
    }}>{children}</Box>
  );
  return (
    <Box sx={{
      maxWidth: '8.5in', minHeight: '11in', bgcolor: 'white',
      display: 'flex', fontFamily: 'Inter, "Segoe UI", sans-serif',
      boxShadow: preview ? 1 : 0,
    }}>
      {/* Left light sidebar */}
      <Box sx={{ width: '36%', bgcolor: sidebarBg, p: preview ? 2.5 : 4.5 }}>
        {/* Profile photo */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <Box sx={{
            width: 130, height: 130, borderRadius: '50%', overflow: 'hidden',
            border: `4px solid ${tan}`,
            backgroundImage: `url(${resume.personalInfo?.profilePhoto ?? ''})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            bgcolor: '#ccc',
          }} />
        </Box>

        {chip('Contacts')}
        <Stack spacing={1.2} sx={{ mb: 3 }}>
          {resume.personalInfo?.phone && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              {round(<MailOutlineIcon sx={{ fontSize: 14 }} />)}
              <Typography sx={{ fontSize: 11.5, color: dark }}>{resume.personalInfo.phone}</Typography>
            </Stack>
          )}
          {resume.personalInfo?.email && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              {round(<MailOutlineIcon sx={{ fontSize: 14 }} />)}
              <Typography sx={{ fontSize: 11.5, color: dark, wordBreak: 'break-all' }}>{resume.personalInfo.email}</Typography>
            </Stack>
          )}
          {resume.personalInfo?.location && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              {round(<LocationOnIcon sx={{ fontSize: 14 }} />)}
              <Typography sx={{ fontSize: 11.5, color: dark }}>{resume.personalInfo.location}</Typography>
            </Stack>
          )}
        </Stack>

        {(resume.education ?? []).length > 0 && (
          <Box sx={{ mb: 3 }}>
            {chip('Utdanning')}
            <Stack spacing={1.2}>
              {resume.education.map((e: any) => (
                <Box key={e.id}>
                  <Typography sx={{ fontWeight: 700, fontSize: 11.5, letterSpacing: 0.5 }}>
                    {e.degree?.toUpperCase()}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: muted }}>
                    {new Date(e.startDate).getFullYear()} - {e.isCurrent ? 'Nå' : (e.endDate ? new Date(e.endDate).getFullYear() : '')}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: dark }}>{e.institution}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        {(resume.skills ?? []).length > 0 && (
          <Box sx={{ mb: 3 }}>
            {chip('Ferdigheter')}
            <Stack spacing={1.2}>
              {resume.skills.slice(0, 8).map((s: any) => {
                const pct = Math.max(10, Math.min(100, s.proficiencyLevel ?? 70));
                return (
                  <Box key={s.id}>
                    <Typography sx={{ fontSize: 11.5, color: dark, mb: 0.4 }}>{s.name}</Typography>
                    <Box sx={{ position: 'relative', height: 4, bgcolor: '#E5DDD3', borderRadius: 2 }}>
                      <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: tan, borderRadius: 2 }} />
                      <Box sx={{
                        position: 'absolute', left: `calc(${pct}% - 4px)`, top: -3,
                        width: 10, height: 10, borderRadius: '50%', bgcolor: tan,
                        border: '2px solid #fff', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                      }} />
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        )}

        {(resume.languages ?? []).length > 0 && (
          <Box>
            {chip('Språk')}
            <Stack spacing={0.6}>
              {resume.languages.map((l: any) => (
                <Stack key={l.id} direction="row" justifyContent="space-between">
                  <Typography sx={{ fontSize: 11.5, color: dark }}>{l.name}</Typography>
                  {l.levelLabel && (
                    <Typography sx={{ fontSize: 11, color: tan, fontWeight: 600 }}>{l.levelLabel}</Typography>
                  )}
                </Stack>
              ))}
            </Stack>
          </Box>
        )}
      </Box>

      {/* Main column */}
      <Box sx={{ flex: 1, p: preview ? 2.5 : 5, bgcolor: '#fff' }}>
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 32, letterSpacing: 2, color: dark, lineHeight: 1 }}>
          {(resume.personalInfo?.fullName ?? '').split(' ').map((w, i, arr) => (
            <Box component="span" key={i} sx={{ color: i === arr.length - 1 ? tan : dark }}>
              {w}{i < arr.length - 1 ? ' ' : ''}
            </Box>
          ))}
        </Typography>
        <Typography sx={{ fontSize: 12, letterSpacing: 4, color: muted, mt: 1, mb: 3 }}>
          {(resume.personalInfo?.professionalTitle ?? '').toUpperCase()}
        </Typography>

        {resume.personalInfo?.summary && (
          <Typography sx={{ fontSize: 12, lineHeight: 1.7, color: '#333', mb: 3 }}>
            {resume.personalInfo.summary}
          </Typography>
        )}

        {(() => {
          const regular = (resume.experiences ?? []).filter((e: any) => e.employmentType !== 'internship');
          if (!regular.length) return null;
          return (
            <Box sx={{ mb: 3 }}>
              {chip('Work Experience')}
              {regular.map((exp: any) => (
                <Box key={exp.id} sx={{ mb: 2 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 13, color: dark, letterSpacing: 1 }}>
                    {(exp.jobTitle ?? '').toUpperCase()}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: muted }}>
                    {new Date(exp.startDate).getFullYear()} - {exp.isCurrent ? 'Present' : (exp.endDate ? new Date(exp.endDate).getFullYear() : '')}
                  </Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 0.7 }}>
                    {exp.company}{exp.location ? `, ${exp.location}` : ''}
                  </Typography>
                  {exp.description && (
                    <Typography sx={{ fontSize: 11.5, lineHeight: 1.6, mb: 0.5 }}>{exp.description}</Typography>
                  )}
                  {Array.isArray(exp.experienceGroups) && exp.experienceGroups.length > 0 ? (
                    exp.experienceGroups.map((g: any, i: number) => (
                      <Box key={i} sx={{ mt: 0.5 }}>
                        {g.category && <Typography sx={{ fontWeight: 700, fontSize: 11.5 }}>{g.category}:</Typography>}
                        {(g.items ?? []).map((it: string, j: number) => (
                          <Typography key={j} sx={{ fontSize: 11.5, ml: 1.5, lineHeight: 1.6 }}>· {it}</Typography>
                        ))}
                      </Box>
                    ))
                  ) : (
                    (exp.achievements ?? []).map((a: string, i: number) => (
                      <Typography key={i} sx={{ fontSize: 11.5, ml: 1.5, lineHeight: 1.6 }}>· {a}</Typography>
                    ))
                  )}
                </Box>
              ))}
            </Box>
          );
        })()}

        {(() => {
          const interns = (resume.experiences ?? []).filter((e: any) => e.employmentType === 'internship');
          if (!interns.length) return null;
          return (
            <Box sx={{ mb: 3 }}>
              {chip('Praksisplasser')}
              {interns.map((exp: any) => (
                <Box key={exp.id} sx={{ mb: 1.5 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 12.5, color: dark, letterSpacing: 1 }}>
                    {(exp.jobTitle ?? '').toUpperCase()}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: muted }}>
                    {new Date(exp.startDate).getFullYear()} - {exp.isCurrent ? 'Nå' : (exp.endDate ? new Date(exp.endDate).getFullYear() : '')}
                  </Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 0.5 }}>
                    {exp.company}{exp.location ? `, ${exp.location}` : ''}
                  </Typography>
                  {exp.description && (
                    <Typography sx={{ fontSize: 11.5, lineHeight: 1.6 }}>{exp.description}</Typography>
                  )}
                </Box>
              ))}
            </Box>
          );
        })()}

        {(resume.certifications ?? []).length > 0 && (
          <Box>
            {chip('Sertifiseringer')}
            <Stack spacing={0.8}>
              {resume.certifications.map((c: any) => (
                <Box key={c.id}>
                  <Typography sx={{ fontWeight: 700, fontSize: 12 }}>{c.name}</Typography>
                  <Typography sx={{ fontSize: 11, color: muted }}>{c.issuer}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </Box>
    </Box>
  );
};


// ============================================================================
// TEMPLATE 13: TIMELINE CENTERED NORWEGIAN (sentrert + vertikal tidslinje)
// ============================================================================

export const TimelineCenteredTemplate: React.FC<ResumeTemplateProps> = ({ resume, preview = false }) => {
  const dark = '#0F172A';
  const muted = '#6B7280';
  const dot = '#0F172A';
  // Vertical timeline with dots, centered name + photo, left sidebar with details
  const sideHead = (label: string) => (
    <Box sx={{ textAlign: 'center', position: 'relative', my: 2 }}>
      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: 3, color: dark, display: 'inline-block', px: 1, bgcolor: '#fff' }}>
        {label.toUpperCase()}
      </Typography>
      <Box sx={{ position: 'absolute', left: 18, right: 18, top: '50%', borderTop: `1px solid ${dark}`, zIndex: -1 }} />
      <Box sx={{ position: 'absolute', left: 14, top: '50%', mt: '-3px', width: 6, height: 6, borderRadius: '50%', border: `1px solid ${dark}` }} />
      <Box sx={{ position: 'absolute', right: 14, top: '50%', mt: '-3px', width: 6, height: 6, borderRadius: '50%', border: `1px solid ${dark}` }} />
    </Box>
  );
  const mainHead = (icon: React.ReactNode, label: string) => (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5, mt: 2 }}>
      <Box sx={{ color: dark, display: 'inline-flex', alignItems: 'center' }}>{icon}</Box>
      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 13, letterSpacing: 2, color: dark }}>
        {label.toUpperCase()}
      </Typography>
    </Stack>
  );
  const timelineItem = (children: React.ReactNode) => (
    <Box sx={{ position: 'relative', pl: 2.5, ml: 1, borderLeft: `1px solid ${dark}` }}>
      <Box sx={{ position: 'absolute', left: -4, top: 4, width: 7, height: 7, borderRadius: '50%', border: `1.5px solid ${dot}`, bgcolor: '#fff' }} />
      {children}
    </Box>
  );
  return (
    <Box sx={{
      maxWidth: '8.5in', minHeight: '11in', bgcolor: 'white',
      fontFamily: 'Inter, "Segoe UI", sans-serif', color: dark,
      p: preview ? 2.5 : 5, boxShadow: preview ? 1 : 0,
    }}>
      {/* Centered header */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        {resume.personalInfo?.profilePhoto && (
          <Box sx={{
            width: 78, height: 78, borderRadius: '50%', overflow: 'hidden',
            mx: 'auto', mb: 1,
            border: `1px solid ${dark}`,
            backgroundImage: `url(${resume.personalInfo.profilePhoto})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
          }} />
        )}
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 900, fontSize: 32, letterSpacing: 4, color: dark }}>
          {(resume.personalInfo?.fullName ?? '').toUpperCase()}
        </Typography>
        <Typography sx={{ fontSize: 11, color: muted, letterSpacing: 1.5, mt: 0.5 }}>
          {resume.personalInfo?.location && <Box component="span" sx={{ mr: 1 }}>● {resume.personalInfo.location.toUpperCase()}</Box>}
          {resume.personalInfo?.phone && <Box component="span">● {resume.personalInfo.phone}</Box>}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Left details column */}
        <Grid item xs={4}>
          {sideHead('Detaljer')}
          <Stack spacing={0.3} sx={{ textAlign: 'center', mb: 2 }}>
            {resume.personalInfo?.location && (
              <Typography sx={{ fontSize: 12 }}>{resume.personalInfo.location}</Typography>
            )}
            {resume.personalInfo?.phone && (
              <Typography sx={{ fontSize: 12 }}>{resume.personalInfo.phone}</Typography>
            )}
            {resume.personalInfo?.email && (
              <Typography sx={{ fontSize: 12, wordBreak: 'break-all' }}>{resume.personalInfo.email}</Typography>
            )}
          </Stack>

          {resume.personalInfo?.linkedin && (
            <>
              {sideHead('Link')}
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Typography sx={{ fontSize: 12, color: '#1D4ED8', textDecoration: 'underline' }}>
                  Linkedin-profil
                </Typography>
              </Box>
            </>
          )}

          {(resume.skills ?? []).length > 0 && (
            <>
              {sideHead('Ferdigheter')}
              <Stack spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
                {resume.skills.map((s: any) => (
                  <Box key={s.id} sx={{ textAlign: 'center', width: '85%' }}>
                    <Typography sx={{ fontSize: 12, mb: 0.4 }}>{s.name}</Typography>
                    <Box sx={{ height: 1, bgcolor: dark, opacity: 0.9 }} />
                  </Box>
                ))}
              </Stack>
            </>
          )}

          {(resume.languages ?? []).length > 0 && (
            <>
              {sideHead('Språk')}
              <Stack spacing={1} sx={{ alignItems: 'center' }}>
                {resume.languages.map((l: any) => (
                  <Box key={l.id} sx={{ textAlign: 'center', width: '85%' }}>
                    <Typography sx={{ fontSize: 12, mb: 0.4 }}>{l.name}</Typography>
                    <Box sx={{ height: 2, bgcolor: '#E5E7EB', overflow: 'hidden' }}>
                      <Box sx={{ width: `${Math.max(20, Math.min(100, l.proficiencyLevel ?? 80))}%`, height: '100%', bgcolor: dark }} />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </>
          )}
        </Grid>

        {/* Right main column */}
        <Grid item xs={8}>
          {resume.personalInfo?.summary && (
            <>
              {mainHead(<Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: dark }} />, 'Profil')}
              {timelineItem(
                <Typography sx={{ fontSize: 12, lineHeight: 1.6 }}>
                  {resume.personalInfo.summary}
                </Typography>,
              )}
            </>
          )}

          {(() => {
            const regular = (resume.experiences ?? []).filter((e: any) => e.employmentType !== 'internship');
            if (!regular.length) return null;
            return (
              <>
                {mainHead(<WorkOutlineIcon sx={{ fontSize: 16 }} />, 'Arbeidshistorikk')}
                {regular.map((exp: any) => (
                  <Box key={exp.id} sx={{ mb: 2 }}>
                    {timelineItem(
                      <>
                        <Typography sx={{ fontWeight: 700, fontSize: 12.5 }}>
                          {exp.jobTitle}, {exp.company}{exp.location ? `, ${exp.location}` : ''}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: muted, mb: 0.4 }}>
                          {new Date(exp.startDate).toLocaleDateString('no-NO', { month: 'short', year: 'numeric' })}
                          {' — '}
                          {exp.isCurrent ? 'Dags dato' : (exp.endDate ? new Date(exp.endDate).toLocaleDateString('no-NO', { month: 'short', year: 'numeric' }) : '')}
                        </Typography>
                        {exp.description && (
                          <Typography sx={{ fontSize: 11.5, lineHeight: 1.55, mb: 0.5 }}>{exp.description}</Typography>
                        )}
                        {Array.isArray(exp.experienceGroups) && exp.experienceGroups.length > 0 ? (
                          exp.experienceGroups.map((g: any, i: number) => (
                            <Box key={i} sx={{ mt: 0.5 }}>
                              {g.category && <Typography sx={{ fontWeight: 700, fontSize: 11.5 }}>{g.category}:</Typography>}
                              {(g.items ?? []).map((it: string, j: number) => (
                                <Typography key={j} sx={{ fontSize: 11.5, ml: 1.5 }}>- {it}</Typography>
                              ))}
                            </Box>
                          ))
                        ) : (
                          (exp.achievements ?? []).map((a: string, i: number) => (
                            <Typography key={i} sx={{ fontSize: 11.5, ml: 1.5 }}>• {a}</Typography>
                          ))
                        )}
                      </>,
                    )}
                  </Box>
                ))}
              </>
            );
          })()}

          {(resume.education ?? []).length > 0 && (
            <>
              {mainHead(<SchoolIcon sx={{ fontSize: 16 }} />, 'Utdanning')}
              {resume.education.map((e: any) => (
                <Box key={e.id} sx={{ mb: 2 }}>
                  {timelineItem(
                    <>
                      <Typography sx={{ fontWeight: 700, fontSize: 12.5 }}>
                        {e.degree}, {e.institution}{e.location ? `, ${e.location}` : ''}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: muted, mb: 0.4 }}>
                        {new Date(e.startDate).toLocaleDateString('no-NO', { month: 'short', year: 'numeric' })}
                        {' — '}
                        {e.isCurrent ? 'Nå' : (e.endDate ? new Date(e.endDate).toLocaleDateString('no-NO', { month: 'short', year: 'numeric' }) : '')}
                      </Typography>
                      {e.fieldOfStudy && <Typography sx={{ fontSize: 12, mb: 0.3 }}>{e.fieldOfStudy}</Typography>}
                      {e.description && <Typography sx={{ fontSize: 11.5, lineHeight: 1.55 }}>{e.description}</Typography>}
                      {(e.achievements ?? []).map((a: string, i: number) => (
                        <Typography key={i} sx={{ fontSize: 11.5, ml: 1.5 }}>• {a}</Typography>
                      ))}
                    </>,
                  )}
                </Box>
              ))}
            </>
          )}

          {(resume.certifications ?? []).length > 0 && (
            <>
              {mainHead(<VerifiedIcon sx={{ fontSize: 16 }} />, 'Sertifiseringer')}
              {resume.certifications.map((c: any) => (
                <Box key={c.id} sx={{ mb: 1.2 }}>
                  {timelineItem(
                    <>
                      <Typography sx={{ fontWeight: 700, fontSize: 12 }}>{c.name}, {c.issuer}</Typography>
                      <Typography sx={{ fontSize: 11, color: muted }}>
                        {new Date(c.issueDate).toLocaleDateString('no-NO', { month: 'short', year: 'numeric' })}
                        {c.expiryDate && ` — ${new Date(c.expiryDate).toLocaleDateString('no-NO', { month: 'short', year: 'numeric' })}`}
                      </Typography>
                    </>,
                  )}
                </Box>
              ))}
            </>
          )}

          {(() => {
            const interns = (resume.experiences ?? []).filter((e: any) => e.employmentType === 'internship');
            if (!interns.length) return null;
            return (
              <>
                {mainHead(<EmojiEventsIcon sx={{ fontSize: 16 }} />, 'Praksisplasser')}
                {interns.map((exp: any) => (
                  <Box key={exp.id} sx={{ mb: 1.5 }}>
                    {timelineItem(
                      <>
                        <Typography sx={{ fontWeight: 700, fontSize: 12.5 }}>
                          {exp.jobTitle}, {exp.company}{exp.location ? `, ${exp.location}` : ''}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: muted, mb: 0.4 }}>
                          {new Date(exp.startDate).toLocaleDateString('no-NO', { month: 'short', year: 'numeric' })}
                          {' — '}
                          {exp.isCurrent ? 'Nå' : (exp.endDate ? new Date(exp.endDate).toLocaleDateString('no-NO', { month: 'short', year: 'numeric' }) : '')}
                        </Typography>
                        {exp.description && (
                          <Typography sx={{ fontSize: 11.5, lineHeight: 1.55 }}>{exp.description}</Typography>
                        )}
                      </>,
                    )}
                  </Box>
                ))}
              </>
            );
          })()}
        </Grid>
      </Grid>
    </Box>
  );
};


// ============================================================================
// TEMPLATE 14: MINIMAL MONO (single-column ultra-clean, ATS-vinner)
// ============================================================================

export const MinimalMonoTemplate: React.FC<ResumeTemplateProps> = ({ resume, preview = false }) => {
  const dark = '#111111';
  const muted = '#666666';
  const head = (label: string) => (
    <Box sx={{ mt: 3, mb: 1 }}>
      <Typography sx={{ fontWeight: 700, fontSize: 11, letterSpacing: 3, color: dark }}>
        {label.toUpperCase()}
      </Typography>
      <Box sx={{ height: '1px', bgcolor: dark, mt: 0.5 }} />
    </Box>
  );
  return (
    <Box sx={{
      maxWidth: '8.5in', minHeight: '11in', bgcolor: '#fff',
      fontFamily: '"IBM Plex Mono", "JetBrains Mono", "Courier New", monospace',
      color: dark, p: preview ? 2.5 : 5, boxShadow: preview ? 1 : 0,
    }}>
      <Typography sx={{ fontFamily: 'inherit', fontWeight: 800, fontSize: 26, letterSpacing: 1, mb: 0.5 }}>
        {resume.personalInfo?.fullName}
      </Typography>
      <Typography sx={{ fontFamily: 'inherit', fontSize: 12, color: muted, mb: 1 }}>
        {resume.personalInfo?.professionalTitle}
      </Typography>
      <Typography sx={{ fontFamily: 'inherit', fontSize: 11, color: muted }}>
        {[resume.personalInfo?.email, resume.personalInfo?.phone, resume.personalInfo?.location, resume.personalInfo?.linkedin]
          .filter(Boolean).join('  ·  ')}
      </Typography>

      {resume.personalInfo?.summary && (
        <>
          {head('Profil')}
          <Typography sx={{ fontSize: 12, lineHeight: 1.7 }}>{resume.personalInfo.summary}</Typography>
        </>
      )}

      {(resume.experiences ?? []).length > 0 && (
        <>
          {head('Erfaring')}
          {resume.experiences.map((exp: any) => (
            <Box key={exp.id} sx={{ mb: 2 }}>
              <Stack direction="row" justifyContent="space-between">
                <Typography sx={{ fontWeight: 700, fontSize: 12 }}>{exp.jobTitle} · {exp.company}</Typography>
                <Typography sx={{ fontSize: 11, color: muted }}>
                  {new Date(exp.startDate).toLocaleDateString('no-NO', { month: 'short', year: 'numeric' })} – {exp.isCurrent ? 'nå' : exp.endDate ? new Date(exp.endDate).toLocaleDateString('no-NO', { month: 'short', year: 'numeric' }) : ''}
                </Typography>
              </Stack>
              {exp.location && <Typography sx={{ fontSize: 11, color: muted }}>{exp.location}</Typography>}
              {exp.description && <Typography sx={{ fontSize: 11.5, mt: 0.4 }}>{exp.description}</Typography>}
              {Array.isArray(exp.experienceGroups) && exp.experienceGroups.length > 0 ? (
                exp.experienceGroups.map((g: any, i: number) => (
                  <Box key={i} sx={{ mt: 0.4 }}>
                    {g.category && <Typography sx={{ fontWeight: 700, fontSize: 11.5 }}>{g.category}:</Typography>}
                    {(g.items ?? []).map((it: string, j: number) => (
                      <Typography key={j} sx={{ fontSize: 11.5, ml: 1.5 }}>› {it}</Typography>
                    ))}
                  </Box>
                ))
              ) : (
                (exp.achievements ?? []).map((a: string, i: number) => (
                  <Typography key={i} sx={{ fontSize: 11.5, ml: 1.5 }}>› {a}</Typography>
                ))
              )}
            </Box>
          ))}
        </>
      )}

      {(resume.education ?? []).length > 0 && (
        <>
          {head('Utdanning')}
          {resume.education.map((e: any) => (
            <Stack key={e.id} direction="row" justifyContent="space-between" sx={{ mb: 0.6 }}>
              <Typography sx={{ fontSize: 12 }}>
                <Box component="span" sx={{ fontWeight: 700 }}>{e.degree}</Box>
                {e.fieldOfStudy ? ` · ${e.fieldOfStudy}` : ''} · {e.institution}
              </Typography>
              <Typography sx={{ fontSize: 11, color: muted }}>
                {new Date(e.startDate).getFullYear()}–{e.isCurrent ? 'nå' : e.endDate ? new Date(e.endDate).getFullYear() : ''}
              </Typography>
            </Stack>
          ))}
        </>
      )}

      <Grid container spacing={3}>
        {(resume.skills ?? []).length > 0 && (
          <Grid item xs={6}>
            {head('Ferdigheter')}
            <Typography sx={{ fontSize: 11.5, lineHeight: 1.8 }}>
              {resume.skills.map((s: any) => s.name).join(' · ')}
            </Typography>
          </Grid>
        )}
        {(resume.languages ?? []).length > 0 && (
          <Grid item xs={6}>
            {head('Språk')}
            <Stack spacing={0.3}>
              {resume.languages.map((l: any) => (
                <Stack key={l.id} direction="row" justifyContent="space-between">
                  <Typography sx={{ fontSize: 11.5 }}>{l.name}</Typography>
                  {l.levelLabel && <Typography sx={{ fontSize: 11.5, color: muted }}>{l.levelLabel}</Typography>}
                </Stack>
              ))}
            </Stack>
          </Grid>
        )}
      </Grid>

      {(resume.certifications ?? []).length > 0 && (
        <>
          {head('Sertifiseringer')}
          {resume.certifications.map((c: any) => (
            <Stack key={c.id} direction="row" justifyContent="space-between">
              <Typography sx={{ fontSize: 11.5 }}>{c.name} · {c.issuer}</Typography>
              <Typography sx={{ fontSize: 11, color: muted }}>
                {new Date(c.issueDate).getFullYear()}{c.expiryDate ? `–${new Date(c.expiryDate).getFullYear()}` : ''}
              </Typography>
            </Stack>
          ))}
        </>
      )}
    </Box>
  );
};


// ============================================================================
// TEMPLATE 15: BOLD CREATIVE (CreatorHub orange-aksent, slanted headers)
// ============================================================================

export const BoldCreativeTemplate: React.FC<ResumeTemplateProps> = ({ resume, preview = false }) => {
  const orange = '#FF6B35';
  const dark = '#0F172A';
  const muted = '#64748B';
  const head = (label: string) => (
    <Box sx={{
      display: 'inline-block', mb: 1.5, mt: 2.5,
      bgcolor: orange, color: '#fff',
      px: 2, py: 0.5,
      transform: 'skewX(-12deg)',
    }}>
      <Typography sx={{
        fontFamily: 'Inter, sans-serif', fontWeight: 800,
        fontSize: 13, letterSpacing: 2,
        transform: 'skewX(12deg)',
      }}>
        {label.toUpperCase()}
      </Typography>
    </Box>
  );
  return (
    <Box sx={{
      maxWidth: '8.5in', minHeight: '11in', bgcolor: '#fff',
      fontFamily: 'Inter, "Segoe UI", sans-serif', color: dark,
      p: preview ? 2.5 : 5, boxShadow: preview ? 1 : 0,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
        {resume.personalInfo?.profilePhoto && (
          <Box sx={{
            width: 100, height: 100, borderRadius: '50%', overflow: 'hidden',
            border: `4px solid ${orange}`,
            backgroundImage: `url(${resume.personalInfo.profilePhoto})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            flexShrink: 0,
          }} />
        )}
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 900, fontSize: 36, lineHeight: 1, color: dark }}>
            {resume.personalInfo?.fullName}
          </Typography>
          <Box sx={{ height: 4, width: 60, bgcolor: orange, my: 1 }} />
          <Typography sx={{ fontSize: 14, color: muted, fontWeight: 600, letterSpacing: 1 }}>
            {resume.personalInfo?.professionalTitle}
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: 'wrap' }}>
            {resume.personalInfo?.email && (
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <MailOutlineIcon sx={{ fontSize: 14, color: muted }} />
                <Typography sx={{ fontSize: 11, color: muted }}>{resume.personalInfo.email}</Typography>
              </Stack>
            )}
            {resume.personalInfo?.phone && (
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <PhoneIphoneIcon sx={{ fontSize: 14, color: muted }} />
                <Typography sx={{ fontSize: 11, color: muted }}>{resume.personalInfo.phone}</Typography>
              </Stack>
            )}
            {resume.personalInfo?.location && (
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <LocationOnIcon sx={{ fontSize: 14, color: muted }} />
                <Typography sx={{ fontSize: 11, color: muted }}>{resume.personalInfo.location}</Typography>
              </Stack>
            )}
          </Stack>
        </Box>
      </Box>

      {resume.personalInfo?.summary && (
        <>
          {head('Om meg')}
          <Typography sx={{ fontSize: 12.5, lineHeight: 1.7 }}>
            {resume.personalInfo.summary}
          </Typography>
        </>
      )}

      <Grid container spacing={3}>
        <Grid item xs={8}>
          {(resume.experiences ?? []).length > 0 && (
            <>
              {head('Erfaring')}
              {resume.experiences.map((exp: any) => (
                <Box key={exp.id} sx={{ mb: 2, borderLeft: `3px solid ${orange}`, pl: 2 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 13.5 }}>{exp.jobTitle}</Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: orange }}>{exp.company}{exp.location ? ` · ${exp.location}` : ''}</Typography>
                  <Typography sx={{ fontSize: 11, color: muted, mb: 0.4 }}>
                    {new Date(exp.startDate).toLocaleDateString('no-NO', { month: 'short', year: 'numeric' })} – {exp.isCurrent ? 'nå' : exp.endDate ? new Date(exp.endDate).toLocaleDateString('no-NO', { month: 'short', year: 'numeric' }) : ''}
                  </Typography>
                  {exp.description && (
                    <Typography sx={{ fontSize: 11.5, lineHeight: 1.6 }}>{exp.description}</Typography>
                  )}
                  {Array.isArray(exp.experienceGroups) && exp.experienceGroups.length > 0 ? (
                    exp.experienceGroups.map((g: any, i: number) => (
                      <Box key={i} sx={{ mt: 0.4 }}>
                        {g.category && <Typography sx={{ fontWeight: 700, fontSize: 11.5 }}>{g.category}:</Typography>}
                        {(g.items ?? []).map((it: string, j: number) => (
                          <Typography key={j} sx={{ fontSize: 11.5, ml: 1.5 }}>▸ {it}</Typography>
                        ))}
                      </Box>
                    ))
                  ) : (
                    (exp.achievements ?? []).map((a: string, i: number) => (
                      <Typography key={i} sx={{ fontSize: 11.5, ml: 1.5 }}>▸ {a}</Typography>
                    ))
                  )}
                </Box>
              ))}
            </>
          )}

          {(resume.education ?? []).length > 0 && (
            <>
              {head('Utdanning')}
              {resume.education.map((e: any) => (
                <Box key={e.id} sx={{ mb: 1.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 12.5 }}>{e.degree}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: orange }}>{e.institution}{e.location ? `, ${e.location}` : ''}</Typography>
                  <Typography sx={{ fontSize: 11, color: muted }}>
                    {new Date(e.startDate).getFullYear()} – {e.isCurrent ? 'nå' : e.endDate ? new Date(e.endDate).getFullYear() : ''}
                  </Typography>
                </Box>
              ))}
            </>
          )}
        </Grid>

        <Grid item xs={4}>
          {(resume.skills ?? []).length > 0 && (
            <>
              {head('Skills')}
              <Stack spacing={0.6}>
                {resume.skills.map((s: any) => (
                  <Box key={s.id} sx={{
                    bgcolor: 'rgba(255, 107, 53, 0.08)',
                    border: `1px solid ${orange}`,
                    px: 1.2, py: 0.4,
                  }}>
                    <Typography sx={{ fontSize: 11.5, fontWeight: 600 }}>{s.name}</Typography>
                  </Box>
                ))}
              </Stack>
            </>
          )}

          {(resume.languages ?? []).length > 0 && (
            <>
              {head('Språk')}
              <Stack spacing={0.5}>
                {resume.languages.map((l: any) => (
                  <Box key={l.id}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ fontSize: 11.5, fontWeight: 600 }}>{l.name}</Typography>
                      {l.levelLabel && <Typography sx={{ fontSize: 11, color: orange }}>{l.levelLabel}</Typography>}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </>
          )}

          {(resume.certifications ?? []).length > 0 && (
            <>
              {head('Cert')}
              <Stack spacing={0.5}>
                {resume.certifications.map((c: any) => (
                  <Box key={c.id}>
                    <Typography sx={{ fontWeight: 700, fontSize: 11.5 }}>{c.name}</Typography>
                    <Typography sx={{ fontSize: 11, color: muted }}>{c.issuer}</Typography>
                  </Box>
                ))}
              </Stack>
            </>
          )}
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
  }, 'professional-two-column': {
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
  }, 'sales-professional': {
    id: 'sales-professional',
    name: 'Salgsprofil',
    description: 'Dynamisk mal for salgsrepresentanter og -ledere',
    component: SalesProfessionalTemplate,
    atsScore: 90,
    category: 'sales',
    layout: 'single-column',
    isPremium: false,
  }, 'nordic-dark-sidebar': {
    id: 'nordic-dark-sidebar',
    name: 'Nordic Dark Sidebar',
    description: 'To-spaltet med mørk navy høyresidebar — matcher den klassiske norske kreatør-CVen.',
    component: NordicDarkSidebarTemplate,
    atsScore: 92,
    category: 'creative',
    layout: 'two-column',
    isPremium: false,
  }, 'modern-tan-sidebar': {
    id: 'modern-tan-sidebar',
    name: 'Modern Tan Sidebar',
    description: 'Elegant lys to-spaltet med tan/bronse-aksent, sirkulært profilbilde og chip-overskrifter.',
    component: ModernTanSidebarTemplate,
    atsScore: 88,
    category: 'creative',
    layout: 'two-column',
    isPremium: false,
  }, 'timeline-centered': {
    id: 'timeline-centered',
    name: 'Timeline Centered',
    description: 'Sentrert layout med vertikal tidslinje og dotter ved hver oppføring. Klassisk norsk kreatør-CV.',
    component: TimelineCenteredTemplate,
    atsScore: 90,
    category: 'creative',
    layout: 'two-column',
    isPremium: false,
  }, 'minimal-mono': {
    id: 'minimal-mono',
    name: 'Minimal Mono',
    description: 'Single-column monospace ATS-vinner — maks 100 % score. Perfekt for tech og engineering.',
    component: MinimalMonoTemplate,
    atsScore: 100,
    category: 'professional',
    layout: 'single-column',
    isPremium: false,
  }, 'bold-creative': {
    id: 'bold-creative',
    name: 'Bold Creative',
    description: 'CreatorHub-orange aksent med vinklede headere — for kreatører som vil bli sett.',
    component: BoldCreativeTemplate,
    atsScore: 82,
    category: 'creative',
    layout: 'two-column',
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
  {
    id: 'nordic-dark-sidebar',
    name: 'Nordic Dark Sidebar',
    description: 'To-spaltet med mørk navy høyresidebar. Inspirert av klassisk norsk CV-design — kreatører, journalister, fotografer.',
    category: 'creative',
    atsScore: 92,
    isAtsOptimized: true,
    layout: 'two-column',
    sections: ['summary','experience','education','skills','languages','certifications','internships'],
    previewImage: '/templates/nordic-dark-sidebar-preview.png',
    colorSchemes: ['nordic-navy','nordic-charcoal','nordic-graphite'],
    fonts: { heading: 'Inter', body: 'Inter' },
    isPremium: false,
    isActive: true,
  },
  {
    id: 'modern-tan-sidebar',
    name: 'Modern Tan Sidebar',
    description: 'Elegant to-spaltet med lys sidebar og tan/bronse-aksent, sirkulært profilbilde og chip-overskrifter.',
    category: 'creative',
    atsScore: 88,
    isAtsOptimized: true,
    layout: 'two-column',
    sections: ['summary','experience','education','skills','languages','certifications','interests'],
    previewImage: '/templates/modern-tan-sidebar-preview.png',
    colorSchemes: ['tan-bronze','tan-warm-gray','tan-cream'],
    fonts: { heading: 'Inter', body: 'Inter' },
    isPremium: false,
    isActive: true,
  },
  {
    id: 'timeline-centered',
    name: 'Timeline Centered',
    description: 'Sentrert layout med vertikal tidslinje, dot-markører og minimalistiske side-overskrifter. Klassisk skandinavisk.',
    category: 'creative',
    atsScore: 90,
    isAtsOptimized: true,
    layout: 'two-column',
    sections: ['summary','experience','education','skills','languages','certifications','internships'],
    previewImage: '/templates/timeline-centered-preview.png',
    colorSchemes: ['classic-black','classic-navy','classic-charcoal'],
    fonts: { heading: 'Inter', body: 'Inter' },
    isPremium: false,
    isActive: true,
  },
  {
    id: 'minimal-mono',
    name: 'Minimal Mono',
    description: 'Single-column monospace med maksimal ATS-kompatibilitet. Renheten gir 100 % ATS-score.',
    category: 'professional',
    atsScore: 100,
    isAtsOptimized: true,
    layout: 'single-column',
    sections: ['summary','experience','education','skills','languages','certifications'],
    previewImage: '/templates/minimal-mono-preview.png',
    colorSchemes: ['mono-black','mono-charcoal'],
    fonts: { heading: 'IBM Plex Mono', body: 'IBM Plex Mono' },
    isPremium: false,
    isActive: true,
  },
  {
    id: 'bold-creative',
    name: 'Bold Creative',
    description: 'CreatorHub-orange med vinklede chip-overskrifter og fargesterk visuell profil. For kreatører som vil bli lagt merke til.',
    category: 'creative',
    atsScore: 82,
    isAtsOptimized: false,
    layout: 'two-column',
    sections: ['summary','experience','education','skills','languages','certifications'],
    previewImage: '/templates/bold-creative-preview.png',
    colorSchemes: ['creator-orange','creator-coral','creator-amber'],
    fonts: { heading: 'Inter', body: 'Inter' },
    isPremium: false,
    isActive: true,
  },
];
