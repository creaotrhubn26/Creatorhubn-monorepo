/**
 * Role Room primitives — kanoniske layout-bygge-blokker.
 *
 * Bruk istedenfor å rebuilde card/stat-pill/header per panel. Hindrer
 * drift over tid (samme komponent ser ikke forskjellig ut i 3 paneler).
 *
 * Bruk:
 *   import { RoleStatPillRow, RolePanelHeader, RoleCard } from '../primitives';
 */

export { RoleStatPill, RoleStatPillRow } from './RoleStatPill';
export type { RoleStatPillProps, RoleStatPillRowProps } from './RoleStatPill';
export { RolePanelHeader } from './RolePanelHeader';
export type { RolePanelHeaderProps } from './RolePanelHeader';
export { RoleCard } from './RoleCard';
export type { RoleCardProps } from './RoleCard';
