-- ============================================================================
-- AUDIT: Kiểm tra không nhất quán giữa LinhKien và ViTriKho
-- ============================================================================

USE MM_DB;
GO

PRINT '=== AUDIT DATABASE INCONSISTENCY ===';
PRINT '';

-- ============================================================================
-- 1. Backup dữ liệu trước khi thay đổi
-- ============================================================================

PRINT '--- BACKUP ---';
IF OBJECT_ID('dbo.LinhKien_Backup', 'U') IS NOT NULL DROP TABLE dbo.LinhKien_Backup;
IF OBJECT_ID('dbo.ViTriKho_Backup', 'U') IS NOT NULL DROP TABLE dbo.ViTriKho_Backup;
IF OBJECT_ID('dbo.TonKhoChiTiet_Backup', 'U') IS NOT NULL DROP TABLE dbo.TonKhoChiTiet_Backup;

SELECT * INTO dbo.LinhKien_Backup FROM dbo.LinhKien;
SELECT * INTO dbo.ViTriKho_Backup FROM dbo.ViTriKho;
SELECT * INTO dbo.TonKhoChiTiet_Backup FROM dbo.TonKhoChiTiet;

PRINT 'Backed up: LinhKien, ViTriKho, TonKhoChiTiet';

GO

-- ============================================================================
-- 2. ASSY không có vị trí trong ViTriKho
-- ============================================================================

PRINT '';
PRINT '--- ISSUE 1: ASSY không có vị trí ---';

SELECT 
  lk.ASSY,
  lk.MoTa,
  lk.Rack,
  lk.Tang,
  lk.Thung,
  COUNT(DISTINCT t.MaViTri) AS 'Locations_in_TonKho'
FROM dbo.LinhKien lk
LEFT JOIN dbo.TonKhoChiTiet t ON t.MaLinhKien = lk.ASSY
WHERE lk.Rack IS NULL OR lk.Tang IS NULL OR lk.Thung IS NULL
GROUP BY lk.ASSY, lk.MoTa, lk.Rack, lk.Tang, lk.Thung
ORDER BY lk.ASSY;

GO

-- ============================================================================
-- 3. Kiểm tra xem LinhKien.Rack/Tang/Thung có khớp với ViTriKho không
-- ============================================================================

PRINT '';
PRINT '--- ISSUE 2: LinhKien vs ViTriKho location mismatch ---';

SELECT 
  lk.ASSY,
  lk.MoTa,
  CONCAT(lk.Rack, '-', ISNULL(lk.Tang, '?'), '-', lk.Thung) AS 'LK_Location',
  CONCAT(v.TenDay, '-', ISNULL(v.Tang, '?'), '-', v.ViTriO) AS 'VTK_Location',
  v.MaViTri,
  COUNT(DISTINCT t.MaViTri) AS 'Num_Locations_in_TonKho'
FROM dbo.LinhKien lk
LEFT JOIN dbo.ViTriKho v ON v.TenDay = lk.Rack 
  AND ISNULL(v.Tang, 0) = ISNULL(lk.Tang, 0)
LEFT JOIN dbo.TonKhoChiTiet t ON t.MaLinhKien = lk.ASSY
WHERE lk.Rack IS NOT NULL
GROUP BY lk.ASSY, lk.MoTa, lk.Rack, lk.Tang, lk.Thung, v.TenDay, v.Tang, v.ViTriO, v.MaViTri
ORDER BY lk.ASSY;

GO

-- ============================================================================
-- 4. ASSY ở nhiều vị trí (inconsistency)
-- ============================================================================

PRINT '';
PRINT '--- ISSUE 3: ASSY ở nhiều vị trí (Inconsistency) ---';

SELECT 
  tkct.MaLinhKien,
  COUNT(DISTINCT tkct.MaViTri) AS 'NumLocations',
  STRING_AGG(
    CONCAT(v.TenDay, '-', ISNULL(v.Tang, '?'), '-', v.ViTriO, ' (MaViTri=', v.MaViTri, ')'),
    ' | '
  ) AS 'Locations'
