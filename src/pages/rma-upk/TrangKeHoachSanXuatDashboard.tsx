import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { khsxCoTheChuyenSang } from "@/lib/khsxStatusFlow";
import { rmaUpkGet, rmaUpkPost, type KhsxPlanListResult, type KhsxPlanRow, type KhsxStatus, type KhsxZone, type KhsxMaterialPlanResult } from "@/lib/rmaUpkApi";
import { toast } from "sonner";

function zoneFromPath(pathname: string): KhsxZone {
  if (pathname.startsWith("/upk")) return "UPK";
  if (pathname.startsWith("/rma")) return "RMA";
  return "MM";
}

/** Số dòng kế hoạch mỗi trang (API `/api/khsx/plans`) */
const KHSX_PLANS_PAGE_SIZE = 10;

const ALL_STATUS: KhsxStatus[] = ["CHO_XUAT_VT", "DANG_XUAT", "SAN_SANG", "THIEU_VT", "DA_XONG"];

/** Ngày từ API/SQL (ISO hoặc YYYY-MM-DD) → dd/mm/yyyy */
function fmtNgayKhsx(v: string | null | undefined, emptyLabel: string): string {
  if (v == null || v === "") return emptyLabel;
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

function lineRank(v: string): number {
  const s = String(v || "").toUpperCase();
  const m = s.match(/LINE\s*(\d+)/);
  if (m) return Number(m[1]);
  const n = Number(s.replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 9999;
}

export default function TrangKeHoachSanXuatDashboard() {
  const { t } = useI18n();
  const location = useLocation();
  const maKhu = useMemo(() => zoneFromPath(location.pathname), [location.pathname]);
  const basePath = useMemo(() => (maKhu === "MM" ? "/khsx" : maKhu === "UPK" ? "/upk/plan" : "/rma/plan"), [maKhu]);
  const [plans, setPlans] = useState<KhsxPlanRow[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [ca, setCa] = useState<"" | "CN" | "CD">("");
  const [congDoan, setCongDoan] = useState("");
  const [tai, setTai] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [lineQtyByLine, setLineQtyByLine] = useState<Record<string, number>>({});
  const [mrp, setMrp] = useState<KhsxMaterialPlanResult | null>(null);
  const plansSorted = useMemo(() => {
    return [...plans].sort((a, b) => {
      const la = lineRank(a.LineSanXuat);
      const lb = lineRank(b.LineSanXuat);
      if (la !== lb) return la - lb;
      if (a.LineSanXuat !== b.LineSanXuat) return a.LineSanXuat.localeCompare(b.LineSanXuat);
      if (a.NgaySanXuat !== b.NgaySanXuat) return a.NgaySanXuat.localeCompare(b.NgaySanXuat);
      if (a.CaSanXuat !== b.CaSanXuat) return a.CaSanXuat.localeCompare(b.CaSanXuat);
      return a.MaKeHoach - b.MaKeHoach;
    });
  }, [plans]);
  async function load(nextPage = page) {
    setTai(true);
    try {
      const params = new URLSearchParams({ maKhu, limit: String(KHSX_PLANS_PAGE_SIZE), page: String(nextPage) });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (ca) params.set("ca", ca);
      if (congDoan.trim()) params.set("congDoan", congDoan.trim().toUpperCase());
      const rs = await rmaUpkGet<KhsxPlanListResult | KhsxPlanRow[]>(`/api/khsx/plans?${params.toString()}`);
      if (Array.isArray(rs)) {
        setPlans(rs);
        setTotalRows(rs.length);
        setTotalPages(1);
        setPage(1);
        setLineQtyByLine({});
      } else {
        setPlans(Array.isArray(rs.items) ? rs.items : []);
        setTotalRows(Number(rs.totalRows) || 0);
        setTotalPages(Number(rs.totalPages) || 1);
        setPage(Number(rs.page) || 1);
        setLineQtyByLine(rs.lineQtyByLine && typeof rs.lineQtyByLine === "object" ? rs.lineQtyByLine : {});
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("rmaUpk.error_generic"));
      setPlans([]);
      setTotalRows(0);
      setTotalPages(1);
      setLineQtyByLine({});
    } finally {
      setTai(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maKhu]);

  async function doiTrangThai(id: number, hienTai: KhsxStatus, status: KhsxStatus) {
    if (hienTai === status || !khsxCoTheChuyenSang(hienTai, status)) {
      toast.message(t("khsx.status_transition_forbidden"));
      return;
    }
    try {
      await rmaUpkPost(`/api/khsx/${id}/status`, { status });
      setPlans((prev) => prev.map((p) => (p.MaKeHoach === id ? { ...p, TrangThai: status } : p)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("rmaUpk.error_generic"));
    }
  }

  async function duTru(id: number) {
    try {
      const rs = await rmaUpkPost<KhsxMaterialPlanResult>(`/api/khsx/${id}/material-plan`, {});
      setMrp(rs);
      if (rs.warningCode === "NO_BOM") {
        toast.warning(t("khsx.mrp_no_bom"));
      } else {
        toast.success(t("khsx.mrp_ok"));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("rmaUpk.error_generic"));
      setMrp(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold">{t("khsx.dashboard_title")}</h1>
        <p className="text-sm text-muted-foreground">{t("khsx.dashboard_subtitle", { zone: maKhu })}</p>
        <Button asChild size="sm" className="mt-3">
          <Link to={`${basePath}/import`}>{t("khsx.go_import")}</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("khsx.filters")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-6">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t("khsx.aria_date_from")} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label={t("khsx.aria_date_to")} />
          <Input placeholder={t("khsx.col_stage")} value={congDoan} onChange={(e) => setCongDoan(e.target.value)} />
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={ca === "" ? "default" : "outline"} onClick={() => setCa("")}>
              {t("khsx.shift_all")}
            </Button>
            <Button type="button" size="sm" variant={ca === "CN" ? "default" : "outline"} onClick={() => setCa("CN")}>
              {t("khsx.shift_cn")}
            </Button>
            <Button type="button" size="sm" variant={ca === "CD" ? "default" : "outline"} onClick={() => setCa("CD")}>
              {t("khsx.shift_cd")}
            </Button>
          </div>
          <div className="sm:col-span-2">
            <Button
              type="button"
              onClick={() => {
                setPage(1);
                load(1);
              }}
              disabled={tai}
            >
              {tai ? t("khsx.loading") : t("khsx.apply_filter")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("khsx.page_stat", { page: String(page), pages: String(totalPages), total: String(totalRows) })}</span>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={tai || page <= 1} onClick={() => load(page - 1)}>
                {t("khsx.prev_page")}
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={tai || page >= totalPages} onClick={() => load(page + 1)}>
                {t("khsx.next_page")}
              </Button>
            </div>
          </div>
          <div className="rounded-md border border-border">
            <table className="w-full text-xs" aria-label={t("khsx.dashboard_title")}>
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="p-2">{t("khsx.dash_th_region")}</th>
                  <th className="p-2">{t("khsx.dash_th_line")}</th>
                  <th className="p-2">{t("khsx.dash_th_basic_model")}</th>
                  <th className="p-2">{t("khsx.dash_th_model_desc")}</th>
                  <th className="p-2">{t("khsx.dash_th_model_code")}</th>
                  <th className="p-2">{t("khsx.dash_th_type")}</th>
                  <th className="p-2">{t("khsx.dash_th_po_type")}</th>
                  <th className="p-2">{t("khsx.dash_th_master_date")}</th>
                  <th className="p-2 text-right">{t("khsx.dash_th_qty")}</th>
                  <th className="p-2">{t("khsx.dash_th_shift")}</th>
                  <th className="p-2">{t("khsx.dash_th_status")}</th>
                  <th className="p-2 text-right">{t("khsx.dash_th_total")}</th>
                  <th className="p-2">{t("khsx.dash_th_action")}</th>
                </tr>
              </thead>
              <tbody>
                {plansSorted.map((p) => {
                  const empty = t("khsx.cell_empty");
                  const cdRaw = (p.CongDoan || "CHUNG").trim();
                  const cdShow = cdRaw.toUpperCase() === "CHUNG" ? t("khsx.cong_doan_chung") : cdRaw || t("khsx.cong_doan_chung");
                  return (
                  <tr key={p.MaKeHoach} className="border-b border-border/70">
                    <td className="p-2">{cdShow}</td>
                    <td className="p-2 font-medium">{p.LineSanXuat}</td>
                    <td className="p-2">{p.BasicModel ?? p.Model ?? empty}</td>
                    <td className="p-2 max-w-[10rem] truncate" title={p.ModelDesc ?? undefined}>
                      {p.ModelDesc ?? empty}
                    </td>
                    <td className="p-2 font-mono">{p.MaAssy || empty}</td>
                    <td className="p-2">{p.NhomVatTuYeuCau || empty}</td>
                    <td className="p-2">{p.PoType ?? empty}</td>
                    <td className="p-2 tabular-nums">{fmtNgayKhsx(p.NgaySanXuat, empty)}</td>
                    <td className="p-2 text-right tabular-nums">{p.SoLuongKeHoach}</td>
                    <td className="p-2">{p.CaSanXuat}</td>
                    <td className="p-2">{t(`khsx.status_${p.TrangThai.toLowerCase()}`)}</td>
                    <td className="p-2 text-right tabular-nums">
                      {lineQtyByLine[p.LineSanXuat] != null ? lineQtyByLine[p.LineSanXuat].toLocaleString() : empty}
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        <Button type="button" size="sm" variant="secondary" onClick={() => duTru(p.MaKeHoach)}>
                          {t("khsx.btn_mrp")}
                        </Button>
                        {ALL_STATUS.map((s) => {
                          const tat = p.TrangThai === s || !khsxCoTheChuyenSang(p.TrangThai, s);
                          return (
                            <Button
                              key={s}
                              type="button"
                              size="sm"
                              variant={p.TrangThai === s ? "default" : "outline"}
                              disabled={tat}
                              title={tat && p.TrangThai !== s ? t("khsx.status_flow_hint") : undefined}
                              onClick={() => doiTrangThai(p.MaKeHoach, p.TrangThai, s)}
                            >
                              {t(`khsx.status_${s.toLowerCase()}`)}
                            </Button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {!tai && plansSorted.length === 0 ? (
                  <tr>
                    <td className="p-3 text-muted-foreground" colSpan={13}>
                      {t("khsx.empty")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {mrp ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("khsx.mrp_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mrp.warningCode === "NO_BOM" ? (
              <p className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200">
                {t("khsx.mrp_no_bom")}
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {t("khsx.mrp_summary", { total: String(mrp.summary.tongDong), ok: String(mrp.summary.dongDu), miss: String(mrp.summary.dongThieu) })}
            </p>
            <div className="rounded-md border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left">
                    <th className="p-2">{t("khsx.col_code")}</th>
                    <th className="p-2 text-right">{t("khsx.col_need")}</th>
                    <th className="p-2 text-right">{t("khsx.col_stock")}</th>
                    <th className="p-2 text-right">{t("khsx.col_short")}</th>
                  </tr>
                </thead>
                <tbody>
                  {mrp.pickList.map((r) => (
                    <tr key={r.maLinhKien} className={`border-b border-border/70 ${r.thieu > 0 ? "bg-destructive/10" : ""}`}>
                      <td className="p-2 font-mono">{r.maLinhKien}</td>
                      <td className="p-2 text-right tabular-nums">{r.can}</td>
                      <td className="p-2 text-right tabular-nums">{r.ton}</td>
                      <td className="p-2 text-right tabular-nums">{r.thieu}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
