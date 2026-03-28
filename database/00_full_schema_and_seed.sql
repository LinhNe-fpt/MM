-- =============================================================================
-- MM_DB - CSDL day du theo form:
--   (1) Thong tin linh kien: ASSY, ASSYS CODE TONG, CODE CON, MO TA, Cum vat lieu, Model, He so -> LinhKien
--   (2) Chi tiet linh kien theo ASSY: No., Code, Item Description, Qty Plan, Qty kitting, He so, Don vi, Xuat SX, Remark -> ChiTietLinhKien
--   (3) Nhap: CODE, MODEL, Ton dau/cuoi, UPK, IQC, SX Tra Lại, SX Tra UPL -> PhieuKho(LoaiChiTiet) + ChiTietPhieuKho
--   (4) Xuat: CODE, MODEL, Ton dau/cuoi, RMA, SX UPL, FB UPL, Tra SX, RT, KITTING -> PhieuKho(LoaiChiTiet) + ChiTietPhieuKho
--   + NguoiDung (dang nhap), ViTriKho, TonKhoChiTiet
-- Chay trong SSMS: tao MM_DB, chon MM_DB, F5. Dang nhap admin (sa) de GRANT.
-- =============================================================================

USE MM_DB;
GO

-- ----- 1. XOA BANG (theo thu tu FK) -----
IF OBJECT_ID(N'dbo.TonKhoChiTiet', N'U') IS NOT NULL DROP TABLE dbo.TonKhoChiTiet;
IF OBJECT_ID(N'dbo.ChiTietPhieuKho', N'U') IS NOT NULL DROP TABLE dbo.ChiTietPhieuKho;
IF OBJECT_ID(N'dbo.PhieuKho', N'U') IS NOT NULL DROP TABLE dbo.PhieuKho;
IF OBJECT_ID(N'dbo.ChiTietLinhKien', N'U') IS NOT NULL DROP TABLE dbo.ChiTietLinhKien;
IF OBJECT_ID(N'dbo.LinhKien', N'U') IS NOT NULL DROP TABLE dbo.LinhKien;
IF OBJECT_ID(N'dbo.ViTriKho', N'U') IS NOT NULL DROP TABLE dbo.ViTriKho;
IF OBJECT_ID(N'dbo.NguoiDung', N'U') IS NOT NULL DROP TABLE dbo.NguoiDung;
GO

-- ----- 2. TAO BANG -----

-- Nguoi dung (dang nhap)
CREATE TABLE dbo.NguoiDung (
  MaNguoiDung INT IDENTITY(1,1) PRIMARY KEY,
  TaiKhoan VARCHAR(50) NOT NULL,
  MatKhau VARCHAR(255) NOT NULL,
  HoTen NVARCHAR(100) NULL,
  Quyen NVARCHAR(20) NULL
);

-- (1) Thong tin linh kien - Form anh 1: ASSY, ASSYS CODE TONG, CODE CON, MO TA, Cum vat lieu, Model, He so
CREATE TABLE dbo.LinhKien (
  ASSY VARCHAR(50) PRIMARY KEY,
  AssysCodeTong NVARCHAR(200) NULL,
  CodeCon NVARCHAR(100) NULL,
  MoTa NVARCHAR(500) NULL,
  CumVatLieu NVARCHAR(100) NULL,
  Model NVARCHAR(200) NULL,
  HeSo DECIMAL(18,4) NULL,
  TonToiThieu INT NULL,
  NgayTao DATETIME NULL
);

-- (2) Chi tiet linh kien truy van theo ASSY - Form anh 2: No., Code, Item Description, Qty Plan, Qty kitting, He so, Don vi, Xuat SX, Remark
CREATE TABLE dbo.ChiTietLinhKien (
  ID INT IDENTITY(1,1) PRIMARY KEY,
  MaAssy VARCHAR(50) NOT NULL,
  Stt INT NULL,
  Code NVARCHAR(50) NULL,
  ItemDescription NVARCHAR(500) NULL,
  QtyPlan DECIMAL(18,2) NULL,
  QtyKitting DECIMAL(18,2) NULL,
  HeSo DECIMAL(18,4) NULL,
  DonVi NVARCHAR(20) NULL,
  XuatSX DECIMAL(18,2) NULL,
  Remark NVARCHAR(500) NULL,
  CONSTRAINT FK_ChiTietLinhKien_Assy FOREIGN KEY (MaAssy) REFERENCES dbo.LinhKien(ASSY) ON DELETE CASCADE
);

-- Vi tri kho (day + thung)
CREATE TABLE dbo.ViTriKho (
  MaViTri INT IDENTITY(1,1) PRIMARY KEY,
  TenDay VARCHAR(20) NOT NULL,
  TenThung VARCHAR(20) NOT NULL,
  ToaDoX INT NULL,
  ToaDoY INT NULL,
  TrangThai NVARCHAR(50) NULL
);

