import { useEffect, useState } from "react";
import authSessionService from "../services/authSessionService";

const PROTECTED_OUTPUT_PREFIX = "/api/role-room/feed-mockup-outputs/";

export function isProtectedRoleRoomMediaUrl(
  value: string | null | undefined,
): boolean {
  if (!value) return false;
  try {
    const url = new URL(
      value,
      typeof window === "undefined"
        ? "https://theroleroom.com"
        : window.location.origin,
    );
    return (
      url.pathname.startsWith(PROTECTED_OUTPUT_PREFIX) &&
      url.pathname.endsWith("/content")
    );
  } catch {
    return false;
  }
}

async function readProtectedMedia(value: string): Promise<Blob> {
  const response = await fetch(value, {
    headers: authSessionService.getAuthHeadersSync(),
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(
      `Kunne ikke hente mockup-mediet (HTTP ${response.status}).`,
    );
  }
  return response.blob();
}

export async function roleRoomMediaToDataUrl(
  value: string | null | undefined,
): Promise<string | undefined> {
  if (!value) return undefined;
  if (!isProtectedRoleRoomMediaUrl(value)) return value;
  const blob = await readProtectedMedia(value);
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Kunne ikke lese mockup-mediet."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

/** Resolves protected project media to a short-lived local object URL for img/video previews. */
export function useRoleRoomMediaUrl(value: string | null | undefined): {
  url: string | null;
  loading: boolean;
  error: string | null;
} {
  const [resolved, setResolved] = useState<string | null>(value ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;
    setError(null);
    if (!value || !isProtectedRoleRoomMediaUrl(value)) {
      setResolved(value ?? null);
      setLoading(false);
      return () => undefined;
    }
    setResolved(null);
    setLoading(true);
    void readProtectedMedia(value)
      .then((blob) => {
        if (disposed) return;
        objectUrl = URL.createObjectURL(blob);
        setResolved(objectUrl);
      })
      .catch((caught) => {
        if (!disposed)
          setError(
            caught instanceof Error
              ? caught.message
              : "Kunne ikke hente mockup-mediet.",
          );
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [value]);

  return { url: resolved, loading, error };
}
