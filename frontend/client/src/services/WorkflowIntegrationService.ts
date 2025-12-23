/**
 * Workflow Integration Service
 * Closes gaps between ProjectCreation, ProjectTimeline, UniversalShowcase, and WeddingTimeline
 */

import { apiRequest } from '@/lib/queryClient';

export class WorkflowIntegrationService {
  /**
   * GAP 1: Auto-create showcase when project is created
   */
  static async autoCreateShowcase(project: {
    id: string;
    title: string;
    clientEmail?: string;
    projectType?: string;
    userId: string;
    memoryCards?: Array<{ id: string; label: string; purpose: string }>;
  }) {
    try {
      // Create showcase
      const showcase = await apiRequest('/api/showcase/auto-create', {
        method: 'POST',
        body: {
          projectId: project.id,
          projectTitle: project.title,
          clientEmail: project.clientEmail,
          projectType: project.projectType,
          userId: project.userId,
        },
      });

      // Link memory cards if provided
      if (project.memoryCards && project.memoryCards.length > 0) {
        await apiRequest('/api/showcase/link-memory-cards', {
          method: 'POST',
          body: {
            projectId: project.id,
            memoryCards: project.memoryCards.reduce(
              (acc, card) => ({
                ...acc,
                [card.id]: card.purpose,
              }),
              {},
            ),
          },
        });
      }

      console.log('✅ Showcase auto-created: ', showcase);
      return showcase;
    } catch (error) {
      console.error('❌ Failed to auto-create showcase:', error);
      throw error;
    }
  }

  /**
   * AUTO-CREATE WEDDING TIMELINE: Create timeline when wedding project is created
   */
  static async autoCreateWeddingTimeline(project: {
    id: string;
    title: string;
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    weddingDate?: string;
    venue?: string;
    weddingCulture?: string;
    photographerId: string;
  }) {
    try {
      const timeline = await apiRequest('/api/wedding-timeline/auto-create', {
        method: 'POST',
        body: {
          projectId: project.id,
          photographerId: project.photographerId,
          coupleName: project.clientName,
          weddingDate: project.weddingDate,
          venue: project.venue || ', ',
          culturalType: project.weddingCulture || 'norsk',
          clientEmail: project.clientEmail,
          clientPhone: project.clientPhone,
          // Auto-enable client access
          clientAccessEnabled: true,
          // Generate default events based on culture
          autoGenerateEvents: true,
        },
      });

      console.log('✅ Wedding timeline auto-created:', timeline);
      return timeline;
    } catch (error) {
      console.error('❌ Failed to auto-create wedding timeline:', error);
      // Don't throw - this is optional enhancement
      return null;
    }
  }

  /**
   * AUTO-CREATE EVENT TIMELINE: Universal timeline creation for all project types
   */
  static async autoCreateEventTimeline(project: {
    id: string;
    title: string;
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    eventDate?: string;
    venue?: string;
    projectType: string;
    photographerId: string;
  }) {
    try {
      const timeline = await apiRequest('/api/event-timeline/auto-create', {
        method: 'POST',
        body: {
          projectId: project.id,
          photographerId: project.photographerId,
          projectType: project.projectType,
          clientName: project.clientName,
          eventDate: project.eventDate,
          venue: project.venue || ', ',
          clientEmail: project.clientEmail,
          clientPhone: project.clientPhone,
          // Auto-enable client access
          clientAccessEnabled: true,
          // Generate default events based on project type
          autoGenerateEvents: true,
        },
      });

      console.log(`✅ Event timeline auto-created for ${project.projectType}:`, timeline);
      return timeline;
    } catch (error) {
      console.error('❌ Failed to auto-create event timeline:', error);
      // Don't throw - this is optional enhancement
      return null;
    }
  }

  /**
   * GAP 2: Sync wedding timeline to project timeline
   */
  static async syncWeddingToProjectTimeline(weddingTimelineId: string, projectId: string) {
    try {
      await apiRequest(`/api/wedding-timeline/${weddingTimelineId}/sync-to-project`, {
        method: 'POST',
        body: { projectId },
      });
      console.log('✅ Wedding timeline synced to project timeline');
    } catch (error) {
      console.error('❌ Failed to sync timelines:', error);
    }
  }

  /**
   * GAP 3: Auto-tag showcase item by timeline event
   */
  static async autoTagByTimelineEvent(showcaseItem: {
    id: string;
    timestamp: Date;
    projectId: string;
  }) {
    try {
      // Fetch timeline events
      const events = await apiRequest(`/api/projects/${showcaseItem.projectId}/timeline-events`);

      // Find matching event based on timestamp
      const matchedEvent = events.find((event: unknown) => {
        const eventStart = new Date(event.startTime);
        const eventEnd = new Date(
          event.endTime || new Date(eventStart.getTime() + 2 * 60 * 60 * 1000),
        ); // +2 hours default
        return showcaseItem.timestamp >= eventStart && showcaseItem.timestamp <= eventEnd;
      });

      if (matchedEvent) {
        // Update showcase item with event metadata
        await apiRequest(`/api/showcase/items/${showcaseItem.id}/tag-event`, {
          method: 'PUT',
          body: {
            timelineEventId: matchedEvent.id,
            eventName: matchedEvent.eventName || matchedEvent.name,
            eventType: matchedEvent.type,
          },
        });
        console.log(`✅ Tagged as "${matchedEvent.eventName}"`);
        return matchedEvent;
      }
    } catch (error) {
      console.error('❌ Failed to auto-tag:', error);
    }
  }

