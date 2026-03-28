/**
 * POST /api/import-excel/bom
 * Upload file Excel (.xlsx/.xls), parse sheet "BOM" và/hoặc "IN BOM THƯỜNG",
 * import vào Parts + BOMItems.
 *
 * Body (multipart/form-data):
 *   file   — file .xlsx / .xls
 *   mode   — "replace" | "merge"  (default: "merge")
 *   sheets — "bom" | "inbom" | "both"  (default: "both")
 *
 * Response:
 *   { ok, stats: { partsNew, partsSkipped, bomNew, bomSkipped, bomDuplicate,
 *                  sheetsFound, sheetStats } }
 */

const { Router }  = require("express");
const multer      = require("multer");
const XLSX        = require("xlsx");
const sql         = require("mssql");
const { getPool } = require("../db");

const router  = Router();
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Normalize một dòng BOM ───────────────────────────────────────────────────
function normRow(codeTong, codeCon, moTa, cumVatLieu, model, heSo, donVi) {
  if (!codeTong || !codeCon) return null;
  const ct = String(codeTong).trim().toUpperCase();
  const cc = String(codeCon).trim().toUpperCase();
  if (!ct || !cc || ct === cc) return null;
  return {
    codeTong:   ct,
    codeCon:    cc,
    moTa:       moTa        ? String(moTa).trim().slice(0, 500)        : null,
    cumVatLieu: cumVatLieu  ? String(cumVatLieu).trim().slice(0, 100)  : null,
    model:      model       ? String(model).trim().slice(0, 200)       : null,
    heSo:       typeof heSo === "number" && heSo > 0 ? heSo : 1,
    donVi:      donVi       ? String(donVi).trim().slice(0, 20)        : null,
  };
}

// ─── Parser sheet "BOM" (dạng bảng phẳng với header row) ─────────────────────
// Cột: CODE TỔNG | CODE CON | MÔ TẢ | Cụm vật liệu | Model | Hệ số
function parseBomSheet(ws) {
  const COL = {
    codeTong:   ["CODE TỔNG", "CODE TONG", "CodeTong", "CODE_TONG"],
    codeCon:    ["CODE CON",  "CODE_CON",  "CodeCon",  "code_con"],
    moTa:       ["MÔ TẢ", "MO TA", "MoTa", "ITEM DESCRIPTION", "Item Description"],
    cumVatLieu: ["Cụm vật liệu", "Cum vat lieu", "CumVatLieu"],
    model:      ["Model", "MODEL"],
    heSo:       ["Hệ số", "He so", "HeSo", "QTY"],
  };
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  const get  = (row, keys) => { for (const k of keys) if (row[k] != null) return row[k]; return null; };

  const result = [];
  for (const r of rows) {
    const row = normRow(
      get(r, COL.codeTong), get(r, COL.codeCon),
      get(r, COL.moTa), get(r, COL.cumVatLieu),
      get(r, COL.model), get(r, COL.heSo)
    );
    if (row) result.push(row);
  }
  return result;
}

