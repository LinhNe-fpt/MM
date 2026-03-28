/**
 * Build cho XAMPP: base /mm/ roi tu dong copy dist vao htdocs.
 * Chay: npm run build:xampp
 */
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

process.env.COPY_TO_XAMPP = "1";
execSync("npx vite build --base /mm/", {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, COPY_TO_XAMPP: "1" },
});

await import("./copy-to-xampp.js");
