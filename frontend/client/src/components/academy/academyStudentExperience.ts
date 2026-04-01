import { useQuery } from '@tanstack/react-query';
import { apiRequest, isApiEndpointMissing } from '@/lib/queryClient';

export type AcademyTranslateFn = (no: string, en: string) => string;

export interface AcademyStudentAccessSummary {
  userId: string | null;
  email: string | null;
  access: {
    status: string | null;
    approvedAt: string | null;
    approvedBy: string | null;
    approvedByUserId: string | null;
    approvedByRoleLabel?: string | null;
    role: string | null;
    roleLabel: string | null;
    profession: string | null;
    onboardingStatus: string | null;
    inviteRequestId: string | null;
    accountUserId: string | null;
    isActive: boolean;
  } | null;
}

type AcademyStudentAccessPayload = {
  success?: boolean;
  data?: AcademyStudentAccessSummary | null;
};

export interface AcademyStudentNextAction {
  id: string;
  title: string;
  detail: string;
  ctaLabel: string;
  tone: 'primary' | 'attention' | 'support';
}

export interface AcademyStudentWeekPlanItem {
  id: string;
  title: string;
  detail: string;
  tone: 'primary' | 'attention' | 'support' | 'celebrate';
}

export interface AcademyStudentSupportCard {
  eyebrow: string;
  title: string;
  detail: string;
  meta: string | null;
  tone: 'success' | 'support';
}

export interface AcademyStudentAssignmentStatusMeta {
  label: string;
  detail: string;
  chipBg: string;
  chipColor: string;
}

export interface AcademyStudentResourceContextMeta {
  label: string;
  detail: string;
  chipBg: string;
  chipColor: string;
}

interface AcademyStudentNextActionInput {
  tt: AcademyTranslateFn;
  courseTitle?: string | null;
  lessonTitle?: string | null;
  pendingAssignments?: number;
  dueSoonAssignments?: number;
  feedbackCount?: number;
  notesToReview?: number;
  resourceCount?: number;
  progressPercent?: number;
  isNewStudent?: boolean;
}

interface AcademyStudentWeekPlanInput
  extends AcademyStudentNextActionInput {
  approvedBy?: string | null;
}

interface AcademyStudentSupportCardInput {
  tt: AcademyTranslateFn;
  access?: AcademyStudentAccessSummary['access'];
  instructorName?: string | null;
  locale?: string;
}

interface AcademyStudentResourceContextInput {
  tt: AcademyTranslateFn;
  type?: string | null;
  tags?: string[] | null;
  source?: string | null;
  lessonId?: string | null;
  currentLessonId?: string | null;
  activeAssignmentLessonId?: string | null;
  isFavorite?: boolean;
}

const formatDateLabel = (value: string | null | undefined, locale = 'nb-NO'): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(parsed);
};

const toCount = (value: unknown): number => {
  const normalized = Number(value || 0);
  return Number.isFinite(normalized) ? Math.max(0, Math.round(normalized)) : 0;
};

export function useAcademyStudentAccessSummary(courseId?: string) {
  return useQuery<AcademyStudentAccessSummary | null>({
    queryKey: ['/api/academy/access-summary', { courseId: courseId || undefined }],
    staleTime: 60_000,
    queryFn: async () => {
      try {
        const path = courseId
          ? `/api/academy/access-summary?courseId=${encodeURIComponent(courseId)}`
          : '/api/academy/access-summary';
        const payload = (await apiRequest(path)) as AcademyStudentAccessPayload;
        return payload?.data || null;
      } catch (error) {
        if (isApiEndpointMissing(error)) {
          return null;
        }
        throw error;
      }
    },
  });
}

