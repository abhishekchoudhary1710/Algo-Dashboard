import { LiveSnapshot } from "./api";

const WS_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace("http", "ws") ||
  "ws://localhost:8000";

export function createWebSocket(
  onMessage: (data: LiveSnapshot) => void,
  onError?: (error: Event) => void,
  onClose?: () => void
): WebSocket | null {
  if (typeof window === "undefined") return null;

  const ws = new WebSocket(`${WS_URL}/ws/live`);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as LiveSnapshot;
      onMessage(data);
    } catch {
      console.error("Failed to parse WebSocket message");
    }
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
    onError?.(error);
  };

  ws.onclose = () => {
    console.log("WebSocket closed");
    onClose?.();
  };

  return ws;
}
