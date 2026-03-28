/**
 * Copy thu muc dist (build frontend) vao XAMPP htdocs de chia se qua Apache.
 * Mac dinh: C:\xampp\htdocs\mm (Windows) hoac /opt/lampp/htdocs/mm (Linux).
 * Dat bien moi truong XAMPP_HTDOCS de doi duong dan.
 *
 * - Chay tu dong sau build khi COPY_TO_XAMPP=1 (npm run build:xampp).
 * - Hoac chay thu cong: node scripts/copy-to-xampp.js (can co thu muc dist).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "..", "dist");
const DEFAULT_HTDOCS_WIN = "C:\\xampp\\htdocs\\mm";
const DEFAULT_HTDOCS_LINUX = "/opt/lampp/htdocs/mm";

const isWin = process.platform === "win32";
const targetDir = process.env.XAMPP_HTDOCS || (isWin ? DEFAULT_HTDOCS_WIN : DEFAULT_HTDOCS_LINUX);

// Khi chay tu postbuild: chi copy neu COPY_TO_XAMPP=1 (build:xampp da set)
const fromPostbuild = process.env.npm_lifecycle_event === "postbuild";
if (fromPostbuild && process.env.COPY_TO_XAMPP !== "1") {
  process.exit(0);
}

if (!fs.existsSync(DIST)) {
  if (fromPostbuild) process.exit(0);
  console.error("Khong thay thu muc dist. Chay 'npm run build' hoac 'npm run build:xampp' truoc.");
  process.exit(1);
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) {
      copyRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

try {
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true });
  }
  copyRecursive(DIST, targetDir);
  console.log("Da copy build vao:", targetDir);
  console.log("Mo trinh duyet: http://localhost/mm/ (neu Apache chay o port 80)");
} catch (err) {
  console.error("Loi khi copy:", err.message);
  process.exit(1);
}
