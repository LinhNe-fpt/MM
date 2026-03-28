/**
 * users.js — /api/users
 * CRUD tài khoản người dùng (NguoiDung)
 *
 * GET    /api/users          — danh sách (không trả MatKhau)
 * GET    /api/users/:id      — chi tiết 1 user
 * POST   /api/users          — tạo tài khoản mới
 * PUT    /api/users/:id      — sửa HoTen, Quyen, MatKhau (nếu truyền)
 * DELETE /api/users/:id      — xóa tài khoản
 */
const { Router } = require("express");
const { getPool } = require("../db");
const sql = require("mssql");

const router = Router();

/** Khi chưa có bảng dbo.VaiTro */
const ALLOWED_QUYEN_FALLBACK = ["admin", "staff", "viewer", "upk", "rma", "nhan_vien", "kiem_kho", "y_te"];

async function layDanhSachQuyenHopLe(pool) {
  try {
    const r = await pool.request().query(`
      SELECT MaVaiTro FROM dbo.VaiTro WITH (NOLOCK) ORDER BY MaVaiTro
    `);
    if (r.recordset?.length > 0) return r.recordset.map((row) => row.MaVaiTro);
  } catch (e) {
    /* Bảng chưa tạo hoặc không có quyền SELECT */
  }
  return ALLOWED_QUYEN_FALLBACK;
}

function chonQuyenKhiTao(requested, allowed) {
  const q = String(requested || "").trim();
  if (q && allowed.includes(q)) return q;
  if (allowed.includes("staff")) return "staff";
  return allowed[0] || "staff";
}

const toUser = (r) => ({
  id: r.MaNguoiDung,
  taiKhoan: r.TaiKhoan,
  hoTen: r.HoTen ?? null,
  quyen: r.Quyen ?? null,
  anhDaiDien: r.AnhDaiDien ?? null,
});

