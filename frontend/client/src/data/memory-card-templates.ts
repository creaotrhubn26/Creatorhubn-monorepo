/**
 * CreatorHub Norge - Memory Card Template System
 * Template-based memory card recommendations with contextual benefits
 */

import type { MemoryCardRecommendation } from './memory-card-database';
import { MemoryCardType } from './memory-card-database';

export interface MemoryCardTemplate {
  id: string;
  name: string;
  description: string;
  category: 'wedding' | 'commercial' | 'portrait' | 'event' | 'cinema' | 'photography' | 'videography' | 'hybrid';
  profession: 'photographer' | 'videographer' | 'both';
  projectType: string;
  budget: 'budget' | 'mid' | 'premium' | 'professional';
  totalDays: number;
  recommendations: MemoryCardRecommendation[];
  contextualBenefits: ContextualBenefit[];
  useCases: string[];
  estimatedCost: number;
  estimatedCostNOK: number;
  isDefault: boolean;
  isEditable: boolean;
  createdBy: string;
  lastModified: string;
  version: string;
  tags: string[];
}

export interface ContextualBenefit {
  id: string;
  title: string;
  description: string;
  category: 'performance' | 'reliability' | 'workflow' | 'cost' | 'safety' | 'professional';
  impact: 'low' | 'medium' | 'high' | 'critical';
  icon: string;
  examples: string[];
  technicalDetails?: string;
}

export interface TemplateEditWarning {
  type: 'global_change' | 'cost_impact' | 'compatibility' | 'workflow';
  message: string;
  affectedProjects: number;
  severity: 'info' | 'warning' | 'error';
}

