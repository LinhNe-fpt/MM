/**
 * testApi.js — Kiểm tra toàn bộ API endpoints đã implement
 * Chạy: node scripts/testApi.js [--port 3001]
 *
 * Bao gồm:
 *   /api/health
 *   /api/auth/login
 *   /api/components  (GET, POST, PUT, DELETE)
 *   /api/bom         (GET, POST, PUT, DELETE)
 *   /api/users       (GET, GET/:id, POST, PUT, DELETE)
 *   /api/categories
 *   /api/warehouse/rows
 *   /api/warehouse/map
 *   /api/transactions
 */

const PORT = (() => {
  const i = process.argv.indexOf("--port");
  return i !== -1 ? parseInt(process.argv[i + 1]) : 3001;
})();
const BASE = `http://localhost:${PORT}`;

// ─── ANSI colours ─────────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m",
  bold:  "\x1b[1m",
  green: "\x1b[32m",
  red:   "\x1b[31m",
  yellow:"\x1b[33m",
  cyan:  "\x1b[36m",
  dim:   "\x1b[2m",
};

// ─── State ────────────────────────────────────────────────────────────────────
const results = { pass: 0, fail: 0, skip: 0 };
// IDs tạo trong lúc test — dùng để cleanup cuối
const created = { compCode: null, bomId: null, userId: null };

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function request(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${BASE}${path}`, opts);
    let json;
    try { json = await res.json(); } catch { json = null; }
    return { status: res.status, body: json, error: null };
  } catch (e) {
    return { status: 0, body: null, error: e.message || String(e) };
  }
}

function assertFetch(r, label) {
  if (r.status === 0) {
    fail(label, `fetch error: ${r.error}`);
    return false;
  }
  return true;
}

function pass(label, detail = "") {
  results.pass++;
  console.log(`  ${C.green}✓${C.reset} ${label}${detail ? C.dim + "  " + detail + C.reset : ""}`);
}

function fail(label, detail = "") {
  results.fail++;
  console.log(`  ${C.red}✗${C.reset} ${label}${detail ? C.dim + "  " + detail + C.reset : ""}`);
}

function skip(label) {
  results.skip++;
  console.log(`  ${C.yellow}–${C.reset} ${label} ${C.dim}(skipped)${C.reset}`);
}

function section(title) {
  console.log(`\n${C.bold}${C.cyan}▶ ${title}${C.reset}`);
}

function assert(ok, label, detail = "") {
  ok ? pass(label, detail) : fail(label, detail);
  return ok;
}

// ─── Test suites ──────────────────────────────────────────────────────────────

async function testHealth() {
  section("Health check");
  const { status, body } = await request("GET", "/api/health");
  assert(status === 200 && body?.ok === true, "GET /api/health → 200 ok");
}

async function testAuth() {
  section("Auth — /api/auth/login");

  // Đăng nhập đúng — mật khẩu admin lấy từ DB
  const ok = await request("POST", "/api/auth/login", { taiKhoan: "admin", matKhau: "1" });
  if (!assertFetch(ok, "POST /api/auth/login (admin) → 200")) return;
  assert(ok.status === 200 && ok.body?.user?.taiKhoan === "admin",
    "POST /api/auth/login (admin) → 200 user object",
    `quyen=${ok.body?.user?.quyen ?? "?"} | status=${ok.status}`);

  // Đăng nhập sai mật khẩu
  const bad = await request("POST", "/api/auth/login", { taiKhoan: "admin", matKhau: "wrong_password_xyz" });
  if (!assertFetch(bad, "POST /api/auth/login (sai mật khẩu) → 401")) return;
  assert(bad.status === 401, "POST /api/auth/login (sai mật khẩu) → 401");

  // Thiếu body
  const empty = await request("POST", "/api/auth/login", {});
  if (!assertFetch(empty, "POST /api/auth/login (thiếu body) → 400")) return;
  assert(empty.status === 400, "POST /api/auth/login (thiếu body) → 400");
}

async function testComponents() {
  section("Components — /api/components");

  // GET list
  const list = await request("GET", "/api/components");
  if (!assertFetch(list, "GET /api/components → 200 array")) return;
  assert(list.status === 200 && Array.isArray(list.body),
    "GET /api/components → 200 array",
    `${list.body?.length ?? "?"} bản ghi`);

  // GET search
  const search = await request("GET", "/api/components?q=test");
  if (assertFetch(search, "GET /api/components?q= → 200 array"))
    assert(search.status === 200 && Array.isArray(search.body), "GET /api/components?q=test → 200 array");

  // POST create (code duy nhất theo timestamp)
  const code = `TEST-${Date.now()}`;
  created.compCode = code;
  const create = await request("POST", "/api/components", {
    codeTong: code,
    moTa: "Test component tạo bởi testApi.js",
    cumVatLieu: "TEST-GROUP",
    heSo: 0.01,
    tonToiThieu: 5,
  });
  if (!assertFetch(create, "POST /api/components → 201")) return;
  const createdOk = assert(create.status === 201 && create.body?.ok === true,
    "POST /api/components → 201 ok", `codeTong=${code}`);

  // POST trùng code
  if (createdOk) {
    const dup = await request("POST", "/api/components", { codeTong: code });
    if (assertFetch(dup, "POST /api/components (trùng) → 409"))
      assert(dup.status === 409, "POST /api/components (trùng code) → 409");
  } else skip("POST /api/components (trùng code)");

  // POST thiếu code
  const noCode = await request("POST", "/api/components", { moTa: "no code" });
  if (assertFetch(noCode, "POST /api/components (thiếu codeTong) → 400"))
    assert(noCode.status === 400, "POST /api/components (thiếu codeTong) → 400");

  // PUT update
  if (createdOk) {
    const upd = await request("PUT", `/api/components/${code}`, {
      moTa: "Updated description",
      tonToiThieu: 10,
    });
    if (assertFetch(upd, "PUT /api/components/:code → 200"))
      assert(upd.status === 200 && upd.body?.ok === true, "PUT /api/components/:code → 200 ok");
  } else skip("PUT /api/components/:code");

  // PUT không tồn tại
  const notFound = await request("PUT", "/api/components/NOTEXIST-9999", { moTa: "x" });
  if (assertFetch(notFound, "PUT /api/components (không tồn tại) → 404"))
    assert(notFound.status === 404, "PUT /api/components/:code (không tồn tại) → 404");
}

async function testBom() {
  section("BOM — /api/bom");

  const assy = created.compCode;
  if (!assy) {
    ["GET /api/bom", "GET /api/bom (thiếu assy)", "POST /api/bom",
     "PUT /api/bom/:id", "PUT (không tồn tại)", "PUT (id không hợp lệ)"]
      .forEach(l => skip(l + " (cần test component pass trước)"));
    return;
  }

  // GET list
  const list = await request("GET", `/api/bom?assy=${encodeURIComponent(assy)}`);
  if (assertFetch(list, `GET /api/bom?assy=... → 200 array`))
    assert(list.status === 200 && Array.isArray(list.body),
      `GET /api/bom?assy=${assy} → 200 array`, `${list.body?.length ?? "?"} dòng`);

  // GET thiếu assy
  const noAssy = await request("GET", "/api/bom");
  if (assertFetch(noAssy, "GET /api/bom (thiếu assy) → 400"))
    assert(noAssy.status === 400, "GET /api/bom (thiếu assy) → 400");

  // POST tạo dòng BOM
  const create = await request("POST", "/api/bom", {
    maAssy: assy, stt: 1, code: "BOM-TEST-001",
    itemDescription: "Test BOM row", qtyPlan: 2, donVi: "pcs",
  });
  if (!assertFetch(create, "POST /api/bom → 201")) return;
  const createdBom = assert(create.status === 201 && create.body?.id > 0,
    "POST /api/bom → 201 ok", `id=${create.body?.id}`);
  if (createdBom) created.bomId = create.body.id;

  // POST assy không tồn tại
  const badAssy = await request("POST", "/api/bom", { maAssy: "NOTEXIST-9999", code: "X" });
  if (assertFetch(badAssy, "POST /api/bom (assy không tồn tại) → 404"))
    assert(badAssy.status === 404, "POST /api/bom (assy không tồn tại) → 404");

  // PUT update
  if (createdBom) {
    const upd = await request("PUT", `/api/bom/${created.bomId}`, { code: "BOM-TEST-UPD", qtyPlan: 5 });
    if (assertFetch(upd, "PUT /api/bom/:id → 200"))
      assert(upd.status === 200 && upd.body?.ok === true, "PUT /api/bom/:id → 200 ok");
  } else skip("PUT /api/bom/:id");

  // PUT id không tồn tại
  const notFound = await request("PUT", "/api/bom/999999999", { code: "X" });
  if (assertFetch(notFound, "PUT /api/bom (không tồn tại) → 404"))
    assert(notFound.status === 404, "PUT /api/bom/:id (không tồn tại) → 404");

  // PUT id không hợp lệ
  const badId = await request("PUT", "/api/bom/abc", { code: "X" });
  if (assertFetch(badId, "PUT /api/bom (id không hợp lệ) → 400"))
    assert(badId.status === 400, "PUT /api/bom/:id (id không hợp lệ) → 400");
}

async function testUsers() {
  section("Users — /api/users");

  // GET list
  const list = await request("GET", "/api/users");
  if (!assertFetch(list, "GET /api/users → 200 array")) return;
  assert(list.status === 200 && Array.isArray(list.body),
    "GET /api/users → 200 array", `${list.body?.length ?? "?"} tài khoản`);

  // Kiểm tra MatKhau không lộ ra ngoài
  if (Array.isArray(list.body) && list.body.length > 0) {
    assert(!list.body.some((u) => u.matKhau !== undefined),
      "GET /api/users không trả MatKhau trong response");
  } else skip("Kiểm tra MatKhau ẩn (danh sách trống)");

  // GET by id
  const byId = await request("GET", "/api/users/1");
  if (assertFetch(byId, "GET /api/users/1 → 200"))
    assert(byId.status === 200 && byId.body?.id === 1, "GET /api/users/1 → 200 user object");

  // GET id không tồn tại
  const notFound = await request("GET", "/api/users/999999");
  if (assertFetch(notFound, "GET /api/users (không tồn tại) → 404"))
    assert(notFound.status === 404, "GET /api/users/:id (không tồn tại) → 404");

  // POST tạo user mới
  const acc = `test_${Date.now()}`;
  const create = await request("POST", "/api/users", {
    taiKhoan: acc, matKhau: "test123", hoTen: "Test User", quyen: "staff",
  });
  if (!assertFetch(create, "POST /api/users → 201")) return;
  const createdUser = assert(create.status === 201 && create.body?.id > 0,
    "POST /api/users → 201 ok", `taiKhoan=${acc}`);
  if (createdUser) created.userId = create.body.id;

  // POST trùng tài khoản
  if (createdUser) {
    const dup = await request("POST", "/api/users", { taiKhoan: acc, matKhau: "x" });
    if (assertFetch(dup, "POST /api/users (trùng) → 409"))
      assert(dup.status === 409, "POST /api/users (trùng tài khoản) → 409");
  } else skip("POST /api/users (trùng tài khoản)");

  // POST thiếu tài khoản
  const noAcc = await request("POST", "/api/users", { matKhau: "x" });
  if (assertFetch(noAcc, "POST /api/users (thiếu taiKhoan) → 400"))
    assert(noAcc.status === 400, "POST /api/users (thiếu taiKhoan) → 400");

  // POST thiếu mật khẩu
  const noPwd = await request("POST", "/api/users", { taiKhoan: `x_${Date.now()}` });
  if (assertFetch(noPwd, "POST /api/users (thiếu matKhau) → 400"))
    assert(noPwd.status === 400, "POST /api/users (thiếu matKhau) → 400");

  // PUT sửa thông tin
  if (createdUser) {
    const upd = await request("PUT", `/api/users/${created.userId}`, {
      hoTen: "Test User Updated", quyen: "viewer",
    });
    if (assertFetch(upd, "PUT /api/users/:id → 200"))
      assert(upd.status === 200 && upd.body?.ok === true, "PUT /api/users/:id → 200 ok");

    // PUT đổi mật khẩu
    const pwd = await request("PUT", `/api/users/${created.userId}`, {
      hoTen: "Test User Updated", quyen: "viewer", matKhauMoi: "newpass456",
    });
    if (assertFetch(pwd, "PUT /api/users (đổi matKhauMoi) → 200"))
      assert(pwd.status === 200, "PUT /api/users/:id (đổi matKhauMoi) → 200");
  } else {
    skip("PUT /api/users/:id");
    skip("PUT /api/users/:id (đổi matKhauMoi)");
  }
}

async function testCategories() {
  section("Categories — /api/categories");

  const all = await request("GET", "/api/categories");
  if (!assertFetch(all, "GET /api/categories → 200")) return;
  assert(all.status === 200 && all.body?.IN !== undefined && all.body?.OUT !== undefined,
    "GET /api/categories → 200 { IN, OUT }",
    `IN: ${all.body?.IN?.length ?? "?"} · OUT: ${all.body?.OUT?.length ?? "?"}`);

  const inOnly = await request("GET", "/api/categories?type=IN");
  if (assertFetch(inOnly, "GET /api/categories?type=IN → 200"))
    assert(inOnly.status === 200, "GET /api/categories?type=IN → 200");

  const outOnly = await request("GET", "/api/categories?type=OUT");
  if (assertFetch(outOnly, "GET /api/categories?type=OUT → 200"))
    assert(outOnly.status === 200, "GET /api/categories?type=OUT → 200");
}

async function testWarehouse() {
  section("Warehouse — /api/warehouse");

  const rows = await request("GET", "/api/warehouse/rows");
  if (assertFetch(rows, "GET /api/warehouse/rows → 200"))
    assert(rows.status === 200 && Array.isArray(rows.body),
      "GET /api/warehouse/rows → 200 array", `${rows.body?.length ?? "?"} dãy`);

  const map = await request("GET", "/api/warehouse/map");
  if (assertFetch(map, "GET /api/warehouse/map → 200"))
    assert(map.status === 200 && Array.isArray(map.body),
      "GET /api/warehouse/map → 200 array", `${map.body?.length ?? "?"} dãy`);
}

async function testTransactions() {
  section("Transactions — /api/transactions");

  const list = await request("GET", "/api/transactions?limit=10");
  if (assertFetch(list, "GET /api/transactions → 200"))
    assert(list.status === 200 && Array.isArray(list.body),
      "GET /api/transactions?limit=10 → 200 array", `${list.body?.length ?? "?"} giao dịch`);
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup() {
  section("Cleanup — xóa dữ liệu test");

  if (created.bomId) {
    const r = await request("DELETE", `/api/bom/${created.bomId}`);
    if (assertFetch(r, `DELETE /api/bom/${created.bomId} → 200`))
      assert(r.status === 200, `DELETE /api/bom/${created.bomId} → 200`);
  } else skip("DELETE /api/bom/:id (không có bomId)");

  if (created.compCode) {
    const r = await request("DELETE", `/api/components/${created.compCode}`);
    if (assertFetch(r, `DELETE /api/components/${created.compCode} → 200`))
      assert(r.status === 200, `DELETE /api/components/${created.compCode} → 200`);
  } else skip("DELETE /api/components/:code (không có compCode)");

  if (created.userId) {
    const r = await request("DELETE", `/api/users/${created.userId}`);
    if (assertFetch(r, `DELETE /api/users/${created.userId} → 200`))
      assert(r.status === 200, `DELETE /api/users/${created.userId} → 200`);
  } else skip("DELETE /api/users/:id (không có userId)");

  const notFound = await request("DELETE", "/api/users/999999999");
  if (assertFetch(notFound, "DELETE /api/users (không tồn tại) → 404"))
    assert(notFound.status === 404, "DELETE /api/users/:id (không tồn tại) → 404");
}

// ─── Run all ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${C.bold}╔══════════════════════════════════════╗`);
  console.log(`║   API TEST — EMS Warehouse           ║`);
  console.log(`║   ${BASE.padEnd(36)}║`);
  console.log(`╚══════════════════════════════════════╝${C.reset}`);

  // Kiểm tra server có đang chạy không
  try {
    await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
  } catch {
    console.error(`\n${C.red}✗ Không kết nối được server tại ${BASE}${C.reset}`);
    console.error(`  Hãy chạy: cd backend && npm start\n`);
    process.exit(1);
  }

  await testHealth();
  await testAuth();
  await testComponents();
  await testBom();
  await testUsers();
  await testCategories();
  await testWarehouse();
  await testTransactions();
  await cleanup();

  // ─── Summary ───────────────────────────────────────────────────────────────
  const total = results.pass + results.fail + results.skip;
  const allPass = results.fail === 0;
  console.log(`\n${C.bold}${"─".repeat(42)}${C.reset}`);
  console.log(`${C.bold}  KẾT QUẢ: ${results.pass}/${total} test case`);
  if (results.fail > 0) console.log(`  ${C.red}FAIL: ${results.fail}${C.reset}`);
  if (results.skip > 0) console.log(`  ${C.yellow}SKIP: ${results.skip}${C.reset}`);
  console.log(`${C.bold}${"─".repeat(42)}${C.reset}`);
  console.log(allPass
    ? `${C.green}${C.bold}  ✓ Tất cả test đều PASS${C.reset}\n`
    : `${C.red}${C.bold}  ✗ Có ${results.fail} test FAIL — kiểm tra output ở trên${C.reset}\n`
  );

  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(`\n${C.red}Lỗi không mong muốn:${C.reset}`, err.message || err);
  process.exit(1);
});
