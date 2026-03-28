/**
 * Import BOM từ Excel KITTING BOM A5 - DÙNG CHUNG.xlsx vào SQL Server
 * Sheet BOM:          CODE TỔNG | CODE CON | MÔ TẢ | Cụm vật liệu | Model | Hệ số
 * Sheet IN BOM THƯỜNG: phiếu in 1 assembly — Code Tổng từ "Code Halb", data từ row 12+
 */
const XLSX   = require("../backend/node_modules/xlsx");
const sql    = require("../backend/node_modules/mssql");
const dotenv = require("../backend/node_modules/dotenv");
const path   = require("path");
const fs     = require("fs");
dotenv.config({ path: path.join(__dirname, "../backend/.env") });

// ─── Config DB ────────────────────────────────────────────────────────────────
const dbConfig = {
  server:   process.env.DB_SERVER   || "localhost",
  database: process.env.DB_NAME     || "MM_DB",
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true },
  pool: { max: 5 },
};

// ─── Đọc file Excel, trả về wb + tên file ─────────────────────────────────────
function openWorkbook() {
  const files = fs.readdirSync(path.join(__dirname, "..")).filter(f => f.startsWith("KITTING") && f.endsWith(".xlsx"));
  if (!files.length) throw new Error("Không tìm thấy file KITTING BOM");
  const chosen = files.find(f => f.includes("(1)")) || files[files.length - 1];
  console.log(`📄 Đọc: ${chosen}`);
  return { wb: XLSX.readFile(path.join(__dirname, "..", chosen)), chosen };
}

// ─── Parse sheet BOM (bảng phẳng nhiều assembly) ──────────────────────────────
function parseBomSheet(wb) {
  const ws = wb.Sheets["BOM"];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: null })
    .filter(r => r["CODE TỔNG"] && r["CODE CON"])
    .map(r => ({
      codeTong:   String(r["CODE TỔNG"]).trim().toUpperCase(),
      codeCon:    String(r["CODE CON"]).trim().toUpperCase(),
      moTa:       r["MÔ TẢ"]          ? String(r["MÔ TẢ"]).trim()          : null,
      cumVatLieu: r["Cụm vật liệu"]  ? String(r["Cụm vật liệu"]).trim()   : null,
      model:      r["Model"]          ? String(r["Model"]).trim()           : null,
      heSo:       typeof r["Hệ số"] === "number" ? r["Hệ số"] : 1,
    }));
}

