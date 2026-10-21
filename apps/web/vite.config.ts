import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import http from "http";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:8000";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      open: false,
      // Proxy hacia el backend: la petición es del mismo origen, así que las
      // cookies de sesión HttpOnly viajan sin problemas de CORS.
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          // Una conexión nueva por petición. Reutilizarlas (keep-alive) deja en
          // Windows algunas peticiones colgadas o cortadas (ECONNRESET): medido,
          // 3 de 16 colgadas con keep-alive frente a 0 de 120 sin él.
          agent: new http.Agent({ keepAlive: false }),
        },
      },
    },
  };
});
