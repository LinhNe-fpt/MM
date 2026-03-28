/**
 * /api/rma-upk — module tách biệt MM: tồn kho UPK/RMA, điều chỉnh, chuyển kho bắt tay.
 * Bắt buộc header: X-Ma-Phien (cùng token sau POST /api/auth/login).
 */
const { Router } = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const { getPool } = require("../db");
const sql = require("mssql");
const { requireRmaUpkSession, assertWriteKho } = require("../middleware/rmaUpkSession");
const { mergeRowsFromSheetsInOrder } = require("../lib/baocaoSheetParse");
const { mergeRmaTonFromLastSheets } = require("../lib/rmaTonKhoBaoCaoParse");

const router = Router();
router.use(requireRmaUpkSession);

/** Bảng lịch sử điều chỉnh UPK theo đối tác (schema-rma-upk.sql) */
const UPK_PARTNER_TABLES = Object.freeze({
  SEVT: "dbo.RmaUpkLichSu_SEVT",
  VENDOR: "dbo.RmaUpkLichSu_VENDOR",
  IQC: "dbo.RmaUpkLichSu_IQC",
  MM: "dbo.RmaUpkLichSu_MM",
});

const uploadBaocao = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 35 * 1024 * 1024 },
});

function walkSqlErrors(err, visit) {
  if (!err) return;
  visit(err);
  if (Array.isArray(err.precedingErrors)) err.precedingErrors.forEach((e) => walkSqlErrors(e, visit));
  walkSqlErrors(err.originalError, visit);
}

function deepSqlNumber(err) {
  let n = null;
  walkSqlErrors(err, (e) => {
    const num = e?.number ?? e?.info?.number;
    if (num != null && n == null) n = Number(num);
  });
  return n;
}

function deepSqlMessage(err) {
  const parts = [];
  walkSqlErrors(err, (e) => {
    if (e?.message) parts.push(String(e.message));
  });
  return parts.length ? parts.join(" | ") : String(err?.message || err);
}

/** SQL Server 208 = invalid object name */
function laLoiBangKhongTonTai(err) {
  const n = deepSqlNumber(err);
  const msg = deepSqlMessage(err);
  return n === 208 || msg.includes("Invalid object name") || /does not exist|Could not find object/i.test(msg);
}

/** SQL 229/230… = user DB (ysv) chưa được GRANT trên bảng RMA/UPK */
function laLoiTuChoiQuyenSql(err) {
  const n = deepSqlNumber(err);
  const msg = deepSqlMessage(err).toLowerCase();
  if (n === 229 || n === 230) return true;
  return (
    msg.includes("permission was denied") ||
    msg.includes("denied the select") ||
    msg.includes("denied the insert") ||
    msg.includes("denied the update") ||
    msg.includes("denied the delete")
  );
}

const HINT_GRANT_RMA_UPK =
  "Chay script GRANT trong SSMS: backend/scripts/grant-rma-upk-permissions.sql (hoac grantPermissionsSQL.sql da co phan RMA/UPK) cho dung user trong .env (DB_USER).";

function xuLyLoiSql(res, err, userMsg) {
  if (laLoiBangKhongTonTai(err)) {
    return res.status(503).json({
      error: "Chua tao bang RMA/UPK. Chay backend/scripts/schema-rma-upk.sql",
    });
  }
  if (laLoiTuChoiQuyenSql(err)) {
    console.error(userMsg, deepSqlMessage(err), deepSqlNumber(err));
    return res.status(403).json({
      error: "Tai khoan SQL khong co quyen tren bang RMA/UPK (thieu GRANT).",
      hint: HINT_GRANT_RMA_UPK,
      sqlNumber: deepSqlNumber(err),
      ...(process.env.API_DEBUG_SQL === "1" || process.env.NODE_ENV !== "production"
        ? { debug: deepSqlMessage(err) }
        : {}),
    });
  }
  guiLoi500(res, err, userMsg);
}