// Contextual Benefits Database
export const CONTEXTUAL_BENEFITS: Record<string, ContextualBenefit> = {
  'high_speed_performance': {
    id: 'high_speed_performance',
    title: 'Høyhastighets-ytelse',
    description: 'Raske lese-/skrivehastigheter gir jevn seriefotografering og 4K-video uten droppede bilder.',
    category: 'performance',
    impact: 'high',
    icon: 'lightning',
    examples: [
      'Seriefoto i 20+ bilder/sek uten stopp','4K-opptak uten buffer-problemer','Raskere filoverføring til maskin','Kortere ventetid mellom bilder'
    ],
    technicalDetails: 'UHS-II-kort leser opptil 300 MB/s — ti ganger raskere enn standard SD-kort'
},
  'data_reliability': {
    id: 'data_reliability',
    title: 'Datapålitelighet og sikkerhet',
    description: 'Profesjonelle kort har innebygd feilkorrigering og slitasjeutjevning som beskytter verdifullt materiale.',
    category: 'reliability',
    impact: 'critical',
    icon: 'shield',
    examples: [
      'Feilkorrigering hindrer datakorrupsjon','Slitasjeutjevning forlenger levetiden','Temperaturtoleranse for ekstreme forhold','Støt- og vibrasjonsbeskyttelse'
    ],
    technicalDetails: 'Proff-kort bruker SLC/MLC NAND med 10 000+ skrivesykluser mot ~1 000 for forbrukerkort'
},
  'workflow_efficiency': {
    id: 'workflow_efficiency',
    title: 'Effektiv arbeidsflyt',
    description: 'Riktig kortvalg strømlinjeformer etterarbeidet og reduserer tid brukt på filhåndtering.',
    category: 'workflow',
    impact: 'high',
    icon: 'settings',
    examples: [
      'Raskere overføring til redigeringsmaskin','Kortere backup-tid med høykapasitetskort','Bedre organisering med flere kort per dag','Mindre kortbytte under opptak'
    ],
    technicalDetails: 'Høykapasitetskort reduserer kortbytter kraftig og sparer 15–30 min per opptaksdag'
},
  'cost_optimization': {
    id: 'cost_optimization',
    title: 'Kostnadsoptimalisering',
    description: 'Riktig dimensjonerte kort hindrer overforbruk og sikrer nok lagring for prosjektet.',
    category: 'cost',
    impact: 'medium',
    icon: 'coin',
    examples: [
      'Unngå overdimensjonerte kort på enkle prosjekter','Unngå tapskostnader ved for lite lagring','Reduser leiekostnader med god planlegging','Utnytt kortene på tvers av prosjekter'
    ],
    technicalDetails: 'God planlegging kan kutte minnekort-kostnader 20–40 % og samtidig øke påliteligheten'
,},
  'professional_standards': {
    id: 'professional_standards',
    title: 'Profesjonell standard',
    description: 'Riktige kort viser profesjonalitet og sikrer kompatibilitet med kundens forventninger.',
    category: 'professional',
    impact: 'high',
    icon: 'star',
    examples: [
      'Møter bransjestandarder for profesjonelt arbeid','Sikrer kompatibilitet med proff-utstyr','Viser kunden sans for detaljer','Reduserer risiko for utstyrs-inkompatibilitet'
    ],
    technicalDetails: 'Proff-kort møter bransjestandarder som V90 videoklasse og UHS-II'
,},
  'backup_safety': {
    id: 'backup_safety',
    title: 'Backup- og sikkerhetsstrategi',
    description: 'Flere kort gir redundans og trygghet på kritiske oppdrag der datatap er uakseptabelt.',
    category: 'safety',
    impact: 'critical',
    icon: 'backup',
    examples: [
      'Redundant lagring hindrer totalt datatap','Løpende backup under lange eventer','Egne kort per del av eventet','Enkel gjenoppretting hvis ett kort svikter'
    ],
    technicalDetails: '3-2-1-regelen: 3 kopier, 2 medietyper, 1 lagret eksternt'
},
  'pricing_optimization': {
    id: 'pricing_optimization',
    title: 'Prisoptimalisering og kostnadskontroll',
    description: 'Prisinnsikt hjelper deg å velge riktige kort for budsjettet — uten over- eller underinvestering.',
    category: 'cost',
    impact: 'high',
    icon: '�, �, ',
    examples: [
      'Unngå overdimensjonerte kort på enkle prosjekter','Unngå tapskostnader ved for lite lagring','Reduser leiekostnader med god planlegging','Utnytt kortene på tvers av prosjekter','Budsjettfordeling per prosjekttype'
    ],
    technicalDetails: 'God minnekort-planlegging kan kutte kostnader 20–40 % og samtidig bedre pålitelighet og flyt'
,},
  'project_planning': {
    id: 'project_planning',
    title: 'Prosjektplanlegging og ressursstyring',
    description: 'Prisdata hjelper deg å planlegge ressurser, estimere kostnader og sikre nok lagring til ethvert prosjekt.',
    category: 'workflow',
    impact: 'high',
    icon: '�, �, ',
    examples: [
      'Presis kostnadsestimering','Ressursfordeling for flerdagers-eventer','Kundetilbud med detaljerte kostnader','Lagerstyring og kort-rotasjon','Budsjettplanlegging for utstyrskjøp'
    ],
    technicalDetails: 'Profesjonell planlegging legger minnekort inn med 15–25 % av utstyrsbudsjettet'
,},
  'client_transparency': {
    id: 'client_transparency',
    title: 'Kundetransparens og profesjonalitet',
    description: 'Tydelig prisoppstilling viser kunden nøyaktig hva de betaler for — og viser profesjonalitet.',
    category: 'professional',
    impact: 'medium',
    icon: '�, �, ',
    examples: [
      'Detaljert kostnadsoppstilling i tilbud','Transparent prising av minnekort-behov','Profesjonell begrunnelse for utstyrskostnader','Kundetillit til planleggingen din','Tydelig kommunikasjon om prosjektkrav'
    ],
    technicalDetails: 'Kunder verdsetter åpenhet — flertallet foretrekker detaljert oppstilling fremfor rundsum'
,},
  'equipment_justification': {
    id: 'equipment_justification',
    title: 'Begrunnelse av utstyrskostnader',
    description: 'Prisdata gjør det enkelt å begrunne utstyrskostnader og vise verdien av proff-kort.',
    category: 'professional',
    impact: 'medium',
    icon: '⚖, ️, ',
    examples: [
      'Forklar hvorfor proff-kort koster mer','Vis pålitelighetsgevinsten for kunden','Begrunn leie- vs kjøpsbeslutninger','Vis kost-per-GB-analyse','Sammenlign med forbrukeralternativer'
    ],
    technicalDetails: 'Proff-kort koster 2–4× mer, men gir ~10× bedre pålitelighet og 3–5× bedre ytelse'
,},
  'budget_scaling': {
    id: 'budget_scaling',
    title: 'Budsjett-skalering og vekstplanlegging',
    description: 'Prisforståelse gjør det lettere å skalere virksomheten og planlegge vekst i ulike segmenter.',
    category: 'workflow',
    impact: 'medium',
    icon: '�, �, ',
    examples: [
      'Planlegg utstyrsinvesteringer for vekst','Skaler prising per kundesegment','Budsjetter nye kamerasystemer og kortbehov','Planlegg lager for høysesong','Beregn ROI på utstyrsinvesteringer'
    ],
    technicalDetails: 'Minnekort utgjør typisk 5–15 % av utstyrsinvesteringen, men er kritiske for datasikkerheten'
,},
  'market_competitiveness': {
    id: 'market_competitiveness',
    title: 'Konkurransekraft og prisstrategi',
    description: 'Presis prisinnsikt holder deg konkurransedyktig uten å ofre lønnsomhet.',
    category: 'professional',
    impact: 'high',
    icon: '�, �',
    examples: [
      'Konkurransedyktig prising per segment','Marginanalyse per prosjekttype','Markedsposisjonering på utstyrskvalitet','Prisstrategi for premium- vs budsjettkunder','Utstyrskostnadsanalyse for tjenesteprising'
    ],
    technicalDetails: 'Profesjonelle legger typisk 20–30 % utstyrspåslag inn i tjenesteprisingen'
,},
  'risk_mitigation': {
    id: 'risk_mitigation',
    title: 'Risikoreduksjon og forsikring',
    description: 'Riktig minnekort-investering reduserer forretningsrisiko og støtter forsikringskrav og dekning.',
    category: 'safety',
    impact: 'high',
    icon: '🛡, ️',
    examples: [
      'Reduser datatap-risiko med kvalitetskort','Forsikringskrav ved utstyrsskade','Profesjonell utstyrsdokumentasjon','Risikovurdering for høyverdi-prosjekter','Planlegging av erstatningskostnader'
    ],
    technicalDetails: 'Datatap koster i snitt titusener i tapt omsetning og kunderelasjoner'
}
};

