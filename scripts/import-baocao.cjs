/**
 * Import BÁO CÁO XUẤT NHẬP TỒN Excel vào SQL Server
 *
 * Mỗi sheet = 1 ca làm việc (CN = Ca Ngày, CD = Ca Đêm)
 * Cấu trúc mỗi sheet (24 cột, 0-indexed):
 *   [1]=STT  [2]=CODE  [3]=MODEL  [4]=Tồn đầu  [5]=Tồn cuối
 *   NHẬP: [6]=UPK  [7]=IQC  [8]=SX TRẢ LẠI  [9]=SX TRẢ UPL
 *         [10]=FB TRẢ UPL  [11]=RMA OK  [12]=NHẬP HKH
 *   XUẤT: [13]=KITTING  [14]=RMA  [15]=SX UPL  [16]=FB UPL
 *         [17]=TRẢ SX  [18]=QC MƯỢN  [19]=RT
 *   [20]=Tồn thực tế  [21]=Thừa thiếu
 *
 * Kết quả import:
 *   - CaLamViec: 1 record / ca
 *   - TonKhoDauCa: Tồn đầu của ca đầu tiên (CD 28.2)
 *   - PhieuKho + ChiTietPhieuKho: mỗi loại giao dịch có tồn != 0
 *   - TonKhoChiTiet: mỗi mã lấy từ sheet CD/CN gần nhất còn dòng (gộp theo mã, kể cả Code Tổng)
 */

const XLSX   = require("../backend/node_modules/xlsx");
const sql    = require("../backend/node_modules/mssql");
const dotenv = require("../backend/node_modules/dotenv");
const path   = require("path");
const fs     = require("fs");

dotenv.config({ path: path.join(__dirname, "../backend/.env") });

const dbConfig = {
  server:   process.env.DB_SERVER   || "localhost",
  database: process.env.DB_NAME     || "MM_DB",
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true },
  pool: { max: 5 },
};

// ─── Cấu hình cột (base offset — sẽ +1 nếu có cột VỊ TRÍ) ────────────────────
const BASE_NHAP = [
  { off: 6,  key: "UPK"       },
  { off: 7,  key: "IQC"       },
  { off: 8,  key: "SX_TRA_LAI"},
  { off: 9,  key: "SX_TRA_UPL"},
  { off: 10, key: "FB_TRA_UPL"},
  { off: 11, key: "RMA_OK"    },
  { off: 12, key: "NHAP_HKH"  },
];
const BASE_XUAT = [
  { off: 13, key: "KITTING"   },
  { off: 14, key: "RMA"       },
  { off: 15, key: "SX_UPL"    },
  { off: 16, key: "FB_UPL"    },
  { off: 17, key: "TRA_SX"    },
  { off: 18, key: "QC_MUON"   },
  { off: 19, key: "RT"        },
];

