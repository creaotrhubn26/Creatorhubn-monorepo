/**
 * ExportTemplates - Pre-configured export preset + schedule combinations
 * 
 * Features:
 * - Ready-to-use export workflows
 * - Platform-optimized bundles
 * - Scheduled release strategies
 * - Team collaboration templates
 * - Client delivery workflows
 */

import { ExportJobPriority, BatchExportConfig } from './ExportScheduler';
import { ExportPreset, EXPORT_PRESETS } from './GoogleDriveExportService';
import { logger } from '../services/logger';

const log = logger.module('ExportTemplates');

// Material UI Icon names for templates
export type TemplateIconName = 
  | 'Rocket'
  | 'YouTube'
  | 'Instagram'
  | 'Smartphone'
  | 'Inventory'
  | 'Language'
  | 'CardGiftcard'
  | 'Palette'
  | 'Movie'
  | 'Visibility'
  | 'BusinessCenter'
  | 'WbSunny'
  | 'DarkMode'
  | 'Celebration'
  | 'Public'
  | 'Bolt'
  | 'Chat'
  | 'Archive'
  | 'Save';

// ============================================================================
// Types
// ============================================================================

export type ScheduleType = 'immediate' | 'delay' | 'specific_time' | 'recurring';

export interface ScheduleConfig {
  type: ScheduleType;
  delayMinutes?: number;
  specificTime?: string; // ISO string or cron-like pattern
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
  recurringTime?: string; // HH:mm format
  timezone?: string;
}

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  icon: TemplateIconName;
  category: ExportTemplateCategory;
  
  // Presets to use
  presets: string[]; // Preset IDs from EXPORT_PRESETS
  
  // Scheduling
  schedule: ScheduleConfig;
  priority: ExportJobPriority;
  
  // Options
  uploadToDrive: boolean;
  createSubfolder: boolean;
  subfolderName?: string;
  notifyOnComplete: boolean;
  
  // Metadata
  tags: string[];
  estimatedDuration?: string;
  recommendedFor?: string[];
}

export type ExportTemplateCategory = 
  | 'social_media'
  | 'client_delivery'
  | 'portfolio'
  | 'team_review'
  | 'archival'
  | 'quick_share'
  | 'scheduled_release'
  | 'custom';

// ============================================================================
// Template Categories
// ============================================================================

export type CategoryIconName = 
  | 'Smartphone'
  | 'Inventory'
  | 'Palette'
  | 'Groups'
  | 'Archive'
  | 'Bolt'
  | 'Schedule'
  | 'Settings';

export const TEMPLATE_CATEGORIES: Record<ExportTemplateCategory, { label: string; icon: CategoryIconName; color: string }> = {
  social_media: { label: 'Social Media', icon: 'Smartphone', color: '#e91e63' },
  client_delivery: { label: 'Client Delivery', icon: 'Inventory', color: '#2196f3' },
  portfolio: { label: 'Portfolio', icon: 'Palette', color: '#9c27b0' },
  team_review: { label: 'Team Review', icon: 'Groups', color: '#ff9800' },
  archival: { label: 'Archival', icon: 'Archive', color: '#607d8b' },
  quick_share: { label: 'Quick Share', icon: 'Bolt', color: '#4caf50' },
  scheduled_release: { label: 'Scheduled Release', icon: 'Schedule', color: '#00bcd4' },
  custom: { label: 'Custom', icon: 'Settings', color: '#795548' },
};

// ============================================================================
// Export Templates
// ============================================================================

