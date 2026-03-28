const sql = require("mssql");

const config = {
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_DATABASE || "MM_DB",
  user: process.env.DB_USER || "ysv",
  password: process.env.DB_PASSWORD || "123",
  port: parseInt(process.env.DB_PORT || "1433", 10),
  options: {
    encrypt: process.env.NODE_ENV === "production",
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

let pool = null;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(config);
  }
  return pool;
}

async function closePool() {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

module.exports = { getPool, closePool };
