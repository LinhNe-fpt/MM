-- MM_DB - Du lieu mau. Chay sau 01_schema.sql (bang rong).
USE MM_DB;
GO

SET IDENTITY_INSERT dbo.NguoiDung ON;
INSERT INTO dbo.NguoiDung (MaNguoiDung, TaiKhoan, MatKhau, HoTen, Quyen) VALUES
  (1, N'admin', N'1', N'Quản trị', N'admin');
SET IDENTITY_INSERT dbo.NguoiDung OFF;

INSERT INTO dbo.LinhKien (ASSY, AssysCodeTong, CodeCon, MoTa, CumVatLieu, Model, HeSo, TonToiThieu, Rack, Tang, Thung, NgayTao) VALUES
  (N'RC0805-10K', N'TONG01', N'C01', N'Điện trở 10kΩ', N'Yageo', N'M1', 0.02, 2000, N'A', 1, N'A01', GETDATE()),
  (N'CC0603-100N', N'TONG02', N'C02', N'Tụ gốm 100nF', N'Murata', N'M2', 0.01, 1000, N'A', 1, N'A02', GETDATE()),
  (N'LED-0805-RED', N'TONG03', N'C03', N'LED đỏ 0805', N'Kingbright', NULL, 0.03, 500, N'B', 2, N'B01', GETDATE()),
  (N'IC-STM32F4', N'TONG04', N'C04', N'MCU STM32F407', N'STMicro', NULL, 0.005, 20, N'B', 2, N'B02', GETDATE()),
  (N'CONN-USB-C', N'TONG05', N'C05', N'USB-C Connector', N'Molex', NULL, 0.01, 500, N'C', 3, N'C01', GETDATE());

INSERT INTO dbo.ChiTietLinhKien (MaAssy, Stt, Code, ItemDescription, QtyPlan, QtyKitting, HeSo, DonVi, XuatSX, Remark) VALUES
  (N'RC0805-10K', 1, N'RC0805-10K', N'Điện trở 10kΩ', 1000, 500, 0.02, N'pcs', 100, NULL),
  (N'RC0805-10K', 2, N'CC0603-100N', N'Tụ 100nF', 200, 100, 0.01, N'pcs', 50, NULL),
  (N'CC0603-100N', 1, N'CC0603-100N', N'Tụ gốm 100nF', 500, 200, 0.01, N'pcs', 80, NULL);

INSERT INTO dbo.ViTriKho (TenDay, TenThung) VALUES
  (N'A', N'A1'), (N'A', N'A2'), (N'A', N'A3'), (N'A', N'A4'), (N'A', N'A5'), (N'A', N'A6'),
  (N'B', N'B1'), (N'B', N'B2'), (N'B', N'B3'), (N'B', N'B4'), (N'B', N'B5'), (N'B', N'B6'),
  (N'C', N'C1'), (N'C', N'C2'), (N'C', N'C3'), (N'C', N'C4'), (N'C', N'C5'), (N'C', N'C6');

INSERT INTO dbo.TonKhoChiTiet (MaLinhKien, MaViTri, SoLuongTon) VALUES
  (N'RC0805-10K', 1, 12400), (N'CC0603-100N', 2, 850), (N'LED-0805-RED', 3, 340), (N'IC-STM32F4', 5, 56), (N'CONN-USB-C', 6, 2100);

INSERT INTO dbo.PhieuKho (MaPhieu, LoaiGiaoDich, LoaiChiTiet, NgayThucHien, MaNguoiDung, GhiChu) VALUES
  (N'PHMAU01', N'IN', N'UPK', '2026-03-17 08:30:00', 1, NULL),
  (N'PHMAU02', N'OUT', N'RMA', '2026-03-17 09:15:00', 1, NULL);

INSERT INTO dbo.ChiTietPhieuKho (MaPhieu, MaLinhKien, Model, SoLuong, MaViTri, TiLeHaoHut) VALUES
  (N'PHMAU01', N'RC0805-10K', N'M1', 5000, 1, NULL),
  (N'PHMAU02', N'CC0603-100N', N'M2', 200, 2, NULL);

GO