function guiLoi500(res, err, userMsg) {
  const debug =
    process.env.API_DEBUG_SQL === "1" || process.env.NODE_ENV !== "production"
      ? { debug: deepSqlMessage(err), sqlNumber: deepSqlNumber(err) }
      : {};
  console.error(userMsg, deepSqlMessage(err), deepSqlNumber(err));
  res.status(500).json({ error: userMsg, ...debug });
}

function parseKhoQuery(v) {
  const s = String(v || "ALL").toUpperCase();
  if (s === "UPK" || s === "RMA") return s;
  return "ALL";
}

async function upsertRmaUpkTonTheoMa(pool, rows, maKho) {
  const BATCH = 80;
  const k = String(maKho).toUpperCase();
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const rq = pool.request();
    rq.input("KhoMerge", sql.NVarChar(10), k);
    const vals = chunk.map((r, j) => {
      rq.input(`c${j}`, sql.NVarChar(100), r.code);
      rq.input(`s${j}`, sql.Int, r.soLuongTon);
      return `(@c${j}, @KhoMerge, @s${j})`;
    });
    await rq.query(`
      MERGE dbo.RmaUpkTonKho AS t
      USING (VALUES ${vals.join(",")}) AS s (MaLinhKien, MaKho, SoLuongTon)
      ON t.MaLinhKien = s.MaLinhKien AND t.MaKho = s.MaKho
      WHEN MATCHED THEN UPDATE SET SoLuongTon = s.SoLuongTon
      WHEN NOT MATCHED THEN INSERT (MaLinhKien, MaKho, SoLuongTon) VALUES (s.MaLinhKien, s.MaKho, s.SoLuongTon);
    `);
  }
}

// POST /api/rma-upk/import-baocao — 2 sheet cuối file .xlsx (2 ca gần nhất), gộp theo mã (sheet sau ghi đè), cập nhật tồn kho UPK
router.post("/import-baocao", uploadBaocao.single("file"), async (req, res) => {
  const u = req.rmaUpk;
  if (!u.isAdmin && u.khoGhi !== "UPK") {
    return res.status(403).json({ error: "Chi admin hoac nhom UPK moi import ton tu bao cao" });
  }

  if (!req.file) return res.status(400).json({ error: "Chua co file upload" });
  const ext = (req.file.originalname || "").toLowerCase();
  if (!ext.endsWith(".xlsx") && !ext.endsWith(".xls")) {
    return res.status(400).json({ error: "Chi ho tro file .xlsx / .xls" });
  }

  try {
    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const allNames = wb.SheetNames || [];
    if (allNames.length === 0) {
      return res.status(422).json({ error: "File khong co sheet" });
    }
    const sheetsUsed = allNames.slice(-2);
    const merged = mergeRowsFromSheetsInOrder(wb, sheetsUsed);
    const rows = [];
    for (const d of merged.values()) {
      const raw = d.tonThucTe != null ? d.tonThucTe : d.tonCuoi;
      const sl = Math.max(0, Math.round(Number(raw) || 0));
      rows.push({ code: d.code, soLuongTon: sl });
    }

    const pool = await getPool();
    await upsertRmaUpkTonTheoMa(pool, rows, "UPK");

    res.json({
      ok: true,
      sheetsUsed,
      maCount: rows.length,
    });
  } catch (err) {
    xuLyLoiSql(res, err, "Loi import bao cao UPK");
  }
});

