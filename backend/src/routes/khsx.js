const { Router } = require("express");
const multer = require("multer");
const sql = require("mssql");
const { getPool } = require("../db");
const { parseWorkbookKhsx } = require("../lib/khsxSheetParse");

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

async function requireSession(req, res, next) {
  const maPhien = req.get("X-Ma-Phien") || req.get("x-ma-phien");
  if (!maPhien) return res.status(401).json({ error: "Thieu phien. Gui header X-Ma-Phien." });
  try {
    const pool = await getPool();
    const r = await pool
      .request()
      .input("MaPhien", sql.NVarChar(64), String(maPhien).trim())
      .query(`
        SELECT n.MaNguoiDung, n.TaiKhoan, n.HoTen, n.Quyen
        FROM dbo.PhienDangNhap p
        INNER JOIN dbo.NguoiDung n ON n.MaNguoiDung = p.MaNguoiDung
        WHERE p.MaPhien = @MaPhien
      `);
    const row = r.recordset[0];
    if (!row) return res.status(401).json({ error: "Phien khong hop le hoac het han" });
    req.userSession = {
      maNguoiDung: row.MaNguoiDung,
      taiKhoan: row.TaiKhoan,
      hoTen: row.HoTen,
      quyen: String(row.Quyen || "").toLowerCase(),
      isAdmin: String(row.Quyen || "").toLowerCase() === "admin",
    };
    next();
  } catch (err) {
    console.error("requireSession khsx:", err.message || err);
    res.status(500).json({ error: "Loi xac thuc phien" });
  }
}

router.use(requireSession);

function validateZoneInput(v) {
  const z = String(v || "").trim().toUpperCase();
  if (z === "MM" || z === "UPK" || z === "RMA") return z;
  return "";
}

/** tedious/mssql đôi khi trả về camelCase — gộp về một bộ key cho JSON */
function coalesceDbField(row, pascalKey, camelKey) {
  const a = row[pascalKey];
  const b = row[camelKey];
  if (a != null && String(a).trim() !== "") return a;
  if (b != null && String(b).trim() !== "") return b;
  return a ?? b ?? null;
}

function normalizeKhsxPlanRow(r) {
  const model = coalesceDbField(r, "Model", "model");
  let basicModel = coalesceDbField(r, "BasicModel", "basicModel");
  if (basicModel == null || String(basicModel).trim() === "") basicModel = model;
  return {
    ...r,
    BasicModel: basicModel,
    ModelDesc: coalesceDbField(r, "ModelDesc", "modelDesc"),
    PoType: coalesceDbField(r, "PoType", "poType"),
    Model: model,
  };
}

async function loadMasterAssySet(pool, codes) {
  const set = new Set();
  if (!codes.length) return set;
  const uniq = [...new Set(codes.map((c) => String(c || "").trim().toUpperCase()).filter(Boolean))];
  const CHUNK = 200;
  for (let i = 0; i < uniq.length; i += CHUNK) {
    const part = uniq.slice(i, i + CHUNK);
    const rq = pool.request();
    const vals = part.map((code, j) => {
      rq.input(`c${j}`, sql.NVarChar(100), code);
      return `(@c${j})`;
    });
    const rs = await rq.query(`
      SELECT UPPER(Code) AS Code
      FROM dbo.Parts
      WHERE UPPER(Code) IN (SELECT Code FROM (VALUES ${vals.join(",")}) v(Code))
    `);
    rs.recordset.forEach((r) => set.add(r.Code));
  }
  return set;
}

function rowKey(r) {
  return [r.maKhu, r.ngaySanXuat, r.caSanXuat, r.lineSanXuat, r.congDoan, r.maAssy].join("|");
}

async function validateRowsWithMaster(pool, rows) {
  const errors = [];
  void pool; // giữ chữ ký hàm để dễ bật lại strict mode sau này
  rows.forEach((r) => {
    const rowNo = Number(r.rowNo) || 0;
    const sheetName = String(r.sheetName || "");
    if (!r.ngaySanXuat) {
      errors.push({ sheetName, rowNo, field: "NgaySanXuat", code: "MISSING_DATE", message: "Thiếu ngày sản xuất", rowData: r });
    }
    if (!(r.caSanXuat === "CN" || r.caSanXuat === "CD")) {
      errors.push({ sheetName, rowNo, field: "CaSanXuat", code: "MISSING_SHIFT", message: "Thiếu ca sản xuất (CN/CD)", rowData: r });
    }
    if (!String(r.lineSanXuat || "").trim()) {
      errors.push({ sheetName, rowNo, field: "LineSanXuat", code: "MISSING_LINE", message: "Thiếu line sản xuất", rowData: r });
    }
    if (!String(r.congDoan || "").trim()) {
      errors.push({ sheetName, rowNo, field: "CongDoan", code: "MISSING_STAGE", message: "Thiếu công đoạn/khu vực", rowData: r });
    }
    if (!String(r.maAssy || "").trim()) {
      errors.push({ sheetName, rowNo, field: "MaAssy", code: "MISSING_ASSY", message: "Thiếu mã ASSY", rowData: r });
    }
    if (!Number.isFinite(Number(r.soLuongKeHoach)) || Number(r.soLuongKeHoach) <= 0) {
      errors.push({ sheetName, rowNo, field: "SoLuongKeHoach", code: "INVALID_QTY", message: "Số lượng kế hoạch phải > 0", rowData: r });
    }
  });
  return errors;
}

