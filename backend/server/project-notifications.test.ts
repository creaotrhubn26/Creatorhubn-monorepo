/**
 * project-notifications.test.ts — reglene `notify()` er den eneste eieren av.
 *
 * Kjøres mot en liten in-memory pool som forstår akkurat de setningene
 * varsellaget sender. Poenget er ikke å teste PostgreSQL, men å pinne
 * beslutningene: hvem blir mottaker, hvem blir det aldri, hva skjer når
 * kringkastingen svikter, og hva ulest-telleren sier etterpå.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const broadcastUserEvent = vi.fn();
vi.mock("./realtime-user-events", () => ({
  broadcastUserEvent: (...args: unknown[]) => broadcastUserEvent(...args),
}));
vi.mock("./project-change-log", () => ({
  recordProjectChange: vi.fn().mockResolvedValue(undefined),
}));

import {
  DELIVERABLE_CLOSED_STATUSES,
  listProjectActivity,
  listUserInbox,
  markAllNotificationsRead,
  markNotificationRead,
  notify,
  resetProjectNotificationSchemaCache,
  sweepDueSoonDeliverables,
} from "./project-notifications";

const PROJECT = "project-42";
const OWNER = "user-owner";
const MEMBER = "user-member";
const OUTSIDER = "user-outsider";

interface NotificationRow {
  id: string;
  project_id: string;
  audience: string;
  event_type: string;
  title: string;
  message: string | null;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  metadata: Record<string, unknown>;
  created_by_user_id: string | null;
  created_by_label: string | null;
  assigned_to_user_id: string | null;
  assigned_to_label: string | null;
  due_at: string | null;
  resolved_at: string | null;
  archived_at: string | null;
  dedupe_key: string | null;
  created_at: Date;
}

interface RecipientRow {
  notification_id: string;
  user_id: string;
  read_at: Date | null;
}

/** Bare de setningene varsellaget faktisk sender. Alt annet svarer tomt. */
function createFakePool(options: { team?: string[] } = {}) {
  const team = options.team ?? [OWNER, MEMBER];
  const notifications: NotificationRow[] = [];
  const recipients: RecipientRow[] = [];
  let sequence = 0;

  const run = async (sql: string, params: any[] = []): Promise<any> => {
    const text = sql.replace(/\s+/g, " ").trim();

    if (/^(BEGIN|COMMIT|ROLLBACK|CREATE|ALTER)/i.test(text)) return { rows: [], rowCount: 0 };

    // projectTeamRecipients: eier i public, eier i legacy, aktive medlemmer.
    if (text.includes("FROM projects p JOIN users u")) {
      return { rows: team.includes(OWNER) ? [{ uid: OWNER, n: "Eier Eiersen" }] : [] };
    }
    if (text.includes("FROM legacy.projects p JOIN users u")) return { rows: [] };
    if (text.includes("FROM project_team_members m")) {
      return {
        rows: team
          .filter((id) => id !== OWNER)
          .map((id) => ({ uid: id, n: `Navn ${id}` })),
      };
    }

    if (text.startsWith("INSERT INTO project_notifications")) {
      const dedupeKey = params[13] ?? null;
      if (dedupeKey && notifications.some((n) => n.dedupe_key === dedupeKey)) {
        return { rows: [], rowCount: 0 };
      }
      const row: NotificationRow = {
        id: `notif-${++sequence}`,
        project_id: params[0],
        audience: params[1],
        event_type: params[2],
        title: params[3],
        message: params[4] ?? null,
        linked_entity_type: params[5] ?? null,
        linked_entity_id: params[6] ?? null,
        metadata: JSON.parse(params[7] ?? "{}"),
        created_by_user_id: params[8] ?? null,
        created_by_label: params[9] ?? null,
        assigned_to_user_id: params[10] ?? null,
        assigned_to_label: params[11] ?? null,
        due_at: params[12] ?? null,
        resolved_at: null,
        archived_at: null,
        dedupe_key: dedupeKey,
        created_at: new Date(Date.now() + sequence),
      };
      notifications.push(row);
      return { rows: [{ id: row.id }], rowCount: 1 };
    }

    if (text.startsWith("INSERT INTO project_notification_recipients")) {
      for (const userId of params[1] as string[]) {
        recipients.push({ notification_id: params[0], user_id: userId, read_at: null });
      }
      return { rows: [], rowCount: (params[1] as string[]).length };
    }

    if (text.includes("SELECT n.*, r.read_at")) {
      const unreadOnly = params[1] === true;
      const rows = recipients
        .filter((r) => r.user_id === params[0])
        .filter((r) => !unreadOnly || r.read_at === null)
        .map((r) => ({
          ...notifications.find((n) => n.id === r.notification_id)!,
          read_at: r.read_at,
        }))
        .filter((n) => n.archived_at === null)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        .slice(0, params[2]);
      return { rows };
    }

    if (text.includes("SELECT COUNT(*)::int AS c")) {
      const count = recipients.filter(
        (r) => r.user_id === params[0] && r.read_at === null,
      ).length;
      return { rows: [{ c: count }] };
    }

    if (text.startsWith("SELECT * FROM project_notifications")) {
      const rows = notifications
        .filter((n) => n.project_id === params[0])
        .filter((n) => (params[1] as string[]).includes(n.audience))
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        .slice(0, params[2]);
      return { rows };
    }

    if (text.includes("SET read_at = NOW() WHERE notification_id")) {
      const target = recipients.find(
        (r) => r.notification_id === params[0] && r.user_id === params[1] && r.read_at === null,
      );
      if (!target) return { rows: [], rowCount: 0 };
      target.read_at = new Date();
      return { rows: [], rowCount: 1 };
    }

    if (text.includes("SET read_at = NOW() WHERE user_id")) {
      const targets = recipients.filter((r) => r.user_id === params[0] && r.read_at === null);
      for (const t of targets) t.read_at = new Date();
      return { rows: [], rowCount: targets.length };
    }

    return { rows: [], rowCount: 0 };
  };

  const pool: any = {
    query: (sql: string, params?: any[]) => run(sql, params),
    connect: async () => ({
      query: (sql: string, params?: any[]) => run(sql, params),
      release: () => undefined,
    }),
  };
  return { pool, notifications, recipients };
}

