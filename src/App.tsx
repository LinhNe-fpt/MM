import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/contexts/NguCanhNgonNgu";
import { ThemeProvider } from "@/contexts/NguCanhGiaoDien";
import { AuthProvider, useAuth } from "@/contexts/NguCanhXacThuc";
import { CaProvider } from "@/contexts/NguCanhCa";
import { BoCucMM } from "@/components/layout/BoCucMM";
import { BoCucKhoPhu } from "@/components/layout/BoCucKhoPhu";
import TrangTongQuan from "@/pages/TrangTongQuan";
import TrangSoDoKho from "@/pages/TrangSoDoKho";
import TrangNhapXuat from "@/pages/TrangNhapXuat";
import TrangThanhPhan from "@/pages/TrangThanhPhan";
import TrangQuetMa from "@/pages/TrangQuetMa";
import TrangCaNhan from "@/pages/TrangCaNhan";
import TrangDangNhap from "@/pages/TrangDangNhap";
import TrangQuenMatKhau from "@/pages/TrangQuenMatKhau";
import TrangDatLaiMatKhau from "@/pages/TrangDatLaiMatKhau";
import TrangBOM from "@/pages/TrangBOM";
import TrangBOMNew from "@/pages/TrangBOMNew";
import TrangQuanLyNguoiDung from "@/pages/TrangQuanLyNguoiDung";
import TrangBoPhanVaiTro from "@/pages/TrangBoPhanVaiTro";
import TrangCaLamViec from "@/pages/TrangCaLamViec";
import TrangDanhMuc from "@/pages/TrangDanhMuc";
import TrangKhongTimThay from "@/pages/TrangKhongTimThay";
import TrangYTe from "@/pages/TrangYTe";
import TrangMRO from "@/pages/TrangMRO";
import TrangRmaUpkDashboard from "@/pages/rma-upk/TrangRmaUpkDashboard";
import TrangRmaUpkTonKho from "@/pages/rma-upk/TrangRmaUpkTonKho";
import TrangRmaUpkGiaoDich from "@/pages/rma-upk/TrangRmaUpkGiaoDich";
import TrangRmaUpkChuyenKho from "@/pages/rma-upk/TrangRmaUpkChuyenKho";
import TrangRmaUpkBaoCao from "@/pages/rma-upk/TrangRmaUpkBaoCao";
import TrangKeHoachSanXuatImport from "@/pages/rma-upk/TrangKeHoachSanXuatImport";
import TrangKeHoachSanXuatDashboard from "@/pages/rma-upk/TrangKeHoachSanXuatDashboard";
import {
  duocVaoMm,
  duocVaoRmaUpk,
  duocVaoUpk,
  duocVaoRma,
  layQuyenTuUser,
  laVaiTroChiRmaUpk,
} from "@/lib/phanVungHeThong";

/** Đích mặc định khi user chỉ có quyền kho phụ (hoặc admin chưa chọn — ưu tiên UPK). */
function duongKhoPhuMacDinh(q: string): string {
  if (duocVaoUpk(q) && !duocVaoRma(q)) return "/upk";
  if (duocVaoRma(q) && !duocVaoUpk(q)) return "/rma";
  return "/upk";
}

const queryClient = new QueryClient();

/** True neu dang truy cap qua mang (IP/hostname), khong phai localhost */
function laTruyCapMang(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host !== "localhost" && host !== "127.0.0.1";
}

