const XLSX = require("xlsx");

/** Chỉ import N sheet cuối (file KHSX thường có rất nhiều tab CN/CD theo ngày; user chỉ cần 2 ngày cuối). */
const KHSX_ONLY_LAST_SHEET_COUNT = 2;

function normalizeHeader(v) {
  return String(v || "")
    .trim()
    .normalize("NFKC")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/_/g, " ");
}

/** Bỏ dấu + chuẩn hóa để khớp header Excel (KHU VỰC ≡ KHU VUC, MÔ TẢ ≡ MO TA) */
function foldVi(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/_/g, " ")
    .replace(/\./g, "")
    .replace(/'/g, "")
    .trim();
}

/** Tìm ô theo danh sách tên cột có thể (so khớp foldVi với mọi header trong dòng) */
function pickValueFlex(row, candidates) {
  for (const cand of candidates) {
    const fc = foldVi(cand);
    if (!fc) continue;
    for (const [k, v] of Object.entries(row)) {
      if (foldVi(k) === fc && v != null && String(v).trim() !== "") return v;
    }
  }
  return null;
}

function excelDateToJS(v) {
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  const s = String(v || "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    let yy = m[3] ? Number(m[3]) : new Date().getFullYear();
    if (yy < 100) yy += 2000;
    return new Date(Date.UTC(yy, mm - 1, dd));
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateISO(d) {
  if (!d) return "";
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function detectShiftFromSheet(sheetName) {
  const s = String(sheetName || "").toUpperCase();
  if (/\bCN\b/.test(s)) return "CN";
  if (/\bCD\b/.test(s)) return "CD";
  return "";
}

function detectDateFromSheet(sheetName, yearHint) {
  const s = String(sheetName || "");
  const m = s.match(/(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?/);
  if (!m) return "";
  const d = Number(m[1]);
  const mo = Number(m[2]);
  let y = m[3] ? Number(m[3]) : yearHint || new Date().getFullYear();
  if (y < 100) y += 2000;
  return formatDateISO(new Date(Date.UTC(y, mo - 1, d)));
}

/** Khớp cột theo quy tắc trên header đã fold (ASCII) */
function pickByHeaderRule(row, test) {
  for (const [k, v] of Object.entries(row)) {
    if (v == null || String(v).trim() === "") continue;
    const fk = foldVi(k);
    if (test(fk)) return v;
  }
  return null;
}

function toInt(v) {
  if (typeof v === "number") return Math.trunc(v);
  const n = Number(String(v || "").replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function mapRow(raw, meta) {
  const row = {};
  Object.entries(raw).forEach(([k, v]) => {
    row[normalizeHeader(k)] = v;
  });

  const dateRaw = pickValueFlex(row, [
    "MASTER DATE",
    "MASTERDATE",
    "NGAY SX",
    "NGAY SAN XUAT",
    "NGÀY SX",
    "NGAY",
    "DATE",
    "PLAN DATE",
    "NGAY KE HOACH",
  ]);
  const dateVal = excelDateToJS(dateRaw);
  const ngaySanXuat = formatDateISO(dateVal) || meta.ngaySanXuat || "";

  const caCell = pickValueFlex(row, ["GIAO CA", "GIAO CA SX", "CA", "SHIFT", "CA SX", "CA SAN XUAT", "HANDOVER"]);
  const caRaw = String(caCell || meta.caSanXuat || "")
    .trim()
    .toUpperCase();
  const caSanXuat = caRaw.includes("DEM") || caRaw === "CD" ? "CD" : caRaw.includes("NGAY") || caRaw === "CN" ? "CN" : "";

  const lineRaw = pickValueFlex(row, [
    "LINE",
    "LINE SX",
    "DAY CHUYEN",
    "DÂY CHUYỀN",
    "LINE SAN XUAT",
    "CHUYỀN",
  ]);
  const lineSanXuat = String(lineRaw || "").trim().toUpperCase();
  const congDoanRaw = pickValueFlex(row, [
    "KHU VỰC",
    "KHU VUC",
    "CONG DOAN",
    "CÔNG ĐOẠN",
    "KHU VỰC/CÔNG ĐOẠN",
    "STAGE",
    "PROCESS",
    "AREA",
    "KHU",
  ]);
  const congDoan = String(congDoanRaw || "").trim().toUpperCase() || "CHUNG";

  const maAssyRaw = pickValueFlex(row, [
    "MODEL CODE",
    "MA ASSY",
    "MÃ ASSY",
    "ASSY CODE",
    "ASSY",
    "MA SAN PHAM",
    "PART NO",
    "PART NUMBER",
    "ITEM CODE",
  ]);
  const maAssy = String(maAssyRaw || "").trim().toUpperCase();

  /* Excel KHSX: Basic Model / Model Desc / Model Code — tách rõ, không gộp vào một cột MODEL */
  let basicModel = String(
    pickValueFlex(row, ["BASIC MODEL", "BASICMODEL", "BASE MODEL", "MODEL BASIC", "BASEMODEL"]) || ""
  ).trim() || null;
  if (!basicModel) {
    const fuzzy = pickByHeaderRule(
      row,
      (fk) =>
        fk.includes("BASIC") &&
        fk.includes("MODEL") &&
        !fk.includes("DESC") &&
        !fk.includes("DESCRIPTION") &&
        !fk.includes("CODE")
    );
    basicModel = fuzzy != null ? String(fuzzy).trim() || null : null;
  }

  let modelDesc = String(
    pickValueFlex(row, [
      "MODEL DESC",
      "MODEL DESCRIPTION",
      "MODEL DESC.",
      "MO TA MODEL",
      "MÔ TẢ MODEL",
      "DESC MODEL",
      "ITEM DESCRIPTION",
      "ITEM DESC",
      "PART DESCRIPTION",
      "DESCRIPTION",
      "MO TA",
      "MÔ TẢ",
    ]) || ""
  ).trim() || null;
  if (!modelDesc) {
    const fuzzyD = pickByHeaderRule(
      row,
      (fk) =>
        (fk.includes("MODEL") && (fk.includes("DESC") || fk.includes("DESCRIPTION"))) ||
        fk.includes("MOTA MODEL") ||
        (fk.includes("ITEM") && fk.includes("DESC")) ||
        (fk.includes("PART") && fk.includes("DESC"))
    );
    modelDesc = fuzzyD != null ? String(fuzzyD).trim() || null : null;
  }

  const modelLegacy = String(
    pickValueFlex(row, ["MODEL", "TEN MODEL", "ASSY MODEL", "MODEL NAME", "MODEL NO"]) || ""
  ).trim() || null;
  const model = basicModel || modelLegacy || null;

  const nhomRaw = String(
    pickValueFlex(row, ["TYPE", "LOAI", "CLASS", "NHOM VAT TU", "NHÓM VẬT TƯ", "LOẠI VT", "MATERIAL TYPE"]) || ""
  )
    .trim()
    .toUpperCase();
  const poTypeRaw = pickValueFlex(row, ["PO TYPE", "PO_TYPE", "PO-TYPE", "LOAI PO", "POTYPE", "PO KIND"]);
  const poType = poTypeRaw != null && String(poTypeRaw).trim() !== "" ? String(poTypeRaw).trim() : null;
  const nhomVatTu = nhomRaw.includes("MAIN") || nhomRaw.includes("DAT TIEN") ? "MAIN" : nhomRaw ? "SUB" : null;

  const slRaw = pickValueFlex(row, [
    "QTY",
    "QUANTITY",
    "QTY PLAN",
    "PLAN QTY",
    "TARGET QTY",
    "ORDER QTY",
    "SO LUONG KE HOACH",
    "SO LUONG",
    "SỐ LƯỢNG",
    "SL KH",
    "KE HOACH",
    "SL",
  ]);
  const soLuongKeHoach = toInt(slRaw);

  return {
    ngaySanXuat,
    caSanXuat,
    lineSanXuat,
    congDoan,
    maAssy,
    basicModel,
    modelDesc,
    poType,
    model,
    nhomVatTu,
    soLuongKeHoach,
  };
}

function isMostlyEmptyRow(raw) {
  const vals = Object.values(raw || {});
  if (!vals.length) return true;
  let nonEmpty = 0;
  for (const v of vals) {
    if (v != null && String(v).trim() !== "") nonEmpty += 1;
  }
  return nonEmpty === 0;
}

function looksLikeHeaderCell(s) {
  const fk = foldVi(normalizeHeader(s));
  return (
    fk.includes("LINE") ||
    fk.includes("ASSY") ||
    fk.includes("MODEL") ||
    fk.includes("BASIC") ||
    fk.includes("QTY") ||
    fk.includes("QUANTITY") ||
    fk.includes("KEHOACH") ||
    fk.includes("PLAN") ||
    fk.includes("SLKH") ||
    fk.includes("NGAY") ||
    fk.includes("DATE") ||
    fk.includes("CA") ||
    fk.includes("KHU") ||
    fk.includes("TYPE") ||
    fk.includes("PO") ||
    fk.includes("MASTER") ||
    fk.includes("DESC") ||
    fk.includes("ITEM")
  );
}

function detectHeaderRowIndex(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const maxScan = Math.min(rows.length, 40);
  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < maxScan; i++) {
    const row = Array.isArray(rows[i]) ? rows[i] : [];
    let score = 0;
    row.forEach((c) => {
      if (looksLikeHeaderCell(c)) score += 1;
    });
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return { headerIdx: bestIdx, allRows: rows };
}

function parseWorkbookKhsx(buffer, opts = {}) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const allSheetNames = wb.SheetNames || [];
  const lastN = Number(opts.onlyLastSheets ?? KHSX_ONLY_LAST_SHEET_COUNT);
  const take = Number.isFinite(lastN) && lastN > 0 ? Math.min(lastN, allSheetNames.length) : allSheetNames.length;
  const sheetNames = take >= allSheetNames.length ? [...allSheetNames] : allSheetNames.slice(-take);
  const rows = [];
  const errors = [];
  const yearHint = opts.yearHint || new Date().getFullYear();

  sheetNames.forEach((sheetName) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;
    const meta = {
      caSanXuat: detectShiftFromSheet(sheetName),
      ngaySanXuat: detectDateFromSheet(sheetName, yearHint),
    };

    const { headerIdx } = detectHeaderRowIndex(ws);
    const jsonRows = XLSX.utils.sheet_to_json(ws, {
      defval: null,
      range: headerIdx,
    });
    jsonRows.forEach((r, idx) => {
      if (isMostlyEmptyRow(r)) return;
      const mapped = mapRow(r, meta);
      const rowNo = headerIdx + idx + 2;
      // Bỏ các dòng ghi chú/footer không phải dữ liệu
      if (!mapped.maAssy && !mapped.lineSanXuat && !mapped.soLuongKeHoach) return;
      const rowErrors = [];
      if (!mapped.ngaySanXuat) rowErrors.push({ field: "NgaySanXuat", code: "MISSING_DATE", message: "Thiếu ngày sản xuất" });
      if (!mapped.caSanXuat) rowErrors.push({ field: "CaSanXuat", code: "MISSING_SHIFT", message: "Thiếu ca sản xuất (CN/CD)" });
      if (!mapped.lineSanXuat) rowErrors.push({ field: "LineSanXuat", code: "MISSING_LINE", message: "Thiếu line sản xuất" });
      if (!mapped.maAssy) rowErrors.push({ field: "MaAssy", code: "MISSING_ASSY", message: "Thiếu mã ASSY" });
      if (!mapped.soLuongKeHoach || mapped.soLuongKeHoach <= 0) {
        rowErrors.push({ field: "SoLuongKeHoach", code: "INVALID_QTY", message: "Số lượng kế hoạch phải > 0" });
      }
      if (rowErrors.length) {
        rowErrors.forEach((e) =>
          errors.push({
            sheetName,
            rowNo,
            field: e.field,
            code: e.code,
            message: e.message,
            rowData: mapped,
          })
        );
      }
      rows.push({
        sheetName,
        rowNo,
        ...mapped,
      });
    });
  });

  return {
    sheetNames,
    sheetNamesAll: allSheetNames,
    rows,
    errors,
  };
}

module.exports = {
  parseWorkbookKhsx,
  KHSX_ONLY_LAST_SHEET_COUNT,
};
