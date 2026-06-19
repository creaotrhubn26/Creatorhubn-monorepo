/**
 * WaTemplatePhonePreview.tsx
 *
 * Mockup av hvordan en WhatsApp-template ser ut på telefon.
 */

import React from "react";
import { Box, Typography, Stack } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

interface Props {
  headerText: string | null;
  bodyText: string;
  bodyParamExamples: string[];
  footerText: string | null;
  buttons: any;
}

function substituteVars(text: string, examples: string[]): string {
  return text.replace(/\{\{(\d+)\}\}/g, (_, n) => examples[parseInt(n, 10) - 1] ?? `[${n}]`);
}

export function WaTemplatePhonePreview({
  headerText, bodyText, bodyParamExamples, footerText, buttons,
}: Props) {
  const renderedBody = substituteVars(bodyText, bodyParamExamples ?? []);
  const buttonArr = Array.isArray(buttons) ? buttons : [];

  return (
    <Box sx={{
      bgcolor: "#0a141a", py: 4, px: 2,
      borderRadius: 3, position: "relative",
      backgroundImage: "linear-gradient(135deg, #0b141a 0%, #1f2c33 100%)",
    }}>
      <Box sx={{
        bgcolor: "#005c4b",
        color: "#fff",
        ml: "auto", mr: 0,
        maxWidth: 280,
        borderRadius: "8px 0 8px 8px",
        p: 1.5,
        position: "relative",
        boxShadow: "0 1px 1px rgba(0,0,0,0.3)",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        {headerText && (
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: "#fff" }}>
            {headerText}
          </Typography>
        )}
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap",
          color: "rgba(255,255,255,0.95)", lineHeight: 1.4, fontSize: 14 }}>
          {renderedBody}
        </Typography>
        {footerText && (
          <Typography variant="caption" sx={{
            display: "block", mt: 1, color: "rgba(255,255,255,0.55)", fontSize: 11,
          }}>
            {footerText}
          </Typography>
        )}
        <Stack direction="row" spacing={1} sx={{ mt: 0.5, justifyContent: "flex-end" }}>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)", fontSize: 10 }}>
            12:34 ✓✓
          </Typography>
        </Stack>
      </Box>

      {buttonArr.length > 0 && (
        <Stack spacing={0.5} sx={{ mt: 1, mr: 0, ml: "auto", maxWidth: 280 }}>
          {buttonArr.map((btn: any, i: number) => (
            <Box key={i} sx={{
              bgcolor: "#005c4b",
              color: "#53bdeb",
              borderTop: "1px solid rgba(255,255,255,0.1)",
              borderRadius: i === buttonArr.length - 1 ? "0 0 8px 8px" : 0,
              p: 1, textAlign: "center",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5,
              fontSize: 13, fontWeight: 600,
            }}>
              <OpenInNewIcon sx={{ fontSize: 14 }} />
              {btn.text}
            </Box>
          ))}
        </Stack>
      )}

      <Typography variant="caption" sx={{
        display: "block", textAlign: "center", color: "rgba(255,255,255,0.4)",
        mt: 2, fontSize: 10,
      }}>
        Forhåndsvisning — slik vises templaten på en WhatsApp-konto
      </Typography>
    </Box>
  );
}
