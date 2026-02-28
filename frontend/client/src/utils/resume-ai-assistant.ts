/**
 * CreatorHub Norge - Resume AI Assistant
 * Advanced AI-powered resume analysis and improvement suggestions
 */

export interface AIAnalysisResult {
  overallScore: number;
  atsScore: number;
  contentScore: number;
  grammarScore: number;
  keywordScore: number;
  suggestions: AISuggestion[];
  matchedKeywords: string[];
  missingKeywords: string[];
  industryInsights: string[];
}

export interface AISuggestion {
  id: string;
  type: 'critical, ' | 'important' | 'optional';
  category: 'summary' | 'experience' | 'skills' | 'formatting' | 'keywords' | 'grammar';
  title: string;
  description: string;
  suggestion: string;
  impact: 'high' | 'medium' | 'low';
  priority: number;
}

/**
 * Analyze resume and provide AI-powered suggestions
 */
export async function analyzeResume(resume: any, jobDescription?: string): Promise<AIAnalysisResult> {
  const suggestions: AISuggestion[] = [];
  let atsScore = 100;
  let contentScore = 100;
  const grammarScore = 100;

  // 1. Check Professional Summary
  if (!resume.personalInfo?.summary || resume.personalInfo.summary.length < 50) {
    suggestions.push({
      id: 'summary-missing',
      type: 'critical',
      category: 'summary',
      title: 'Manglende profesjonelt sammendrag',
      description: 'CV-en din mangler et profesjonelt sammendrag. Dette er ofte det første arbeidsgivere leser.',
      suggestion: 'Legg til et sammendrag på 2-3 setninger som fremhever din erfaring, kompetanse og karrieremål. Bruk nøkkelord fra bransjen din.',
      impact: 'high',
      priority: 1,
    });
    atsScore -= 15;
    contentScore -= 20;
  } else if (resume.personalInfo.summary.length < 100) {
    suggestions.push({
      id: 'summary-too-short',
      type: 'important',
      category: 'summary',
      title: 'Sammendraget kan utvides',
      description: 'Ditt profesjonelle sammendrag er litt kort.',
      suggestion: 'Utvid sammendraget til 2-3 setninger (100-200 ord). Inkluder dine viktigste kvalifikasjoner, erfaring og hva du kan tilføre arbeidsgiveren.',
      impact: 'medium',
      priority: 3,
    });
    contentScore -= 10;
  }

  // 2. Check Work Experience
  if (!resume.experiences || resume.experiences.length === 0) {
    suggestions.push({
      id: 'experience-missing',
      type: 'critical',
      category: 'experience',
      title: 'Ingen arbeidserfaring listet',
      description: 'CV-en din mangler arbeidserfaring.',
      suggestion: 'Legg til dine relevante jobber, prosjekter eller frivillig arbeid. Bruk "Importer prosjekter"-funksjonen for å automatisk legge til fullførte prosjekter.',
      impact: 'high',
      priority: 1,
    });
    atsScore -= 30;
    contentScore -= 40;
  } else {
    // Check each experience entry
    resume.experiences.forEach((exp: any, index: number) => {
      if (!exp.description || exp.description.length < 50) {
        suggestions.push({
          id: `experience-${index}-description`,
          type: 'important',
          category: 'experience',
          title: `Manglende beskrivelse for ${exp.jobTitle}`,
          description: `Arbeidserfaringen "${exp.jobTitle}" mangler en god beskrivelse.`,
          suggestion: 'Legg til en beskrivelse som forklarer dine ansvarsområder og prestasjoner. Bruk konkrete tall og resultater når mulig.',
          impact: 'medium',
          priority: 4,
        });
        contentScore -= 5;
      }

      if (!exp.achievements || exp.achievements.length === 0) {
        suggestions.push({
          id: `experience-${index}-achievements`,
          type: 'optional',
          category: 'experience',
          title: `Legg til prestasjoner for ${exp.jobTitle}`,
          description: `Ingen spesifikke prestasjoner listet for "${exp.jobTitle}".`,
          suggestion: 'Legg til 2-3 konkrete prestasjoner eller resultater. Bruk STAR-metoden (Situasjon, Oppgave, Handling, Resultat).',
          impact: 'medium',
          priority: 6,
        });
        contentScore -= 3;
      }
    });
  }

  // 3. Check Skills
  if (!resume.skills || resume.skills.length < 3) {
    suggestions.push({
      id: 'skills-insufficient',
      type: 'critical',
      category: 'skills',
      title: 'For få ferdigheter listet',
      description: 'CV-en din har for få ferdigheter.',
      suggestion: 'Legg til minst 5-10 relevante ferdigheter. Inkluder både tekniske ferdigheter og myke ferdigheter. ATS-systemer søker etter spesifikke nøkkelord.',
      impact: 'high',
      priority: 2,
    });
    atsScore -= 20;
    contentScore -= 15;
  } else if (resume.skills.length < 5) {
    suggestions.push({
      id: 'skills-few',
      type: 'important',
      category: 'skills',
      title: 'Legg til flere ferdigheter',
      description: 'Du har noen ferdigheter, men flere ville styrke CV-en.',
      suggestion: 'Legg til minst 5-10 relevante ferdigheter for å øke sjansene for å bli funnet av ATS-systemer.',
      impact: 'medium',
      priority: 5,
    });
    contentScore -= 5;
  }

  // 4. Check Education
  if (!resume.education || resume.education.length === 0) {
    suggestions.push({
      id: 'education-missing',
      type: 'important',
      category: 'formatting',
      title: 'Manglende utdanning',
      description: 'Ingen utdanning er lagt til.',
      suggestion: 'Legg til din utdannelsesbakgrunn, selv om det kun er videregående. Dette er viktig informasjon for mange arbeidsgivere.',
      impact: 'medium',
      priority: 7,
    });
    contentScore -= 10;
  }

  // 5. ATS Formatting Checks
  if (resume.templateId && !['modern-ats','simple-classic','tech-modern'].includes(resume.templateId)) {
    suggestions.push({
      id: 'template-ats',
      type: 'optional',
      category: 'formatting',
      title: 'Vurder mer ATS-vennlig mal',
      description: 'Din valgte mal kan ha lavere ATS-score.',
      suggestion: 'Bytt til "Modern ATS","Simple Classic" eller "Tech Modern" for best mulig ATS-kompatibilitet.',
      impact: 'low',
      priority: 8,
    });
    atsScore -= 5;
  }

  // 6. Keyword Analysis (if job description provided)
  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];
  let keywordScore = 100;

  if (jobDescription) {
    const jobKeywords = extractKeywords(jobDescription);
    const resumeText = JSON.stringify(resume).toLowerCase();

    jobKeywords.forEach((keyword) => {
      if (resumeText.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
      } else {
        missingKeywords.push(keyword);
      }
    });

    keywordScore = Math.round((matchedKeywords.length / jobKeywords.length) * 100);

    if (missingKeywords.length > 0 && missingKeywords.length < 10) {
      suggestions.push({
        id: 'keywords-missing',
        type: 'important',
        category: 'keywords',
        title: `Mangler ${missingKeywords.length} nøkkelord fra stillingsannonsen`,
        description: 'CV-en din mangler noen viktige nøkkelord fra stillingsannonsen.',
        suggestion: `Vurder å inkludere disse nøkkelordene naturlig i CV-en din: ${missingKeywords.slice(0, 5).join('')}`,
        impact: 'high',
        priority: 2,
      });
    }

    if (matchedKeywords.length > 0) {
      suggestions.push({
        id: 'keywords-matched',
        type: 'optional',
        category: 'keywords',
        title: `Godt jobbet! ${matchedKeywords.length} nøkkelord matchet`,
        description: 'CV-en din inneholder relevante nøkkelord fra stillingsannonsen.',
        suggestion: `Matched nøkkelord: ${matchedKeywords.slice(0, 10).join(', ')}`,
        impact: 'low',
        priority: 10,
      });
    }
  }

  // 7. Contact Information Check
  if (!resume.personalInfo?.email) {
    suggestions.push({
      id: 'contact-email',
      type: 'critical',
      category: 'formatting',
      title: 'Manglende e-postadresse',
      description: 'CV-en din mangler e-postadresse.',
      suggestion: 'Legg til en profesjonell e-postadresse i kontaktinformasjonen.',
      impact: 'high',
      priority: 1,
    });
    atsScore -= 10;
  }

  if (!resume.personalInfo?.phone) {
    suggestions.push({
      id: 'contact-phone',
      type: 'important',
      category: 'formatting',
      title: 'Manglende telefonnummer',
      description: 'CV-en din mangler telefonnummer.',
      suggestion: 'Legg til et telefonnummer der du kan nås.',
      impact: 'medium',
      priority: 3,
    });
    atsScore -= 5;
  }

  // 8. Length Check
  const totalSections = [
    resume.personalInfo?.summary,
    resume.experiences?.length,
    resume.skills?.length,
    resume.education?.length,
  ].filter(Boolean).length;

  if (totalSections < 3) {
    suggestions.push({
      id: 'length-too-short',
      type: 'important',
      category: 'formatting',
      title: 'CV-en er for kort',
      description: 'CV-en din virker ufullstendig.',
      suggestion: 'Utvid CV-en din med mer informasjon om erfaring, ferdigheter og utdanning. En god CV er vanligvis 1-2 sider.',
      impact: 'medium',
      priority: 4,
    });
    contentScore -= 15;
  }

  // Calculate overall score
  const overallScore = Math.round((atsScore + contentScore + grammarScore + keywordScore) / 4);

  // Industry insights
  const industryInsights = generateIndustryInsights(resume);

  return {
    overallScore,
    atsScore: Math.max(0, atsScore),
    contentScore: Math.max(0, contentScore),
    grammarScore: Math.max(0, grammarScore),
    keywordScore,
    suggestions: suggestions.sort((a, b) => a.priority - b.priority),
    matchedKeywords,
    missingKeywords,
    industryInsights,
  };
}

