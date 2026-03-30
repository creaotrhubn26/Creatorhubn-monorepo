import type {
  CastingProject,
  ProducerClientIntake,
  ProducerClientMaterial,
  ProducerProjectPlanning,
  ProducerWorkspaceSurfaceKey,
  RoleRoomGoogleCalendarAttendee,
  RoleRoomGoogleCalendarEventInput,
  RoleRoomGoogleFolderKey,
  RoleRoomGoogleGeneratedArtifactInput,
  RoleRoomGoogleMeetSessionInput,
} from '../models/casting';
import type { ContentProductionEstimate } from '../services/contentProductionEstimateService';
import type { ProducerClientReview } from '../services/producerWorkflowService';
import {
  buildProducerDeliveryManifest,
  getProducerStrategySnapshot,
  isProducerPlanningMomentOpen,
  mergeProducerPlanningClientMomentsWithReviews,
  PRODUCER_PLANNING_FRAMEWORK_LABELS,
  PRODUCER_PLANNING_PHASE_LABELS,
  type ProducerPlanningClientMoment,
} from './producerProjectPlanning';
import { getProjectFileMetadataString, type ProjectFileRecord } from './projectFiles';

interface BuildProducerGoogleArtifactsOptions {
  project: CastingProject;
  planning: ProducerProjectPlanning;
  intake: ProducerClientIntake;
  materials: ProducerClientMaterial[];
  reviews: ProducerClientReview[];
  estimate: ContentProductionEstimate;
}

interface BuildProducerGoogleCalendarEventsOptions {
  project: CastingProject;
  planning: ProducerProjectPlanning;
  intake: ProducerClientIntake;
  reviews: ProducerClientReview[];
}

interface BuildProducerGoogleMeetSessionOptions {
  project: CastingProject;
  planning: ProducerProjectPlanning;
  intake: ProducerClientIntake;
  reviews: ProducerClientReview[];
}

const hasText = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
);