// POST /api/rma-upk/import-baocao-rma — file "Báo cáo tồn kho RMA", gộp sheet có dữ liệu (mặc định 2 sheet cuối có data), cột Tồn cuối / RMA → tồn kho RMA
// Form field dryRun=1 chỉ phân tích, không ghi DB; trả previewRows (model, mô tả, vị trí nếu có).
router.post("/import-baocao-rma", uploadBaocao.single("file"), async (req, res) => {
  const u = req.rmaUpk;
  if (!u.isAdmin && u.khoGhi !== "RMA") {
    return res.status(403).json({ error: "Chi admin hoac nhom RMA moi import ton tu bao cao RMA" });
  }

  if (!req.file) return res.status(400).json({ error: "Chua co file upload" });
  const ext = (req.file.originalname || "").toLowerCase();
  if (!ext.endsWith(".xlsx") && !ext.endsWith(".xls")) {
    return res.status(400).json({ error: "Chi ho tro file .xlsx / .xls" });
  }

  const dryRun =
    req.body?.dryRun === "1" ||
    req.body?.dryRun === "true" ||
    req.body?.dryRun === true;

  try {
    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const allNames = wb.SheetNames || [];
    if (allNames.length === 0) {
      return res.status(422).json({ error: "File khong co sheet" });
    }

    const { rows, sheetsUsed } = mergeRmaTonFromLastSheets(wb, 2);
    if (rows.length === 0) {
      return res.status(422).json({
        error:
          "Khong doc duoc dong du lieu hop le. Can: cot ma linh kien (CODE / MA...) + cot ton RMA (Tồn cuối → RMA, hoac cot 'RMA'). Kiem tra file dung dinh dang bao cao ton kho RMA.",
        sheetsUsed,
        sheetNames: allNames,
        hint: "Neu file dung: thu luu lai .xlsx tu Excel, hoac gui admin 5 dong dau sheet de dieu chinh parser.",
      });
    }

    const rowsDb = rows.map((r) => ({ code: r.code, soLuongTon: r.soLuongTon }));
    const previewRows = rows.map((r) => ({
      code: r.code,
      soLuongTon: r.soLuongTon,
      model: r.model ?? null,
      moTa: r.moTa ?? null,
      viTri: r.viTri ?? null,
    }));

    if (!dryRun) {
      const pool = await getPool();
      await upsertRmaUpkTonTheoMa(pool, rowsDb, "RMA");
    }

    res.json({
      ok: true,
      dryRun,
      sheetsUsed,
      maCount: rows.length,
      previewRows,
    });
  } catch (err) {
    xuLyLoiSql(res, err, "Loi import bao cao RMA");
  }
});

// GET /api/rma-upk/me
router.get("/me", (req, res) => {
  const u = req.rmaUpk;
  res.json({
    maNguoiDung: u.maNguoiDung,
    taiKhoan: u.taiKhoan,
    hoTen: u.hoTen,
    quyen: u.quyen,
    khoGhi: u.khoGhi,
    isAdmin: u.isAdmin,
    /** UI: được thao tác ghi trên kho nào (null = cả hai nếu admin) */
    coTheGhiUPK: u.isAdmin || u.khoGhi === "UPK",
    coTheGhiRMA: u.isAdmin || u.khoGhi === "RMA",
  });
});

// GET /api/rma-upk/stock?kho=UPK|RMA|ALL&q=CODE&limit=20
router.get("/stock", async (req, res) => {
  const kho = parseKhoQuery(req.query.kho);
  const qCode = String(req.query.q || "")
    .trim()
    .toUpperCase()
    .slice(0, 100);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "500"), 10) || 500));
  try {
    const pool = await getPool();
    const request = pool.request();
    request.input("Lim", sql.Int, limit);
    let q;
    if (qCode) {
      request.input("Prefix", sql.NVarChar(101), `${qCode}%`);
      request.input("Code", sql.NVarChar(110), `%${qCode}%`);
      q = `
        SELECT TOP (@Lim) MaLinhKien, MaKho, SoLuongTon
        FROM dbo.RmaUpkTonKho
        WHERE (@Kho IS NULL OR MaKho = @Kho)
          AND UPPER(MaLinhKien) LIKE @Code
        ORDER BY
          CASE WHEN UPPER(MaLinhKien) LIKE @Prefix THEN 0 ELSE 1 END,
          MaLinhKien ASC,
          MaKho ASC
      `;
    } else {
      q = `
        SELECT TOP (@Lim) MaLinhKien, MaKho, SoLuongTon
        FROM dbo.RmaUpkTonKho
        WHERE (@Kho IS NULL OR MaKho = @Kho)
        ORDER BY MaKho ASC, MaLinhKien ASC
      `;
    }
    request.input("Kho", sql.NVarChar(10), kho === "UPK" || kho === "RMA" ? kho : null);
    const result = await request.query(q);
    res.json(result.recordset);
  } catch (err) {
    xuLyLoiSql(res, err, "Loi doc ton kho");
  }
});