// GET /api/users
async function listUsers(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT MaNguoiDung, TaiKhoan, HoTen, Quyen, AnhDaiDien
      FROM NguoiDung ORDER BY MaNguoiDung
    `);
    res.json(result.recordset.map(toUser));
  } catch (err) {
    console.error("GET /api/users:", err.message || err);
    res.status(500).json({ error: "Loi khi lay danh sach nguoi dung" });
  }
}

// GET /api/users/:id
async function getUser(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: "ID khong hop le" });
    const pool = await getPool();
    const result = await pool.request()
      .input("ID", sql.Int, id)
      .query("SELECT MaNguoiDung, TaiKhoan, HoTen, Quyen, AnhDaiDien FROM NguoiDung WHERE MaNguoiDung = @ID");
    if (result.recordset.length === 0) return res.status(404).json({ error: "Khong tim thay nguoi dung" });
    res.json(toUser(result.recordset[0]));
  } catch (err) {
    console.error("GET /api/users/:id:", err.message || err);
    res.status(500).json({ error: "Loi khi lay nguoi dung" });
  }
}

// POST /api/users — tạo tài khoản mới
async function createUser(req, res) {
  try {
    const { taiKhoan, matKhau, hoTen, quyen } = req.body || {};
    if (!taiKhoan || !String(taiKhoan).trim()) return res.status(400).json({ error: "Thieu TaiKhoan" });
    if (!matKhau || !String(matKhau).trim()) return res.status(400).json({ error: "Thieu MatKhau" });

    const pool = await getPool();
    const allowed = await layDanhSachQuyenHopLe(pool);
    const quyenVal = chonQuyenKhiTao(quyen, allowed);

    // Check duplicate
    const dup = await pool.request()
      .input("TaiKhoan", sql.VarChar(50), String(taiKhoan).trim())
      .query("SELECT 1 FROM NguoiDung WHERE TaiKhoan = @TaiKhoan");
    if (dup.recordset.length > 0) return res.status(409).json({ error: "TaiKhoan da ton tai" });

    const result = await pool.request()
      .input("TaiKhoan", sql.VarChar(50), String(taiKhoan).trim())
      .input("MatKhau", sql.VarChar(255), String(matKhau))
      .input("HoTen", sql.NVarChar(100), hoTen || null)
      .input("Quyen", sql.NVarChar(20), quyenVal)
      .query(`
        INSERT INTO NguoiDung (TaiKhoan, MatKhau, HoTen, Quyen)
        OUTPUT INSERTED.MaNguoiDung
        VALUES (@TaiKhoan, @MatKhau, @HoTen, @Quyen)
      `);
    res.status(201).json({ ok: true, id: result.recordset[0].MaNguoiDung });
  } catch (err) {
    console.error("POST /api/users:", err.message || err);
    res.status(500).json({ error: "Loi khi tao nguoi dung" });
  }
}

// PUT /api/users/:id — sửa user
async function updateUser(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: "ID khong hop le" });

    const { hoTen, quyen, matKhauMoi, anhDaiDien } = req.body || {};
    const pool = await getPool();
    const allowed = await layDanhSachQuyenHopLe(pool);
    const qRaw = quyen !== undefined && quyen !== null ? String(quyen).trim() : "";
    const quyenVal = qRaw && allowed.includes(qRaw) ? qRaw : null;

    let query = `
      UPDATE NguoiDung SET
        HoTen = @HoTen
        ${quyenVal !== null ? ", Quyen = @Quyen" : ""}
        ${matKhauMoi ? ", MatKhau = @MatKhauMoi" : ""}
        ${anhDaiDien !== undefined ? ", AnhDaiDien = @AnhDaiDien" : ""}
      WHERE MaNguoiDung = @ID
    `;
    const req2 = pool.request()
      .input("ID", sql.Int, id)
      .input("HoTen", sql.NVarChar(100), hoTen || null);
    if (quyenVal !== null) req2.input("Quyen", sql.NVarChar(20), quyenVal);
    if (matKhauMoi) req2.input("MatKhauMoi", sql.VarChar(255), String(matKhauMoi));
    if (anhDaiDien !== undefined) req2.input("AnhDaiDien", sql.NVarChar(sql.MAX), anhDaiDien || null);

    const result = await req2.query(query);
    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: "Khong tim thay nguoi dung" });
    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/users/:id:", err.message || err);
    res.status(500).json({ error: "Loi khi sua nguoi dung" });
  }
}

// DELETE /api/users/:id
async function deleteUser(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: "ID khong hop le" });
    const pool = await getPool();
    const result = await pool.request()
      .input("ID", sql.Int, id)
      .query("DELETE FROM NguoiDung WHERE MaNguoiDung = @ID");
    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: "Khong tim thay nguoi dung" });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/users/:id:", err.message || err);
    res.status(500).json({ error: "Loi khi xoa nguoi dung" });
  }
}

// PUT /api/users/:id/avatar — chỉ cập nhật AnhDaiDien (base64 hoặc URL)
async function updateAvatar(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: "ID khong hop le" });
    const { anhDaiDien } = req.body || {};
    const pool = await getPool();
    const result = await pool.request()
      .input("ID", sql.Int, id)
      .input("AnhDaiDien", sql.NVarChar(sql.MAX), anhDaiDien || null)
      .query("UPDATE NguoiDung SET AnhDaiDien = @AnhDaiDien WHERE MaNguoiDung = @ID");
    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: "Khong tim thay nguoi dung" });
    res.json({ ok: true, anhDaiDien: anhDaiDien || null });
  } catch (err) {
    console.error("PUT /api/users/:id/avatar:", err.message || err);
    res.status(500).json({ error: "Loi khi cap nhat anh dai dien" });
  }
}

router.get("/", listUsers);
router.get("/:id", getUser);
router.post("/", createUser);
router.put("/:id/avatar", updateAvatar);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

module.exports = router;
