import { describe, it, expect } from "vitest";
import {
  ACTIONS_REQUIRING_NOTE,
  availableActions,
  canTransition,
  type ApprovalStatus,
} from "./role-room-take-approval-service.js";

describe("canTransition", () => {
  it("lar en uvurdert take gå hvor som helst", () => {
    for (const to of ["approved", "needs_work", "rejected"] as ApprovalStatus[]) {
      expect(canTransition("pending", to)).toBe(true);
    }
  });

  it("lar en godkjenning trekkes tilbake", () => {
    // Klippen finner ting review ikke så. Godkjenning er ikke endelig.
    expect(canTransition("approved", "needs_work")).toBe(true);
    expect(canTransition("approved", "rejected")).toBe(true);
  });

  it("krever at en underkjent take gjenåpnes før den kan godkjennes", () => {
    // Ellers mister historikken at noen faktisk vurderte den på nytt.
    expect(canTransition("rejected", "approved")).toBe(false);
    expect(canTransition("rejected", "pending")).toBe(true);
  });

  it("avviser overgang til samme status", () => {
    // Dobbeltklikk eller misforståelse — begge er bedre å få vite om enn å
    // skrive enda en rad i historikken for.
    for (const s of ["pending", "approved", "needs_work", "rejected"] as ApprovalStatus[]) {
      expect(canTransition(s, s)).toBe(false);
    }
  });

  it("lar «trenger arbeid» gå begge veier", () => {
    expect(canTransition("needs_work", "approved")).toBe(true);
    expect(canTransition("needs_work", "rejected")).toBe(true);
  });
});

describe("availableActions", () => {
  it("gir bare opplåsing på en låst take", () => {
    // Låsen skal slå ut uansett hvor lovlig overgangen ellers ville vært.
    expect(availableActions("approved", true)).toEqual(["unlock"]);
    expect(availableActions("pending", true)).toEqual(["unlock"]);
  });

  it("tilbyr ikke låsing før det finnes en beslutning å fryse", () => {
    expect(availableActions("pending", false)).not.toContain("lock");
    expect(availableActions("approved", false)).toContain("lock");
  });

  it("tilbyr de tre beslutningene på en uvurdert take", () => {
    const actions = availableActions("pending", false);
    expect(actions).toContain("approve");
    expect(actions).toContain("needs_work");
    expect(actions).toContain("reject");
  });

  it("tilbyr ikke godkjenning direkte fra underkjent", () => {
    const actions = availableActions("rejected", false);
    expect(actions).not.toContain("approve");
    expect(actions).toContain("reopen");
  });

  it("tilbyr aldri en handling som ikke er lovlig", () => {
    for (const status of ["pending", "approved", "needs_work", "rejected"] as ApprovalStatus[]) {
      for (const action of availableActions(status, false)) {
        if (action === "lock" || action === "unlock") continue;
        const target = { approve: "approved", needs_work: "needs_work", reject: "rejected", reopen: "pending" }[action];
        expect(canTransition(status, target as ApprovalStatus)).toBe(true);
      }
    }
  });
});

describe("begrunnelseskravet", () => {
  it("gjelder underkjenning, ikke godkjenning", () => {
    // En godkjenning trenger ingen forklaring. En underkjennelse uten
    // begrunnelse er en beskjed om å gjette hva som er galt.
    expect(ACTIONS_REQUIRING_NOTE).toContain("needs_work");
    expect(ACTIONS_REQUIRING_NOTE).toContain("reject");
    expect(ACTIONS_REQUIRING_NOTE).not.toContain("approve");
    expect(ACTIONS_REQUIRING_NOTE).not.toContain("lock");
  });
});