// ─── Parse sheet IN BOM THƯỜNG (phiếu in 1 assembly) ─────────────────────────
function parseInBomSheet(wb) {
  const ws = wb.Sheets["IN BOM THƯỜNG"];
  if (!ws) return [];
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (!rawRows.length) return [];

  // Tìm Code Tổng từ dòng "Code Halb :"
  let codeTong = null;
  for (let i = 0; i < Math.min(rawRows.length, 12); i++) {
    const r = rawRows[i];
    for (let j = 0; j < r.length; j++) {
      if (/code.?halb/i.test(String(r[j]))) {
        for (let k = j + 1; k < r.length; k++) {
          const v = String(r[k]).trim();
          if (v && !/model|date|norm|po|line|sl|timeto/i.test(v) && !v.includes(" ")) {
            codeTong = v.toUpperCase(); break;
          }
        }
        break;
      }
    }
    if (codeTong) break;
  }
  // Fallback: pattern Samsung code
  if (!codeTong) {
    for (let i = 0; i < 12; i++) {
      const found = rawRows[i].find(c => typeof c === "string" && /^[A-Z]{2}\d{2,}-[A-Z0-9]/.test(c.trim()));
      if (found) { codeTong = found.trim().toUpperCase(); break; }
    }
  }
  if (!codeTong) { console.log("   ⚠️  IN BOM THƯỜNG: không tìm được Code Tổng — bỏ qua"); return []; }

  // Tìm header row
  const hIdx = rawRows.findIndex(r =>
    r.some(c => /^no\.?$/i.test(String(c).trim())) && r.some(c => String(c).trim() === "Code")
  ) || 11;
  const header = rawRows[hIdx] || [];
  const cCode  = header.findIndex(c => String(c).trim() === "Code");
  const cDesc  = header.findIndex(c => /item.?desc/i.test(String(c)));
  const cHeSo  = header.findIndex(c => /hệ.?số|he.?so/i.test(String(c)));
  const cDonVi = header.findIndex(c => /đơn.?vị|don.?vi/i.test(String(c)));

  const result = [];
  for (let i = hIdx + 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    const codeCon = String(r[cCode >= 0 ? cCode : 3] ?? "").trim().toUpperCase();
    if (!codeCon || codeCon === codeTong) continue;
    if (!/^[A-Z0-9][\w\-]{2,}$/i.test(codeCon)) continue;
    const donViRaw = cDonVi >= 0 ? r[cDonVi] : null;
    result.push({
      codeTong,
      codeCon,
      moTa:       cDesc >= 0 ? (r[cDesc] ? String(r[cDesc]).trim() : null) : null,
      cumVatLieu: null,
      model:      null,
      heSo:       typeof r[cHeSo >= 0 ? cHeSo : 7] === "number" ? r[cHeSo >= 0 ? cHeSo : 7] : 1,
      donVi:      donViRaw ? String(donViRaw).trim() : null,
    });
  }
  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const { wb } = openWorkbook();

  const bomRows   = parseBomSheet(wb);
  const inBomRows = parseInBomSheet(wb);
  console.log(`✅ Sheet BOM:           ${bomRows.length} dòng`);
  console.log(`✅ Sheet IN BOM THƯỜNG: ${inBomRows.length} dòng (CodeTổng: ${inBomRows[0]?.codeTong || "—"})`);

  // Gộp tất cả, loại trùng sau
  const allRows = [...bomRows, ...inBomRows];
  console.log(`📦 Tổng: ${allRows.length} dòng BOM`);

  // Tập hợp tất cả mã từ cả 2 sheet
  const codeTongSet = new Set(allRows.map(r => r.codeTong));
  const allCodes    = new Map(); // code → { moTa, cumVatLieu, model }

  // Thu thập CumVatLieu + Model đầu tiên cho mỗi Code Tổng từ context BOM rows
  const codeTongCtx = new Map();
  allRows.forEach(r => {
    if (!codeTongCtx.has(r.codeTong)) {
      codeTongCtx.set(r.codeTong, { cumVatLieu: r.cumVatLieu, model: r.model });
    }
  });

  allRows.forEach(r => {
    if (!allCodes.has(r.codeCon))
      allCodes.set(r.codeCon, { moTa: r.moTa, cumVatLieu: r.cumVatLieu, model: r.model, donVi: r.donVi || null });
  });
  codeTongSet.forEach(c => {
    const ctx = codeTongCtx.get(c) || {};
    if (!allCodes.has(c)) {
      allCodes.set(c, { moTa: null, cumVatLieu: ctx.cumVatLieu || null, model: ctx.model || null, donVi: null });
    }
  });

  console.log(`📦 Parts unique: ${allCodes.size} (tổng: ${codeTongSet.size})`);

  // ─── Kết nối DB ──────────────────────────────────────────────────────────
  console.log("🔌 Kết nối DB...");
  const pool = await sql.connect(dbConfig);

  // ─── Xoá dữ liệu cũ nếu có ───────────────────────────────────────────────
  await pool.request().query("DELETE FROM BOMItems");
  await pool.request().query("DELETE FROM Parts");
  console.log("🗑️  Xoá dữ liệu cũ xong");

  // ─── Insert Parts (batch 500) ─────────────────────────────────────────────
  const partEntries = [...allCodes.entries()];
  const BATCH = 500;
  let inserted = 0;

  console.log(`⬆️  Insert ${partEntries.length} Parts...`);
  for (let i = 0; i < partEntries.length; i += BATCH) {
    const chunk = partEntries.slice(i, i + BATCH);
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
      table.rows.add(
        code,
        info.moTa   ? info.moTa.slice(0, 500)   : null,
        info.cumVatLieu ? info.cumVatLieu.slice(0, 100) : null,
        info.model  ? info.model.slice(0, 200)  : null,
        info.donVi  ? info.donVi.slice(0, 20)   : null,
        codeTongSet.has(code) ? 1 : 0,
        1
      );
    });

    await pool.request().bulk(table);
    inserted += chunk.length;
    process.stdout.write(`\r  ${inserted}/${partEntries.length}`);
  }
  console.log(`\n✅ Parts: ${inserted} dòng`);

  // ─── Insert BOMItems (batch 1000) ─────────────────────────────────────────
  console.log(`⬆️  Insert BOMItems từ cả 2 sheet...`);
  const seen    = new Set();
  const unique  = allRows.filter(r => {
    const key = `${r.codeTong}|${r.codeCon}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(`   (${allRows.length - unique.length} dòng trùng bị bỏ, còn ${unique.length})`);

  inserted = 0;
  let thuTuMap = new Map(); // codeTong → counter

  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH);
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
      table.rows.add(
        r.codeTong,
        r.codeCon,
        r.heSo || 1,
        r.cumVatLieu ? r.cumVatLieu.slice(0, 100) : null,
        n,
        1
      );
    });

    await pool.request().bulk(table);
    inserted += chunk.length;
    process.stdout.write(`\r  ${inserted}/${unique.length}`);
  }
  console.log(`\n✅ BOMItems: ${inserted} dòng`);

  // ─── Thống kê cuối ────────────────────────────────────────────────────────
  const stats = await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM Parts)             AS TongParts,
      (SELECT COUNT(*) FROM Parts WHERE LaAssembly=1) AS TongAssembly,
      (SELECT COUNT(*) FROM Parts WHERE LaAssembly=0) AS TongLeaf,
      (SELECT COUNT(*) FROM BOMItems)          AS TongBOM,
      (SELECT COUNT(DISTINCT CodeTong) FROM BOMItems) AS UniqueTong
  `);
  const s = stats.recordset[0];
  console.log("\n📊 Kết quả import:");
  console.log(`  Parts tổng:     ${s.TongParts}`);
  console.log(`  - Assembly:     ${s.TongAssembly}`);
  console.log(`  - Leaf (con):   ${s.TongLeaf}`);
  console.log(`  BOMItems:       ${s.TongBOM}`);
  console.log(`  Code Tổng duy nhất: ${s.UniqueTong}`);

  await pool.close();
  console.log("\n🎉 Import hoàn tất!");
}

main().catch(e => { console.error("❌ Lỗi:", e.message); process.exit(1); });
