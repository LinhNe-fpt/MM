import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, RotateCcw, ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react";
import { API_BASE } from "@/api/client";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { Button } from "@/components/ui/button";

interface DanhMuc {
  id: number;
  loaiGiaoDich: "IN" | "OUT";
  tenDanhMuc: string;
  moTa: string;
  thuTu: number;
  dangHoatDong: boolean;
}

function BadgeLoai({ loai }: { loai: "IN" | "OUT" }) {
  return loai === "IN" ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
      <ArrowDownToLine className="w-2.5 h-2.5" />IN
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
      <ArrowUpFromLine className="w-2.5 h-2.5" />OUT
    </span>
  );
}

export default function TrangDanhMuc() {
  const { t } = useI18n();
  const [items, setItems] = useState<DanhMuc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // Form thêm mới
  const [newLoai, setNewLoai]   = useState<"IN" | "OUT">("IN");
  const [newTen, setNewTen]     = useState("");
  const [newMoTa, setNewMoTa]   = useState("");
  const [newThuTu, setNewThuTu] = useState("");
  const [addError, setAddError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/categories/all`);
      if (res.ok) setItems(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (item: DanhMuc) => {
    setBusy(true);
    try {
      await fetch(`${API_BASE}/api/categories/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moTa: item.moTa, thuTu: item.thuTu, dangHoatDong: !item.dangHoatDong }),
      });
      await load();
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Xoá danh mục này?")) return;
    setBusy(true);
    try {
      await fetch(`${API_BASE}/api/categories/${id}`, { method: "DELETE" });
      await load();
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  const handleAdd = async () => {
    if (!newTen.trim()) { setAddError("Tên danh mục không được trống"); return; }
    setBusy(true);
    setAddError("");
    try {
      const res = await fetch(`${API_BASE}/api/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loaiGiaoDich: newLoai,
          tenDanhMuc: newTen.trim().toUpperCase(),
          moTa: newMoTa.trim(),
          thuTu: newThuTu ? parseInt(newThuTu) : 99,
        }),
      });
      if (res.status === 409) { setAddError("Danh mục này đã tồn tại"); return; }
      if (!res.ok) { setAddError("Lỗi khi thêm danh mục"); return; }
      setNewTen(""); setNewMoTa(""); setNewThuTu("");
      setShowAdd(false);
      await load();
    } catch { setAddError("Lỗi kết nối"); } finally { setBusy(false); }
  };

  const inItems  = items.filter(i => i.loaiGiaoDich === "IN");
  const outItems = items.filter(i => i.loaiGiaoDich === "OUT");

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Danh mục giao dịch</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Quản lý các loại nhập/xuất — đồng bộ với phiếu giao dịch</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="gap-1.5 shrink-0">
          <Plus className="w-4 h-4" />
          Thêm loại
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="border border-border rounded-xl p-4 bg-muted/30 space-y-3">
          <p className="text-sm font-semibold">Thêm danh mục mới</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Loại *</label>
              <select
                value={newLoai}
                onChange={e => setNewLoai(e.target.value as "IN" | "OUT")}
                className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-lg"
              >
                <option value="IN">IN — Nhập kho</option>
                <option value="OUT">OUT — Xuất kho</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Tên *</label>
              <input
                type="text"
                value={newTen}
                onChange={e => setNewTen(e.target.value)}
                placeholder="VD: IQC, KITTING..."
                className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-lg"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="text-xs font-medium text-muted-foreground block mb-1">Mô tả</label>
              <input
                type="text"
                value={newMoTa}
                onChange={e => setNewMoTa(e.target.value)}
                placeholder="Giải thích ngắn..."
                className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Thứ tự</label>
              <input
                type="number"
                value={newThuTu}
                onChange={e => setNewThuTu(e.target.value)}
                placeholder="99"
                className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-lg"
              />
            </div>
          </div>
          {addError && <p className="text-xs text-destructive">{addError}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Lưu
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setAddError(""); }}>Huỷ</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-5">
          {/* IN */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownToLine className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">Nhập kho (IN)</span>
              <span className="text-xs text-muted-foreground ml-auto">{inItems.filter(i => i.dangHoatDong).length} hoạt động</span>
            </div>
            <div className="space-y-1.5">
              {inItems.map(item => (
                <CategoryRow key={item.id} item={item} onToggle={handleToggle} onDelete={handleDelete} busy={busy} />
              ))}
              {inItems.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Chưa có danh mục nhập</p>}
            </div>
          </div>

          {/* OUT */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpFromLine className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Xuất kho (OUT)</span>
              <span className="text-xs text-muted-foreground ml-auto">{outItems.filter(i => i.dangHoatDong).length} hoạt động</span>
            </div>
            <div className="space-y-1.5">
              {outItems.map(item => (
                <CategoryRow key={item.id} item={item} onToggle={handleToggle} onDelete={handleDelete} busy={busy} />
              ))}
              {outItems.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Chưa có danh mục xuất</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryRow({ item, onToggle, onDelete, busy }: {
  item: DanhMuc;
  onToggle: (item: DanhMuc) => void;
  onDelete: (id: number) => void;
  busy: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
      item.dangHoatDong
        ? "border-border bg-card"
        : "border-border/40 bg-muted/30 opacity-50"
    }`}>
      <BadgeLoai loai={item.loaiGiaoDich} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-xs truncate">{item.tenDanhMuc}</p>
        {item.moTa && <p className="text-[10px] text-muted-foreground truncate">{item.moTa}</p>}
      </div>
      <span className="text-[10px] text-muted-foreground shrink-0">#{item.thuTu}</span>
      <button
        type="button"
        onClick={() => onToggle(item)}
        disabled={busy}
        className="p-1 rounded hover:bg-muted text-muted-foreground"
        title={item.dangHoatDong ? "Tắt danh mục" : "Bật lại"}
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        disabled={busy}
        className="p-1 rounded hover:bg-red-50 hover:text-red-600 text-muted-foreground transition-colors"
        title="Xoá"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