const asIsoDateTime = (dateValue?: string | null, fallbackTime = '09:00'): string | null => {
  if (!hasText(dateValue)) {
    return null;
  }

  if (dateValue.includes('T')) {
    const parsed = new Date(dateValue);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  const candidate = `${dateValue.trim().slice(0, 10)}T${fallbackTime}:00`;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
};

const addMinutes = (startIso: string, minutes: number): string => {
  const parsed = new Date(startIso);
  parsed.setMinutes(parsed.getMinutes() + minutes);
  return parsed.toISOString();
};

const addDays = (dateValue: string, dayCount: number): string => {
  const parsed = new Date(`${dateValue.slice(0, 10)}T00:00:00`);
  parsed.setDate(parsed.getDate() + dayCount);
  return parsed.toISOString();
};

const dedupeStrings = (values: Array<string | null | undefined>): string[] => (
  Array.from(new Set(values.filter(hasText).map((value) => value.trim())))
);

const buildCalendarAttendees = (
  project: CastingProject,
  intake: ProducerClientIntake,
): RoleRoomGoogleCalendarAttendee[] => {
  const emailEntries = dedupeStrings([
    project.clientEmail,
    intake.contactEmail,
  ]);

  return emailEntries.map((email) => ({
    email,
    displayName: email === intake.contactEmail
      ? intake.contactName?.trim() || project.clientName?.trim() || undefined
      : project.clientName?.trim() || intake.contactName?.trim() || undefined,
  }));
};

const getCalendarMomentDescription = (
  moment: ProducerPlanningClientMoment,
  project: CastingProject,
): string => {
  const lines = [
    moment.detail,
    moment.owner ? `Ansvarlig: ${moment.owner}` : '',
    moment.reviewStatusLabel ? `Reviewstatus: ${moment.reviewStatusLabel}` : '',
    project.clientCompanyName ? `Kunde: ${project.clientCompanyName}` : '',
  ].filter(hasText);

  return lines.join('\n');
};

const getMaterialSummary = (materials: ProducerClientMaterial[]) => (
  materials.map((material) => ({
    id: material.id,
    type: material.entry_type,
    title: material.title,
    phase: material.phase ?? 'general',
    status: material.status ?? 'provided',
    sourceLabel: getProjectFileMetadataString({
      id: material.id,
      name: material.title,
      metadata: material.metadata ?? {},
    }, 'sourceLabel', 'source'),
    externalUrl: material.external_url ?? null,
    linkedShotListId: material.linked_shot_list_id ?? null,
    description: material.description ?? '',
  }))
);

const getOpenClientMoments = (
  planning: ProducerProjectPlanning,
  reviews: ProducerClientReview[],
): ProducerPlanningClientMoment[] => (
  mergeProducerPlanningClientMomentsWithReviews(planning, reviews)
    .filter((moment) => isProducerPlanningMomentOpen(moment))
);

const mapFolderKeyToSurface = (folderKey: RoleRoomGoogleFolderKey): ProducerWorkspaceSurfaceKey => {
  switch (folderKey) {
    case 'materials':
      return 'materials';
    case 'brand':
      return 'brand';
    case 'meetings':
      return 'meetings';
    case 'delivery':
    case 'approvals':
      return 'delivery';
    case 'brief':
    default:
      return 'brief';
  }
};

export const getProducerWorkspaceSurfaceForGoogleFolder = (
  folderKey?: string | null,
): ProducerWorkspaceSurfaceKey => {
  const normalized = folderKey === 'materials'
    || folderKey === 'brand'
    || folderKey === 'delivery'
    || folderKey === 'approvals'
    || folderKey === 'meetings'
    || folderKey === 'brief'
    ? folderKey
    : 'brief';
  return mapFolderKeyToSurface(normalized);
};

export const collectRoleRoomGoogleProjectFileIds = (
  projectFiles: ProjectFileRecord[],
  materials: ProducerClientMaterial[],
): string[] => {
  const allowedSources = new Set([
    'role_room_client_material',
    'role_room_client_handoff_package',
    'role_room_delivery_workspace',
  ]);

  const ids = new Set<string>();
  projectFiles.forEach((file) => {
    const source = getProjectFileMetadataString(file, 'source');
    if (allowedSources.has(source) || source.startsWith('role_room_delivery')) {
      ids.add(file.id);
    }
  });

  materials.forEach((material) => {
    const metadata = material.metadata ?? {};
    const projectFileId = typeof metadata.projectFileId === 'string' ? metadata.projectFileId.trim() : '';
    if (projectFileId) {
      ids.add(projectFileId);
    }
  });

  return Array.from(ids);
};

export const buildProducerGoogleGeneratedArtifacts = ({
  project,
  planning,
  intake,
  materials,
  reviews,
  estimate,
}: BuildProducerGoogleArtifactsOptions): RoleRoomGoogleGeneratedArtifactInput[] => {
  const deliveryManifest = buildProducerDeliveryManifest(project.name, planning, estimate, reviews);
  const strategySnapshot = getProducerStrategySnapshot(planning);
  const openClientMoments = getOpenClientMoments(planning, reviews);

  return [
    {
      localEntityType: 'producer_planning',
      localEntityId: 'brief-summary',
      artifactType: 'drive_file',
      title: 'Brief - prosjektretning.json',
      folderKey: 'brief',
      mimeType: 'application/json',
      sourceLabel: 'producer_brief',
      contentText: JSON.stringify({
        projectName: project.name,
        clientName: project.clientName ?? intake.contactName ?? null,
        clientCompanyName: project.clientCompanyName ?? null,
        strategySnapshot,
        activationPlan: planning.activationPlan,
        framework: (planning.activationPlan.framework ?? []).map((step) => ({
          key: step.key,
          label: PRODUCER_PLANNING_FRAMEWORK_LABELS[step.key],
          focus: step.focus ?? '',
          output: step.output ?? '',
          notes: step.notes ?? '',
        })),
        intake,
      }, null, 2),
      metadata: {
        workspaceSurface: 'brief',
        projectId: project.id,
      },
    },
    {
      localEntityType: 'producer_material_register',
      localEntityId: 'client-materials',
      artifactType: 'drive_file',
      title: 'Materiale - klientgrunnlag.json',
      folderKey: 'materials',
      mimeType: 'application/json',
      sourceLabel: 'producer_materials',
      contentText: JSON.stringify({
        projectName: project.name,
        materials: getMaterialSummary(materials),
        openClientMoments: openClientMoments
          .filter((moment) => moment.type === 'content_delivery')
          .map((moment) => ({
            id: moment.id,
            title: moment.title,
            detail: moment.detail,
            phase: moment.phase,
            date: moment.date ?? null,
          })),
      }, null, 2),
      metadata: {
        workspaceSurface: 'materials',
        projectId: project.id,
      },
    },
    {
      localEntityType: 'producer_brand_guide',
      localEntityId: 'brand-guide',
      artifactType: 'drive_file',
      title: 'Merkevareguide - grunnlag.json',
      folderKey: 'brand',
      mimeType: 'application/json',
      sourceLabel: 'producer_brand_guide',
      contentText: JSON.stringify({
        projectName: project.name,
        brandGuide: planning.brandGuide,
        notes: intake.brandNotes ?? '',
      }, null, 2),
      metadata: {
        workspaceSurface: 'brand',
        projectId: project.id,
      },
    },
    {
      localEntityType: 'producer_delivery_manifest',
      localEntityId: 'delivery-manifest',
      artifactType: 'drive_file',
      title: 'Levering - manifest.json',
      folderKey: 'delivery',
      mimeType: 'application/json',
      sourceLabel: 'producer_delivery_manifest',
      contentText: JSON.stringify(deliveryManifest, null, 2),
      metadata: {
        workspaceSurface: 'delivery',
        projectId: project.id,
      },
    },
    {
      localEntityType: 'producer_approval_queue',
      localEntityId: 'approval-queue',
      artifactType: 'drive_file',
      title: 'Godkjenning - åpne saker.json',
      folderKey: 'approvals',
      mimeType: 'application/json',
      sourceLabel: 'producer_approvals',
      contentText: JSON.stringify({
        projectName: project.name,
        openClientMoments,
        pendingReviews: reviews
          .filter((review) => review.status !== 'approved')
          .map((review) => ({
            id: review.id,
            type: review.review_type,
            title: review.title,
            status: review.status,
            dueAt: review.due_at ?? null,
            commentCount: review.comments?.length ?? 0,
          })),
      }, null, 2),
      metadata: {
        workspaceSurface: 'delivery',
        projectId: project.id,
      },
    },
    {
      localEntityType: 'producer_meeting_workspace',
      localEntityId: 'meeting-workspace',
      artifactType: 'drive_file',
      title: 'Møte - agenda og oppfølging.json',
      folderKey: 'meetings',
      mimeType: 'application/json',
      sourceLabel: 'producer_meeting_workspace',
      contentText: JSON.stringify({
        projectName: project.name,
        sessionLabel: planning.meetingWorkspace.sessionLabel ?? '',
        status: planning.meetingWorkspace.status,
        activeMeetUrl: planning.meetingWorkspace.activeMeetUrl ?? null,
        agenda: planning.meetingWorkspace.agenda,
        decisions: planning.meetingWorkspace.decisions,
        followUps: planning.meetingWorkspace.followUps,
        liveNotes: planning.meetingWorkspace.liveNotes ?? '',
      }, null, 2),
      metadata: {
        workspaceSurface: 'meetings',
        projectId: project.id,
      },
    },
  ];
};

export const buildProducerGoogleCalendarEvents = ({
  project,
  planning,
  intake,
  reviews,
}: BuildProducerGoogleCalendarEventsOptions): RoleRoomGoogleCalendarEventInput[] => {
  const attendees = buildCalendarAttendees(project, intake);
  const events: RoleRoomGoogleCalendarEventInput[] = [];

  planning.phasePlan.forEach((phaseItem) => {
    const start = asIsoDateTime(phaseItem.startDate, '09:00');
    if (!start) {
      return;
    }
    const end = phaseItem.endDate
      ? addDays(phaseItem.endDate, 1)
      : addDays(start, 1);
    events.push({
      entityType: 'phase_plan',
      entityId: phaseItem.phase,
      title: `${PRODUCER_PLANNING_PHASE_LABELS[phaseItem.phase]} · ${phaseItem.title ?? 'Fasearbeid'}`,
      description: [
        phaseItem.objective ?? '',
        phaseItem.clientCheckpoint ? `Klientcheckpoint: ${phaseItem.clientCheckpoint}` : '',
        phaseItem.owner ? `Ansvarlig: ${phaseItem.owner}` : '',
        phaseItem.notes ?? '',
      ].filter(hasText).join('\n'),
      start,
      end,
      phase: phaseItem.phase,
      allDay: true,
      attendees,
    });
  });

  planning.contentCalendar.forEach((item) => {
    const start = asIsoDateTime(item.publishAt, hasText(item.publishAt) && item.publishAt.includes('T') ? '09:00' : '10:00');
    if (!start) {
      return;
    }
    events.push({
      entityType: 'content_calendar',
      entityId: item.id,
      title: `Content-kalender · ${item.title}`,
      description: [
        item.channel ? `Kanal: ${item.channel}` : '',
        item.format ? `Format: ${item.format}` : '',
        item.owner ? `Ansvarlig: ${item.owner}` : '',
        item.notes ?? '',
      ].filter(hasText).join('\n'),
      start,
      end: addMinutes(start, 45),
      phase: item.phase,
      allDay: !item.publishAt?.includes('T'),
      attendees,
    });
  });

  (project.productionDays ?? []).forEach((day) => {
    const start = asIsoDateTime(day.date, day.callTime || '08:00');
    if (!start) {
      return;
    }
    const end = asIsoDateTime(day.date, day.wrapTime || '16:00') ?? addMinutes(start, 480);
    const sceneLabels = day.scenes.filter(hasText);
    events.push({
      entityType: 'production_day',
      entityId: day.id,
      title: `Produksjonsdag · ${day.date?.slice(0, 10) ?? day.id}`,
      description: [
        sceneLabels.length > 0 ? `Scener: ${sceneLabels.join(', ')}` : '',
        day.notes ?? '',
      ].filter(hasText).join('\n'),
      start,
      end,
      phase: 'production',
      attendees,
    });
  });

  reviews
    .filter((review) => review.status !== 'approved' && hasText(review.due_at))
    .forEach((review) => {
      const start = asIsoDateTime(review.due_at, '10:00');
      if (!start) {
        return;
      }
      events.push({
        entityType: 'client_review',
        entityId: review.id,
        title: `Klientreview · ${review.title}`,
        description: review.description ?? undefined,
        start,
        end: addMinutes(start, 45),
        phase: 'preproduction',
        attendees,
      });
    });

  return events;
};

export const buildProducerGoogleMeetSession = ({
  project,
  planning,
  intake,
  reviews,
}: BuildProducerGoogleMeetSessionOptions): RoleRoomGoogleMeetSessionInput => {
  const attendees = buildCalendarAttendees(project, intake);
  const openMoment = getOpenClientMoments(planning, reviews)
    .filter((moment) => hasText(moment.date))
    .sort((left, right) => {
      const leftTime = Date.parse(left.date ?? '');
      const rightTime = Date.parse(right.date ?? '');
      return (Number.isNaN(leftTime) ? Number.MAX_SAFE_INTEGER : leftTime)
        - (Number.isNaN(rightTime) ? Number.MAX_SAFE_INTEGER : rightTime);
    })[0] ?? null;

  const pendingReview = reviews
    .filter((review) => review.status !== 'approved' && hasText(review.due_at))
    .sort((left, right) => {
      const leftTime = Date.parse(left.due_at ?? '');
      const rightTime = Date.parse(right.due_at ?? '');
      return (Number.isNaN(leftTime) ? Number.MAX_SAFE_INTEGER : leftTime)
        - (Number.isNaN(rightTime) ? Number.MAX_SAFE_INTEGER : rightTime);
    })[0] ?? null;

  const productionDay = (project.productionDays ?? [])
    .filter((day) => hasText(day.date))
    .sort((left, right) => {
      const leftTime = Date.parse(left.date ?? '');
      const rightTime = Date.parse(right.date ?? '');
      return (Number.isNaN(leftTime) ? Number.MAX_SAFE_INTEGER : leftTime)
        - (Number.isNaN(rightTime) ? Number.MAX_SAFE_INTEGER : rightTime);
    })[0] ?? null;

  const anchorDate = pendingReview?.due_at
    ?? openMoment?.date
    ?? productionDay?.date
    ?? new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString();
  const start = asIsoDateTime(anchorDate, '10:00') ?? new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString();

  return {
    entityType: 'meet_session',
    entityId: pendingReview?.id ?? openMoment?.id ?? productionDay?.id ?? 'client-sync',
    title: planning.meetingWorkspace.sessionLabel?.trim() || `Klientsync · ${project.name}`,
    description: pendingReview
      ? `Gjennomgang av ${pendingReview.title}`
      : openMoment
        ? getCalendarMomentDescription(openMoment, project)
        : planning.meetingWorkspace.agenda.length > 0
          ? planning.meetingWorkspace.agenda
            .slice(0, 4)
            .map((item) => item.title)
            .join('\n')
          : 'Statusmøte for prosjektplan, materiale og levering.',
    start,
    end: addMinutes(start, 45),
    phase: pendingReview?.metadata?.phase as string | undefined
      ?? openMoment?.phase
      ?? 'preproduction',
    includeMeet: true,
    attendees,
  };
};
