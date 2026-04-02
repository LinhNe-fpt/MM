/**
 * Luồng trạng thái kế hoạch SX — chỉ tiến một bước, không nhảy cóc, không quay lại.
 * CHO_XUAT_VT → DANG_XUAT → (SAN_SANG | THIEU_VT) → DA_XONG
 */
const ALLOWED = Object.freeze({
  CHO_XUAT_VT: ["DANG_XUAT"],
  DANG_XUAT: ["SAN_SANG", "THIEU_VT"],
  SAN_SANG: ["DA_XONG"],
  THIEU_VT: ["DA_XONG"],
  DA_XONG: [],
});

const ALL = Object.freeze(Object.keys(ALLOWED));

function normalizeKhsxStatus(s) {
  return String(s || "").trim().toUpperCase();
}

function isKnownKhsxStatus(s) {
  return Object.prototype.hasOwnProperty.call(ALLOWED, s);
}

/** Chuyển từ `from` sang `to` có hợp lệ không (hai trạng thái khác nhau). */
function canTransitionKhsx(fromRaw, toRaw) {
  const from = normalizeKhsxStatus(fromRaw);
  const to = normalizeKhsxStatus(toRaw);
  if (!isKnownKhsxStatus(from) || !isKnownKhsxStatus(to)) return false;
  if (from === to) return false;
  const next = ALLOWED[from];
  return Array.isArray(next) && next.includes(to);
}

module.exports = {
  ALLOWED,
  ALL,
  normalizeKhsxStatus,
  isKnownKhsxStatus,
  canTransitionKhsx,
};
