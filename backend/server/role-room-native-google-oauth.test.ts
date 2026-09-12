import { describe, expect, it } from "vitest";
import {
  buildRoleRoomNativeGoogleReturnUrl,
  parseRoleRoomGoogleNativeClient,
} from "./role-room-native-google-oauth.js";

describe("Role Room native Google OAuth return", () => {
  it("only accepts Storyboard Room as a native client", () => {
    expect(parseRoleRoomGoogleNativeClient("storyboard-room")).toBe("storyboard-room");
    expect(parseRoleRoomGoogleNativeClient("leadgrid")).toBeNull();
    expect(parseRoleRoomGoogleNativeClient("storyboardstudio://oauth")).toBeNull();
  });

  it("returns the one-time Role Room transfer to the Storyboard Room scheme", () => {
    const callback = buildRoleRoomNativeGoogleReturnUrl("storyboard-room", {
      rrGoogleStatus: "success",
      rrGoogleMode: "login",
      rrGoogleTransfer: "transfer-123",
    });

    expect(callback).not.toBeNull();
    const url = new URL(callback!);
    expect(url.protocol).toBe("storyboardstudio:");
    expect(url.host).toBe("oauth");
    expect(url.searchParams.get("rrGoogleStatus")).toBe("success");
    expect(url.searchParams.get("rrGoogleTransfer")).toBe("transfer-123");
  });

  it("does not build custom-scheme redirects for web clients", () => {
    expect(buildRoleRoomNativeGoogleReturnUrl(null, {
      rrGoogleStatus: "success",
    })).toBeNull();
  });
});
