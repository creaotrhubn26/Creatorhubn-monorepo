import { describe, expect, it } from "vitest";
import {
  SENSEAID_STORAGE_PREFIX,
  isSenseAidStorageKey,
  senseAidAudioKey,
  senseAidCaptionsKey,
  senseAidImageKey,
  senseAidMediaUrl,
} from "./reiseguide-storage.js";

const ref = { areaSlug: "oslo-kvadraturen", poiSlug: "akershus-festning", kind: "narration", chapterNo: 2, lang: "nb", version: 3 };

describe("SenseAid-hierarki i CreatorHub S3", () => {
  it("legger alt under products/senseaid-explore/areas/…/pois/…", () => {
    expect(senseAidAudioKey(ref)).toBe(`${SENSEAID_STORAGE_PREFIX}/areas/oslo-kvadraturen/pois/akershus-festning/audio/narration-2-nb-v3.mp3`);
    expect(senseAidCaptionsKey(ref)).toBe(`${SENSEAID_STORAGE_PREFIX}/areas/oslo-kvadraturen/pois/akershus-festning/captions/narration-2-nb-v3.vtt`);
    expect(senseAidImageKey(ref, "img_1", "Fasade Øst.JPG")).toBe(`${SENSEAID_STORAGE_PREFIX}/areas/oslo-kvadraturen/pois/akershus-festning/images/img_1-Fasade-st.JPG`);
  });

  it("saniterer segmenter så nøkler aldri kan gå ut av hierarkiet", () => {
    const key = senseAidAudioKey({ ...ref, areaSlug: "../organizations", poiSlug: "x/y", lang: "nb NO" });
    expect(key).toBe(`${SENSEAID_STORAGE_PREFIX}/areas/organizations/pois/x-y/audio/narration-2-nb-NO-v3.mp3`);
    expect(isSenseAidStorageKey(key)).toBe(true);
  });

  it("godkjenner bare nøkler i hierarkiet", () => {
    expect(isSenseAidStorageKey(senseAidAudioKey(ref))).toBe(true);
    expect(isSenseAidStorageKey("organizations/o/users/u/file.mp3")).toBe(false);
    expect(isSenseAidStorageKey("products/senseaid-explore/areas/a/pois/p/audio/../x.mp3")).toBe(false);
    expect(isSenseAidStorageKey("products/senseaid-explore/areas/a/pois/p/other/x.mp3")).toBe(false);
    expect(isSenseAidStorageKey("products/senseaid-explore/")).toBe(false);
  });

  it("bygger app-URL via /api/guide/media", () => {
    expect(senseAidMediaUrl(senseAidAudioKey(ref), "https://api.test/")).toBe(
      `https://api.test/api/guide/media/${senseAidAudioKey(ref)}`,
    );
  });
});
