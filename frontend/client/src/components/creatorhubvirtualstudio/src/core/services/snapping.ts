export function snap(value: number, step = 0.1): number {
  return Math.round(value / step) * step;
}

export function snapVec3(
  [x, y, z]: [number, number, number],
  step = 0.1,
): [number, number, number] {
  return [snap(x, step), snap(y, step), snap(z, step)];
}
