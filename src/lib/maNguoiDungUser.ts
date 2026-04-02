import type { User } from "@supabase/supabase-js";

/** MaNguoiDung từ tài khoản đăng nhập qua API (user.id = String(maNguoiDung)). Không có nếu không phải phiên DB. */
export function layMaNguoiDungTuUser(user: User | null): number | null {
  if (!user) return null;
  const fromDb = (user.user_metadata as { fromDb?: boolean } | undefined)?.fromDb;
  if (!fromDb) return null;
  const n = parseInt(String(user.id), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
