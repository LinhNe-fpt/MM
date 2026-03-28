/**
 * Xác thực phiên đăng nhập cho module RMA/UPK (header X-Ma-Phien).
 * Gắn req.rmaUpk: { maNguoiDung, taiKhoan, hoTen, quyen, khoGhi, isAdmin }
 */
const { getPool } = require("../db");
const sql = require("mssql");

const HEADER = "x-ma-phien";

function khoGhiTuQuyen(quyen) {
  const q = String(quyen || "").trim().toLowerCase();
  if (q === "upk") return "UPK";
  if (q === "rma") return "RMA";
  return null;
}

function laQuyenMoRmaUpk(quyen) {
  const q = String(quyen || "").trim().toLowerCase();
  return q === "admin" || q === "upk" || q === "rma";
}

async function requireRmaUpkSession(req, res, next) {
  const maPhien = req.get(HEADER) || req.get("X-Ma-Phien");
  if (!maPhien || !String(maPhien).trim()) {
    return res.status(401).json({ error: "Thieu phien. Gui header X-Ma-Phien." });
  }
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
    const quyen = row.Quyen;
    if (!laQuyenMoRmaUpk(quyen)) {
      return res.status(403).json({ error: "Tai khoan khong co quyen module RMA/UPK" });
    }
    req.rmaUpk = {
      maNguoiDung: row.MaNguoiDung,
      taiKhoan: row.TaiKhoan,
      hoTen: row.HoTen,
      quyen,
      khoGhi: khoGhiTuQuyen(quyen),
      isAdmin: String(quyen || "").trim().toLowerCase() === "admin",
    };
    next();
  } catch (err) {
    console.error("requireRmaUpkSession:", err.message || err);
    res.status(500).json({ error: "Loi xac thuc phien" });
  }
}

/** Trả về { status, error } nếu không được ghi kho maKho */
function assertWriteKho(req, maKho) {
  const { khoGhi, isAdmin } = req.rmaUpk;
  const k = String(maKho || "").toUpperCase();
  if (k !== "UPK" && k !== "RMA") return { status: 400, error: "MaKho khong hop le" };
  if (isAdmin) return null;
  if (!khoGhi || khoGhi !== k) return { status: 403, error: "Chi duoc ghi kho cua nhom minh" };
  return null;
}

module.exports = { requireRmaUpkSession, assertWriteKho, khoGhiTuQuyen, laQuyenMoRmaUpk };