// GET /api/rma-upk/stock-summary — tổng tồn theo kho (không phụ thuộc limit/paging)
router.get("/stock-summary", async (_req, res) => {
  try {
    const pool = await getPool();
    const rs = await pool.request().query(`
      SELECT MaKho, SUM(SoLuongTon) AS TongTon
      FROM dbo.RmaUpkTonKho
      GROUP BY MaKho
    `);
    let upk = 0;
    let rma = 0;
    for (const row of rs.recordset || []) {
      const sl = Number(row.TongTon) || 0;
      if (row.MaKho === "UPK") upk = sl;
      else if (row.MaKho === "RMA") rma = sl;
    }
    res.json({ UPK: upk, RMA: rma });
  } catch (err) {
    xuLyLoiSql(res, err, "Loi doc tong ton kho");
  }
});

// GET /api/rma-upk/adjustments?kho=UPK|RMA&limit=50&doiTac=SEVT|... — UPK: union 4 bảng đối tác; RMA: RmaUpkDieuChinh
router.get("/adjustments", async (req, res) => {
  const k = String(req.query.kho || "").toUpperCase();
  if (k !== "UPK" && k !== "RMA") {
    return res.status(400).json({ error: "Thieu hoac sai tham so kho (UPK hoac RMA)" });
  }
  const dt = String(req.query.doiTac || "")
    .trim()
    .toUpperCase();
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
  try {
    const pool = await getPool();
    const rq = pool.request().input("Lim", sql.Int, limit);
    let q;
    if (k === "RMA") {
      rq.input("DoiTacTag", sql.NVarChar(20), dt || null);
      q = `
        SELECT TOP (@Lim)
          d.MaDieuChinh, d.MaKho,
          CASE
            WHEN d.GhiChu LIKE N'DOI_TAC:%' THEN
              LTRIM(RTRIM(
                CASE
                  WHEN CHARINDEX(N'|', d.GhiChu) > 0 THEN SUBSTRING(d.GhiChu, 9, CHARINDEX(N'|', d.GhiChu) - 9)
                  ELSE SUBSTRING(d.GhiChu, 9, 500)
                END
              ))
            ELSE NULL
          END AS DoiTac,
          d.MaLinhKien, d.Loai, d.SoLuong, d.TonSau, d.NgayGio, d.GhiChu,
          n.TaiKhoan AS TaiKhoanNguoiTao, n.HoTen AS HoTenNguoiTao
        FROM dbo.RmaUpkDieuChinh d
        LEFT JOIN dbo.NguoiDung n ON n.MaNguoiDung = d.MaNguoiDung
        WHERE d.MaKho = N'RMA'
          AND (
            @DoiTacTag IS NULL
            OR (
              d.GhiChu LIKE N'DOI_TAC:%'
              AND LTRIM(RTRIM(
                CASE
                  WHEN CHARINDEX(N'|', d.GhiChu) > 0 THEN SUBSTRING(d.GhiChu, 9, CHARINDEX(N'|', d.GhiChu) - 9)
                  ELSE SUBSTRING(d.GhiChu, 9, 500)
                END
              )) = @DoiTacTag
            )
          )
        ORDER BY d.NgayGio DESC
      `;
    } else if (dt && UPK_PARTNER_TABLES[dt]) {
      const tbl = UPK_PARTNER_TABLES[dt];
      rq.input("DoiTacTag", sql.NVarChar(20), dt);
      q = `
        SELECT TOP (@Lim)
          d.MaDieuChinh, N'UPK' AS MaKho, @DoiTacTag AS DoiTac, d.MaLinhKien, d.Loai, d.SoLuong, d.TonSau, d.NgayGio, d.GhiChu,
          n.TaiKhoan AS TaiKhoanNguoiTao, n.HoTen AS HoTenNguoiTao
        FROM ${tbl} d
        LEFT JOIN dbo.NguoiDung n ON n.MaNguoiDung = d.MaNguoiDung
        ORDER BY d.NgayGio DESC
      `;
    } else if (k === "UPK") {
      q = `
        SELECT TOP (@Lim)
          x.MaDieuChinh, x.MaKho, x.DoiTac, x.MaLinhKien, x.Loai, x.SoLuong, x.TonSau, x.NgayGio, x.GhiChu,
          n.TaiKhoan AS TaiKhoanNguoiTao, n.HoTen AS HoTenNguoiTao
        FROM (
          SELECT MaDieuChinh, N'UPK' AS MaKho, N'SEVT' AS DoiTac, MaLinhKien, Loai, SoLuong, TonSau, NgayGio, GhiChu, MaNguoiDung FROM dbo.RmaUpkLichSu_SEVT
          UNION ALL
          SELECT MaDieuChinh, N'UPK', N'VENDOR', MaLinhKien, Loai, SoLuong, TonSau, NgayGio, GhiChu, MaNguoiDung FROM dbo.RmaUpkLichSu_VENDOR
          UNION ALL
          SELECT MaDieuChinh, N'UPK', N'IQC', MaLinhKien, Loai, SoLuong, TonSau, NgayGio, GhiChu, MaNguoiDung FROM dbo.RmaUpkLichSu_IQC
          UNION ALL
          SELECT MaDieuChinh, N'UPK', N'MM', MaLinhKien, Loai, SoLuong, TonSau, NgayGio, GhiChu, MaNguoiDung FROM dbo.RmaUpkLichSu_MM
        ) x
        LEFT JOIN dbo.NguoiDung n ON n.MaNguoiDung = x.MaNguoiDung
        ORDER BY x.NgayGio DESC
      `;
    }
    const result = await rq.query(q);
    res.json(result.recordset);
  } catch (err) {
    xuLyLoiSql(res, err, "Loi doc lich su nhap xuat");
  }
});

