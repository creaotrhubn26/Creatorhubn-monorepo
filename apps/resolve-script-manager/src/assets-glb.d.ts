// Vite laster .glb som asset-URL; TS trenger en modul-deklarasjon.
declare module '*.glb' {
  const src: string;
  export default src;
}
