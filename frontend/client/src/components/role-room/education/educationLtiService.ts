/**
 * educationLtiService.ts — LTI-launch-kontekst + AGS grade-passback.
 *
 * Når faglærer launcher Role Room fra LMS-en (Canvas/saLTIre) lander de med
 * ?lti_launch=<id> i URL-en. Vi persisterer den (localStorage) for økta, slik
 * at «Send til LMS-karakterbok» i vurderings-flaten kan pushe karakteren rett
 * inn i LMS-karakterboka via AGS (Assignment and Grade Services).
 */

import authSessionService from '../services/authSessionService';

const STORAGE_KEY = 'rr_lti_launch';

const authHeaders = (): Record<string, string> =>
  authSessionService.getAuthHeadersSync() as Record<string, string>;

export const educationLtiService = {
  /**
   * Fanger ?lti_launch=<id> fra URL-en (om til stede) → persisterer i
   * localStorage og fjerner param fra URL-en. Returnerer aktiv launch-id
   * (fra URL eller tidligere lagret) eller null.
   */
  captureLaunchContext(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('lti_launch');
      if (fromUrl) {
        localStorage.setItem(STORAGE_KEY, fromUrl);
        params.delete('lti_launch');
        const clean = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', clean);
        return fromUrl;
      }
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },

  getLaunchId(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* no-op */
    }
  },

  /**
   * Pusher en karakter til LMS-karakterboka via AGS. `grade` = fri tekst
   * (mappes til tallscore på backend); `scoreMaximum` kan overstyre maks.
   * `ltiUserSub`/`studentEmail` velger hvilken students rad (NRPS-roster) —
   * uten dem går karakteren til launch-brukeren. Kaster med backendens melding.
   */
  async pushGrade(
    launchId: string,
    input: { grade: string; comment?: string; label?: string; scoreMaximum?: number; ltiUserSub?: string; studentEmail?: string },
  ): Promise<void> {
    const res = await fetch(`/api/role-room/lti/launches/${encodeURIComponent(launchId)}/grade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      throw new Error(body.message || body.error || `HTTP ${res.status}`);
    }
  },

  /** Henter LMS-klasse-rosteret (NRPS) for en launch — hver students LMS-sub + navn/e-post/rolle. */
  async getRoster(launchId: string): Promise<LtiRosterMember[]> {
    const res = await fetch(`/api/role-room/lti/launches/${encodeURIComponent(launchId)}/roster`, {
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { members?: LtiRosterMember[] };
    return data.members ?? [];
  },
};

export interface LtiRosterMember {
  sub: string;
  name: string | null;
  email: string | null;
  roles: string[];
  status: string;
}

export default educationLtiService;
