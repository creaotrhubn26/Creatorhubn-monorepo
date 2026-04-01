const BASE_URL =
  process.env.ACADEMY_TEST_BASE_URL?.trim() || "http://127.0.0.1:3003";
const ADMIN_EMAIL = "academy-guest@creatorhubn.com";
const ADMIN_PASSWORD = "guest-access";
const VALID_ORG_NUMBER = "923609016";
const VALID_COMPANY_NAME = "EQUINOR ASA";

type JsonRecord = Record<string, unknown>;

type LoginResponse = {
  success: boolean;
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
};

type InviteRequestSummary = {
  id: string;
  email: string;
  status?: string | null;
  processedBy?: string | null;
  processedDate?: string | null;
  source?: string | null;
};

type AdminUserSummary = {
  id: string;
  email: string;
  status?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  approvedByUserId?: string | null;
};

type AcademyAccessSummaryResponse = {
  success?: boolean;
  data?: {
    userId?: string | null;
    email?: string | null;
    access?: {
      status?: string | null;
      approvedBy?: string | null;
      approvedByUserId?: string | null;
      approvedByRoleLabel?: string | null;
    } | null;
  } | null;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function requestJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    const errorMessage =
      typeof data?.error === "string"
        ? data.error
        : `${response.status} ${response.statusText}`;
    throw new Error(`${options.method || "GET"} ${path} failed: ${errorMessage}`);
  }

  return data as T;
}

async function loginAsAdmin(): Promise<LoginResponse> {
  return requestJson<LoginResponse>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });
}

async function loginAsInstructor(email: string): Promise<LoginResponse> {
  return requestJson<LoginResponse>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: ADMIN_PASSWORD,
      loginAs: "production_team",
      role: "instructor",
    }),
  });
}

async function createInviteRequest(email: string): Promise<string> {
  const payload = await requestJson<{ requestId: string }>("/api/invite-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      firstName: "Academy",
      lastName: "Student",
      profession: "photographer",
      companyName: VALID_COMPANY_NAME,
      organizationNumber: VALID_ORG_NUMBER,
      businessAddress: "Forusbeen 50, 4035 Stavanger",
      phoneNumber: "90000000",
      website: "https://example.com",
      message: "academy access approval test",
      selectedPlan: "pro",
      planName: "Pro Creator",
      planPrice: 599,
      source: "academy-landing",
    }),
  });

  assert(payload.requestId, "Invite request creation did not return requestId");
  return payload.requestId;
}

async function listInviteRequests(): Promise<InviteRequestSummary[]> {
  return requestJson<InviteRequestSummary[]>("/api/invite-requests");
}

async function approveInviteRequest(
  inviteRequestId: string,
  instructorToken: string,
): Promise<JsonRecord> {
  return requestJson<JsonRecord>(`/api/invite-requests/${inviteRequestId}/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${instructorToken}`,
    },
    body: JSON.stringify({
      status: "approved",
      notes: "Approved by academy instructor integration test",
    }),
  });
}

async function listAdminUsers(adminToken: string): Promise<AdminUserSummary[]> {
  const payload = await requestJson<AdminUserSummary[] | { users?: AdminUserSummary[] }>(
    "/api/admin/users",
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    },
  );

  if (Array.isArray(payload)) {
    return payload;
  }

  return Array.isArray(payload.users) ? payload.users : [];
}

async function readAcademyAccessSummary(
  userEmail: string,
): Promise<AcademyAccessSummaryResponse> {
  return requestJson<AcademyAccessSummaryResponse>("/api/academy/access-summary", {
    headers: {
      "x-user-email": userEmail,
    },
  });
}

