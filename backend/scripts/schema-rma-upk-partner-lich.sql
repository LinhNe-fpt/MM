-- Bảng lịch sử UPK theo đối tác (SEVT / VENDOR / IQC / MM). Chạy nếu DB chưa có.
USE MM_DB;
GO

/* Tăng tốc tìm kiếm code trong phiếu nhập/xuất */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RmaUpkTonKho_MaLinhKien' AND object_id = OBJECT_ID('dbo.RmaUpkTonKho'))
BEGIN
  CREATE INDEX IX_RmaUpkTonKho_MaLinhKien ON dbo.RmaUpkTonKho (MaLinhKien ASC) INCLUDE (MaKho, SoLuongTon);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RmaUpkLichSu_SEVT' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.RmaUpkLichSu_SEVT (
    MaDieuChinh INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    MaLinhKien  NVARCHAR(100) NOT NULL,
    Loai        NVARCHAR(10)  NOT NULL CONSTRAINT DF_RmaUpkLsSEVT_Loai DEFAULT (N'NHAP'),
    SoLuong     INT           NOT NULL,
    TonSau      INT           NOT NULL,
    MaNguoiDung INT           NOT NULL,
    NgayGio     DATETIME2     NOT NULL CONSTRAINT DF_RmaUpkLsSEVT_Ngay DEFAULT (SYSUTCDATETIME()),
    GhiChu      NVARCHAR(500) NULL,
    CONSTRAINT CK_RmaUpkLsSEVT_Loai CHECK (Loai IN (N'NHAP', N'XUAT')),
    CONSTRAINT CK_RmaUpkLsSEVT_SL   CHECK (SoLuong > 0)
  );
  CREATE INDEX IX_RmaUpkLsSEVT_Ngay ON dbo.RmaUpkLichSu_SEVT (NgayGio DESC);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RmaUpkLichSu_VENDOR' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.RmaUpkLichSu_VENDOR (
    MaDieuChinh INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    MaLinhKien  NVARCHAR(100) NOT NULL,
    Loai        NVARCHAR(10)  NOT NULL CONSTRAINT DF_RmaUpkLsV_Loai DEFAULT (N'NHAP'),
    SoLuong     INT           NOT NULL,
    TonSau      INT           NOT NULL,
    MaNguoiDung INT           NOT NULL,
    NgayGio     DATETIME2     NOT NULL CONSTRAINT DF_RmaUpkLsV_Ngay DEFAULT (SYSUTCDATETIME()),
    GhiChu      NVARCHAR(500) NULL,
    CONSTRAINT CK_RmaUpkLsV_Loai CHECK (Loai IN (N'NHAP', N'XUAT')),
    CONSTRAINT CK_RmaUpkLsV_SL   CHECK (SoLuong > 0)
  );
  CREATE INDEX IX_RmaUpkLsV_Ngay ON dbo.RmaUpkLichSu_VENDOR (NgayGio DESC);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RmaUpkLichSu_IQC' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.RmaUpkLichSu_IQC (
    MaDieuChinh INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    MaLinhKien  NVARCHAR(100) NOT NULL,
    Loai        NVARCHAR(10)  NOT NULL CONSTRAINT DF_RmaUpkLsIQC_Loai DEFAULT (N'XUAT'),
    SoLuong     INT           NOT NULL,
    TonSau      INT           NOT NULL,
    MaNguoiDung INT           NOT NULL,
    NgayGio     DATETIME2     NOT NULL CONSTRAINT DF_RmaUpkLsIQC_Ngay DEFAULT (SYSUTCDATETIME()),
    GhiChu      NVARCHAR(500) NULL,
    CONSTRAINT CK_RmaUpkLsIQC_Loai CHECK (Loai IN (N'NHAP', N'XUAT')),
    CONSTRAINT CK_RmaUpkLsIQC_SL   CHECK (SoLuong > 0)
  );
  CREATE INDEX IX_RmaUpkLsIQC_Ngay ON dbo.RmaUpkLichSu_IQC (NgayGio DESC);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RmaUpkLichSu_MM' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.RmaUpkLichSu_MM (
    MaDieuChinh INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    MaLinhKien  NVARCHAR(100) NOT NULL,
    Loai        NVARCHAR(10)  NOT NULL CONSTRAINT DF_RmaUpkLsMM_Loai DEFAULT (N'XUAT'),
    SoLuong     INT           NOT NULL,
    TonSau      INT           NOT NULL,
    MaNguoiDung INT           NOT NULL,
    NgayGio     DATETIME2     NOT NULL CONSTRAINT DF_RmaUpkLsMM_Ngay DEFAULT (SYSUTCDATETIME()),
    GhiChu      NVARCHAR(500) NULL,
    CONSTRAINT CK_RmaUpkLsMM_Loai CHECK (Loai IN (N'NHAP', N'XUAT')),
    CONSTRAINT CK_RmaUpkLsMM_SL   CHECK (SoLuong > 0)
  );
  CREATE INDEX IX_RmaUpkLsMM_Ngay ON dbo.RmaUpkLichSu_MM (NgayGio DESC);
END
GO

PRINT N'RmaUpkLichSu_*: xong.';
GO
