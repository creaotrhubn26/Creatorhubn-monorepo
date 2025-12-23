export function distance3D(a: [number, number, number], b: [number, number, number]) {
  const dx = a[0] - b[0],
    dy = a[1] - b[1],
    dz = a[2] - b[2];
  return Math.hypot(dx, dy, dz);
}