// POST /api/rma-upk/adjust  { maKho, maLinhKien, delta, ghiChu?, doiTac? }  — UPK: ghi bảng đối tác; RMA: RmaUpkDieuChinh
router.post("/adjust", async (req, res) => {
  const { maKho, maLinhKien, delta, ghiChu: ghiChuBody, doiTac: doiTacBody } = req.body || {};
  const k = String(maKho || "").toUpperCase();
  const code = String(maLinhKien || "").trim();
  const d = parseInt(String(delta), 10);
  const ghiChu = String(ghiChuBody ?? "")
    .trim()
    .slice(0, 500);
  const doiTac = String(doiTacBody ?? "")
    .trim()
    .toUpperCase();
  if (!code) return res.status(400).json({ error: "Thieu maLinhKien" });
  if (!Number.isFinite(d) || d === 0) return res.status(400).json({ error: "delta phai la so khac 0" });
  if (k === "UPK") {
    if (d > 0 && doiTac !== "SEVT" && doiTac !== "VENDOR") {
      return res.status(400).json({ error: "UPK nhap chi nhan tu SEVT hoac VENDOR" });
    }
    if (d < 0 && doiTac !== "IQC" && doiTac !== "MM") {
      return res.status(400).json({ error: "UPK xuat chi cap cho IQC hoac MM" });
    }
  } else if (k === "RMA") {
    if (d > 0 && doiTac !== "SX" && doiTac !== "FB" && doiTac !== "QC") {
      return res.status(400).json({ error: "RMA nhap chi nhan tu SX, FB hoac QC" });
    }
    if (d < 0 && doiTac !== "SX" && doiTac !== "FB" && doiTac !== "SEVT") {
      return res.status(400).json({ error: "RMA xuat chi cap cho SX, FB hoac SEVT" });
    }
  }

  const deny = assertWriteKho(req, k);
  if (deny) return res.status(deny.status).json({ error: deny.error });

  const maNd = req.rmaUpk.maNguoiDung;

  try {
    const pool = await getPool();
    const t = new sql.Transaction(pool);
    await t.begin();
    try {
      const rq = new sql.Request(t);
      rq.input("MaLinhKien", sql.NVarChar(100), code);
      rq.input("MaKho", sql.NVarChar(10), k);
      rq.input("Delta", sql.Int, d);

      const cur = await rq.query(`
        SELECT SoLuongTon FROM dbo.RmaUpkTonKho WITH (UPDLOCK, HOLDLOCK)
        WHERE MaLinhKien = @MaLinhKien AND MaKho = @MaKho
      `);
      const slHienTai = cur.recordset[0]?.SoLuongTon ?? 0;
      const slMoi = slHienTai + d;
      if (slMoi < 0) {
        await t.rollback();
        return res.status(400).json({ error: "Vuot qua ton kho kha dung" });
      }

      if (cur.recordset.length === 0) {
        if (d < 0) {
          await t.rollback();
          return res.status(400).json({ error: "Khong co ton kho de xuat" });
        }
        await rq.query(`
          INSERT INTO dbo.RmaUpkTonKho (MaLinhKien, MaKho, SoLuongTon)
          VALUES (@MaLinhKien, @MaKho, @Delta)
        `);
      } else {
        await rq.query(`
          UPDATE dbo.RmaUpkTonKho SET SoLuongTon = SoLuongTon + @Delta
          WHERE MaLinhKien = @MaLinhKien AND MaKho = @MaKho
        `);
      }

      const rqLog = new sql.Request(t);
      rqLog.input("MaLinhKien", sql.NVarChar(100), code);
      rqLog.input("Loai", sql.NVarChar(10), d > 0 ? "NHAP" : "XUAT");
      rqLog.input("SoLuong", sql.Int, Math.abs(d));
      rqLog.input("TonSau", sql.Int, slMoi);
      rqLog.input("MaNguoiDung", sql.Int, maNd);
      if (k === "UPK") {
        rqLog.input("GhiChu", sql.NVarChar(500), ghiChu || null);
        const tbl = UPK_PARTNER_TABLES[doiTac];
        if (!tbl) {
          await t.rollback();
          return res.status(400).json({ error: "Thieu hoac sai doi tac UPK" });
        }
        await rqLog.query(`
          INSERT INTO ${tbl} (MaLinhKien, Loai, SoLuong, TonSau, MaNguoiDung, GhiChu)
          VALUES (@MaLinhKien, @Loai, @SoLuong, @TonSau, @MaNguoiDung, @GhiChu)
        `);
      } else {
        const ghiChuRma = [doiTac ? `DOI_TAC:${doiTac}` : "", ghiChu]
          .filter(Boolean)
          .join(" | ");
        rqLog.input("GhiChu", sql.NVarChar(500), ghiChuRma || null);
        rqLog.input("MaKho", sql.NVarChar(10), k);
        await rqLog.query(`
          INSERT INTO dbo.RmaUpkDieuChinh (MaKho, MaLinhKien, Loai, SoLuong, TonSau, MaNguoiDung, GhiChu)
          VALUES (@MaKho, @MaLinhKien, @Loai, @SoLuong, @TonSau, @MaNguoiDung, @GhiChu)
        `);
      }

      await t.commit();
      res.json({ ok: true, maLinhKien: code, maKho: k, soLuongTon: slMoi });
    } catch (e) {
      await t.rollback();
      throw e;
    }
  } catch (err) {
    xuLyLoiSql(res, err, "Loi cap nhat ton");
  }
});

