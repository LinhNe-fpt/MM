-- ============================================================================
-- UPDATE BACKEND WAREHOUSE API (warehouse.js)
-- Giải thích: Thay vì query từ LinhKien.Rack/Tang/Thung,
-- lấy dữ liệu từ LinhKien.MaViTri → ViTriKho
-- ============================================================================

-- OLD QUERY (Trước Normalization):
--
-- SELECT v.MaViTri, v.TenDay, v.TenThung, v.TrangThai,
--        t.MaLinhKien, t.SoLuongTon AS quantity,
--        l.MoTa AS part_name, l.TonToiThieu AS min_stock, l.Rack, l.Tang, l.Thung
-- FROM ViTriKho v
-- LEFT JOIN TonKhoChiTiet t ON t.MaViTri = v.MaViTri
-- LEFT JOIN LinhKien l ON l.ASSY = t.MaLinhKien
--
-- ISSUE: 
--   - t.MaLinhKien có thể ở nhiều MaViTri (inconsistency)
--   - l.Rack, l.Tang, l.Thung bị redundant với v.TenDay, v.Tang, v.ViTriO
--   - Khó maintain khi update vị trí

-- NEW QUERY (Sau Normalization):
--
-- SELECT v.MaViTri, v.TenDay, v.TenThung, v.TrangThai,
--        l.ASSY, (l.MoTa) AS part_name, l.TonToiThieu AS min_stock,
--        ISNULL(t.SoLuongTon, 0) AS quantity, v.Tang, v.ViTriO
-- FROM ViTriKho v
-- LEFT JOIN LinhKien l ON l.MaViTri = v.MaViTri
-- LEFT JOIN TonKhoChiTiet t ON t.MaLinhKien = l.ASSY AND t.MaViTri = v.MaViTri
-- ORDER BY v.TenDay, v.Tang, v.ViTriO, l.ASSY
--
-- BENEFIT:
--   - ViTriKho là master (source of truth)
--   - LinhKien.MaViTri là primary location
--   - Single vị trí per ASSY
--   - Clean, maintainable

-- ============================================================================
-- MIGRATION CHECKLIST:
-- ============================================================================

-- ✅ Step 1: Backup current warehouse.js
--   - cp backend/src/routes/warehouse.js backend/src/routes/warehouse.js.backup

-- ✅ Step 2: Update Query in getWarehouseMap()
--   - Change FROM ViTriKho v LEFT JOIN LinhKien l ...
--   - To: FROM ViTriKho v LEFT JOIN LinhKien l ON l.MaViTri = v.MaViTri

-- ✅ Step 3: Update data mapping (group by logic)
--   - OLD: Group by v.TenDay (from ViTriKho)
--   - NEW: Group by v.TenDay (still from ViTriKho)
--   - Remove: grouping by l.Rack, l.Tang, l.Thung (no longer exist)

-- ✅ Step 4: Test warehouse API
--   curl http://localhost:3000/api/warehouse/map

-- ✅ Step 5: Frontend (TrangSoDoKho.tsx) should work without changes
--   - Already expects tiers structure
--   - Label format: A-1-1 (from ViTriKho.TenDay-Tang-ViTriO)

-- ============================================================================
-- DATABASE-ONLY VALIDATION QUERIES:
-- ============================================================================

USE MM_DB;
GO

-- Check: Mỗi ASSY có MaViTri?
SELECT COUNT(*) AS 'ASSY_With_MaViTri' FROM dbo.LinhKien WHERE MaViTri IS NOT NULL;
SELECT COUNT(*) AS 'ASSY_Without_MaViTri' FROM dbo.LinhKien WHERE MaViTri IS NULL;

-- Check: ASSY nào không có vị trí?
SELECT ASSY, MoTa FROM dbo.LinhKien WHERE MaViTri IS NULL;

-- Check: Vị trí nào không có ASSY?
SELECT MaViTri, TenDay, Tang, ViTriO, TenThung 
FROM dbo.ViTriKho
WHERE MaViTri NOT IN (SELECT DISTINCT MaViTri FROM dbo.LinhKien WHERE MaViTri IS NOT NULL);

-- Check: Data integrity sample
SELECT TOP 20
  v.MaViTri,
  CONCAT(v.TenDay, '-', v.Tang, '-', v.ViTriO) AS 'Location',
  l.ASSY,
  l.MoTa,
  SUM(t.SoLuongTon) AS 'Qty'
FROM dbo.ViTriKho v
LEFT JOIN dbo.LinhKien l ON l.MaViTri = v.MaViTri
LEFT JOIN dbo.TonKhoChiTiet t ON t.MaLinhKien = l.ASSY AND t.MaViTri = v.MaViTri
GROUP BY v.MaViTri, v.TenDay, v.Tang, v.ViTriO, l.ASSY, l.MoTa
ORDER BY v.TenDay, v.Tang, v.ViTriO;

GO

PRINT 'DATABASE MIGRATION READY FOR BACKEND UPDATE ✓';
PRINT 'Next: Update backend/src/routes/warehouse.js query';
