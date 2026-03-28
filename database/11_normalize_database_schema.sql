-- ============================================================================
-- NORMALIZE DATABASE SCHEMA
-- Chuẩn hóa: Mỗi ASSY có MỘT vị trí duy nhất (Single Source of Truth)
-- ============================================================================

USE MM_DB;
GO

PRINT '=== NORMALIZE DATABASE SCHEMA ===';
PRINT '';

-- ============================================================================
-- STEP 1: Thêm MaViTri column vào LinhKien (nếu chưa có)
-- ============================================================================

PRINT '--- STEP 1: Add MaViTri to LinhKien ---';

IF NOT EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'LinhKien' AND COLUMN_NAME = 'MaViTri'
)
BEGIN
  ALTER TABLE dbo.LinhKien ADD MaViTri INT NULL;
  PRINT 'Added column MaViTri';
END
ELSE
BEGIN
  PRINT 'Column MaViTri already exists';
END

GO

-- ============================================================================
-- STEP 2: Nếu chưa có FK, thêm FK từ LinhKien → ViTriKho
-- ============================================================================

PRINT '';
PRINT '--- STEP 2: Add Foreign Key LinhKien → ViTriKho ---';

IF NOT EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_NAME = 'LinhKien' AND CONSTRAINT_NAME = 'FK_LinhKien_ViTriKho'
)
BEGIN
  ALTER TABLE dbo.LinhKien
    ADD CONSTRAINT FK_LinhKien_ViTriKho 
    FOREIGN KEY (MaViTri) REFERENCES dbo.ViTriKho(MaViTri) ON DELETE SET NULL;
  PRINT 'Added FK_LinhKien_ViTriKho';
END
ELSE
BEGIN
  PRINT 'FK_LinhKien_ViTriKho already exists';
END

GO

-- ============================================================================
-- STEP 3: Doanh sách ASSY theo vị trí từ TonKhoChiTiet
-- (Nếu ASSY ở nhiều vị trí, lấy vị trí có số lượng lớn nhất)
-- ============================================================================

PRINT '';
PRINT '--- STEP 3: Map ASSY to Primary Location ---';

UPDATE lk
SET lk.MaViTri = t.MaViTri
FROM dbo.LinhKien lk
CROSS APPLY (
  SELECT TOP 1 
    MaViTri,
    SUM(SoLuongTon) AS TotalQty
  FROM dbo.TonKhoChiTiet
  WHERE MaLinhKien = lk.ASSY
  GROUP BY MaViTri
  ORDER BY SUM(SoLuongTon) DESC
) t
WHERE lk.MaViTri IS NULL;

PRINT CAST(@@ROWCOUNT AS VARCHAR) + ' ASSY records updated with MaViTri';

GO

-- ============================================================================
-- STEP 4: Xóa Rack/Tang/Thung từ LinhKien (thay thế bằng MaViTri)
-- ============================================================================

PRINT '';
PRINT '--- STEP 4: Cleanup LinhKien redundant columns ---';

-- Kiểm tra xem có FK từ bảng khác tham chiếu đến các cột này không
IF EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'LinhKien' AND COLUMN_NAME = 'Rack'
)
BEGIN
  ALTER TABLE dbo.LinhKien DROP COLUMN Rack, Tang, Thung;
  PRINT 'Dropped columns: Rack, Tang, Thung from LinhKien';
END
ELSE
BEGIN
  PRINT 'Columns already removed';
END

GO

-- ============================================================================
-- STEP 5: Thêm unique constraint: Mỗi MaViTri chỉ có 1 ASSY (Optional, tuỳ yêu cầu)
-- ============================================================================

PRINT '';
PRINT '--- STEP 5: Add Unique Constraint (optional) ---';
PRINT 'NOTE: Nếu 1 vị trí chỉ có 1 ASSY, uncomment dòng này:';
PRINT 'ALTER TABLE dbo.LinhKien ADD CONSTRAINT UQ_LinhKien_MaViTri UNIQUE (MaViTri);';

GO

-- ============================================================================
-- STEP 6: Verify Schema Changes
-- ============================================================================

PRINT '';
PRINT '=== VERIFY SCHEMA CHANGES ===';

PRINT '';
PRINT 'LinhKien columns:';
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'LinhKien'
ORDER BY ORDINAL_POSITION;

PRINT '';
PRINT 'ViTriKho columns:';
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'ViTriKho'
ORDER BY ORDINAL_POSITION;

GO

-- ============================================================================
-- STEP 7: Validate Data Integrity
-- ============================================================================

PRINT '';
PRINT '=== VALIDATE DATA INTEGRITY ===';

PRINT '';
PRINT 'ASSY without MaViTri (orphaned):';
SELECT COUNT(*) FROM dbo.LinhKien WHERE MaViTri IS NULL;

PRINT 'Locations without ASSY:';
SELECT COUNT(*) FROM dbo.ViTriKho 
WHERE MaViTri NOT IN (SELECT DISTINCT MaViTri FROM dbo.LinhKien WHERE MaViTri IS NOT NULL);

PRINT 'Invalid FK references (MaViTri):';
SELECT COUNT(*) FROM dbo.LinhKien 
WHERE MaViTri IS NOT NULL 
  AND MaViTri NOT IN (SELECT MaViTri FROM dbo.ViTriKho);

GO

-- ============================================================================
-- STEP 8: Sample Query - Warehouse Map (New Logic)
-- ============================================================================

PRINT '';
PRINT '=== SAMPLE: New Warehouse Map Query ===';

SELECT TOP 20
  lk.ASSY,
  lk.MoTa AS 'Description',
  v.TenDay AS 'Rack',
  v.Tang AS 'Tier',
  v.ViTriO AS 'Bin',
  v.TenThung AS 'Label',
  SUM(t.SoLuongTon) AS 'Quantity'
FROM dbo.LinhKien lk
LEFT JOIN dbo.ViTriKho v ON v.MaViTri = lk.MaViTri
LEFT JOIN dbo.TonKhoChiTiet t ON t.MaLinhKien = lk.ASSY
WHERE lk.MaViTri IS NOT NULL
GROUP BY lk.ASSY, lk.MoTa, v.TenDay, v.Tang, v.ViTriO, v.TenThung
ORDER BY v.TenDay, v.Tang, v.ViTriO;

GO

-- ============================================================================
-- STEP 9: Cleanup Old Backup Tables (Optional - Keep for 1 week)
-- ============================================================================

PRINT '';
PRINT '=== CLEANUP ===';
PRINT 'Keep backup tables: LinhKien_Backup, ViTriKho_Backup, TonKhoChiTiet_Backup';
PRINT 'These will be deleted after 1 week if no issues found.';

GO

PRINT '';
PRINT 'NORMALIZATION COMPLETE! ✓';
PRINT 'Next steps:';
PRINT '  1. Run backend tests';
PRINT '  2. Verify UI warehouse map';
PRINT '  3. If all OK, delete backup tables';
PRINT '  4. Commit to git';
