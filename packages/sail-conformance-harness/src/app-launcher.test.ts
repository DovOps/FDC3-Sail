import { describe, expect, it } from "vite-plus/test"
import type { DirectoryApp } from "@finos/sail-desktop-agent"

import { resolveHarnessLaunchMode } from "./app-launcher"

describe("resolveHarnessLaunchMode", () => {
  it("returns iframe when sail hostManifest omits forceNewWindow", () => {
    const app: DirectoryApp = {
      appId: "Conformance1",
      title: "Conformance1",
      type: "web",
      details: { url: "https://example.com/conformance1" },
    }

    expect(resolveHarnessLaunchMode(app)).toBe("iframe")
  })

  it("returns popup when hostManifests.sail.forceNewWindow is true", () => {
    const app: DirectoryApp = {
      appId: "ChannelsAppId",
      title: "Channels App",
      type: "web",
      details: { url: "https://example.com/channels" },
      hostManifests: {
        sail: {
          "inject-api": "2.0",
          forceNewWindow: true,
        },
      },
    }

    expect(resolveHarnessLaunchMode(app)).toBe("popup")
  })
})
