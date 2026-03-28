/**
 * /api/bom — BOM management (schema mới: Parts + BOMItems)
 * Hỗ trợ: tra cứu 1 cấp, mở rộng đa cấp (recursive), tính kitting
 */
const { Router } = require("express");
const { getPool } = require("../db");
const sql = require("mssql");

const router = Router();

function toBomItem(r) {
  return {
    maBOM:       r.MaBOM,
    codeTong:    r.CodeTong,
    codeCon:     r.CodeCon,
    moTa:        r.MoTa       || null,
    cumVatLieu:  r.CumVatLieu || null,
    model:       r.Model      || null,
    heSo:        parseFloat(r.HeSo) || 1,
    thuTu:       r.ThuTu      || null,
    laAssembly:  r.LaAssembly === true || r.LaAssembly === 1,
  };
}

// ─── GET /api/bom/:codeTong ───────────────────────────────────────────────────
// BOM 1 cấp của một Code Tổng
router.get("/:codeTong", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("CodeTong", sql.NVarChar(50), req.params.codeTong)
      .query(`
        SELECT
          b.MaBOM, b.CodeTong, b.CodeCon, b.HeSo, b.CumVatLieu, b.ThuTu,
          p.MoTa, p.Model, p.LaAssembly
        FROM BOMItems b
        JOIN Parts p ON p.Code = b.CodeCon
        WHERE b.CodeTong = @CodeTong AND b.DangHoatDong = 1
        ORDER BY b.ThuTu, b.CodeCon
      `);

    // Thông tin code tổng
    const parent = await pool.request()
      .input("Code", sql.NVarChar(50), req.params.codeTong)
      .query("SELECT Code, MoTa, Model, LaAssembly FROM Parts WHERE Code=@Code");

    res.json({
      codeTong: req.params.codeTong,
      thongTin: parent.recordset[0] || null,
      items:    result.recordset.map(toBomItem),
      total:    result.recordset.length,
    });
  } catch (err) {
    console.error("GET /api/bom/:codeTong:", err.message);
    res.status(500).json({ error: "Loi lay BOM" });
  }
});

// ─── GET /api/bom/:codeTong/expand ───────────────────────────────────────────
// BOM đa cấp (recursive) — dùng CTE đệ quy trong SQL Server
router.get("/:codeTong/expand", async (req, res) => {
  try {
    const pool = await getPool();
    const maxDepth = Math.min(10, parseInt(req.query.maxDepth) || 5);

    const result = await pool.request()
      .input("CodeTong", sql.NVarChar(50), req.params.codeTong)
      .input("MaxDepth", sql.Int, maxDepth)
      .query(`
        WITH BOMTree AS (
          -- Cấp 1
          SELECT
            b.CodeTong,
            b.CodeCon,
            b.HeSo          AS HeSoCapNay,
            b.HeSo          AS HeSoTichLuy,  -- hệ số nhân tích lũy từ gốc
            b.CumVatLieu,
            b.ThuTu,
            p.MoTa,
            p.Model,
            p.LaAssembly,
            1               AS CapDo,
            CAST(b.CodeCon AS NVARCHAR(MAX)) AS DuongDan
          FROM BOMItems b
          JOIN Parts p ON p.Code = b.CodeCon
          WHERE b.CodeTong = @CodeTong AND b.DangHoatDong = 1

          UNION ALL

          -- Đệ quy cấp tiếp theo
          SELECT
            b.CodeTong,
            b.CodeCon,
            b.HeSo,
            t.HeSoTichLuy * b.HeSo,  -- nhân tích lũy
            b.CumVatLieu,
            b.ThuTu,
            p.MoTa,
            p.Model,
            p.LaAssembly,
            t.CapDo + 1,
            t.DuongDan + N' > ' + b.CodeCon
          FROM BOMItems b
          JOIN Parts p ON p.Code = b.CodeCon
          JOIN BOMTree t ON t.CodeCon = b.CodeTong
          WHERE b.DangHoatDong = 1
            AND t.CapDo < @MaxDepth
            AND t.DuongDan NOT LIKE N'%' + b.CodeCon + N'%'  -- chống vòng lặp
        )
        SELECT * FROM BOMTree ORDER BY CapDo, ThuTu, CodeCon
      `);

    res.json({
      codeTong: req.params.codeTong,
      items:    result.recordset.map(r => ({
        codeTong:       r.CodeTong,
        codeCon:        r.CodeCon,
        moTa:           r.MoTa || null,
        model:          r.Model || null,
        heSoCapNay:     parseFloat(r.HeSoCapNay) || 1,
        heSoTichLuy:    parseFloat(r.HeSoTichLuy) || 1,
        cumVatLieu:     r.CumVatLieu || null,
        laAssembly:     r.LaAssembly === true || r.LaAssembly === 1,
        capDo:          r.CapDo,
        duongDan:       r.DuongDan,
      })),
      total: result.recordset.length,
    });
  } catch (err) {
    console.error("GET /api/bom/:codeTong/expand:", err.message);
    res.status(500).json({ error: "Loi mo rong BOM" });
  }
});

