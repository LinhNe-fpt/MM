import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Package, Truck, AlertCircle, Shield, PieChart as BieuDoTronIcon } from "lucide-react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  rmaUpkGet,
  type RmaUpkMe,
  type RmaUpkStockSkuCounts,
  type RmaUpkTransferPending,
} from "@/lib/rmaUpkApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { useKhoPhu } from "@/contexts/NguCanhKhoPhu";

export default function TrangRmaUpkDashboard() {
  const { t } = useI18n();
  const { scope, basePath } = useKhoPhu();
  const maKho: "UPK" | "RMA" = scope;
  const [me, setMe] = useState<RmaUpkMe | null>(null);
  const [pending, setPending] = useState<RmaUpkTransferPending[]>([]);
  const [tongTon, setTongTon] = useState<{ UPK: number; RMA: number }>({ UPK: 0, RMA: 0 });
  const [demMa, setDemMa] = useState<RmaUpkStockSkuCounts | null>(null);
  const [loi, setLoi] = useState("");
  const [tai, setTai] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setTai(true);
      setLoi("");
      try {
        const [m, p, tong, dem] = await Promise.all([
          rmaUpkGet<RmaUpkMe>("/api/rma-upk/me"),
          rmaUpkGet<RmaUpkTransferPending[]>("/api/rma-upk/transfers/pending"),
          rmaUpkGet<{ UPK: number; RMA: number }>("/api/rma-upk/stock-summary"),
          rmaUpkGet<RmaUpkStockSkuCounts>(`/api/rma-upk/stock-sku-counts?kho=${encodeURIComponent(maKho)}`),
        ]);
        if (!cancel) {
          setMe(m);
          setPending(p);
          setTongTon({
            UPK: Number(tong?.UPK) || 0,
            RMA: Number(tong?.RMA) || 0,
          });
          setDemMa(dem);
        }
      } catch (e) {
        if (!cancel) setLoi(e instanceof Error ? e.message : t("rmaUpk.error_load"));
      } finally {
        if (!cancel) setTai(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [t, maKho]);

  const pendingLoc = useMemo(
    () => pending.filter((p) => p.MaKhoNguon === maKho || p.MaKhoDich === maKho),
    [pending, maKho],
  );

  const duLieuBieuDo = useMemo(() => {
    const co = demMa?.coTon ?? 0;
    const het = demMa?.hetHang ?? 0;
    return [
      { key: "in", name: t("rmaUpk.dash_chart_in"), value: co, fill: "var(--dash-stock-in, #22c55e)" },
      { key: "out", name: t("rmaUpk.dash_chart_out"), value: het, fill: "var(--dash-stock-out, #94a3b8)" },
    ];
  }, [demMa, t]);

  const tongMa = (demMa?.coTon ?? 0) + (demMa?.hetHang ?? 0);

  if (tai) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (loi) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">{loi}</p>
            <p className="mt-1 text-muted-foreground">{t("rmaUpk.dash_error_hint")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {scope === "UPK" ? t("khoPhu.dash_title_upk") : t("khoPhu.dash_title_rma")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("khoPhu.dash_subtitle_scope")}</p>
      </div>

      {me && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" />
              {t("rmaUpk.dash_card_session")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">{t("rmaUpk.dash_account")}</span>{" "}
              <span className="font-medium">{me.taiKhoan}</span>
              {me.hoTen ? ` — ${me.hoTen}` : ""}
            </div>
            <div>
              <span className="text-muted-foreground">{t("rmaUpk.dash_role")}</span>{" "}
              <span className="font-medium uppercase">{me.quyen}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t("rmaUpk.dash_write_wh")}</span>{" "}
              <span className="font-medium">
                {me.ghiHaiKhoMm ?? me.isAdmin
                  ? me.isAdmin
                    ? t("rmaUpk.dash_write_both_admin")
                    : t("rmaUpk.dash_write_both_mm_staff")
                  : me.khoGhi ?? "—"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">{t("rmaUpk.dash_read_stock")}</span>{" "}
              <span className="font-medium">{t("rmaUpk.dash_read_both")}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className={pendingLoc.length > 0 ? "border-status-critical/40 bg-status-critical/5" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="h-4 w-4" />
              {t("rmaUpk.dash_card_pending")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-bold tabular-nums">{pendingLoc.length}</p>
            <p className="text-xs text-muted-foreground">{t("khoPhu.dash_pending_scope", { kho: maKho })}</p>
            <Button asChild size="sm" variant={pendingLoc.length > 0 ? "default" : "outline"}>
              <Link to={`${basePath}/transfers`}>{t("rmaUpk.dash_open_transfers")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" />
              {t("rmaUpk.dash_card_stock")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border bg-muted/20 p-2">
                <p className="text-[11px] text-muted-foreground">{t("rmaUpk.dash_total_upk")}</p>
                <p className="text-base font-semibold tabular-nums">{tongTon.UPK.toLocaleString()}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-2">
                <p className="text-[11px] text-muted-foreground">{t("rmaUpk.dash_total_rma")}</p>
                <p className="text-base font-semibold tabular-nums">{tongTon.RMA.toLocaleString()}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{t("khoPhu.dash_stock_scope", { kho: maKho })}</p>
            <Button asChild className="mt-3" size="sm" variant="outline">
              <Link to={`${basePath}/stock`}>{t("rmaUpk.dash_open_stock")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("rmaUpk.nav.tx")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("rmaUpk.dash_tx_desc")}</p>
            <Button asChild className="mt-3" size="sm" variant="outline">
              <Link to={`${basePath}/transactions`}>{t("rmaUpk.dash_open_tx")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BieuDoTronIcon className="h-4 w-4 text-primary" />
            {t("rmaUpk.dash_chart_title")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("rmaUpk.dash_chart_sub", { kho: maKho })}</p>
        </CardHeader>
        <CardContent>
          {tongMa === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t("rmaUpk.dash_chart_empty")}</p>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6 lg:items-center lg:justify-between">
              <div className="h-[min(280px,42vh)] w-full max-w-md mx-auto lg:mx-0 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={duLieuBieuDo}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="52%"
                      outerRadius="78%"
                      paddingAngle={2}
                    >
                      {duLieuBieuDo.map((d) => (
                        <Cell key={d.key} fill={d.fill} stroke="hsl(var(--background))" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number, _n, item) => {
                        const payload = item?.payload as { name?: string; value?: number } | undefined;
                        const v = Number(val);
                        const pct = tongMa > 0 ? ((v / tongMa) * 100).toFixed(1) : "0";
                        return [`${v.toLocaleString()} (${pct}%)`, payload?.name ?? ""];
                      }}
                    />
                    <Legend verticalAlign="bottom" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border border-border bg-muted/25 p-3">
                  <p className="text-xs text-muted-foreground">{t("rmaUpk.dash_chart_total")}</p>
                  <p className="text-2xl font-bold tabular-nums mt-1">{tongMa.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
                  <p className="text-xs text-muted-foreground">{t("rmaUpk.dash_chart_in")}</p>
                  <p className="text-2xl font-bold tabular-nums mt-1 text-emerald-700 dark:text-emerald-400">
                    {(demMa?.coTon ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-400/30 bg-slate-500/5 p-3">
                  <p className="text-xs text-muted-foreground">{t("rmaUpk.dash_chart_out")}</p>
                  <p className="text-2xl font-bold tabular-nums mt-1 text-slate-700 dark:text-slate-300">
                    {(demMa?.hetHang ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