/**
 * Extract keywords from job description
 */
function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  
  // Common important keywords for different roles
  const commonKeywords = [
    'erfaring','lederskap','teamarbeid','kommunikasjon','prosjektledelse','problemløsning','analytisk','kreativ','innovativ','strategisk',
  ];

  // Extract words longer than 4 characters
  const words = text
    .toLowerCase()
    .match(/\b\w{4,}\b/g) || [];

  // Filter and deduplicate
  const uniqueWords = [...new Set(words)];
  
  // Combine with common keywords
  return [...new Set([...uniqueWords.slice(0, 20), ...commonKeywords])];
}

/**
 * Generate industry-specific insights
 */
function generateIndustryInsights(resume: any): string[] {
  const insights: string[] = [];

  // Check for project-based experience
  if (resume.projects && resume.projects.length > 0) {
    insights.push('💡 Du har gode porteføljeprosjekter. Vurder å fremheve de mest imponerende resultatene.');
  }

  // Check for recent experience
  const latestExperience = resume.experiences?.[0];
  if (latestExperience) {
    const yearsAgo = new Date().getFullYear() - new Date(latestExperience.startDate).getFullYear();
    if (yearsAgo > 5) {
      insights.push('⏰ Din nyeste erfaring er fra flere år tilbake. Vurder å oppdatere med nylige prosjekter eller frilans-arbeid.');
    }
  }

  // Skills diversity
  if (resume.skills && resume.skills.length > 0) {
    const categories = new Set(resume.skills.map((s: any) => s.category));
    if (categories.size > 3) {
      insights.push('🎯 Du har en god bredde av ferdigheter. Dette viser allsidighet.');
    }
  }

  // Education level
  if (resume.education && resume.education.length > 1) {
    insights.push('🎓 Flere utdannelser viser dedikasjon til læring og utvikling.');
  }

  // Auto-generated content
  const autoGenCount = (resume.experiences?.filter((e: any) => e.autoGenerated).length || 0) +
                       (resume.projects?.filter((p: any) => p.autoGenerated).length || 0);
  if (autoGenCount > 0) {
    insights.push(`🤖 ${autoGenCount} poster er auto-importert fra prosjekter. Vurder å tilpasse beskrivelsene for best mulig inntrykk.`);
  }

  return insights;
}

