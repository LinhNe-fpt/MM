import type { User } from "@supabase/supabase-js";

/**
 * Quy định truy cập theo bộ phận (UI + route):
 * - Luồng **UPK** (`/upk`): admin, nhan_vien, upk
 * - Luồng **RMA** (`/rma`): admin, nhan_vien, rma
 * - Module **kho MM** (IMS): mọi quyền không phải chỉ upk/rma/y_te (admin, nhan_vien, kiem_kho, …)
 * - **upk** / **rma** chỉ dùng đúng một luồng kho phụ, không vào layout MM
 * - **y_te** chỉ giao diện Y tế (`/yte`) + hồ sơ (`/profile`), không vào kho MM
 * - **admin** vào được MM + cả hai luồng UPK/RMA + Y tế
 */
export function layQuyenTuUser(user: User | null): string {
  if (!user) return "";
  return String((user.user_metadata as { quyen?: string } | undefined)?.quyen ?? "")
    .trim()
    .toLowerCase();
}

export function laVaiTroChiRmaUpk(quyen: string): boolean {
  return quyen === "upk" || quyen === "rma";
}

/** Chỉ nhân sự Y tế — không dùng menu kho MM */
export function laVaiTroChiYTe(quyen: string): boolean {
  return quyen === "y_te";
}

/** Luồng kho UPK (`/upk`) — admin, nhân viên MM, hoặc vai trò upk */
export function duocVaoUpk(quyen: string): boolean {
  return quyen === "admin" || quyen === "nhan_vien" || quyen === "upk";
}

/** Luồng kho RMA (`/rma`) — admin, nhân viên MM, hoặc vai trò rma */
export function duocVaoRma(quyen: string): boolean {
  return quyen === "admin" || quyen === "nhan_vien" || quyen === "rma";
}

/** Có thể vào ít nhất một trong hai module phụ (UPK hoặc RMA) */
export function duocVaoRmaUpk(quyen: string): boolean {
  return duocVaoUpk(quyen) || duocVaoRma(quyen);
}

export function duocVaoMm(quyen: string): boolean {
  if (!quyen) return false;
  return !laVaiTroChiRmaUpk(quyen) && !laVaiTroChiYTe(quyen);
}
