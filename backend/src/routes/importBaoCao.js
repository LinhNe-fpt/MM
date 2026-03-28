/**
 * POST /api/import-excel/baocao
 * Upload file BÁO CÁO XUẤT NHẬP TỒN (.xlsx) và import vào DB:
 *   - CaLamViec: mỗi sheet = 1 ca
 *   - TonKhoDauCa: tồn đầu ca đầu tiên
 *   - PhieuKho + ChiTietPhieuKho: giao dịch NHẬP/XUẤT
 *   - TonKhoChiTiet: mỗi mã từ sheet CD/CN gần nhất còn dòng (gộp theo mã, kể cả Code Tổng)
 */

const { Router } = require("express");
const multer     = require("multer");
const XLSX       = require("xlsx");
const sql        = require("mssql");
const { getPool } = require("../db");

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

const {
  parseSheetName,
  parseSheet,
  mergeSheetRowsByLastOccurrence,
  buildTonKhoChiTietRows,
} = require("../lib/baocaoSheetParse");

// ─── POST /api/import-excel/baocao ────────────────────────────────────────────
router.post("/baocao", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Chưa có file upload" });
  const ext = (req.file.originalname || "").toLowerCase();
  if (!ext.endsWith(".xlsx") && !ext.endsWith(".xls"))
    return res.status(400).json({ error: "Chỉ hỗ trợ file .xlsx / .xls" });

  try {
    const wb     = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheets = wb.SheetNames.filter(n => /^(CN|CD)\s+\d+\.\d+$/i.test(n));
    if (!sheets.length)
      return res.status(422).json({ error: "Không tìm thấy sheet hợp lệ (CN/CD X.X)" });

    const pool = await getPool();

    // Admin user
    const adminRes = await pool.request().query("SELECT TOP 1 MaNguoiDung FROM NguoiDung WHERE Quyen='admin'");
    const maNguoiDung  = adminRes.recordset[0]?.MaNguoiDung || 1;
    const defaultViTri = 1;

    // Parts hiện có
    const partsRes = await pool.request().query("SELECT Code FROM Parts WHERE DangHoatDong=1");
    const partsSet = new Set(partsRes.recordset.map(r => r.Code));

    // ── Pre-scan tất cả sheets → thu thập unique codes ────────────────────────
    const allExcelCodes = new Map(); // code → model (lần đầu gặp)
    for (const sn of sheets) {
      const ws = wb.Sheets[sn];
      if (!ws) continue;
      for (const d of parseSheet(ws)) {
        if (!allExcelCodes.has(d.code)) allExcelCodes.set(d.code, d.model);
      }
    }

    // ── Auto-create mã thiếu vào Parts (LoaiPart='leaf') ─────────────────────
    const newPartsList = [];
    for (const [code, model] of allExcelCodes) {
      if (!partsSet.has(code)) newPartsList.push({ code, model });
    }
    let partsAutoCreated = 0;
    if (newPartsList.length > 0) {
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
    }

    // Cập nhật ViTriText nếu Excel có cột VỊ TRÍ
    const viTriMap = new Map(); // code → viTri text
    for (const sn of sheets) {
      const ws = wb.Sheets[sn];
      if (!ws) continue;
      for (const d of parseSheet(ws)) {
        if (d.viTri && !viTriMap.has(d.code)) viTriMap.set(d.code, d.viTri);
      }
    }
    if (viTriMap.size > 0) {
      const entries = [...viTriMap.entries()];
      const BATCH = 50;
      for (let i = 0; i < entries.length; i += BATCH) {
        const chunk = entries.slice(i, i + BATCH);
        for (const [code, viTri] of chunk) {
          await pool.request()
            .input("Code",      sql.NVarChar(50), code)
            .input("ViTriText", sql.NVarChar(20), viTri)
            .query("UPDATE Parts SET ViTriText=@ViTriText WHERE Code=@Code AND (ViTriText IS NULL OR ViTriText='')");
        }
      }
    }

    // Xoá dữ liệu cũ (historical only)
    await pool.request().query("DELETE FROM TonKhoChiTiet");
    await pool.request().query("DELETE FROM TonKhoDauCa");
    await pool.request().query("DELETE FROM ChiTietPhieuKho");
    await pool.request().query("DELETE FROM PhieuKho");
    await pool.request().query("DELETE FROM CaLamViec WHERE TrangThai='da_ket_thuc'");

    let tongCa = 0, tongPhieu = 0, tongChiTiet = 0;
    let isFirstSheet = true;
    const sheetStats = [];

    for (const sheetName of sheets) {
      const caInfo = parseSheetName(sheetName);
      if (!caInfo) continue;

      const ws       = wb.Sheets[sheetName];
      const data     = parseSheet(ws);
      const valid    = data.filter(d => partsSet.has(d.code));

      // CaLamViec
      const caRes = await pool.request()
        .input("MaNguoiDung",    sql.Int,          maNguoiDung)
        .input("ThoiGianBatDau", sql.DateTime,     caInfo.batDau)
        .input("ThoiGianKetThuc",sql.DateTime,     caInfo.ketThuc)
        .input("TrangThai",      sql.NVarChar(30),  "da_ket_thuc")
        .input("GhiChu",         sql.NVarChar(500), `Import Excel: ${sheetName}`)
        .input("TenCa",          sql.NVarChar(100), caInfo.tenCa)
        .input("LoaiCa",         sql.NVarChar(10),  caInfo.loaiCa)
        .query(`INSERT INTO CaLamViec (MaNguoiDung,ThoiGianBatDau,ThoiGianKetThuc,TrangThai,GhiChu,TenCa,LoaiCa)
                OUTPUT INSERTED.MaCa
                VALUES (@MaNguoiDung,@ThoiGianBatDau,@ThoiGianKetThuc,@TrangThai,@GhiChu,@TenCa,@LoaiCa)`);
      const maCa = caRes.recordset[0].MaCa;
      tongCa++;

      // TonKhoDauCa
      if (isFirstSheet) {
        const tonDauRows = valid.filter(d => d.tonDau !== 0);
        for (const d of tonDauRows) {
          await pool.request()
            .input("MaCa",       sql.Int,          maCa)
            .input("MaLinhKien", sql.NVarChar(50),  d.code)
            .input("MaViTri",    sql.Int,           defaultViTri)
            .input("SoLuong",    sql.Decimal(18,4), d.tonDau)
            .query("INSERT INTO TonKhoDauCa (MaCa,MaLinhKien,MaViTri,SoLuong) VALUES (@MaCa,@MaLinhKien,@MaViTri,@SoLuong)");
        }
        isFirstSheet = false;
      }

      // PhieuKho + ChiTietPhieuKho
      const phieuMap = new Map();
      for (const d of valid) {
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
          .query(`INSERT INTO PhieuKho (MaPhieu,LoaiGiaoDich,LoaiChiTiet,NgayThucHien,MaNguoiDung,GhiChu,MaCa)
                  VALUES (@MaPhieu,@LoaiGiaoDich,@LoaiChiTiet,@NgayThucHien,@MaNguoiDung,@GhiChu,@MaCa)`);
        tongPhieu++;

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

      sheetStats.push({ sheet: sheetName, valid: valid.length, total: data.length });
    }

    // TonKhoChiTiet: mỗi mã lấy từ sheet CD/CN gần nhất còn chứa dòng (kể cả Code Tổng có trong báo cáo)
    let maCoTon = 0;
    const { rows: tonRows, cdSheetCount, cnSheetCount } = buildTonKhoChiTietRows(wb, sheets, partsSet);
    if (tonRows.length > 0) {
      const BATCH = 50;
      for (let i = 0; i < tonRows.length; i += BATCH) {
        const chunk = tonRows.slice(i, i + BATCH);
        const reqT = pool.request();
        const vals = chunk.map((d, j) => {
          reqT.input(`code${j}`, sql.NVarChar(50), d.code);
          reqT.input(`vt${j}`, sql.Int, defaultViTri);
          reqT.input(`ton${j}`, sql.Decimal(18, 4), d.tonCuoi);
          reqT.input(`thuc${j}`, sql.Decimal(18, 4), d.tonThucTe ?? d.tonCuoi);
          reqT.input(`ngay${j}`, sql.Decimal(18, 4), d.caNgayTon);
          return `(@code${j},@vt${j},@ton${j},@thuc${j},@ngay${j})`;
        });
        await reqT.query(
          `INSERT INTO TonKhoChiTiet (MaLinhKien,MaViTri,SoLuongTon,TonThucTe,TonCuoiCaNgay) VALUES ${vals.join(",")}`
        );
        maCoTon += chunk.length;
      }
    }

    // DB stats
    const dbStats = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM CaLamViec WHERE TrangThai='da_ket_thuc') AS TongCa,
        (SELECT COUNT(*) FROM PhieuKho)    AS TongPhieu,
        (SELECT COUNT(*) FROM ChiTietPhieuKho) AS TongChiTiet,
        (SELECT COUNT(*) FROM TonKhoChiTiet WHERE SoLuongTon>0) AS MaCoTon,
        (SELECT ISNULL(SUM(SoLuongTon),0) FROM TonKhoChiTiet)   AS TongTon
    `);

    res.json({
      ok: true,
      stats: {
        sheets:          sheets.length,
        cdSheets:        cdSheetCount,
        cnSheets:        cnSheetCount,
        tongCa,
        tongPhieu,
        tongChiTiet,
        maCoTon,
        partsAutoCreated,
        sheetStats,
        db: dbStats.recordset[0],
      },
    });
  } catch (err) {
    console.error("POST /api/import-excel/baocao:", err.message || err);
    res.status(500).json({ error: "Lỗi import: " + (err.message || String(err)) });
  }
});

module.exports = router;
