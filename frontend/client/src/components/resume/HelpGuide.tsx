/**
 * In-App Help & Guide System for Resume Builder
 * Provides contextual help, tooltips, and guided tours
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  IconButton,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Stack,
  Paper,
} from '@mui/material';
import {
  Help as HelpIcon,
  ExpandMore as ExpandMoreIcon,
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  TipsAndUpdates as TipsIcon,
  Lightbulb as LightbulbIcon,
  Info as InfoIcon,
  School as SchoolIcon,
  Work as WorkIcon,
  Star as SkillIcon,
  EmojiEvents as CertIcon,
  Folder as ProjectIcon,
  AutoAwesome as AIIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';

// ============================================================================
// HELP CONTENT DEFINITIONS
// ============================================================================

interface HelpTopic {
  id: string;
  title: string;
  category: 'Getting Started' | 'CV Sections' | 'AI Features' | 'Job Tracking' | 'Publishing' | 'Tips';
  icon: React.ReactNode;
  description: string;
  steps?: string[];
  tips?: string[];
  example?: string;
  relatedFeatures?: string[];
}

const HELP_TOPICS: HelpTopic[] = [
  // Getting Started
  {
    id: 'getting-started',
    title: 'Getting Started with CV Builder',
    category: 'Getting Started',
    icon: <HelpIcon />,
    description: 'Learn the basics of creating your first CV',
    steps: [
      'Click "Lag ny CV" to create a new resume',
      'Enter a title (e.g., "Senior Developer CV")',
      'Fill in your personal information',
      'Choose a template and color scheme',
      'Start adding sections',
    ],
    tips: [
      'You can have multiple CVs for different job roles',
      'Changes are auto-saved every 30 seconds',
      'Use the search bar to find and filter your CVs',
    ],
  },

  // CV Sections
  {
    id: 'personal-info',
    title: 'Personal Information',
    category: 'CV Sections',
    icon: <InfoIcon />,
    description: 'Add your professional details that appear at the top of your CV',
    steps: [
      'Enter your full name',
      'Add professional email and phone',
      'Include your location',
      'Add links: website, LinkedIn, GitHub, portfolio',
      'Write a professional headline or summary (2-3 sentences)',
      'Upload a professional photo (optional)',
    ],
    tips: [
      'Use a professional photo (head and shoulders)',
      'Email should be professional (not party nicknames)',
      'LinkedIn URL helps recruiters verify your profile',
      'GitHub links showcase your projects',
    ],
    example: 'E.g., "Full-stack developer with 8+ years experience building scalable web applications"',
  },

  {
    id: 'work-experience',
    title: 'Work Experience',
    category: 'CV Sections',
    icon: <WorkIcon />,
    description: 'Showcase your professional background and achievements',
    steps: [
      'Click "Legg til erfaring" (Add Experience)',
      'Enter job title and company name',
      'Add location and employment dates',
      'Check "Nåværende jobb" if you still work there',
      'Write 3-5 achievements using action verbs',
      'Include metrics and results',
    ],
    tips: [
      'Use power words: Led, Developed, Implemented, Increased, Managed',
      'Always quantify achievements (e.g., "Increased sales by 30%")',
      'List most recent job first',
      'Focus on impact, not just duties',
      'Tailor descriptions to match job posting keywords',
    ],
    example:
      'E.g., "Led team of 5 developers to deliver 3 major features on time, increasing customer retention by 25%"',
  },

  {
    id: 'education',
    title: 'Education & Credentials',
    category: 'CV Sections',
    icon: <SchoolIcon />,
    description: 'Add your academic qualifications and certifications',
    steps: [
      'Click "Legg til utdanning" (Add Education)',
      'Enter degree/qualification name',
      'Add field of study and institution',
      'Include graduation date',
      'Add GPA if it was 3.5 or higher',
      'Optionally add notes about achievements',
    ],
    tips: [
      'Start with highest degree (Master/Bachelor first)',
      'Include relevant coursework if recently graduated',
      'Mention honors/scholarships if notable',
      'Use Vitnemålsportalen import for automatic data',
    ],
  },

  {
    id: 'skills',
    title: 'Skills & Expertise',
    category: 'CV Sections',
    icon: <SkillIcon />,
    description: 'Highlight your technical and soft skills',
    steps: [
      'Click "Legg til ferdighet" (Add Skill)',
      'Enter skill name (e.g., "React", "Leadership")',
      'Select skill category (Technical, Language, Soft Skills)',
      'Set proficiency level (1-5)',
      'Add 10-15 relevant skills total',
    ],
    tips: [
      'Match skills to job description keywords',
      'Put most important skills first',
      'Include mix of technical and soft skills',
      'Be honest about proficiency levels',
      'Use AI to generate skill suggestions from your experience',
    ],
    example: 'React (5), Node.js (4), Leadership (4), Project Management (3)',
  },

  {
    id: 'certifications',
    title: 'Certifications & Credentials',
    category: 'CV Sections',
    icon: <CertIcon />,
    description: 'Add professional certifications and licenses',
    steps: [
      'Click "Legg til sertifisering" (Add Certification)',
      'Enter certification name',
      'Add issuing organization',
      'Include issue date and expiry date (if applicable)',
      'Add credential ID and verification URL',
    ],
    tips: [
      'Include only relevant, non-expired certifications',
      'Add direct link to verify credentials',
      'Include credential ID for verification',
      'LinkedIn import can populate many certifications automatically',
    ],
  },

  {
    id: 'projects',
    title: 'Projects & Portfolio',
    category: 'CV Sections',
    icon: <ProjectIcon />,
    description: 'Showcase your best work and side projects',
    steps: [
      'Click "Legg til prosjekt" (Add Project)',
      'Enter project name and description',
      'List technologies used',
      'Add project dates',
      'Include link to live project or GitHub repo',
      'Optionally add screenshots from Google Drive',
    ],
    tips: [
      'Include 3-5 best projects',
      'Focus on projects relevant to target job',
      'Include GitHub links for code verification',
      'Add screenshots to showcase visually impressive work',
      'Import directly from GitHub for automatic formatting',
    ],
  },

  // AI Features
  {
    id: 'ai-resume-generation',
    title: 'Generate CV with AI',
    category: 'AI Features',
    icon: <AIIcon />,
    description: 'Let AI help write professional job descriptions and achievements',
    steps: [
      'Click "Generer CV med AI" button',
      'Provide job title and years of experience',
      'List key skills you want to highlight',
      'Give brief overview of your background',
      'Review AI suggestions',
      'Edit and customize as needed',
      'Click "Inkluder i CV" to add to your resume',
    ],
    tips: [
      'Use AI for first draft, then personalize',
      'Include specific metrics AI suggests',
      'Customize AI text with your own examples',
      'Add quantifiable results from your own experience',
    ],
    example:
      'Input: "Senior React Developer, 8 years". AI generates: "Led development of high-performance React applications serving 500K+ daily users..."',
  },

  {
    id: 'ai-cover-letter',
    title: 'Generate Cover Letter with AI',
    category: 'AI Features',
    icon: <AIIcon />,
    description: 'Create personalized cover letters for specific job applications',
    steps: [
      'Click "Generer søknadsbrev med AI"',
      'Enter job title and company name',
      'List 3-5 most relevant skills',
      'Review generated cover letter',
      'Personalize with specific examples',
      'Save to job application',
    ],
    tips: [
      'Use generated letter as template, then customize',
      'Add specific projects or achievements relevant to company',
      'Research company culture and reference it',
      'Keep cover letter concise (1 page)',
    ],
  },

  {
    id: 'ai-rewrite',
    title: 'AI Text Enhancement',
    category: 'AI Features',
    icon: <AIIcon />,
    description: 'Improve writing quality and professionalism of any section',
    steps: [
      'Select text in any description field',
      'Click AI Rewrite button (pencil icon)',
      'Review improved version',
      'Accept or try different style',
      'Adjust manually as needed',
    ],
    tips: [
      'Use for job descriptions and achievements',
      'Try different suggestions',
      'Combine AI suggestions with your own examples',
      'Maintain authentic voice while improving clarity',
    ],
  },

  // Job Tracking
  {
    id: 'job-import',
    title: 'Import Jobs from finn.no',
    category: 'Job Tracking',
    icon: <WorkIcon />,
    description: 'Track job applications and connect them to job postings',
    steps: [
      'Find job on finn.no',
      'Copy the job URL',
      'Click "Legg til søknad" in Job Tracker',
      'Paste URL and click "Importer fra finn.no"',
      'System extracts: title, company, deadline',
      'Verify and save',
    ],
    tips: [
      'System auto-extracts deadline from job posting',
      'Always use full URL, not shortened version',
      'Import as soon as you apply',
      'Add notes about why you applied',
    ],
  },

  {
    id: 'job-analysis',
    title: 'Analyze Job vs Your CV',
    category: 'Job Tracking',
    icon: <SpeedIcon />,
    description: 'Get AI analysis of how well your CV matches a job posting',
    steps: [
      'After importing job, click "Analyser jobb & få AI-forslag"',
      'System compares job requirements with your CV',
      'View Match Percentage and skill gaps',
      'See recommended keywords to add',
      'Update your CV based on suggestions',
      'Re-analyze to see improved match %',
    ],
    tips: [
      'Aim for 70%+ match before applying',
      'Update CV with missing keywords',
      'Focus on hard skills mentioned in job',
      'Add relevant experience even if title differs',
    ],
  },

  {
    id: 'interview-prep',
    title: 'Interview Preparation',
    category: 'Job Tracking',
    icon: <CheckIcon />,
    description: 'Prepare for interviews with AI-generated guidance',
    steps: [
      'Mark job as "Intervju" (Interviewing)',
      'Set interview date and time',
      'Click "Forbered intervju" (Prepare Interview)',
      'Review AI-generated questions and answers',
      'Study key points about role and company',
      'Check interview preparation checklist',
      'Practice before interview date',
    ],
    tips: [
      'Use STAR method for answers (Situation, Task, Action, Result)',
      'Research company before interview',
      'Prepare 2-3 questions to ask interviewer',
      'Practice talking through your projects',
    ],
  },

  {
    id: 'deadline-tracking',
    title: 'Deadline Tracking & Reminders',
    category: 'Job Tracking',
    icon: <SpeedIcon />,
    description: 'Never miss application deadlines with visual alerts',
    steps: [
      'Import job from finn.no (deadline auto-extracted)',
      'Orange alert banner shows for jobs within 7 days',
      'Red alert for deadlines today or tomorrow',
      'Click alert to edit and apply immediately',
      'Update status after applying',
    ],
    tips: [
      'Apply early in deadline window',
      'Use deadline reminders as motivation',
      'Set phone reminders for interviews',
      'Update status so you don\'t lose track',
    ],
  },

  // Publishing
  {
    id: 'template-selection',
    title: 'Choose CV Template',
    category: 'Publishing',
    icon: <InfoIcon />,
    description: 'Select and customize your CV template and appearance',
    steps: [
      'Click "Velg CV-mal" (Select Template)',
      'Preview each template',
      'Check ATS Score for each (higher is better)',
      'Select your preferred template',
      'Change color scheme if desired',
      'Preview final result',
    ],
    tips: [
      'ATS-Optimized template best for automated screening',
      'Modern template looks great for portfolios',
      'Classic template best for traditional industries',
      'Choose readable fonts and good contrast',
    ],
  },

  {
    id: 'public-resume',
    title: 'Make Your CV Public',
    category: 'Publishing',
    icon: <SecurityIcon />,
    description: 'Share your CV publicly with employers and recruiters',
    steps: [
      'Click "Publiser CV" (Publish Resume)',
      'Toggle "Gjør CV offentlig" (Make Public)',
      'Click "Kopier lenke" (Copy Link)',
      'Share link with employers',
      'View counts show who visited (if enabled)',
      'Toggle off to unpublish anytime',
    ],
    tips: [
      'Public CV doesn\'t show job applications',
      'Only shows: experience, skills, projects, contact',
      'You can republish/unpublish anytime',
      'Keep public CV professional and up-to-date',
      'Track views to see recruiter interest',
    ],
  },

  {
    id: 'export-cv',
    title: 'Export Your CV',
    category: 'Publishing',
    icon: <InfoIcon />,
    description: 'Download your CV in multiple formats',
    steps: [
      'Click "Eksporter" (Export)',
      'Choose format: PDF, Word, Text, HTML, or JSON',
      'Download file',
      'Use for applications or printing',
    ],
    tips: [
      'PDF is most universal format',
      'Word format for further editing',
      'Some companies ask for specific format - provide it',
      'Always export before major changes as backup',
    ],
  },

  // Tips
  {
    id: 'ats-optimization',
    title: 'ATS Optimization Tips',
    category: 'Tips',
    icon: <LightbulbIcon />,
    description: 'Make your CV pass Applicant Tracking Systems',
    steps: [
      'Use ATS-Optimized template',
      'Include keywords from job description',
      'Use clear section headings',
      'Avoid graphics in experience section',
      'Use standard fonts',
      'Include exact job titles and company names',
    ],
    tips: [
      'ATS systems scan for specific keywords',
      'Mirror job description language',
      'Use common technical terms',
      'Avoid creative formatting',
      'Test your ATS score for template',
    ],
  },

  {
    id: 'cv-best-practices',
    title: 'CV Best Practices',
    category: 'Tips',
    icon: <LightbulbIcon />,
    description: 'General guidelines for a strong resume',
    steps: [
      'Keep to 1-2 pages (maximum 3 for very senior)',
      'Use consistent formatting',
      'Include relevant information only',
      'Tailor to job description',
      'Proofread carefully for typos',
      'Use recent experience prominently',
    ],
    tips: [
      'Most important: measurable achievements',
      'Focus on what you accomplished, not just tasks',
      'Use action verbs and specific metrics',
      'Keep descriptions concise',
      'Use professional email and phone number',
    ],
  },

  {
    id: 'common-mistakes',
    title: 'Avoid Common Mistakes',
    category: 'Tips',
    icon: <LightbulbIcon />,
    description: 'Mistakes that can hurt your chances',
    steps: [
      'Don\'t use unprofessional email address',
      'Don\'t include outdated information',
      'Don\'t lie about skills or experience',
      'Don\'t use inconsistent formatting',
      'Don\'t include typos or grammar errors',
      'Don\'t make CV too long or cluttered',
    ],
    tips: [
      'Test every link and contact info',
      'Have someone proofread',
      'Use spell checker',
      'Keep consistent spacing and fonts',
      'Update dates regularly',
    ],
  },
];

// ============================================================================
// CONTEXTUAL HELP TOOLTIPS
// ============================================================================

export const FIELD_HELP_TEXT = {
  fullName: 'Your full professional name as it appears on official documents',
  email: 'Professional email address. Employers will contact you here.',
  phone: 'Phone number where you can be reached. Include country code (+47 for Norway)',
  location: 'City and country. E.g., "Oslo, Norge"',
  summary: 'Professional headline or summary. 1-3 sentences about your expertise.',
  jobTitle: 'Your job title at this position. E.g., "Senior Software Engineer"',
  company: 'Company name where you worked',
  startDate: 'Date you started this position (MM/DD/YYYY)',
  endDate: 'Date you left this position. Leave blank if still employed.',
  description: 'List 3-5 key achievements or responsibilities using action verbs.',
  skills: 'Add 10-15 relevant skills. Include technical and soft skills.',
  certificationName: 'Official name of certification or license',
  certificationOrg: 'Organization that issued the certification',
  projectName: 'Name of the project (personal or professional)',
  projectDescription: 'Brief description of what the project does and your role',
  github: 'Link to your GitHub profile: https://github.com/yourname',
  linkedin: 'Link to your LinkedIn profile',
};

// ============================================================================
// COMPONENTS
// ============================================================================

interface HelpGuideProps {
  open: boolean;
  onClose: () => void;
}

export const HelpGuideDialog: React.FC<HelpGuideProps> = ({ open, onClose }) => {
  const [expandedTopic, setExpandedTopic] = useState<string | false>(false);
  const [selectedCategory, setSelectedCategory] = useState<
    'All' | 'Getting Started' | 'CV Sections' | 'AI Features' | 'Job Tracking' | 'Publishing' | 'Tips'
  >('All');

  const filteredTopics =
    selectedCategory === 'All' ? HELP_TOPICS : HELP_TOPICS.filter((t) => t.category === selectedCategory);

  const categories = ['All', 'Getting Started', 'CV Sections', 'AI Features', 'Job Tracking', 'Publishing', 'Tips'] as const;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HelpIcon />
        Resume Builder Help & Guide
        <Box sx={{ flexGrow: 1 }} />
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2}>
          {/* Category Filter */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {categories.map((cat) => (
              <Chip
                key={cat}
                label={cat}
                onClick={() => setSelectedCategory(cat)}
                variant={selectedCategory === cat ? 'filled' : 'outlined'}
                color={selectedCategory === cat ? 'primary' : 'default'}
              />
            ))}
          </Box>

          <Divider />

          {/* Help Topics */}
          <Box>
            {filteredTopics.map((topic) => (
              <Accordion
                key={topic.id}
                expanded={expandedTopic === topic.id}
                onChange={() => setExpandedTopic(expandedTopic === topic.id ? false : topic.id)}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ color: 'primary.main' }}>{topic.icon}</Box>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {topic.title}
                      </Typography>
                      <Chip label={topic.category} size="small" variant="outlined" sx={{ mt: 0.5 }} />
                    </Box>
                  </Box>
                </AccordionSummary>

                <AccordionDetails sx={{ pt: 0 }}>
                  <Stack spacing={2}>
                    {/* Description */}
                    <Typography variant="body2" color="textSecondary">
                      {topic.description}
                    </Typography>

                    {/* Steps */}
                    {topic.steps && (
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                          Steps:
                        </Typography>
                        <List dense>
                          {topic.steps.map((step, idx) => (
                            <ListItem key={idx} disableGutters>
                              <ListItemIcon sx={{ minWidth: 32 }}>
                                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                  {idx + 1}.
                                </Typography>
                              </ListItemIcon>
                              <ListItemText primary={step} />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}

                    {/* Tips */}
                    {topic.tips && (
                      <Paper sx={{ p: 1.5, bgcolor: 'info.lighter', border: '1px solid', borderColor: 'info.light' }}>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                          <TipsIcon sx={{ mt: 0.5, color: 'info.main', flexShrink: 0 }} />
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                              Pro Tips:
                            </Typography>
                            <ul style={{ margin: 0, paddingLeft: 20 }}>
                              {topic.tips.map((tip, idx) => (
                                <li key={idx}>
                                  <Typography variant="caption">{tip}</Typography>
                                </li>
                              ))}
                            </ul>
                          </Box>
                        </Box>
                      </Paper>
                    )}

                    {/* Example */}
                    {topic.example && (
                      <Paper sx={{ p: 1.5, bgcolor: 'success.lighter', border: '1px solid', borderColor: 'success.light' }}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <CheckIcon sx={{ color: 'success.main', flexShrink: 0 }} />
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                              Example:
                            </Typography>
                            <Typography variant="caption">{topic.example}</Typography>
                          </Box>
                        </Box>
                      </Paper>
                    )}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Got it!
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * Help Icon Button with Tooltip
 * Use throughout the app for contextual help
 */
interface ContextualHelpProps {
  title: string;
  content?: string;
  size?: 'small' | 'medium';
}

export const ContextualHelp: React.FC<ContextualHelpProps> = ({ title, content, size = 'small' }) => {
  return (
    <Tooltip
      title={
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {title}
          </Typography>
          {content && <Typography variant="caption">{content}</Typography>}
        </Box>
      }
      arrow
      placement="top"
    >
      <HelpIcon sx={{ fontSize: size === 'small' ? 18 : 24, color: 'info.main', cursor: 'help' }} />
    </Tooltip>
  );
};

/**
 * Field Help Tooltip
 */
export const FieldHelper: React.FC<{ fieldKey: keyof typeof FIELD_HELP_TEXT }> = ({ fieldKey }) => {
  const helpText = FIELD_HELP_TEXT[fieldKey];
  return <ContextualHelp title={fieldKey} content={helpText} size="small" />;
};

/**
 * Tip Alert Component
 * Shows helpful tips at the top of sections
 */
interface TipAlertProps {
  title: string;
  content: string;
  onDismiss?: () => void;
}

export const TipAlert: React.FC<TipAlertProps> = ({ title, content, onDismiss }) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <Alert
      severity="info"
      onClose={() => {
        setDismissed(true);
        onDismiss?.();
      }}
      icon={<LightbulbIcon />}
      sx={{ mb: 2 }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="body2">{content}</Typography>
    </Alert>
  );
};

/**
 * Quick Tips Sidebar
 * Shows context-specific tips for current page
 */
interface QuickTipsProps {
  tips: string[];
  title?: string;
}

export const QuickTips: React.FC<QuickTipsProps> = ({ tips, title = 'Quick Tips' }) => {
  return (
    <Paper sx={{ p: 2, bgcolor: 'warning.lighter', border: '1px solid', borderColor: 'warning.light' }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
        <TipsIcon sx={{ color: 'warning.main', flexShrink: 0, mt: 0.5 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
      </Box>

      <List dense>
        {tips.map((tip, idx) => (
          <ListItem key={idx} disableGutters sx={{ py: 0.5 }}>
            <ListItemIcon sx={{ minWidth: 28 }}>
              <CheckIcon sx={{ fontSize: 16, color: 'warning.main' }} />
            </ListItemIcon>
            <ListItemText
              primary={tip}
              primaryTypographyProps={{ variant: 'caption' }}
              sx={{ m: 0 }}
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

/**
 * Help Button for Floating Action
 */
interface HelpButtonProps {
  onClick: () => void;
}

export const HelpButton: React.FC<HelpButtonProps> = ({ onClick }) => {
  return (
    <Tooltip title="Open Help Guide" placement="left">
      <IconButton
        onClick={onClick}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          bgcolor: 'primary.main',
          color: 'white',
          '&:hover': {
            bgcolor: 'primary.dark',
          },
          boxShadow: 2,
        }}
      >
        <HelpIcon />
      </IconButton>
    </Tooltip>
  );
};
