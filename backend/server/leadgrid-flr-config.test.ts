/**
 * FLR-oppsettet samlet i én miljøvariabel.
 *
 * Render har et tak på 300 variabler per tjeneste, og produksjonsbackenden
 * står på 300. Fire separate variabler for samme oppsett er fire plasser vi
 * ikke har. Testene her holder på tre ting:
 *
 *   1. Den samlede variabelen konfigurerer FLR alene (minus nøkkelen).
 *   2. Enkeltvariabler overstyrer den, så lokal overstyring og eksisterende
 *      oppsett virker uendret.
 *   3. Ugyldig JSON tar ikke ned Discovery — provideren er fail-closed, og
 *      skal si «ikke konfigurert», ikke kaste.
 */
import { describe, expect, it, vi } from "vitest";
import {
  flrEnvFra,
  isDiscoveryFlrConfigured,
} from "./leadgrid-discovery-flr-provider.js";

// Bare en ikke-tom streng. `normalizedPrivateKey` bytter «\n» mot linjeskift
// og sjekker at noe står igjen — den validerer ikke PEM-strukturen. En ekte
// nøkkelblokk her ville dessuten blitt stoppet av hemmelighets-skanneren før
// push, og med rette.
const NØKKEL = "testnokkel-ikke-ekte";

const SAMLET = JSON.stringify({
  enabled: true,
  environment: "production",
  clientId: "b3bb0492-93e6-4613-b1bf-e8f315f6dd38",
  keyId: "leadgrid-flr-2026-09",
});

describe("flrEnvFra", () => {
  it("konfigurerer FLR fra den samlede variabelen alene", () => {
    const env = flrEnvFra({
      LEADGRID_FLR_CONFIG: SAMLET,
      LEADGRID_FLR_MASKINPORTEN_PRIVATE_KEY: NØKKEL,
    } as NodeJS.ProcessEnv);

    expect(env.LEADGRID_DISCOVERY_FLR_ENABLED).toBe("true");
    expect(env.LEADGRID_FLR_ENVIRONMENT).toBe("production");
    expect(env.LEADGRID_FLR_MASKINPORTEN_KEY_ID).toBe("leadgrid-flr-2026-09");
    expect(isDiscoveryFlrConfigured(env)).toBe(true);
  });

  it("lar enkeltvariabler overstyre den samlede", () => {
    // Typisk lokalt: kjør mot test-Maskinporten uten å skrive om JSON-en.
    const env = flrEnvFra({
      LEADGRID_FLR_CONFIG: SAMLET,
      LEADGRID_FLR_ENVIRONMENT: "test",
      LEADGRID_FLR_MASKINPORTEN_PRIVATE_KEY: NØKKEL,
    } as NodeJS.ProcessEnv);

    expect(env.LEADGRID_FLR_ENVIRONMENT).toBe("test");
    expect(env.LEADGRID_FLR_MASKINPORTEN_CLIENT_ID)
      .toBe("b3bb0492-93e6-4613-b1bf-e8f315f6dd38");
  });

  it("virker som før uten den samlede variabelen", () => {
    const env = flrEnvFra({
      LEADGRID_DISCOVERY_FLR_ENABLED: "true",
      LEADGRID_FLR_ENVIRONMENT: "production",
      LEADGRID_FLR_MASKINPORTEN_CLIENT_ID: "abc",
      LEADGRID_FLR_MASKINPORTEN_KEY_ID: "leadgrid-flr-2026-09",
      LEADGRID_FLR_MASKINPORTEN_PRIVATE_KEY: NØKKEL,
    } as NodeJS.ProcessEnv);

    expect(isDiscoveryFlrConfigured(env)).toBe(true);
  });

  it("godtar enabled som streng, ikke bare boolean", () => {
    const env = flrEnvFra({
      LEADGRID_FLR_CONFIG: '{"enabled":"true","clientId":"a","keyId":"b"}',
      LEADGRID_FLR_MASKINPORTEN_PRIVATE_KEY: NØKKEL,
    } as NodeJS.ProcessEnv);
    expect(env.LEADGRID_DISCOVERY_FLR_ENABLED).toBe("true");
  });

  it("tar ikke ned Discovery på ugyldig JSON", () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = flrEnvFra({
      LEADGRID_FLR_CONFIG: "{ikke json",
      LEADGRID_FLR_MASKINPORTEN_PRIVATE_KEY: NØKKEL,
    } as NodeJS.ProcessEnv);

    // Fail-closed: ikke konfigurert, men heller ingen kastet feil.
    expect(isDiscoveryFlrConfigured(env)).toBe(false);
    expect(advarsel).toHaveBeenCalled();
    advarsel.mockRestore();
  });

  it("er ikke konfigurert når privatnøkkelen mangler", () => {
    // Nøkkelen bor bevisst i sin egen variabel. Glemmer man den, skal FLR
    // være av — ikke halvveis på.
    const env = flrEnvFra({ LEADGRID_FLR_CONFIG: SAMLET } as NodeJS.ProcessEnv);
    expect(isDiscoveryFlrConfigured(env)).toBe(false);
  });
});
