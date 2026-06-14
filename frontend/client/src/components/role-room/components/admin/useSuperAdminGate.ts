// useSuperAdminGate.ts
// ─────────────────────────────────────────────────────────────────────────
// Avgjør om innlogget bruker er Super Admin (daniel@creatorhubn.com).
//
// Hvorfor egen hook framfor å lese useAuth()-resultatet direkte?
//
// 1) AuthContext er ikke alltid garantert montert (Role Room-shell mounter
//    flere top-level overlays utenfor det skjermtreet som forbruker auth).
// 2) Email-feltet i `creatorhub_auth_user`-localStorage kan være tomt selv
//    etter en gyldig session (Google-OAuth-redirect mistet email i 2026-06
//    — derav PR #517 fallback-mønsteret som denne hooken speiler).
// 3) Vi vil ALDRI rendre Super Admin-overlayen for noen andre enn Daniel,
//    så vi bekrefter via /api/auth/user bare hvis localStorage er tomt.
//
// Bruk:
//   const { isSuperAdmin, email, ready } = useSuperAdminGate();
//
// `ready` blir true når både local- og server-sjekk er ferdige.
// Komponenter som vil rendre noe synlig bør vente på `ready === true`
// for å unngå flash-of-not-admin-content.
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';

const SUPER_ADMIN_EMAIL = 'daniel@creatorhubn.com';
const AUTH_USER_KEY = 'creatorhub_auth_user';

function readLocalEmail(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: unknown } | null;
    if (!parsed || typeof parsed !== 'object') return null;
    const email = typeof parsed.email === 'string' ? parsed.email.trim().toLowerCase() : '';
    return email || null;
  } catch {
    return null;
  }
}

export interface SuperAdminGateResult {
  /** True kun hvis email == daniel@creatorhubn.com (uavhengig av kilde). */
  isSuperAdmin: boolean;
  /** Normalisert (lowercase) email — null hvis ingen session funnet. */
  email: string | null;
  /** True når begge sjekker (localStorage + server-fallback) er ferdige. */
  ready: boolean;
}

export function useSuperAdminGate(): SuperAdminGateResult {
  const [localEmail] = useState<string | null>(() => readLocalEmail());
  const [serverEmail, setServerEmail] = useState<string | null>(null);
  const [ready, setReady] = useState<boolean>(() => readLocalEmail() !== null);

  useEffect(() => {
    // Hvis localStorage allerede ga oss en email, trenger vi ikke server-sjekk.
    if (localEmail) {
      setReady(true);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch('/api/auth/user', {
          credentials: 'include',
          signal: controller.signal,
        });
        if (cancelled) return;
        if (response.ok) {
          const body = await response.json().catch(() => null) as
            | { user?: { email?: string }; email?: string }
            | null;
          const email =
            typeof body?.user?.email === 'string'
              ? body.user.email.trim().toLowerCase()
              : typeof body?.email === 'string'
                ? body.email.trim().toLowerCase()
                : null;
          if (!cancelled) {
            setServerEmail(email || null);
          }
        }
      } catch {
        // Ignore — Daniel kan fortsatt navigere via direkte URL.
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [localEmail]);

  const email = localEmail || serverEmail;
  const isSuperAdmin = email === SUPER_ADMIN_EMAIL;

  return { isSuperAdmin, email, ready };
}

/** Synchronous-ish sjekk for visibility-gating UTEN React-state.
 * Bruk i kontekster der hooks ikke er trygt (event-handlers, IIFE).
 * NB: Returnerer false hvis localStorage er tom — bruk hook for fulltest. */
export function isSuperAdminSync(): boolean {
  return readLocalEmail() === SUPER_ADMIN_EMAIL;
}

export const SUPER_ADMIN_OWNER_EMAIL = SUPER_ADMIN_EMAIL;
