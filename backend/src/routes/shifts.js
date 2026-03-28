/**
 * shifts.js — /api/shifts
 *
 * GET  /api/shifts/active      — ca đang active (nếu có)
 * POST /api/shifts/start       — bắt đầu ca (auto-close ca cũ nếu còn active)
 * POST /api/shifts/:id/end     — kết thúc ca
 * GET  /api/shifts             — lịch sử ca (phân trang)
 * GET  /api/shifts/:id/report  — báo cáo chi tiết 1 ca
 */
const { Router } = require("express");
const sql = require("mssql");
const { getPool } = require("../db");

const router = Router();

const toShift = (r) => ({
  maCa: r.MaCa,
  maNguoiDung: r.MaNguoiDung,
  tenNguoiDung: r.TenNguoiDung ?? null,
  thoiGianBatDau: r.ThoiGianBatDau,
  thoiGianKetThuc: r.ThoiGianKetThuc ?? null,
  trangThai: r.TrangThai,
  ghiChu: r.GhiChu ?? null,
});

// ─── GET /api/shifts/active ──────────────────────────────────────────────────

async function getActiveShift(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TOP 1 c.MaCa, c.MaNguoiDung, c.ThoiGianBatDau, c.ThoiGianKetThuc, c.TrangThai, c.GhiChu,
             ISNULL(n.HoTen, n.TaiKhoan) AS TenNguoiDung
      FROM CaLamViec c
      LEFT JOIN NguoiDung n ON n.MaNguoiDung = c.MaNguoiDung
      WHERE c.TrangThai = 'active'
      ORDER BY c.ThoiGianBatDau DESC
    `);
    if (result.recordset.length === 0) return res.json(null);
    res.json(toShift(result.recordset[0]));
  } catch (err) {
    console.error("GET /api/shifts/active:", err.message || err);
    res.status(500).json({ error: "Loi khi lay ca hien tai" });
  }
}

// ─── Helper: tạo ca mới + snapshot tồn đầu ──────────────────────────────────

async function _createShift(pool, maNguoiDung, ghiChu) {
  const insertResult = await pool.request()
    .input("MaNguoiDung", sql.Int, maNguoiDung)
    .input("GhiChu", sql.NVarChar(500), ghiChu || null)
    .query(`
      INSERT INTO CaLamViec (MaNguoiDung, TrangThai, GhiChu)
      OUTPUT INSERTED.MaCa, INSERTED.ThoiGianBatDau
      VALUES (@MaNguoiDung, 'active', @GhiChu)
    `);
  const { MaCa: maCa, ThoiGianBatDau: thoiGianBatDau } = insertResult.recordset[0];

  await pool.request()
    .input("MaCa", sql.Int, maCa)
    .query(`
      INSERT INTO TonKhoDauCa (MaCa, MaLinhKien, MaViTri, SoLuong)
      SELECT @MaCa, MaLinhKien, MaViTri, SoLuongTon
      FROM TonKhoChiTiet WHERE SoLuongTon > 0
    `);

  return { maCa, thoiGianBatDau };
}

// ─── POST /api/shifts/start ──────────────────────────────────────────────────
/**
 * Body: { taiKhoan, ghiChu?, force? }
 *
 * Kết quả có thể:
 *   201 { maCa, trangThai: "active" }                → ca mới được tạo
 *   200 { maCa, trangThai: "active", sameUser: true } → ca của chính user đang mở, trả về ca cũ
 *   409 { conflict: true, maCa, tenNguoiDung }       → ca của người KHÁC đang mở, cần admin xử lý
 */
async function startShift(req, res) {
  try {
    const { taiKhoan, ghiChu, force } = req.body || {};
    if (!taiKhoan) return res.status(400).json({ error: "Thieu taiKhoan" });

    const pool = await getPool();

    // Lấy thông tin user
    const userResult = await pool.request()
      .input("TaiKhoan", sql.VarChar(50), String(taiKhoan).trim())
      .query("SELECT MaNguoiDung, Quyen FROM NguoiDung WHERE TaiKhoan = @TaiKhoan");
    if (!userResult.recordset[0]) return res.status(404).json({ error: "Khong tim thay tai khoan" });
    const { MaNguoiDung: maNguoiDung, Quyen: quyen } = userResult.recordset[0];

    // Kiểm tra ca đang active
    const activeResult = await pool.request().query(`
      SELECT TOP 1 c.MaCa, c.MaNguoiDung, c.ThoiGianBatDau,
             ISNULL(n.HoTen, n.TaiKhoan) AS TenNguoiDung
      FROM CaLamViec c
      LEFT JOIN NguoiDung n ON n.MaNguoiDung = c.MaNguoiDung
      WHERE c.TrangThai = 'active'
      ORDER BY c.ThoiGianBatDau DESC
    `);

    if (activeResult.recordset.length > 0) {
      const active = activeResult.recordset[0];

      // Case 1: Chính user này đang có ca active
      if (active.MaNguoiDung === maNguoiDung) {
        return res.status(200).json({
          maCa: active.MaCa,
          maNguoiDung,
          thoiGianBatDau: active.ThoiGianBatDau,
          trangThai: "active",
          sameUser: true,
        });
      }

      // Case 2: User khác đang có ca active
      // Chỉ cho phép tiếp tục nếu là admin HOẶC force=true (từ admin UI)
      const isAdmin = quyen === "admin";
      if (!isAdmin || !force) {
        return res.status(409).json({
          conflict: true,
          maCa: active.MaCa,
          tenNguoiDung: active.TenNguoiDung,
          thoiGianBatDau: active.ThoiGianBatDau,
        });
      }

      // Admin force-close ca cũ
      await pool.request()
        .input("MaCa", sql.Int, active.MaCa)
        .query(`
          UPDATE CaLamViec SET TrangThai = 'closed', ThoiGianKetThuc = GETDATE(),
            GhiChu = ISNULL(GhiChu + ' | ', '') + 'Auto-closed by admin'
          WHERE MaCa = @MaCa
        `);
    }

    // Tạo ca mới
    const { maCa, thoiGianBatDau } = await _createShift(pool, maNguoiDung, ghiChu);
    res.status(201).json({ maCa, maNguoiDung, thoiGianBatDau, trangThai: "active" });
  } catch (err) {
    console.error("POST /api/shifts/start:", err.message || err);
    res.status(500).json({ error: "Loi khi bat dau ca" });
  }
}

// ─── POST /api/shifts/:id/end ────────────────────────────────────────────────

async function endShift(req, res) {
  try {
    const maCa = parseInt(req.params.id);
    if (!maCa || isNaN(maCa)) return res.status(400).json({ error: "MaCa khong hop le" });

    const pool = await getPool();
    const result = await pool.request()
      .input("MaCa", sql.Int, maCa)
      .query(`
        UPDATE CaLamViec
        SET TrangThai = 'closed', ThoiGianKetThuc = GETDATE()
        WHERE MaCa = @MaCa AND TrangThai = 'active';
        SELECT @@ROWCOUNT AS cnt;
      `);
    if (result.recordset[0]?.cnt === 0) {
      return res.status(404).json({ error: "Khong tim thay ca dang active voi ID nay" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/shifts/:id/end:", err.message || err);
    res.status(500).json({ error: "Loi khi ket thuc ca" });
  }
}

// ─── GET /api/shifts ─────────────────────────────────────────────────────────

async function listShifts(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;
    const pool = await getPool();
    const result = await pool.request()
      .input("limit", sql.Int, limit)
      .input("offset", sql.Int, offset)
      .query(`
        SELECT c.MaCa, c.MaNguoiDung, c.ThoiGianBatDau, c.ThoiGianKetThuc, c.TrangThai, c.GhiChu,
               ISNULL(n.HoTen, n.TaiKhoan) AS TenNguoiDung,
               (SELECT COUNT(*) FROM PhieuKho p WHERE p.MaCa = c.MaCa) AS SoPhieu,
               (SELECT ISNULL(SUM(ct.SoLuong),0) FROM ChiTietPhieuKho ct JOIN PhieuKho p ON p.MaPhieu=ct.MaPhieu WHERE p.MaCa=c.MaCa AND p.LoaiGiaoDich='IN')  AS TongNhap,
               (SELECT ISNULL(SUM(ct.SoLuong),0) FROM ChiTietPhieuKho ct JOIN PhieuKho p ON p.MaPhieu=ct.MaPhieu WHERE p.MaCa=c.MaCa AND p.LoaiGiaoDich='OUT') AS TongXuat
        FROM CaLamViec c
        LEFT JOIN NguoiDung n ON n.MaNguoiDung = c.MaNguoiDung
        ORDER BY c.ThoiGianBatDau DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `);
    const totalResult = await pool.request().query("SELECT COUNT(*) AS cnt FROM CaLamViec");
    res.json({
      total: totalResult.recordset[0].cnt,
      items: result.recordset.map((r) => ({
        ...toShift(r),
        soPhieu: r.SoPhieu,
        tongNhap: Number(r.TongNhap),
        tongXuat: Number(r.TongXuat),
      })),
    });
  } catch (err) {
    console.error("GET /api/shifts:", err.message || err);
    res.status(500).json({ error: "Loi khi lay danh sach ca" });
  }
}

// ─── GET /api/shifts/:id/report ──────────────────────────────────────────────

async function getShiftReport(req, res) {
  try {
    const maCa = parseInt(req.params.id);
    if (!maCa || isNaN(maCa)) return res.status(400).json({ error: "MaCa khong hop le" });

    const pool = await getPool();

    // Thông tin ca
    const caResult = await pool.request()
      .input("MaCa", sql.Int, maCa)
      .query(`
        SELECT c.MaCa, c.MaNguoiDung, c.ThoiGianBatDau, c.ThoiGianKetThuc, c.TrangThai, c.GhiChu,
               ISNULL(n.HoTen, n.TaiKhoan) AS TenNguoiDung
        FROM CaLamViec c LEFT JOIN NguoiDung n ON n.MaNguoiDung = c.MaNguoiDung
        WHERE c.MaCa = @MaCa
      `);
    if (!caResult.recordset[0]) return res.status(404).json({ error: "Khong tim thay ca" });

    // Tồn đầu ca vs tồn cuối ca
    // Tồn cuối = tồn đầu + tổng nhập trong ca - tổng xuất trong ca (per linh kiện x vị trí)
    const tonResult = await pool.request()
      .input("MaCa", sql.Int, maCa)
      .query(`
        SELECT
          d.MaLinhKien,
          d.MaViTri,
          ISNULL(l.MoTa, '') AS MoTa,
          CONCAT(ISNULL(v.Rack,''),'-',ISNULL(v.Tang,''),'-',ISNULL(v.Thung,'')) AS ViTri,
          d.SoLuong AS TonDau,
          d.SoLuong
            + ISNULL((
                SELECT SUM(ct.SoLuong) FROM ChiTietPhieuKho ct
                JOIN PhieuKho p ON p.MaPhieu=ct.MaPhieu
                WHERE p.MaCa=@MaCa AND p.LoaiGiaoDich='IN'
                  AND ct.MaLinhKien=d.MaLinhKien AND ct.MaViTri=d.MaViTri
              ), 0)
            - ISNULL((
                SELECT SUM(ct.SoLuong) FROM ChiTietPhieuKho ct
                JOIN PhieuKho p ON p.MaPhieu=ct.MaPhieu
                WHERE p.MaCa=@MaCa AND p.LoaiGiaoDich='OUT'
                  AND ct.MaLinhKien=d.MaLinhKien AND ct.MaViTri=d.MaViTri
              ), 0)
          AS TonCuoi
        FROM TonKhoDauCa d
        LEFT JOIN Parts l ON l.Code = d.MaLinhKien
        LEFT JOIN ViTriKho v ON v.MaViTri = d.MaViTri
        WHERE d.MaCa = @MaCa
        ORDER BY d.MaLinhKien, d.MaViTri
      `);

    // Danh sách giao dịch trong ca
    const giaoDichResult = await pool.request()
      .input("MaCa", sql.Int, maCa)
      .query(`
        SELECT ct.ID, p.LoaiGiaoDich AS type, p.LoaiChiTiet AS category,
               ct.MaLinhKien AS partNumber, l.MoTa AS partName,
               ct.SoLuong AS quantity,
               CONCAT(ISNULL(v.Rack,''),'-',ISNULL(v.Tang,''),'-',ISNULL(v.Thung,'')) AS bin,
               ISNULL(n.HoTen, n.TaiKhoan) AS operator,
               p.NgayThucHien AS timestamp
        FROM PhieuKho p
        JOIN ChiTietPhieuKho ct ON ct.MaPhieu = p.MaPhieu
        LEFT JOIN Parts l ON l.Code = ct.MaLinhKien
        LEFT JOIN ViTriKho v ON v.MaViTri = ct.MaViTri
        LEFT JOIN NguoiDung n ON n.MaNguoiDung = p.MaNguoiDung
        WHERE p.MaCa = @MaCa
        ORDER BY p.NgayThucHien DESC, ct.ID DESC
      `);

    res.json({
      ca: toShift(caResult.recordset[0]),
      tonKho: tonResult.recordset.map((r) => ({
        maLinhKien: r.MaLinhKien,
        maViTri: r.MaViTri,
        moTa: r.MoTa,
        viTri: r.ViTri,
        tonDau: Number(r.TonDau),
        tonCuoi: Number(r.TonCuoi),
        delta: Number(r.TonCuoi) - Number(r.TonDau),
      })),
      giaoDich: giaoDichResult.recordset.map((r) => ({
        id: "t" + r.ID,
        type: r.type,
        category: r.category,
        partNumber: r.partNumber,
        partName: r.partName,
        quantity: Number(r.quantity),
        bin: r.bin,
        operator: r.operator,
        timestamp: r.timestamp ? new Date(r.timestamp).toISOString().slice(0, 16).replace("T", " ") : "",
      })),
    });
  } catch (err) {
    console.error("GET /api/shifts/:id/report:", err.message || err);
    res.status(500).json({ error: "Loi khi lay bao cao ca" });
  }
}

// ─── POST /api/shifts/:id/force-end — Admin đóng ca của người khác ───────────

async function forceEndShift(req, res) {
  try {
    const maCa = parseInt(req.params.id);
    const { lyDo } = req.body || {};
    if (!maCa || isNaN(maCa)) return res.status(400).json({ error: "MaCa khong hop le" });

    const pool = await getPool();
    const result = await pool.request()
      .input("MaCa", sql.Int, maCa)
      .input("LyDo", sql.NVarChar(500), lyDo || "Admin dong ca")
      .query(`
        UPDATE CaLamViec
        SET TrangThai = 'closed', ThoiGianKetThuc = GETDATE(),
            GhiChu = ISNULL(GhiChu + ' | ', '') + @LyDo
        WHERE MaCa = @MaCa AND TrangThai = 'active';
        SELECT @@ROWCOUNT AS cnt;
      `);
    if (result.recordset[0]?.cnt === 0) {
      return res.status(404).json({ error: "Ca khong ton tai hoac da dong" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/shifts/:id/force-end:", err.message || err);
    res.status(500).json({ error: "Loi khi dong ca" });
  }
}

router.get("/active", getActiveShift);
router.get("/", listShifts);
router.post("/start", startShift);
router.post("/:id/end", endShift);
router.post("/:id/force-end", forceEndShift);
router.get("/:id/report", getShiftReport);

module.exports = router;
