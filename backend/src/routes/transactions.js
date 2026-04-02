const { Router } = require("express");
const sql = require("mssql");
const { getPool } = require("../db");

const router = Router();

/** "K2-3", "M3-1" (Parts.ViTriText) → rack/tang/thung tách bởi dấu gạch sau chữ cái */
function parseViTriTextKieuParts(vt) {
  const s = String(vt || "").trim();
  if (!s) return null;
  const m = s.match(/^([A-Za-z]+)(\d+)-(\d+)$/);
  if (!m) return null;
  return { rack: m[1].toUpperCase(), tang: m[2], thung: m[3] };
}

/**
 * Tìm MaViTri theo binLabel:
 * 1) Khớp chuỗi CONCAT như GET /api/warehouse/rows (vd. K-2-3)
 * 2) Nếu label dạng ViTriText không có gạch sau rack (vd. K2-3) → tra Rack+Tang+Thung
 */
async function timMaViTriTheoNhanThung(pool, binLabel) {
  const label = String(binLabel || "").trim();
  if (!label) return null;

  const r1 = await pool
    .request()
    .input("BinLabel", sql.NVarChar(100), label)
    .query(`
      SELECT TOP 1 MaViTri
      FROM ViTriKho
      WHERE CONCAT(ISNULL(Rack, ''), '-', ISNULL(Tang, ''), '-', ISNULL(Thung, '')) = @BinLabel
         OR CONCAT(ISNULL(Rack, ''), ISNULL(Thung, '')) = @BinLabel
      ORDER BY MaViTri
    `);
  if (r1.recordset[0]) return r1.recordset[0].MaViTri;

  const parsed = parseViTriTextKieuParts(label);
  if (!parsed) return null;

  const r2 = await pool
    .request()
    .input("Rack", sql.NVarChar(50), parsed.rack)
    .input("Tang", sql.NVarChar(50), parsed.tang)
    .input("Thung", sql.NVarChar(50), parsed.thung)
    .query(`
      SELECT TOP 1 MaViTri
      FROM ViTriKho
      WHERE UPPER(LTRIM(RTRIM(ISNULL(Rack, '')))) = @Rack
        AND LTRIM(RTRIM(CAST(Tang AS NVARCHAR(50)))) = @Tang
        AND LTRIM(RTRIM(CAST(Thung AS NVARCHAR(50)))) = @Thung
      ORDER BY MaViTri
    `);
  if (r2.recordset[0]) return r2.recordset[0].MaViTri;

  const tangInt = parseInt(parsed.tang, 10);
  const thungInt = parseInt(parsed.thung, 10);
  if (!Number.isNaN(tangInt) && !Number.isNaN(thungInt)) {
    const r2n = await pool
      .request()
      .input("Rack", sql.NVarChar(50), parsed.rack)
      .input("TangInt", sql.Int, tangInt)
      .input("ThungInt", sql.Int, thungInt)
      .query(`
        SELECT TOP 1 MaViTri
        FROM ViTriKho
        WHERE UPPER(LTRIM(RTRIM(ISNULL(Rack, '')))) = @Rack
          AND TRY_CONVERT(INT, LTRIM(RTRIM(CAST(Tang AS NVARCHAR(50))))) = @TangInt
          AND TRY_CONVERT(INT, LTRIM(RTRIM(CAST(Thung AS NVARCHAR(50))))) = @ThungInt
        ORDER BY MaViTri
      `);
    if (r2n.recordset[0]) return r2n.recordset[0].MaViTri;
  }

  const compact = `${parsed.rack}${parsed.tang}${parsed.thung}`.toUpperCase();
  const r3 = await pool.request().input("Compact", sql.NVarChar(80), compact).query(`
    SELECT TOP 1 MaViTri
    FROM ViTriKho
    WHERE UPPER(
      REPLACE(REPLACE(CONCAT(ISNULL(Rack, ''), ISNULL(Tang, ''), ISNULL(Thung, '')), ' ', ''), '-', '')
    ) = @Compact
    ORDER BY MaViTri
  `);
  if (r3.recordset[0]) return r3.recordset[0].MaViTri;

  return null;
}

