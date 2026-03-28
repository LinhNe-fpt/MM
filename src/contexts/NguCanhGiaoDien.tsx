import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

type GiaoDien = "dark" | "light";

interface KieuNguCanhGiaoDien {
  giaoDien: GiaoDien;
  datGiaoDien: (giaoDien: GiaoDien) => void;
  chuyenGiaoDien: () => void;
}

const NguCanhGiaoDien = createContext<KieuNguCanhGiaoDien | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [giaoDien, setGiaoDien] = useState<GiaoDien>(
    () => (localStorage.getItem("ems-theme") as GiaoDien) || "dark"
  );

  useEffect(() => {
    const root = document.documentElement;
    if (giaoDien === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [giaoDien]);

  const datGiaoDien = useCallback((g: GiaoDien) => {
    setGiaoDien(g);
    localStorage.setItem("ems-theme", g);
  }, []);

  const chuyenGiaoDien = useCallback(() => {
    datGiaoDien(giaoDien === "dark" ? "light" : "dark");
  }, [giaoDien, datGiaoDien]);

  return (
    <NguCanhGiaoDien.Provider value={{ giaoDien, datGiaoDien, chuyenGiaoDien: chuyenGiaoDien }}>
      {children}
    </NguCanhGiaoDien.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(NguCanhGiaoDien);
  if (!ctx) throw new Error("useTheme phai dung trong ThemeProvider");
  return { theme: ctx.giaoDien, setTheme: ctx.datGiaoDien, toggleTheme: ctx.chuyenGiaoDien };
}
