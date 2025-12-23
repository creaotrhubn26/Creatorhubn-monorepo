// Inverse-square falloff with optional beam angle attenuation
export function intensityAt(
  power: number,
  distanceMeters: number,
  beamDegrees?: number,
  angleFromAxisDegrees?: number,
) {
  const d = Math.max(0.05, distanceMeters);
  let intensity = power / (d * d);
  if (beamDegrees && angleFromAxisDegrees !== undefined) {
    const half = Math.max(1, beamDegrees / 2);
    const a = Math.abs(angleFromAxisDegrees);
    const fall = a <= half ? 1 - (a / half) * 0.7 : 0.2 * Math.max(0, 1 - (a - half) / half);
    intensity *= Math.max(0, fall);
  }
  return intensity;
}

// CCT to RGB (very rough approximation)
export function cctToRgb(kelvin: number): [number, number, number] {
  // clamp
  const t = Math.max(1000, Math.min(40000, kelvin)) / 100;
  // approximate formula
  let r, g, b;
  // red
  r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  // green
  g =
    t <= 66
      ? 99.4708025861 * Math.log(t) - 161.1195681661
      : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  // blue
  if (t >= 66) b = 255;
  else if (t <= 19) b = 0;
  else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [
    Math.max(0, Math.min(255, r)) / 255,
    Math.max(0, Math.min(255, g)) / 255,
    Math.max(0, Math.min(255, b)) / 255,
  ];
}

// Exposure helper (EV100)
export function exposureValue(aperture: number, shutter: number, iso: number) {
  const ev = Math.log2((aperture * aperture) / shutter) - Math.log2(iso / 100);
  return ev;
}
