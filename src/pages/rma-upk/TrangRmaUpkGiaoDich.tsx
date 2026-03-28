import { useCallback, useEffect, useState } from "react";
import { rmaUpkGet, rmaUpkPost, type RmaUpkDieuChinhRow, type RmaUpkMe, type RmaUpkTonRow } from "@/lib/rmaUpkApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { useKhoPhu } from "@/contexts/NguCanhKhoPhu";

export default function TrangRmaUpkGiaoDich() {
  const { t, ngonNgu } = useI18n();
  const { scope } = useKhoPhu();
  const maKho: "UPK" | "RMA" = scope;
  const [me, setMe] = useState<RmaUpkMe | null>(null);
  const [maLinhKien, setMaLinhKien] = useState("");
  const [soLuongPhieu, setSoLuongPhieu] = useState("");
  const [loaiPhieu, setLoaiPhieu] = useState<"NHAP" | "XUAT">("NHAP");
  const [nhapTuUpk, setNhapTuUpk] = useState<"SEVT" | "VENDOR">("SEVT");
  const [xuatDenUpk, setXuatDenUpk] = useState<"IQC" | "MM">("IQC");
  const [nhapTuRma, setNhapTuRma] = useState<"SX" | "FB" | "QC">("SX");
  const [xuatDenRma, setXuatDenRma] = useState<"SX" | "FB" | "SEVT">("SX");
  const [ghiChu, setGhiChu] = useState("");
  const [lichSu, setLichSu] = useState<RmaUpkDieuChinhRow[]>([]);
  const [goiYCode, setGoiYCode] = useState<RmaUpkTonRow[]>([]);
  const [dangTimCode, setDangTimCode] = useState(false);
  const [hienGoiYCode, setHienGoiYCode] = useState(false);
  const [chiSoGoiY, setChiSoGoiY] = useState(-1);
  const [taiLichSu, setTaiLichSu] = useState(true);
  const [loiLichSu, setLoiLichSu] = useState(false);
  const [tongTonUpk, setTongTonUpk] = useState<number | null>(null);
  const [tongTonRma, setTongTonRma] = useState<number | null>(null);
  /** Chỉ UPK: lọc lịch sử theo đối tác hoặc tất cả */
  const [locDoiTacUpk, setLocDoiTacUpk] = useState<"TAT_CA" | "SEVT" | "VENDOR" | "IQC" | "MM">("TAT_CA");

  useEffect(() => {
    rmaUpkGet<RmaUpkMe>("/api/rma-upk/me")
      .then((m) => {
        setMe(m);
      })
      .catch(() => {});
  }, []);

  const loadHistory = useCallback(async () => {
    setTaiLichSu(true);
    setLoiLichSu(false);
    try {
      const q =
        maKho === "UPK" && locDoiTacUpk !== "TAT_CA"
          ? `kho=${maKho}&limit=80&doiTac=${encodeURIComponent(locDoiTacUpk)}`
          : `kho=${maKho}&limit=80`;
      const rows = await rmaUpkGet<RmaUpkDieuChinhRow[]>(`/api/rma-upk/adjustments?${q}`);
      setLichSu(Array.isArray(rows) ? rows : []);
    } catch {
      setLichSu([]);
      setLoiLichSu(true);
    } finally {
      setTaiLichSu(false);
    }
  }, [maKho, locDoiTacUpk]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const loadTongTon = useCallback(async () => {
    try {
      const rows = await rmaUpkGet<RmaUpkTonRow[]>("/api/rma-upk/stock?kho=ALL&limit=5000");
      let upk = 0;
      let rma = 0;
      for (const r of rows || []) {
        const sl = Number(r.SoLuongTon) || 0;
        if (r.MaKho === "UPK") upk += sl;
        else if (r.MaKho === "RMA") rma += sl;
      }
      setTongTonUpk(upk);
      setTongTonRma(rma);
    } catch {
      setTongTonUpk(null);
      setTongTonRma(null);
    }
  }, []);

  useEffect(() => {
    loadTongTon();
  }, [loadTongTon]);

  useEffect(() => {
    const kw = maLinhKien.trim();
    if (kw.length < 2) {
      setGoiYCode([]);
      setHienGoiYCode(false);
      setChiSoGoiY(-1);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setDangTimCode(true);
      try {
        const rows = await rmaUpkGet<RmaUpkTonRow[]>(
          `/api/rma-upk/stock?kho=${maKho}&q=${encodeURIComponent(kw)}&limit=8`
        );
        if (!cancelled) {
          setGoiYCode(Array.isArray(rows) ? rows : []);
          setHienGoiYCode(true);
          setChiSoGoiY(-1);
        }
      } catch {
        if (!cancelled) {
          setGoiYCode([]);
          setChiSoGoiY(-1);
        }
      } finally {
        if (!cancelled) setDangTimCode(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [maLinhKien, maKho]);

  const coTheGhi = me?.isAdmin || me?.khoGhi === maKho;
  const locale = ngonNgu === "ko" ? "ko-KR" : "vi-VN";
  const doiTacPhieu =
    maKho === "UPK"
      ? loaiPhieu === "NHAP"
        ? nhapTuUpk
        : xuatDenUpk
      : loaiPhieu === "NHAP"
        ? nhapTuRma
        : xuatDenRma;
  const dsHienThiGoiY = maLinhKien.trim().length >= 2 && hienGoiYCode;

  function chonGoiYCode(code: string) {
    setMaLinhKien(code);
    setHienGoiYCode(false);
    setChiSoGoiY(-1);
  }

  async function guiPhieu() {
    const n = parseInt(soLuongPhieu, 10);
    if (!maLinhKien.trim() || !Number.isFinite(n) || n <= 0) {
      toast.error(loaiPhieu === "NHAP" ? t("rmaUpk.toast_tx_need_code_qty") : t("rmaUpk.toast_tx_need_out_qty"));
      return;
    }
    try {
      await rmaUpkPost("/api/rma-upk/adjust", {
        maKho,
        maLinhKien: maLinhKien.trim(),
        delta: loaiPhieu === "NHAP" ? n : -n,
        doiTac: doiTacPhieu,
        ghiChu: ghiChu.trim() || undefined,
      });
      toast.success(loaiPhieu === "NHAP" ? t("rmaUpk.toast_tx_in_ok") : t("rmaUpk.toast_tx_out_ok"));
      setSoLuongPhieu("");
      setMaLinhKien("");
      await Promise.all([loadHistory(), loadTongTon()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("rmaUpk.error_generic"));
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold">{t("rmaUpk.tx_title")}</h1>
        <p className="text-sm text-muted-foreground">{t("rmaUpk.tx_subtitle")}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">{t("rmaUpk.tx_total_upk")}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{tongTonUpk != null ? tongTonUpk.toLocaleString(locale) : "—"}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">{t("rmaUpk.tx_total_rma")}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{tongTonRma != null ? tongTonRma.toLocaleString(locale) : "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("rmaUpk.tx_card_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {me?.isAdmin ? (
            <p className="text-sm text-muted-foreground">
              {t("rmaUpk.tx_wh_label")}: <strong>{maKho}</strong>
            </p>
          ) : me?.khoGhi ? (
            <p className="text-sm text-muted-foreground">{t("rmaUpk.tx_only_write", { kho: me.khoGhi })}</p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="mlk">{t("rmaUpk.tx_code_label")}</Label>
            <Input
              id="mlk"
              className="font-mono"
              value={maLinhKien}
              onChange={(e) => setMaLinhKien(e.target.value)}
              onFocus={() => {
                if (maLinhKien.trim().length >= 2) setHienGoiYCode(true);
              }}
              onBlur={() => {
                setTimeout(() => setHienGoiYCode(false), 120);
              }}
              onKeyDown={(e) => {
                if (!dsHienThiGoiY || goiYCode.length === 0) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setChiSoGoiY((prev) => (prev + 1) % goiYCode.length);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setChiSoGoiY((prev) => (prev <= 0 ? goiYCode.length - 1 : prev - 1));
                } else if (e.key === "Enter") {
                  const picked = goiYCode[chiSoGoiY] || goiYCode[0];
                  if (picked) {
                    e.preventDefault();
                    chonGoiYCode(picked.MaLinhKien);
                  }
                }
              }}
              placeholder={t("rmaUpk.tx_code_ph")}
            />
            <p className="text-xs text-muted-foreground">{t("rmaUpk.tx_code_search_hint")}</p>
            {dsHienThiGoiY ? (
              <div className="rounded-md border border-border bg-background p-1">
                {dangTimCode ? (
                  <p className="px-2 py-1 text-xs text-muted-foreground">{t("rmaUpk.stock_loading")}</p>
                ) : goiYCode.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-muted-foreground">{t("rmaUpk.tx_code_search_empty")}</p>
                ) : (
                  <div className="max-h-40 overflow-auto">
                    {goiYCode.map((r, idx) => (
                      <button
                        key={`${r.MaKho}-${r.MaLinhKien}`}
                        type="button"
                        className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-muted ${idx === chiSoGoiY ? "bg-muted" : ""}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => chonGoiYCode(r.MaLinhKien)}
                      >
                        <span className="font-mono">{r.MaLinhKien}</span>
                        <span className="text-muted-foreground">{r.SoLuongTon}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {!coTheGhi ? (
            <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">{t("rmaUpk.tx_no_write")}</p>
          ) : (
            <div className="space-y-4 rounded-md border border-border bg-muted/20 p-4">
              <div className="space-y-2">
                <Label>{t("rmaUpk.tx_col_type")}</Label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant={loaiPhieu === "NHAP" ? "default" : "outline"} onClick={() => setLoaiPhieu("NHAP")}>
                    {t("rmaUpk.tx_in_label")}
                  </Button>
                  <Button type="button" size="sm" variant={loaiPhieu === "XUAT" ? "default" : "outline"} onClick={() => setLoaiPhieu("XUAT")}>
                    {t("rmaUpk.tx_out_label")}
                  </Button>
                </div>
              </div>

              {maKho === "UPK" ? (
                <div className="space-y-2">
                  <Label>{t("rmaUpk.tx_col_partner")}</Label>
                  {loaiPhieu === "NHAP" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant={nhapTuUpk === "SEVT" ? "default" : "outline"} onClick={() => setNhapTuUpk("SEVT")}>
                        {t("rmaUpk.tx_from_sevt")}
                      </Button>
                      <Button type="button" size="sm" variant={nhapTuUpk === "VENDOR" ? "default" : "outline"} onClick={() => setNhapTuUpk("VENDOR")}>
                        {t("rmaUpk.tx_from_vendor")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant={xuatDenUpk === "IQC" ? "default" : "outline"} onClick={() => setXuatDenUpk("IQC")}>
                        {t("rmaUpk.tx_to_iqc")}
                      </Button>
                      <Button type="button" size="sm" variant={xuatDenUpk === "MM" ? "default" : "outline"} onClick={() => setXuatDenUpk("MM")}>
                        {t("rmaUpk.tx_to_mm")}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>{t("rmaUpk.tx_col_partner")}</Label>
                  {loaiPhieu === "NHAP" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant={nhapTuRma === "SX" ? "default" : "outline"} onClick={() => setNhapTuRma("SX")}>
                        {t("rmaUpk.tx_from_sx")}
                      </Button>
                      <Button type="button" size="sm" variant={nhapTuRma === "FB" ? "default" : "outline"} onClick={() => setNhapTuRma("FB")}>
                        {t("rmaUpk.tx_from_fb")}
                      </Button>
                      <Button type="button" size="sm" variant={nhapTuRma === "QC" ? "default" : "outline"} onClick={() => setNhapTuRma("QC")}>
                        {t("rmaUpk.tx_from_qc")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant={xuatDenRma === "SX" ? "default" : "outline"} onClick={() => setXuatDenRma("SX")}>
                        {t("rmaUpk.tx_to_sx")}
                      </Button>
                      <Button type="button" size="sm" variant={xuatDenRma === "FB" ? "default" : "outline"} onClick={() => setXuatDenRma("FB")}>
                        {t("rmaUpk.tx_to_fb")}
                      </Button>
                      <Button type="button" size="sm" variant={xuatDenRma === "SEVT" ? "default" : "outline"} onClick={() => setXuatDenRma("SEVT")}>
                        {t("rmaUpk.tx_to_sevt")}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>{t("rmaUpk.tx_col_qty_tx")}</Label>
                <Input className="font-mono" type="number" min={1} value={soLuongPhieu} onChange={(e) => setSoLuongPhieu(e.target.value)} placeholder={t("rmaUpk.tx_qty_ph")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gc">{t("rmaUpk.tx_note_label")}</Label>
                <Textarea
                  id="gc"
                  className="min-h-[72px] resize-y text-sm"
                  value={ghiChu}
                  onChange={(e) => setGhiChu(e.target.value)}
                  placeholder={t("rmaUpk.tx_note_ph")}
                  maxLength={500}
                />
              </div>

              <Button type="button" onClick={guiPhieu} variant={loaiPhieu === "NHAP" ? "default" : "secondary"}>
                {loaiPhieu === "NHAP" ? t("rmaUpk.tx_save_in") : t("rmaUpk.tx_save_out")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">{t("rmaUpk.tx_history_title")}</CardTitle>
          {maKho === "UPK" ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={locDoiTacUpk === "TAT_CA" ? "default" : "outline"} onClick={() => setLocDoiTacUpk("TAT_CA")}>
                {t("rmaUpk.tx_filter_all")}
              </Button>
              <Button type="button" size="sm" variant={locDoiTacUpk === "SEVT" ? "default" : "outline"} onClick={() => setLocDoiTacUpk("SEVT")}>
                SEVT
              </Button>
              <Button type="button" size="sm" variant={locDoiTacUpk === "VENDOR" ? "default" : "outline"} onClick={() => setLocDoiTacUpk("VENDOR")}>
                VENDOR
              </Button>
              <Button type="button" size="sm" variant={locDoiTacUpk === "IQC" ? "default" : "outline"} onClick={() => setLocDoiTacUpk("IQC")}>
                IQC
              </Button>
              <Button type="button" size="sm" variant={locDoiTacUpk === "MM" ? "default" : "outline"} onClick={() => setLocDoiTacUpk("MM")}>
                MM
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          {taiLichSu ? (
            <p className="text-sm text-muted-foreground">{t("rmaUpk.tx_history_loading")}</p>
          ) : loiLichSu ? (
            <p className="text-sm text-destructive">{t("rmaUpk.tx_history_err")}</p>
          ) : lichSu.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("rmaUpk.tx_history_empty")}</p>
          ) : (
            <ScrollArea className="h-[min(420px,50vh)] rounded-md border border-border">
              <table className="w-full min-w-[min(100%,880px)] text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left">
                    <th className="sticky top-0 bg-muted/50 p-2 font-medium whitespace-nowrap">{t("rmaUpk.tx_col_time")}</th>
                    {maKho === "UPK" || maKho === "RMA" ? (
                      <th className="sticky top-0 bg-muted/50 p-2 font-medium whitespace-nowrap">{t("rmaUpk.tx_col_partner")}</th>
                    ) : null}
                    <th className="sticky top-0 bg-muted/50 p-2 font-medium">{t("rmaUpk.tx_col_type")}</th>
                    <th className="sticky top-0 bg-muted/50 p-2 font-medium">{t("rmaUpk.stock_col_code")}</th>
                    <th className="sticky top-0 bg-muted/50 p-2 text-right font-medium">{t("rmaUpk.tx_col_qty_tx")}</th>
                    <th className="sticky top-0 bg-muted/50 p-2 text-right font-medium">{t("rmaUpk.tx_col_after")}</th>
                    <th className="sticky top-0 bg-muted/50 p-2 font-medium">{t("rmaUpk.tx_col_user")}</th>
                    <th className="sticky top-0 bg-muted/50 p-2 font-medium max-w-[180px]">{t("rmaUpk.tx_col_note")}</th>
                  </tr>
                </thead>
                <tbody>
                  {lichSu.map((row) => (
                    <tr key={`${row.DoiTac ?? ""}-${row.MaDieuChinh}`} className="border-b border-border/70">
                      <td className="p-2 whitespace-nowrap tabular-nums text-muted-foreground">
                        {row.NgayGio ? new Date(row.NgayGio).toLocaleString(locale) : "—"}
                      </td>
                      {maKho === "UPK" || maKho === "RMA" ? <td className="p-2 font-medium whitespace-nowrap">{row.DoiTac || "—"}</td> : null}
                      <td className="p-2">
                        {row.Loai === "NHAP" ? (
                          <span className="text-emerald-700 dark:text-emerald-400">{t("rmaUpk.tx_type_in")}</span>
                        ) : (
                          <span className="text-amber-800 dark:text-amber-400">{t("rmaUpk.tx_type_out")}</span>
                        )}
                      </td>
                      <td className="p-2 font-mono">{row.MaLinhKien}</td>
                      <td className="p-2 text-right tabular-nums">{row.SoLuong}</td>
                      <td className="p-2 text-right tabular-nums">{row.TonSau}</td>
                      <td className="p-2">
                        {row.HoTenNguoiTao || row.TaiKhoanNguoiTao || "—"}
                      </td>
                      <td className="p-2 max-w-[180px] break-words text-muted-foreground">{row.GhiChu || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
