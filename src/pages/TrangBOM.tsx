import { useState, useEffect, useCallback } from "react";
import { usePhanTrang } from "@/lib/usePhanTrang";
import { PhanTrang } from "@/components/ui/PhanTrang";
import { useSearchParams } from "react-router-dom";
import { API_BASE, apiPost, apiPut, apiDelete } from "@/api/client";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { useQuyen } from "@/hooks/useQuyen";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { Search, Plus, Pencil, Trash2, Loader2, ChevronDown } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AssyOption {
  id: string;
  partNumber: string;
  name: string | null;
  model: string | null;
}

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

const EMPTY_BOM: BomForm = {
  stt: "",
  code: "",
  itemDescription: "",
  qtyPlan: "",
  qtyKitting: "",
  heSo: "",
  donVi: "",
  xuatSX: "",
  remark: "",
};

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

// ─── Delete confirm ───────────────────────────────────────────────────────────

function BomDeleteDialog({
  open,
  rowId,
  onClose,
  onDeleted,
}: {
  open: boolean;
  rowId: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) setError(null); }, [open]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiDelete(`/api/bom/${rowId}`);
      onDeleted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-destructive">{t("bom.confirm_delete")}</DialogTitle>
          <DialogDescription className="mt-1 text-sm">{t("bom.confirm_delete_desc")}</DialogDescription>
        </DialogHeader>
        {error && <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">{error}</p>}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={deleting}>{t("bom.form_cancel")}</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            {t("bom.confirm_delete_btn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TrangBOM() {
  const { t } = useI18n();
  const { chiXem } = useQuyen();
  const [searchParams] = useSearchParams();
  const preselectedAssy = searchParams.get("assy") || "";

  // Assy selector state
  const [assyList, setAssyList] = useState<AssyOption[]>([]);
  const [assySearch, setAssySearch] = useState("");
  const [assyDropOpen, setAssyDropOpen] = useState(false);
  const [selectedAssy, setSelectedAssy] = useState<AssyOption | null>(null);
  const [loadingAssy, setLoadingAssy] = useState(true);

  // BOM rows state
  const [rows, setRows] = useState<BomRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  // CRUD state
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [formInitial, setFormInitial] = useState<BomForm>(EMPTY_BOM);
  const [editRowId, setEditRowId] = useState<number | undefined>();
  const [deleteRowId, setDeleteRowId] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  // Load assy list, auto-select if URL param present
  useEffect(() => {
    setLoadingAssy(true);
    fetch(`${API_BASE}/api/components`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: AssyOption[]) => {
        const arr = Array.isArray(list) ? list : [];
        setAssyList(arr);
        if (preselectedAssy) {
          const found = arr.find((a) => a.partNumber === preselectedAssy);
          if (found) setSelectedAssy(found);
        }
      })
      .catch(() => setAssyList([]))
      .finally(() => setLoadingAssy(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load BOM rows when assy changes
  const loadRows = useCallback((assy: string) => {
    if (!assy) { setRows([]); return; }
    setLoadingRows(true);
    fetch(`${API_BASE}/api/bom?assy=${encodeURIComponent(assy)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: BomRow[]) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoadingRows(false));
  }, []);

  useEffect(() => {
    if (selectedAssy) loadRows(selectedAssy.partNumber);
    else setRows([]);
  }, [selectedAssy, loadRows]);

  const { page, setPage, resetPage, totalPages, slice: rowsTrang, pageSize } = usePhanTrang(rows);
  useEffect(() => {
    resetPage();
  }, [selectedAssy?.partNumber, resetPage]);

  const filteredAssy = assyList.filter(
    (a) =>
      (a.partNumber || "").toLowerCase().includes(assySearch.toLowerCase()) ||
      (a.name || "").toLowerCase().includes(assySearch.toLowerCase())
  );

  function openAdd() {
    setFormInitial(EMPTY_BOM);
    setFormMode("add");
    setEditRowId(undefined);
    setFormOpen(true);
  }

  function openEdit(row: BomRow) {
    setFormInitial(rowToForm(row));
    setFormMode("edit");
    setEditRowId(row.id);
    setFormOpen(true);
  }

  return (
    <motion.div
      className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">{t("bom.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("bom.subtitle")}</p>
        </div>
        {selectedAssy && !chiXem && (
          <Button size="sm" className="gap-1.5 shrink-0" onClick={openAdd}>
            <Plus className="w-4 h-4" />
            {t("bom.add_row")}
          </Button>
        )}
      </div>

      {/* Assy selector */}
      <div className="relative">
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t("comp.assy")}</label>
        <button
          type="button"
          onClick={() => setAssyDropOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all text-left"
        >
          {selectedAssy ? (
            <span>
              <span className="font-mono font-semibold">{selectedAssy.partNumber}</span>
              {selectedAssy.name && <span className="text-muted-foreground ml-2">{selectedAssy.name}</span>}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {loadingAssy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : t("bom.select_assy")}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${assyDropOpen ? "rotate-180" : ""}`} />
        </button>

        {assyDropOpen && (
          <div className="absolute z-30 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  className="w-full pl-7 pr-3 py-1.5 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder={t("bom.search_assy")}
                  value={assySearch}
                  onChange={(e) => setAssySearch(e.target.value)}
                />
              </div>
            </div>
            <ul className="max-h-64 overflow-y-auto">
              {filteredAssy.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">{t("comp.no_items")}</li>
              ) : (
                filteredAssy.map((a) => (
                  <li key={a.partNumber}>
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors ${selectedAssy?.partNumber === a.partNumber ? "bg-accent text-accent-foreground" : ""}`}
                      onClick={() => {
                        setSelectedAssy(a);
                        setAssyDropOpen(false);
                        setAssySearch("");
                      }}
                    >
                      <span className="font-mono font-medium">{a.partNumber}</span>
                      {a.name && <span className="text-muted-foreground ml-2 text-xs">{a.name}</span>}
                      {a.model && <span className="text-muted-foreground ml-1 text-xs">· {a.model}</span>}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>

      {/* BOM table */}
      {!selectedAssy ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-2">
          <p className="text-sm">{t("bom.no_assy_selected")}</p>
        </div>
      ) : loadingRows ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">
              {rows.length} {t("bom.total_rows")} · <span className="font-mono font-semibold text-foreground">{selectedAssy.partNumber}</span>
              {selectedAssy.model && <span className="ml-1">· {selectedAssy.model}</span>}
            </p>
          </div>

          {rows.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg py-12 flex items-center justify-center text-muted-foreground text-sm">
              {t("bom.no_rows")}
            </div>
          ) : (
            <div className="flex flex-col overflow-hidden rounded-lg border border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border">
                      <th className="text-center py-2.5 px-3 font-semibold text-xs text-muted-foreground w-12">{t("bom.col_stt")}</th>
                      <th className="text-left py-2.5 px-3 font-semibold text-xs text-muted-foreground">{t("bom.col_code")}</th>
                      <th className="text-left py-2.5 px-3 font-semibold text-xs text-muted-foreground min-w-[200px]">{t("bom.col_desc")}</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-xs text-muted-foreground">{t("bom.col_qty_plan")}</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-xs text-muted-foreground">{t("bom.col_qty_kitting")}</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-xs text-muted-foreground">{t("bom.col_he_so")}</th>
                      <th className="text-center py-2.5 px-3 font-semibold text-xs text-muted-foreground">{t("bom.col_don_vi")}</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-xs text-muted-foreground">{t("bom.col_xuat_sx")}</th>
                      <th className="text-left py-2.5 px-3 font-semibold text-xs text-muted-foreground">{t("bom.col_remark")}</th>
                      {!chiXem && <th className="text-center py-2.5 px-3 font-semibold text-xs text-muted-foreground w-20">{t("bom.col_actions")}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rowsTrang.map((row, idx) => (
                      <tr
                        key={row.id}
                        className={`border-b border-border/60 hover:bg-muted/20 transition-colors ${((page - 1) * pageSize + idx) % 2 === 0 ? "" : "bg-muted/10"}`}
                      >
                        <td className="py-2 px-3 text-center tabular-nums text-muted-foreground">{row.stt ?? "—"}</td>
                        <td className="py-2 px-3 font-mono text-xs font-medium">{row.code ?? "—"}</td>
                        <td className="py-2 px-3 text-xs">{row.itemDescription ?? "—"}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-xs">{row.qtyPlan != null ? row.qtyPlan.toLocaleString() : "—"}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-xs">{row.qtyKitting != null ? row.qtyKitting.toLocaleString() : "—"}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-xs">{row.heSo ?? "—"}</td>
                        <td className="py-2 px-3 text-center text-xs text-muted-foreground">{row.donVi ?? "—"}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-xs">{row.xuatSX != null ? row.xuatSX.toLocaleString() : "—"}</td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">{row.remark ?? "—"}</td>
                        {!chiXem && (
                          <td className="py-2 px-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(row)}
                                className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                title={t("bom.edit_row")}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteRowId(row.id)}
                                className="p-1.5 rounded hover:bg-destructive/10 text-destructive/60 hover:text-destructive transition-colors"
                                title={t("bom.delete_row")}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PhanTrang
                trangHienTai={page}
                tongSoTrang={totalPages}
                tongSoMuc={rows.length}
                onChuyenTrang={setPage}
                nhanTomTat={t("comp.pagination_rows")}
              />
            </div>
          )}
        </motion.div>
      )}

      {/* Form dialog — pass editRowId via a workaround using key to reset */}
      {formOpen && (
        <BomFormDialogWithId
          open={formOpen}
          mode={formMode}
          initial={formInitial}
          maAssy={selectedAssy?.partNumber ?? ""}
          editRowId={editRowId}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            showToast(t("bom.save_ok"));
            if (selectedAssy) loadRows(selectedAssy.partNumber);
          }}
        />
      )}

      {/* Delete dialog */}
      {deleteRowId != null && (
        <BomDeleteDialog
          open={true}
          rowId={deleteRowId}
          onClose={() => setDeleteRowId(null)}
          onDeleted={() => {
            setDeleteRowId(null);
            showToast(t("bom.delete_ok"));
            if (selectedAssy) loadRows(selectedAssy.partNumber);
          }}
        />
      )}

      {/* Toast */}
      {toastMsg && (
        <motion.div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background text-sm px-4 py-2.5 rounded-lg shadow-lg"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {toastMsg}
        </motion.div>
      )}
    </motion.div>
  );
}

// Wrapper to properly thread editRowId into BomFormDialog
function BomFormDialogWithId({
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

  useEffect(() => {
    if (open) { setForm(initial); setError(null); }
  }, [open, initial]);

  function set(field: keyof BomForm, val: string) {
    setForm((f) => ({ ...f, [field]: val }));
  }

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
      if (mode === "add") {
        await apiPost("/api/bom", body);
      } else if (editRowId != null) {
        await apiPut(`/api/bom/${editRowId}`, body);
      }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full px-2.5 py-1.5 bg-muted border border-border rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all";
  const numCls = inputCls + " text-right tabular-nums";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? t("bom.form_title_add") : t("bom.form_title_edit")}</DialogTitle>
          <DialogDescription className="font-mono text-xs mt-0.5">{maAssy}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("bom.col_stt")}</label>
            <input type="number" className={numCls} value={form.stt} onChange={(e) => set("stt", e.target.value)} placeholder="1" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("bom.col_code")}</label>
            <input className={inputCls} value={form.code} onChange={(e) => set("code", e.target.value)} placeholder={`${t("common.eg")} CC-001`} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("bom.col_desc")}</label>
            <input className={inputCls} value={form.itemDescription} onChange={(e) => set("itemDescription", e.target.value)} placeholder={t("common.ph_desc_detail")} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("bom.col_qty_plan")}</label>
            <input type="number" min="0" step="0.01" className={numCls} value={form.qtyPlan} onChange={(e) => set("qtyPlan", e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("bom.col_qty_kitting")}</label>
            <input type="number" min="0" step="0.01" className={numCls} value={form.qtyKitting} onChange={(e) => set("qtyKitting", e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("bom.col_he_so")}</label>
            <input type="number" min="0" step="0.0001" className={numCls} value={form.heSo} onChange={(e) => set("heSo", e.target.value)} placeholder="0.0000" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("bom.col_don_vi")}</label>
            <input className={inputCls} value={form.donVi} onChange={(e) => set("donVi", e.target.value)} placeholder={t("common.ph_unit")} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("bom.col_xuat_sx")}</label>
            <input type="number" min="0" step="0.01" className={numCls} value={form.xuatSX} onChange={(e) => set("xuatSX", e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("bom.col_remark")}</label>
            <input className={inputCls} value={form.remark} onChange={(e) => set("remark", e.target.value)} placeholder={t("common.ph_notes")} />
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
