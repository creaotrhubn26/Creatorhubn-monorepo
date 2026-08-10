/**
 * VaultSecurityGuide — full sikkerhetsguide for The Role Room Vault.
 *
 * Vises som modal når bruker klikker "Slik fungerer sikkerheten" i
 * Client Access Vault-headeren. Forklarer kryptering, 2FA-step-up,
 * reveal-flyt, audit-log og rolle-modell på lekmannsspråk så
 * markedsføreren kan forsikre klienten om at deres passord er trygge.
 *
 * Strukturen følger Bruce Schneiers prinsipp: "trust through
 * transparency" — vis nøyaktig hva som skjer i bakgrunnen så
 * brukeren kan bestemme om de stoler på løsningen.
 */

import React, { useState, useMemo } from 'react';
import { useT } from '../../../../i18n';
type TFn = ReturnType<typeof useT>['t'];
import {
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  Shield as ShieldIcon,
  Lock as LockIcon,
  Key as KeyIcon,
  Visibility as VisibilityIcon,
  History as HistoryIcon,
  AdminPanelSettings as RoleIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';

export interface VaultSecurityGuideProps {
  open: boolean;
  onClose: () => void;
}

interface GuideSection {
  id: string;
  title: string;
  Icon: React.ElementType;
  iconColor: string;
  oneLineSummary: string;
  details: React.ReactNode;
}

// ── Helpers (deklarert FØR SECTIONS siden de refereres i details-feltet
//   ved modul-evaluering, ikke senere ved render) ───────────────────────

interface RoleCardProps {
  role: string;
  permissions: string[];
  color: string;
}

const RoleCard: React.FC<RoleCardProps> = ({ role, permissions, color }) => (
  <Box
    sx={{
      p: 1.2,
      borderRadius: 1,
      bgcolor: 'rgba(15,23,42,0.5)',
      borderLeft: `3px solid ${color}`,
    }}
  >
    <Typography sx={{ fontSize: '0.86rem', fontWeight: 700, color: '#f8fafc', mb: 0.4 }}>
      {role}
    </Typography>
    <Stack spacing={0.2}>
      {permissions.map((p) => (
        <Typography key={p} sx={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.7)' }}>
          • {p}
        </Typography>
      ))}
    </Stack>
  </Box>
);

const infoBoxSx = {
  p: 1.4,
  borderRadius: 1,
  bgcolor: 'rgba(15,23,42,0.45)',
  border: '1px solid rgba(148,163,184,0.16)',
} as const;

const codeSx: React.CSSProperties = {
  fontFamily: '"SF Mono", Menlo, monospace',
  fontSize: '0.85em',
  background: 'rgba(34,211,238,0.12)',
  color: 'var(--role-cyan, #22d3ee)',
  padding: '1px 5px',
  borderRadius: 3,
};

const buildSECTIONS = (t: TFn): GuideSection[] => ([
  {
    id: 'encryption',
    title: t('vaultGuide.s003'),
    Icon: LockIcon,
    iconColor: 'var(--role-cyan, #22d3ee)',
    oneLineSummary: t('vaultGuide.s010'),
    details: (
      <Stack spacing={1.4}>
        <Typography sx={{ fontSize: '0.88rem', color: 'rgba(226,232,240,0.8)', lineHeight: 1.6 }}>
          
          {t('vaultGuide.s066')} <strong>AES-256-GCM</strong>  {t('vaultGuide.s085')}
        </Typography>
        <Box sx={infoBoxSx}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--role-cyan, #22d3ee)', mb: 0.4 }}>
            
            {t('vaultGuide.s034')}
          </Typography>
          <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.78)', lineHeight: 1.6 }}>
            
            {t('vaultGuide.s045')} <code style={codeSx}>v1.A3kQ...gT4=.x9pK...zR2=</code>  {t('vaultGuide.s083')}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.6)' }}>
          
          {t('vaultGuide.s062')}
        </Typography>
      </Stack>
    ),
  },
  {
    id: 'mfa',
    title: t('vaultGuide.s004'),
    Icon: ShieldIcon,
    iconColor: '#a78bfa',
    oneLineSummary: t('vaultGuide.s073'),
    details: (
      <Stack spacing={1.4}>
        <Typography sx={{ fontSize: '0.88rem', color: 'rgba(226,232,240,0.8)', lineHeight: 1.6 }}>
          
          {t('vaultGuide.s051')} <strong>se</strong>  {t('vaultGuide.s082')}
        </Typography>
        <Box sx={infoBoxSx}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#a78bfa', mb: 0.6 }}>
            
            {t('vaultGuide.s077')}
          </Typography>
          <Stack spacing={0.8}>
            <Stack direction="row" spacing={1.2} alignItems="flex-start">
              <CheckIcon sx={{ color: '#a78bfa', fontSize: 18, mt: 0.2 }} />
              <Box>
                <Typography sx={{ fontSize: '0.84rem', fontWeight: 600, color: '#f8fafc' }}>
                  
                  {t('vaultGuide.s017')}
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.65)' }}>
                  
                  {t('vaultGuide.s032')}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1.2} alignItems="flex-start">
              <CheckIcon sx={{ color: '#a78bfa', fontSize: 18, mt: 0.2 }} />
              <Box>
                <Typography sx={{ fontSize: '0.84rem', fontWeight: 600, color: '#f8fafc' }}>
                  
                  {t('vaultGuide.s027')}
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.65)' }}>
                  
                  {t('vaultGuide.s043')}
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </Box>
        <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.7)', lineHeight: 1.6 }}>
          <strong>{t('vaultGuide.s048')}</strong>  {t('vaultGuide.s046')}
        </Typography>
      </Stack>
    ),
  },
  {
    id: 'reveal',
    title: t('vaultGuide.s005'),
    Icon: VisibilityIcon,
    iconColor: '#34d399',
    oneLineSummary: t('vaultGuide.s029'),
    details: (
      <Stack spacing={1.4}>
        <Typography sx={{ fontSize: '0.88rem', color: 'rgba(226,232,240,0.8)', lineHeight: 1.6 }}>
          
          {t('vaultGuide.s039')}
        </Typography>
        <Stepper orientation="vertical" sx={{ pl: 0, '& .MuiStepIcon-root': { color: '#34d399' } }}>
          <Step active>
            <StepLabel sx={{ '& .MuiStepLabel-label': { color: '#f8fafc', fontWeight: 700 } }}>
              
              {t('vaultGuide.s019')}
            </StepLabel>
            <StepContent sx={{ borderColor: 'rgba(52,211,153,0.3)' }}>
              <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.7)' }}>
                
                {t('vaultGuide.s026')} <code style={codeSx}>pending</code>.
              </Typography>
            </StepContent>
          </Step>
          <Step active>
            <StepLabel sx={{ '& .MuiStepLabel-label': { color: '#f8fafc', fontWeight: 700 } }}>
              
              {t('vaultGuide.s031')}
            </StepLabel>
            <StepContent sx={{ borderColor: 'rgba(52,211,153,0.3)' }}>
              <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.7)' }}>
                
                {t('vaultGuide.s047')} <code style={codeSx}>approval_required</code>{t('vaultGuide.s002')}
              </Typography>
            </StepContent>
          </Step>
          <Step active>
            <StepLabel sx={{ '& .MuiStepLabel-label': { color: '#f8fafc', fontWeight: 700 } }}>
              
              {t('vaultGuide.s070')}
            </StepLabel>
            <StepContent sx={{ borderColor: 'rgba(52,211,153,0.3)' }}>
              <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.7)' }}>
                
                {t('vaultGuide.s067')}
              </Typography>
            </StepContent>
          </Step>
        </Stepper>
        <Box sx={infoBoxSx}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#34d399', mb: 0.4 }}>
            
            {t('vaultGuide.s072')}
          </Typography>
          <Stack spacing={0.4}>
            <Typography sx={{ fontSize: '0.8rem', color: 'rgba(226,232,240,0.78)' }}>
              • <code style={codeSx}>approval_required</code>  {t('vaultGuide.s084')}
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: 'rgba(226,232,240,0.78)' }}>
              • <code style={codeSx}>mfa_required</code>  {t('vaultGuide.s087')}
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: 'rgba(226,232,240,0.78)' }}>
              • <code style={codeSx}>one_time</code>  {t('vaultGuide.s086')}
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: 'rgba(226,232,240,0.78)' }}>
              • <code style={codeSx}>manual_only</code>  {t('vaultGuide.s088')}
            </Typography>
          </Stack>
        </Box>
      </Stack>
    ),
  },
  {
    id: 'audit',
    title: t('vaultGuide.s006'),
    Icon: HistoryIcon,
    iconColor: '#fbbf24',
    oneLineSummary: t('vaultGuide.s041'),
    details: (
      <Stack spacing={1.4}>
        <Typography sx={{ fontSize: '0.88rem', color: 'rgba(226,232,240,0.8)', lineHeight: 1.6 }}>
          
          {t('vaultGuide.s038')} <strong>append-only</strong>{t('vaultGuide.s009')}
        </Typography>
        <Box sx={infoBoxSx}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#fbbf24', mb: 0.6 }}>
            
            {t('vaultGuide.s024')}
          </Typography>
          <Stack spacing={0.4}>
            {[
              t('vaultGuide.s036'),
              t('vaultGuide.s065'),
              t('vaultGuide.s042'),
              t('vaultGuide.s020'),
              t('vaultGuide.s063'),
              t('vaultGuide.s037'),
              t('vaultGuide.s049'),
              t('vaultGuide.s076'),
            ].map((item) => (
              <Stack key={item} direction="row" spacing={0.8} alignItems="flex-start">
                <CheckIcon sx={{ color: '#fbbf24', fontSize: 14, mt: 0.3 }} />
                <Typography sx={{ fontSize: '0.8rem', color: 'rgba(226,232,240,0.78)' }}>
                  {item}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
        <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.7)', lineHeight: 1.6 }}>
          
          {t('vaultGuide.s044')}
        </Typography>
      </Stack>
    ),
  },
  {
    id: 'roles',
    title: t('vaultGuide.s007'),
    Icon: RoleIcon,
    iconColor: '#f87171',
    oneLineSummary: t('vaultGuide.s018'),
    details: (
      <Stack spacing={1.4}>
        <Typography sx={{ fontSize: '0.88rem', color: 'rgba(226,232,240,0.8)', lineHeight: 1.6 }}>
          
          {t('vaultGuide.s050')}
        </Typography>
        <Stack spacing={0.8}>
          <RoleCard
            role="Director / Producer / Content Producer"
            permissions={[t('vaultGuide.s060'), t('vaultGuide.s055'), t('vaultGuide.s057')]}
            color="#34d399"
          />
          <RoleCard
            role="Production Manager"
            permissions={[t('vaultGuide.s056'), t('vaultGuide.s053'), t('vaultGuide.s052')]}
            color="#fbbf24"
          />
          <RoleCard
            role={t('vaultGuide.s021')}
            permissions={[t('vaultGuide.s058'), t('vaultGuide.s054')]}
            color="#a78bfa"
          />
          <RoleCard
            role={t('vaultGuide.s022')}
            permissions={[t('vaultGuide.s059'), t('vaultGuide.s030')]}
            color="#94a3b8"
          />
        </Stack>
      </Stack>
    ),
  },
  {
    id: 'integrity',
    title: t('vaultGuide.s008'),
    Icon: KeyIcon,
    iconColor: 'var(--role-cyan, #22d3ee)',
    oneLineSummary: t('vaultGuide.s068'),
    details: (
      <Stack spacing={1}>
        {[
          {
            title: t('vaultGuide.s013'),
            body: t('vaultGuide.s011'),
          },
          {
            title: t('vaultGuide.s014'),
            body: t('vaultGuide.s081'),
          },
          {
            title: t('vaultGuide.s015'),
            body: t('vaultGuide.s069'),
          },
          {
            title: t('vaultGuide.s012'),
            body: t('vaultGuide.s023'),
          },
          {
            title: t('vaultGuide.s078'),
            body: t('vaultGuide.s074'),
          },
          {
            title: t('vaultGuide.s016'),
            body: t('vaultGuide.s040'),
          },
          {
            title: t('vaultGuide.s071'),
            body: t('vaultGuide.s061'),
          },
        ].map((item) => (
          <Stack key={item.title} direction="row" spacing={1} alignItems="flex-start" sx={{ p: 1.2, borderRadius: 1, bgcolor: 'rgba(34,211,238,0.04)' }}>
            <CheckIcon sx={{ color: 'var(--role-cyan, #22d3ee)', fontSize: 18, mt: 0.2 }} />
            <Box>
              <Typography sx={{ fontSize: '0.86rem', fontWeight: 700, color: '#f8fafc' }}>
                {item.title}
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', color: 'rgba(226,232,240,0.7)', lineHeight: 1.55 }}>
                {item.body}
              </Typography>
            </Box>
          </Stack>
        ))}
      </Stack>
    ),
  },
]);