export function buildAcademyStudentNextAction(
  input: AcademyStudentNextActionInput,
): AcademyStudentNextAction {
  const {
    tt,
    courseTitle,
    lessonTitle,
    pendingAssignments = 0,
    dueSoonAssignments = 0,
    feedbackCount = 0,
    notesToReview = 0,
    resourceCount = 0,
    progressPercent = 0,
    isNewStudent = false,
  } = input;

  if (dueSoonAssignments > 0) {
    return {
      id: 'assignment',
      title: tt('Lever neste oppgave', 'Submit the next assignment'),
      detail: tt(
        `${dueSoonAssignments} oppgaver trenger oppmerksomhet i ${courseTitle || tt('kurset ditt', 'your course')}.`,
        `${dueSoonAssignments} assignments need attention in ${courseTitle || 'your course'}.`,
      ),
      ctaLabel: tt('Åpne oppgaver', 'Open assignments'),
      tone: 'attention',
    };
  }

  if (feedbackCount > 0) {
    return {
      id: 'feedback',
      title: tt('Se ny feedback', 'Review new feedback'),
      detail: tt(
        `${feedbackCount} tilbakemeldinger venter på deg før neste steg.`,
        `${feedbackCount} feedback updates are waiting before your next step.`,
      ),
      ctaLabel: tt('Se feedback', 'Review feedback'),
      tone: 'support',
    };
  }

  if (isNewStudent || progressPercent <= 0) {
    return {
      id: 'onboarding',
      title: tt('Kom i gang med første leksjon', 'Start your first lesson'),
      detail: tt(
        `Start i ${courseTitle || tt('Academy', 'Academy')} og bygg momentum fra første modul.`,
        `Start in ${courseTitle || 'Academy'} and build momentum from the first module.`,
      ),
      ctaLabel: tt('Start leksjon', 'Start lesson'),
      tone: 'primary',
    };
  }

  if (pendingAssignments > 0) {
    return {
      id: 'assignment',
      title: tt('Arbeid videre med oppgaven', 'Keep working on the assignment'),
      detail: tt(
        `${pendingAssignments} aktive oppgaver er en naturlig del av neste læringssteg.`,
        `${pendingAssignments} active assignments are a natural part of your next learning step.`,
      ),
      ctaLabel: tt('Åpne oppgaver', 'Open assignments'),
      tone: 'primary',
    };
  }

  if (notesToReview > 0) {
    return {
      id: 'review',
      title: tt('Gå gjennom notatene dine', 'Review your notes'),
      detail: tt(
        `${notesToReview} notater og bokmerker er klare før du går videre.`,
        `${notesToReview} notes and bookmarks are ready before you move on.`,
      ),
      ctaLabel: tt('Åpne spiller', 'Open player'),
      tone: 'support',
    };
  }

  if (resourceCount > 0) {
    return {
      id: 'resources',
      title: tt('Bruk ressursene i neste steg', 'Use the next resources'),
      detail: tt(
        `${resourceCount} ressurser er kuratert for ${lessonTitle || courseTitle || tt('neste del', 'the next section')}.`,
        `${resourceCount} resources are curated for ${lessonTitle || courseTitle || 'the next section'}.`,
      ),
      ctaLabel: tt('Åpne ressurser', 'Open resources'),
      tone: 'primary',
    };
  }

  return {
    id: 'continue',
    title: tt('Fortsett neste leksjon', 'Continue the next lesson'),
    detail: tt(
      `${lessonTitle || tt('Neste leksjon', 'Next lesson')} er det tydeligste steget akkurat nå.`,
      `${lessonTitle || 'Next lesson'} is the clearest step right now.`,
    ),
    ctaLabel: tt('Fortsett læring', 'Continue learning'),
    tone: 'primary',
  };
}

