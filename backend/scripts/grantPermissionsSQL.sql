-- Chạy script này trong SSMS bằng tài khoản SA hoặc db_owner
-- Cấp quyền đầy đủ cho user 'ysv' trên database MM_DB

USE MM_DB;
GO

-- LinhKien (CRUD components)
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.LinhKien TO [ysv];

-- ChiTietLinhKien (CRUD BOM)
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.ChiTietLinhKien TO [ysv];

-- NguoiDung (CRUD users)
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.NguoiDung TO [ysv];

-- BoPhan + VaiTro (danh muc bo phan / vai tro — schema-bophan-vaitro.sql)
GRANT SELECT ON dbo.BoPhan TO [ysv];
GRANT SELECT ON dbo.VaiTro TO [ysv];
GRANT SELECT ON dbo.vw_NguoiDung_VaiTro TO [ysv];

-- ViTriKho (warehouse positions)
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.ViTriKho TO [ysv];

-- TonKhoChiTiet (stock per bin)
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.TonKhoChiTiet TO [ysv];

-- PhieuKho + ChiTietPhieuKho (transactions)
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.PhieuKho TO [ysv];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.ChiTietPhieuKho TO [ysv];

-- RMA / UPK (module tách MM — bảng tạo bởi schema-rma-upk.sql)
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.RmaUpkTonKho TO [ysv];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.RmaUpkChuyenKho TO [ysv];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.RmaUpkChuyenKhoChiTiet TO [ysv];
GRANT SELECT, INSERT ON dbo.RmaUpkDieuChinh TO [ysv];
GRANT SELECT, INSERT ON dbo.RmaUpkLichSu_SEVT TO [ysv];
GRANT SELECT, INSERT ON dbo.RmaUpkLichSu_VENDOR TO [ysv];
GRANT SELECT, INSERT ON dbo.RmaUpkLichSu_IQC TO [ysv];
GRANT SELECT, INSERT ON dbo.RmaUpkLichSu_MM TO [ysv];

PRINT 'Đã cấp quyền thành công cho user ysv';
GO
