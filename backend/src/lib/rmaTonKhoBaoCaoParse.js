/**
 * Parse sheet báo cáo "Tồn kho RMA" (.xlsx) — hỗ trợ nhiều layout (ca CN/CD, báo cáo tháng, v.v.).
 * Tồn RMA: cột trong khối "TỒN CUỐI" → nhãn phụ "RMA", hoặc một ô gộp "Tồn cuối RMA".
 */
const XLSX = require("xlsx");

function normalizePartCode(cell) {
  return String(cell ?? "").trim().toUpperCase();
}

function chuanHoaHeader(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\u0300-\u036f/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function laTonCuoiHeader(h) {
  const u = chuanHoaHeader(h);
  /** Một ô: "Tồn RMA", "Tồn kho RMA" — không có chữ CUỐI */
  if (u.includes("RMA") && (u.includes("TON") || u.includes("TỒN") || u.includes("TON KHO"))) return true;
  return (
    (u.includes("CUOI") || u.includes("CUỐI") || u.includes("END")) &&
    (u.includes("TON") || u.includes("TỒN") || u.includes("TON KHO"))
  );
}

function laMaLinhKienHeader(h) {
  const u = chuanHoaHeader(h).replace(/\s/g, "");
  if (u.includes("CODE") || u.includes("PART") || u.includes("MATERIAL")) return true;
  if (u === "MA" || u.includes("MALINHKIEN") || u.includes("MÃLINHKIỆN")) return true;
  if (u.includes("MALINHKIEN") || u.includes("MALK") || u.includes("MAHANG")) return true;
  return false;
}

function laModelHeader(h) {
  const u = chuanHoaHeader(h);
  return u.includes("MODEL") || u.includes("MODEL NO");
}

function laMoTaHeader(h) {
  const u = chuanHoaHeader(h);
  return u.includes("MO TA") || u.includes("DESCRIPTION") || u.includes("TEN HANG") || u.includes("TÊN");
}

function laViTriHeader(h) {
  const u = chuanHoaHeader(h);
  return u.includes("VI TRI") || u.includes("VỊ TRÍ") || u.includes("LOCATION");
}

/** Tìm cột CODE trong vài hàng đầu */
function findCodeCol(rows) {
  const maxR = Math.min(20, rows.length);
  for (let r = 0; r < maxR; r++) {
    const row = rows[r] || [];
    for (let j = 0; j < row.length; j++) {
      if (laMaLinhKienHeader(row[j])) return j;
    }
  }
  return 2;
}

/** Tìm cột tồn cuối RMA: (hàng TỒN CUỐI + hàng con RMA) hoặc ô gộp chứa cả hai */
function findTonCuoiRmaCol(rows) {
  const maxR = Math.min(20, rows.length);
  for (let r = 0; r < maxR; r++) {
    const row = rows[r] || [];
    for (let j = 0; j < row.length; j++) {
      const h = String(row[j] ?? "");
      const u = chuanHoaHeader(h);
      if (/RMA/.test(u) && laTonCuoiHeader(h)) return j;
    }
  }
  for (let r = 0; r < maxR; r++) {
    for (let r2 = r + 1; r2 < Math.min(r + 4, maxR); r2++) {
      const row1 = rows[r] || [];
      const row2 = rows[r2] || [];
      const len = Math.max(row1.length, row2.length);
      for (let j = 0; j < len; j++) {
        const h = String(row1[j] ?? "");
        const sub = String(row2[j] ?? "")
          .trim()
          .toUpperCase()
          .replace(/\s/g, "");
        if (laTonCuoiHeader(h) && sub === "RMA") return j;
      }
    }
  }
  for (let r = 0; r < maxR; r++) {
    const row = rows[r] || [];
    for (let j = 0; j < row.length; j++) {
      const sub = String(row[j] ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s/g, "");
      if (sub !== "RMA") continue;
      for (let pr = Math.max(0, r - 3); pr < r; pr++) {
        const above = String((rows[pr] || [])[j] ?? "");
        if (laTonCuoiHeader(above)) return j;
      }
    }
  }
  for (let r = 0; r < maxR; r++) {
    const row = rows[r] || [];
    for (let j = 0; j < row.length; j++) {
      const u = chuanHoaHeader(String(row[j] ?? ""));
      if (u.includes("RMA") && (u.includes("TON") || u.includes("SL") || u.includes("SO LUONG"))) {
        return j;
      }
    }
  }
  return -1;
}

/**
 * Fallback: ô chỉ ghi "RMA" (hoặc gần giống) làm header cột tồn — hay gặp ở báo cáo tháng.
 */
function findTonRmaHeaderOnlyCol(rows) {
  const maxR = Math.min(20, rows.length);
  for (let r = 0; r < maxR; r++) {
    const row = rows[r] || [];
    for (let j = 0; j < row.length; j++) {
      const raw = String(row[j] ?? "").trim();
      const u = chuanHoaHeader(raw).replace(/\s/g, "");
      if (u === "RMA" || u === "RMA ") return j;
    }
  }
  return -1;
}

/**
 * Khi không nhận ra header: tìm cột (không phải mã) có nhiều nhất dòng (mã hợp lệ + số không âm).
 */
function findOptionalCol(rows, predicate) {
  const maxR = Math.min(20, rows.length);
  for (let r = 0; r < maxR; r++) {
    const row = rows[r] || [];
    for (let j = 0; j < row.length; j++) {
      if (predicate(row[j])) return j;
    }
  }
  return -1;
}

function hopLeMaLinhKien(code) {
  return code && code !== "TOTAL" && /^[A-Z0-9][\w\-]{2,}$/i.test(code);
}

/** Khi header không chuẩn: cột có nhiều ô giống mã linh kiện nhất (hàng 5 trở đi). */
function findCodeColHeuristic(rows) {
  const lens = rows.slice(0, 100).map((r) => (r && r.length) || 0);
  const maxCol = Math.min(25, Math.max(8, lens.length ? Math.max(...lens) : 8));
  let bestJ = 2;
  let bestScore = 0;
  for (let j = 0; j < maxCol; j++) {
    let score = 0;
    for (let i = 5; i < Math.min(rows.length, 400); i++) {
      const code = normalizePartCode((rows[i] || [])[j]);
      if (hopLeMaLinhKien(code)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestJ = j;
    }
  }
  if (bestScore >= 3) return { col: bestJ, score: bestScore };
  return { col: 2, score: 0 };
}

function findTonColumnByDataHeuristic(rows, colCode, minScore = 5) {
  const lens = rows.slice(0, 80).map((r) => (r && r.length) || 0);
  const maxCol = Math.min(50, Math.max(12, lens.length ? Math.max(...lens) : 12));
  let bestJ = -1;
  let bestScore = 0;
  for (let j = 0; j < maxCol; j++) {
    if (j === colCode) continue;
    let score = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || [];
      const code = normalizePartCode(r[colCode]);
      if (!hopLeMaLinhKien(code)) continue;
      const raw = r[j];
      const n =
        typeof raw === "number" && Number.isFinite(raw)
          ? raw
          : parseFloat(String(raw ?? "").replace(/,/g, "").replace(/\s/g, ""));
      if (Number.isFinite(n) && n >= 0 && n < 1e9) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestJ = j;
    }
  }
  if (bestScore >= minScore) return { col: bestJ, score: bestScore };
  return { col: -1, score: 0 };
}

function findDataStartRow(rows, colCode, colTon) {
  const maxScan = Math.min(rows.length, 500);
  for (let i = 6; i < maxScan; i++) {
    const r = rows[i] || [];
    const code = normalizePartCode(r[colCode]);
    if (!hopLeMaLinhKien(code)) continue;
    return i;
  }
  for (let i = 3; i < Math.min(25, rows.length); i++) {
    const r = rows[i] || [];
    const code = normalizePartCode(r[colCode]);
    if (!hopLeMaLinhKien(code)) continue;
    const rawTon = r[colTon];
    const hasTon =
      (typeof rawTon === "number" && Number.isFinite(rawTon)) ||
      (String(rawTon ?? "").trim() !== "" && !Number.isNaN(parseFloat(String(rawTon).replace(/,/g, ""))));
    if (hasTon) return i;
  }
  for (let i = 0; i < maxScan; i++) {
    const r = rows[i] || [];
    const code = normalizePartCode(r[colCode]);
    if (!hopLeMaLinhKien(code)) continue;
    return i;
  }
  return 6;
}

function parseSoNguyenDuong(val) {
  if (typeof val === "number" && Number.isFinite(val)) return Math.max(0, Math.round(val));
  const n = parseFloat(String(val ?? "").replace(/,/g, "").replace(/\s/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function buildRowsFromCols(rows, colCode, colTon) {
  const colModel = findOptionalCol(rows, laModelHeader);
  const colMoTa = findOptionalCol(rows, laMoTaHeader);
  const colViTri = findOptionalCol(rows, laViTriHeader);
  const start = findDataStartRow(rows, colCode, colTon);
  const out = [];
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const code = normalizePartCode(r[colCode]);
    if (!hopLeMaLinhKien(code)) continue;
    const sl = parseSoNguyenDuong(r[colTon]);
    out.push({
      code,
      soLuongTon: sl,
      model: colModel >= 0 ? String(r[colModel] ?? "").trim() || null : null,
      moTa: colMoTa >= 0 ? String(r[colMoTa] ?? "").trim() || null : null,
      viTri: colViTri >= 0 ? String(r[colViTri] ?? "").trim() || null : null,
    });
  }
  return out;
}

/**
 * @returns {Array<{ code: string, soLuongTon: number, model: string|null, moTa: string|null, viTri: string|null }>}
 */
function parseRmaTonKhoBaoCaoSheetDetailed(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (rows.length < 4) return [];

  let colCode = findCodeCol(rows);
  let colTon = findTonCuoiRmaCol(rows);
  if (colTon < 0) colTon = findTonRmaHeaderOnlyCol(rows);
  if (colTon < 0) {
    const h = findTonColumnByDataHeuristic(rows, colCode);
    if (h.col >= 0) colTon = h.col;
  }
  if (colTon < 0) return [];

  let out = buildRowsFromCols(rows, colCode, colTon);
  if (out.length === 0) {
    const { col: gc } = findCodeColHeuristic(rows);
    let tt = findTonCuoiRmaCol(rows);
    if (tt < 0) tt = findTonRmaHeaderOnlyCol(rows);
    if (tt < 0) {
      const h = findTonColumnByDataHeuristic(rows, gc, 5);
      if (h.col >= 0) tt = h.col;
    }
    if (tt >= 0) out = buildRowsFromCols(rows, gc, tt);
  }
  if (out.length === 0) {
    const { col: gc } = findCodeColHeuristic(rows);
    const h = findTonColumnByDataHeuristic(rows, gc, 3);
    if (h.col >= 0) out = buildRowsFromCols(rows, gc, h.col);
  }
  return out;
}

function parseRmaTonKhoBaoCaoSheet(ws) {
  return parseRmaTonKhoBaoCaoSheetDetailed(ws).map((r) => ({
    code: r.code,
    soLuongTon: r.soLuongTon,
  }));
}

/**
 * Chọn sheet có dữ liệu parse được; ưu tiên N sheet cuối cùng có dữ liệu (báo cáo tháng thường 1 sheet).
 */
function pickSheetNamesForMerge(wb, lastCount) {
  const allNames = wb.SheetNames || [];
  if (allNames.length === 0) return [];
  const withData = [];
  for (const sn of allNames) {
    const ws = wb.Sheets[sn];
    if (!ws) continue;
    const n = parseRmaTonKhoBaoCaoSheet(ws).length;
    if (n > 0) withData.push(sn);
  }
  if (withData.length > 0) {
    return withData.slice(-Math.min(lastCount, withData.length));
  }
  for (let i = allNames.length - 1; i >= 0; i--) {
    const sn = allNames[i];
    const ws = wb.Sheets[sn];
    if (!ws) continue;
    if (parseRmaTonKhoBaoCaoSheetDetailed(ws).length > 0) return [sn];
  }
  return allNames.slice(-Math.min(lastCount, allNames.length));
}

/**
 * Gộp sheet đã chọn; cùng mã → sheet sau ghi đè (giữ đủ field từ bản ghi sau).
 * @returns {{ rows: Array<{ code: string, soLuongTon: number, model?: string|null, moTa?: string|null, viTri?: string|null }>, sheetsUsed: string[] }}
 */
function mergeRmaTonFromLastSheets(wb, lastCount = 2) {
  const allNames = wb.SheetNames || [];
  if (allNames.length === 0) return { rows: [], sheetsUsed: [] };
  let sheetsUsed = pickSheetNamesForMerge(wb, lastCount);
  const merged = new Map();
  for (const sn of sheetsUsed) {
    const ws = wb.Sheets[sn];
    if (!ws) continue;
    for (const row of parseRmaTonKhoBaoCaoSheetDetailed(ws)) {
      merged.set(row.code, row);
    }
  }
  let rows = [...merged.values()];
  /** Sheet đúng có thể không nằm trong “2 sheet cuối có data” — quét toàn bộ sheet nếu vẫn trống */
  if (rows.length === 0) {
    const mergedAll = new Map();
    const used = [];
    for (const sn of allNames) {
      const ws = wb.Sheets[sn];
      if (!ws) continue;
      const ar = parseRmaTonKhoBaoCaoSheetDetailed(ws);
      if (ar.length === 0) continue;
      used.push(sn);
      for (const row of ar) mergedAll.set(row.code, row);
    }
    rows = [...mergedAll.values()];
    if (rows.length > 0) sheetsUsed = used;
  }
  return { rows, sheetsUsed };
}

module.exports = {
  normalizePartCode,
  parseRmaTonKhoBaoCaoSheet,
  parseRmaTonKhoBaoCaoSheetDetailed,
  mergeRmaTonFromLastSheets,
  pickSheetNamesForMerge,
};
