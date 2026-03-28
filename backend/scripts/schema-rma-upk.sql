/*
  RMA / UPK module — tách biệt khỏi kho MM.
  Chạy một lần trên SQL Server (SSMS / sqlcmd).

  Quyền NguoiDung.Quyen: thêm giá trị upk | rma (cùng admin hiện có).
  - upk: chỉ ghi kho UPK; đọc được UPK + RMA.
  - rma: chỉ ghi kho RMA; đọc được UPK + RMA.
  - admin: ghi cả hai kho trong module này.
*/

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RmaUpkTonKho' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.RmaUpkTonKho (
    MaLinhKien NVARCHAR(100) NOT NULL,
    MaKho      NVARCHAR(10)  NOT NULL,
    SoLuongTon INT           NOT NULL CONSTRAINT DF_RmaUpkTonKho_SoLuong DEFAULT (0),
    CONSTRAINT PK_RmaUpkTonKho PRIMARY KEY (MaLinhKien, MaKho),
    CONSTRAINT CK_RmaUpkTonKho_Kho CHECK (MaKho IN (N'UPK', N'RMA')),
    CONSTRAINT CK_RmaUpkTonKho_SL CHECK (SoLuongTon >= 0)
  );
END
GO

/* Tăng tốc tìm kiếm code trong phiếu nhập/xuất */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RmaUpkTonKho_MaLinhKien' AND object_id = OBJECT_ID('dbo.RmaUpkTonKho'))
BEGIN
  CREATE INDEX IX_RmaUpkTonKho_MaLinhKien ON dbo.RmaUpkTonKho (MaLinhKien ASC) INCLUDE (MaKho, SoLuongTon);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RmaUpkChuyenKho' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.RmaUpkChuyenKho (
    MaChuyen       INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    MaKhoNguon     NVARCHAR(10) NOT NULL,
    MaKhoDich      NVARCHAR(10) NOT NULL,
    MaNguoiTao     INT NOT NULL,
    NgayTao        DATETIME2 NOT NULL CONSTRAINT DF_RmaUpkChuyen_Ngay DEFAULT (SYSUTCDATETIME()),
    TrangThai      NVARCHAR(20) NOT NULL CONSTRAINT DF_RmaUpkChuyen_TT DEFAULT (N'DANG_CHUYEN'),
    MaNguoiXacNhan INT NULL,
    NgayXacNhan    DATETIME2 NULL,
    GhiChu         NVARCHAR(500) NULL,
    CONSTRAINT CK_RmaUpkChuyen_Kho CHECK (MaKhoNguon IN (N'UPK', N'RMA') AND MaKhoDich IN (N'UPK', N'RMA') AND MaKhoNguon <> MaKhoDich),
    CONSTRAINT CK_RmaUpkChuyen_TT CHECK (TrangThai IN (N'DANG_CHUYEN', N'HOAN_THANH', N'TU_CHOI'))
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RmaUpkChuyenKhoChiTiet' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.RmaUpkChuyenKhoChiTiet (
    MaChuyen   INT NOT NULL,
    MaLinhKien NVARCHAR(100) NOT NULL,
    SoLuong    INT NOT NULL,
    CONSTRAINT PK_RmaUpkChuyenCT PRIMARY KEY (MaChuyen, MaLinhKien),
    CONSTRAINT FK_RmaUpkChuyenCT_Chuyen FOREIGN KEY (MaChuyen) REFERENCES dbo.RmaUpkChuyenKho (MaChuyen) ON DELETE CASCADE,
    CONSTRAINT CK_RmaUpkChuyenCT_SL CHECK (SoLuong > 0)
  );
END
GO

/* Lịch sử nhập/xuất nội bộ (POST /api/rma-upk/adjust) — tách khỏi chuyển kho */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RmaUpkDieuChinh' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.RmaUpkDieuChinh (
    MaDieuChinh INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    MaKho       NVARCHAR(10)  NOT NULL,
    MaLinhKien  NVARCHAR(100) NOT NULL,
    Loai        NVARCHAR(10)  NOT NULL,
    SoLuong     INT           NOT NULL,
    TonSau      INT           NOT NULL,
    MaNguoiDung INT           NOT NULL,
    NgayGio     DATETIME2     NOT NULL CONSTRAINT DF_RmaUpkDieuChinh_Ngay DEFAULT (SYSUTCDATETIME()),
    GhiChu      NVARCHAR(500) NULL,
    CONSTRAINT CK_RmaUpkDieuChinh_Kho  CHECK (MaKho IN (N'UPK', N'RMA')),
    CONSTRAINT CK_RmaUpkDieuChinh_Loai CHECK (Loai IN (N'NHAP', N'XUAT')),
    CONSTRAINT CK_RmaUpkDieuChinh_SL    CHECK (SoLuong > 0)
  );
  CREATE INDEX IX_RmaUpkDieuChinh_Kho_Ngay ON dbo.RmaUpkDieuChinh (MaKho, NgayGio DESC);
END
GO

/* Lịch sử điều chỉnh UPK theo đối tác (mỗi đối tác một bảng) */
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

/* Tiếp theo: GRANT cho user SQL trong .env (vd. ysv) — nếu không sẽ lỗi 229 permission denied.
   Chạy: backend/scripts/grant-rma-upk-permissions.sql
   Hoặc phần RMA/UPK trong grantPermissionsSQL.sql */
