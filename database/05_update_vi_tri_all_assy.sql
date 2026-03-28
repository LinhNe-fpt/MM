-- CAP NHAT VI TRI (Rack, Tang, Thung) CHO CAC MA LINH KIEN
-- Voi du lieu co san (ASSY-01 -> ASSY-10, CC0603-100N, CONN-USB-C, IC-STM32F4, LED-0805-RED, PCBA-MAIN-V1, RC0805-10K)
USE MM_DB;
GO

-- ASSY-01
UPDATE dbo.LinhKien SET Rack = N'A', Tang = 1, Thung = N'A01' WHERE ASSY = N'ASSY-01';

-- ASSY-02
UPDATE dbo.LinhKien SET Rack = N'A', Tang = 1, Thung = N'A02' WHERE ASSY = N'ASSY-02';

-- ASSY-03
UPDATE dbo.LinhKien SET Rack = N'A', Tang = 1, Thung = N'A03' WHERE ASSY = N'ASSY-03';

-- ASSY-04
UPDATE dbo.LinhKien SET Rack = N'A', Tang = 2, Thung = N'A04' WHERE ASSY = N'ASSY-04';

-- ASSY-05
UPDATE dbo.LinhKien SET Rack = N'A', Tang = 2, Thung = N'A05' WHERE ASSY = N'ASSY-05';

-- ASSY-06
UPDATE dbo.LinhKien SET Rack = N'B', Tang = 1, Thung = N'B01' WHERE ASSY = N'ASSY-06';

-- ASSY-07
UPDATE dbo.LinhKien SET Rack = N'B', Tang = 1, Thung = N'B02' WHERE ASSY = N'ASSY-07';

-- ASSY-08
UPDATE dbo.LinhKien SET Rack = N'B', Tang = 2, Thung = N'B03' WHERE ASSY = N'ASSY-08';

-- ASSY-09
UPDATE dbo.LinhKien SET Rack = N'B', Tang = 2, Thung = N'B04' WHERE ASSY = N'ASSY-09';

-- ASSY-10
UPDATE dbo.LinhKien SET Rack = N'C', Tang = 1, Thung = N'C01' WHERE ASSY = N'ASSY-10';

-- CC0603-100N (da co: A, 1, A02)
UPDATE dbo.LinhKien SET Rack = N'A', Tang = 1, Thung = N'A02' WHERE ASSY = N'CC0603-100N';

-- CONN-USB-C (da co: B, 3, C01)
UPDATE dbo.LinhKien SET Rack = N'B', Tang = 3, Thung = N'C01' WHERE ASSY = N'CONN-USB-C';

-- IC-STM32F4 (da co: B, 2, B02)
UPDATE dbo.LinhKien SET Rack = N'B', Tang = 2, Thung = N'B02' WHERE ASSY = N'IC-STM32F4';

-- LED-0805-RED (da co: B, 2, B01)
UPDATE dbo.LinhKien SET Rack = N'B', Tang = 2, Thung = N'B01' WHERE ASSY = N'LED-0805-RED';

-- PCBA-MAIN-V1
UPDATE dbo.LinhKien SET Rack = N'C', Tang = 1, Thung = N'C02' WHERE ASSY = N'PCBA-MAIN-V1';

-- RC0805-10K (da co: A, 1, A01)
UPDATE dbo.LinhKien SET Rack = N'A', Tang = 1, Thung = N'A01' WHERE ASSY = N'RC0805-10K';

GO

-- KIEM TRA KET QUA
SELECT ASSY, MoTa, Rack, Tang, Thung 
FROM dbo.LinhKien 
WHERE ASSY IN (
  N'ASSY-01', N'ASSY-02', N'ASSY-03', N'ASSY-04', N'ASSY-05',
  N'ASSY-06', N'ASSY-07', N'ASSY-08', N'ASSY-09', N'ASSY-10',
  N'CC0603-100N', N'CONN-USB-C', N'IC-STM32F4', N'LED-0805-RED', N'PCBA-MAIN-V1', N'RC0805-10K'
)
ORDER BY ASSY;
