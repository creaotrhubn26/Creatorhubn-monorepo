import { apiRequest } from "@/lib/queryClient";

/** Opens the user-events socket with a short-lived, single-use credential. */
export async function openUserEventsWebSocket(wsBase: string): Promise<WebSocket> {
  const response: any = await apiRequest("/api/realtime/user-events/ticket", {
    method: "POST",
    body: {},
  });
  const ticket = typeof response?.ticket === "string" ? response.ticket : "";
  if (!ticket) throw new Error("realtime_ticket_missing");
  return new WebSocket(`${wsBase.replace(/\/+$/, "")}/api/ipad/ws/events?ticket=${encodeURIComponent(ticket)}`);
}
