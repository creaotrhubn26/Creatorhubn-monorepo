import type { RoleWorkflowStatus } from './roleWorkflow';

export interface RoleTemplate {
  id: string;
  name: string;
  description?: string;
  roleType?: string;
  requirements: Record<string, unknown>;
  tags: string[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectRoleOverrides {
  name?: string;
  description?: string;
  requirements?: Record<string, unknown>;
  castingWindow?: {
    start?: string | null;
    end?: string | null;
  };
}

export interface RoleAuditEntry {
  id: string;
  actor: string;
  action:
    | 'TEMPLATE_IMPORTED'
    | 'OVERRIDES_UPDATED'
    | 'WORKFLOW_CHANGED'
    | 'ARCHIVED'
    | 'UNARCHIVED';
  at: string;
  note?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ProjectRoleLink {
  id: string;
  projectId: string;
  roleTemplateId: string;
  workflowStatus: RoleWorkflowStatus;
  overrides: ProjectRoleOverrides;
  audit: RoleAuditEntry[];
}

export function createTemplateImportAuditEntry(input: {
  templateId: string;
  actor: string;
  note?: string;
}): RoleAuditEntry {
  return {
    id: `audit-${Date.now()}`,
    actor: input.actor,
    action: 'TEMPLATE_IMPORTED',
    at: new Date().toISOString(),
    note: input.note || null,
    metadata: {
      templateId: input.templateId,
    },
  };
}