// Memory Card Templates Database
export const MEMORY_CARD_TEMPLATES: MemoryCardTemplate[] = [
  {
    id: 'wedding-photography-standard',
    name: 'Wedding Photography Standard',
    description: 'Optimal memory card setup for wedding photography with safety redundancy',
    category: 'wedding',
    profession: 'photographer',
    projectType: 'wedding',
    budget: 'mid',
    totalDays:  1,
    recommendations:  [], // Will be populated dynamically
    contextualBenefits: [
      CONTEXTUAL_BENEFITS.data_reliability,
      CONTEXTUAL_BENEFITS.backup_safety,
      CONTEXTUAL_BENEFITS.workflow_efficiency,
      CONTEXTUAL_BENEFITS.professional_standards,
      CONTEXTUAL_BENEFITS.pricing_optimization,
      CONTEXTUAL_BENEFITS.project_planning,
      CONTEXTUAL_BENEFITS.client_transparency
    ],
    useCases: [
      'Single-day wedding photography','Ceremony and reception coverage','Formal portraits and candid shots','High-volume shooting requirements'
    ],
    estimatedCost:  0,
    estimatedCostNOK:  0,
    isDefault: true,
    isEditable: true,
    createdBy: 'system',
    lastModified: new Date().toISOString(),
    version: '1.0.0',
    tags: ['wedding','photography','standard','safety']
},
  {
    id: 'wedding-videography-premium',
    name: 'Wedding Videography Premium',
    description: 'High-performance setup for wedding videography with 4K recording capabilities',
    category: 'wedding',
    profession: 'videographer',
    projectType: 'wedding',
    budget: 'premium',
    totalDays:  1,
    recommendations:  [],
    contextualBenefits: [
      CONTEXTUAL_BENEFITS.high_speed_performance,
      CONTEXTUAL_BENEFITS.data_reliability,
      CONTEXTUAL_BENEFITS.workflow_efficiency,
      CONTEXTUAL_BENEFITS.professional_standards,
      CONTEXTUAL_BENEFITS.pricing_optimization,
      CONTEXTUAL_BENEFITS.equipment_justification,
      CONTEXTUAL_BENEFITS.market_competitiveness
    ],
    useCases: [
      '4K wedding video recording','Multi-camera setup','Long-form ceremony coverage','High-bitrate video requirements'
    ],
    estimatedCost:  0,
    estimatedCostNOK:  0,
    isDefault: true,
    isEditable: true,
    createdBy: 'system',
    lastModified: new Date().toISOString(),
    version: '1.0.0',
    tags: ['wedding','videography','4k','premium']
},
  {
    id: 'commercial-photography-professional',
    name: 'Commercial Photography Professional',
    description: 'Professional-grade setup for commercial photography with high-speed requirements',
    category: 'commercial',
    profession: 'photographer',
    projectType: 'commercial',
    budget: 'professional',
    totalDays:  1,
    recommendations:  [],
    contextualBenefits: [
      CONTEXTUAL_BENEFITS.high_speed_performance,
      CONTEXTUAL_BENEFITS.data_reliability,
      CONTEXTUAL_BENEFITS.workflow_efficiency,
      CONTEXTUAL_BENEFITS.cost_optimization
    ],
    useCases: [
      'Product photography','Corporate headshots','Architecture photography','High-volume commercial shoots'
    ],
    estimatedCost:  0,
    estimatedCostNOK:  0,
    isDefault: true,
    isEditable: true,
    createdBy: 'system',
    lastModified: new Date().toISOString(),
    version: '1.0.0',
    tags: ['commercial','photography','professional','high-speed']
},
  {
    id: 'cinema-production-ultra',
    name: 'Cinema Production Ultra',
    description: 'Ultra-high performance setup for cinema and film production',
    category: 'cinema',
    profession: 'videographer',
    projectType: 'cinema',
    budget: 'professional',
    totalDays:  1,
    recommendations:  [],
    contextualBenefits: [
      CONTEXTUAL_BENEFITS.high_speed_performance,
      CONTEXTUAL_BENEFITS.data_reliability,
      CONTEXTUAL_BENEFITS.workflow_efficiency,
      CONTEXTUAL_BENEFITS.professional_standards
    ],
    useCases: [
      '8K video recording','Raw video formats','High-bitrate cinema recording','Professional film production'
    ],
    estimatedCost:  0,
    estimatedCostNOK:  0,
    isDefault: true,
    isEditable: true,
    createdBy: 'system',
    lastModified: new Date().toISOString(),
    version: '1.0.0',
    tags: ['cinema','8k','raw','ultra-professional']
},
  {
    id: 'event-coverage-hybrid',
    name: 'Event Coverage Hybrid',
    description: 'Versatile setup for event coverage with both photo and video requirements',
    category: 'event',
    profession: 'both',
    projectType: 'event',
    budget: 'mid',
    totalDays:  1,
    recommendations:  [],
    contextualBenefits: [
      CONTEXTUAL_BENEFITS.workflow_efficiency,
      CONTEXTUAL_BENEFITS.cost_optimization,
      CONTEXTUAL_BENEFITS.data_reliability,
      CONTEXTUAL_BENEFITS.backup_safety
    ],
    useCases: [
      'Corporate events','Conferences and seminars','Sports events','Mixed photo/video coverage'
    ],
    estimatedCost:  0,
    estimatedCostNOK:  0,
    isDefault: true,
    isEditable: true,
    createdBy: 'system',
    lastModified: new Date().toISOString(),
    version: '1.0.0',
    tags: ['event','hybrid','versatile','mixed-media']
}
];

