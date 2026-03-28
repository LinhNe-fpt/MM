import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutGrid, Map, ArrowLeftRight, Package, Users, User, ChevronLeft, ChevronRight, ChevronDown, Sun, Moon, LogOut, CalendarClock, Tag, Layers, Boxes, Factory, BadgeCheck, ClipboardList } from "lucide-react";
import { APP_LOGO_URL, MRO_LOGO_URL, Y_TE_LOGO_URL } from "@/lib/app-icon";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { useTheme } from "@/contexts/NguCanhGiaoDien";
import { useAuth } from "@/contexts/NguCanhXacThuc";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ThanhCaTrucDesktop } from "@/components/shift/ThanhCaTruc";

export function ThanhBenDesktop() {
  const [thuGon, setThuGon] = useState(false);
  const location = useLocation();
  const { t, ngonNgu, datNgonNgu } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const quyen = (user?.user_metadata as { quyen?: string } | undefined)?.quyen;
  const laChiYTe = String(quyen ?? "").toLowerCase() === "y_te";

  const cacMucDieuHuong = useMemo(
    () => [
      { nhan: t("nav.overview"), icon: LayoutGrid, path: "/" },
      { nhan: t("nav.warehouse"), icon: Map, path: "/warehouse" },
      { nhan: t("nav.components"), icon: Package, path: "/components" },
      { nhan: "BOM Kitting", icon: Layers, path: "/bom-new" },
      ...(quyen === "admin" || quyen === "nhan_vien"
        ? [
            { nhan: t("nav.transactions"), icon: ArrowLeftRight, path: "/transactions" },
            { nhan: t("shift.nav"), icon: CalendarClock, path: "/shifts" },
          ]
        : []),
      { nhan: t("khsx.nav"), icon: ClipboardList, path: "/khsx" },
    ],
    [t, quyen],
  );

  const mmCoConDangChon = useMemo(
    () => !laChiYTe && cacMucDieuHuong.some((m) => location.pathname === m.path),
    [cacMucDieuHuong, location.pathname, laChiYTe],
  );

  const [mmMo, setMmMo] = useState(true);
  useEffect(() => {
    if (mmCoConDangChon) setMmMo(true);
  }, [mmCoConDangChon]);

  return (
    <aside
      className={`hidden md:flex flex-col border-r border-border bg-sidebar transition-all ${thuGon ? "w-20" : "w-64"}`}
      style={{ transitionDuration: "var(--snap-duration)", transitionTimingFunction: "var(--snap-curve)" }}
    >
      <div className={`border-b border-border ${thuGon ? "h-16 px-3" : "h-20 px-4"} flex items-center gap-3`}>
        <img src={APP_LOGO_URL} alt="EMS Warehouse" className={`${thuGon ? "h-[3.3rem] w-[3.3rem]" : "h-[4.2rem] w-[4.2rem]"} shrink-0 object-contain`} />
        {!thuGon && (
          <div className="min-w-0">
            <p className="font-bold text-base text-foreground tracking-tight leading-5 truncate">IMS WAREHOUSE</p>
            <p className="text-[11px] text-muted-foreground truncate">Inventory Management System</p>
          </div>
        )}
      </div>
      <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto">
        {!laChiYTe && thuGon ? (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-center h-10 px-0 btn-mechanical transition-colors",
                      mmCoConDangChon
                        ? "bg-sidebar-accent text-primary border-r-2 border-primary"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                    style={{ transitionDuration: "var(--snap-duration)" }}
                    aria-label={t("nav.mm_section")}
                  >
                    <Boxes className="w-4 h-4 shrink-0" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">{t("nav.mm_section")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="right" align="start" className="w-56 z-[60]">
              {cacMucDieuHuong.map((muc) => {
                const Icon = muc.icon;
                const dangChon = location.pathname === muc.path;
                return (
                  <DropdownMenuItem key={muc.path} asChild className={cn("p-0 focus:bg-transparent", dangChon && "bg-accent")}>
                    <Link
                      to={muc.path}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none"
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="truncate">{muc.nhan}</span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : !laChiYTe ? (
          <Collapsible open={mmMo} onOpenChange={setMmMo}>
            <CollapsibleTrigger
              className={cn(
                "flex w-full items-center gap-3 h-10 px-4 btn-mechanical transition-colors text-left",
                mmCoConDangChon
                  ? "bg-sidebar-accent text-primary border-r-2 border-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
              style={{ transitionDuration: "var(--snap-duration)" }}
            >
              <Boxes className="w-4 h-4 shrink-0" aria-hidden />
              <span className="text-sm font-medium truncate flex-1">{t("nav.mm_section")}</span>
              <ChevronDown
                className={cn("w-4 h-4 shrink-0 transition-transform duration-200", mmMo && "rotate-180")}
                aria-hidden
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden">
              <div className="space-y-0.5 border-l-2 border-border ml-4 mr-1 pl-2 mt-0.5">
                {cacMucDieuHuong.map((muc) => {
                  const dangChon = location.pathname === muc.path;
                  const Icon = muc.icon;
                  return (
                    <Link
                      key={muc.path}
                      to={muc.path}
                      className={cn(
                        "flex items-center gap-2 h-9 px-2 rounded-sm btn-mechanical transition-colors text-sm",
                        dangChon
                          ? "bg-sidebar-accent text-primary font-medium"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground",
                      )}
                      style={{ transitionDuration: "var(--snap-duration)" }}
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden />
                      <span className="truncate">{muc.nhan}</span>
                    </Link>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : null}

        {/* MRO — module riêng, không gộp trong nhóm MM */}
        {!laChiYTe && (
          <div className="pt-2 mt-1 border-t border-border/60 space-y-0.5">
            {!thuGon && (
              <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {t("nav.mro_section")}
              </p>
            )}
            {thuGon ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/mro"
                    className={cn(
                      "flex items-center justify-center h-10 px-0 btn-mechanical transition-colors",
                      location.pathname === "/mro" || location.pathname.startsWith("/mro/")
                        ? "bg-sidebar-accent text-primary border-r-2 border-primary"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                    style={{ transitionDuration: "var(--snap-duration)" }}
                    aria-label={t("nav.mro")}
                  >
                    <img src={MRO_LOGO_URL} alt="" className="h-7 w-7 shrink-0 object-contain" width={28} height={28} decoding="async" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{t("nav.mro")}</TooltipContent>
              </Tooltip>
            ) : (
              <Link
                to="/mro"
                className={cn(
                  "flex items-center gap-3 h-10 px-4 btn-mechanical transition-colors",
                  location.pathname === "/mro" || location.pathname.startsWith("/mro/")
                    ? "bg-sidebar-accent text-primary border-r-2 border-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
                style={{ transitionDuration: "var(--snap-duration)" }}
              >
                <img src={MRO_LOGO_URL} alt="" className="h-8 w-8 shrink-0 object-contain" width={32} height={32} decoding="async" />
                <span className="text-sm font-medium truncate">{t("nav.mro")}</span>
              </Link>
            )}
          </div>
        )}

        {/* Y tế — module riêng, mọi user MM + chỉ y_te */}
        <div className="pt-2 mt-1 border-t border-border/60 space-y-0.5">
          {!thuGon && (
            <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              {t("nav.y_te_section")}
            </p>
          )}
          {thuGon ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/yte"
                  className={cn(
                    "flex items-center justify-center h-10 px-0 btn-mechanical transition-colors",
                    location.pathname === "/yte" || location.pathname.startsWith("/yte/")
                      ? "bg-sidebar-accent text-primary border-r-2 border-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                  style={{ transitionDuration: "var(--snap-duration)" }}
                  aria-label={t("nav.y_te")}
                >
                  <img src={Y_TE_LOGO_URL} alt="" className="h-7 w-7 shrink-0 object-contain" width={28} height={28} decoding="async" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{t("nav.y_te")}</TooltipContent>
            </Tooltip>
          ) : (
            <Link
              to="/yte"
              className={cn(
                "flex items-center gap-3 h-10 px-4 btn-mechanical transition-colors",
                location.pathname === "/yte" || location.pathname.startsWith("/yte/")
                  ? "bg-sidebar-accent text-primary border-r-2 border-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
              style={{ transitionDuration: "var(--snap-duration)" }}
            >
              <img src={Y_TE_LOGO_URL} alt="" className="h-8 w-8 shrink-0 object-contain" width={32} height={32} decoding="async" />
              <span className="text-sm font-medium truncate">{t("nav.y_te")}</span>
            </Link>
          )}
        </div>

        {laChiYTe && (
          <div className="pt-2 mt-1 border-t border-border/60 space-y-0.5">
            {thuGon ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/profile"
                    className={cn(
                      "flex items-center justify-center h-10 px-0 btn-mechanical transition-colors",
                      location.pathname === "/profile" || location.pathname.startsWith("/profile/")
                        ? "bg-sidebar-accent text-primary border-r-2 border-primary"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                    style={{ transitionDuration: "var(--snap-duration)" }}
                    aria-label={t("nav.profile")}
                  >
                    <User className="w-4 h-4 shrink-0" aria-hidden />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{t("nav.profile")}</TooltipContent>
              </Tooltip>
            ) : (
              <Link
                to="/profile"
                className={cn(
                  "flex items-center gap-3 h-10 px-4 btn-mechanical transition-colors",
                  location.pathname === "/profile" || location.pathname.startsWith("/profile/")
                    ? "bg-sidebar-accent text-primary border-r-2 border-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
                style={{ transitionDuration: "var(--snap-duration)" }}
              >
                <User className="w-4 h-4 shrink-0" aria-hidden />
                <span className="text-sm font-medium truncate">{t("nav.profile")}</span>
              </Link>
            )}
          </div>
        )}

        {/* Kho phụ UPK / RMA — admin mở được; user upk/rma vào thẳng luồng tương ứng, không thấy MM */}
        {quyen === "admin" && (
          <div className="pt-2 mt-1 border-t border-border/60 space-y-0.5">
            {!thuGon && (
              <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {t("khoPhu.nav_section")}
              </p>
            )}
            {thuGon ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/upk"
                      className={cn(
                        "flex items-center justify-center h-10 px-0 btn-mechanical transition-colors",
                        location.pathname === "/upk" || location.pathname.startsWith("/upk/")
                          ? "bg-sidebar-accent text-primary border-r-2 border-primary"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                      style={{ transitionDuration: "var(--snap-duration)" }}
                      aria-label={t("khoPhu.nav_upk")}
                    >
                      <span className="text-xs font-bold tabular-nums" aria-hidden>
                        U
                      </span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{t("khoPhu.nav_upk")}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/rma"
                      className={cn(
                        "flex items-center justify-center h-10 px-0 btn-mechanical transition-colors",
                        location.pathname === "/rma" || location.pathname.startsWith("/rma/")
                          ? "bg-sidebar-accent text-primary border-r-2 border-primary"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                      style={{ transitionDuration: "var(--snap-duration)" }}
                      aria-label={t("khoPhu.nav_rma")}
                    >
                      <span className="text-xs font-bold tabular-nums" aria-hidden>
                        R
                      </span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{t("khoPhu.nav_rma")}</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <>
                <Link
                  to="/upk"
                  className={cn(
                    "flex items-center gap-3 h-10 px-4 btn-mechanical transition-colors",
                    location.pathname === "/upk" || location.pathname.startsWith("/upk/")
                      ? "bg-sidebar-accent text-primary border-r-2 border-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                  style={{ transitionDuration: "var(--snap-duration)" }}
                >
                  <Factory className="w-4 h-4 shrink-0" aria-hidden />
                  <span className="text-sm font-medium truncate">{t("khoPhu.nav_upk")}</span>
                </Link>
                <Link
                  to="/rma"
                  className={cn(
                    "flex items-center gap-3 h-10 px-4 btn-mechanical transition-colors",
                    location.pathname === "/rma" || location.pathname.startsWith("/rma/")
                      ? "bg-sidebar-accent text-primary border-r-2 border-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                  style={{ transitionDuration: "var(--snap-duration)" }}
                >
                  <Factory className="w-4 h-4 shrink-0" aria-hidden />
                  <span className="text-sm font-medium truncate">{t("khoPhu.nav_rma")}</span>
                </Link>
              </>
            )}
          </div>
        )}

        {/* Admin section — chỉ hiện với quyen === "admin" */}
        {quyen === "admin" && (
          <div className="pt-2">
            {!thuGon && (
              <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {t("admin.nav")}
              </p>
            )}
            {thuGon ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/admin/users"
                    className={`flex items-center justify-center h-10 px-0 btn-mechanical transition-colors ${location.pathname === "/admin/users" ? "bg-sidebar-accent text-primary border-r-2 border-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}
                    style={{ transitionDuration: "var(--snap-duration)" }}
                    aria-label={t("admin.users_nav")}
                  >
                    <Users className="w-4 h-4 shrink-0" aria-hidden />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{t("admin.users_nav")}</TooltipContent>
              </Tooltip>
            ) : (
              <Link
                to="/admin/users"
                className={`flex items-center gap-3 h-10 px-4 btn-mechanical transition-colors ${location.pathname === "/admin/users" ? "bg-sidebar-accent text-primary border-r-2 border-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}
                style={{ transitionDuration: "var(--snap-duration)" }}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span className="text-sm font-medium truncate">{t("admin.users_nav")}</span>
              </Link>
            )}
            {thuGon ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/admin/roles"
                    className={`flex items-center justify-center h-10 px-0 btn-mechanical transition-colors ${location.pathname === "/admin/roles" ? "bg-sidebar-accent text-primary border-r-2 border-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}
                    style={{ transitionDuration: "var(--snap-duration)" }}
                    aria-label={t("admin.roles_nav")}
                  >
                    <BadgeCheck className="w-4 h-4 shrink-0" aria-hidden />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{t("admin.roles_nav")}</TooltipContent>
              </Tooltip>
            ) : (
              <Link
                to="/admin/roles"
                className={`flex items-center gap-3 h-10 px-4 btn-mechanical transition-colors ${location.pathname === "/admin/roles" ? "bg-sidebar-accent text-primary border-r-2 border-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}
                style={{ transitionDuration: "var(--snap-duration)" }}
              >
                <BadgeCheck className="w-4 h-4 shrink-0" />
                <span className="text-sm font-medium truncate">{t("admin.roles_nav")}</span>
              </Link>
            )}
            {thuGon ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/admin/categories"
                    className={`flex items-center justify-center h-10 px-0 btn-mechanical transition-colors ${location.pathname === "/admin/categories" ? "bg-sidebar-accent text-primary border-r-2 border-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}
                    style={{ transitionDuration: "var(--snap-duration)" }}
                    aria-label={t("admin.categories_nav")}
                  >
                    <Tag className="w-4 h-4 shrink-0" aria-hidden />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{t("admin.categories_nav")}</TooltipContent>
              </Tooltip>
            ) : (
              <Link
                to="/admin/categories"
                className={`flex items-center gap-3 h-10 px-4 btn-mechanical transition-colors ${location.pathname === "/admin/categories" ? "bg-sidebar-accent text-primary border-r-2 border-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}
                style={{ transitionDuration: "var(--snap-duration)" }}
              >
                <Tag className="w-4 h-4 shrink-0" />
                <span className="text-sm font-medium truncate">{t("admin.categories_nav")}</span>
              </Link>
            )}
          </div>
        )}
      </nav>
      {/* Shift status bar — không áp dụng luồng chỉ Y tế */}
      {!laChiYTe && <ThanhCaTrucDesktop thuGon={thuGon} />}

      <div className="border-t border-border space-y-1 py-2 px-2">
        <div className={`flex items-center gap-1 ${thuGon ? "justify-center" : "justify-between"}`}>
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => datNgonNgu("vi")}
              className={`px-2 py-1 text-xs font-medium btn-mechanical ${ngonNgu === "vi" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title={t("profile.lang_vi")}
              aria-pressed={ngonNgu === "vi"}
            >
              {thuGon ? "V" : t("profile.lang_vi")}
            </button>
            <button
              type="button"
              onClick={() => datNgonNgu("ko")}
              className={`px-2 py-1 text-xs font-medium btn-mechanical ${ngonNgu === "ko" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title={t("profile.lang_ko")}
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

        {/* Logout button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={signOut}
              className={`w-full flex items-center gap-2.5 h-9 px-3 rounded-md btn-mechanical text-status-critical/80 hover:text-status-critical hover:bg-status-critical/10 transition-colors ${thuGon ? "justify-center px-0" : ""}`}
              style={{ transitionDuration: "var(--snap-duration)" }}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!thuGon && <span className="text-xs font-medium">{t("profile.logout")}</span>}
            </button>
          </TooltipTrigger>
          {thuGon && (
            <TooltipContent side="right">{t("profile.logout")}</TooltipContent>
          )}
        </Tooltip>
      </div>
      <button onClick={() => setThuGon(!thuGon)} className="h-10 flex items-center justify-center border-t border-border text-muted-foreground hover:text-foreground btn-mechanical">
        {thuGon ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
