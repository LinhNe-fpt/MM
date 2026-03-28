/* Cấp quyền cho app-user (ví dụ: ysv) trên phân hệ KHSX */
USE MM_DB;
GO

GRANT SELECT, INSERT, UPDATE ON dbo.KeHoachSanXuat TO ysv;
GRANT SELECT, INSERT, UPDATE ON dbo.KeHoachSanXuatImportBatch TO ysv;
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.KeHoachSanXuatImportLoi TO ysv;
GO