export function buildAcademyStudentWeekPlan(
  input: AcademyStudentWeekPlanInput,
): AcademyStudentWeekPlanItem[] {
  const nextAction = buildAcademyStudentNextAction(input);
  const items: AcademyStudentWeekPlanItem[] = [
    {
      id: 'week-primary',
      title: nextAction.title,
      detail: nextAction.detail,
      tone: nextAction.tone === 'attention' ? 'attention' : 'primary',
    },
  ];

  if (input.pendingAssignments && input.pendingAssignments > 0) {
    items.push({
      id: 'week-assignments',
      title: input.tt('Lukk åpne oppgaver', 'Close open assignments'),
      detail: input.tt(
        `${input.pendingAssignments} aktive oppgaver holder fremdriften oppe denne uken.`,
        `${input.pendingAssignments} active assignments keep your momentum up this week.`,
      ),
      tone: input.dueSoonAssignments ? 'attention' : 'support',
    });
  } else if (toCount(input.resourceCount) > 0) {
    items.push({
      id: 'week-resources',
      title: input.tt('Bruk læringsressursene', 'Use the learning resources'),
      detail: input.tt(
        `${input.resourceCount} ressurser gir deg støtte før neste modul.`,
        `${input.resourceCount} resources support you before the next module.`,
      ),
      tone: 'support',
    });
  }

  if (toCount(input.notesToReview) > 0) {
    items.push({
      id: 'week-review',
      title: input.tt('Repeter egne notater', 'Revisit your notes'),
      detail: input.tt(
        `${input.notesToReview} notater og bokmerker kan brukes som mini-repetisjon.`,
        `${input.notesToReview} notes and bookmarks can work as a mini review.`,
      ),
      tone: 'support',
    });
  }

  if (toCount(input.feedbackCount) > 0) {
    items.push({
      id: 'week-feedback',
      title: input.tt('Følg opp feedback', 'Follow up on feedback'),
      detail: input.tt(
        'Bruk tilbakemeldingene til å justere leveransen eller neste opptak.',
        'Use the feedback to improve your submission or your next recording.',
      ),
      tone: 'attention',
    });
  } else if (input.approvedBy) {
    items.push({
      id: 'week-support',
      title: input.tt('Hold kontakt med instruktør', 'Stay in touch with your instructor'),
      detail: input.tt(
        `Tilgangen din er allerede godkjent av ${input.approvedBy}.`,
        `Your access is already approved by ${input.approvedBy}.`,
      ),
      tone: 'celebrate',
    });
  }

  return items.slice(0, 4);
}

export function buildAcademyStudentSupportCard(
  input: AcademyStudentSupportCardInput,
): AcademyStudentSupportCard {
  const { tt, access, instructorName, locale = 'nb-NO' } = input;
  const approvedAtLabel = formatDateLabel(access?.approvedAt, locale);
  const approver = access?.approvedBy || instructorName || null;

  if (approver && access?.isActive) {
    return {
      eyebrow: tt('Tilgang aktiv', 'Access active'),
      title: tt(`Godkjent av ${approver}`, `Approved by ${approver}`),
      detail: tt(
        'Du er inne i studentflyten og kan fortsette direkte til kurs, oppgaver og ressurser.',
        'You are in the learner flow and can continue directly to lessons, assignments, and resources.',
      ),
      meta:
        approvedAtLabel && access?.approvedByRoleLabel
          ? `${approvedAtLabel} · ${access.approvedByRoleLabel}`
          : approvedAtLabel || access?.approvedByRoleLabel || null,
      tone: 'success',
    };
  }

  if (instructorName) {
    return {
      eyebrow: tt('Instruktørkontakt', 'Instructor contact'),
      title: instructorName,
      detail: tt(
        'Bruk meldinger når du trenger hjelp, avklaring eller vil få rask feedback på neste steg.',
        'Use messages when you need help, clarity, or quick feedback on your next step.',
      ),
      meta: null,
      tone: 'support',
    };
  }

  return {
    eyebrow: tt('Academy support', 'Academy support'),
    title: tt('Trenger du hjelp?', 'Need help?'),
    detail: tt(
      'Åpne meldinger for å få støtte med tilgang, leksjoner eller oppgaver.',
      'Open messages to get support with access, lessons, or assignments.',
    ),
    meta: null,
    tone: 'support',
  };
}

