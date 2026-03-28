-- PCBA-MAIN-V1: 1 ASSY trong LinhKien, 10 code thành phần trong ChiTietLinhKien
-- LinhKien: khóa chính ASSY -> mỗi ASSY chỉ 1 dòng
-- ChiTietLinhKien: nhiều dòng cho mỗi ASSY (danh sách code thuộc ASSY)
USE MM_DB;
GO

-- (1) Một dòng ASSY trong LinhKien (nếu chưa có)
IF NOT EXISTS (SELECT 1 FROM dbo.LinhKien WHERE ASSY = 'PCBA-MAIN-V1')
INSERT INTO dbo.LinhKien (ASSY, AssysCodeTong, CodeCon, MoTa, CumVatLieu, Model, HeSo, TonToiThieu, NgayTao)
VALUES ('PCBA-MAIN-V1', N'PCBA-MAIN-V1', N'C-001', N'PCBA Main Board V1', NULL, N'M1', 0.0200, 2000, GETDATE());

-- (2) Các mã code thuộc ASSY PCBA-MAIN-V1 -> bảng ChiTietLinhKien
INSERT INTO dbo.ChiTietLinhKien (MaAssy, Stt, Code, ItemDescription, QtyPlan, QtyKitting, HeSo, DonVi, XuatSX, Remark)
VALUES
  (N'PCBA-MAIN-V1', 1, N'T-RES-01', N'Điện trở SMD 10k 1/16W', 2000, NULL, 0.0200, N'pcs', NULL, NULL),
  (N'PCBA-MAIN-V1', 2, N'T-RES-02', N'Điện trở SMD 1k 1/16W', 2000, NULL, 0.0200, N'pcs', NULL, NULL),
  (N'PCBA-MAIN-V1', 3, N'T-CAP-01', N'Tụ gốm 100nF 50V', 5000, NULL, 0.0100, N'pcs', NULL, NULL),
  (N'PCBA-MAIN-V1', 4, N'T-CAP-02', N'Tụ hóa 10uF 25V', 500, NULL, 0.0500, N'pcs', NULL, NULL),
  (N'PCBA-MAIN-V1', 5, N'T-IC-01',  N'IC ổn áp 3.3V LDO', 100, NULL, 1.0000, N'pcs', NULL, NULL),
  (N'PCBA-MAIN-V1', 6, N'T-IC-02',  N'Vi điều khiển STM32F103', 50, NULL, 1.0000, N'pcs', NULL, NULL),
  (N'PCBA-MAIN-V1', 7, N'T-LED-01', N'LED xanh lá 0603', 1000, NULL, 0.0300, N'pcs', NULL, NULL),
  (N'PCBA-MAIN-V1', 8, N'T-DIO-01', N'Diode Schottky 1A', 800, NULL, 0.0400, N'pcs', NULL, NULL),
  (N'PCBA-MAIN-V1', 9, N'T-CON-01', N'Header 2.54mm 10 pin', 200, NULL, 1.0000, N'pcs', NULL, NULL),
  (N'PCBA-MAIN-V1', 10, N'T-SW-01',  N'Nút nhấn Reset SMD', 300, NULL, 0.1000, N'pcs', NULL, NULL);

GO

-- Kiểm tra
SELECT * FROM dbo.LinhKien WHERE ASSY = 'PCBA-MAIN-V1';
SELECT * FROM dbo.ChiTietLinhKien WHERE MaAssy = 'PCBA-MAIN-V1' ORDER BY Stt;
