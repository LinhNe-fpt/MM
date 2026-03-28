import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { NgonNgu, phienDich } from "@/i18n/phienDich";

interface KieuNguCanhNgonNgu {
  ngonNgu: NgonNgu;
  datNgonNgu: (lang: NgonNgu) => void;
  t: (key: string, vars?: Record<string, string>) => string;
}

/** Dùng khi chưa có Provider (HMR tạm thời, edge case) — tránh crash toàn app. */
const FALLBACK_I18N: KieuNguCanhNgonNgu = {
  ngonNgu: "vi",
  datNgonNgu: () => {},
  t: (key: string, vars?: Record<string, string>) => {
    try {
      let val = phienDich.vi[key] || key;
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          val = val.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
        });
      }
      return val;
    } catch {
      return key;
    }
  },
};

const NguCanhNgonNgu = createContext<KieuNguCanhNgonNgu>(FALLBACK_I18N);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [ngonNgu, setNgonNgu] = useState<NgonNgu>(() => {
    const saved = localStorage.getItem("ems-lang");
    return (saved === "vi" || saved === "ko") ? saved : "vi";
  });

  const datNgonNgu = useCallback((lang: NgonNgu) => {
    setNgonNgu(lang);
    localStorage.setItem("ems-lang", lang);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string>) => {
      try {
        const dict = phienDich[ngonNgu] ?? phienDich["vi"];
        let val = dict[key] || phienDich["vi"][key] || key;
        if (vars) {
          Object.entries(vars).forEach(([k, v]) => {
            val = val.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
          });
        }
        return val;
      } catch {
        return key;
      }
    },
    [ngonNgu]
  );

  return (
    <NguCanhNgonNgu.Provider value={{ ngonNgu, datNgonNgu, t }}>
      {children}
    </NguCanhNgonNgu.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(NguCanhNgonNgu);
  return {
    ...ctx,
    language: ctx.ngonNgu,
    setLanguage: ctx.datNgonNgu,
    t: ctx.t as (key: string, vars?: Record<string, string>) => string,
  };
}
