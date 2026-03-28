# Thực Hiện Chuẩn Hóa CSDL - Step by Step

## 📋 Tóm Tắt Vấn Đề

| Vấn Đề | Nguyên Nhân | Giải Pháp |
|--------|-----------|----------|
| **Tên cột không nhất quán** | `Rack` vs `TenDay`, `Thung` vs `ViTriO` | Dùng ViTriKho làm master, xóa duplicate ở LinhKien |
| **Dữ liệu lặp lại** | LinhKien.Rack/Tang/Thung + ViTriKho.TenDay/Tang/ViTriO | Thay bằng FK: LinhKien.MaViTri → ViTriKho.MaViTri |
| **ASSY ở nhiều vị trí** | TonKhoChiTiet không enforce uniqueness | Map mỗi ASSY → 1 vị trí chính (MaViTri) |
| **Khó maintain** | Cần update 2 bảng khi thay đổi vị trí | Single source of truth: ViTriKho |

---

## 🚀 Thực Hiện (5 Bước)

### **Bước 1: Audit hiện tại (5 phút)**

```sql
-- SSMS: Chạy script này để xem vấn đề chi tiết
-- File: 10_audit_database_inconsistency.sql

-- Kết quả: Sẽ show:
--   - ASSY không có vị trí
--   - ASSY ở nhiều vị trí (inconsistency)
--   - Vị trí trống
--   - Thống kê tổng quát
```

✅ **Sau bước 1, bạn sẽ biết:**
- Bao nhiêu ASSY không có vị trị
- Bao nhiêu ASSY ở nhiều vị trị
- Cần fix bao nhiêu records

---

### **Bước 2: Backup & Chuẩn hóa Schema (5 phút)**

```sql
-- SSMS: Chạy script này
-- File: 11_normalize_database_schema.sql

-- Công việc:
--   1. Thêm column MaViTri vào LinhKien
--   2. Thêm FK: LinhKien.MaViTri → ViTriKho.MaViTri
--   3. Map ASSY → vị trí chính (lấy vị trị có qty lớn nhất)
--   4. Xóa Rack/Tang/Thung khỏi LinhKien
--   5. Verify data integrity
```

✅ **Sau bước 2:**
- LinhKien schema thay đổi
- Mỗi ASSY có MaViTri
- FK chặt từ LinhKien → ViTriKho

---

### **Bước 3: Verify Database (5 phút)**

```sql
-- Chạy các query này để confirm:

-- 1. ASSY without MaViTri (should be 0 hoặc ít)
SELECT COUNT(*) FROM dbo.LinhKien WHERE MaViTri IS NULL;

-- 2. Locations without ASSY (should be > 0, tùy dữ liệu)
SELECT COUNT(*) FROM dbo.ViTriKho 
WHERE MaViTri NOT IN (SELECT DISTINCT MaViTri FROM dbo.LinhKien WHERE MaViTri IS NOT NULL);

-- 3. Sample data
SELECT TOP 10
  l.ASSY,
  l.MoTa,
  v.TenDay,
  v.Tang,
  v.ViTriO,
  v.TenThung
FROM dbo.LinhKien l
JOIN dbo.ViTriKho v ON v.MaViTri = l.MaViTri
ORDER BY v.TenDay, v.Tang, v.ViTriO;
```

✅ **Kiểm tra:**
- ✅ Không có ASSY treo (orphaned)
- ✅ Mỗi ASSY → 1 vị trí
- ✅ FK valid

---

### **Bước 4: Cập nhật Backend API (10 phút)**

**File: `c:\MM\backend\src\routes\warehouse.js`**

**OLD Query:**
```javascript
const result = await pool.request().query(`
  SELECT v.MaViTri, v.TenDay, v.TenThung, v.TrangThai,
         t.MaLinhKien, t.SoLuongTon AS quantity,
         l.MoTa AS part_name, l.TonToiThieu AS min_stock, l.Rack, l.Tang, l.Thung
  FROM ViTriKho v
  LEFT JOIN TonKhoChiTiet t ON t.MaViTri = v.MaViTri
  LEFT JOIN LinhKien l ON l.ASSY = t.MaLinhKien
  ORDER BY ISNULL(l.Rack, v.TenDay), v.MaViTri, t.MaLinhKien
`);
```

**NEW Query (Sau Normalization):**
```javascript
const result = await pool.request().query(`
  SELECT v.MaViTri, v.TenDay, v.TenThung, v.TrangThai,
         l.ASSY, l.MoTa AS part_name, l.TonToiThieu AS min_stock,
         ISNULL(t.SoLuongTon, 0) AS quantity, v.Tang, v.ViTriO
  FROM ViTriKho v
  LEFT JOIN LinhKien l ON l.MaViTri = v.MaViTri
  LEFT JOIN TonKhoChiTiet t ON t.MaLinhKien = l.ASSY AND t.MaViTri = v.MaViTri
  ORDER BY v.TenDay, v.Tang, v.ViTriO, l.ASSY
`);
```

**Thay đổi chính:**
- ❌ Xóa: `l.Rack, l.Tang, l.Thung` (không còn tồn tại)
- ❌ Xóa: `ISNULL(l.Rack, v.TenDay)` từ ORDER BY
- ✅ Thêm: `l.MaViTri = v.MaViTri` trong LEFT JOIN LinhKien
- ✅ Thêm: `t.MaViTri = v.MaViTri` trong LEFT JOIN TonKhoChiTiet
- ✅ Đơn giản hơn, rõ ràng hơn

