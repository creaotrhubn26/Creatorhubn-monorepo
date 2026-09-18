/**
 * notify_channel sendte aldri noe. Den returnerte «deferred» med
 * «notify_channel_queued», og fire leverte maler brukte den. En bruker kunne
 * slå på en mal og tro at teamet ble varslet.
 *
 * Testene her holder på det som var feil: at handlingen enten sender, eller
 * sier tydelig hvorfor den ikke gjorde det. Aldri «køet» om ingenting skjer.
 */
import { describe, expect, it } from "vitest";
import { isSafeWebhookUrl } from "./leadgrid-workflow-engine";

describe("isSafeWebhookUrl", () => {
  it("slipper gjennom vanlige Slack- og Teams-webhooks", () => {
    expect(isSafeWebhookUrl("https://hooks.slack.com/services/T000/B000/xxx")).toBe(true);
    expect(isSafeWebhookUrl("https://creatorhubn.webhook.office.com/webhookb2/abc")).toBe(true);
  });

  it("blokkerer loopback og lenke-lokale adresser", () => {
    for (const url of [
      "http://localhost/hook",
      "http://127.0.0.1:3000/hook",
      "http://[::1]/hook",
      "http://169.254.169.254/latest/meta-data/",
    ]) {
      expect(isSafeWebhookUrl(url)).toBe(false);
    }
  });

  it("blokkerer private nett og interne toppdomener", () => {
    for (const url of [
      "http://10.0.0.5/hook",
      "http://192.168.1.10/hook",
      "http://172.16.0.9/hook",
      "http://172.31.255.1/hook",
      "https://db.internal/hook",
      "https://printer.local/hook",
    ]) {
      expect(isSafeWebhookUrl(url)).toBe(false);
    }
  });

  it("slipper gjennom 172-adresser utenfor det private området", () => {
    // 172.15 og 172.32 er offentlige; bare 172.16-172.31 er private.
    expect(isSafeWebhookUrl("http://172.15.0.1/hook")).toBe(true);
    expect(isSafeWebhookUrl("http://172.32.0.1/hook")).toBe(true);
  });

  it("blokkerer IPv6 som peker innover, også IPv4-mappet", () => {
    for (const url of [
      "http://[::1]/hook",
      "http://[::]/hook",
      "http://[fc00::1]/hook",
      "http://[fd12:3456::1]/hook",
      "http://[fe80::1]/hook",
      "http://[::ffff:127.0.0.1]/hook",
      "http://[::ffff:10.0.0.1]/hook",
    ]) {
      expect(isSafeWebhookUrl(url)).toBe(false);
    }
  });

  it("blokkerer hele 127-blokken og 0.0.0.0, ikke bare 127.0.0.1", () => {
    expect(isSafeWebhookUrl("http://127.5.5.5/hook")).toBe(false);
    expect(isSafeWebhookUrl("http://0.0.0.0/hook")).toBe(false);
  });

  it("blokkerer sky-metadata i hele 169.254-blokken", () => {
    expect(isSafeWebhookUrl("http://169.254.1.1/hook")).toBe(false);
  });

  it("avviser andre protokoller og søppel", () => {
    for (const url of ["ftp://example.com/hook", "file:///etc/passwd", "ikke en url", ""]) {
      expect(isSafeWebhookUrl(url)).toBe(false);
    }
  });
});
