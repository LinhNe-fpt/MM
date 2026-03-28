/**
 * inspectDb.js — Liệt kê toàn bộ schema DB: bảng, cột, FK, trigger, số dòng
 * Chạy: node scripts/inspectDb.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { getPool } = require("../src/db");
const sql = require("mssql");

function line(char = "─", len = 60) {
  return char.repeat(len);
}

async function main() {
  console.log("\n" + line("═"));
  console.log("  DB INSPECTOR — EMS Warehouse");
  console.log(line("═"));

  const pool = await getPool();

  // ────────────────────────────────────────────────
  // 1. Danh sách bảng + số dòng
  // ────────────────────────────────────────────────
  const tables = await pool.request().query(`
    SELECT
      t.name                          AS TABLE_NAME,
      SUM(p.rows)                     AS ROW_COUNT,
      SUM(a.total_pages) * 8          AS SIZE_KB
    FROM sys.tables t
    JOIN sys.indexes      i  ON t.object_id = i.object_id  AND i.index_id <= 1
    JOIN sys.partitions   p  ON i.object_id = p.object_id  AND i.index_id  = p.index_id
    JOIN sys.allocation_units a ON p.partition_id = a.container_id
    GROUP BY t.name
    ORDER BY t.name
  `);

  console.log(`\n  BẢNG (${tables.recordset.length} bảng)\n`);
  console.log(
    "  " +
    "TABLE_NAME".padEnd(30) +
    "SỐ DÒNG".padStart(12) +
    "SIZE (KB)".padStart(12)
  );
  console.log("  " + line("─", 54));
  for (const r of tables.recordset) {
    console.log(
      "  " +
      r.TABLE_NAME.padEnd(30) +
      String(r.ROW_COUNT).padStart(12) +
      String(r.SIZE_KB).padStart(12)
    );
  }

  // ────────────────────────────────────────────────
  // 2. Chi tiết cột từng bảng
  // ────────────────────────────────────────────────
  console.log("\n" + line("═"));
  console.log("  CHI TIẾT CỘT TỪNG BẢNG");
  console.log(line("═"));

  for (const { TABLE_NAME } of tables.recordset) {
    const req = pool.request();
    req.input("tbl", sql.NVarChar(128), TABLE_NAME);
    const cols = await req.query(`
      SELECT
        c.ORDINAL_POSITION                                          AS ORD,
        c.COLUMN_NAME                                               AS COL,
        c.DATA_TYPE +
          CASE
            WHEN c.CHARACTER_MAXIMUM_LENGTH IS NOT NULL
              THEN '(' + CAST(c.CHARACTER_MAXIMUM_LENGTH AS VARCHAR) + ')'
            WHEN c.NUMERIC_PRECISION IS NOT NULL AND c.DATA_TYPE IN ('decimal','numeric')
              THEN '(' + CAST(c.NUMERIC_PRECISION AS VARCHAR) + ',' + CAST(c.NUMERIC_SCALE AS VARCHAR) + ')'
            ELSE ''
          END                                                       AS TYPE_FULL,
        c.IS_NULLABLE                                               AS NULLABLE,
        ISNULL(c.COLUMN_DEFAULT, '')                                AS DEF_VAL,
        CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'PK' ELSE '' END AS PK_FLAG,
        CASE WHEN fk.FK_COL    IS NOT NULL THEN 'FK→' + fk.REF_TABLE + '.' + fk.REF_COL
             ELSE '' END                                            AS FK_INFO
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN (
        SELECT ku.TABLE_NAME, ku.COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
          ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME AND tc.TABLE_NAME = ku.TABLE_NAME
        WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
      ) pk ON pk.TABLE_NAME = c.TABLE_NAME AND pk.COLUMN_NAME = c.COLUMN_NAME
      LEFT JOIN (
        SELECT
          ku.TABLE_NAME,
          ku.COLUMN_NAME    AS FK_COL,
          ccu.TABLE_NAME    AS REF_TABLE,
          ccu.COLUMN_NAME   AS REF_COL
        FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
          ON rc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
        JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
          ON rc.UNIQUE_CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
      ) fk ON fk.TABLE_NAME = c.TABLE_NAME AND fk.FK_COL = c.COLUMN_NAME
      WHERE c.TABLE_NAME = @tbl
      ORDER BY c.ORDINAL_POSITION
    `);

    // Số dòng
    const cnt = await pool.request().query(`SELECT COUNT(*) AS N FROM [${TABLE_NAME}]`);
    const rowCount = cnt.recordset[0].N;

    console.log(`\n┌─ ${TABLE_NAME}  (${rowCount} dòng)`);
    console.log(
      "│  " +
      "#".padEnd(4) +
      "CỘT".padEnd(26) +
      "KIỂU".padEnd(22) +
      "NULL?".padEnd(7) +
      "PK".padEnd(4) +
      "FK / MẶC ĐỊNH"
    );
    console.log("│  " + line("─", 80));

    for (const col of cols.recordset) {
      const flags = [col.PK_FLAG, col.FK_INFO, col.DEF_VAL].filter(Boolean).join("  ");
      console.log(
        "│  " +
        String(col.ORD).padEnd(4) +
        col.COL.padEnd(26) +
        col.TYPE_FULL.padEnd(22) +
        col.NULLABLE.padEnd(7) +
        col.PK_FLAG.padEnd(4) +
        (col.FK_INFO || (col.DEF_VAL ? "DEFAULT: " + col.DEF_VAL : ""))
      );
    }
    console.log("└" + line("─", 84));
  }

  // ────────────────────────────────────────────────
  // 3. Tất cả Foreign Keys (tổng hợp)
  // ────────────────────────────────────────────────
  const fks = await pool.request().query(`
    SELECT
      fk.name             AS FK_NAME,
      tp.name             AS PARENT_TABLE,
      cp.name             AS PARENT_COL,
      tr.name             AS REF_TABLE,
      cr.name             AS REF_COL,
      fk.delete_referential_action_desc AS ON_DELETE,
      fk.update_referential_action_desc AS ON_UPDATE
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
    JOIN sys.tables  tp ON fkc.parent_object_id      = tp.object_id
    JOIN sys.columns cp ON fkc.parent_object_id      = cp.object_id AND fkc.parent_column_id      = cp.column_id
    JOIN sys.tables  tr ON fkc.referenced_object_id  = tr.object_id
    JOIN sys.columns cr ON fkc.referenced_object_id  = cr.object_id AND fkc.referenced_column_id  = cr.column_id
    ORDER BY tp.name, fk.name
  `);

  console.log("\n" + line("═"));
  console.log(`  FOREIGN KEYS (${fks.recordset.length} FK)`);
  console.log(line("═"));
  for (const r of fks.recordset) {
    console.log(
      `  ${r.PARENT_TABLE}.${r.PARENT_COL}`.padEnd(45) +
      `→  ${r.REF_TABLE}.${r.REF_COL}`.padEnd(35) +
      `DEL:${r.ON_DELETE}  UPD:${r.ON_UPDATE}`
    );
  }

  // ────────────────────────────────────────────────
  // 4. Triggers
  // ────────────────────────────────────────────────
  const trigs = await pool.request().query(`
    SELECT
      OBJECT_NAME(parent_id) AS TABLE_NAME,
      name                   AS TRIGGER_NAME,
      type_desc,
      is_disabled
    FROM sys.triggers
    WHERE is_ms_shipped = 0
    ORDER BY OBJECT_NAME(parent_id), name
  `);

  console.log("\n" + line("═"));
  console.log(`  TRIGGERS (${trigs.recordset.length})`);
  console.log(line("═"));
  if (trigs.recordset.length === 0) {
    console.log("  (Không có trigger)");
  } else {
    for (const r of trigs.recordset) {
      const status = r.is_disabled ? "[DISABLED]" : "[ENABLED] ";
      console.log(`  ${status}  ${r.TABLE_NAME}.${r.TRIGGER_NAME}  (${r.type_desc})`);
    }
  }

  // ────────────────────────────────────────────────
  // 5. Stored procedures / views (nếu có)
  // ────────────────────────────────────────────────
  const procs = await pool.request().query(`
    SELECT name, type_desc
    FROM sys.objects
    WHERE type IN ('P','V','FN','IF','TF')
      AND is_ms_shipped = 0
    ORDER BY type, name
  `);

  if (procs.recordset.length > 0) {
    console.log("\n" + line("═"));
    console.log(`  STORED PROCS / VIEWS / FUNCTIONS (${procs.recordset.length})`);
    console.log(line("═"));
    for (const r of procs.recordset) {
      console.log(`  [${r.type_desc.padEnd(25)}]  ${r.name}`);
    }
  }

  // ────────────────────────────────────────────────
  // 6. Indexes
  // ────────────────────────────────────────────────
  const idxs = await pool.request().query(`
    SELECT
      t.name  AS TABLE_NAME,
      i.name  AS INDEX_NAME,
      i.type_desc,
      i.is_unique,
      i.is_primary_key,
      STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS COLUMNS
    FROM sys.indexes i
    JOIN sys.tables t ON i.object_id = t.object_id
    JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE i.name IS NOT NULL AND t.is_ms_shipped = 0
    GROUP BY t.name, i.name, i.type_desc, i.is_unique, i.is_primary_key
    ORDER BY t.name, i.is_primary_key DESC, i.name
  `);

  console.log("\n" + line("═"));
  console.log(`  INDEXES (${idxs.recordset.length})`);
  console.log(line("═"));
  for (const r of idxs.recordset) {
    const flags = [
      r.is_primary_key ? "PK" : null,
      r.is_unique ? "UNIQUE" : null,
      r.type_desc,
    ].filter(Boolean).join(", ");
    console.log(
      `  ${r.TABLE_NAME.padEnd(28)} ${r.INDEX_NAME.padEnd(36)} [${flags}]  (${r.COLUMNS})`
    );
  }

  console.log("\n" + line("═"));
  console.log("  HOÀN TẤT");
  console.log(line("═") + "\n");

  process.exit(0);
}

main().catch((e) => {
  console.error("\n[LỖI]", e.message || e);
  process.exit(1);
});
