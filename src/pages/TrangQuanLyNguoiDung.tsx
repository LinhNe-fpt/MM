import { useState, useEffect, useRef, useMemo } from "react";
import { API_BASE, apiPost, apiPut, apiDelete } from "@/api/client";
import { fetchCatalogTomTat, type VaiTroRow } from "@/lib/catalogApi";
import { nhanQuyenTuMa } from "@/lib/quyenLabels";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { useAuth } from "@/contexts/NguCanhXacThuc";
import { usePhanTrang } from "@/lib/usePhanTrang";
import { PhanTrang } from "@/components/ui/PhanTrang";
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
import { Plus, Pencil, Trash2, Loader2, ShieldCheck, Eye, Users, UserCog, Camera, Stethoscope } from "lucide-react";
import { Navigate } from "react-router-dom";

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserRow {
  id: number;
  taiKhoan: string;
  hoTen: string | null;
  quyen: string | null;
  anhDaiDien: string | null;
}

interface UserForm {
  taiKhoan: string;
  hoTen: string;
  quyen: string;
  matKhau: string;
}

const EMPTY_FORM: UserForm = { taiKhoan: "", hoTen: "", quyen: "staff", matKhau: "" };
const QUYEN_OPTIONS = ["admin", "staff", "viewer", "nhan_vien", "kiem_kho", "upk", "rma", "y_te"];

