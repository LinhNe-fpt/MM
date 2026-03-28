import { Thung } from "@/data/duLieuMau";
import { motion } from "framer-motion";
import { GripVertical, AlertTriangle } from "lucide-react";

interface PropsTheThung {
  thung: Thung;
  khiBam?: (thung: Thung) => void;
  /** Tô sâu khi mở sơ đồ từ danh sách linh kiện (query ?vt=) */
  noiBat?: boolean;
}

const lopThanhTrangThai: Record<string, string> = {
  ok: "status-bar-ok",
  low: "status-bar-low",
  critical: "status-bar-critical",
  dead: "status-bar-dead",
};

/** Hiển thị số gọn trong ô nhỏ (11850 → 11.9k; từ 100k trở lên làm tròn nghìn) */
function fmtTonGon(n: number): string {
  const x = Math.abs(n);
  if (x >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`.replace(/\.0M$/, "M");
  if (x >= 100_000) return `${Math.round(n / 1000)}k`;
  if (x >= 1000) return `${(n / 1000).toFixed(1)}k`.replace(/\.0k$/, "k");
  return String(Math.round(n));
}

export function TheThung({ thung, khiBam, noiBat }: PropsTheThung) {
  const linhKienChinh = thung.components[0];
  const coLinhKien = thung.components.length > 0;
  
  // 🔴 Nếu ô trống, không render (chỉ render ô có hàng)
  if (!coLinhKien) {
    return null;
  }

  const tonNgay = (linhKienChinh as { tonCuoiCaNgay?: number | null }).tonCuoiCaNgay;
  const coNhieuMa = thung.components.length > 1;
  const coCanhBaoLech = thung.components.some((c) => (c as { lech?: number | null }).lech != null);

  // Thùng được tô từ URL: viền tĩnh + lớp phủ chỉ animate opacity (mượt hơn animate-pulse của Tailwind)
  const classThung =
    "bin-card rounded-xl text-left w-full h-[88px] inner-shadow cursor-pointer relative group border-solid border-2 overflow-visible z-[1] !p-0 !gap-0" +
    (noiBat
      ? " border-amber-500/80 shadow-[0_0_0_1px_rgba(245,158,11,0.35),0_8px_28px_-4px_rgba(245,158,11,0.22)] transition-[border-color,box-shadow] duration-300 ease-out"
      : " transition-all hover:shadow-lg hover:border-primary/50");

  return (
    <motion.button
      type="button"
      onClick={() => khiBam?.(thung)}
      className={classThung}
      aria-label={`${thung.label ?? "Ô"}: ${linhKienChinh.partNumber}${linhKienChinh.name ? ` — ${linhKienChinh.name}` : ""}`}
      aria-current={noiBat ? "true" : undefined}
      whileTap={{ scale: 0.97 }}
      whileHover={
        noiBat
          ? { y: 0, boxShadow: "0 0 0 1px rgba(245,158,11,0.45), 0 12px 32px -6px rgba(245,158,11,0.28)" }
          : { y: -1, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }
      }
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      {noiBat ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[5] rounded-xl"
          style={{
            boxShadow: "inset 0 0 0 2px rgba(251, 191, 36, 0.55)",
          }}
          initial={{ opacity: 0.88 }}
          animate={{ opacity: [0.72, 1, 0.72] }}
          transition={{
            duration: 2.6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ) : null}
      {/* Grip — góc dưới trái, không đè header */}
      <div className="absolute bottom-1 left-1.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20 pointer-events-none">
        <GripVertical size={12} />
      </div>

      {coLinhKien && <div className={`status-bar ${lopThanhTrangThai[thung.status]}`} />}
      {thung.fillPercent > 0 && (
        <div className="bin-fill" style={{ height: `${thung.fillPercent}%` }} />
      )}

      <div className="relative z-10 flex flex-col h-full min-h-0 pl-2.5 pr-2 py-1.5 ml-1">
        {/* Chỉ mã vị trí (+ cảnh báo); mã linh kiện xem trong ngăn chi tiết */}
        <div className="flex items-center justify-between gap-1 min-w-0 shrink-0">
          <span
            className="font-mono text-[11px] font-bold text-foreground tracking-tight truncate bg-primary/10 text-primary px-2 py-1 rounded-md border border-primary/15"
            title={thung.label || undefined}
          >
            {thung.label}
          </span>
          <div className="flex items-center gap-0.5 shrink-0">
            {coCanhBaoLech && <AlertTriangle className="w-3 h-3 text-destructive" aria-hidden />}
            {coNhieuMa && (
              <span className="text-[9px] font-semibold tabular-nums text-muted-foreground bg-muted px-1 rounded" title="Nhiều mã trong cùng ô">
                +{thung.components.length - 1}
              </span>
            )}
          </div>
        </div>

        <div className="mt-auto pt-1 border-t border-border/50 flex items-center justify-between gap-1 text-[9px] tabular-nums leading-none">
          {tonNgay != null ? (
            <>
              <span className="min-w-0">
                <span className="text-muted-foreground font-medium text-[8px] uppercase tracking-wide">Ca ngày</span>
                <span className="block font-semibold text-violet-700 dark:text-violet-300 truncate">
                  {fmtTonGon(Number(tonNgay))}
                </span>
              </span>
              <span className="w-px h-5 bg-border/60 shrink-0" aria-hidden />
              <span className="min-w-0 text-right">
                <span className="text-muted-foreground font-medium text-[8px] uppercase tracking-wide">Ca đêm</span>
                <span
                  className={`block font-semibold truncate ${
                    linhKienChinh.quantity <= 0
                      ? "text-muted-foreground"
                      : linhKienChinh.quantity < 10
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-emerald-700 dark:text-emerald-400"
                  }`}
                >
                  {fmtTonGon(linhKienChinh.quantity)}
                </span>
              </span>
            </>
          ) : (
            <span className="w-full flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground font-medium text-[8px] uppercase tracking-wide">Tồn</span>
              <span
                className={`font-semibold ${
                  linhKienChinh.quantity <= 0
                    ? "text-muted-foreground"
                    : linhKienChinh.quantity < 10
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-emerald-700 dark:text-emerald-400"
                }`}
              >
                {fmtTonGon(linhKienChinh.quantity)}
              </span>
            </span>
          )}
        </div>
      </div>
      </motion.button>
  );
}
