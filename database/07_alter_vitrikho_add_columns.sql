-- ============================================================================
-- ADD COLUMNS TO ViTriKho (IF NOT EXIST)
-- Thêm cột Tang (Tầng) và ViTriO (Vị trí ô) vào bảng ViTriKho
-- ============================================================================

USE MM_DB;
GO

-- Check if columns exist before adding
IF NOT EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_NAME = 'ViTriKho' AND COLUMN_NAME = 'Tang'
)
BEGIN
  ALTER TABLE dbo.ViTriKho ADD Tang INT NULL;
  PRINT 'Added column Tang';
END
ELSE
BEGIN
  PRINT 'Column Tang already exists';
END

GO

IF NOT EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_NAME = 'ViTriKho' AND COLUMN_NAME = 'ViTriO'
)
BEGIN
  ALTER TABLE dbo.ViTriKho ADD ViTriO INT NULL;
  PRINT 'Added column ViTriO';
END
ELSE
BEGIN
  PRINT 'Column ViTriO already exists';
END

GO

-- ============================================================================
-- VERIFY COLUMNS
-- ============================================================================

PRINT '=== ViTriKho Table Structure ===';
SELECT 
  COLUMN_NAME, 
  DATA_TYPE, 
  IS_NULLABLE,
  COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'ViTriKho'
ORDER BY ORDINAL_POSITION;
