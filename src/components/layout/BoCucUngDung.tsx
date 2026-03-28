import { ReactNode, Component, ErrorInfo } from "react";
import { useLocation, Link } from "react-router-dom";
import { LayoutGrid, Map, ScanLine, ArrowLeftRight, User, Sun, Moon } from "lucide-react";
import { ThanhBenDesktop } from "./ThanhBenDesktop";
import { ThanhCaTrucMobile } from "@/components/shift/ThanhCaTruc";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { useTheme } from "@/contexts/NguCanhGiaoDien";
import { useAuth } from "@/contexts/NguCanhXacThuc";
import { APP_LOGO_URL, Y_TE_LOGO_URL } from "@/lib/app-icon";

interface ErrorBoundaryProps { children: ReactNode; inline?: boolean; }
interface ErrorBoundaryState { hasError: boolean; }

class PageErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }
  componentDidCatch(_err: Error, _info: ErrorInfo) {
    // Auto-reset sau 2 giây để thử lại render (hữu ích cho lỗi HMR/transient)
    this.resetTimer = setTimeout(() => {
      this.setState({ hasError: false });
    }, 2000);
  }
  componentWillUnmount() {
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }
  render() {
    if (this.state.hasError) {
      if (this.props.inline) {
        // Fallback nhỏ gọn cho widget inline (mobile header...)
        return null;
      }
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4 text-muted-foreground">
          <p className="text-sm">Đã xảy ra lỗi hiển thị.</p>
          <button
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
            onClick={() => window.location.reload()}
          >
            Tải lại trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface PropsBoCucUngDung {
  children: ReactNode;
}

export function BoCucUngDung({ children }: PropsBoCucUngDung) {
  const location = useLocation();
  const { t, ngonNgu, datNgonNgu } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const quyen = (user?.user_metadata as { quyen?: string } | undefined)?.quyen;
  const coQuyenNhapXuat = quyen === "admin" || quyen === "nhan_vien";
  const laChiYTe = quyen === "y_te";

  type MucTab = {
    label: string;
    path: string;
    icon?: typeof LayoutGrid;
    logoSrc?: string;
    laGiua?: boolean;
    canXem?: boolean;
  };
  const cacTabDuoi: MucTab[] = laChiYTe
    ? [
        { label: t("nav.y_te"), path: "/yte", logoSrc: Y_TE_LOGO_URL, canXem: true },
        { label: t("nav.profile"), path: "/profile", icon: User, canXem: true },
      ]
    : [
        { label: t("nav.overview"), path: "/", icon: LayoutGrid, canXem: true },
        { label: t("nav.warehouse"), path: "/warehouse", icon: Map, canXem: true },
        { label: t("nav.y_te"), path: "/yte", logoSrc: Y_TE_LOGO_URL, canXem: true },
        { label: t("nav.scan"), path: "/scan", icon: ScanLine, laGiua: true, canXem: coQuyenNhapXuat },
        { label: t("nav.transactions"), path: "/transactions", icon: ArrowLeftRight, canXem: coQuyenNhapXuat },
        { label: t("nav.profile"), path: "/profile", icon: User, canXem: true },
      ];

  return (
    <div className="min-h-screen flex w-full">
      <ThanhBenDesktop />
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="md:hidden flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-2 min-w-0">
            <img src={APP_LOGO_URL} alt="EMS Warehouse" className="h-12 w-12 object-contain shrink-0" />
            <p className="text-xs font-semibold text-foreground truncate">EMS WAREHOUSE</p>
          </div>
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => datNgonNgu("vi")}
              className={`px-3 py-1.5 text-xs font-medium btn-mechanical ${ngonNgu === "vi" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              aria-pressed={ngonNgu === "vi"}
            >
              {t("profile.lang_vi")}
            </button>
            <button
              type="button"
              onClick={() => datNgonNgu("ko")}
              className={`px-3 py-1.5 text-xs font-medium btn-mechanical ${ngonNgu === "ko" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              aria-pressed={ngonNgu === "ko"}
            >
              {t("profile.lang_ko")}
            </button>
          </div>
          {!laChiYTe && (
            <PageErrorBoundary inline><ThanhCaTrucMobile /></PageErrorBoundary>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-md border border-border btn-mechanical text-muted-foreground hover:text-foreground"
            aria-label={theme === "dark" ? t("profile.light") : t("profile.dark")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
        <main className="flex-1 pb-20 md:pb-0 relative overflow-hidden">
          {/* Watermark YOUSUNG — ẩn trên /yte và trên /profile khi user y_te (họ dùng logo Chữ thập đỏ trong trang) */}
          {!location.pathname.startsWith("/yte") && !(laChiYTe && location.pathname.startsWith("/profile")) && (
            <div
              className="pointer-events-none select-none absolute inset-0 z-0 flex items-center justify-center"
              aria-hidden
            >
              <img
                src={APP_LOGO_URL}
                alt=""
                className="h-auto w-full max-h-[min(504px,66vh)] max-w-[min(624px,85vw)] object-contain opacity-[0.09] dark:opacity-[0.12]"
              />
            </div>
          )}
          <div className="relative z-10 h-full"><PageErrorBoundary>{children}</PageErrorBoundary></div>
        </main>
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card md:hidden">
          <div className="flex items-center justify-around h-16">
            {cacTabDuoi.filter(tab => tab.canXem !== false).map((tab) => {
              const dangChon = location.pathname === tab.path;
              const Icon = tab.icon;
              const iconEl = tab.logoSrc ? (
                <img src={tab.logoSrc} alt="" className="h-5 w-5 object-contain" width={20} height={20} decoding="async" />
              ) : Icon ? (
                <Icon className="w-5 h-5" />
              ) : null;
              if (tab.laGiua) {
                return (
                  <Link key={tab.path} to={tab.path} className="scanner-fab !fixed !bottom-8 !right-1/2 !translate-x-1/2 md:hidden" style={{ position: "fixed", bottom: "1.5rem" }}>
                    {Icon ? <Icon className="w-7 h-7" /> : iconEl}
                  </Link>
                );
              }
              return (
                <Link key={tab.path} to={tab.path} className={`flex flex-col items-center gap-0.5 px-3 py-1.5 btn-mechanical ${dangChon ? "text-primary" : "text-muted-foreground"}`}>
                  {iconEl}
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