// GET /api/rma-upk/transfers/pending
router.get("/transfers/pending", async (req, res) => {
  const u = req.rmaUpk;
  try {
    const pool = await getPool();
    const rq = pool.request();
    let where = `WHERE c.TrangThai = N'DANG_CHUYEN'`;
    if (!u.isAdmin) {
      if (u.khoGhi === "RMA") {
        where += ` AND c.MaKhoDich = N'RMA'`;
      } else if (u.khoGhi === "UPK") {
        where += ` AND c.MaKhoNguon = N'UPK'`;
      } else {
        return res.json([]);
      }
    }
    const result = await rq.query(`
      SELECT
        c.MaChuyen,
        c.MaKhoNguon,
        c.MaKhoDich,
        c.MaNguoiTao,
        c.NgayTao,
        c.GhiChu,
        n.HoTen AS TenNguoiTao,
        n.TaiKhoan AS TaiKhoanNguoiTao
      FROM dbo.RmaUpkChuyenKho c
      LEFT JOIN dbo.NguoiDung n ON n.MaNguoiDung = c.MaNguoiTao
      ${where}
      ORDER BY c.NgayTao DESC
    `);
    const rows = result.recordset;
    const out = [];
    for (const row of rows) {
      const ct = await pool
        .request()
        .input("Mc", sql.Int, row.MaChuyen)
        .query(
          `SELECT MaLinhKien, SoLuong FROM dbo.RmaUpkChuyenKhoChiTiet WHERE MaChuyen = @Mc ORDER BY MaLinhKien`,
        );
      out.push({ ...row, chiTiet: ct.recordset });
    }
    res.json(out);
  } catch (err) {
    xuLyLoiSql(res, err, "Loi doc chuyen kho");
  }
});