beforeEach(() => {
  broadcastUserEvent.mockReset();
  resetProjectNotificationSchemaCache();
});

describe("notify()", () => {
  it("writes the row and broadcasts to every recipient", async () => {
    const { pool, notifications, recipients } = createFakePool();

    const result = await notify(pool, {
      projectId: PROJECT,
      eventType: "task.assigned",
      title: "Ny oppgave: rigg lys",
      actorUserId: OWNER,
      recipientUserIds: [MEMBER],
      assignedToUserId: MEMBER,
    });

    expect(result?.recipientUserIds).toEqual([MEMBER]);
    expect(notifications).toHaveLength(1);
    expect(recipients).toEqual([
      { notification_id: result!.id, user_id: MEMBER, read_at: null },
    ]);
    expect(broadcastUserEvent).toHaveBeenCalledTimes(1);
    expect(broadcastUserEvent).toHaveBeenCalledWith(
      MEMBER,
      expect.objectContaining({
        kind: "project.notification",
        projectId: PROJECT,
        notificationId: result!.id,
        eventType: "task.assigned",
      }),
    );
  });

  it("keeps the row when the broadcast throws", async () => {
    const { pool, notifications, recipients } = createFakePool();
    broadcastUserEvent.mockImplementation(() => {
      throw new Error("redis unreachable");
    });

    const result = await notify(pool, {
      projectId: PROJECT,
      eventType: "task.assigned",
      title: "Ny oppgave",
      actorUserId: OWNER,
      recipientUserIds: [MEMBER],
    });

    expect(result).not.toBeNull();
    expect(notifications).toHaveLength(1);
    expect(recipients).toHaveLength(1);
    // Varselet står i innboksen selv om ingen fikk push.
    const inbox = await listUserInbox(pool, MEMBER);
    expect(inbox.notifications).toHaveLength(1);
    expect(inbox.unreadCount).toBe(1);
  });

  it("never notifies the actor, even when asked to", async () => {
    const { pool, recipients } = createFakePool();

    const result = await notify(pool, {
      projectId: PROJECT,
      eventType: "deliverable.file-added",
      title: "Ny fil",
      actorUserId: MEMBER,
      recipientUserIds: [MEMBER],
    });

    // Eneste forespurte mottaker var utløseren selv → ingen rad i det hele tatt.
    expect(result).toBeNull();
    expect(recipients).toHaveLength(0);
    expect(broadcastUserEvent).not.toHaveBeenCalled();
  });

  it("drops the actor but keeps the rest of the team on a broadcast event", async () => {
    const { pool } = createFakePool({ team: [OWNER, MEMBER] });

    const result = await notify(pool, {
      projectId: PROJECT,
      eventType: "deliverable.file-added",
      title: "Ny fil på Highlight",
      actorUserId: OWNER,
    });

    expect(result?.recipientUserIds).toEqual([MEMBER]);
    expect((await listUserInbox(pool, OWNER)).notifications).toHaveLength(0);
    expect((await listUserInbox(pool, MEMBER)).notifications).toHaveLength(1);
  });

  it("does not notify someone who is not on the project", async () => {
    const { pool, notifications } = createFakePool({ team: [OWNER, MEMBER] });

    const result = await notify(pool, {
      projectId: PROJECT,
      eventType: "task.assigned",
      title: "Ny oppgave",
      actorUserId: OWNER,
      recipientUserIds: [OUTSIDER],
    });

    // Forespurt mottaker er ikke i teamet → filtreres bort, ingen rad skrives.
    expect(result).toBeNull();
    expect(notifications).toHaveLength(0);
    expect((await listUserInbox(pool, OUTSIDER)).unreadCount).toBe(0);
  });

  it("collapses a repeated logical event via the dedupe key", async () => {
    const { pool, notifications } = createFakePool();
    const params = {
      projectId: PROJECT,
      eventType: "deliverable.due-soon" as const,
      title: "Frist nærmer seg",
      dedupeKey: "deliverable.due-soon:d1:2026-09-16",
    };

    expect(await notify(pool, params)).not.toBeNull();
    expect(await notify(pool, params)).toBeNull();
    expect(notifications).toHaveLength(1);
  });
});

