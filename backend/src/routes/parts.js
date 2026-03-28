/**
 * /api/parts — Quản lý danh mục linh kiện (Parts master)
 * Dựa trên bảng Parts (schema mới từ KITTING BOM A5)
 */
const { Router } = require("express");
const { getPool } = require("../db");
const sql = require("mssql");

const router = Router();

function toPart(r) {
  return {
    maPart:       r.MaPart,
    code:         r.Code,
    moTa:         r.MoTa         || null,
    cumVatLieu:   r.CumVatLieu   || null,
    model:        r.Model        || null,
    donVi:        r.DonVi        || "pcs",
    laAssembly:   r.LaAssembly   === true || r.LaAssembly === 1,
    dangHoatDong: r.DangHoatDong === true || r.DangHoatDong === 1,
    ngayTao:      r.NgayTao      || null,
  };
}

// ─── GET /api/parts ───────────────────────────────────────────────────────────
// ?q=    tìm code/mô tả
// ?assembly=1|0  lọc is_assembly
// ?page=1&limit=50
router.get("/", async (req, res) => {
  try {
    const pool  = await getPool();
    const q     = (req.query.q || "").trim();
    const asm   = req.query.assembly;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(200, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    let where = "WHERE DangHoatDong = 1";
    const req2 = pool.request();
    if (q) {
      where += " AND (Code LIKE @q OR MoTa LIKE @q OR Model LIKE @q)";
      req2.input("q", sql.NVarChar, `%${q}%`);
    }
    if (asm === "1" || asm === "0") {
      where += ` AND LaAssembly = ${asm === "1" ? 1 : 0}`;
    }

    const result = await req2.query(`
      SELECT MaPart, Code, MoTa, CumVatLieu, Model, DonVi, LaAssembly, DangHoatDong, NgayTao,
             COUNT(*) OVER() AS TotalCount
      FROM Parts ${where}
      ORDER BY LaAssembly DESC, Code
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `);

    const total = result.recordset[0]?.TotalCount ?? 0;
    res.json({
      data:  result.recordset.map(toPart),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("GET /api/parts:", err.message);
    res.status(500).json({ error: "Loi lay danh sach" });
  }
});

// ─── GET /api/parts/:code ─────────────────────────────────────────────────────
router.get("/:code", async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input("Code", sql.NVarChar(50), req.params.code)
      .query("SELECT * FROM Parts WHERE Code = @Code");
    if (!r.recordset[0]) return res.status(404).json({ error: "Khong tim thay" });
    res.json(toPart(r.recordset[0]));
  } catch (err) {
    console.error("GET /api/parts/:code:", err.message);
    res.status(500).json({ error: "Loi" });
  }
});

// ─── POST /api/parts ──────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { code, moTa, cumVatLieu, model, donVi, laAssembly } = req.body || {};
    if (!code) return res.status(400).json({ error: "Thieu code" });
    const pool = await getPool();
    await pool.request()
      .input("Code",         sql.NVarChar(50),  String(code).trim().toUpperCase())
      .input("MoTa",         sql.NVarChar(500), moTa       || null)
      .input("CumVatLieu",   sql.NVarChar(100), cumVatLieu || null)
      .input("Model",        sql.NVarChar(200), model      || null)
      .input("DonVi",        sql.NVarChar(20),  donVi      || "pcs")
      .input("LaAssembly",   sql.Bit,           laAssembly ? 1 : 0)
      .query(`INSERT INTO Parts (Code,MoTa,CumVatLieu,Model,DonVi,LaAssembly)
              VALUES (@Code,@MoTa,@CumVatLieu,@Model,@DonVi,@LaAssembly)`);
    res.status(201).json({ ok: true });
  } catch (err) {
    if (err.message?.includes("UQ_Parts_Code"))
      return res.status(409).json({ error: "Code da ton tai" });
    console.error("POST /api/parts:", err.message);
    res.status(500).json({ error: "Loi them" });
  }
});

// ─── PUT /api/parts/:code ─────────────────────────────────────────────────────
router.put("/:code", async (req, res) => {
  try {
    const { moTa, cumVatLieu, model, donVi, laAssembly, dangHoatDong } = req.body || {};
    const pool = await getPool();
    await pool.request()
      .input("Code",         sql.NVarChar(50),  req.params.code)
      .input("MoTa",         sql.NVarChar(500), moTa       ?? null)
      .input("CumVatLieu",   sql.NVarChar(100), cumVatLieu ?? null)
      .input("Model",        sql.NVarChar(200), model      ?? null)
      .input("DonVi",        sql.NVarChar(20),  donVi      || "pcs")
      .input("LaAssembly",   sql.Bit,           laAssembly ? 1 : 0)
      .input("DangHoatDong", sql.Bit,           dangHoatDong !== false ? 1 : 0)
      .query(`UPDATE Parts SET MoTa=@MoTa, CumVatLieu=@CumVatLieu, Model=@Model,
              DonVi=@DonVi, LaAssembly=@LaAssembly, DangHoatDong=@DangHoatDong
              WHERE Code=@Code`);
    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/parts/:code:", err.message);
    res.status(500).json({ error: "Loi cap nhat" });
  }
});

// ─── DELETE /api/parts/:code (soft delete) ────────────────────────────────────
router.delete("/:code", async (req, res) => {
  try {
    const pool = await getPool();
    // Kiểm tra có BOM nào dùng không
    const used = await pool.request()
      .input("Code", sql.NVarChar(50), req.params.code)
      .query("SELECT COUNT(*) AS N FROM BOMItems WHERE CodeTong=@Code OR CodeCon=@Code");
    if (used.recordset[0].N > 0)
      return res.status(409).json({ error: `Dang duoc dung trong ${used.recordset[0].N} dong BOM` });
    await pool.request()
      .input("Code", sql.NVarChar(50), req.params.code)
      .query("UPDATE Parts SET DangHoatDong=0 WHERE Code=@Code");
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/parts/:code:", err.message);
    res.status(500).json({ error: "Loi xoa" });
  }
});

module.exports = router;
