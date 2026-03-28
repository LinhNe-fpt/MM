/**
 * Parse sheet báo cáo Nhập-Xuất-Tồn (format MM / UPK) — dùng chung importBaoCao + RMA/UPK.
 */
const XLSX = require("xlsx");

const BASE_NHAP = [
  { off: 6, key: "UPK" },
  { off: 7, key: "IQC" },
  { off: 8, key: "SX_TRA_LAI" },
  { off: 9, key: "SX_TRA_UPL" },
  { off: 10, key: "FB_TRA_UPL" },
  { off: 11, key: "RMA_OK" },
  { off: 12, key: "NHAP_HKH" },
];
const BASE_XUAT = [
  { off: 13, key: "KITTING" },
  { off: 14, key: "RMA" },
  { off: 15, key: "SX_UPL" },
  { off: 16, key: "FB_UPL" },
  { off: 17, key: "TRA_SX" },
  { off: 18, key: "QC_MUON" },
  { off: 19, key: "RT" },
];

function parseSheetName(name) {
  const m = name.match(/^(CN|CD)\s+(\d+)\.(\d+)$/i);
  if (!m) return null;
  const loai = m[1].toUpperCase();
  const ngay = parseInt(m[2], 10);
  const thang = parseInt(m[3], 10);
  const year = parseInt(process.env.BAOCAO_SHEET_YEAR || "2026", 10);
  let batDau;
  let ketThuc;
  if (loai === "CN") {
    batDau = new Date(year, thang - 1, ngay, 7, 0, 0);
    ketThuc = new Date(year, thang - 1, ngay, 19, 0, 0);
  } else {
    batDau = new Date(year, thang - 1, ngay, 19, 0, 0);
    ketThuc = new Date(year, thang - 1, ngay + 1, 7, 0, 0);
  }
  return {
    tenCa: `${loai === "CN" ? "Ca Ngày" : "Ca Đêm"} ${ngay}/${thang}/${year}`,
    loaiCa: loai,
    batDau,
    ketThuc,
  };
}

function normalizePartCode(cell) {
  return String(cell ?? "").trim().toUpperCase();
}

function detectFormat(rows) {
  const headerRow = rows[2] || [];
  const col2Head = String(headerRow[2] ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const hasViTriHeader = /V[IÍỊ]TR[IÍ]|VITRI|V\.T/.test(col2Head);

  const dataRows = rows.slice(6, 16).filter((r) => String(r[2] ?? "").trim() !== "");
  const locMatch = dataRows.filter((r) => /^[A-Z]{1,3}\d{1,2}-\d{1,3}$/i.test(String(r[2]).trim()));
  const hasViTriData = dataRows.length > 0 && locMatch.length / dataRows.length >= 0.1;

  const hasViTri = hasViTriHeader || hasViTriData;
  const shift = hasViTri ? 1 : 0;

  return {
    hasViTri,
    vtCol: hasViTri ? 2 : -1,
    codeCol: 2 + shift,
    modelCol: 3 + shift,
    dCol: 4 + shift,
    cCol: 5 + shift,
    t20Col: 20 + shift,
    nhapCols: BASE_NHAP.map((c) => ({ idx: c.off + shift, key: c.key })),
    xuatCols: BASE_XUAT.map((c) => ({ idx: c.off + shift, key: c.key })),
  };
}

function parseSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const fmt = detectFormat(rows);
  const data = [];

  for (let i = 6; i < rows.length; i++) {
    const r = rows[i];
    const code = normalizePartCode(r[fmt.codeCol]);
    if (!code || code === "TOTAL" || !/^[A-Z0-9][\w\-]{2,}$/i.test(code)) continue;
    const tonDau = typeof r[fmt.dCol] === "number" ? r[fmt.dCol] : 0;
    const tonCuoi = typeof r[fmt.cCol] === "number" ? r[fmt.cCol] : 0;
    const viTri = fmt.vtCol >= 0 ? String(r[fmt.vtCol] ?? "").trim().toUpperCase() || null : null;
    const nhap = {};
    for (const col of fmt.nhapCols) {
      const val = typeof r[col.idx] === "number" ? r[col.idx] : 0;
      if (val !== 0) nhap[col.key] = val;
    }
    const xuat = {};
    for (const col of fmt.xuatCols) {
      const val = typeof r[col.idx] === "number" ? r[col.idx] : 0;
      if (val !== 0) xuat[col.key] = val;
    }
    const tonThucTe = typeof r[fmt.t20Col] === "number" ? r[fmt.t20Col] : tonCuoi;
    data.push({
      code,
      model: String(r[fmt.modelCol] ?? "").trim() || null,
      viTri,
      tonDau: Math.round(tonDau),
      tonCuoi: Math.round(tonCuoi),
      tonThucTe: Math.round(tonThucTe),
      nhap,
      xuat,
    });
  }
  return data;
}

function mergeSheetRowsByLastOccurrence(wb, sheetNames, partsSet) {
  const merged = new Map();
  for (const sn of [...sheetNames].reverse()) {
    const ws = wb.Sheets[sn];
    if (!ws) continue;
    const sheetData = parseSheet(ws);
    const valid = sheetData.filter((d) => partsSet.has(d.code));
    for (const d of valid) {
      if (!merged.has(d.code)) merged.set(d.code, d);
    }
  }
  return merged;
}

/**
 * Duyệt các sheet theo thứ tự; cùng mã linh kiện thì sheet sau ghi đè sheet trước.
 */
function mergeRowsFromSheetsInOrder(wb, sheetNames) {
  const merged = new Map();
  for (const sn of sheetNames) {
    const ws = wb.Sheets[sn];
    if (!ws) continue;
    for (const d of parseSheet(ws)) {
      merged.set(d.code, d);
    }
  }
  return merged;
}

function buildTonKhoChiTietRows(wb, sheets, partsSet) {
  const cdNames = [];
  const cnNames = [];
  for (const sn of sheets) {
    const caInfo = parseSheetName(sn);
    if (!caInfo) continue;
    if (caInfo.loaiCa === "CD") cdNames.push(sn);
    else if (caInfo.loaiCa === "CN") cnNames.push(sn);
  }
  const mergedCD = mergeSheetRowsByLastOccurrence(wb, cdNames, partsSet);
  const mergedCN = mergeSheetRowsByLastOccurrence(wb, cnNames, partsSet);
  const allCodes = new Set([...mergedCD.keys(), ...mergedCN.keys()]);
  const rows = [];
  for (const code of allCodes) {
    const dCD = mergedCD.get(code);
    const dCN = mergedCN.get(code);
    const soLuongTon = dCD ? dCD.tonCuoi : dCN ? dCN.tonCuoi : 0;
    const tonThucTe = dCD ? dCD.tonThucTe ?? dCD.tonCuoi : dCN ? dCN.tonThucTe ?? dCN.tonCuoi : 0;
    const tonCaNgay = dCN ? dCN.tonCuoi : null;
    rows.push({
      code,
      tonCuoi: soLuongTon,
      tonThucTe,
      caNgayTon: tonCaNgay,
    });
  }
  return { rows, cdSheetCount: cdNames.length, cnSheetCount: cnNames.length };
}

module.exports = {
  parseSheetName,
  normalizePartCode,
  detectFormat,
  parseSheet,
  mergeSheetRowsByLastOccurrence,
  mergeRowsFromSheetsInOrder,
  buildTonKhoChiTietRows,
};
