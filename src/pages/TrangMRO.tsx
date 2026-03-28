import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { MRO_LOGO_URL } from "@/lib/app-icon";

export default function TrangMRO() {
  const { t } = useI18n();
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-[4.5rem] w-[6.25rem] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white p-1.5 shadow-sm dark:bg-white/95">
            <img src={MRO_LOGO_URL} alt="" className="h-full w-full object-contain object-center" width={100} height={72} decoding="async" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">{t("mro.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("mro.subtitle")}</p>
          </div>
        </div>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("mro.card_title")}</CardTitle>
          <CardDescription>{t("mro.card_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("mro.intro")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