export const EXPORT_TEMPLATES: ExportTemplate[] = [
  // ==========================================================================
  // SOCIAL MEDIA TEMPLATES
  // ==========================================================================
  {
    id: 'social_media_blast',
    name: 'Social Media Blast',
    description: 'Export to all major social platforms at once',
    icon: 'Rocket',
    category: 'social_media',
    presets: ['youtube_1080p','instagram_reels','tiktok','twitter','facebook_feed'],
    schedule: { type: 'immediate' },
    priority: 'high',
    uploadToDrive: true,
    createSubfolder: true,
    subfolderName: 'Social Media Export',
    notifyOnComplete: true,
    tags: ['multi-platform','social','viral'],
    estimatedDuration: '15-20 min',
    recommendedFor: ['Content creators','Marketing teams'],
  },
  {
    id: 'youtube_full_package',
    name: 'YouTube Full Package',
    description: 'YouTube video + Shorts + thumbnail-ready formats',
    icon: 'YouTube',
    category: 'social_media',
    presets: ['youtube_4k','youtube_1080p','youtube_shorts'],
    schedule: { type: 'immediate' },
    priority: 'normal',
    uploadToDrive: true,
    createSubfolder: true,
    subfolderName: 'YouTube Package',
    notifyOnComplete: true,
    tags: ['youtube','video','shorts'],
    estimatedDuration: '20-30 min',
    recommendedFor: ['YouTubers','Video creators'],
  },
  {
    id: 'instagram_complete',
    name: 'Instagram Complete',
    description: 'Feed, Reels, and Stories in one go',
    icon: 'Instagram',
    category: 'social_media',
    presets: ['instagram_feed','instagram_reels','instagram_story'],
    schedule: { type: 'immediate' },
    priority: 'normal',
    uploadToDrive: true,
    createSubfolder: true,
    subfolderName: 'Instagram Export',
    notifyOnComplete: true,
    tags: ['instagram','reels','stories'],
    estimatedDuration: '10-15 min',
    recommendedFor: ['Influencers','Brands'],
  },
  {
    id: 'vertical_video_pack',
    name: 'Vertical Video Pack',
    description: 'All vertical, formats: TikTok, Reels, Shorts, Stories',
    icon: 'Smartphone',
    category: 'social_media',
    presets: ['tiktok','instagram_reels','youtube_shorts','instagram_story','snapchat'],
    schedule: { type: 'immediate' },
    priority: 'high',
    uploadToDrive: true,
    createSubfolder: true,
    subfolderName: 'Vertical Videos',
    notifyOnComplete: true,
    tags: ['vertical','mobile','short-form'],
    estimatedDuration: '15-20 min',
    recommendedFor: ['TikTokers','Reels creators'],
  },

  // ==========================================================================
  // CLIENT DELIVERY TEMPLATES
  // ==========================================================================
  {
    id: 'client_master_delivery',
    name: 'Client Master Delivery',
    description: 'High-quality master files for client handoff',
    icon: 'Inventory',
    category: 'client_delivery',
    presets: ['youtube_4k','vimeo_4k','broadcast_1080p'],
    schedule: { type: 'immediate' },
    priority: 'high',
    uploadToDrive: true,
    createSubfolder: true,
    subfolderName: 'Client Delivery - Master Files',
    notifyOnComplete: true,
    tags: ['client','master','high-quality'],
    estimatedDuration: '30-45 min',
    recommendedFor: ['Production studios','Freelancers'],
  },
  {
    id: 'client_web_package',
    name: 'Client Web Package',
    description: 'Web-optimized files for client websites',
    icon: 'Language',
    category: 'client_delivery',
    presets: ['youtube_1080p','facebook_feed','linkedin'],
    schedule: { type: 'immediate' },
    priority: 'normal',
    uploadToDrive: true,
    createSubfolder: true,
    subfolderName: 'Client Delivery - Web',
    notifyOnComplete: true,
    tags: ['client','web','optimized'],
    estimatedDuration: '15-20 min',
    recommendedFor: ['Web designers','Agencies'],
  },
  {
    id: 'client_social_kit',
    name: 'Client Social Media Kit',
    description: 'Social media assets for client marketing',
    icon: 'CardGiftcard',
    category: 'client_delivery',
    presets: ['instagram_feed','instagram_reels','facebook_feed','linkedin','twitter'],
    schedule: { type: 'immediate' },
    priority: 'normal',
    uploadToDrive: true,
    createSubfolder: true,
    subfolderName: 'Client Delivery - Social Kit',
    notifyOnComplete: true,
    tags: ['client','social','marketing'],
    estimatedDuration: '20-25 min',
    recommendedFor: ['Marketing agencies','Social media managers'],
  },

  // ==========================================================================
  // PORTFOLIO TEMPLATES
  // ==========================================================================
  {
    id: 'portfolio_showcase',
    name: 'Portfolio Showcase',
    description: 'High-quality exports for portfolio sites',
    icon: 'Palette',
    category: 'portfolio',
    presets: ['vimeo_4k','youtube_4k'],
    schedule: { type: 'immediate' },
    priority: 'normal',
    uploadToDrive: true,
    createSubfolder: true,
    subfolderName: 'Portfolio',
    notifyOnComplete: true,
    tags: ['portfolio','showcase','professional'],
    estimatedDuration: '25-35 min',
    recommendedFor: ['Filmmakers','Artists'],
  },
  {
    id: 'demo_reel_package',
    name: 'Demo Reel Package',
    description: 'Multiple formats for demo reel distribution',
    icon: 'Movie',
    category: 'portfolio',
    presets: ['youtube_1080p','vimeo_4k','linkedin'],
    schedule: { type: 'immediate' },
    priority: 'high',
    uploadToDrive: true,
    createSubfolder: true,
    subfolderName: 'Demo Reel',
    notifyOnComplete: true,
    tags: ['demo','reel','career'],
    estimatedDuration: '20-30 min',
    recommendedFor: ['Job seekers','Creatives'],
  },

  // ==========================================================================
  // TEAM REVIEW TEMPLATES
  // ==========================================================================
  {
    id: 'quick_review',
    name: 'Quick Review',
    description: 'Fast export for team feedback',
    icon: 'Visibility',
    category: 'team_review',
    presets: ['youtube_1080p'],
    schedule: { type: 'immediate' },
    priority: 'urgent',
    uploadToDrive: true,
    createSubfolder: false,
    notifyOnComplete: true,
    tags: ['review','feedback','fast'],
    estimatedDuration: '3-5 min',
    recommendedFor: ['Teams','Collaborators'],
  },
  {
    id: 'stakeholder_review',
    name: 'Stakeholder Review',
    description: 'Professional quality for stakeholder presentations',
    icon: 'BusinessCenter',
    category: 'team_review',
    presets: ['youtube_1080p','linkedin'],
    schedule: { type: 'delay', delayMinutes: 30 },
    priority: 'high',
    uploadToDrive: true,
    createSubfolder: true,
    subfolderName: 'For Review',
    notifyOnComplete: true,
    tags: ['stakeholder','presentation','review'],
    estimatedDuration: '8-12 min',
    recommendedFor: ['Project managers','Directors'],
  },
  {
    id: 'daily_standup',
    name: 'Daily Standup',
    description: 'Quick export scheduled for morning standups',
    icon: 'WbSunny',
    category: 'team_review',
    presets: ['youtube_1080p'],
    schedule: { 
      type: 'recurring', 
      recurringPattern: 'daily',
      recurringTime: '08:30',
    },
    priority: 'normal',
    uploadToDrive: true,
    createSubfolder: false,
    notifyOnComplete: true,
    tags: ['daily','standup','agile'],
    estimatedDuration: '3-5 min',
    recommendedFor: ['Agile teams','Remote teams'],
  },

  // ==========================================================================
  // ARCHIVAL TEMPLATES
  // ==========================================================================
  {
    id: 'master_archive',
    name: 'Master Archive',
    description: 'Highest quality for long-term storage',
    icon: 'Archive',
    category: 'archival',
    presets: ['youtube_4k','cinema_dcp'],
    schedule: { type: 'delay', delayMinutes: 60 },
    priority: 'low',
    uploadToDrive: true,
    createSubfolder: true,
    subfolderName: 'Archive - Master',
    notifyOnComplete: true,
    tags: ['archive','master','preservation'],
    estimatedDuration: '45-60 min',
    recommendedFor: ['Studios','Archives'],
  },
  {
    id: 'project_backup',
    name: 'Project Backup',
    description: 'Multiple formats for project backup',
    icon: 'Save',
    category: 'archival',
    presets: ['youtube_4k','youtube_1080p','broadcast_1080p'],
    schedule: { type: 'delay', delayMinutes: 120 },
    priority: 'low',
    uploadToDrive: true,
    createSubfolder: true,
    subfolderName: 'Backup',
    notifyOnComplete: false,
    tags: ['backup','safety','storage'],
    estimatedDuration: '40-50 min',
    recommendedFor: ['Producers','Editors'],
  },

  // ==========================================================================
  // QUICK SHARE TEMPLATES
  // ==========================================================================
  {
    id: 'instant_share',
    name: 'Instant Share',
    description: 'Fastest possible export for quick sharing',
    icon: 'Bolt',
    category: 'quick_share',
    presets: ['twitter'],
    schedule: { type: 'immediate' },
    priority: 'urgent',
    uploadToDrive: false,
    createSubfolder: false,
    notifyOnComplete: true,
    tags: ['instant','fast','share'],
    estimatedDuration: '1-2 min',
    recommendedFor: ['Quick shares','Previews'],
  },
  {
    id: 'messenger_share',
    name: 'Messenger Share',
    description: 'Optimized for messaging apps (WhatsApp, Telegram)',
    icon: 'Chat',
    category: 'quick_share',
    presets: ['instagram_story'],
    schedule: { type: 'immediate' },
    priority: 'urgent',
    uploadToDrive: false,
    createSubfolder: false,
    notifyOnComplete: true,
    tags: ['messenger','whatsapp','telegram'],
    estimatedDuration: '2-3 min',
    recommendedFor: ['Quick sends','Personal shares'],
  },

  // ==========================================================================
  // SCHEDULED RELEASE TEMPLATES
  // ==========================================================================
  {
    id: 'midnight_release',
    name: 'Midnight Release',
    description: 'Schedule export for midnight release',
    icon: 'DarkMode',
    category: 'scheduled_release',
    presets: ['youtube_1080p','instagram_reels','tiktok'],
    schedule: { 
      type: 'specific_time',
      specificTime: '00:00',
    },
    priority: 'normal',
    uploadToDrive: true,
    createSubfolder: true,
    subfolderName: 'Scheduled Release',
    notifyOnComplete: true,
    tags: ['midnight','scheduled','release'],
    estimatedDuration: '15-20 min',
    recommendedFor: ['Music releases','Product launches'],
  },
  {
    id: 'prime_time_release',
    name: 'Prime Time Release',
    description: 'Scheduled for peak engagement hours (6 PM)',
    icon: 'WbSunny',
    category: 'scheduled_release',
    presets: ['youtube_1080p','instagram_reels','facebook_feed'],
    schedule: { 
      type: 'specific_time',
      specificTime: '18:00',
    },
    priority: 'normal',
    uploadToDrive: true,
    createSubfolder: true,
    subfolderName: 'Prime Time Release',
    notifyOnComplete: true,
    tags: ['prime-time','engagement','scheduled'],
    estimatedDuration: '15-20 min',
    recommendedFor: ['Influencers','Marketers'],
  },
  {
    id: 'weekend_warrior',
    name: 'Weekend Warrior',
    description: 'Scheduled for Saturday morning release',
    icon: 'Celebration',
    category: 'scheduled_release',
    presets: ['youtube_1080p','instagram_reels','tiktok','facebook_reels'],
    schedule: { 
      type: 'recurring',
      recurringPattern: 'weekly',
      recurringTime: '10:00',
    },
    priority: 'normal',
    uploadToDrive: true,
    createSubfolder: true,
    subfolderName: 'Weekend Release',
    notifyOnComplete: true,
    tags: ['weekend','recurring','scheduled'],
    estimatedDuration: '20-25 min',
    recommendedFor: ['Weekly vloggers','Consistent creators'],
  },
  {
    id: 'global_release',
    name: 'Global Release',
    description: 'Staggered exports for different time zones',
    icon: 'Public',
    category: 'scheduled_release',
    presets: ['youtube_1080p','instagram_reels','tiktok'],
    schedule: { type: 'immediate' },
    priority: 'high',
    uploadToDrive: true,
    createSubfolder: true,
    subfolderName: 'Global Release',
    notifyOnComplete: true,
    tags: ['global','international','release'],
    estimatedDuration: '15-20 min',
    recommendedFor: ['Global brands','International creators'],
  },
];

