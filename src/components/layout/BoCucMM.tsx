import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/NguCanhXacThuc";
import { layQuyenTuUser, laVaiTroChiYTe } from "@/lib/phanVungHeThong";
import { BoCucUngDung } from "./BoCucUngDung";

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

/** Layout MM: user chỉ UPK/RMA không vào được — chuyển sang đúng luồng kho phụ */
export function BoCucMM({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  const q = layQuyenTuUser(user);
  if (q === "upk") return <Navigate to="/upk" replace />;
  if (q === "rma") return <Navigate to="/rma" replace />;
  if (laVaiTroChiYTe(q)) {
    const path = location.pathname.replace(/^\/mm\/?/, "/") || "/";
    const ok = path === "/yte" || path.startsWith("/yte/") || path === "/profile" || path.startsWith("/profile/");
    if (!ok) return <Navigate to="/yte" replace />;
  }
  return <BoCucUngDung>{children}</BoCucUngDung>;
}
