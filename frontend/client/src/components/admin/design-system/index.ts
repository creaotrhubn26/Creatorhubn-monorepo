/**
 * Admin design-system — felles tokens + komponenter for admin-dashbordet.
 *
 *   import { AdminCard, AdminButton, StatusChip, adminTokens } from "@/components/admin/design-system";
 *
 * Mål: samle de 5588+ hardkodede fargene, 3 konkurrerende brand-oransjene og
 * de divergerende kort-/knapp-/tabell-/tilstand-mønstrene til én kilde. Ta i
 * bruk gradvis — hvert panel som migreres fjerner titalls inkonsistenser.
 */
export { adminTokens } from "./adminTokens";
export type { AdminTokens } from "./adminTokens";

export { AdminCard } from "./AdminCard";
export type { AdminCardProps } from "./AdminCard";

export { AdminButton } from "./AdminButton";
export type { AdminButtonProps, AdminButtonTone } from "./AdminButton";

export { StatusChip } from "./StatusChip";
export type { StatusChipProps, StatusTone } from "./StatusChip";

export { AdminLoading, AdminEmpty, AdminError } from "./AdminStates";

export { AdminTableContainer, useIsMobile } from "./AdminTableContainer";
export type { AdminTableContainerProps } from "./AdminTableContainer";
