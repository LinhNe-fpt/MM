require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const sql = require("mssql");

async function main() {
  const pool = await sql.connect({
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || "1433"),
    options: { encrypt: false, trustServerCertificate: true },
  });

  // Check if db_owner
  const r1 = await pool.request().query("SELECT IS_MEMBER('db_owner') AS IsOwner, USER_NAME() AS UserName, IS_SRVROLEMEMBER('sysadmin') AS IsSA");
  console.log("User info:", r1.recordset[0]);

  // Check permissions granted
  const r2 = await pool.request().query(
    "SELECT permission_name, state_desc, OBJECT_NAME(major_id) AS obj " +
    "FROM sys.database_permissions " +
    "WHERE grantee_principal_id = USER_ID('ysv') " +
    "AND OBJECT_NAME(major_id) IN ('LinhKien','NguoiDung','ChiTietLinhKien')"
  );
  console.log("\nPermissions for ysv:");
  r2.recordset.forEach(r => console.log(" ", r.state_desc, r.permission_name, "ON", r.obj));

  // Try INSERT directly
  try {
    await pool.request().query("INSERT INTO NguoiDung (TaiKhoan,MatKhau,HoTen,Quyen) VALUES ('__permtest__','x','x','staff')");
    console.log("\nDirect INSERT into NguoiDung: OK");
    await pool.request().query("DELETE FROM NguoiDung WHERE TaiKhoan='__permtest__'");
  } catch (e) {
    console.log("\nDirect INSERT into NguoiDung FAILED:", e.message);
  }

  // Try DELETE directly
  try {
    const res = await pool.request().query("DELETE FROM LinhKien WHERE CodeTong='__notexist__'");
    console.log("Direct DELETE from LinhKien: OK (rows:", res.rowsAffected[0], ")");
  } catch (e) {
    console.log("Direct DELETE from LinhKien FAILED:", e.message);
  }

  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
