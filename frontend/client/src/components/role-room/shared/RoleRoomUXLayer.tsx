/**
 * RoleRoomUXLayer — bundled UX-komponenter som skal være på ALLE
 * RoleRoom-workspaces (Dance, Casting, Talent, Education, Producer, etc.).
 *
 * Inkluderer (alle valgfrie):
 *   • CommandPalette  — Cmd+K søk over workspace-spesifikke kommandoer
 *   • ProfessionModeChip — modus-indikator i topp (hvis mode er gitt)
 *   • HelpButton — fixed bottom-right (kun én instans per side)
 *   • FirstTimeTour — første-gangs-overlay (per workspace-id)
 *
 * SessionExpiredModal er allerede globalt i App.tsx — ikke duplisert her.
 *
 * Eksempel:
 *   <RoleRoomUXLayer
 *     workspaceId="casting-v1"
 *     mode={professionMode}
 *     onSwitchMode={(m) => navigate(`?mode=${m}`)}
 *     commands={castingCommands}
 *     tourSteps={[{ title: 'Velkommen', body: '...', icon: ... }]}
 *   >
 *     {children}
 *   </RoleRoomUXLayer>
 */

import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import CommandPalette, { type Command } from './CommandPalette';
import ProfessionModeChip from './ProfessionModeChip';
import HelpButton from './HelpButton';
import FirstTimeTour, { type TourStep } from './FirstTimeTour';
import type { ProfessionMode } from '../config/professionMode';

interface RoleRoomUXLayerProps {
  /** Hvilken workspace dette er — brukt som key for first-time-tour */
  workspaceId: string;
  /** Nåværende profession-modus. Hvis satt, vises chip i header. */
  mode?: ProfessionMode | string | null;
  /** Bytte-handler for modus. Hvis utelatt, vises chip uten dropdown. */
  onSwitchMode?: (mode: ProfessionMode) => void;
  /** Kommandoer for Cmd+K-søk i denne workspace */
  commands?: Command[];
  /** Steg for første-gangs-tour */
  tourSteps?: TourStep[];
  /** Skjul help-button (f.eks. på subsidiær side hvor en parent har den) */
  hideHelpButton?: boolean;
  /** Tilpasset header — hvis ikke gitt, viser vi default mode-chip + Cmd+K-hint */
  customHeader?: React.ReactNode;
  /** Support-e-post som vises i help-popoveren */
  supportEmail?: string;
  /** Lenke til changelog/release-notes (fallback hvis whatsNewMode ikke er satt) */
  changelogUrl?: string;
  /**
   * Modus-slug for "Hva er nytt"-feed. Hvis satt henter HelpButton publiserte
   * oppføringer fra /api/whats-new?mode=... og viser en badge for uleste.
   */
  whatsNewMode?: string;
  /** Modal-tittel for "Hva er nytt" (når whatsNewMode er satt) */
  whatsNewTitle?: string;
  children: React.ReactNode;
}

export const RoleRoomUXLayer: React.FC<RoleRoomUXLayerProps> = ({
  workspaceId,
  mode,
  onSwitchMode,
  commands = [],
  tourSteps,
  hideHelpButton = false,
  customHeader,
  supportEmail = 'support@theroleroom.com',
  changelogUrl,
  whatsNewMode,
  whatsNewTitle,
  children,
}) => {
  return (
    <>
      {(mode || customHeader) && (
        <Box
          sx={{
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            flexWrap: 'wrap',
            bgcolor: 'rgba(10,10,10,0.95)',
            borderBottom: '1px solid rgba(139,92,246,0.18)',
          }}
        >
          {customHeader ?? (
            <Stack direction="row" spacing={1} alignItems="center">
              {mode && (
                <ProfessionModeChip mode={mode} onSwitch={onSwitchMode} />
              )}
            </Stack>
          )}
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ fontFamily: 'monospace', fontSize: 11 }}
          >
            <Box
              component="kbd"
              sx={{ px: 0.5, borderRadius: 0.5, bgcolor: 'rgba(255,255,255,0.08)' }}
            >
              ⌘K
            </Box>{' '}
            for å søke
          </Typography>
        </Box>
      )}

      {children}

      {commands.length > 0 && <CommandPalette commands={commands} />}

      {!hideHelpButton && (
        <HelpButton
          supportEmail={supportEmail}
          changelogUrl={changelogUrl}
          mode={whatsNewMode}
          whatsNewTitle={whatsNewTitle}
        />
      )}

      {tourSteps && tourSteps.length > 0 && (
        <FirstTimeTour tourId={workspaceId} steps={tourSteps} />
      )}
    </>
  );
};

export default RoleRoomUXLayer;
