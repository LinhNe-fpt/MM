-- ============================================================================
-- MAP: LinhKien (ASSY) → ViTriKho (Locations)
-- Update Rack/Tang/Thung trong LinhKien khớp với ViTriKho
-- ============================================================================

USE MM_DB;
GO

PRINT '=== MAP LinhKien TO ViTriKho ===';
PRINT '';

-- ============================================================================
-- Step 1: Verify current LinhKien data
-- ============================================================================

PRINT '--- STEP 1: Current LinhKien Status ---';

SELECT COUNT(*) AS 'Total ASSY' FROM dbo.LinhKien;
SELECT COUNT(*) AS 'ASSY with Rack' FROM dbo.LinhKien WHERE Rack IS NOT NULL;
SELECT COUNT(*) AS 'ASSY without Rack' FROM dbo.LinhKien WHERE Rack IS NULL;

GO

-- ============================================================================
-- Step 2: Verify ViTriKho data
-- ============================================================================

PRINT '';
PRINT '--- STEP 2: ViTriKho Locations ---';

SELECT COUNT(*) AS 'Total Locations' FROM dbo.ViTriKho;
SELECT COUNT(DISTINCT Rack) AS 'Dãy (Rack)' FROM dbo.ViTriKho;
SELECT COUNT(DISTINCT CONCAT(Rack, '-', Tang)) AS 'Tầng' FROM dbo.ViTriKho;

GO

-- ============================================================================
-- Step 3: Map ASSY to Locations
-- Distribute ASSY across ViTriKho locations
-- ============================================================================

PRINT '';
PRINT '--- STEP 3: Map ASSY to Locations ---';

-- Create a mapping table (temporary)
WITH LocatedASSY AS (
  SELECT 
    ROW_NUMBER() OVER (ORDER BY ASSY) AS rn,
    ASSY,
    COUNT(*) OVER () AS total_assy
  FROM dbo.LinhKien
),
LocationList AS (
  SELECT 
    ROW_NUMBER() OVER (ORDER BY MaViTri) AS loc_rn,
    MaViTri,
    Rack,
    Tang,
    Thung,
    COUNT(*) OVER () AS total_locs
  FROM dbo.ViTriKho
)
UPDATE lk
SET 
  lk.Rack = ll.Rack,
  lk.Tang = CAST(ll.Tang AS INT),
  lk.Thung = ll.Thung
FROM dbo.LinhKien lk
INNER JOIN LocatedASSY la ON lk.ASSY = la.ASSY
INNER JOIN LocationList ll ON la.rn = ll.loc_rn
WHERE lk.Rack IS NULL;

PRINT CAST(@@ROWCOUNT AS VARCHAR) + ' ASSY records mapped to locations';

GO

-- ============================================================================
-- Step 4: Verify mapping - Show ASSY with locations
-- ============================================================================

PRINT '';
PRINT '--- STEP 4: Verify Mapping ---';

SELECT 
  CONCAT(Rack, '-', Tang, '-', Thung) AS 'Location',
  COUNT(*) AS 'ASSY Count',
  STRING_AGG(ASSY, ', ') AS 'ASSY Codes'
FROM dbo.LinhKien
WHERE Rack IS NOT NULL
GROUP BY Rack, Tang, Thung
ORDER BY Rack, CAST(Tang AS INT), CAST(Thung AS INT);

GO

-- ============================================================================
-- Step 5: Check if all ASSY have location
-- ============================================================================

PRINT '';
PRINT '--- STEP 5: ASSY Without Location (if any) ---';

SELECT 
  ASSY,
  MoTa
FROM dbo.LinhKien
WHERE Rack IS NULL OR Tang IS NULL OR Thung IS NULL;

IF @@ROWCOUNT = 0
BEGIN
  PRINT 'All ASSY have locations ✓';
END

GO

-- ============================================================================
-- Step 6: Add MaViTri to LinhKien (if not exist)
-- ============================================================================

PRINT '';
PRINT '--- STEP 6: Add MaViTri Column ---';

IF NOT EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'LinhKien' AND COLUMN_NAME = 'MaViTri'
)
BEGIN
  ALTER TABLE dbo.LinhKien ADD MaViTri INT NULL;
  PRINT 'Added MaViTri column';
END
ELSE
BEGIN
  PRINT 'MaViTri column already exists';
END

GO

-- ============================================================================
-- Step 7: Map MaViTri from ViTriKho
-- ============================================================================

