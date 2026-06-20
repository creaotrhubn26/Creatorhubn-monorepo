/**
 * The Role Room — Post Agent pairing page.
 *
 * Mounted at /link (theroleroom.com/link). Standalone — pulls in only React +
 * the existing auth fetch wrapper. User pastes the 6-char pairing code shown
 * in Post Agent → backend redeems → Post Agent's poll returns the bearer.
 *
 * Wire this into the app router with:
 *   <Route path="/link" component={PostAgentLinkPage} />
 *
 * Bearer auth: relies on the user's existing Role Room login (cookie/session).
 * If the user isn't signed in, the redeem call returns 401 and we show a
 * sign-in CTA.
 */

import { useCallback, useEffect, useState } from 'react';

type Status = 'idle' | 'pairing' | 'paired' | 'error' | 'unauthorized';

function getBearerFromStorage(): string | null {
  // MÅ speile queryClient.ts: appen lagrer bearer-token under
  // 'creatorhub_auth_token' / 'role_room_auth_token'. De gamle placeholder-
  // nøklene (authToken osv.) fantes aldri → redeem ble sendt uten Bearer →
  // 401 → Post Agent fikk aldri token (paring «hang»). Riktige nøkler først.
  for (const key of [
    'creatorhub_auth_token',
    'role_room_auth_token',
    'auth_token',
    'authToken',
    'sessionToken',
    'rr_session',
    'auth_session',
  ]) {
    const v = window.localStorage.getItem(key);
    if (v) return v;
  }
  return null;
}

export default function PostAgentLinkPage(): JSX.Element {
  const [code, setCode] = useState<string>('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  // Allow ?code=ABC-DEF prefill so Post Agent can deep-link the user here
  useEffect(() => {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get('code');
    if (fromUrl) setCode(fromUrl.toUpperCase());
  }, []);

  const handlePair = useCallback(async () => {
    setStatus('pairing');
    setError(null);
    try {
      const bearer = getBearerFromStorage();
      const res = await fetch('/api/post-agent/pairing/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      if (res.status === 401) {
        setStatus('unauthorized');
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setError(data?.error || `HTTP ${res.status}`);
        return;
      }
      setStatus('paired');
    } catch (e) {
      setStatus('error');
      setError(String(e));
    }
  }, [code]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(160, 48, 192, 0.18), transparent 60%), #0a0518',
        color: '#f0eaff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
        padding: 24,
      }}
    >
      <div
        style={{
          background: 'rgba(26, 13, 69, 0.7)',
          border: '1px solid #2c1860',
          borderRadius: 12,
          padding: 32,
          maxWidth: 480,
          width: '100%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Koble Post Agent</h1>
        <p style={{ color: '#b8a8d8', fontSize: 14, marginTop: 8, marginBottom: 24 }}>
          Skriv inn 6-tegns koden som vises i Post Agent for å pare den med Role Room-kontoen din.
        </p>

        {status === 'paired' ? (
          <div
            style={{
              background: 'rgba(74, 212, 138, 0.1)',
              border: '1px solid #4ad48a',
              borderRadius: 8,
              padding: 16,
              color: '#4ad48a',
              fontWeight: 500,
            }}
          >
            <div style={{ marginBottom: 12 }}>
              Paret. Post Agent fullfører oppsettet automatisk innen et par sekunder.
            </div>
            <button
              type="button"
              onClick={() => {
                // postagent:// URL-protokoll registreres av Tauri-appen
                // (tauri-plugin-deep-link) fra Post Agent v0.2.4+. OS
                // ruter klikket til appen som brings vinduet til front.
                window.location.href = 'postagent://focus';
              }}
              style={{
                width: '100%',
                background: '#4ad48a',
                color: '#0a0518',
                border: 'none',
                borderRadius: 8,
                padding: '12px 16px',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Åpne Post Agent
            </button>
            <div style={{ fontSize: 12, color: 'rgba(74,212,138,0.7)', marginTop: 8 }}>
              Krever Post Agent v0.2.4+ installert. Eldre versjoner: bytt til appen manuelt — den henter pairing automatisk.
            </div>
          </div>
        ) : status === 'unauthorized' ? (
          <div>
            <div
              style={{
                background: 'rgba(239, 79, 111, 0.1)',
                border: '1px solid #ef4f6f',
                borderRadius: 8,
                padding: 16,
                color: '#ef4f6f',
                marginBottom: 16,
              }}
            >
              Du må være logget inn på Role Room for å pare en Post Agent.
            </div>
            <a
              href="/login?redirect=/link"
              style={{
                display: 'inline-block',
                background: '#a030c0',
                color: '#fff',
                padding: '10px 20px',
                borderRadius: 6,
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Logg inn
            </a>
          </div>
        ) : (
          <>
            <label
              style={{
                display: 'block',
                color: '#b8a8d8',
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 8,
              }}
            >
              Pairing-kode
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC-DEF"
              autoFocus
              maxLength={7}
              style={{
                width: '100%',
                background: '#0a0518',
                border: '1px solid #2c1860',
                borderRadius: 8,
                padding: '14px 18px',
                color: '#f0eaff',
                fontSize: 22,
                fontFamily: 'ui-monospace, "SF Mono", monospace',
                letterSpacing: 4,
                textAlign: 'center',
                marginBottom: 16,
                outline: 'none',
              }}
            />
            <button
              onClick={handlePair}
              disabled={status === 'pairing' || code.replace('-', '').length < 6}
              style={{
                width: '100%',
                background: '#a030c0',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                opacity: status === 'pairing' || code.replace('-', '').length < 6 ? 0.5 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {status === 'pairing' ? 'Parer…' : 'Pare Post Agent'}
            </button>
            {error && (
              <div
                style={{
                  background: 'rgba(239, 79, 111, 0.1)',
                  border: '1px solid #ef4f6f',
                  borderRadius: 8,
                  padding: 12,
                  color: '#ef4f6f',
                  marginTop: 12,
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}
          </>
        )}

        <p style={{ color: '#8674a8', fontSize: 11, marginTop: 24, marginBottom: 0 }}>
          Pairing-koden utløper etter 10 minutter. Du kan generere en ny direkte fra Post Agent.
        </p>
      </div>
    </div>
  );
}
