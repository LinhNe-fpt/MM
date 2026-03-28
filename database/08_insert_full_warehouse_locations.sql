-- ============================================================================
-- FULL WAREHOUSE LOCATION DATA
-- Dữ liệu vị trí kho đầy đủ: Dãy A (3 tầng x 3 ô), Dãy B (2 tầng x 3 ô), Dãy C (2 tầng x 2 ô)
-- Mỗi ô có: TenDay (Dãy), Tang (Tầng), ViTriO (Vị trí ô), TenThung (Tên ô)
-- ============================================================================

USE MM_DB;
GO

-- Clear existing data (nếu cần)
-- DELETE FROM dbo.ViTriKho;
-- DBCC CHECKIDENT (ViTriKho, RESEED, 0);

-- ============================================================================
-- DÃY A: 3 Tầng x 3 Ô = 9 Ô
-- ============================================================================

-- Tầng 1: A-1-1, A-1-2, A-1-3
INSERT INTO dbo.ViTriKho (TenDay, Tang, ViTriO, TenThung, TrangThai) VALUES
  (N'A', 1, 1, N'A1', 1),
  (N'A', 1, 2, N'A2', 1),
  (N'A', 1, 3, N'A3', 1);

-- Tầng 2: A-2-1, A-2-2, A-2-3
INSERT INTO dbo.ViTriKho (TenDay, Tang, ViTriO, TenThung, TrangThai) VALUES
  (N'A', 2, 1, N'A4', 1),
  (N'A', 2, 2, N'A5', 1),
  (N'A', 2, 3, N'A6', 1);

-- Tầng 3: A-3-1, A-3-2, A-3-3
INSERT INTO dbo.ViTriKho (TenDay, Tang, ViTriO, TenThung, TrangThai) VALUES
  (N'A', 3, 1, N'A7', 1),
  (N'A', 3, 2, N'A8', 1),
  (N'A', 3, 3, N'A9', 1);

PRINT 'Dãy A inserted: 9 locations';

GO

-- ============================================================================
-- DÃY B: 2 Tầng x 3 Ô = 6 Ô
-- ============================================================================

-- Tầng 1: B-1-1, B-1-2, B-1-3
INSERT INTO dbo.ViTriKho (TenDay, Tang, ViTriO, TenThung, TrangThai) VALUES
  (N'B', 1, 1, N'B1', 1),
  (N'B', 1, 2, N'B2', 1),
  (N'B', 1, 3, N'B3', 1);

-- Tầng 2: B-2-1, B-2-2, B-2-3
INSERT INTO dbo.ViTriKho (TenDay, Tang, ViTriO, TenThung, TrangThai) VALUES
  (N'B', 2, 1, N'B4', 1),
  (N'B', 2, 2, N'B5', 1),
  (N'B', 2, 3, N'B6', 1);

PRINT 'Dãy B inserted: 6 locations';

GO

-- ============================================================================
-- DÃY C: 2 Tầng x 2 Ô = 4 Ô
-- ============================================================================

-- Tầng 1: C-1-1, C-1-2
INSERT INTO dbo.ViTriKho (TenDay, Tang, ViTriO, TenThung, TrangThai) VALUES
  (N'C', 1, 1, N'C1', 1),
  (N'C', 1, 2, N'C2', 1);

-- Tầng 2: C-2-1, C-2-2
INSERT INTO dbo.ViTriKho (TenDay, Tang, ViTriO, TenThung, TrangThai) VALUES
  (N'C', 2, 1, N'C3', 1),
  (N'C', 2, 2, N'C4', 1);

PRINT 'Dãy C inserted: 4 locations';

GO

-- ============================================================================
-- VERIFY DATA
-- ============================================================================

PRINT '';
PRINT '=== TỔNG HỢP VỊ TRÍ KHO ===';
SELECT 
  TenDay AS [Dãy],
  Tang AS [Tầng],
  ViTriO AS [Vị trí ô],
  TenThung AS [Tên ô],
  TrangThai AS [Trạng thái]
FROM dbo.ViTriKho
ORDER BY TenDay, Tang, ViTriO;

PRINT '';
PRINT '=== THỐNG KÊ THEO DÃY ===';
SELECT 
  TenDay AS [Dãy],
  COUNT(*) AS [Tổng số ô]
FROM dbo.ViTriKho
GROUP BY TenDay
ORDER BY TenDay;

PRINT '';
PRINT '=== THỐNG KÊ THEO DÃY VÀ TẦNG ===';
SELECT 
  TenDay AS [Dãy],
  Tang AS [Tầng],
  COUNT(*) AS [Số ô trong tầng]
FROM dbo.ViTriKho
GROUP BY TenDay, Tang
ORDER BY TenDay, Tang;

PRINT '';
PRINT 'TOTAL: ' + CAST(COUNT(*) AS VARCHAR) + ' locations' 
FROM (SELECT COUNT(*) FROM dbo.ViTriKho) t(c);
