/**
 * BOM routes — /api/bom
 * Đọc từ BOMItems + Parts (schema mới)
 * Giữ nguyên response format để TrangBOM.tsx tương thích
 */
const { Router } = require("express");
const { getPool } = require("../db");
const sql = require("mssql");

const router = Router();

function toBomRow(r) {
  return {
    id:              r.MaBOM,
    maAssy:          r.CodeTong,
    stt:             r.ThuTu,
    code:            r.CodeCon,
    itemDescription: r.MoTa   || null,
    qtyPlan:         null,
    qtyKitting:      r.HeSo   != null ? Number(r.HeSo)  : null,
    heSo:            r.HeSo   != null ? Number(r.HeSo)  : null,
    donVi:           r.DonVi  || "pcs",
    xuatSX:          null,
    remark:          r.CumVatLieu || null,
    laAssembly:      r.LaAssembly === true || r.LaAssembly === 1,
  };
}

// GET /api/bom?assy=XXX
router.get("/", async (req, res) => {
  try {
    const assy = (req.query.assy || "").toString().trim();
    if (!assy) return res.status(400).json({ error: "Thieu tham so assy" });

    const pool = await getPool();
    const result = await pool.request()
      .input("CodeTong", sql.NVarChar(50), assy)
      .query(`
        SELECT b.MaBOM, b.CodeTong, b.CodeCon, b.HeSo, b.CumVatLieu, b.ThuTu,
               p.MoTa, p.DonVi, p.LaAssembly
        FROM BOMItems b
        JOIN Parts p ON p.Code = b.CodeCon
        WHERE b.CodeTong = @CodeTong AND b.DangHoatDong = 1
        ORDER BY b.ThuTu, b.CodeCon
      `);

    res.json(result.recordset.map(toBomRow));
  } catch (err) {
    console.error("GET /api/bom:", err.message || err);
    res.status(500).json({ error: "Loi khi lay BOM" });
  }
});

// POST /api/bom — thêm row BOM mới vào BOMItems
router.post("/", async (req, res) => {
  try {
    const { maAssy, code, heSo, donVi, stt, remark } = req.body || {};
    if (!maAssy || !String(maAssy).trim()) return res.status(400).json({ error: "Thieu maAssy" });
    if (!code    || !String(code).trim())   return res.status(400).json({ error: "Thieu code" });

    const pool = await getPool();
    const parentCheck = await pool.request()
      .input("CodeTong", sql.NVarChar(50), String(maAssy).trim())
      .query("SELECT 1 FROM Parts WHERE Code = @CodeTong AND DangHoatDong = 1");
    if (!parentCheck.recordset.length)
      return res.status(404).json({ error: "CodeTong khong ton tai trong Parts" });

    const childCheck = await pool.request()
      .input("CodeCon", sql.NVarChar(50), String(code).trim())
      .query("SELECT 1 FROM Parts WHERE Code = @CodeCon AND DangHoatDong = 1");
    if (!childCheck.recordset.length)
      return res.status(404).json({ error: "CodeCon khong ton tai trong Parts" });

    const result = await pool.request()
      .input("CodeTong",    sql.NVarChar(50),   String(maAssy).trim())
      .input("CodeCon",     sql.NVarChar(50),   String(code).trim())
      .input("HeSo",        sql.Decimal(10, 4), heSo != null ? Number(heSo) : 1)
      .input("CumVatLieu",  sql.NVarChar(100),  remark || null)
      .input("ThuTu",       sql.Int,            stt   != null ? parseInt(stt) : 9999)
      .query(`
        INSERT INTO BOMItems (CodeTong, CodeCon, HeSo, CumVatLieu, ThuTu)
        OUTPUT INSERTED.MaBOM
        VALUES (@CodeTong, @CodeCon, @HeSo, @CumVatLieu, @ThuTu)
      `);

    res.status(201).json({ ok: true, id: result.recordset[0].MaBOM });
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.includes("UQ_BOMItems") || msg.includes("Violation of UNIQUE"))
      return res.status(409).json({ error: "Quan he CodeTong-CodeCon da ton tai" });
    console.error("POST /api/bom:", msg);
    res.status(500).json({ error: "Loi khi them row BOM" });
  }
});

// PUT /api/bom/:id — sửa HeSo, ThuTu, CumVatLieu
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: "ID khong hop le" });

    const { heSo, stt, remark } = req.body || {};
    const pool = await getPool();
    const result = await pool.request()
      .input("ID",          sql.Int,            id)
      .input("HeSo",        sql.Decimal(10, 4), heSo  != null ? Number(heSo)    : null)
      .input("ThuTu",       sql.Int,            stt   != null ? parseInt(stt)   : null)
      .input("CumVatLieu",  sql.NVarChar(100),  remark !== undefined ? (remark || null) : null)
      .query(`
        UPDATE BOMItems SET
          HeSo       = COALESCE(@HeSo,       HeSo),
          ThuTu      = COALESCE(@ThuTu,      ThuTu),
          CumVatLieu = COALESCE(@CumVatLieu, CumVatLieu)
        WHERE MaBOM = @ID
      `);

    if (result.rowsAffected[0] === 0)
      return res.status(404).json({ error: "Khong tim thay row BOM" });
    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/bom/:id:", err.message || err);
    res.status(500).json({ error: "Loi khi sua row BOM" });
  }
});

// DELETE /api/bom/:id — soft delete
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: "ID khong hop le" });

    const pool = await getPool();
    const result = await pool.request()
      .input("ID", sql.Int, id)
      .query("UPDATE BOMItems SET DangHoatDong = 0 WHERE MaBOM = @ID");

    if (result.rowsAffected[0] === 0)
      return res.status(404).json({ error: "Khong tim thay row BOM" });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/bom/:id:", err.message || err);
    res.status(500).json({ error: "Loi khi xoa row BOM" });
  }
});

module.exports = router;
