/** Nhãn quyền đăng nhập (đồng bộ keys `users.role_*` trong phienDich). */
export function nhanQuyenTuMa(ma: string | null | undefined, t: (key: string) => string): string {
  const q = String(ma ?? "").trim().toLowerCase();
  switch (q) {
    case "admin":
      return t("users.role_admin");
    case "viewer":
      return t("users.role_viewer");
    case "staff":
      return t("users.role_staff");
    case "nhan_vien":
      return t("users.role_nhan_vien");
    case "kiem_kho":
      return t("users.role_kiem_kho");
    case "upk":
      return t("users.role_upk");
    case "rma":
      return t("users.role_rma");
    case "y_te":
      return t("users.role_y_te");
    default:
      return ma?.trim() ? String(ma).trim() : t("users.role_staff");
  }
}
