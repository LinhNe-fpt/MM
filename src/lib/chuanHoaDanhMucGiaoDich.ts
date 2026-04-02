/**
 * Chuẩn hóa tên danh mục nhập/xuất (fix DB/encoding sai, so khớp lọc với giao dịch cũ).
 */
export function chuanHoaTenDanhMuc(ten: string): string {
  const s = String(ten || "").trim();
  if (!s) return s;
  const oneSpace = s.replace(/\s+/g, " ");
  // "SX TR?" / replacement char — đúng ra là "SX TRẢ"
  if (/^SX TR[?\uFFFD]$/i.test(oneSpace)) return "SX TRẢ";
  if (/^SX TR$/i.test(oneSpace)) return "SX TRẢ";
  return s;
}

export function gopDanhMucTrungLap(items: { ten: string; moTa: string }[]): { ten: string; moTa: string }[] {
  const m = new Map<string, { ten: string; moTa: string }>();
  for (const it of items) {
    const ten = chuanHoaTenDanhMuc(it.ten);
    const prev = m.get(ten);
    if (!prev) m.set(ten, { ten, moTa: it.moTa || "" });
    else if (!prev.moTa && it.moTa) m.set(ten, { ten, moTa: it.moTa });
  }
  return [...m.values()];
}
