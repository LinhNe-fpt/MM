import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
// Base path: COPY_TO_XAMPP=1 hoac VITE_BASE=/mm/ khi build de copy len XAMPP (htdocs/mm)
const base = process.env.COPY_TO_XAMPP ? "/mm/" : (process.env.VITE_BASE || "/");

/** Full-reload khi các UI primitive thay đổi để tránh HMR portal conflict với Radix Dialog. */
function fullReloadOnUiPrimitivesPlugin() {
  return {
    name: "full-reload-ui-primitives",
    handleHotUpdate({ file, server }: { file: string; server: { ws: { send: (msg: object) => void } } }) {
      if (/components[\\/]ui[\\/]/.test(file) || file.endsWith("index.css")) {
        server.ws.send({ type: "full-reload" });
        return [];
      }
    },
  };
}

/** SPA fallback: rewrite route trang sang index.html truoc khi Vite resolve module (tranh /components tra ve file config). */
function spaFallbackPlugin() {
  return {
    name: "spa-fallback",
    enforce: "pre" as const,
    configureServer(server: { middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void; stack?: unknown[] } }) {
      const handler = (req: any, res: any, next: () => void) => {
        const url = req.url?.split("?")[0] ?? "";
        const pathname = (url.replace(base, "") || "/").replace(/^\/+/, "/") || "/";
        const isStaticOrModule =
          pathname.includes(".") ||
          pathname.startsWith("/@") ||
          pathname.startsWith("/node_modules") ||
          pathname.startsWith("/src") ||
          pathname.startsWith("/assets");
        const isAppRoute =
          pathname === "/" ||
          /^\/(auth|warehouse|components|transactions|profile|scan|forgot-password|reset-password|bom|admin|rma-upk|upk|rma|mro)(\/.*)?$/.test(pathname);
        if (isAppRoute && !isStaticOrModule) {
          const q = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
          req.url = (base === "/" ? "/" : base) + "index.html" + q;
        }
        next();
      };
      const m = server.middlewares as { use: (fn: (req: any, res: any, next: () => void) => void) => void; stack?: Array<{ route: string; handle: (req: any, res: any, next: () => void) => void }> };
      if (Array.isArray(m.stack)) {
        m.stack.unshift({ route: "", handle: handler });
      } else {
        m.use(handler);
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  base,
  appType: "spa",
  server: {
    host: "0.0.0.0",
    port: 5713,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        configure(proxy) {
          proxy.on("error", (_err, _req, res) => {
            // Backend dang restart (node --watch) - tra ve 503 thay vi crash proxy
            const httpRes = res as import("http").ServerResponse;
            if (typeof httpRes.writeHead === "function" && !httpRes.headersSent) {
              httpRes.writeHead(503, { "Content-Type": "application/json" });
              httpRes.end(JSON.stringify({ error: "Backend dang khoi dong lai, thu lai sau giay lat." }));
            }
          });
        },
      },
    },
    hmr: {
      overlay: false,
    },
  },
  plugins: [spaFallbackPlugin(), fullReloadOnUiPrimitivesPlugin(), react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
