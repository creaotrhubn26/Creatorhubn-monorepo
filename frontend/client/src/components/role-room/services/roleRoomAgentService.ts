import settingsService from './settingsService';
import { authSessionService } from './authSessionService';

const AGENT_SNAPSHOT_NAMESPACE = 'role-room-agent-snapshot';

export interface RoleRoomAgentAccess {
  success: boolean;
  featureId: string;
  enabled: boolean;
  isAdmin: boolean;
  allowed: boolean;
  stage: 'admin_test' | string;
  audience?: string;
  provider?: 'openai' | string;
  providerConfigured?: boolean;
  defaultModel?: string;
}

export interface RoleRoomAgentBrandColor {
  label: string;
  hex: string;
  usage?: string;
}

export interface RoleRoomAgentProducerBootstrapResult {
  generatedAt: string;
  provider: 'openai' | 'fallback';
  model: string;
  companyProfile: {
    companyName: string;
    websiteUrl?: string | null;
    organizationNumber?: string | null;
    summary: string;
    offerings: string[];
    targetAudience: string[];
    toneAndBrandSignals: string[];
    industry: string;
    subIndustry: string;
    businessModel: string;
    contentCategory: string;
    productionApproach: string;
    probableLocationAddress?: string | null;
    logoUrl?: string | null;
  };
  intakeDraft: {
    projectGoal: string;
    deliverables: string;
    targetAudience: string;
    keyMessage: string;
    timingConstraints: string;
    brandNotes: string;
    materialOverview: string;
    referenceLinks: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    additionalNotes: string;
  };
  planningDraft: {
    activationPlan: {
      direction?: string;
      idea?: string;
      activation?: string;
      targetAudience?: string;
      businessGoal?: string;
      coreMessage?: string;
      successSignals?: string[];
    };
    contentLogic: {
      objective?: string;
      audience?: string;
      hook?: string;
      coreMessage?: string;
      industry?: string;
      subIndustry?: string;
      businessModel?: string;
      contentCategory?: string;
      productionApproach?: string;
      proofPoints?: string[];
      callToAction?: string;
      distributionPlan?: string;
      successSignals?: string[];
    };
    brandGuide: {
      logoUrl?: string | null;
      toneOfVoice?: string;
      visualStyle?: string;
      fonts: string[];
      dos: string[];
      donts: string[];
      colors: RoleRoomAgentBrandColor[];
    };
  };
  storyLogicDraft: Record<string, unknown>;
  nextRecommendedSteps: string[];
}

type RoleRoomAgentGenerateResponse = {
  success: boolean;
  result?: RoleRoomAgentProducerBootstrapResult;
  error?: string;
};

type RoleRoomAgentGenerateInput = {
  projectId: string;
  projectName?: string;
  websiteUrl?: string | null;
  organizationNumber?: string | null;
  companyName?: string | null;
  extraContext?: string | null;
};

const readRoleRoomAgentHeaders = (): Record<string, string> => {
  const headers = authSessionService.getAuthHeadersSync();
  const session = authSessionService.getSessionSync();
  const adminUser = session.adminUser;

  if (Object.keys(headers).length === 0 && typeof window !== 'undefined') {
    const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (isLocalHost) {
      headers.Authorization = 'Bearer dev-admin-local-session';
    }
  }

  if (typeof session.currentUserId === 'string' && session.currentUserId.trim().length > 0) {
    headers['x-role-room-user-id'] = session.currentUserId.trim();
  }
  if (typeof adminUser?.email === 'string' && adminUser.email.trim().length > 0) {
    headers['x-role-room-email'] = adminUser.email.trim();
  }
  if (typeof adminUser?.role === 'string' && adminUser.role.trim().length > 0) {
    headers['x-role-room-role'] = adminUser.role.trim();
  }
  if (typeof adminUser?.loginAs === 'string' && adminUser.loginAs.trim().length > 0) {
    headers['x-role-room-login-as'] = adminUser.loginAs.trim();
  }
  if (typeof adminUser?.requestedRole === 'string' && adminUser.requestedRole.trim().length > 0) {
    headers['x-role-room-requested-role'] = adminUser.requestedRole.trim();
  }

  return headers;
};

const normalizeStoryLogicDraft = (value: Record<string, unknown>): Record<string, unknown> => ({
  ...value,
  locks:
    value.locks && typeof value.locks === 'object' && !Array.isArray(value.locks)
      ? value.locks
      : { concept: false, logline: false, theme: false },
  versions: Array.isArray(value.versions) ? value.versions : [],
});

export const roleRoomAgentService = {
  async getAccess(): Promise<RoleRoomAgentAccess> {
    const response = await fetch('/api/role-room/agent/access', {
      headers: readRoleRoomAgentHeaders(),
    });

    if (!response.ok) {
      throw new Error('Kunne ikke hente tilgang for The Role Room Agent.');
    }

    return response.json() as Promise<RoleRoomAgentAccess>;
  },

  async generateProducerBootstrap(
    input: RoleRoomAgentGenerateInput,
  ): Promise<RoleRoomAgentProducerBootstrapResult> {
    const response = await fetch('/api/role-room/agent/producer-bootstrap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...readRoleRoomAgentHeaders(),
      },
      body: JSON.stringify(input),
    });

    const payload = await response.json().catch(() => null) as RoleRoomAgentGenerateResponse | null;

    if (!response.ok || !payload?.success || !payload.result) {
      throw new Error(payload?.error || 'Kunne ikke generere forslag fra The Role Room Agent.');
    }

    const normalizedResult: RoleRoomAgentProducerBootstrapResult = {
      ...payload.result,
      storyLogicDraft: normalizeStoryLogicDraft(payload.result.storyLogicDraft ?? {}),
    };

    await this.saveSnapshot(input.projectId, normalizedResult);
    return normalizedResult;
  },

  async getSnapshot(projectId: string): Promise<RoleRoomAgentProducerBootstrapResult | null> {
    return settingsService.getSetting<RoleRoomAgentProducerBootstrapResult>(AGENT_SNAPSHOT_NAMESPACE, {
      projectId,
    });
  },

  async saveSnapshot(
    projectId: string,
    result: RoleRoomAgentProducerBootstrapResult,
  ): Promise<RoleRoomAgentProducerBootstrapResult> {
    return settingsService.setSetting<RoleRoomAgentProducerBootstrapResult>(
      AGENT_SNAPSHOT_NAMESPACE,
      result,
      { projectId },
    );
  },
};

export default roleRoomAgentService;
