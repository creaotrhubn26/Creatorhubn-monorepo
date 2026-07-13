/**
 * Produktkonfigurasjon. Produktnavnet er BEVISST ikke hardkodet i domenemodellen —
 * det er ren presentasjon og kan endres uten kodeendring i domenet.
 */
export interface ProductConfig {
  productName: string;
  environment: 'development' | 'test' | 'production';
  databaseUrl: string;
  port: number;
  /** Katalog for lokalt objektlager (dokumentinnhold). */
  storageDir: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ProductConfig {
  const environment = (env.NODE_ENV ?? 'development') as ProductConfig['environment'];
  const databaseUrl =
    env.DATABASE_URL ??
    (environment === 'production'
      ? (() => {
          throw new Error('DATABASE_URL må settes i produksjon');
        })()
      : 'postgres://ledgerly:ledgerly_dev@localhost:5432/ledgerly_dev');
  return {
    productName: env.PRODUCT_NAME ?? 'Ledgerly Norge',
    environment,
    databaseUrl,
    port: Number(env.PORT ?? 4310),
    storageDir: env.LEDGERLY_STORAGE_DIR ?? './data/documents',
  };
}