// ─── Parser sheet "IN BOM THƯỜNG" (phiếu in BOM 1 assembly) ─────────────────
// Cấu trúc:
//   - Code Tổng: ưu tiên dòng "Code Halb :" → col kế tiếp có pattern Samsung
//   - Fallback: dòng 0 "CODE" → col kế (mã rút gọn)
//   - Header row: dòng có "No." + "Code"
//   - Data: từ hIdx+1, col 3 = Code Con
function parseInBomSheet(ws) {
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (!rawRows.length) return [];

  let codeTong = null;

  // Ưu tiên 1: tìm "Code Halb" → lấy giá trị Samsung code (GH97-xxx) ở col tiếp theo
  for (let i = 0; i < Math.min(rawRows.length, 12); i++) {
    const r = rawRows[i];
    for (let j = 0; j < r.length; j++) {
      if (/code.?halb/i.test(String(r[j]))) {
        // Tìm cell tiếp theo có giá trị hợp lệ (không rỗng, không phải label)
        for (let k = j + 1; k < r.length; k++) {
          const v = String(r[k]).trim();
          if (v && !/model|date|norm|po|line|sl|timeto/i.test(v) && !v.includes(" ")) {
            codeTong = v.toUpperCase();
            break;
          }
        }
        break;
      }
    }
    if (codeTong) break;
  }

  // Ưu tiên 2: tìm pattern Samsung code đầy đủ (GH97-xxx) trong vùng header
  if (!codeTong) {
    for (let i = 0; i < Math.min(rawRows.length, 12); i++) {
      const found = rawRows[i].find(c =>
        typeof c === "string" && /^[A-Z]{2}\d{2,}-[A-Z0-9]/.test(c.trim())
      );
      if (found) { codeTong = found.trim().toUpperCase(); break; }
    }
  }

  // Fallback 3: tìm label "CODE" → lấy cell bên cạnh
  if (!codeTong) {
    for (let i = 0; i < Math.min(rawRows.length, 12); i++) {
      const r = rawRows[i];
      for (let j = 0; j < r.length - 1; j++) {
        if (String(r[j]).trim().toUpperCase() === "CODE") {
          const v = String(r[j + 1]).trim();
          if (v && !v.includes(" ") && !/norm|date|model/i.test(v)) {
            codeTong = v.toUpperCase();
            break;
          }
        }
      }
      if (codeTong) break;
    }
  }

  if (!codeTong) return []; // Không tìm được code tổng → bỏ qua sheet

  // Tìm header row (có "No." + "Code")
  let hIdx = rawRows.findIndex(r =>
    r.some(c => /^no\.?$/i.test(String(c).trim())) &&
    r.some(c => String(c).trim() === "Code")
  );
  if (hIdx < 0) hIdx = 11;

  const header = rawRows[hIdx] || [];
  const col = {
    code: header.findIndex(c => String(c).trim() === "Code"),
    desc: header.findIndex(c => /item.?desc/i.test(String(c))),
    heSo: header.findIndex(c => /hệ.?số|he.?so/i.test(String(c))),
    donVi: header.findIndex(c => /đơn.?vị|don.?vi/i.test(String(c))),
    remark: header.findIndex(c => /remark/i.test(String(c))),
  };
  // Fallback nếu không tìm được cột
  if (col.code  < 0) col.code  = 3;
  if (col.desc  < 0) col.desc  = 4;
  if (col.heSo  < 0) col.heSo  = 7;
  if (col.donVi < 0) col.donVi = 8;

  const result = [];
  for (let i = hIdx + 1; i < rawRows.length; i++) {
    const r      = rawRows[i];
    const codeCon = String(r[col.code] ?? "").trim();
    if (!codeCon || codeCon === codeTong) continue;
    // Bỏ qua dòng không có code hợp lệ
    if (!/^[A-Z0-9][\w\-]{2,}$/i.test(codeCon)) continue;

    const moTa  = r[col.desc]  ?? null;
    const heSo  = r[col.heSo]  ?? null;
    const donVi = col.donVi >= 0 ? (r[col.donVi] ?? null) : null;

    const row = normRow(codeTong, codeCon, moTa, null, null, heSo, donVi);
    if (row) result.push(row);
  }
  return result;
}

// ─── Parse toàn bộ workbook, hỗ trợ cả 2 sheet ───────────────────────────────
function parseExcel(buffer, sheetFilter = "both") {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetNames = wb.SheetNames;

  const sheetStats = [];
  let allRows = [];

  const wantBom   = sheetFilter === "both" || sheetFilter === "bom";
  const wantInBom = sheetFilter === "both" || sheetFilter === "inbom";

  // Sheet "BOM"
  if (wantBom && sheetNames.includes("BOM")) {
    const rows = parseBomSheet(wb.Sheets["BOM"]);
    sheetStats.push({ sheet: "BOM", rows: rows.length });
    allRows = allRows.concat(rows);
  }

  // Sheet "IN BOM THƯỜNG"
  if (wantInBom && sheetNames.includes("IN BOM THƯỜNG")) {
    const rows = parseInBomSheet(wb.Sheets["IN BOM THƯỜNG"]);
    sheetStats.push({ sheet: "IN BOM THƯỜNG", rows: rows.length });
    allRows = allRows.concat(rows);
  }

  // Fallback: nếu không có sheet nào quen, thử sheet đầu tiên như BOM
  if (allRows.length === 0 && sheetNames.length > 0) {
    const ws   = wb.Sheets[sheetNames[0]];
    const rows = parseBomSheet(ws);
    if (rows.length) {
      sheetStats.push({ sheet: sheetNames[0] + " (auto)", rows: rows.length });
      allRows = rows;
    }
  }

  if (!allRows.length) {
    throw new Error(
      `Không tìm thấy dữ liệu hợp lệ. Sheets trong file: ${sheetNames.join(", ")}. ` +
      `Hỗ trợ: sheet "BOM" (CODE TỔNG|CODE CON|...) hoặc "IN BOM THƯỜNG".`
    );
  }

  return { bomRows: allRows, sheetStats, sheetsFound: sheetNames };
}

