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
    const url = `${WS_URL}/ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      if (mountedRef.current) setStatus("connected");
    };

    ws.onmessage = (event) => {
      try {
        const update: JobUpdate = JSON.parse(event.data);
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
