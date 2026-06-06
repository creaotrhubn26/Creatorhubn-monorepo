/**
 * currentUserService — henter den faktisk innloggede Role Room-brukeren
 * (/api/post-agent/me med lagret bearer-token). Brukes til å vise ekte
 * bruker i app-chrome i stedet for mockup-data.
 */

const STORAGE_KEY = 'trrpa.settings';

function getBaseUrl(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as { RR_POST_AGENT_BASE_URL?: string };
      if (s.RR_POST_AGENT_BASE_URL) return s.RR_POST_AGENT_BASE_URL.replace(/\/$/, '');
    }
  } catch { /* fall through */ }
  return 'https://creatorhubn.com/api/post-agent';
}

function getBearer(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as { RR_BEARER_TOKEN?: string };
    return s.RR_BEARER_TOKEN?.trim() ?? null;
  } catch {
    return null;
  }
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: string;
  profileImageUrl?: string;
  companyName?: string;
  isAdministrator?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Admin', admin: 'Admin', producer: 'Produsent',
  editor: 'Editor', creator: 'Creator', user: 'Bruker',
};

/** Pen rolle-/plan-etikett for visning. */
export function roleLabel(user: CurrentUser): string {
  return user.companyName || ROLE_LABELS[user.role] || user.role || 'Role Room';
}

/** Initialer fra navn (for avatar uten profilbilde). */
export function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Hent innlogget bruker, eller null hvis ikke logget inn / feil. */
export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const bearer = getBearer();
  if (!bearer) return null;
  try {
    const res = await fetch(`${getBaseUrl()}/me`, { headers: { Authorization: `Bearer ${bearer}` } });
    if (!res.ok) return null;
    return (await res.json()) as CurrentUser;
  } catch {
    return null;
  }
}