// ─── POST /api/bom/kitting ────────────────────────────────────────────────────
// Tính số lượng linh kiện cần cho N sản phẩm
// Body: { codeTong, soLuong }
router.post("/kitting", async (req, res) => {
  try {
    const { codeTong, soLuong } = req.body || {};
    if (!codeTong || !soLuong || soLuong <= 0)
      return res.status(400).json({ error: "Thieu codeTong hoac soLuong khong hop le" });

    const pool = await getPool();
    const result = await pool.request()
      .input("CodeTong", sql.NVarChar(50), codeTong)
      .input("MaxDepth", sql.Int, 8)
      .query(`
        WITH BOMTree AS (
          SELECT b.CodeCon, b.HeSo AS HeSoTichLuy, p.MoTa, p.Model, p.LaAssembly, b.CumVatLieu, 1 AS CapDo,
                 CAST(b.CodeCon AS NVARCHAR(MAX)) AS DuongDan
          FROM BOMItems b JOIN Parts p ON p.Code=b.CodeCon
          WHERE b.CodeTong=@CodeTong AND b.DangHoatDong=1
          UNION ALL
          SELECT b.CodeCon, t.HeSoTichLuy*b.HeSo, p.MoTa, p.Model, p.LaAssembly, b.CumVatLieu, t.CapDo+1,
                 t.DuongDan+N' > '+b.CodeCon
          FROM BOMItems b JOIN Parts p ON p.Code=b.CodeCon
          JOIN BOMTree t ON t.CodeCon=b.CodeTong
          WHERE b.DangHoatDong=1 AND t.CapDo<@MaxDepth
            AND t.DuongDan NOT LIKE N'%'+b.CodeCon+N'%'
        )
        SELECT CodeCon AS Code, MoTa, Model, CumVatLieu,
               SUM(HeSoTichLuy) AS HeSoTong
        FROM BOMTree
        WHERE LaAssembly = 0   -- chỉ lấy linh kiện lá (không phải assembly)
        GROUP BY CodeCon, MoTa, Model, CumVatLieu
        ORDER BY CumVatLieu, CodeCon
      `);

    const sl = parseFloat(soLuong);
    res.json({
      codeTong,
      soLuong:    sl,
      kitting:    result.recordset.map(r => ({
        code:        r.Code,
        moTa:        r.MoTa || null,
        model:       r.Model || null,
        cumVatLieu:  r.CumVatLieu || null,
        heSoTong:    parseFloat(r.HeSoTong),
        soLuongCan:  Math.ceil(parseFloat(r.HeSoTong) * sl),
      })),
      total: result.recordset.length,
    });
  } catch (err) {
    console.error("POST /api/bom/kitting:", err.message);
    res.status(500).json({ error: "Loi tinh kitting" });
  }
});