export function describeAcademyStudentAssignmentStatus(
  status: string,
  tt: AcademyTranslateFn,
): AcademyStudentAssignmentStatusMeta {
  switch (String(status || '').toLowerCase()) {
    case 'in_review':
      return {
        label: tt('Innsendt', 'Submitted'),
        detail: tt(
          'Leveringen er hos instruktør for gjennomgang.',
          'Your submission is with the instructor for review.',
        ),
        chipBg: 'rgba(120,187,255,0.14)',
        chipColor: '#d8ecff',
      };
    case 'completed':
      return {
        label: tt('Godkjent', 'Approved'),
        detail: tt(
          'Denne oppgaven er godkjent og teller som fullført.',
          'This assignment is approved and counts as completed.',
        ),
        chipBg: 'rgba(154,210,123,0.16)',
        chipColor: '#b7efc7',
      };
    case 'overdue':
      return {
        label: tt('Trenger handling', 'Needs action'),
        detail: tt(
          'Oppgaven har passert frist og bør prioriteres nå.',
          'This assignment has passed its due date and should be prioritized now.',
        ),
        chipBg: 'rgba(226,117,74,0.18)',
        chipColor: '#ffc8b0',
      };
    case 'draft':
      return {
        label: tt('Ikke publisert', 'Not published'),
        detail: tt(
          'Denne oppgaven er ikke klar for studentvisning ennå.',
          'This assignment is not ready for the learner view yet.',
        ),
        chipBg: 'rgba(255,255,255,0.08)',
        chipColor: '#edf0f7',
      };
    default:
      return {
        label: tt('Pågår', 'In progress'),
        detail: tt(
          'Arbeid deg gjennom oppgaven og forbered levering.',
          'Work through the assignment and prepare your submission.',
        ),
        chipBg: 'rgba(248,179,33,0.16)',
        chipColor: '#f8d56f',
      };
  }
}

export function describeAcademyStudentResourceContext(
  input: AcademyStudentResourceContextInput,
): AcademyStudentResourceContextMeta {
  const tagText = Array.isArray(input.tags)
    ? input.tags.join(' ').toLowerCase()
    : '';
  const normalizedType = String(input.type || '').trim().toLowerCase();
  const normalizedSource = String(input.source || '').trim().toLowerCase();
  const normalizedLessonId = String(input.lessonId || '').trim();
  const currentLessonId = String(input.currentLessonId || '').trim();
  const activeAssignmentLessonId = String(input.activeAssignmentLessonId || '').trim();

  if (
    (normalizedLessonId && currentLessonId && normalizedLessonId === currentLessonId) ||
    normalizedSource === 'lesson'
  ) {
    return {
      label: input.tt('For denne leksjonen', 'For this lesson'),
      detail: input.tt(
        'Åpne denne mens du jobber med det du ser i playeren nå.',
        'Open this while working through what you are watching right now.',
      ),
      chipBg: 'rgba(248,179,33,0.16)',
      chipColor: '#f8d56f',
    };
  }

  if (
    (normalizedLessonId && activeAssignmentLessonId && normalizedLessonId === activeAssignmentLessonId) ||
    /assignment|oppgave|brief|worksheet|template|checklist/.test(tagText)
  ) {
    return {
      label: input.tt('Bruk før oppgaven', 'Use before the assignment'),
      detail: input.tt(
        'Denne ressursen hjelper deg å levere en sterkere oppgave.',
        'This resource helps you produce a stronger assignment.',
      ),
      chipBg: 'rgba(120,187,255,0.14)',
      chipColor: '#d8ecff',
    };
  }

  if (input.isFavorite) {
    return {
      label: input.tt('Lagret av deg', 'Saved by you'),
      detail: input.tt(
        'Dette er en ressurs du allerede har markert som nyttig.',
        'This is a resource you have already marked as useful.',
      ),
      chipBg: 'rgba(255,255,255,0.08)',
      chipColor: '#edf0f7',
    };
  }

  if (normalizedType === 'document' || normalizedType === 'link') {
    return {
      label: input.tt('Referanse', 'Reference'),
      detail: input.tt(
        'Bra å ha åpent når du skal repetere eller dobbeltsjekke detaljer.',
        'Helpful to keep open when revising or double-checking details.',
      ),
      chipBg: 'rgba(255,255,255,0.08)',
      chipColor: '#edf0f7',
    };
  }

  return {
    label: input.tt('Gå dypere', 'Go deeper'),
    detail: input.tt(
      'Bruk denne etter leksjonen hvis du vil forstå stoffet enda bedre.',
      'Use this after the lesson if you want a deeper understanding.',
    ),
    chipBg: 'rgba(154,210,123,0.16)',
    chipColor: '#b7efc7',
  };
}
