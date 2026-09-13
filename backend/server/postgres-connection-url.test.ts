import { describe, expect, it } from "vitest";
import { withExplicitPostgresVerifyFull } from "./postgres-connection-url.mjs";

describe("PostgreSQL connection URL TLS normalization", () => {
  it.each(["prefer", "require", "verify-ca"])(
    "makes the legacy %s alias explicitly verify-full",
    (sslmode) => {
      const normalized = withExplicitPostgresVerifyFull(
        `postgresql://runtime@ep-example.neon.tech/app?sslmode=${sslmode}&channel_binding=require`,
      );
      const parsed = new URL(normalized);

      expect(parsed.username).toBe("runtime");
      expect(parsed.searchParams.get("sslmode")).toBe("verify-full");
      expect(parsed.searchParams.get("channel_binding")).toBe("require");
    },
  );

  it("leaves an explicit verify-full URL byte-for-byte unchanged", () => {
    const connectionString =
      "postgresql://runtime@ep-example.neon.tech/app?sslmode=verify-full&channel_binding=require";
    expect(withExplicitPostgresVerifyFull(connectionString)).toBe(
      connectionString,
    );
  });

  it.each([
    "postgresql://localhost/app",
    "postgresql://localhost/app?sslmode=disable",
  ])("does not reinterpret URLs without a legacy strict alias: %s", (value) => {
    expect(withExplicitPostgresVerifyFull(value)).toBe(value);
  });

  it("rejects ambiguous sslmode parameters", () => {
    expect(() =>
      withExplicitPostgresVerifyFull(
        "postgresql://localhost/app?sslmode=require&sslmode=verify-full",
      ),
    ).toThrow("PostgreSQL connection URL must set at most one sslmode");
  });

  it("rejects an invalid URL without including the input in the error", () => {
    const invalid = "not-a-postgres-url-with-a-secret";
    expect(() => withExplicitPostgresVerifyFull(invalid)).toThrow(
      "PostgreSQL connection URL must be valid",
    );
    try {
      withExplicitPostgresVerifyFull(invalid);
    } catch (error) {
      expect(String(error)).not.toContain(invalid);
    }
  });
});
