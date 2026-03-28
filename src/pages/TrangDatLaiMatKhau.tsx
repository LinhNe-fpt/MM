import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/NguCanhXacThuc";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { APP_LOGO_URL } from "@/lib/app-icon";
import { Button } from "@/components/ui/button";

export default function TrangDatLaiMatKhau() {
  const { updatePassword } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [matKhau, setMatKhau] = useState("");
  const [loi, setLoi] = useState("");
  const [dangTai, setDangTai] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("type=recovery")) navigate("/auth");
  }, [navigate]);

  const xuLyGui = async (e: React.FormEvent) => {
    e.preventDefault();
    setDangTai(true);
    setLoi("");
    const { error } = await updatePassword(matKhau);
    if (error) setLoi(error.message);
    else navigate("/");
    setDangTai(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <img src={APP_LOGO_URL} alt="" className="h-24 w-24 sm:h-[7.2rem] sm:w-[7.2rem] object-contain drop-shadow-md" />
          <h1 className="text-lg font-bold tracking-tight">{t("auth.update_password")}</h1>
        </div>
        <form onSubmit={xuLyGui} className="space-y-3">
          <div>
            <label className="label-industrial mb-1 block">{t("auth.new_password")}</label>
            <input
              type="password"
              required
              minLength={6}
              value={matKhau}
              onChange={(e) => setMatKhau(e.target.value)}
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          {loi && <p className="text-xs text-status-critical">{loi}</p>}
          <Button type="submit" disabled={dangTai} className="w-full btn-mechanical bg-primary text-primary-foreground hover:bg-primary/90">
            {dangTai && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t("auth.update_password")}
          </Button>
        </form>
      </div>
    </div>
  );
}
