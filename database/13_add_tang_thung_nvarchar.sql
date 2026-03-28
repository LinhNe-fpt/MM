-- ============================================================================
-- ADD/ALTER: Tang và Thung columns to ViTriKho as NVARCHAR
-- ============================================================================

USE MM_DB;
GO

PRINT '=== ADD/ALTER Tang và Thung as NVARCHAR ===';
PRINT '';

-- ============================================================================
-- Check if columns exist and their current types
-- ============================================================================

PRINT '--- Check current schema ---';

SELECT 
  COLUMN_NAME,
  DATA_TYPE,
  CHARACTER_MAXIMUM_LENGTH,
  IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'ViTriKho' 
  AND COLUMN_NAME IN ('Tang', 'Thung', 'ViTriO')
ORDER BY ORDINAL_POSITION;

GO

-- ============================================================================
-- If Tang/Thung don't exist as NVARCHAR, recreate them
-- ============================================================================

PRINT '';
PRINT '--- Migrate to NVARCHAR ---';

-- Step 1: Check if old INT columns exist, drop them if needed
IF EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ViTriKho' AND COLUMN_NAME = 'ViTriO'
)
BEGIN
  -- Rename ViTriO to Thung first
  EXEC sp_rename 'dbo.ViTriKho.ViTriO', 'ThungOld', 'COLUMN';
  PRINT '  Backed up ViTriO → ThungOld (INT)';
END

GO

-- Step 2: Add Tang as NVARCHAR if not exist
IF NOT EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ViTriKho' AND COLUMN_NAME = 'Tang'
)
BEGIN
  ALTER TABLE dbo.ViTriKho ADD Tang NVARCHAR(50) NULL;
  PRINT '✓ Added Tang (NVARCHAR(50))';
END
ELSE
BEGIN
  -- Check if it's already NVARCHAR, if not convert
  DECLARE @currentType NVARCHAR(MAX);
  SELECT @currentType = DATA_TYPE 
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ViTriKho' AND COLUMN_NAME = 'Tang';
  
  IF @currentType != 'nvarchar'
  BEGIN
    -- Drop and recreate as NVARCHAR
    ALTER TABLE dbo.ViTriKho DROP COLUMN Tang;
    ALTER TABLE dbo.ViTriKho ADD Tang NVARCHAR(50) NULL;
    PRINT '✓ Converted Tang to NVARCHAR(50)';
  END
  ELSE
  BEGIN
    PRINT '  Tang already NVARCHAR';
  END
END

GO

-- Step 3: Add Thung as NVARCHAR if not exist
IF NOT EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ViTriKho' AND COLUMN_NAME = 'Thung'
)
BEGIN
  ALTER TABLE dbo.ViTriKho ADD Thung NVARCHAR(50) NULL;
  PRINT '✓ Added Thung (NVARCHAR(50))';
END
ELSE
BEGIN
  -- Check if it's already NVARCHAR, if not convert
  DECLARE @currentType NVARCHAR(MAX);
  SELECT @currentType = DATA_TYPE 
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ViTriKho' AND COLUMN_NAME = 'Thung';
  
  IF @currentType != 'nvarchar'
  BEGIN
    -- Drop and recreate as NVARCHAR
    ALTER TABLE dbo.ViTriKho DROP COLUMN Thung;
    ALTER TABLE dbo.ViTriKho ADD Thung NVARCHAR(50) NULL;
    PRINT '✓ Converted Thung to NVARCHAR(50)';
  END
  ELSE
  BEGIN
    PRINT '  Thung already NVARCHAR';
  END
END

GO

-- Step 4: Migrate data from ThungOld (INT) to Thung (NVARCHAR) if exists
IF EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ViTriKho' AND COLUMN_NAME = 'ThungOld'
)
BEGIN
  PRINT '';
  PRINT '--- Migrate data from ThungOld to Thung ---';
  
  UPDATE dbo.ViTriKho
  SET Thung = CAST(ThungOld AS NVARCHAR(50))
  WHERE Thung IS NULL AND ThungOld IS NOT NULL;
  
  PRINT CAST(@@ROWCOUNT AS VARCHAR) + ' rows updated';
  
  -- Drop old column
  ALTER TABLE dbo.ViTriKho DROP COLUMN ThungOld;
  PRINT '✓ Dropped ThungOld';
END

GO

-- ============================================================================
-- Remove TenThung if it exists (redundant)
-- ============================================================================

IF EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ViTriKho' AND COLUMN_NAME = 'TenThung'
)
BEGIN
  ALTER TABLE dbo.ViTriKho DROP COLUMN TenThung;
  PRINT '✓ Dropped TenThung (redundant)';
END

GO

-- ============================================================================
-- Rename TenDay to Rack for consistency
-- ============================================================================

PRINT '';
PRINT '--- Unify naming convention ---';

IF EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ViTriKho' AND COLUMN_NAME = 'TenDay'
)
BEGIN
  EXEC sp_rename 'dbo.ViTriKho.TenDay', 'Rack', 'COLUMN';
  PRINT '✓ Renamed TenDay → Rack';
END

GO

-- ============================================================================
-- VERIFY Final Schema
-- ============================================================================

PRINT '';
PRINT '=== FINAL SCHEMA ===';

SELECT 
  COLUMN_NAME,
  DATA_TYPE,
  CHARACTER_MAXIMUM_LENGTH,
  IS_NULLABLE,
  ORDINAL_POSITION
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'ViTriKho'
ORDER BY ORDINAL_POSITION;

GO

-- ============================================================================
-- Sample data after migration
-- ============================================================================

PRINT '';
PRINT '=== SAMPLE DATA ===';

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
-- Insert Sample Data (để test)
-- ============================================================================

PRINT '';
PRINT '--- Insert Sample Data if empty ---';

IF (SELECT COUNT(*) FROM dbo.ViTriKho) = 0
BEGIN
  -- Dãy A: 3 tầng x 3 ô
  INSERT INTO dbo.ViTriKho (Rack, Tang, Thung, TrangThai) VALUES
    (N'A', N'1', N'1', 1),
    (N'A', N'1', N'2', 1),
    (N'A', N'1', N'3', 1),
    (N'A', N'2', N'1', 1),
    (N'A', N'2', N'2', 1),
    (N'A', N'2', N'3', 1),
    (N'A', N'3', N'1', 1),
    (N'A', N'3', N'2', 1),
    (N'A', N'3', N'3', 1),
    -- Dãy B: 2 tầng x 3 ô
    (N'B', N'1', N'1', 1),
    (N'B', N'1', N'2', 1),
    (N'B', N'1', N'3', 1),
    (N'B', N'2', N'1', 1),
    (N'B', N'2', N'2', 1),
    (N'B', N'2', N'3', 1),
    -- Dãy C: 2 tầng x 2 ô
    (N'C', N'1', N'1', 1),
    (N'C', N'1', N'2', 1),
    (N'C', N'2', N'1', 1),
    (N'C', N'2', N'2', 1);
  
  PRINT CAST(@@ROWCOUNT AS VARCHAR) + ' sample records inserted';
END
ELSE
BEGIN
  PRINT '  Data already exists, skipping insert';
END

GO

PRINT '';
PRINT 'MIGRATION COMPLETE! ✓';
PRINT '';
PRINT 'ViTriKho schema:';
PRINT '  • Rack (NVARCHAR)';
PRINT '  • Tang (NVARCHAR)';
PRINT '  • Thung (NVARCHAR)';