**Mapping logic không thay đổi:**
- Vẫn dùng `v.TenDay` (Rack) → `rackKey`
- Vẫn dùng `v.Tang` → `tierNum`
- Vẫn tạo label: `` `${rackKey}-${tierNum}-${row.TenThung.split('').pop()}` ``

---

### **Bước 5: Test & Verify (15 phút)**

```bash
# 1. Restart backend server
npm run dev

# 2. Test warehouse API
curl http://localhost:3000/api/warehouse/map

# 3. Verify response có tier structure
# Expected:
# [
#   {
#     "id": "row-A",
#     "label": "A",
#     "tiers": [
#       {
#         "id": "tier-1",
#         "tierNum": 1,
#         "label": "Tầng 1",
#         "bins": [
#           {
#             "id": "b1",
#             "label": "A-1-1",
#             "components": [...]
#           }
#         ]
#       }
#     ]
#   }
# ]

# 4. Frontend: Mở http://localhost:5173
# - Sơ đồ Kho sẽ hiển thị Dãy A, Dãy B, Dãy C
# - Mỗi dãy có các Tầng 1, 2, 3
# - Mỗi tầng có các ô (bin cards)
```

✅ **Verify UI:**
- ✅ Warehouse map hiển thị đúng
- ✅ Tier structure đúng
- ✅ Bin cards có ASSY + số lượng
- ✅ Click bin card → modal hiển thị ASSY

---

## 📊 Trước & Sau

### **Trước (Inconsistent):**
```
LinhKien:
  ASSY-1: Rack='A', Tang=1, Thung='A1'
  ASSY-2: Rack='A', Tang=1, Thung='A1' (❌ Cùng vị trí?)

ViTriKho:
  MaViTri=1: TenDay='A', Tang=1, ViTriO=1, TenThung='A1'
  MaViTri=2: TenDay='A', Tang=1, ViTriO=1, TenThung='A1' (❌ Trùng?)

TonKhoChiTiet:
  ASSY-1 → MaViTri=1
  ASSY-1 → MaViTri=2 (❌ ASSY-1 ở 2 vị trị!)
  ASSY-2 → MaViTri=1
```

### **Sau (Normalized):**
```
LinhKien:
  ASSY-1: MaViTri=1 (FK → ViTriKho)
  ASSY-2: MaViTri=1 (FK → ViTriKho)
  ✅ Rack/Tang/Thung đã xóa, cùng vị trí

ViTriKho:
  MaViTri=1: TenDay='A', Tang=1, ViTriO=1, TenThung='A1'
  ✅ Master source of truth, không bị lặp

TonKhoChiTiet:
  ASSY-1 → MaViTri=1 (archive, dùng cho history)
  ASSY-2 → MaViTri=1 (archive)
  ✅ Luôn khớp với LinhKien.MaViTri
```

---

## ⏱️ Timeline

| Bước | Công Việc | Thời Gian | Status |
|------|----------|----------|--------|
| 1 | Audit | 5 phút | 📋 TODO |
| 2 | Schema Migration | 5 phút | 📋 TODO |
| 3 | Verify DB | 5 phút | 📋 TODO |
| 4 | Update Backend API | 10 phút | 📋 TODO |
| 5 | Test UI | 15 phút | 📋 TODO |
| **TOTAL** | | **40 phút** | |

---

## 🎯 File Chính

```
database/
├── 10_audit_database_inconsistency.sql       ← Chạy trước để audit
├── 11_normalize_database_schema.sql          ← Chạy để chuẩn hóa
├── BACKEND_MIGRATION_GUIDE.sql               ← Reference cho backend update
└── ANALYSIS_DATABASE_INCONSISTENCY.md        ← Phân tích chi tiết

backend/src/routes/
└── warehouse.js                              ← Cập nhật query
```

---

## ✅ Checklist

- [ ] Chạy `10_audit_database_inconsistency.sql` → Review kết quả
- [ ] Backup dữ liệu (tự động trong step 2)
- [ ] Chạy `11_normalize_database_schema.sql` → Schema change
- [ ] Verify DB integrity (check NULL, FK)
- [ ] Cập nhật query trong `warehouse.js`
- [ ] Restart backend server
- [ ] Test API endpoint
- [ ] Mở UI → verify warehouse map
- [ ] Xoá backup tables (sau 1 tuần nếu OK)
- [ ] Commit to git

---

## 🚨 Rollback (Nếu có vấn đề)

```sql
-- Nếu cần rollback:
USE MM_DB;
GO

-- 1. Restore từ backup table
IF OBJECT_ID('dbo.LinhKien_Backup') IS NOT NULL
BEGIN
  DELETE FROM dbo.LinhKien;
  INSERT INTO dbo.LinhKien
  SELECT * FROM dbo.LinhKien_Backup;
END

-- 2. Hoặc restore từ SQL Server backup
-- - SSMS → Restore Database
-- - Chọn backup trước normalization
```

---

## 📞 Hỗ Trợ

**Nếu có lỗi:**
1. Kiểm tra `9_delete_orphaned_data.sql` output
2. Chạy verify queries trong `11_normalize_database_schema.sql`
3. Xem `BACKEND_MIGRATION_GUIDE.sql` để confirm query

**Nếu UI không hiển thị:**
1. Check browser console (F12)
2. Check backend API: `curl http://localhost:3000/api/warehouse/map`
3. Verify backend logs

---

**Bây giờ bạn đã sẵn sàng! Hãy bắt đầu từ Bước 1. 🚀**
