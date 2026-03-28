-- ============================================================================
-- SAMPLE DATA: Warehouse Layout by Tiers (Tầng)
-- Dãy A: 3 tầng x 3 ô mỗi tầng = 9 ô
-- Dãy B: 2 tầng x 3 ô mỗi tầng = 6 ô
-- Dãy C: 2 tầng x 2 ô mỗi tầng = 4 ô
-- ============================================================================
USE MM_DB;
GO

-- ============================================================================
-- 1. DÃY A - 3 Tầng x 3 Ô
-- ============================================================================

-- Tầng 1 - Ô A1, A2, A3
INSERT INTO dbo.ViTriKho (TenDay, Tang, ViTriO, TenThung, TrangThai) VALUES
  (N'A', 1, 1, N'A1', 1),
  (N'A', 1, 2, N'A2', 1),
  (N'A', 1, 3, N'A3', 1);

-- Tầng 2 - Ô A4, A5, A6
INSERT INTO dbo.ViTriKho (TenDay, Tang, ViTriO, TenThung, TrangThai) VALUES
  (N'A', 2, 1, N'A4', 1),
  (N'A', 2, 2, N'A5', 1),
  (N'A', 2, 3, N'A6', 1);

-- Tầng 3 - Ô A7, A8, A9
INSERT INTO dbo.ViTriKho (TenDay, Tang, ViTriO, TenThung, TrangThai) VALUES
  (N'A', 3, 1, N'A7', 1),
  (N'A', 3, 2, N'A8', 1),
  (N'A', 3, 3, N'A9', 1);

-- ============================================================================
-- 2. DÃY B - 2 Tầng x 3 Ô
-- ============================================================================

-- Tầng 1 - Ô B1, B2, B3
INSERT INTO dbo.ViTriKho (TenDay, Tang, ViTriO, TenThung, TrangThai) VALUES
  (N'B', 1, 1, N'B1', 1),
  (N'B', 1, 2, N'B2', 1),
  (N'B', 1, 3, N'B3', 1);

-- Tầng 2 - Ô B4, B5, B6
INSERT INTO dbo.ViTriKho (TenDay, Tang, ViTriO, TenThung, TrangThai) VALUES
  (N'B', 2, 1, N'B4', 1),
  (N'B', 2, 2, N'B5', 1),
  (N'B', 2, 3, N'B6', 1);

-- ============================================================================
-- 3. DÃY C - 2 Tầng x 2 Ô
-- ============================================================================

-- Tầng 1 - Ô C1, C2
INSERT INTO dbo.ViTriKho (TenDay, Tang, ViTriO, TenThung, TrangThai) VALUES
  (N'C', 1, 1, N'C1', 1),
  (N'C', 1, 2, N'C2', 1);

-- Tầng 2 - Ô C3, C4
INSERT INTO dbo.ViTriKho (TenDay, Tang, ViTriO, TenThung, TrangThai) VALUES
  (N'C', 2, 1, N'C3', 1),
  (N'C', 2, 2, N'C4', 1);

GO

-- ============================================================================
-- 4. INSERT ASSY (Linh Kiện) với vị trí Rack, Tầng, Thùng
-- ============================================================================

-- DÃY A - ASSY
INSERT INTO dbo.LinhKien (ASSY, MoTa, TonToiThieu, HeSo, Rack, Tang, Thung) VALUES
  (N'ASSY-A1', N'Assembly A tầng 1 ô 1', 100, 1, N'A', 1, N'A1'),
  (N'ASSY-A2', N'Assembly A tầng 1 ô 2', 150, 1, N'A', 1, N'A2'),
  (N'ASSY-A3', N'Assembly A tầng 1 ô 3', 200, 1, N'A', 1, N'A3'),
  (N'ASSY-A4', N'Assembly A tầng 2 ô 1', 120, 1, N'A', 2, N'A4'),
  (N'ASSY-A5', N'Assembly A tầng 2 ô 2', 180, 1, N'A', 2, N'A5'),
  (N'ASSY-A6', N'Assembly A tầng 2 ô 3', 250, 1, N'A', 2, N'A6'),
  (N'ASSY-A7', N'Assembly A tầng 3 ô 1', 110, 1, N'A', 3, N'A7'),
  (N'ASSY-A8', N'Assembly A tầng 3 ô 2', 160, 1, N'A', 3, N'A8'),
  (N'ASSY-A9', N'Assembly A tầng 3 ô 3', 220, 1, N'A', 3, N'A9');

