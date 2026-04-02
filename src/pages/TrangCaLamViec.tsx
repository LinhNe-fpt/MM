import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { usePhanTrang } from "@/lib/usePhanTrang";
import { PhanTrang } from "@/components/ui/PhanTrang";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarClock, Play, Square, Clock, Loader2,
  ArrowDownToLine, ArrowUpFromLine, TrendingUp, TrendingDown, Minus,
  AlertTriangle, ShieldAlert, RefreshCw, UserCheck,
  type LucideIcon,
} from "lucide-react";
import { API_BASE } from "@/api/client";
import { useCa, CaLamViec, KetQuaBatDauCa } from "@/contexts/NguCanhCa";
import { useAuth } from "@/contexts/NguCanhXacThuc";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { Button } from "@/components/ui/button";

/**
 * Render icon + spinner bằng CSS opacity, không bao giờ thêm/xoá DOM node.
 * Tránh lỗi insertBefore/removeChild khi browser (Chrome translate/spellcheck)
 * đã inject node vào trong vùng React đang quản lý.
 */
function SpinIcon({ busy, Icon, cls = "w-4 h-4" }: { busy: boolean; Icon: LucideIcon; cls?: string }) {
  return (
    <span className="relative flex items-center justify-center" style={{ width: "1rem", height: "1rem" }} aria-hidden>
      <Loader2
        className={`absolute ${cls} animate-spin transition-opacity duration-150 ${busy ? "opacity-100" : "opacity-0"}`}
      />
      <Icon
        className={`${cls} transition-opacity duration-150 ${busy ? "opacity-0" : "opacity-100"}`}
      />
    </span>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ShiftItem extends CaLamViec {
  loaiCa: "day" | "day_ot" | "night" | "night_ot" | "gap";
  soPhieu: number;
  tongNhap: number;
  tongXuat: number;
}

interface TonKhoRow {
  maLinhKien: string;
  maViTri: number;
  moTa: string;
  viTri: string;
  tonDau: number;
  tonCuoi: number;
  delta: number;
}

interface GiaoDichRow {
  id: string;
  type: "IN" | "OUT";
  category: string;
  partNumber: string;
  partName: string;
  quantity: number;
  bin: string;
  operator: string;
  timestamp: string;
}

interface BaoCaoCa {
  ca: CaLamViec & { tenNguoiDung: string | null };
  tonKho: TonKhoRow[];
  giaoDich: GiaoDichRow[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(start: string, end?: string | null): string {
  const ms = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime();
  if (ms < 0) return "—";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}g ${m}p`;
  return `${m} phút`;
}

function formatTime(dt: string): string {
  return new Date(dt).toLocaleString("vi-VN", {
    hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
  });
}

// ─── Dialog: Ca của chính user đang mở ───────────────────────────────────────

function DialogSameUser({
  maCa,
  onContinue,
  onRestart,
  onClose,
  busy,
}: {
  maCa: number;
  onContinue: () => void;
  onRestart: () => void;
  onClose: () => void;
  busy: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative bg-background border border-border rounded-2xl shadow-2xl p-6 w-full max-w-md"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="font-bold text-base">{t("shift.dialog_same_user_title")}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("shift.dialog_same_user_desc", { maCa: String(maCa) })}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button className="w-full" onClick={onContinue} disabled={busy}>
            <UserCheck className="w-4 h-4 mr-1.5" />
            {t("shift.dialog_continue_shift")}
          </Button>
          <Button variant="outline" className="w-full border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30" onClick={onRestart} disabled={busy}>
            <SpinIcon busy={busy} Icon={RefreshCw} />
            <span className="ml-1.5">{t("shift.dialog_end_and_new")}</span>
          </Button>
          <button type="button" className="text-xs text-muted-foreground hover:underline mt-1" onClick={onClose}>
            {t("common.cancel")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Dialog: Ca của người khác đang mở ───────────────────────────────────────

function DialogConflict({
  info,
  isAdmin,
  onForceClose,
  onClose,
  busy,
}: {
  info: { maCa: number; tenNguoiDung: string; thoiGianBatDau: string };
  isAdmin: boolean;
  onForceClose: () => void;
  onClose: () => void;
  busy: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative bg-background border border-border rounded-2xl shadow-2xl p-6 w-full max-w-md"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="font-bold text-base">{t("shift.dialog_conflict_title")}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("shift.dialog_conflict_desc", { name: info.tenNguoiDung })}
            </p>
            <div className="mt-2 px-3 py-2 bg-muted/60 rounded-lg text-xs">
              <p className="text-muted-foreground">{t("shift.dialog_conflict_since")}</p>
              <p className="font-semibold mt-0.5">{formatTime(info.thoiGianBatDau)}</p>
              <p className="text-muted-foreground mt-1">{t("shift.dialog_conflict_duration")}: {formatDuration(info.thoiGianBatDau)}</p>
            </div>
          </div>
        </div>

        {isAdmin ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{t("shift.dialog_admin_warning")}</span>
            </div>
            <Button
              variant="destructive"
              className="w-full"
              onClick={onForceClose}
              disabled={busy}
            >
              <SpinIcon busy={busy} Icon={ShieldAlert} />
              <span className="ml-1.5">{t("shift.dialog_admin_force_close")}</span>
            </Button>
            <button type="button" className="w-full text-xs text-muted-foreground hover:underline mt-1 block text-center" onClick={onClose}>
              {t("common.cancel")}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground border border-border rounded-lg px-3 py-2">
              {t("shift.dialog_contact_admin")}
            </p>
            <Button variant="outline" className="w-full" onClick={onClose}>
              {t("common.close")}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Shift card ───────────────────────────────────────────────────────────────

function ShiftCard({ item, isAdmin, onViewReport, onForceClose }: {
  item: ShiftItem;
  isAdmin: boolean;
  onViewReport: (maCa: number) => void;
  onForceClose?: (maCa: number) => void;
}) {
  const { t } = useI18n();
  const isActive = item.trangThai === "active";

  return (
    <div
      className={`border rounded-xl p-4 transition-all hover:shadow-sm ${isActive ? "border-emerald-400/50 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-border bg-card"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {isActive
            ? <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0 mt-0.5" />
            : <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 shrink-0 mt-0.5" />
          }
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">{item.tenNguoiDung ?? `#${item.maNguoiDung}`}</span>
              <span
                className={`text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-full border ${
                  item.loaiCa === "day"
                    ? "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800"
                    : item.loaiCa === "night"
                      ? "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800"
                      : "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                }`}
              >
                {item.loaiCa === "day"
                  ? t("khsx.shift_cn")
                  : item.loaiCa === "night"
                    ? t("khsx.shift_cd")
                    : t("shift.shift_gap")}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                {isActive ? t("shift.status_active") : t("shift.status_closed")}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">#{item.maCa}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{formatTime(item.thoiGianBatDau)}</span>
              {item.thoiGianKetThuc && <span>→ {formatTime(item.thoiGianKetThuc)}</span>}
              <span className="text-primary font-medium">({formatDuration(item.thoiGianBatDau, item.thoiGianKetThuc)})</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400 font-semibold">
                <ArrowDownToLine className="w-3 h-3" />
                {Math.round(item.tongNhap).toLocaleString()}
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-semibold">
                <ArrowUpFromLine className="w-3 h-3" />
                {Math.round(item.tongXuat).toLocaleString()}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{item.soPhieu} {t("shift.phieu")}</p>
          </div>

          {isActive && isAdmin && onForceClose && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={() => onForceClose(item.maCa)}
              title={t("shift.admin_force_close_hint")}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 px-2.5"
            onClick={() => onViewReport(item.maCa)}
          >
            {t("shift.view_report")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Report drawer ────────────────────────────────────────────────────────────

function BaoCaoDrawer({ maCa, onClose }: { maCa: number | null; onClose: () => void }) {
  const { t } = useI18n();
  const [data, setData] = useState<BaoCaoCa | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"ton" | "giao-dich">("ton");
  const [filterDelta, setFilterDelta] = useState<"all" | "changed">("changed");

  useEffect(() => {
    if (!maCa) { setData(null); return; }
    setLoading(true);
    fetch(`${API_BASE}/api/shifts/${maCa}/report`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [maCa]);

  const tonKhoFiltered = useMemo(
    () => (data?.tonKho ?? []).filter((r) => filterDelta === "all" || r.delta !== 0),
    [data, filterDelta],
  );
  const pgTon = usePhanTrang(tonKhoFiltered);
  const pgGd = usePhanTrang(data?.giaoDich ?? []);

  useEffect(() => {
    pgTon.resetPage();
    pgGd.resetPage();
  }, [maCa, tab, filterDelta, pgTon.resetPage, pgGd.resetPage]);

  if (!maCa) return null;

  return (
    <AnimatePresence>
      {maCa && (
        <motion.div
          className="fixed inset-0 z-50 flex"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative ml-auto w-full max-w-2xl h-full bg-background border-l border-border flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-border shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-base">{t("shift.report_title")} #{maCa}</h2>
                  {data && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {data.ca.tenNguoiDung} · {formatTime(data.ca.thoiGianBatDau)}
                      {data.ca.thoiGianKetThuc && ` → ${formatTime(data.ca.thoiGianKetThuc)}`}
                      {" "}({formatDuration(data.ca.thoiGianBatDau, data.ca.thoiGianKetThuc)})
                    </p>
                  )}
                </div>
                <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">✕</button>
              </div>

              {data && (
                <div className="flex gap-2 mt-3">
                  {[
                    { label: t("shift.ton_dau"), value: data.tonKho.reduce((s, r) => s + r.tonDau, 0), Icon: null, color: "text-foreground" },
                    { label: t("shift.tong_nhap"), value: data.giaoDich.filter(g => g.type === "IN").reduce((s, g) => s + g.quantity, 0), Icon: ArrowDownToLine, color: "text-blue-600 dark:text-blue-400" },
                    { label: t("shift.tong_xuat"), value: data.giaoDich.filter(g => g.type === "OUT").reduce((s, g) => s + g.quantity, 0), Icon: ArrowUpFromLine, color: "text-amber-600 dark:text-amber-400" },
                    { label: t("shift.ton_cuoi"), value: data.tonKho.reduce((s, r) => s + r.tonCuoi, 0), Icon: null, color: "text-foreground" },
                  ].map(({ label, value, Icon, color }) => (
                    <div key={label} className="flex-1 rounded-lg bg-muted/50 px-2 py-2 text-center">
                      <p className={`text-sm font-bold tabular-nums ${color}`}>
                        {Icon && <Icon className={`inline w-3 h-3 mr-0.5 mb-0.5 ${color}`} />}
                        {Math.round(value).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-1 mt-3">
                {(["ton", "giao-dich"] as const).map((tabKey) => (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => setTab(tabKey)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === tabKey ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    {tabKey === "ton" ? t("shift.tab_inventory") : t("shift.tab_transactions")}
                  </button>
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {loading ? (
                <div className="flex h-40 flex-1 items-center justify-center overflow-y-auto">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : !data ? (
                <div className="flex h-40 flex-1 items-center justify-center overflow-y-auto text-sm text-muted-foreground">{t("error.load_data")}</div>
              ) : tab === "ton" ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
                    <div className="flex gap-2 mb-3">
                      {(["changed", "all"] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFilterDelta(f)}
                          className={`text-[11px] px-2.5 py-1 rounded border transition-colors ${filterDelta === f ? "border-primary text-primary bg-primary/5" : "border-border text-muted-foreground hover:border-muted-foreground"}`}
                        >
                          {f === "changed" ? t("shift.filter_changed") : t("shift.filter_all")}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-[1fr_4rem_2rem_4rem_4rem] gap-2 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border mb-1 sticky top-0 bg-background/95">
                      <span>{t("comp.mo_ta")}</span>
                      <span className="text-right">{t("shift.ton_dau")}</span>
                      <span className="text-center">Δ</span>
                      <span className="text-right">{t("shift.ton_cuoi")}</span>
                      <span>{t("warehouse.bin")}</span>
                    </div>

                    <div className="space-y-0.5">
                      {tonKhoFiltered.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-8">{t("shift.no_changes")}</p>
                      ) : (
                        pgTon.slice.map((row, i) => (
                          <div
                            key={`${row.maLinhKien}-${row.maViTri}`}
                            className={`grid grid-cols-[1fr_4rem_2rem_4rem_4rem] gap-2 items-center px-2 py-1.5 rounded text-xs ${((pgTon.page - 1) * pgTon.pageSize + i) % 2 === 0 ? "" : "bg-muted/20"}`}
                          >
                            <div className="min-w-0">
                              <p className="font-mono text-[10px] text-primary truncate">{row.maLinhKien}</p>
                              <p className="text-muted-foreground truncate text-[10px]">{row.moTa}</p>
                            </div>
                            <span className="text-right tabular-nums">{Math.round(row.tonDau).toLocaleString()}</span>
                            <span className={`text-center text-[10px] font-bold ${row.delta > 0 ? "text-blue-600" : row.delta < 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                              {row.delta > 0 ? <TrendingUp className="w-3 h-3 inline" /> : row.delta < 0 ? <TrendingDown className="w-3 h-3 inline" /> : <Minus className="w-3 h-3 inline" />}
                            </span>
                            <span className="text-right tabular-nums font-semibold">{Math.round(row.tonCuoi).toLocaleString()}</span>
                            <span className="text-[10px] text-muted-foreground truncate">{row.viTri}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  {tonKhoFiltered.length > 0 ? (
                    <PhanTrang
                      trangHienTai={pgTon.page}
                      tongSoTrang={pgTon.totalPages}
                      tongSoMuc={tonKhoFiltered.length}
                      onChuyenTrang={pgTon.setPage}
                      nhanTomTat={t("comp.pagination_rows")}
                    />
                  ) : null}
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-5 py-3">
                    {data.giaoDich.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-8">{t("shift.no_transactions")}</p>
                    ) : (
                      pgGd.slice.map((gd) => (
                        <div key={gd.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/60 hover:bg-muted/20 text-xs">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${gd.type === "IN" ? "bg-blue-500" : "bg-amber-500"}`} />
                          <span className="font-mono text-[10px] text-primary shrink-0 w-20 truncate">{gd.partNumber}</span>
                          <span className="flex-1 truncate text-muted-foreground">{gd.partName}</span>
                          <span className={`font-bold tabular-nums shrink-0 ${gd.type === "IN" ? "text-blue-600" : "text-amber-600"}`}>
                            {gd.type === "IN" ? "+" : "-"}{Math.round(gd.quantity).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{gd.bin}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:block">{gd.timestamp}</span>
                        </div>
                      ))
                    )}
                  </div>
                  {data.giaoDich.length > 0 ? (
                    <PhanTrang
                      trangHienTai={pgGd.page}
                      tongSoTrang={pgGd.totalPages}
                      tongSoMuc={data.giaoDich.length}
                      onChuyenTrang={pgGd.setPage}
                      nhanTomTat={t("comp.pagination_rows")}
                    />
                  ) : null}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TrangCaLamViec() {
  const { t } = useI18n();
  const { id: paramId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const daBaoBatBuocCa = useRef(false);
  const { user } = useAuth();
  const { caHienTai, batDauCa, batDauCaForce, ketThucCa, adminDongCa, reload } = useCa();

  const isAdmin = (user?.user_metadata as { quyen?: string } | undefined)?.quyen === "admin";

  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reportId, setReportId] = useState<number | null>(paramId ? parseInt(paramId) : null);
  const [trangDanhSachCa, setTrangDanhSachCa] = useState(1);
  const [phienTaiDanhSachCa, setPhienTaiDanhSachCa] = useState(0);
  const [locKieuCa, setLocKieuCa] = useState<"all" | "day" | "night">("all");
  /** Lọc theo nhân viên (admin: chọn user; nhân viên: Tất cả / Chỉ ca của tôi) */
  const [locNhanVien, setLocNhanVien] = useState<number | "all">("all");
  const [dsNhanVien, setDsNhanVien] = useState<{ id: number; label: string }[]>([]);
  const maNguoiDungToi = user ? parseInt(String(user.id), 10) : 0;

  /** Ít ca hơn mỗi trang để dễ lướt và phân trang rõ hơn */
  const soCaMotTrang = 10;

  // Dialog state
  const [sameUserDialog, setSameUserDialog] = useState<{ maCa: number } | null>(null);
  const [conflictDialog, setConflictDialog] = useState<{
    maCa: number; tenNguoiDung: string; thoiGianBatDau: string;
  } | null>(null);

  const pendingGhiChuRef = useRef<string | undefined>(undefined);

  const tongSoTrangCa = Math.max(1, Math.ceil(total / soCaMotTrang));

  useEffect(() => {
    const st = routerLocation.state as { requireShift?: boolean } | null | undefined;
    if (st?.requireShift && !daBaoBatBuocCa.current) {
      daBaoBatBuocCa.current = true;
      toast.info(t("shift.mandatory_must_start"));
      navigate({ pathname: routerLocation.pathname, search: routerLocation.search, hash: routerLocation.hash }, { replace: true, state: {} });
    }
  }, [routerLocation.state, routerLocation.pathname, routerLocation.search, routerLocation.hash, navigate, t]);

  useEffect(() => {
    if (!isAdmin) {
      setDsNhanVien([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/users`);
        if (!res.ok || cancelled) return;
        const rows = (await res.json()) as { id: number; taiKhoan: string; hoTen: string | null }[];
        setDsNhanVien(
          rows
            .map((r) => ({
              id: r.id,
              label: (r.hoTen && String(r.hoTen).trim()) ? String(r.hoTen) : r.taiKhoan,
            }))
            .sort((a, b) => a.label.localeCompare(b.label, "vi")),
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const offset = (trangDanhSachCa - 1) * soCaMotTrang;
        const qs = new URLSearchParams({
          limit: String(soCaMotTrang),
          offset: String(offset),
        });
        if (locKieuCa === "day") qs.set("kieuCa", "day");
        else if (locKieuCa === "night") qs.set("kieuCa", "night");
        if (locNhanVien !== "all") qs.set("maNguoiDung", String(locNhanVien));
        const res = await fetch(`${API_BASE}/api/shifts?${qs}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const raw = data.items ?? [];
        const items: ShiftItem[] = raw.map((r: CaLamViec & { loaiCa?: string; soPhieu?: number; tongNhap?: number; tongXuat?: number }) => {
          const v = String(r.loaiCa ?? "").toLowerCase();
          const lc: ShiftItem["loaiCa"] =
            v === "day"
              ? "day"
              : v === "day_ot"
                ? "day_ot"
                : v === "night"
                  ? "night"
                  : v === "night_ot"
                    ? "night_ot"
                    : "gap";
          return {
            ...r,
            loaiCa: lc,
            soPhieu: Number(r.soPhieu) || 0,
            tongNhap: Number(r.tongNhap) || 0,
            tongXuat: Number(r.tongXuat) || 0,
          };
        });
        const tot = Number(data.total) || 0;
        const maxTrang = Math.max(1, Math.ceil(tot / soCaMotTrang));
        if (!cancelled) {
          setShifts(items);
          setTotal(tot);
          setTrangDanhSachCa((p) => (p > maxTrang ? maxTrang : p));
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trangDanhSachCa, phienTaiDanhSachCa, soCaMotTrang, locKieuCa, locNhanVien]);

  const taiLaiDanhSachCa = useCallback((veTrangDau?: boolean) => {
    if (veTrangDau) setTrangDanhSachCa(1);
    setPhienTaiDanhSachCa((v) => v + 1);
  }, []);

  // ─── Bắt đầu ca: xử lý 3 kết quả ─────────────────────────────────────────

  const handleStart = async (ghiChu?: string) => {
    setBusy(true);
    try {
      const result: KetQuaBatDauCa = await batDauCa(ghiChu);
      if (result.loai === "created") {
        taiLaiDanhSachCa(true);
      } else if (result.loai === "sameUser") {
        setSameUserDialog({ maCa: result.maCa });
      } else if (result.loai === "conflict") {
        pendingGhiChuRef.current = ghiChu;
        setConflictDialog({
          maCa: result.maCa,
          tenNguoiDung: result.tenNguoiDung,
          thoiGianBatDau: result.thoiGianBatDau,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  // ─── SameUser dialog handlers ──────────────────────────────────────────────

  const handleSameUserContinue = () => {
    setSameUserDialog(null);
    // Không làm gì, ca cũ vẫn đang chạy — chỉ đóng dialog
    reload();
  };

  const handleSameUserRestart = async () => {
    if (!sameUserDialog) return;
    setBusy(true);
    try {
      // Kết thúc ca hiện tại của mình, rồi tạo ca mới
      await fetch(`${API_BASE}/api/shifts/${sameUserDialog.maCa}/end`, { method: "POST" });
      setSameUserDialog(null);
      // Tạo ca mới
      const res = await fetch(`${API_BASE}/api/shifts/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taiKhoan: user?.email }),
      });
      if (res.ok) {
        reload();
        taiLaiDanhSachCa(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  // ─── Conflict dialog handlers ──────────────────────────────────────────────

  const handleForceClose = async () => {
    if (!conflictDialog || !isAdmin) return;
    setBusy(true);
    try {
      await adminDongCa(conflictDialog.maCa, "Admin force-close để bắt đầu ca mới");
      setConflictDialog(null);
      await batDauCaForce(pendingGhiChuRef.current);
      taiLaiDanhSachCa(true);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  // ─── Kết thúc ca ──────────────────────────────────────────────────────────

  const handleEnd = async () => {
    setBusy(true);
    try {
      const result = await ketThucCa();
      taiLaiDanhSachCa(true);
      if (result) setReportId(result.maCa);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  // ─── Admin force-close từ danh sách ca ────────────────────────────────────

  const handleAdminForceClose = async (maCa: number) => {
    if (!isAdmin) return;
    if (!window.confirm(t("shift.confirm_force_close"))) return;
    setBusy(true);
    try {
      await adminDongCa(maCa, "Admin đóng ca từ danh sách");
      taiLaiDanhSachCa();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-3xl xl:max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="shrink-0 px-4 md:px-6 pt-4 md:pt-6 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
              <CalendarClock className="w-6 h-6 text-primary" />
              {t("shift.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("shift.subtitle")}</p>
          </div>
          <Button
            size="sm"
            translate="no"
            variant={caHienTai ? "destructive" : "default"}
            className="gap-1.5 shrink-0"
            onClick={caHienTai ? handleEnd : () => handleStart()}
            disabled={busy}
          >
            <SpinIcon busy={busy} Icon={caHienTai ? Square : Play} />
            <span translate="no">{caHienTai ? t("shift.end_shift") : t("shift.start_shift")}</span>
          </Button>
        </div>

        {/* Current shift banner — CSS transition thay vì motion.div */}
        {caHienTai && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-400/40 bg-emerald-50 dark:bg-emerald-950/30">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{t("shift.current_shift_label")}</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                {caHienTai.tenNguoiDung} · {t("shift.started_at")} {formatTime(caHienTai.thoiGianBatDau)}
                {" "}({formatDuration(caHienTai.thoiGianBatDau)})
              </p>
            </div>
            <button
              type="button"
              className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline shrink-0"
              onClick={() => setReportId(caHienTai.maCa)}
            >
              {t("shift.view_report")}
            </button>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{t("shift.history_label")} ({total})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "day", "night"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setLocKieuCa(k);
                  setTrangDanhSachCa(1);
                }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  locKieuCa === k
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {k === "all" ? t("khsx.shift_all") : k === "day" ? t("khsx.shift_cn") : t("khsx.shift_cd")}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground shrink-0">{t("shift.filter_staff")}</span>
            <select
              className="text-xs rounded-md border border-border bg-background px-2 py-1.5 min-w-[11rem] max-w-[min(100%,18rem)]"
              value={locNhanVien === "all" ? "" : String(locNhanVien)}
              onChange={(e) => {
                const v = e.target.value;
                setLocNhanVien(v === "" ? "all" : parseInt(v, 10));
                setTrangDanhSachCa(1);
              }}
              aria-label={t("shift.filter_staff")}
            >
              <option value="">
                {isAdmin ? t("shift.filter_all_staff") : t("khsx.shift_all")}
              </option>
              {isAdmin
                ? dsNhanVien.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))
                : maNguoiDungToi > 0
                  ? (
                      <option value={String(maNguoiDungToi)}>{t("shift.filter_my_shifts_only")}</option>
                    )
                  : null}
            </select>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">{t("shift.shift_classify_hint")}</p>
        </div>
        <div className="h-px bg-border" />
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
          </div>
        ) : shifts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <CalendarClock className="w-10 h-10 opacity-30" />
            <p className="text-sm">{t("shift.no_shifts")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {shifts.map((item) => (
              <ShiftCard
                key={item.maCa}
                item={item}
                isAdmin={isAdmin}
                onViewReport={setReportId}
                onForceClose={isAdmin ? handleAdminForceClose : undefined}
              />
            ))}
            <PhanTrang
              trangHienTai={trangDanhSachCa}
              tongSoTrang={tongSoTrangCa}
              tongSoMuc={total}
              onChuyenTrang={setTrangDanhSachCa}
              nhanTomTat={t("shift.pagination_rows")}
              className="rounded-lg border border-border bg-card"
            />
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AnimatePresence>
        {sameUserDialog && (
          <DialogSameUser
            maCa={sameUserDialog.maCa}
            onContinue={handleSameUserContinue}
            onRestart={handleSameUserRestart}
            onClose={() => setSameUserDialog(null)}
            busy={busy}
          />
        )}
        {conflictDialog && (
          <DialogConflict
            info={conflictDialog}
            isAdmin={isAdmin}
            onForceClose={handleForceClose}
            onClose={() => setConflictDialog(null)}
            busy={busy}
          />
        )}
      </AnimatePresence>

      {/* Report drawer */}
      <BaoCaoDrawer maCa={reportId} onClose={() => { setReportId(null); navigate("/shifts"); }} />
    </div>
  );
}
