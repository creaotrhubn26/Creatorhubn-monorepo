// Delt auth for /api/ccapi/* — kamera-styring.
//
// Serveren utleder brukeren fra den autentiserte sesjonen (Bearer-token),
// IKKE lenger fra en klient-satt x-role-room-user-id-header (som var fritt
// spoofbar → IDOR mot andres kameraer). Alle ccapi-kall må derfor sende
// Bearer-tokenet. Samme token-oppslag som queryClient/usePresenceHeartbeat.

export function ccapiAuthToken(): string {
  if (typeof window === "undefined") return "";
  return (
    window.localStorage.getItem("creatorhub_auth_token") ||
    window.localStorage.getItem("role_room_auth_token") ||
    window.localStorage.getItem("token") ||
    ""
  );
}

/// Bygg headers for et ccapi-kall. Legger på Authorization: Bearer når vi
/// har et token; `extra` slås sammen (f.eks. Content-Type).
export function ccapiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const token = ccapiAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
