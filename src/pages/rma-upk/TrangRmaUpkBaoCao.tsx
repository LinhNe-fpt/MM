import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileBarChart } from "lucide-react";
import { useI18n } from "@/contexts/NguCanhNgonNgu";

export default function TrangRmaUpkBaoCao() {
  const { t } = useI18n();
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold">{t("rmaUpk.rep_title")}</h1>
        <p className="text-sm text-muted-foreground">{t("rmaUpk.rep_subtitle")}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileBarChart className="h-4 w-4" />
            {t("rmaUpk.rep_wip")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t("rmaUpk.rep_body1")}</p>
          <p>{t("rmaUpk.rep_body2")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