// ============================================================================
// Template Service - Database Persistent
// ============================================================================

import { exportTemplatesApi, ExportTemplateDB } from '../api/virtualStudioApi';

class ExportTemplateService {
  private customTemplates: ExportTemplate[] = [];
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  // -------------------------------------------------------------------------
  // Getters (Sync)
  // -------------------------------------------------------------------------

  getAllTemplates(): ExportTemplate[] {
    return [...EXPORT_TEMPLATES, ...this.customTemplates];
  }

  getTemplateById(id: string): ExportTemplate | undefined {
    return this.getAllTemplates().find((t) => t.id === id);
  }

  getTemplatesByCategory(category: ExportTemplateCategory): ExportTemplate[] {
    return this.getAllTemplates().filter((t) => t.category === category);
  }

  getTemplatesByTag(tag: string): ExportTemplate[] {
    return this.getAllTemplates().filter((t) => 
      t.tags.some((t) => t.toLowerCase().includes(tag.toLowerCase()))
    );
  }

  searchTemplates(query: string): ExportTemplate[] {
    const q = query.toLowerCase();
    return this.getAllTemplates().filter((t) =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }

  // -------------------------------------------------------------------------
  // Custom Templates - Database Operations
  // -------------------------------------------------------------------------

  async createCustomTemplateAsync(
    template: Omit<ExportTemplate, 'id' | 'category'>
  ): Promise<ExportTemplate | null> {
    try {
      const dbTemplate = await exportTemplatesApi.create({
        name: template.name,
        description: template.description,
        icon: template.icon,
        category: 'custom',
        presets: template.presets,
        scheduleType: template.schedule.type,
        delayMinutes: template.schedule.delayMinutes,
        specificTime: template.schedule.specificTime,
        recurringPattern: template.schedule.recurringPattern,
        timezone: template.schedule.timezone,
        priority: template.priority,
        uploadToDrive: template.uploadToDrive,
        createSubfolder: template.createSubfolder,
        subfolderName: template.subfolderName,
        notifyOnComplete: template.notifyOnComplete,
        tags: template.tags,
        estimatedDuration: template.estimatedDuration,
        recommendedFor: template.recommendedFor,
      });

      if (dbTemplate) {
        const newTemplate = this.dbToExportTemplate(dbTemplate);
        this.customTemplates.push(newTemplate);
        return newTemplate;
      }
      return null;
    } catch (e) {
      log.error('Failed to create custom template: ', e);
      return null;
    }
  }

  // Sync version for backward compatibility
  createCustomTemplate(
    template: Omit<ExportTemplate, 'id' | 'category'>
  ): ExportTemplate {
    const newTemplate: ExportTemplate = {
      ...template,
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      category: 'custom',
    };
    this.customTemplates.push(newTemplate);
    // Fire async save
    this.createCustomTemplateAsync(template);
    return newTemplate;
  }

  async updateCustomTemplateAsync(id: string, updates: Partial<ExportTemplate>): Promise<boolean> {
    try {
      const dbUpdates: Partial<ExportTemplateDB> = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.description) dbUpdates.description = updates.description;
      if (updates.icon) dbUpdates.icon = updates.icon;
      if (updates.presets) dbUpdates.presets = updates.presets;
      if (updates.priority) dbUpdates.priority = updates.priority;
      if (updates.uploadToDrive !== undefined) dbUpdates.uploadToDrive = updates.uploadToDrive;
      if (updates.createSubfolder !== undefined) dbUpdates.createSubfolder = updates.createSubfolder;
      if (updates.subfolderName) dbUpdates.subfolderName = updates.subfolderName;
      if (updates.notifyOnComplete !== undefined) dbUpdates.notifyOnComplete = updates.notifyOnComplete;
      if (updates.tags) dbUpdates.tags = updates.tags;
      if (updates.schedule) {
        dbUpdates.scheduleType = updates.schedule.type;
        dbUpdates.delayMinutes = updates.schedule.delayMinutes;
        dbUpdates.specificTime = updates.schedule.specificTime;
        dbUpdates.recurringPattern = updates.schedule.recurringPattern;
      }

      const result = await exportTemplatesApi.update(id, dbUpdates);
      if (result) {
        const index = this.customTemplates.findIndex((t) => t.id === id);
        if (index >= 0) {
          this.customTemplates[index] = { ...this.customTemplates[index], ...updates };
        }
        return true;
      }
      return false;
    } catch (e) {
      log.error('Failed to update custom template:', e);
      return false;
    }
  }

