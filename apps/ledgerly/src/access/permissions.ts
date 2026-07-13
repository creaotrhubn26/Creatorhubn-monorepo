/**
 * Rollebasert tilgangskontroll. Minste privilegium:
 * en rolle har KUN eksplisitt tildelte rettigheter.
 * Matrisen dokumenteres i docs/permissions-matrix.md (generert fra denne filen).
 */
import { ForbiddenError } from '../shared/errors.js';

export const ROLES = [
  'owner',
  'admin',
  'general_manager',
  'accounting_manager',
  'accountant', // ekstern regnskapsfører
  'auditor_readonly',
  'attestant',
  'approver',
  'employee',
  'external_advisor',
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'org.manage',
  'members.manage',
  'documents.upload',
  'documents.view',
  'documents.approve',
  'journal.post',
  'journal.reverse',
  'period.lock',
  'reports.view',
  'vat.view',
  'vat.submit', // krever i tillegg eksplisitt signeringshandling
  'bank.reconcile',
  'integrations.manage',
  'audit.view',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: [
    'org.manage', 'members.manage', 'documents.upload', 'documents.view', 'documents.approve',
    'journal.post', 'journal.reverse', 'period.lock', 'reports.view', 'vat.view', 'vat.submit',
    'bank.reconcile', 'integrations.manage', 'audit.view',
  ],
  admin: [
    'org.manage', 'members.manage', 'documents.upload', 'documents.view', 'documents.approve',
    'journal.post', 'journal.reverse', 'period.lock', 'reports.view', 'vat.view',
    'bank.reconcile', 'integrations.manage', 'audit.view',
  ],
  general_manager: [
    'documents.upload', 'documents.view', 'documents.approve', 'reports.view', 'vat.view',
    'vat.submit', 'audit.view',
  ],
  accounting_manager: [
    'documents.upload', 'documents.view', 'documents.approve', 'journal.post', 'journal.reverse',
    'period.lock', 'reports.view', 'vat.view', 'vat.submit', 'bank.reconcile', 'audit.view',
  ],
  accountant: [
    'documents.upload', 'documents.view', 'documents.approve', 'journal.post', 'journal.reverse',
    'period.lock', 'reports.view', 'vat.view', 'vat.submit', 'bank.reconcile', 'audit.view',
  ],
  auditor_readonly: ['documents.view', 'reports.view', 'vat.view', 'audit.view'],
  attestant: ['documents.view', 'documents.approve'],
  approver: ['documents.view', 'documents.approve'],
  employee: ['documents.upload', 'documents.view'],
  external_advisor: ['documents.view', 'reports.view'],
};

export function hasPermission(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role as Role];
  return perms ? perms.includes(permission) : false;
}

export function requirePermission(role: string, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new ForbiddenError(`Rollen ${role} har ikke rettigheten ${permission}.`);
  }
}

export function rolePermissions(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
