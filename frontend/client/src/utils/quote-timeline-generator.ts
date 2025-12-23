/**
 * CreatorHub Norge - Quote Timeline Generator
 * Automatically creates timeline events when a quote is accepted and project is created
 */

import { apiRequest } from '@/lib/queryClient';

interface QuoteTimelineConfig {
  quoteId: string;
  projectId: string;
  quoteSentDate: string;
  quoteAcceptedDate: string;
  projectType: string;
  clientName: string;
  profession: string;
  eventDate?: string; // If project has specific event date
}

/**
 * Generate timeline events for a quote → project workflow
 */
export async function generateQuoteTimeline(
  config: QuoteTimelineConfig,
  auth: Record<string, string>,
) {
  const {
    projectId,
    quoteSentDate,
    quoteAcceptedDate,
    projectType,
    clientName,
    profession,
    eventDate,
  } = config;

  const timelineEvents = [];

  // Event 1: Quote Sent
  timelineEvents.push({
    projectId,
    title: 'Tilbud sendt til kunde',
    description: `Tilbud sendt til ${clientName} for ${projectType}-prosjekt`,
    eventDate: quoteSentDate,
    eventTime: new Date(quoteSentDate).toLocaleTimeString('no-NO', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    type: 'pre_planning',
    status: 'completed',
    priority: 'medium',
    notes: 'Tilbud ble sendt og er under vurdering av kunde',
    notificationSent: true,
    completedAt: quoteSentDate,
  });

  // Event 2: Quote Accepted
  timelineEvents.push({
    projectId,
    title: 'Tilbud godkjent av kunde',
    description: `${clientName} har godkjent tilbudet - prosjekt kan startes`,
    eventDate: quoteAcceptedDate,
    eventTime: new Date(quoteAcceptedDate).toLocaleTimeString('no-NO', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    type: 'milestone',
    status: 'completed',
    priority: 'high',
    notes: 'Kunde har godkjent tilbudet, prosjekt opprettet automatisk',
    notificationSent: true,
    completedAt: quoteAcceptedDate,
  });

  // Event 3: Project Kickoff
  const kickoffDate = new Date(quoteAcceptedDate);
  kickoffDate.setHours(kickoffDate.getHours() + 1); // 1 hour after acceptance
  timelineEvents.push({
    projectId,
    title: 'Prosjekt oppstartet',
    description: `Prosjekt for ${clientName} er nå aktivt og klart for planlegging`,
    eventDate: kickoffDate.toISOString().split('T')[0],
    eventTime: kickoffDate.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' }),
    type: 'milestone',
    status: 'completed',
    priority: 'high',
    notes: 'Prosjekt opprettet fra godkjent tilbud',
    notificationSent: false,
    completedAt: kickoffDate.toISOString(),
  });

  // Event 4: Initial Meeting (scheduled for future)
  const meetingDate = new Date(quoteAcceptedDate);
  meetingDate.setDate(meetingDate.getDate() + 3); // 3 days after acceptance
  meetingDate.setHours(10, 0, 0, 0); // 10:00 AM
  timelineEvents.push({
    projectId,
    title: 'Oppstartsmøte med kunde',
    description: `Første møte med ${clientName} for å diskutere detaljer og forventninger`,
    eventDate: meetingDate.toISOString().split('T')[0],
    eventTime: '10:00',
    type: 'meeting',
    status: 'planned',
    priority: 'high',
    notes: 'Viktig å diskutere: timeline, forventninger, spesielle ønsker',
    notificationSent: false,
  });

  // Event 5: Project-type specific milestones
  const typeSpecificEvents = getProjectTypeEvents(
    projectType,
    profession,
    projectId,
    clientName,
    eventDate,
  );
  timelineEvents.push(...typeSpecificEvents);

  // Create all timeline events via API
  const createdEvents = [];
  for (const event of timelineEvents) {
    try {
      const response = await apiRequest('/api/timeline/events', {
        method: 'POST',
        headers: {
          ...auth 'Content-Type' : 'application/json',
        },
        body: JSON.stringify(event),
      });
      createdEvents.push(response);
    } catch (error) {
      console.error('Error creating timeline event: ', error);
    }
  }

  return createdEvents;
}

/**
 * Get project type-specific timeline events
 */
function getProjectTypeEvents(
  projectType: string,
  profession: string,
  projectId: string,
  clientName: string,
  eventDate?: string,
): unknown[] {
  const events = [];

  // Calculate dates relative to event date or acceptance date
  const baseDate = eventDate ? new Date(eventDate) : new Date();

  switch (projectType) {
    case 'wedding':
      // Pre-production
      const locationScoutDate = new Date(baseDate);
      locationScoutDate.setDate(locationScoutDate.getDate() - 30); // 1 month before
      events.push({
        projectId,
        title: 'Location scouting',
        description: 'Besøk bryllupslokasjonen for å planlegge fotografering',
        eventDate: locationScoutDate.toISOString().split('T')[0],
        eventTime: '14:00',
        type: 'pre_production',
        status: 'planned',
        priority: 'medium',
        notes: 'Ta bilder av lokasjon, sjekk lysforhold, planlegg beste vinkler',
      });

      // Wedding day
      if (eventDate) {
        events.push({
          projectId,
          title: 'Bryllupsdag - Fotografering',
          description: `Bryllupsdagen for ${clientName}`,
          eventDate: eventDate,
          eventTime: '10:00',
          type: 'photo_session',
          status: 'planned',
          priority: 'critical',
          notes: 'Hovedarrangement - husk alt utstyr, minnekort, backup batterier',
        });
      }

      // Post-production
      const editingDeadline = new Date(baseDate);
      editingDeadline.setDate(editingDeadline.getDate() + 14); // 2 weeks after
      events.push({
        projectId,
        title: 'Redigeringsfrist',
        description: 'Ferdigstille og levere redigerte bilder til kunde',
        eventDate: editingDeadline.toISOString().split('T')[0],
        eventTime: '17:00',
        type: 'deadline',
        status: 'planned',
        priority: 'high',
        notes: 'Levering av alle redigerte bilder',
      });

      // Delivery
      const deliveryDate = new Date(baseDate);
      deliveryDate.setDate(deliveryDate.getDate() + 21); // 3 weeks after
      events.push({
        projectId,
        title: 'Levering til kunde',
        description: `Levere ferdige bilder til ${clientName}`,
        eventDate: deliveryDate.toISOString().split('T')[0],
        eventTime: '12:00',
        type: 'delivery',
        status: 'planned',
        priority: 'high',
        notes: 'Online galleri + USB/nedlastingslink',
      });
      break;

    case 'portrait':
      // Photo session
      const portraitDate = new Date(baseDate);
      portraitDate.setDate(portraitDate.getDate() + 7); // 1 week out
      events.push({
        projectId,
        title: 'Portrettfotografering',
        description: `Fotosession med ${clientName}`,
        eventDate: portraitDate.toISOString().split('T')[0],
        eventTime: '13:00',
        type: 'photo_session',
        status: 'planned',
        priority: 'high',
        notes: 'Diskuter klær, stil, og bakgrunn med kunde på forhånd',
      });

      // Review
      const reviewDate = new Date(portraitDate);
      reviewDate.setDate(reviewDate.getDate() + 3);
      events.push({
        projectId,
        title: 'Bildegodkjenning',
        description: 'Kunde velger favorittbilder for redigering',
        eventDate: reviewDate.toISOString().split('T')[0],
        eventTime: '15:00',
        type: 'review',
        status: 'planned',
        priority: 'medium',
        notes: 'Send proofing-galleri for utvalg',
      });

      // Delivery
      const portraitDelivery = new Date(reviewDate);
      portraitDelivery.setDate(portraitDelivery.getDate() + 7);
      events.push({
        projectId,
        title: 'Levering av ferdige bilder',
        description: 'Levere redigerte portrettbilder',
        eventDate: portraitDelivery.toISOString().split('T')[0],
        eventTime: '12:00',
        type: 'delivery',
        status: 'planned',
        priority: 'high',
      });
      break;

    case 'commercial':
      // Planning meeting
      const planningDate = new Date(baseDate);
      planningDate.setDate(planningDate.getDate() + 5);
      events.push({
        projectId,
        title: 'Planleggingsmøte',
        description: 'Diskutere konsept, stil, og leveranser',
        eventDate: planningDate.toISOString().split('T')[0],
        eventTime: '10:00',
        type: 'meeting',
        status: 'planned',
        priority: 'high',
        notes: 'Diskuter brand guidelines, ønsket stil, leveranseformat',
      });

      // Shoot day
      const shootDate = new Date(planningDate);
      shootDate.setDate(shootDate.getDate() + 10);
      events.push({
        projectId,
        title: 'Kommersiell fotografering',
        description: 'Hovedfotografering for kommersielt prosjekt',
        eventDate: shootDate.toISOString().split('T')[0],
        eventTime: '09:00',
        type: 'photo_session',
        status: 'planned',
        priority: 'critical',
        notes: 'Profesjonelt utstyr, backup plan for vær/lys',
      });

      // Delivery
      const commercialDelivery = new Date(shootDate);
      commercialDelivery.setDate(commercialDelivery.getDate() + 10);
      events.push({
        projectId,
        title: 'Levering av kommersielle bilder',
        description: 'Levere ferdige høyoppløselige bilder',
        eventDate: commercialDelivery.toISOString().split('T')[0],
        eventTime: '16:00',
        type: 'delivery',
        status: 'planned',
        priority: 'critical',
        notes: 'Leveringsformat per avtale - print-ready, web-ready, RAW',
      });
      break;

    // Add more project types as needed
    default:
      // Generic milestone
      const genericMilestone = new Date(baseDate);
      genericMilestone.setDate(genericMilestone.getDate() + 14);
      events.push({
        projectId,
        title: 'Prosjektleveranse',
        description: `Levering av ${projectType}-prosjekt`,
        eventDate: genericMilestone.toISOString().split('T')[0],
        eventTime: '15:00',
        type: 'delivery',
        status: 'planned',
        priority: 'high',
      });
      break;
  }

  return events;
}

/**
 * Create initial timeline when project is created from quote
 * This is called automatically after project creation
 */
export async function createQuoteProjectTimeline(
  projectId: string,
  quoteData: any,
  projectData: any,
  auth: Record<string, string>,
) {
  return generateQuoteTimeline(
    {
      quoteId: quoteData.id,
      projectId,
      quoteSentDate: quoteData.sentAt || quoteData.createdAt,
      quoteAcceptedDate: quoteData.acceptedAt || new Date().toISOString(),
      projectType: projectData.projectType || quoteData.projectType || 'wedding',
      clientName: projectData.clientName || quoteData.clientName,
      profession: projectData.profession || quoteData.profession ||'photographer',
      eventDate: projectData.eventDate,
    },
    auth,
  );
}
