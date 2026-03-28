-- Cấp quyền RMA/UPK cho user kết nối API (mặc định ysv — đổi tên nếu DB_USER khác).
-- Chạy trong SSMS bằng tài khoản có quyền db_owner / SA, sau khi đã chạy schema-rma-upk.sql.

USE MM_DB;
GO

GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.RmaUpkTonKho TO [ysv];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.RmaUpkChuyenKho TO [ysv];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.RmaUpkChuyenKhoChiTiet TO [ysv];
GRANT SELECT, INSERT ON dbo.RmaUpkDieuChinh TO [ysv];
GRANT SELECT, INSERT ON dbo.RmaUpkLichSu_SEVT TO [ysv];
GRANT SELECT, INSERT ON dbo.RmaUpkLichSu_VENDOR TO [ysv];
GRANT SELECT, INSERT ON dbo.RmaUpkLichSu_IQC TO [ysv];
GRANT SELECT, INSERT ON dbo.RmaUpkLichSu_MM TO [ysv];

PRINT N'Đã GRANT RMA/UPK cho [ysv].';
GO