  updateCustomTemplate(id: string, updates: Partial<ExportTemplate>): boolean {
    const index = this.customTemplates.findIndex((t) => t.id === id);
    if (index < 0) return false;
    this.customTemplates[index] = { ...this.customTemplates[index], ...updates };
    // Fire async update
    this.updateCustomTemplateAsync(id, updates);
    return true;
  }

  async deleteCustomTemplateAsync(id: string): Promise<boolean> {
    try {
      const success = await exportTemplatesApi.delete(id);
      if (success) {
        const index = this.customTemplates.findIndex((t) => t.id === id);
        if (index >= 0) {
          this.customTemplates.splice(index, 1);
        }
        return true;
      }
      return false;
    } catch (e) {
      log.error('Failed to delete custom template:', e);
      return false;
    }
  }

  deleteCustomTemplate(id: string): boolean {
    const index = this.customTemplates.findIndex((t) => t.id === id);
    if (index < 0) return false;
    this.customTemplates.splice(index, 1);
    // Fire async delete
    this.deleteCustomTemplateAsync(id);
    return true;
  }

  duplicateTemplate(id: string): ExportTemplate | null {
    const template = this.getTemplateById(id);
    if (!template) return null;
    return this.createCustomTemplate({
      ...template,
      name: `${template.name} (Copy)`,
    });
  }