-- DÃY B - ASSY
INSERT INTO dbo.LinhKien (ASSY, MoTa, TonToiThieu, HeSo, Rack, Tang, Thung) VALUES
  (N'ASSY-B1', N'Assembly B tầng 1 ô 1', 140, 1, N'B', 1, N'B1'),
  (N'ASSY-B2', N'Assembly B tầng 1 ô 2', 170, 1, N'B', 1, N'B2'),
  (N'ASSY-B3', N'Assembly B tầng 1 ô 3', 190, 1, N'B', 1, N'B3'),
  (N'ASSY-B4', N'Assembly B tầng 2 ô 1', 130, 1, N'B', 2, N'B4'),
  (N'ASSY-B5', N'Assembly B tầng 2 ô 2', 175, 1, N'B', 2, N'B5'),
  (N'ASSY-B6', N'Assembly B tầng 2 ô 3', 240, 1, N'B', 2, N'B6');

-- DÃY C - ASSY
INSERT INTO dbo.LinhKien (ASSY, MoTa, TonToiThieu, HeSo, Rack, Tang, Thung) VALUES
  (N'ASSY-C1', N'Assembly C tầng 1 ô 1', 100, 1, N'C', 1, N'C1'),
  (N'ASSY-C2', N'Assembly C tầng 1 ô 2', 150, 1, N'C', 1, N'C2'),
  (N'ASSY-C3', N'Assembly C tầng 2 ô 1', 120, 1, N'C', 2, N'C3'),
  (N'ASSY-C4', N'Assembly C tầng 2 ô 2', 180, 1, N'C', 2, N'C4');

PRINT 'LinhKien inserted successfully';
GO

-- ============================================================================
-- 5. INSERT TỒN KHO CHI TIẾT (TonKhoChiTiet)
-- ============================================================================

-- Lấy MaViTri từ ViTriKho
DECLARE @maViTri_A1 INT, @maViTri_A2 INT, @maViTri_A3 INT;
DECLARE @maViTri_B1 INT, @maViTri_B2 INT, @maViTri_B3 INT;
DECLARE @maViTri_C1 INT, @maViTri_C2 INT;

SELECT @maViTri_A1 = MaViTri FROM dbo.ViTriKho WHERE TenDay = N'A' AND TenThung = N'A1';
SELECT @maViTri_A2 = MaViTri FROM dbo.ViTriKho WHERE TenDay = N'A' AND TenThung = N'A2';
SELECT @maViTri_A3 = MaViTri FROM dbo.ViTriKho WHERE TenDay = N'A' AND TenThung = N'A3';
SELECT @maViTri_B1 = MaViTri FROM dbo.ViTriKho WHERE TenDay = N'B' AND TenThung = N'B1';
SELECT @maViTri_B2 = MaViTri FROM dbo.ViTriKho WHERE TenDay = N'B' AND TenThung = N'B2';
SELECT @maViTri_B3 = MaViTri FROM dbo.ViTriKho WHERE TenDay = N'B' AND TenThung = N'B3';
SELECT @maViTri_C1 = MaViTri FROM dbo.ViTriKho WHERE TenDay = N'C' AND TenThung = N'C1';
SELECT @maViTri_C2 = MaViTri FROM dbo.ViTriKho WHERE TenDay = N'C' AND TenThung = N'C2';

-- Insert tồn kho cho các ASSY
INSERT INTO dbo.TonKhoChiTiet (MaViTri, MaLinhKien, SoLuongTon) VALUES
  (@maViTri_A1, N'ASSY-A1', 1200),
  (@maViTri_A2, N'ASSY-A2', 1500),
  (@maViTri_A3, N'ASSY-A3', 2000),
  (@maViTri_B1, N'ASSY-B1', 1400),
  (@maViTri_B2, N'ASSY-B2', 1700),
  (@maViTri_B3, N'ASSY-B3', 1900),
  (@maViTri_C1, N'ASSY-C1', 1000),
  (@maViTri_C2, N'ASSY-C2', 1500);

GO

-- ============================================================================
-- 6. VERIFY DATA
-- ============================================================================

PRINT '=== ViTriKho Structure ===';
SELECT TenDay, TenThung, COUNT(*) as SoOThung
FROM dbo.ViTriKho
GROUP BY TenDay, TenThung
ORDER BY TenDay, TenThung;

PRINT '';
PRINT '=== LinhKien by Rack and Tier ===';
SELECT Rack, Tang, Thung, ASSY, MoTa, TonToiThieu
FROM dbo.LinhKien
WHERE Rack IS NOT NULL AND Tang IS NOT NULL
ORDER BY Rack, Tang, Thung, ASSY;

PRINT '';
PRINT '=== Tồn Kho Tổng Hợp ===';
SELECT 
  l.Rack,
  l.Tang,
  l.Thung,
  l.ASSY,
  l.MoTa,
  SUM(t.SoLuongTon) as TongSoLuong,
  l.TonToiThieu
FROM dbo.LinhKien l
LEFT JOIN dbo.TonKhoChiTiet t ON t.MaLinhKien = l.ASSY
WHERE l.Rack IS NOT NULL
GROUP BY l.Rack, l.Tang, l.Thung, l.ASSY, l.MoTa, l.TonToiThieu
ORDER BY l.Rack, l.Tang, l.Thung, l.ASSY;