// ─── POST /api/import-excel/bom ───────────────────────────────────────────────
router.post("/bom", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Chưa có file upload" });

  const ext = (req.file.originalname || "").toLowerCase();
  if (!ext.endsWith(".xlsx") && !ext.endsWith(".xls"))
    return res.status(400).json({ error: "Chỉ hỗ trợ file .xlsx / .xls" });

  const mode   = (req.body.mode   || "merge").toLowerCase();
  const sheets = (req.body.sheets || "both").toLowerCase();
  if (!["replace", "merge"].includes(mode))
    return res.status(400).json({ error: "mode phải là 'replace' hoặc 'merge'" });
  if (!["bom", "inbom", "both"].includes(sheets))
    return res.status(400).json({ error: "sheets phải là 'bom', 'inbom', hoặc 'both'" });

  let bomRows, sheetStats, sheetsFound;
  try {
    ({ bomRows, sheetStats, sheetsFound } = parseExcel(req.file.buffer, sheets));
  } catch (e) {
    return res.status(422).json({ error: e.message });
  }

  const pool = await getPool();

  try {
    // ── Chuẩn bị tập mã ──────────────────────────────────────────────────────
    const codeTongSet = new Set(bomRows.map(r => r.codeTong));
    const allCodes    = new Map(); // code → { moTa, cumVatLieu, model, laAssembly }

    // Thu thập CumVatLieu + Model đầu tiên cho mỗi Code Tổng từ context BOM rows
    const codeTongCtx = new Map(); // code → { cumVatLieu, model }
    bomRows.forEach(r => {
      if (!codeTongCtx.has(r.codeTong)) {
        codeTongCtx.set(r.codeTong, { cumVatLieu: r.cumVatLieu, model: r.model });
      }
    });

    bomRows.forEach(r => {
      if (!allCodes.has(r.codeCon)) {
        allCodes.set(r.codeCon, { moTa: r.moTa, cumVatLieu: r.cumVatLieu, model: r.model, donVi: r.donVi || null, laAssembly: 0 });
      }
    });
    codeTongSet.forEach(c => {
      const ctx = codeTongCtx.get(c) || {};
      if (!allCodes.has(c)) {
        allCodes.set(c, { moTa: null, cumVatLieu: ctx.cumVatLieu || null, model: ctx.model || null, donVi: null, laAssembly: 1 });
      } else {
        allCodes.get(c).laAssembly = 1;
      }
    });

    let stats = {
      partsNew: 0, partsSkipped: 0,
      bomNew: 0, bomSkipped: 0, bomDuplicate: 0,
      totalRows: bomRows.length,
      sheetStats, sheetsFound,
    };

    // ── REPLACE: xoá sạch ────────────────────────────────────────────────────
    if (mode === "replace") {
      await pool.request().query("DELETE FROM BOMItems");
      await pool.request().query("DELETE FROM Parts");
    }

    // ── Insert Parts ─────────────────────────────────────────────────────────
    const BATCH = 500;
    const partEntries = [...allCodes.entries()];

    for (let i = 0; i < partEntries.length; i += BATCH) {
      const chunk = partEntries.slice(i, i + BATCH);
      if (mode === "replace") {
        const table = new sql.Table("Parts");
        table.create = false;
        table.columns.add("Code",         sql.NVarChar(50),  { nullable: false });
        table.columns.add("MoTa",         sql.NVarChar(500), { nullable: true });
        table.columns.add("CumVatLieu",   sql.NVarChar(100), { nullable: true });
        table.columns.add("Model",        sql.NVarChar(200), { nullable: true });
        table.columns.add("DonVi",        sql.NVarChar(20),  { nullable: true });
        table.columns.add("LaAssembly",   sql.Bit,           { nullable: false });
        table.columns.add("DangHoatDong", sql.Bit,           { nullable: false });
        chunk.forEach(([code, info]) => {
          table.rows.add(code, info.moTa, info.cumVatLieu, info.model, info.donVi || null, info.laAssembly, 1);
        });
        await pool.request().bulk(table);
        stats.partsNew += chunk.length;
      } else {
        // MERGE: INSERT nếu chưa có
        for (const [code, info] of chunk) {
          const r = await pool.request()
            .input("Code",         sql.NVarChar(50),  code)
            .input("MoTa",         sql.NVarChar(500), info.moTa)
            .input("CumVatLieu",   sql.NVarChar(100), info.cumVatLieu)
            .input("Model",        sql.NVarChar(200), info.model)
            .input("DonVi",        sql.NVarChar(20),  info.donVi || null)
            .input("LaAssembly",   sql.Bit,           info.laAssembly)
            .query(`
              IF NOT EXISTS (SELECT 1 FROM Parts WHERE Code = @Code)
                INSERT INTO Parts (Code, MoTa, CumVatLieu, Model, DonVi, LaAssembly, DangHoatDong)
                VALUES (@Code, @MoTa, @CumVatLieu, @Model, @DonVi, @LaAssembly, 1)
              ELSE
                UPDATE Parts SET
                  MoTa = COALESCE(@MoTa, MoTa),
                  CumVatLieu = COALESCE(@CumVatLieu, CumVatLieu),
                  Model = COALESCE(@Model, Model),
                  DonVi = COALESCE(@DonVi, DonVi),
                  LaAssembly = CASE WHEN @LaAssembly = 1 THEN 1 ELSE LaAssembly END,
                  DangHoatDong = 1
                WHERE Code = @Code
            `);
          if (r.rowsAffected[0] === 1) stats.partsNew++;
          else stats.partsSkipped++;
        }
      }
    }

    // ── Insert BOMItems ───────────────────────────────────────────────────────
    // Loại trùng (codeTong + codeCon)
    const seen    = new Set();
    const unique  = bomRows.filter(r => {
      const key = `${r.codeTong}|${r.codeCon}`;
      if (seen.has(key)) { stats.bomDuplicate++; return false; }
      seen.add(key);
      return true;
    });

    const thuTuMap = new Map();

    for (let i = 0; i < unique.length; i += BATCH) {
      const chunk = unique.slice(i, i + BATCH);

      if (mode === "replace") {
        const table = new sql.Table("BOMItems");
        table.create = false;
        table.columns.add("CodeTong",     sql.NVarChar(50),   { nullable: false });
        table.columns.add("CodeCon",      sql.NVarChar(50),   { nullable: false });
        table.columns.add("HeSo",         sql.Decimal(10, 4), { nullable: false });
        table.columns.add("CumVatLieu",   sql.NVarChar(100),  { nullable: true });
        table.columns.add("ThuTu",        sql.Int,            { nullable: true });
        table.columns.add("DangHoatDong", sql.Bit,            { nullable: false });
        chunk.forEach(r => {
          const n = (thuTuMap.get(r.codeTong) || 0) + 1;
          thuTuMap.set(r.codeTong, n);
          table.rows.add(r.codeTong, r.codeCon, r.heSo || 1, r.cumVatLieu, n, 1);
        });
        await pool.request().bulk(table);
        stats.bomNew += chunk.length;
      } else {
        for (const r of chunk) {
          const n = (thuTuMap.get(r.codeTong) || 0) + 1;
          thuTuMap.set(r.codeTong, n);
          const res2 = await pool.request()
            .input("CodeTong",   sql.NVarChar(50),   r.codeTong)
            .input("CodeCon",    sql.NVarChar(50),   r.codeCon)
            .input("HeSo",       sql.Decimal(10, 4), r.heSo || 1)
            .input("CumVatLieu", sql.NVarChar(100),  r.cumVatLieu)
            .input("ThuTu",      sql.Int,            n)
            .query(`
              IF NOT EXISTS (
                SELECT 1 FROM BOMItems WHERE CodeTong=@CodeTong AND CodeCon=@CodeCon AND DangHoatDong=1
              )
                INSERT INTO BOMItems (CodeTong, CodeCon, HeSo, CumVatLieu, ThuTu, DangHoatDong)
                VALUES (@CodeTong, @CodeCon, @HeSo, @CumVatLieu, @ThuTu, 1)
            `);
          if (res2.rowsAffected[0] === 1) stats.bomNew++;
          else stats.bomSkipped++;
        }
      }
    }

    // ── Thống kê từ DB ────────────────────────────────────────────────────────
    const dbStats = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM Parts WHERE DangHoatDong=1)              AS TongParts,
        (SELECT COUNT(*) FROM Parts WHERE LaAssembly=1 AND DangHoatDong=1) AS TongAssembly,
        (SELECT COUNT(*) FROM BOMItems WHERE DangHoatDong=1)           AS TongBOM,
        (SELECT COUNT(DISTINCT CodeTong) FROM BOMItems WHERE DangHoatDong=1) AS UniqueTong
    `);
    stats.db = dbStats.recordset[0];

    res.json({ ok: true, stats });
  } catch (err) {
    console.error("POST /api/import-excel/bom:", err.message || err);
    res.status(500).json({ error: "Lỗi khi import: " + (err.message || String(err)) });
  }
});

module.exports = router;
