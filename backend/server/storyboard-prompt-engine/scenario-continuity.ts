import type { StoryboardScenarioSelection } from './scenario-packs.js';
import { storyboardScenarioSelectionSchema } from './scenario-packs.js';

export interface ScenarioContinuityIssue {
  code: string;
  severity: 'warning' | 'error';
  field: 'pack' | 'subdomain' | 'zone' | 'roles' | 'props' | 'states';
  message: string;
}

/**
 * Resolve scene defaults plus explicit shot overrides before Prompt Engine.
 * Empty arrays are intentional overrides; omitted arrays inherit the scene.
 */
export function inheritStoryboardScenarioSelection(
  scene: StoryboardScenarioSelection | null | undefined,
  shot: Partial<StoryboardScenarioSelection> | null | undefined,
): StoryboardScenarioSelection | null {
  if (!scene && !shot) return null;
  const merged = { ...(scene ?? {}), ...(shot ?? {}) };
  return storyboardScenarioSelectionSchema.parse(merged);
}

function sameMembers(left: string[], right: string[]): boolean {
  return left.length === right.length
    && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

/** Deterministic preflight; it never calls a model and therefore cannot drift. */
export function validateStoryboardScenarioContinuity(
  current: StoryboardScenarioSelection | null | undefined,
  neighbour: StoryboardScenarioSelection | null | undefined,
): ScenarioContinuityIssue[] {
  if (!current || !neighbour) return [];
  const a = storyboardScenarioSelectionSchema.parse(current);
  const b = storyboardScenarioSelectionSchema.parse(neighbour);
  const issues: ScenarioContinuityIssue[] = [];
  if (a.packId !== b.packId || a.packVersion !== b.packVersion) {
    issues.push({
      code: 'scenario-pack-changed', severity: 'error', field: 'pack',
      message: 'Scenario package or version changes between connected shots.',
    });
    return issues;
  }
  if (a.subdomainId !== b.subdomainId) {
    issues.push({
      code: 'scenario-subdomain-changed', severity: 'warning', field: 'subdomain',
      message: 'Scenario subdomain changes between connected shots.',
    });
  }
  if (a.zoneId !== b.zoneId) {
    issues.push({
      code: 'scenario-zone-changed', severity: 'warning', field: 'zone',
      message: 'Zone changes; verify screen direction and location geography.',
    });
  }
  if (!sameMembers(a.roleIds, b.roleIds)) {
    issues.push({
      code: 'scenario-roles-changed', severity: 'warning', field: 'roles',
      message: 'Selected scenario roles differ from the adjacent shot.',
    });
  }
  if (!sameMembers(a.propTypeIds, b.propTypeIds)) {
    issues.push({
      code: 'scenario-props-changed', severity: 'warning', field: 'props',
      message: 'Selected scenario props differ from the adjacent shot.',
    });
  }
  if (!sameMembers(a.stateIds, b.stateIds)) {
    issues.push({
      code: 'scenario-states-changed', severity: 'warning', field: 'states',
      message: 'Selected scenario state differs from the adjacent shot.',
    });
  }
  return issues;
}