describe("assigning a task", () => {
  it("notifies the assignee and nobody else", async () => {
    const { pool } = createFakePool({ team: [OWNER, MEMBER] });

    await notify(pool, {
      projectId: PROJECT,
      eventType: "task.assigned",
      title: "Ny oppgave: rigg lys",
      actorUserId: OWNER,
      actorLabel: "Eier Eiersen",
      recipientUserIds: [MEMBER],
      assignedToUserId: MEMBER,
      linkedEntityType: "board_task",
      linkedEntityId: "task-1",
    });

    const assignee = await listUserInbox(pool, MEMBER);
    expect(assignee.unreadCount).toBe(1);
    expect(assignee.notifications[0]).toMatchObject({
      eventType: "task.assigned",
      linkedEntityId: "task-1",
      assignedToUserId: MEMBER,
    });
    expect((await listUserInbox(pool, OWNER)).unreadCount).toBe(0);
    expect((await listUserInbox(pool, OUTSIDER)).unreadCount).toBe(0);
  });
});

describe("unread counter", () => {
  it("counts unread, and a read notification stays read", async () => {
    const { pool } = createFakePool();
    const first = await notify(pool, {
      projectId: PROJECT,
      eventType: "task.assigned",
      title: "Oppgave 1",
      actorUserId: OWNER,
      recipientUserIds: [MEMBER],
    });
    await notify(pool, {
      projectId: PROJECT,
      eventType: "task.assigned",
      title: "Oppgave 2",
      actorUserId: OWNER,
      recipientUserIds: [MEMBER],
    });

    expect((await listUserInbox(pool, MEMBER)).unreadCount).toBe(2);

    expect(await markNotificationRead(pool, MEMBER, first!.id)).toBe(true);
    const afterRead = await listUserInbox(pool, MEMBER);
    expect(afterRead.unreadCount).toBe(1);
    // Fortsatt synlig i lista, bare merket lest.
    expect(afterRead.notifications).toHaveLength(2);

    // Å merke den samme raden lest igjen endrer ingenting.
    expect(await markNotificationRead(pool, MEMBER, first!.id)).toBe(false);
    expect((await listUserInbox(pool, MEMBER)).unreadCount).toBe(1);

    expect(await markAllNotificationsRead(pool, MEMBER)).toBe(1);
    expect((await listUserInbox(pool, MEMBER)).unreadCount).toBe(0);
    expect(await markAllNotificationsRead(pool, MEMBER)).toBe(0);
  });

  it("keeps read state per user", async () => {
    const { pool } = createFakePool({ team: [OWNER, MEMBER] });
    const created = await notify(pool, {
      projectId: PROJECT,
      eventType: "deliverable.file-added",
      title: "Ny fil",
      actorUserId: "someone-else-entirely",
    });
    expect(created?.recipientUserIds.sort()).toEqual([MEMBER, OWNER].sort());

    await markNotificationRead(pool, MEMBER, created!.id);
    expect((await listUserInbox(pool, MEMBER)).unreadCount).toBe(0);
    expect((await listUserInbox(pool, OWNER)).unreadCount).toBe(1);
  });
});

