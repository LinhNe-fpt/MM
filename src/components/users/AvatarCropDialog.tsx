import { useState, useCallback, useEffect } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { cropImageToJpegBase64 } from "@/lib/avatarCrop";
import { Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  /** Object URL hoặc URL ảnh có thể vẽ lên canvas (same-origin / blob). */
  imageUrl: string | null;
  onOpenChange: (open: boolean) => void;
  /** Gọi sau khi người dùng xác nhận crop (JPEG base64). */
  onCropped: (base64: string) => void;
};

export function AvatarCropDialog({ open, imageUrl, onOpenChange, onCropped }: Props) {
  const { t } = useI18n();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState<Area | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (open && imageUrl) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedPixels(null);
    }
  }, [open, imageUrl]);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedPixels(areaPixels);
  }, []);

  async function handleApply() {
    if (!imageUrl || !croppedPixels) return;
    setApplying(true);
    try {
      const b64 = await cropImageToJpegBase64(imageUrl, croppedPixels, 256, 0.88);
      onCropped(b64);
      onOpenChange(false);
    } finally {
      setApplying(false);
    }
  }

  function handleCancel() {
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>{t("users.avatar_crop_title")}</DialogTitle>
          <p className="text-sm text-muted-foreground font-normal pt-1">{t("users.avatar_crop_hint")}</p>
        </DialogHeader>

        {imageUrl ? (
          <div className="px-6 pb-2">
            <div className="relative w-full h-[min(52vw,280px)] sm:h-[300px] rounded-lg bg-muted overflow-hidden">
              <Cropper
                image={imageUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="flex items-center gap-3 mt-4">
              <span className="text-xs text-muted-foreground shrink-0 w-16">{t("users.avatar_crop_zoom")}</span>
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.02}
                onValueChange={(v) => setZoom(v[0] ?? 1)}
                className="flex-1"
              />
            </div>
          </div>
        ) : null}

        <DialogFooter className="px-6 py-4 border-t border-border gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={handleCancel} disabled={applying}>
            {t("users.avatar_crop_cancel")}
          </Button>
          <Button type="button" onClick={handleApply} disabled={!imageUrl || !croppedPixels || applying} className="gap-2">
            {applying ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : null}
            {t("users.avatar_crop_apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
