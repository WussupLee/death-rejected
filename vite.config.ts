import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/death-rejected/" : "/",
  plugins: [sites()],
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
});
