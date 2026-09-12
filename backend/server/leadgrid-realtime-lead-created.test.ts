/**
 * Tests the new `broadcastLeadCreated` helper + SSE-event payload-shape
 * iPad expects for pulse-animasjon på nye pins.
 *
 * Vi tester den rene routing-laget — emit() driver alle klienter
 * basert på channel-match. Vi spy-er på singleton-instance for
 * å fange emit-calls uten å åpne en ekte WebSocket-server.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  leadgridRealtime,
  broadcastLeadCreated,
} from "./leadgrid-realtime";

describe("broadcastLeadCreated", () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Stub ut emit på singleton — vi vil bare verifisere call-args.
    spy = vi.spyOn(leadgridRealtime, "emit").mockImplementation(() => {});
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it("emitter både org:- og user:-kanal når begge id-er er gitt", () => {
    broadcastLeadCreated("org-1", "user-1", {
      lead_id: "lead-abc",
      source: "batch",
      batch_id: "batch-xyz",
      latitude: 60.1,
      longitude: 11.0,
      name: "Acme AS",
    });

    expect(spy).toHaveBeenCalledTimes(2);
    const first = spy.mock.calls[0]![0] as {
      type: string;
      channel: string;
      data: Record<string, unknown>;
    };
    const second = spy.mock.calls[1]![0] as {
      type: string;
      channel: string;
      data: Record<string, unknown>;
    };
    expect(first.channel).toBe("org:org-1");
    expect(first.type).toBe("lead.created");
    expect(second.channel).toBe("user:user-1");
    expect(second.type).toBe("lead.created");
  });

  it("dropper org-kanal når orgId er null (manuell drop fra usynkronisert konto)", () => {
    broadcastLeadCreated(null, "user-1", {
      lead_id: "lead-abc",
      source: "manual",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const evt = spy.mock.calls[0]![0] as { channel: string };
    expect(evt.channel).toBe("user:user-1");
  });

  it("dropper user-kanal når userId er null (org-wide broadcast fra cron)", () => {
    broadcastLeadCreated("org-1", null, {
      lead_id: "lead-abc",
      source: "discovery",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const evt = spy.mock.calls[0]![0] as { channel: string };
    expect(evt.channel).toBe("org:org-1");
  });

  it("propagerer alle data-felt til payload — iPad bruker disse for pulse-state", () => {
    broadcastLeadCreated("org-1", null, {
      lead_id: "lead-abc",
      organization_id: "org-1",
      project_id: "proj-1",
      name: "Acme AS",
      latitude: 60.1,
      longitude: 11.0,
      source: "batch",
      batch_id: "batch-xyz",
      confidence: "exact",
    });

    const evt = spy.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(evt.data.lead_id).toBe("lead-abc");
    expect(evt.data.organization_id).toBe("org-1");
    expect(evt.data.project_id).toBe("proj-1");
    expect(evt.data.source).toBe("batch");
    expect(evt.data.batch_id).toBe("batch-xyz");
    expect(evt.data.confidence).toBe("exact");
    expect(evt.data.latitude).toBe(60.1);
    expect(evt.data.longitude).toBe(11.0);
    expect(evt.data.name).toBe("Acme AS");
  });

  it("emitter ingenting når begge org-id og user-id er null", () => {
    broadcastLeadCreated(null, null, {
      lead_id: "lead-abc",
      source: "manual",
    });
    expect(spy).not.toHaveBeenCalled();
  });
});
