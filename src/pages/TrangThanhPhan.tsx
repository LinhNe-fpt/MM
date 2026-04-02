import { type LinhKien } from "@/data/duLieuMau";
import { API_BASE, apiPost, apiPut, apiPatch, apiDelete, resolveMediaUrl } from "@/api/client";
import { Search, Loader2, List, Plus, Pencil, Trash2, X, XCircle, AlertTriangle, MapPin, Package, ImagePlus, Upload } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { PageListSkeleton } from "@/components/ui/page-list-skeleton";
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
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, Link } from "react-router-dom";
import { Input } from "@/components/ui/input";

export interface ChiTietLinhKienRow {
  id: number;
  stt: number | null;
  code: string | null;
  itemDescription: string | null;
  /** Tồn kho (ca đêm) theo mã con — API GET .../details */
  tonKho?: number | null;
  qtyPlan: number | null;
  qtyKitting: number | null;
  heSo: number | null;
  donVi: string | null;
  xuatSX: number | null;
  remark: string | null;
}

interface LinhKienForm {
  codeTong: string;
  moTa: string;
  cumVatLieu: string;
  model: string;
  donVi: string;
  laAssembly: boolean;
  heSo: string;
  tonToiThieu: string;
  hinhAnhUrl: string;
}

const EMPTY_FORM: LinhKienForm = {
  codeTong: "",
  moTa: "",
  cumVatLieu: "",
  model: "",
  donVi: "pcs",
  laAssembly: false,
  heSo: "",
  tonToiThieu: "",
  hinhAnhUrl: "",
};

