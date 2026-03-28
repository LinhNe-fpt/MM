import { useCallback, useEffect, useMemo, useState } from "react";

/** Kích thước trang mặc định cho bảng / danh sách */
export const SO_DONG_MOT_TRANG = 20;

/**
 * Phân trang client-side: cắt `items` theo trang.
 * Gọi `resetPage()` khi bộ lọc/tab đổi (ví dụ trong useEffect).
 */
export function usePhanTrang<T>(items: readonly T[], pageSize: number = SO_DONG_MOT_TRANG) {
  const [page, setPageState] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPageState((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const pageClamped = Math.max(1, Math.min(page, totalPages));

  const slice = useMemo(
    () => items.slice((pageClamped - 1) * pageSize, pageClamped * pageSize),
    [items, pageClamped, pageSize],
  );

  const chuyenTrang = useCallback(
    (trang: number) => {
      setPageState(Math.max(1, Math.min(trang, totalPages)));
    },
    [totalPages],
  );

  const resetPage = useCallback(() => {
    setPageState(1);
  }, []);

  return { page: pageClamped, setPage: chuyenTrang, resetPage, totalPages, slice, pageSize };
}
