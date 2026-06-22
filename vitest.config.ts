import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // Next.js 소스는 React 자동 JSX 런타임 전제(React 미import) → esbuild도 automatic 사용
  esbuild: {
    jsx: "automatic",
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