describe("project activity", () => {
  it("reads the same rows, regardless of who the recipients were", async () => {
    const { pool } = createFakePool();
    await notify(pool, {
      projectId: PROJECT,
      eventType: "task.assigned",
      title: "Oppgave til ett medlem",
      actorUserId: OWNER,
      recipientUserIds: [MEMBER],
    });

    const activity = await listProjectActivity(pool, PROJECT);
    expect(activity).toHaveLength(1);
    expect(activity[0].title).toBe("Oppgave til ett medlem");
    // Ingen rader fra andre prosjekter lekker inn.
    expect(await listProjectActivity(pool, "annet-prosjekt")).toHaveLength(0);
  });
});

describe("due-soon sweep", () => {
  it("excludes finished deliverables and writes one deduped row each", async () => {
    const { pool, notifications } = createFakePool();
    let sweepParams: any[] = [];
    const inner = pool.query;
    pool.query = (sql: string, params?: any[]) => {
      if (sql.includes("FROM project_workspace_deliverables")) {
        sweepParams = params ?? [];
        return Promise.resolve({
          rows: [{ id: "d1", title: "Highlight-film", due_date: "2026-09-16" }],
        });
      }
      return inner(sql, params);
    };

    await sweepDueSoonDeliverables(pool, PROJECT);
    await sweepDueSoonDeliverables(pool, PROJECT);

    // «Ferdig» er fire synonymer på denne flaten — alle må utelukkes, ellers
    // maser bjella om frister på leveranser som alt er levert.
    expect(sweepParams[2]).toEqual([...DELIVERABLE_CLOSED_STATUSES]);
    // Andre sveip er en no-op: samme leveranse, samme dato, samme dedupe-nøkkel.
    expect(notifications).toHaveLength(1);
    expect(notifications[0].dedupe_key).toBe("deliverable.due-soon:d1:2026-09-16");
    expect(notifications[0].event_type).toBe("deliverable.due-soon");
  });
});
