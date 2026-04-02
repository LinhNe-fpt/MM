import type { KhsxStatus } from "@/lib/rmaUpkApi";

/**
 * Luồng trạng thái kế hoạch SX — chỉ tiến một bước, không nhảy cóc, không quay lại.
 * CHO_XUAT_VT → DANG_XUAT → (SAN_SANG | THIEU_VT) → DA_XONG
 */
const ALLOWED: Record<KhsxStatus, readonly KhsxStatus[]> = {
  CHO_XUAT_VT: ["DANG_XUAT"],
  DANG_XUAT: ["SAN_SANG", "THIEU_VT"],
  SAN_SANG: ["DA_XONG"],
  THIEU_VT: ["DA_XONG"],
  DA_XONG: [],
};

export function normalizeKhsxStatus(s: string): KhsxStatus | null {
  const u = String(s || "").trim().toUpperCase() as KhsxStatus;
  if (u in ALLOWED) return u;
  return null;
}

export function isKnownKhsxStatus(s: string): s is KhsxStatus {
  return normalizeKhsxStatus(s) != null;
}

/** Có thể bấm chuyển sang `target` từ `current` (không tính bấm lại đúng trạng thái hiện tại). */
export function khsxCoTheChuyenSang(current: KhsxStatus, target: KhsxStatus): boolean {
  if (current === target) return false;
  const next = ALLOWED[current];
  return next.includes(target);
}
