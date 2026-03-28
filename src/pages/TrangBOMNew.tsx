import { useState, useCallback, useRef, useMemo } from "react";
import {
  Search, ChevronRight, ChevronDown, Calculator, ArrowUpFromLine,
  Loader2, Package, GitBranch, RefreshCw, Download, Upload, Database,
  CheckCircle2, XCircle, AlertTriangle, type LucideIcon,
} from "lucide-react";
import { API_BASE } from "@/api/client";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

/** Luôn render cả 2 icon bằng CSS opacity — không bao giờ swap DOM node. */
function SpinIcon({ busy, Icon, cls = "w-4 h-4" }: { busy: boolean; Icon: LucideIcon; cls?: string }) {
  return (
    <span
      className="relative flex items-center justify-center shrink-0"
      style={{ width: "1rem", height: "1rem" }}
      aria-hidden
    >
      <Loader2 className={`absolute ${cls} animate-spin transition-opacity ${busy ? "opacity-100" : "opacity-0"}`} />
      <Icon  className={`${cls} transition-opacity ${busy ? "opacity-0" : "opacity-100"}`} />
    </span>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Part {
  code: string; moTa: string | null; model: string | null;
  laAssembly: boolean; cumVatLieu: string | null;
}
interface BomItem {
  codeCon: string; moTa: string | null; model: string | null;
  heSo: number; cumVatLieu: string | null; laAssembly: boolean; thuTu: number | null;
  maBOM: number;
}
interface BomExpanded extends BomItem {
  heSoTichLuy: number; capDo: number; duongDan: string;
}
interface KittingItem {
  code: string; moTa: string | null; cumVatLieu: string | null;
  heSoTong: number; soLuongCan: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>{label}</span>;
}

function CumBadge({ cum }: { cum: string | null }) {
  if (!cum) return null;
  const colors: Record<string, string> = {
    FRONT: "bg-blue-100 text-blue-700",
    REAR:  "bg-amber-100 text-amber-700",
  };
  return <Badge label={cum} color={colors[cum] ?? "bg-muted text-muted-foreground"} />;
}

// ─── Component: Kết quả BOM 1 cấp ────────────────────────────────────────────

function BomTable({ items, loading }: { items: BomItem[]; loading: boolean }) {
  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!items.length) return <p className="text-sm text-muted-foreground text-center py-8">Không có dữ liệu BOM</p>;
  return (
    <div className="overflow-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/50 text-muted-foreground">
            <th className="py-2 px-3 text-left font-semibold w-8">#</th>
            <th className="py-2 px-3 text-left font-semibold">Code Con</th>
            <th className="py-2 px-3 text-left font-semibold">Mô tả</th>
            <th className="py-2 px-3 text-left font-semibold">Cụm</th>
            <th className="py-2 px-3 text-right font-semibold w-16">Hệ số</th>
            <th className="py-2 px-3 text-center font-semibold w-20">Loại</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.maBOM} className="border-t border-border hover:bg-muted/30 transition-colors">
              <td className="py-1.5 px-3 text-muted-foreground">{i + 1}</td>
              <td className="py-1.5 px-3 font-mono font-semibold">{item.codeCon}</td>
              <td className="py-1.5 px-3 text-muted-foreground max-w-xs truncate" title={item.moTa || ""}>{item.moTa || "—"}</td>
              <td className="py-1.5 px-3"><CumBadge cum={item.cumVatLieu} /></td>
              <td className="py-1.5 px-3 text-right tabular-nums font-medium">{item.heSo}</td>
              <td className="py-1.5 px-3 text-center">
                {item.laAssembly
                  ? <Badge label="Assembly" color="bg-purple-100 text-purple-700" />
                  : <Badge label="Leaf"     color="bg-green-100 text-green-700" />}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-muted/30">
            <td colSpan={6} className="py-1.5 px-3 text-xs text-muted-foreground text-right">{items.length} linh kiện</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Component: BOM đa cấp (tree) ────────────────────────────────────────────

function BomTreeRow({ item, depth }: { item: BomExpanded; depth: number }) {
  return (
    <tr className="border-t border-border hover:bg-muted/20 transition-colors">
      <td className="py-1.5 px-3">
        <div className="flex items-center gap-1" style={{ paddingLeft: depth * 16 }}>
          {item.laAssembly
            ? <ChevronRight className="w-3 h-3 text-purple-500 shrink-0" />
            : <span className="w-3 shrink-0" />}
          <span className="font-mono text-xs font-semibold">{item.codeCon}</span>
        </div>
      </td>
      <td className="py-1.5 px-3 text-xs text-muted-foreground max-w-xs truncate">{item.moTa || "—"}</td>
      <td className="py-1.5 px-3 text-center"><CumBadge cum={item.cumVatLieu} /></td>
      <td className="py-1.5 px-3 text-right tabular-nums text-xs">{item.heSo}</td>
      <td className="py-1.5 px-3 text-right tabular-nums text-xs font-semibold text-primary">{item.heSoTichLuy.toFixed(4).replace(/\.?0+$/, "")}</td>
      <td className="py-1.5 px-3 text-center text-xs text-muted-foreground">Cấp {item.capDo}</td>
    </tr>
  );
}

// ─── Component: Kitting calculator ────────────────────────────────────────────

function KittingPanel({ codeTong }: { codeTong: string }) {
  const [soLuong, setSoLuong] = useState("100");
  const [result, setResult]   = useState<KittingItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const calc = async () => {
    const sl = parseInt(soLuong);
    if (!sl || sl <= 0) { setError("Nhập số lượng hợp lệ"); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API_BASE}/api/bom-new/kitting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codeTong, soLuong: sl }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || "Lỗi"); return; }
      setResult(data.kitting);
    } catch { setError("Lỗi kết nối"); }
    finally { setLoading(false); }
  };

  const exportCsv = () => {
    if (!result) return;
    const header = "Code,Mô tả,Cụm vật liệu,Hệ số tổng,Số lượng cần";
    const rows = result.map(r =>
      `"${r.code}","${r.moTa || ""}","${r.cumVatLieu || ""}",${r.heSoTong},${r.soLuongCan}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `kitting_${codeTong}_${soLuong}pcs.csv`; a.click();
  };

  const byGroup = useMemo(() => result
    ? result.reduce<Record<string, KittingItem[]>>((acc, item) => {
        const key = item.cumVatLieu || "Khác";
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {})
    : null, [result]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground block mb-1">Số lượng sản phẩm</label>
          <input
            type="number" min="1" value={soLuong}
            onChange={e => setSoLuong(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg"
            placeholder="VD: 100"
          />
        </div>
        <Button size="sm" onClick={calc} disabled={loading} className="mt-5 gap-1.5" translate="no">
          <SpinIcon busy={loading} Icon={Calculator} cls="w-3.5 h-3.5" />
          <span translate="no">Tính</span>
        </Button>
        {result && (
          <Button size="sm" variant="outline" onClick={exportCsv} className="mt-5 gap-1.5">
            <Download className="w-3.5 h-3.5" />CSV
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}

      {byGroup && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Cần <span className="font-semibold text-foreground">{result!.length}</span> loại linh kiện cho <span className="font-semibold text-primary">{parseInt(soLuong).toLocaleString()}</span> sản phẩm
          </p>
          {Object.entries(byGroup).map(([group, items]) => (
            <div key={group}>
              <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                <CumBadge cum={group !== "Khác" ? group : null} />
                {group} <span className="font-normal">({items.length})</span>
              </p>
              <div className="overflow-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground">
                      <th className="py-1.5 px-2 text-left font-semibold">Code</th>
                      <th className="py-1.5 px-2 text-left font-semibold">Mô tả</th>
                      <th className="py-1.5 px-2 text-right font-semibold">Hệ số</th>
                      <th className="py-1.5 px-2 text-right font-semibold text-primary">SL cần</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.code} className="border-t border-border hover:bg-muted/20">
                        <td className="py-1 px-2 font-mono font-semibold">{item.code}</td>
                        <td className="py-1 px-2 text-muted-foreground max-w-[200px] truncate">{item.moTa || "—"}</td>
                        <td className="py-1 px-2 text-right tabular-nums">{item.heSoTong}</td>
                        <td className="py-1 px-2 text-right tabular-nums font-bold text-primary">{item.soLuongCan.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Import Excel Dialog ──────────────────────────────────────────────────────

type ImportMode   = "merge" | "replace";
type ImportSheets = "both" | "bom" | "inbom";
interface ImportStats {
  partsNew: number; partsSkipped: number;
  bomNew: number; bomSkipped: number; bomDuplicate: number;
  totalRows: number;
  sheetStats: { sheet: string; rows: number }[];
  sheetsFound: string[];
  db: { TongParts: number; TongAssembly: number; TongBOM: number; UniqueTong: number };
}

function ImportExcelDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone?: () => void }) {
  const [file, setFile]       = useState<File | null>(null);
  const [mode, setMode]       = useState<ImportMode>("merge");
  const [sheets, setSheets]   = useState<ImportSheets>("both");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<ImportStats | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null); setResult(null); setError(null); setLoading(false);
  }

  function handleClose() { reset(); onClose(); }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f); setResult(null); setError(null);
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", mode);
      fd.append("sheets", sheets);
      const r = await fetch(`${API_BASE}/api/import-excel/bom`, { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Lỗi import");
      setResult(d.stats);
      onDone?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg" aria-describedby="import-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Import BOM từ Excel
          </DialogTitle>
          <DialogDescription id="import-desc">
            Upload file <span className="font-mono">.xlsx</span> theo định dạng{" "}
            <span className="font-semibold">KITTING BOM A5</span> — sheet <span className="font-mono">BOM</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* File picker */}
          <div
            onClick={() => fileRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors
              ${file ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/50"}`}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
            {file ? (
              <>
                <CheckCircle2 className="w-8 h-8 text-primary" />
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm font-medium">Kéo thả hoặc click để chọn file</p>
                <p className="text-xs text-muted-foreground">Hỗ trợ .xlsx, .xls · Tối đa 20MB</p>
              </>
            )}
          </div>

          {/* Chọn sheet */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Sheet cần import</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { val: "both",  label: "Cả 2 sheet",    desc: "BOM + IN BOM THƯỜNG" },
                { val: "bom",   label: "Sheet BOM",      desc: "Nhiều assembly" },
                { val: "inbom", label: "IN BOM THƯỜNG",  desc: "1 assembly, dạng phiếu" },
              ] as const).map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setSheets(opt.val)}
                  className={`flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl border-2 text-left transition-all
                    ${sheets === opt.val ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-border/80"}`}
                >
                  <span className="text-xs font-semibold">{opt.label}</span>
                  <span className="text-[10px] leading-tight">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chế độ import */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Chế độ import</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { val: "merge",   label: "Bổ sung",   desc: "Thêm mới, giữ dữ liệu cũ" },
                { val: "replace", label: "Thay thế",  desc: "Xoá tất cả, import lại" },
              ] as const).map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setMode(opt.val)}
                  className={`flex flex-col items-start gap-0.5 px-4 py-3 rounded-xl border-2 text-left transition-all
                    ${mode === opt.val ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-border/80"}`}
                >
                  <span className="text-sm font-semibold">{opt.label}</span>
                  <span className="text-xs">{opt.desc}</span>
                </button>
              ))}
            </div>
            {mode === "replace" && (
              <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Chế độ này sẽ <strong>xoá toàn bộ</strong> Parts và BOMItems hiện tại trước khi import.</span>
              </div>
            )}
          </div>

          {/* Kết quả */}
          {result && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Import thành công
              </div>

              {/* Sheet breakdown */}
              {result.sheetStats?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {result.sheetStats.map(s => (
                    <span key={s.sheet} className="inline-flex items-center gap-1.5 text-[10px] font-mono bg-green-100 text-green-800 rounded px-2 py-0.5">
                      <span className="font-bold">{s.sheet}</span>
                      <span className="opacity-70">→ {s.rows.toLocaleString()} dòng</span>
                    </span>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-green-800">
                <span>Tổng dòng đọc được:</span><span className="font-mono font-bold text-right">{result.totalRows.toLocaleString()}</span>
                <span>Parts thêm mới:</span>     <span className="font-mono font-bold text-right text-green-600">+{result.partsNew.toLocaleString()}</span>
                <span>Parts bỏ qua:</span>       <span className="font-mono text-right">{result.partsSkipped.toLocaleString()}</span>
                <span>BOM thêm mới:</span>       <span className="font-mono font-bold text-right text-green-600">+{result.bomNew.toLocaleString()}</span>
                <span>BOM bỏ qua:</span>         <span className="font-mono text-right">{result.bomSkipped.toLocaleString()}</span>
                <span>BOM trùng lặp:</span>      <span className="font-mono text-right">{result.bomDuplicate.toLocaleString()}</span>
              </div>
              <div className="border-t border-green-200 pt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-green-900">
                <span className="font-semibold">DB sau import:</span><span />
                <span>Tổng Parts:</span>  <span className="font-mono text-right font-bold">{result.db.TongParts.toLocaleString()}</span>
                <span>Assembly:</span>   <span className="font-mono text-right">{result.db.TongAssembly.toLocaleString()}</span>
                <span>BOM items:</span>  <span className="font-mono text-right font-bold">{result.db.TongBOM.toLocaleString()}</span>
                <span>Code Tổng:</span> <span className="font-mono text-right">{result.db.UniqueTong.toLocaleString()}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={loading}>Đóng</Button>
          <Button onClick={handleImport} disabled={!file || loading} className="gap-1.5" translate="no">
            <SpinIcon busy={loading} Icon={Upload} />
            <span translate="no">{loading ? "Đang import..." : "Import"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = "bom1" | "tree" | "kitting" | "parents";

// ─── Dialog: Import BÁO CÁO Tồn Kho ──────────────────────────────────────────
function ImportBaoCaoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [file, setFile]     = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    sheets?: number;
    cdSheets?: number;
    cnSheets?: number;
    tongCa: number;
    tongPhieu: number;
    tongChiTiet: number;
    maCoTon: number;
    partsAutoCreated: number;
    sheetStats?: { sheet: string; valid: number; total: number }[];
    db: { TongTon: number; MaCoTon?: number; TongCa?: number; TongPhieu?: number; TongChiTiet?: number };
  } | null>(null);
  const [error, setError]   = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleClose() { if (!loading) { setFile(null); setResult(null); setError(""); onClose(); } }

  async function handleImport() {
    if (!file) return;
    setLoading(true); setResult(null); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE}/api/import-excel/baocao`, { method: "POST", body: fd });
      const d   = await res.json();
      if (!res.ok) throw new Error(d.error || "Lỗi không xác định");
      setResult(d.stats);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Import Tồn Kho từ BÁO CÁO
          </DialogTitle>
          <DialogDescription>
            Upload file <strong>BÁO CÁO XUẤT NHẬP TỒN</strong> (.xlsx). Hệ thống sẽ tự động đọc
            toàn bộ ca làm việc, giao dịch NHẬP/XUẤT và cập nhật tồn kho hiện tại.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File picker */}
          <div
            className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
            onClick={() => fileRef.current?.click()}
          >
            <Database className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            {file
              ? <p className="text-sm font-medium text-primary">{file.name}</p>
              : <>
                  <p className="text-sm font-medium">Chọn file BÁO CÁO XUẤT NHẬP TỒN</p>
                  <p className="text-xs text-muted-foreground mt-1">BÁO CÁO XUẤT NHẬP TỒN MM THÁNG XX.xlsx</p>
                </>
            }
            <input
              ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { setFile(e.target.files?.[0] || null); setResult(null); setError(""); }}
            />
          </div>

          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 space-y-1">
            <p className="font-semibold text-foreground">Dữ liệu sẽ được import:</p>
            <p>• Mỗi sheet (CN/CD X.X) → 1 ca làm việc lịch sử</p>
            <p>• Giao dịch NHẬP: UPK, IQC, SX Trả lại, RMA OK...</p>
            <p>• Giao dịch XUẤT: Kitting, RMA, SX UPL, FB UPL...</p>
            <p>• <strong>Tồn kho</strong>: với mỗi mã lấy dòng từ sheet <strong>CD/CN gần nhất</strong> còn chứa mã (kể cả Code Tổng chỉ có ở giữa tháng)</p>
            <p>• <strong>Ca ngày</strong> (CN) → cột ca ngày; <strong>Ca đêm</strong> (CD) → tồn hệ thống (SoLuongTon)</p>
            <p>• Tồn thực tế (cột kiểm đếm) được lưu riêng</p>
            <p>• Vị trí kho (nếu có cột VỊ TRÍ) được tự động đọc</p>
            <p>• Mã chưa có trong hệ thống sẽ được tự động tạo</p>
            <p className="text-amber-600 font-medium">⚠ Dữ liệu ca/phiếu cũ sẽ bị xoá và thay thế</p>
          </div>

          {result && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-green-800">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> Import thành công!
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-green-800">
                {result.partsAutoCreated > 0 && <>
                  <span className="text-amber-700">Mã mới tự động tạo:</span>
                  <span className="font-mono font-bold text-right text-amber-700">{result.partsAutoCreated}</span>
                </>}
                {(result.cdSheets != null || result.cnSheets != null) && <>
                  <span>Sheet CD / CN:</span>
                  <span className="font-mono font-bold text-right">{result.cdSheets ?? "—"} / {result.cnSheets ?? "—"}</span>
                </>}
                <span>Ca làm việc:</span>      <span className="font-mono font-bold text-right">{result.tongCa}</span>
                <span>Phiếu kho:</span>        <span className="font-mono font-bold text-right">{result.tongPhieu}</span>
                <span>Chi tiết phiếu:</span>   <span className="font-mono font-bold text-right">{result.tongChiTiet.toLocaleString()}</span>
                <span>Dòng TonKhoChiTiet đã ghi:</span><span className="font-mono font-bold text-right text-green-600">{result.maCoTon.toLocaleString()}</span>
                {result.db.MaCoTon != null && <>
                  <span>Mã có tồn &gt; 0 (DB):</span><span className="font-mono font-bold text-right">{result.db.MaCoTon.toLocaleString()}</span>
                </>}
                <span>Tổng SL tồn (SoLuongTon):</span>   <span className="font-mono font-bold text-right">{Math.round(result.db.TongTon).toLocaleString()}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={loading}>Đóng</Button>
          <Button onClick={handleImport} disabled={!file || loading} className="gap-1.5 bg-green-600 hover:bg-green-700" translate="no">
            <SpinIcon busy={loading} Icon={Database} />
            <span translate="no">{loading ? "Đang import..." : "Import Tồn Kho"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TrangBOMNew() {
  const { t } = useI18n();
  const [query, setQuery]       = useState("");
  const [codeTong, setCodeTong] = useState("");
  const [tab, setTab]           = useState<Tab>("bom1");
  const [importOpen, setImportOpen]       = useState(false);
  const [importBaoCaoOpen, setImportBaoCaoOpen] = useState(false);

  // Suggestions khi tìm code tổng
  const [suggestions, setSuggestions]   = useState<Part[]>([]);
  const [showSug, setShowSug]           = useState(false);
  const [loadingSug, setLoadingSug]     = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // BOM data
  const [bom1Items, setBom1Items]       = useState<BomItem[]>([]);
  const [bomTree, setBomTree]           = useState<BomExpanded[]>([]);
  const [parentItems, setParentItems]   = useState<{ codeTong: string; moTa: string | null; heSo: number }[]>([]);
  const [parentInfo, setParentInfo]     = useState<Part | null>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");

  const searchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); return; }
    setLoadingSug(true);
    try {
      const r = await fetch(`${API_BASE}/api/parts?q=${encodeURIComponent(q)}&assembly=1&limit=10`);
      const d = await r.json();
      setSuggestions(d.data || []);
    } catch { setSuggestions([]); }
    finally { setLoadingSug(false); }
  }, []);

  const handleQueryChange = (v: string) => {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchSuggestions(v), 250);
    setShowSug(true);
  };

  const selectCode = async (code: string) => {
    setQuery(code); setCodeTong(code);
    setShowSug(false); setSuggestions([]);
    await loadBom(code, tab);
  };

  const loadBom = useCallback(async (code: string, currentTab: Tab) => {
    if (!code) return;
    setLoading(true); setError("");
    try {
      if (currentTab === "bom1") {
        const r = await fetch(`${API_BASE}/api/bom-new/${encodeURIComponent(code)}`);
        const d = await r.json();
        setBom1Items(d.items || []);
        setParentInfo(d.thongTin || null);
      } else if (currentTab === "tree") {
        const r = await fetch(`${API_BASE}/api/bom-new/${encodeURIComponent(code)}/expand`);
        const d = await r.json();
        setBomTree(d.items || []);
      } else if (currentTab === "parents") {
        const r = await fetch(`${API_BASE}/api/bom-new/${encodeURIComponent(code)}/parents`);
        const d = await r.json();
        setParentItems(d.parents || []);
      }
    } catch { setError("Lỗi tải dữ liệu"); }
    finally { setLoading(false); }
  }, []);

  const handleTabChange = (t: Tab) => {
    setTab(t);
    if (codeTong) loadBom(codeTong, t);
  };

  const handleSearch = () => {
    if (query.trim()) selectCode(query.trim());
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">BOM — Bill of Materials</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tra cứu quan hệ Code Tổng – Code Con
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setImportBaoCaoOpen(true)}>
            <Database className="w-4 h-4" />
            Import Tồn Kho
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4" />
            Import BOM
          </Button>
        </div>
      </div>

      <ImportExcelDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <ImportBaoCaoDialog open={importBaoCaoOpen} onClose={() => setImportBaoCaoOpen(false)} />

      {/* Search box */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              onFocus={() => query.length >= 2 && setShowSug(true)}
              placeholder="Nhập Code Tổng để tra cứu BOM... (VD: GH97-18436C)"
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {loadingSug && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
            )}
          </div>
          <Button onClick={handleSearch} className="gap-1.5">
            <Search className="w-4 h-4" />Tra cứu
          </Button>
        </div>

        {/* Suggestions dropdown */}
        {showSug && suggestions.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
            {suggestions.map(s => (
              <button
                key={s.code}
                type="button"
                onClick={() => selectCode(s.code)}
                className="w-full flex items-start gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
              >
                <Package className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-mono font-semibold truncate">{s.code}</p>
                  {s.moTa && <p className="text-xs text-muted-foreground truncate">{s.moTa}</p>}
                </div>
                {s.model && <span className="text-xs text-muted-foreground ml-auto shrink-0">{s.model}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Parent info */}
      {parentInfo && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/20">
          <Package className="w-5 h-5 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-mono font-bold text-sm">{parentInfo.code}</p>
            {parentInfo.moTa && <p className="text-xs text-muted-foreground truncate">{parentInfo.moTa}</p>}
          </div>
          {parentInfo.model && <span className="text-xs font-medium text-muted-foreground">{parentInfo.model}</span>}
          <Badge label="Assembly" color="bg-purple-100 text-purple-700" />
        </div>
      )}

      {codeTong && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
            {([
              { key: "bom1",    label: "BOM 1 cấp",   icon: Package },
              { key: "tree",    label: "Đa cấp",       icon: GitBranch },
              { key: "kitting", label: "Kitting",      icon: Calculator },
              { key: "parents", label: "Dùng trong",   icon: ArrowUpFromLine },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleTabChange(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  tab === key ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Tab content */}
          <div className="flex-1 overflow-auto">
            {tab === "bom1" && <BomTable items={bom1Items} loading={loading} />}

            {tab === "tree" && (
              loading
                ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                : (
                  <div className="overflow-auto rounded-xl border border-border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50 text-muted-foreground">
                          <th className="py-2 px-3 text-left font-semibold">Code Con</th>
                          <th className="py-2 px-3 text-left font-semibold">Mô tả</th>
                          <th className="py-2 px-3 text-center font-semibold">Cụm</th>
                          <th className="py-2 px-3 text-right font-semibold w-16">Hệ số</th>
                          <th className="py-2 px-3 text-right font-semibold w-24">Hệ số tích lũy</th>
                          <th className="py-2 px-3 text-center font-semibold w-16">Cấp độ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!loading && bomTree.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-10 px-3 text-center text-sm text-muted-foreground">
                              Không có BOM đa cấp cho code này (hoặc chưa khai báo con trong hệ thống).
                            </td>
                          </tr>
                        )}
                        {bomTree.map((item, i) => (
                          <BomTreeRow key={`${item.codeCon}-${i}`} item={item} depth={item.capDo - 1} />
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border bg-muted/30">
                          <td colSpan={6} className="py-1.5 px-3 text-right text-xs text-muted-foreground">
                            {bomTree.length} dòng · {bomTree.reduce((m, i) => Math.max(m, i.capDo), 0)} cấp
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )
            )}

            {tab === "kitting" && <KittingPanel codeTong={codeTong} />}

            {tab === "parents" && (
              loading
                ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                : parentItems.length === 0
                  ? <p className="text-sm text-muted-foreground text-center py-8">Code này không là con của assembly nào</p>
                  : (
                    <div className="overflow-auto rounded-xl border border-border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/50 text-muted-foreground">
                            <th className="py-2 px-3 text-left font-semibold">Code Tổng</th>
                            <th className="py-2 px-3 text-left font-semibold">Mô tả</th>
                            <th className="py-2 px-3 text-left font-semibold">Model</th>
                            <th className="py-2 px-3 text-right font-semibold w-16">Hệ số</th>
                            <th className="py-2 px-3 text-center font-semibold">Cụm</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parentItems.map(item => (
                            <tr key={item.codeTong} className="border-t border-border hover:bg-muted/30">
                              <td className="py-1.5 px-3">
                                <button type="button" onClick={() => selectCode(item.codeTong)}
                                  className="font-mono font-semibold text-primary hover:underline">{item.codeTong}</button>
                              </td>
                              <td className="py-1.5 px-3 text-muted-foreground truncate max-w-xs">{item.moTa || "—"}</td>
                              <td className="py-1.5 px-3 text-muted-foreground">{(item as { model?: string | null }).model || "—"}</td>
                              <td className="py-1.5 px-3 text-right tabular-nums">{item.heSo}</td>
                              <td className="py-1.5 px-3 text-center"><CumBadge cum={(item as { cumVatLieu?: string | null }).cumVatLieu || null} /></td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-border bg-muted/30">
                            <td colSpan={5} className="py-1.5 px-3 text-right text-xs text-muted-foreground">
                              Dùng trong {parentItems.length} assembly
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )
            )}
          </div>
        </>
      )}

      {!codeTong && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <RefreshCw className="w-12 h-12 opacity-20" />
          <p className="text-sm">Nhập Code Tổng để tra cứu BOM</p>
          <p className="text-xs">VD: GH97-18436C · GH97-18399C · GH97-18199A</p>
        </div>
      )}
    </div>
  );
}
