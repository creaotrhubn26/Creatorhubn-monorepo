import * as React from 'react';
import { Box, Stack, Typography, Divider } from '@mui/material';
import { useNodes } from '@/state/selectors';
import { getThreeScene, getActiveCameraId, setActiveCameraId } from '@/core/services/viewports';

let THREE: any = null;
try {
  THREE = require('three');
} catch {}

function CameraThumb({ node }: { node: any }) {
  const ref = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    if (!THREE || !ref.current) return;
    const scene = getThreeScene();
    if (!scene) return;
    const canvas = ref.current!;
    canvas.width = 160;
    canvas.height = 100;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(160, 100, false);
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = Math.pow(2, -(node.userData?.video?.ndStops || 0));
    const cam = new THREE.PerspectiveCamera(50, 160 / 100, 0.1, 100);
    const sensor = node.camera?.sensor || [36, 24];
    const focal = node.camera?.focalLength || 50;
    const fovRad = 2 * Math.atan(sensor[1] / 2 / focal);
    cam.fov = (fovRad * 180) / Math.PI;
    cam.position.set(
      node.transform.position[0],
      node.transform.position[1],
      node.transform.position[2],
    );
    cam.lookAt(0, node.transform.position[1], 0);
    cam.updateProjectionMatrix();

    let raf: number;
    const loop = () => {
      renderer.render(scene, cam);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
    };
  }, [node?.id]);

  return (
    <canvas
      ref={ref}
      style={{
        width: '100%',
        height: 120,
        display: 'block',
        borderRadius: 8,
        border: '1px solid #e2e8f0'}}
    />
  );
}

export default function MultiCameraView() {
  const nodes = useNodes();
  const cams = nodes.filter((n) => n.camera);
  const active = getActiveCameraId();

  return (
    <Box sx={{ p: 1 }}>
      <Typography fontWeight={700}>Cameras ({cams.length})</Typography>
      <Divider sx={{ my: 1 }} />
      <Stack direction="row" spacing={1}>
        {cams.map((c) => {
          const isActive = c.id === active;
          return (
            <Box
              key={c.id}
              sx={{
                width: 180,
                cursor: 'pointer',
                borderRadius: 2,
                border: isActive ? '2px solid #2563eb' : '2px solid transparent',
                p: isActive ? 0 : 0}}
              onClick={() => setActiveCameraId(c.id)}
            >
              <CameraThumb node={c} />
              <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>
                {c.name || c.id}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
