import { useState } from "react";
import { useAuth } from "@/contexts/NguCanhXacThuc";
import { useI18n } from "@/contexts/NguCanhNgonNgu";
import { Loader2, Users } from "lucide-react";
import { APP_LOGO_URL } from "@/lib/app-icon";
import { nhanQuyenTuMa } from "@/lib/quyenLabels";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function TrangDangNhap() {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const [tenDangNhap, setTenDangNhap] = useState("");
  const [matKhau, setMatKhau] = useState("");
  const [loi, setLoi] = useState("");
  const [conflict, setConflict] = useState<{ quyen: string; blockedBy: string } | null>(null);
  const [dangTai, setDangTai] = useState(false);

  const roleLabel = (q: string) => nhanQuyenTuMa(q, t);

  const xuLyGui = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoi("");
    setConflict(null);
    setDangTai(true);
    const ketQua = await signIn(tenDangNhap, matKhau);
    if (ketQua.error) {
      if (ketQua.error.message === "session_conflict" && ketQua.conflict) {
        setConflict(ketQua.conflict);
      } else {
        setLoi(ketQua.error.message);
      }
    }
    setDangTai(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 overflow-hidden"
      style={{ background: "#EEF2FB" }}
    >
      {/* ── Flowing silk blobs ── */}
      <div aria-hidden className="pointer-events-none select-none fixed inset-0 overflow-hidden">
        {/* top-left ribbon */}
        <div style={{
          position: "absolute", top: "-25%", left: "-18%",
          width: "75vw", height: "75vw", maxWidth: 860, maxHeight: 860,
          borderRadius: "50%",
          background: "radial-gradient(ellipse at 40% 40%, rgba(168,196,255,0.70) 0%, rgba(120,160,255,0.30) 40%, transparent 70%)",
          filter: "blur(72px)",
          transform: "rotate(-25deg)",
        }} />
        {/* right ribbon */}
        <div style={{
          position: "absolute", top: "5%", right: "-20%",
          width: "65vw", height: "80vw", maxWidth: 750, maxHeight: 900,
          borderRadius: "50%",
          background: "radial-gradient(ellipse at 60% 35%, rgba(186,214,255,0.65) 0%, rgba(140,180,255,0.25) 45%, transparent 68%)",
          filter: "blur(80px)",
          transform: "rotate(20deg)",
        }} />
        {/* bottom center ribbon */}
        <div style={{
          position: "absolute", bottom: "-30%", left: "15%",
          width: "70vw", height: "60vw", maxWidth: 800, maxHeight: 700,
          borderRadius: "50%",
          background: "radial-gradient(ellipse at 50% 50%, rgba(200,220,255,0.55) 0%, rgba(160,195,255,0.20) 50%, transparent 70%)",
          filter: "blur(90px)",
          transform: "rotate(10deg)",
        }} />
        {/* center soft accent */}
        <div style={{
          position: "absolute", top: "30%", left: "30%",
          width: "45vw", height: "45vw", maxWidth: 520, maxHeight: 520,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(210,225,255,0.40) 0%, transparent 65%)",
          filter: "blur(60px)",
        }} />
      </div>

      {/* ── Glass card ── */}
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[400px] rounded-3xl px-8 py-10 flex flex-col gap-6 overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.62)",
          backdropFilter: "blur(48px) saturate(160%)",
          WebkitBackdropFilter: "blur(48px) saturate(160%)",
          border: "1px solid rgba(255,255,255,0.80)",
          boxShadow: [
            "0 32px 80px rgba(80,120,220,0.10)",
            "0 8px 24px rgba(80,100,200,0.07)",
            "inset 0 1.5px 0 rgba(255,255,255,0.90)",
            "inset 0 -1px 0 rgba(180,200,255,0.15)",
          ].join(", "),
        }}
      >
        {/* Specular top edge */}
        <div aria-hidden style={{
          position: "absolute", top: 0, left: "14%", right: "14%", height: 1,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,1) 30%, rgba(255,255,255,1) 70%, transparent)",
        }} />

        {/* ── Logo + title ── */}
        <div className="flex flex-col items-center gap-4 pt-1">
          <div className="flex items-center justify-center rounded-2xl bg-white/40 p-3 ring-1 ring-white/60 shadow-sm">
            <img
              src={APP_LOGO_URL}
              alt=""
              className="h-[8.7rem] w-[8.7rem] sm:h-[9.6rem] sm:w-[9.6rem] object-contain"
              style={{ filter: "drop-shadow(0 4px 14px rgba(18,10,143,0.14))" }}
            />
          </div>
          <div className="text-center -mt-0.5">
            <h1
              className="text-lg sm:text-xl font-bold tracking-widest uppercase"
              style={{ color: "#1a1a2e", letterSpacing: "0.18em" }}
            >
              {t("auth.app_title")}
            </h1>
            <p className="text-[11px] mt-0.5" style={{ color: "#8890a8", letterSpacing: "0.06em" }}>
              {t("auth.app_subtitle")}
            </p>
          </div>
        </div>

        {/* ── Form ── */}
        <form onSubmit={xuLyGui} className="flex flex-col gap-3.5">
          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <label
              className="text-[10px] font-semibold uppercase"
              style={{ color: "#7880a0", letterSpacing: "0.12em" }}
            >
              {t("auth.username")}
            </label>
            <input
              type="text"
              required
              value={tenDangNhap}
              onChange={(e) => setTenDangNhap(e.target.value)}
              placeholder={t("auth.username")}
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
              style={{
                background: "rgba(240,244,255,0.70)",
                border: "1px solid rgba(180,200,255,0.40)",
                color: "#1a1a2e",
              }}
              onFocus={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.90)";
                e.currentTarget.style.border = "1px solid rgba(80,100,220,0.50)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(100,130,255,0.10)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.background = "rgba(240,244,255,0.70)";
                e.currentTarget.style.border = "1px solid rgba(180,200,255,0.40)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label
              className="text-[10px] font-semibold uppercase"
              style={{ color: "#7880a0", letterSpacing: "0.12em" }}
            >
              {t("auth.password")}
            </label>
            <input
              type="password"
              required
              value={matKhau}
              onChange={(e) => setMatKhau(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
              style={{
                background: "rgba(240,244,255,0.70)",
                border: "1px solid rgba(180,200,255,0.40)",
                color: "#1a1a2e",
              }}
              onFocus={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.90)";
                e.currentTarget.style.border = "1px solid rgba(80,100,220,0.50)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(100,130,255,0.10)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.background = "rgba(240,244,255,0.70)";
                e.currentTarget.style.border = "1px solid rgba(180,200,255,0.40)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {/* Lỗi thông thường */}
          <p
            className="text-[11px] text-center transition-all duration-200"
            style={{
              color: "#dc2626",
              minHeight: 16,
              opacity: loi ? 1 : 0,
              transform: loi ? "translateY(0)" : "translateY(-4px)",
            }}
          >
            {loi || " "}
          </p>

          {/* Lỗi xung đột phiên */}
          <AnimatePresence>
            {conflict && (
              <motion.div
                className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-xs"
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  color: "#b91c1c",
                }}
                initial={{ opacity: 0, scale: 0.97, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.18 }}
              >
                <Users className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#dc2626" }} />
                <span>
                  <strong>{roleLabel(conflict.quyen)}</strong>
                  {" "}{t("login.session_conflict_prefix") || "đang được sử dụng bởi"}{" "}
                  <strong>{conflict.blockedBy}</strong>.{" "}
                  {t("login.session_conflict_suffix") || "Vui lòng đợi người đó đăng xuất trước."}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={dangTai}
            className="relative w-full py-3 rounded-xl text-sm font-bold uppercase overflow-hidden disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #2a1fcf 0%, #120A8F 100%)",
              color: "#ffffff",
              letterSpacing: "0.16em",
              boxShadow: "0 6px 20px rgba(18,10,143,0.35), inset 0 1px 0 rgba(255,255,255,0.20)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
            whileTap={{ scale: 0.97 }}
            whileHover={{ boxShadow: "0 10px 28px rgba(18,10,143,0.45), inset 0 1px 0 rgba(255,255,255,0.25)" }}
            transition={{ duration: 0.15 }}
          >
            {/* button specular */}
            <span aria-hidden style={{
              position: "absolute", top: 0, left: "18%", right: "18%", height: 1,
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.50), transparent)",
            }} />
            <span className="relative inline-flex items-center justify-center gap-2">
              <Loader2
                className="w-4 h-4 shrink-0 transition-all duration-150"
                style={{ opacity: dangTai ? 1 : 0, animation: dangTai ? "spin 1s linear infinite" : "none" }}
                aria-hidden
              />
              {t("auth.login_btn")}
            </span>
          </motion.button>

          {/* Forgot password */}
          <Link
            to="/forgot-password"
            className="block text-center text-[11px] transition-colors duration-150 mt-0.5"
            style={{ color: "#8890a8" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#120A8F"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#8890a8"; }}
          >
            {t("auth.forgot_password")}
          </Link>
        </form>
      </motion.div>
    </div>
  );
}
