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
    title: 'High-Speed Performance',
    description: 'Fast read/write speeds ensure smooth continuous shooting and 4K video recording without dropped frames.',
    category: 'performance',
    impact: 'high',
    icon: 'lightning',
    examples: [
      'Continuous burst photography at 20+ fps','4K video recording without buffer issues','Faster file transfer to computer','Reduced waiting time between shots'
    ],
    technicalDetails: 'UHS-II cards can achieve 300MB/s read speeds, 10x faster than standard SD cards'
},
  'data_reliability': {
    id: 'data_reliability',
    title: 'Data Reliability & Safety',
    description: 'Professional-grade cards have built-in error correction and wear leveling to protect your valuable footage.',
    category: 'reliability',
    impact: 'critical',
    icon: 'shield',
    examples: [
      'Built-in error correction prevents data corruption','Wear leveling extends card lifespan','Temperature resistance for extreme conditions','Shock and vibration protection'
    ],
    technicalDetails: 'Professional cards use SLC/MLC NAND flash with 10,000+ write cycles vs 1,000 for consumer cards'
},
  'workflow_efficiency': {
    id: 'workflow_efficiency',
    title: 'Workflow Efficiency',
    description: 'Proper card selection streamlines your post-production workflow and reduces time spent on file management.',
    category: 'workflow',
    impact: 'high',
    icon: 'settings',
    examples: [
      'Faster file transfers to editing workstation','Reduced backup time with high-capacity cards','Better organization with multiple cards per day','Less time spent swapping cards during shoots'
    ],
    technicalDetails: 'High-capacity cards reduce card swaps by 50-7%, saving 15-30 minutes per shoot day'
},
  'cost_optimization': {
    id: 'cost_optimization',
    title: 'Cost Optimization',
    description: 'Right-sized cards prevent over-spending while ensuring you have adequate storage for your project needs.',
    category: 'cost',
    impact: 'medium',
    icon: 'coin',
    examples: [
      'Avoid buying oversized cards for simple projects','Prevent data loss costs from insufficient storage','Reduce rental costs with proper planning','Optimize card utilization across projects'
    ],
    technicalDetails: 'Proper planning can reduce memory card costs by 20-40% while improving reliability'
,},
  'professional_standards': {
    id: 'professional_standards',
    title: 'Professional Standards',
    description: 'Using appropriate cards demonstrates professionalism and ensures compatibility with client expectations.',
    category: 'professional',
    impact: 'high',
    icon: 'star',
    examples: [
      'Meets industry standards for professional work','Ensures compatibility with professional equipment','Demonstrates attention to detail to clients','Reduces risk of equipment compatibility issues'
    ],
    technicalDetails: 'Professional cards meet industry standards like V90 video class and UHS-II specifications'
,},
  'backup_safety': {
    id: 'backup_safety',
    title: 'Backup & Safety Strategy',
    description: 'Multiple cards provide redundancy and safety for critical events where data loss is not acceptable.',
    category: 'safety',
    impact: 'critical',
    icon: 'backup',
    examples: [
      'Redundant storage prevents total data loss','Immediate backup during long events','Separate cards for different parts of event','Easy recovery if one card fails'
    ],
    technicalDetails: '3-2-1 backup rule: 3 copies, 2 different media types, 1 offsite storage'
},
  'pricing_optimization': {
    id: 'pricing_optimization',
    title: 'Pricing Optimization & Cost Control',
    description: 'Intelligent pricing helps you choose the right memory cards for your budget while avoiding over-spending or under-investing.',
    category: 'cost',
    impact: 'high',
    icon: '�, �, ',
    examples: [
      'Avoid buying oversized cards for simple projects','Prevent data loss costs from insufficient storage','Reduce rental costs with proper planning','Optimize card utilization across multiple projects','Budget allocation for different project types'
    ],
    technicalDetails: 'Proper memory card planning can reduce costs by 20-40% while improving reliability and workflow efficiency'
,},
  'project_planning': {
    id: 'project_planning',
    title: 'Project Planning & Resource Management',
    description: 'Memory card pricing helps you plan project resources, estimate costs, and ensure you have adequate storage for any project.',
    category: 'workflow',
    impact: 'high',
    icon: '�, �, ',
    examples: [
      'Accurate project cost estimation','Resource allocation for multi-day events','Client proposal preparation with detailed costs','Inventory management and card rotation','Budget planning for equipment purchases'
    ],
    technicalDetails: 'Professional project planning includes memory card costs in 15-25% of total equipment budget'
,},
  'client_transparency': {
    id: 'client_transparency',
    title: 'Client Transparency & Professionalism',
    description: 'Clear pricing breakdown shows clients exactly what they are paying for and demonstrates your professional approach.',
    category: 'professional',
    impact: 'medium',
    icon: '�, �, ',
    examples: [
      'Detailed cost breakdown in client proposals','Transparent pricing for memory card requirements','Professional justification for equipment costs','Client confidence in your planning abilities','Clear communication about project requirements'
    ],
    technicalDetails: 'Clients appreciate transparency - 78% prefer detailed cost breakdowns over lump sum pricing'
,},
  'equipment_justification': {
    id: 'equipment_justification',
    title: 'Equipment Cost Justification',
    description: 'Pricing data helps justify equipment costs to clients and demonstrates the value of professional-grade memory cards.',
    category: 'professional',
    impact: 'medium',
    icon: '⚖, ️, ',
    examples: [
      'Explain why professional cards cost more','Demonstrate reliability benefits to clients','Justify equipment rental vs purchase decisions','Show cost per GB analysis','Compare with consumer alternatives'
    ],
    technicalDetails: 'Professional cards cost 2-4x more but offer 10x better reliability and 3-5x better performance'
,},
  'budget_scaling': {
    id: 'budget_scaling',
    title: 'Budget Scaling & Growth Planning',
    description: 'Understanding memory card pricing helps you scale your business and plan for growth in different market segments.',
    category: 'workflow',
    impact: 'medium',
    icon: '�, �, ',
    examples: [
      'Plan equipment investment for business growth','Scale pricing for different client segments','Budget for new camera systems and card requirements','Plan inventory for peak season demands','Calculate ROI on equipment investments'
    ],
    technicalDetails: 'Memory card costs typically represent 5-15% of total equipment investment but are critical for data safety'
,},
  'market_competitiveness': {
    id: 'market_competitiveness',
    title: 'Market Competitiveness & Pricing Strategy',
    description: 'Accurate pricing knowledge helps you stay competitive while maintaining profitability in your market.',
    category: 'professional',
    impact: 'high',
    icon: '�, �',
    examples: [
      'Competitive pricing for different market segments','Profit margin analysis for different project types','Market positioning based on equipment quality','Pricing strategy for premium vs budget clients','Equipment cost analysis for service pricing'
    ],
    technicalDetails: 'Professional photographers typically factor 20-30% equipment cost markup into service pricing'
,},
  'risk_mitigation': {
    id: 'risk_mitigation',
    title: 'Risk Mitigation & Insurance',
    description: 'Proper memory card investment reduces business risk and can help with insurance claims and equipment coverage.',
    category: 'safety',
    impact: 'high',
    icon: '🛡, ️',
    examples: [
      'Reduce data loss risk with quality cards','Insurance claims for equipment damage','Professional equipment documentation','Risk assessment for high-value projects','Equipment replacement cost planning'
    ],
    technicalDetails: 'Data loss incidents cost photographers an average of , $, 2,500 in lost revenue and client relationships'
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
