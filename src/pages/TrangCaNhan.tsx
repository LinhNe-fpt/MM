import { useRef, useState, useCallback } from "react";
import { User, LogOut, Sun, Moon, Globe, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/NguCanhXacThuc";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { Y_TE_LOGO_URL } from "@/lib/app-icon";
import { nhanQuyenTuMa } from "@/lib/quyenLabels";
import { useTheme } from "@/contexts/NguCanhGiaoDien";
import { apiPut } from "@/api/client";
import type { NgonNgu } from "@/i18n/phienDich";
import { AvatarCropDialog } from "@/components/users/AvatarCropDialog";

export default function TrangCaNhan() {
  const { user, signOut, capNhatAnhDaiDien } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarErr, setAvatarErr] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropUrl, setCropUrl] = useState<string | null>(null);

  const revokeCropUrl = useCallback(() => {
    setCropUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const meta = user?.user_metadata as { fromDb?: boolean; hoTen?: string; quyen?: string; anhDaiDien?: string | null } | undefined;
  const userId = user?.id;
  const displayName = meta?.hoTen || user?.email || "—";
  const quyen = meta?.quyen ?? "staff";
  const laYTe = String(quyen).toLowerCase() === "y_te";
  const avatarSrc = meta?.anhDaiDien ?? null;

  function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setAvatarErr(null);
    revokeCropUrl();
    setCropUrl(URL.createObjectURL(file));
    setCropOpen(true);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleAvatarCropped(b64: string) {
    if (!userId) return;
    setUploading(true);
    setAvatarErr(null);
    try {
      await apiPut(`/api/users/${userId}/avatar`, { anhDaiDien: b64 });
      capNhatAnhDaiDien(b64);
    } catch (err) {
      setAvatarErr(err instanceof Error ? err.message : "Lỗi cập nhật ảnh");
    } finally {
      setUploading(false);
      revokeCropUrl();
      setCropOpen(false);
    }
  }

  async function handleRemoveAvatar() {
    if (!userId) return;
    setUploading(true);
    try {
      await apiPut(`/api/users/${userId}/avatar`, { anhDaiDien: null });
      capNhatAnhDaiDien(null);
    } catch { /* ignore */ } finally {
      setUploading(false);
    }
  }

  const roleLabel = nhanQuyenTuMa(quyen, t);

  return (
    <div className="relative mx-auto max-w-md min-h-[min(480px,60vh)]">
      <AvatarCropDialog
        open={cropOpen}
        imageUrl={cropUrl}
        onOpenChange={(o) => {
          if (!o) revokeCropUrl();
          setCropOpen(o);
        }}
        onCropped={handleAvatarCropped}
      />
      {laYTe ? (
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
      ) : null}

      <div className="relative z-10 space-y-6 p-4 md:p-6">
      {/* Avatar section */}
      <div className="flex flex-col items-center pt-8 gap-2">
        <div className="relative group">
          {avatarSrc
            ? <img src={avatarSrc} alt={displayName} className="w-24 h-24 rounded-full object-cover border-2 border-primary/30 shadow" />
            : <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center border-2 border-border shadow">
                <User className="w-12 h-12 text-muted-foreground" />
              </div>
          }
          {/* Overlay khi hover */}
          <button
            type="button"
            className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title={t("profile.change_avatar") || "Thay ảnh đại diện"}
          >
            <Camera className="w-6 h-6 text-white" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
          {uploading && (
            <div className="absolute inset-0 rounded-full bg-background/60 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        <div className="text-center">
          <h1 className="text-lg font-bold leading-tight">{displayName}</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">{roleLabel}</span>
        </div>

        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="text-primary hover:underline disabled:opacity-50"
          >
            {t("profile.change_avatar") || "Thay ảnh"}
          </button>
          {avatarSrc && (
            <>
              <span className="text-muted-foreground">·</span>
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={uploading}
                className="text-destructive hover:underline disabled:opacity-50"
              >
                {t("users.avatar_remove") || "Xoá ảnh"}
              </button>
            </>
          )}
        </div>
        {avatarErr && <p className="text-xs text-destructive">{avatarErr}</p>}
      </div>

      {/* Settings */}
      <div className="space-y-2">
        <div className="border border-border rounded-lg p-3">
          <div className="flex items-center gap-3 mb-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t("profile.language")}</span>
          </div>
          <div className="flex gap-2">
            {(["vi", "ko"] as NgonNgu[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`flex-1 py-2 text-xs font-semibold rounded border btn-mechanical transition-colors ${
                  language === lang ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-muted-foreground"
                }`}
              >
                {lang === "vi" ? t("profile.lang_vi_full") : t("profile.lang_ko_full")}
              </button>
            ))}
          </div>
        </div>
        <div className="border border-border rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === "dark" ? <Moon className="w-4 h-4 text-muted-foreground" /> : <Sun className="w-4 h-4 text-muted-foreground" />}
              <span className="text-sm font-medium">{t("profile.theme")}</span>
            </div>
            <button
              onClick={toggleTheme}
              className="px-3 py-1.5 text-xs font-semibold rounded border border-border text-muted-foreground hover:border-primary hover:text-primary btn-mechanical transition-colors"
            >
              {theme === "dark" ? t("profile.light") : t("profile.dark")}
            </button>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full justify-start gap-3 btn-mechanical text-status-critical"
          onClick={signOut}
        >
          <LogOut className="w-4 h-4" /> {t("profile.logout")}
        </Button>
      </div>
      </div>
    </div>
  );
}
