import { useState, useEffect, useCallback } from "react";
import { Thung } from "@/data/duLieuMau";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Package, QrCode, Clipboard, ChevronDown, ChevronUp, Plus, Pencil, Trash2, Loader2, ExternalLink } from "lucide-react";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { useNavigate } from "react-router-dom";
import { API_BASE, apiPost, apiPut, apiPatch, apiDelete } from "@/api/client";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BomRow {
  id: number;
  maAssy: string;
  stt: number | null;
  code: string | null;
  itemDescription: string | null;
  qtyPlan: number | null;
  qtyKitting: number | null;
  heSo: number | null;
  donVi: string | null;
  xuatSX: number | null;
  remark: string | null;
}

interface BomForm {
  stt: string;
  code: string;
  itemDescription: string;
  qtyPlan: string;
  qtyKitting: string;
  heSo: string;
  donVi: string;
  xuatSX: string;
  remark: string;
}

const EMPTY_BOM: BomForm = { stt: "", code: "", itemDescription: "", qtyPlan: "", qtyKitting: "", heSo: "", donVi: "", xuatSX: "", remark: "" };

function rowToForm(r: BomRow): BomForm {
  return {
    stt: r.stt != null ? String(r.stt) : "",
    code: r.code ?? "",
    itemDescription: r.itemDescription ?? "",
    qtyPlan: r.qtyPlan != null ? String(r.qtyPlan) : "",
    qtyKitting: r.qtyKitting != null ? String(r.qtyKitting) : "",
    heSo: r.heSo != null ? String(r.heSo) : "",
    donVi: r.donVi ?? "",
    xuatSX: r.xuatSX != null ? String(r.xuatSX) : "",
    remark: r.remark ?? "",
  };
}

// ─── BOM Form Dialog ──────────────────────────────────────────────────────────

