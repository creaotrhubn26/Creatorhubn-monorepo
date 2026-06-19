/**
 * leadgrid-research-consent.tsx — Public side: /personvern/automatisk-research
 *
 * Forklarer hva som skjer når en lead samtykker til at vi gjør
 * automatisk research på dem.
 */

import React from "react";
import { Box, Container, Stack, Typography, Card, CardContent, Chip, Divider } from "@mui/material";
import PublicIcon from "@mui/icons-material/Public";
import LanguageIcon from "@mui/icons-material/Language";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import GavelIcon from "@mui/icons-material/Gavel";
import LockIcon from "@mui/icons-material/Lock";

export default function LeadgridResearchConsentPage() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#0a0512", color: "#fff" }}>
      <Container maxWidth="md" sx={{ py: 6 }}>

        <Stack alignItems="center" spacing={2} mb={6}>
          <Box sx={{ width: 56, height: 56, borderRadius: 2,
                      bgcolor: "rgba(167,139,250,0.15)",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AutoAwesomeIcon sx={{ color: "#a78bfa", fontSize: 32 }} />
          </Box>
          <Chip label="Personvern" sx={{ bgcolor: "rgba(167,139,250,0.15)", color: "#a78bfa" }} />
          <Typography variant="h3" sx={{ fontWeight: 800, textAlign: "center" }}>
            Automatisk research av leads
          </Typography>
          <Typography variant="h6" sx={{ color: "rgba(255,255,255,0.7)",
                                          textAlign: "center", maxWidth: 600 }}>
            Hva skjer hvis du krysser av "Tillater du at vi sjekker bedriftsinformasjon"
            når du sender inn en forespørsel.
          </Typography>
        </Stack>

        <Card sx={{ bgcolor: "rgba(255,255,255,0.04)",
                     border: "1px solid rgba(167,139,250,0.20)", mb: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
              Hva vi henter inn
            </Typography>
            <Stack spacing={3}>
              <Item icon={<PublicIcon sx={{ color: "#a78bfa" }} />}
                    title="Offentlig bedriftsinformasjon fra Brønnøysundregistrene"
                    body="Vi slår opp organisasjonsnummeret eller navnet ditt og henter offentlig tilgjengelig data: bedriftsnavn, antall ansatte, bransje, stiftelsesdato og forretningsadresse." />
              <Item icon={<LanguageIcon sx={{ color: "#a78bfa" }} />}
                    title="Hjemmesiden din"
                    body="Vi besøker hjemmesiden din og leser metadata (tittel, beskrivelse, logo). Vi følger en standard User-Agent ('LeadgridResearch/1.0') og respekterer robots.txt." />
              <Item icon={<AutoAwesomeIcon sx={{ color: "#a78bfa" }} />}
                    title="AI-sammendrag"
                    body="Vi bruker Claude (Anthropic) til å lage et kort sammendrag av hvem dere er og hvor relevant Leadgrid kan være for dere. Dette hjelper teamet vårt forberede et godt møte." />
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ bgcolor: "rgba(255,255,255,0.04)",
                     border: "1px solid rgba(167,139,250,0.20)", mb: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
              Hva vi <em>ikke</em> gjør
            </Typography>
            <Stack spacing={2}>
              <Bullet text="Vi sjekker IKKE privatpersoner mot kredittregister, Folkeregister eller liknende" />
              <Bullet text="Vi kjøper IKKE data fra tredjepart om deg eller bedriften" />
              <Bullet text="Vi deler IKKE data med andre kunder eller eksterne uten ditt samtykke" />
              <Bullet text="Vi sender IKKE markedsføring uten din uttrykkelige opt-in (kun bekreftelse på din egen forespørsel)" />
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ bgcolor: "rgba(255,255,255,0.04)",
                     border: "1px solid rgba(167,139,250,0.20)", mb: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
              <LockIcon sx={{ color: "#9be15d" }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>Lagring og sletting</Typography>
            </Stack>
            <Stack spacing={2}>
              <Bullet text="Research-resultatene lagres i 12 måneder fra siste kontakt, deretter slettes automatisk" />
              <Bullet text="Hvis du ber om å bli slettet (GDPR art. 17), sletter vi all data om deg innen 30 dager" />
              <Bullet text="Logg over hvem som så research-rapporten din er audit-tilgjengelig på forespørsel" />
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ bgcolor: "rgba(255,255,255,0.04)",
                     border: "1px solid rgba(167,139,250,0.20)", mb: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
              <GavelIcon sx={{ color: "#9be15d" }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>Dine rettigheter</Typography>
            </Stack>
            <Stack spacing={2}>
              <Bullet text="Rett til innsyn: be om å se all data vi har lagret om deg" />
              <Bullet text="Rett til retting: korriger uriktig informasjon" />
              <Bullet text="Rett til sletting: 'be om å bli glemt'" />
              <Bullet text="Rett til dataportabilitet: få utlevert dine data i maskin-lesbart format" />
              <Bullet text="Rett til å trekke samtykke når som helst (uten å påvirke lovligheten av tidligere behandling)" />
            </Stack>
            <Divider sx={{ my: 3, borderColor: "rgba(255,255,255,0.10)" }} />
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)" }}>
              For å utøve disse rettighetene, kontakt oss på{" "}
              <Box component="a" href="mailto:personvern@creatorhubn.com"
                   sx={{ color: "#a78bfa" }}>personvern@creatorhubn.com</Box>.
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ bgcolor: "rgba(167,139,250,0.10)",
                     border: "1px solid rgba(167,139,250,0.30)" }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Hvorfor gjør vi dette?
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)",
                                                lineHeight: 1.7 }}>
              Når du vurderer å bruke Leadgrid, ønsker vi at samtalen vår skal være
              relevant og konkret. Ved å gjøre automatisk research <em>før</em> møtet,
              kan vi:
              <br/>• Gi deg et tilpasset tilbud fra første samtale, ikke generisk salgspitch
              <br/>• Spare tid — du slipper å forklare grunnleggende info om bedriften
              <br/>• Vise hva vår platform faktisk kan finne om markedet ditt
              <br/><br/>
              Du kan alltid si nei til denne sjekken og fortsatt få demo eller kontakt
              — vi gjør da research manuelt sammen med deg i møtet.
            </Typography>
          </CardContent>
        </Card>

        <Typography variant="caption" sx={{ display: "block", textAlign: "center",
                                              mt: 4, color: "rgba(255,255,255,0.5)" }}>
          Sist oppdatert: 19. juni 2026 · Behandlingsansvarlig: Creatorhubn AS
        </Typography>
      </Container>
    </Box>
  );
}

function Item({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Stack direction="row" spacing={2} alignItems="flex-start">
      <Box sx={{ pt: 0.5 }}>{icon}</Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#fff" }}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.75)", mt: 0.5,
                                            lineHeight: 1.6 }}>
          {body}
        </Typography>
      </Box>
    </Stack>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box sx={{ width: 5, height: 5, borderRadius: "50%",
                  bgcolor: "#a78bfa", flexShrink: 0, mt: 1 }} />
      <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>
        {text}
      </Typography>
    </Stack>
  );
}
