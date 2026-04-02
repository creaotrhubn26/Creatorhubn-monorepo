import { getRoleRoomCanonicalPath, normalizeRoleRoomStandalonePath } from './runtime';

export type TalentPortalSection = 'overview' | 'auditions' | 'selftapes' | 'activity' | 'profile';

export interface TalentPortalIntent {
  projectId?: string;
  candidateId?: string;
  inviteToken?: string;
  section: TalentPortalSection;
}

const hasText = (value: string | null | undefined): value is string => (
  typeof value === 'string' && value.trim().length > 0
);

const TALENT_PORTAL_SECTIONS: readonly TalentPortalSection[] = [
  'overview',
  'auditions',
  'selftapes',
  'activity',
  'profile',
];

const isTalentPortalSection = (value: string | null): value is TalentPortalSection => (
  hasText(value) && TALENT_PORTAL_SECTIONS.includes(value as TalentPortalSection)
);

const getTalentPortalBaseUrl = (): URL | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const pathname = normalizeRoleRoomStandalonePath(
      window.location.pathname || getRoleRoomCanonicalPath(window.location),
      window.location,
    );
    return new URL(pathname, window.location.origin);
  } catch {
    return null;
  }
};

export const parseTalentPortalIntentFromWindow = (): TalentPortalIntent | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    if ((params.get('portal') || '').trim().toLowerCase() !== 'talent') {
      return null;
    }

    return {
      projectId: hasText(params.get('projectId')) ? params.get('projectId')!.trim() : undefined,
      candidateId: hasText(params.get('candidateId')) ? params.get('candidateId')!.trim() : undefined,
      inviteToken: hasText(params.get('inviteToken')) ? params.get('inviteToken')!.trim() : undefined,
      section: isTalentPortalSection(params.get('section')) ? params.get('section')! : 'overview',
    };
  } catch {
    return null;
  }
};

export const buildTalentPortalUrl = (options?: {
  projectId?: string;
  candidateId?: string;
  inviteToken?: string;
  section?: TalentPortalSection;
}): string => {
  const baseUrl = getTalentPortalBaseUrl();
  if (!baseUrl) {
    return '';
  }

  const url = new URL(baseUrl.toString());
  url.searchParams.set('portal', 'talent');
  if (hasText(options?.projectId)) {
    url.searchParams.set('projectId', options.projectId.trim());
  } else {
    url.searchParams.delete('projectId');
  }
  if (hasText(options?.candidateId)) {
    url.searchParams.set('candidateId', options.candidateId.trim());
  } else {
    url.searchParams.delete('candidateId');
  }
  if (hasText(options?.inviteToken)) {
    url.searchParams.set('inviteToken', options.inviteToken.trim());
  } else {
    url.searchParams.delete('inviteToken');
  }
  url.searchParams.set('section', options?.section ?? 'overview');
  return url.toString();
};
