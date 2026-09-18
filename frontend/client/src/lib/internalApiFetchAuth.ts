type LocationAuthority = Pick<Location, "origin" | "host">;

export function withInternalApiAuthorization(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  location: LocationAuthority,
  readToken: () => string | null,
): RequestInit | undefined {
  // Explicit anonymous transport wins over every global/session default.
  if (init?.credentials === "omit") return init;

  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const isInternalApi =
    url.startsWith("/api/") ||
    url.startsWith(location.origin + "/api/") ||
    (url.startsWith("http") &&
      url.includes("/api/") &&
      new URL(url).host === location.host);
  if (!isInternalApi) return init;

  const token = readToken();
  if (!token) return init;
  const requestHeaders =
    typeof input !== "string" && !(input instanceof URL)
      ? input.headers
      : undefined;
  const headers = new Headers(init?.headers ?? requestHeaders);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", "Bearer " + token);
  }
  return {
    ...(init ?? {}),
    headers,
    credentials: init?.credentials ?? "include",
  };
}