-- (3)(4) Phieu nhap/xuat - LoaiChiTiet: Nhap = UPK, IQC, SX Tra Lại, SX Tra UPL; Xuat = RMA, SX UPL, FB UPL, Tra SX, RT, KITTING
CREATE TABLE dbo.PhieuKho (
  MaPhieu VARCHAR(20) PRIMARY KEY,
  LoaiGiaoDich NVARCHAR(10) NOT NULL,
  LoaiChiTiet NVARCHAR(50) NULL,
  NgayThucHien DATETIME NULL,
  MaNguoiDung INT NULL,
  GhiChu NVARCHAR(500) NULL,
  CONSTRAINT FK_PhieuKho_NguoiDung FOREIGN KEY (MaNguoiDung) REFERENCES dbo.NguoiDung(MaNguoiDung)
);

-- Chi tiet phieu: CODE, MODEL, SoLuong, Vi tri... (phuc vu form 3, 4)
CREATE TABLE dbo.ChiTietPhieuKho (
  ID INT IDENTITY(1,1) PRIMARY KEY,
  MaPhieu VARCHAR(20) NOT NULL,
  MaLinhKien VARCHAR(50) NULL,
  Model NVARCHAR(200) NULL,
  SoLuong DECIMAL(18,2) NOT NULL,
  MaViTri INT NULL,
  TiLeHaoHut DECIMAL(5,2) NULL,
  CONSTRAINT FK_ChiTietPhieu_MaPhieu FOREIGN KEY (MaPhieu) REFERENCES dbo.PhieuKho(MaPhieu) ON DELETE CASCADE,
  CONSTRAINT FK_ChiTietPhieu_Assy FOREIGN KEY (MaLinhKien) REFERENCES dbo.LinhKien(ASSY),
  CONSTRAINT FK_ChiTietPhieu_MaViTri FOREIGN KEY (MaViTri) REFERENCES dbo.ViTriKho(MaViTri)
);

-- Ton kho theo vi tri (CODE + Vi tri -> So luong)
CREATE TABLE dbo.TonKhoChiTiet (
  MaLinhKien VARCHAR(50) NOT NULL,
  MaViTri INT NOT NULL,
  SoLuongTon DECIMAL(18,2) NULL,
  PRIMARY KEY (MaLinhKien, MaViTri),
  CONSTRAINT FK_TonKho_Assy FOREIGN KEY (MaLinhKien) REFERENCES dbo.LinhKien(ASSY) ON DELETE CASCADE,
  CONSTRAINT FK_TonKho_ViTri FOREIGN KEY (MaViTri) REFERENCES dbo.ViTriKho(MaViTri) ON DELETE CASCADE
);

CREATE INDEX IX_ChiTietLinhKien_MaAssy ON dbo.ChiTietLinhKien(MaAssy);
CREATE INDEX IX_ChiTietPhieuKho_MaPhieu ON dbo.ChiTietPhieuKho(MaPhieu);
CREATE INDEX IX_TonKhoChiTiet_MaLinhKien ON dbo.TonKhoChiTiet(MaLinhKien);
GO

-- ----- 3. DU LIEU MAU -----

SET IDENTITY_INSERT dbo.NguoiDung ON;
INSERT INTO dbo.NguoiDung (MaNguoiDung, TaiKhoan, MatKhau, HoTen, Quyen) VALUES
  (1, N'admin', N'1', N'Quản trị', N'admin');
SET IDENTITY_INSERT dbo.NguoiDung OFF;

INSERT INTO dbo.LinhKien (ASSY, AssysCodeTong, CodeCon, MoTa, CumVatLieu, Model, HeSo, TonToiThieu, NgayTao) VALUES
  (N'RC0805-10K', N'TONG01', N'C01', N'Điện trở 10kΩ', N'Yageo', N'M1', 0.02, 2000, GETDATE()),
  (N'CC0603-100N', N'TONG02', N'C02', N'Tụ gốm 100nF', N'Murata', N'M2', 0.01, 1000, GETDATE()),
  (N'LED-0805-RED', N'TONG03', N'C03', N'LED đỏ 0805', N'Kingbright', NULL, 0.03, 500, GETDATE()),
  (N'IC-STM32F4', N'TONG04', N'C04', N'MCU STM32F407', N'STMicro', NULL, 0.005, 20, GETDATE()),
  (N'CONN-USB-C', N'TONG05', N'C05', N'USB-C Connector', N'Molex', NULL, 0.01, 500, GETDATE());

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

-- ----- 4. CAP QUYEN [ysv] -----
IF SUSER_SNAME() = 'ysv'
  PRINT N'Dang nhap bang [ysv]. Khong GRANT.';
ELSE
BEGIN
  GRANT SELECT ON dbo.NguoiDung TO [ysv];
  GRANT SELECT, INSERT, UPDATE ON dbo.LinhKien TO [ysv];
  GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.ChiTietLinhKien TO [ysv];
  GRANT SELECT ON dbo.ViTriKho TO [ysv];
  GRANT SELECT, INSERT, UPDATE ON dbo.PhieuKho TO [ysv];
  GRANT SELECT, INSERT, UPDATE ON dbo.ChiTietPhieuKho TO [ysv];
  GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.TonKhoChiTiet TO [ysv];
  PRINT N'Da cap quyen cho [ysv].';
END
GO