FROM dbo.TonKhoChiTiet tkct
JOIN dbo.ViTriKho v ON v.MaViTri = tkct.MaViTri
GROUP BY tkct.MaLinhKien
HAVING COUNT(DISTINCT tkct.MaViTri) > 1
ORDER BY COUNT(DISTINCT tkct.MaViTri) DESC;

GO

-- ============================================================================
-- 5. Vị trí không có ASSY nào
-- ============================================================================

PRINT '';
PRINT '--- ISSUE 4: Vị trí trống (không có ASSY) ---';

SELECT 
  v.MaViTri,
  CONCAT(v.TenDay, '-', ISNULL(v.Tang, '?'), '-', v.ViTriO) AS 'Location',
  v.TenThung,
  COUNT(DISTINCT t.MaLinhKien) AS 'NumASSY'
FROM dbo.ViTriKho v
LEFT JOIN dbo.TonKhoChiTiet t ON t.MaViTri = v.MaViTri
GROUP BY v.MaViTri, v.TenDay, v.Tang, v.ViTriO, v.TenThung
HAVING COUNT(DISTINCT t.MaLinhKien) = 0
ORDER BY v.TenDay, v.Tang, v.ViTriO;

GO

-- ============================================================================
-- 6. Thống kê tổng quát
-- ============================================================================

PRINT '';
PRINT '=== SUMMARY STATISTICS ===';

DECLARE @TotalASSY INT = (SELECT COUNT(DISTINCT ASSY) FROM dbo.LinhKien);
DECLARE @AssyWithLocation INT = (SELECT COUNT(DISTINCT ASSY) FROM dbo.LinhKien WHERE Rack IS NOT NULL);
DECLARE @AssyWithoutLocation INT = @TotalASSY - @AssyWithLocation;
DECLARE @TotalLocations INT = (SELECT COUNT(*) FROM dbo.ViTriKho);
DECLARE @FilledLocations INT = (SELECT COUNT(DISTINCT MaViTri) FROM dbo.TonKhoChiTiet);
DECLARE @EmptyLocations INT = @TotalLocations - @FilledLocations;
DECLARE @MultiLocationASSY INT = (
  SELECT COUNT(DISTINCT MaLinhKien) 
  FROM (
    SELECT MaLinhKien, COUNT(DISTINCT MaViTri) AS cnt
    FROM dbo.TonKhoChiTiet
    GROUP BY MaLinhKien
    HAVING COUNT(DISTINCT MaViTri) > 1
  ) t
);

PRINT CONCAT('Total ASSY: ', @TotalASSY);
PRINT CONCAT('  ├─ With Location: ', @AssyWithLocation, ' (', 
  CAST(CAST(@AssyWithLocation AS FLOAT) / @TotalASSY * 100 AS DECIMAL(5,1)), '%)');
PRINT CONCAT('  └─ Without Location: ', @AssyWithoutLocation, ' (', 
  CAST(CAST(@AssyWithoutLocation AS FLOAT) / @TotalASSY * 100 AS DECIMAL(5,1)), '%)');

PRINT '';
PRINT CONCAT('Total Locations: ', @TotalLocations);
PRINT CONCAT('  ├─ Filled: ', @FilledLocations, ' (', 
  CAST(CAST(@FilledLocations AS FLOAT) / @TotalLocations * 100 AS DECIMAL(5,1)), '%)');
PRINT CONCAT('  └─ Empty: ', @EmptyLocations, ' (', 
  CAST(CAST(@EmptyLocations AS FLOAT) / @TotalLocations * 100 AS DECIMAL(5,1)), '%)');

PRINT '';
PRINT CONCAT('Multi-Location ASSY: ', @MultiLocationASSY);

GO

PRINT '';
PRINT 'AUDIT COMPLETE! ✓';
PRINT 'Review issues above and run NORMALIZE_DATABASE_SCHEMA.sql next.';
