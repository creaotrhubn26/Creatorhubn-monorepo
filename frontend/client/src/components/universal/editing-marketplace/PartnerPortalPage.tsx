/**
 * PartnerPortalPage.tsx
 *
 * Landings-/portalside for godkjente partnere. Tar magic-link (?jti=&t=).
 * Innløsning krever et eksplisitt klikk («Åpne portalen») FØR den engangs-
 * tokenet konsumeres — bedrifts-e-post-skannere (Microsoft Safe Links m.fl.)
 * pre-henter/rendrer lenker i e-post automatisk og ville ellers konsumert
 * tokenet før partneren selv rakk å klikke, og gjort lenken død («ugyldig»)
 * uten at partneren noensinne fikk logget inn. Etter vellykket innløsning:
 * fjerner hemmeligheten fra URL-en (history.replaceState — hindrer referer/
 * historikk-lekkasje), og rendrer partner-arbeidsområdet.
 *
 * Allerede innlogget partner (uten lenke) lander rett i portalen.
 */

import React, { useEffect, useState } from "react";
import { Box, CircularProgress, Alert, Typography, Button } from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";
import { apiRequest } from "@/lib/queryClient";
import EditingVendorWorkspace from "./EditingVendorWorkspace";

export default function PartnerPortalPage() {
  const [state, setState] = useState<"loading" | "confirm" | "redeeming" | "ready" | "error">("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const [link, setLink] = useState<{ jti: string; t: string } | null>(null);

  const redeem = React.useCallback(async (jti: string, t: string) => {
    setState("redeeming");
    try {
      const r = (await apiRequest("/api/editing/partner/portal/redeem", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jti, t }),
      })) as { ok: boolean; sessionToken: string; user: { id: string; email: string; role: string } };
      // Etabler session lokalt.
      localStorage.setItem("creatorhub_auth_token", r.sessionToken);
      localStorage.setItem("creatorhub_auth_user", JSON.stringify(r.user));
      localStorage.setItem("userId", r.user.id);
      if (r.user.email) localStorage.setItem("userEmail", r.user.email);
      // Fjern hemmelig token fra URL umiddelbart (referer/historikk-lekkasje).
      window.history.replaceState({}, "", "/partner-portal");
      setUserId(r.user.id); setState("ready");
    } catch {
      setErrMsg("invalid_link"); setState("error");
    }
  }, []);

  useEffect(() => {
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

    // Venter på et eksplisitt klikk — se komponent-docstring.
    setLink({ jti, t });
    setState("confirm");
  }, []);

  if (state === "loading" || state === "redeeming") {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#05060a" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (state === "confirm" && link) {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#05060a", p: 3 }}>
        <Box sx={{ maxWidth: 460, textAlign: "center", color: "#f6f2ea" }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Velkommen til Creatorhub Partnerportal / Welcome to the Creatorhub Partner Portal
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, color: "text.secondary" }}>
            Klikk under for å logge inn. Lenken er personlig og engangs — den aktiveres kun ved ditt klikk.
            <br />
            Click below to sign in. The link is personal and single-use — it only activates on your click.
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<LoginIcon />}
            onClick={() => redeem(link.jti, link.t)}
          >
            Åpne portalen / Open portal
          </Button>
        </Box>
      </Box>
    );
  }

  if (state === "error") {
    const expired = errMsg === "invalid_link";
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#05060a", p: 3 }}>
        <Box sx={{ maxWidth: 460, textAlign: "center", color: "#f6f2ea" }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            {expired ? "Denne lenken er ikke lenger gyldig / This link is no longer valid" : "Partnerportal / Partner portal"}
          </Typography>
          <Alert severity={expired ? "warning" : "info"} sx={{ mb: 2, textAlign: "left" }}>
            {expired
              ? (
                <>
                  Tilgangslenken er utløpt eller allerede brukt. Be partneransvarlig hos Creatorhub om å sende den på nytt.
                  <br />
                  The access link has expired or was already used. Ask your Creatorhub partner manager to resend it.
                </>
              )
              : (
                <>
                  Åpne portalen fra tilgangslenken vi sendte deg på e-post, eller logg inn på vendor-kontoen din.
                  <br />
                  Open your portal from the access link we emailed you, or sign in to your vendor account.
                </>
              )}
          </Alert>
          <Button variant="outlined" href="/partner/apply">Søk om å bli partner / Apply to the Partner Program</Button>
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
