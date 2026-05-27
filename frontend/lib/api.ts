export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080";

interface ApiOptions extends RequestInit {
  token?: string;
}

export async function apiFetch<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;
  const url = `${API_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...fetchOptions, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T = any>(path: string, body: unknown, options: ApiOptions = {}): Promise<T> {
  return apiFetch<T>(path, {
    ...options,
    method: "POST",
    body: JSON.stringify(body),
  });
}
