import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
 import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { API_BASE } from "@/api/client";

/** User tra ve tu API dang nhap (NguoiDung) */
export interface NguoiDungDb {
  maNguoiDung: number;
  taiKhoan: string;
  hoTen: string | null;
  quyen: string | null;
  anhDaiDien?: string | null;
}

interface KieuNguCanhXacThuc {
  nguoiDung: User | null;
  phien: Session | null;
  dangTai: boolean;
  dangNhap: (email: string, matKhau: string) => Promise<{ error: Error | null; conflict?: { quyen: string; blockedBy: string } }>;
  dangKy: (email: string, matKhau: string, tenHienThi?: string) => Promise<{ error: Error | null }>;
  dangXuat: () => Promise<void>;
  datLaiMatKhau: (email: string) => Promise<{ error: Error | null }>;
  capNhatMatKhau: (matKhau: string) => Promise<{ error: Error | null }>;
  capNhatAnhDaiDien: (anhDaiDien: string | null) => void;
}

const NguCanhXacThuc = createContext<KieuNguCanhXacThuc | null>(null);

const STORAGE_KEY_DB_USER = "ems-auth-db-user";
const STORAGE_KEY_SESSION = "ems-auth-session-token";

/** Chuyen user tu API (NguoiDung) sang dang User de dung chung trong app */
function userDbToSupabaseUser(u: NguoiDungDb): User {
  return {
    id: String(u.maNguoiDung),
    email: u.taiKhoan,
    app_metadata: {},
    user_metadata: { fromDb: true, hoTen: u.hoTen, quyen: u.quyen, anhDaiDien: u.anhDaiDien ?? null },
    aud: "authenticated",
    created_at: new Date().toISOString(),
  } as User;
}

function layUserDbTuStorage(): NguoiDungDb | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DB_USER);
    if (!raw) return null;
    const u = JSON.parse(raw) as NguoiDungDb;
    if (u && typeof u.maNguoiDung === "number" && u.taiKhoan) return u;
  } catch { /* ignore */ }
  return null;
}

function luuUserDbStorage(u: NguoiDungDb | null) {
  if (typeof localStorage === "undefined") return;
  if (u) localStorage.setItem(STORAGE_KEY_DB_USER, JSON.stringify(u));
  else localStorage.removeItem(STORAGE_KEY_DB_USER);
}

function layMaPhien(): string | null {
  try { return localStorage.getItem(STORAGE_KEY_SESSION); } catch { return null; }
}
function luuMaPhien(token: string | null) {
  try {
    if (token) localStorage.setItem(STORAGE_KEY_SESSION, token);
    else localStorage.removeItem(STORAGE_KEY_SESSION);
  } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [nguoiDung, setNguoiDung] = useState<User | null>(null);
  const [phien, setPhien] = useState<Session | null>(null);
  const [dangTai, setDangTai] = useState(true);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Dừng heartbeat timer */
  function stopHeartbeat() {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }

  /** Bắt đầu gửi heartbeat mỗi 5 phút */
  function startHeartbeat() {
    stopHeartbeat();
    heartbeatRef.current = setInterval(async () => {
      const maPhien = layMaPhien();
      if (!maPhien) return;
      try {
        const res = await fetch(`${API_BASE}/api/auth/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maPhien }),
        });
        if (res.status === 401) {
          // Phiên hết hạn hoặc bị xoá (người khác đăng nhập cùng vai trò)
          stopHeartbeat();
          luuUserDbStorage(null);
          luuMaPhien(null);
          setNguoiDung(null);
          setPhien(null);
        }
      } catch { /* bỏ qua lỗi mạng tạm thời */ }
    }, 5 * 60 * 1000); // 5 phút
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setPhien(session);
      setNguoiDung(session?.user ?? null);
      setDangTai(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setPhien(session);
        setNguoiDung(session.user);
      } else {
        const dbUser = layUserDbTuStorage();
        if (dbUser) {
          setPhien(null);
          setNguoiDung(userDbToSupabaseUser(dbUser));
          // Khởi động lại heartbeat nếu có session token
          if (layMaPhien()) startHeartbeat();
        } else {
          setPhien(null);
          setNguoiDung(null);
        }
      }
      setDangTai(false);
    });

    return () => {
      subscription.unsubscribe();
      stopHeartbeat();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dangNhap = async (tenDangNhap: string, matKhau: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taiKhoan: tenDangNhap.trim(), matKhau }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        user?: NguoiDungDb;
        maPhien?: string;
        error?: string;
        quyen?: string;
        blockedBy?: string;
      };

      if (res.ok && data.user) {
        luuUserDbStorage(data.user);
        if (data.maPhien) luuMaPhien(data.maPhien);
        setNguoiDung(userDbToSupabaseUser(data.user));
        setPhien(null);
        setDangTai(false);
        startHeartbeat();
        return { error: null };
      }

      if (res.status === 409 && data.error === "session_conflict") {
        return {
          error: new Error("session_conflict"),
          conflict: { quyen: data.quyen ?? "", blockedBy: data.blockedBy ?? "" },
        };
      }
      if (res.status === 401) {
        return { error: new Error(data.error || "Sai tai khoan hoac mat khau") };
      }
      return { error: new Error(data.error || "Loi dang nhap") };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error("Loi ket noi") };
    }
  };

  const dangKy = async (email: string, matKhau: string, tenHienThi?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password: matKhau,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: tenHienThi },
      },
    });
    return { error: error as Error | null };
  };

  const dangXuat = async () => {
    const fromDb = (nguoiDung?.user_metadata as { fromDb?: boolean } | undefined)?.fromDb;
    if (fromDb) {
      // Gọi server xoá phiên
      const maPhien = layMaPhien();
      if (maPhien) {
        fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maPhien }),
        }).catch(() => {});
      }
      stopHeartbeat();
      luuUserDbStorage(null);
      luuMaPhien(null);
      setNguoiDung(null);
      setPhien(null);
      return;
    }
    await supabase.auth.signOut();
  };

  const datLaiMatKhau = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error as Error | null };
  };

  const capNhatMatKhau = async (matKhau: string) => {
    const { error } = await supabase.auth.updateUser({ password: matKhau });
    return { error: error as Error | null };
  };

  const capNhatAnhDaiDien = (anhDaiDien: string | null) => {
    const fromDb = (nguoiDung?.user_metadata as { fromDb?: boolean } | undefined)?.fromDb;
    if (!fromDb || !nguoiDung) return;
    const raw = localStorage.getItem(STORAGE_KEY_DB_USER);
    if (!raw) return;
    try {
      const u = JSON.parse(raw) as NguoiDungDb;
      u.anhDaiDien = anhDaiDien;
      luuUserDbStorage(u);
      setNguoiDung(userDbToSupabaseUser(u));
    } catch { /* ignore */ }
  };

  return (
    <NguCanhXacThuc.Provider value={{ nguoiDung, phien, dangTai, dangNhap, dangKy, dangXuat, datLaiMatKhau, capNhatMatKhau, capNhatAnhDaiDien }}>
      {children}
    </NguCanhXacThuc.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(NguCanhXacThuc);
  if (!ctx) throw new Error("useAuth phai dung trong AuthProvider");
  return {
    user: ctx.nguoiDung,
    session: ctx.phien,
    loading: ctx.dangTai,
    signIn: ctx.dangNhap,
    signUp: ctx.dangKy,
    signOut: ctx.dangXuat,
    resetPassword: ctx.datLaiMatKhau,
    updatePassword: ctx.capNhatMatKhau,
    capNhatAnhDaiDien: ctx.capNhatAnhDaiDien,
  };
}