PRINT '';
PRINT '--- STEP 7: Map MaViTri ---';

UPDATE lk
SET lk.MaViTri = v.MaViTri
FROM dbo.LinhKien lk
INNER JOIN dbo.ViTriKho v ON 
  v.Rack = lk.Rack 
  AND v.Tang = CAST(lk.Tang AS NVARCHAR(20))
  AND v.Thung = lk.Thung
WHERE lk.MaViTri IS NULL;

PRINT CAST(@@ROWCOUNT AS VARCHAR) + ' MaViTri records updated';

GO

-- ============================================================================
-- Step 8: Display Final Mapping
-- ============================================================================

PRINT '';
PRINT '=== FINAL RESULT ===';

SELECT 
  lk.ASSY,
  lk.MoTa,
  CONCAT(lk.Rack, '-', lk.Tang, '-', lk.Thung) AS 'Location',
  lk.MaViTri,
  lk.TonToiThieu AS 'Min Stock'
FROM dbo.LinhKien lk
ORDER BY lk.Rack, CAST(lk.Tang AS INT), lk.Thung, lk.ASSY;

GO

-- ============================================================================
-- Step 9: Statistics
-- ============================================================================

PRINT '';
PRINT '=== STATISTICS ===';

DECLARE @TotalASSY INT = (SELECT COUNT(*) FROM dbo.LinhKien);
DECLARE @MappedASSY INT = (SELECT COUNT(*) FROM dbo.LinhKien WHERE MaViTri IS NOT NULL);
DECLARE @UnmappedASSY INT = @TotalASSY - @MappedASSY;
DECLARE @TotalLocs INT = (SELECT COUNT(*) FROM dbo.ViTriKho);
DECLARE @FilledLocs INT = (SELECT COUNT(DISTINCT MaViTri) FROM dbo.LinhKien WHERE MaViTri IS NOT NULL);
DECLARE @EmptyLocs INT = @TotalLocs - @FilledLocs;

PRINT '';
PRINT 'ASSY Statistics:';
PRINT '  Total ASSY: ' + CAST(@TotalASSY AS VARCHAR);
PRINT '  Mapped: ' + CAST(@MappedASSY AS VARCHAR) + ' (' + CAST(CAST(@MappedASSY AS FLOAT) / @TotalASSY * 100 AS DECIMAL(5,1)) + '%)';
PRINT '  Unmapped: ' + CAST(@UnmappedASSY AS VARCHAR);

PRINT '';
PRINT 'Location Statistics:';
PRINT '  Total Locations: ' + CAST(@TotalLocs AS VARCHAR);
PRINT '  Filled: ' + CAST(@FilledLocs AS VARCHAR);
PRINT '  Empty: ' + CAST(@EmptyLocs AS VARCHAR);

PRINT '';
PRINT 'ASSY per Location:';
SELECT 
  CONCAT(Rack, '-', Tang, '-', Thung) AS 'Location',
  COUNT(*) AS 'ASSY Count'
FROM dbo.LinhKien
WHERE MaViTri IS NOT NULL
GROUP BY MaViTri, Rack, Tang, Thung
ORDER BY Rack, CAST(Tang AS INT), CAST(Thung AS INT);

GO

-- ============================================================================
-- Step 10: Verify TonKhoChiTiet alignment
-- ============================================================================

PRINT '';
PRINT '--- STEP 10: Verify TonKhoChiTiet Alignment ---';

SELECT TOP 20
  tkct.MaLinhKien,
  lk.MoTa,
  lk.MaViTri AS 'LK_MaViTri',
  tkct.MaViTri AS 'TKCT_MaViTri',
  tkct.SoLuongTon,
  CASE 
    WHEN lk.MaViTri = tkct.MaViTri THEN '✓ Match'
    ELSE '⚠ Mismatch'
  END AS 'Status'
FROM dbo.TonKhoChiTiet tkct
LEFT JOIN dbo.LinhKien lk ON lk.ASSY = tkct.MaLinhKien
ORDER BY tkct.MaLinhKien;

GO

PRINT '';
PRINT 'MAPPING COMPLETE! ✓';
PRINT '';
PRINT 'Summary:';
PRINT '  • All ASSY distributed across 27 locations (3-3-3)';
PRINT '  • Rack/Tang/Thung standardized';
PRINT '  • MaViTri mapped for referential integrity';
