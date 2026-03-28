import { ScanLine } from "lucide-react";
import { useI18n } from "@/contexts/NguCanhNgonNgu";

export default function TrangQuetMa() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center">
      <div className="w-24 h-24 rounded-2xl bg-primary/15 flex items-center justify-center mb-6">
        <ScanLine className="w-12 h-12 text-primary" />
      </div>
      <h1 className="text-xl font-bold tracking-tight mb-2">{t("scan.title")}</h1>
      <p className="text-sm text-muted-foreground max-w-xs">{t("scan.desc")}</p>
      <div className="mt-8 w-64 h-64 border-2 border-dashed border-primary/40 rounded-xl flex items-center justify-center">
        <p className="text-xs text-muted-foreground">{t("scan.camera")}</p>
      </div>
    </div>
  );
}