router.post("/import/preview", upload.single("file"), async (req, res) => {
  const maKhu = validateZoneInput(req.body?.maKhu);
  if (!maKhu) return res.status(400).json({ error: "Thieu hoac sai maKhu (MM|UPK|RMA)" });
  if (!req.file) return res.status(400).json({ error: "Chua co file upload" });
  if (!req.userSession.isAdmin) return res.status(403).json({ error: "Chi admin duoc import KHSX" });

  try {
    const parsed = parseWorkbookKhsx(req.file.buffer, {});
    const rows = parsed.rows.map((r) => ({ ...r, maKhu }));

    const pool = await getPool();
    const errors = [...parsed.errors, ...(await validateRowsWithMaster(pool, rows))];

    const errorKeySet = new Set(errors.map((e) => `${e.sheetName}|${e.rowNo}`));
    const validRows = rows.filter((r) => !errorKeySet.has(`${r.sheetName}|${r.rowNo}`));
    res.json({
      ok: true,
      summary: {
        fileName: req.file.originalname,
        maKhu,
        totalRows: rows.length,
        validRows: validRows.length,
        invalidRows: rows.length - validRows.length,
        sheetNames: parsed.sheetNames,
        sheetNamesAll: parsed.sheetNamesAll,
      },
      rows,
      errors,
    });
  } catch (err) {
    console.error("POST /api/khsx/import/preview:", err.message || err);
    res.status(500).json({ error: "Loi phan tich file KHSX" });
  }
});

