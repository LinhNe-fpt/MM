/** Payload in QR thùng: `MM|BIN|{row}|{label}|{maViTri}` */
export type KetQuaPhanTichQr =
  | { kind: "bin"; row: string; label: string; maViTri: string; raw: string }
  | { kind: "text"; raw: string };

export function phanTichQrQuet(raw: string): KetQuaPhanTichQr {
  const t = raw.trim();
  if (!t.toUpperCase().startsWith("MM|BIN|")) {
    return { kind: "text", raw: t };
  }
  const parts = t.split("|");
  if (parts.length < 4) {
    return { kind: "text", raw: t };
  }
  const row = parts[2] ?? "";
  const label = parts[3] ?? "";
  const maViTri = parts.length > 4 ? parts.slice(4).join("|") : "";
  return { kind: "bin", row, label, maViTri, raw: t };
}

/** Chuẩn hoá mã để gộp trùng trong danh sách quét dãy */
export function chuanHoaMaQuet(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}