  // -------------------------------------------------------------------------
  // Database Persistence
  // -------------------------------------------------------------------------

  private dbToExportTemplate(db: ExportTemplateDB): ExportTemplate {
    return {
      id: db.id,
      name: db.name,
      description: db.description || ', ',
      icon: db.icon as TemplateIconName,
      category: db.category as ExportTemplateCategory,
      presets: db.presets as string[],
      schedule: {
        type: db.scheduleType as ScheduleType,
        delayMinutes: db.delayMinutes,
        specificTime: db.specificTime,
        recurringPattern: db.recurringPattern as 'daily' | 'weekly' | 'monthly' | undefined,
        timezone: db.timezone,
      },
      priority: db.priority as ExportJobPriority,
      uploadToDrive: db.uploadToDrive,
      createSubfolder: db.createSubfolder,
      subfolderName: db.subfolderName,
      notifyOnComplete: db.notifyOnComplete,
      tags: (db.tags as string[]) || [],
      estimatedDuration: db.estimatedDuration,
      recommendedFor: (db.recommendedFor as string[]) || [],
    };
  }

  async loadCustomTemplatesAsync(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        const dbTemplates = await exportTemplatesApi.getAll();
        this.customTemplates = dbTemplates.map((t) => this.dbToExportTemplate(t));
        this.isLoaded = true;
      } catch (e) {
        log.warn('Failed to load custom templates from DB, trying localStorage:', e);
        this.loadCustomTemplatesFromLocalStorage();
      }
    })();

    return this.loadPromise;
  }

  private loadCustomTemplatesFromLocalStorage(): void {
    try {
      const saved = localStorage.getItem('virtualStudio_exportTemplates');
      if (saved) {
        this.customTemplates = JSON.parse(saved);
      }
    } catch (e) {
      log.warn('Failed to load custom templates:', e);
    }
  }

  // Sync version for backward compatibility
  loadCustomTemplates(): void {
    this.loadCustomTemplatesFromLocalStorage();
    // Also fire async load which will update when ready
    this.loadCustomTemplatesAsync();
  }

  exportTemplates(): string {
    return JSON.stringify(this.customTemplates, null, 2);
  }

  async importTemplatesAsync(json: string): Promise<number> {
    try {
      const templates = JSON.parse(json) as ExportTemplate[];
      let imported = 0;
      for (const template of templates) {
        if (template.name && template.presets) {
          const created = await this.createCustomTemplateAsync(template);
          if (created) imported++;
        }
      }
      return imported;
    } catch {
      return 0;
    }
  }

  importTemplates(json: string): number {
    try {
      const templates = JSON.parse(json) as ExportTemplate[];
      let imported = 0;
      for (const template of templates) {
        if (template.id && template.name && template.presets) {
          this.customTemplates.push({
            ...template,
            id: `imported_${Date.now()}_${imported}`,
          });
          imported++;
        }
      }
      // Fire async import
      this.importTemplatesAsync(json);
      return imported;
    } catch {
      return 0;
    }
  }

  // -------------------------------------------------------------------------
  // Convert to BatchExportConfig
  // -------------------------------------------------------------------------

  toBatchConfig(
    template: ExportTemplate,
    driveConfig?: { userId: string; projectId?: string; projectName?: string }
  ): BatchExportConfig {
    return {
      name: template.name,
      presets: template.presets,
      uploadToDrive: template.uploadToDrive && !!driveConfig,
      driveConfig: template.uploadToDrive ? driveConfig : undefined,
    };
  }

  // -------------------------------------------------------------------------
  // Get Presets for Template
  // -------------------------------------------------------------------------

  getPresetsForTemplate(templateId: string): ExportPreset[] {
    const template = this.getTemplateById(templateId);
    if (!template) return [];
    return template.presets
      .map((id) => EXPORT_PRESETS.find((p) => p.id === id))
      .filter((p): p is ExportPreset => p !== undefined);
  }

  // -------------------------------------------------------------------------
  // Estimate Duration
  // -------------------------------------------------------------------------

  estimateDuration(templateId: string, animationDuration: number): number {
    const template = this.getTemplateById(templateId);
    if (!template) return 0;

    let totalMs = 0;
    for (const presetId of template.presets) {
      const preset = EXPORT_PRESETS.find((p) => p.id === presetId);
      if (preset) {
        // Rough estimate: 50ms per frame
        const frames = preset.config.fps * animationDuration;
        totalMs += frames * 50;
        // Add upload time if enabled (rough estimate)
        if (template.uploadToDrive) {
          const fileSize = (preset.config.bitrate * animationDuration) / 8;
          totalMs += fileSize / 1_000_000 * 500; // 500ms per MB upload
        }
      }
    }

    return totalMs / 1000; // Return in seconds
  }

  formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.ceil((seconds % 3600) / 60)}m`;
  }
}

// Export singleton
export const exportTemplateService = new ExportTemplateService();

// Load custom templates on init
if (typeof window !=='undefined') {
  exportTemplateService.loadCustomTemplates();
}

export default exportTemplateService;

