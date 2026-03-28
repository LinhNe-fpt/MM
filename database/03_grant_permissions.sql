-- MM_DB - Cap quyen cho user backend [ysv]. Dang nhap SSMS bang tai khoan khac [ysv] (vd. sa).
USE MM_DB;
GO

IF SUSER_SNAME() = 'ysv'
  PRINT N'Dang nhap bang [ysv]. Khong thuc hien GRANT.';
ELSE
BEGIN
  GRANT SELECT ON dbo.NguoiDung TO [ysv];
  GRANT SELECT, INSERT, UPDATE ON dbo.LinhKien TO [ysv];
  GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.ChiTietLinhKien TO [ysv];
  GRANT SELECT ON dbo.ViTriKho TO [ysv];
  GRANT SELECT, INSERT, UPDATE ON dbo.PhieuKho TO [ysv];
  GRANT SELECT, INSERT, UPDATE ON dbo.ChiTietPhieuKho TO [ysv];
  GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.TonKhoChiTiet TO [ysv];
  PRINT N'Da cap quyen cho user [ysv] tren MM_DB.';
END
GO
