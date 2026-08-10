import { describe, it, expect } from "vitest";
import {
  orderEvents,
  projectLiveSet,
  type LiveSetEvent,
} from "./role-room-live-set-projection.js";

let seq = 0;
const at = (isoSeconds: string) => `2027-03-15T${isoSeconds}Z`;

const ev = (
  type: string,
  capturedAt: string,
  payload: Record<string, unknown> = {},
  extra: Partial<LiveSetEvent> = {},
): LiveSetEvent => ({
  eventId: `e${++seq}`,
  sessionId: "s1",
  seq,
  type,
  payload,
  capturedAt: at(capturedAt),
  operatorId: "ola",
  deviceId: "dev1",
  shootingDayId: "d1",
  ...extra,
});

describe("orderEvents", () => {
  it("sorterer på felles tidslinje, ikke på seq", () => {
    // To enheter starter begge på seq 1. Uten capturedAt ville rekkefølgen
    // avhengt av hvem som tilfeldigvis kom først i lista.
    const a = ev("roll", "09:00:05", {}, { sessionId: "A", seq: 1 });
    const b = ev("set_scene", "09:00:01", {}, { sessionId: "B", seq: 1 });
    expect(orderEvents([a, b]).map((e) => e.type)).toEqual(["set_scene", "roll"]);
  });

  it("bruker seq når to hendelser har samme tidspunkt i samme sesjon", () => {
    const a = ev("roll", "09:00:00", {}, { sessionId: "A", seq: 2 });
    const b = ev("set_scene", "09:00:00", {}, { sessionId: "A", seq: 1 });
    expect(orderEvents([a, b]).map((e) => e.seq)).toEqual([1, 2]);
  });
});

