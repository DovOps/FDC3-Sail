import { defineConfig } from "vite-plus"
import path from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    // Allow imports without file extensions
    extensions: [".ts", ".js", ".json"],
  },
  // Ensure proper module resolution for Node.js packages
  build: {
    target: "node22",
    lib: {
      entry: "src/main.ts",
      formats: ["es"],
      fileName: "main",
    },
    rollupOptions: {
      external: ["dotenv", "http", /^node:.*/],
    },
  },
})
