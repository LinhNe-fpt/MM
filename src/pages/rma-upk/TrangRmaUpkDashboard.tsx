import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package, Truck, AlertCircle, Shield } from "lucide-react";
import { rmaUpkGet, type RmaUpkMe, type RmaUpkTransferPending } from "@/lib/rmaUpkApi";
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
  const [loi, setLoi] = useState("");
  const [tai, setTai] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setTai(true);
      setLoi("");
      try {
        const [m, p, tong] = await Promise.all([
          rmaUpkGet<RmaUpkMe>("/api/rma-upk/me"),
          rmaUpkGet<RmaUpkTransferPending[]>("/api/rma-upk/transfers/pending"),
          rmaUpkGet<{ UPK: number; RMA: number }>("/api/rma-upk/stock-summary"),
        ]);
        if (!cancel) {
          setMe(m);
          setPending(p);
          setTongTon({
            UPK: Number(tong?.UPK) || 0,
            RMA: Number(tong?.RMA) || 0,
          });
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
  }, [t]);

  if (tai) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const pendingLoc = pending.filter((p) => p.MaKhoNguon === maKho || p.MaKhoDich === maKho);

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
              <span className="font-medium">{me.isAdmin ? t("rmaUpk.dash_write_both_admin") : me.khoGhi ?? "—"}</span>
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
    </div>
  );
}
