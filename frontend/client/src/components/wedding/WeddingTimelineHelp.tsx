import React from 'react';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton
} from '@mui/material';
import {
  Close,
  HelpOutline,
  Event,
  Edit,
  Schedule,
  People,
  CheckCircle,
  Pending,
  CalendarToday,
  GetApp,
  Share
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface WeddingTimelineHelpProps {
  open: boolean;
  onClose: () => void;
  mode?: 'client' | 'admin';
}

export default function WeddingTimelineHelp({ open, onClose, mode = 'client' }: WeddingTimelineHelpProps) {
  const { profession } = useProfessionAdapter();
  const theming = useTheming(profession || 'photographer');

  if (mode === 'client') {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: theming.colors.primary, color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HelpOutline />
            <Typography variant="h6">Hvordan bruker jeg tidslinjen?</Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Event />
              Velkommen til Evendi tidslinjen
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Denne tidslinjen gir deg en oversikt over alle aktiviteter på arrangementsdagen. Du kan se tider, lokasjoner, og legge til dine egne notater.
            </Typography>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Edit />
                <Typography variant="subtitle1" sx={{ fontWeight: 600}}>Hvordan redigere hendelser</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                <ListItem>
                  <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                  <ListItemText 
                    primary="Klikk på 'Rediger' ved en hendelse"
                    secondary="Du kan legge til beskrivelse, lokasjon, deltakere og spesielle ønsker"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><Pending color="info" /></ListItemIcon>
                  <ListItemText 
                    primary="Endringer må godkjennes"
                    secondary="Når du lagrer endringer, vil de vises med 'VENTER PÅ GODKJENNING' badge. Fotografen din vil gjennomgå dem."
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Schedule />
                <Typography variant="subtitle1" sx={{ fontWeight: 600}}>Følge tidslinjen på arrangementsdagen</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                <ListItem>
                  <ListItemIcon><CalendarToday color="primary" /></ListItemIcon>
                  <ListItemText 
                    primary="Tidslinjen oppdateres automatisk"
                    secondary="Du ser hvilken aktivitet som pågår nå og hva som kommer neste"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                  <ListItemText 
                    primary="Fullførte aktiviteter markeres"
                    secondary="Aktiviteter som er over vises med grønn farge"
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <GetApp />
                <Typography variant="subtitle1" sx={{ fontWeight: 600}}>Eksporter til kalender</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Klikk på nedlastingsikonet for å eksportere hele tidslinjen til din kalenderapp (Google Calendar, Apple Calendar, Outlook, etc.)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Filen lastes ned i iCal-format (.ics) som støttes av alle moderne kalenderapper.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Share />
                <Typography variant="subtitle1" sx={{ fontWeight: 600}}>Dele tidslinjen</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                Bruk delingsknappen for å dele tidslinjen med familie og venner. De trenger tilgangskoden for å se tidslinjen.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Trenger du hjelp?
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Kontakt fotografen din hvis du har spørsmål eller trenger hjelp med tidslinjen.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} variant="contained" sx={theming.getThemedButtonSx()}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  // Admin help modal
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: theming.colors.primary, color: 'white' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HelpOutline />
          <Typography variant="h6">Evendi Tidslinje - Administrasjon</Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Event />
            Administrere Evendi tidslinje
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Her kan du opprette og administrere tidslinjer, gi klienter tilgang, og håndtere endringsforespørsler.
          </Typography>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Event />
              <Typography variant="subtitle1" sx={{ fontWeight: 600}}>Opprette tidslinje</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <List>
              <ListItem>
                <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                <ListItemText 
                  primary="Velg prosjekt eller opprett ny"
                  secondary="Tidslinjen kan knyttes til et eksisterende bryllupsprosjekt"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                <ListItemText 
                  primary="Kulturtilpassede maler"
                  secondary="Systemet tilbyr forhåndsutfylte tidslinjer basert på kulturtype (norsk, sikh, indisk, etc.)"
                />
              </ListItem>
            </List>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <People />
              <Typography variant="subtitle1" sx={{ fontWeight: 600}}>Klienttilgang</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <List>
              <ListItem>
                <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                <ListItemText 
                  primary="Generer tilgangskode"
                  secondary="En unik tilgangskode genereres automatisk. Du kan også sette PIN eller passord for ekstra sikkerhet."
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                <ListItemText 
                  primary="Del med klienter"
                  secondary="Send tilgangskoden via e-post eller del direkte link. Klienter kan se tidslinjen uten å logge inn."
                />
              </ListItem>
            </List>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Pending />
              <Typography variant="subtitle1" sx={{ fontWeight: 600}}>Håndtere endringsforespørsler</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Når klienter foreslår endringer, vil de vises med en "Klientendring" badge i tidslinjen.
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Godkjenn endringer"
                  secondary="Gjennomgå klientnotater og godkjenn eller avvis endringsforespørsler"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><Pending color="info" /></ListItemIcon>
                <ListItemText 
                  primary="Se alle endringer"
                  secondary="Bruk 'Endringer' fanen for å se alle klientkommentarer og endringsforespørsler"
                />
              </ListItem>
            </List>
          </AccordionDetails>
        </Accordion>

        <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            Tips
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • Aktiver klienttilgang tidlig slik at paret kan se og kommentere tidslinjen<br/>
            • Bruk kulturtilpassede maler for å spare tid<br/>
            • Svar raskt på endringsforespørsler for best kundeopplevelse
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained" sx={theming.getThemedButtonSx()}>
          Lukk
        </Button>
      </DialogActions>
    </Dialog>
  );
}
