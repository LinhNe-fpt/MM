import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { PageDashboardSkeleton } from "@/components/ui/page-list-skeleton";
import { type LinhKien } from "@/data/duLieuMau";
import { type GiaoDich } from "@/data/duLieuMau";
import { type Day } from "@/data/duLieuMau";
import { API_BASE } from "@/api/client";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Package,
  TrendingDown,
  Boxes,
  CalendarClock,
  Clock,
  Play,
} from "lucide-react";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { useNavigate, Link } from "react-router-dom";
import { useCa } from "@/contexts/NguCanhCa";
import {
  LineChart,
  Line,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatDuration(start: string): string {
  const ms = new Date().getTime() - new Date(start).getTime();
  if (ms < 0) return "—";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}g ${m}p` : `${m} phút`;
}

export default function TrangTongQuan() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { caHienTai } = useCa();
  const [tatCaLinhKien, setTatCaLinhKien] = useState<LinhKien[]>([]);
  const [danhSachDayKho, setDanhSachDayKho] = useState<Day[]>([]);
  const [giaoDichGanDay, setGiaoDichGanDay] = useState<GiaoDich[]>([]);
  const [tai, setTai] = useState(true);
  const [loi, setLoi] = useState<string | null>(null);
  const [thoiGianTai, setThoiGianTai] = useState("");
  const [vuaLamMoi, setVuaLamMoi] = useState(false);
  const lamMoiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dùng ref để track request đang chạy, tránh overlap
  const loadingRef = useRef(false);

  const loadData = useCallback((silent = false) => {
    if (loadingRef.current && silent) return; // bỏ qua nếu đang load
    const controller = new AbortController();
    loadingRef.current = true;
    if (!silent) setTai(true);
    setLoi(null);
    Promise.all([
      fetch(`${API_BASE}/api/components`, { signal: controller.signal }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}/api/warehouse/rows`, { signal: controller.signal }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}/api/transactions?limit=100`, { signal: controller.signal }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([compList, rows, txList]) => {
        setTatCaLinhKien(Array.isArray(compList) ? compList : []);
        setDanhSachDayKho(Array.isArray(rows) ? rows : []);
        setGiaoDichGanDay(Array.isArray(txList) ? txList : []);
        const now = new Date();
        setThoiGianTai(`${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`);
        if (silent) {
          if (lamMoiTimerRef.current) clearTimeout(lamMoiTimerRef.current);
          setVuaLamMoi(true);
          lamMoiTimerRef.current = setTimeout(() => {
            setVuaLamMoi(false);
            lamMoiTimerRef.current = null;
          }, 2200);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setLoi(e?.message || t("error.load_data"));
      })
      .finally(() => {
        loadingRef.current = false;
        if (!controller.signal.aborted) setTai(false);
      });
    return () => { controller.abort(); };
  }, [t]);

  useEffect(() => {
    const cleanup = loadData();

    // Tự refresh mỗi 60 giây
    const interval = setInterval(() => loadData(true), 60_000);

    // Refresh ngay khi user quay lại trang (chuyển từ tab khác hoặc navigate)
    const onVisible = () => {
      if (document.visibilityState === "visible") loadData(true);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cleanup?.();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      if (lamMoiTimerRef.current) clearTimeout(lamMoiTimerRef.current);
    };
  }, [loadData]);

  const { tongLinhKien, tongSoLuong, sapHetList, hetHangList, sapHet, hetHang } = useMemo(() => {
    let tongSoLuong = 0;
    const sapHetList: LinhKien[] = [];
    const hetHangList: LinhKien[] = [];
    for (const c of tatCaLinhKien) {
      tongSoLuong += c.quantity ?? 0;
      if (c.quantity === 0) hetHangList.push(c);
      else if (c.quantity > 0 && c.quantity < (c.minStock ?? 0)) sapHetList.push(c);
    }
    return { tongLinhKien: tatCaLinhKien.length, tongSoLuong, sapHetList, hetHangList, sapHet: sapHetList.length, hetHang: hetHangList.length };
  }, [tatCaLinhKien]);
  const tongThung = useMemo(() => danhSachDayKho.reduce((s, r) => s + (r.bins?.length ?? 0), 0), [danhSachDayKho]);

  const canhBaoUuTien = useMemo(() => {
    return tatCaLinhKien
      .filter((c) => c.quantity === 0 || (c.quantity != null && c.quantity < (c.minStock ?? 0)))
      .map((c) => {
        const min = c.minStock ?? 0;
        const qty = c.quantity ?? 0;
        const ratio = min > 0 ? qty / min : 1;
        const urgency = qty === 0 ? 999999 : 1 - ratio;
        return { ...c, urgency, ratio };
      })
      .sort((a, b) => b.urgency - a.urgency)
      .slice(0, 8);
  }, [tatCaLinhKien]);

  const chartData = useMemo(() => {
    // Dùng local date (không phải UTC) để tránh lệch ngày do timezone UTC+7
    const toLocalKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const days: { key: string; label: string; inQty: number; outQty: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = toLocalKey(d);
      days.push({ key, label: `${d.getDate()}/${d.getMonth() + 1}`, inQty: 0, outQty: 0 });
    }

    const dayMap = new Map(days.map((d) => [d.key, d]));
    giaoDichGanDay.forEach((gd) => {
      if (!gd.timestamp) return;
      // Parse timestamp DB (lưu theo giờ local, không có timezone suffix)
      const raw = gd.timestamp.includes("T") ? gd.timestamp : gd.timestamp.replace(" ", "T");
      const d = new Date(raw.endsWith("Z") || raw.match(/[+-]\d{2}:\d{2}$/) ? raw : raw + "+07:00");
      if (Number.isNaN(d.getTime())) return;
      const key = toLocalKey(d);
      const item = dayMap.get(key);
      if (!item) return;
      const qty = Number(gd.quantity) || 0;
      if (gd.type === "IN") item.inQty += qty;
      else item.outQty += qty;
    });

    return days;
  }, [giaoDichGanDay]);

  const lamSachBin = (bin: string) => {
    const b = (bin || "").trim();
    if (!b) return "—";
    return b.replace(/--+/g, "-");
  };

  const cacChiSo = [
    {
      nhan: t("dashboard.total_components"),
      giaTri: tongLinhKien,
      icon: Boxes,
      className: "border-border/70",
      soClassName: "text-foreground",
      action: () => navigate("/components"),
    },
    {
      nhan: t("dashboard.total_stock"),
      giaTri: tongSoLuong.toLocaleString(),
      icon: Package,
      className: "border-border/70",
      soClassName: "text-foreground",
      action: () => navigate("/components"),
    },
    {
      nhan: t("dashboard.low_stock"),
      giaTri: sapHet,
      icon: AlertTriangle,
      className: sapHet > 0 ? "border-amber-300/80 bg-amber-50/60" : "border-border/70",
      soClassName: sapHet > 0 ? "text-amber-600" : "text-foreground",
      action: () => navigate("/components?status=low"),
    },
    {
      nhan: t("dashboard.out_of_stock"),
      giaTri: hetHang,
      icon: TrendingDown,
      className: hetHang > 0 ? "border-red-300/70 bg-red-50/60" : "border-border/70",
      soClassName: hetHang > 0 ? "text-red-600" : "text-foreground",
      action: () => navigate("/components?status=out"),
    },
  ];

  if (tai) {
    return <PageDashboardSkeleton />;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1500px] mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">{t("dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5">
          <span>
            {danhSachDayKho.length} {t("dashboard.subtitle_rows")} · {tongThung}{" "}
            {t("dashboard.subtitle_bins")} · {t("dashboard.subtitle_updated")}{" "}
            <time dateTime={thoiGianTai}>{thoiGianTai}</time>
          </span>
          {vuaLamMoi && (
            <span className="text-xs font-medium text-primary animate-pulse">· Đã làm mới dữ liệu</span>
          )}
        </p>
      </div>
      {loi && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{loi}</p>
      )}
      {/* ─── Shift widget ─────────────────────────────────────────────────── */}
      {caHienTai ? (
        <Link
          to="/shifts"
          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-400/40 bg-emerald-50/70 hover:bg-emerald-100/60 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 transition-colors group"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <CalendarClock className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 leading-tight">
              {t("shift.current_shift_label")}
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {caHienTai.tenNguoiDung} · {formatDuration(caHienTai.thoiGianBatDau)}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-emerald-600/50 group-hover:text-emerald-600 transition-colors" />
        </Link>
      ) : (
        <Link
          to="/shifts"
          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-muted-foreground/30 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
        >
          <Play className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors flex-1">
            {t("shift.start_shift")} →
          </span>
        </Link>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cacChiSo.map((chiSo) => {
          const Icon = chiSo.icon;
          return (
            <button
              type="button"
              key={chiSo.nhan}
              onClick={chiSo.action}
              className={`relative overflow-hidden border rounded-xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${chiSo.className}`}
            >
              <Icon className="absolute -right-2 -bottom-2 w-14 h-14 text-muted-foreground/15" />
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <span className="label-industrial">{chiSo.nhan}</span>
              </div>
              <p className={`qty-display ${chiSo.soClassName}`}>
                {chiSo.giaTri}
              </p>
              <span className="absolute right-2 top-2 text-muted-foreground/60">
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-10 gap-5">
        <div className="xl:col-span-7 space-y-5">
          <div>
            <h2 className="label-industrial mb-3">{t("dashboard.activity_chart")}</h2>
            <div className="border border-border rounded-xl p-3 bg-card relative">
              {chartData.every((d) => d.inQty === 0 && d.outQty === 0) && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-card/85 text-center text-xs text-muted-foreground px-4 pointer-events-none">
                  Chưa có nhập/xuất trong 7 ngày gần đây (theo phiếu đã ghi).
                </div>
              )}
              <div className="h-[210px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => Math.round(v).toLocaleString()} allowDecimals={false} />
                    <Tooltip formatter={(v: number) => Math.round(v).toLocaleString()} />
                    <Line
                      type="monotone"
                      dataKey="inQty"
                      name={t("tx.in")}
                      stroke="#16a34a"
                      strokeWidth={2.5}
                      dot={{ r: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="outQty"
                      name={t("tx.out")}
                      stroke="#dc2626"
                      strokeWidth={2.5}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div>
            <h2 className="label-industrial mb-3">{t("dashboard.recent_tx")}</h2>
            <div className="border border-border rounded-xl overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="label-industrial text-left px-4 py-2.5">{t("table.type")}</th>
                      <th className="label-industrial text-left px-4 py-2.5">{t("table.code")}</th>
                      <th className="label-industrial text-left px-4 py-2.5 hidden md:table-cell">
                        {t("table.name")}
                      </th>
                      <th className="label-industrial text-right px-4 py-2.5">{t("table.quantity")}</th>
                      <th className="label-industrial text-left px-4 py-2.5">{t("table.bin")}</th>
                      <th className="label-industrial text-left px-4 py-2.5 hidden md:table-cell">
                        {t("table.time")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {giaoDichGanDay.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                          <p className="mb-2">Chưa có giao dịch gần đây.</p>
                          <Link to="/transactions" className="text-primary font-medium underline underline-offset-2">
                            Tạo phiếu nhập / xuất
                          </Link>
                        </td>
                      </tr>
                    )}
                    {giaoDichGanDay.slice(0, 10).map((gd) => (
                      <tr
                        key={gd.id}
                        className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-bold ${
                              gd.type === "IN"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {gd.type === "IN" ? (
                              <ArrowDownRight className="w-3 h-3" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3" />
                            )}
                            {gd.type === "IN" ? `${t("tx.in")} ${gd.category}` : `${t("tx.out")} ${gd.category}`}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{gd.partNumber}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                          {gd.partName}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono font-bold tabular-nums ${
                              gd.type === "IN"
                                ? "bg-green-50 text-green-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {gd.type === "IN" ? "+" : "-"}
                            {Math.round(Number(gd.quantity)).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{lamSachBin(gd.bin)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                          {gd.timestamp}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-3">
          <h2 className="label-industrial mb-3">{t("dashboard.alerts")}</h2>
          <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
            {canhBaoUuTien.length === 0 && (
              <div className="border border-border rounded-xl p-4 text-sm text-muted-foreground">
                {t("dashboard.no_alerts")}
              </div>
            )}
            {canhBaoUuTien.map((lk) => {
              const qty = lk.quantity ?? 0;
              const min = lk.minStock ?? 0;
              const ratio = min > 0 ? Math.min(100, (qty / min) * 100) : 100;
              const critical = qty === 0;
              return (
                <button
                  type="button"
                  key={lk.id}
                  title="Mở linh kiện trong danh sách"
                  onClick={() => navigate(`/components?q=${encodeURIComponent(lk.partNumber)}`)}
                  className={`relative w-full text-left border rounded-xl p-3 transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${critical ? "border-red-300/60 bg-red-50/30" : "border-amber-300/60 bg-amber-50/30"}`}
                >
                    <div className="flex items-start gap-3">
                    <div className="w-10 h-10 shrink-0 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <Package className="w-5 h-5 text-primary/70" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-mono text-xs text-muted-foreground">{lk.partNumber}</p>
                        {lk.viTriText && (
                          <span className="text-[9px] font-mono font-bold px-1 py-px bg-orange-50 border border-orange-200 rounded text-orange-600">
                            📍 {lk.viTriText}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium truncate">{lk.name || lk.manufacturer || lk.model}</p>
                      <div className="mt-2">
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${critical ? "bg-red-500" : "bg-amber-500"}`}
                            style={{ width: `${Math.max(4, ratio)}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <p className="text-[10px] text-muted-foreground">
                            Ca đêm: <span className="font-semibold">{Math.round(qty).toLocaleString()}</span>
                            {min > 0 && <> / Min {Math.round(min).toLocaleString()}</>}
                          </p>
                          {lk.tonCuoiCaNgay != null && (
                            <p className="text-[10px] text-violet-600">
                              Ca ngày: <span className="font-semibold">{Math.round(lk.tonCuoiCaNgay).toLocaleString()}</span>
                            </p>
                          )}
                          {lk.tonThucTe != null && lk.tonThucTe !== qty && (
                            <p className="text-[10px] text-red-600">
                              Thực tế: <span className="font-semibold">{Math.round(lk.tonThucTe).toLocaleString()}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono font-bold tabular-nums text-lg ${critical ? "text-red-600" : "text-amber-600"}`}>
                        {Math.round(qty).toLocaleString()}
                      </p>
                      <p className="text-[9px] text-muted-foreground">ca đêm</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
