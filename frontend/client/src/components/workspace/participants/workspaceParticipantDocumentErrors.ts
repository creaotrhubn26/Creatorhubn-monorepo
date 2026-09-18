export class WorkspaceParticipantDocumentsApiError extends Error {
  readonly status?: number;
  readonly code: string;
  readonly details: unknown;

  constructor(args: {
    message: string;
    status?: number;
    code?: string;
    details?: unknown;
  }) {
    super(args.message);
    this.name = "WorkspaceParticipantDocumentsApiError";
    this.status = args.status;
    this.code = args.code ?? "unknown";
    this.details = args.details ?? null;
  }
}

export function workspaceParticipantDocumentsError(
  error: unknown,
): WorkspaceParticipantDocumentsApiError {
  if (error instanceof WorkspaceParticipantDocumentsApiError) return error;
  const source =
    error && typeof error === "object"
      ? (error as { message?: unknown; status?: unknown; details?: unknown })
      : null;
  const details =
    source?.details && typeof source.details === "object"
      ? (source.details as Record<string, unknown>)
      : null;
  return new WorkspaceParticipantDocumentsApiError({
    message: String(
      details?.message ??
        source?.message ??
        "Kunne ikke kontakte dokumenttjenesten.",
    ),
    status: typeof source?.status === "number" ? source.status : undefined,
    code:
      typeof details?.error === "string"
        ? details.error
        : typeof details?.code === "string"
          ? details.code
          : "unknown",
    details,
  });
}
