/**
 * Compact user-profile display for the HeaderBar.
 *
 * Fetches /api/post-agent/me on mount with the stored bearer token and shows:
 *   - circular avatar (profile image OR initials)
 *   - name + role chip
 *   - click → dropdown with email + sign-out
 *
 * When not signed in, renders a slim "Logg inn"-button instead.
 */

import { useCallback, useEffect, useState } from "react";
import { authedGet, updateAppSettings } from "../api";
import { IconCheck, IconX, IconArrowRight } from "./Icons";

interface Me {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  role: string;
  profileImageUrl?: string;
  profession?: string;
  companyName?: string;
  isAdministrator: boolean;
}

interface Props {
  signedIn: boolean;
  onSignIn: () => void;
  onSignedOut: () => void;
}

const ROLE_LABELS: Record<string, { label: string; tone: "admin" | "pro" | "user" }> = {
  super_admin: { label: "Super admin", tone: "admin" },
  admin: { label: "Admin", tone: "admin" },
  owner: { label: "Owner", tone: "admin" },
  user: { label: "Bruker", tone: "user" },
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getBaseUrl(): string {
  try {
    const raw = localStorage.getItem("trrpa.settings");
    if (raw) {
      const s = JSON.parse(raw) as { RR_POST_AGENT_BASE_URL?: string };
      if (s.RR_POST_AGENT_BASE_URL) return s.RR_POST_AGENT_BASE_URL.replace(/\/$/, "");
    }
  } catch {
    /* fall through */
  }
  return "https://creatorhubn.com/api/post-agent";
}

function getBearer(): string | null {
  try {
    const raw = localStorage.getItem("trrpa.settings");
    if (!raw) return null;
    const s = JSON.parse(raw) as { RR_BEARER_TOKEN?: string };
    return s.RR_BEARER_TOKEN?.trim() ?? null;
  } catch {
    return null;
  }
}

export function UserProfile({ signedIn, onSignIn, onSignedOut }: Props) {
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    const bearer = getBearer();
    if (!bearer) {
      setMe(null);
      return;
    }
    setLoading(true);
    try {
      // Via Rust (authedGet) — backend mangler CORS for tauri://localhost.
      const res = await authedGet(`${getBaseUrl()}/me`, bearer);
      if (res.status >= 200 && res.status < 300) {
        setMe((res.body ?? {}) as Me);
      } else if (res.status === 401) {
        // Token invalid — clear local state
        setMe(null);
      }
    } catch {
      // Network error — just stay quiet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (signedIn) void loadProfile();
    else setMe(null);
  }, [signedIn, loadProfile]);

  // Listen for storage changes so post-login the avatar appears without
  // a full page refresh. RoleRoomSignInDialog writes RR_BEARER_TOKEN to
  // localStorage which fires a 'storage' event on OTHER tabs — but not
  // the same tab. We dispatch a custom event from the dialog instead.
  useEffect(() => {
    const handler = () => void loadProfile();
    window.addEventListener("trrpa:auth-changed", handler);
    return () => window.removeEventListener("trrpa:auth-changed", handler);
  }, [loadProfile]);

  const handleSignOut = useCallback(async () => {
    setOpen(false);
    // Clear bearer from local settings
    try {
      const raw = localStorage.getItem("trrpa.settings");
      const s = raw ? JSON.parse(raw) : {};
      s.RR_BEARER_TOKEN = "";
      localStorage.setItem("trrpa.settings", JSON.stringify(s));
      // Also clear from Rust-side cache so Python scripts don't keep using it
      await updateAppSettings({ RR_BEARER_TOKEN: "" });
    } catch {
      /* non-critical */
    }
    setMe(null);
    onSignedOut();
  }, [onSignedOut]);

  if (!signedIn || !me) {
    return (
      <button
        className="user-profile-signin"
        onClick={onSignIn}
        title="Logg inn med Role Room-kontoen din"
      >
        <span className="user-profile-signin-dot" />
        Logg inn
      </button>
    );
  }

  const roleInfo = ROLE_LABELS[me.role] ?? { label: me.role, tone: "user" as const };

  return (
    <div className="user-profile-wrap">
      <button
        className="user-profile-trigger"
        onClick={() => setOpen((s) => !s)}
        title={me.email}
      >
        <div className="user-profile-avatar">
          {me.profileImageUrl ? (
            <img src={me.profileImageUrl} alt={me.name} />
          ) : (
            <span>{getInitials(me.name)}</span>
          )}
        </div>
        <div className="user-profile-text">
          <div className="user-profile-name">{me.name}</div>
          <div className={`user-profile-role tone-${roleInfo.tone}`}>{roleInfo.label}</div>
        </div>
      </button>

      {open && (
        <>
          <div className="user-profile-backdrop" onClick={() => setOpen(false)} />
          <div className="user-profile-menu">
            <div className="user-profile-menu-header">
              <div className="user-profile-avatar large">
                {me.profileImageUrl ? (
                  <img src={me.profileImageUrl} alt={me.name} />
                ) : (
                  <span>{getInitials(me.name)}</span>
                )}
              </div>
              <div>
                <div className="user-profile-menu-name">{me.name}</div>
                <div className="user-profile-menu-email">{me.email}</div>
                <div className={`user-profile-role tone-${roleInfo.tone}`} style={{ marginTop: 4 }}>
                  {roleInfo.label}
                </div>
              </div>
            </div>

            {(me.companyName || me.profession) && (
              <div className="user-profile-menu-meta">
                {me.companyName && <div>{me.companyName}</div>}
                {me.profession && <div className="card-chip-meta">{me.profession}</div>}
              </div>
            )}

            <div className="user-profile-menu-divider" />

            <button className="user-profile-menu-item" onClick={() => { void loadProfile(); }}>
              <IconCheck /> {loading ? "Oppdaterer…" : "Oppdater profil"}
            </button>
            <button className="user-profile-menu-item" onClick={() => { setOpen(false); window.open("https://theroleroom.com/billing/post-agent", "_blank"); }}>
              <IconArrowRight /> Administrer abonnement
            </button>
            <div className="user-profile-menu-divider" />
            <button className="user-profile-menu-item danger" onClick={handleSignOut}>
              <IconX /> Logg ut
            </button>
          </div>
        </>
      )}
    </div>
  );
}
