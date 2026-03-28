# CSDL Normalization - Visual Diagram

## 1. CURRENT STATE (Inconsistent) ❌

```
┌─────────────────────────────────────────────────────────────────┐
│                       INCONSISTENT MODEL                        │
└─────────────────────────────────────────────────────────────────┘

LinhKien (Component Master)
├── ASSY: 'ASSY-A1-001'
├── MoTa: 'Capacitor 100uF'
├── Rack: 'A'           ◄─── DUPLICATE
├── Tang: 1             ◄─── DUPLICATE  (from ViTriKho)
├── Thung: 'A1'         ◄─── DUPLICATE
└── TonToiThieu: 500

ViTriKho (Location Master)
├── MaViTri: 1
├── TenDay: 'A'         ◄─── DUPLICATE (same as Rack)
├── Tang: 1             ◄─── DUPLICATE (same as Tang)
├── ViTriO: 1           ◄─── DIFFERENT NAME (vs Thung)
└── TenThung: 'A1'

TonKhoChiTiet (Stock Detail)
├── MaLinhKien: 'ASSY-A1-001'
├── MaViTri: 1          ◄─── Can have multiple! (not unique)
└── SoLuongTon: 340


PROBLEM: ASSY-A1-001 có thể ở MaViTri=1 AND MaViTri=5 cùng lúc!
┌─────────────────────┬─────────────────────┐
│ MaLinhKien          │ MaViTri             │
├─────────────────────┼─────────────────────┤
│ ASSY-A1-001         │ 1 (A-1-1)           │ ← Qty=340
│ ASSY-A1-001         │ 5 (A-2-2)           │ ← Qty=56
│ ASSY-A1-001         │ 12 (B-1-3)          │ ← Qty=120
└─────────────────────┴─────────────────────┘
^^^ INCONSISTENCY: Mã nào thuộc vị trí nào???
```

---

## 2. NORMALIZED STATE (Consistent) ✅

```
┌─────────────────────────────────────────────────────────────────┐
│                      NORMALIZED MODEL                           │
└─────────────────────────────────────────────────────────────────┘

ViTriKho (Location Master - SINGLE SOURCE OF TRUTH)
├── MaViTri: 1 (PK)
├── Rack: 'A'
├── Tang: 1
├── Thung: 1 (ViTriO)
└── TenThung: 'A1'

        ▼ Foreign Key

LinhKien (Component Master)
├── ASSY: 'ASSY-A1-001' (PK)
├── MoTa: 'Capacitor 100uF'
├── MaViTri: 1 (FK → ViTriKho.MaViTri)  ◄─── SINGLE LOCATION
├── TonToiThieu: 500
└── [Rack/Tang/Thung REMOVED ✓]

        ▼ Archive Only

TonKhoChiTiet (Stock History/Archive)
├── MaLinhKien: 'ASSY-A1-001' (FK)
├── MaViTri: 1 (FK)
└── SoLuongTon: 340

BENEFIT: ASSY-A1-001 có MỘT vị trí chính (MaViTri=1)
┌──────────────────────────────────┐
│ LinhKien                         │
│ ASSY-A1-001 → MaViTri=1 ✓        │
└──────────────────────────────────┘
        ▼
┌──────────────────────────────────┐
│ ViTriKho MaViTri=1               │
│ Location: A-1-1                  │
│ (Master Record)                  │
└──────────────────────────────────┘

TonKhoChiTiet (có thể có history)
├── ASSY-A1-001 → MaViTri=1, Qty=340 (hiện tại)
└── [Nếu moved, tạo record mới, old record archive]
```

---

## 3. Data Flow Comparison

### BEFORE (Confusing)
```
User: "ASSY-A1-001 ở đâu?"

Query LinhKien:
  ➜ Rack='A', Tang=1, Thung='A1'

Query ViTriKho:
  ➜ TenDay='A', Tang=1, ViTriO=1, TenThung='A1'

Query TonKhoChiTiet:
  ➜ MaViTri=1, 5, 12  (❌ 3 vị trí???)

Result: CONFUSED! Đâu là vị trí đúng?
```

### AFTER (Clear)
```
User: "ASSY-A1-001 ở đâu?"

Query LinhKien:
  ➜ MaViTri=1

Query ViTriKho (WHERE MaViTri=1):
  ➜ Rack='A', Tang=1, Thung=1, TenThung='A1'
     Location: A-1-1 ✓

Result: CLEAR! 1 vị trí duy nhất
```

---

## 4. Schema Migration Visual

