import { useState } from "react";
import { useAuth } from "@/contexts/NguCanhXacThuc";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { Loader2, ArrowLeft } from "lucide-react";
import { APP_LOGO_URL } from "@/lib/app-icon";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function TrangQuenMatKhau() {
  const { resetPassword } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [daGui, setDaGui] = useState(false);
  const [loi, setLoi] = useState("");
  const [dangTai, setDangTai] = useState(false);

  const xuLyGui = async (e: React.FormEvent) => {
    e.preventDefault();
    setDangTai(true);
    setLoi("");
    const { error } = await resetPassword(email);
    if (error) setLoi(error.message);
    else setDaGui(true);
    setDangTai(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <img src={APP_LOGO_URL} alt="" className="h-24 w-24 sm:h-[7.2rem] sm:w-[7.2rem] object-contain drop-shadow-md" />
          <h1 className="text-lg font-bold tracking-tight">{t("auth.reset_password")}</h1>
          <p className="text-xs text-muted-foreground text-center">{t("auth.reset_desc")}</p>
        </div>
        {daGui ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-status-ok">{t("auth.reset_sent")}</p>
            <Link to="/auth" className="text-xs text-primary hover:underline">{t("auth.back_login")}</Link>
          </div>
        ) : (
          <form onSubmit={xuLyGui} className="space-y-3">
            <div>
              <label className="label-industrial mb-1 block">{t("auth.email")}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {loi && <p className="text-xs text-status-critical">{loi}</p>}
            <Button type="submit" disabled={dangTai} className="w-full btn-mechanical bg-primary text-primary-foreground hover:bg-primary/90">
              {dangTai && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("auth.reset_password")}
            </Button>
            <Link to="/auth" className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary">
              <ArrowLeft className="w-3 h-3" /> {t("auth.back_login")}
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
