import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ScanLine, Copy, Trash2, Package, MapPin, Pause, Play, ListOrdered } from "lucide-react";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { VungQuetCamera, type VungQuetCameraHandle } from "@/components/scan/VungQuetCamera";
import { phanTichQrQuet, chuanHoaMaQuet } from "@/lib/parseScanPayload";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

type DongDanhSach = { key: string; raw: string };

export default function TrangQuetMa() {
  const { t } = useI18n();
  const [cheDo, setCheDo] = useState<"don" | "day">("don");
  const [cameraBat, setCameraBat] = useState(true);
  const refCamera = useRef<VungQuetCameraHandle>(null);
  const [ketQuaDon, setKetQuaDon] = useState<string | null>(null);
  const [danhSach, setDanhSach] = useState<DongDanhSach[]>([]);

  const xuLyMa = useCallback(
    (text: string) => {
      const raw = text.trim();
      if (!raw) return;

      if (cheDo === "don") {
        setKetQuaDon(raw);
        try {
          if (navigator.vibrate) navigator.vibrate(40);
        } catch {
          /* ignore */
        }
        return;
      }

      const khoa = chuanHoaMaQuet(raw);
      setDanhSach((prev) => {
        if (prev.some((d) => chuanHoaMaQuet(d.raw) === khoa)) {
          toast.message(t("scan.batch_dupe"));
          return prev;
        }
        return [...prev, { key: `${Date.now()}-${prev.length}`, raw }];
      });
      try {
        if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
      } catch {
        /* ignore */
      }
    },
    [cheDo, t],
  );

  const parsedDon = ketQuaDon ? phanTichQrQuet(ketQuaDon) : null;

  async function saoChepDanhSach() {
    if (danhSach.length === 0) return;
    const body = danhSach.map((d) => d.raw).join("\n");
    try {
      await navigator.clipboard.writeText(body);
      toast.success(t("scan.batch_copied"));
    } catch {
      toast.error(t("scan.batch_copy_fail"));
    }
  }

  function xoaDong(key: string) {
    setDanhSach((prev) => prev.filter((d) => d.key !== key));
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-8rem)] p-4 md:p-6 max-w-lg mx-auto w-full gap-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <ScanLine className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight">{t("scan.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("scan.desc")}</p>
        </div>
      </div>

      <Tabs value={cheDo} onValueChange={(v) => setCheDo(v as "don" | "day")} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="don">{t("scan.tab_single")}</TabsTrigger>
          <TabsTrigger value="day" className="gap-1">
            <ListOrdered className="h-3.5 w-3.5" />
            {t("scan.tab_batch")}
          </TabsTrigger>
        </TabsList>

        <div className="flex justify-end mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={async () => {
              if (cameraBat) {
                await refCamera.current?.tamDung();
              }
              setCameraBat((b) => !b);
            }}
          >
            {cameraBat ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {cameraBat ? t("scan.camera_pause") : t("scan.camera_resume")}
          </Button>
        </div>

        <div className="mt-3 space-y-3">
          {cheDo === "day" && <p className="text-sm text-muted-foreground">{t("scan.batch_help")}</p>}
          <VungQuetCamera ref={refCamera} bat={cameraBat} khiGiaiMa={xuLyMa} />
        </div>

        <TabsContent value="don" className="mt-3 space-y-4">
          {ketQuaDon && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("scan.last_scan")}</p>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-muted/50 rounded-lg p-3">{ketQuaDon}</pre>
              {parsedDon?.kind === "bin" ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button asChild size="sm" variant="secondary" className="gap-2">
                    <Link to={`/warehouse?vt=${encodeURIComponent(parsedDon.label)}`}>
                      <MapPin className="h-4 w-4" />
                      {t("scan.open_bin")}
                    </Link>
                  </Button>
                </div>
              ) : (
                <Button asChild size="sm" className="gap-2 w-full sm:w-auto">
                  <Link to={`/components?q=${encodeURIComponent(ketQuaDon.trim())}`}>
                    <Package className="h-4 w-4" />
                    {t("scan.open_component")}
                  </Link>
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="day" className="mt-3 space-y-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/30">
              <span className="text-sm font-medium">
                {t("scan.batch_list_title")}{" "}
                <span className="tabular-nums text-muted-foreground">({danhSach.length})</span>
              </span>
              <div className="flex gap-1 shrink-0">
                <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={saoChepDanhSach} disabled={danhSach.length === 0}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-destructive"
                  onClick={() => setDanhSach([])}
                  disabled={danhSach.length === 0}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {danhSach.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">{t("scan.batch_empty")}</p>
            ) : (
              <ScrollArea className="h-[min(40vh,280px)]">
                <ul className="p-2 space-y-1">
                  {danhSach.map((d, i) => (
                    <li
                      key={d.key}
                      className="flex items-start gap-2 rounded-lg border border-border/60 bg-background px-2 py-2 text-sm"
                    >
                      <span className="text-[10px] font-mono text-muted-foreground tabular-nums w-6 shrink-0 pt-0.5">{i + 1}</span>
                      <span className="font-mono text-xs break-all flex-1 min-w-0">{d.raw}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => xoaDong(d.key)} aria-label={t("scan.batch_remove")}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>
          <Button type="button" variant="secondary" className="w-full gap-2" onClick={saoChepDanhSach} disabled={danhSach.length === 0}>
            <Copy className="h-4 w-4" />
            {t("scan.batch_copy_all")}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