describe("projectLiveSet", () => {
  it("gir tom tilstand uten hendelser", () => {
    const p = projectLiveSet([]);
    expect(p.liveState).toBe("idle");
    expect(p.takes).toEqual([]);
    expect(p.eventCount).toBe(0);
  });

  it("følger scene → roll → cut", () => {
    const p = projectLiveSet([
      ev("set_scene", "09:00:00", { sceneId: "sc1" }),
      ev("set_setup", "09:00:10", { label: "A" }),
      ev("roll", "09:01:00"),
      ev("cut", "09:01:45"),
    ]);
    expect(p.currentSceneId).toBe("sc1");
    expect(p.activeSetup).toBe("A");
    expect(p.liveState).toBe("cut");
    expect(p.takes).toHaveLength(1);
    expect(p.takes[0].takeNumber).toBe(1);
  });

  it("måler varigheten mellom ROLL og CUT", () => {
    // Serverside-utledning framfor klientens egen klokke: to enheter skal
    // rapportere samme take like langt.
    const p = projectLiveSet([
      ev("set_scene", "09:00:00", { sceneId: "sc1" }),
      ev("roll", "09:01:00"),
      ev("cut", "09:01:45"),
    ]);
    expect(p.takes[0].duration).toBe(45);
  });

  it("melder rulling som pågår, med starttidspunkt", () => {
    const p = projectLiveSet([
      ev("set_scene", "09:00:00", { sceneId: "sc1" }),
      ev("roll", "09:01:00"),
    ]);
    expect(p.liveState).toBe("rolling");
    expect(p.rollingSince).toBe(at("09:01:00"));
    expect(p.takes).toHaveLength(0);
  });

  it("avviser ROLL uten scene, som reduceren gjør", () => {
    // Hendelsen ligger i loggen selv om skjermen avviste den — den skrives
    // før reduceren har sagt ja.
    const p = projectLiveSet([ev("roll", "09:01:00")]);
    expect(p.liveState).toBe("idle");
    expect(p.takes).toHaveLength(0);
  });

  it("avviser CUT uten ROLL", () => {
    const p = projectLiveSet([
      ev("set_scene", "09:00:00", { sceneId: "sc1" }),
      ev("cut", "09:01:00"),
    ]);
    expect(p.takes).toHaveLength(0);
    expect(p.liveState).toBe("idle");
  });

  it("blokkerer dobbel CUT på samme take", () => {
    const p = projectLiveSet([
      ev("set_scene", "09:00:00", { sceneId: "sc1" }),
      ev("roll", "09:01:00"),
      ev("cut", "09:01:30"),
      ev("cut", "09:01:31"),
    ]);
    expect(p.takes).toHaveLength(1);
  });

  it("ignorerer dobbel ROLL", () => {
    const p = projectLiveSet([
      ev("set_scene", "09:00:00", { sceneId: "sc1" }),
      ev("roll", "09:01:00"),
      ev("roll", "09:01:05"),
      ev("cut", "09:02:00"),
    ]);
    expect(p.takes).toHaveLength(1);
    // Varigheten regnes fra første ROLL — den andre ble aldri godtatt.
    expect(p.takes[0].duration).toBe(60);
  });

  it("teller take-nummer per oppsett", () => {
    const p = projectLiveSet([
      ev("set_scene", "09:00:00", { sceneId: "sc1" }),
      ev("set_setup", "09:00:05", { label: "A" }),
      ev("roll", "09:01:00"), ev("cut", "09:01:10"),
      ev("roll", "09:02:00"), ev("cut", "09:02:10"),
      ev("set_setup", "09:03:00", { label: "B" }),
      ev("roll", "09:04:00"), ev("cut", "09:04:10"),
    ]);
    const byId = p.takes.map((t) => `${t.setupLabel}${t.takeNumber}`);
    // Nyeste først.
    expect(byId).toEqual(["B1", "A2", "A1"]);
  });

  it("setter status på en take, både på klient-id og utledet id", () => {
    const roll = ev("roll", "09:01:00");
    const cut = ev("cut", "09:01:30");
    const p = projectLiveSet([
      ev("set_scene", "09:00:00", { sceneId: "sc1" }),
      roll, cut,
      ev("set_take_status", "09:02:00", { id: cut.eventId, status: "circle" }),
    ]);
    expect(p.takes[0].status).toBe("circle");
  });

  it("faller tilbake på «normal» ved ukjent status", () => {
    const cut = ev("cut", "09:01:30");
    const p = projectLiveSet([
      ev("set_scene", "09:00:00", { sceneId: "sc1" }),
      ev("roll", "09:01:00"), cut,
      ev("set_take_status", "09:02:00", { id: cut.eventId, status: "tullestatus" }),
    ]);
    expect(p.takes[0].status).toBe("normal");
  });

  it("henger flagg på siste take", () => {
    const p = projectLiveSet([
      ev("set_scene", "09:00:00", { sceneId: "sc1" }),
      ev("roll", "09:01:00"), ev("cut", "09:01:30"),
      ev("add_flag", "09:01:40", { flag: "kontinuitet" }),
      ev("add_flag", "09:01:41", { flag: "kontinuitet" }),
    ]);
    // Samme flagg to ganger er fortsatt ett flagg.
    expect(p.takes[0].flags).toEqual(["kontinuitet"]);
  });

  it("krever shot-id for capture_take", () => {
    const p = projectLiveSet([
      ev("set_scene", "09:00:00", { sceneId: "sc1" }),
      ev("capture_take", "09:01:00", { quality: "good" }),
    ]);
    expect(p.takes).toHaveLength(0);
  });

  it("lar capture_take arve varigheten fra siste cut", () => {
    const p = projectLiveSet([
      ev("set_scene", "09:00:00", { sceneId: "sc1" }),
      ev("roll", "09:01:00"), ev("cut", "09:01:20"),
      ev("capture_take", "09:02:00", { shotId: "sh1", quality: "good" }),
    ]);
    expect(p.takes[0].duration).toBe(20);
    expect(p.takes[0].status).toBe("good");
  });

  it("blokkerer setup_complete under opptak", () => {
    const p = projectLiveSet([
      ev("set_scene", "09:00:00", { sceneId: "sc1" }),
      ev("roll", "09:01:00"),
      ev("setup_complete", "09:01:30"),
    ]);
    expect(p.liveState).toBe("rolling");
  });

  it("nullstiller til idle ved scenebytte", () => {
    const p = projectLiveSet([
      ev("set_scene", "09:00:00", { sceneId: "sc1" }),
      ev("roll", "09:01:00"), ev("cut", "09:01:30"),
      ev("advance_scene", "09:02:00"),
    ]);
    expect(p.liveState).toBe("idle");
    expect(p.rollingSince).toBeNull();
    // Takene forsvinner ikke — de er dagens logg, ikke scenens.
    expect(p.takes).toHaveLength(1);
  });

  it("bærer kameradata over på taken", () => {
    const p = projectLiveSet([
      ev("set_scene", "09:00:00", { sceneId: "sc1" }),
      ev("set_cam", "09:00:05", { cam: "A" }),
      ev("set_camera", "09:00:06", { lens: "35mm", fps: 25 }),
      ev("roll", "09:01:00"), ev("cut", "09:01:30"),
    ]);
    expect(p.takes[0]).toMatchObject({ camera: "A", lens: "35mm", fps: 25 });
  });

  it("filtrerer på opptaksdag når det er oppgitt", () => {
    const p = projectLiveSet(
      [
        ev("set_scene", "09:00:00", { sceneId: "sc1" }, { shootingDayId: "d1" }),
        ev("set_scene", "09:00:10", { sceneId: "sc9" }, { shootingDayId: "d2" }),
      ],
      { shootingDayId: "d1" },
    );
    expect(p.currentSceneId).toBe("sc1");
    expect(p.eventCount).toBe(1);
  });

  it("gir samme svar uansett rekkefølgen hendelsene kom inn i", () => {
    // Offline-først betyr at batcher ankommer i vilkårlig rekkefølge.
    const events = [
      ev("set_scene", "09:00:00", { sceneId: "sc1" }),
      ev("roll", "09:01:00"),
      ev("cut", "09:01:45"),
    ];
    const forward = projectLiveSet(events);
    const shuffled = projectLiveSet([events[2], events[0], events[1]]);
    expect(shuffled).toEqual(forward);
  });
});
