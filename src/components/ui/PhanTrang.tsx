import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { cn } from "@/lib/utils";

type Props = {
  trangHienTai: number;
  tongSoTrang: number;
  tongSoMuc: number;
  onChuyenTrang: (trang: number) => void;
  /** Nhãn sau số lượng, ví dụ t("common.pagination_rows") */
  nhanTomTat: string;
  className?: string;
};

/**
 * Thanh điều hướng trang (← 1 2 3 →). Chỉ render khi có hơn 1 trang.
 */
export function PhanTrang({ trangHienTai, tongSoTrang, tongSoMuc, onChuyenTrang, nhanTomTat, className }: Props) {
  const { t } = useI18n();
  if (tongSoTrang <= 1) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/30 px-3 py-2",
        className,
      )}
    >
      <div className="text-xs text-muted-foreground">
        {t("comp.page")} {trangHienTai}/{tongSoTrang} ({tongSoMuc} {nhanTomTat})
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onChuyenTrang(trangHienTai - 1)}
          disabled={trangHienTai === 1}
          className="btn-mechanical rounded border border-border px-2.5 py-1 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          ←
        </button>
        {Array.from({ length: Math.min(5, tongSoTrang) }).map((_, i) => {
          const startPage = Math.max(1, trangHienTai - 2);
          const page = startPage + i;
          if (page > tongSoTrang) return null;
          return (
            <button
              key={page}
              type="button"
              onClick={() => onChuyenTrang(page)}
              className={`btn-mechanical rounded border px-2.5 py-1 text-xs transition-colors ${
                page === trangHienTai
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-accent"
              }`}
            >
              {page}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onChuyenTrang(trangHienTai + 1)}
          disabled={trangHienTai === tongSoTrang}
          className="btn-mechanical rounded border border-border px-2.5 py-1 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          →
        </button>
      </div>
    </div>
  );
}