router.post("/import/commit", async (req, res) => {
  if (!req.userSession.isAdmin) return res.status(403).json({ error: "Chi admin duoc commit KHSX" });
  const maKhu = validateZoneInput(req.body?.maKhu);
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const tenFile = String(req.body?.fileName || "khsx.xlsx").slice(0, 260);
  if (!maKhu) return res.status(400).json({ error: "Thieu hoac sai maKhu (MM|UPK|RMA)" });
  if (rows.length === 0) return res.status(400).json({ error: "Khong co dong hop le de commit" });

  try {
    const pool = await getPool();
    const normalized = rows.map((r) => ({
      sheetName: String(r.sheetName || ""),
      rowNo: Number(r.rowNo) || 0,
      maKhu,
      ngaySanXuat: String(r.ngaySanXuat || "").trim(),
      caSanXuat: String(r.caSanXuat || "").trim().toUpperCase(),
      lineSanXuat: String(r.lineSanXuat || "").trim().toUpperCase(),
      congDoan: String(r.congDoan || "").trim().toUpperCase() || "CHUNG",
      maAssy: String(r.maAssy || "").trim().toUpperCase(),
      basicModel: r.basicModel ? String(r.basicModel).trim() : null,
      modelDesc: r.modelDesc ? String(r.modelDesc).trim() : null,
      poType: r.poType ? String(r.poType).trim() : null,
      model: r.model ? String(r.model).trim() : r.basicModel ? String(r.basicModel).trim() : null,
      nhomVatTuYeuCau: r.nhomVatTu
        ? String(r.nhomVatTu).trim().toUpperCase()
        : r.nhomVatTuYeuCau
          ? String(r.nhomVatTuYeuCau).trim().toUpperCase()
          : null,
      soLuongKeHoach: Number(r.soLuongKeHoach) || 0,
    }));
    const errors = await validateRowsWithMaster(pool, normalized);
    if (errors.length > 0) {
      return res.status(400).json({ error: "Con dong loi. Khong the commit.", errors });
    }
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const insBatch = await new sql.Request(tx)
        .input("TenFile", sql.NVarChar(260), tenFile)
        .input("MaKhu", sql.NVarChar(10), maKhu)
        .input("TongDong", sql.Int, normalized.length)
        .input("DongHopLe", sql.Int, normalized.length)
        .input("DongLoi", sql.Int, 0)
        .input("MaNguoiTao", sql.Int, req.userSession.maNguoiDung)
        .query(`
          INSERT INTO dbo.KeHoachSanXuatImportBatch (TenFile, MaKhu, TongDong, DongHopLe, DongLoi, TrangThai, MaNguoiTao, NgayCommit)
          OUTPUT INSERTED.MaBatch
          VALUES (@TenFile, @MaKhu, @TongDong, @DongHopLe, @DongLoi, N'COMMITTED', @MaNguoiTao, SYSUTCDATETIME())
        `);
      const maBatch = insBatch.recordset[0].MaBatch;

      for (const r of normalized) {
        await new sql.Request(tx)
          .input("MaBatch", sql.Int, maBatch)
          .input("MaKhu", sql.NVarChar(10), maKhu)
          .input("NgaySanXuat", sql.Date, r.ngaySanXuat)
          .input("CaSanXuat", sql.NVarChar(10), r.caSanXuat)
          .input("LineSanXuat", sql.NVarChar(50), String(r.lineSanXuat || "").slice(0, 50))
          .input("CongDoan", sql.NVarChar(50), String(r.congDoan || "CHUNG").slice(0, 50))
          .input("MaAssy", sql.NVarChar(100), String(r.maAssy || "").slice(0, 100))
          .input("Model", sql.NVarChar(200), r.model ? String(r.model).slice(0, 200) : null)
          .input("BasicModel", sql.NVarChar(200), r.basicModel ? String(r.basicModel).slice(0, 200) : null)
          .input("ModelDesc", sql.NVarChar(500), r.modelDesc ? String(r.modelDesc).slice(0, 500) : null)
          .input("PoType", sql.NVarChar(120), r.poType ? String(r.poType).slice(0, 120) : null)
          .input("NhomVatTuYeuCau", sql.NVarChar(20), r.nhomVatTuYeuCau ? String(r.nhomVatTuYeuCau).slice(0, 20) : null)
          .input("SoLuongKeHoach", sql.Int, Number(r.soLuongKeHoach) || 0)
          .input("MaNguoiTao", sql.Int, req.userSession.maNguoiDung)
          .query(`
            INSERT INTO dbo.KeHoachSanXuat (MaBatch, MaKhu, NgaySanXuat, CaSanXuat, LineSanXuat, CongDoan, MaAssy, Model, BasicModel, ModelDesc, PoType, NhomVatTuYeuCau, SoLuongKeHoach, MaNguoiTao)
            VALUES (@MaBatch, @MaKhu, @NgaySanXuat, @CaSanXuat, @LineSanXuat, @CongDoan, @MaAssy, @Model, @BasicModel, @ModelDesc, @PoType, @NhomVatTuYeuCau, @SoLuongKeHoach, @MaNguoiTao)
          `);
      }

      await tx.commit();
      res.json({ ok: true, maBatch, insertedRows: normalized.length });
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  } catch (err) {
    console.error("POST /api/khsx/import/commit:", err.message || err);
    res.status(500).json({ error: "Loi commit KHSX" });
  }
});