const VaultSecurityGuide: React.FC<VaultSecurityGuideProps> = ({ open, onClose }) => {
  const { t } = useT();
  const [expandedSection, setExpandedSection] = useState<string | null>('encryption');
  const SECTIONS = useMemo(() => buildSECTIONS(t), [t]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      PaperProps={{
        sx: {
          bgcolor: '#0b1226',
          color: '#f8fafc',
          maxHeight: '92vh',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1.4, borderBottom: '1px solid rgba(148,163,184,0.18)' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.4}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                bgcolor: 'rgba(34,211,238,0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldIcon sx={{ color: 'var(--role-cyan, #22d3ee)', fontSize: 24 }} />
            </Box>
            <Stack spacing={0.2}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', color: '#f8fafc' }}>
                
                {t('vaultGuide.s075')}
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', color: 'rgba(226,232,240,0.6)' }}>
                
                {t('vaultGuide.s079')}
              </Typography>
            </Stack>
          </Stack>
          <IconButton onClick={onClose} sx={{ color: '#cbd5e1' }}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 2.4 }}>
        <Box
          sx={{
            mb: 2.4,
            p: 1.8,
            borderRadius: 1.5,
            bgcolor: 'rgba(34,211,238,0.06)',
            border: '1px solid rgba(34,211,238,0.2)',
          }}
        >
          <Typography sx={{ fontSize: '0.92rem', color: '#f8fafc', fontWeight: 700, mb: 0.6 }}>
            
            {t('vaultGuide.s028')}
          </Typography>
          <Typography sx={{ fontSize: '0.86rem', color: 'rgba(226,232,240,0.78)', lineHeight: 1.6 }}>
            
            {t('vaultGuide.s080')}
          </Typography>
        </Box>

        <Stack spacing={1}>
          {SECTIONS.map((section) => {
            const isExpanded = expandedSection === section.id;
            const Icon = section.Icon;
            return (
              <Box
                key={section.id}
                sx={{
                  borderRadius: 1.5,
                  border: `1px solid ${isExpanded ? `${section.iconColor}55` : 'rgba(148,163,184,0.18)'}`,
                  bgcolor: isExpanded ? `${section.iconColor}08` : 'rgba(15,23,42,0.45)',
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                }}
              >
                <Button
                  fullWidth
                  onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                  sx={{
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    py: 1.4,
                    px: 1.8,
                    textTransform: 'none',
                    color: 'inherit',
                    '&:hover': { bgcolor: 'transparent' },
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1.4} sx={{ flex: 1, minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        bgcolor: `${section.iconColor}18`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon sx={{ color: section.iconColor, fontSize: 18 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: '#f8fafc' }}>
                        {section.title}
                      </Typography>
                      <Typography sx={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.62)', mt: 0.1 }}>
                        {section.oneLineSummary}
                      </Typography>
                    </Box>
                    <ExpandMoreIcon
                      sx={{
                        color: 'rgba(226,232,240,0.5)',
                        transition: 'transform 0.2s',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    />
                  </Stack>
                </Button>
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Box sx={{ px: 2.2, pb: 2.2, pt: 0.4 }}>
                    {section.details}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Stack>

        <Box
          sx={{
            mt: 3,
            p: 1.8,
            borderRadius: 1.5,
            bgcolor: 'rgba(52,211,153,0.06)',
            border: '1px solid rgba(52,211,153,0.2)',
          }}
        >
          <Stack direction="row" alignItems="flex-start" spacing={1.2}>
            <CheckIcon sx={{ color: '#34d399', mt: 0.2 }} />
            <Box>
              <Typography sx={{ fontSize: '0.92rem', fontWeight: 700, color: '#f0fdf4', mb: 0.4 }}>
                
                {t('vaultGuide.s035')}
              </Typography>
              <Typography sx={{ fontSize: '0.84rem', color: 'rgba(220,252,231,0.78)', lineHeight: 1.6 }}>
                
                {t('vaultGuide.s025')} <em>{t('vaultGuide.s001')}</em>
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: 'rgba(220,252,231,0.6)', mt: 1, lineHeight: 1.55 }}>
                
                {t('vaultGuide.s064')}
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Box sx={{ mt: 2.4, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            onClick={onClose}
            variant="contained"
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              bgcolor: 'var(--role-cyan, #22d3ee)',
              color: '#0b1226',
              px: 2.4,
              '&:hover': { bgcolor: '#06b6d4' },
            }}
          >
            
            {t('vaultGuide.s033')}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default VaultSecurityGuide;