// Template Management Functions
export class MemoryCardTemplateManager {
  /**
   * Get templates by profession and project type
   */
  static getTemplatesByContext(
    profession: 'photographer' | 'videographer' | 'both',
    projectType: string,
    budget?: string
  ): MemoryCardTemplate[] {
    return MEMORY_CARD_TEMPLATES.filter(template => 
      (template.profession === profession || template.profession === 'both') &&
      template.projectType === projectType &&
      (!budget || template.budget === budget)
    );
}

  /**
   * Get default template for context
   */
  static getDefaultTemplate(
    profession: 'photographer' | 'videographer' | 'both',
    projectType: string
  ): MemoryCardTemplate | null {
    return MEMORY_CARD_TEMPLATES.find(template => 
      template.isDefault &&
      (template.profession === profession || template.profession === 'both') &&
      template.projectType === projectType
    ) || null;
  }

  /**
   * Get template by ID
   */
  static getTemplateById(id: string): MemoryCardTemplate | null {
    return MEMORY_CARD_TEMPLATES.find(template => template.id === id) || null;
  }

  /**
   * Get contextual benefits for template
   */
  static getContextualBenefits(templateId: string): ContextualBenefit[] {
    const template = this.getTemplateById(templateId);
    return template?.contextualBenefits || [];
  }

