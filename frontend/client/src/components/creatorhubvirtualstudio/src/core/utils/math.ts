export const add3 = (
  a: [number, number, number],
  b: [number, number, number],
): [number, number, number] => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (
  a: [number, number, number],
  b: [number, number, number],
): [number, number, number] => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul3 = (a: [number, number, number], s: number): [number, number, number] => [
  a[0] * s,
  a[1] * s,
  a[2] * s,
];