/** Chuẩn hóa nhãn hiển thị từ dòng ViTriKho */
async function layNhanThungTuMaViTri(pool, maViTri) {
  const r = await pool
    .request()
    .input("id", sql.Int, maViTri)
    .query(`
      SELECT TOP 1 CONCAT(ISNULL(Rack, ''), '-', ISNULL(Tang, ''), '-', ISNULL(Thung, '')) AS bin
      FROM ViTriKho WHERE MaViTri = @id
    `);
  const b = r.recordset[0]?.bin;
  return b && String(b).trim() ? String(b).trim() : null;
}

/** Chuẩn hóa IN/OUT giống listTransactions */
function chuanHoaLoaiGiaoDich(raw) {
  const loai = String(raw || "").toUpperCase();
  if (loai === "IN" || loai.includes("NHẬP") || loai.includes("NAP")) return "IN";
  return "OUT";
}

// GET /api/transactions/summary — tổng số lượng theo danh mục (LoaiChiTiet), bucket ngày / tuần (thứ 2) / tháng
// Query: granularity=day|week|month, type=IN|OUT (tùy chọn), from=YYYY-MM-DD, to=YYYY-MM-DD
async function summaryTransactions(req, res) {
  try {
    const gran = String(req.query.granularity || "day").toLowerCase();
    if (!["day", "week", "month"].includes(gran)) {
      return res.status(400).json({ error: "granularity phai la day, week hoac month" });
    }
    const typeQ = req.query.type;
    if (typeQ != null && typeQ !== "" && typeQ !== "IN" && typeQ !== "OUT") {
      return res.status(400).json({ error: "type phai la IN hoac OUT" });
    }

    const toStr = req.query.to;
    const fromStr = req.query.from;
    const toDate = toStr ? new Date(String(toStr) + "T12:00:00") : new Date();
    if (Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ error: "to khong hop le (YYYY-MM-DD)" });
    }
    let fromDate;
    if (fromStr) {
      fromDate = new Date(String(fromStr) + "T00:00:00");
      if (Number.isNaN(fromDate.getTime())) {
        return res.status(400).json({ error: "from khong hop le (YYYY-MM-DD)" });
      }
    } else {
      fromDate = new Date(toDate.getTime() - 90 * 86400000);
    }
    if (fromDate > toDate) {
      return res.status(400).json({ error: "from phai truoc hoac bang to" });
    }

    let bucketSql;
    if (gran === "day") {
      bucketSql = "CONVERT(varchar(10), CAST(p.NgayThucHien AS date), 23)";
    } else if (gran === "month") {
      bucketSql = "LEFT(CONVERT(varchar(10), CAST(p.NgayThucHien AS date), 23), 7)";
    } else {
      // Tuần theo thứ Hai (SQL Server: 1900-01-01 là thứ Hai)
      bucketSql = `CONVERT(varchar(10),
        DATEADD(DAY,
          -((DATEDIFF(DAY, CAST('19000101' AS DATE), CAST(p.NgayThucHien AS DATE)) % 7)),
          CAST(p.NgayThucHien AS DATE)
        ), 23)`;
    }

    let query = `
      SELECT ${bucketSql} AS period,
             p.LoaiGiaoDich AS rawType,
             ISNULL(NULLIF(LTRIM(RTRIM(p.LoaiChiTiet)), N''), N'') AS category,
             MAX(ISNULL(u.HoTen, u.TaiKhoan)) AS TenNguoiThaoTac,
             SUM(CAST(c.SoLuong AS FLOAT)) AS quantity
      FROM ChiTietPhieuKho c
      JOIN PhieuKho p ON p.MaPhieu = c.MaPhieu
      LEFT JOIN NguoiDung u ON u.MaNguoiDung = p.MaNguoiDung
      WHERE p.NgayThucHien >= @from
        AND p.NgayThucHien < DATEADD(day, 1, CAST(@to AS date))
    `;

    const pool = await getPool();
    const request = pool
      .request()
      .input("from", sql.DateTime, fromDate)
      .input("to", sql.Date, toDate);

    if (typeQ === "IN" || typeQ === "OUT") {
      query += " AND p.LoaiGiaoDich = @type";
      request.input("type", sql.NVarChar(50), typeQ);
    }

    query += `
      GROUP BY ${bucketSql}, p.LoaiGiaoDich, ISNULL(NULLIF(LTRIM(RTRIM(p.LoaiChiTiet)), N''), N''), p.MaNguoiDung
      ORDER BY period DESC, p.LoaiGiaoDich, category, TenNguoiThaoTac
    `;

    const result = await request.query(query);
    const rows = result.recordset.map((r) => {
      const tenNt =
        r.TenNguoiThaoTac != null
          ? r.TenNguoiThaoTac
          : r.tennguoithaotac != null
            ? r.tennguoithaotac
            : "";
      const op = String(tenNt || "").trim();
      return {
        period: r.period || "",
        type: chuanHoaLoaiGiaoDich(r.rawType),
        category: r.category || "",
        operator: op,
        quantity: Number(r.quantity) || 0,
      };
    });

    res.json({
      granularity: gran,
      from: fromDate.toISOString().slice(0, 10),
      to: toDate.toISOString().slice(0, 10),
      rows,
    });
  } catch (err) {
    console.error("GET /api/transactions/summary:", err.message || err);
    res.status(500).json({
      error: "Loi khi tong hop giao dich",
      detail: process.env.NODE_ENV !== "production" ? (err.message || String(err)) : undefined,
    });
  }
}