// ─── GET /api/bom/:codeCon/parents ────────────────────────────────────────────
// Tìm tất cả Code Tổng sử dụng một Code Con (where-used)
router.get("/:codeCon/parents", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("CodeCon", sql.NVarChar(50), req.params.codeCon)
      .query(`
        SELECT b.CodeTong, b.HeSo, b.CumVatLieu, p.MoTa, p.Model
        FROM BOMItems b JOIN Parts p ON p.Code=b.CodeTong
        WHERE b.CodeCon=@CodeCon AND b.DangHoatDong=1
        ORDER BY b.CodeTong
      `);
    res.json({
      codeCon: req.params.codeCon,
      parents: result.recordset.map(r => ({
        codeTong:   r.CodeTong,
        moTa:       r.MoTa || null,
        model:      r.Model || null,
        heSo:       parseFloat(r.HeSo),
        cumVatLieu: r.CumVatLieu || null,
      })),
      total: result.recordset.length,
    });
  } catch (err) {
    console.error("GET /api/bom/:codeCon/parents:", err.message);
    res.status(500).json({ error: "Loi tim parents" });
  }
});

// ─── POST /api/bom/bulk ───────────────────────────────────────────────────────
// Thêm nhiều CodeCon vào 1 CodeTong trong 1 lần
// Body: { codeTong: string, items: [{codeCon, heSo?, cumVatLieu?}] }
router.post("/bulk", async (req, res) => {
  try {
    const { codeTong, items } = req.body || {};
    if (!codeTong || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: "Thiếu codeTong hoặc items" });

    const pool = await getPool();
    const parentCheck = await pool.request()
      .input("Code", sql.NVarChar(50), codeTong)
      .query("SELECT Code FROM Parts WHERE Code=@Code AND DangHoatDong=1");
    if (!parentCheck.recordset.length)
      return res.status(404).json({ error: `Code Tổng "${codeTong}" không tìm thấy` });

    const maxThuTuRes = await pool.request()
      .input("CodeTong", sql.NVarChar(50), codeTong)
      .query("SELECT ISNULL(MAX(ThuTu),0) AS MaxThuTu FROM BOMItems WHERE CodeTong=@CodeTong");
    let nextThuTu = (maxThuTuRes.recordset[0]?.MaxThuTu ?? 0) + 1;

    let added = 0, skipped = 0, errors = [];
    for (const item of items) {
      const codeCon = (item.codeCon || "").trim();
      if (!codeCon || codeCon === codeTong) { skipped++; continue; }
      try {
        await pool.request()
          .input("CodeTong",   sql.NVarChar(50),   codeTong)
          .input("CodeCon",    sql.NVarChar(50),   codeCon)
          .input("HeSo",       sql.Decimal(10, 4), parseFloat(item.heSo) || 1)
          .input("CumVatLieu", sql.NVarChar(100),  item.cumVatLieu || null)
          .input("ThuTu",      sql.Int,            nextThuTu++)
          .query(`INSERT INTO BOMItems (CodeTong,CodeCon,HeSo,CumVatLieu,ThuTu)
                  VALUES (@CodeTong,@CodeCon,@HeSo,@CumVatLieu,@ThuTu)`);
        added++;
      } catch (e) {
        if (e.message?.includes("UQ_BOMItems") || e.message?.includes("duplicate")) skipped++;
        else errors.push({ codeCon, error: e.message });
      }
    }
    res.status(201).json({ ok: true, added, skipped, errors });
  } catch (err) {
    console.error("POST /api/bom/bulk:", err.message);
    res.status(500).json({ error: "Lỗi thêm BOM hàng loạt: " + err.message });
  }
});

