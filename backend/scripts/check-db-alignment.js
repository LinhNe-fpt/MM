/**
 * Script kiem tra backend da dong nhat voi DB (MM_DB) chua.
 * - Kiem tra cac bang va cot theo schema (01_schema.sql)
 * - Chay thu cac cau lenh SELECT ma backend su dung
 *
 * Chay: cd backend && node scripts/check-db-alignment.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const sql = require("mssql");

const config = {
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_DATABASE || "MM_DB",
  user: process.env.DB_USER || "ysv",
  password: process.env.DB_PASSWORD || "123",
  port: parseInt(process.env.DB_PORT || "1433", 10),
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    connectTimeout: 10000,
  },
};

// Schema mong doi (bang -> mang ten cot) - khop voi 01_schema.sql va backend
const SCHEMA_MONG_DOI = {
  NguoiDung: ["MaNguoiDung", "TaiKhoan", "MatKhau", "HoTen", "Quyen"],
  LinhKien: ["ASSY", "AssysCodeTong", "CodeCon", "MoTa", "CumVatLieu", "Model", "HeSo", "TonToiThieu", "NgayTao"],
  ChiTietLinhKien: ["ID", "MaAssy", "Stt", "Code", "ItemDescription", "QtyPlan", "QtyKitting", "HeSo", "DonVi", "XuatSX", "Remark"],
  ViTriKho: ["MaViTri", "TenDay", "TenThung", "ToaDoX", "ToaDoY", "TrangThai"],
  PhieuKho: ["MaPhieu", "LoaiGiaoDich", "LoaiChiTiet", "NgayThucHien", "MaNguoiDung", "GhiChu"],
  ChiTietPhieuKho: ["ID", "MaPhieu", "MaLinhKien", "Model", "SoLuong", "MaViTri", "TiLeHaoHut"],
  TonKhoChiTiet: ["MaLinhKien", "MaViTri", "SoLuongTon"],
};

// Cac cau lenh SELECT backend dung (chi can chay thanh cong, khong can kiem tra ket qua)
const TRUY_VAN_BACKEND = [
  {
    ten: "GET /api/components (LinhKien + TonKhoChiTiet)",
    query: `
      SELECT l.ASSY AS partNumber, l.MoTa AS name, l.CumVatLieu AS manufacturer,
             l.TonToiThieu AS minStock, l.HeSo AS lossRate,
             ISNULL(SUM(t.SoLuongTon), 0) AS quantity
      FROM LinhKien l
      LEFT JOIN TonKhoChiTiet t ON t.MaLinhKien = l.ASSY
      GROUP BY l.ASSY, l.MoTa, l.CumVatLieu, l.TonToiThieu, l.HeSo
      ORDER BY l.ASSY
    `,
  },
  {
    ten: "GET /api/warehouse/rows (ViTriKho)",
    query: `
      SELECT MaViTri, TenDay, TenThung
      FROM ViTriKho
      ORDER BY TenDay, MaViTri
    `,
  },
  {
    ten: "GET /api/warehouse/map (ViTriKho + TonKhoChiTiet + LinhKien)",
    query: `
      SELECT v.MaViTri, v.TenDay, v.TenThung, v.TrangThai,
             t.MaLinhKien, t.SoLuongTon AS quantity,
             l.MoTa AS part_name, l.TonToiThieu AS min_stock
      FROM ViTriKho v
      LEFT JOIN TonKhoChiTiet t ON t.MaViTri = v.MaViTri
      LEFT JOIN LinhKien l ON l.ASSY = t.MaLinhKien
      ORDER BY v.TenDay, v.MaViTri, t.MaLinhKien
    `,
  },
  {
    ten: "GET /api/transactions (ChiTietPhieuKho + PhieuKho + LinhKien + ViTriKho + NguoiDung)",
    query: `
      SELECT c.ID, p.LoaiGiaoDich AS type, p.NgayThucHien AS timestamp,
             c.MaLinhKien AS partNumber, l.MoTa AS partName, c.SoLuong AS quantity,
             v.TenThung AS bin, ISNULL(u.HoTen, u.TaiKhoan) AS operator
      FROM ChiTietPhieuKho c
      JOIN PhieuKho p ON p.MaPhieu = c.MaPhieu
      LEFT JOIN LinhKien l ON l.ASSY = c.MaLinhKien
      LEFT JOIN ViTriKho v ON v.MaViTri = c.MaViTri
      LEFT JOIN NguoiDung u ON u.MaNguoiDung = p.MaNguoiDung
      WHERE 1=1
      ORDER BY p.NgayThucHien DESC, c.ID DESC OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY
    `,
  },
];

function log(msg, type = "info") {
  const prefix = type === "ok" ? "[OK] " : type === "err" ? "[LOI] " : "";
  console.log(prefix + msg);
}

async function layBangVaCotTrongDB(pool) {
  const result = await pool.request().query(`
    SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo'
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);
  const map = {};
  for (const row of result.recordset) {
    const t = row.tableName;
    if (!map[t]) map[t] = [];
    map[t].push(row.columnName);
  }
  return map;
}

async function kiemTraSchema(pool) {
  log("\n=== 1. KIEM TRA BANG VA COT (dbo) ===\n");
  const trongDB = await layBangVaCotTrongDB(pool);

  let coLoi = false;

  for (const [bang, cotMongDoi] of Object.entries(SCHEMA_MONG_DOI)) {
    const cotTrongDB = trongDB[bang] || [];
    const thieu = cotMongDoi.filter((c) => !cotTrongDB.includes(c));
    const thua = cotTrongDB.filter((c) => !cotMongDoi.includes(c));

    if (!trongDB[bang]) {
      log("Thieu bang: " + bang, "err");
      coLoi = true;
      continue;
    }
    if (thieu.length > 0) {
      log("Bang " + bang + " thieu cot: " + thieu.join(", "), "err");
      coLoi = true;
    }
    if (thua.length > 0) {
      log("Bang " + bang + " co cot khong dung trong backend (bo qua OK): " + thua.join(", "));
    }
    if (trongDB[bang] && thieu.length === 0) {
      log("Bang " + bang + ": day du " + cotMongDoi.length + " cot.");
    }
  }

  const bangMongDoi = Object.keys(SCHEMA_MONG_DOI);
  const bangThua = Object.keys(trongDB).filter((t) => !bangMongDoi.includes(t));
  if (bangThua.length > 0) {
    log("DB co bang khac (khong dung backend): " + bangThua.join(", "));
  }

  return coLoi;
}

async function chayThuTruyVanBackend(pool) {
  log("\n=== 2. CHAY THU TRUY VAN BACKEND ===\n");
  let coLoi = false;

  for (const { ten, query } of TRUY_VAN_BACKEND) {
    try {
      await pool.request().query(query.trim());
      log(ten, "ok");
    } catch (err) {
      log(ten + " - " + err.message, "err");
      coLoi = true;
    }
  }

  return coLoi;
}

async function main() {
  console.log("Kiem tra backend dong nhat voi DB (MM_DB)");
  console.log("  Server:", config.server);
  console.log("  Database:", config.database);
  console.log("  User:", config.user);

  let pool;
  try {
    pool = await sql.connect(config);
    log("\nKet noi DB thanh cong.", "ok");
  } catch (err) {
    console.error("\nKet noi that bai:", err.message);
    process.exit(1);
  }

  try {
    const loiSchema = await kiemTraSchema(pool);
    const loiTruyVan = await chayThuTruyVanBackend(pool);

    console.log("\n=== KET LUAN ===");
    if (!loiSchema && !loiTruyVan) {
      log("Backend dong nhat voi DB: cac bang/cot dung va truy van chay thanh cong.", "ok");
      process.exit(0);
    } else {
      if (loiSchema) log("Co loi ve bang/cot (thieu bang hoac thieu cot).", "err");
      if (loiTruyVan) log("Co truy van backend chay loi.", "err");
      process.exit(1);
    }
  } finally {
    if (pool) await pool.close();
  }
}

main();
