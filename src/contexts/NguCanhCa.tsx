import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { API_BASE } from "@/api/client";
import { useAuth } from "@/contexts/NguCanhXacThuc";

export interface CaLamViec {
  maCa: number;
  maNguoiDung: number;
  tenNguoiDung: string | null;
  thoiGianBatDau: string;
  thoiGianKetThuc: string | null;
  trangThai: "active" | "closed";
  ghiChu: string | null;
}

/** Kết quả trả về khi gọi batDauCa() */
export type KetQuaBatDauCa =
  | { loai: "created";  maCa: number }
  | { loai: "sameUser"; maCa: number }
  | { loai: "conflict"; maCa: number; tenNguoiDung: string; thoiGianBatDau: string };

interface KieuNguCanhCa {
  caHienTai: CaLamViec | null;
  dangTai: boolean;
  batDauCa: (ghiChu?: string) => Promise<KetQuaBatDauCa>;
  batDauCaForce: (ghiChu?: string) => Promise<KetQuaBatDauCa>;
  ketThucCa: () => Promise<{ maCa: number } | null>;
  adminDongCa: (maCa: number, lyDo?: string) => Promise<void>;
  reload: () => void;
}

const NguCanhCa = createContext<KieuNguCanhCa | null>(null);

export function CaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [caHienTai, setCaHienTai] = useState<CaLamViec | null>(null);
  const [dangTai, setDangTai] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const taiKhoan = user?.email ?? "";
  const quyen = (user?.user_metadata as { quyen?: string } | undefined)?.quyen;

  const fetchActive = useCallback(async (silent = false) => {
    if (!silent) setDangTai(true);
    try {
      const res = await fetch(`${API_BASE}/api/shifts/active`);
      if (res.ok) {
        const data = await res.json();
        setCaHienTai(data ?? null);
      }
    } catch { /* ignore network errors */ } finally {
      if (!silent) setDangTai(false);
    }
  }, []);

  useEffect(() => {
    if (!user) { setCaHienTai(null); setDangTai(false); return; }
    fetchActive();
    pollRef.current = setInterval(() => fetchActive(true), 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user, fetchActive]);

  const batDauCa = useCallback(async (ghiChu?: string): Promise<KetQuaBatDauCa> => {
    const res = await fetch(`${API_BASE}/api/shifts/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taiKhoan, ghiChu }),
    });
    const data = await res.json().catch(() => ({})) as {
      maCa?: number; trangThai?: string; sameUser?: boolean;
      conflict?: boolean; tenNguoiDung?: string; thoiGianBatDau?: string;
      error?: string;
    };

    if (res.status === 409 && data.conflict) {
      return {
        loai: "conflict",
        maCa: data.maCa!,
        tenNguoiDung: data.tenNguoiDung ?? "?",
        thoiGianBatDau: data.thoiGianBatDau ?? "",
      };
    }
    if (res.ok && data.sameUser) {
      await fetchActive(true);
      return { loai: "sameUser", maCa: data.maCa! };
    }
    if (res.ok || res.status === 201) {
      await fetchActive(true);
      return { loai: "created", maCa: data.maCa! };
    }
    throw new Error(data.error || "Lỗi bắt đầu ca");
  }, [taiKhoan, fetchActive]);

  /** Admin force-start: đóng ca cũ rồi tạo mới */
  const batDauCaForce = useCallback(async (ghiChu?: string): Promise<KetQuaBatDauCa> => {
    const res = await fetch(`${API_BASE}/api/shifts/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taiKhoan, ghiChu, force: true }),
    });
    const data = await res.json().catch(() => ({})) as { maCa?: number; error?: string };
    if (!res.ok) throw new Error(data.error || "Lỗi force start ca");
    await fetchActive(true);
    return { loai: "created", maCa: data.maCa! };
  }, [taiKhoan, fetchActive]);

  const ketThucCa = useCallback(async (): Promise<{ maCa: number } | null> => {
    if (!caHienTai) return null;
    const maCa = caHienTai.maCa;
    const res = await fetch(`${API_BASE}/api/shifts/${maCa}/end`, { method: "POST" });
    if (res.ok) {
      setCaHienTai(null);
      return { maCa };
    }
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || "Lỗi kết thúc ca");
  }, [caHienTai]);

  const adminDongCa = useCallback(async (maCa: number, lyDo?: string): Promise<void> => {
    if (quyen !== "admin") throw new Error("Không có quyền");
    const res = await fetch(`${API_BASE}/api/shifts/${maCa}/force-end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lyDo }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || "Lỗi đóng ca");
    }
    await fetchActive(true);
  }, [quyen, fetchActive]);

  const reload = useCallback(() => fetchActive(true), [fetchActive]);

  return (
    <NguCanhCa.Provider value={{ caHienTai, dangTai, batDauCa, batDauCaForce, ketThucCa, adminDongCa, reload }}>
      {children}
    </NguCanhCa.Provider>
  );
}

export function useCa() {
  const ctx = useContext(NguCanhCa);
  if (!ctx) throw new Error("useCa phải dùng trong CaProvider");
  return ctx;
}
