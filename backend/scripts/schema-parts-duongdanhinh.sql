-- Ảnh linh kiện: URL hoặc đường dẫn tương đối (tùy triển khai)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.Parts') AND name = N'DuongDanHinh'
)
BEGIN
  ALTER TABLE dbo.Parts ADD DuongDanHinh NVARCHAR(1000) NULL;
END
GO