// GET /api/transactions - Danh sach giao dich tu ChiTietPhieuKho + PhieuKho + Parts + ViTriKho + NguoiDung
async function listTransactions(req, res) {
  try {
    const type = req.query.type;
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const pool = await getPool();
    let query = `
      SELECT c.ID, p.LoaiGiaoDich AS type, p.LoaiChiTiet AS categoryDetail, p.NgayThucHien AS timestamp,
             c.MaLinhKien AS partNumber, pt.MoTa AS partName, c.SoLuong AS quantity,
             CONCAT(ISNULL(v.Rack, ''), '-', ISNULL(v.Tang, ''), '-', ISNULL(v.Thung, '')) AS bin,
             ISNULL(u.HoTen, u.TaiKhoan) AS operator, c.Model AS model
      FROM ChiTietPhieuKho c
      JOIN PhieuKho p ON p.MaPhieu = c.MaPhieu
      LEFT JOIN Parts pt ON pt.Code = c.MaLinhKien
      LEFT JOIN ViTriKho v ON v.MaViTri = c.MaViTri
      LEFT JOIN NguoiDung u ON u.MaNguoiDung = p.MaNguoiDung
      WHERE 1=1
    `;
    if (type === "IN" || type === "OUT") {
      query += " AND p.LoaiGiaoDich = @type";
    }
    query += " ORDER BY p.NgayThucHien DESC, c.ID DESC OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY";
    const request = pool.request();
    if (type === "IN" || type === "OUT") request.input("type", sql.NVarChar(50), type);
    request.input("limit", sql.Int, limit);
    const result = await request.query(query);
    const list = result.recordset.map((r) => {
      const loai = (r.type || "").toUpperCase();
      const type = loai === "IN" || loai.includes("NHẬP") || loai.includes("NAP") ? "IN" : "OUT";
      return {
        id: "t" + r.ID,
        type,
        category: r.categoryDetail || r.type || type,
        partNumber: r.partNumber,
        partName: r.partName,
        quantity: Number(r.quantity),
        bin: r.bin || "",
        timestamp: r.timestamp ? new Date(r.timestamp).toISOString().slice(0, 16).replace("T", " ") : "",
        operator: r.operator || "",
        model: r.model || null,
      };
    });
    res.json(list);
  } catch (err) {
    console.error("GET /api/transactions:", err.message || err);
    res.status(500).json({
      error: "Loi khi lay giao dich",
      detail: process.env.NODE_ENV !== "production" ? (err.message || String(err)) : undefined,
    });
  }
}

