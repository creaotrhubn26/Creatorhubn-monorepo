/**
 * RoleRoomMark — The Role Room-merket, felles for alle flatene.
 *
 * Lå tidligere under education/ som RoleRoomEduLogo. Den var allerede skrevet
 * generisk, men navnet og plasseringen gjorde at ingen andre flate fant den:
 * Produksjon og Admin Room hadde ingen logo i det hele tatt, og Talents har
 * sin egen. Ett merke, ett sted.
 *
 * Bruker MERKE-filen (masker + klaffbrett, ingen tekst) og setter ordmerket
 * som ekte tekst ved siden av.
 *
 * 🔑 Tidligere ble lockup-filen beskåret med background-crop for å late som
 * den var et rent merke. Beskjæringen var skjør — den brakk hvis noen byttet
 * filen — og den dro med seg taglinen som står FEIL i selve bildet
 * («Casting.. Roles. Together.»). Lockup-filene er nå slettet, og merket
 * ligger som egen fil i full oppløsning.
 *
 * Ordmerket og taglinen settes derfor som tekst: da er de lesbare på mørk
 * bakgrunn, de skalerer, og de er stavet riktig.
 */

import { Box, Stack, Typography } from '@mui/material';

/**
 * Ordmerkets skrift. Logoen er satt i Poppins — geometrisk, runde O-er —
 * og appen satte det tidligere i Inter, som er en nøytral grotesk. Samme
 * ord, feil skrift. Vekt 600 og tettere sperring er valgt for å ligge
 * nærmest lockupen; Inter 800 var både tyngre og bredere.
 *
 * Fallbacken er systemets geometriske skrifter, ikke Inter: mister vi
 * Poppins, er Avenir/Century Gothic nærmere enn en grotesk.
 */
const WORDMARK_FONT = 'Poppins, "Avenir Next", "Century Gothic", system-ui, sans-serif';

export function RoleRoomMark({
  markSize = 46,
  showTagline = true,
  /** Flaten du er på, satt under ordmerket: «Produksjon», «Admin Room» … */
  surface,
}: {
  markSize?: number;
  showTagline?: boolean;
  surface?: string;
}) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.4}>
      <Box
        role="img"
        aria-label="The Role Room"
        sx={{
          width: markSize, height: markSize, flexShrink: 0,
          backgroundImage: 'url(/theroleroom-mark-1024-transparent.png)',
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          // Lysende lilla glød så merket «synes mer» (som på hero-bildet):
          // radial halo (0 0-blur) i to lag.
          filter: 'drop-shadow(0 0 13px rgba(93, 118, 203,0.75)) drop-shadow(0 0 5px rgba(195, 203, 230,0.55))',
        }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontFamily: WORDMARK_FONT, fontWeight: 600, fontSize: markSize * 0.33, letterSpacing: 0.6, lineHeight: 1.05, color: '#fff', whiteSpace: 'nowrap' }}>
          THE ROLE ROOM
        </Typography>
        {surface ? (
          <Typography sx={{ fontFamily: WORDMARK_FONT, fontWeight: 500, fontSize: markSize * 0.22, color: '#c3cbe6', letterSpacing: 0.4, lineHeight: 1, mt: 0.25 }}>
            {surface}
          </Typography>
        ) : showTagline ? (
          <Typography sx={{ fontFamily: WORDMARK_FONT, fontWeight: 500, fontSize: markSize * 0.2, color: '#c3cbe6', letterSpacing: 0.2, lineHeight: 1, mt: 0.25 }}>
            Casting. Roles. Together.
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
}

export default RoleRoomMark;

/** Gammelt navn, beholdt for education-flaten. */
export const RoleRoomEduLogo = RoleRoomMark;
