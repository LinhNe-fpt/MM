import { useCallback, useEffect, useState } from "react";
import { rmaUpkGet, rmaUpkPost, type RmaUpkMe, type RmaUpkTransferPending } from "@/lib/rmaUpkApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { useKhoPhu } from "@/contexts/NguCanhKhoPhu";
import { usePhanTrang } from "@/lib/usePhanTrang";
import { PhanTrang } from "@/components/ui/PhanTrang";

export default function TrangRmaUpkChuyenKho() {
  const { t, ngonNgu } = useI18n();
  const { scope } = useKhoPhu();
  const maKho: "UPK" | "RMA" = scope;
  const maKhoKia: "UPK" | "RMA" = scope === "UPK" ? "RMA" : "UPK";
  const [me, setMe] = useState<RmaUpkMe | null>(null);
  const [pending, setPending] = useState<RmaUpkTransferPending[]>([]);
  const [tai, setTai] = useState(true);
  const [dong, setDong] = useState<{ ma: string; sl: string }[]>([{ ma: "", sl: "" }]);
  const [ghiChu, setGhiChu] = useState("");

  const load = useCallback(async () => {
    setTai(true);
    try {
      const [m, p] = await Promise.all([
        rmaUpkGet<RmaUpkMe>("/api/rma-upk/me"),
        rmaUpkGet<RmaUpkTransferPending[]>("/api/rma-upk/transfers/pending"),
      ]);
      setMe(m);
      setPending(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("rmaUpk.error_load"));
    } finally {
      setTai(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const capGhiHaiKho = !!(me?.ghiHaiKhoMm ?? me?.isAdmin);
  const laBenNhan = (phieu: RmaUpkTransferPending) =>
    capGhiHaiKho || me?.khoGhi === phieu.MaKhoDich;

  async function xacNhan(id: number) {
    try {
      await rmaUpkPost(`/api/rma-upk/transfers/${id}/confirm`);
      toast.success(t("rmaUpk.toast_tr_confirm_ok"));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("rmaUpk.error_generic"));
    }
  }

  async function taoChuyen() {
    const lines = dong
      .map((r) => ({ maLinhKien: r.ma.trim(), soLuong: parseInt(r.sl, 10) }))
      .filter((r) => r.maLinhKien && Number.isFinite(r.soLuong) && r.soLuong > 0);
    if (lines.length === 0) {
      toast.error(t("rmaUpk.toast_tr_need_line"));
      return;
    }
    try {
      const body: Record<string, unknown> = { lines, ghiChu: ghiChu.trim() || undefined };
      if (me?.ghiHaiKhoMm ?? me?.isAdmin) {
        body.maKhoNguon = maKho;
        body.maKhoDich = maKhoKia;
      }
      await rmaUpkPost("/api/rma-upk/transfers", body);
      toast.success(t("rmaUpk.toast_tr_created"));
      setDong([{ ma: "", sl: "" }]);
      setGhiChu("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("rmaUpk.error_generic"));
    }
  }

  const localeDate = ngonNgu === "ko" ? "ko-KR" : "vi-VN";
  const pendingLoc = pending.filter((p) => p.MaKhoNguon === maKho || p.MaKhoDich === maKho);
  const pgPending = usePhanTrang(pendingLoc);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold">{t("rmaUpk.tr_title")}</h1>
        <p className="text-sm text-muted-foreground">{t("rmaUpk.tr_subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("rmaUpk.tr_pending_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {tai ? (
            <p className="text-sm text-muted-foreground">{t("rmaUpk.tr_loading")}</p>
          ) : pendingLoc.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("rmaUpk.tr_no_pending")}</p>
          ) : (
            <div className="flex flex-col gap-0">
              <ul className="space-y-4">
                {pgPending.slice.map((phieu) => (
                  <li key={phieu.MaChuyen} className="rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          #{phieu.MaChuyen}: {phieu.MaKhoNguon} → {phieu.MaKhoDich}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("rmaUpk.tr_created_by")} {phieu.TenNguoiTao || phieu.TaiKhoanNguoiTao || "—"} ·{" "}
                          {new Date(phieu.NgayTao).toLocaleString(localeDate)}
                        </p>
                        {phieu.GhiChu ? <p className="mt-1 text-xs">{phieu.GhiChu}</p> : null}
                      </div>
                      {laBenNhan(phieu) ? (
                        <Button size="sm" onClick={() => xacNhan(phieu.MaChuyen)}>
                          {t("rmaUpk.tr_confirm_btn")}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t("rmaUpk.tr_wait_dest")}</span>
                      )}
                    </div>
                    <ul className="mt-2 font-mono text-xs">
                      {phieu.chiTiet.map((c) => (
                        <li key={c.MaLinhKien}>
                          {c.MaLinhKien} × {c.SoLuong}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              <PhanTrang
                trangHienTai={pgPending.page}
                tongSoTrang={pgPending.totalPages}
                tongSoMuc={pendingLoc.length}
                onChuyenTrang={pgPending.setPage}
                nhanTomTat={t("comp.pagination_items")}
                className="mt-4 rounded-lg border border-border"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {(me?.ghiHaiKhoMm ?? me?.isAdmin) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("rmaUpk.tr_admin_card")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("khoPhu.tr_admin_route", {
                tu: maKho === "UPK" ? t("rmaUpk.kho_upk") : t("rmaUpk.kho_rma"),
                den: maKhoKia === "UPK" ? t("rmaUpk.kho_upk") : t("rmaUpk.kho_rma"),
              })}
            </p>
            <div className="space-y-2">
              <Label>{t("rmaUpk.tr_note_opt")}</Label>
              <Input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder={t("rmaUpk.tr_note_ph")} />
            </div>
            {dong.map((r, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <Input
                  className="min-w-[160px] flex-1 font-mono"
                  placeholder={t("rmaUpk.tr_code_ph")}
                  value={r.ma}
                  onChange={(e) => {
                    const n = [...dong];
                    n[i] = { ...n[i], ma: e.target.value };
                    setDong(n);
                  }}
                />
                <Input
                  className="w-24 font-mono"
                  type="number"
                  min={1}
                  placeholder={t("rmaUpk.tr_qty_ph")}
                  value={r.sl}
                  onChange={(e) => {
                    const n = [...dong];
                    n[i] = { ...n[i], sl: e.target.value };
                    setDong(n);
                  }}
                />
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDong([...dong, { ma: "", sl: "" }])}>
                {t("rmaUpk.tr_add_row")}
              </Button>
              <Button type="button" onClick={taoChuyen}>
                {t("rmaUpk.tr_save_slip")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {me && !(me.ghiHaiKhoMm ?? me.isAdmin) && me.khoGhi && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("rmaUpk.tr_user_card", { kho: me.khoGhi })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("rmaUpk.tr_auto_dest")} <strong>{me.khoGhi === "UPK" ? t("rmaUpk.kho_rma") : t("rmaUpk.kho_upk")}</strong>
            </p>
            <div className="space-y-2">
              <Label>{t("rmaUpk.tr_note_opt")}</Label>
              <Input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder={t("rmaUpk.tr_note_ph")} />
            </div>
            {dong.map((r, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <Input
                  className="min-w-[160px] flex-1 font-mono"
                  placeholder={t("rmaUpk.tr_code_ph")}
                  value={r.ma}
                  onChange={(e) => {
                    const n = [...dong];
                    n[i] = { ...n[i], ma: e.target.value };
                    setDong(n);
                  }}
                />
                <Input
                  className="w-24 font-mono"
                  type="number"
                  min={1}
                  placeholder={t("rmaUpk.tr_qty_ph")}
                  value={r.sl}
                  onChange={(e) => {
                    const n = [...dong];
                    n[i] = { ...n[i], sl: e.target.value };
                    setDong(n);
                  }}
                />
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDong([...dong, { ma: "", sl: "" }])}>
                {t("rmaUpk.tr_add_row")}
              </Button>
              <Button type="button" onClick={taoChuyen}>
                {t("rmaUpk.tr_save_slip")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
