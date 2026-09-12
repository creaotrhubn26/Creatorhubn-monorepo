/**
 * leadgrid-url-research.test.ts
 *
 * Unit-tester for URL Research → draft-lead → pin på kartet (mig 328).
 *
 * Fokus:
 *   1. resolveLocation — pin-garantien. Sikrer at vi alltid returnerer
 *      en confidence-verdi, og at fallback-kjeden brukes i riktig rekkefølge.
 *   2. deriveCompanyProfile — orchestrator-payload → DerivedCompanyProfile.
 *   3. Pin-garanti-test: full run ender med commit-respons som har
 *      latitude+longitude populert når vi har en kjent by.
 */
import { describe, expect, it, vi } from "vitest";
import { __test } from "../leadgrid-url-research-routes";

const { resolveLocation, deriveCompanyProfile, lookupCityCentroid } = __test;

// ---------------------------------------------------------------------
// resolveLocation — pin-garantien
// ---------------------------------------------------------------------

describe("resolveLocation", () => {
  it("returnerer 'exact' når Google Places gir lat/lng", async () => {
    const r = await resolveLocation({
      businessSignals: {
        source: "google_places",
        location: { latitude: 59.91, longitude: 10.75 },
        topReviews: [],
        serviceSignals: [],
      },
      brregCompany: null,
      companyProfile: { city: "Oslo", country: "NO", address: null },
      geocoder: async () => null, // skal IKKE bli kalt
    });
    expect(r.confidence).toBe("exact");
    expect(r.latitude).toBe(59.91);
    expect(r.longitude).toBe(10.75);
    expect(r.source).toBe("google_places");
  });

  it("faller til 'geocoded' når Places mangler men Brreg-adresse + Geocoding suksess", async () => {
    const geocoder = vi.fn(async () => ({
      lat: 60.39,
      lng: 5.32,
      formattedAddress: "Bryggen 1, 5003 Bergen, Norge",
    }));
    const r = await resolveLocation({
      businessSignals: null,
      brregCompany: {
        source: "brreg",
        lookupStatus: "verified",
        businessAddress: "Bryggen 1",
        municipality: "Bergen",
        statusFlags: {},
      },
      companyProfile: { city: "Bergen", country: "NO", address: null },
      geocoder,
    });
    expect(r.confidence).toBe("geocoded");
    expect(r.latitude).toBe(60.39);
    expect(r.longitude).toBe(5.32);
    expect(geocoder).toHaveBeenCalled();
  });

  it("faller til 'approximate' med by-sentroid når Geocoding feiler men byen finnes", async () => {
    const geocoder = vi.fn(async () => null);
    const r = await resolveLocation({
      businessSignals: null,
      brregCompany: null,
      companyProfile: { city: "Oslo", country: "NO", address: null },
      geocoder,
    });
    expect(r.confidence).toBe("approximate");
    // Oslo-sentroid
    expect(r.latitude).toBeCloseTo(59.913868, 3);
    expect(r.longitude).toBeCloseTo(10.752245, 3);
  });

  it("returnerer 'unknown' når vi ikke har noe — lat/lng = null", async () => {
    const r = await resolveLocation({
      businessSignals: null,
      brregCompany: null,
      companyProfile: { city: null, country: null, address: null },
      geocoder: async () => null,
    });
    expect(r.confidence).toBe("unknown");
    expect(r.latitude).toBeNull();
    expect(r.longitude).toBeNull();
  });

  it("PIN-GARANTI: når Places mangler og geocoder feiler, returnerer city-centroid", async () => {
    // Dette er den viktigste enkelttesten: brukeren limer inn en URL,
    // research finner navn + by, men ingen presis lokasjon.
    // Vi MÅ likevel ende opp med en lat/lng slik at pinen dukker opp.
    const r = await resolveLocation({
      businessSignals: null,
      brregCompany: null,
      companyProfile: { city: "Trondheim", country: "NO", address: null },
      geocoder: async () => null,
    });
    expect(r.latitude).not.toBeNull();
    expect(r.longitude).not.toBeNull();
    expect(r.confidence).toBe("approximate");
  });
});

// ---------------------------------------------------------------------
// lookupCityCentroid
// ---------------------------------------------------------------------

describe("lookupCityCentroid", () => {
  it("matcher case-insensitivt på by", () => {
    const oslo = lookupCityCentroid("OSLO");
    expect(oslo?.lat).toBeCloseTo(59.91, 1);
  });

  it("matcher ASCII-variant for byer m/ æøå", () => {
    const bodo = lookupCityCentroid("Bodo");
    expect(bodo).not.toBeNull();
    const bodoNo = lookupCityCentroid("Bodø");
    expect(bodoNo?.lat).toEqual(bodo?.lat);
  });

  it("returnerer null for ukjente byer", () => {
    expect(lookupCityCentroid("Springfield")).toBeNull();
  });

  it("returnerer null for null/empty", () => {
    expect(lookupCityCentroid(null)).toBeNull();
    expect(lookupCityCentroid("")).toBeNull();
  });
});

// ---------------------------------------------------------------------
// deriveCompanyProfile
// ---------------------------------------------------------------------

