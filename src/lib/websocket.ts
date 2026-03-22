import type {
  TickData,
  CandleUpdate,
  SignalEvent,
  LiveSnapshot,
  HeartbeatData,
  ExcursionsResponse,
  WSMessage,
} from "./api";

const WS_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace("http", "ws") ||
  "ws://localhost:8000";

export interface WSHandlers {
  onTick: (data: TickData) => void;
  onCandle: (data: CandleUpdate) => void;
  onSignal: (data: SignalEvent) => void;
  onSnapshot: (data: LiveSnapshot) => void;
  onHeartbeat: (data: HeartbeatData) => void;
  onExcursion?: (data: ExcursionsResponse) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function createTypedWebSocket(handlers: WSHandlers): {
  close: () => void;
} {
  if (typeof window === "undefined") return { close: () => {} };

  let ws: WebSocket | null = null;
  let reconnectDelay = 3000;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  let intentionalClose = false;

  function resetHeartbeatTimer() {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = setTimeout(() => {
      // No heartbeat for 60s — force reconnect
      if (ws) {
        ws.close();
      }
    }, 60000);
  }

  function connect() {
    ws = new WebSocket(`${WS_URL}/ws/live`);

    ws.onopen = () => {
      reconnectDelay = 3000; // Reset backoff on successful connect
      handlers.onConnect();
      resetHeartbeatTimer();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        switch (msg.type) {
          case "tick":
            handlers.onTick(msg.data);
            break;
          case "candle":
            handlers.onCandle(msg.data);
            break;
          case "signal":
            handlers.onSignal(msg.data);
            break;
          case "snapshot":
            handlers.onSnapshot(msg.data);
            break;
          case "heartbeat":
            handlers.onHeartbeat(msg.data);
            resetHeartbeatTimer();
            break;
          case "excursion":
            handlers.onExcursion?.(msg.data);
            break;
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onerror = () => {
      // Error handled by onclose
    };

    ws.onclose = () => {
      handlers.onDisconnect();
      if (heartbeatTimer) clearTimeout(heartbeatTimer);

      if (!intentionalClose) {
        // Exponential backoff: 3s -> 6s -> 12s -> max 30s
        reconnectTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 30000);
      }
    };
  }

  connect();

  return {
    close: () => {
      intentionalClose = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      if (ws) ws.close();
    },
  };
}

// Keep legacy export for backward compatibility
export function createWebSocket(
  onMessage: (data: LiveSnapshot) => void,
  onError?: (error: Event) => void,
  onClose?: () => void
): WebSocket | null {
  if (typeof window === "undefined") return null;

  const ws = new WebSocket(`${WS_URL}/ws/live`);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      // Handle both old flat format and new typed format
      if (msg.type === "snapshot") {
        onMessage(msg.data as LiveSnapshot);
      } else if (!msg.type && msg.bot_running !== undefined) {
        onMessage(msg as LiveSnapshot);
      }
    } catch {
      // Ignore
    }
  };

  ws.onerror = (error) => {
    onError?.(error);
  };

  ws.onclose = () => {
    onClose?.();
  };

  return ws;
}