function detectFormat(rows) {
  const col2Head = String((rows[2] || [])[2] ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const hasViTriHeader = /V[IÍỊ]TR[IÍ]|VITRI|V\.T/.test(col2Head);
  const dataRows = rows.slice(6, 16).filter(r => String(r[2] ?? "").trim() !== "");
  const locMatch = dataRows.filter(r => /^[A-Z]{1,3}\d{1,2}-\d{1,3}$/i.test(String(r[2]).trim()));
  const hasViTri = hasViTriHeader || (dataRows.length > 0 && locMatch.length / dataRows.length >= 0.1);
  const shift    = hasViTri ? 1 : 0;
  return {
    hasViTri,
    vtCol:    hasViTri ? 2 : -1,
    codeCol:  2 + shift,
    modelCol: 3 + shift,
    dCol:     4 + shift,
    cCol:     5 + shift,
    t20Col:   20 + shift,
    nhapCols: BASE_NHAP.map(c => ({ idx: c.off + shift, key: c.key })),
    xuatCols: BASE_XUAT.map(c => ({ idx: c.off + shift, key: c.key })),
  };
}

// ─── Parse tên sheet → thông tin ca ──────────────────────────────────────────
// "CD 28.2" → { loai: "CD", ngay: 28, thang: 2 }
// "CN 1.3"  → { loai: "CN", ngay: 1,  thang: 3 }
function parseSheetName(name) {
  const m = name.match(/^(CN|CD)\s+(\d+)\.(\d+)$/i);
  if (!m) return null;
  const loai = m[1].toUpperCase(); // CN or CD
  const ngay = parseInt(m[2]);
  const thang = parseInt(m[3]);
  const year = 2026;

  // CN (Ca Ngày): 07:00 → 19:00
  // CD (Ca Đêm):  19:00 → 07:00 hôm sau
  let batDau, ketThuc;
  if (loai === "CN") {
    batDau  = new Date(year, thang - 1, ngay, 7,  0, 0);
    ketThuc = new Date(year, thang - 1, ngay, 19, 0, 0);
  } else {
    batDau  = new Date(year, thang - 1, ngay, 19, 0, 0);
    ketThuc = new Date(year, thang - 1, ngay + 1, 7, 0, 0);
  }

  return {
    tenCa: `${loai === "CN" ? "Ca Ngày" : "Ca Đêm"} ${ngay}/${thang}/${year}`,
    loaiCa: loai,
    batDau,
    ketThuc,
  };
}

// ─── Đọc Excel ────────────────────────────────────────────────────────────────
function openWorkbook() {
  const dir   = path.join(__dirname, "..");
  const files = fs.readdirSync(dir).filter(f => f.includes("BÁO CÁO") || f.includes("BAO CAO"));
  if (!files.length) throw new Error("Không tìm thấy file BÁO CÁO XUẤT NHẬP TỒN");
  // Ưu tiên file không có "(1)" (phiên bản mới nhất)
  const chosen = files.find(f => !f.includes("(1)")) || files[0];
  console.log(`📂 File: ${chosen}`);
  return XLSX.readFile(path.join(dir, chosen));
}

function normalizePartCode(cell) {
  return String(cell ?? "").trim().toUpperCase();
}

// ─── Parse dữ liệu một sheet ─────────────────────────────────────────────────
function parseSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const fmt  = detectFormat(rows);
  const data = [];

  if (fmt.hasViTri) process.stdout.write(" [có VỊ TRÍ]");

  for (let i = 6; i < rows.length; i++) {
    const r    = rows[i];
    const code = normalizePartCode(r[fmt.codeCol]);
    if (!code || code === "TOTAL" || !/^[A-Z0-9][\w\-]{2,}$/i.test(code)) continue;

    const tonDau  = typeof r[fmt.dCol]  === "number" ? r[fmt.dCol]  : 0;
    const tonCuoi = typeof r[fmt.cCol]  === "number" ? r[fmt.cCol]  : 0;
    const viTri   = fmt.vtCol >= 0 ? String(r[fmt.vtCol] ?? "").trim().toUpperCase() || null : null;

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
      model:     String(r[fmt.modelCol] ?? "").trim() || null,
      viTri,
      tonDau:    Math.round(tonDau),
      tonCuoi:   Math.round(tonCuoi),
      tonThucTe: Math.round(tonThucTe),
      nhap,
      xuat,
    });
  }
  return data;
}

