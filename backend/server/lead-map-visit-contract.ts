import { createHash } from "node:crypto";

export interface LeadVisitRequestPayload {
  visitType?: string;
  contactPerson?: string;
  conversationSummary?: string;
  objectionReason?: string;
  notes?: string;
  newStatus?: string;
  nextAction?: string;
  nextFollowUpAt?: string;
  visitLatitude?: number;
  visitLongitude?: number;
  visitDatetime?: string;
  activityKind?: string;
  outcome?: string;
  durationMinutes?: number;
}

/**
 * Hashes the accepted mutation fields in a fixed order. Missing optional fields
 * are represented as null, so JSON key order and omitted-vs-undefined fields
 * cannot create different hashes for the same logical request.
 */
export function hashLeadVisitRequest(
  leadId: string,
  payload: LeadVisitRequestPayload,
): string {
  const canonical = {
    schemaVersion: 1,
    leadId: leadId.trim().toLowerCase(),
    visitType: payload.visitType ?? null,
    contactPerson: payload.contactPerson ?? null,
    conversationSummary: payload.conversationSummary ?? null,
    objectionReason: payload.objectionReason ?? null,
    notes: payload.notes ?? null,
    newStatus: payload.newStatus ?? null,
    nextAction: payload.nextAction ?? null,
    nextFollowUpAt: payload.nextFollowUpAt ?? null,
    visitLatitude: payload.visitLatitude ?? null,
    visitLongitude: payload.visitLongitude ?? null,
    visitDatetime: payload.visitDatetime ?? null,
    activityKind: payload.activityKind ?? null,
    outcome: payload.outcome ?? null,
    durationMinutes: payload.durationMinutes ?? null,
  };
  return createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex");
}
