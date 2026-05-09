/**
 * _shared.ts
 *
 * Felles typer og pure helpers for ekstrakterte route-moduler under
 * Admin Room (og senere flere). Etabler ÉN strategi før første ekstrakt:
 *
 *   - Stateful helpers (pool, getActiveSessionFromRequest, requireAdminRoomAccess,
 *     logAdminActivity) blir værende i index.ts og passes via deps-objekt.
 *   - Pure helpers (asString, asNumberOrNull, asJsonbArray, asJsonbObject) bor her
 *     og importeres direkte både i index.ts og i route-moduler.
 *   - Felles dep-shape og session-type defineres her så hver route-modul slipper
 *     å redeklarere de samme interfacene.
 *
 * Når flere route-grupper enn admin-room ekstraktes (role-room, showcase, ...) kan
 * denne filen utvides med flere dep-interfaces uten å bryte eksisterende moduler.
 */

import type express from "express";
import type { Pool } from "pg";

export interface AdminSession {
  userId: string;
  email: string;
}

export interface LogAdminActivityArgs {
  userId: string;
  entityType: string;
  entityId?: string | null;
  action: string;
  summary?: string;
  details?: Record<string, unknown>;
}

export interface AdminRoomRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSessionFromRequest: (req: express.Request) => AdminSession | null;
  requireAdminRoomAccess: (
    req: express.Request,
    res: express.Response,
  ) => AdminSession | null;
  logAdminActivity: (args: LogAdminActivityArgs) => Promise<void>;
}

// ── Pure body-parsing helpers ─────────────────────────────────────────
// Brukes på tvers av admin-room-skrivende endpoints (funding, investors,
// partners, decks, business-plan). Definert her slik at hver ekstraktert
// modul slipper å redeklarere — og slik at index.ts ikke fortsetter å
// bære duplikerte versjoner.

export function asJsonbArray(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value);
  return "[]";
}

export function asJsonbObject(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) return JSON.stringify(value);
  return "{}";
}

export function asString(value: unknown, fallback: string | null = null): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return fallback;
}

export function asNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// ── Generelle parser-helpers ──────────────────────────────────────────
// Brukt på tvers av hele backend-en (1949+ kall i index.ts og kommende
// route-moduler). Pure funksjoner, ingen lukking over module-state.

export function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

export function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/,+$/u, "");
  return trimmed.length ? trimmed : null;
}

export function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(
      (entry): entry is string =>
        typeof entry === "string" && entry.trim().length > 0,
    );
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

export function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function readOptionalIsoDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  }
  return null;
}

export function normalizeJsonObjectField(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}
