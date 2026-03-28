import { API_BASE } from "@/api/client";

const STORAGE_KEY_SESSION = "ems-auth-session-token";

export function layHeaderPhien(): HeadersInit {
  const maPhien = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY_SESSION) : null;
  if (!maPhien) return {};
  return { "X-Ma-Phien": maPhien };
}

async function parseErr(res: Response): Promise<string> {
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    hint?: string;
    debug?: string;
    sqlNumber?: number;
  };
  const parts = [
    j.error,
    j.hint,
    j.debug,
    j.sqlNumber != null ? `SQL#${j.sqlNumber}` : "",
  ].filter(Boolean);
  return parts.join(" — ") || res.statusText || "Loi API";
}

export async function rmaUpkGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path.startsWith("/") ? path : `/${path}`}`, {
    headers: layHeaderPhien(),
  });
  if (!res.ok) throw new Error(await parseErr(res));
  return res.json() as Promise<T>;
}

export async function rmaUpkPost<T>(path: string, body?: unknown): Promise<T> {
  const h: Record<string, string> = { ...(layHeaderPhien() as Record<string, string>) };
  if (body !== undefined) h["Content-Type"] = "application/json";
  const res = await fetch(`${API_BASE}${path.startsWith("/") ? path : `/${path}`}`, {
    method: "POST",
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await parseErr(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Upload multipart (FormData) — không set Content-Type để trình duyệt gửi boundary. */
export async function rmaUpkPostFormData<T>(path: string, formData: FormData): Promise<T> {
  const h = layHeaderPhien() as Record<string, string>;
  const res = await fetch(`${API_BASE}${path.startsWith("/") ? path : `/${path}`}`, {
    method: "POST",
    headers: h,
    body: formData,
  });
  if (!res.ok) throw new Error(await parseErr(res));
  return res.json() as Promise<T>;
}

export interface RmaUpkMe {
  maNguoiDung: number;
  taiKhoan: string;
  hoTen: string | null;
  quyen: string;
  khoGhi: "UPK" | "RMA" | null;
  isAdmin: boolean;
  coTheGhiUPK: boolean;
  coTheGhiRMA: boolean;
}

export interface RmaUpkTonRow {
  MaLinhKien: string;
  MaKho: string;
  SoLuongTon: number;
}

export interface RmaUpkTransferLine {
  MaLinhKien: string;
  SoLuong: number;
}

export interface RmaUpkImportPreviewRow {
  code: string;
  soLuongTon: number;
  model: string | null;
  moTa: string | null;
  viTri: string | null;
}

export interface RmaUpkImportBaocaoResult {
  ok: boolean;
  sheetsUsed: string[];
  maCount: number;
  dryRun?: boolean;
  previewRows?: RmaUpkImportPreviewRow[];
  sheetNames?: string[];
}

/** Dòng lịch sử nhập/xuất (GET /api/rma-upk/adjustments) — kho UPK có DoiTac; RMA thường null */
export interface RmaUpkDieuChinhRow {
  MaDieuChinh: number;
  MaKho: string;
  DoiTac?: string | null;
  MaLinhKien: string;
  Loai: "NHAP" | "XUAT";
  SoLuong: number;
  TonSau: number;
  NgayGio: string;
  GhiChu: string | null;
  TaiKhoanNguoiTao: string | null;
  HoTenNguoiTao: string | null;
}

export interface RmaUpkTransferPending {
  MaChuyen: number;
  MaKhoNguon: string;
  MaKhoDich: string;
  MaNguoiTao: number;
  NgayTao: string;
  GhiChu: string | null;
  TenNguoiTao: string | null;
  TaiKhoanNguoiTao: string | null;
  chiTiet: RmaUpkTransferLine[];
}

export type KhsxZone = "MM" | "UPK" | "RMA";
export type KhsxShift = "CN" | "CD";
export type KhsxStatus = "CHO_XUAT_VT" | "DANG_XUAT" | "SAN_SANG" | "THIEU_VT" | "DA_XONG";

export interface KhsxPreviewRow {
  sheetName: string;
  rowNo: number;
  maKhu: KhsxZone;
  ngaySanXuat: string;
  caSanXuat: KhsxShift | "";
  lineSanXuat: string;
  congDoan: string;
  maAssy: string;
  /** Gộp từ cột MODEL cũ hoặc Basic Model */
  model: string | null;
  basicModel?: string | null;
  modelDesc?: string | null;
  poType?: string | null;
  nhomVatTu: string | null;
  soLuongKeHoach: number | null;
}

export interface KhsxPreviewError {
  sheetName: string;
  rowNo: number;
  field: string;
  code: string;
  message: string;
  rowData?: KhsxPreviewRow;
}

export interface KhsxPreviewResult {
  ok: boolean;
  summary: {
    fileName: string;
    maKhu: KhsxZone;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    /** Sheet thực sự đọc (mặc định 2 sheet cuối) */
    sheetNames: string[];
    /** Toàn bộ tab trong file (nếu có) */
    sheetNamesAll?: string[];
  };
  rows: KhsxPreviewRow[];
  errors: KhsxPreviewError[];
}

export interface KhsxPlanRow {
  MaKeHoach: number;
  MaBatch: number | null;
  MaKhu: KhsxZone;
  NgaySanXuat: string;
  CaSanXuat: KhsxShift;
  LineSanXuat: string;
  CongDoan: string;
  MaAssy: string;
  Model: string | null;
  BasicModel?: string | null;
  ModelDesc?: string | null;
  PoType?: string | null;
  NhomVatTuYeuCau?: string | null;
  SoLuongKeHoach: number;
  TrangThai: KhsxStatus;
  GhiChu: string | null;
  NgayTao: string;
  NgayCapNhat: string | null;
}

export interface KhsxPlanListResult {
  items: KhsxPlanRow[];
  /** Tổng Qty theo Line (cùng bộ lọc, toàn DB) — cột Total trên UI */
  lineQtyByLine?: Record<string, number>;
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
}

export interface KhsxMaterialPlanResult {
  ok: boolean;
  plan: KhsxPlanRow;
  stockSource: KhsxZone;
  warningCode?: string;
  warningMessage?: string;
  summary: { tongDong: number; dongDu: number; dongThieu: number };
  pickList: Array<{
    maLinhKien: string;
    heSo: number;
    nhomVatTu?: string;
    can: number;
    ton: number;
    thieu: number;
    du: boolean;
  }>;
}