router.get("/plans", async (req, res) => {
  const maKhu = validateZoneInput(req.query.maKhu);
  const ca = String(req.query.ca || "").trim().toUpperCase();
  const status = String(req.query.status || "").trim().toUpperCase();
  const congDoan = String(req.query.congDoan || "").trim().toUpperCase();
  const q = String(req.query.q || "").trim().toUpperCase();
  const from = String(req.query.from || "").trim();
  const to = String(req.query.to || "").trim();
  const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
  const offset = (page - 1) * limit;
  try {
    const pool = await getPool();
    const bindFiltersOnly = (rq) => {
      if (maKhu) rq.input("MaKhu", sql.NVarChar(10), maKhu);
      if (ca === "CN" || ca === "CD") rq.input("Ca", sql.NVarChar(10), ca);
      if (status) rq.input("Status", sql.NVarChar(30), status);
      if (congDoan) rq.input("CongDoan", sql.NVarChar(50), congDoan);
      if (from) rq.input("From", sql.Date, from);
      if (to) rq.input("To", sql.Date, to);
      if (q) rq.input("Q", sql.NVarChar(140), `%${q}%`);
      return rq;
    };
    const bindPage = (rq) => {
      bindFiltersOnly(rq);
      rq.input("Lim", sql.Int, limit);
      rq.input("Off", sql.Int, offset);
      return rq;
    };
    const where = ["1=1"];
    if (maKhu) {
      where.push("k.MaKhu = @MaKhu");
    }
    if (ca === "CN" || ca === "CD") {
      where.push("k.CaSanXuat = @Ca");
    }
    if (status) {
      where.push("k.TrangThai = @Status");
    }
    if (congDoan) {
      where.push("UPPER(k.CongDoan) = @CongDoan");
    }
    if (from) {
      where.push("k.NgaySanXuat >= @From");
    }
    if (to) {
      where.push("k.NgaySanXuat <= @To");
    }
    if (q) {
      where.push(`(
        UPPER(k.MaAssy) LIKE @Q OR UPPER(k.LineSanXuat) LIKE @Q
        OR UPPER(ISNULL(k.Model,'')) LIKE @Q
        OR UPPER(ISNULL(k.BasicModel,'')) LIKE @Q
        OR UPPER(ISNULL(k.ModelDesc,'')) LIKE @Q
        OR UPPER(ISNULL(k.PoType,'')) LIKE @Q
      )`);
    }
    const whereSql = where.join(" AND ");
    const rs = await bindPage(pool.request()).query(`
      SELECT
        k.MaKeHoach, k.MaBatch, k.MaKhu, k.NgaySanXuat, k.CaSanXuat, k.LineSanXuat, k.MaAssy, k.Model,
        k.BasicModel,
        COALESCE(NULLIF(LTRIM(RTRIM(k.ModelDesc)), N''), p.MoTa) AS ModelDesc,
        k.PoType,
        k.CongDoan, k.NhomVatTuYeuCau, k.SoLuongKeHoach, k.TrangThai, k.GhiChu, k.NgayTao, k.NgayCapNhat
      FROM dbo.KeHoachSanXuat k
      OUTER APPLY (
        SELECT TOP 1 p2.MoTa
        FROM dbo.Parts p2
        WHERE UPPER(LTRIM(RTRIM(p2.Code))) = UPPER(LTRIM(RTRIM(k.MaAssy)))
      ) p
      WHERE ${whereSql}
      ORDER BY k.NgaySanXuat DESC, k.CaSanXuat ASC, k.LineSanXuat ASC, k.MaKeHoach DESC
      OFFSET @Off ROWS FETCH NEXT @Lim ROWS ONLY
    `);
    const cnt = await bindFiltersOnly(pool.request()).query(`
      SELECT COUNT(1) AS TotalRows
      FROM dbo.KeHoachSanXuat k
      WHERE ${whereSql}
    `);
    const aggRs = await bindFiltersOnly(pool.request()).query(`
      SELECT k.LineSanXuat AS LineKey, SUM(k.SoLuongKeHoach) AS TongQty
      FROM dbo.KeHoachSanXuat k
      WHERE ${whereSql}
      GROUP BY k.LineSanXuat
    `);
    const totalRows = Number(cnt.recordset[0]?.TotalRows || 0);
    const lineQtyByLine = {};
    for (const a of aggRs.recordset || []) {
      const lk = a.LineKey ?? a.lineKey;
      const tq = a.TongQty ?? a.tongQty;
      if (lk != null) lineQtyByLine[String(lk)] = Number(tq) || 0;
    }
    res.json({
      items: rs.recordset.map(normalizeKhsxPlanRow),
      lineQtyByLine,
      page,
      pageSize: limit,
      totalRows,
      totalPages: Math.max(1, Math.ceil(totalRows / limit)),
    });
  } catch (err) {
    console.error("GET /api/khsx/plans:", err.message || err);
    res.status(500).json({ error: "Loi doc ke hoach san xuat" });
  }
});

router.post("/:id/status", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const status = String(req.body?.status || "").trim().toUpperCase();
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "MaKeHoach khong hop le" });
  if (!["CHO_XUAT_VT", "DANG_XUAT", "SAN_SANG", "THIEU_VT", "DA_XONG"].includes(status)) {
    return res.status(400).json({ error: "TrangThai khong hop le" });
  }
  try {
    const pool = await getPool();
    await pool
      .request()
      .input("Id", sql.Int, id)
      .input("Status", sql.NVarChar(30), status)
      .query(`
        UPDATE dbo.KeHoachSanXuat
        SET TrangThai = @Status, NgayCapNhat = SYSUTCDATETIME()
        WHERE MaKeHoach = @Id
      `);
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/khsx/:id/status:", err.message || err);
    res.status(500).json({ error: "Loi cap nhat trang thai ke hoach" });
  }
});

