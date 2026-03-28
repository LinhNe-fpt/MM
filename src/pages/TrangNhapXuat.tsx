import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { PageListSkeleton } from "@/components/ui/page-list-skeleton";
import { type GiaoDich, type LinhKien } from "@/data/duLieuMau";
import { API_BASE, apiPost } from "@/api/client";
import { ArrowDownRight, ArrowUpRight, CheckCircle, Loader2, Printer, Package, FileDown } from "lucide-react";
import { APP_LOGO_URL } from "@/lib/app-icon";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { useAuth } from "@/contexts/NguCanhXacThuc";
import { useCa } from "@/contexts/NguCanhCa";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { snappyAnimations } from "@/lib/animations";
import { usePhanTrang } from "@/lib/usePhanTrang";
import { PhanTrang } from "@/components/ui/PhanTrang";

type KieuTab = "IN" | "OUT";
type BuocForm = "form" | "confirm" | "evidence";

function formatThoiGian() {
  const now = new Date();
  return now.toISOString().slice(0, 16).replace("T", " ");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Bỏ gạch/khoảng trắng để so khớp K2-3 với K-2-3. */
function chuanHoaViTriSoSanh(s: string): string {
  return s.replace(/-/g, "").replace(/\s+/g, "").toUpperCase();
}

/** Tìm đúng nhãn trong danh sách thùng API (chuẩn Rack-Tang-Thung). */
function timNhanTrongDanhSachThung(candidate: string, danhSachThung: string[]): string {
  const c = candidate.trim();
  if (!c) return "";
  if (danhSachThung.includes(c)) return c;
  const nc = chuanHoaViTriSoSanh(c);
  for (const lb of danhSachThung) {
    if (chuanHoaViTriSoSanh(lb) === nc) return lb;
  }
  return "";
}

/**
 * Nhãn gửi lên API: ưu tiên khớp danh sách thùng (K-2-3), sau đó ghép từ rack/tang/thung,
 * cuối cùng ViTriText (backend cũng parse được dạng K2-3).
 */
function layNhanThungHienTai(lk: LinhKien | null | undefined, danhSachThung: string[]): string {
  if (!lk) return "";
  const rack = (lk.rack ?? "").trim();
  const tang = (lk.tang ?? "").trim();
  const thungOnly = (lk.thung ?? "").trim();
  const ghepDayDu = rack && tang && thungOnly ? `${rack}-${tang}-${thungOnly}` : "";
  const v = (lk.viTriText ?? "").trim();

  for (const raw of [ghepDayDu, v, thungOnly]) {
    if (!raw) continue;
    const hit = timNhanTrongDanhSachThung(raw, danhSachThung);
    if (hit) return hit;
  }
  if (v) return v;
  if (ghepDayDu) return ghepDayDu;
  if (thungOnly) return thungOnly;
  return "";
}

type CachChonViTri = "current" | "other";

export default function TrangNhapXuat() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { caHienTai } = useCa();
  const [tab, setTab] = useState<KieuTab>("IN");
  const [locDanhMuc, setLocDanhMuc] = useState<string>("all");
  const [danhSachGiaoDich, setDanhSachGiaoDich] = useState<GiaoDich[]>([]);
  const [tatCaLinhKien, setTatCaLinhKien] = useState<LinhKien[]>([]);
  const [danhSachThung, setDanhSachThung] = useState<string[]>([]);
  const [danhMucNhap, setDanhMucNhap] = useState<{ ten: string; moTa: string }[]>([]);
  const [danhMucXuat, setDanhMucXuat] = useState<{ ten: string; moTa: string }[]>([]);
  const [taiDanhSach, setTaiDanhSach] = useState(true);
  const [loiDanhSach, setLoiDanhSach] = useState<string | null>(null);
  const [moForm, setMoForm] = useState(false);
  const [buoc, setBuoc] = useState<BuocForm>("form");
  const [danhMuc, setDanhMuc] = useState("");
  const [maLinhKien, setMaLinhKien] = useState("");
  const [model, setModel] = useState("");
  const [soLuong, setSoLuong] = useState("");
  const [thung, setThung] = useState("");
  const [fileMinhChung, setFileMinhChung] = useState<File | null>(null);
  const [dangGui, setDangGui] = useState(false);
  const [codeSearch, setCodeSearch] = useState("");
  const [codeSuggestions, setCodeSuggestions] = useState<LinhKien[]>([]);
  const [codeSuggestionsOpen, setCodeSuggestionsOpen] = useState(false);
  const [loadingCodeSuggestions, setLoadingCodeSuggestions] = useState(false);
  const [selectedLinhKien, setSelectedLinhKien] = useState<LinhKien | null>(null);
  const [tiepTucNhapSauKhiLuu, setTiepTucNhapSauKhiLuu] = useState(false);
  const [cachChonViTri, setCachChonViTri] = useState<CachChonViTri>("other");
  const [loiFormPhieu, setLoiFormPhieu] = useState<string | null>(null);
  const [loiGuiPhieu, setLoiGuiPhieu] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLDivElement>(null);
  const danhMucSelectRef = useRef<HTMLSelectElement>(null);
  const soLuongInputRef = useRef<HTMLInputElement>(null);
  const thungSelectRef = useRef<HTMLSelectElement>(null);
  const prevMaLinhKienChoViTri = useRef<string | null>(null);
  const operator = (user as { email?: string })?.email ?? "admin";

  useEffect(() => {
    let cancelled = false;
    setTaiDanhSach(true);
    setLoiDanhSach(null);
    Promise.all([
      fetch(`${API_BASE}/api/transactions?limit=100`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}/api/components`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}/api/warehouse/rows`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}/api/categories`).then((r) => (r.ok ? r.json() : { IN: [], OUT: [] })),
    ])
      .then(([txList, compList, rows, cats]) => {
        if (cancelled) return;
        setDanhSachGiaoDich(Array.isArray(txList) ? txList : []);
        setTatCaLinhKien(Array.isArray(compList) ? compList : []);
        const bins = Array.isArray(rows) ? rows.flatMap((r: { bins?: { label?: string }[] }) => r.bins || []) : [];
        setDanhSachThung([...new Set(bins.map((b: { label?: string }) => b.label).filter(Boolean))]);
        const toList = (arr: unknown[]): { ten: string; moTa: string }[] =>
          Array.isArray(arr) && arr.length > 0
            ? arr.map(i => typeof i === "string" ? { ten: i, moTa: "" } : { ten: String((i as { ten?: unknown }).ten ?? i), moTa: String((i as { moTa?: unknown }).moTa ?? "") })
            : [];
        const inList  = toList(cats?.IN);
        const outList = toList(cats?.OUT);
        setDanhMucNhap(inList.length  > 0 ? inList  : [
          { ten: "UPK", moTa: "Unpack — Nhập từ nhà cung cấp" },
          { ten: "IQC", moTa: "Incoming QC" },
          { ten: "SX TRẢ", moTa: "Sản xuất trả lại" },
          { ten: "RMA OK", moTa: "Hàng RMA xử lý xong nhập lại" },
        ]);
        setDanhMucXuat(outList.length > 0 ? outList : [
          { ten: "KITTING",  moTa: "Xuất cho line sản xuất" },
          { ten: "RMA",      moTa: "Trả hàng lỗi nhà cung cấp" },
          { ten: "SX UPL",   moTa: "Sản xuất UPL" },
          { ten: "TRẢ SX",   moTa: "Trả về sản xuất" },
          { ten: "RT",       moTa: "Return" },
        ]);
      })
      .catch((e) => {
        if (!cancelled) setLoiDanhSach(e?.message || "Loi tai du lieu");
      })
      .finally(() => {
        if (!cancelled) setTaiDanhSach(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const danhMucTheoTab = tab === "IN" ? danhMucNhap : danhMucXuat;

  const daLoc = useMemo(() => danhSachGiaoDich.filter((gd) => {
    if (gd.type !== tab) return false;
    if (locDanhMuc !== "all" && gd.category !== locDanhMuc) return false;
    return true;
  }), [danhSachGiaoDich, tab, locDanhMuc]);

  const { page, setPage, resetPage, totalPages, slice: danhSachHienThi } = usePhanTrang(daLoc);
  useEffect(() => {
    resetPage();
  }, [tab, locDanhMuc, resetPage]);

  const linhKienChon = useMemo(
    () => tatCaLinhKien.find((lk) => lk.partNumber === maLinhKien),
    [maLinhKien, tatCaLinhKien]
  );
  const lkHienTai = selectedLinhKien ?? linhKienChon ?? null;
  const maViTriTuLinhKien = useMemo(() => {
    const v = lkHienTai?.maViTri;
    if (v == null) return null;
    const n = typeof v === "number" ? v : Number(String(v).trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [lkHienTai]);
  const nhanThungHienTai = useMemo(
    () => layNhanThungHienTai(lkHienTai ?? undefined, danhSachThung),
    [lkHienTai, danhSachThung]
  );
  const binLabelHieuLuc = useMemo(() => {
    if (cachChonViTri === "current" && nhanThungHienTai) return nhanThungHienTai.trim();
    return thung.trim();
  }, [cachChonViTri, nhanThungHienTai, thung]);
  /** Đủ để gửi phiếu: có nhãn thùng hoặc vị trí hiện tại kèm MaViTri từ DB (TonKho + ViTriKho). */
  const duViTriChoPhieu =
    Boolean(binLabelHieuLuc.trim()) || (cachChonViTri === "current" && maViTriTuLinhKien != null);

  useEffect(() => {
    if (!moForm || buoc !== "form") return;
    if (prevMaLinhKienChoViTri.current === maLinhKien) return;
    prevMaLinhKienChoViTri.current = maLinhKien;
    setThung("");
    if (!maLinhKien.trim()) {
      setCachChonViTri("other");
      return;
    }
    const lk = selectedLinhKien ?? tatCaLinhKien.find((lk) => lk.partNumber === maLinhKien);
    const cur = layNhanThungHienTai(lk, danhSachThung);
    setCachChonViTri(cur ? "current" : "other");
  }, [moForm, buoc, maLinhKien, selectedLinhKien, tatCaLinhKien, danhSachThung]);

  const tenLinhKien = selectedLinhKien?.name ?? linhKienChon?.name ?? "";
  const tonHienTai = selectedLinhKien?.quantity ?? linhKienChon?.quantity ?? 0;
  const heSoQuyDoi = selectedLinhKien?.lossRate && selectedLinhKien.lossRate > 0 ? selectedLinhKien.lossRate : 1;
  const soLuongNhap = Number(soLuong) || 0;
  const soLuongQuyDoi = soLuongNhap * heSoQuyDoi;

  const categoryBadgeClass = (category: string, type: KieuTab) => {
    const key = (category || "").toUpperCase();
    if (key.includes("UPK")) return "bg-green-100 text-green-700 border-green-200";
    if (key.includes("IQC")) return "bg-blue-100 text-blue-700 border-blue-200";
    if (key.includes("RMA")) return "bg-orange-100 text-orange-700 border-orange-200";
    if (key.includes("SX UPL") || key.includes("UPL")) return "bg-purple-100 text-purple-700 border-purple-200";
    return type === "IN"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : "bg-rose-100 text-rose-700 border-rose-200";
  };

  const parseTxDate = (timestamp: string) => {
    if (!timestamp) return null;
    const normalized = timestamp.includes("T") ? timestamp : timestamp.replace(" ", "T");
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const timelineLabel = (timestamp: string) => {
    const d = parseTxDate(timestamp);
    if (!d) return t("tx.timeline_other");
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDay = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDay === 0) return t("tx.today");
    if (diffDay === 1) return t("tx.yesterday");
    if (diffDay <= 7) return t("tx.this_week");
    return `${target.getDate()}/${target.getMonth() + 1}/${target.getFullYear()}`;
  };

  const duLieuBieuDo7Ngay = useMemo(() => {
    const buckets: { label: string; inQty: number; outQty: number; key: string }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets.push({
        key,
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        inQty: 0,
        outQty: 0,
      });
    }
    const map = new Map(buckets.map((b) => [b.key, b]));
    daLoc.forEach((gd) => {
      const d = parseTxDate(gd.timestamp);
      if (!d) return;
      const key = d.toISOString().slice(0, 10);
      const item = map.get(key);
      if (!item) return;
      const qty = Number(gd.quantity) || 0;
      if (gd.type === "IN") item.inQty += qty;
      else item.outQty += qty;
    });
    return buckets;
  }, [daLoc]);

  const inBaoCaoPdf = () => {
    const reportRows = daLoc.slice(0, 30);
    const maxY = Math.max(
      1,
      ...duLieuBieuDo7Ngay.map((d) => Math.max(d.inQty, d.outQty))
    );

    const barWidth = 26;
    const gap = 18;
    const chartHeight = 170;

    const barsSvg = duLieuBieuDo7Ngay
      .map((d, i) => {
        const x = 30 + i * (barWidth * 2 + gap);
        const inH = Math.round((d.inQty / maxY) * chartHeight);
        const outH = Math.round((d.outQty / maxY) * chartHeight);
        return `
          <rect x="${x}" y="${200 - inH}" width="${barWidth}" height="${inH}" fill="#16a34a" rx="4" />
          <rect x="${x + barWidth + 4}" y="${200 - outH}" width="${barWidth}" height="${outH}" fill="#dc2626" rx="4" />
          <text x="${x + barWidth}" y="220" font-size="10" fill="#6b7280" text-anchor="middle">${d.label}</text>
        `;
      })
      .join("");

    const rowsHtml = reportRows
      .map(
        (gd) => `
          <tr>
            <td>${escapeHtml(gd.timestamp || "")}</td>
            <td>${escapeHtml(gd.type)}</td>
            <td>${escapeHtml(gd.category || "")}</td>
            <td>${escapeHtml(gd.partNumber || "")}</td>
            <td style="text-align:right;">${Number(gd.quantity || 0).toLocaleString()}</td>
            <td>${escapeHtml(gd.bin || "")}</td>
            <td>${escapeHtml(gd.operator || "")}</td>
          </tr>
        `
      )
      .join("");

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Bao cao nhap xuat</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
          h1 { margin: 0 0 6px; font-size: 22px; }
          .sub { color: #6b7280; margin-bottom: 18px; font-size: 12px; }
          .kpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
          .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; }
          .label { font-size: 11px; color: #6b7280; }
          .value { font-size: 20px; font-weight: 700; margin-top: 2px; }
          .section { margin-top: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #e5e7eb; padding: 6px 8px; }
          th { background: #f3f4f6; text-align: left; }
          .legend { display: flex; gap: 12px; margin: 8px 0 0; font-size: 11px; color: #6b7280; }
          .dot { width: 10px; height: 10px; border-radius: 999px; display: inline-block; margin-right: 6px; }
          @media print { body { padding: 10mm; } }
        </style>
      </head>
      <body>
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
          <img src="${APP_LOGO_URL}" alt="EMS Warehouse" style="width:62px; height:62px; object-fit:contain;" />
          <div>
            <div style="font-size:16px; font-weight:800; line-height:1.1;">EMS WAREHOUSE</div>
            <div style="font-size:11px; color:#6b7280;">Inventory Management System</div>
          </div>
        </div>
        <h1>${t("tx.pdf_title")}</h1>
        <div class="sub">${t("tx.pdf_generated")}: ${escapeHtml(formatThoiGian())} · ${t("tx.pdf_tab")}: ${escapeHtml(tab)} · ${t("tx.pdf_category")}: ${escapeHtml(locDanhMuc)}</div>
        <div class="kpi">
          <div class="card"><div class="label">${t("tx.pdf_total_tx")}</div><div class="value">${daLoc.length}</div></div>
          <div class="card"><div class="label">${t("tx.pdf_total_in")}</div><div class="value">${daLoc.filter(x => x.type === "IN").reduce((s, x) => s + (Number(x.quantity) || 0), 0).toLocaleString()}</div></div>
          <div class="card"><div class="label">${t("tx.pdf_total_out")}</div><div class="value">${daLoc.filter(x => x.type === "OUT").reduce((s, x) => s + (Number(x.quantity) || 0), 0).toLocaleString()}</div></div>
          <div class="card"><div class="label">${t("tx.pdf_unique_parts")}</div><div class="value">${new Set(daLoc.map(x => x.partNumber)).size}</div></div>
        </div>
        <div class="section">
          <div style="font-weight:700; margin-bottom:6px;">${t("tx.pdf_chart_title")}</div>
          <svg width="100%" viewBox="0 0 420 240" preserveAspectRatio="xMidYMid meet">
            <line x1="20" y1="200" x2="400" y2="200" stroke="#9ca3af" stroke-width="1" />
            ${barsSvg}
          </svg>
          <div class="legend">
            <span><i class="dot" style="background:#16a34a"></i>${t("tx.pdf_in_legend")}</span>
            <span><i class="dot" style="background:#dc2626"></i>${t("tx.pdf_out_legend")}</span>
          </div>
        </div>
        <div class="section">
          <div style="font-weight:700; margin-bottom:6px;">${t("tx.pdf_recent_title")} (${reportRows.length})</div>
          <table>
            <thead>
              <tr>
                <th>${t("tx.pdf_col_time")}</th>
                <th>${t("tx.pdf_col_type")}</th>
                <th>${t("tx.pdf_col_category")}</th>
                <th>${t("tx.pdf_col_code")}</th>
                <th>${t("tx.pdf_col_qty")}</th>
                <th>${t("tx.pdf_col_bin")}</th>
                <th>${t("tx.pdf_col_operator")}</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </body>
      </html>
    `;

    const w = window.open("", "_blank", "width=1200,height=900");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  // Tim kiem CODE theo ky tu (debounce 300ms, cancel in-flight request)
  useEffect(() => {
    if (!moForm || buoc !== "form") return;
    const q = codeSearch.trim();
    if (q.length < 1) {
      setCodeSuggestions([]);
      setCodeSuggestionsOpen(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const t = setTimeout(() => {
      setLoadingCodeSuggestions(true);
      fetch(`${API_BASE}/api/components?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((list: LinhKien[]) => {
          if (!cancelled) {
            setCodeSuggestions(Array.isArray(list) ? list : []);
            setCodeSuggestionsOpen(true);
          }
        })
        .catch(() => {
          if (!cancelled) setCodeSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setLoadingCodeSuggestions(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
      controller.abort();
    };
  }, [moForm, buoc, codeSearch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (codeInputRef.current && !codeInputRef.current.contains(e.target as Node)) {
        setCodeSuggestionsOpen(false);
      }
    }
    if (codeSuggestionsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [codeSuggestionsOpen]);

  const moDialogPhieu = (kieu: KieuTab) => {
    setTab(kieu);
    setBuoc("form");
    setDanhMuc(kieu === "IN" ? (danhMucNhap[0]?.ten ?? "") : (danhMucXuat[0]?.ten ?? ""));
    prevMaLinhKienChoViTri.current = null;
    setMaLinhKien("");
    setModel("");
    setSoLuong("");
    setThung("");
    setCachChonViTri("other");
    setFileMinhChung(null);
    setCodeSearch("");
    setCodeSuggestions([]);
    setCodeSuggestionsOpen(false);
    setSelectedLinhKien(null);
    setLoiFormPhieu(null);
    setLoiGuiPhieu(null);
    setMoForm(true);
  };

  const dongDialog = () => {
    setMoForm(false);
    setBuoc("form");
    setLoiGuiPhieu(null);
    setLoiFormPhieu(null);
  };

  const sangXacNhan = () => {
    setLoiFormPhieu(null);
    const errs: string[] = [];
    if (!danhMuc?.trim()) errs.push("Chọn danh mục nhập/xuất.");
    if (!maLinhKien?.trim()) errs.push("Chọn hoặc nhập mã linh kiện.");
    const soRaw = soLuong.trim();
    if (!soRaw) errs.push("Nhập số lượng (số nguyên dương).");
    else if (Number.isNaN(parseInt(soRaw, 10)) || parseInt(soRaw, 10) <= 0) errs.push("Số lượng phải là số nguyên lớn hơn 0.");
    if (!duViTriChoPhieu) errs.push(t("tx.bin_required"));
    if (errs.length > 0) {
      setLoiFormPhieu(errs.join(" "));
      if (!danhMuc?.trim()) danhMucSelectRef.current?.focus();
      else if (!maLinhKien?.trim()) codeInputRef.current?.querySelector("input")?.focus();
      else if (!soRaw || Number.isNaN(parseInt(soRaw, 10)) || parseInt(soRaw, 10) <= 0) soLuongInputRef.current?.focus();
      else if (!duViTriChoPhieu) thungSelectRef.current?.focus();
      return;
    }
    setBuoc("confirm");
  };

  const sangMinhChung = () => setBuoc("evidence");

  const hoanTat = async () => {
    const so = parseInt(soLuong, 10);
    if (Number.isNaN(so) || so <= 0) return;
    setLoiGuiPhieu(null);
    setDangGui(true);
    try {
      const body: Record<string, unknown> = {
        type: tab,
        category: danhMuc,
        partNumber: maLinhKien,
        partName: tenLinhKien || maLinhKien,
        quantity: so,
        operator,
      };
      const bl = binLabelHieuLuc.trim();
      if (bl) body.binLabel = bl;
      if (cachChonViTri === "current" && maViTriTuLinhKien != null) body.maViTri = maViTriTuLinhKien;
      if (!body.binLabel && body.maViTri == null) {
        setLoiGuiPhieu(t("tx.bin_required"));
        setDangGui(false);
        return;
      }
      if (model.trim()) body.model = model.trim();
      const res = await apiPost<GiaoDich>("/api/transactions", body);
      setDanhSachGiaoDich((prev) => [res, ...prev]);
      if (tiepTucNhapSauKhiLuu) {
        setBuoc("form");
        setMaLinhKien("");
        setModel("");
        setSoLuong("");
        setThung("");
        setCachChonViTri("other");
        prevMaLinhKienChoViTri.current = null;
        setFileMinhChung(null);
        setCodeSearch("");
        setCodeSuggestions([]);
        setCodeSuggestionsOpen(false);
        setSelectedLinhKien(null);
      } else {
        dongDialog();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Loi tao phieu";
      setLoiDanhSach(msg);
      setLoiGuiPhieu(msg);
    } finally {
      setDangGui(false);
    }
  };

  const inPhieuMotGiaoDich = useCallback((gd: GiaoDich) => {
    const html = `
      <!doctype html>
      <html><head><meta charset="utf-8"/><title>Phieu giao dich</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #111827; max-width: 480px; margin: 0 auto; }
        h1 { font-size: 18px; margin: 0 0 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        td { padding: 6px 0; border-bottom: 1px solid #e5e7eb; }
        td:first-child { color: #6b7280; width: 38%; }
        .qty { font-size: 22px; font-weight: 800; margin-top: 12px; }
        ${gd.type === "IN" ? ".qty { color: #16a34a; }" : ".qty { color: #dc2626; }"}
        @media print { body { padding: 8mm; } }
      </style></head><body>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <img src="${APP_LOGO_URL}" alt="" style="width:53px;height:53px;object-fit:contain;"/>
          <div><div style="font-weight:800;">EMS WAREHOUSE</div><div style="font-size:11px;color:#6b7280;">Phiếu giao dịch</div></div>
        </div>
        <h1>${gd.type === "IN" ? "NHẬP KHO" : "XUẤT KHO"} · ${escapeHtml(gd.category || "")}</h1>
        <table>
          <tr><td>Thời gian</td><td>${escapeHtml(gd.timestamp || "")}</td></tr>
          <tr><td>Mã linh kiện</td><td><strong>${escapeHtml(gd.partNumber || "")}</strong></td></tr>
          <tr><td>Tên</td><td>${escapeHtml(gd.partName || "")}</td></tr>
          ${gd.model ? `<tr><td>Model</td><td>${escapeHtml(String(gd.model))}</td></tr>` : ""}
          <tr><td>Thùng</td><td>${escapeHtml(gd.bin || "")}</td></tr>
          <tr><td>Người thực hiện</td><td>${escapeHtml(gd.operator || "")}</td></tr>
        </table>
        <p class="qty">${gd.type === "IN" ? "+" : "-"}${Number(gd.quantity).toLocaleString()} pcs</p>
      </body></html>`;
    const w = window.open("", "_blank", "width=520,height=640");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }, []);

  if (taiDanhSach) {
    return <PageListSkeleton rows={6} />;
  }

  return (
    <motion.div 
      className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Banner cảnh báo khi chưa có ca */}
      {!caHienTai && (
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-300">
          <span className="shrink-0">⚠️</span>
          <span className="flex-1">{t("shift.no_active_shift_warning")}</span>
          <Link to="/shifts" className="shrink-0 font-semibold underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200">
            {t("shift.start_shift")}
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">{t("tx.title")}</h1>
        <div className="flex gap-2">
          <motion.button
            className="px-3 py-2 rounded-md btn-mechanical gap-1.5 border border-primary/40 text-primary hover:bg-primary/10 transition-all duration-150 flex items-center text-sm font-medium"
            onClick={inBaoCaoPdf}
            whileTap={{ scale: 0.95 }}
            whileHover={{ y: -1 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <FileDown className="w-4 h-4" />
            <span className="hidden md:inline">{t("tx.print_report")}</span>
          </motion.button>
          <motion.button
            className="px-3 py-2 rounded-md btn-mechanical gap-1.5 text-status-ok border border-status-ok/50 hover:bg-status-ok/10 transition-all duration-150 flex items-center text-sm font-medium"
            onClick={() => moDialogPhieu("IN")}
            whileTap={{ scale: 0.95 }}
            whileHover={{ y: -1 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <ArrowDownRight className="w-4 h-4" />
            <span className="hidden md:inline">{t("tx.form_btn")}</span>
          </motion.button>
          <motion.button
            className="px-3 py-2 rounded-md btn-mechanical gap-1.5 text-status-critical border border-status-critical/50 hover:bg-status-critical/10 transition-all duration-150 flex items-center text-sm font-medium"
            onClick={() => moDialogPhieu("OUT")}
            whileTap={{ scale: 0.95 }}
            whileHover={{ y: -1 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span className="hidden md:inline">{t("tx.form_btn_out")}</span>
          </motion.button>
        </div>
      </div>

      {loiDanhSach && (
        <motion.p 
          className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {loiDanhSach}
        </motion.p>
      )}

      <div className="flex border border-border rounded-lg overflow-hidden">
        {(["IN", "OUT"] as const).map((kieu) => (
          <motion.button
            key={kieu}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            onClick={() => {
              setTab(kieu);
              setLocDanhMuc("all");
            }}
            className={`flex-1 py-2.5 text-sm font-semibold btn-mechanical flex items-center justify-center gap-1.5 transition-colors ${tab === kieu ? (kieu === "IN" ? "bg-status-ok/15 text-status-ok" : "bg-status-critical/15 text-status-critical") : "text-muted-foreground hover:bg-accent"}`}
          >
            {kieu === "IN" ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
            {kieu === "IN" ? t("tx.in") : t("tx.out")}
          </motion.button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <motion.button
          onClick={() => setLocDanhMuc("all")}
          className={`label-industrial px-3 py-1.5 rounded border btn-mechanical whitespace-nowrap transition-all duration-150 ${locDanhMuc === "all" ? "border-primary text-primary bg-primary/10 shadow-sm" : "border-border text-muted-foreground hover:border-primary/30"}`}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          {t("tx.all")}
        </motion.button>
        {danhMucTheoTab.map((dm, idx) => (
          <motion.button
            key={dm.ten}
            onClick={() => setLocDanhMuc(dm.ten)}
            className={`label-industrial px-3 py-1.5 rounded border btn-mechanical whitespace-nowrap transition-all duration-150 ${locDanhMuc === dm.ten ? "border-primary text-primary bg-primary/10 shadow-sm" : "border-border text-muted-foreground hover:border-primary/30"}`}
            title={dm.moTa || dm.ten}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: idx * 0.05, duration: 0.2, ease: "easeOut" }}
            whileTap={{ scale: 0.95 }}
          >
            {dm.ten}
          </motion.button>
        ))}
      </div>

      <div className="border border-border rounded-lg overflow-hidden flex flex-col max-h-96">
        {daLoc.length === 0 ? (
          <motion.p 
            className="text-sm text-muted-foreground text-center py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {t("tx.no_data")}
          </motion.p>
        ) : (
          <>
            <motion.div 
              className="overflow-y-auto flex-1 space-y-1 p-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ staggerChildren: 0.02, delayChildren: 0.1 }}
            >
              <AnimatePresence>
                {danhSachHienThi.map((gd, idx) => (
                  <div key={`${gd.id}-wrap`}>
                    {(idx === 0 || timelineLabel(danhSachHienThi[idx - 1].timestamp) !== timelineLabel(gd.timestamp)) && (
                      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur py-1.5 px-1">
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {timelineLabel(gd.timestamp)}
                        </span>
                      </div>
                    )}
                  <motion.div
                    key={gd.id}
                    className="border border-border rounded p-2 flex items-center justify-between hover:border-primary/40 transition-all duration-150 bg-background text-sm hover:bg-primary/5 cursor-pointer group"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: idx * 0.02, duration: 0.2, ease: "easeOut" }}
                    whileHover={{ scale: 1.01, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
                    whileTap={{ scale: 0.98 }}
                  >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-md border border-primary/20 bg-primary/5 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-primary/60" />
                    </div>
                    <div
                      className={`w-6 h-6 rounded flex-shrink-0 flex items-center justify-center ${gd.type === "IN" ? "bg-status-ok/15" : "bg-status-critical/15"}`}
                    >
                      {gd.type === "IN" ? (
                        <ArrowDownRight className="w-3 h-3 text-status-ok" />
                      ) : (
                        <ArrowUpRight className="w-3 h-3 text-status-critical" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-mono text-[11px] text-muted-foreground">{gd.partNumber}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${categoryBadgeClass(gd.category, gd.type)}`}>
                          {gd.category}
                        </span>
                      </div>
                      <p className="text-xs font-medium mt-0.5 truncate">{gd.partName}</p>
                      {gd.model && (
                        <p className="text-[9px] text-muted-foreground truncate">Model: {gd.model}</p>
                      )}
                      <p className="text-[9px] text-muted-foreground">
                        {gd.operator} · {gd.timestamp}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={() => inPhieuMotGiaoDich(gd)}
                      className="mb-1 ml-auto block rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title={t("tx.quick_print")}
                      aria-label={t("tx.quick_print")}
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    <p
                      className={`font-mono font-bold text-xs tabular-nums ${gd.type === "IN" ? "text-status-ok" : "text-status-critical"}`}
                    >
                      {gd.type === "IN" ? "+" : "-"}
                      {Number(gd.quantity).toLocaleString()}
                    </p>
                    <p className="font-mono text-[9px] text-muted-foreground">
                      {t("table.bin")} {gd.bin}
                    </p>
                  </div>
                </motion.div>
                </div>
              ))}
              </AnimatePresence>
            </motion.div>
            <PhanTrang
              trangHienTai={page}
              tongSoTrang={totalPages}
              tongSoMuc={daLoc.length}
              onChuyenTrang={setPage}
              nhanTomTat={t("tx.transactions_count")}
            />
          </>
        )}
      </div>

      <Dialog open={moForm} onOpenChange={setMoForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("tx.form_title")} · {tab === "IN" ? t("tx.in") : t("tx.out")}
            </DialogTitle>
          </DialogHeader>

          {buoc === "form" && (
            <>
              <div className="space-y-4 py-2">
                <p className="text-sm font-medium text-muted-foreground">{t("tx.step_form")}</p>
                {loiFormPhieu && (
                  <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2" role="alert">
                    {loiFormPhieu}
                  </p>
                )}
                <div>
                  <label className="label-industrial mb-1 block">{t("tx.category_label")}</label>
                  <select
                    ref={danhMucSelectRef}
                    value={danhMuc}
                    onChange={(e) => { setDanhMuc(e.target.value); setLoiFormPhieu(null); }}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {danhMucTheoTab.map((dm) => (
                      <option key={dm.ten} value={dm.ten}>
                        {dm.ten}{dm.moTa ? ` — ${dm.moTa}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div ref={codeInputRef} className="relative">
                  <label className="label-industrial mb-1 block">{t("tx.code_label")}</label>
                  <input
                    type="text"
                    value={selectedLinhKien ? `${selectedLinhKien.partNumber} · ${selectedLinhKien.name ?? ""}` : codeSearch}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCodeSearch(v);
                      setLoiFormPhieu(null);
                      if (selectedLinhKien) {
                        setSelectedLinhKien(null);
                        setMaLinhKien("");
                      }
                    }}
                    onFocus={() => {
                      if (codeSearch.trim()) setCodeSuggestionsOpen(true);
                    }}
                    placeholder={t("tx.code_search_placeholder")}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                  />
                  {loadingCodeSuggestions && (
                    <span className="absolute right-3 top-9 text-muted-foreground" aria-hidden>
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </span>
                  )}
                  {codeSuggestionsOpen && (codeSearch.trim() || codeSuggestions.length > 0) && (
                    <ul
                      className="absolute z-50 w-full mt-1 max-h-48 overflow-auto rounded-lg border border-border bg-background shadow-lg py-1 text-sm"
                      role="listbox"
                    >
                      {codeSuggestions.length === 0 && !loadingCodeSuggestions ? (
                        <li className="px-3 py-2 text-muted-foreground">{t("tx.code_no_results")}</li>
                      ) : (
                        codeSuggestions.map((lk) => (
                          <li
                            key={lk.id ?? lk.partNumber}
                            role="option"
                            tabIndex={0}
                            className="px-3 py-2 cursor-pointer hover:bg-muted focus:bg-muted focus:outline-none"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setMaLinhKien(lk.partNumber);
                              setSelectedLinhKien(lk);
                              setModel((lk as unknown as { model?: string }).model ?? "");
                              setCodeSearch("");
                              setCodeSuggestionsOpen(false);
                              setCodeSuggestions([]);
                            }}
                          >
                            <span className="font-mono text-xs text-muted-foreground">{lk.partNumber}</span>
                            {lk.name ? ` · ${lk.name}` : ""}
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
                <div>
                  <label className="label-industrial mb-1 block">{t("tx.part_name")} ({t("tx.description_label")})</label>
                  <input
                    type="text"
                    readOnly
                    value={tenLinhKien}
                    className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-lg text-sm text-muted-foreground"
                  />
                </div>
                <div>
                  <label className="label-industrial mb-1 block">{t("tx.model_label_short")} ({t("tx.optional")})</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder=""
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="label-industrial mb-1 block">{t("tx.quantity_label")}</label>
                  <input
                    ref={soLuongInputRef}
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min={1}
                    value={soLuong}
                    onChange={(e) => { setSoLuong(e.target.value); setLoiFormPhieu(null); }}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {!!maLinhKien && (() => {
                    const lk = selectedLinhKien ?? linhKienChon;
                    const caDem  = lk?.quantity ?? 0;
                    const caNgay = lk?.tonCuoiCaNgay;
                    const thucTe = lk?.tonThucTe;
                    const viTri  = lk?.viTriText;
                    return (
                      <div className="mt-1.5 flex flex-col gap-0.5">
                        {viTri && (
                          <p className="text-[11px] text-orange-600 font-semibold">
                            📍 Vị trí: <span className="font-mono">{viTri}</span>
                          </p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          {caNgay != null && (
                            <span className="text-[11px] bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5 text-violet-700 font-mono font-semibold">
                              Ca ngày: {caNgay.toLocaleString()}
                            </span>
                          )}
                          <span className={`text-[11px] rounded px-1.5 py-0.5 font-mono font-semibold border ${
                            caDem <= 0 ? "bg-muted/50 border-border/40 text-muted-foreground"
                            : caDem < 10 ? "bg-amber-50 border-amber-200 text-amber-700"
                            : "bg-emerald-50 border-emerald-200 text-emerald-700"
                          }`}>
                            Ca đêm: {caDem.toLocaleString()}
                          </span>
                          {thucTe != null && thucTe !== caDem && (
                            <span className="text-[11px] bg-red-50 border border-red-200 rounded px-1.5 py-0.5 text-red-600 font-mono font-semibold">
                              Thực tế: {thucTe.toLocaleString()} ({thucTe - caDem > 0 ? "+" : ""}{thucTe - caDem})
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  {!!soLuongNhap && !!maLinhKien && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t("tx.converted_qty")} ({t("tx.ratio_label")} {heSoQuyDoi}): <span className="font-semibold text-foreground">{soLuongQuyDoi.toLocaleString()}</span> pcs
                    </p>
                  )}
                </div>
                <div>
                  <span className="label-industrial mb-1 block">{t("tx.bin_label")}</span>
                  {nhanThungHienTai ? (
                    <RadioGroup
                      value={cachChonViTri}
                      onValueChange={(v) => {
                        setCachChonViTri(v as CachChonViTri);
                        setLoiFormPhieu(null);
                        if (v === "current") setThung("");
                      }}
                      className="gap-2.5"
                    >
                      <div className="flex items-start gap-2 rounded-lg border border-border/80 bg-muted/30 px-3 py-2">
                        <RadioGroupItem value="current" id="tx-bin-current" className="mt-0.5" />
                        <Label htmlFor="tx-bin-current" className="cursor-pointer font-normal leading-snug">
                          <span className="text-sm text-foreground">{t("tx.bin_use_current")}</span>
                          <span className="mt-0.5 block font-mono text-xs text-primary">{nhanThungHienTai}</span>
                        </Label>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/30 px-3 py-2">
                        <RadioGroupItem value="other" id="tx-bin-other" />
                        <Label htmlFor="tx-bin-other" className="cursor-pointer font-normal text-sm">
                          {t("tx.bin_pick_other")}
                        </Label>
                      </div>
                    </RadioGroup>
                  ) : null}
                  {(cachChonViTri === "other" || !nhanThungHienTai) && (
                    <select
                      ref={thungSelectRef}
                      value={thung}
                      onChange={(e) => { setThung(e.target.value); setLoiFormPhieu(null); }}
                      className={`w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary ${nhanThungHienTai ? "mt-2" : ""}`}
                    >
                      <option value="">{t("tx.select_bin")}</option>
                      {danhSachThung.map((lb) => (
                        <option key={lb} value={lb}>
                          {lb}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={tiepTucNhapSauKhiLuu}
                    onChange={(e) => setTiepTucNhapSauKhiLuu(e.target.checked)}
                  />
                  {t("tx.continue_after_save")}
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={dongDialog}>
                  {t("tx.back")}
                </Button>
                <Button onClick={sangXacNhan}>
                  {t("tx.next")}
                </Button>
              </DialogFooter>
            </>
          )}

          {buoc === "confirm" && (
            <>
              <div className="space-y-4 py-2">
                {loiGuiPhieu && (
                  <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2" role="alert">
                    {loiGuiPhieu}
                  </p>
                )}
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-status-ok" />
                  {t("tx.confirm_info")}
                </p>
                <div className="border border-border rounded-lg p-4 space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">{t("tx.category_label")}:</span>{" "}
                    {danhMuc}
                  </p>
                  <p>
                    <span className="text-muted-foreground">{t("tx.part_code")}:</span>{" "}
                    {maLinhKien}
                  </p>
                  <p>
                    <span className="text-muted-foreground">{t("tx.part_name")}:</span>{" "}
                    {tenLinhKien || "—"}
                  </p>
                  {model.trim() ? (
                    <p>
                      <span className="text-muted-foreground">{t("tx.model_label")}:</span>{" "}
                      {model.trim()}
                    </p>
                  ) : null}
                  <p>
                    <span className="text-muted-foreground">{t("tx.quantity_label")}:</span>{" "}
                    {tab === "IN" ? "+" : "-"}
                    {soLuong}
                  </p>
                  <p>
                    <span className="text-muted-foreground">{t("tx.bin_label")}:</span>{" "}
                    <span className="font-mono">
                      {binLabelHieuLuc.trim() ||
                        (maViTriTuLinhKien != null ? `${t("tx.bin_ma_vi_tri")} ${maViTriTuLinhKien}` : "—")}
                    </span>
                    {nhanThungHienTai && cachChonViTri === "current" ? (
                      <span className="ml-1.5 text-[10px] text-muted-foreground">({t("tx.bin_saved_as_current")})</span>
                    ) : null}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setLoiGuiPhieu(null); setBuoc("form"); }}>
                  {t("tx.back")}
                </Button>
                <Button variant="secondary" onClick={sangMinhChung}>{t("tx.upload_evidence")}</Button>
                <Button onClick={hoanTat} disabled={dangGui}>
                  {dangGui ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {t("tx.finish")}
                </Button>
              </DialogFooter>
            </>
          )}

          {buoc === "evidence" && (
            <>
              <div className="space-y-4 py-2">
                {loiGuiPhieu && (
                  <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2" role="alert">
                    {loiGuiPhieu}
                  </p>
                )}
                <p className="text-sm font-medium text-muted-foreground">{t("tx.step_evidence")}</p>
                <div>
                  <label className="label-industrial mb-1 block">
                    {t("tx.evidence_label")}
                  </label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setFileMinhChung(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded file:border file:border-primary file:bg-primary/10 file:text-primary"
                  />
                  {fileMinhChung && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("tx.file_selected")}: {fileMinhChung.name}
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBuoc("confirm")}>
                  {t("tx.back")}
                </Button>
                <Button onClick={hoanTat} disabled={dangGui}>
                  {dangGui ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {t("tx.finish")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
