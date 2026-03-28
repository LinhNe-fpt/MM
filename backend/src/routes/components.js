/**
 * /api/components — Quản lý linh kiện (đọc từ Parts + TonKhoChiTiet)
 * Schema mới: Parts thay thế LinhKien
 */
const path = require("path");
const fs = require("fs");
const { Router } = require("express");
const multer = require("multer");
const { getPool } = require("../db");
const sql = require("mssql");

const router = Router();

const PARTS_UPLOAD_DIR = path.join(__dirname, "../../uploads/parts");
const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MIME_TO_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function safeCodeSegment(code) {
  const s = String(code || "").replace(/[^a-zA-Z0-9._-]+/g, "_");
  return (s || "part").slice(0, 80);
}

const uploadPartImage = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(PARTS_UPLOAD_DIR, { recursive: true });
      cb(null, PARTS_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const code = safeCodeSegment(req.params.code);
      const ext = MIME_TO_EXT[file.mimetype] || path.extname(file.originalname || "").slice(0, 6).toLowerCase() || ".bin";
      cb(null, `${code}_${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error("Chi chap nhan JPEG, PNG, WebP hoac GIF"));
  },
});

function toPart(r) {
  const heSo = r.HeSo != null ? Number(r.HeSo) : 0;
  const lossRate = heSo > 1 && heSo <= 100 ? heSo / 100 : heSo > 100 ? 0 : heSo;
  return {
    id:           r.Code,
    partNumber:   r.Code,
    name:         r.MoTa         || null,
    manufacturer: r.CumVatLieu   || null,
    model:        r.Model        || null,
    donVi:        r.DonVi        || "pcs",
    laAssembly:   r.LaAssembly   === true || r.LaAssembly === 1,
    quantity:     r.quantity     != null ? Math.round(Number(r.quantity)) : 0,
    minStock:     r.TonToiThieu  != null ? Number(r.TonToiThieu) : 0,
    unit:         r.DonVi        || "pcs",
    lossRate,
    // Vị trí kho
    viTriText:    r.ViTriText || null,
    rack:         r.Rack  || null,
    tang:         r.Tang  || null,
    thung:        r.Thung || null,
    maViTri:      r.MaViTri != null ? Number(r.MaViTri) : null,
    kittable:     r.kittable  != null ? Math.floor(Number(r.kittable))              : null,
    tonDau:       r.tonDau    != null ? Math.max(0, Math.round(Number(r.tonDau)))   : 0,
    tonThucTe:    r.tonThucTe    != null ? Math.round(Number(r.tonThucTe))           : null,
    tonCuoiCaNgay: r.tonCuoiCaNgay != null ? Math.round(Number(r.tonCuoiCaNgay))   : null,
    hinhAnh:       r.duongDanHinh != null && String(r.duongDanHinh).trim() !== "" ? String(r.duongDanHinh).trim() : null,
  };
}

// ─── GET /api/components ──────────────────────────────────────────────────────
// ?q=       tìm code/mô tả/model
// ?assembly=1|0  lọc assembly/leaf
// ?status=low|out   lọc tồn thấp/hết
router.get("/", async (req, res) => {
  try {
    const q      = (req.query.q || "").trim();
    const asmFilter = req.query.assembly;
    const status    = req.query.status;
    const pool   = await getPool();
    const req2   = pool.request();

    let where = "WHERE p.DangHoatDong = 1";
    if (q) {
      where += " AND (p.Code LIKE @q OR p.MoTa LIKE @q OR p.Model LIKE @q OR p.CumVatLieu LIKE @q)";
      req2.input("q", sql.NVarChar, `%${q}%`);
    }
    if (asmFilter === "1" || asmFilter === "0") {
      where += ` AND p.LaAssembly = ${asmFilter === "1" ? 1 : 0}`;
    }

    const result = await req2.query(`
      WITH KittableCTE AS (
        SELECT b.CodeTong,
          MIN(FLOOR(tc.SoLuongTon / NULLIF(b.HeSo, 0))) AS kittable
        FROM BOMItems b
        INNER JOIN TonKhoChiTiet tc ON LTRIM(RTRIM(tc.MaLinhKien)) = LTRIM(RTRIM(b.CodeCon))
        WHERE b.DangHoatDong = 1 AND b.HeSo > 0
        GROUP BY b.CodeTong
      ),
      -- Tồn đầu = Tồn cuối − Tổng nhập + Tổng xuất (ngược chiều về đầu kỳ)
      TonDauCTE AS (
        SELECT ctpk.MaLinhKien,
          SUM(CASE WHEN pk.LoaiGiaoDich = 'NHAP' THEN ctpk.SoLuong ELSE 0 END) AS tongNhap,
          SUM(CASE WHEN pk.LoaiGiaoDich = 'XUAT' THEN ctpk.SoLuong ELSE 0 END) AS tongXuat
        FROM ChiTietPhieuKho ctpk
        JOIN PhieuKho pk ON pk.MaPhieu = ctpk.MaPhieu
        GROUP BY ctpk.MaLinhKien
      )
      SELECT
        p.Code, p.MoTa, p.CumVatLieu, p.Model, p.DonVi,
        p.LaAssembly, p.TonToiThieu, p.HeSo, p.ViTriText,
        ISNULL(SUM(t.SoLuongTon), 0)                                              AS quantity,
        ISNULL(SUM(t.TonThucTe),     0)                                            AS tonThucTe,
        MAX(t.TonCuoiCaNgay)                                                       AS tonCuoiCaNgay,
        -- tonDau = tonCuoi - nhap + xuat
        ISNULL(SUM(t.SoLuongTon), 0)
          - ISNULL(MAX(td.tongNhap), 0)
          + ISNULL(MAX(td.tongXuat), 0)                                            AS tonDau,
        MAX(v.Rack)    AS Rack,
        MAX(v.Tang)    AS Tang,
        MAX(v.Thung)   AS Thung,
        MAX(t.MaViTri) AS MaViTri,
        MAX(k.kittable) AS kittable,
        MAX(p.DuongDanHinh) AS duongDanHinh
      FROM Parts p
      LEFT JOIN TonKhoChiTiet t  ON LTRIM(RTRIM(t.MaLinhKien))  = LTRIM(RTRIM(p.Code))
      LEFT JOIN ViTriKho v       ON v.MaViTri      = t.MaViTri
      LEFT JOIN KittableCTE k    ON k.CodeTong     = p.Code
      LEFT JOIN TonDauCTE td     ON LTRIM(RTRIM(td.MaLinhKien)) = LTRIM(RTRIM(p.Code))
      ${where}
      GROUP BY p.Code, p.MoTa, p.CumVatLieu, p.Model, p.DonVi,
               p.LaAssembly, p.TonToiThieu, p.HeSo, p.ViTriText
      ORDER BY p.Code
    `);

    let list = result.recordset.map(toPart);

    // Lọc theo tồn kho
    if (status === "low") {
      list = list.filter(r => r.minStock > 0 && r.quantity > 0 && r.quantity < r.minStock);
    } else if (status === "out") {
      list = list.filter(r => r.quantity <= 0);
    }

    res.json(list);
  } catch (err) {
    console.error("GET /api/components:", err.message || err);
    res.status(500).json({ error: "Loi khi lay danh sach" });
  }
});

// ─── GET /api/components/:assy/details ───────────────────────────────────────
// BOM 1 cấp của một code tổng — từ BOMItems + Parts
router.get("/:assy/details", async (req, res) => {
  try {
    const assy = (req.params.assy || "").trim();
    if (!assy) return res.status(400).json({ error: "Thieu code" });

    const pool = await getPool();

    const parent = await pool.request()
      .input("Code", sql.NVarChar(50), assy)
      .query("SELECT Code, MoTa, Model, LaAssembly FROM Parts WHERE Code = @Code");

    const items = await pool.request()
      .input("CodeTong", sql.NVarChar(50), assy)
      .query(`
        SELECT b.MaBOM AS id, b.ThuTu AS stt, b.CodeCon AS code,
               p.MoTa AS itemDescription, b.HeSo AS heSo, b.CumVatLieu,
               p.DonVi AS donVi, p.LaAssembly,
               ISNULL(SUM(t.SoLuongTon), 0) AS tonKho
        FROM BOMItems b
        JOIN Parts p ON p.Code = b.CodeCon
        LEFT JOIN TonKhoChiTiet t ON LTRIM(RTRIM(t.MaLinhKien)) = LTRIM(RTRIM(p.Code))
        WHERE b.CodeTong = @CodeTong AND b.DangHoatDong = 1
        GROUP BY b.MaBOM, b.ThuTu, b.CodeCon, p.MoTa, b.HeSo, b.CumVatLieu, p.DonVi, p.LaAssembly
        ORDER BY b.ThuTu, b.CodeCon
      `);

    const h = parent.recordset[0];
    res.json({
      assy:  h ? h.Code  : assy,
      model: h ? h.Model : null,
      moTa:  h ? h.MoTa  : null,
      rows: items.recordset.map(r => ({
        id:              r.id,
        stt:             r.stt,
        code:            r.code,
        itemDescription: r.itemDescription,
        heSo:            r.heSo != null ? Number(r.heSo) : null,
        donVi:           r.donVi,
        cumVatLieu:      r.CumVatLieu || null,
        laAssembly:      r.LaAssembly === true || r.LaAssembly === 1,
        tonKho:          Math.round(Number(r.tonKho)),
      })),
    });
  } catch (err) {
    console.error("GET /api/components/:assy/details:", err.message || err);
    res.status(500).json({ error: "Loi khi lay chi tiet" });
  }
});

// ─── POST /api/components — Thêm linh kiện mới vào Parts ─────────────────────
router.post("/", async (req, res) => {
  try {
    const { codeTong, moTa, cumVatLieu, model, heSo, tonToiThieu, laAssembly, donVi, duongDanHinh } = req.body || {};
    if (!codeTong || !String(codeTong).trim())
      return res.status(400).json({ error: "Thieu code" });
    const pool = await getPool();
    await pool.request()
      .input("Code",         sql.NVarChar(50),   String(codeTong).trim().toUpperCase())
      .input("MoTa",         sql.NVarChar(500),  moTa        || null)
      .input("CumVatLieu",   sql.NVarChar(100),  cumVatLieu  || null)
      .input("Model",        sql.NVarChar(200),  model       || null)
      .input("DonVi",        sql.NVarChar(20),   donVi       || "pcs")
      .input("LaAssembly",   sql.Bit,            laAssembly  ? 1 : 0)
      .input("HeSo",         sql.Decimal(10, 4), heSo != null ? Number(heSo) : 0)
      .input("TonToiThieu",  sql.Int,            tonToiThieu != null ? parseInt(tonToiThieu) : 0)
      .input("DuongDanHinh", sql.NVarChar(1000), duongDanHinh != null && String(duongDanHinh).trim() !== "" ? String(duongDanHinh).trim() : null)
      .query(`
        INSERT INTO Parts (Code, MoTa, CumVatLieu, Model, DonVi, LaAssembly, HeSo, TonToiThieu, DuongDanHinh)
        VALUES (@Code, @MoTa, @CumVatLieu, @Model, @DonVi, @LaAssembly, @HeSo, @TonToiThieu, @DuongDanHinh)
      `);
    res.status(201).json({ ok: true, code: String(codeTong).trim().toUpperCase() });
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.includes("UQ_Parts_Code") || msg.includes("PRIMARY KEY") || msg.includes("Duplicate"))
      return res.status(409).json({ error: "Code da ton tai" });
    console.error("POST /api/components:", msg);
    res.status(500).json({ error: "Loi khi them" });
  }
});

// ─── PUT /api/components/:code ────────────────────────────────────────────────
router.put("/:code", async (req, res) => {
  try {
    const code = (req.params.code || "").trim();
    if (!code) return res.status(400).json({ error: "Thieu code" });
    const { moTa, cumVatLieu, model, heSo, tonToiThieu, donVi, laAssembly, duongDanHinh } = req.body || {};
    const pool = await getPool();
    const rq = pool.request()
      .input("Code",        sql.NVarChar(50),   code)
      .input("MoTa",        sql.NVarChar(500),  moTa       !== undefined ? (moTa       || null) : null)
      .input("CumVatLieu",  sql.NVarChar(100),  cumVatLieu !== undefined ? (cumVatLieu || null) : null)
      .input("Model",       sql.NVarChar(200),  model      !== undefined ? (model      || null) : null)
      .input("DonVi",       sql.NVarChar(20),   donVi      || "pcs")
      .input("LaAssembly",  sql.Bit,            laAssembly ? 1 : 0)
      .input("HeSo",        sql.Decimal(10, 4), heSo        != null ? Number(heSo)        : 0)
      .input("TonToiThieu", sql.Int,            tonToiThieu != null ? parseInt(tonToiThieu) : 0);
    if (duongDanHinh !== undefined) {
      rq.input(
        "DuongDanHinh",
        sql.NVarChar(1000),
        duongDanHinh != null && String(duongDanHinh).trim() !== "" ? String(duongDanHinh).trim() : null,
      );
    }
    const r = await rq.query(`
        UPDATE Parts SET
          MoTa        = COALESCE(@MoTa,       MoTa),
          CumVatLieu  = COALESCE(@CumVatLieu, CumVatLieu),
          Model       = COALESCE(@Model,      Model),
          DonVi       = @DonVi,
          LaAssembly  = @LaAssembly,
          HeSo        = @HeSo,
          TonToiThieu = @TonToiThieu
          ${duongDanHinh !== undefined ? ", DuongDanHinh = @DuongDanHinh" : ""}
        WHERE Code = @Code
      `);
    if (r.rowsAffected[0] === 0)
      return res.status(404).json({ error: "Khong tim thay" });
    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/components/:code:", err.message || err);
    res.status(500).json({ error: "Loi khi sua" });
  }
});

// ─── DELETE /api/components/:code (soft delete) ───────────────────────────────
router.delete("/:code", async (req, res) => {
  try {
    const code = (req.params.code || "").trim();
    if (!code) return res.status(400).json({ error: "Thieu code" });
    const pool = await getPool();
    // Kiểm tra còn tồn kho không
    const ton = await pool.request()
      .input("Code", sql.NVarChar(50), code)
      .query("SELECT ISNULL(SUM(SoLuongTon),0) AS Ton FROM TonKhoChiTiet WHERE MaLinhKien=@Code");
    if (Number(ton.recordset[0]?.Ton) > 0)
      return res.status(409).json({ error: "Con ton kho, khong the xoa" });
    const r = await pool.request()
      .input("Code", sql.NVarChar(50), code)
      .query("UPDATE Parts SET DangHoatDong=0 WHERE Code=@Code");
    if (r.rowsAffected[0] === 0)
      return res.status(404).json({ error: "Khong tim thay" });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/components/:code:", err.message || err);
    res.status(500).json({ error: "Loi khi xoa" });
  }
});

// ─── POST /api/components/:code/hinh-anh/upload — tải file ảnh lên server, ghi DuongDanHinh ──
router.post(
  "/:code/hinh-anh/upload",
  (req, res, next) => {
    uploadPartImage.single("file")(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE")
          return res.status(400).json({ error: "Anh qua lon (toi da 3MB)" });
        return res.status(400).json({ error: err.message || "Loi upload" });
      }
      return res.status(400).json({ error: err.message || "Loi upload" });
    });
  },
  async (req, res) => {
    try {
      const code = (req.params.code || "").trim();
      if (!code) return res.status(400).json({ error: "Thieu code" });
      if (!req.file) return res.status(400).json({ error: "Thieu file" });
      const relUrl = `/api/uploads/parts/${req.file.filename}`;
      const pool = await getPool();
      const r = await pool
        .request()
        .input("Code", sql.NVarChar(50), code)
        .input("DuongDanHinh", sql.NVarChar(1000), relUrl)
        .query("UPDATE Parts SET DuongDanHinh = @DuongDanHinh WHERE Code = @Code AND DangHoatDong = 1");
      if (r.rowsAffected[0] === 0) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (_) {
          /* ignore */
        }
        return res.status(404).json({ error: "Khong tim thay" });
      }
      res.json({ ok: true, duongDanHinh: relUrl });
    } catch (err) {
      if (req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (_) {
          /* ignore */
        }
      }
      console.error("POST hinh-anh/upload:", err.message || err);
      res.status(500).json({ error: "Loi khi luu anh" });
    }
  },
);

// ─── PATCH /api/components/:code/hinh-anh — chỉ cập nhật DuongDanHinh (gán ảnh nhanh) ──
router.patch("/:code/hinh-anh", async (req, res) => {
  try {
    const code = (req.params.code || "").trim();
    if (!code) return res.status(400).json({ error: "Thieu code" });
    const raw = req.body?.duongDanHinh;
    const val =
      raw == null || (typeof raw === "string" && raw.trim() === "")
        ? null
        : String(raw).trim().slice(0, 1000);
    const pool = await getPool();
    const r = await pool
      .request()
      .input("Code", sql.NVarChar(50), code)
      .input("DuongDanHinh", sql.NVarChar(1000), val)
      .query("UPDATE Parts SET DuongDanHinh = @DuongDanHinh WHERE Code = @Code AND DangHoatDong = 1");
    if (r.rowsAffected[0] === 0) return res.status(404).json({ error: "Khong tim thay" });
    res.json({ ok: true, duongDanHinh: val });
  } catch (err) {
    console.error("PATCH hinh-anh:", err.message || err);
    res.status(500).json({ error: "Loi khi cap nhat anh" });
  }
});

// ─── PATCH /api/components/:code/vitri ───────────────────────────────────────
router.patch("/:code/vitri", async (req, res) => {
  const { code } = req.params;
  const { viTriText } = req.body;
  try {
    const pool = await getPool();
    const val = viTriText ? String(viTriText).trim().toUpperCase() : null;
    await pool.request()
      .input("Code",      sql.NVarChar(50), code)
      .input("ViTriText", sql.NVarChar(20), val)
      .query("UPDATE Parts SET ViTriText=@ViTriText WHERE Code=@Code AND DangHoatDong=1");
    res.json({ ok: true, viTriText: val });
  } catch (err) {
    console.error("PATCH vitri:", err.message || err);
    res.status(500).json({ error: "Lỗi cập nhật vị trí" });
  }
});

module.exports = router;