// POST /api/transactions - Tao phieu (PhieuKho + ChiTietPhieuKho) va cap nhat TonKhoChiTiet
async function createTransaction(req, res) {
  try {
    const { type, category, partNumber, partName, quantity, binLabel, operator, model, maViTri: bodyMaViTri } = req.body;
    const binStr = binLabel != null ? String(binLabel).trim() : "";
    const mvtParsed = parseInt(String(bodyMaViTri ?? ""), 10);
    const coMaViTriHopLe = Number.isFinite(mvtParsed) && mvtParsed > 0;

    if (!type || !category || !partNumber || !partName || quantity == null || !operator) {
      return res.status(400).json({
        error: "Thieu truong: type, category, partNumber, partName, quantity, operator",
      });
    }
    if (!binStr && !coMaViTriHopLe) {
      return res.status(400).json({
        error: "Thieu binLabel hoac maViTri hop le",
      });
    }
    const qty = parseFloat(String(quantity));
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: "So luong phai la so duong" });
    }
    const pool = await getPool();

    const comp = await pool
      .request()
      .input("MaLinhKien", sql.NVarChar(50), partNumber)
      .query("SELECT Code FROM Parts WHERE Code = @MaLinhKien AND DangHoatDong = 1");
    if (!comp.recordset[0]) {
      return res.status(400).json({ error: "Khong tim thay linh kien voi ma: " + partNumber });
    }

    let maViTri = null;
    let nhanThungPhanHoi = binStr;

    if (coMaViTriHopLe) {
      const chk = await pool
        .request()
        .input("id", sql.Int, mvtParsed)
        .query("SELECT TOP 1 MaViTri FROM ViTriKho WHERE MaViTri = @id");
      if (chk.recordset[0]) {
        maViTri = chk.recordset[0].MaViTri;
        const canonical = await layNhanThungTuMaViTri(pool, maViTri);
        if (canonical) nhanThungPhanHoi = canonical;
      }
    }
    if (maViTri == null && binStr) {
      maViTri = await timMaViTriTheoNhanThung(pool, binStr);
      if (maViTri != null) {
        const canonical = await layNhanThungTuMaViTri(pool, maViTri);
        if (canonical) nhanThungPhanHoi = canonical;
      }
    }
    if (maViTri == null) {
      return res.status(400).json({
        error:
          "Khong tim thay vi tri thung: " +
          (binStr || "") +
          (coMaViTriHopLe ? " (maViTri " + mvtParsed + ")" : ""),
      });
    }

    if (type === "OUT" || type === "Xuất" || type === "Xuat") {
      const ton = await pool
        .request()
        .input("MaLinhKien", sql.NVarChar(50), partNumber)
        .input("MaViTri", sql.Int, maViTri)
        .query("SELECT SoLuongTon FROM TonKhoChiTiet WHERE MaLinhKien = @MaLinhKien AND MaViTri = @MaViTri");
      const current = ton.recordset[0] ? Number(ton.recordset[0].SoLuongTon) : 0;
      if (current < qty) {
        return res.status(400).json({ error: "Ton kho khong du. Hien co: " + current });
      }
    }

    const maNguoiDungResult = await pool
      .request()
      .input("TaiKhoan", sql.VarChar(50), operator)
      .query("SELECT MaNguoiDung FROM NguoiDung WHERE TaiKhoan = @TaiKhoan");
    const maNguoiDung = maNguoiDungResult.recordset[0] ? maNguoiDungResult.recordset[0].MaNguoiDung : null;

    const maPhieu = "PH" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
    const loaiGiaoDich = type === "IN" ? "IN" : type === "OUT" ? "OUT" : type;

    // Gắn ca đang active (nếu có)
    const activeShift = await pool.request()
      .query("SELECT TOP 1 MaCa FROM CaLamViec WHERE TrangThai = 'active' ORDER BY ThoiGianBatDau DESC");
    const maCa = activeShift.recordset[0]?.MaCa ?? null;

    await pool
      .request()
      .input("MaPhieu", sql.VarChar(20), maPhieu)
      .input("LoaiGiaoDich", sql.NVarChar(10), loaiGiaoDich)
      .input("LoaiChiTiet", sql.NVarChar(50), category)
      .input("NgayThucHien", sql.DateTime, new Date())
      .input("MaNguoiDung", sql.Int, maNguoiDung)
      .input("GhiChu", sql.NVarChar(500), null)
      .input("MaCa", sql.Int, maCa)
      .query(`
        INSERT INTO PhieuKho (MaPhieu, LoaiGiaoDich, LoaiChiTiet, NgayThucHien, MaNguoiDung, GhiChu, MaCa)
        VALUES (@MaPhieu, @LoaiGiaoDich, @LoaiChiTiet, @NgayThucHien, @MaNguoiDung, @GhiChu, @MaCa)
      `);

    const modelVal = model != null && String(model).trim() !== "" ? String(model).trim() : null;
    await pool
      .request()
      .input("MaPhieu", sql.VarChar(20), maPhieu)
      .input("MaLinhKien", sql.NVarChar(50), partNumber)
      .input("MaViTri", sql.Int, maViTri)
      .input("SoLuong", sql.Decimal(18, 2), qty)
      .input("TiLeHaoHut", sql.Decimal(5, 2), null)
      .input("Model", sql.NVarChar(200), modelVal)
      .query(`
        INSERT INTO ChiTietPhieuKho (MaPhieu, MaLinhKien, MaViTri, SoLuong, TiLeHaoHut, Model)
        VALUES (@MaPhieu, @MaLinhKien, @MaViTri, @SoLuong, @TiLeHaoHut, @Model)
      `);

    if (type === "IN" || type === "Nhập" || type === "Nhap") {
      const existing = await pool
        .request()
        .input("MaLinhKien", sql.NVarChar(50), partNumber)
        .input("MaViTri", sql.Int, maViTri)
        .query("SELECT SoLuongTon FROM TonKhoChiTiet WHERE MaLinhKien = @MaLinhKien AND MaViTri = @MaViTri");
      if (existing.recordset[0]) {
        await pool
          .request()
          .input("MaLinhKien", sql.NVarChar(50), partNumber)
          .input("MaViTri", sql.Int, maViTri)
          .input("SoLuong", sql.Decimal(18, 2), qty)
          .query(`
            UPDATE TonKhoChiTiet SET SoLuongTon = SoLuongTon + @SoLuong
            WHERE MaLinhKien = @MaLinhKien AND MaViTri = @MaViTri
          `);
      } else {
        await pool
          .request()
          .input("MaLinhKien", sql.NVarChar(50), partNumber)
          .input("MaViTri", sql.Int, maViTri)
          .input("SoLuongTon", sql.Decimal(18, 2), qty)
          .query(`
            INSERT INTO TonKhoChiTiet (MaLinhKien, MaViTri, SoLuongTon) VALUES (@MaLinhKien, @MaViTri, @SoLuongTon)
          `);
      }
    } else {
      await pool
        .request()
        .input("MaLinhKien", sql.NVarChar(50), partNumber)
        .input("MaViTri", sql.Int, maViTri)
        .input("SoLuong", sql.Decimal(18, 2), qty)
        .query(`
          UPDATE TonKhoChiTiet SET SoLuongTon = SoLuongTon - @SoLuong
          WHERE MaLinhKien = @MaLinhKien AND MaViTri = @MaViTri
        `);
    }

    res.status(201).json({
      id: maPhieu,
      type: loaiGiaoDich,
      category,
      partNumber,
      partName,
      quantity: qty,
      bin: nhanThungPhanHoi || binStr || String(maViTri),
      operator,
      model: modelVal || undefined,
      timestamp: new Date().toISOString().slice(0, 16).replace("T", " "),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Loi khi tao giao dich" });
  }
}

router.get("/summary", summaryTransactions);
router.get("/", listTransactions);
router.post("/", createTransaction);

module.exports = router;
