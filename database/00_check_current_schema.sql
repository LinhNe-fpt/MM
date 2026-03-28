-- ============================================================================
-- CHECK: Verify current schema trước khi mapping
-- ============================================================================

USE MM_DB;
GO

PRINT '=== CHECK CURRENT SCHEMA ===';
PRINT '';

-- ============================================================================
-- Check ViTriKho columns
-- ============================================================================

PRINT '--- ViTriKho Columns ---';
SELECT 
  COLUMN_NAME,
  DATA_TYPE,
  CHARACTER_MAXIMUM_LENGTH,
  IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'ViTriKho'
ORDER BY ORDINAL_POSITION;

GO

-- ============================================================================
-- Check LinhKien columns
-- ============================================================================

PRINT '';
PRINT '--- LinhKien Columns (Location-related) ---';
SELECT 
  COLUMN_NAME,
  DATA_TYPE,
  CHARACTER_MAXIMUM_LENGTH,
  IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'LinhKien'
  AND COLUMN_NAME IN ('Rack', 'Tang', 'Thung', 'TenDay', 'ViTriO', 'MaViTri')
ORDER BY ORDINAL_POSITION;

GO

-- ============================================================================
-- Sample data from both tables
-- ============================================================================

PRINT '';
PRINT '--- Sample ViTriKho Data ---';
SELECT TOP 5 * FROM dbo.ViTriKho;

PRINT '';
PRINT '--- Sample LinhKien Data ---';
SELECT TOP 5 ASSY, MoTa, Rack, Tang, Thung, MaViTri FROM dbo.LinhKien;

GO

PRINT '';
PRINT 'CHECK COMPLETE - Use results above to verify schema state.';
