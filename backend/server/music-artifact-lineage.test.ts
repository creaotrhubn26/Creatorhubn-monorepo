import { describe, expect, it } from "vitest";
import {
  claimCompanionCommands,
  queueCompanionCommand,
  upsertMusicArtifact,
  validateCompanionCommand,
} from "./music-artifact-lineage";

describe("music artifact lineage", () => {
  it("normalizes safe Pro Tools commands and strips caller supplied URLs", () => {
    expect(validateCompanionCommand("locate", { seconds: "12.5", commentId: "comment-1", outputDirectory: "/tmp/escape" })).toEqual({
      kind: "locate", payload: { seconds: 12.5, commentId: "comment-1" },
    });
    expect(validateCompanionCommand("import_audio", {
      artifactId: "artifact-1", fileUrl: "https://attacker.example/file", storageKey: "other/tenant",
    })).toEqual({ kind: "import_audio", payload: { artifactId: "artifact-1" } });
    expect(validateCompanionCommand("export_review", {
      fileName: "../../Mix?.wav", outputDirectory: "/tmp/escape",
    })).toEqual({ kind: "export_review", payload: { fileName: "_.._Mix_.wav" } });
    expect(validateCompanionCommand("locate", { seconds: -1 })).toBeNull();
    expect(validateCompanionCommand("shell", { command: "rm" })).toBeNull();
  });

  it("upserts a source artifact under the owner scope", async () => {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    const database = {
      async query(sql: string, params?: unknown[]) {
        calls.push({ sql, params });
        return { rows: [{ id: "artifact-1", revision: 1 }] };
      },
    };
    const artifact = await upsertMusicArtifact(database, {
      ownerUserId: "user-1", audioReviewProjectId: "room-1", kind: "mix",
      sourceSystem: "protools", sourceArtifactId: "bounce:bounce-1", fileName: "Mix.wav",
    });
    expect(artifact.id).toBe("artifact-1");
    expect(calls[0].sql).toContain("ON CONFLICT(owner_user_id,source_system,source_artifact_id)");
    expect(calls[0].params).toContain("user-1");
    expect(calls[0].params).toContain("bounce:bounce-1");
  });

  it("binds queued and claimed commands to session, device and user", async () => {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    const database = {
      async query(sql: string, params?: unknown[]) {
        calls.push({ sql, params });
        return { rows: [{ id: "command-1", command_kind: "locate" }] };
      },
    };
    await queueCompanionCommand(database, {
      sessionId: "session-1", deviceTokenId: "device-1", userId: "user-1", requestedBy: "reviewer-1",
      kind: "locate", payload: { seconds: 8 }, dedupeKey: "comment-1:locate",
    });
    await claimCompanionCommands(database, {
      sessionId: "session-1", deviceTokenId: "device-1", userId: "user-1", limit: 50,
    });
    expect(calls[0].params?.slice(0, 4)).toEqual(["session-1", "device-1", "user-1", "locate"]);
    expect(calls[1].sql).toContain("device_token_id=$2 AND user_id=$3");
    expect(calls[1].params?.slice(0, 4)).toEqual(["session-1", "device-1", "user-1", 20]);
  });
});