// POST /api/rma-upk/transfers  { maKhoNguon?, maKhoDich?, lines: [{ maLinhKien, soLuong }], ghiChu? }
router.post("/transfers", async (req, res) => {
  let { maKhoNguon, maKhoDich, lines, ghiChu } = req.body || {};
  const u = req.rmaUpk;

  if (!Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: "Thieu lines" });
  }

  let nguon = String(maKhoNguon || "").toUpperCase();
  let dich = String(maKhoDich || "").toUpperCase();

  if (!u.isAdmin) {
    nguon = u.khoGhi;
    if (!nguon) return res.status(403).json({ error: "Khong xac dinh kho nguon" });
    dich = nguon === "UPK" ? "RMA" : "UPK";
  }

  if ((nguon !== "UPK" && nguon !== "RMA") || (dich !== "UPK" && dich !== "RMA") || nguon === dich) {
    return res.status(400).json({ error: "Cap kho nguon/dich khong hop le" });
  }

  const deny = assertWriteKho(req, nguon);
  if (deny) return res.status(deny.status).json({ error: deny.error });

  const normalized = [];
  for (const line of lines) {
    const mlk = String(line.maLinhKien || "").trim();
    const sl = parseInt(String(line.soLuong), 10);
    if (!mlk || !Number.isFinite(sl) || sl <= 0) {
      return res.status(400).json({ error: "Line khong hop le" });
    }
    normalized.push({ maLinhKien: mlk, soLuong: sl });
  }

  try {
    const pool = await getPool();
    const t = new sql.Transaction(pool);
    await t.begin();
    try {
      for (const { maLinhKien, soLuong } of normalized) {
        const rq = new sql.Request(t);
        rq.input("MaLinhKien", sql.NVarChar(100), maLinhKien);
        rq.input("MaKho", sql.NVarChar(10), nguon);
        rq.input("SL", sql.Int, soLuong);
        const cur = await rq.query(`
          SELECT SoLuongTon FROM dbo.RmaUpkTonKho WITH (UPDLOCK, HOLDLOCK)
          WHERE MaLinhKien = @MaLinhKien AND MaKho = @MaKho
        `);
        const ton = cur.recordset[0]?.SoLuongTon ?? 0;
        if (ton < soLuong) {
          await t.rollback();
          return res.status(400).json({
            error: `Khong du ton kho ${nguon} cho ma ${maLinhKien} (co ${ton}, can ${soLuong})`,
          });
        }
        await rq.query(`
          UPDATE dbo.RmaUpkTonKho SET SoLuongTon = SoLuongTon - @SL
          WHERE MaLinhKien = @MaLinhKien AND MaKho = @MaKho
        `);
      }

      const ins = new sql.Request(t);
      ins.input("MaKhoNguon", sql.NVarChar(10), nguon);
      ins.input("MaKhoDich", sql.NVarChar(10), dich);
      ins.input("MaNguoiTao", sql.Int, u.maNguoiDung);
      ins.input("GhiChu", sql.NVarChar(500), ghiChu ? String(ghiChu).slice(0, 500) : null);
      const insR = await ins.query(`
        INSERT INTO dbo.RmaUpkChuyenKho (MaKhoNguon, MaKhoDich, MaNguoiTao, GhiChu)
        OUTPUT INSERTED.MaChuyen
        VALUES (@MaKhoNguon, @MaKhoDich, @MaNguoiTao, @GhiChu)
      `);
      const maChuyen = insR.recordset[0].MaChuyen;

      for (const { maLinhKien, soLuong } of normalized) {
        const rq2 = new sql.Request(t);
        rq2.input("MaChuyen", sql.Int, maChuyen);
        rq2.input("MaLinhKien", sql.NVarChar(100), maLinhKien);
        rq2.input("SoLuong", sql.Int, soLuong);
        await rq2.query(`
          INSERT INTO dbo.RmaUpkChuyenKhoChiTiet (MaChuyen, MaLinhKien, SoLuong)
          VALUES (@MaChuyen, @MaLinhKien, @SoLuong)
        `);
      }

      await t.commit();
      res.status(201).json({ ok: true, maChuyen });
    } catch (e) {
      await t.rollback();
      throw e;
    }
  } catch (err) {
    xuLyLoiSql(res, err, "Loi tao chuyen kho");
  }
});

