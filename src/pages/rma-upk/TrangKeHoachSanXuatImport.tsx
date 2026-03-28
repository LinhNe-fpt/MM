import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { rmaUpkPost, rmaUpkPostFormData, type KhsxPreviewResult, type KhsxZone } from "@/lib/rmaUpkApi";
import { toast } from "sonner";

function zoneFromPath(pathname: string): KhsxZone {
  if (pathname.startsWith("/upk")) return "UPK";
  if (pathname.startsWith("/rma")) return "RMA";
  return "MM";
}

export default function TrangKeHoachSanXuatImport() {
  const { t } = useI18n();
  const location = useLocation();
  const maKhu = useMemo(() => zoneFromPath(location.pathname), [location.pathname]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<KhsxPreviewResult | null>(null);
  const [dangPreview, setDangPreview] = useState(false);
  const [dangCommit, setDangCommit] = useState(false);
  const [keoTha, setKeoTha] = useState(false);

  async function xemTruoc() {
    if (!file) {
      toast.error(t("khsx.pick_file"));
      return;
    }
    setDangPreview(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("maKhu", maKhu);
      const rs = await rmaUpkPostFormData<KhsxPreviewResult>("/api/khsx/import/preview", fd);
      setPreview(rs);
      toast.success(t("khsx.preview_ok", { count: String(rs.summary.totalRows) }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("rmaUpk.error_generic"));
    } finally {
      setDangPreview(false);
    }
  }

  function onDropFile(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setKeoTha(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }

  async function luuHeThong() {
    if (!preview) return;
    const rowErrorKeys = new Set(preview.errors.map((e) => `${e.sheetName}|${e.rowNo}`));
    const validRows = preview.rows.filter((r) => !rowErrorKeys.has(`${r.sheetName}|${r.rowNo}`));
    if (validRows.length === 0) {
      toast.error(t("khsx.no_valid_rows"));
      return;
    }
    setDangCommit(true);
    try {
      await rmaUpkPost("/api/khsx/import/commit", {
        maKhu,
        fileName: preview.summary.fileName,
        rows: validRows,
      });
      if (preview.errors.length > 0) {
        toast.success(t("khsx.commit_partial_ok", { count: String(validRows.length) }));
      } else {
        toast.success(t("khsx.commit_ok"));
      }
      setPreview(null);
      setFile(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("rmaUpk.error_generic"));
    } finally {
      setDangCommit(false);
    }
  }

  const errByRow = useMemo(() => {
    const m = new Map<string, string>();
    (preview?.errors || []).forEach((e) => {
      const k = `${e.sheetName}|${e.rowNo}`;
      if (!m.has(k)) m.set(k, e.message);
    });
    return m;
  }, [preview]);

  const cellEmpty = t("khsx.cell_empty");

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold">{t("khsx.import_title")}</h1>
        <p className="text-sm text-muted-foreground">{t("khsx.import_subtitle", { zone: maKhu })}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("khsx.upload_card")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${keoTha ? "border-primary bg-primary/5" : "border-primary/30 bg-muted/20"}`}
            onDragOver={(e) => {
              e.preventDefault();
              setKeoTha(true);
            }}
            onDragLeave={() => setKeoTha(false)}
            onDrop={onDropFile}
          >
            <p className="text-sm font-medium">{t("khsx.dropzone_text")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("khsx.dropzone_hint")}</p>
            <div className="mt-3">
              <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            {file ? <p className="mt-2 text-xs text-muted-foreground">{file.name}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={xemTruoc} disabled={dangPreview}>
              {dangPreview ? t("khsx.previewing") : t("khsx.preview_btn")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={luuHeThong}
              disabled={dangCommit || !preview || preview.summary.validRows <= 0}
            >
              {dangCommit ? t("khsx.committing") : t("khsx.commit_btn")}
            </Button>
          </div>
          {preview ? (
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>
                {t("khsx.preview_stats", {
                  total: String(preview.summary.totalRows),
                  valid: String(preview.summary.validRows),
                  invalid: String(preview.summary.invalidRows),
                })}
              </p>
              {preview.summary.sheetNamesAll &&
              preview.summary.sheetNamesAll.length > preview.summary.sheetNames.length ? (
                <p className="text-amber-800 dark:text-amber-200/90">
                  {t("khsx.preview_only_last_sheets", {
                    count: String(preview.summary.sheetNames.length),
                    names: preview.summary.sheetNames.join(", "),
                    total: String(preview.summary.sheetNamesAll.length),
                  })}
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("khsx.preview_table")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[56vh] rounded-md border border-border">
              <table className="w-full text-xs" aria-label={t("khsx.preview_table")}>
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left">
                    <th className="p-2">{t("khsx.col_sheet")}</th>
                    <th className="p-2">{t("khsx.col_date")}</th>
                    <th className="p-2">{t("khsx.col_shift")}</th>
                    <th className="p-2">{t("khsx.col_line")}</th>
                    <th className="p-2">{t("khsx.col_stage")}</th>
                    <th className="p-2">{t("khsx.col_basic_model")}</th>
                    <th className="p-2">{t("khsx.col_model_desc")}</th>
                    <th className="p-2">{t("khsx.col_assy")}</th>
                    <th className="p-2">{t("khsx.col_type")}</th>
                    <th className="p-2">{t("khsx.col_po_type")}</th>
                    <th className="p-2 text-right">{t("khsx.col_qty")}</th>
                    <th className="p-2">{t("khsx.col_status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => {
                    const err = errByRow.get(`${r.sheetName}|${r.rowNo}`);
                    const cdRaw = (r.congDoan || "").trim();
                    const cdShow =
                      !cdRaw ? cellEmpty : cdRaw.toUpperCase() === "CHUNG" ? t("khsx.cong_doan_chung") : cdRaw;
                    return (
                      <tr key={`${r.sheetName}-${r.rowNo}`} className={`border-b border-border/70 ${err ? "bg-destructive/10" : ""}`}>
                        <td className="p-2">{r.sheetName}#{r.rowNo}</td>
                        <td className="p-2">{r.ngaySanXuat || cellEmpty}</td>
                        <td className="p-2">{r.caSanXuat || cellEmpty}</td>
                        <td className="p-2">{r.lineSanXuat || cellEmpty}</td>
                        <td className="p-2">{cdShow}</td>
                        <td className="p-2">{r.basicModel ?? r.model ?? cellEmpty}</td>
                        <td className="p-2 max-w-[8rem] truncate" title={r.modelDesc ?? undefined}>
                          {r.modelDesc ?? cellEmpty}
                        </td>
                        <td className="p-2 font-mono">{r.maAssy || cellEmpty}</td>
                        <td className="p-2">{r.nhomVatTu || cellEmpty}</td>
                        <td className="p-2">{r.poType ?? cellEmpty}</td>
                        <td className="p-2 text-right tabular-nums">{r.soLuongKeHoach ?? cellEmpty}</td>
                        <td className="p-2">{err || t("khsx.valid")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
