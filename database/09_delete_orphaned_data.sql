-- ============================================================================
-- DELETE ORPHANED DATA
-- Xoá các mã ASSY không có vị trí ô tương ứng hoặc không được ánh xạ
-- ============================================================================

USE MM_DB;
GO

-- ============================================================================
-- 1. XOÁ các bản ghi trong TonKhoChiTiet mà MaViTri không tồn tại trong ViTriKho
-- ============================================================================

PRINT '=== XOÁ orphaned TonKhoChiTiet records ===';

DELETE FROM dbo.TonKhoChiTiet
WHERE MaViTri NOT IN (SELECT MaViTri FROM dbo.ViTriKho);

PRINT CAST(@@ROWCOUNT AS VARCHAR) + ' TonKhoChiTiet records deleted (vị trí không tồn tại)';

GO

-- ============================================================================
-- 2. XOÁ các mã ASSY trong LinhKien mà không có dữ liệu tồn kho nào
-- (nếu muốn xoá hoàn toàn các ASSY không được sử dụng)
-- ============================================================================

PRINT '';
PRINT '=== XOÁ unused LinhKien records ===';

DELETE FROM dbo.LinhKien
WHERE ASSY NOT IN (SELECT DISTINCT MaLinhKien FROM dbo.TonKhoChiTiet WHERE MaLinhKien IS NOT NULL)
  AND ASSY NOT IN (SELECT DISTINCT MaLinhKien FROM dbo.ChiTietLinhKien WHERE MaLinhKien IS NOT NULL);

PRINT CAST(@@ROWCOUNT AS VARCHAR) + ' LinhKien records deleted (không được sử dụng)';

GO

-- ============================================================================
-- 3. XOÁ các bản ghi trong ChiTietLinhKien mà ASSY cha không tồn tại
-- ============================================================================

PRINT '';
PRINT '=== XOÁ orphaned ChiTietLinhKien records ===';

DELETE FROM dbo.ChiTietLinhKien
WHERE MaLinhKien NOT IN (SELECT ASSY FROM dbo.LinhKien);

PRINT CAST(@@ROWCOUNT AS VARCHAR) + ' ChiTietLinhKien records deleted (ASSY cha không tồn tại)';

GO

-- ============================================================================
-- VERIFY: Hiển thị dữ liệu còn lại
-- ============================================================================

PRINT '';
PRINT '=== VERIFY: Dữ liệu còn lại ===';
PRINT '';
PRINT 'Vị trí kho (ViTriKho):';
SELECT COUNT(*) AS [Tổng số ô] FROM dbo.ViTriKho;

PRINT 'Tồn kho chi tiết (TonKhoChiTiet):';
SELECT COUNT(*) AS [Tổng số bản ghi] FROM dbo.TonKhoChiTiet;

PRINT 'Linh kiện (LinhKien):';
SELECT COUNT(*) AS [Tổng số ASSY] FROM dbo.LinhKien;

PRINT 'Chi tiết linh kiện (ChiTietLinhKien):';
SELECT COUNT(*) AS [Tổng số chi tiết] FROM dbo.ChiTietLinhKien;

GO

-- ============================================================================
-- DETAIL: Danh sách các vị trí có dữ liệu
-- ============================================================================

PRINT '';
PRINT '=== Chi tiết: Vị trí có dữ liệu ===';
SELECT 
  v.MaViTri,
  v.TenDay,
  v.Tang,
  v.ViTriO,
  v.TenThung,
  COUNT(t.MaLinhKien) AS [Số ASSY]
FROM dbo.ViTriKho v
LEFT JOIN dbo.TonKhoChiTiet t ON v.MaViTri = t.MaViTri
GROUP BY v.MaViTri, v.TenDay, v.Tang, v.ViTriO, v.TenThung
ORDER BY v.TenDay, v.Tang, v.ViTriO;

GO

PRINT '';
PRINT 'CLEANUP COMPLETE! ✓';
