import type { Pool } from "pg";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { SocialPostInput } from "./social-publisher.js";
import {
  encryptLinkedInToken,
  listManagedCompaniesForUser,
  makeLinkedInPublisher,
  publishLinkedInPostWithAccessToken,
} from "./social-publisher-linkedin.js";

const POSTS_URL = "https://api.linkedin.com/rest/posts";
const IMAGE_INITIALIZE_URL =
  "https://api.linkedin.com/rest/images?action=initializeUpload";
const VIDEO_INITIALIZE_URL =
  "https://api.linkedin.com/rest/videos?action=initializeUpload";
const VIDEO_FINALIZE_URL =
  "https://api.linkedin.com/rest/videos?action=finalizeUpload";

type ConnectionRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  linkedin_member_id: string | null;
  linkedin_email: string | null;
  linkedin_name: string | null;
  access_token_encrypted: string;
  expiry_date: string | null;
  scopes: string[];
  connection_state: string;
  profile: Record<string, unknown>;
  updated_at: string;
};

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

function emptyResponse(
  status = 201,
  headers: Record<string, string> = {},
): Response {
  return new Response(null, { status, headers });
}

function makeConnectionRow(
  overrides: Partial<ConnectionRow> & {
    token?: string;
  } = {},
): ConnectionRow {
  const {
    token = "member-token",
    ...rowOverrides
  } = overrides;
  return {
    id: "connection-global",
    user_id: "user-1",
    project_id: null,
    linkedin_member_id: "member-1",
    linkedin_email: "member@example.com",
    linkedin_name: "Member One",
    access_token_encrypted: encryptLinkedInToken(token),
    expiry_date: new Date(Date.now() + 3_600_000).toISOString(),
    scopes: ["w_member_social"],
    connection_state: "connected",
    profile: { profilePictureUrl: "https://cdn.example/member.jpg" },
    updated_at: new Date().toISOString(),
    ...rowOverrides,
  };
}

function makePool(rows: ConnectionRow[]) {
  const query = vi.fn(async () => ({
    rows,
    rowCount: rows.length,
  }));
  return {
    pool: { query } as unknown as Pool,
    query,
  };
}

function makePost(
  overrides: Partial<SocialPostInput> = {},
): SocialPostInput {
  return {
    connectionId: "connection-global",
    userId: "user-1",
    projectId: "project-1",
    mediaKind: "text",
    caption: "Hei fra Role Room",
    ...overrides,
  };
}

function requestDetails(
  fetchMock: ReturnType<typeof vi.fn>,
  url: string,
): RequestInit {
  const call = fetchMock.mock.calls.find(
    ([input]) => String(input) === url,
  );
  if (!call) throw new Error("Fant ikke fetch-kall til " + url);
  return (call[1] ?? {}) as RequestInit;
}

