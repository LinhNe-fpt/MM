# Phân Tích Vấn Đề Không Nhất Quán CSDL

## 1. VẤN ĐỀ HIỆN TẠI

### 1.1 Cấu Trúc Hiện Tại
```
LinhKien (ASSY)
├── Rack (VARCHAR) - e.g., 'A'
├── Tang (INT) - e.g., 1
└── Thung (VARCHAR) - e.g., 'A1'

ViTriKho
├── TenDay (VARCHAR) - e.g., 'A'  ❌ Khác với Rack
├── Tang (INT) - e.g., 1
├── ViTriO (INT) - e.g., 1  ❌ Khác với Thung
└── TenThung (VARCHAR) - e.g., 'A1'

TonKhoChiTiet
├── MaLinhKien → LinhKien.ASSY
└── MaViTri → ViTriKho.MaViTri
```

### 1.2 Vấn Đề Chính
| Vấn Đề | Nguyên Nhân | Hậu Quả |
|--------|-----------|---------|
| **Tên cột không nhất quán** | `Rack` vs `TenDay`, `Thung` vs `ViTriO` | Dễ nhầm, khó maintain |
| **Dữ liệu bị trùng lặp** | LinhKien.Rack/Tang/Thung AND ViTriKho lưu cùng info | Mất đồng bộ khi update |
| **Không enforce duy nhất** | ASSY có thể ở nhiều vị trí (TonKhoChiTiet cho phép) | Quản lý chặt chẽ không được |
| **Thiếu FK chặt** | Không có FK từ LinhKien → ViTriKho | ASSY "lơ lửng" không liên kết chặt |
| **Dữ liệu thừa** | `LinhKien.Rack/Tang/Thung` chỉ là metadata | Duplicate data → inconsistent |

---

## 2. GIẢI PHÁP ĐỀ XUẤT

### Option A: **Chuẩn Hóa Bảng (Recommended) ✅**

**Ý tưởng:** Mỗi ASSY có **MỘT vị trí duy nhất**. ViTriKho là nguồn thật.

#### 2.1 Thay Đổi Schema

**Bước 1:** Đổi `ViTriKho.TenDay` → `Rack` để nhất quán
```sql
ALTER TABLE dbo.ViTriKho
  RENAME COLUMN TenDay TO Rack;
```
*(Hoặc thêm cột `Rack` riêng nếu cần giữ TenDay)*

**Bước 2:** Đổi `ViTriKho.ViTriO` → `Thung` để nhất quán
```sql
ALTER TABLE dbo.ViTriKho
  RENAME COLUMN ViTriO TO Thung;
  
-- Và xóa TenThung (thừa)
ALTER TABLE dbo.ViTriKho DROP COLUMN TenThung;
```

**Bước 3:** Thêm cột vị trí vào `LinhKien` (tham chiếu chính)
```sql
ALTER TABLE dbo.LinhKien
  ADD MaViTri INT NULL,
  CONSTRAINT FK_LinhKien_ViTriKho FOREIGN KEY (MaViTri) REFERENCES dbo.ViTriKho(MaViTri);
```

**Bước 4:** Xóa cột thừa từ LinhKien
```sql
ALTER TABLE dbo.LinhKien
  DROP COLUMN Rack, Tang, Thung;
```

#### 2.2 Kết Quả
```
LinhKien (ASSY) ← Primary Location
└── MaViTri (FK) → ViTriKho.MaViTri

ViTriKho (Master)
├── Rack
├── Tang
├── Thung
└── TenThung (label hiển thị)

TonKhoChiTiet (Historical, Archive)
├── MaLinhKien
├── MaViTri (now validates against both LinhKien + ViTriKho)
└── SoLuongTon
```

**Ưu điểm:**
- ✅ Single source of truth (ViTriKho)
- ✅ Mỗi ASSY → 1 vị trí
- ✅ Dễ query, maintain
- ✅ FK chặt, data integrity

---

### Option B: **Keep Flexibility - Nếu ASSY có thể ở nhiều vị trí**

Nếu yêu cầu là ASSY có thể **lưu ở nhiều vị trí** (multi-location):
- Bỏ dữ liệu `Rack/Tang/Thung` khỏi LinhKien
- Dùng `TonKhoChiTiet` làm **master table** cho mapping
- Thêm trigger check constraint

```sql
-- Đảm bảo TonKhoChiTiet.MaViTri khớp với ViTriKho.Rack/Tang/Thung
CREATE TRIGGER TR_TonKho_ValidateLocation
ON dbo.TonKhoChiTiet
INSTEAD OF INSERT
AS
BEGIN
  -- Validate logic here
END;
```

