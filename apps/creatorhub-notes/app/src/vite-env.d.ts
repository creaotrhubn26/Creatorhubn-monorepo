/** `?raw` gir fila som en streng. Brukes av tilgjengelighetstesten, som måler
 *  kontrastene i `styles.css` i stedet for å skrive tallene av: setter noen
 *  `--ink-faint` tilbake til en farge under kravet, feiler testen.
 *
 *  Erklæringen står her fordi `tsconfig.json` har `types: []` — uten den ville
 *  tsc dratt inn @types-pakker fra monorepoets rot som ikke er installert. */
declare module "*.css?raw" {
  const innhold: string;
  export default innhold;
}