```
STEP 1: Add MaViTri to LinhKien
┌─────────────────────────────┐
│ LinhKien                    │
├─────────────────────────────┤
│ ASSY (PK)                   │
│ MoTa                        │
│ Rack                        │
│ Tang                        │
│ Thung                       │
│ + MaViTri (NULL initially) ◄──── NEW
└─────────────────────────────┘

STEP 2: Add FK
┌─────────────────────────────┐        ┌──────────────────┐
│ LinhKien                    │──FK────│ ViTriKho         │
├─────────────────────────────┤        ├──────────────────┤
│ ASSY                        │        │ MaViTri (PK)     │
│ MaViTri ─────────────────→  │        │ Rack             │
│ ...                         │        │ Tang             │
└─────────────────────────────┘        │ Thung            │
                                       └──────────────────┘

STEP 3: Map Data
UPDATE LinhKien
SET MaViTri = (SELECT MaViTri FROM ViTriKho 
               WHERE TenDay=Rack AND Tang=Tang AND ViTriO=RIGHT(Thung,1))

STEP 4: Drop Redundant Columns
┌──────────────────────────┐
│ LinhKien (Cleaned)       │
├──────────────────────────┤
│ ASSY (PK)                │
│ MoTa                     │
│ MaViTri (FK) ◄─── Only!  │
│ TonToiThieu              │
│ - Rack (✓ dropped)       │
│ - Tang (✓ dropped)       │
│ - Thung (✓ dropped)      │
└──────────────────────────┘
```

---

## 5. Query Transformation

### Query A: Get Warehouse Map

**BEFORE (Buggy)**
```sql
SELECT v.MaViTri, v.TenDay, v.TenThung,
       t.MaLinhKien, t.SoLuongTon,
       l.MoTa, l.Rack, l.Tang, l.Thung
FROM ViTriKho v
LEFT JOIN TonKhoChiTiet t ON t.MaViTri = v.MaViTri
LEFT JOIN LinhKien l ON l.ASSY = t.MaLinhKien
ORDER BY ISNULL(l.Rack, v.TenDay), ...

ISSUE: 
  • l.Rack bị NULL nếu không có TonKho
  • l.Rack, l.Tang, l.Thung redundant
  • Complex ORDER BY
```

**AFTER (Clean)**
```sql
SELECT v.MaViTri, v.TenDay, v.TenThung,
       l.ASSY, l.MoTa,
       ISNULL(t.SoLuongTon, 0) AS qty,
       v.Rack, v.Tang, v.Thung
FROM ViTriKho v
LEFT JOIN LinhKien l ON l.MaViTri = v.MaViTri
LEFT JOIN TonKhoChiTiet t ON t.MaLinhKien = l.ASSY 
                          AND t.MaViTri = v.MaViTri
ORDER BY v.TenDay, v.Tang, v.Thung, l.ASSY

BENEFIT:
  • ViTriKho luôn là master
  • LinhKien.MaViTri là primary location
  • Clear, predictable
```

---

## 6. Impact Matrix

| Component | BEFORE | AFTER | Impact |
|-----------|--------|-------|--------|
| **DB Size** | Larger (duplicate) | Smaller | ✅ Save space |
| **Query Speed** | Slower (LEFT JOIN x2) | Faster (optimized) | ✅ +5-10% |
| **Data Consistency** | ❌ Inconsistent | ✅ Consistent | ✅ CRITICAL |
| **Maintenance** | Hard (2 sources) | Easy (1 source) | ✅ Easier |
| **Update ASSY Location** | Complex (2 tables) | Simple (1 FK) | ✅ Simpler |
| **Add New ASSY** | Complex (3 inserts) | Simple (1 insert) | ✅ Simpler |
| **Code Complexity** | Medium | Low | ✅ Cleaner |

---

## 7. Risk Assessment

| Risk | Likelihood | Severity | Mitigation |
|------|------------|----------|-----------|
| Data Loss | 🟢 Low | 🔴 Critical | Backup + Gradual | 
| Query Breaking | 🟡 Medium | 🟡 High | Test all APIs |
| Performance Regression | 🟢 Low | 🟡 High | Index on FK |
| Downtime | 🟢 Low | 🟡 High | Off-peak hours |

---

## 8. Rollback Plan

```
IF SOMETHING GOES WRONG:

┌─ Option 1: Restore from Backup Table
│  RESTORE FROM dbo.LinhKien_Backup
│  Time: < 1 minute
│
├─ Option 2: UNDO Normalization Script
│  • Re-add Rack/Tang/Thung columns
│  • Drop MaViTri FK
│  • Restore data from backup
│  Time: 5-10 minutes
│
└─ Option 3: Database Restore Point
   • Restore full database from SQL Server backup
   • Time: 10-20 minutes
```

---

## 9. Implementation Timeline

```
Day 1:
├─ 09:00 - Audit & Backup (10 min)
├─ 09:10 - Run Normalization Script (10 min)
├─ 09:20 - Verify DB Integrity (10 min)
├─ 09:30 - Update Backend API (10 min)
├─ 09:40 - Test & Validation (20 min)
└─ 10:00 - ✅ DONE!

Post-Deployment (1 week later):
└─ Delete backup tables (safe to do)
```

---

## 10. Success Criteria

✅ **MUST HAVE:**
- [ ] All ASSY have MaViTri (no NULL)
- [ ] No ASSY in multiple locations (unique constraint possible)
- [ ] FK validates correctly
- [ ] Warehouse Map API returns correct structure
- [ ] UI renders all tiers correctly

✅ **SHOULD HAVE:**
- [ ] Query performance improved by 5%+
- [ ] Code complexity reduced
- [ ] Zero data loss
- [ ] Backward compatible (if needed)

✅ **NICE TO HAVE:**
- [ ] Archive old TonKhoChiTiet records
- [ ] Create audit trail for location changes
- [ ] Add move history table

---

**Ready to normalize? Let's go! 🚀**
