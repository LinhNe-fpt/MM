import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Play, Square, Loader2, type LucideIcon } from "lucide-react";
import { useCa } from "@/contexts/NguCanhCa";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { useNavigate } from "react-router-dom";

/** Luôn render icon + spinner bằng CSS opacity — không bao giờ add/remove DOM node. */
function SpinIcon({ busy, Icon, cls = "w-3.5 h-3.5" }: { busy: boolean; Icon: LucideIcon; cls?: string }) {
  return (
    <span
      className="relative flex items-center justify-center shrink-0"
      style={{ width: "0.875rem", height: "0.875rem" }}
      aria-hidden
    >
      <Loader2 className={`absolute ${cls} animate-spin transition-opacity ${busy ? "opacity-100" : "opacity-0"}`} />
      <Icon className={`${cls} transition-opacity ${busy ? "opacity-0" : "opacity-100"}`} />
    </span>
  );
}

/** Tính thời gian đã trôi qua */
function dungThoiGian(start: string): string {
  const ms = Date.now() - new Date(start).getTime();
  if (ms < 0) return "0:00";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Widget dạng compact — dùng trong sidebar desktop */
export function ThanhCaTrucDesktop({ thuGon }: { thuGon: boolean }) {
  const { caHienTai, dangTai, batDauCa, ketThucCa } = useCa();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [thoiGian, setThoiGian] = useState("0:00");

  useEffect(() => {
    if (!caHienTai) { setThoiGian("0:00"); return; }
    const update = () => setThoiGian(dungThoiGian(caHienTai.thoiGianBatDau));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [caHienTai]);

  const handleStart = async () => {
    if (busy) return;
    setBusy(true);
    try { await batDauCa(); } catch { /* ignore */ } finally { setBusy(false); }
  };

  const handleEnd = async () => {
    if (!caHienTai || busy) return;
    setBusy(true);
    try {
      const result = await ketThucCa();
      if (result) navigate(`/shifts/${result.maCa}/report`);
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  if (dangTai) return null;

  const isActive = Boolean(caHienTai);

  if (thuGon) {
    return (
      <div className="flex justify-center py-1">
        <button
          type="button"
          translate="no"
          onClick={isActive ? handleEnd : handleStart}
          disabled={busy}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            isActive
              ? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
          title={isActive ? t("shift.end_shift") : t("shift.start_shift")}
          aria-label={isActive ? t("shift.end_shift") : t("shift.start_shift")}
        >
          <SpinIcon busy={busy} Icon={isActive ? Square : Play} />
        </button>
      </div>
    );
  }

  return (
    <div className="mx-2 mb-2 rounded-lg border border-border overflow-hidden">
      <AnimatePresence mode="wait">
        {isActive ? (
          <motion.div
            key="active"
            className="bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2.5"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" aria-hidden />
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 truncate">
                {t("shift.active_label")}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground truncate mb-1.5">
              {caHienTai?.tenNguoiDung ?? caHienTai?.maNguoiDung}
            </p>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-foreground" aria-live="polite">
                <Clock className="w-3 h-3 text-muted-foreground" aria-hidden />
                <span aria-hidden>{thoiGian}</span>
              </div>
              <button
                type="button"
                translate="no"
                onClick={handleEnd}
                disabled={busy}
                className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
                aria-label={t("shift.end_shift")}
              >
                <SpinIcon busy={busy} Icon={Square} cls="w-3 h-3" />
                <span translate="no">{t("shift.end_shift")}</span>
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="idle"
            type="button"
            translate="no"
            onClick={handleStart}
            disabled={busy}
            className="w-full flex items-center gap-2 px-3 py-2.5 bg-muted/40 hover:bg-muted transition-colors"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            aria-label={t("shift.start_shift")}
          >
            <SpinIcon busy={busy} Icon={Play} />
            <span className="text-xs text-muted-foreground font-medium" translate="no">
              {t("shift.start_shift")}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Widget compact — dùng ở mobile header */
export function ThanhCaTrucMobile() {
  const { caHienTai, batDauCa, ketThucCa } = useCa();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [thoiGian, setThoiGian] = useState("0:00");

  useEffect(() => {
    if (!caHienTai) { setThoiGian("0:00"); return; }
    const update = () => setThoiGian(dungThoiGian(caHienTai.thoiGianBatDau));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [caHienTai]);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (caHienTai) {
        const result = await ketThucCa();
        if (result) navigate(`/shifts/${result.maCa}/report`);
      } else {
        await batDauCa();
      }
    } catch { /* ignore */ } finally {
      setBusy(false);
    }
  };

  const isActive = Boolean(caHienTai);

  return (
    <button
      type="button"
      translate="no"
      onClick={handleClick}
      disabled={busy}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors shrink-0 ${
        isActive
          ? "bg-emerald-500/10 border-emerald-400/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
          : "border-border text-muted-foreground hover:text-foreground hover:border-primary"
      }`}
      aria-label={isActive ? t("shift.end_shift") : t("shift.start_shift")}
    >
      {isActive ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
          <span className="font-mono text-[11px] font-bold" aria-hidden>{thoiGian}</span>
          <SpinIcon busy={busy} Icon={Square} cls="w-3 h-3" />
        </>
      ) : (
        <SpinIcon busy={busy} Icon={Play} cls="w-3 h-3" />
      )}
    </button>
  );
}
