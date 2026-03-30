import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Truck,
  FileBarChart,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  LogOut,
  Factory,
  ArrowRightLeft,
} from "lucide-react";
import { SIDEBAR_BRAND_LOGO_URL } from "@/lib/app-icon";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { useTheme } from "@/contexts/NguCanhGiaoDien";
import { useAuth } from "@/contexts/NguCanhXacThuc";
import { useKhoPhu } from "@/contexts/NguCanhKhoPhu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

export function ThanhBenKhoPhu() {
  const [thuGon, setThuGon] = useState(false);
  const location = useLocation();
  const { t, ngonNgu, datNgonNgu } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { signOut, user } = useAuth();
  const { basePath, scope } = useKhoPhu();
  const quyen = String((user?.user_metadata as { quyen?: string } | undefined)?.quyen || "").toLowerCase();
  const coVeMM = quyen === "admin" || quyen === "nhan_vien";
  const adminHaiKho = quyen === "admin" || quyen === "nhan_vien";

  const NAV = useMemo(
    () =>
      [
        { tkey: "rmaUpk.nav.dashboard", path: basePath, icon: LayoutDashboard },
        { tkey: "rmaUpk.nav.stock", path: `${basePath}/stock`, icon: Package },
        { tkey: "rmaUpk.nav.tx", path: `${basePath}/transactions`, icon: ArrowLeftRight },
        { tkey: "rmaUpk.nav.transfers", path: `${basePath}/transfers`, icon: Truck },
        { tkey: "rmaUpk.nav.reports", path: `${basePath}/reports`, icon: FileBarChart },
        { tkey: "rmaUpk.nav.plan", path: `${basePath}/plan`, icon: ClipboardList },
      ] as const,
    [basePath],
  );

  const brandTitle = scope === "UPK" ? t("khoPhu.upk_brand") : t("khoPhu.rma_brand");
  const brandTag = scope === "UPK" ? t("khoPhu.upk_tagline") : t("khoPhu.rma_tagline");
  const duongKhoKia = scope === "UPK" ? "/rma" : "/upk";
  const nhanKhoKia = scope === "UPK" ? t("khoPhu.switch_to_rma") : t("khoPhu.switch_to_upk");

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r border-border bg-sidebar transition-all",
        thuGon ? "w-20" : "w-64",
      )}
      style={{ transitionDuration: "var(--snap-duration)", transitionTimingFunction: "var(--snap-curve)" }}
    >
      <div className={cn("border-b border-border flex items-center gap-3", thuGon ? "h-16 px-3" : "h-20 px-4")}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Factory className="h-6 w-6" aria-hidden />
        </div>
        {!thuGon && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-foreground">{brandTitle}</p>
            <p className="truncate text-[11px] text-muted-foreground">{brandTag}</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto py-3">
        {NAV.map((m) => {
          const label = t(m.tkey);
          const dangChon = location.pathname === m.path;
          const Icon = m.icon;
          const linkClass = cn(
            "flex h-10 items-center gap-3 px-4 btn-mechanical transition-colors",
            dangChon
              ? "border-r-2 border-primary bg-sidebar-accent text-primary"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            thuGon && "justify-center px-0",
          );
          const inner = (
            <>
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {!thuGon && <span className="truncate text-sm font-medium">{label}</span>}
            </>
          );
          return thuGon ? (
            <Tooltip key={m.path}>
              <TooltipTrigger asChild>
                <Link to={m.path} className={linkClass} aria-label={label} style={{ transitionDuration: "var(--snap-duration)" }}>
                  {inner}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          ) : (
            <Link key={m.path} to={m.path} className={linkClass} style={{ transitionDuration: "var(--snap-duration)" }}>
              {inner}
            </Link>
          );
        })}

        {adminHaiKho && (
          <div className="mt-2 border-t border-border pt-2">
            {!thuGon && (
              <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{t("khoPhu.link_other_flow")}</p>
            )}
            {thuGon ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to={duongKhoKia}
                    className="flex h-10 items-center justify-center px-0 text-muted-foreground btn-mechanical hover:bg-sidebar-accent hover:text-foreground"
                    aria-label={nhanKhoKia}
                  >
                    <ArrowRightLeft className="h-4 w-4" aria-hidden />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{nhanKhoKia}</TooltipContent>
              </Tooltip>
            ) : (
              <Link
                to={duongKhoKia}
                className="flex h-10 items-center gap-3 px-4 text-sm text-muted-foreground btn-mechanical hover:bg-sidebar-accent hover:text-foreground"
              >
                <ArrowRightLeft className="h-4 w-4 shrink-0" />
                <span className="truncate font-medium">{nhanKhoKia}</span>
              </Link>
            )}
          </div>
        )}

        {coVeMM && (
          <div className="mt-4 border-t border-border pt-2">
            {!thuGon && (
              <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{t("rmaUpk.links_section")}</p>
            )}
            {thuGon ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/"
                    className="flex h-10 items-center justify-center px-0 text-muted-foreground btn-mechanical hover:bg-sidebar-accent hover:text-foreground"
                    aria-label={t("rmaUpk.back_mm")}
                  >
                    <img src={SIDEBAR_BRAND_LOGO_URL} alt="" className="h-[2.1rem] w-[2.1rem] object-contain opacity-80" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{t("rmaUpk.back_mm_aria")}</TooltipContent>
              </Tooltip>
            ) : (
              <Link
                to="/"
                className="flex h-10 items-center gap-3 px-4 text-sm text-muted-foreground btn-mechanical hover:bg-sidebar-accent hover:text-foreground"
              >
                <img src={SIDEBAR_BRAND_LOGO_URL} alt="" className="h-[2.4rem] w-[2.4rem] shrink-0 object-contain opacity-90" />
                <span className="truncate font-medium">{t("rmaUpk.back_mm")}</span>
              </Link>
            )}
          </div>
        )}
      </nav>

      <div className="space-y-1 border-t border-border px-2 py-2">
        <div className={cn("flex items-center gap-1", thuGon ? "justify-center" : "justify-between")}>
          <div className="flex overflow-hidden rounded-md border border-border">
            <button
              type="button"
              onClick={() => datNgonNgu("vi")}
              className={cn(
                "px-2 py-1 text-xs font-medium btn-mechanical",
                ngonNgu === "vi" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={ngonNgu === "vi"}
            >
              {thuGon ? "V" : t("profile.lang_vi")}
            </button>
            <button
              type="button"
              onClick={() => datNgonNgu("ko")}
              className={cn(
                "px-2 py-1 text-xs font-medium btn-mechanical",
                ngonNgu === "ko" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={ngonNgu === "ko"}
            >
              {thuGon ? "한" : t("profile.lang_ko")}
            </button>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={toggleTheme} aria-label={theme === "dark" ? t("profile.light") : t("profile.dark")}>
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{theme === "dark" ? t("profile.light") : t("profile.dark")}</TooltipContent>
          </Tooltip>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => signOut()}
              className={cn(
                "flex h-9 w-full items-center gap-2.5 rounded-md px-3 btn-mechanical text-status-critical/80 transition-colors hover:bg-status-critical/10 hover:text-status-critical",
                thuGon && "justify-center px-0",
              )}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!thuGon && <span className="text-xs font-medium">{t("profile.logout")}</span>}
            </button>
          </TooltipTrigger>
          {thuGon && <TooltipContent side="right">{t("profile.logout")}</TooltipContent>}
        </Tooltip>
      </div>
      <button
        type="button"
        onClick={() => setThuGon(!thuGon)}
        className="flex h-10 items-center justify-center border-t border-border text-muted-foreground btn-mechanical hover:text-foreground"
      >
        {thuGon ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
