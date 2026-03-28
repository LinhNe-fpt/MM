import { createContext, useContext, type ReactNode } from "react";

/** Luồng UI: chỉ UPK hoặc chỉ RMA (không gộp). */
export type KhoPhuScope = "UPK" | "RMA";

export type KhoPhuValue = {
  scope: KhoPhuScope;
  /** Tiền tố route: `/upk` hoặc `/rma` */
  basePath: "/upk" | "/rma";
};

const Ctx = createContext<KhoPhuValue | null>(null);

export function KhoPhuProvider({ scope, children }: { scope: KhoPhuScope; children: ReactNode }) {
  const basePath: "/upk" | "/rma" = scope === "UPK" ? "/upk" : "/rma";
  return <Ctx.Provider value={{ scope, basePath }}>{children}</Ctx.Provider>;
}

export function useKhoPhu(): KhoPhuValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useKhoPhu chỉ dùng trong module UPK/RMA");
  return v;
}
