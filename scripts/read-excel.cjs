const XLSX = require("../backend/node_modules/xlsx");
const path = require("path");
const fs = require("fs");

const files = fs.readdirSync(path.join(__dirname, "..")).filter(f => f.startsWith("KITTING"));
const filePath = path.join(__dirname, "..", files[0]);
const wb = XLSX.readFile(filePath);

// ─── BOM sheet ───────────────────────────────────────────────────────────────
const bomWs = wb.Sheets["BOM"];
const bomData = XLSX.utils.sheet_to_json(bomWs, { defval: null });

// Lọc dòng có dữ liệu thật
const bomRows = bomData.filter(r => r["CODE TỔNG"] && r["CODE CON"]);
console.log(`\n=== BOM: ${bomRows.length} dòng thực tế ===`);
console.log("Headers:", Object.keys(bomRows[0] || {}));
console.log("Mẫu 10 dòng:");
bomRows.slice(0, 10).forEach((r, i) => console.log(`  ${i+1}:`, JSON.stringify(r)));

// Thống kê
const codeTongs = [...new Set(bomRows.map(r => r["CODE TỔNG"]))];
const codeCons  = [...new Set(bomRows.map(r => r["CODE CON"]))];
console.log(`\nCode tổng (unique): ${codeTongs.length}`);
console.log(`Code con  (unique): ${codeCons.length}`);
console.log("Mẫu code tổng:", codeTongs.slice(0, 5));

// Code con cũng là code tổng (multi-level)
const multiLevel = codeCons.filter(c => codeTongs.includes(c));
console.log(`\nCode vừa là tổng vừa là con (multi-level): ${multiLevel.length}`);
console.log("Mẫu:", multiLevel.slice(0, 5));

// Hệ số != 1
const hesoKhac1 = bomRows.filter(r => r["Hệ số"] && r["Hệ số"] !== 1);
console.log(`\nDòng có Hệ số ≠ 1: ${hesoKhac1.length}`);
hesoKhac1.slice(0, 5).forEach(r => console.log(`  ${r["CODE TỔNG"]} → ${r["CODE CON"]} (heso=${r["Hệ số"]})`));

// ─── IN BOM THƯỜNG sheet ─────────────────────────────────────────────────────
const inWs = wb.Sheets["IN BOM THƯỜNG"];
const inData = XLSX.utils.sheet_to_json(inWs, { header: 1, defval: "" });
console.log(`\n=== IN BOM THƯỜNG: tất cả ${inData.length} rows ===`);
inData.forEach((row, i) => {
  if (row.some(c => c !== "")) console.log(`  Row ${i}:`, JSON.stringify(row));
});
