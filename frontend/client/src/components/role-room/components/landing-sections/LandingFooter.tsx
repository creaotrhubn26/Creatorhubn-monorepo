import { memo } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import PublicSocialLinks from '@/components/common/PublicSocialLinks';
import { getPublicSocialProfiles } from '@/lib/publicBrandLinks';

const roleRoomSocialLinks = getPublicSocialProfiles('roleRoom');

interface LandingFooterProps {
  onAdminLoginClick: () => void;
}

function LandingFooterImpl({ onAdminLoginClick }: LandingFooterProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 2.2, duration: 1 }}
    >
      <Box
        component="footer"
        sx={{
          mt: 12,
          textAlign: 'center',
          color: 'rgba(255,255,255,0.35)',
          fontSize: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <PublicSocialLinks
          label="Sosiale medier"
          body="Følg The Role Room for nye verktøy, case og produktoppdateringer fra produksjonsmiljøet."
          links={roleRoomSocialLinks}
          tone="roleRoom"
          align="center"
          maxWidth={420}
        />
        <Box sx={{ width: 72, height: 1, bgcolor: 'rgba(255,255,255,0.12)' }} />
        <Typography>Et produkt av</Typography>
        <Box
          component="img"
          src="/creatorhub-wordmark-light.png"
          alt="CreatorHub"
          loading="lazy"
          sx={{
            height: { xs: 24, sm: 28 },
            width: 'auto',
            opacity: 0.78,
          }}
        />
        <Button
          type="button"
          onClick={onAdminLoginClick}
          sx={{
            mt: 0.75,
            minHeight: 36,
            px: 1.75,
            textTransform: 'none',
            borderRadius: '999px',
            color: 'rgba(255,255,255,0.72)',
            border: '1px solid rgba(255,255,255,0.14)',
            bgcolor: 'rgba(255,255,255,0.03)',
            '&:hover': {
              color: '#fff',
              borderColor: 'rgba(139,92,246,0.45)',
              bgcolor: 'rgba(139,92,246,0.12)',
            },
          }}
        >
          Admin login
        </Button>
        <Stack
          direction="row"
          spacing={1.25}
          flexWrap="wrap"
          justifyContent="center"
          sx={{ color: 'rgba(255,255,255,0.58)' }}
        >
          <Button
            variant="text"
            href="/privacy-policy"
            sx={{
              minWidth: 'auto',
              px: 0.25,
              color: 'inherit',
              textTransform: 'none',
              '&:hover': { color: '#fff', backgroundColor: 'transparent' },
            }}
          >
            Personvernerklæring
          </Button>
          <Typography component="span" sx={{ opacity: 0.35, alignSelf: 'center' }}>
            •
          </Typography>
          <Button
            variant="text"
            href="/terms-and-conditions"
            sx={{
              minWidth: 'auto',
              px: 0.25,
              color: 'inherit',
              textTransform: 'none',
              '&:hover': { color: '#fff', backgroundColor: 'transparent' },
            }}
          >
            Vilkår og betingelser
          </Button>
        </Stack>
      </Box>
    </motion.div>
  );
}

export const LandingFooter = memo(LandingFooterImpl);
LandingFooter.displayName = 'LandingFooter';
