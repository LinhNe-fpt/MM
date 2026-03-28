-- CAP NHAT TEN DAY (TenDay) TU DANG "DAY XX" SANG CHU CAI A, B, C, ...
-- Trong bang ViTriKho
USE MM_DB;
GO

-- Map TenDay cu sang chu cai
-- DÃY 01 -> A
-- DÃY 02 -> B
-- DÃY 03 -> C
-- ...

UPDATE dbo.ViTriKho SET TenDay = N'A' WHERE TenDay = N'DÃY 01';
UPDATE dbo.ViTriKho SET TenDay = N'B' WHERE TenDay = N'DÃY 02';
UPDATE dbo.ViTriKho SET TenDay = N'C' WHERE TenDay = N'DÃY 03';

GO

-- Neu co nhieu day hon, them cac dong sau:
/*
UPDATE dbo.ViTriKho SET TenDay = N'D' WHERE TenDay = N'DÃY 04';
UPDATE dbo.ViTriKho SET TenDay = N'E' WHERE TenDay = N'DÃY 05';
-- ... va tiep tuc
*/

-- KIEM TRA KET QUA
SELECT DISTINCT TenDay FROM dbo.ViTriKho ORDER BY TenDay;

-- Xem chi tiet
SELECT MaViTri, TenDay, TenThung FROM dbo.ViTriKho ORDER BY TenDay, MaViTri;