/** Số lượng hiển thị gọn (≤1 chữ số thập phân); hover `title` vẫn có thể gắn giá trị đầy đủ */
function formatSoLuongGon(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const lamTron = Math.round(n * 10) / 10;
  if (Number.isInteger(lamTron)) return Math.round(lamTron).toLocaleString("vi-VN");
  return lamTron.toLocaleString("vi-VN", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}

function OVuongAnhLinhKien({
  src,
  title,
  interactive,
  onActivate,
}: {
  src?: string | null;
  title: string;
  interactive?: boolean;
  onActivate?: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const displaySrc = resolveMediaUrl(src);
  useEffect(() => {
    setBroken(false);
  }, [src]);

  const showPlaceholder = !displaySrc || broken;

  const content = showPlaceholder ? (
    <div
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border text-muted-foreground ${
        interactive ? "border-dashed border-primary/55 bg-primary/5 hover:bg-primary/10" : "border-border bg-muted/40"
      }`}
    >
      {interactive ? (
        <ImagePlus className="h-5 w-5 text-primary/80" aria-hidden />
      ) : (
        <Package className="h-5 w-5 opacity-60" aria-hidden />
      )}
    </div>
  ) : (
    <img
      src={displaySrc}
      alt=""
      className={`h-14 w-14 shrink-0 rounded-lg border border-border bg-background object-cover ${
        interactive ? "transition-shadow hover:ring-2 hover:ring-primary/35 ring-offset-1 ring-offset-background" : ""
      }`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );

  if (interactive && onActivate) {
    return (
      <button
        type="button"
        onClick={onActivate}
        className="shrink-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        title={title}
      >
        {content}
      </button>
    );
  }

  return (
    <span className="inline-flex shrink-0 rounded-md" title={title}>
      {content}
    </span>
  );
}

function LinhKienFormDialog({
  open,
  mode,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "add" | "edit";
  initial: LinhKienForm;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState<LinhKienForm>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initial);
      setError(null);
    }
  }, [open, initial]);

  function set(field: keyof LinhKienForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    if (!form.codeTong.trim()) {
      setError(t("comp.form_required") + ": " + t("comp.form_code"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        codeTong:    form.codeTong.trim(),
        moTa:        form.moTa.trim()        || null,
        cumVatLieu:  form.cumVatLieu.trim()  || null,
        model:       form.model.trim()       || null,
        donVi:       form.donVi.trim()       || "pcs",
        laAssembly:  form.laAssembly,
        heSo:        form.heSo        !== "" ? Number(form.heSo)        : 0,
        tonToiThieu: form.tonToiThieu !== "" ? parseInt(form.tonToiThieu) : 0,
        duongDanHinh: form.hinhAnhUrl.trim() || null,
      };
      if (mode === "add") {
        await apiPost("/api/components", body);
      } else {
        await apiPut(`/api/components/${encodeURIComponent(form.codeTong)}`, body);
      }
      onSaved();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes("ton tai") ? `${form.codeTong} — ${t("error.code_exists")}` : msg);
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full px-3 py-2 bg-muted border border-border rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? t("comp.form_title_add") : t("comp.form_title_edit")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("comp.form_code")} <span className="text-destructive">*</span>
            </label>
            <input
              className={inputCls}
              value={form.codeTong}
              onChange={(e) => set("codeTong", e.target.value)}
              disabled={mode === "edit"}
              placeholder={`${t("common.eg")} ASSY-001`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("comp.form_mo_ta")}
            </label>
            <input
              className={inputCls}
              value={form.moTa}
              onChange={(e) => set("moTa", e.target.value)}
              placeholder={t("common.ph_desc_detail")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("comp.form_cum_vl")}
              </label>
              <input
                className={inputCls}
                value={form.cumVatLieu}
                onChange={(e) => set("cumVatLieu", e.target.value)}
                placeholder={t("common.ph_material")}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("comp.form_model")}
              </label>
              <input
                className={inputCls}
                value={form.model}
                onChange={(e) => set("model", e.target.value)}
                placeholder={t("comp.form_model")}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("comp.form_image_url")}</label>
            <input
              className={inputCls}
              type="url"
              value={form.hinhAnhUrl}
              onChange={(e) => set("hinhAnhUrl", e.target.value)}
              placeholder="https://..."
            />
            <p className="mt-1 text-[11px] text-muted-foreground">{t("comp.form_image_hint")}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("comp.form_don_vi") || "Đơn vị"}
              </label>
              <input
                className={inputCls}
                value={form.donVi}
                onChange={(e) => set("donVi", e.target.value)}
                placeholder="pcs"
              />
            </div>
            <div className="flex items-end pb-1.5">
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary"
                  checked={form.laAssembly}
                  onChange={(e) => setForm(f => ({ ...f, laAssembly: e.target.checked }))}
                />
                {t("comp.form_la_assembly") || "Là Code Tổng"}
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("comp.form_he_so")}
              </label>
              <input
                type="number"
                min="0"
                step="0.0001"
                className={inputCls}
                value={form.heSo}
                onChange={(e) => set("heSo", e.target.value)}
                placeholder="0.0000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("comp.form_ton_tt")}
              </label>
              <input
                type="number"
                min="0"
                step="1"
                className={inputCls}
                value={form.tonToiThieu}
                onChange={(e) => set("tonToiThieu", e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">{error}</p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t("comp.form_cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <span className="flex items-center gap-1.5">
              <Loader2 className={`w-3.5 h-3.5 animate-spin transition-opacity ${saving ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}`} />
              {t("comp.form_save")}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmDialog({
  open,
  codeTong,
  onClose,
  onDeleted,
}: {
  open: boolean;
  codeTong: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await apiDelete(`/api/components/${encodeURIComponent(codeTong)}`);
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
          <DialogTitle className="text-destructive">{t("comp.confirm_delete")}</DialogTitle>
          <DialogDescription className="mt-1 text-sm">
            {t("comp.confirm_delete_desc")}
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <p className="text-sm font-mono bg-muted rounded px-3 py-2">{codeTong}</p>
          {error && (
            <p className="mt-2 text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">{error}</p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={deleting}>
            {t("comp.form_cancel")}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            {t("comp.confirm_delete_btn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog: Đặt vị trí kho cho nhiều mã ─────────────────────────────────────
function BulkViTriDialog({
  open,
  selected,
  onClose,
  onDone,
}: {
  open: boolean;
  selected: LinhKien[];
  onClose: () => void;
  onDone: (payload: { viTriText: string | null; successCodes: string[]; failedCodes: string[] }) => void;
}) {
  const [viTri, setViTri] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setViTri("");
      setError("");
    }
  }, [open]);

  async function handleSave() {
    const raw = viTri.trim().toUpperCase();
    if (!raw) {
      setError("Nhập vị trí (VD: M3-1)");
      return;
    }
    setLoading(true);
    setError("");
    const successCodes: string[] = [];
    const failedCodes: string[] = [];
    for (const lk of selected) {
      try {
        const res = await fetch(`${API_BASE}/api/components/${encodeURIComponent(lk.partNumber)}/vitri`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ viTriText: raw }),
        });
        if (res.ok) successCodes.push(lk.partNumber);
        else failedCodes.push(lk.partNumber);
      } catch {
        failedCodes.push(lk.partNumber);
      }
    }
    setLoading(false);
    onDone({ viTriText: raw, successCodes, failedCodes });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-orange-500" />
            Đặt vị trí kho
          </DialogTitle>
          <DialogDescription>
            Gán cùng một vị trí cho <span className="font-semibold text-foreground">{selected.length} mã</span> đã chọn (lưu vào CSDL, trường ViTriText).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Vị trí</label>
            <input
              type="text"
              value={viTri}
              onChange={(e) => setViTri(e.target.value.toUpperCase())}
              maxLength={20}
              placeholder="VD: M3-1"
              className="w-full font-mono text-sm px-3 py-2.5 border border-orange-200 rounded-lg bg-orange-50/50 focus:outline-none focus:ring-2 focus:ring-orange-400"
              autoFocus
            />
          </div>
          <div className="border border-border rounded-lg max-h-36 overflow-y-auto text-xs">
            <div className="px-2 py-1.5 bg-muted/50 font-semibold text-muted-foreground">Mã sẽ cập nhật</div>
            <ul className="px-2 py-1 space-y-0.5 font-mono text-primary">
              {selected.map((lk) => (
                <li key={lk.partNumber} className="truncate">
                  {lk.partNumber}
                  {lk.viTriText ? <span className="text-muted-foreground ml-1">(hiện: {lk.viTriText})</span> : null}
                </li>
              ))}
            </ul>
          </div>
          {error && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-destructive/10 text-destructive text-sm">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Hủy
          </Button>
          <Button onClick={handleSave} disabled={loading || selected.length === 0} className="gap-1.5 bg-orange-600 hover:bg-orange-700">
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Lưu vị trí
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TrangThanhPhan() {
  const { t } = useI18n();
  const { chiXem } = useQuyen();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tuKhoa, setTuKhoa] = useState("");
  const [tatCaLinhKien, setTatCaLinhKien] = useState<LinhKien[]>([]);
  const [tai, setTai] = useState(true);
  const [loi, setLoi] = useState<string | null>(null);
  const [assyChiTiet, setAssyChiTiet] = useState<string | null>(null);
  const [chiTietData, setChiTietData] = useState<{ assy: string; model: string | null; rows: ChiTietLinhKienRow[] } | null>(null);
  const [taiChiTiet, setTaiChiTiet] = useState(false);
  const [trangHienTai, setTrangHienTai] = useState(1);
  // "has-stock" | "assembly" | "leaf" | "all"
  const [boLocLoai, setBoLocLoai] = useState<"has-stock" | "assembly" | "leaf" | "all">("has-stock");
  const itemsPerPage = 6;
  const boLocTrangThai = (searchParams.get("status") || "").toLowerCase();

  // CRUD state
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [formInitial, setFormInitial] = useState<LinhKienForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [nhanhAnhMa, setNhanhAnhMa] = useState<string | null>(null);
  const [nhanhAnhUrlInput, setNhanhAnhUrlInput] = useState("");
  const [dangLuuAnhNhanh, setDangLuuAnhNhanh] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Multi-select state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkViTriOpen, setBulkViTriOpen] = useState(false);
  // Inline edit vị trí
  const [editViTri, setEditViTri] = useState<{ code: string; value: string } | null>(null);
  const viTriInputRef = useRef<HTMLInputElement>(null);
  const quickImageFileRef = useRef<HTMLInputElement>(null);
  // Debounce search để tránh filter nặng mỗi keystroke
  const [tuKhoaInput, setTuKhoaInput] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleSearchChange(val: string) {
    setTuKhoaInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setTuKhoa(val); setTrangHienTai(1); }, 180);
  }

  async function saveViTri(code: string, value: string) {
    try {
      const res = await fetch(`${API_BASE}/api/components/${encodeURIComponent(code)}/vitri`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viTriText: value.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast((err as { error?: string }).error || t("error.load_components"));
        return;
      }
      setTatCaLinhKien(prev => prev.map(lk =>
        lk.partNumber === code ? { ...lk, viTriText: value.trim().toUpperCase() || null } : lk
      ));
      setEditViTri(null);
    } catch {
      showToast(t("error.load_components"));
    }
  }

  function toggleSelect(code: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }
  function clearSelection() { setSelected(new Set()); }

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  function loadComponents() {
    setTai(true);
    setLoi(null);
    fetch(`${API_BASE}/api/components`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: LinhKien[]) => setTatCaLinhKien(Array.isArray(list) ? list : []))
      .catch((e) => setLoi(e?.message || t("error.load_components")))
      .finally(() => setTai(false));
  }

  async function luuAnhNhanh(url: string | null) {
    const ma = nhanhAnhMa;
    if (!ma) return;
    setDangLuuAnhNhanh(true);
    try {
      const rs = await apiPatch<{ ok: boolean; duongDanHinh: string | null }>(
        `/api/components/${encodeURIComponent(ma)}/hinh-anh`,
        { duongDanHinh: url },
      );
      const hinh = rs.duongDanHinh ?? null;
      setTatCaLinhKien((prev) => prev.map((lk) => (lk.partNumber === ma ? { ...lk, hinhAnh: hinh } : lk)));
      toast.success(t("comp.quick_image_saved"));
      setNhanhAnhMa(null);
      setNhanhAnhUrlInput("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setDangLuuAnhNhanh(false);
    }
  }

  async function uploadAnhTuMay(file: File) {
    const ma = nhanhAnhMa;
    if (!ma) return;
    setDangLuuAnhNhanh(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE}/api/components/${encodeURIComponent(ma)}/hinh-anh/upload`, {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; duongDanHinh?: string | null };
      if (!res.ok) throw new Error(data.error || "Upload lỗi");
      const hinh = data.duongDanHinh ?? null;
      setTatCaLinhKien((prev) => prev.map((lk) => (lk.partNumber === ma ? { ...lk, hinhAnh: hinh } : lk)));
      toast.success(t("comp.quick_image_saved"));
      setNhanhAnhMa(null);
      setNhanhAnhUrlInput("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setDangLuuAnhNhanh(false);
      if (quickImageFileRef.current) quickImageFileRef.current.value = "";
    }
  }

  useEffect(() => {
    let cancelled = false;
    setTai(true);
    setLoi(null);
    fetch(`${API_BASE}/api/components`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: LinhKien[]) => {
        if (!cancelled) setTatCaLinhKien(Array.isArray(list) ? list : []);
      })
      .catch((e) => {
        if (!cancelled) setLoi(e?.message || t("error.load_components"));
      })
      .finally(() => {
        if (!cancelled) setTai(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!assyChiTiet) { setChiTietData(null); return; }
    let cancelled = false;
    setTaiChiTiet(true);
    fetch(`${API_BASE}/api/components/${encodeURIComponent(assyChiTiet)}/details`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { assy?: string; model?: string | null; rows?: ChiTietLinhKienRow[] } | ChiTietLinhKienRow[] | null) => {
        if (cancelled) return;
        if (Array.isArray(data)) {
          setChiTietData({ assy: assyChiTiet, model: null, rows: data });
        } else if (data && Array.isArray(data.rows)) {
          setChiTietData({ assy: data.assy ?? assyChiTiet, model: data.model ?? null, rows: data.rows });
        } else {
          setChiTietData({ assy: assyChiTiet, model: null, rows: [] });
        }
      })
      .catch(() => { if (!cancelled) setChiTietData({ assy: assyChiTiet, model: null, rows: [] }); })
      .finally(() => { if (!cancelled) setTaiChiTiet(false); });
    return () => { cancelled = true; };
  }, [assyChiTiet]);

  // Deep link từ Tổng quan (cảnh báo hết hàng): /components?q=CODE — mặc định tab "Có tồn kho" sẽ loại SL=0
  const qTuUrl = searchParams.get("q");
  useEffect(() => {
    if (qTuUrl == null || qTuUrl === "") return;
    setTuKhoaInput(qTuUrl);
    setTuKhoa(qTuUrl);
    setTrangHienTai(1);
    setBoLocLoai("all");
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("q");
      // status=low ẩn hàng tồn 0; bỏ để mở đúng mã từ cảnh báo
      next.delete("status");
      return next;
    }, { replace: true });
  }, [qTuUrl, setSearchParams]);

  // Đang ở tab "Có tồn kho" mà gõ tìm kiếm → chuyển "Tất cả" để thấy cả mã hết hàng khớp từ khóa
  useEffect(() => {
    if (!tuKhoa.trim()) return;
    setBoLocLoai((prev) => (prev === "has-stock" ? "all" : prev));
  }, [tuKhoa]);

  // Memoize toàn bộ pipeline filter → sort → paginate
  const tuKhoaLower = useMemo(() => tuKhoa.toLowerCase(), [tuKhoa]);

  const coTonKhoCount = useMemo(
    () => tatCaLinhKien.reduce((n, lk) => n + (lk.quantity > 0 ? 1 : 0), 0),
    [tatCaLinhKien]
  );

  /** Khi đang gõ tìm kiếm: bỏ lọc "chỉ có tồn"; bỏ status=low (vì loại mã tồn 0). Giữ status=out nếu user muốn chỉ hết hàng. */
  const loaiLocHieuLuc = tuKhoaLower && boLocLoai === "has-stock" ? "all" : boLocLoai;
  const trangThaiTuUrlHieuLuc = tuKhoaLower && boLocTrangThai === "low" ? "" : boLocTrangThai;

  const daLoc = useMemo(() => {
    return tatCaLinhKien.filter((lk) => {
      if (tuKhoaLower) {
        const match =
          (lk.partNumber || "").toLowerCase().includes(tuKhoaLower) ||
          (lk.name || "").toLowerCase().includes(tuKhoaLower) ||
          (lk.manufacturer || "").toLowerCase().includes(tuKhoaLower) ||
          (lk.model || "").toLowerCase().includes(tuKhoaLower);
        if (!match) return false;
      }
      if (trangThaiTuUrlHieuLuc === "low") return lk.quantity > 0 && lk.quantity < (lk.minStock ?? 0);
      if (trangThaiTuUrlHieuLuc === "out") return lk.quantity === 0;
      if (loaiLocHieuLuc === "has-stock") return lk.quantity > 0;
      if (loaiLocHieuLuc === "assembly") return lk.laAssembly === true;
      if (loaiLocHieuLuc === "leaf") return !lk.laAssembly;
      return true;
    });
  }, [tatCaLinhKien, tuKhoaLower, trangThaiTuUrlHieuLuc, loaiLocHieuLuc]);

  const daLocSorted = useMemo(
    () =>
      boLocLoai === "has-stock" && !tuKhoaLower
        ? [...daLoc].sort((a, b) => b.quantity - a.quantity)
        : daLoc,
    [daLoc, boLocLoai, tuKhoaLower]
  );

  const tongSoTrang = Math.ceil(daLocSorted.length / itemsPerPage);
  const trangHienTaiValid = Math.max(1, Math.min(trangHienTai, tongSoTrang || 1));

  const danhSachHienThi = useMemo(
    () => daLocSorted.slice((trangHienTaiValid - 1) * itemsPerPage, trangHienTaiValid * itemsPerPage),
    [daLocSorted, trangHienTaiValid]
  );

  const chuyenTrang = useCallback(
    (trang: number) => setTrangHienTai(Math.max(1, Math.min(trang, tongSoTrang || 1))),
    [tongSoTrang]
  );

  function toggleSelectPage() {
    const pageIds = danhSachHienThi.map(lk => lk.partNumber);
    const allSelected = pageIds.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) pageIds.forEach(id => next.delete(id));
      else pageIds.forEach(id => next.add(id));
      return next;
    });
  }

  // Dùng Map để lookup O(1) thay vì filter O(n) mỗi render
  const linhKienMap = useMemo(
    () => new Map(tatCaLinhKien.map(lk => [lk.partNumber, lk])),
    [tatCaLinhKien]
  );
  const selectedItems = useMemo(
    () => [...selected].map(id => linhKienMap.get(id)).filter(Boolean) as LinhKien[],
    [selected, linhKienMap]
  );

  function openAddForm() {
    setFormInitial(EMPTY_FORM);
    setFormMode("add");
    setFormOpen(true);
  }

  function openEditForm(lk: LinhKien) {
    setFormInitial({
      codeTong:    lk.partNumber,
      moTa:        lk.name         ?? "",
      cumVatLieu:  lk.manufacturer ?? "",
      model:       lk.model        ?? "",
      donVi:       lk.donVi        ?? "pcs",
      laAssembly:  lk.laAssembly   ?? false,
      heSo:        lk.lossRate     != null ? String(lk.lossRate) : "",
      tonToiThieu: lk.minStock     != null ? String(lk.minStock) : "",
      hinhAnhUrl:  lk.hinhAnh      ?? "",
    });
    setFormMode("edit");
    setFormOpen(true);
  }

  if (tai) {
    return <PageListSkeleton rows={10} />;
  }

  return (
    <motion.div
      className="flex flex-col h-full w-full max-w-[min(100%,96rem)] mx-auto"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header cố định — không cuộn */}
      <div className="shrink-0 px-4 md:px-6 pt-4 md:pt-6 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t("comp.title")}</h1>
          {!chiXem && (
            <Button size="sm" className="gap-1.5 shrink-0" onClick={openAddForm}>
              <Plus className="w-4 h-4" />
              {t("comp.add_btn")}
            </Button>
          )}
        </div>

        {(boLocTrangThai === "low" || boLocTrangThai === "out") && (
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${boLocTrangThai === "low" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
              {boLocTrangThai === "low" ? t("comp.filter_active_low") : t("comp.filter_active_out")}
            </span>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setSearchParams({})}>
              {t("comp.clear_filter")}
            </Button>
          </div>
        )}

        {loi && (
          <motion.p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
            {loi}
          </motion.p>
        )}

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("comp.search")}
            value={tuKhoaInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-muted border border-border rounded-lg text-base placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-sans transition-all duration-150"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 flex-wrap">
          {([
            { key: "has-stock", label: "Có tồn kho", color: "emerald" },
            { key: "assembly",  label: "Code Tổng",   color: "blue"    },
            { key: "leaf",      label: "Code Con",    color: "violet"  },
            { key: "all",       label: "Tất cả",      color: "gray"    },
          ] as const).map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setBoLocLoai(tab.key); setTrangHienTai(1); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                boLocLoai === tab.key
                  ? tab.key === "has-stock" ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                  : tab.key === "assembly"  ? "bg-blue-100 text-blue-700 border-blue-300"
                  : tab.key === "leaf"      ? "bg-violet-100 text-violet-700 border-violet-300"
                  : "bg-muted text-foreground border-border"
                  : "text-muted-foreground border-transparent hover:border-border hover:bg-muted/50"
              }`}
            >
              {tab.label}
              {tab.key === "has-stock" && (
                <span className="ml-1.5 tabular-nums">{coTonKhoCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Thanh phân trang + đếm */}
        <div className="flex items-center justify-between text-sm text-muted-foreground pb-2">
          <span>
            {daLocSorted.length > 0
              ? <><span className="font-semibold text-foreground">{(trangHienTaiValid - 1) * itemsPerPage + 1}–{Math.min(trangHienTaiValid * itemsPerPage, daLocSorted.length)}</span> / {daLocSorted.length} {t("comp.items_count")}</>
              : t("comp.no_items")}
          </span>
          {tongSoTrang > 1 && (
            <div className="flex gap-1">
              <motion.button onClick={() => chuyenTrang(trangHienTaiValid - 1)} disabled={trangHienTaiValid === 1} className="btn-mechanical px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-40 transition-all" whileTap={{ scale: 0.95 }}>←</motion.button>
              {Array.from({ length: Math.min(5, tongSoTrang) }).map((_, i) => {
                const startPage = Math.max(1, trangHienTaiValid - 2);
                const page = startPage + i;
                if (page > tongSoTrang) return null;
                return (
                  <motion.button key={page} onClick={() => chuyenTrang(page)} className={`btn-mechanical px-2 py-1 rounded border transition-colors ${page === trangHienTaiValid ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`} whileTap={{ scale: 0.95 }}>{page}</motion.button>
                );
              })}
              <motion.button onClick={() => chuyenTrang(trangHienTaiValid + 1)} disabled={trangHienTaiValid === tongSoTrang} className="btn-mechanical px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-40 transition-all" whileTap={{ scale: 0.95 }}>→</motion.button>
            </div>
          )}
        </div>
      </div>

      {/* Danh sách — cuộn nội bộ */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto px-4 md:px-6 pb-6">
        {/* Table header */}
        <div className="grid grid-cols-[2rem_4rem_13rem_minmax(12rem,1fr)_minmax(15rem,18.5rem)_8.5rem] gap-x-3 gap-y-1 min-w-[52rem] px-3 py-2.5 text-[11px] md:text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-border mb-2 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
          {/* Select-all checkbox */}
          <button
            type="button"
            onClick={toggleSelectPage}
            className="w-4 h-4 rounded border border-border flex items-center justify-center hover:border-primary transition-colors shrink-0"
            title="Chọn tất cả trang này"
          >
            {danhSachHienThi.length > 0 && danhSachHienThi.every(lk => selected.has(lk.partNumber)) && (
              <span className="w-2 h-2 rounded-sm bg-primary" />
            )}
          </button>
          <span className="text-center leading-tight">{t("comp.col_image")}</span>
          <span>Mã linh kiện</span>
          <span>Thông tin</span>
          <span className="grid grid-cols-4 gap-1 text-center text-[9px] md:text-[10px] leading-tight">
            <span className="rounded px-1 py-0.5 bg-muted/60 text-muted-foreground">Đầu kỳ</span>
            <span className="rounded px-1 py-0.5 bg-violet-100 text-violet-700">Ca ngày</span>
            <span className="rounded px-1 py-0.5 bg-emerald-100 text-emerald-700">Ca đêm</span>
            <span className="rounded px-1 py-0.5 bg-sky-100 text-sky-700">Thực tế</span>
          </span>
          <span className="text-right">{t("comp.actions") || "Actions"}</span>
        </div>
        <p className="text-[10px] text-muted-foreground px-3 mb-2 leading-snug max-w-[52rem] border-b border-border/40 pb-2">
          {t("comp.stock_lech_legend")}
        </p>

        <motion.div className="space-y-1 min-w-[52rem]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
          {danhSachHienThi.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Không có linh kiện khớp bộ lọc</p>
              <p className="text-xs mb-3">Thử đổi tab, xóa ô tìm kiếm hoặc bỏ lọc trạng thái.</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button type="button" variant="outline" size="sm" onClick={() => { setTuKhoaInput(""); setTuKhoa(""); setBoLocLoai("all"); setTrangHienTai(1); }}>
                  Xóa tìm và hiện tất cả
                </Button>
                {(boLocTrangThai === "low" || boLocTrangThai === "out") && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSearchParams({})}>
                    {t("comp.clear_filter")}
                  </Button>
                )}
              </div>
            </div>
          )}
          {danhSachHienThi.map((lk) => {
            const isSelected = selected.has(lk.partNumber);
            const hasLech    = lk.tonThucTe != null && Math.abs(lk.tonThucTe - lk.quantity) > 0;
            return (
              <motion.div
                key={lk.id}
                className={`group grid grid-cols-[2rem_4rem_13rem_minmax(12rem,1fr)_minmax(15rem,18.5rem)_8.5rem] gap-x-3 gap-y-1 items-center px-3 py-3 md:py-3.5 rounded-xl border transition-all duration-150 ${
                  isSelected ? "border-primary/40 bg-primary/5"
                  : hasLech  ? "border-red-200 bg-red-50/40 hover:bg-red-50/60"
                  : "border-transparent hover:border-border hover:bg-muted/30"
                }`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
              >
                {/* Checkbox / Status dot */}
                <button
                  type="button"
                  onClick={() => toggleSelect(lk.partNumber)}
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-all ${isSelected ? "border-primary bg-primary" : `border-transparent group-hover:border-border ${lk.quantity <= 0 ? "bg-muted-foreground/20" : lk.quantity < 10 ? "bg-amber-400" : "bg-emerald-500"} group-hover:bg-transparent`}`}
                >
                  {isSelected && <span className="w-2.5 h-2.5 text-primary-foreground font-bold text-[9px] leading-none">✓</span>}
                </button>

                <div className="flex justify-center self-center">
                  <OVuongAnhLinhKien
                    key={`${lk.partNumber}-${lk.hinhAnh ?? ""}`}
                    src={lk.hinhAnh}
                    title={!chiXem ? t("comp.tap_set_image") : lk.partNumber}
                    interactive={!chiXem}
                    onActivate={
                      !chiXem
                        ? () => {
                            setNhanhAnhMa(lk.partNumber);
                            setNhanhAnhUrlInput((lk.hinhAnh ?? "").trim());
                          }
                        : undefined
                    }
                  />
                </div>

                {/* Code */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1 min-w-0 flex-wrap">
                    <span className="font-mono text-sm md:text-[15px] font-semibold text-primary truncate" title={lk.partNumber}>
                      {lk.partNumber}
                    </span>
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded leading-none ${lk.laAssembly ? "bg-blue-100 text-blue-600" : "bg-violet-100 text-violet-600"}`}>
                      {lk.laAssembly ? "TỔNG" : "CON"}
                    </span>
                  </div>
                  {/* Vị trí — inline edit */}
                  {editViTri?.code === lk.partNumber ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-orange-500 shrink-0" />
                      <input
                        ref={viTriInputRef}
                        autoFocus
                        className="w-[4.5rem] text-xs font-mono font-bold uppercase bg-orange-50 border border-orange-300 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-orange-400"
                        value={editViTri.value}
                        maxLength={10}
                        onChange={e => setEditViTri({ code: lk.partNumber, value: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === "Enter") saveViTri(lk.partNumber, editViTri.value);
                          if (e.key === "Escape") setEditViTri(null);
                        }}
                        onBlur={() => saveViTri(lk.partNumber, editViTri.value)}
                        placeholder="VD: M3-1"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <button
                        type="button"
                        className="shrink-0 p-0.5 rounded hover:bg-orange-100/80 transition-colors"
                        title={t("comp.vi_tri_edit_pin")}
                        onClick={() => setEditViTri({ code: lk.partNumber, value: lk.viTriText || "" })}
                      >
                        <MapPin className={`w-3 h-3 ${lk.viTriText ? "text-orange-500" : "text-muted-foreground/30 hover:text-orange-400"}`} />
                      </button>
                      {lk.viTriText ? (
                        <Link
                          to={`/warehouse?vt=${encodeURIComponent(lk.viTriText.trim())}`}
                          className="text-xs font-mono font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 leading-snug py-0.5 hover:bg-orange-100 hover:border-orange-300 transition-colors"
                          title={t("comp.vi_tri_open_map")}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {lk.viTriText}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="text-[11px] text-muted-foreground/30 hover:text-orange-400 italic leading-snug"
                          onClick={() => setEditViTri({ code: lk.partNumber, value: "" })}
                        >
                          Chưa có VT
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Info: mô tả + chips */}
                <div className="min-w-0">
                  {lk.name ? (
                    /* MoTa đầy đủ */
                    <p className="text-base text-foreground line-clamp-2 leading-snug" title={lk.name}>{lk.name}</p>
                  ) : lk.manufacturer ? (
                    /* Fallback: dùng CumVatLieu làm mô tả chính */
                    <p className="text-base text-foreground/80 line-clamp-2 leading-snug font-medium">{lk.manufacturer}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground/50 leading-snug italic">Chưa có mô tả</p>
                  )}
                  {lk.model && (
                    <span className="inline-flex text-[11px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground/70 leading-snug mt-1.5">
                      {lk.model}
                    </span>
                  )}
                </div>

                {/* Đầu kỳ | Ca ngày | Ca đêm | Thực tế */}
                {(() => {
                  const caDem  = lk.quantity;
                  const caNgay = lk.tonCuoiCaNgay;
                  const thucTe = lk.tonThucTe;
                  const lech   = thucTe != null ? thucTe - caDem : 0;
                  const coLech = Math.abs(lech) > 0;

                  const cell = (
                    v: number | null | undefined,
                    bg: string,
                    numColor: (v: number) => string,
                    diff?: number
                  ) => (
                    <div
                      className={`flex flex-col items-center justify-center gap-0.5 py-1 min-h-[2.5rem] ${bg}`}
                      title={v != null && Number.isFinite(v as number) ? String(v as number) : undefined}
                    >
                      <span className={`font-mono font-semibold tabular-nums text-sm leading-none ${
                        v == null || (v as number) <= 0 ? "text-muted-foreground/40" : numColor(v as number)
                      }`}>
                        {v == null ? "—" : formatSoLuongGon(v as number)}
                      </span>
                      {diff !== undefined && Math.abs(diff) > 0 && (
                        <span className={`text-[9px] font-bold leading-none ${diff > 0 ? "text-green-600" : "text-red-600"}`}>
                          {diff > 0 ? `+${formatSoLuongGon(diff)}` : formatSoLuongGon(diff)}
                        </span>
                      )}
                    </div>
                  );

                  return (
                    <div className="min-w-0 space-y-1">
                      <div className="grid grid-cols-4 gap-1 rounded-lg overflow-hidden">
                        {cell(lk.tonDau ?? 0, "rounded-md bg-muted/50 border border-muted-foreground/10",
                              () => "text-foreground/60")}
                        {cell(caNgay,          "rounded-md bg-violet-50 border border-violet-200/60",
                              (v) => v < 10 ? "text-amber-600" : "text-violet-700")}
                        {cell(caDem,           "rounded-md bg-emerald-50 border border-emerald-200/60",
                              (v) => v < 10 ? "text-amber-600" : "text-emerald-700")}
                        {coLech ? (
                          <div
                            className="relative rounded-lg bg-red-500 border-2 border-red-500 flex flex-col items-center justify-center gap-0.5 py-1 min-h-[2.5rem] shadow-md shadow-red-200 ring-2 ring-red-400/40 ring-offset-1"
                            title={thucTe != null ? String(thucTe) : undefined}
                          >
                            <div className="flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3 text-red-100 shrink-0" />
                              <span className="font-mono font-bold tabular-nums text-sm text-white leading-none">
                                {thucTe == null ? "—" : formatSoLuongGon(thucTe)}
                              </span>
                            </div>
                            <span
                              className={`text-[9px] font-bold leading-none px-1 py-0.5 rounded ${lech > 0 ? "bg-green-400/30 text-green-100" : "bg-white/20 text-white"}`}
                              title={t("comp.stock_lech_tooltip")}
                            >
                              {lech > 0 ? `+${formatSoLuongGon(lech)}` : formatSoLuongGon(lech)}
                            </span>
                          </div>
                        ) : (
                          cell(thucTe, "rounded-md bg-sky-50 border border-sky-200/60",
                               () => "text-sky-700")
                        )}
                      </div>
                      {lk.laAssembly && (() => {
                        const coSoLieuTon =
                          (lk.quantity ?? 0) > 0 ||
                          (lk.tonDau ?? 0) > 0 ||
                          (lk.tonCuoiCaNgay != null && lk.tonCuoiCaNgay !== 0) ||
                          (lk.tonThucTe != null && lk.tonThucTe !== 0);
                        if (coSoLieuTon) return null;
                        return (
                        <p className="text-xs leading-snug text-muted-foreground">
                          <span className="font-medium text-foreground/80">Code tổng:</span> chưa có dòng tồn trong DB cho mã này (hoặc báo cáo Excel không có dòng code tổng). Import lại <strong className="text-foreground/90">BÁO CÁO XUẤT NHẬP TỒN</strong> sau khi cập nhật hệ thống; số liệu chi tiết theo từng mã con — mở chi tiết.
                          {lk.kittable != null && lk.kittable >= 0 && (
                            <span className="block mt-0.5 text-sky-800/90 dark:text-sky-300/90">
                              Ước lượng lắp được từ tồn con: <strong className="tabular-nums">{lk.kittable}</strong> bộ (theo BOM).
                            </span>
                          )}
                        </p>
                        );
                      })()}
                    </div>
                  );
                })()}

                {/* Actions — luôn hiện trên cảm ứng; desktop: hover/focus-within */}
                <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity duration-100">
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9" title={t("comp.view_detail")} onClick={() => setAssyChiTiet(lk.partNumber)}>
                    <List className="w-4 h-4" />
                  </Button>
                  {!chiXem && (
                    <>
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" title={t("comp.edit_btn")} onClick={() => openEditForm(lk)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive/60 hover:text-destructive hover:bg-destructive/10" title={t("comp.delete_btn")} onClick={() => setDeleteTarget(lk.partNumber)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>{/* end scroll area */}

      {/* Detail dialog */}
      {assyChiTiet != null && (
        <Dialog open={true} onOpenChange={(open) => !open && setAssyChiTiet(null)}>
          <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-lg">{t("comp.detail_title")} — {assyChiTiet}</DialogTitle>
              <DialogDescription className="mt-0.5 space-y-1">
                <span>{t("comp.detail_subtitle")}</span>
                <span className="block text-xs text-muted-foreground">
                  Cột <strong>Tồn kho</strong> là số lượng theo từng mã con (ca đêm trong hệ thống), không phải số lượng “bộ” của code tổng.
                </span>
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-auto flex-1 -mx-6 px-6 min-h-0">
              <div role="region" aria-busy={taiChiTiet} className="min-h-[120px]">
                {taiChiTiet && <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}
                {!taiChiTiet && chiTietData && chiTietData.rows.length === 0 && <p className="text-sm text-muted-foreground py-4">{t("comp.detail_no_codes")}</p>}
                {!taiChiTiet && chiTietData && chiTietData.rows.length > 0 && (
                  <>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-4 py-2 px-3 bg-muted/50 rounded-lg text-sm">
                      <p><span className="font-medium text-muted-foreground">{t("comp.assy")}:</span> {chiTietData.assy}</p>
                      {chiTietData.model != null && chiTietData.model !== "" && <p><span className="font-medium text-muted-foreground">{t("comp.model_label")}:</span> {chiTietData.model}</p>}
                    </div>
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b-2 border-border bg-muted/30">
                          <th className="text-left py-2.5 pr-2 font-semibold">{t("comp.detail_no")}</th>
                          <th className="text-left py-2.5 pr-2 font-semibold">{t("comp.detail_code")}</th>
                          <th className="text-left py-2.5 pr-2 font-semibold">{t("comp.detail_item_desc")}</th>
                          <th className="text-right py-2.5 pr-2 font-semibold">Tồn kho</th>
                          <th className="text-right py-2.5 pr-2 font-semibold">{t("comp.detail_qty_plan")}</th>
                          <th className="text-right py-2.5 pr-2 font-semibold">{t("comp.detail_qty_kitting")}</th>
                          <th className="text-right py-2.5 pr-2 font-semibold">{t("comp.detail_he_so")}</th>
                          <th className="text-left py-2.5 pr-2 font-semibold">{t("comp.detail_don_vi")}</th>
                          <th className="text-right py-2.5 pr-2 font-semibold">{t("comp.detail_xuat_sx")}</th>
                          <th className="text-left py-2.5 font-semibold">{t("comp.detail_remark")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chiTietData.rows.map((row) => (
                          <tr key={row.id} className="border-b border-border/60 hover:bg-muted/20">
                            <td className="py-2 pr-2">{row.stt ?? "—"}</td>
                            <td className="py-2 pr-2 font-mono text-xs">{row.code ?? "—"}</td>
                            <td className="py-2 pr-2">{row.itemDescription ?? "—"}</td>
                            <td className="py-2 pr-2 text-right tabular-nums font-medium text-emerald-800 dark:text-emerald-300">
                              {row.tonKho != null ? formatSoLuongGon(row.tonKho) : "—"}
                            </td>
                            <td className="py-2 pr-2 text-right tabular-nums">{row.qtyPlan != null ? formatSoLuongGon(row.qtyPlan) : "—"}</td>
                            <td className="py-2 pr-2 text-right tabular-nums">{row.qtyKitting != null ? formatSoLuongGon(row.qtyKitting) : "—"}</td>
                            <td className="py-2 pr-2 text-right tabular-nums">{row.heSo ?? "—"}</td>
                            <td className="py-2 pr-2">{row.donVi ?? "—"}</td>
                            <td className="py-2 pr-2 text-right tabular-nums">{row.xuatSX != null ? formatSoLuongGon(row.xuatSX) : "—"}</td>
                            <td className="py-2 text-muted-foreground">{row.remark ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog
        open={nhanhAnhMa != null}
        onOpenChange={(o) => {
          if (!o) {
            setNhanhAnhMa(null);
            setNhanhAnhUrlInput("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("comp.quick_image_title")}</DialogTitle>
            <DialogDescription>{t("comp.form_image_hint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm">
              <span className="text-muted-foreground">{t("comp.quick_image_code")}: </span>
              <span className="font-mono font-semibold">{nhanhAnhMa ?? ""}</span>
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="quick-image-url">
                {t("comp.form_image_url")}
              </label>
              <Input
                id="quick-image-url"
                value={nhanhAnhUrlInput}
                onChange={(e) => setNhanhAnhUrlInput(e.target.value)}
                placeholder="https://…"
                disabled={dangLuuAnhNhanh}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const u = nhanhAnhUrlInput.trim();
                    if (!u) {
                      toast.error(t("comp.quick_image_need_url"));
                      return;
                    }
                    void luuAnhNhanh(u);
                  }
                }}
              />
            </div>
            <div className="relative flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" aria-hidden />
                <span>{t("comp.quick_image_or")}</span>
                <span className="h-px flex-1 bg-border" aria-hidden />
              </div>
              <input
                ref={quickImageFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadAnhTuMay(f);
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={dangLuuAnhNhanh}
                onClick={() => quickImageFileRef.current?.click()}
              >
                {dangLuuAnhNhanh ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <Upload className="h-4 w-4 shrink-0" aria-hidden />}
                {t("comp.quick_image_pick_file")}
              </Button>
              <p className="text-[11px] text-muted-foreground">{t("comp.quick_image_file_hint")}</p>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={dangLuuAnhNhanh}
              onClick={() => {
                setNhanhAnhMa(null);
                setNhanhAnhUrlInput("");
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={dangLuuAnhNhanh}
              onClick={() => void luuAnhNhanh(null)}
            >
              {t("comp.quick_image_clear")}
            </Button>
            <Button
              type="button"
              className="gap-2"
              disabled={dangLuuAnhNhanh}
              onClick={() => {
                const u = nhanhAnhUrlInput.trim();
                if (!u) {
                  toast.error(t("comp.quick_image_need_url"));
                  return;
                }
                void luuAnhNhanh(u);
              }}
            >
              {dangLuuAnhNhanh ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
              {t("comp.quick_image_save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit form dialog */}
      <LinhKienFormDialog
        open={formOpen}
        mode={formMode}
        initial={formInitial}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          showToast(t("comp.save_ok"));
          loadComponents();
        }}
      />

      {/* Delete confirm dialog */}
      <DeleteConfirmDialog
        open={deleteTarget != null}
        codeTong={deleteTarget ?? ""}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          setDeleteTarget(null);
          showToast(t("comp.delete_ok"));
          loadComponents();
        }}
      />

      {/* Toast notification */}
      {toastMsg && (
        <motion.div
          role="status"
          aria-live="polite"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-foreground text-background text-sm px-4 py-2.5 rounded-lg shadow-lg max-w-[min(90vw,24rem)] text-center"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {toastMsg}
        </motion.div>
      )}

      {/* Floating action bar khi có selection */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-foreground text-background px-4 py-2.5 rounded-xl shadow-xl"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.18 }}
          >
            <span className="text-sm font-medium">
              <span className="font-bold text-primary">{selected.size}</span> mã đã chọn
            </span>
            <div className="w-px h-4 bg-background/20" />
            {!chiXem && (
              <button
                type="button"
                onClick={() => setBulkViTriOpen(true)}
                className="flex items-center gap-1.5 text-sm font-medium hover:text-orange-300 transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
                Đặt vị trí
              </button>
            )}
            <button
              type="button"
              onClick={clearSelection}
              className="hover:text-red-400 transition-colors"
              title="Bỏ chọn tất cả"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <BulkViTriDialog
        open={bulkViTriOpen}
        selected={selectedItems}
        onClose={() => setBulkViTriOpen(false)}
        onDone={({ viTriText, successCodes, failedCodes }) => {
          const v = viTriText || null;
          setTatCaLinhKien((prev) =>
            prev.map((lk) => (successCodes.includes(lk.partNumber) ? { ...lk, viTriText: v } : lk))
          );
          setBulkViTriOpen(false);
          clearSelection();
          if (failedCodes.length === 0) {
            showToast(`Đã lưu vị trí ${v} cho ${successCodes.length} mã`);
          } else {
            showToast(`Đã lưu ${successCodes.length} mã · Lỗi ${failedCodes.length} mã`);
          }
        }}
      />
    </motion.div>
  );
}
