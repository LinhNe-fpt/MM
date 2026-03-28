/**
 * grantPermissions.js — Cấp quyền đầy đủ cho DB user 'ysv' trên MM_DB
 *
 * Cách dùng:
 *   node scripts/grantPermissions.js              (dùng SA với Windows Auth)
 *   DB_SA_PASS=<sa_pass> node scripts/grantPermissions.js  (dùng SA account)
 *
 * Hoặc mở SSMS và chạy file: backend/scripts/grantPermissionsSQL.sql
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const sql = require("mssql");

const TARGET_USER = process.env.DB_USER || "ysv";

const GRANTS = [
  `GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.LinhKien TO [${TARGET_USER}]`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.ChiTietLinhKien TO [${TARGET_USER}]`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.NguoiDung TO [${TARGET_USER}]`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.ViTriKho TO [${TARGET_USER}]`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.TonKhoChiTiet TO [${TARGET_USER}]`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.PhieuKho TO [${TARGET_USER}]`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.ChiTietPhieuKho TO [${TARGET_USER}]`,
];

async function main() {
  const useSA = process.env.DB_SA_PASS !== undefined;

  let config;
  if (useSA) {
    // SQL auth bằng SA
    config = {
      server: process.env.DB_SERVER || "localhost",
      database: process.env.DB_DATABASE || "MM_DB",
      user: "sa",
      password: process.env.DB_SA_PASS,
      port: parseInt(process.env.DB_PORT || "1433"),
      options: { encrypt: false, trustServerCertificate: true },
    };
    console.log("Đang kết nối bằng SA (SQL auth)...");
  } else {
    // Thử Windows Authentication (trusted connection)
    config = {
      server: process.env.DB_SERVER || "localhost",
      database: process.env.DB_DATABASE || "MM_DB",
      options: { encrypt: false, trustServerCertificate: true, trustedConnection: true },
    };
    console.log("Đang kết nối bằng Windows Authentication...");
  }

  let pool;
  try {
    pool = await sql.connect(config);
    const userInfo = await pool.request().query("SELECT USER_NAME() AS u, IS_MEMBER('db_owner') AS o");
    console.log(`Đã kết nối: user=${userInfo.recordset[0].u}, db_owner=${userInfo.recordset[0].o}`);
  } catch (e) {
    console.error("Kết nối thất bại:", e.message);
    console.log("\nGiải pháp thay thế:");
    console.log("  1. Mở SSMS bằng tài khoản SA hoặc Windows Admin");
    console.log("  2. Chạy file: backend/scripts/grantPermissionsSQL.sql");
    console.log("  3. Hoặc chạy lại với: DB_SA_PASS=<pass> node scripts/grantPermissions.js");
    process.exit(1);
  }

  console.log(`\nCấp quyền cho [${TARGET_USER}] trên ${process.env.DB_DATABASE}...\n`);

  let ok = 0, fail = 0;
  for (const stmt of GRANTS) {
    try {
      await pool.request().query(stmt);
      console.log(`  ✓ ${stmt}`);
      ok++;
    } catch (e) {
      console.log(`  ✗ ${stmt}`);
      console.log(`    → ${e.message}`);
      fail++;
    }
  }

  console.log(`\nKết quả: ${ok} OK, ${fail} lỗi`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
