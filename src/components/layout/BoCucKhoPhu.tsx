import { ReactNode, Component, ErrorInfo } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, ArrowLeftRight, Truck, FileBarChart, ClipboardList, Sun, Moon } from "lucide-react";
import { ThanhBenKhoPhu } from "./ThanhBenKhoPhu";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { useTheme } from "@/contexts/NguCanhGiaoDien";
import { APP_LOGO_URL } from "@/lib/app-icon";
import { KhoPhuProvider, type KhoPhuScope } from "@/contexts/NguCanhKhoPhu";

interface ErrorBoundaryProps {
  children: ReactNode;
  inline?: boolean;
  errorMessage?: string;
  reloadLabel?: string;
}
interface ErrorBoundaryState {
  hasError: boolean;
}

class PageErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state = { hasError: false };
  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }
  componentDidCatch(_err: Error, _info: ErrorInfo) {}
  render() {
    if (this.state.hasError) {
      if (this.props.inline) return null;
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
          <p className="text-sm">{this.props.errorMessage ?? "Đã xảy ra lỗi hiển thị."}</p>
          <button type="button" className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={() => window.location.reload()}>
            {this.props.reloadLabel ?? "Tải lại trang"}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function BoCucKhoPhu({ scope, children }: { scope: KhoPhuScope; children: ReactNode }) {
  const location = useLocation();
  const { t, ngonNgu, datNgonNgu } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const basePath = scope === "UPK" ? "/upk" : "/rma";

  const tabs = [
    { tkey: "rmaUpk.nav.short.dashboard", path: basePath, icon: LayoutDashboard },
    { tkey: "rmaUpk.nav.short.stock", path: `${basePath}/stock`, icon: Package },
    { tkey: "rmaUpk.nav.short.tx", path: `${basePath}/transactions`, icon: ArrowLeftRight },
    { tkey: "rmaUpk.nav.short.transfers", path: `${basePath}/transfers`, icon: Truck },
    { tkey: "rmaUpk.nav.short.reports", path: `${basePath}/reports`, icon: FileBarChart },
    { tkey: "rmaUpk.nav.short.plan", path: `${basePath}/plan`, icon: ClipboardList },
  ] as const;

  const mobileTitle = scope === "UPK" ? t("khoPhu.upk_brand") : t("khoPhu.rma_brand");
  const mobileBadge = scope === "UPK" ? "U" : "R";

  return (
    <KhoPhuProvider scope={scope}>
      <div className="flex min-h-screen w-full">
        <ThanhBenKhoPhu />
        <div className="flex min-h-screen flex-1 flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 md:hidden">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary">{mobileBadge}</div>
              <p className="truncate text-xs font-semibold text-foreground">{mobileTitle}</p>
            </div>
            <div className="flex overflow-hidden rounded-md border border-border">
              <button
                type="button"
                onClick={() => datNgonNgu("vi")}
                className={`px-2 py-1 text-xs font-medium ${ngonNgu === "vi" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                VN
              </button>
              <button
                type="button"
                onClick={() => datNgonNgu("ko")}
                className={`px-2 py-1 text-xs font-medium ${ngonNgu === "ko" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                KO
              </button>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-md border border-border p-2 text-muted-foreground btn-mechanical"
              aria-label={theme === "dark" ? t("profile.light") : t("profile.dark")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
          <main className="relative flex-1 overflow-auto pb-16 md:pb-0">
            <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center select-none" aria-hidden>
              <img
                src={APP_LOGO_URL}
                alt=""
                className="h-auto max-h-[min(456px,60vh)] w-full max-w-[min(504px,80vw)] object-contain opacity-[0.06] dark:opacity-[0.09]"
              />
            </div>
            <div className="relative z-10 h-full min-h-0">
              <PageErrorBoundary errorMessage={t("rmaUpk.error_display")} reloadLabel={t("rmaUpk.reload_page")}>
                {children}
              </PageErrorBoundary>
            </div>
          </main>
          <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card md:hidden">
            <div className="flex h-14 items-center justify-around">
              {tabs.map((tab) => {
                const on = location.pathname === tab.path;
                const Icon = tab.icon;
                const shortLabel = t(tab.tkey);
                return (
                  <Link key={tab.path} to={tab.path} className={`flex flex-col items-center gap-0.5 px-2 py-1 ${on ? "text-primary" : "text-muted-foreground"}`}>
                    <Icon className="h-5 w-5" />
                    <span className="text-[9px] font-medium">{shortLabel}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </KhoPhuProvider>
  );
}
