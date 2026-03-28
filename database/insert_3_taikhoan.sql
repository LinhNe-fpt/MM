-- Thêm 3 tài khoản đăng nhập (NguoiDung)
-- Cột: TaiKhoan, MatKhau, HoTen, Quyen
USE MM_DB;
GO

INSERT INTO dbo.NguoiDung (TaiKhoan, MatKhau, HoTen, Quyen)
VALUES
  (N'nhanvien1', N'1', N'Nhân viên kho 1', N'staff'),
  (N'nhanvien2', N'1', N'Nhân viên kho 2', N'staff'),
  (N'kiemkho',   N'1', N'Kiểm kho', N'staff');

GO

-- Kiểm tra
SELECT MaNguoiDung, TaiKhoan, HoTen, Quyen FROM dbo.NguoiDung ORDER BY MaNguoiDung;
