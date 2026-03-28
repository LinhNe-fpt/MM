USE MM_DB;
GO

PRINT '=== ADD TongTon TO LinhKien ===';

-- 1) Add column TongTon if not exists
IF NOT EXISTS (
  SELECT 1
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'LinhKien' AND COLUMN_NAME = 'TongTon'
)
BEGIN
  ALTER TABLE dbo.LinhKien
    ADD TongTon DECIMAL(18,2) NULL;
  PRINT 'Added column LinhKien.TongTon';
END
ELSE
BEGIN
  PRINT 'Column LinhKien.TongTon already exists';
END
GO

-- 2) Backfill TongTon from TonKhoChiTiet
;WITH StockAgg AS (
  SELECT
    MaLinhKien,
    SUM(ISNULL(SoLuongTon, 0)) AS TongSoLuongTon
  FROM dbo.TonKhoChiTiet
  GROUP BY MaLinhKien
)
UPDATE lk
SET lk.TongTon = ISNULL(sa.TongSoLuongTon, 0)
FROM dbo.LinhKien lk
LEFT JOIN StockAgg sa ON sa.MaLinhKien = lk.ASSY;

PRINT 'Backfilled TongTon from TonKhoChiTiet';
GO

-- 3) Create/replace trigger to auto-sync TongTon when stock detail changes
IF OBJECT_ID(N'dbo.TR_TonKhoChiTiet_SyncTongTon', N'TR') IS NOT NULL
BEGIN
  DROP TRIGGER dbo.TR_TonKhoChiTiet_SyncTongTon;
END
GO

CREATE TRIGGER dbo.TR_TonKhoChiTiet_SyncTongTon
ON dbo.TonKhoChiTiet
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;

  ;WITH Changed AS (
    SELECT DISTINCT MaLinhKien FROM inserted
    UNION
    SELECT DISTINCT MaLinhKien FROM deleted
  ),
  Agg AS (
    SELECT
      t.MaLinhKien,
      SUM(ISNULL(t.SoLuongTon, 0)) AS TongSoLuongTon
    FROM dbo.TonKhoChiTiet t
    INNER JOIN Changed c ON c.MaLinhKien = t.MaLinhKien
    GROUP BY t.MaLinhKien
  )
  UPDATE lk
  SET lk.TongTon = ISNULL(a.TongSoLuongTon, 0)
  FROM dbo.LinhKien lk
  INNER JOIN Changed c ON c.MaLinhKien = lk.ASSY
  LEFT JOIN Agg a ON a.MaLinhKien = lk.ASSY;
END
GO

PRINT 'Created trigger TR_TonKhoChiTiet_SyncTongTon';
GO

-- 4) Verify
SELECT TOP 30
  lk.ASSY,
  lk.MoTa,
  lk.TongTon,
  lk.TonToiThieu
FROM dbo.LinhKien lk
ORDER BY lk.ASSY;
GO

PRINT 'DONE: TongTon added and synced automatically.';