async function pollUntil<T>(
  run: () => Promise<T>,
  predicate: (value: T) => boolean,
  options: { timeoutMs?: number; intervalMs?: number; label: string },
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const intervalMs = options.intervalMs ?? 750;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = await run();
    if (predicate(value)) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out while waiting for ${options.label}`);
}

async function main() {
  const runId = Date.now();
  const studentEmail = `academy-access-student-${runId}@creatorhubn.test`;
  const instructorEmail = `academy-access-instructor-${runId}@creatorhubn.test`;

  console.log(`[academy-access] Base URL: ${BASE_URL}`);

  const adminSession = await loginAsAdmin();
  assert(adminSession.token, "Admin login did not return token");
  console.log(
    `[academy-access] Admin session: ${adminSession.user.email} (${adminSession.user.role})`,
  );

  const instructorSession = await loginAsInstructor(instructorEmail);
  assert(instructorSession.user.role === "instructor", "Expected instructor role");
  console.log(
    `[academy-access] Instructor session: ${instructorSession.user.email} (${instructorSession.user.role})`,
  );

  const inviteRequestId = await createInviteRequest(studentEmail);
  console.log(`[academy-access] Created invite request: ${inviteRequestId}`);

  const pendingInvite = await pollUntil(
    async () => {
      const invites = await listInviteRequests();
      return invites.find((invite) => invite.id === inviteRequestId) || null;
    },
    (invite) => Boolean(invite && invite.status === "pending"),
    { label: "pending invite request to be readable from /api/invite-requests" },
  );
  assert(pendingInvite, "Created invite request was not returned by /api/invite-requests");
  assert(pendingInvite.processedBy == null, "New invite request should not be processed");

  const approvalResponse = await approveInviteRequest(
    inviteRequestId,
    instructorSession.token,
  );
  const processedBy = approvalResponse.processedBy as JsonRecord | undefined;
  assert(
    processedBy?.id === instructorSession.user.id,
    "Approval response did not return instructor as processedBy.id",
  );
  assert(
    processedBy?.role === "instructor",
    "Approval response did not return processedBy.role=instructor",
  );
  console.log(
    `[academy-access] Approved request with instructor: ${String(
      processedBy?.id,
    )}`,
  );

  const approvedInvite = await pollUntil(
    async () => {
      const invites = await listInviteRequests();
      return invites.find((invite) => invite.id === inviteRequestId) || null;
    },
    (invite) =>
      Boolean(
        invite &&
          invite.status === "approved" &&
          invite.processedBy === instructorSession.user.id,
      ),
    { label: "approved invite request to expose processedBy" },
  );
  assert(approvedInvite, "Approved invite request could not be reloaded");

  const approvedAdminUser = await pollUntil(
    async () => {
      const users = await listAdminUsers(adminSession.token);
      return (
        users.find(
          (user) => String(user.email || "").toLowerCase() === studentEmail,
        ) || null
      );
    },
    (user) =>
      Boolean(
        user &&
          user.status === "approved" &&
          user.approvedByUserId === instructorSession.user.id &&
          user.approvedBy,
      ),
    { label: "admin users snapshot to expose approvedBy + approvedByUserId" },
  );
  assert(approvedAdminUser, "Admin users snapshot did not include approved user");

  const studentAccessSummary = await pollUntil(
    async () => readAcademyAccessSummary(studentEmail),
    (payload) =>
      Boolean(
        payload.data?.access &&
          payload.data.access.status === "approved" &&
          payload.data.access.approvedByUserId === instructorSession.user.id &&
          payload.data.access.approvedBy,
      ),
    { label: "academy access summary to expose approvedBy + approvedByUserId" },
  );
  assert(
    studentAccessSummary.data?.access?.approvedByUserId === instructorSession.user.id,
    "Student academy access summary did not expose the instructor approver",
  );

  console.log("[academy-access] Verified:");
  console.log(`  inviteRequestId: ${inviteRequestId}`);
  console.log(`  studentEmail: ${studentEmail}`);
  console.log(`  instructorUserId: ${instructorSession.user.id}`);
  console.log(`  adminApprovedBy: ${approvedAdminUser.approvedBy}`);
  console.log(
    `  adminApprovedByUserId: ${approvedAdminUser.approvedByUserId}`,
  );
  console.log(
    `  academyApprovedBy: ${studentAccessSummary.data?.access?.approvedBy}`,
  );
}

main().catch((error) => {
  console.error(
    `[academy-access] FAILED: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(1);
});