// POST /api/rma-upk/transfers/:id/confirm
router.post("/transfers/:id/confirm", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || Number.isNaN(id)) return res.status(400).json({ error: "Ma chuyen khong hop le" });
  const u = req.rmaUpk;

  try {
    const pool = await getPool();
    const chk = await pool.request().input("Id", sql.Int, id).query(`
      SELECT MaChuyen, MaKhoNguon, MaKhoDich, TrangThai
      FROM dbo.RmaUpkChuyenKho WHERE MaChuyen = @Id
    `);
    const row = chk.recordset[0];
    if (!row) return res.status(404).json({ error: "Khong tim thay chuyen" });
    if (row.TrangThai !== "DANG_CHUYEN") return res.status(400).json({ error: "Chuyen khong con cho nhan" });

    if (!u.isAdmin) {
      const deny = assertWriteKho(req, row.MaKhoDich);
      if (deny) return res.status(deny.status).json({ error: deny.error });
      if (u.khoGhi !== row.MaKhoDich) {
        return res.status(403).json({ error: "Chi kho dich moi xac nhan nhan hang" });
      }
    }

    const t = new sql.Transaction(pool);
    await t.begin();
    try {
      const lines = await new sql.Request(t)
        .input("Id", sql.Int, id)
        .query(`SELECT MaLinhKien, SoLuong FROM dbo.RmaUpkChuyenKhoChiTiet WHERE MaChuyen = @Id`);

      for (const line of lines.recordset) {
        const rq = new sql.Request(t);
        rq.input("MaLinhKien", sql.NVarChar(100), line.MaLinhKien);
        rq.input("MaKho", sql.NVarChar(10), row.MaKhoDich);
        rq.input("SL", sql.Int, line.SoLuong);
        const ex = await rq.query(`
          SELECT SoLuongTon FROM dbo.RmaUpkTonKho WITH (UPDLOCK, HOLDLOCK)
          WHERE MaLinhKien = @MaLinhKien AND MaKho = @MaKho
        `);
        if (ex.recordset.length === 0) {
          await rq.query(`
            INSERT INTO dbo.RmaUpkTonKho (MaLinhKien, MaKho, SoLuongTon) VALUES (@MaLinhKien, @MaKho, @SL)
          `);
        } else {
          await rq.query(`
            UPDATE dbo.RmaUpkTonKho SET SoLuongTon = SoLuongTon + @SL
            WHERE MaLinhKien = @MaLinhKien AND MaKho = @MaKho
          `);
        }
      }

      await new sql.Request(t)
        .input("Id", sql.Int, id)
        .input("MaNX", sql.Int, u.maNguoiDung)
        .query(`
          UPDATE dbo.RmaUpkChuyenKho
          SET TrangThai = N'HOAN_THANH', MaNguoiXacNhan = @MaNX, NgayXacNhan = SYSUTCDATETIME()
          WHERE MaChuyen = @Id
        `);

      await t.commit();
      res.json({ ok: true, maChuyen: id });
    } catch (e) {
      await t.rollback();
      throw e;
    }
  } catch (err) {
    xuLyLoiSql(res, err, "Loi xac nhan chuyen");
  }
});

module.exports = router;
