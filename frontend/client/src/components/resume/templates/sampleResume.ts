// sampleResume.ts — realistisk eksempel-CV for THUMBNAIL-generering (og forhåndsvisning).
// Brukes KUN til å rendre mal-komponentene til et galleri-bilde (previewImage). Ikke ekte
// bruker-data. Formen speiler det ResumeBuilder-malene leser (personalInfo, experiences,
// education, skills[{id,name,proficiencyLevel}], languages, certifications).

export const SAMPLE_RESUME = {
  id: 'sample',
  title: 'Eksempel-CV',
  slug: 'eksempel',
  templateId: 'modern-ats',
  colorScheme: 'blue',
  atsScore: 92,
  atsOptimized: true,
  status: 'draft',
  isPublic: false,
  language: 'no',
  keywords: ['prosjektledelse', 'strategi', 'analyse'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  personalInfo: {
    fullName: 'Ingrid Solberg',
    title: 'Senior Prosjektleder',
    email: 'ingrid.solberg@epost.no',
    phone: '+47 987 65 432',
    location: 'Oslo, Norge',
    linkedin: 'linkedin.com/in/ingridsolberg',
    website: 'ingridsolberg.no',
    profilePhoto: '',
    summary:
      'Resultatorientert prosjektleder med 8+ års erfaring innen digital transformasjon og tverrfaglig teamledelse. Har levert komplekse leveranser til tid og under budsjett, og bygget høytytende team i vekstselskaper.',
  },
  experiences: [
    {
      id: 'e1', resumeId: 'sample', jobTitle: 'Senior Prosjektleder', company: 'Nordisk Teknologi AS',
      location: 'Oslo', startDate: '2021-03', endDate: '', isCurrent: true,
      achievements: [
        'Ledet et team på 12 og leverte en ny kundeplattform 3 uker før tidsplan.',
        'Reduserte leveransetid med 28 % gjennom innføring av smidige prosesser.',
        'Eide en portefølje på 14 MNOK med 100 % on-time-leveranse.',
      ],
    },
    {
      id: 'e2', resumeId: 'sample', jobTitle: 'Prosjektleder', company: 'Fjord Digital',
      location: 'Bergen', startDate: '2018-01', endDate: '2021-02', isCurrent: false,
      achievements: [
        'Koordinerte 6 parallelle kundeprosjekter med samlet verdi 22 MNOK.',
        'Innførte OKR-rammeverk som økte team-leveranse med 35 %.',
      ],
    },
  ],
  education: [
    {
      id: 'ed1', degree: 'Master i Informatikk', institution: 'Universitetet i Oslo',
      startDate: '2013-08', endDate: '2015-06', isCurrent: false, location: 'Oslo',
      description: 'Spesialisering i systemutvikling og HCI.', achievements: ['Beste masteroppgave 2015'],
    },
    {
      id: 'ed2', degree: 'Bachelor i Ingeniørfag', institution: 'NTNU',
      startDate: '2010-08', endDate: '2013-06', isCurrent: false, location: 'Trondheim',
      description: '', achievements: [],
    },
  ],
  skills: [
    { id: 's1', name: 'Prosjektledelse', proficiencyLevel: 5 },
    { id: 's2', name: 'Smidig / Scrum', proficiencyLevel: 5 },
    { id: 's3', name: 'Interessenthåndtering', proficiencyLevel: 4 },
    { id: 's4', name: 'Budsjett & økonomi', proficiencyLevel: 4 },
    { id: 's5', name: 'Risikostyring', proficiencyLevel: 4 },
    { id: 's6', name: 'Dataanalyse', proficiencyLevel: 3 },
  ],
  // Feltet heter levelLabel — det speiler kolonnen level_label fra
  // migrasjon 0132, som er den malene leser. Sto som `proficiency` her, og
  // konsekvensen var at ingen forhåndsvisning viste språknivå selv om
  // ekte CV-er gjør det. Malvelgeren viste altså produktet dårligere enn
  // det er.
  languages: [
    { id: 'l1', name: 'Norsk', levelLabel: 'Morsmål' },
    { id: 'l2', name: 'Engelsk', levelLabel: 'Flytende' },
    { id: 'l3', name: 'Tysk', levelLabel: 'Middels' },
  ],
  certifications: [
    { id: 'c1', name: 'PRINCE2 Practitioner', issuer: 'AXELOS', issueDate: '2020-05-01' },
    { id: 'c2', name: 'Certified ScrumMaster', issuer: 'Scrum Alliance', issueDate: '2019-03-01' },
  ],
} as const;

export type SampleResume = typeof SAMPLE_RESUME;