async function loadStockByZone(pool, maKhu) {
  if (maKhu === "UPK" || maKhu === "RMA") {
    const rs = await pool
      .request()
      .input("Kho", sql.NVarChar(10), maKhu)
      .query(`
        SELECT UPPER(MaLinhKien) AS Code, SUM(SoLuongTon) AS Qty
        FROM dbo.RmaUpkTonKho
        WHERE MaKho = @Kho
        GROUP BY UPPER(MaLinhKien)
      `);
    return rs.recordset;
  }
  const rs = await pool.request().query(`
    SELECT UPPER(MaLinhKien) AS Code, SUM(SoLuongTon) AS Qty
    FROM dbo.TonKhoChiTiet
    GROUP BY UPPER(MaLinhKien)
  `);
  return rs.recordset;
}

async function loadBomByStage(pool, assy, congDoan, nhomVatTuYeuCau) {
  const cols = await pool.request().query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'BOMItems'
      AND COLUMN_NAME IN ('CongDoan','NhomVatTu')
  `);
  const colSet = new Set((cols.recordset || []).map((x) => x.COLUMN_NAME));
  const hasStage = colSet.has("CongDoan");
  const hasGroup = colSet.has("NhomVatTu");
  const rq = pool.request().input("Assy", sql.NVarChar(100), String(assy).toUpperCase());
  let q = `
    SELECT UPPER(CodeCon) AS MaLinhKien, CAST(HeSo AS DECIMAL(18,4)) AS HeSo
    ${hasGroup ? ", UPPER(ISNULL(NhomVatTu,'')) AS NhomVatTu" : ""}
    FROM dbo.BOMItems
    WHERE UPPER(CodeTong) = @Assy AND DangHoatDong = 1
  `;
  if (hasStage) {
    rq.input("CongDoan", sql.NVarChar(50), String(congDoan || "CHUNG").toUpperCase());
    q += ` AND (UPPER(CongDoan) = @CongDoan OR UPPER(CongDoan) = N'ALL')`;
  }
  if (hasGroup && nhomVatTuYeuCau) {
    rq.input("Nhom", sql.NVarChar(20), String(nhomVatTuYeuCau).toUpperCase());
    q += ` AND (UPPER(ISNULL(NhomVatTu,'')) = @Nhom OR ISNULL(NhomVatTu,'') = '')`;
  }
  return rq.query(q);
}

router.post("/:id/material-plan", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "MaKeHoach khong hop le" });
  try {
    const pool = await getPool();
    const kh = await pool
      .request()
      .input("Id", sql.Int, id)
      .query(`
        SELECT TOP 1 MaKeHoach, MaKhu, MaAssy, SoLuongKeHoach, NgaySanXuat, CaSanXuat, LineSanXuat, CongDoan, NhomVatTuYeuCau
        FROM dbo.KeHoachSanXuat
        WHERE MaKeHoach = @Id
      `);
    const plan = kh.recordset[0];
    if (!plan) return res.status(404).json({ error: "Khong tim thay ke hoach" });

    const bom = await loadBomByStage(pool, plan.MaAssy, plan.CongDoan, plan.NhomVatTuYeuCau);
    const bomRows = bom.recordset || [];
    if (!bomRows.length) {
      return res.json({
        ok: true,
        plan,
        stockSource: plan.MaKhu,
        warningCode: "NO_BOM",
        warningMessage: "Khong tim thay BOM cho ASSY nay",
        summary: {
          tongDong: 0,
          dongDu: 0,
          dongThieu: 0,
        },
        pickList: [],
      });
    }

    const stockRows = await loadStockByZone(pool, plan.MaKhu);
    const stockMap = new Map(stockRows.map((r) => [String(r.Code).toUpperCase(), Number(r.Qty) || 0]));

    const pickList = bomRows.map((b) => {
      const required = Number(plan.SoLuongKeHoach) * Number(b.HeSo || 0);
      const available = stockMap.get(String(b.MaLinhKien).toUpperCase()) || 0;
      const shortage = Math.max(0, required - available);
      return {
        maLinhKien: b.MaLinhKien,
        heSo: Number(b.HeSo),
        can: required,
        ton: available,
        thieu: shortage,
        du: shortage <= 0,
      };
    });

    const tongThieu = pickList.filter((x) => x.thieu > 0).length;
    res.json({
      ok: true,
      plan,
      stockSource: plan.MaKhu,
      summary: {
        tongDong: pickList.length,
        dongDu: pickList.length - tongThieu,
        dongThieu: tongThieu,
      },
      pickList,
    });
  } catch (err) {
    console.error("POST /api/khsx/:id/material-plan:", err.message || err);
    res.status(500).json({ error: "Loi du tru vat tu" });
  }
});

module.exports = router;
