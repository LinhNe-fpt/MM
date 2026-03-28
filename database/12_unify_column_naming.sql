-- ============================================================================
-- SIMPLE: Thống Nhất Tên Cột (Rename Only)
-- Không cần migration phức tạp, chỉ rename để thống nhất naming convention
-- ============================================================================

USE MM_DB;
GO

PRINT '=== UNIFY COLUMN NAMING CONVENTION ===';
PRINT '';

-- ============================================================================
-- OPTION 1: Thống nhất dùng "Rack, Tang, Thung" (từ LinhKien)
-- ============================================================================

PRINT '--- OPTION 1: Use LinhKien naming (Rack, Tang, Thung) ---';
PRINT '';

-- Step 1: Rename ViTriKho.TenDay → Rack
IF EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ViTriKho' AND COLUMN_NAME = 'TenDay'
)
BEGIN
  EXEC sp_rename 'dbo.ViTriKho.TenDay', 'Rack', 'COLUMN';
  PRINT '✓ ViTriKho.TenDay → Rack';
END
ELSE
BEGIN
  PRINT '  ViTriKho.TenDay already renamed or not found';
END

GO

-- Step 2: Rename ViTriKho.ViTriO → Thung
IF EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ViTriKho' AND COLUMN_NAME = 'ViTriO'
)
BEGIN
  EXEC sp_rename 'dbo.ViTriKho.ViTriO', 'Thung', 'COLUMN';
  PRINT '✓ ViTriKho.ViTriO → Thung';
END
ELSE
BEGIN
  PRINT '  ViTriKho.ViTriO already renamed or not found';
END

GO

-- Step 3: Xóa TenThung (thừa vì đã có Thung)
IF EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ViTriKho' AND COLUMN_NAME = 'TenThung'
)
BEGIN
  -- Cập nhật Thung = TenThung trước
  UPDATE dbo.ViTriKho
  SET Thung = CASE 
    WHEN ISNUMERIC(RIGHT(TenThung, 1)) = 1 THEN CAST(RIGHT(TenThung, 1) AS INT)
    ELSE Thung
  END
  WHERE Thung IS NULL AND TenThung IS NOT NULL;
  
  ALTER TABLE dbo.ViTriKho DROP COLUMN TenThung;
  PRINT '✓ ViTriKho.TenThung → dropped (value merged to Thung)';
END
ELSE
BEGIN
  PRINT '  ViTriKho.TenThung already dropped or not found';
END

GO

PRINT '';
PRINT '=== VERIFY RENAMED SCHEMA ===';

SELECT 
  COLUMN_NAME,
  DATA_TYPE,
  IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'ViTriKho'
ORDER BY ORDINAL_POSITION;

GO

PRINT '';
PRINT '=== SAMPLE DATA (New Structure) ===';

SELECT TOP 10
  MaViTri,
  Rack,
  Tang,
  Thung,
  TrangThai
FROM dbo.ViTriKho
ORDER BY Rack, Tang, Thung;

GO

-- ============================================================================
-- VERIFY: Compare LinhKien vs ViTriKho (should now align)
-- ============================================================================

PRINT '';
PRINT '=== VERIFY: LinhKien vs ViTriKho Alignment ===';

SELECT 
  lk.ASSY,
  lk.MoTa,
  CONCAT(lk.Rack, '-', lk.Tang, '-', lk.Thung) AS 'LinhKien_Location',
  CONCAT(v.Rack, '-', v.Tang, '-', v.Thung) AS 'ViTriKho_Location',
  CASE 
    WHEN lk.Rack = v.Rack AND lk.Tang = v.Tang AND CAST(lk.Thung AS INT) = v.Thung 
    THEN '✓ MATCH'
    ELSE '❌ MISMATCH'
  END AS 'Status'
FROM dbo.LinhKien lk
LEFT JOIN dbo.ViTriKho v ON v.Rack = lk.Rack 
  AND v.Tang = lk.Tang
  AND v.Thung = CAST(lk.Thung AS INT)
ORDER BY lk.Rack, lk.Tang, lk.Thung;

GO

PRINT '';
PRINT 'UNIFICATION COMPLETE! ✓';
PRINT '';
PRINT 'Schema is now consistent:';
PRINT '  LinhKien: Rack, Tang, Thung';
PRINT '  ViTriKho: Rack, Tang, Thung';
PRINT '';
PRINT 'No backend changes needed if you handle the mapping correctly!';
