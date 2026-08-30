import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(process.cwd(), "client");
const html = readFileSync(resolve(clientRoot, "index.html"), "utf8");
const main = readFileSync(resolve(clientRoot, "src/main.tsx"), "utf8");
const mainApp = readFileSync(resolve(clientRoot, "src/main-app.tsx"), "utf8");
const portalEntry = readFileSync(
  resolve(clientRoot, "src/participant-document-entry.tsx"),
  "utf8",
);

describe("participant document bootstrap security", () => {
  it("scrubs and bridges the fragment before indexing policy and analytics", () => {
    const sanitizer = html.indexOf("consumeParticipantDocumentTokenFromUrl");
    const noindex = html.indexOf("applyPrivateDocumentIndexingPolicy");
    const analytics = html.indexOf(
      "bootstrapThirdPartyServicesUnlessPrivateDocument",
    );
    const moduleEntry = html.indexOf('type="module" src="/src/main.tsx"');

    expect(sanitizer).toBeGreaterThan(0);
    expect(sanitizer).toBeLessThan(noindex);
    expect(noindex).toBeLessThan(analytics);
    expect(analytics).toBeLessThan(moduleEntry);
    expect(html).toContain(
      "creatorhub.workspace-participant-document.credential.v1",
    );
    expect(html).toContain("takeParticipantDocumentCredentialOnce");
    expect(html).toContain("participantCredential = null");
    expect(html).toContain("participantUrl.hash = ''");
    expect(html).toContain("participantReferrer.content = 'no-referrer'");
    expect(html).not.toContain(
      '<meta name="referrer" content="no-referrer" />',
    );
    expect(html).not.toContain("__creatorhubSigningCredential");
    expect(html).toContain("noindex,nofollow,noarchive");
    expect(html).toContain("window.location.origin + '/participant-document'");
  });

  it("hard-disables analytics, pixels, picker and remote fonts on the private route", () => {
    const analyticsGuard = html.indexOf(
      "bootstrapThirdPartyServicesUnlessPrivateDocument",
    );
    const dataLayer = html.indexOf("window.dataLayer = window.dataLayer || []");
    const picker = html.indexOf("https://apis.google.com/js/api.js");
    const fontGuard = html.indexOf("loadCreatorHubFontsUnlessPrivateDocument");
    const fontSource = html.indexOf("https://fonts.googleapis.com/css2");

    expect(analyticsGuard).toBeLessThan(dataLayer);
    expect(dataLayer).toBeLessThan(picker);
    expect(fontGuard).toBeLessThan(fontSource);
    expect(html).toContain(
      "if (window[Symbol.for('creatorhub.workspace-participant-document.private-route.v1')]) return;",
    );
    expect(html).toContain(
      "if (!window[Symbol.for('creatorhub.workspace-participant-document.private-route.v1')]) {",
    );
  });

  it("routes the private page to a minimal entry and keeps app services in the other chunk", () => {
    expect(main).toContain('import("./participant-document-entry")');
    expect(main).toContain('import("./main-app")');
    expect(main).not.toContain("initSentry");
    expect(main).not.toContain("runLegacyStorageMigration");
    expect(main).not.toContain("bootstrapCreatorHubGoogleLoginRedirect");
    expect(main).not.toContain("installFrontendErrorReporter");
    expect(main).not.toContain("serviceWorker");
    expect(main).not.toContain("offlineQueue");

    expect(mainApp).toContain("initSentry");
    expect(mainApp).toContain("runLegacyStorageMigration");
    expect(mainApp).toContain("bootstrapCreatorHubGoogleLoginRedirect");

    expect(portalEntry).toContain("ParticipantDocumentPage");
    expect(portalEntry).not.toContain("App");
    expect(portalEntry).not.toContain("AuthProvider");
    expect(portalEntry).not.toContain("QueryClientProvider");
    expect(portalEntry).not.toContain("initSentry");
  });
});
