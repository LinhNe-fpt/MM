/**
 * Base URL cho backend API (MM_DB).
 * - Production: để VITE_API_URL trống → fetch("/api/...") cùng host (reverse proxy).
 * - Production tách host: VITE_API_URL=http://<server>:3001
 * - Dev: nếu VITE_API_URL trống → http(s)://<hostname>:3001 để khi mở qua LAN
 *   (vd. http://192.168.x.x:5713) vẫn gọi đúng Node trên máy chạy backend, không phụ thuộc Vite proxy.
 */
function resolveApiBase(): string {
  const fromEnv = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    if (hostname) return `${protocol}//${hostname}:3001`;
  }
  return "";
}

export const API_BASE = resolveApiBase();

/** Ảnh lưu đường dẫn tương đối `/api/...` — khi gọi API qua host khác (VITE_API_URL), nối BASE vào trước. */
export function resolveMediaUrl(pathOrUrl: string | null | undefined): string | undefined {
  if (pathOrUrl == null || String(pathOrUrl).trim() === "") return undefined;
  const u = String(pathOrUrl).trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("/") && API_BASE) return `${API_BASE}${u}`;
  return u;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path.startsWith("/") ? path : "/" + path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || "Loi API");
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path.startsWith("/") ? path : "/" + path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || "Loi API");
  }
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path.startsWith("/") ? path : "/" + path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || "Loi API");
  }
  return res.json() as Promise<T>;
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path.startsWith("/") ? path : "/" + path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || "Loi API");
  }
  return res.json() as Promise<T>;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path.startsWith("/") ? path : "/" + path}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || "Loi API");
  }
  return res.json() as Promise<T>;
}
