"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WS_URL } from "@/lib/api";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export interface JobUpdate {
  job_id: string;
  status: string;
  result_url?: string;
  error?: string;
}

interface UseNatsSocketOptions {
  token?: string | null;
  onJobUpdate?: (update: JobUpdate) => void;
}

export function useNatsSocket({ token, onJobUpdate }: UseNatsSocketOptions) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!token || !mountedRef.current) return;

    setStatus("connecting");
    const ws = new WebSocket(WS_URL + "/ws");

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth", token }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "auth_ok") {
          if (mountedRef.current) setStatus("connected");
          return;
        }
        if (msg.type === "auth_error") {
          ws.close();
          return;
        }
        const update: JobUpdate = msg;
        onJobUpdate?.(update);
      } catch {
        // silent
      }
    };

    ws.onclose = () => {
      if (mountedRef.current) {
        setStatus("disconnected");
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [token, onJobUpdate]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { status };
}
