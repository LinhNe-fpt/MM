-- ============================================================================
-- RESET & REDO: Complete fresh start with correct schema
-- ============================================================================

USE MM_DB;
GO

PRINT '=== COMPLETE RESET & REDO ===';
PRINT '';

-- ============================================================================
-- STEP 1: Update ViTriKho schema if needed
-- ============================================================================

PRINT '--- STEP 1: Ensure ViTriKho has Rack, Tang, Thung ---';

-- If TenDay exists, rename to Rack
IF EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ViTriKho' AND COLUMN_NAME = 'TenDay'
)
BEGIN
  EXEC sp_rename 'dbo.ViTriKho.TenDay', 'Rack', 'COLUMN';
  PRINT '✓ Renamed TenDay → Rack';
END

-- If ViTriO exists, rename to Thung
IF EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ViTriKho' AND COLUMN_NAME = 'ViTriO'
)
BEGIN
  EXEC sp_rename 'dbo.ViTriKho.ViTriO', 'Thung', 'COLUMN';
  PRINT '✓ Renamed ViTriO → Thung';
END

-- If Tang is INT, convert to NVARCHAR
IF EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ViTriKho' AND COLUMN_NAME = 'Tang'
)
BEGIN
  DECLARE @Tang_Type NVARCHAR(MAX);
  SELECT @Tang_Type = DATA_TYPE 
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ViTriKho' AND COLUMN_NAME = 'Tang';
  
  IF @Tang_Type = 'int'
  BEGIN
    PRINT 'Converting Tang from INT to NVARCHAR...';
    -- Backup
    ALTER TABLE dbo.ViTriKho ADD Tang_Temp NVARCHAR(20);
    UPDATE dbo.ViTriKho SET Tang_Temp = CAST(Tang AS NVARCHAR(20));
    ALTER TABLE dbo.ViTriKho DROP COLUMN Tang;
    EXEC sp_rename 'dbo.ViTriKho.Tang_Temp', 'Tang', 'COLUMN';
    PRINT '✓ Converted Tang to NVARCHAR';
  END
END

-- If Thung is INT, convert to NVARCHAR
IF EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ViTriKho' AND COLUMN_NAME = 'Thung'
)
BEGIN
  DECLARE @Thung_Type NVARCHAR(MAX);
  SELECT @Thung_Type = DATA_TYPE 
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ViTriKho' AND COLUMN_NAME = 'Thung';
  
  IF @Thung_Type = 'int'
  BEGIN
    PRINT 'Converting Thung from INT to NVARCHAR...';
    -- Backup
    ALTER TABLE dbo.ViTriKho ADD Thung_Temp NVARCHAR(20);
    UPDATE dbo.ViTriKho SET Thung_Temp = CAST(Thung AS NVARCHAR(20));
    ALTER TABLE dbo.ViTriKho DROP COLUMN Thung;
    EXEC sp_rename 'dbo.ViTriKho.Thung_Temp', 'Thung', 'COLUMN';
    PRINT '✓ Converted Thung to NVARCHAR';
  END
END

-- Remove TenThung if exists (redundant)
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
-- STEP 2: Update LinhKien schema if needed
-- ============================================================================

PRINT '';
PRINT '--- STEP 2: Ensure LinhKien has Rack, Tang, Thung, MaViTri ---';

-- Ensure Rack column exists
IF NOT EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'LinhKien' AND COLUMN_NAME = 'Rack'
)
BEGIN
  ALTER TABLE dbo.LinhKien ADD Rack NVARCHAR(50) NULL;
  PRINT '✓ Added Rack';
END

-- Ensure Tang column exists
IF NOT EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'LinhKien' AND COLUMN_NAME = 'Tang'
)
BEGIN
  ALTER TABLE dbo.LinhKien ADD Tang INT NULL;
  PRINT '✓ Added Tang';
END

-- Ensure Thung column exists
IF NOT EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'LinhKien' AND COLUMN_NAME = 'Thung'
)
BEGIN
  ALTER TABLE dbo.LinhKien ADD Thung NVARCHAR(50) NULL;
  PRINT '✓ Added Thung';
END

-- Ensure MaViTri column exists
IF NOT EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'LinhKien' AND COLUMN_NAME = 'MaViTri'
)
BEGIN
  ALTER TABLE dbo.LinhKien ADD MaViTri INT NULL;
  PRINT '✓ Added MaViTri';
END

GO

-- ============================================================================
-- STEP 3: Map ASSY to Locations (Round-robin distribution)
-- ============================================================================

PRINT '';
PRINT '--- STEP 3: Distribute ASSY across Locations ---';

WITH RankedASSY AS (
  SELECT 
    ASSY,
    ROW_NUMBER() OVER (ORDER BY ASSY) AS assy_rn
  FROM dbo.LinhKien
  WHERE ISNULL(Rack, '') = ''
),
RankedLocations AS (
  SELECT 
    MaViTri,
    Rack,
    Tang,
    Thung,
    ROW_NUMBER() OVER (ORDER BY Rack, CAST(Tang AS INT), CAST(Thung AS INT)) AS loc_rn,
    COUNT(*) OVER () AS total_locs
  FROM dbo.ViTriKho
)
UPDATE lk
SET 
  lk.Rack = rl.Rack,
  lk.Tang = CAST(rl.Tang AS INT),
  lk.Thung = rl.Thung,
  lk.MaViTri = rl.MaViTri
FROM dbo.LinhKien lk
INNER JOIN RankedASSY ra ON lk.ASSY = ra.ASSY
INNER JOIN RankedLocations rl ON ra.assy_rn = ((rl.loc_rn - 1) % rl.total_locs) + 1;

PRINT CAST(@@ROWCOUNT AS VARCHAR) + ' ASSY records updated with location info';

GO

-- ============================================================================
-- STEP 4: Verify Results
-- ============================================================================

PRINT '';
PRINT '=== VERIFY RESULTS ===';

PRINT '';
PRINT 'ASSY Distribution by Location:';
SELECT 
  CONCAT(Rack, '-', Tang, '-', Thung) AS 'Location',
  COUNT(*) AS 'ASSY Count',
  STRING_AGG(ASSY, ', ') AS 'ASSY Codes'
FROM dbo.LinhKien
WHERE Rack IS NOT NULL
GROUP BY MaViTri, Rack, Tang, Thung
ORDER BY Rack, CAST(Tang AS INT), CAST(Thung AS INT);

GO

PRINT '';
PRINT 'ASSY without location (if any):';
SELECT COUNT(*) FROM dbo.LinhKien WHERE Rack IS NULL;

GO

PRINT '';
PRINT 'Sample LinhKien data:';
SELECT TOP 10 
  ASSY,
  MoTa,
  CONCAT(Rack, '-', Tang, '-', Thung) AS 'Location',
  MaViTri
FROM dbo.LinhKien
WHERE Rack IS NOT NULL
ORDER BY Rack, CAST(Tang AS INT), CAST(Thung AS INT);

GO

PRINT '';
PRINT 'RESET & MAPPING COMPLETE! ✓';
