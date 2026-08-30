import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./transactional-email-service", () => ({
  sendTransactionalEmail: vi.fn(async () => ({ success: true })),
}));
vi.mock("./lead-map-apns-client", () => ({
  sendAPNs: vi.fn(async () => ({ sent: true })),
}));

import {
  listMentions,
  markMentionsRead,
  notifyStoryboardMentions,
} from "./storyboard-mention-service.js";
import { sendTransactionalEmail } from "./transactional-email-service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("storyboard mention identity isolation", () => {
  it("lists only the session-bound user inside projects they still access", async () => {
    const query = vi.fn(async (statement: string) => {
      if (statement.includes("SELECT n.id")) {
        return { rows: [{ id: 1, mentioned_name: "Alice" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const rows = await listMentions({ query } as any, "alice-user-id", true);
    const inboxCall = query.mock.calls.find(([statement]) =>
      String(statement).includes("SELECT n.id"),
    );
    const backfillCall = query.mock.calls.find(([statement]) =>
      String(statement).includes("WITH unique_email_users"),
    );

    expect(rows).toEqual([{ id: 1, mentioned_name: "Alice" }]);
    expect(String(inboxCall?.[0])).toContain("n.mentioned_user_id = $1");
    expect(String(inboxCall?.[0])).toContain("cur.user_id = $1");
    expect(String(inboxCall?.[0])).toContain("cur.deactivated_at IS NULL");
    expect(String(inboxCall?.[0])).toContain(
      "cur.expires_at IS NULL OR cur.expires_at > NOW()",
    );
    expect(String(inboxCall?.[0])).not.toContain("lower(mentioned_name)");
    expect(inboxCall?.[1]).toEqual(["alice-user-id"]);
    expect(String(backfillCall?.[0])).toContain(
      "GROUP BY lower(btrim(email))",
    );
    expect(String(backfillCall?.[0])).toContain("HAVING COUNT(*) = 1");
  });

  it("marks read state only for the authenticated recipient", async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 3 }));

    const updated = await markMentionsRead(
      { query } as any,
      "recipient-user-id",
    );
    const updateCall = query.mock.calls.find(([statement]) =>
      String(statement).includes("UPDATE storyboard_mention_notifications n"),
    );

    expect(updated).toBe(3);
    expect(String(updateCall?.[0])).toContain("n.mentioned_user_id = $1");
    expect(String(updateCall?.[0])).toContain("cur.deactivated_at IS NULL");
    expect(String(updateCall?.[0])).toContain(
      "cur.expires_at IS NULL OR cur.expires_at > NOW()",
    );
    expect(String(updateCall?.[0])).not.toContain("mentioned_name");
    expect(updateCall?.[1]).toEqual(["recipient-user-id"]);
  });

  it("derives recipients and author from verified project accounts", async () => {
    const query = vi.fn(async (statement: string, params?: unknown[]) => {
      if (statement.includes("WITH member_ids")) {
        return {
          rows: [
            {
              id: "bob-user-id",
              name: "Bob Builder",
              email: "bob@example.com",
            },
          ],
          rowCount: 1,
        };
      }
      if (statement.includes("COALESCE(") && statement.includes("FROM users")) {
        return { rows: [{ name: "Alice Director" }], rowCount: 1 };
      }
      if (statement.includes("INSERT INTO storyboard_mention_notifications")) {
        return { rows: [{ id: 42 }], rowCount: 1 };
      }
      if (statement.includes("SELECT token FROM notification_device_tokens")) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });

    await notifyStoryboardMentions(
      { query } as any,
      {
        projectId: "project-1",
        manuscriptId: "manuscript-1",
        sceneId: "scene-1",
        frameId: "frame-1",
        authorUserId: "alice-user-id",
        projectTitle: "<Unsafe project>",
      },
      [],
      [
        {
          id: "comment-1",
          author: "<img src=x onerror=alert(1)>",
          text: "@BobBuilder <b>please review</b>",
        },
      ],
    );

    const recipientCall = query.mock.calls.find(([statement]) =>
      String(statement).includes("WITH member_ids"),
    );
    const insertCall = query.mock.calls.find(([statement]) =>
      String(statement).includes("INSERT INTO storyboard_mention_notifications"),
    );
    expect(String(recipientCall?.[0])).toContain("casting_user_roles");
    expect(String(recipientCall?.[0])).toContain(
      "deactivated_at IS NULL",
    );
    expect(String(recipientCall?.[0])).toContain(
      "expires_at IS NULL OR expires_at > NOW()",
    );
    expect(recipientCall?.[1]).toEqual(["project-1"]);
    expect(insertCall?.[1]).toEqual([
      "project-1",
      "bob-user-id",
      "Bob Builder",
      "bob@example.com",
      "Alice Director",
      "@BobBuilder <b>please review</b>",
      "manuscript-1",
      "scene-1",
      "frame-1",
      "comment-1",
      null,
    ]);
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1);
    const email = vi.mocked(sendTransactionalEmail).mock.calls[0]?.[0];
    expect(email?.html).toContain("Alice Director");
    expect(email?.html).toContain("&lt;Unsafe project&gt;");
    expect(email?.html).toContain("&lt;b&gt;please review&lt;/b&gt;");
    expect(email?.html).not.toContain("<img");
    const tokenCall = query.mock.calls.find(([statement]) =>
      String(statement).includes("SELECT token FROM notification_device_tokens"),
    );
    expect(tokenCall?.[1]).toEqual(["bob-user-id"]);
    expect(
      query.mock.calls.some(([statement]) =>
        String(statement).includes("lower(email) = lower($1)"),
      ),
    ).toBe(false);
  });
});
