import { useEffect, useState } from "react";
import { usePhanTrang } from "@/lib/usePhanTrang";
import { PhanTrang } from "@/components/ui/PhanTrang";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/NguCanhXacThuc";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { fetchCatalogTomTat, type BoPhanRow, type VaiTroRow } from "@/lib/catalogApi";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, BadgeCheck, ArrowLeft } from "lucide-react";

export default function TrangBoPhanVaiTro() {
  const { t } = useI18n();
  const { user } = useAuth();
  const quyen = (user?.user_metadata as { quyen?: string } | undefined)?.quyen;
  if (quyen !== "admin") return <Navigate to="/" replace />;

  const [boPhan, setBoPhan] = useState<BoPhanRow[]>([]);
  const [vaiTro, setVaiTro] = useState<VaiTroRow[]>([]);
  const [loi, setLoi] = useState<string | null>(null);
  const [canhBaoThieuBang, setCanhBaoThieuBang] = useState<string | null>(null);
  const [tai, setTai] = useState(true);

  useEffect(() => {
    let huy = false;
    (async () => {
      setTai(true);
      setLoi(null);
      setCanhBaoThieuBang(null);
      try {
        const data = await fetchCatalogTomTat();
        if (!huy) {
          setBoPhan(data.boPhan);
          setVaiTro(data.vaiTro);
          if (data.catalogMissing) {
            setCanhBaoThieuBang(
              data.hint || t("admin.roles_catalog_missing_hint"),
            );
          }
        }
      } catch (e) {
        if (!huy) setLoi(e instanceof Error ? e.message : t("admin.roles_load_error_generic"));
      } finally {
        if (!huy) setTai(false);
      }
    })();
    return () => {
      huy = true;
    };
  }, [t]);

  const pgBp = usePhanTrang(boPhan);
  const pgVt = usePhanTrang(vaiTro);

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col px-4 pb-8 pt-4 md:px-6 md:pt-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 h-8 gap-1 text-muted-foreground" asChild>
            <Link to="/admin/users">
              <ArrowLeft className="h-4 w-4" />
              {t("users.title")}
            </Link>
          </Button>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">{t("admin.roles_catalog_title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.roles_catalog_subtitle")}</p>
        </div>
      </div>

      {tai ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">{t("admin.roles_loading")}</p>
        </div>
      ) : loi ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-medium">{t("admin.roles_catalog_error")}</p>
          <p className="mt-2 whitespace-pre-wrap font-mono text-xs opacity-90">{loi}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {canhBaoThieuBang && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-medium">{t("admin.roles_catalog_missing_title")}</p>
              <p className="mt-2 whitespace-pre-wrap text-xs opacity-90">{canhBaoThieuBang}</p>
            </div>
          )}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <Building2 className="h-4 w-4" />
              {t("admin.roles_section_departments")}
            </h2>
            <div className="flex flex-col overflow-hidden rounded-lg border border-border">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left">
                    <th className="p-3 font-medium">{t("admin.roles_col_mabophan")}</th>
                    <th className="p-3 font-medium">{t("admin.roles_col_name")}</th>
                    <th className="p-3 font-medium w-20">{t("admin.roles_col_thutu")}</th>
                    <th className="p-3 font-medium">{t("admin.roles_col_note")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pgBp.slice.map((b) => (
                    <tr key={b.MaBoPhan} className="border-b border-border/80">
                      <td className="p-3 font-mono text-xs">{b.MaBoPhan}</td>
                      <td className="p-3">{b.TenBoPhan}</td>
                      <td className="p-3 tabular-nums">{b.ThuTu}</td>
                      <td className="p-3 text-muted-foreground">{b.GhiChu ?? t("admin.roles_empty_cell")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              {boPhan.length > 0 ? (
                <PhanTrang
                  trangHienTai={pgBp.page}
                  tongSoTrang={pgBp.totalPages}
                  tongSoMuc={boPhan.length}
                  onChuyenTrang={pgBp.setPage}
                  nhanTomTat={t("comp.pagination_rows")}
                />
              ) : null}
            </div>
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <BadgeCheck className="h-4 w-4" />
              {t("admin.roles_section_roles")}
            </h2>
            <div className="flex flex-col overflow-hidden rounded-lg border border-border">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left">
                    <th className="p-3 font-medium">{t("admin.roles_col_mavaitro")}</th>
                    <th className="p-3 font-medium">{t("admin.roles_col_display")}</th>
                    <th className="p-3 font-medium">{t("admin.roles_col_mabophan")}</th>
                    <th className="p-3 font-medium">{t("admin.roles_col_dept")}</th>
                    <th className="p-3 font-medium w-24" title={t("admin.roles_col_flag_qt_aria")}>
                      {t("admin.roles_col_flag_qt")}
                    </th>
                    <th className="p-3 font-medium w-24">{t("admin.roles_col_mac_dinh")}</th>
                    <th className="p-3 font-medium">{t("admin.roles_col_note")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pgVt.slice.map((v) => (
                    <tr key={v.MaVaiTro} className="border-b border-border/80">
                      <td className="p-3 font-mono text-xs">{v.MaVaiTro}</td>
                      <td className="p-3">{v.TenHienThi}</td>
                      <td className="p-3 font-mono text-xs">{v.MaBoPhan}</td>
                      <td className="p-3 text-muted-foreground">{v.TenBoPhan}</td>
                      <td className="p-3" title={t("admin.roles_col_flag_qt_aria")}>
                        {v.LaQuanTri ? "✓" : ""}
                      </td>
                      <td className="p-3" title={t("admin.roles_col_mac_dinh")}>
                        {v.DuLieuMacDinh ? "✓" : ""}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs max-w-md">
                        {v.MoTa ?? t("admin.roles_empty_cell")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              {vaiTro.length > 0 ? (
                <PhanTrang
                  trangHienTai={pgVt.page}
                  tongSoTrang={pgVt.totalPages}
                  tongSoMuc={vaiTro.length}
                  onChuyenTrang={pgVt.setPage}
                  nhanTomTat={t("comp.pagination_rows")}
                />
              ) : null}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
