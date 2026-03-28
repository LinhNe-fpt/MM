-- MM_DB - Tao cac bang. Chay trong SSMS (da tao database MM_DB). Sau do chay 02_seed.sql, 03_grant_permissions.sql.
-- (1) Thong tin linh kien  (2) Chi tiet theo ASSY  (3)(4) Nhap/Xuat theo loai  + NguoiDung, ViTriKho
USE MM_DB;
GO

IF OBJECT_ID(N'dbo.TonKhoChiTiet', N'U') IS NOT NULL DROP TABLE dbo.TonKhoChiTiet;
IF OBJECT_ID(N'dbo.ChiTietPhieuKho', N'U') IS NOT NULL DROP TABLE dbo.ChiTietPhieuKho;
IF OBJECT_ID(N'dbo.PhieuKho', N'U') IS NOT NULL DROP TABLE dbo.PhieuKho;
IF OBJECT_ID(N'dbo.ChiTietLinhKien', N'U') IS NOT NULL DROP TABLE dbo.ChiTietLinhKien;
IF OBJECT_ID(N'dbo.LinhKien', N'U') IS NOT NULL DROP TABLE dbo.LinhKien;
IF OBJECT_ID(N'dbo.ViTriKho', N'U') IS NOT NULL DROP TABLE dbo.ViTriKho;
IF OBJECT_ID(N'dbo.NguoiDung', N'U') IS NOT NULL DROP TABLE dbo.NguoiDung;
GO

CREATE TABLE dbo.NguoiDung (
  MaNguoiDung INT IDENTITY(1,1) PRIMARY KEY,
  TaiKhoan VARCHAR(50) NOT NULL,
  MatKhau VARCHAR(255) NOT NULL,
  HoTen NVARCHAR(100) NULL,
  Quyen NVARCHAR(20) NULL
);

-- (1) Form thong tin linh kien: ASSY, AssysCodeTong, CodeCon, MoTa, CumVatLieu, Model, HeSo
CREATE TABLE dbo.LinhKien (
  ASSY VARCHAR(50) PRIMARY KEY,
  AssysCodeTong NVARCHAR(200) NULL,
  CodeCon NVARCHAR(100) NULL,
  MoTa NVARCHAR(500) NULL,
  CumVatLieu NVARCHAR(100) NULL,
  Model NVARCHAR(200) NULL,
  HeSo DECIMAL(18,4) NULL,
  TonToiThieu INT NULL,
  Rack NVARCHAR(50) NULL,
  Tang INT NULL,
  Thung NVARCHAR(50) NULL,
  NgayTao DATETIME NULL
);

-- (2) Chi tiet linh kien truy van theo ASSY: Stt, Code, ItemDescription, QtyPlan, QtyKitting, HeSo, DonVi, XuatSX, Remark
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

CREATE TABLE dbo.ViTriKho (
  MaViTri INT IDENTITY(1,1) PRIMARY KEY,
  TenDay VARCHAR(20) NOT NULL,
  Tang INT NULL,
  ViTriO INT NULL,
  TenThung VARCHAR(20) NOT NULL,
  ToaDoX INT NULL,
  ToaDoY INT NULL,
  TrangThai NVARCHAR(50) NULL
);

-- (3) Nhap: UPK, IQC, SX Tra Lại, SX Tra UPL  (4) Xuat: RMA, SX UPL, FB UPL, Tra SX, RT, KITTING
CREATE TABLE dbo.PhieuKho (
  MaPhieu VARCHAR(20) PRIMARY KEY,
  LoaiGiaoDich NVARCHAR(10) NOT NULL,
  LoaiChiTiet NVARCHAR(50) NULL,
  NgayThucHien DATETIME NULL,
  MaNguoiDung INT NULL,
  GhiChu NVARCHAR(500) NULL,
  CONSTRAINT FK_PhieuKho_NguoiDung FOREIGN KEY (MaNguoiDung) REFERENCES dbo.NguoiDung(MaNguoiDung)
);

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
