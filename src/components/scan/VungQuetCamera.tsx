import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef } from "react";
import { useI18n } from "@/contexts/NguCanhNgonNgu";

type Props = {
  bat: boolean;
  khiGiaiMa: (text: string) => void;
};

export type VungQuetCameraHandle = {
  /** Dừng và xóa DOM scanner (await trước khi đổi state UI) — tránh lệch React insertBefore với html5-qrcode. */
  tamDung: () => Promise<void>;
};

/**
 * Camera QR / barcode (html5-qrcode) — mỗi instance một id DOM riêng, tránh trùng Radix Tabs / Strict Mode.
 */
export const VungQuetCamera = forwardRef<VungQuetCameraHandle, Props>(function VungQuetCamera(
  { bat, khiGiaiMa },
  ref,
) {
  const { t } = useI18n();
  const reactId = useId().replace(/:/g, "");
  const elementId = `mm-scan-${reactId}`;

  const refCb = useRef(khiGiaiMa);
  refCb.current = khiGiaiMa;
  const refLanCuoi = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  /** Instance đang giữ để cleanup await stop — tránh hai Html5Qrcode cùng một element. */
  const refMay = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const refTacVu = useRef(0);

  const dungHet = useCallback(async () => {
    const may = refMay.current;
    refMay.current = null;
    if (!may) return;
    try {
      await may.stop();
    } catch {
      /* chưa start hoặc đã dừng */
    }
    try {
      may.clear();
    } catch {
      /* ignore */
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      tamDung: async () => {
        refTacVu.current++;
        await dungHet();
      },
    }),
    [dungHet],
  );

  useEffect(() => {
    const tacVu = ++refTacVu.current;

    if (!bat) {
      void dungHet();
      return () => {
        refTacVu.current++;
        void dungHet();
      };
    }

    const onSuccess = (text: string) => {
      if (refTacVu.current !== tacVu) return;
      const now = Date.now();
      const prev = refLanCuoi.current;
      if (text === prev.text && now - prev.at < 1000) return;
      refLanCuoi.current = { text, at: now };
      refCb.current(text);
    };
    const onFail = () => {};

    void (async () => {
      await dungHet();
      if (refTacVu.current !== tacVu || !bat) return;

      let Html5Qrcode: typeof import("html5-qrcode").Html5Qrcode;
      try {
        ({ Html5Qrcode } = await import("html5-qrcode"));
      } catch {
        return;
      }
      if (refTacVu.current !== tacVu || !bat) return;

      const el = document.getElementById(elementId);
      if (!el) return;

      const may = new Html5Qrcode(elementId, { verbose: false });
      refMay.current = may;

      const cauHinh = {
        fps: 8,
        qrbox: (viewW: number, viewH: number) => {
          const w = Number(viewW) > 0 ? Number(viewW) : 300;
          const h = Number(viewH) > 0 ? Number(viewH) : 300;
          const edge = Math.max(200, Math.min(280, Math.floor(Math.min(w, h) * 0.72)));
          return { width: edge, height: edge };
        },
        aspectRatio: 1,
      };

      try {
        await may.start({ facingMode: "environment" }, cauHinh, onSuccess, onFail);
      } catch {
        if (refTacVu.current !== tacVu) return;
        try {
          await may.start({ facingMode: "user" }, cauHinh, onSuccess, onFail);
        } catch {
          if (refTacVu.current !== tacVu) return;
          try {
            const devices = await Html5Qrcode.getCameras();
            if (devices.length === 0) return;
            await may.start({ deviceId: { exact: devices[0].id } }, cauHinh, onSuccess, onFail);
          } catch {
            try {
              await dungHet();
            } catch {
              /* ignore */
            }
          }
        }
      }
    })();

    return () => {
      refTacVu.current++;
      void dungHet();
    };
  }, [bat, dungHet, elementId]);

  return (
    <div className="w-full max-w-md mx-auto space-y-2">
      <div className="relative w-full overflow-hidden rounded-xl border border-border bg-black [&_video]:rounded-xl">
        <div id={elementId} className="w-full min-h-[240px] sm:min-h-[280px]" />
      </div>
      <p className="text-[11px] text-center text-muted-foreground px-2">{t("scan.camera_hint")}</p>
    </div>
  );
});
VungQuetCamera.displayName = "VungQuetCamera";
