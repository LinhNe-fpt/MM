// ─── Enums & Status ────────────────────────────────────────────────────────
export type TrangThaiThung = "ok" | "low" | "critical" | "dead";

// ─── LinhKien — khớp với GET /api/components (schema mới: Parts) ───────────
export interface LinhKien {
  id: string;
  partNumber: string;   // Parts.Code (PK)
  name: string;
  manufacturer?: string | null;  // CumVatLieu
  model?: string | null;
  donVi?: string | null;
  laAssembly?: boolean;
  quantity: number;
  minStock?: number;
  unit?: string;
  lossRate?: number;
  rack?: string | null;
  tang?: string | null;
  thung?: string | null;
  maViTri?: number | null;
  kittable?: number | null;  // số bộ có thể kit từ vật tư hiện có (null = chưa có BOM)
  tonDau?:   number;         // tồn đầu kỳ (từ ca làm việc đầu tiên)
  tonThucTe?:    number | null; // tồn thực tế (kiểm đếm vật lý, col[20] Excel)
  tonCuoiCaNgay?: number | null; // tồn cuối ca ngày cuối (sheet CN cuối)
  viTriText?:    string | null;  // vị trí kho dạng text: "M3-1", "L2-3"…
  /** URL ảnh minh họa (Parts.DuongDanHinh) */
  hinhAnh?:      string | null;
}

// ─── GiaoDich — khớp với GET /api/transactions ─────────────────────────────
export interface GiaoDich {
  id: string;
  type: "IN" | "OUT";
  category: string;
  partNumber: string;
  partName: string;
  quantity: number;
  bin: string;
  timestamp: string;
  operator: string;
  model?: string | null;
}

// ─── Thung (bin) — dùng cho warehouse/rows & warehouse/map ─────────────────
export interface Thung {
  id: string;
  row: string;
  slot: string;
  label: string;
  // map endpoint thêm các field sau
  maViTri?: number;
  tier?: number;
  thung?: string;
  components: LinhKien[];
  fillPercent: number;
  status: TrangThaiThung;
}

// ─── Tier — tầng trong warehouse map ────────────────────────────────────────
export interface Tier {
  id: string;
  tierNum: number;
  label: string;
  bins: Thung[];
}

// ─── Day (rack) — GET /api/warehouse/rows trả bins[], map trả tiers[] ───────
export interface Day {
  id: string;
  label: string;
  bins?: Thung[];   // từ /api/warehouse/rows
  tiers?: Tier[];   // từ /api/warehouse/map
}
