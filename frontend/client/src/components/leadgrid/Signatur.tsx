/**
 * Underskrift.
 *
 * Kunden skriver navnet sitt og velger hvordan det gjengis. Det er en ekte
 * handling — ikke en avkrysset boks — og det er forskjellen mellom å ha
 * klikket på noe og å ha skrevet under på noe.
 *
 * Vi tegner med skrift, ikke med canvas. En innskrevet signatur ser lik ut
 * på nettbrett, mus og telefon, veier ingenting, kan gjengis i e-post, og
 * lar seg lese av en skjermleser. En tegnet strek gjør ingen av delene.
 *
 * Stilene og skriftstakkene er de samme som serveren bruker i kvitteringen
 * (leadgrid-org-agreements.ts) — underskriften skal se lik ut overalt.
 */
import React from "react";
import { Box, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";

export const SIGNATURE_STYLES = ["flyt", "klassisk", "rund"] as const;
export type SignaturStil = (typeof SIGNATURE_STYLES)[number];

export const SIGNATURE_FONTS: Record<SignaturStil, string> = {
  flyt: "'Snell Roundhand', 'Apple Chancery', 'Segoe Script', cursive",
  klassisk: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
  rund: "'Bradley Hand', 'Comic Sans MS', 'Segoe Print', cursive",
};

const STIL_NAVN: Record<SignaturStil, string> = {
  flyt: "Flyt",
  klassisk: "Klassisk",
  rund: "Rund",
};

/** Underskriften på en linje. Brukes både ved signering og i «Mine avtaler». */
export function SignaturVisning({
  tekst, stil, størrelse = 34, undertekst,
}: {
  tekst: string;
  stil: SignaturStil;
  størrelse?: number;
  undertekst?: React.ReactNode;
}) {
  return (
    <Box>
      <Box
        sx={{
          fontFamily: SIGNATURE_FONTS[stil],
          fontSize: `${størrelse}px`,
          fontStyle: "italic",
          lineHeight: 1.35,
          minHeight: størrelse * 1.5,
          display: "flex",
          alignItems: "flex-end",
          color: "#1a1a2e",
          overflowX: "auto",
          whiteSpace: "nowrap",
        }}
      >
        {tekst}
      </Box>
      <Box sx={{ borderBottom: "1px solid", borderColor: "divider", mb: 0.75 }} />
      {undertekst && (
        <Typography variant="caption" color="text.secondary">{undertekst}</Typography>
      )}
    </Box>
  );
}

/**
 * Selve underskriftsfeltet.
 *
 * Stilvalget kommer først når det står noe der å se på — å velge håndskrift
 * for et tomt felt er en avgjørelse uten innhold.
 */
export function SignaturFelt({
  verdi, onVerdi, stil, onStil, forventetNavn, låst,
}: {
  verdi: string;
  onVerdi: (v: string) => void;
  stil: SignaturStil;
  onStil: (s: SignaturStil) => void;
  /** Navnet fra «Hvem signerer?» — underskriften må stemme med det. */
  forventetNavn: string;
  låst?: boolean;
}) {
  const skrevet = verdi.trim();
  const normaliser = (t: string) => t.trim().replace(/\s+/g, " ").toLowerCase();
  const avvik =
    skrevet.length > 0 &&
    forventetNavn.trim().length > 0 &&
    normaliser(skrevet) !== normaliser(forventetNavn);

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          border: "1px solid", borderColor: avvik ? "warning.main" : "divider",
          borderRadius: 2, p: { xs: 2, sm: 2.5 }, bgcolor: "background.paper",
        }}
      >
        <Typography variant="overline" color="text.secondary">Underskrift</Typography>
        <SignaturVisning
          tekst={skrevet || " "}
          stil={stil}
          undertekst={
            skrevet
              ? `${forventetNavn.trim() || skrevet}`
              : "Skriv navnet ditt under for å signere"
          }
        />
      </Box>

      <TextField
        label="Skriv navnet ditt"
        value={verdi}
        onChange={(e) => onVerdi(e.target.value)}
        disabled={låst}
        fullWidth
        autoComplete="off"
        error={avvik}
        helperText={
          avvik
            ? `Underskriften må være det samme navnet som over: «${forventetNavn.trim()}».`
            : "Dette blir din elektroniske signatur på avtalen."
        }
        inputProps={{ "aria-label": "Underskrift — skriv navnet ditt" }}
      />

      {skrevet.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
            Velg hvordan underskriften skal se ut
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={stil}
            onChange={(_, v) => { if (v) onStil(v as SignaturStil); }}
            disabled={låst}
            sx={{ flexWrap: "wrap", gap: 1, "& .MuiToggleButton-root": { borderRadius: 2, borderLeft: "1px solid rgba(0,0,0,0.12) !important" } }}
          >
            {SIGNATURE_STYLES.map((s) => (
              <ToggleButton key={s} value={s} sx={{ px: 2, py: 1, minHeight: 56, textTransform: "none" }}>
                <Stack alignItems="flex-start" spacing={0}>
                  <Box
                    sx={{
                      fontFamily: SIGNATURE_FONTS[s], fontSize: 20, fontStyle: "italic",
                      maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {skrevet}
                  </Box>
                  <Typography variant="caption" color="text.secondary">{STIL_NAVN[s]}</Typography>
                </Stack>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      )}
    </Stack>
  );
}
