import { defineConfig } from "vite-plus"

export default defineConfig({
  pack: {
    entry: {
      main: "./src/main.ts",
      "preload/preload": "./src/preload/preload.ts",
    },
    format: "cjs",
    sourcemap: true,
    dts: false,
    deps: {
      neverBundle: ["electron"],
      alwaysBundle: ["@finos/fdc3"],
      onlyBundle: [
        "@finos/fdc3",
        "@finos/fdc3-context",
        "@finos/fdc3-schema",
        "@finos/fdc3-standard",
        "@finos/fdc3-agent-proxy",
        "@finos/fdc3-get-agent",
        "uuid",
      ],
    },
  },
})
