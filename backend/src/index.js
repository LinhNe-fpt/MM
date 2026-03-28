require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const warehouseRoutes = require("./routes/warehouse");
const componentsRoutes = require("./routes/components");
const transactionsRoutes = require("./routes/transactions");
const authRoutes = require("./routes/auth");
const categoriesRoutes = require("./routes/categories");
const bomRoutes    = require("./routes/bom");
const bomNewRoutes = require("./routes/bomNew");
const partsRoutes  = require("./routes/parts");
const usersRoutes  = require("./routes/users");
const shiftsRoutes      = require("./routes/shifts");
const importExcelRoutes  = require("./routes/importExcel");
const importBaoCaoRoutes = require("./routes/importBaoCao");
const rmaUpkRoutes = require("./routes/rmaUpk");
const khsxRoutes = require("./routes/khsx");
const catalogBoPhanVaiTroRoutes = require("./routes/catalogBoPhanVaiTro");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true }));
app.use(express.json({ limit: "20mb" }));
app.use(
  "/api/uploads",
  express.static(path.join(__dirname, "../uploads"), {
    fallthrough: false,
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=86400");
    },
  }),
);

app.use("/api/auth", authRoutes);
app.use("/api/warehouse", warehouseRoutes);
app.use("/api/components", componentsRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/bom", bomRoutes);
app.use("/api/parts",    partsRoutes);   // Parts master (schema mới)
app.use("/api/bom-new",  bomNewRoutes);  // BOM mới từ Excel
app.use("/api/users", usersRoutes);
app.use("/api/shifts", shiftsRoutes);
app.use("/api/import-excel", importExcelRoutes);
app.use("/api/import-excel", importBaoCaoRoutes);
app.use("/api/rma-upk", rmaUpkRoutes);
app.use("/api/khsx", khsxRoutes);
app.use("/api/catalog", catalogBoPhanVaiTroRoutes);

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "EMS Warehouse API" });
});

app.listen(PORT, "0.0.0.0", () => {
  const { networkInterfaces } = require("os");
  const nets = networkInterfaces();
  const lanIps = Object.values(nets)
    .flat()
    .filter((n) => n.family === "IPv4" && !n.internal)
    .map((n) => `  http://${n.address}:${PORT}`);
  console.log(`EMS Warehouse API chay tai:`);
  console.log(`  http://localhost:${PORT}`);
  lanIps.forEach((ip) => console.log(ip));
});
