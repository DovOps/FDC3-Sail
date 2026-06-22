/**
 * Platform-api should re-export desktop-agent host contracts instead of owning
 * parallel IntentResolver / ChannelSelector type definitions.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vite-plus/test"

const interfacesRoot = fileURLToPath(new URL("../interfaces", import.meta.url))

function readInterface(relativePath: string): string {
  return readFileSync(join(interfacesRoot, relativePath), "utf-8")
}

describe("@finos/sail-platform-api host contract re-exports", () => {
  describe("interfaces/intent-resolver.ts", () => {
    it("re-exports intent resolver types from @finos/sail-desktop-agent", () => {
      const content = readInterface("intent-resolver.ts")

      expect(
        content,
        "intent-resolver.ts should re-export from desktop-agent, not define parallel types"
      ).toMatch(/from\s+["']@finos\/sail-desktop-agent["']/)
      expect(content).not.toMatch(/export\s+interface\s+IntentResolver\b/)
      expect(content).not.toMatch(/export\s+interface\s+IntentResolutionRequest\b/)
      expect(content).not.toMatch(/export\s+interface\s+IntentResolutionResponse\b/)
      expect(content).not.toMatch(/export\s+interface\s+IntentHandler\b/)
    })
  })

  describe("interfaces/channel-selector.ts", () => {
    it("re-exports channel control types from @finos/sail-desktop-agent", () => {
      const content = readInterface("channel-selector.ts")

      expect(
        content,
        "channel-selector.ts should re-export from desktop-agent, not define parallel types"
      ).toMatch(/from\s+["']@finos\/sail-desktop-agent["']/)
      expect(content).not.toMatch(/export\s+interface\s+ChannelSelector\b/)
      expect(content).not.toMatch(/export\s+interface\s+ChannelSelectionRequest\b/)
    })
  })

  describe("interfaces/index.ts", () => {
    it("re-exports all host contracts from @finos/sail-desktop-agent", () => {
      const content = readInterface("index.ts")

      expect(content).toMatch(/AppLauncher/)
      expect(content).toMatch(/IntentResolver/)
      expect(content).toMatch(/ChannelControl|ChannelSelector/)

      const desktopAgentReExports = content.match(
        /export\s+type\s*\{([^}]+)\}\s*from\s+["']@finos\/sail-desktop-agent["']/g
      )

      expect(
        desktopAgentReExports?.join("\n"),
        "interfaces/index.ts should re-export host contracts from desktop-agent, not local duplicates"
      ).toMatch(/IntentResolver/)
      expect(desktopAgentReExports?.join("\n")).toMatch(/ChannelControl|ChannelSelector/)
    })
  })

  describe("desktop-agent owns host contract definitions", () => {
    it("exports IntentResolver and ChannelControl from its top-level entry", () => {
      const desktopAgentEntry = readFileSync(
        fileURLToPath(new URL("../../../sail-desktop-agent/src/index.ts", import.meta.url)),
        "utf-8"
      )
      const hostContractsBarrel = readFileSync(
        fileURLToPath(
          new URL("../../../sail-desktop-agent/src/host-contracts/index.ts", import.meta.url)
        ),
        "utf-8"
      )

      expect(desktopAgentEntry).toMatch(/export\s+\*\s+from\s+["']\.\/host-contracts["']/)
      expect(hostContractsBarrel).toMatch(/\bIntentResolver\b/)
      expect(hostContractsBarrel).toMatch(/\bChannelControl\b/)
    })
  })
})
