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

  /** True hvis launchen er en Deep Linking-forespørsel (?deeplink=1). */
  isDeepLinkMode(): boolean {
    if (typeof window === 'undefined') return false;
    try { return new URLSearchParams(window.location.search).get('deeplink') === '1'; } catch { return false; }
  },

  /** Canvas-kontekst fra launchen: emne, emnekode, semester, institusjon. */
  async getContext(launchId: string): Promise<LtiContext> {
    const res = await fetch(`/api/role-room/lti/launches/${encodeURIComponent(launchId)}/context`, {
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as LtiContext;
  },

  /**
   * Deep Linking-respons: sender valgt produksjon tilbake til Canvas. Returnerer
   * { returnUrl, jwt } — kalleren auto-poster JWT-en til returnUrl (skjema-POST).
   */
  async deepLinkResponse(launchId: string, input: { projectId: string; title?: string }): Promise<{ returnUrl: string; jwt: string }> {
    const res = await fetch(`/api/role-room/lti/launches/${encodeURIComponent(launchId)}/deep-link-response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return (await res.json()) as { returnUrl: string; jwt: string };
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
    input: { grade: string; comment?: string; label?: string; scoreMaximum?: number; ltiUserSub?: string; studentEmail?: string; resourceTag?: string },
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

  /**
   * Eksamensklar-status LEST FRA CANVAS (AGS Results): per student hvor mange
   * arbeidskrav som er godkjent i Canvas-karakterboka, og om alle er godkjent.
   * Canvas = fasit — ingen parallell Role Room-sannhet.
   */
  async getExamReadiness(launchId: string, cohortId?: string): Promise<ExamReadiness> {
    const qs = cohortId ? `?cohortId=${encodeURIComponent(cohortId)}` : '';
    const res = await fetch(`/api/role-room/lti/launches/${encodeURIComponent(launchId)}/exam-readiness${qs}`, {
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return (await res.json()) as ExamReadiness;
  },

  /**
   * Canvas-seksjoner i rosteret (FS lager én seksjon per kull). Tom liste =
   * plattformen leverer ikke seksjonsdata (da brukes vanlig samle-import).
   */
  async getSections(launchId: string): Promise<LtiSections> {
    const res = await fetch(`/api/role-room/lti/launches/${encodeURIComponent(launchId)}/sections`, {
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return (await res.json()) as LtiSections;
  },

  /**
   * Importerer rosteret gruppert per Canvas-seksjon → ett kull PER seksjon.
   * Idempotent «synk» (gjenbruker kull m/ samme navn). `namePrefix` gir lesbare
   * kull-navn (f.eks. emnekode); `includeUnsectioned` lager et «Uten seksjon»-kull.
   */
  async importBySection(
    launchId: string,
    input: { namePrefix?: string; includeUnsectioned?: boolean; nameMap?: Record<string, string> } = {},
  ): Promise<{ cohorts: ImportedSectionCohort[]; unsectioned: number }> {
    const res = await fetch(`/api/role-room/lti/launches/${encodeURIComponent(launchId)}/import-students-by-section`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      throw new Error(body.message || body.error || `HTTP ${res.status}`);
    }
    return (await res.json()) as { cohorts: ImportedSectionCohort[]; unsectioned: number };
  },

  /**
   * Importerer LMS-klasse-rosteret (NRPS) inn i et utdannings-kull. Uten
   * cohortId opprettes et nytt kull (cohortName). Idempotent på e-post = «synk».
   */
  async importStudents(
    launchId: string,
    input: { cohortId?: string; cohortName?: string } = {},
  ): Promise<{ cohortId: string; added: number; skipped: number; total: number }> {
    const res = await fetch(`/api/role-room/lti/launches/${encodeURIComponent(launchId)}/import-students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return (await res.json()) as { cohortId: string; added: number; skipped: number; total: number };
  },
};

export interface LtiContext {
  courseId: string | null;
  courseTitle: string | null;
  courseCode: string | null;
  institution: string | null;
  term: string | null;
  isDeepLink: boolean;
}

export interface LtiRosterMember {
  sub: string;
  name: string | null;
  email: string | null;
  roles: string[];
  status: string;
  sections: string[];
}

export interface LtiSections {
  sections: { section: string; studentCount: number }[];
  unsectioned: number;
  totalStudents: number;
}

export interface ImportedSectionCohort {
  cohortId: string;
  section: string;
  name: string;
  added: number;
  skipped: number;
  total: number;
}

export interface ExamReadinessStudent {
  sub: string;
  name: string | null;
  email: string | null;
  godkjent: number;
  total: number;
  examReady: boolean;
}
export interface ExamReadiness {
  totalArbeidskrav: number;
  arbeidskrav: { id: string; title: string }[];
  students: ExamReadinessStudent[];
}

export default educationLtiService;
