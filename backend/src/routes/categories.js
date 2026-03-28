const { Router } = require("express");
const { getPool } = require("../db");
const sql = require("mssql");

const router = Router();

// ─── GET /api/categories ─────────────────────────────────────────────────────
// Trả về danh mục từ bảng DanhMucGiaoDich (ưu tiên), fallback từ PhieuKho

async function listCategories(req, res) {
  try {
    const pool = await getPool();

    // Lấy từ bảng cấu hình DanhMucGiaoDich
    const result = await pool.request().query(`
      SELECT LoaiGiaoDich, TenDanhMuc, MoTa, ThuTu
      FROM DanhMucGiaoDich
      WHERE DangHoatDong = 1
      ORDER BY LoaiGiaoDich, ThuTu, TenDanhMuc
    `);

    const inList  = result.recordset.filter(r => r.LoaiGiaoDich === "IN").map(r => ({
      ten: r.TenDanhMuc, moTa: r.MoTa || ""
    }));
    const outList = result.recordset.filter(r => r.LoaiGiaoDich === "OUT").map(r => ({
      ten: r.TenDanhMuc, moTa: r.MoTa || ""
    }));

    res.json({ IN: inList, OUT: outList });
  } catch (err) {
    console.error("GET /api/categories:", err.message || err);
    // Fallback: đọc từ transactions nếu bảng không tồn tại
    try {
      const pool = await getPool();
      const fb = await pool.request().query(`
        SELECT DISTINCT LoaiChiTiet AS TenDanhMuc, LoaiGiaoDich
        FROM PhieuKho WHERE LoaiChiTiet IS NOT NULL AND LoaiChiTiet <> ''
        ORDER BY LoaiGiaoDich, LoaiChiTiet
      `);
      const inList  = fb.recordset.filter(r => r.LoaiGiaoDich === "IN").map(r => ({ ten: r.TenDanhMuc, moTa: "" }));
      const outList = fb.recordset.filter(r => r.LoaiGiaoDich === "OUT").map(r => ({ ten: r.TenDanhMuc, moTa: "" }));
      res.json({ IN: inList, OUT: outList });
    } catch {
      res.status(500).json({ error: "Loi khi lay danh muc", IN: [], OUT: [] });
    }
  }
}

// ─── POST /api/categories ────────────────────────────────────────────────────

async function addCategory(req, res) {
  try {
    const { loaiGiaoDich, tenDanhMuc, moTa, thuTu } = req.body || {};
    if (!loaiGiaoDich || !tenDanhMuc)
      return res.status(400).json({ error: "Thieu loaiGiaoDich hoac tenDanhMuc" });
    const pool = await getPool();
    await pool.request()
      .input("LoaiGiaoDich", sql.NVarChar(10),  String(loaiGiaoDich).toUpperCase())
      .input("TenDanhMuc",   sql.NVarChar(50),  String(tenDanhMuc).trim())
      .input("MoTa",         sql.NVarChar(200), moTa || null)
      .input("ThuTu",        sql.Int,           thuTu ?? 99)
      .query(`
        INSERT INTO DanhMucGiaoDich (LoaiGiaoDich, TenDanhMuc, MoTa, ThuTu)
        VALUES (@LoaiGiaoDich, @TenDanhMuc, @MoTa, @ThuTu)
      `);
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("POST /api/categories:", err.message || err);
    if (err.message?.includes("UQ_DanhMucGiaoDich"))
      return res.status(409).json({ error: "Danh muc da ton tai" });
    res.status(500).json({ error: "Loi them danh muc" });
  }
}

// ─── DELETE /api/categories/:id ──────────────────────────────────────────────

async function deleteCategory(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: "ID khong hop le" });
    const pool = await getPool();
    // Soft delete: chỉ tắt hoạt động, không xóa khỏi DB
    await pool.request()
      .input("MaDanhMuc", sql.Int, id)
      .query("UPDATE DanhMucGiaoDich SET DangHoatDong = 0 WHERE MaDanhMuc = @MaDanhMuc");
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/categories/:id:", err.message || err);
    res.status(500).json({ error: "Loi xoa danh muc" });
  }
}

// ─── GET /api/categories/all — bao gồm cả đã tắt (dành cho admin) ───────────

async function listAllCategories(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT MaDanhMuc, LoaiGiaoDich, TenDanhMuc, MoTa, ThuTu, DangHoatDong
      FROM DanhMucGiaoDich
      ORDER BY LoaiGiaoDich, ThuTu, TenDanhMuc
    `);
    res.json(result.recordset.map(r => ({
      id: r.MaDanhMuc,
      loaiGiaoDich: r.LoaiGiaoDich,
      tenDanhMuc: r.TenDanhMuc,
      moTa: r.MoTa || "",
      thuTu: r.ThuTu,
      dangHoatDong: r.DangHoatDong === true || r.DangHoatDong === 1,
    })));
  } catch (err) {
    console.error("GET /api/categories/all:", err.message || err);
    res.status(500).json({ error: "Loi lay danh muc" });
  }
}

// ─── PUT /api/categories/:id — restore hoặc cập nhật ─────────────────────────

async function updateCategory(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: "ID khong hop le" });
    const { moTa, thuTu, dangHoatDong } = req.body || {};
    const pool = await getPool();
    await pool.request()
      .input("MaDanhMuc",    sql.Int,           id)
      .input("MoTa",         sql.NVarChar(200), moTa ?? null)
      .input("ThuTu",        sql.Int,           thuTu ?? 99)
      .input("DangHoatDong", sql.Bit,           dangHoatDong !== false ? 1 : 0)
      .query(`
        UPDATE DanhMucGiaoDich
        SET MoTa = @MoTa, ThuTu = @ThuTu, DangHoatDong = @DangHoatDong
        WHERE MaDanhMuc = @MaDanhMuc
      `);
    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/categories/:id:", err.message || err);
    res.status(500).json({ error: "Loi cap nhat danh muc" });
  }
}

router.get("/all", listAllCategories);
router.get("/",    listCategories);
router.post("/",   addCategory);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);

module.exports = router;
