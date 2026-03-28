-- ============================================================
-- seedBin4Data.sql
-- Thêm linh kiện cho 9 vị trí Thùng 4 mới (MaViTri 102-110)
-- Dãy A: 102(A-1-4), 103(A-2-4), 104(A-3-4)
-- Dãy B: 105(B-1-4), 106(B-2-4), 107(B-3-4)
-- Dãy C: 108(C-1-4), 109(C-2-4), 110(C-3-4)
-- ============================================================
USE MM_DB;
GO

-- Dọn test data cũ còn sót lại (nếu có)
DELETE FROM ChiTietLinhKien WHERE MaAssy LIKE 'TEST-%';
DELETE FROM LinhKien WHERE CodeTong LIKE 'TEST-%';
GO

-- ============================================================
-- CHÈN LINH KIỆN MỚI (LinhKien) — 8 linh kiện hoàn toàn mới
-- ============================================================
INSERT INTO LinhKien (CodeTong, MoTa, CumVatLieu, TonToiThieu, TongTon, MaViTri)
VALUES
  ('ASSY-A10', N'Assembly A tầng 1 ô 4',  N'DÃY-A', 130,   130.00, 102),  -- OK
  ('ASSY-A11', N'Assembly A tầng 2 ô 4',  N'DÃY-A', 160,    80.00, 103),  -- LOW
  ('ASSY-A12', N'Assembly A tầng 3 ô 4',  N'DÃY-A', 210,     0.00, 104),  -- CRITICAL

  ('ASSY-B7',  N'Assembly B tầng 1 ô 4',  N'DÃY-B', 145,   290.00, 105),  -- OK
  ('ASSY-B8',  N'Assembly B tầng 2 ô 4',  N'DÃY-B', 185,    50.00, 106),  -- LOW
  ('ASSY-B9',  N'Assembly B tầng 3 ô 4',  N'DÃY-B', 230,   230.00, 107),  -- OK

  -- ASSY-C4 đã tồn tại → xử lý bên dưới
  ('ASSY-C5',  N'Assembly C tầng 2 ô 4',  N'DÃY-C', 155,   310.00, 109),  -- OK
  ('ASSY-C6',  N'Assembly C tầng 3 ô 4',  N'DÃY-C', 200,   120.00, 110);  -- LOW
GO

-- ============================================================
-- CẬP NHẬT ASSY-C4 (đã có sẵn, chỉ cần gán MaViTri và TongTon)
-- ============================================================
UPDATE LinhKien
SET
  MaViTri    = 108,
  MoTa       = N'Assembly C tầng 1 ô 4',
  CumVatLieu = N'DÃY-C',
  TonToiThieu = 110,
  TongTon    = 0.00   -- CRITICAL (hết hàng — để test màu đỏ)
WHERE CodeTong = 'ASSY-C4';
GO

-- ============================================================
-- CHÈN TỒN KHO CHI TIẾT (TonKhoChiTiet)
-- ============================================================
-- Xóa bản ghi cũ nếu đã có (tránh duplicate khi chạy lại)
DELETE FROM TonKhoChiTiet WHERE MaViTri BETWEEN 102 AND 110;
GO

INSERT INTO TonKhoChiTiet (MaViTri, MaLinhKien, SoLuongTon)
VALUES
  (102, 'ASSY-A10', 130.00),
  (103, 'ASSY-A11',  80.00),
  (104, 'ASSY-A12',   0.00),
  (105, 'ASSY-B7',  290.00),
  (106, 'ASSY-B8',   50.00),
  (107, 'ASSY-B9',  230.00),
  (108, 'ASSY-C4',    0.00),
  (109, 'ASSY-C5',  310.00),
  (110, 'ASSY-C6',  120.00);
GO

-- ============================================================
-- XÁC NHẬN KẾT QUẢ
-- ============================================================
SELECT
  v.Rack                                          AS Day,
  v.Tang                                          AS Tang,
  v.Thung                                         AS Thung,
  l.CodeTong,
  l.MoTa,
  l.TonToiThieu                                   AS MinStock,
  l.TongTon                                       AS TongTon,
  CASE
    WHEN l.TongTon = 0             THEN N'🔴 CRITICAL'
    WHEN l.TongTon < l.TonToiThieu THEN N'🟠 LOW'
    ELSE                                N'🟢 OK'
  END                                             AS TrangThai
FROM LinhKien l
JOIN ViTriKho v ON v.MaViTri = l.MaViTri
WHERE l.MaViTri BETWEEN 102 AND 110
ORDER BY v.Rack, CAST(v.Tang AS INT), CAST(v.Thung AS INT);
GO
