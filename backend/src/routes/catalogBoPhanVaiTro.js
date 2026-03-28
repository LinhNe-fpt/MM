/**
 * GET /api/catalog/bo-phan
 * GET /api/catalog/vai-tro
 * GET /api/catalog/tom-tat  — { boPhan, vaiTro } (một vòng gọi UI)
 *
 * Bảng: schema-bophan-vaitro.sql. Thiếu bảng → 503 + hint.
 */
const { Router } = require("express");
const { getPool } = require("../db");

const router = Router();

function laLoiBangKhongTonTai(err) {
  const n = err?.number ?? err?.originalError?.number;
  const msg = String(err?.message || "");
  return n === 208 || msg.includes("Invalid object name") || /does not exist/i.test(msg);
}

async function docBoPhan(pool) {
  const r = await pool.request().query(`
    SELECT MaBoPhan, TenBoPhan, ThuTu, GhiChu
    FROM dbo.BoPhan
    ORDER BY ThuTu, MaBoPhan
  `);
  return r.recordset || [];
}

async function docVaiTro(pool) {
  const r = await pool.request().query(`
    SELECT
      v.MaVaiTro,
      v.MaBoPhan,
      b.TenBoPhan,
      v.TenHienThi,
      v.LaQuanTri,
      v.DuLieuMacDinh,
      v.MoTa
    FROM dbo.VaiTro v
    INNER JOIN dbo.BoPhan b ON b.MaBoPhan = v.MaBoPhan
    ORDER BY b.ThuTu, b.MaBoPhan, v.MaVaiTro
  `);
  return r.recordset || [];
}

router.get("/bo-phan", async (req, res) => {
  try {
    const pool = await getPool();
    const rows = await docBoPhan(pool);
    res.json(rows);
  } catch (err) {
    if (laLoiBangKhongTonTai(err)) {
      return res.status(503).json({
        error: "Chua tao bang BoPhan/VaiTro",
        hint: "Chay backend/scripts/schema-bophan-vaitro.sql",
      });
    }
    console.error("GET /api/catalog/bo-phan:", err.message || err);
    res.status(500).json({ error: "Loi doc danh muc bo phan" });
  }
});

router.get("/vai-tro", async (req, res) => {
  try {
    const pool = await getPool();
    const rows = await docVaiTro(pool);
    res.json(rows);
  } catch (err) {
    if (laLoiBangKhongTonTai(err)) {
      return res.status(503).json({
        error: "Chua tao bang BoPhan/VaiTro",
        hint: "Chay backend/scripts/schema-bophan-vaitro.sql",
      });
    }
    console.error("GET /api/catalog/vai-tro:", err.message || err);
    res.status(500).json({ error: "Loi doc danh muc vai tro" });
  }
});

router.get("/tom-tat", async (req, res) => {
  try {
    const pool = await getPool();
    const [boPhan, vaiTro] = await Promise.all([docBoPhan(pool), docVaiTro(pool)]);
    res.json({ boPhan, vaiTro });
  } catch (err) {
    if (laLoiBangKhongTonTai(err)) {
      /* 200 + rỗng: UI người dùng / form quyền không bị 503; trang admin đọc catalogMissing */
      return res.json({
        boPhan: [],
        vaiTro: [],
        catalogMissing: true,
        hint: "Chay backend/scripts/schema-bophan-vaitro.sql va GRANT (grantPermissionsSQL.sql)",
      });
    }
    console.error("GET /api/catalog/tom-tat:", err.message || err);
    res.status(500).json({ error: "Loi doc catalog" });
  }
});

module.exports = router;