/** Khi truy cap qua link mang ma chua dang nhap -> chuyen thang ve /auth */
function ChuyenMangVeLogin({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { user, loading } = useAuth();
  const path = pathname.replace(/^\/mm\/?/, "") || "/";
  const pathNorm = path.startsWith("/") ? path : "/" + path;
  const laTrangCongKhai =
    pathNorm === "/auth" || pathNorm === "/forgot-password" || pathNorm === "/reset-password" ||
    pathNorm.startsWith("/auth") || pathNorm.startsWith("/forgot-password") || pathNorm.startsWith("/reset-password");
  if (!loading && laTruyCapMang() && !user && !laTrangCongKhai) {
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
}

type Quyen = "admin" | "nhan_vien" | "kiem_kho";

function layQuyen(user: ReturnType<typeof useAuth>["user"]): Quyen | null {
  if (!user) return null;
  return ((user.user_metadata as { quyen?: string } | undefined)?.quyen as Quyen) ?? null;
}

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

/** Bảo vệ route: yêu cầu đăng nhập */
function TuyenBaoVe({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

/** Bảo vệ route: yêu cầu đăng nhập + có một trong các quyền cho phép */
function TuyenPhanQuyen({
  children,
  quyen: cacQuyen,
}: {
  children: React.ReactNode;
  quyen: Quyen[];
}) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/auth" replace />;
  const q = layQuyen(user);
  if (!q || !cacQuyen.includes(q)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function TuyenCongKhai({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    const q = layQuyenTuUser(user);
    if (duocVaoRmaUpk(q) && !duocVaoMm(q)) return <Navigate to={duongKhoPhuMacDinh(q)} replace />;
    if (duocVaoMm(q)) return <Navigate to="/" replace />;
    if (q === "y_te") return <Navigate to="/yte" replace />;
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
}

/** Luồng `/upk` — admin, nhân viên MM, hoặc vai trò upk */
function TuyenUpk({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/auth" replace />;
  const q = layQuyenTuUser(user);
  if (!duocVaoUpk(q)) {
    if (duocVaoRma(q)) return <Navigate to="/rma" replace />;
    if (duocVaoMm(q)) return <Navigate to="/" replace />;
    if (q === "y_te") return <Navigate to="/yte" replace />;
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
}

/** Luồng `/rma` — admin, nhân viên MM, hoặc vai trò rma */
function TuyenRma({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/auth" replace />;
  const q = layQuyenTuUser(user);
  if (!duocVaoRma(q)) {
    if (duocVaoUpk(q)) return <Navigate to="/upk" replace />;
    if (duocVaoMm(q)) return <Navigate to="/" replace />;
    if (q === "y_te") return <Navigate to="/yte" replace />;
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
}

/** Chuyển URL cũ `/rma-upk` → `/upk` hoặc `/rma` (giữ phần đường dẫn sau). */
function ChuyenHuongRmaUpkCu() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/auth" replace />;
  const q = layQuyenTuUser(user);
  if (!duocVaoRmaUpk(q)) {
    if (duocVaoMm(q)) return <Navigate to="/" replace />;
    if (q === "y_te") return <Navigate to="/yte" replace />;
    return <Navigate to="/auth" replace />;
  }
  const rest = pathname.replace(/^\/rma-upk/, "") || "";
  const target = duongKhoPhuMacDinh(q) + (rest === "" ? "" : rest);
  return <Navigate to={target} replace />;
}

/** Chỉ tài khoản được phép module kho MM — chặn upk/rma gõ tay URL MM */
/** Kho MM — chặn upk/rma/y_te (y_te chỉ /yte + /profile qua TuyenMmHoacYTe) */
function TuyenVungMm({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/auth" replace />;
  const q = layQuyenTuUser(user);
  if (!duocVaoMm(q)) {
    if (duocVaoRmaUpk(q)) return <Navigate to={duongKhoPhuMacDinh(q)} replace />;
    if (q === "y_te") return <Navigate to="/yte" replace />;
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
}

/** Layout MM + trang chỉ dành cho y_te: /yte, /profile */
function TuyenMmHoacYTe({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/auth" replace />;
  const q = layQuyenTuUser(user);
  if (laVaiTroChiRmaUpk(q)) return <Navigate to={duongKhoPhuMacDinh(q)} replace />;
  if (!duocVaoMm(q) && q !== "y_te") return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter
            basename={import.meta.env.BASE_URL.replace(/\/$/, "") || undefined}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <AuthProvider>
              <CaProvider>
              <ChuyenMangVeLogin>
              <Routes>
                <Route path="/auth" element={<TuyenCongKhai><TrangDangNhap /></TuyenCongKhai>} />
                <Route path="/login" element={<Navigate to="/auth" replace />} />
                <Route path="/forgot-password" element={<TuyenCongKhai><TrangQuenMatKhau /></TuyenCongKhai>} />
                <Route path="/reset-password" element={<TrangDatLaiMatKhau />} />
                <Route path="/rma-upk/*" element={<ChuyenHuongRmaUpkCu />} />
                {/* ── Luồng kho UPK ── */}
                <Route path="/upk" element={<TuyenBaoVe><TuyenUpk><BoCucKhoPhu scope="UPK"><TrangRmaUpkDashboard /></BoCucKhoPhu></TuyenUpk></TuyenBaoVe>} />
                <Route path="/upk/stock" element={<TuyenBaoVe><TuyenUpk><BoCucKhoPhu scope="UPK"><TrangRmaUpkTonKho /></BoCucKhoPhu></TuyenUpk></TuyenBaoVe>} />
                <Route path="/upk/transactions" element={<TuyenBaoVe><TuyenUpk><BoCucKhoPhu scope="UPK"><TrangRmaUpkGiaoDich /></BoCucKhoPhu></TuyenUpk></TuyenBaoVe>} />
                <Route path="/upk/transfers" element={<TuyenBaoVe><TuyenUpk><BoCucKhoPhu scope="UPK"><TrangRmaUpkChuyenKho /></BoCucKhoPhu></TuyenUpk></TuyenBaoVe>} />
                <Route path="/upk/reports" element={<TuyenBaoVe><TuyenUpk><BoCucKhoPhu scope="UPK"><TrangRmaUpkBaoCao /></BoCucKhoPhu></TuyenUpk></TuyenBaoVe>} />
                <Route path="/upk/plan" element={<TuyenBaoVe><TuyenUpk><BoCucKhoPhu scope="UPK"><TrangKeHoachSanXuatDashboard /></BoCucKhoPhu></TuyenUpk></TuyenBaoVe>} />
                <Route path="/upk/plan/import" element={<TuyenBaoVe><TuyenUpk><BoCucKhoPhu scope="UPK"><TrangKeHoachSanXuatImport /></BoCucKhoPhu></TuyenUpk></TuyenBaoVe>} />
                {/* ── Luồng kho RMA ── */}
                <Route path="/rma" element={<TuyenBaoVe><TuyenRma><BoCucKhoPhu scope="RMA"><TrangRmaUpkDashboard /></BoCucKhoPhu></TuyenRma></TuyenBaoVe>} />
                <Route path="/rma/stock" element={<TuyenBaoVe><TuyenRma><BoCucKhoPhu scope="RMA"><TrangRmaUpkTonKho /></BoCucKhoPhu></TuyenRma></TuyenBaoVe>} />
                <Route path="/rma/transactions" element={<TuyenBaoVe><TuyenRma><BoCucKhoPhu scope="RMA"><TrangRmaUpkGiaoDich /></BoCucKhoPhu></TuyenRma></TuyenBaoVe>} />
                <Route path="/rma/transfers" element={<TuyenBaoVe><TuyenRma><BoCucKhoPhu scope="RMA"><TrangRmaUpkChuyenKho /></BoCucKhoPhu></TuyenRma></TuyenBaoVe>} />
                <Route path="/rma/reports" element={<TuyenBaoVe><TuyenRma><BoCucKhoPhu scope="RMA"><TrangRmaUpkBaoCao /></BoCucKhoPhu></TuyenRma></TuyenBaoVe>} />
                <Route path="/rma/plan" element={<TuyenBaoVe><TuyenRma><BoCucKhoPhu scope="RMA"><TrangKeHoachSanXuatDashboard /></BoCucKhoPhu></TuyenRma></TuyenBaoVe>} />
                <Route path="/rma/plan/import" element={<TuyenBaoVe><TuyenRma><BoCucKhoPhu scope="RMA"><TrangKeHoachSanXuatImport /></BoCucKhoPhu></TuyenRma></TuyenBaoVe>} />

                {/* ── Module kho MM — chỉ vai trò không thuộc bộ phận RMA/UPK độc quyền ── */}
                <Route path="/" element={<TuyenBaoVe><TuyenVungMm><BoCucMM><TrangTongQuan /></BoCucMM></TuyenVungMm></TuyenBaoVe>} />
                <Route path="/warehouse" element={<TuyenBaoVe><TuyenVungMm><BoCucMM><TrangSoDoKho /></BoCucMM></TuyenVungMm></TuyenBaoVe>} />
                <Route path="/components" element={<TuyenBaoVe><TuyenVungMm><BoCucMM><TrangThanhPhan /></BoCucMM></TuyenVungMm></TuyenBaoVe>} />
                <Route path="/bom" element={<TuyenBaoVe><TuyenVungMm><BoCucMM><TrangBOM /></BoCucMM></TuyenVungMm></TuyenBaoVe>} />
                <Route path="/bom-new" element={<TuyenBaoVe><TuyenVungMm><BoCucMM><TrangBOMNew /></BoCucMM></TuyenVungMm></TuyenBaoVe>} />
                <Route path="/profile" element={<TuyenBaoVe><TuyenMmHoacYTe><BoCucMM><TrangCaNhan /></BoCucMM></TuyenMmHoacYTe></TuyenBaoVe>} />
                <Route path="/khsx" element={<TuyenBaoVe><TuyenVungMm><BoCucMM><TrangKeHoachSanXuatDashboard /></BoCucMM></TuyenVungMm></TuyenBaoVe>} />
                <Route path="/khsx/import" element={<TuyenBaoVe><TuyenVungMm><BoCucMM><TrangKeHoachSanXuatImport /></BoCucMM></TuyenVungMm></TuyenBaoVe>} />
                <Route path="/mro" element={<TuyenBaoVe><TuyenVungMm><BoCucMM><TrangMRO /></BoCucMM></TuyenVungMm></TuyenBaoVe>} />
                <Route path="/yte" element={<TuyenBaoVe><TuyenMmHoacYTe><BoCucMM><TrangYTe /></BoCucMM></TuyenMmHoacYTe></TuyenBaoVe>} />

                {/* ── Nhân viên ca + Admin ── */}
                <Route path="/transactions" element={<TuyenBaoVe><TuyenVungMm><TuyenPhanQuyen quyen={["admin","nhan_vien"]}><BoCucMM><TrangNhapXuat /></BoCucMM></TuyenPhanQuyen></TuyenVungMm></TuyenBaoVe>} />
                <Route path="/shifts" element={<TuyenBaoVe><TuyenVungMm><TuyenPhanQuyen quyen={["admin","nhan_vien"]}><BoCucMM><TrangCaLamViec /></BoCucMM></TuyenPhanQuyen></TuyenVungMm></TuyenBaoVe>} />
                <Route path="/shifts/:id/report" element={<TuyenBaoVe><TuyenVungMm><TuyenPhanQuyen quyen={["admin","nhan_vien"]}><BoCucMM><TrangCaLamViec /></BoCucMM></TuyenPhanQuyen></TuyenVungMm></TuyenBaoVe>} />
                <Route path="/scan" element={<TuyenBaoVe><TuyenVungMm><TuyenPhanQuyen quyen={["admin","nhan_vien"]}><BoCucMM><TrangQuetMa /></BoCucMM></TuyenPhanQuyen></TuyenVungMm></TuyenBaoVe>} />

                {/* ── Admin only ── */}
                <Route path="/admin/users" element={<TuyenBaoVe><TuyenVungMm><TuyenPhanQuyen quyen={["admin"]}><BoCucMM><TrangQuanLyNguoiDung /></BoCucMM></TuyenPhanQuyen></TuyenVungMm></TuyenBaoVe>} />
                <Route path="/admin/roles" element={<TuyenBaoVe><TuyenVungMm><TuyenPhanQuyen quyen={["admin"]}><BoCucMM><TrangBoPhanVaiTro /></BoCucMM></TuyenPhanQuyen></TuyenVungMm></TuyenBaoVe>} />
                <Route path="/admin/categories" element={<TuyenBaoVe><TuyenVungMm><TuyenPhanQuyen quyen={["admin"]}><BoCucMM><TrangDanhMuc /></BoCucMM></TuyenPhanQuyen></TuyenVungMm></TuyenBaoVe>} />
                <Route path="*" element={<TrangKhongTimThay />} />
              </Routes>
              </ChuyenMangVeLogin>
              </CaProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