---

## 3. PLAN THỰC HIỆN

### Phase 1: **Backup & Analysis** (Ngay)
```sql
-- Backup dữ liệu
SELECT * INTO dbo.LinhKien_Backup FROM dbo.LinhKien;
SELECT * INTO dbo.ViTriKho_Backup FROM dbo.ViTriKho;
SELECT * INTO dbo.TonKhoChiTiet_Backup FROM dbo.TonKhoChiTiet;

-- Phân tích inconsistency
SELECT 
  lk.ASSY, 
  CONCAT(lk.Rack, '-', lk.Tang, '-', lk.Thung) AS 'LK_Location',
  CONCAT(v.TenDay, '-', v.Tang, '-', v.ViTriO) AS 'VTK_Location',
  COUNT(DISTINCT t.MaViTri) AS 'NumLocations'
FROM dbo.LinhKien lk
LEFT JOIN dbo.ViTriKho v ON v.TenDay = lk.Rack AND v.Tang = lk.Tang
LEFT JOIN dbo.TonKhoChiTiet t ON t.MaLinhKien = lk.ASSY
GROUP BY lk.ASSY, lk.Rack, lk.Tang, lk.Thung, v.TenDay, v.Tang, v.ViTriO
HAVING COUNT(DISTINCT t.MaViTri) > 1 OR lk.Rack IS NULL;
```

### Phase 2: **Chuẩn Hóa Schema** (Nếu chọn Option A)
- Rename TenDay → Rack
- Rename ViTriO → Thung
- Drop TenThung
- Add MaViTri FK to LinhKien
- Drop Rack/Tang/Thung from LinhKien

### Phase 3: **Migrate Data**
```sql
-- Set MaViTri in LinhKien from ViTriKho match
UPDATE lk
SET lk.MaViTri = v.MaViTri
FROM dbo.LinhKien lk
JOIN dbo.ViTriKho v ON v.Rack = lk.Rack 
  AND v.Tang = lk.Tang
  AND v.Thung = CAST(RIGHT(lk.Thung, 1) AS INT);
```

### Phase 4: **Validate & Test**
- Verify no NULL MaViTri
- Check foreign keys integrity
- Retest warehouse map API
- Verify UI rendering

---

## 4. QUERY AUDIT & FIX

### Check Orphaned Records
```sql
-- ASSY không có vị trí
SELECT * FROM dbo.LinhKien 
WHERE MaViTri IS NULL 
  AND ASSY NOT IN (SELECT DISTINCT MaLinhKien FROM dbo.TonKhoChiTiet);

-- Vị trí không có ASSY
SELECT * FROM dbo.ViTriKho
WHERE MaViTri NOT IN (SELECT DISTINCT MaViTri FROM dbo.TonKhoChiTiet);

-- ASSY ở nhiều vị trí (inconsistency)
SELECT MaLinhKien, COUNT(DISTINCT MaViTri) AS NumLocations
FROM dbo.TonKhoChiTiet
GROUP BY MaLinhKien
HAVING COUNT(DISTINCT MaViTri) > 1;
```

### Reconcile Location Data
```sql
-- Đồng bộ: TenDay ← Rack
SELECT DISTINCT TenDay, Rack FROM dbo.ViTriKho;
-- Nếu khác nhau, chọn Rack làm canonical, update TenDay

-- Đồng bộ: ViTriO ← Thung
SELECT DISTINCT ViTriO, Thung FROM dbo.ViTriKho;
-- Nếu khác nhau, chọn Thung làm canonical
```

---

## 5. RECOMMENDATION

**Chọn Option A (Chuẩn Hóa) vì:**
1. ✅ Đơn giản, rõ ràng
2. ✅ Hỗ trợ yêu cầu "mỗi ASSY có vị trí"
3. ✅ Dễ quản lý, tránh duplicate
4. ✅ FK chặt → data integrity
5. ✅ Backend API không cần đổi nhiều

**Bước tiếp theo:**
1. Chạy `ANALYSIS_DATABASE_INCONSISTENCY.sql` để audit
2. Backup toàn bộ dữ liệu
3. Chạy `NORMALIZE_DATABASE_SCHEMA.sql` (create next)
4. Retest UI + API
5. Delete backup tables

---

## 6. Timeline

| Bước | Công Việc | Thời Gian |
|------|----------|----------|
| 1 | Audit & Backup | 5 phút |
| 2 | Schema migration | 5 phút |
| 3 | Data migration | 10 phút |
| 4 | Validation | 10 phút |
| 5 | Test UI/API | 15 phút |
| **TOTAL** | | **45 phút** |
