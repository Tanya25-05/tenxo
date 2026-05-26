// Tenxo API configuration
// Uses NEXT_PUBLIC_API_URL from .env.local or defaults to localhost for development

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080";

/**
 * Fetch helper that injects auth headers and the base URL.
 */
export async function apiFetch(path, options = {}) {
  const url = `${API_URL}${path}`;
  const headers = options.headers || {};

  // Add auth token from session if available
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

/**
 * Get auth token from Supabase session (stored in memory by the client).
 */
function getAuthToken() {
  try {
    // Supabase stores session in memory; accessed via the client singleton
    const { supabase } = require("./supabaseClient");
    // This is a sync snapshot; in practice the token is set in the component
    return typeof window !== "undefined" && window.__TENXO_AUTH_TOKEN;
  } catch {
    return null;
  }
}

/**
 * Set the auth token (called from _app.js when session changes).
 */
export function setGlobalAuthToken(token) {
  if (typeof window !== "undefined") {
    window.__TENXO_AUTH_TOKEN = token;
  }
}
