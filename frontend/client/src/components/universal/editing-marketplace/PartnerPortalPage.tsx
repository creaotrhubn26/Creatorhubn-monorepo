/**
 * PartnerPortalPage.tsx
 *
 * Landings-/portalside for godkjente partnere. Tar magic-link (?jti=&t=),
 * løser den inn til en ekte session (én gang), fjerner hemmeligheten fra URL-en
 * (history.replaceState — hindrer referer/historikk-lekkasje), og rendrer
 * partner-arbeidsområdet (PartnerProgramDashboard + verifisering + katalog).
 *
 * Allerede innlogget partner (uten lenke) lander rett i portalen.
 */

import React, { useEffect, useState } from "react";
import { Box, CircularProgress, Alert, Typography, Button } from "@mui/material";
import { apiRequest } from "@/lib/queryClient";
import EditingVendorWorkspace from "./EditingVendorWorkspace";

export default function PartnerPortalPage() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const jti = params.get("jti");
      const t = params.get("t");

      // Allerede innlogget partner uten lenke → vis portalen direkte.
      const existingUser = (() => {
        try { return JSON.parse(localStorage.getItem("creatorhub_auth_user") || "null"); } catch { return null; }
      })();
      if (!jti || !t) {
        if (existingUser?.id && localStorage.getItem("creatorhub_auth_token")) {
          setUserId(existingUser.id); setState("ready");
        } else {
          setErrMsg("missing_link"); setState("error");
        }
        return;
      }

      try {
        const r = (await apiRequest("/api/editing/partner/portal/redeem", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jti, t }),
        })) as { ok: boolean; sessionToken: string; user: { id: string; email: string; role: string } };
        if (cancelled) return;
        // Etabler session lokalt.
        localStorage.setItem("creatorhub_auth_token", r.sessionToken);
        localStorage.setItem("creatorhub_auth_user", JSON.stringify(r.user));
        localStorage.setItem("userId", r.user.id);
        if (r.user.email) localStorage.setItem("userEmail", r.user.email);
        // Fjern hemmelig token fra URL umiddelbart (referer/historikk-lekkasje).
        window.history.replaceState({}, "", "/partner-portal");
        setUserId(r.user.id); setState("ready");
      } catch {
        if (!cancelled) { setErrMsg("invalid_link"); setState("error"); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (state === "loading") {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#05060a" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (state === "error") {
    const expired = errMsg === "invalid_link";
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#05060a", p: 3 }}>
        <Box sx={{ maxWidth: 460, textAlign: "center", color: "#f6f2ea" }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            {expired ? "This link is no longer valid" : "Partner portal"}
          </Typography>
          <Alert severity={expired ? "warning" : "info"} sx={{ mb: 2, textAlign: "left" }}>
            {expired
              ? "The access link has expired or was already used. Ask your Creatorhub partner manager to resend it."
              : "Open your portal from the access link we emailed you, or sign in to your vendor account."}
          </Alert>
          <Button variant="outlined" href="/partner/apply">Apply to the Partner Program</Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", background: "#05060a", color: "#f6f2ea", py: { xs: 2, md: 4 }, px: { xs: 1, sm: 2 } }}>
      <Box sx={{ maxWidth: 1100, mx: "auto" }}>
        {userId && <EditingVendorWorkspace userId={userId} />}
      </Box>
    </Box>
  );
}
