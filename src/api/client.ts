/**
 * Base URL cho backend API (MM_DB).
 * - Dev (Vite proxy): để trống → dùng same-origin, Vite tự proxy /api/* → localhost:3001
 * - Production hoặc truy cập trực tiếp: đặt VITE_API_URL=http://<ip>:3001 trong .env
 */
const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export const API_BASE = BASE;

/** Ảnh lưu đường dẫn tương đối `/api/...` — khi gọi API qua host khác (VITE_API_URL), nối BASE vào trước. */
export function resolveMediaUrl(pathOrUrl: string | null | undefined): string | undefined {
  if (pathOrUrl == null || String(pathOrUrl).trim() === "") return undefined;
  const u = String(pathOrUrl).trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("/") && BASE) return `${BASE}${u}`;
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