  /**
   * Check if template edit will affect other projects
   */
  static getEditWarnings(templateId: string, changes: Partial<MemoryCardTemplate>): TemplateEditWarning[] {
    const warnings: TemplateEditWarning[] = [];
    const template = this.getTemplateById(templateId);
    
    if (!template) return warnings;

    // Check for global changes
    if (changes.recommendations || changes.budget || changes.totalDays) {
      warnings.push({
        type: 'global_change',
        message: 'This change will affect all projects using this template',
        affectedProjects: 0, // Would be calculated from database
        severity: 'warning'
      });
  }

    // Check for cost impact
    if (changes.budget) {
      warnings.push({
        type: 'cost_impact',
        message: `Budget change from ${template.budget} to ${changes.budget} will affect project costs`,
        affectedProjects:  0,
        severity: 'info'
      });
  }

    // Check for compatibility issues
    if (changes.recommendations) {
      warnings.push({
        type: 'compatibility',
        message: 'Memory card changes may affect camera compatibility',
        affectedProjects:  0,
        severity: 'warning'
      });
  }

    return warnings;
}

  /**
   * Update template with warnings
   */
  static updateTemplate(
    templateId: string, 
    changes: Partial<MemoryCardTemplate>,
    userId: string
  ): { success: boolean; warnings: TemplateEditWarning[]; template?: MemoryCardTemplate } {
    const warnings = this.getEditWarnings(templateId, changes);
    const template = this.getTemplateById(templateId);
    
    if (!template) {
      return { success: false, warnings: [] };
  }

    if (!template.isEditable) {
      warnings.push({
        type: 'global_change',
        message: 'This template is not editable',
        affectedProjects:  0,
        severity: 'error'
    ,});
      return { success: false, warnings };
  }

    // Update template
    const updatedTemplate: MemoryCardTemplate = {
      ...template,
      ...changes,
      lastModified: new Date().toISOString(),
      version: this.incrementVersion(template.version)
    };

    return { success: true, warnings, template: updatedTemplate };
}

  /**
   * Increment version number
   */
  private static incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[2]) + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
}

  /**
   * Get all templates for admin management
   */
  static getAllTemplates(): MemoryCardTemplate[] {
    return MEMORY_CARD_TEMPLATES;
}

  /**
   * Get templates by category
   */
  static getTemplatesByCategory(category: string): MemoryCardTemplate[] {
    return MEMORY_CARD_TEMPLATES.filter(template => template.category === category);
  }
}

// Export utility functions
export const getTemplatesByProfession = (profession: 'photographer' | 'videographer' | 'both') => {
  return MEMORY_CARD_TEMPLATES.filter(template => 
    template.profession === profession || template.profession ==='both'
  );
};

export const getTemplatesByProjectType = (projectType: string) => {
  return MEMORY_CARD_TEMPLATES.filter(template => template.projectType === projectType);
};

export const getContextualBenefitById = (id: string): ContextualBenefit | null => {
  return CONTEXTUAL_BENEFITS[id] || null;
};