  /**
   * GAP 4: Track memory card through upload
   */
  static async tagWithMemoryCard(
    showcaseItemId: string,
    memoryCardId: string,
    memoryCardLabel: string,
  ) {
    try {
      await apiRequest(`/api/showcase/items/${showcaseItemId}/tag-memory-card`, {
        method: 'PUT',
        body: {
          memoryCardId,
          memoryCardLabel,
        },
      });
      console.log(`✅ Tagged with memory card: ${memoryCardLabel}`);
    } catch (error) {
      console.error('❌ Failed to tag memory card:', error);
    }
  }

  /**
   * GAP 5: Comment triggers timeline milestone update
   */
  static async handleCommentTimelineUpdate(comment: {
    id: string;
    projectId: string;
    commentType: string;
    metadata?: {
      timelineEventId?: string;
      eventName?: string;
    };
    content: string;
  }) {
    try {
      // Only trigger for approval comments
      if (comment.commentType === 'approval' && comment.metadata?.timelineEventId) {
        await apiRequest(`/api/projects/${comment.projectId}/timeline/auto-update`, {
          method: 'POST',
          body: {
            milestoneId: `${comment.metadata.eventName?.toLowerCase()}_approved`,
            status: 'completed',
            completedBy: 'client',
            completedAt: new Date().toISOString(),
            notes: `Client approved via comment: "${comment.content.substring(0, 100)}"`,
          },
        });
        console.log('✅ Timeline milestone updated from comment');
      }
    } catch (error) {
      console.error('❌ Failed to update timeline:', error);
    }
  }

  /**
   * GAP 6: Get customizable guidelines for project
   */
  static async getProjectGuidelines(projectId: string) {
    try {
      const project = await apiRequest(`/api/projects/${projectId}`);
      return project?.settings?.commentingGuidelines || this.getDefaultGuidelines();
    } catch (error) {
      console.error('❌ Failed to fetch guidelines:', error);
      return this.getDefaultGuidelines();
    }
  }

  static getDefaultGuidelines() {
    return {
      approval: [
        '✅ Confirm which aspects you love', '❤️ Be specific about what works well','🎯 Mention if it meets contract expectations',
      ],
      revision: [
        '🔍 Be specific about what needs changing','📍 Reference exact location/timestamp','📊 Check if it aligns with contract deliverables',
      ],
      feedback: [
        '💭 Share your honest thoughts', '⭐ Mention both what works and could improve', '🎨 Comment on composition, lighting, mood',
      ],
    };
  }

  /**
   * GAP 7: Fetch contract for showcase
   */
  static async getProjectContract(projectId: string) {
    try {
      const contract = await apiRequest(`/api/contracts/by-project/${projectId}`);
      return contract;
    } catch (error) {
      console.error('❌ Failed to fetch contract:', error);
      return null;
    }
  }

  /**
   * Complete workflow orchestration
   * Call this after project creation to set up everything
   */
  static async orchestrateCompleteWorkflow(project: unknown) {
    console.log('🚀 Orchestrating complete workflow for:', project.title);

    try {
      // Step 1: Auto-create showcase
      const showcase = await this.autoCreateShowcase(project);

      // Step 2: Auto-create event timeline for ALL project types
      let eventTimeline = null;
      console.log(`📅 Creating event timeline for ${project.projectType} project...`);
      eventTimeline = await this.autoCreateEventTimeline({
        id: project.id,
        title: project.title,
        clientName: project.clientName,
        clientEmail: project.clientEmail,
        clientPhone: project.clientPhone,
        eventDate: project.eventDate,
        venue: project.location || project.venue,
        projectType: project.projectType || 'other',
        photographerId: project.userId,
      });

      // Step 3: For backwards compatibility, still create wedding timeline for wedding projects
      let weddingTimeline = null;
      if (project.projectType === 'wedding' || project.projectType ==='bryllup') {
        console.log('💒 Creating legacy wedding timeline for wedding project...');
        weddingTimeline = await this.autoCreateWeddingTimeline({
          id: project.id,
          title: project.title,
          clientName: project.clientName,
          clientEmail: project.clientEmail,
          clientPhone: project.clientPhone,
          weddingDate: project.eventDate,
          venue: project.location || project.venue,
          weddingCulture: project.weddingCulture,
          photographerId: project.userId,
        });

        // Sync to project timeline if created successfully
        if (weddingTimeline) {
          await this.syncWeddingToProjectTimeline(weddingTimeline.id, project.id);
        }
      }

      // Step 4: Set up default guidelines
      const guidelines = await this.getProjectGuidelines(project.id);

      console.log('✅ Complete workflow orchestrated successfully');

      return {
        showcase,
        eventTimeline,
        weddingTimeline,
        guidelines,
        success: true,
      };
    } catch (error) {
      console.error('❌ Workflow orchestration failed:', error);
      throw error;
    }
  }
}

export default WorkflowIntegrationService;
