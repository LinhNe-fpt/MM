/*
  =============================================================================
  BoPhan + VaiTro (catalog) — đồng bộ với NguoiDung.Quyen (MaVaiTro).
  Chạy TRỌN file này một lần trên SQL Server (SSMS: F5), sau khi sửa USE bên dưới.
  =============================================================================
  Bước 1: Đổi [MM_DB] thành tên database thật (cùng DB có bảng NguoiDung).
  Bước 2: Execute toàn bộ (không chỉ copy phần MERGE).
  Sau khi chạy: cấp GRANT nếu cần (xem grantPermissionsSQL.sql).
  =============================================================================
*/

/* ── BẮT BUỘC: tên database ứng dụng ─────────────────────────────────────── */
USE [MM_DB];
GO

SET NOCOUNT ON;
GO

/* ── 1) Tạo bảng (idempotent) ───────────────────────────────────────────── */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'BoPhan' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
  CREATE TABLE dbo.BoPhan (
    MaBoPhan   NVARCHAR(20)  NOT NULL,
    TenBoPhan  NVARCHAR(100) NOT NULL,
    ThuTu      SMALLINT      NOT NULL CONSTRAINT DF_BoPhan_ThuTu DEFAULT (0),
    GhiChu     NVARCHAR(500) NULL,
    CONSTRAINT PK_BoPhan PRIMARY KEY (MaBoPhan)
  );
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'VaiTro' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
  CREATE TABLE dbo.VaiTro (
    MaVaiTro      NVARCHAR(30)  NOT NULL,
    MaBoPhan      NVARCHAR(20)  NOT NULL,
    TenHienThi    NVARCHAR(100) NOT NULL,
    LaQuanTri     BIT           NOT NULL CONSTRAINT DF_VaiTro_QT DEFAULT (0),
    DuLieuMacDinh BIT           NOT NULL CONSTRAINT DF_VaiTro_MD DEFAULT (0),
    MoTa          NVARCHAR(500) NULL,
    CONSTRAINT PK_VaiTro PRIMARY KEY (MaVaiTro),
    CONSTRAINT FK_VaiTro_BoPhan FOREIGN KEY (MaBoPhan) REFERENCES dbo.BoPhan (MaBoPhan)
  );
  CREATE INDEX IX_VaiTro_MaBoPhan ON dbo.VaiTro (MaBoPhan);
END
GO

/* ── 2) Nạp / cập nhật bộ phận ───────────────────────────────────────────── */
MERGE dbo.BoPhan AS t
USING (VALUES
  (N'MM',        N'Kho / IMS (Material Management)', 10, N'Giao diện và nghiệp vụ kho MM'),
  (N'Y_TE',      N'Y tế',                            12, N'Module Y tế — không menu kho MM'),
  (N'RMA_UPK',   N'RMA · UPK',                       20, N'Tồn và chuyển kho RMA/UPK'),
  (N'HE_THONG',  N'Quản trị hệ thống',               5,  N'Vào được cả MM và RMA·UPK khi cần')
) AS s (MaBoPhan, TenBoPhan, ThuTu, GhiChu)
ON t.MaBoPhan = s.MaBoPhan
WHEN MATCHED THEN UPDATE SET
  TenBoPhan = s.TenBoPhan,
  ThuTu     = s.ThuTu,
  GhiChu    = s.GhiChu
WHEN NOT MATCHED THEN INSERT (MaBoPhan, TenBoPhan, ThuTu, GhiChu)
VALUES (s.MaBoPhan, s.TenBoPhan, s.ThuTu, s.GhiChu);
GO

