-- Bổ sung bảng lịch sử nhập/xuất RMA/UPK (chạy nếu DB đã có schema-rma-upk cũ, chưa có RmaUpkDieuChinh).
USE MM_DB;
GO

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

PRINT N'RmaUpkDieuChinh: xong.';
GO
