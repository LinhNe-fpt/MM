import { useAuth } from "@/contexts/NguCanhXacThuc";

export type Quyen = "admin" | "nhan_vien" | "kiem_kho" | "y_te";

/** Hook tiện ích để kiểm tra quyền người dùng hiện tại */
export function useQuyen() {
  const { user } = useAuth();
  const quyen = ((user?.user_metadata as { quyen?: string } | undefined)?.quyen ?? null) as Quyen | null;

  return {
    quyen,
    laAdmin: quyen === "admin",
    laNhanVien: quyen === "nhan_vien",
    laKiemKho: quyen === "kiem_kho",
    laYTe: quyen === "y_te",
    /** Có thể tạo/sửa/xóa giao dịch và quản lý ca */
    coQuyenThaoTac: quyen === "admin" || quyen === "nhan_vien",
    /** Chỉ xem, không được thêm/sửa/xóa */
    chiXem: quyen === "kiem_kho",
  };
}
