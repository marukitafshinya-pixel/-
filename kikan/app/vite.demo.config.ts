import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// 見本版（ブラウザの中で動くもの）の作り方。サーバーの db.js・auth.js・excel.js を見本版のものに差し替える
const demo = (f: string) => fileURLToPath(new URL(`./client/src/demo/${f}`, import.meta.url));

export default defineConfig({
  root: "client",
  base: "./",
  plugins: [react()],
  define: {
    "import.meta.env.VITE_DEMO": JSON.stringify("1"),
    // サーバーの合言葉（見本版ではどれも demo）
    "process.env.JUCHU_DELETE_PASSWORD": JSON.stringify("demo"),
    "process.env.JUCHU_EDIT_PASSWORD": JSON.stringify("demo"),
    "process.env.JUCHU_MASTER_PASSWORD": JSON.stringify("demo"),
    "process.env.MASTER_PASSWORD": JSON.stringify("demo"),
  },
  resolve: {
    alias: [
      { find: /^\.\/db\.js$/, replacement: demo("db.ts") },
      { find: /^\.\/auth\.js$/, replacement: demo("auth.ts") },
      { find: /^\.\.\/\.\.\/\.\.\/server\/auth$/, replacement: demo("auth.ts") },
      { find: /^\.\/excel\.js$/, replacement: demo("excel.ts") },
      { find: /^\.\/himitsu\.js$/, replacement: demo("himitsu.ts") },
    ],
  },
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  build: { outDir: "../dist-demo", emptyOutDir: true, rollupOptions: { input: "client/demo.html" }, target: "es2022" },
});
