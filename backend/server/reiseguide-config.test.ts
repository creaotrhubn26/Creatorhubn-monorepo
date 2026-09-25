import { describe, expect, it } from "vitest";
import { MissingSenseAidEnvError, SENSEAID_ENV, requireSenseAidEnv, senseAidEnvStatus } from "./reiseguide-config.js";

describe("reiseguide-config", () => {
  it("bruker SenseAid-spesifikke variabelnavn", () => {
    expect(SENSEAID_ENV.sonioxApiKey).toBe("SENSEAID_SONIOX_API_KEY");
    expect(SENSEAID_ENV.sonioxVoice).toBe("SENSEAID_SONIOX_VOICE");
    expect(Object.values(SENSEAID_ENV)).not.toContain("SENSEAID_ELEVENLABS_API_KEY");
  });

  it("leser nøkkelen fra miljøet og trimmer", () => {
    expect(requireSenseAidEnv(SENSEAID_ENV.sonioxApiKey, { SENSEAID_SONIOX_API_KEY: "  abc  " })).toBe("abc");
  });

  it("feiler med variabelnavnet når nøkkelen mangler, uten fallback til delte nøkler", () => {
    const env = { SONIOX_API_KEY: "delt-nokkel", SENSEAID_SONIOX_API_KEY: "" };
    expect(() => requireSenseAidEnv(SENSEAID_ENV.sonioxApiKey, env)).toThrow(MissingSenseAidEnvError);
    expect(() => requireSenseAidEnv(SENSEAID_ENV.sonioxApiKey, env)).toThrow(/SENSEAID_SONIOX_API_KEY/);
  });

  it("rapporterer status uten å lekke verdier", () => {
    const status = senseAidEnvStatus({ SENSEAID_SONIOX_API_KEY: "hemmelig" });
    expect(status).toEqual({
      SENSEAID_SONIOX_API_KEY: true,
      SENSEAID_SONIOX_VOICE: false,
      SENSEAID_SONIOX_REGION: false,
      REISEGUIDE_MEDIA_URL_BASE: false,
    });
    expect(JSON.stringify(status)).not.toContain("hemmelig");
  });
});
