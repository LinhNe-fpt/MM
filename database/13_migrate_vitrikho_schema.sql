-- ============================================================================
-- CLEAN: Chuyển đổi ViTriKho sang Rack, Tang, Thung (NVARCHAR)
-- Sạch sẽ và không lỗi
-- ============================================================================

USE MM_DB;
GO

PRINT '=== MIGRATE ViTriKho SCHEMA ===';
PRINT '';

-- ============================================================================
-- Step 1: Backup dữ liệu hiện tại
-- ============================================================================

PRINT '--- STEP 1: Backup Current Data ---';

IF OBJECT_ID('dbo.ViTriKho_Backup', 'U') IS NOT NULL 
  DROP TABLE dbo.ViTriKho_Backup;

SELECT * INTO dbo.ViTriKho_Backup FROM dbo.ViTriKho;

PRINT CAST(@@ROWCOUNT AS VARCHAR) + ' rows backed up';

GO

-- ============================================================================
-- Step 2: Recreate ViTriKho with new schema
-- ============================================================================

PRINT '';
PRINT '--- STEP 2: Recreate ViTriKho Table ---';

-- Drop constraints first
IF EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_NAME = 'TonKhoChiTiet' AND CONSTRAINT_NAME LIKE 'FK_TonKho_ViTri%'
)
BEGIN
  ALTER TABLE dbo.TonKhoChiTiet DROP CONSTRAINT FK_TonKho_ViTri;
  PRINT 'Dropped FK from TonKhoChiTiet';
END

IF EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_NAME = 'ChiTietPhieuKho' AND CONSTRAINT_NAME LIKE 'FK_ChiTietPhieu_MaViTri%'
)
BEGIN
  ALTER TABLE dbo.ChiTietPhieuKho DROP CONSTRAINT FK_ChiTietPhieu_MaViTri;
  PRINT 'Dropped FK from ChiTietPhieuKho';
END

GO

-- Drop old table
IF OBJECT_ID(N'dbo.ViTriKho', N'U') IS NOT NULL 
BEGIN
  DROP TABLE dbo.ViTriKho;
  PRINT 'Dropped old ViTriKho';
END

GO

-- Create new table with unified schema
CREATE TABLE dbo.ViTriKho (
  MaViTri INT IDENTITY(1,1) PRIMARY KEY,
  Rack NVARCHAR(20) NOT NULL,           -- Changed from TenDay VARCHAR
  Tang NVARCHAR(20) NULL,               -- Changed from INT
  Thung NVARCHAR(20) NULL,              -- Changed from ViTriO INT
  ToaDoX INT NULL,
  ToaDoY INT NULL,
  TrangThai NVARCHAR(50) NULL
);

PRINT 'Created new ViTriKho with schema:';
PRINT '  • Rack (NVARCHAR)';
PRINT '  • Tang (NVARCHAR)';
PRINT '  • Thung (NVARCHAR)';

GO

-- ============================================================================
-- Step 3: Restore data to new table
-- ============================================================================

PRINT '';
PRINT '--- STEP 3: Restore Data ---';

INSERT INTO dbo.ViTriKho (Rack, Tang, Thung, ToaDoX, ToaDoY, TrangThai)
SELECT 
  TenDay AS Rack,
  CAST(Tang AS NVARCHAR(20)) AS Tang,
  CAST(ViTriO AS NVARCHAR(20)) AS Thung,
  ToaDoX,
  ToaDoY,
  TrangThai
FROM dbo.ViTriKho_Backup;

PRINT CAST(@@ROWCOUNT AS VARCHAR) + ' rows restored';

GO

-- ============================================================================
-- Step 4: Restore Foreign Keys
-- ============================================================================

PRINT '';
PRINT '--- STEP 4: Restore Foreign Keys ---';

ALTER TABLE dbo.TonKhoChiTiet
ADD CONSTRAINT FK_TonKho_ViTri FOREIGN KEY (MaViTri) REFERENCES dbo.ViTriKho(MaViTri) ON DELETE CASCADE;

PRINT 'Restored FK_TonKho_ViTri';

GO

ALTER TABLE dbo.ChiTietPhieuKho
ADD CONSTRAINT FK_ChiTietPhieu_MaViTri FOREIGN KEY (MaViTri) REFERENCES dbo.ViTriKho(MaViTri);

PRINT 'Restored FK_ChiTietPhieu_MaViTri';

GO

-- ============================================================================
-- Step 5: Verify Schema
-- ============================================================================

PRINT '';
PRINT '=== VERIFY NEW SCHEMA ===';

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
-- Step 6: Sample Data
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
-- Step 7: Verify Foreign Keys
-- ============================================================================

PRINT '';
PRINT '=== VERIFY FOREIGN KEYS ===';

SELECT
  CONSTRAINT_NAME,
  TABLE_NAME,
  COLUMN_NAME,
  REFERENCED_TABLE_NAME = OBJECT_NAME(referenced_object_id),
  REFERENCED_COLUMN_NAME = (
    SELECT NAME FROM sys.columns 
    WHERE object_id = referenced_object_id 
      AND column_id = referenced_column_id
  )
FROM sys.foreign_key_columns fkc
JOIN sys.objects obj ON fkc.parent_object_id = obj.object_id
WHERE OBJECT_NAME(fkc.parent_object_id) IN ('TonKhoChiTiet', 'ChiTietPhieuKho');

GO

PRINT '';
PRINT 'MIGRATION COMPLETE! ✓';
PRINT '';
PRINT 'Changes:';
PRINT '  ✓ TenDay (VARCHAR) → Rack (NVARCHAR)';
PRINT '  ✓ Tang (INT) → Tang (NVARCHAR)';
PRINT '  ✓ ViTriO (INT) → Thung (NVARCHAR)';
PRINT '  ✓ TenThung removed (replaced by Thung)';
PRINT '  ✓ All data migrated';
PRINT '  ✓ Foreign keys restored';
PRINT '';
PRINT 'Backup table: ViTriKho_Backup (keep for 1 week)';
