export type Histogram = { r: number[]; g: number[]; b: number[]; luma: number[] };

export function computeHistogramFromCanvas(canvas: HTMLCanvasElement): Histogram {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.canvas.width = canvas.width;
  ctx.canvas.height = canvas.height;
  ctx.drawImage(canvas, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const hist = {
    r: Array(256).fill(0),
    g: Array(256).fill(0),
    b: Array(256).fill(0),
    luma: Array(256).fill(0),
  } as Histogram;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const y = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    hist.r[r]++;
    hist.g[g]++;
    hist.b[b]++;
    hist.luma[y]++;
  }
  return hist;
}
