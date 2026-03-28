-- ============================================================================
-- INSERT: Complete ViTriKho Data (3 Dãy × 3 Tầng × 3 Ô = 27 vị trí)
-- Format: Rack - Tang - Thung (3-3-3)
-- ============================================================================

USE MM_DB;
GO

PRINT '=== INSERT COMPLETE ViTriKho DATA ===';
PRINT '';

-- ============================================================================
-- Option: Clear existing data (nếu muốn fresh start)
-- ============================================================================

-- PRINT '--- Clear existing data ---';
-- DELETE FROM dbo.TonKhoChiTiet WHERE MaViTri IN (SELECT MaViTri FROM dbo.ViTriKho);
-- DELETE FROM dbo.ViTriKho;
-- DBCC CHECKIDENT (ViTriKho, RESEED, 0);
-- PRINT 'Cleared old data';

-- GO

-- ============================================================================
-- INSERT: Dãy A (3 tầng × 3 ô)
-- ============================================================================

PRINT '--- Dãy A: Tầng 1-3, Ô 1-3 ---';

INSERT INTO dbo.ViTriKho (Rack, Tang, Thung, TrangThai)
VALUES
  -- Tầng 1
  (N'A', N'1', N'1', N'active'),
  (N'A', N'1', N'2', N'active'),
  (N'A', N'1', N'3', N'active'),
  -- Tầng 2
  (N'A', N'2', N'1', N'active'),
  (N'A', N'2', N'2', N'active'),
  (N'A', N'2', N'3', N'active'),
  -- Tầng 3
  (N'A', N'3', N'1', N'active'),
  (N'A', N'3', N'2', N'active'),
  (N'A', N'3', N'3', N'active');

PRINT CAST(@@ROWCOUNT AS VARCHAR) + ' rows inserted';

GO

-- ============================================================================
-- INSERT: Dãy B (3 tầng × 3 ô)
-- ============================================================================

PRINT '';
PRINT '--- Dãy B: Tầng 1-3, Ô 1-3 ---';

INSERT INTO dbo.ViTriKho (Rack, Tang, Thung, TrangThai)
VALUES
  -- Tầng 1
  (N'B', N'1', N'1', N'active'),
  (N'B', N'1', N'2', N'active'),
  (N'B', N'1', N'3', N'active'),
  -- Tầng 2
  (N'B', N'2', N'1', N'active'),
  (N'B', N'2', N'2', N'active'),
  (N'B', N'2', N'3', N'active'),
  -- Tầng 3
  (N'B', N'3', N'1', N'active'),
  (N'B', N'3', N'2', N'active'),
  (N'B', N'3', N'3', N'active');

PRINT CAST(@@ROWCOUNT AS VARCHAR) + ' rows inserted';

GO

-- ============================================================================
-- INSERT: Dãy C (3 tầng × 3 ô)
-- ============================================================================

PRINT '';
PRINT '--- Dãy C: Tầng 1-3, Ô 1-3 ---';

INSERT INTO dbo.ViTriKho (Rack, Tang, Thung, TrangThai)
VALUES
  -- Tầng 1
  (N'C', N'1', N'1', N'active'),
  (N'C', N'1', N'2', N'active'),
  (N'C', N'1', N'3', N'active'),
  -- Tầng 2
  (N'C', N'2', N'1', N'active'),
  (N'C', N'2', N'2', N'active'),
  (N'C', N'2', N'3', N'active'),
  -- Tầng 3
  (N'C', N'3', N'1', N'active'),
  (N'C', N'3', N'2', N'active'),
  (N'C', N'3', N'3', N'active');

PRINT CAST(@@ROWCOUNT AS VARCHAR) + ' rows inserted';

GO

-- ============================================================================
-- VERIFY: Display all data
-- ============================================================================

PRINT '';
PRINT '=== VERIFY DATA ===';
PRINT '';

SELECT 
  MaViTri,
  Rack,
  Tang,
  Thung,
  TrangThai
FROM dbo.ViTriKho
ORDER BY Rack, CAST(Tang AS INT), CAST(Thung AS INT);

GO

-- ============================================================================
-- STATISTICS: Count by Rack and Tang
-- ============================================================================

PRINT '';
PRINT '=== STATISTICS ===';

PRINT '';
PRINT 'Total locations:';
SELECT COUNT(*) AS 'Total' FROM dbo.ViTriKho;

PRINT '';
PRINT 'By Rack:';
SELECT 
  Rack,
  COUNT(*) AS 'Total Locations'
FROM dbo.ViTriKho
GROUP BY Rack
ORDER BY Rack;

PRINT '';
PRINT 'By Rack and Tang:';
SELECT 
  Rack,
  Tang,
  COUNT(*) AS 'Ô per Tầng'
FROM dbo.ViTriKho
GROUP BY Rack, Tang
ORDER BY Rack, CAST(Tang AS INT);

GO

-- ============================================================================
-- Display as formatted view (Rack - Tang - Thung)
-- ============================================================================

PRINT '';
PRINT '=== FORMATTED VIEW ===';

SELECT 
  MaViTri,
  CONCAT(Rack, '-', Tang, '-', Thung) AS 'Location (Rack-Tang-Thung)',
  TrangThai
FROM dbo.ViTriKho
ORDER BY Rack, CAST(Tang AS INT), CAST(Thung AS INT);

GO

PRINT '';
PRINT 'INSERTION COMPLETE! ✓';
PRINT '';
PRINT 'Summary:';
PRINT '  • 3 Dãy (A, B, C)';
PRINT '  • 3 Tầng mỗi dãy (1, 2, 3)';
PRINT '  • 3 Ô mỗi tầng (1, 2, 3)';
PRINT '  • Tổng: 27 vị trí';
PRINT '';
PRINT 'Example locations:';
PRINT '  A-1-1, A-1-2, A-1-3, ...';
PRINT '  A-2-1, A-2-2, A-2-3, ...';
PRINT '  B-1-1, B-1-2, ... C-3-3';