/**
 * Generate AI-powered professional summary
 */
export function generateAISummary(resume: any): string {
  const experiences = resume.experiences || [];
  const skills = resume.skills || [];
  const profession = resume.personalInfo?.professionalTitle || 'Profesjonell';

  const yearsOfExperience = calculateYearsOfExperience(experiences);
  const topSkills = skills.slice(0, 5).map((s: any) => s.name).join('');

  // Generate summary based on experience
  if (yearsOfExperience > 10) {
    return `Erfaren ${profession} med over ${yearsOfExperience} års erfaring innen ${topSkills}. Dokumentert suksess med å levere høykvalitets resultater og lede komplekse prosjekter. Søker etter muligheter for å bidra med min ekspertise og drive innovasjon.`;
  } else if (yearsOfExperience > 5) {
    return `Dyktig ${profession} med ${yearsOfExperience} års erfaring. Spesialisert i ${topSkills}. Sterk problemløser med fokus på kvalitet og kundetilfredshet. Motivert av utfordrende prosjekter og muligheten til å skape verdi.`;
  } else if (yearsOfExperience > 0) {
    return `Engasjert ${profession} med ${yearsOfExperience} års erfaring. Kompetent i ${topSkills}. Lærevillig og dedikert til å levere gode resultater. Søker etter muligheter for vekst og utvikling.`;
  } else {
    return `Motivert ${profession} med solid kompetanse i ${topSkills}. Ivrig etter å anvende mine ferdigheter i et dynamisk miljø. Dedikert til kontinuerlig læring og profesjonell utvikling.`;
  }
}

