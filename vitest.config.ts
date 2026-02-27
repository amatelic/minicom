import path from "path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./packages/chat-core/src/test/setup.ts"],
    include: [
      "packages/**/*.test.ts",
      "packages/**/*.test.tsx",
      "apps/**/*.test.ts",
      "apps/**/*.test.tsx",
    ],
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
  resolve: {
    alias: {
      "@/lib/runtime": path.resolve(__dirname, "./apps/agent/src/lib/runtime.ts"),
      "@/hooks/useListKeyboardNavigation": path.resolve(
        __dirname,
        "./apps/agent/src/hooks/useListKeyboardNavigation.ts",
      ),
    },
  },
});