/* ── 3) Nạp / cập nhật vai trò (MaVaiTro = giá trị NguoiDung.Quyen) ─────── */
MERGE dbo.VaiTro AS t
USING (VALUES
  (N'admin',      N'HE_THONG',  N'Quản trị viên',                    1, 0, N'Full quyền cấu hình; vào MM và RMA·UPK'),
  (N'staff',      N'MM',        N'Nhân viên (staff)',               0, 1, N'Mặc định tạo user — nghiệp vụ MM theo phân quyền trang'),
  (N'viewer',     N'MM',        N'Chỉ xem',                          0, 0, N'Xem dữ liệu MM, không thao tác nhập xuất/ca'),
  (N'nhan_vien',  N'MM',        N'Nhân viên ca',                     0, 0, N'Giao dịch, ca làm việc, quét mã'),
  (N'kiem_kho',   N'MM',        N'Kiểm kho',                         0, 0, N'Chủ yếu xem/kiểm — UI MM'),
  (N'upk',        N'RMA_UPK',   N'Bộ phận UPK',                      0, 0, N'Chỉ module RMA·UPK, ghi kho UPK'),
  (N'rma',        N'RMA_UPK',   N'Bộ phận RMA',                      0, 0, N'Chỉ module RMA·UPK, ghi kho RMA'),
  (N'y_te',       N'Y_TE',      N'Nhân sự Y tế',                     0, 0, N'Chỉ /yte và hồ sơ; không kho MM')
) AS s (MaVaiTro, MaBoPhan, TenHienThi, LaQuanTri, DuLieuMacDinh, MoTa)
ON t.MaVaiTro = s.MaVaiTro
WHEN MATCHED THEN UPDATE SET
  MaBoPhan      = s.MaBoPhan,
  TenHienThi    = s.TenHienThi,
  LaQuanTri     = s.LaQuanTri,
  DuLieuMacDinh = s.DuLieuMacDinh,
  MoTa          = s.MoTa
WHEN NOT MATCHED THEN INSERT (MaVaiTro, MaBoPhan, TenHienThi, LaQuanTri, DuLieuMacDinh, MoTa)
VALUES (s.MaVaiTro, s.MaBoPhan, s.TenHienThi, s.LaQuanTri, s.DuLieuMacDinh, s.MoTa);
GO

/* ── 4) Một vai trò mặc định (staff) ─────────────────────────────────────── */
UPDATE dbo.VaiTro SET DuLieuMacDinh = 0;
UPDATE dbo.VaiTro SET DuLieuMacDinh = 1 WHERE MaVaiTro = N'staff';
GO

/* ── 5) View tra cứu user + vai trò ─────────────────────────────────────── */
IF OBJECT_ID(N'dbo.vw_NguoiDung_VaiTro', N'V') IS NOT NULL
  DROP VIEW dbo.vw_NguoiDung_VaiTro;
GO

CREATE VIEW dbo.vw_NguoiDung_VaiTro
AS
SELECT
  n.MaNguoiDung,
  n.TaiKhoan,
  n.HoTen,
  n.Quyen,
  v.MaVaiTro,
  v.TenHienThi  AS TenVaiTro,
  b.MaBoPhan,
  b.TenBoPhan,
  v.LaQuanTri,
  v.MoTa        AS MoTaVaiTro
FROM dbo.NguoiDung n
LEFT JOIN dbo.VaiTro v ON v.MaVaiTro = n.Quyen
LEFT JOIN dbo.BoPhan b ON b.MaBoPhan = v.MaBoPhan;
GO

PRINT N'Hoan tat: BoPhan, VaiTro (gom y_te), vw_NguoiDung_VaiTro. Kiem tra GRANT trong grantPermissionsSQL.sql';
GO

/*
  ── Tùy chọn: ràng buộc FK NguoiDung.Quyen -> VaiTro (chạy riêng khi đã chuẩn hóa dữ liệu) ──

  ALTER TABLE dbo.NguoiDung ALTER COLUMN Quyen NVARCHAR(30) NULL;

  SELECT n.MaNguoiDung, n.TaiKhoan, n.Quyen
  FROM dbo.NguoiDung n
  WHERE n.Quyen IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM dbo.VaiTro v WHERE v.MaVaiTro = n.Quyen);

  ALTER TABLE dbo.NguoiDung WITH NOCHECK
    ADD CONSTRAINT FK_NguoiDung_VaiTro FOREIGN KEY (Quyen) REFERENCES dbo.VaiTro (MaVaiTro);
  ALTER TABLE dbo.NguoiDung CHECK CONSTRAINT FK_NguoiDung_VaiTro;
*/
