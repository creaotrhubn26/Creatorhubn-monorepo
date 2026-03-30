export type ClientPortalWorkspace = 'brief' | 'materials' | 'brand' | 'accounts' | 'delivery' | 'meetings';
export type ClientPortalTab = 'media' | 'reviews' | 'export';

export interface ClientPortalWorkspaceFocus {
  workspace?: ClientPortalWorkspace;
  sectionId?: string;
  pageId?: string;
  artifactId?: string;
}

export interface ClientPortalIntent {
  projectId: string;
  workspace: ClientPortalWorkspace;
  tab: ClientPortalTab;
  sectionId?: string;
  pageId?: string;
  reviewId?: string;
  artifactId?: string;
}

const CLIENT_PORTAL_WORKSPACES: readonly ClientPortalWorkspace[] = ['brief', 'materials', 'brand', 'accounts', 'delivery', 'meetings'];
const CLIENT_PORTAL_TABS: readonly ClientPortalTab[] = ['media', 'reviews', 'export'];

const hasText = (value: string | null | undefined): value is string => (
  typeof value === 'string' && value.trim().length > 0
);

const isClientPortalWorkspace = (value: string | null): value is ClientPortalWorkspace => (
  hasText(value) && CLIENT_PORTAL_WORKSPACES.includes(value as ClientPortalWorkspace)
);

const isClientPortalTab = (value: string | null): value is ClientPortalTab => (
  hasText(value) && CLIENT_PORTAL_TABS.includes(value as ClientPortalTab)
);

const getClientPortalBaseUrl = (): URL | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return new URL(window.location.pathname || '/casting.html', window.location.origin);
  } catch {
    return null;
  }
};

export const parseClientPortalIntentFromWindow = (): ClientPortalIntent | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const portal = params.get('portal');
    const projectId = params.get('projectId');
    if ((portal || '').trim().toLowerCase() !== 'client' || !hasText(projectId)) {
      return null;
    }

    const requestedTab = params.get('tab');
    const requestedWorkspace = params.get('workspace');

    return {
      projectId: projectId.trim(),
      tab: isClientPortalTab(requestedTab) ? requestedTab : 'media',
      workspace: isClientPortalWorkspace(requestedWorkspace) ? requestedWorkspace : 'brief',
      sectionId: hasText(params.get('section')) ? params.get('section')!.trim() : undefined,
      pageId: hasText(params.get('page')) ? params.get('page')!.trim() : undefined,
      reviewId: hasText(params.get('reviewId')) ? params.get('reviewId')!.trim() : undefined,
      artifactId: hasText(params.get('artifactId')) ? params.get('artifactId')!.trim() : undefined,
    };
  } catch {
    return null;
  }
};

export const buildClientPortalUrl = (
  projectId: string,
  options?: {
    workspace?: ClientPortalWorkspace;
    tab?: ClientPortalTab;
    sectionId?: string;
    pageId?: string;
    reviewId?: string;
    artifactId?: string;
  },
): string => {
  const baseUrl = getClientPortalBaseUrl();
  if (!baseUrl) {
    return '';
  }

  const url = new URL(baseUrl.toString());
  url.searchParams.set('portal', 'client');
  url.searchParams.set('projectId', projectId);
  url.searchParams.set('tab', options?.tab ?? 'media');
  url.searchParams.set('workspace', options?.workspace ?? 'brief');
  if (hasText(options?.sectionId)) {
    url.searchParams.set('section', options.sectionId.trim());
  } else {
    url.searchParams.delete('section');
  }
  if (hasText(options?.pageId)) {
    url.searchParams.set('page', options.pageId.trim());
  } else {
    url.searchParams.delete('page');
  }
  if (hasText(options?.reviewId)) {
    url.searchParams.set('reviewId', options.reviewId.trim());
  } else {
    url.searchParams.delete('reviewId');
  }
  if (hasText(options?.artifactId)) {
    url.searchParams.set('artifactId', options.artifactId.trim());
  } else {
    url.searchParams.delete('artifactId');
  }
  return url.toString();
};