function parseRequestBody(init: RequestInit): Record<string, unknown> {
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

describe("LinkedIn Marketing Posts publisher", () => {
  let previousEncryptionKey: string | undefined;

  beforeEach(() => {
    previousEncryptionKey =
      process.env.ROLE_ROOM_LINKEDIN_TOKEN_ENCRYPTION_KEY;
    process.env.ROLE_ROOM_LINKEDIN_TOKEN_ENCRYPTION_KEY =
      "publisher-test-encryption-key";
  });

  afterEach(() => {
    if (previousEncryptionKey === undefined) {
      delete process.env.ROLE_ROOM_LINKEDIN_TOKEN_ENCRYPTION_KEY;
    } else {
      process.env.ROLE_ROOM_LINKEDIN_TOKEN_ENCRYPTION_KEY =
        previousEncryptionKey;
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("publishes a personal text post with the 202608 Posts contract", async () => {
    const { pool } = makePool([makeConnectionRow()]);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(POSTS_URL);
      return emptyResponse(201, {
        "x-restli-id": "urn:li:share:12345",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await makeLinkedInPublisher(pool).publish(makePost());

    expect(result).toMatchObject({
      ok: true,
      status: "published",
      externalPostId: "12345",
      accountId: "member-1",
      permalink:
        "https://www.linkedin.com/feed/update/urn:li:share:12345/",
    });
    const init = requestDetails(fetchMock, POSTS_URL);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer member-token",
      "LinkedIn-Version": "202608",
      "X-Restli-Protocol-Version": "2.0.0",
    });
    expect(parseRequestBody(init)).toEqual({
      author: "urn:li:person:member-1",
      commentary: "Hei fra Role Room",
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    });
  });

  it("initializes, uploads, and attaches a single image", async () => {
    const { pool } = makePool([makeConnectionRow()]);
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === IMAGE_INITIALIZE_URL) {
          return jsonResponse({
            value: {
              uploadUrl: "https://upload.example/image-1",
              image: "urn:li:image:image-1",
            },
          });
        }
        if (url === "https://upload.example/image-1") {
          expect(init?.headers).toEqual({
            "Content-Type": "application/octet-stream",
          });
          return emptyResponse(201);
        }
        if (url === POSTS_URL) {
          return emptyResponse(201, {
            "x-restli-id": "urn:li:ugcPost:222",
          });
        }
        throw new Error("Uventet URL: " + url);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await makeLinkedInPublisher(pool).publish(makePost({
      mediaKind: "image",
      imageUrl: "data:image/png;base64,AAE=",
      extras: { altText: "Et lite testbilde" },
    }));

    expect(result.permalink).toBe(
      "https://www.linkedin.com/feed/update/urn:li:ugcPost:222/",
    );
    const init = requestDetails(fetchMock, IMAGE_INITIALIZE_URL);
    expect(parseRequestBody(init)).toEqual({
      initializeUploadRequest: {
        owner: "urn:li:person:member-1",
      },
    });
    expect(parseRequestBody(requestDetails(fetchMock, POSTS_URL))).toMatchObject({
      content: {
        media: {
          id: "urn:li:image:image-1",
          altText: "Et lite testbilde",
        },
      },
    });
  });

  it("uploads 2 images and emits content.multiImage", async () => {
    const { pool } = makePool([makeConnectionRow()]);
    let imageIndex = 0;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === IMAGE_INITIALIZE_URL) {
          imageIndex += 1;
          return jsonResponse({
            value: {
              uploadUrl: "https://upload.example/image-" + imageIndex,
              image: "urn:li:image:image-" + imageIndex,
            },
          });
        }
        if (url.startsWith("https://upload.example/image-")) {
          return emptyResponse(201);
        }
        if (url === POSTS_URL) {
          return emptyResponse(201, {
            "x-restli-id": "urn:li:share:333",
          });
        }
        throw new Error("Uventet URL: " + url);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await makeLinkedInPublisher(pool).publish(makePost({
      mediaKind: "carousel",
      imageUrls: [
        "data:image/png;base64,AAE=",
        "data:image/jpeg;base64,AgM=",
      ],
      extras: { imageAltTexts: ["Første", "Andre"] },
    }));

    expect(result.ok).toBe(true);
    expect(parseRequestBody(requestDetails(fetchMock, POSTS_URL))).toMatchObject({
      content: {
        multiImage: {
          images: [
            { id: "urn:li:image:image-1", altText: "Første" },
            { id: "urn:li:image:image-2", altText: "Andre" },
          ],
        },
      },
    });
  });

  it("accepts at most 20 images for a LinkedIn multi-image post", () => {
    const { pool } = makePool([makeConnectionRow()]);
    const publisher = makeLinkedInPublisher(pool);
    const imageUrls = Array.from(
      { length: 20 },
      () => "data:image/png;base64,AAE=",
    );

    expect(publisher.validate(makePost({
      mediaKind: "carousel",
      imageUrls,
    }))).toBeNull();
    expect(publisher.validate(makePost({
      mediaKind: "carousel",
      imageUrls: [...imageUrls, imageUrls[0]],
    }))).toMatch(/2–20 bilder/);
  });

  it("rejects oversized encoded image data before Buffer decoding", () => {
    const publisher = makeLinkedInPublisher({
      query: vi.fn(),
    } as unknown as Pool);
    const maxImageBytes = 20 * 1024 * 1024;
    const encodedOverLimit = "A".repeat(
      Math.ceil(maxImageBytes / 3) * 4 + 5,
    );
    const bufferFrom = vi.spyOn(Buffer, "from");

    const error = publisher.validate(makePost({
      mediaKind: "image",
      imageUrl: "data:image/png;base64," + encodedOverLimit,
    }));

    expect(error).toMatch(/20 MB/);
    expect(bufferFrom).not.toHaveBeenCalled();
  });

  it("rejects a personal connection missing w_member_social before fetch", async () => {
    const { pool } = makePool([
      makeConnectionRow({ scopes: ["openid", "profile"] }),
    ]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await makeLinkedInPublisher(pool).publish(makePost());

    expect(result).toMatchObject({
      ok: false,
      status: "failed",
      reason: "scope_missing",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an expired token before fetch", async () => {
    const { pool } = makePool([
      makeConnectionRow({
        expiry_date: new Date(Date.now() - 60_000).toISOString(),
      }),
    ]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await makeLinkedInPublisher(pool).publish(makePost());

    expect(result).toMatchObject({
      ok: false,
      status: "failed",
      reason: "reconnect_required",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a legacy token without an expiry before fetch", async () => {
    const { pool } = makePool([
      makeConnectionRow({ expiry_date: null }),
    ]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await makeLinkedInPublisher(pool).publish(makePost());

    expect(result).toMatchObject({
      ok: false,
      status: "failed",
      reason: "reconnect_required",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prefers a project company token and falls back globally by approved role", async () => {
    const organizationUrn = "urn:li:organization:777";
    const projectRow = makeConnectionRow({
      id: "connection-project",
      project_id: "project-1",
      token: "project-token",
      scopes: ["r_organization_admin", "w_organization_social"],
    });
    const globalRow = makeConnectionRow({
      id: "connection-global",
      token: "global-token",
      scopes: ["r_organization_admin", "w_organization_social"],
    });
    const { pool, query } = makePool([projectRow, globalRow]);
    const aclTokens: string[] = [];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const authorization = (
          init?.headers as Record<string, string> | undefined
        )?.Authorization ?? "";
        if (url.includes("/rest/organizationAcls")) {
          aclTokens.push(authorization);
          if (authorization === "Bearer project-token") {
            return jsonResponse({
              elements: [{
                organization: "urn:li:organization:999",
                role: "ADMINISTRATOR",
                state: "APPROVED",
              }],
              paging: { total: 1 },
            });
          }
          return jsonResponse({
            elements: [{
              organization: organizationUrn,
              role: "CONTENT_ADMIN",
              state: "APPROVED",
            }],
            paging: { total: 1 },
          });
        }
        if (url === POSTS_URL) {
          expect(authorization).toBe("Bearer global-token");
          return emptyResponse(201, {
            "x-restli-id": "urn:li:share:444",
          });
        }
        throw new Error("Uventet URL: " + url);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await makeLinkedInPublisher(pool).publish(makePost({
      extras: { linkedInOrganizationUrn: organizationUrn },
    }));

    expect(result).toMatchObject({
      ok: true,
      accountId: "777",
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("project_id = $2 OR project_id IS NULL"),
      ["user-1", "project-1"],
    );
    expect(aclTokens).toEqual([
      "Bearer project-token",
      "Bearer global-token",
    ]);
    expect(parseRequestBody(requestDetails(fetchMock, POSTS_URL))).toMatchObject({
      author: organizationUrn,
    });
  });

  it("lists managed companies through current REST endpoints and project scope", async () => {
    const organizationUrn = "urn:li:organization:888";
    const { pool } = makePool([
      makeConnectionRow({
        id: "connection-project",
        project_id: "project-1",
        token: "project-token",
        scopes: ["r_organization_admin", "w_organization_social"],
      }),
      makeConnectionRow({
        token: "global-token",
        scopes: ["r_organization_admin", "w_organization_social"],
      }),
    ]);
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        expect(init?.headers).toMatchObject({
          Authorization: "Bearer project-token",
          "LinkedIn-Version": "202608",
          "X-Restli-Protocol-Version": "2.0.0",
        });
        if (url.includes("/rest/organizationAcls")) {
          return jsonResponse({
            elements: [{
              organization: organizationUrn,
              role: "ADMINISTRATOR",
              state: "APPROVED",
            }],
            paging: { total: 1 },
          });
        }
        if (url === "https://api.linkedin.com/rest/organizations/888") {
          return jsonResponse({
            id: 888,
            localizedName: "Role Room AS",
            vanityName: "role-room",
            logoV2: {
              original: "https://cdn.example/company.png",
            },
          });
        }
        throw new Error("Uventet URL: " + url);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await listManagedCompaniesForUser(
      pool,
      "user-1",
      "project-1",
    );

    expect(result).toEqual({
      companies: [{
        urn: organizationUrn,
        id: "888",
        name: "Role Room AS",
        vanityName: "role-room",
        logoUrl: "https://cdn.example/company.png",
        role: "ADMINISTRATOR",
      }],
      scopeMissing: false,
      reconnectRequired: false,
      connectionScope: "project",
    });
  });

  it("uploads video byte ranges, finalizes with ETags, and posts the media URN", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === VIDEO_INITIALIZE_URL) {
          return jsonResponse({
            value: {
              video: "urn:li:video:video-1",
              uploadToken: "upload-token",
              uploadInstructions: [
                {
                  uploadUrl: "https://upload.example/video-part-1",
                  firstByte: 0,
                  lastByte: 2,
                },
                {
                  uploadUrl: "https://upload.example/video-part-2",
                  firstByte: 3,
                  lastByte: 5,
                },
              ],
            },
          });
        }
        if (url === "https://upload.example/video-part-1") {
          return emptyResponse(201, { etag: "part-etag-1" });
        }
        if (url === "https://upload.example/video-part-2") {
          return emptyResponse(201, { etag: "part-etag-2" });
        }
        if (url === VIDEO_FINALIZE_URL) {
          return jsonResponse({ value: {} });
        }
        if (url === POSTS_URL) {
          return emptyResponse(201, {
            "x-restli-id": "urn:li:ugcPost:555",
          });
        }
        throw new Error("Uventet URL: " + url);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await publishLinkedInPostWithAccessToken({
      accessToken: "direct-token",
      authorUrn: "urn:li:organization:888",
      mediaKind: "video",
      caption: "Video fra Role Room",
      videoUrl: "data:video/mp4;base64,AAECAwQF",
    });

    expect(result.ok).toBe(true);
    expect(parseRequestBody(
      requestDetails(fetchMock, VIDEO_FINALIZE_URL),
    )).toEqual({
      finalizeUploadRequest: {
        video: "urn:li:video:video-1",
        uploadToken: "upload-token",
        uploadedPartIds: ["part-etag-1", "part-etag-2"],
      },
    });
    expect(parseRequestBody(requestDetails(fetchMock, POSTS_URL))).toMatchObject({
      content: {
        media: {
          id: "urn:li:video:video-1",
        },
      },
    });
  });

  it("uses content.article.source for link posts", async () => {
    const fetchMock = vi.fn(async () =>
      emptyResponse(201, {
        "x-restli-id": "urn:li:share:666",
      }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await publishLinkedInPostWithAccessToken({
      accessToken: "direct-token",
      authorUrn: "urn:li:person:member-1",
      mediaKind: "link",
      caption: "Les mer",
      extras: {
        link: "https://example.com/article",
        linkTitle: "Artikkel",
      },
    });

    expect(result.ok).toBe(true);
    expect(parseRequestBody(requestDetails(fetchMock, POSTS_URL))).toMatchObject({
      content: {
        article: {
          source: "https://example.com/article",
          title: "Artikkel",
        },
      },
    });
  });

  it.each([
    [401, "failed", "reconnect_required"],
    [403, "failed", "permission_denied"],
    [429, "rate_limited", "rate_limited"],
  ])(
    "maps LinkedIn HTTP %s to %s/%s",
    async (httpStatus, status, reason) => {
      const fetchMock = vi.fn(async () =>
        jsonResponse({ message: "provider failure" }, httpStatus));
      vi.stubGlobal("fetch", fetchMock);

      const result = await publishLinkedInPostWithAccessToken({
        accessToken: "direct-token",
        authorUrn: "urn:li:person:member-1",
        mediaKind: "text",
        caption: "Test",
      });

      expect(result).toMatchObject({
        ok: false,
        status,
        reason,
      });
    },
  );
});
