import { useMemo, useState } from "react";
import {
  Users,
  ClipboardList,
  Package,
  Activity,
  AlertTriangle,
  Pill,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { Y_TE_LOGO_URL } from "@/lib/app-icon";
import { cn } from "@/lib/utils";

type HangCho = {
  id: string;
  time: string;
  name: string;
  dept: string;
  reason: string;
  status: "waiting" | "in_progress";
};

type BenhNhan = {
  id: string;
  name: string;
  dept: string;
  lastVisit: string;
  bp: string;
  hr: string;
  spo2: string;
  temp: string;
};

type ThuocGoiY = {
  id: string;
  name: string;
  dosage: string;
  instruction: string;
};

type ThuocKho = {
  id: string;
  name: string;
  qty: number;
  min: number;
  unit: string;
};

const MAU_HANG_CHO: HangCho[] = [
  { id: "1", time: "08:10", name: "Nguyễn Thị Lan", dept: "Sản xuất LINE 2", reason: "Đau đầu, sốt nhẹ", status: "waiting" },
  { id: "2", time: "08:22", name: "Trần Văn Hùng", dept: "Kho UPK", reason: "Trầy da khi làm việc", status: "waiting" },
  { id: "3", time: "08:35", name: "Lê Minh Tuấn", dept: "QA", reason: "Khám định kỳ", status: "in_progress" },
  { id: "4", time: "08:40", name: "Phạm Thu Hà", dept: "Văn phòng", reason: "Đau họng, ho", status: "waiting" },
];

const MAU_BENH_NHAN: BenhNhan[] = [
  { id: "a", name: "Nguyễn Thị Lan", dept: "Sản xuất LINE 2", lastVisit: "28/03/2026", bp: "118/76", hr: "78", spo2: "98%", temp: "37,1°C" },
  { id: "b", name: "Trần Văn Hùng", dept: "Kho UPK", lastVisit: "15/03/2026", bp: "122/80", hr: "82", spo2: "97%", temp: "36,8°C" },
  { id: "c", name: "Lê Minh Tuấn", dept: "QA", lastVisit: "28/03/2026", bp: "110/72", hr: "68", spo2: "99%", temp: "36,6°C" },
];

const MAU_THUOC_GOI_Y: ThuocGoiY[] = [
  { id: "m1", name: "Paracetamol 500 mg", dosage: "1 viên / lần, tối đa 4 lần/ngày", instruction: "Uống sau ăn, cách nhau ít nhất 4 giờ" },
  { id: "m2", name: "Dung dịch sát khuẩn (Povidone-Iodine)", dosage: "Bôi 1–2 lần/ngày", instruction: "Rửa sạch vết thương trước khi bôi" },
  { id: "m3", name: "Thuốc ho viêm họng (dạng viên ngậm)", dosage: "1 viên ngậm, 3–4 lần/ngày", instruction: "Không nuốt ngay; tránh ăn uống 15 phút sau" },
  { id: "m4", name: "Oresol / bù nước điện giải", dosage: "1 gói pha 200 ml nước, uống từng ngụm", instruction: "Dùng khi sốt, mất nước nhẹ" },
];

const MAU_KHO: ThuocKho[] = [
  { id: "k1", name: "Paracetamol 500 mg", qty: 8, min: 20, unit: "vỉ" },
  { id: "k2", name: "Khẩu trang y tế 4 lớp", qty: 120, min: 50, unit: "cái" },
  { id: "k3", name: "Băng gạc vô trùng", qty: 40, min: 15, unit: "miếng" },
  { id: "k4", name: "Thuốc ho viên ngậm", qty: 5, min: 10, unit: "hộp" },
  { id: "k5", name: "Povidone-Iodine 10%", qty: 3, min: 4, unit: "chai" },
];

function TheKpi({
  icon: Icon,
  label,
  value,
  sub,
  variant,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  sub?: string;
  variant?: "default" | "amber" | "rose";
}) {
  const border =
    variant === "amber"
      ? "border-amber-200/80 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20"
      : variant === "rose"
        ? "border-rose-200/80 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20"
        : "border-border bg-card";
  return (
    <Card className={cn("shadow-sm", border)}>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums leading-tight">{value}</p>
          {sub ? <p className="text-xs text-muted-foreground mt-0.5">{sub}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function TrangYTe() {
  const { t } = useI18n();
  const [hangCho, setHangCho] = useState<HangCho[]>(MAU_HANG_CHO);
  const [donThuoc, setDonThuoc] = useState<ThuocGoiY[]>([]);

  const choKham = useMemo(() => hangCho.filter((h) => h.status === "waiting").length, [hangCho]);
  const dangKham = useMemo(() => hangCho.filter((h) => h.status === "in_progress").length, [hangCho]);
  const sapHet = useMemo(() => MAU_KHO.filter((k) => k.qty <= k.min).length, []);

  function goiVao(id: string) {
    setHangCho((prev) =>
      prev.map((h) => (h.id === id ? { ...h, status: "in_progress" as const } : h)),
    );
  }

  function themThuoc(thuoc: ThuocGoiY) {
    setDonThuoc((prev) => (prev.some((x) => x.id === thuoc.id) ? prev : [...prev, thuoc]));
  }

  function xoaDon() {
    setDonThuoc([]);
  }

  return (
    <div className="relative mx-auto max-w-6xl min-h-[min(560px,65vh)]">
      {/* Watermark: logo Hội Chữ thập đỏ / Yousung Vina (logo-y-te.png) — cùng kích thước kiểu Nhập/Xuất */}
      <div
        className="pointer-events-none absolute inset-0 z-0 flex select-none items-center justify-center overflow-hidden"
        aria-hidden
      >
        <img
          src={Y_TE_LOGO_URL}
          alt=""
          className="h-auto w-full max-h-[min(504px,66vh)] max-w-[min(624px,85vw)] object-contain opacity-[0.09] dark:opacity-[0.12]"
          decoding="async"
        />
      </div>

      <div className="relative z-10 space-y-5 p-4 md:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white shadow-sm dark:bg-white/95 p-1">
            <img
              src={Y_TE_LOGO_URL}
              alt=""
              className="h-full w-full object-contain"
              width={72}
              height={72}
              decoding="async"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">{t("health.title")}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("health.subtitle")}</p>
          </div>
        </div>
        <Badge variant="secondary" className="shrink-0 self-start gap-1 py-1.5 text-xs font-normal">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {t("health.demo_banner")}
        </Badge>
      </header>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-1 flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          <TabsTrigger value="overview" className="gap-1.5">
            <Activity className="h-4 w-4" aria-hidden />
            {t("health.tab_overview")}
          </TabsTrigger>
          <TabsTrigger value="reception" className="gap-1.5">
            <Users className="h-4 w-4" aria-hidden />
            {t("health.tab_reception")}
          </TabsTrigger>
          <TabsTrigger value="records" className="gap-1.5">
            <ClipboardList className="h-4 w-4" aria-hidden />
            {t("health.tab_records")}
          </TabsTrigger>
          <TabsTrigger value="rx" className="gap-1.5">
            <Pill className="h-4 w-4" aria-hidden />
            {t("health.tab_rx_stock")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TheKpi icon={Users} label={t("health.kpi_waiting")} value={choKham} sub={dangKham ? `${dangKham} ${t("health.status_in_progress").toLowerCase()}` : undefined} variant="amber" />
            <TheKpi icon={ClipboardList} label={t("health.kpi_today_done")} value={12} />
            <TheKpi icon={AlertTriangle} label={t("health.kpi_low_stock")} value={sapHet} variant="rose" />
            <TheKpi icon={Activity} label={t("health.kpi_followup")} value={3} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("health.section_queue")}</CardTitle>
                <CardDescription>{t("health.tab_reception")}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {hangCho.slice(0, 4).map((h) => (
                    <li
                      key={h.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/20 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <span className="font-mono text-xs text-muted-foreground">{h.time}</span>{" "}
                        <span className="font-medium">{h.name}</span>
                        <p className="text-xs text-muted-foreground truncate">{h.reason}</p>
                      </div>
                      <Badge variant={h.status === "waiting" ? "secondary" : "default"} className="shrink-0">
                        {h.status === "waiting" ? t("health.status_waiting") : t("health.status_in_progress")}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("health.section_stock_alerts")}</CardTitle>
                <CardDescription>{t("health.stock_desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {MAU_KHO.filter((k) => k.qty <= k.min)
                    .slice(0, 4)
                    .map((k) => (
                      <li
                        key={k.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-rose-200/60 bg-rose-50/40 px-3 py-2 text-sm dark:border-rose-900/50 dark:bg-rose-950/25"
                      >
                        <span className="min-w-0 font-medium truncate">{k.name}</span>
                        <span className="shrink-0 font-mono tabular-nums text-xs">
                          {k.qty} / {k.min} {k.unit}
                        </span>
                      </li>
                    ))}
                </ul>
                {MAU_KHO.every((k) => k.qty > k.min) ? (
                  <p className="text-sm text-muted-foreground">{t("health.badge_ok")}</p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reception" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("health.section_queue")}</CardTitle>
              <CardDescription>{t("health.col_reason")}</CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              <ScrollArea className="h-[min(420px,55vh)] sm:h-[min(480px,60vh)]">
                <div className="min-w-[520px] space-y-0 divide-y divide-border">
                  <div className="grid grid-cols-[5rem_1fr_1.2fr_8rem_7rem] gap-2 bg-muted/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>{t("health.col_time")}</span>
                    <span>{t("health.col_patient")}</span>
                    <span>{t("health.col_reason")}</span>
                    <span>{t("health.col_dept")}</span>
                    <span className="text-right">{t("health.col_status")}</span>
                  </div>
                  {hangCho.map((h) => (
                    <div
                      key={h.id}
                      className="grid grid-cols-[5rem_1fr_1.2fr_8rem_7rem] items-center gap-2 px-4 py-3 text-sm hover:bg-muted/30"
                    >
                      <span className="font-mono text-xs text-muted-foreground">{h.time}</span>
                      <span className="font-medium">{h.name}</span>
                      <span className="text-muted-foreground">{h.reason}</span>
                      <span className="text-xs">{h.dept}</span>
                      <div className="flex justify-end gap-1">
                        {h.status === "waiting" ? (
                          <Button type="button" size="sm" variant="secondary" className="h-8 text-xs" onClick={() => goiVao(h.id)}>
                            {t("health.btn_call")}
                          </Button>
                        ) : (
                          <Badge>{t("health.status_in_progress")}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">{t("health.records_intro")}</p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {MAU_BENH_NHAN.map((bn) => (
              <Card key={bn.id} className="overflow-hidden shadow-sm">
                <CardHeader className="border-b border-border/60 bg-muted/30 pb-3">
                  <CardTitle className="text-base">{bn.name}</CardTitle>
                  <CardDescription>
                    {t("health.col_dept")}: {bn.dept}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <p className="text-xs text-muted-foreground">
                    {t("health.last_visit")}: <span className="font-medium text-foreground">{bn.lastVisit}</span>
                  </p>
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("health.vitals_title")}</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-md border border-border/80 bg-background px-2 py-1.5">
                        <span className="text-xs text-muted-foreground">{t("health.vital_bp")}</span>
                        <p className="font-mono font-semibold">{bn.bp}</p>
                      </div>
                      <div className="rounded-md border border-border/80 bg-background px-2 py-1.5">
                        <span className="text-xs text-muted-foreground">{t("health.vital_hr")}</span>
                        <p className="font-mono font-semibold">{bn.hr} bpm</p>
                      </div>
                      <div className="rounded-md border border-border/80 bg-background px-2 py-1.5">
                        <span className="text-xs text-muted-foreground">{t("health.vital_spo2")}</span>
                        <p className="font-mono font-semibold">{bn.spo2}</p>
                      </div>
                      <div className="rounded-md border border-border/80 bg-background px-2 py-1.5">
                        <span className="text-xs text-muted-foreground">{t("health.vital_temp")}</span>
                        <p className="font-mono font-semibold">{bn.temp}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rx" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="lg:row-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Pill className="h-5 w-5 text-primary" aria-hidden />
                  {t("health.quick_rx_title")}
                </CardTitle>
                <CardDescription>{t("health.quick_rx_desc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium">{t("health.suggested_meds")}</p>
                  <div className="space-y-2">
                    {MAU_THUOC_GOI_Y.map((th) => (
                      <div key={th.id} className="rounded-lg border border-border bg-muted/15 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-medium leading-snug">{th.name}</p>
                          <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 text-xs" onClick={() => themThuoc(th)}>
                            {t("health.btn_add_rx")}
                          </Button>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{t("health.dosage")}:</span> {th.dosage}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{t("health.instruction")}:</span> {th.instruction}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
                  <p className="mb-2 text-sm font-medium">{t("health.current_rx")}</p>
                  {donThuoc.length === 0 ? (
                    <p className="text-sm text-muted-foreground">—</p>
                  ) : (
                    <ul className="space-y-2">
                      {donThuoc.map((th) => (
                        <li key={th.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border/80 bg-background px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <p className="font-medium">{th.name}</p>
                            <p className="text-xs text-muted-foreground">{th.dosage}</p>
                          </div>
                          <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setDonThuoc((p) => p.filter((x) => x.id !== th.id))}>
                            {t("health.btn_remove")}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="secondary" disabled={donThuoc.length === 0}>
                      {t("health.btn_print_rx")}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={xoaDon} disabled={donThuoc.length === 0}>
                      {t("health.btn_clear_rx")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-5 w-5 text-primary" aria-hidden />
                  {t("health.stock_title")}
                </CardTitle>
                <CardDescription>{t("health.stock_desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[min(520px,58vh)]">
                  <div className="min-w-[300px] space-y-0 pr-3">
                    <div className="grid grid-cols-[1fr_5rem_5rem_4rem_auto] gap-2 border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <span>{t("health.stock_name")}</span>
                      <span className="text-right">{t("health.stock_qty")}</span>
                      <span className="text-right">{t("health.stock_min")}</span>
                      <span>{t("health.stock_unit")}</span>
                      <span />
                    </div>
                    {MAU_KHO.map((k) => {
                      const low = k.qty <= k.min;
                      return (
                        <div
                          key={k.id}
                          className={cn(
                            "grid grid-cols-[1fr_5rem_5rem_4rem_auto] items-center gap-2 border-b border-border/60 py-2.5 text-sm",
                            low && "bg-rose-50/50 dark:bg-rose-950/15",
                          )}
                        >
                          <span className="min-w-0 font-medium leading-snug">{k.name}</span>
                          <span className="text-right font-mono tabular-nums">{k.qty}</span>
                          <span className="text-right font-mono tabular-nums text-muted-foreground">{k.min}</span>
                          <span className="text-xs text-muted-foreground">{k.unit}</span>
                          <Badge variant={low ? "destructive" : "secondary"} className="justify-center text-[10px]">
                            {low ? t("health.badge_low") : t("health.badge_ok")}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