describe("deriveCompanyProfile", () => {
  it("trekker navn/industry/summary/website fra orchestrator-synthesis", () => {
    const bootstrap: Record<string, unknown> = {
      companyProfile: {
        companyName: "Acme AS",
        websiteUrl: "https://acme.no",
        organizationNumber: "913 469 395",
        summary: "Vi gjør X",
        industry: "Software",
        logoUrl: "https://acme.no/logo.png",
      },
    };
    const r = deriveCompanyProfile(bootstrap, null, null, "https://fallback.no");
    expect(r.name).toBe("Acme AS");
    expect(r.company).toBe("Acme AS");
    expect(r.industry).toBe("Software");
    expect(r.summary).toBe("Vi gjør X");
    expect(r.website).toBe("https://acme.no");
    expect(r.logoUrl).toBe("https://acme.no/logo.png");
    expect(r.organizationNumber).toBe("913 469 395");
  });

  it("faller tilbake til Brreg.name når companyProfile mangler", () => {
    const r = deriveCompanyProfile(
      null,
      null,
      {
        source: "brreg",
        lookupStatus: "verified",
        name: "Acme Industrier AS",
        organizationNumber: "999000123",
        statusFlags: {},
      },
      "https://fallback.no",
    );
    expect(r.name).toBe("Acme Industrier AS");
    expect(r.organizationNumber).toBe("999000123");
    expect(r.website).toBe("https://fallback.no");
  });

  it("plukker socials fra websiteInsights.socialProfileCandidates", () => {
    const bootstrap: Record<string, unknown> = {
      companyProfile: { companyName: "X" },
      websiteInsights: {
        socialProfileCandidates: [
          { platform: "instagram", canonicalUrl: "https://instagram.com/x", status: "verified" },
          { platform: "linkedin", canonicalUrl: "https://linkedin.com/company/x", status: "likely" },
          { platform: "facebook", canonicalUrl: "https://facebook.com/x", status: "rejected" },
        ],
      },
    };
    const r = deriveCompanyProfile(bootstrap, null, null, "https://x.no");
    expect(r.socials.instagram).toBe("https://instagram.com/x");
    expect(r.socials.linkedin).toBe("https://linkedin.com/company/x");
    // rejected blir ikke valgt
    expect(r.socials.facebook).toBeUndefined();
  });

  it("nuller ut felter som mangler", () => {
    const r = deriveCompanyProfile(null, null, null, "https://only-url.no");
    expect(r.name).toBeNull();
    expect(r.industry).toBeNull();
    expect(r.email).toBeNull();
    expect(r.phone).toBeNull();
    expect(r.website).toBe("https://only-url.no");
  });
});

// ---------------------------------------------------------------------
// PIN-garanti: full-flyt-simulering
//
// Verifiserer at vi alltid ender med en commit-respons som har lat/lng
// satt når brukeren har gitt oss noe så enkelt som en by.
// ---------------------------------------------------------------------

describe("pin-garanti: integrert flyt-simulering", () => {
  it("scenario A — Places suksess → exact, lat/lng aldri null", async () => {
    const loc = await resolveLocation({
      businessSignals: {
        source: "google_places",
        location: { latitude: 58.146, longitude: 7.995 },
        topReviews: [],
        serviceSignals: [],
      },
      brregCompany: null,
      companyProfile: { city: "Kristiansand", country: "NO", address: null },
    });
    expect(loc.latitude).not.toBeNull();
    expect(loc.longitude).not.toBeNull();
    expect(loc.confidence).toBe("exact");
  });

  it("scenario B — kun Brreg-adresse + Geocode suksess → geocoded, lat/lng satt", async () => {
    const loc = await resolveLocation({
      businessSignals: null,
      brregCompany: {
        source: "brreg",
        lookupStatus: "verified",
        businessAddress: "Karl Johans gate 1",
        municipality: "Oslo",
        statusFlags: {},
      },
      companyProfile: { city: "Oslo", country: "NO", address: null },
      geocoder: async () => ({ lat: 59.91, lng: 10.75 }),
    });
    expect(loc.latitude).not.toBeNull();
    expect(loc.longitude).not.toBeNull();
    expect(loc.confidence).toBe("geocoded");
  });

  it("scenario C — alle ekstern API feiler men by kjent → approximate, lat/lng satt", async () => {
    const loc = await resolveLocation({
      businessSignals: null,
      brregCompany: null,
      companyProfile: { city: "Stavanger", country: "NO", address: null },
      geocoder: async () => null,
    });
    expect(loc.latitude).not.toBeNull();
    expect(loc.longitude).not.toBeNull();
    expect(loc.confidence).toBe("approximate");
  });

  it("scenario D — INGEN signal → unknown, UI MÅ be om manuell pin", async () => {
    const loc = await resolveLocation({
      businessSignals: null,
      brregCompany: null,
      companyProfile: { city: null, country: null, address: null },
      geocoder: async () => null,
    });
    expect(loc.latitude).toBeNull();
    expect(loc.longitude).toBeNull();
    expect(loc.confidence).toBe("unknown");
  });
});