function BomFormDialog({
  open,
  mode,
  initial,
  maAssy,
  editRowId,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "add" | "edit";
  initial: BomForm;
  maAssy: string;
  editRowId?: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState<BomForm>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setForm(initial); setError(null); } }, [open, initial]);
  function set(field: keyof BomForm, val: string) { setForm((f) => ({ ...f, [field]: val })); }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        maAssy,
        stt: form.stt !== "" ? parseInt(form.stt) : null,
        code: form.code.trim() || null,
        itemDescription: form.itemDescription.trim() || null,
        qtyPlan: form.qtyPlan !== "" ? Number(form.qtyPlan) : null,
        qtyKitting: form.qtyKitting !== "" ? Number(form.qtyKitting) : null,
        heSo: form.heSo !== "" ? Number(form.heSo) : null,
        donVi: form.donVi.trim() || null,
        xuatSX: form.xuatSX !== "" ? Number(form.xuatSX) : null,
        remark: form.remark.trim() || null,
      };
      if (mode === "add") await apiPost("/api/bom", body);
      else if (editRowId != null) await apiPut(`/api/bom/${editRowId}`, body);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full px-2.5 py-1.5 bg-muted border border-border rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all";
  const num = inp + " text-right tabular-nums";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? t("bom.form_title_add") : t("bom.form_title_edit")}</DialogTitle>
          <DialogDescription className="font-mono text-xs mt-0.5">{maAssy}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2.5 py-2">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("bom.col_stt")}</label>
            <input type="number" className={num} value={form.stt} onChange={(e) => set("stt", e.target.value)} placeholder="1" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("bom.col_code")}</label>
            <input className={inp} value={form.code} onChange={(e) => set("code", e.target.value)} placeholder={`${t("common.eg")} CC-001`} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("bom.col_desc")}</label>
            <input className={inp} value={form.itemDescription} onChange={(e) => set("itemDescription", e.target.value)} placeholder={t("common.ph_desc")} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("bom.col_qty_plan")}</label>
            <input type="number" min="0" step="0.01" className={num} value={form.qtyPlan} onChange={(e) => set("qtyPlan", e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("bom.col_qty_kitting")}</label>
            <input type="number" min="0" step="0.01" className={num} value={form.qtyKitting} onChange={(e) => set("qtyKitting", e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("bom.col_he_so")}</label>
            <input type="number" min="0" step="0.0001" className={num} value={form.heSo} onChange={(e) => set("heSo", e.target.value)} placeholder="0.0000" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("bom.col_don_vi")}</label>
            <input className={inp} value={form.donVi} onChange={(e) => set("donVi", e.target.value)} placeholder={t("common.ph_unit")} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("bom.col_xuat_sx")}</label>
            <input type="number" min="0" step="0.01" className={num} value={form.xuatSX} onChange={(e) => set("xuatSX", e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("bom.col_remark")}</label>
            <input className={inp} value={form.remark} onChange={(e) => set("remark", e.target.value)} placeholder={t("common.ph_notes")} />
          </div>
        </div>
        {error && <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">{error}</p>}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t("bom.form_cancel")}</Button>
          <Button onClick={handleSave} disabled={saving}>
            <span className="flex items-center gap-1.5">
              <Loader2 className={`w-3.5 h-3.5 animate-spin transition-opacity ${saving ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}`} />
              {t("bom.form_save")}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Inline BOM section per component ────────────────────────────────────────

function BomSection({ partNumber }: { partNumber: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [rows, setRows] = useState<BomRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [formInitial, setFormInitial] = useState<BomForm>(EMPTY_BOM);
  const [editRowId, setEditRowId] = useState<number | undefined>();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadBom = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/bom?assy=${encodeURIComponent(partNumber)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: BomRow[]) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [partNumber]);

  useEffect(() => { loadBom(); }, [loadBom]);

  function openAdd() { setFormInitial(EMPTY_BOM); setFormMode("add"); setEditRowId(undefined); setFormOpen(true); }
  function openEdit(r: BomRow) { setFormInitial(rowToForm(r)); setFormMode("edit"); setEditRowId(r.id); setFormOpen(true); }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try { await apiDelete(`/api/bom/${id}`); loadBom(); } catch { /* silently */ }
    finally { setDeletingId(null); }
  }

  return (
    <div className="mt-2 border-t border-border/40 pt-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("bin.bom_section")} ({rows.length})</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate(`/bom?assy=${encodeURIComponent(partNumber)}`)}
            className="flex items-center gap-1 text-[10px] text-primary hover:underline"
            title={t("bin.bom_manage")}
          >
            <ExternalLink className="w-3 h-3" />
            {t("bin.bom_manage")}
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="ml-2 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title={t("bom.add_row")}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-1.5 py-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />{t("bin.bom_loading")}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-1">{t("bin.bom_empty")}</p>
      ) : (
        <div className="space-y-1">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 bg-muted/40 hover:bg-muted/70 transition-colors group">
              <div className="min-w-0 flex-1">
                <span className="font-mono text-xs font-medium">{row.code ?? "—"}</span>
                {row.itemDescription && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground truncate">{row.itemDescription}</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {row.qtyPlan != null && (
                  <span className="text-[10px] tabular-nums text-muted-foreground">×{row.qtyPlan}</span>
                )}
                {row.donVi && (
                  <span className="text-[10px] text-muted-foreground">{row.donVi}</span>
                )}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(row.id)}
                    className="p-1 rounded hover:bg-destructive/10 text-destructive/50 hover:text-destructive transition-colors"
                    disabled={deletingId === row.id}
                  >
                    {deletingId === row.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Trash2 className="w-3 h-3" />
                    }
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <BomFormDialog
        open={formOpen}
        mode={formMode}
        initial={formInitial}
        maAssy={partNumber}
        editRowId={editRowId}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); loadBom(); }}
      />
    </div>
  );
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────

