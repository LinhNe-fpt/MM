/*
  KHSX multi-zone (MM / UPK / RMA)
  - Import batch + preview lỗi
  - Kế hoạch sản xuất theo ngày / ca / line / khu
*/

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'KeHoachSanXuatImportBatch' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.KeHoachSanXuatImportBatch (
    MaBatch      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenFile      NVARCHAR(260) NOT NULL,
    MaKhu        NVARCHAR(10) NOT NULL,
    TongDong     INT NOT NULL CONSTRAINT DF_KhsxBatch_TongDong DEFAULT (0),
    DongHopLe    INT NOT NULL CONSTRAINT DF_KhsxBatch_DongHopLe DEFAULT (0),
    DongLoi      INT NOT NULL CONSTRAINT DF_KhsxBatch_DongLoi DEFAULT (0),
    TrangThai    NVARCHAR(20) NOT NULL CONSTRAINT DF_KhsxBatch_TT DEFAULT (N'DRAFT'),
    MaNguoiTao   INT NOT NULL,
    NgayTao      DATETIME2 NOT NULL CONSTRAINT DF_KhsxBatch_NgayTao DEFAULT (SYSUTCDATETIME()),
    NgayCommit   DATETIME2 NULL,
    GhiChu       NVARCHAR(500) NULL,
    CONSTRAINT CK_KhsxBatch_Khu CHECK (MaKhu IN (N'MM', N'UPK', N'RMA')),
    CONSTRAINT CK_KhsxBatch_TT CHECK (TrangThai IN (N'DRAFT', N'COMMITTED', N'CANCELLED'))
  );
  CREATE INDEX IX_KhsxBatch_NgayTao ON dbo.KeHoachSanXuatImportBatch (NgayTao DESC);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'KeHoachSanXuat' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.KeHoachSanXuat (
    MaKeHoach        INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    MaBatch          INT NULL,
    MaKhu            NVARCHAR(10) NOT NULL,
    NgaySanXuat      DATE NOT NULL,
    CaSanXuat        NVARCHAR(10) NOT NULL,
    LineSanXuat      NVARCHAR(50) NOT NULL,
    CongDoan         NVARCHAR(50) NOT NULL CONSTRAINT DF_Khsx_CongDoan DEFAULT (N'CHUNG'),
    MaAssy           NVARCHAR(100) NOT NULL,
    Model            NVARCHAR(200) NULL,
    NhomVatTuYeuCau  NVARCHAR(20) NULL,
    SoLuongKeHoach   INT NOT NULL,
    TrangThai        NVARCHAR(30) NOT NULL CONSTRAINT DF_Khsx_TrangThai DEFAULT (N'CHO_XUAT_VT'),
    GhiChu           NVARCHAR(500) NULL,
    MaNguoiTao       INT NOT NULL,
    NgayTao          DATETIME2 NOT NULL CONSTRAINT DF_Khsx_NgayTao DEFAULT (SYSUTCDATETIME()),
    NgayCapNhat      DATETIME2 NULL,
    CONSTRAINT FK_Khsx_Batch FOREIGN KEY (MaBatch) REFERENCES dbo.KeHoachSanXuatImportBatch(MaBatch),
    CONSTRAINT CK_Khsx_Khu CHECK (MaKhu IN (N'MM', N'UPK', N'RMA')),
    CONSTRAINT CK_Khsx_Ca CHECK (CaSanXuat IN (N'CN', N'CD')),
    CONSTRAINT CK_Khsx_SL CHECK (SoLuongKeHoach > 0),
    CONSTRAINT CK_Khsx_TrangThai CHECK (TrangThai IN (N'CHO_XUAT_VT', N'DANG_XUAT', N'SAN_SANG', N'THIEU_VT', N'DA_XONG'))
  );
  CREATE INDEX IX_Khsx_Filter ON dbo.KeHoachSanXuat (MaKhu, NgaySanXuat, CaSanXuat, TrangThai);
  CREATE INDEX IX_Khsx_Assy ON dbo.KeHoachSanXuat (MaAssy);
  CREATE INDEX IX_Khsx_Line ON dbo.KeHoachSanXuat (LineSanXuat, NgaySanXuat);
END
GO

IF COL_LENGTH('dbo.KeHoachSanXuat', 'CongDoan') IS NULL
BEGIN
  ALTER TABLE dbo.KeHoachSanXuat
    ADD CongDoan NVARCHAR(50) NOT NULL CONSTRAINT DF_Khsx_CongDoan_Alter DEFAULT (N'CHUNG');
END
GO

IF COL_LENGTH('dbo.KeHoachSanXuat', 'NhomVatTuYeuCau') IS NULL
BEGIN
  ALTER TABLE dbo.KeHoachSanXuat ADD NhomVatTuYeuCau NVARCHAR(20) NULL;
END
GO

IF COL_LENGTH('dbo.BOMItems', 'CongDoan') IS NULL
BEGIN
  ALTER TABLE dbo.BOMItems
    ADD CongDoan NVARCHAR(50) NOT NULL CONSTRAINT DF_BOMItems_CongDoan DEFAULT (N'ALL');
END
GO

IF COL_LENGTH('dbo.BOMItems', 'NhomVatTu') IS NULL
BEGIN
  ALTER TABLE dbo.BOMItems ADD NhomVatTu NVARCHAR(20) NULL;
END
GO

/* Cột khớp file Excel KHSX: Basic Model, Model Desc, PO Type */
IF COL_LENGTH('dbo.KeHoachSanXuat', 'BasicModel') IS NULL
BEGIN
  ALTER TABLE dbo.KeHoachSanXuat ADD BasicModel NVARCHAR(200) NULL;
END
GO
IF COL_LENGTH('dbo.KeHoachSanXuat', 'ModelDesc') IS NULL
BEGIN
  ALTER TABLE dbo.KeHoachSanXuat ADD ModelDesc NVARCHAR(500) NULL;
END
GO
IF COL_LENGTH('dbo.KeHoachSanXuat', 'PoType') IS NULL
BEGIN
  ALTER TABLE dbo.KeHoachSanXuat ADD PoType NVARCHAR(120) NULL;
END
GO

/* Một lần: bản ghi cũ chỉ có Model (cột chung) — copy sang BasicModel để UI đọc đúng cột */
UPDATE dbo.KeHoachSanXuat
SET BasicModel = Model
WHERE (BasicModel IS NULL OR LTRIM(RTRIM(BasicModel)) = N'')
  AND Model IS NOT NULL
  AND LTRIM(RTRIM(Model)) <> N'';
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'KeHoachSanXuatImportLoi' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.KeHoachSanXuatImportLoi (
    MaLoi          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    MaBatch        INT NOT NULL,
    TenSheet       NVARCHAR(120) NULL,
    SoDong         INT NULL,
    CotDuLieu      NVARCHAR(80) NULL,
    MaLoiCode      NVARCHAR(40) NOT NULL,
    ThongDiep      NVARCHAR(500) NOT NULL,
    DuLieuDongJson NVARCHAR(MAX) NULL,
    NgayTao        DATETIME2 NOT NULL CONSTRAINT DF_KhsxLoi_NgayTao DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_KhsxLoi_Batch FOREIGN KEY (MaBatch) REFERENCES dbo.KeHoachSanXuatImportBatch(MaBatch) ON DELETE CASCADE
  );
  CREATE INDEX IX_KhsxLoi_Batch ON dbo.KeHoachSanXuatImportLoi (MaBatch, SoDong);
END
GO
