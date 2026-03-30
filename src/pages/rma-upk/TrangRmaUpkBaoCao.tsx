import { useCallback, useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { Download, FileBarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { useKhoPhu } from "@/contexts/NguCanhKhoPhu";
import {
  rmaUpkGet,
  type RmaUpkDieuChinhRow,
  type RmaUpkTransferHistoryRow,
} from "@/lib/rmaUpkApi";
import { toast } from "sonner";

function ngayMacDinhTu() {
  return format(subDays(new Date(), 30), "yyyy-MM-dd");
}

function ngayMacDinhDen() {
  return format(new Date(), "yyyy-MM-dd");
}

function fmtThoiGian(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

function csvEscape(cell: string) {
  if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

export default function TrangRmaUpkBaoCao() {
  const { t } = useI18n();
  const { scope } = useKhoPhu();
  const tab: "UPK" | "RMA" = scope;

  const [tuNgay, setTuNgay] = useState(() => ngayMacDinhTu());
  const [denNgay, setDenNgay] = useState(() => ngayMacDinhDen());
  const [repTab, setRepTab] = useState<"nx" | "ck">("nx");
  const [maLoc, setMaLoc] = useState("");
  const [dongBoLoc, setDongBoLoc] = useState({ tu: ngayMacDinhTu(), den: ngayMacDinhDen(), q: "" });

  const [dongNx, setDongNx] = useState<RmaUpkDieuChinhRow[]>([]);
  const [dongCk, setDongCk] = useState<RmaUpkTransferHistoryRow[]>([]);
  const [tai, setTai] = useState(true);

  const queryNx = useMemo(() => {
    const p = new URLSearchParams();
    p.set("kho", tab);
    p.set("limit", "500");
    if (dongBoLoc.tu) p.set("tuNgay", `${dongBoLoc.tu}T00:00:00`);
    if (dongBoLoc.den) p.set("denNgay", `${dongBoLoc.den}T23:59:59.999`);
    if (dongBoLoc.q.trim()) p.set("q", dongBoLoc.q.trim());
    return `/api/rma-upk/adjustments?${p.toString()}`;
  }, [tab, dongBoLoc]);

  const queryCk = useMemo(() => {
    const p = new URLSearchParams();
    p.set("kho", tab);
    p.set("limit", "200");
    if (dongBoLoc.tu) p.set("tuNgay", `${dongBoLoc.tu}T00:00:00`);
    if (dongBoLoc.den) p.set("denNgay", `${dongBoLoc.den}T23:59:59.999`);
    return `/api/rma-upk/transfers/history?${p.toString()}`;
  }, [tab, dongBoLoc]);

  const taiLai = useCallback(async () => {
    setTai(true);
    try {
      const [nx, ck] = await Promise.all([
        rmaUpkGet<RmaUpkDieuChinhRow[]>(queryNx),
        rmaUpkGet<RmaUpkTransferHistoryRow[]>(queryCk),
      ]);
      setDongNx(Array.isArray(nx) ? nx : []);
      setDongCk(Array.isArray(ck) ? ck : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("rmaUpk.toast_load_stock_fail"));
    } finally {
      setTai(false);
    }
  }, [queryNx, queryCk, t]);

  useEffect(() => {
    void taiLai();
  }, [taiLai]);

  function apDungBoLoc() {
    setDongBoLoc({ tu: tuNgay, den: denNgay, q: maLoc });
  }

  function xuatCsvNx() {
    const header = [
      t("rmaUpk.rep_col_time"),
      t("rmaUpk.stock_col_code"),
      t("rmaUpk.stock_col_wh"),
      t("rmaUpk.rep_col_partner"),
      t("rmaUpk.rep_col_type"),
      t("rmaUpk.rep_col_qty"),
      t("rmaUpk.rep_col_after"),
      t("rmaUpk.rep_col_note"),
      t("rmaUpk.rep_col_user"),
    ];
    const lines = dongNx.map((r) => {
      const loai =
        r.Loai === "NHAP" ? t("rmaUpk.rep_type_in") : r.Loai === "XUAT" ? t("rmaUpk.rep_type_out") : r.Loai;
      return [
        fmtThoiGian(r.NgayGio),
        r.MaLinhKien,
        r.MaKho,
        r.DoiTac ?? "",
        loai,
        String(r.SoLuong),
        String(r.TonSau),
        r.GhiChu ?? "",
        [r.HoTenNguoiTao, r.TaiKhoanNguoiTao].filter(Boolean).join(" / "),
      ]
        .map((c) => csvEscape(String(c)))
        .join(",");
    });
    const bom = "\uFEFF";
    const blob = new Blob([bom + [header.join(","), ...lines].join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rma-upk-nxt-${tab}-${dongBoLoc.tu}-${dongBoLoc.den}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function xuatCsvCk() {
    const header = [
      t("rmaUpk.rep_ck_id"),
      t("rmaUpk.rep_ck_route"),
      t("rmaUpk.rep_ck_created"),
      t("rmaUpk.rep_ck_confirmed"),
      t("rmaUpk.rep_ck_lines"),
      t("rmaUpk.rep_col_note"),
      t("rmaUpk.rep_col_user"),
      t("rmaUpk.rep_ck_confirmer"),
    ];
    const lines = dongCk.map((r) => {
      const chi =
        r.chiTiet?.map((c) => `${c.MaLinhKien}×${c.SoLuong}`).join("; ") ?? "";
      return [
        String(r.MaChuyen),
        `${r.MaKhoNguon} → ${r.MaKhoDich}`,
        fmtThoiGian(r.NgayTao),
        fmtThoiGian(r.NgayXacNhan),
        chi,
        r.GhiChu ?? "",
        [r.HoTenNguoiTao, r.TaiKhoanNguoiTao].filter(Boolean).join(" / "),
        [r.HoTenNguoiXacNhan, r.TaiKhoanXacNhan].filter(Boolean).join(" / "),
      ]
        .map((c) => csvEscape(String(c)))
        .join(",");
    });
    const bom = "\uFEFF";
    const blob = new Blob([bom + [header.join(","), ...lines].join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rma-upk-chuyen-${tab}-${dongBoLoc.tu}-${dongBoLoc.den}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FileBarChart className="h-6 w-6 text-primary shrink-0" />
          {t("rmaUpk.rep_title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("rmaUpk.rep_subtitle")}</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="rep-tu">
              {t("rmaUpk.rep_filter_from")}
            </label>
            <Input
              id="rep-tu"
              type="date"
              className="w-[160px]"
              value={tuNgay}
              onChange={(e) => setTuNgay(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="rep-den">
              {t("rmaUpk.rep_filter_to")}
            </label>
            <Input
              id="rep-den"
              type="date"
              className="w-[160px]"
              value={denNgay}
              onChange={(e) => setDenNgay(e.target.value)}
            />
          </div>
          <div className="space-y-1 min-w-[180px] flex-1 max-w-sm">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="rep-ma">
              {t("rmaUpk.rep_filter_code")}
            </label>
            <Input
              id="rep-ma"
              placeholder={t("rmaUpk.rep_filter_code_ph")}
              value={maLoc}
              onChange={(e) => setMaLoc(e.target.value)}
            />
          </div>
          <Button type="button" variant="secondary" onClick={apDungBoLoc}>
            {t("rmaUpk.rep_apply")}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {t("khoPhu.stock_col_wh")}: <span className="font-mono">{tab}</span> · {t("rmaUpk.stock_col_code")}{" "}
          ({t("rmaUpk.rep_tab_nx")})
        </p>
      </div>

      <Tabs value={repTab} onValueChange={(v) => setRepTab(v as "nx" | "ck")} className="w-full">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="nx">{t("rmaUpk.rep_tab_nx")}</TabsTrigger>
            <TabsTrigger value="ck">{t("rmaUpk.rep_tab_ck")}</TabsTrigger>
          </TabsList>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            disabled={
              tai || (repTab === "nx" ? dongNx.length === 0 : dongCk.length === 0)
            }
            onClick={repTab === "nx" ? xuatCsvNx : xuatCsvCk}
          >
            <Download className="h-4 w-4" />
            {t("rmaUpk.rep_export_csv")}
          </Button>
        </div>

        <TabsContent value="nx" className="mt-3">
          <div className="rounded-lg border border-border overflow-hidden">
            <ScrollArea className="h-[min(62vh,560px)]">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="p-2.5 font-medium whitespace-nowrap">{t("rmaUpk.rep_col_time")}</th>
                    <th className="p-2.5 font-medium">{t("rmaUpk.stock_col_code")}</th>
                    <th className="p-2.5 font-medium">{t("rmaUpk.stock_col_wh")}</th>
                    <th className="p-2.5 font-medium">{t("rmaUpk.rep_col_partner")}</th>
                    <th className="p-2.5 font-medium">{t("rmaUpk.rep_col_type")}</th>
                    <th className="p-2.5 font-medium text-right tabular-nums">{t("rmaUpk.rep_col_qty")}</th>
                    <th className="p-2.5 font-medium text-right tabular-nums">{t("rmaUpk.rep_col_after")}</th>
                    <th className="p-2.5 font-medium max-w-[180px]">{t("rmaUpk.rep_col_note")}</th>
                    <th className="p-2.5 font-medium">{t("rmaUpk.rep_col_user")}</th>
                  </tr>
                </thead>
                <tbody>
                  {tai ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">
                        {t("rmaUpk.rep_loading")}
                      </td>
                    </tr>
                  ) : dongNx.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">
                        {t("rmaUpk.rep_empty_nx")}
                      </td>
                    </tr>
                  ) : (
                    dongNx.map((r, i) => (
                      <tr key={`${r.MaDieuChinh}-${r.MaKho}-${r.DoiTac ?? ""}-${i}`} className="border-b border-border/70">
                        <td className="p-2.5 text-xs whitespace-nowrap text-muted-foreground">{fmtThoiGian(r.NgayGio)}</td>
                        <td className="p-2.5 font-mono text-xs">{r.MaLinhKien}</td>
                        <td className="p-2.5">{r.MaKho}</td>
                        <td className="p-2.5 text-xs">{r.DoiTac ?? "—"}</td>
                        <td className="p-2.5">
                          <span
                            className={
                              r.Loai === "NHAP"
                                ? "text-emerald-700 dark:text-emerald-400"
                                : r.Loai === "XUAT"
                                  ? "text-amber-800 dark:text-amber-400"
                                  : ""
                            }
                          >
                            {r.Loai === "NHAP"
                              ? t("rmaUpk.rep_type_in")
                              : r.Loai === "XUAT"
                                ? t("rmaUpk.rep_type_out")
                                : r.Loai}
                          </span>
                        </td>
                        <td className="p-2.5 text-right tabular-nums">{r.SoLuong}</td>
                        <td className="p-2.5 text-right tabular-nums">{r.TonSau}</td>
                        <td className="p-2.5 text-xs max-w-[180px] break-words">{r.GhiChu ?? "—"}</td>
                        <td className="p-2.5 text-xs">
                          {[r.HoTenNguoiTao, r.TaiKhoanNguoiTao].filter(Boolean).join(" · ") || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="ck" className="mt-3">
          <div className="rounded-lg border border-border overflow-hidden">
            <ScrollArea className="h-[min(62vh,560px)]">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="p-2.5 font-medium tabular-nums">{t("rmaUpk.rep_ck_id")}</th>
                    <th className="p-2.5 font-medium">{t("rmaUpk.rep_ck_route")}</th>
                    <th className="p-2.5 font-medium whitespace-nowrap">{t("rmaUpk.rep_ck_created")}</th>
                    <th className="p-2.5 font-medium whitespace-nowrap">{t("rmaUpk.rep_ck_confirmed")}</th>
                    <th className="p-2.5 font-medium min-w-[200px]">{t("rmaUpk.rep_ck_lines")}</th>
                    <th className="p-2.5 font-medium max-w-[140px]">{t("rmaUpk.rep_col_note")}</th>
                    <th className="p-2.5 font-medium">{t("rmaUpk.rep_col_user")}</th>
                    <th className="p-2.5 font-medium">{t("rmaUpk.rep_ck_confirmer")}</th>
                  </tr>
                </thead>
                <tbody>
                  {tai ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        {t("rmaUpk.rep_loading")}
                      </td>
                    </tr>
                  ) : dongCk.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        {t("rmaUpk.rep_empty_ck")}
                      </td>
                    </tr>
                  ) : (
                    dongCk.map((r) => (
                      <tr key={r.MaChuyen} className="border-b border-border/70 align-top">
                        <td className="p-2.5 tabular-nums">{r.MaChuyen}</td>
                        <td className="p-2.5 font-medium">
                          {r.MaKhoNguon} → {r.MaKhoDich}
                        </td>
                        <td className="p-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtThoiGian(r.NgayTao)}</td>
                        <td className="p-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtThoiGian(r.NgayXacNhan)}</td>
                        <td className="p-2.5 font-mono text-[11px] leading-relaxed">
                          {r.chiTiet?.map((c) => (
                            <div key={c.MaLinhKien}>
                              {c.MaLinhKien} × {c.SoLuong}
                            </div>
                          ))}
                        </td>
                        <td className="p-2.5 text-xs max-w-[140px] break-words">{r.GhiChu ?? "—"}</td>
                        <td className="p-2.5 text-xs">
                          {[r.HoTenNguoiTao, r.TaiKhoanNguoiTao].filter(Boolean).join(" · ") || "—"}
                        </td>
                        <td className="p-2.5 text-xs">
                          {[r.HoTenNguoiXacNhan, r.TaiKhoanXacNhan].filter(Boolean).join(" · ") || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
