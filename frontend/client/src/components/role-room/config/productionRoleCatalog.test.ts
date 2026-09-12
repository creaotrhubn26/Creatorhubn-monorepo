import { describe, expect, it } from 'vitest';
import {
  PRODUCTION_DEPARTMENTS,
  PRODUCTION_ROLES,
  PRODUCTION_WORKSPACE_DELIVERY_ORDER,
  getCalendarDepartmentForProductionRole,
  getProductionRoleDefinition,
  getProductionWorkspaceForRole,
  getTechnicalSubgroupForProductionRole,
  resolveProductionRoleId,
} from './productionRoleCatalog';

describe('productionRoleCatalog', () => {
  it('keeps role IDs unique and every reporting line valid', () => {
    const roleIds = PRODUCTION_ROLES.map((role) => role.id);
    const departmentIds = new Set(PRODUCTION_DEPARTMENTS.map((department) => department.id));

    expect(new Set(roleIds).size).toBe(roleIds.length);
    for (const role of PRODUCTION_ROLES) {
      expect(departmentIds.has(role.departmentId)).toBe(true);
      if ('reportsTo' in role && role.reportsTo) {
        expect(roleIds).toContain(role.reportsTo);
      }
    }
  });

  it('normalizes familiar Norwegian and international film-role names', () => {
    expect(resolveProductionRoleId('DoP')).toBe('cinematographer');
    expect(resolveProductionRoleId('Director of Photography')).toBe('cinematographer');
    expect(resolveProductionRoleId('1st AC')).toBe('first_assistant_camera');
    expect(resolveProductionRoleId('production_assistant')).toBe('office_production_assistant');
    expect(resolveProductionRoleId('sound_engineer')).toBe('production_sound_mixer');
    expect(resolveProductionRoleId('unknown-role')).toBeNull();
  });

  it('maps persisted crew roles to the existing calendar departments', () => {
    expect(getCalendarDepartmentForProductionRole('director')).toBe('regi');
    expect(getCalendarDepartmentForProductionRole('cinematographer')).toBe('kamera');
    expect(getCalendarDepartmentForProductionRole('gaffer')).toBe('lys');
    expect(getCalendarDepartmentForProductionRole('script_supervisor')).toBe('regi');
    expect(getCalendarDepartmentForProductionRole('wardrobe')).toBe('kostyme');
    expect(getCalendarDepartmentForProductionRole('unmapped')).toBe('personal');
  });

  it('provides a shared technical grouping and role workspace', () => {
    expect(getTechnicalSubgroupForProductionRole('DoP')).toBe('camera');
    expect(getTechnicalSubgroupForProductionRole('key_grip')).toBe('lighting');
    expect(getTechnicalSubgroupForProductionRole('sound_designer')).toBe('sound');
    expect(getTechnicalSubgroupForProductionRole('colorist')).toBe('post');
    expect(getTechnicalSubgroupForProductionRole('director')).toBeNull();

    expect(getProductionWorkspaceForRole('director')).toBe('director');
    expect(getProductionWorkspaceForRole('director_of_photography')).toBe('cinematography');
    expect(getProductionWorkspaceForRole('production_coordinator')).toBe('production_coordination');
    expect(getProductionWorkspaceForRole('script_supervisor')).toBe('continuity');
    expect(getProductionRoleDefinition('DoP')?.reportsTo).toBe('director');
    expect(PRODUCTION_WORKSPACE_DELIVERY_ORDER.slice(0, 2)).toEqual([
      'director',
      'cinematography',
    ]);
  });
});
