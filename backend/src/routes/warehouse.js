const { Router } = require("express");
const { getPool } = require("../db");
const sql = require("mssql");

const router = Router();

// Hàm sắp xếp theo thứ tự tự nhiên (natural sort): A1, A2, A10 thay vì A1, A10, A2
function naturalSort(a, b) {
  const aLabel = String(a.label);
  const bLabel = String(b.label);
  return aLabel.localeCompare(bLabel, undefined, { numeric: true, sensitivity: "base" });
}

// Hàm sắp xếp bin (thùng) theo thứ tự tự nhiên
function naturalSortBins(bins) {
  return bins.sort((a, b) => {
    const aLabel = String(a.label);
    const bLabel = String(b.label);
    return aLabel.localeCompare(bLabel, undefined, { numeric: true, sensitivity: "base" });
  });
}

// GET /api/warehouse/rows - Danh sach day (Rack) va vi tri (ViTriKho), nhom theo Rack
async function getRows(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT MaViTri, Rack, Tang, Thung
      FROM ViTriKho
      ORDER BY Rack, CAST(Tang AS INT), CAST(Thung AS INT), MaViTri
    `);
    const byDay = new Map();
    for (const r of result.recordset) {
      const key = r.Rack;
      if (!byDay.has(key)) {
        byDay.set(key, { id: "row-" + key, label: key, bins: [] });
      }
      const binLabel = `${r.Rack}-${r.Tang}-${r.Thung}`;
      byDay.get(key).bins.push({
        id: "b" + r.MaViTri,
        row: key,
        slot: binLabel,
        label: binLabel,
        components: [],
        fillPercent: 0,
        status: "ok",
      });
    }
    const rowList = Array.from(byDay.values()).sort(naturalSort);
    res.json(rowList);
  } catch (err) {
    console.error("GET /api/warehouse/rows:", err.message || err);
    res.status(500).json({
      error: "Loi khi lay danh sach day",
      detail: process.env.NODE_ENV !== "production" ? (err.message || String(err)) : undefined,
    });
  }
}

// Parse "M3-1" → { rack:"M", tang:"3", thung:"1" }
function parseViTriText(vt) {
  if (!vt) return null;
  const m = String(vt).trim().match(/^([A-Za-z]+)(\d+)-(\d+)$/);
  if (!m) return null;
  return { rack: m[1].toUpperCase(), tang: m[2], thung: m[3] };
}

// GET /api/warehouse/map - Đọc từ Parts.ViTriText (nguồn chính) + TonKhoChiTiet
async function getWarehouseMap(req, res) {
  try {
    const pool = await getPool();

    // Lấy tất cả parts có ViTriText + tồn kho đầy đủ
    const result = await pool.request().query(`
      SELECT
        p.Code, p.MoTa, p.Model, p.CumVatLieu, p.TonToiThieu, p.ViTriText,
        ISNULL(t.SoLuongTon,    0)    AS quantity,
        t.TonCuoiCaNgay,
        t.TonThucTe,
        t.MaViTri
      FROM Parts p
      LEFT JOIN TonKhoChiTiet t ON t.MaLinhKien = p.Code
      WHERE p.DangHoatDong = 1
        AND p.ViTriText IS NOT NULL
        AND p.ViTriText != ''
      ORDER BY p.ViTriText, p.Code
    `);

    const byRack = new Map();

    for (const row of result.recordset) {
      const loc = parseViTriText(row.ViTriText);
      if (!loc) continue;

      const { rack, tang, thung } = loc;

      if (!byRack.has(rack)) {
        byRack.set(rack, { id: "row-" + rack, label: rack, tiers: new Map() });
      }
      const rackData = byRack.get(rack);

      const tierNum = parseInt(tang) || 1;
      const tierKey = `tier-${tierNum}`;
      if (!rackData.tiers.has(tierKey)) {
        rackData.tiers.set(tierKey, { id: tierKey, tierNum, label: `Tầng ${tierNum}`, bins: [] });
      }
      const tierData = rackData.tiers.get(tierKey);

      const binId  = `vt-${row.ViTriText}`;
      let bin = tierData.bins.find(b => b.id === binId);
      if (!bin) {
        bin = {
          id: binId,
          maViTri: row.MaViTri ?? null,
          row: rack,
          tier: tierNum,
          thung,
          slot: row.ViTriText,
          label: row.ViTriText,
          components: [],
          fillPercent: 0,
          status: "ok",
        };
        tierData.bins.push(bin);
      }

      const minStock    = row.TonToiThieu != null ? Number(row.TonToiThieu) : 0;
      const qty         = Number(row.quantity) || 0;
      const caNgay      = row.TonCuoiCaNgay != null ? Math.round(Number(row.TonCuoiCaNgay)) : null;
      const thucTe      = row.TonThucTe     != null ? Math.round(Number(row.TonThucTe))     : null;
      const lech        = thucTe != null ? thucTe - qty : 0;

      const status = qty === 0 ? "critical" : qty < minStock ? "low" : "ok";

      bin.components.push({
        id:            row.Code,
        partNumber:    row.Code,
        name:          row.MoTa || row.CumVatLieu || null,
        model:         row.Model || null,
        quantity:      qty,
        tonCuoiCaNgay: caNgay,
        tonThucTe:     thucTe,
        lech:          Math.abs(lech) > 0 ? lech : null,
        minStock,
        viTriText:     row.ViTriText,
        unit:          "pcs",
      });

      const fillRatio = minStock > 0
        ? Math.min(100, (qty / minStock) * 100)
        : qty > 0 ? 100 : 0;
      bin.fillPercent = Math.max(bin.fillPercent, fillRatio);
      if (status !== "ok") bin.status = status;
    }

    const list = Array.from(byRack.values()).sort(naturalSort).map(rack => ({
      ...rack,
      tiers: Array.from(rack.tiers.values())
        .sort((a, b) => a.tierNum - b.tierNum)
        .map(tier => ({ ...tier, bins: naturalSortBins(tier.bins) })),
    }));

    res.json(list);
  } catch (err) {
    console.error("GET /api/warehouse/map:", err.message || err);
    res.status(500).json({
      error: "Loi khi lay so do kho",
      detail: process.env.NODE_ENV !== "production" ? (err.message || String(err)) : undefined,
    });
  }
}

// PATCH /api/warehouse/bin/ton-thuc-te — Ghi nhận kiểm kê tồn thực tế theo ô (MaViTri + từng mã)
router.patch("/bin/ton-thuc-te", async (req, res) => {
  try {
    const maViTri = req.body?.maViTri;
    const updates = req.body?.updates;
    if (maViTri == null || Number.isNaN(Number(maViTri))) {
      return res.status(400).json({ error: "Thiếu hoặc sai maViTri" });
    }
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: "Thiếu danh sách updates" });
    }
    const pool = await getPool();
    const mvt = Number(maViTri);

    for (const u of updates) {
      const code = String(u.maLinhKien ?? u.partNumber ?? "").trim();
      if (!code) continue;
      const raw = u.tonThucTe;
      let val = null;
      if (raw !== null && raw !== undefined && String(raw).trim() !== "") {
        const n = Number(raw);
        if (Number.isNaN(n) || n < 0) {
          return res.status(400).json({ error: `tonThucTe không hợp lệ cho mã ${code}` });
        }
        val = Math.round(n);
      }

      let r;
      if (val === null) {
        r = await pool
          .request()
          .input("MaViTri", sql.Int, mvt)
          .input("MaLinhKien", sql.NVarChar(50), code)
          .query(`
            UPDATE TonKhoChiTiet SET TonThucTe = NULL
            WHERE MaViTri = @MaViTri AND LTRIM(RTRIM(MaLinhKien)) = LTRIM(RTRIM(@MaLinhKien))
          `);
      } else {
        r = await pool
          .request()
          .input("MaViTri", sql.Int, mvt)
          .input("MaLinhKien", sql.NVarChar(50), code)
          .input("TonThucTe", sql.Int, val)
          .query(`
            UPDATE TonKhoChiTiet SET TonThucTe = @TonThucTe
            WHERE MaViTri = @MaViTri AND LTRIM(RTRIM(MaLinhKien)) = LTRIM(RTRIM(@MaLinhKien))
          `);
      }
      if (r.rowsAffected[0] === 0) {
        return res.status(404).json({
          error: `Không có dòng tồn kho cho ${code} tại vị trí MaViTri=${mvt}`,
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/warehouse/bin/ton-thuc-te:", err.message || err);
    res.status(500).json({ error: "Lỗi khi cập nhật kiểm kê" });
  }
});

router.get("/rows", getRows);
router.get("/map", getWarehouseMap);

module.exports = router;
