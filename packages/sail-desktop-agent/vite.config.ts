import { defineConfig } from "vite-plus"

export default defineConfig({
  pack: {
    entry: [
      "./src/index.ts",
      "./src/app-connection/index.ts",
      "./src/transports/index.ts",
      "./src/presets/index.ts",
    ],
    sourcemap: true,
  },
})