/**
 * Calculate years of experience
 */
function calculateYearsOfExperience(experiences: any[]): number {
  if (!experiences || experiences.length === 0) return 0;

  const totalMonths = experiences.reduce((sum, exp) => {
    const start = new Date(exp.startDate);
    const end = exp.isCurrent ? new Date() : new Date(exp.endDate);
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return sum + months;
  }, 0);

  return Math.floor(totalMonths / 12);
}

/**
 * Suggest skills based on job title and industry
 */
export function suggestSkills(jobTitle: string, industry?: string): string[] {
  const suggestions: Record<string, string[]> = {
    'fotograf': [
      'Adobe Lightroom','Adobe Photoshop','Portrettfotografering','Bryllupsfotografering','Bilderedigering','Lysdesign','Kamerabehandling','Kundeservice','Kreativ visjon','Tidsplanlegging',
    ],
    'videograf': [
      'Adobe Premiere Pro','DaVinci Resolve','Final Cut Pro','Cinematografi','Videoredigering','Lyddesign','Fargekorrigering','Fortellerteknikk','Kameraføring','Prosjektledelse',
    ],
    'musikkprodusent': [
      'Logic Pro','Ableton Live','Pro Tools','Musikkproduksjon','Mixing','Mastering','Lydteknikk','MIDI Programmering','Komposisjon','Kreativ lyddesign',
    ],
  };

  // Find matching suggestions
  for (const [key, skills] of Object.entries(suggestions)) {
    if (jobTitle.toLowerCase().includes(key)) {
      return skills;
    }
  }

  // Default suggestions
  return [
    'Kommunikasjon','Teamarbeid','Problemløsning','Prosjektledelse','Tidsplanlegging','Kundeservice','Microsoft Office','Kreativitet','Organisering', 'Analytisk tenkning',
  ];
}

