/**
 * auth.js — /api/auth
 *
 * POST /api/auth/login      — đăng nhập, kiểm tra phiên đồng thời theo quyền
 * POST /api/auth/logout     — đăng xuất, xoá phiên
 * POST /api/auth/heartbeat  — giữ phiên sống (gọi mỗi 5 phút)
 *
 * Quy tắc phiên đồng thời:
 *   - Mỗi vai trò (admin / staff / viewer) chỉ được 1 phiên hoạt động cùng lúc
 *   - Phiên hết hạn sau 30 phút không có heartbeat
 */
const { Router } = require("express");
const { getPool } = require("../db");
const sql = require("mssql");
const { randomUUID } = require("crypto");

const router = Router();

/** Phiên hết hạn sau bao nhiêu phút không heartbeat */
const SESSION_TIMEOUT_MINUTES = 30;

/** Xoá các phiên đã quá ${SESSION_TIMEOUT_MINUTES} phút không heartbeat */
async function cleanExpiredSessions(pool) {
  await pool.request()
    .input("Timeout", sql.Int, SESSION_TIMEOUT_MINUTES)
    .query(`
      DELETE FROM PhienDangNhap
      WHERE DATEDIFF(MINUTE, ThoiGianHB, GETDATE()) >= @Timeout
    `);
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

async function login(req, res) {
  try {
    const { taiKhoan, matKhau } = req.body || {};
    if (!taiKhoan || !matKhau) {
      return res.status(400).json({ error: "Thieu tai khoan hoac mat khau" });
    }

    const pool = await getPool();

    // 1. Xác thực credentials
    const authResult = await pool.request()
      .input("TaiKhoan", sql.VarChar(50), String(taiKhoan).trim())
      .input("MatKhau", sql.VarChar(255), String(matKhau))
      .query(`
        SELECT MaNguoiDung, TaiKhoan, HoTen, Quyen, AnhDaiDien
        FROM NguoiDung
        WHERE TaiKhoan = @TaiKhoan AND MatKhau = @MatKhau
      `);

    const row = authResult.recordset[0];
    if (!row) {
      return res.status(401).json({ error: "Sai tai khoan hoac mat khau" });
    }

    const quyen = row.Quyen || "staff";

    // 2. Dọn phiên hết hạn
    await cleanExpiredSessions(pool);

    // 3. Kiểm tra phiên đồng thời theo vai trò (không tính chính mình)
    const activeCheck = await pool.request()
      .input("Quyen", sql.NVarChar(20), quyen)
      .input("MaNguoiDung", sql.Int, row.MaNguoiDung)
      .query(`
        SELECT TOP 1 p.MaPhien, n.HoTen, n.TaiKhoan
        FROM PhienDangNhap p
        JOIN NguoiDung n ON n.MaNguoiDung = p.MaNguoiDung
        WHERE p.Quyen = @Quyen
          AND p.MaNguoiDung <> @MaNguoiDung
      `);

    if (activeCheck.recordset.length > 0) {
      const blocker = activeCheck.recordset[0];
      return res.status(409).json({
        error: "session_conflict",
        quyen,
        blockedBy: blocker.HoTen || blocker.TaiKhoan,
      });
    }

    // 4. Xoá phiên cũ của chính user (nếu còn)
    await pool.request()
      .input("MaNguoiDung", sql.Int, row.MaNguoiDung)
      .query("DELETE FROM PhienDangNhap WHERE MaNguoiDung = @MaNguoiDung");

    // 5. Tạo phiên mới
    const maPhien = randomUUID();
    await pool.request()
      .input("MaPhien", sql.NVarChar(64), maPhien)
      .input("MaNguoiDung", sql.Int, row.MaNguoiDung)
      .input("Quyen", sql.NVarChar(20), quyen)
      .query(`
        INSERT INTO PhienDangNhap (MaPhien, MaNguoiDung, Quyen)
        VALUES (@MaPhien, @MaNguoiDung, @Quyen)
      `);

    res.json({
      user: {
        maNguoiDung: row.MaNguoiDung,
        taiKhoan: row.TaiKhoan,
        hoTen: row.HoTen ?? null,
        quyen,
        anhDaiDien: row.AnhDaiDien ?? null,
      },
      maPhien,
    });
  } catch (err) {
    console.error("POST /api/auth/login:", err.message || err);
    res.status(500).json({ error: "Loi dang nhap" });
  }
}

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

async function logout(req, res) {
  try {
    const { maPhien } = req.body || {};
    if (!maPhien) return res.status(400).json({ error: "Thieu maPhien" });
    const pool = await getPool();
    await pool.request()
      .input("MaPhien", sql.NVarChar(64), maPhien)
      .query("DELETE FROM PhienDangNhap WHERE MaPhien = @MaPhien");
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/auth/logout:", err.message || err);
    res.status(500).json({ error: "Loi dang xuat" });
  }
}

// ─── POST /api/auth/heartbeat ─────────────────────────────────────────────────

async function heartbeat(req, res) {
  try {
    const { maPhien } = req.body || {};
    if (!maPhien) return res.status(400).json({ error: "Thieu maPhien" });
    const pool = await getPool();
    const result = await pool.request()
      .input("MaPhien", sql.NVarChar(64), maPhien)
      .query(`
        UPDATE PhienDangNhap SET ThoiGianHB = GETDATE()
        WHERE MaPhien = @MaPhien;
        SELECT @@ROWCOUNT AS cnt;
      `);
    const cnt = result.recordset[0]?.cnt ?? 0;
    if (cnt === 0) {
      // Phiên không còn tồn tại → bị xoá hoặc hết hạn
      return res.status(401).json({ error: "session_expired" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/auth/heartbeat:", err.message || err);
    res.status(500).json({ error: "Loi heartbeat" });
  }
}

router.post("/login", login);
router.post("/logout", logout);
router.post("/heartbeat", heartbeat);

module.exports = router;
