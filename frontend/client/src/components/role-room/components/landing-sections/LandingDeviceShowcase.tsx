import { memo } from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import DeviceMockup from '../DeviceMockup';

/**
 * Device-showcase med Mac, iPad og iPhone-mockups. Tung visuell seksjon
 * under fold — lazy-loaded.
 */
function LandingDeviceShowcaseImpl() {
  return (
    <Box sx={{ mb: 10, mt: 4 }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
      >
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <Typography
            component="h2"
            sx={{
              fontFamily: '"Courier New", Courier, monospace',
              fontSize: { xs: '1rem', md: '1.1rem' },
              fontWeight: 700,
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              mb: 1.5,
              background: 'linear-gradient(90deg, #fff 0%, #8b5cf6 55%, #6366f1 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Bruk hvor du jobber
          </Typography>
          <Typography
            sx={{
              color: 'rgba(255,255,255,0.72)',
              fontSize: { xs: '0.92rem', md: '1.02rem' },
              maxWidth: 620,
              mx: 'auto',
              lineHeight: 1.6,
            }}
          >
            Bygget for desktop, tablet og telefon — naturlig flyt fra forberedelse i studio til reaksjon i felt.
          </Typography>
        </Box>
      </motion.div>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.4fr 1.1fr 0.6fr' },
          gap: { xs: 4, md: 3 },
          alignItems: 'end',
          justifyItems: 'center',
          px: { xs: 0, md: 2 },
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.7 }}
        >
          <DeviceMockup
            variant="macbook"
            screenshotUrl="/role-room-assets/roleroom_dashboard.webp"
            screenshotAlt="The Role Room dashboard på MacBook — full oversikt over prosjekt, roller og kandidater"
            caption="Planlegg på Mac · full produksjonsoversikt"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.25, duration: 0.7 }}
        >
          <DeviceMockup
            variant="ipad"
            screenshotUrl="/role-room-assets/roleroom_calender.webp"
            screenshotAlt="The Role Room kalender på iPad — opptaksdager og crew-tilgjengelighet"
            caption="Koordiner på iPad · opptaksdager og crew-plan"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.7 }}
        >
          <DeviceMockup
            variant="iphone"
            screenshotUrl="/role-room-assets/roleroom_castingcall.webp"
            screenshotAlt="The Role Room casting på iPhone — reager på audition-respons i felt"
            caption="Reager på iPhone · audition-status i felt"
          />
        </motion.div>
      </Box>
    </Box>
  );
}

const LandingDeviceShowcase = memo(LandingDeviceShowcaseImpl);
LandingDeviceShowcase.displayName = 'LandingDeviceShowcase';

export default LandingDeviceShowcase;
