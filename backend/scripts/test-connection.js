/**
 * Script test ket noi SQL Server
 * Chay: node scripts/test-connection.js
 * Hoac: cd backend && node scripts/test-connection.js
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

async function testConnection() {
  console.log("Dang ket noi SQL Server...");
  console.log("  Server:", config.server);
  console.log("  Database:", config.database);
  console.log("  User:", config.user);
  console.log("  Port:", config.port);
  console.log("");

  try {
    const pool = await sql.connect(config);
    console.log(">>> Ket noi thanh cong!\n");

    const result = await pool.request().query("SELECT @@VERSION AS version");
    console.log("SQL Server version:");
    console.log(result.recordset[0].version);
    console.log("");

    const dbResult = await pool.request().query("SELECT DB_NAME() AS currentDb");
    console.log("Database hien tai:", dbResult.recordset[0].currentDb);

    await pool.close();
    process.exit(0);
  } catch (err) {
    console.error(">>> Ket noi that bai!\n");
    console.error("Loi:", err.message);
    if (err.code) console.error("Ma loi:", err.code);
    process.exit(1);
  }
}

testConnection();
