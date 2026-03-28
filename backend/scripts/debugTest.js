require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { getPool } = require("../src/db");
const sql = require("mssql");

async function main() {
  const pool = await getPool();

  // 1. MaNguoiDung có IDENTITY không?
  const ident = await pool.request().query(
    "SELECT COLUMNPROPERTY(OBJECT_ID('NguoiDung'), 'MaNguoiDung', 'IsIdentity') AS IsIdentity"
  );
  console.log("MaNguoiDung IsIdentity:", ident.recordset[0].IsIdentity);

  // 2. Thử tạo user qua API
  const r1 = await fetch("http://localhost:3001/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taiKhoan: "dbg_test_" + Date.now(), matKhau: "x", hoTen: "Debug", quyen: "staff" }),
  });
  const b1 = await r1.json();
  console.log("POST /api/users →", r1.status, JSON.stringify(b1));
  if (b1.id) {
    await pool.request().input("id", sql.Int, b1.id).query("DELETE FROM NguoiDung WHERE MaNguoiDung=@id");
    console.log("  Cleaned up test user id", b1.id);
  }

  // 3. Thử DELETE component không tồn tại
  const r2 = await fetch("http://localhost:3001/api/components/NOTEXIST-XYZ", { method: "DELETE" });
  const b2 = await r2.json().catch(() => null);
  console.log("DELETE /api/components/NOTEXIST →", r2.status, JSON.stringify(b2));

  // 4. Thử DELETE user không tồn tại
  const r3 = await fetch("http://localhost:3001/api/users/999999999", { method: "DELETE" });
  const b3 = await r3.json().catch(() => null);
  console.log("DELETE /api/users/999999999 →", r3.status, JSON.stringify(b3));

  process.exit(0);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
