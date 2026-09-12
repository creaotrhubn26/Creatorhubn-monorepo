export const STORYBOARD_ROOM_NATIVE_CLIENT = "storyboard-room" as const;

export type RoleRoomGoogleNativeClient = typeof STORYBOARD_ROOM_NATIVE_CLIENT;

export function parseRoleRoomGoogleNativeClient(
  value: unknown,
): RoleRoomGoogleNativeClient | null {
  return value === STORYBOARD_ROOM_NATIVE_CLIENT
    ? STORYBOARD_ROOM_NATIVE_CLIENT
    : null;
}

export function buildRoleRoomNativeGoogleReturnUrl(
  nativeClient: RoleRoomGoogleNativeClient | null | undefined,
  params: Record<string, string | null | undefined>,
): string | null {
  if (nativeClient !== STORYBOARD_ROOM_NATIVE_CLIENT) {
    return null;
  }

  const url = new URL("storyboardstudio://oauth");
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}