interface PropsNganChiTietThung {
  thung: Thung | null;
  mo: boolean;
  dong: () => void;
  /** Gọi sau khi lưu kiểm kê thành công để tải lại sơ đồ kho */
  sauKhiKiemKe?: () => void;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function NganChiTietThung({ thung, mo, dong, sauKhiKiemKe }: PropsNganChiTietThung) {
  const { t } = useI18n();
  const [expandedBom, setExpandedBom] = useState<Set<string>>(new Set());
  const [dialogKiemKe, setDialogKiemKe] = useState(false);
  const [formKiemKe, setFormKiemKe] = useState<Record<string, string>>({});
  const [dangInQr, setDangInQr] = useState(false);
  const [dangLuuKiemKe, setDangLuuKiemKe] = useState(false);

  // Reset expansions khi thùng thay đổi
  useEffect(() => { setExpandedBom(new Set()); }, [thung?.id]);

  useEffect(() => {
    if (!dialogKiemKe || !thung) return;
    const init: Record<string, string> = {};
    for (const lk of thung.components) {
      const te = (lk as { tonThucTe?: number | null }).tonThucTe;
      init[lk.partNumber] = te != null && !Number.isNaN(Number(te)) ? String(Math.round(Number(te))) : "";
    }
    setFormKiemKe(init);
  }, [dialogKiemKe, thung]);

  function toggleBom(partNumber: string) {
    setExpandedBom((prev) => {
      const next = new Set(prev);
      next.has(partNumber) ? next.delete(partNumber) : next.add(partNumber);
      return next;
    });
  }

  if (!thung) return null;

  const coMaViTri = thung.maViTri != null && Number.isFinite(Number(thung.maViTri));

  async function inQrThung() {
    const payload = `MM|BIN|${thung.row}|${thung.label}|${thung.maViTri ?? ""}`;
    setDangInQr(true);
    try {
      const dataUrl = await QRCode.toDataURL(payload, { width: 280, margin: 2, errorCorrectionLevel: "M" });
      const w = window.open("", "_blank", "width=440,height=560");
      if (!w) {
        toast.error(t("bin.print_error"));
        return;
      }
      const title = `${t("warehouse.rack_prefix")} ${escapeHtml(thung.row)} / ${t("bin.bin_label")} ${escapeHtml(thung.label)}`;
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(t("bin.print_title"))}</title>
<style>body{font-family:system-ui,sans-serif;text-align:center;padding:20px} h1{font-size:15px;margin:0 0 12px;font-weight:600} .sub{font-size:11px;color:#555;word-break:break-all;margin-bottom:16px}</style></head><body>
<h1>${title}</h1>
<p class="sub">${escapeHtml(payload)}</p>
<img src="${dataUrl}" width="280" height="280" alt="QR" />
</body></html>`);
      w.document.close();
      const triggerPrint = () => {
        try {
          w.focus();
          w.print();
        } catch {
          /* ignore */
        }
        w.close();
      };
      setTimeout(triggerPrint, 200);
    } catch {
      toast.error(t("bin.print_error"));
    } finally {
      setDangInQr(false);
    }
  }

  async function luuKiemKe() {
    if (!coMaViTri) {
      toast.error(t("bin.count_error_vitri"));
      return;
    }
    setDangLuuKiemKe(true);
    try {
      const updates = thung.components.map((lk) => ({
        maLinhKien: lk.partNumber,
        tonThucTe: (() => {
          const raw = (formKiemKe[lk.partNumber] ?? "").trim();
          if (raw === "") return null;
          return Number(raw);
        })(),
      }));
      await apiPatch<{ ok: boolean }>("/api/warehouse/bin/ton-thuc-te", {
        maViTri: thung.maViTri,
        updates,
      });
      toast.success(t("bin.count_saved"));
      setDialogKiemKe(false);
      sauKhiKiemKe?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setDangLuuKiemKe(false);
    }
  }

  const nhanTrangThai: Record<string, { text: string; class: string }> = {
    ok: { text: t("bin.status_ok"), class: "text-status-ok" },
    low: { text: t("bin.status_low"), class: "text-status-low" },
    critical: { text: t("bin.status_critical"), class: "text-status-critical" },
    dead: { text: t("bin.status_dead"), class: "text-status-dead" },
  };

  const getStockBarColor = (qty: number, minStock: number) => {
    if (qty === 0) return "#dc2626";
    if (qty < minStock) return "#ea580c";
    if (qty < minStock * 1.5) return "#eab308";
    return "#42A5F5";
  };

  const getStockStatusText = (qty: number, minStock: number) => {
    if (qty === 0) return t("bin.out_of_stock");
    if (qty < minStock) return t("bin.need_restock");
    if (qty < minStock * 1.5) return t("bin.warning");
    return t("bin.safe");
  };

  return (
    <>
    <Drawer open={mo} onOpenChange={(v) => !v && dong()}>
      <DrawerContent
        className="bg-gradient-to-b from-card to-background border-border"
        style={{ animation: mo ? "slideUp 0.2s ease-out" : "slideDown 0.2s ease-in" }}
      >
        {/* Header */}
        <DrawerHeader className="border-b border-border pb-4 px-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <DrawerTitle className="font-mono text-base font-bold flex items-center gap-2">
                <span className="text-primary">{t("warehouse.rack_prefix")} {thung.row}</span>
                <span className="text-muted-foreground">/</span>
                <span>{t("bin.bin_label")} {thung.label}</span>
              </DrawerTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {thung.components.length} {t("bin.components_count")}
              </p>
            </div>
            {thung.components.length > 0 && (
              <span className={`label-industrial px-2 py-1 rounded-md font-semibold text-xs ${nhanTrangThai[thung.status].class} bg-opacity-10`}>
                {nhanTrangThai[thung.status].text}
              </span>
            )}
          </div>
        </DrawerHeader>

        {/* Content */}
        <div className="p-4 space-y-3 max-h-[calc(75vh-120px)] overflow-y-auto">
          {thung.components.length === 0 ? (
            <motion.div
              className="flex flex-col items-center py-12 text-muted-foreground"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Package className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">{t("bin.empty_bin")}</p>
            </motion.div>
          ) : (
            thung.components.map((lk, idx) => {
              const minStock = lk.minStock ?? 0;
              const phanTramTon = minStock > 0 ? Math.min(100, (lk.quantity / minStock) * 100) : lk.quantity > 0 ? 100 : 0;
              const stockColor = getStockBarColor(lk.quantity, minStock);
              const stockText = getStockStatusText(lk.quantity, minStock);
              const bomOpen = expandedBom.has(lk.partNumber);

              return (
                <motion.div
                  key={lk.id}
                  className="border border-border/50 rounded-md hover:border-primary/30 hover:bg-primary/5 transition-all duration-150 group overflow-hidden"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  {/* Compact row */}
                  <div className="flex items-start gap-2 px-2.5 py-2">
                    {/* Status dot */}
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: stockColor }} />

                    {/* Code + Name + Stock detail */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-primary">{lk.partNumber}</span>
                        {(lk as any).viTriText && (
                          <span className="text-[9px] font-mono font-bold px-1 py-px bg-orange-50 border border-orange-200 rounded text-orange-600">
                            📍 {(lk as any).viTriText}
                          </span>
                        )}
                        {(lk as any).lech != null && (
                          <span className={`text-[9px] font-bold px-1 py-px rounded ${(lk as any).lech > 0 ? "bg-green-50 border border-green-200 text-green-600" : "bg-red-50 border border-red-200 text-red-600"}`}>
                            {(lk as any).lech > 0 ? "+" : ""}{(lk as any).lech} lệch
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{lk.name}</p>

                      {/* Ca ngày / Ca đêm / Thực tế */}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {(lk as any).tonCuoiCaNgay != null && (
                          <span className="text-[9px] bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5 text-violet-700 font-mono font-semibold">
                            {t("bin.shift_day_short")}: {Math.round((lk as any).tonCuoiCaNgay).toLocaleString()}
                          </span>
                        )}
                        <span className={`text-[9px] rounded px-1.5 py-0.5 font-mono font-semibold border ${
                          lk.quantity <= 0 ? "bg-muted/50 border-border/40 text-muted-foreground"
                          : lk.quantity < 10 ? "bg-amber-50 border-amber-200 text-amber-700"
                          : "bg-emerald-50 border-emerald-200 text-emerald-700"
                        }`}>
                          {t("bin.shift_night_short")}: {lk.quantity.toLocaleString()}
                        </span>
                        {(lk as any).tonThucTe != null && (
                          <span className={`text-[9px] rounded px-1.5 py-0.5 font-mono font-semibold border ${
                            (lk as any).lech != null ? "bg-red-50 border-red-200 text-red-600" : "bg-sky-50 border-sky-200 text-sky-700"
                          }`}>
                            {t("bin.actual_short")}: {Math.round((lk as any).tonThucTe).toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${phanTramTon}%` }}
                            transition={{ delay: idx * 0.03 + 0.1, duration: 0.2, ease: "easeOut" }}
                            style={{ backgroundColor: stockColor }}
                          />
                        </div>
                        {minStock > 0 && (
                          <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">
                            min {minStock.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* BOM toggle */}
                    <button
                      type="button"
                      onClick={() => toggleBom(lk.partNumber)}
                      className="shrink-0 p-1 rounded hover:bg-accent text-muted-foreground hover:text-primary transition-colors"
                      title={bomOpen ? t("bin.bom_collapse") : t("bin.bom_expand")}
                    >
                      {bomOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* BOM Section — collapsible */}
                  <AnimatePresence>
                    {bomOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        style={{ overflow: "hidden" }}
                        className="border-t border-border/40 bg-muted/20 px-2.5 pb-2"
                      >
                        <BomSection partNumber={lk.partNumber} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        {thung.components.length > 0 && (
          <div className="border-t border-border p-4 flex gap-2">
            <motion.button
              type="button"
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all duration-150 disabled:opacity-60"
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              disabled={dangInQr}
              onClick={() => void inQrThung()}
            >
              {dangInQr ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden /> : <QrCode size={18} aria-hidden />}
              {t("bin.print_qr")}
            </motion.button>
            <motion.button
              type="button"
              className="flex-1 px-4 py-2.5 rounded-lg border-2 border-primary text-primary font-medium text-sm flex items-center justify-center gap-2 hover:bg-primary/5 transition-all duration-150"
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              title={!coMaViTri ? t("bin.count_error_vitri") : undefined}
              onClick={() => setDialogKiemKe(true)}
            >
              <Clipboard size={18} aria-hidden />
              {t("bin.count_bin")}
            </motion.button>
          </div>
        )}
      </DrawerContent>
    </Drawer>

      <Dialog open={dialogKiemKe} onOpenChange={setDialogKiemKe}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("bin.count_dialog_title")}</DialogTitle>
            <DialogDescription asChild>
              <div>
                <span className="block">
                  {t("warehouse.rack_prefix")} {thung.row} · {t("bin.bin_label")} {thung.label}
                </span>
                <span className="mt-1 block text-xs">{t("bin.count_dialog_desc")}</span>
              </div>
            </DialogDescription>
          </DialogHeader>
          {!coMaViTri ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{t("bin.count_error_vitri")}</p>
          ) : null}
          <ScrollArea className="max-h-[min(360px,50vh)] pr-3">
            <div className="space-y-4 py-1">
              {thung.components.map((lk) => (
                <div key={lk.partNumber} className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-2">
                  <p className="font-mono text-xs font-semibold text-primary">{lk.partNumber}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{lk.name}</p>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                    <span>
                      {t("bin.count_ref_night")}: <strong className="text-foreground tabular-nums">{lk.quantity.toLocaleString()}</strong>
                    </span>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("bin.count_field_actual")}</label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      className="h-9 font-mono tabular-nums"
                      value={formKiemKe[lk.partNumber] ?? ""}
                      onChange={(e) =>
                        setFormKiemKe((prev) => ({ ...prev, [lk.partNumber]: e.target.value }))
                      }
                      placeholder="—"
                    />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDialogKiemKe(false)} disabled={dangLuuKiemKe}>
              {t("bom.form_cancel")}
            </Button>
            <Button type="button" onClick={() => void luuKiemKe()} disabled={dangLuuKiemKe || !coMaViTri}>
              {dangLuuKiemKe ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {t("bin.count_saving")}
                </span>
              ) : (
                t("bin.count_save")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