/** Màu avatar theo username — nhất quán giữa các lần render */
const AVATAR_COLORS: [string, string][] = [
  ["#3B4FD4", "#EEF0FD"], // ultramarine
  ["#0E7A5A", "#E8F5F1"], // teal
  ["#B45309", "#FEF3E2"], // amber
  ["#7C3AED", "#F3EEFF"], // purple
  ["#C2185B", "#FCE4EC"], // pink
  ["#0277BD", "#E1F5FE"], // blue
];
function avatarColor(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/** Resize ảnh về max 256×256 → base64 JPEG */
function resizeToBase64(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function UserAvatar({ src, name, size = "md" }: { src: string | null; name: string | null; size?: "sm" | "md" | "lg" }) {
  const label = name || "?";
  const initials = label.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || label.slice(0, 2).toUpperCase();
  const [fg, bg] = avatarColor(label);
  const sz = size === "sm" ? "w-8 h-8 text-[11px]" : size === "lg" ? "w-14 h-14 text-lg" : "w-10 h-10 text-sm";
  if (src) return <img src={src} alt={label} className={`${sz} rounded-full object-cover ring-2 ring-white/80 shadow-sm`} />;
  return (
    <span
      className={`${sz} rounded-full flex items-center justify-center font-bold ring-2 ring-white/80 shadow-sm shrink-0`}
      style={{ backgroundColor: bg, color: fg }}
    >
      {initials}
    </span>
  );
}

// ─── Role badge ───────────────────────────────────────────────────────────────

function QuyenBadge({
  quyen,
  size = "sm",
  tenCatalog,
}: {
  quyen: string | null;
  size?: "sm" | "xs";
  /** Tên hiển thị từ bảng VaiTro (nếu có) */
  tenCatalog?: string | null;
}) {
  const { t } = useI18n();
  const base = size === "xs"
    ? "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold"
    : "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold";
  if (quyen === "admin") return (
    <span className={`${base} bg-primary/10 text-primary border border-primary/20`}>
      <ShieldCheck className={size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {t("users.role_admin")}
    </span>
  );
  if (quyen === "viewer") return (
    <span className={`${base} bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700`}>
      <Eye className={size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {t("users.role_viewer")}
    </span>
  );
  if (quyen === "y_te") return (
    <span className={`${base} bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800`}>
      <Stethoscope className={size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {t("users.role_y_te")}
    </span>
  );
  const label = tenCatalog?.trim() ? tenCatalog.trim() : nhanQuyenTuMa(quyen, t);
  return (
    <span className={`${base} bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800`}>
      <UserCog className={size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {label}
    </span>
  );
}

// ─── User Card ────────────────────────────────────────────────────────────────

function UserCard({ u, idx, onEdit, onDelete, tenVaiTro }: {
  u: UserRow;
  idx: number;
  onEdit: (u: UserRow) => void;
  onDelete: (u: UserRow) => void;
  tenVaiTro?: string | null;
}) {
  const { t } = useI18n();
  return (
    <motion.div
      className="group relative bg-card border border-border rounded-xl p-4 hover:border-primary/30 hover:shadow-md transition-all duration-200"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05, duration: 0.25 }}
    >
      {/* Actions — xuất hiện khi hover */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <button
          type="button"
          onClick={() => onEdit(u)}
          className="p-1.5 rounded-md bg-background border border-border hover:border-primary hover:text-primary text-muted-foreground transition-colors shadow-sm"
          title={t("comp.edit_btn")}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(u)}
          className="p-1.5 rounded-md bg-background border border-border hover:border-destructive hover:text-destructive text-muted-foreground transition-colors shadow-sm"
          title={t("comp.delete_btn")}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex items-center gap-3">
        <UserAvatar src={u.anhDaiDien} name={u.hoTen || u.taiKhoan} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">{u.hoTen ?? u.taiKhoan}</p>
          <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">@{u.taiKhoan}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <QuyenBadge quyen={u.quyen} tenCatalog={tenVaiTro} />
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">#{u.id}</span>
      </div>
    </motion.div>
  );
}

// ─── User Form Dialog ─────────────────────────────────────────────────────────

function UserFormDialog({
  open,
  mode,
  initial,
  editId,
  initialAvatar,
  vaiTroRows: vaiTroRowsProp,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "add" | "edit";
  initial: UserForm;
  editId?: number;
  initialAvatar?: string | null;
  /** Luôn coi như mảng — tránh crash khi API catalog 503 / prop thiếu */
  vaiTroRows?: VaiTroRow[] | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const listVaiTro = Array.isArray(vaiTroRowsProp) ? vaiTroRowsProp : [];
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<UserForm>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialAvatar ?? null);

  useEffect(() => {
    if (open) { setForm(initial); setError(null); setAvatarPreview(initialAvatar ?? null); }
  }, [open, initial, initialAvatar]);

  function set(field: keyof UserForm, val: string) { setForm((f) => ({ ...f, [field]: val })); }

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setAvatarPreview(await resizeToBase64(file)); } catch { /* ignore */ }
    e.target.value = "";
  }

  async function handleSave() {
    if (mode === "add" && !form.taiKhoan.trim()) {
      setError(`${t("users.form_required")}: ${t("users.form_account")}`);
      return;
    }
    if (mode === "add" && !form.matKhau.trim()) {
      setError(`${t("users.form_required")}: ${t("users.form_password")}`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (mode === "add") {
        await apiPost("/api/users", {
          taiKhoan: form.taiKhoan.trim(),
          matKhau: form.matKhau,
          hoTen: form.hoTen.trim() || null,
          quyen: form.quyen,
        });
      } else if (editId != null) {
        await apiPut(`/api/users/${editId}`, {
          hoTen: form.hoTen.trim() || null,
          quyen: form.quyen,
          matKhauMoi: form.matKhau.trim() || undefined,
          anhDaiDien: avatarPreview ?? null,
        });
      }
      onSaved();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes("ton tai") ? `${form.taiKhoan} — ${t("error.account_exists")}` : msg);
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";

  const previewName = form.hoTen || form.taiKhoan || "?";
  const [fg, bg] = avatarColor(previewName);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? t("users.form_title_add") : t("users.form_title_edit")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          {/* Avatar preview (edit mode) */}
          {mode === "edit" && (
            <div className="flex items-center gap-4 pb-1">
              <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
                {avatarPreview
                  ? <img src={avatarPreview} alt="" className="w-16 h-16 rounded-full object-cover ring-4 ring-border group-hover:ring-primary/30 transition-all" />
                  : <span className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold ring-4 ring-border group-hover:ring-primary/30 transition-all" style={{ backgroundColor: bg, color: fg }}>
                      {previewName.slice(0, 2).toUpperCase()}
                    </span>
                }
                <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
              </div>
              <div>
                <p className="text-xs font-medium">{t("users.avatar_hint")}</p>
                {avatarPreview && (
                  <button type="button" onClick={() => setAvatarPreview(null)} className="text-[11px] text-destructive mt-1 hover:underline">
                    {t("users.avatar_remove")}
                  </button>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t("users.form_account")} {mode === "add" && <span className="text-destructive">*</span>}
            </label>
            <input className={inp} value={form.taiKhoan} onChange={(e) => set("taiKhoan", e.target.value)}
              disabled={mode === "edit"} placeholder={`${t("common.eg")} ${t("common.ph_account")}`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t("users.form_name")}</label>
            <input className={inp} value={form.hoTen} onChange={(e) => set("hoTen", e.target.value)} placeholder={t("common.ph_name")} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t("users.form_role")}</label>
            <select className={inp + " cursor-pointer"} value={form.quyen} onChange={(e) => set("quyen", e.target.value)}>
              {listVaiTro.length > 0 ? (
                (() => {
                  const byDept = new Map<string, VaiTroRow[]>();
                  for (const v of listVaiTro) {
                    const k = v.TenBoPhan || v.MaBoPhan;
                    if (!byDept.has(k)) byDept.set(k, []);
                    byDept.get(k)!.push(v);
                  }
                  return Array.from(byDept.entries()).map(([deptLabel, rows]) => (
                    <optgroup key={deptLabel} label={deptLabel}>
                      {rows.map((v) => (
                        <option key={v.MaVaiTro} value={v.MaVaiTro}>
                          {v.TenHienThi} ({v.MaVaiTro})
                        </option>
                      ))}
                    </optgroup>
                  ));
                })()
              ) : (
                QUYEN_OPTIONS.map((q) => (
                  <option key={q} value={q}>
                    {nhanQuyenTuMa(q, t)}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {mode === "add" ? <>{t("users.form_password")} <span className="text-destructive">*</span></> : t("users.form_password_new")}
            </label>
            <input type="password" className={inp} value={form.matKhau} onChange={(e) => set("matKhau", e.target.value)}
              placeholder={mode === "edit" ? "••••••••" : t("common.ph_password")} autoComplete="new-password" />
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="gap-2 mt-1">
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t("users.form_cancel")}</Button>
          <Button onClick={handleSave} disabled={saving} className="min-w-[80px]">
            <Loader2 className={`w-3.5 h-3.5 mr-1.5 animate-spin transition-opacity ${saving ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}`} />
            {t("users.form_save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

function DeleteUserDialog({ open, user, onClose, onDeleted }: {
  open: boolean;
  user: UserRow | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) setError(null); }, [open]);

  async function handleDelete() {
    if (!user) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/users/${user.id}`);
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
          <DialogTitle className="text-destructive">{t("users.confirm_delete")}</DialogTitle>
          <DialogDescription className="mt-1 text-sm">{t("users.confirm_delete_desc")}</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          {user && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <UserAvatar src={user.anhDaiDien} name={user.hoTen || user.taiKhoan} size="sm" />
              <div>
                <p className="text-sm font-semibold">{user.hoTen ?? user.taiKhoan}</p>
                <p className="text-[11px] text-muted-foreground font-mono">@{user.taiKhoan}</p>
              </div>
            </div>
          )}
          {error && <p className="mt-2 text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={deleting}>{t("users.form_cancel")}</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            <Loader2 className={`w-3.5 h-3.5 mr-1.5 animate-spin transition-opacity ${deleting ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}`} />
            {t("users.confirm_delete_btn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${color}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <span className="font-bold tabular-nums">{value}</span>
      <span className="text-xs opacity-70">{label}</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TrangQuanLyNguoiDung() {
  const { t } = useI18n();
  const { user } = useAuth();

  const quyen = (user?.user_metadata as { quyen?: string } | undefined)?.quyen;
  if (quyen !== "admin") return <Navigate to="/" replace />;

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [formInitial, setFormInitial] = useState<UserForm>(EMPTY_FORM);
  const [editId, setEditId] = useState<number | undefined>();
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [vaiTroRows, setVaiTroRows] = useState<VaiTroRow[]>([]);

  const tenTheoQuyen = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of vaiTroRows ?? []) m.set(v.MaVaiTro, v.TenHienThi);
    return m;
  }, [vaiTroRows]);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  function loadUsers() {
    setLoading(true);
    fetch(`${API_BASE}/api/users`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: UserRow[]) => setUsers(Array.isArray(list) ? list : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    fetchCatalogTomTat()
      .then((d) => setVaiTroRows(d.vaiTro))
      .catch(() => setVaiTroRows([]));
  }, []);

  function openAdd() {
    setFormInitial(EMPTY_FORM);
    setFormMode("add");
    setEditId(undefined);
    setFormOpen(true);
  }

  function openEdit(u: UserRow) {
    setFormInitial({ taiKhoan: u.taiKhoan, hoTen: u.hoTen ?? "", quyen: u.quyen ?? "staff", matKhau: "" });
    setEditAvatar(u.anhDaiDien ?? null);
    setFormMode("edit");
    setEditId(u.id);
    setFormOpen(true);
  }

  const countAdmin = users.filter((u) => u.quyen === "admin").length;
  const countStaff = users.filter((u) => u.quyen === "staff").length;
  const countYTe = users.filter((u) => u.quyen === "y_te").length;

  const { page, setPage, totalPages, slice: usersTrang, pageSize } = usePhanTrang(users);

  return (
    <motion.div
      className="flex flex-col h-full max-w-4xl mx-auto"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* ── Header ── */}
      <div className="shrink-0 px-4 md:px-6 pt-4 md:pt-6 pb-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">{t("users.title")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("users.subtitle")}</p>
          </div>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={openAdd}>
            <Plus className="w-4 h-4" />
            {t("users.add_btn")}
          </Button>
        </div>

        {/* Stats */}
        {!loading && users.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <StatPill icon={Users} label={t("users.col_account")} value={users.length}
              color="bg-primary/8 border-primary/20 text-primary" />
            <StatPill icon={ShieldCheck} label={t("users.role_admin")} value={countAdmin}
              color="bg-primary/5 border-primary/15 text-primary/80" />
            <StatPill icon={UserCog} label={t("users.role_staff")} value={countStaff}
              color="bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400" />
            <StatPill icon={Stethoscope} label={t("users.stat_y_te")} value={countYTe}
              color="bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300" />
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-border" />
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <Users className="w-10 h-10 opacity-30" />
            <p className="text-sm">{t("users.no_users")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {usersTrang.map((u, idx) => (
                <UserCard
                  key={u.id}
                  u={u}
                  idx={(page - 1) * pageSize + idx}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                  tenVaiTro={u.quyen ? tenTheoQuyen.get(u.quyen) ?? null : null}
                />
              ))}
            </div>
            <PhanTrang
              trangHienTai={page}
              tongSoTrang={totalPages}
              tongSoMuc={users.length}
              onChuyenTrang={setPage}
              nhanTomTat={t("comp.pagination_items")}
            />
          </div>
        )}
      </div>

      {/* ── Dialogs ── */}
      <UserFormDialog
        open={formOpen}
        mode={formMode}
        initial={formInitial}
        editId={editId}
        initialAvatar={editAvatar}
        vaiTroRows={vaiTroRows ?? []}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); showToast(t("users.save_ok")); loadUsers(); }}
      />
      <DeleteUserDialog
        open={deleteTarget != null}
        user={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => { setDeleteTarget(null); showToast(t("users.delete_ok")); loadUsers(); }}
      />

      {/* ── Toast ── */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background text-sm px-4 py-2.5 rounded-lg shadow-lg whitespace-nowrap"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.18 }}
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
