import { API_BASE } from "@/api/client";

export interface BoPhanRow {
  MaBoPhan: string;
  TenBoPhan: string;
  ThuTu: number;
  GhiChu: string | null;
}

export interface VaiTroRow {
  MaVaiTro: string;
  MaBoPhan: string;
  TenBoPhan: string;
  TenHienThi: string;
  LaQuanTri: boolean;
  DuLieuMacDinh: boolean;
  MoTa: string | null;
}

export interface CatalogTomTat {
  boPhan: BoPhanRow[];
  vaiTro: VaiTroRow[];
  /** true khi chưa chạy schema BoPhan/VaiTro trên DB */
  catalogMissing?: boolean;
  hint?: string;
}

export async function fetchCatalogTomTat(): Promise<CatalogTomTat> {
  const res = await fetch(`${API_BASE}/api/catalog/tom-tat`);
  const j = (await res.json().catch(() => ({}))) as CatalogTomTat & { error?: string; hint?: string };
  if (!res.ok) throw new Error((j as { error?: string }).error || "Lỗi tải catalog");
  return {
    boPhan: Array.isArray(j.boPhan) ? j.boPhan : [],
    vaiTro: Array.isArray(j.vaiTro) ? j.vaiTro : [],
    catalogMissing: Boolean(j.catalogMissing),
    hint: typeof j.hint === "string" ? j.hint : undefined,
  };
}
