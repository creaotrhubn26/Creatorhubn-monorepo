import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { Cameraswitch as CameraswitchIcon, QrCodeScanner as QrCodeScannerIcon } from '@mui/icons-material';

type ScannerState = 'idle' | 'starting' | 'scanning' | 'unsupported' | 'permission' | 'error';

interface QrCameraScannerProps {
  active: boolean;
  onDetected: (value: string) => void;
  formats?: string[];
  scanTargetLabel?: string;
}

interface MinimalDetection {
  rawValue?: string;
}

interface MinimalBarcodeDetector {
  detect(source: ImageBitmapSource): Promise<MinimalDetection[]>;
}

interface MinimalBarcodeDetectorCtor {
  new (options?: { formats?: string[] }): MinimalBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
}

const SCAN_INTERVAL_MS = 320;
const DETECTION_COOLDOWN_MS = 1200;

export function QrCameraScanner({
  active,
  onDetected,
  formats,
  scanTargetLabel = 'kode',
}: QrCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<MinimalBarcodeDetector | null>(null);
  const intervalRef = useRef<number | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scanBusyRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  const lastDetectedValueRef = useRef('');
  const lastDetectedAtRef = useRef(0);

  const [scannerState, setScannerState] = useState<ScannerState>('idle');
  const [statusMessage, setStatusMessage] = useState('Kamera er ikke aktivert');
  const [restartNonce, setRestartNonce] = useState(0);
  const [scanPulseActive, setScanPulseActive] = useState(false);
  const normalizedTargetLabel = scanTargetLabel.trim() || 'kode';

  const requestedFormats = useMemo(() => {
    const normalized = (formats ?? ['qr_code'])
      .map((format) => String(format).trim().toLowerCase())
      .filter((format) => format.length > 0);
    const unique = Array.from(new Set(normalized));
    return unique.length > 0 ? unique : ['qr_code'];
  }, [formats]);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  const stopScanner = useCallback(() => {
    if (intervalRef.current != null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (feedbackTimeoutRef.current != null) {
      window.clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
    scanBusyRef.current = false;
    setScanPulseActive(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    detectorRef.current = null;
  }, []);

  const playSuccessSound = useCallback(() => {
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new Ctor();
      }
      const context = audioContextRef.current;
      if (context.state === 'suspended') {
        void context.resume();
      }

      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, now);
      oscillator.frequency.exponentialRampToValueAtTime(1180, now + 0.08);
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.13);
    } catch {
      // Ignore audio errors; visual feedback still indicates successful scan.
    }
  }, []);

  useEffect(() => {
    if (!active) {
      stopScanner();
      setScannerState('idle');
      setStatusMessage('Kamera er ikke aktivert');
      return;
    }

    let cancelled = false;

    const startScanner = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerState('unsupported');
        setStatusMessage('Nettleseren støtter ikke kameratilgang');
        return;
      }

      const detectorCtor = (window as unknown as { BarcodeDetector?: MinimalBarcodeDetectorCtor })
        .BarcodeDetector;
      if (!detectorCtor) {
        setScannerState('unsupported');
        setStatusMessage('Kode-deteksjon støttes ikke i denne nettleseren');
        return;
      }

      setScannerState('starting');
      setStatusMessage('Starter kamera...');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((track) => track.stop());
          setScannerState('error');
          setStatusMessage('Fant ikke videovisning for kamera');
          return;
        }

        streamRef.current = stream;
        let detectorFormats = requestedFormats;
        if (typeof detectorCtor.getSupportedFormats === 'function') {
          try {
            const supported = await detectorCtor.getSupportedFormats();
            const supportedLookup = new Set(
              supported.map((format) => format.trim().toLowerCase())
            );
            const matching = requestedFormats.filter((format) =>
              supportedLookup.has(format)
            );
            detectorFormats = matching.length > 0 ? matching : requestedFormats;
          } catch {
            // Ignore and try requested formats directly.
          }
        }

        try {
          detectorRef.current = new detectorCtor({ formats: detectorFormats });
        } catch {
          detectorRef.current = new detectorCtor();
        }
        video.srcObject = stream;
        await video.play();

        if (cancelled) return;

        setScannerState('scanning');
        setStatusMessage(`Pek kamera mot ${normalizedTargetLabel}`);

        intervalRef.current = window.setInterval(async () => {
          if (scanBusyRef.current || !videoRef.current || !detectorRef.current) return;
          if (videoRef.current.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) return;

          scanBusyRef.current = true;
          try {
            const detections = await detectorRef.current.detect(videoRef.current);
            const value = detections
              .map((entry) => (typeof entry.rawValue === 'string' ? entry.rawValue.trim() : ''))
              .find((entry) => entry.length > 0);

            if (!value) return;

            const now = Date.now();
            const isSameAsLast = lastDetectedValueRef.current === value;
            const withinCooldown = now - lastDetectedAtRef.current < DETECTION_COOLDOWN_MS;
            if (isSameAsLast && withinCooldown) return;

            lastDetectedValueRef.current = value;
            lastDetectedAtRef.current = now;
            setStatusMessage(`${normalizedTargetLabel} funnet. Oppdaterer felt...`);
            setScanPulseActive(true);
            playSuccessSound();
            if (feedbackTimeoutRef.current != null) {
              window.clearTimeout(feedbackTimeoutRef.current);
            }
            feedbackTimeoutRef.current = window.setTimeout(() => {
              setScanPulseActive(false);
              setStatusMessage(`Pek kamera mot ${normalizedTargetLabel}`);
            }, 550);
            onDetectedRef.current(value);
          } catch {
            // Ignore transient frame decode errors and continue scanning.
          } finally {
            scanBusyRef.current = false;
          }
        }, SCAN_INTERVAL_MS);
      } catch (error) {
        const errorName =
          error && typeof error === 'object' && 'name' in error
            ? String((error as { name?: string }).name)
            : '';
        if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
          setScannerState('permission');
          setStatusMessage('Kameratilgang ble blokkert. Tillat kamera og prøv igjen.');
          return;
        }
        setScannerState('error');
        setStatusMessage('Kunne ikke starte kamera');
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [active, normalizedTargetLabel, playSuccessSound, requestedFormats, restartNonce, stopScanner]);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current != null) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  return (
    <Box
      sx={{
        mt: 1,
        p: 1.5,
        borderRadius: 2,
        border: '1px solid rgba(255,255,255,0.1)',
        bgcolor: 'rgba(255,255,255,0.02)',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <QrCodeScannerIcon sx={{ color: '#64b5f6', fontSize: 18 }} />
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#fff' }}>
            Kamera-skanner
          </Typography>
        </Stack>
        <Button
          size="small"
          variant="outlined"
          startIcon={<CameraswitchIcon />}
          onClick={() => setRestartNonce((value) => value + 1)}
          sx={{ borderColor: 'rgba(100,181,246,0.6)', color: '#64b5f6' }}
        >
          Start på nytt
        </Button>
      </Stack>

      <Box
        sx={{
          position: 'relative',
          borderRadius: 1.5,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
          bgcolor: '#000',
          minHeight: { xs: 180, sm: 220 },
        }}
      >
        <Box
          component="video"
          ref={videoRef}
          muted
          autoPlay
          playsInline
          sx={{
            width: '100%',
            height: { xs: 180, sm: 220 },
            objectFit: 'cover',
            display: 'block',
            opacity: scannerState === 'scanning' ? 1 : 0.45,
          }}
        />
        {scannerState === 'scanning' && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              border: '2px solid rgba(100,181,246,0.45)',
              borderRadius: 'inherit',
              boxShadow: scanPulseActive
                ? 'inset 0 0 0 2px rgba(76,175,80,0.95), 0 0 36px rgba(76,175,80,0.55)'
                : 'inset 0 0 0 1px rgba(100,181,246,0.4)',
              transition: 'box-shadow 180ms ease, border-color 180ms ease',
              borderColor: scanPulseActive ? 'rgba(76,175,80,0.9)' : 'rgba(100,181,246,0.45)',
            }}
          />
        )}
        {scanPulseActive && (
          <Box
            sx={{
              position: 'absolute',
              top: 10,
              right: 10,
              px: 1.1,
              py: 0.45,
              borderRadius: 999,
              bgcolor: 'rgba(76,175,80,0.95)',
              color: '#05160a',
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.01em',
              boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
              transform: 'translateZ(0)',
            }}
          >
            {normalizedTargetLabel} lest
          </Box>
        )}
        {scannerState !== 'scanning' && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'rgba(0,0,0,0.45)',
              px: 2,
              textAlign: 'center',
            }}
          >
            <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
              {statusMessage}
            </Typography>
          </Box>
        )}
      </Box>

      {(scannerState === 'unsupported' || scannerState === 'permission' || scannerState === 'error') && (
        <Alert
          severity={scannerState === 'permission' ? 'warning' : 'info'}
          sx={{ mt: 1.25 }}
        >
          {statusMessage}. Du kan fortsatt bruke feltet under for å lime inn skannet kode manuelt.
        </Alert>
      )}
      {scannerState === 'scanning' && (
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)', mt: 1, display: 'block' }}>
          {statusMessage}
        </Typography>
      )}
    </Box>
  );
}

export default QrCameraScanner;
