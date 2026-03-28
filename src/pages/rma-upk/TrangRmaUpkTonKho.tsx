import { useCallback, useEffect, useState } from "react";
import {
  rmaUpkGet,
  rmaUpkPost,
  rmaUpkPostFormData,
  type RmaUpkImportBaocaoResult,
  type RmaUpkMe,
  type RmaUpkTonRow,
} from "@/lib/rmaUpkApi";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { useKhoPhu } from "@/contexts/NguCanhKhoPhu";
import { usePhanTrang } from "@/lib/usePhanTrang";
import { PhanTrang } from "@/components/ui/PhanTrang";

export default function TrangRmaUpkTonKho() {
  const { t } = useI18n();
  const { scope } = useKhoPhu();
  const tab: "UPK" | "RMA" = scope;
  const [me, setMe] = useState<RmaUpkMe | null>(null);
  const [rows, setRows] = useState<RmaUpkTonRow[]>([]);
  const [tai, setTai] = useState(true);
  const [sua, setSua] = useState<{ ma: string; kho: "UPK" | "RMA"; ton: number } | null>(null);
  const [deltaStr, setDeltaStr] = useState("");
  const [fileBaoCaoUpk, setFileBaoCaoUpk] = useState<File | null>(null);
  const [fileBaoCaoRma, setFileBaoCaoRma] = useState<File | null>(null);
  const [dangImportUpk, setDangImportUpk] = useState(false);
  const [dangImportRma, setDangImportRma] = useState(false);
  const [dangPreviewRma, setDangPreviewRma] = useState(false);
  const [ketQuaImportRma, setKetQuaImportRma] = useState<RmaUpkImportBaocaoResult | null>(null);

  const load = useCallback(async () => {
    setTai(true);
    try {
      const [m, s] = await Promise.all([
        rmaUpkGet<RmaUpkMe>("/api/rma-upk/me"),
        rmaUpkGet<unknown>(`/api/rma-upk/stock?kho=${tab}`),
      ]);
      setMe(m);
      setRows(Array.isArray(s) ? (s as RmaUpkTonRow[]) : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("rmaUpk.toast_load_stock_fail"));
    } finally {
      setTai(false);
    }
  }, [tab, t]);

  useEffect(() => {
    load();
  }, [load]);

  const { page, setPage, resetPage, totalPages, slice: dongTrang } = usePhanTrang(rows);
  useEffect(() => {
    resetPage();
  }, [scope, resetPage]);

  const coTheSuaKho = (k: "UPK" | "RMA") => (me?.isAdmin ? true : me?.khoGhi === k);

  async function importBaoCaoUpk() {
    if (!fileBaoCaoUpk) {
      toast.error(t("rmaUpk.toast_pick_upk_file"));
      return;
    }
    setDangImportUpk(true);
    try {
      const fd = new FormData();
      fd.append("file", fileBaoCaoUpk);
      const r = await rmaUpkPostFormData<RmaUpkImportBaocaoResult>("/api/rma-upk/import-baocao", fd);
      toast.success(
        t("rmaUpk.toast_import_upk_ok", {
          count: String(r.maCount),
          sheets: r.sheetsUsed.join(", "),
        }),
      );
      setFileBaoCaoUpk(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("rmaUpk.error_import"));
    } finally {
      setDangImportUpk(false);
    }
  }

  async function xemTruocBaoCaoRma() {
    if (!fileBaoCaoRma) {
      toast.error(t("rmaUpk.toast_pick_rma_file"));
      return;
    }
    setDangPreviewRma(true);
    try {
      const fd = new FormData();
      fd.append("file", fileBaoCaoRma);
      fd.append("dryRun", "1");
      const r = await rmaUpkPostFormData<RmaUpkImportBaocaoResult>("/api/rma-upk/import-baocao-rma", fd);
      setKetQuaImportRma(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("rmaUpk.error_import"));
    } finally {
      setDangPreviewRma(false);
    }
  }

  async function importBaoCaoRma() {
    if (!fileBaoCaoRma) {
      toast.error(t("rmaUpk.toast_pick_rma_file"));
      return;
    }
    setDangImportRma(true);
    try {
      const fd = new FormData();
      fd.append("file", fileBaoCaoRma);
      const r = await rmaUpkPostFormData<RmaUpkImportBaocaoResult>("/api/rma-upk/import-baocao-rma", fd);
      toast.success(
        t("rmaUpk.toast_import_rma_ok", {
          count: String(r.maCount),
          sheets: r.sheetsUsed.join(", "),
        }),
      );
      setKetQuaImportRma(r);
      setFileBaoCaoRma(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("rmaUpk.error_import"));
    } finally {
      setDangImportRma(false);
    }
  }

  async function luuDieuChinh() {
    if (!sua) return;
    const d = parseInt(deltaStr, 10);
    if (!Number.isFinite(d) || d === 0) {
      toast.error(t("rmaUpk.toast_delta_invalid"));
      return;
    }
    try {
      await rmaUpkPost("/api/rma-upk/adjust", {
        maKho: sua.kho,
        maLinhKien: sua.ma,
        delta: d,
      });
      toast.success(t("rmaUpk.toast_adjust_ok"));
      setSua(null);
      setDeltaStr("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("rmaUpk.error_generic"));
    }
  }

  const tieuDe = scope === "UPK" ? t("khoPhu.stock_title_upk") : t("khoPhu.stock_title_rma");

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-bold">{tieuDe}</h1>
        <p className="text-sm text-muted-foreground">{t("khoPhu.stock_subtitle_scope")}</p>
      </div>

      {scope === "UPK" && me?.coTheGhiUPK && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/20 p-4">
          <div className="min-w-[200px] flex-1 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{t("rmaUpk.stock_import_excel")}</p>
            <p className="text-xs text-muted-foreground">{t("rmaUpk.stock_import_upk_help")}</p>
            <Input
              type="file"
              accept=".xlsx,.xls"
              className="cursor-pointer text-sm"
              onChange={(e) => setFileBaoCaoUpk(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button
            type="button"
            disabled={dangImportUpk || dangImportRma || !fileBaoCaoUpk}
            onClick={importBaoCaoUpk}
          >
            {dangImportUpk ? t("rmaUpk.importing") : t("rmaUpk.stock_import_btn_upk")}
          </Button>
        </div>
      )}

      {scope === "RMA" && me?.coTheGhiRMA && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/20 p-4">
          <div className="min-w-[200px] flex-1 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{t("rmaUpk.stock_import_rma_title")}</p>
            <p className="text-xs text-muted-foreground">{t("rmaUpk.stock_import_rma_help")}</p>
            <Input
              type="file"
              accept=".xlsx,.xls"
              className="cursor-pointer text-sm"
              onChange={(e) => {
                setFileBaoCaoRma(e.target.files?.[0] ?? null);
                setKetQuaImportRma(null);
              }}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={dangImportUpk || dangImportRma || dangPreviewRma || !fileBaoCaoRma}
            onClick={xemTruocBaoCaoRma}
          >
            {dangPreviewRma ? t("rmaUpk.importing") : t("rmaUpk.btn_preview_rma")}
          </Button>
          <Button
            type="button"
            disabled={dangImportUpk || dangImportRma || dangPreviewRma || !fileBaoCaoRma}
            onClick={importBaoCaoRma}
          >
            {dangImportRma ? t("rmaUpk.importing") : t("rmaUpk.stock_import_btn_rma")}
          </Button>
        </div>
      )}

      {scope === "RMA" && ketQuaImportRma?.previewRows && ketQuaImportRma.previewRows.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">{t("rmaUpk.import_preview_title")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("rmaUpk.import_preview_sheets")}: {ketQuaImportRma.sheetsUsed.join(", ")} ·{" "}
              {t("rmaUpk.import_preview_count", { count: String(ketQuaImportRma.maCount) })}
            </p>
          </div>
          {ketQuaImportRma.dryRun ? (
            <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">{t("rmaUpk.import_preview_dry")}</p>
          ) : null}
          <ScrollArea className="h-[min(60vh,480px)] rounded-md border border-border">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="sticky top-0 bg-muted/50 p-2 font-medium">#</th>
                  <th className="sticky top-0 bg-muted/50 p-2 font-medium">{t("rmaUpk.stock_col_code")}</th>
                  <th className="sticky top-0 bg-muted/50 p-2 font-medium">{t("rmaUpk.col_model")}</th>
                  <th className="sticky top-0 bg-muted/50 p-2 font-medium">{t("rmaUpk.col_desc")}</th>
                  <th className="sticky top-0 bg-muted/50 p-2 font-medium">{t("rmaUpk.col_loc")}</th>
                  <th className="sticky top-0 bg-muted/50 p-2 text-right font-medium">{t("rmaUpk.stock_col_qty")}</th>
                </tr>
              </thead>
              <tbody>
                {ketQuaImportRma.previewRows.map((row, idx) => (
                  <tr key={`${row.code}-${idx}`} className="border-b border-border/60">
                    <td className="p-2 tabular-nums text-muted-foreground">{idx + 1}</td>
                    <td className="p-2 font-mono">{row.code}</td>
                    <td className="p-2">{row.model ?? "—"}</td>
                    <td className="max-w-[220px] p-2 break-words">{row.moTa ?? "—"}</td>
                    <td className="p-2 font-mono text-[11px]">{row.viTri ?? "—"}</td>
                    <td className="p-2 text-right tabular-nums">{row.soLuongTon}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </div>
      )}

      <div className="flex flex-col overflow-hidden rounded-lg border border-border">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="p-3 font-medium">{t("rmaUpk.stock_col_code")}</th>
              <th className="p-3 font-medium">{t("rmaUpk.stock_col_wh")}</th>
              <th className="p-3 font-medium text-right">{t("rmaUpk.stock_col_qty")}</th>
              <th className="p-3 w-28" />
            </tr>
          </thead>
          <tbody>
            {tai ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                  {t("rmaUpk.stock_loading")}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                  {t("rmaUpk.stock_empty")}
                </td>
              </tr>
            ) : (
              dongTrang.map((r) => {
                const ma = String(r?.MaLinhKien ?? "");
                const kho = String(r?.MaKho ?? "").toUpperCase();
                const ton = Number(r?.SoLuongTon ?? 0);
                const khoHopLe = kho === "UPK" || kho === "RMA";
                return (
                  <tr key={`${kho}-${ma}`} className="border-b border-border/80">
                    <td className="p-3 font-mono text-xs">{ma}</td>
                    <td className="p-3">{kho || "—"}</td>
                    <td className="p-3 text-right tabular-nums">{Number.isFinite(ton) ? ton : 0}</td>
                    <td className="p-3">
                      {khoHopLe && coTheSuaKho(kho) ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSua({ ma, kho, ton: Number.isFinite(ton) ? ton : 0 });
                            setDeltaStr("");
                          }}
                        >
                          {t("rmaUpk.stock_adjust")}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t("rmaUpk.stock_readonly")}</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
        {!tai && rows.length > 0 ? (
          <PhanTrang
            trangHienTai={page}
            tongSoTrang={totalPages}
            tongSoMuc={rows.length}
            onChuyenTrang={setPage}
            nhanTomTat={t("comp.pagination_rows")}
          />
        ) : null}
      </div>

      <Dialog open={!!sua} onOpenChange={(o) => !o && setSua(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rmaUpk.stock_dialog_title")}</DialogTitle>
          </DialogHeader>
          {sua && (
            <div className="space-y-3 text-sm">
              <p>
                {t("rmaUpk.stock_dialog_line", {
                  ma: sua.ma,
                  kho: sua.kho,
                  ton: String(sua.ton),
                })}
              </p>
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t("rmaUpk.stock_delta_label")}</label>
                <Input
                  className="mt-1 font-mono"
                  placeholder={t("rmaUpk.stock_delta_ph")}
                  value={deltaStr}
                  onChange={(e) => setDeltaStr(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSua(null)}>
              {t("rmaUpk.stock_cancel")}
            </Button>
            <Button onClick={luuDieuChinh}>{t("rmaUpk.stock_save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