// ─── POST /api/bom ────────────────────────────────────────────────────────────
// Thêm một dòng BOM
router.post("/", async (req, res) => {
  try {
    const { codeTong, codeCon, heSo, cumVatLieu, thuTu } = req.body || {};
    if (!codeTong || !codeCon)
      return res.status(400).json({ error: "Thieu codeTong hoac codeCon" });

    // Kiểm tra vòng lặp đơn giản
    if (codeTong === codeCon)
      return res.status(409).json({ error: "codeTong khong duoc trung codeCon" });

    const pool = await getPool();
    await pool.request()
      .input("CodeTong",   sql.NVarChar(50),   codeTong)
      .input("CodeCon",    sql.NVarChar(50),   codeCon)
      .input("HeSo",       sql.Decimal(10, 4), parseFloat(heSo) || 1)
      .input("CumVatLieu", sql.NVarChar(100),  cumVatLieu || null)
      .input("ThuTu",      sql.Int,            thuTu || null)
      .query(`INSERT INTO BOMItems (CodeTong,CodeCon,HeSo,CumVatLieu,ThuTu)
              VALUES (@CodeTong,@CodeCon,@HeSo,@CumVatLieu,@ThuTu)`);
    res.status(201).json({ ok: true });
  } catch (err) {
    if (err.message?.includes("UQ_BOMItems"))
      return res.status(409).json({ error: "Quan he nay da ton tai" });
    if (err.message?.includes("FOREIGN KEY"))
      return res.status(404).json({ error: "CodeTong hoac CodeCon chua co trong Parts" });
    console.error("POST /api/bom:", err.message);
    res.status(500).json({ error: "Loi them BOM" });
  }
});

// ─── PUT /api/bom/:id ─────────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { heSo, cumVatLieu, thuTu, dangHoatDong } = req.body || {};
    const pool = await getPool();
    await pool.request()
      .input("MaBOM",       sql.Int,            id)
      .input("HeSo",        sql.Decimal(10, 4), parseFloat(heSo) || 1)
      .input("CumVatLieu",  sql.NVarChar(100),  cumVatLieu || null)
      .input("ThuTu",       sql.Int,            thuTu || null)
      .input("DangHoatDong",sql.Bit,            dangHoatDong !== false ? 1 : 0)
      .query(`UPDATE BOMItems SET HeSo=@HeSo, CumVatLieu=@CumVatLieu,
              ThuTu=@ThuTu, DangHoatDong=@DangHoatDong WHERE MaBOM=@MaBOM`);
    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/bom/:id:", err.message);
    res.status(500).json({ error: "Loi cap nhat" });
  }
});

// ─── DELETE /api/bom/:id ──────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = await getPool();
    await pool.request()
      .input("MaBOM", sql.Int, id)
      .query("UPDATE BOMItems SET DangHoatDong=0 WHERE MaBOM=@MaBOM");
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/bom/:id:", err.message);
    res.status(500).json({ error: "Loi xoa" });
  }
});

// ─── GET /api/bom (search) ────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const q     = (req.query.q || "").trim();
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const pool  = await getPool();

    const req2 = pool.request();
    let where = "WHERE b.DangHoatDong=1";
    if (q) {
      where += " AND (b.CodeTong LIKE @q OR b.CodeCon LIKE @q OR p.MoTa LIKE @q)";
      req2.input("q", sql.NVarChar, `%${q}%`);
    }

    const result = await req2.query(`
      SELECT b.MaBOM, b.CodeTong, b.CodeCon, b.HeSo, b.CumVatLieu, b.ThuTu,
             p.MoTa, p.Model, p.LaAssembly,
             COUNT(*) OVER() AS TotalCount
      FROM BOMItems b JOIN Parts p ON p.Code=b.CodeCon
      ${where}
      ORDER BY b.CodeTong, b.ThuTu
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `);

    const total = result.recordset[0]?.TotalCount ?? 0;
    res.json({
      data:  result.recordset.map(toBomItem),
      total, page, limit,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("GET /api/bom:", err.message);
    res.status(500).json({ error: "Loi tim kiem BOM" });
  }
});

module.exports = router;