/** Mỗi mã: dòng từ sheet CD/CN gần nhất (duyệt từ cuối file) — không mất Code Tổng / mã chỉ có ở sheet giữa */
function mergeSheetRowsByLastOccurrence(wb, sheetNames, partsSet) {
  const merged = new Map();
  for (const sn of [...sheetNames].reverse()) {
    const ws = wb.Sheets[sn];
    if (!ws) continue;
    const data = parseSheet(ws);
    const valid = data.filter((d) => partsSet.has(d.code));
    for (const d of valid) {
      if (!merged.has(d.code)) merged.set(d.code, d);
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
    const tonThucTe = dCD
      ? dCD.tonThucTe ?? dCD.tonCuoi
      : dCN
        ? dCN.tonThucTe ?? dCN.tonCuoi
        : 0;
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

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const wb = openWorkbook();
  const sheets = wb.SheetNames.filter(n => /^(CN|CD)\s+\d+\.\d+$/i.test(n));
  console.log(`📋 ${sheets.length} sheets hợp lệ: ${sheets[0]} → ${sheets[sheets.length - 1]}\n`);

  // Kết nối DB
  console.log("🔌 Kết nối DB...");
  const pool = await sql.connect(dbConfig);

  // Admin user
  const adminRes = await pool.request().query("SELECT TOP 1 MaNguoiDung FROM NguoiDung WHERE Quyen='admin'");
  const maNguoiDung = adminRes.recordset[0]?.MaNguoiDung || 1;
  const defaultViTri = 1; // MaViTri=1 (Rack A)

  // ── Xoá dữ liệu cũ ──────────────────────────────────────────────────────────
  console.log("🗑️  Xoá dữ liệu cũ...");
  await pool.request().query("DELETE FROM TonKhoChiTiet");
  await pool.request().query("DELETE FROM TonKhoDauCa");
  await pool.request().query("DELETE FROM ChiTietPhieuKho");
  await pool.request().query("DELETE FROM PhieuKho");
  await pool.request().query("DELETE FROM CaLamViec WHERE TrangThai='da_ket_thuc'");
  console.log("   ✅ Xong\n");

  // ── Lấy danh sách mã hợp lệ trong Parts ─────────────────────────────────────
  console.log("📦 Đọc danh sách Parts...");
  const partsRes = await pool.request().query("SELECT Code FROM Parts WHERE DangHoatDong=1");
  const partsSet = new Set(partsRes.recordset.map(r => r.Code));
  console.log(`   ${partsSet.size} mã hợp lệ trong Parts`);

  // ── Pre-scan tất cả sheets → thu thập unique codes ────────────────────────
  console.log("🔍 Pre-scan sheets để tìm mã chưa có trong Parts...");
  const allExcelCodes = new Map(); // code → model
  for (const sn of sheets) {
    const ws = wb.Sheets[sn];
    if (!ws) continue;
    for (const d of parseSheet(ws)) {
      if (!allExcelCodes.has(d.code)) allExcelCodes.set(d.code, d.model);
    }
  }

  const newPartsList = [];
  for (const [code, model] of allExcelCodes) {
    if (!partsSet.has(code)) newPartsList.push({ code, model });
  }

  let partsAutoCreated = 0;
  if (newPartsList.length > 0) {
    console.log(`   ⚠️  ${newPartsList.length} mã trong Excel chưa có trong Parts → tự động tạo...`);
    const BATCH = 50;
    for (let i = 0; i < newPartsList.length; i += BATCH) {
      const chunk = newPartsList.slice(i, i + BATCH);
      const req   = pool.request();
      const vals  = chunk.map((p, j) => {
        req.input(`nc${i + j}`, sql.NVarChar(50),  p.code);
        req.input(`nm${i + j}`, sql.NVarChar(200), p.model);
        return `(@nc${i + j}, @nm${i + j}, 0, 1)`;
      });
      await req.query(
        `INSERT INTO Parts (Code, Model, LaAssembly, DangHoatDong) VALUES ${vals.join(",")}`
      );
      chunk.forEach(p => partsSet.add(p.code));
      partsAutoCreated += chunk.length;
    }
    console.log(`   ✅ Đã tạo ${partsAutoCreated} Parts mới\n`);
  } else {
    console.log(`   ✅ Tất cả mã đều đã có trong Parts\n`);
  }

  // Cập nhật ViTriText nếu có cột VỊ TRÍ trong Excel
  const viTriMap = new Map();
  for (const sn of sheets) {
    const ws = wb.Sheets[sn];
    if (!ws) continue;
    for (const d of parseSheet(ws)) {
      if (d.viTri && !viTriMap.has(d.code)) viTriMap.set(d.code, d.viTri);
    }
  }
  if (viTriMap.size > 0) {
    console.log(`\n📍 Cập nhật vị trí cho ${viTriMap.size} mã...`);
    for (const [code, viTri] of viTriMap) {
      await pool.request()
        .input("Code",      sql.NVarChar(50), code)
        .input("ViTriText", sql.NVarChar(20), viTri)
        .query("UPDATE Parts SET ViTriText=@ViTriText WHERE Code=@Code AND (ViTriText IS NULL OR ViTriText='')");
    }
    console.log(`   ✅ ${viTriMap.size} vị trí đã lưu\n`);
  }

  let tongCa = 0, tongPhieu = 0, tongChiTiet = 0;
  let isFirstSheet = true;

  for (let si = 0; si < sheets.length; si++) {
    const sheetName = sheets[si];
    const caInfo = parseSheetName(sheetName);
    if (!caInfo) continue;

    const ws   = wb.Sheets[sheetName];
    const data = parseSheet(ws);
    const validData = data.filter(d => partsSet.has(d.code));

    process.stdout.write(`\r🔄 [${si + 1}/${sheets.length}] ${sheetName}: ${validData.length} mã hợp lệ / ${data.length} tổng   `);

    // 1. Tạo CaLamViec
    const caRes = await pool.request()
      .input("MaNguoiDung",   sql.Int,          maNguoiDung)
      .input("ThoiGianBatDau",sql.DateTime,     caInfo.batDau)
      .input("ThoiGianKetThuc",sql.DateTime,    caInfo.ketThuc)
      .input("TrangThai",     sql.NVarChar(50),  "da_ket_thuc")
      .input("GhiChu",        sql.NVarChar(500), `Import từ Excel: ${sheetName}`)
      .input("TenCa",         sql.NVarChar(100), caInfo.tenCa)
      .input("LoaiCa",        sql.NVarChar(10),  caInfo.loaiCa)
      .query(`
        INSERT INTO CaLamViec (MaNguoiDung, ThoiGianBatDau, ThoiGianKetThuc, TrangThai, GhiChu, TenCa, LoaiCa)
        OUTPUT INSERTED.MaCa
        VALUES (@MaNguoiDung, @ThoiGianBatDau, @ThoiGianKetThuc, @TrangThai, @GhiChu, @TenCa, @LoaiCa)
      `);
    const maCa = caRes.recordset[0].MaCa;
    tongCa++;

    // 2. TonKhoDauCa (chỉ ca đầu tiên lưu tồn đầu; sau đó = tồn cuối ca trước)
    if (isFirstSheet) {
      const tonDauRows = validData.filter(d => d.tonDau !== 0);
      if (tonDauRows.length > 0) {
        const tbl = new sql.Table("TonKhoDauCa");
        tbl.create = false;
        tbl.columns.add("MaCa",       sql.Int,           { nullable: false });
        tbl.columns.add("MaLinhKien", sql.NVarChar(50),  { nullable: false });
        tbl.columns.add("MaViTri",    sql.Int,           { nullable: false });
        tbl.columns.add("SoLuong",    sql.Decimal(18,4), { nullable: false });
        tonDauRows.forEach(d => tbl.rows.add(maCa, d.code, defaultViTri, d.tonDau));
        await pool.request().bulk(tbl);
      }
      isFirstSheet = false;
    }

    // 3. PhieuKho + ChiTietPhieuKho — gom theo LoaiGiaoDich
    const phieuMap = new Map(); // "NHAP-UPK" → [{code, model, soLuong}]

    for (const d of validData) {
      for (const [key, val] of Object.entries(d.nhap)) {
        const k = `NHAP|${key}`;
        if (!phieuMap.has(k)) phieuMap.set(k, []);
        phieuMap.get(k).push({ code: d.code, model: d.model, soLuong: val });
      }
      for (const [key, val] of Object.entries(d.xuat)) {
        const k = `XUAT|${key}`;
        if (!phieuMap.has(k)) phieuMap.set(k, []);
        phieuMap.get(k).push({ code: d.code, model: d.model, soLuong: val });
      }
    }

    for (const [mapKey, items] of phieuMap) {
      const [loai, loaiChiTiet] = mapKey.split("|");
      const maPh = `${sheetName.replace(/\s/g, "")}-${loaiChiTiet}`;

      await pool.request()
        .input("MaPhieu",      sql.VarChar(50),   maPh)
        .input("LoaiGiaoDich", sql.NVarChar(20),  loai)
        .input("LoaiChiTiet",  sql.NVarChar(50),  loaiChiTiet)
        .input("NgayThucHien", sql.DateTime,      caInfo.ketThuc)
        .input("MaNguoiDung",  sql.Int,           maNguoiDung)
        .input("GhiChu",       sql.NVarChar(200), `${caInfo.tenCa} — ${loaiChiTiet}`)
        .input("MaCa",         sql.Int,           maCa)
        .query(`
          INSERT INTO PhieuKho (MaPhieu, LoaiGiaoDich, LoaiChiTiet, NgayThucHien, MaNguoiDung, GhiChu, MaCa)
          VALUES (@MaPhieu, @LoaiGiaoDich, @LoaiChiTiet, @NgayThucHien, @MaNguoiDung, @GhiChu, @MaCa)
        `);
      tongPhieu++;

      // ChiTietPhieuKho (batch)
      const tbl = new sql.Table("ChiTietPhieuKho");
      tbl.create = false;
      tbl.columns.add("MaPhieu",    sql.VarChar(50),   { nullable: false });
      tbl.columns.add("MaLinhKien", sql.NVarChar(50),  { nullable: false });
      tbl.columns.add("Model",      sql.NVarChar(100), { nullable: true  });
      tbl.columns.add("SoLuong",    sql.Decimal(18,4), { nullable: false });
      tbl.columns.add("MaViTri",    sql.Int,           { nullable: true  });
      tbl.columns.add("TiLeHaoHut", sql.Decimal(10,4), { nullable: true  });
      items.forEach(it => tbl.rows.add(maPh, it.code, it.model, Math.abs(it.soLuong), defaultViTri, null));
      await pool.request().bulk(tbl);
      tongChiTiet += items.length;
    }

  }

  console.log(`\n\n✅ ${tongCa} ca | ${tongPhieu} phiếu | ${tongChiTiet} chi tiết\n`);

  // ── TonKhoChiTiet: mỗi mã từ sheet CD/CN gần nhất còn dòng (kể cả Code Tổng) ─
  const { rows: tonRows, cdSheetCount, cnSheetCount } = buildTonKhoChiTietRows(wb, sheets, partsSet);
  console.log(`📊 TonKhoChiTiet: ${cdSheetCount} sheet CD, ${cnSheetCount} sheet CN → gộp theo mã (sheet gần nhất)`);
  if (tonRows.length > 0) {
    const BATCH = 50;
    let ins = 0;
    for (let i = 0; i < tonRows.length; i += BATCH) {
      const chunk = tonRows.slice(i, i + BATCH);
      const reqT = pool.request();
      const vals = chunk.map((d, j) => {
        reqT.input(`code${j}`, sql.NVarChar(50), d.code);
        reqT.input(`viTri${j}`, sql.Int, defaultViTri);
        reqT.input(`ton${j}`, sql.Decimal(18, 4), d.tonCuoi);
        reqT.input(`thuc${j}`, sql.Decimal(18, 4), d.tonThucTe ?? d.tonCuoi);
        reqT.input(`ngay${j}`, sql.Decimal(18, 4), d.caNgayTon);
        return `(@code${j}, @viTri${j}, @ton${j}, @thuc${j}, @ngay${j})`;
      });
      await reqT.query(
        `INSERT INTO TonKhoChiTiet (MaLinhKien, MaViTri, SoLuongTon, TonThucTe, TonCuoiCaNgay) VALUES ${vals.join(",")}`
      );
      ins += chunk.length;
      process.stdout.write(`\r   Đang insert TonKhoChiTiet: ${ins}/${tonRows.length}   `);
    }
    console.log(`\n   ✅ ${ins} mã (${tonRows.filter((d) => d.tonCuoi > 0).length} có tồn kho > 0)\n`);
  }

  // ── Thống kê ─────────────────────────────────────────────────────────────────
  const stats = await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM CaLamViec WHERE TrangThai='da_ket_thuc') AS TongCa,
      (SELECT COUNT(*) FROM PhieuKho)                                AS TongPhieu,
      (SELECT COUNT(*) FROM ChiTietPhieuKho)                         AS TongChiTiet,
      (SELECT COUNT(*) FROM TonKhoChiTiet WHERE SoLuongTon > 0)      AS MaCoTon,
      (SELECT SUM(SoLuongTon) FROM TonKhoChiTiet)                    AS TongTon
  `);
  const s = stats.recordset[0];
  console.log("─────────────────────────────────────────");
  console.log(`🆕 Parts tự động tạo   : ${partsAutoCreated}`);
  console.log(`🏭 Ca làm việc lịch sử : ${s.TongCa}`);
  console.log(`📋 Phiếu kho           : ${s.TongPhieu}`);
  console.log(`📝 Chi tiết phiếu      : ${s.TongChiTiet}`);
  console.log(`📦 Mã có tồn kho       : ${s.MaCoTon}`);
  console.log(`🔢 Tổng số lượng tồn   : ${Math.round(s.TongTon).toLocaleString()}`);
  console.log("─────────────────────────────────────────");

  await pool.close();
  console.log("\n✅ Import hoàn tất!");
}

main().catch(e => {
  console.error("\n❌ Lỗi:", e.message || e);
  process.exit(1);
});
