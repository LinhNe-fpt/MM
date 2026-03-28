import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { PageWarehouseSkeleton } from "@/components/ui/page-list-skeleton";
import { type Day, type Thung, type Tier } from "@/data/duLieuMau";
import { API_BASE } from "@/api/client";
import { TheThung } from "@/components/warehouse/TheThung";
import { NganChiTietThung } from "@/components/warehouse/NganChiTietThung";
import { Filter } from "lucide-react";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { AnimatePresence, motion } from "framer-motion";

type KieuLoc = "all" | "low" | "critical" | "dead";

function chuanHoaViTriLabel(s: string | undefined | null): string {
  if (s == null || s === "") return "";
  return String(s).replace(/\s+/g, "").toUpperCase();
}

function timThungTheoId(days: Day[], id: string): Thung | null {
  for (const d of days) {
    if (!d.tiers) continue;
    for (const tier of d.tiers) {
      const b = tier.bins.find((x) => x.id === id);
      if (b) return b;
    }
  }
  return null;
}

export default function TrangSoDoKho() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const vtTuUrl = searchParams.get("vt")?.trim() ?? "";
  const vtTuUrlNorm = useMemo(() => chuanHoaViTriLabel(vtTuUrl), [vtTuUrl]);
  const lastVtDaDongBo = useRef<string>("");
  const highlightWrapRef = useRef<HTMLDivElement | null>(null);

  const [danhSachDayKho, setDanhSachDayKho] = useState<Day[]>([]);
  const [tai, setTai] = useState(true);
  const [loi, setLoi] = useState<string | null>(null);
  const [thungChon, setThungChon] = useState<Thung | null>(null);
  const [mapVer, setMapVer] = useState(0);
  const [loc, setLoc] = useState<KieuLoc>("all");
  const [timKiem, setTimKiem] = useState("");
  const hangLocRef = useRef<HTMLDivElement>(null);

  const thungLaNoiBat = useCallback(
    (thung: Thung) => (vtTuUrlNorm ? chuanHoaViTriLabel(thung.label) === vtTuUrlNorm : false),
    [vtTuUrlNorm]
  );

  useEffect(() => {
    if (tai || !vtTuUrl) return;
    if (lastVtDaDongBo.current !== vtTuUrl) {
      lastVtDaDongBo.current = vtTuUrl;
      setTimKiem(vtTuUrl);
    }
  }, [tai, vtTuUrl]);

  /** Cuộn sau khi lưới + stagger gần xong — tránh giật khi smooth scroll chạy cùng layout animation */
  useEffect(() => {
    if (tai || !vtTuUrlNorm) return;
    const t = window.setTimeout(() => {
      highlightWrapRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }, 420);
    return () => window.clearTimeout(t);
  }, [tai, vtTuUrlNorm, danhSachDayKho]);

  useEffect(() => {
    let cancelled = false;
    setTai(true);
    setLoi(null);
    fetch(`${API_BASE}/api/warehouse/map`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Day[]) => {
        if (!cancelled) setDanhSachDayKho(Array.isArray(rows) ? rows : []);
      })
      .catch((e) => {
        if (!cancelled) setLoi(e?.message || t("error.load_warehouse"));
      })
      .finally(() => {
        if (!cancelled) setTai(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t, mapVer]);

  useEffect(() => {
    if (!thungChon?.id || danhSachDayKho.length === 0) return;
    const capNhat = timThungTheoId(danhSachDayKho, thungChon.id);
    if (capNhat) setThungChon(capNhat);
  }, [danhSachDayKho, thungChon?.id]);

  const cacLoc: { value: KieuLoc; label: string }[] = [
    { value: "all", label: t("warehouse.filter_all") },
    { value: "critical", label: t("warehouse.filter_critical") },
    { value: "low", label: t("warehouse.filter_low") },
    { value: "dead", label: t("warehouse.filter_dead") },
  ];

  const tuKhoaRaw = timKiem.trim().toLowerCase();
  const tuKhoaSach = tuKhoaRaw.replace(/[^a-z0-9-]/g, "");

  // Nếu người dùng gõ theo dãy (A/B/C hoặc có ký tự thừa kiểu "C ."),
  // ưu tiên chế độ tìm dãy để đưa đúng dãy lên đầu và ẩn dãy còn lại.
  const rackSearch = useMemo(() => {
    if (!tuKhoaSach) return null;
    const labels = new Set(danhSachDayKho.map((d) => String(d.label || "").toLowerCase()));
    if (labels.has(tuKhoaSach)) return tuKhoaSach;
    return null;
  }, [danhSachDayKho, tuKhoaSach]);

  // 🎯 Helper: Kiểm tra xem dãy có match search không
  const dayMatchesSearch = useCallback((day: Day) => {
    if (!tuKhoaRaw) return true;

    const dayLabel = String(day.label || "").toLowerCase();

    if (rackSearch) return dayLabel === rackSearch;

    const tuKhoa = tuKhoaSach || tuKhoaRaw;

    if (dayLabel.includes(tuKhoa)) return true;

    if (day.tiers) {
      return day.tiers.some((tier: Tier) =>
        tier.bins.some(bin =>
          bin.label?.toLowerCase().includes(tuKhoa) ||
          bin.components.some(c =>
            c.partNumber?.toLowerCase().includes(tuKhoa) ||
            c.name?.toLowerCase().includes(tuKhoa)
          )
        )
      );
    }

    if (day.bins) {
      return day.bins.some(bin =>
        bin.label?.toLowerCase().includes(tuKhoa) ||
        bin.components.some(c =>
          c.partNumber?.toLowerCase().includes(tuKhoa) ||
          c.name?.toLowerCase().includes(tuKhoa)
        )
      );
    }

    return false;
  }, [tuKhoaRaw, tuKhoaSach, rackSearch]);

  // 📋 Sort & Reorder: Dãy match lên trước (không scroll)
  const sortedDaysKho = useMemo(() => {
    if (!tuKhoaRaw) return danhSachDayKho;
    
    const matchedDays: Day[] = [];
    const unmatchedDays: Day[] = [];
    
    danhSachDayKho.forEach(day => {
      if (dayMatchesSearch(day)) {
        matchedDays.push(day);
      } else {
        unmatchedDays.push(day);
      }
    });
    
    return [...matchedDays, ...unmatchedDays];
  }, [danhSachDayKho, tuKhoaRaw, dayMatchesSearch]);

  const soDayKhopTimKiem = useMemo(() => {
    if (!tuKhoaRaw) return -1;
    return danhSachDayKho.filter((d) => dayMatchesSearch(d)).length;
  }, [danhSachDayKho, tuKhoaRaw, dayMatchesSearch]);

  const nenMo = (thung: Thung) => {
    // Lọc theo status
    if (loc !== "all" && thung.status !== loc) return true;
    
    // Lọc theo tìm kiếm (spotlight)
    if (tuKhoaRaw) {
      const tuKhoa = tuKhoaSach || tuKhoaRaw;
      const khopThung = thung.label?.toLowerCase().includes(tuKhoa);
      const khopMaLK = thung.components.some(c => c.partNumber?.toLowerCase().includes(tuKhoa));
      const khopTenLK = thung.components.some(c => c.name?.toLowerCase().includes(tuKhoa));
      return !(khopThung || khopMaLK || khopTenLK);
    }
    
    return false;
  };

  if (tai) {
    return <PageWarehouseSkeleton />;
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1500px] mx-auto">
      <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-gradient-to-r from-background to-muted/30 p-4 md:p-5 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">{t("warehouse.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {danhSachDayKho.length} {t("dashboard.subtitle_rows")} · {t("warehouse.subtitle")}
          </p>
        </div>
        <button
          type="button"
          className="md:hidden rounded-lg border border-border/60 p-2 text-muted-foreground hover:bg-muted transition-colors"
          onClick={() => hangLocRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })}
          aria-label={t("warehouse.filter_all")}
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>
      {loi && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{loi}</p>
      )}
      <div ref={hangLocRef} className="flex gap-2 overflow-x-auto pb-1 rounded-xl border border-border/50 bg-muted/30 p-2">
        {cacLoc.map((f) => (
          <motion.button
            key={f.value}
            onClick={() => setLoc(f.value)}
            className={`label-industrial px-4 py-2 rounded-lg border-2 btn-mechanical whitespace-nowrap font-medium transition-colors duration-150 ${loc === f.value ? "border-primary text-primary bg-primary/10 shadow-md" : "border-gray-300 text-muted-foreground hover:bg-gray-50 hover:border-primary/30"}`}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {f.label}
          </motion.button>
        ))}
      </div>

      {/* Modern Spotlight Search */}
      <motion.div 
        className="relative group"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <input
          type="text"
          placeholder={t("warehouse.search_placeholder")}
          value={timKiem}
          onChange={(e) => setTimKiem(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background text-foreground placeholder:text-gray-400 placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-primary/70 focus:border-primary transition-all duration-150 shadow-sm"
        />
        {timKiem && (
          <motion.button
            type="button"
            onClick={() => setTimKiem("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-foreground text-xl transition-colors duration-150"
            whileTap={{ scale: 0.85 }}
            whileHover={{ scale: 1.2 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            aria-label={t("comp.clear_filter")}
          >
            ✕
          </motion.button>
        )}
        {!timKiem && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 text-lg opacity-50 group-focus-within:opacity-0 transition-opacity duration-150">
            🔍
          </div>
        )}
      </motion.div>
      <motion.div
        layout
        className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5 items-start"
      >
        {tuKhoaRaw && soDayKhopTimKiem === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Không có dãy hay thùng khớp tìm kiếm</p>
            <p className="text-xs mb-3">Thử từ khóa khác (mã linh kiện, vị trí M3-1, tên dãy…)</p>
            <button
              type="button"
              onClick={() => setTimKiem("")}
              className="text-sm font-medium text-primary underline underline-offset-2"
            >
              Xóa tìm kiếm
            </button>
          </div>
        )}
        {!(tuKhoaRaw && soDayKhopTimKiem === 0) && (
        <AnimatePresence mode="popLayout">
        {sortedDaysKho.map((day, idx) => {
          const isMatched = dayMatchesSearch(day);
          
          // Khi đang search: ẩn dãy không match để dãy đúng thay thế vị trí đầu
          if (tuKhoaRaw && !isMatched) return null;
          
          return (
            <motion.div 
              key={day.id}
              className="rounded-2xl border border-border/60 bg-card/95 backdrop-blur p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow duration-200 h-full"
              layout
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: isMatched || !tuKhoaRaw ? 1 : 0.25, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.98 }}
              transition={{
                layout: { type: "spring", stiffness: 430, damping: 34, mass: 0.8 },
                opacity: { delay: idx * 0.02, duration: 0.18, ease: "easeOut" },
                y: { delay: idx * 0.02, duration: 0.2, ease: "easeOut" },
                scale: { duration: 0.18, ease: "easeOut" },
              }}
            >
              <h2 className="label-industrial mb-4 flex items-center justify-between gap-2 font-bold text-lg">
                <span className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-sm shadow-md transition-colors ${isMatched || !tuKhoaRaw ? "bg-primary" : "bg-gray-300"}`} />
                <span className={`text-primary font-black text-xl transition-colors ${isMatched || !tuKhoaRaw ? "text-primary" : "text-gray-400"}`}>
                  {t("warehouse.rack_prefix")} {day.label}
                </span>
                </span>
                <span className="text-[11px] px-2 py-1 rounded-full bg-primary/10 text-primary font-semibold">
                  {day.tiers?.length || 0} {t("warehouse.tier")}
                </span>
              </h2>
              
              {/* Hiển thị theo tầng */}
              <div className="space-y-4">
                {day.tiers?.map((tier: Tier, tierIdx: number) => (
                  <motion.div 
                    key={tier.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{
                      layout: { type: "spring", stiffness: 430, damping: 34, mass: 0.8 },
                      opacity: { delay: (idx * 0.02) + (tierIdx * 0.03), duration: 0.16, ease: "easeOut" },
                      y: { delay: (idx * 0.02) + (tierIdx * 0.03), duration: 0.18, ease: "easeOut" },
                    }}
                  className="rounded-xl border border-border/50 bg-muted/25 p-2.5"
                  >
                    <h3 className="text-xs font-semibold text-muted-foreground mb-2 ml-1 uppercase tracking-wide">
                      {tier.label}
                    </h3>
                    <div className="grid grid-cols-4 gap-2">
                      {tier.bins.map((thung, binIdx) => {
                        const noiBat = thungLaNoiBat(thung);
                        return (
                        <motion.div
                          key={thung.id}
                          ref={noiBat ? highlightWrapRef : undefined}
                          className={noiBat ? "h-full scroll-mt-20" : "h-full"}
                          initial={noiBat ? false : { opacity: 0, scale: 0.96 }}
                          animate={{ opacity: nenMo(thung) ? 0.2 : 1, scale: 1 }}
                          transition={
                            noiBat
                              ? { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
                              : {
                                  delay: (tierIdx * 0.05) + (binIdx * 0.02),
                                  duration: 0.22,
                                  ease: [0.22, 1, 0.36, 1],
                                }
                          }
                        >
                          <TheThung thung={thung} khiBam={setThungChon} noiBat={noiBat} />
                        </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                ))}
                
                {/* Fallback nếu không có tiers */}
                {!day.tiers && day.bins && (
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                    {day.bins.map((thung, binIdx) => {
                      const noiBat = thungLaNoiBat(thung);
                      return (
                      <motion.div
                        key={thung.id}
                        ref={noiBat ? highlightWrapRef : undefined}
                        className={noiBat ? "h-full scroll-mt-20" : "h-full"}
                        initial={noiBat ? false : { opacity: 0, scale: 0.96 }}
                        animate={{ opacity: nenMo(thung) ? 0.2 : 1, scale: 1 }}
                        transition={
                          noiBat
                            ? { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
                            : {
                                delay: (idx * 0.03) + (binIdx * 0.02),
                                duration: 0.22,
                                ease: [0.22, 1, 0.36, 1],
                              }
                        }
                      >
                        <TheThung thung={thung} khiBam={setThungChon} noiBat={noiBat} />
                      </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
        </AnimatePresence>
        )}
      </motion.div>
      <NganChiTietThung
        thung={thungChon}
        mo={!!thungChon}
        dong={() => setThungChon(null)}
        sauKhiKiemKe={() => setMapVer((v) => v + 1)}
      />
    </div>
  );
}
