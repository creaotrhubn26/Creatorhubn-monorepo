declare module 'chroma-js' {
  namespace chroma {
    interface Color {
      rgb(): [number, number, number];
      hsl(): [number, number, number];
      get(format: string): number;
      luminance(): number;
      luminance(value: number): Color;
      hex(): string;
      css(format?: string): string;
      alpha(value: number): Color;
      darken(amount?: number): Color;
      brighten(amount?: number): Color;
      saturate(amount?: number): Color;
      desaturate(amount?: number): Color;
      mix(other: Color | string, ratio?: number, mode?: string): Color;
    }

    interface Scale {
      mode(mode: 'lch' | 'lab' | 'hsl' | 'hsv' | 'rgb' | 'lrgb' | 'hcl'): Scale;
      domain(values: number[]): Scale;
      colors(count: number, format?: 'hex' | 'rgb'): string[];
      (value: number): Color;
    }
  }

  interface ChromaStatic {
    (input: string | number | [number, number, number] | [number, number, number, number]): chroma.Color;
    hsl(h: number, s: number, l: number): chroma.Color;
    hsv(h: number, s: number, v: number): chroma.Color;
    lab(l: number, a: number, b: number): chroma.Color;
    lch(l: number, c: number, h: number): chroma.Color;
    rgb(r: number, g: number, b: number): chroma.Color;
    scale(colors?: Array<string | chroma.Color>): chroma.Scale;
    mix(c1: string | chroma.Color, c2: string | chroma.Color, ratio?: number, mode?: string): chroma.Color;
    contrast(c1: string | chroma.Color, c2: string | chroma.Color): number;
    valid(input: unknown): boolean;
  }

  const chroma: ChromaStatic;
  export default chroma;
}
