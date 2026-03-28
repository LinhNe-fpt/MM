-- Them 3 cot vao bang LinhKien: Rack, Tang, Thung
-- Chay script nay tren database co san (neu cot chua co)
USE MM_DB;
GO

-- Kiem tra va them cot Rack
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = N'LinhKien' AND COLUMN_NAME = N'Rack')
BEGIN
  ALTER TABLE dbo.LinhKien ADD Rack NVARCHAR(50) NULL;
  PRINT N'Da them cot Rack vao LinhKien.';
END
ELSE
  PRINT N'Cot Rack da ton tai.';

-- Kiem tra va them cot Tang
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = N'LinhKien' AND COLUMN_NAME = N'Tang')
BEGIN
  ALTER TABLE dbo.LinhKien ADD Tang INT NULL;
  PRINT N'Da them cot Tang vao LinhKien.';
END
ELSE
  PRINT N'Cot Tang da ton tai.';

-- Kiem tra va them cot Thung
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = N'LinhKien' AND COLUMN_NAME = N'Thung')
BEGIN
  ALTER TABLE dbo.LinhKien ADD Thung NVARCHAR(50) NULL;
  PRINT N'Da them cot Thung vao LinhKien.';
END
ELSE
  PRINT N'Cot Thung da ton tai.';

GO

-- Cap nhat du lieu mau (neu can)
UPDATE dbo.LinhKien
SET Rack = N'A', Tang = 1, Thung = N'A01'
WHERE ASSY = N'RC0805-10K';

UPDATE dbo.LinhKien
SET Rack = N'A', Tang = 1, Thung = N'A02'
WHERE ASSY = N'CC0603-100N';

UPDATE dbo.LinhKien
SET Rack = N'B', Tang = 2, Thung = N'B01'
WHERE ASSY = N'LED-0805-RED';

UPDATE dbo.LinhKien
SET Rack = N'B', Tang = 2, Thung = N'B02'
WHERE ASSY = N'IC-STM32F4';

UPDATE dbo.LinhKien
SET Rack = N'C', Tang = 3, Thung = N'C01'
WHERE ASSY = N'CONN-USB-C';

GO

-- Kiem tra
SELECT ASSY, MoTa, Rack, Tang, Thung FROM dbo.LinhKien;
