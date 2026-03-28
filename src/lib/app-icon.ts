/** Base path static trong `public/`, có tiền tố VITE_BASE (vd. /mm/). */
function urlPublic(file: string): string {
  const base =
    typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL.replace(/\/$/, "")
      : "";
  return `${base}/${file}`;
}

/** Logo IMS toàn hệ (sidebar chính, watermark). */
export const APP_LOGO_URL = urlPublic("yousung-vina-logo.png");

/** Logo module Phòng Y tế (/yte) — Hội Chữ thập đỏ / Yousung Vina. */
export const Y_TE_LOGO_URL = urlPublic("logo-y-te.png");

/** Logo module Quản lý MRO (/mro) — YS MRO. */
export const MRO_LOGO_URL = urlPublic("logo-mro.png");
