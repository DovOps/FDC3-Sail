/**
 * Host contracts export contract: UI-free launch, intent resolver, and channel
 * control types live under src/host-contracts/ and are re-exported from the
 * top-level @finos/sail-desktop-agent package entry.
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vite-plus/test"

const packageRoot = fileURLToPath(new URL("../..", import.meta.url))
const srcRoot = join(packageRoot, "src")
const hostContractsRoot = join(srcRoot, "host-contracts")

const HOST_CONTRACT_MODULES = [
  "app-launcher.ts",
  "intent-resolver.ts",
  "channel-control.ts",
  "index.ts",
] as const

const HOST_CONTRACT_TYPE_EXPORTS = [
  "AppLauncher",
  "IntentResolver",
  "ChannelControl",
  "IntentResolutionRequest",
  "IntentResolutionResponse",
  "IntentHandler",
  "ChannelSelectionRequest",
] as const

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), "utf-8")
}

describe("@finos/sail-desktop-agent host-contracts package boundary", () => {
  describe("host-contracts/ module layout", () => {
    it.each(HOST_CONTRACT_MODULES)(
      "src/host-contracts/%s exists as the canonical host contract module",
      moduleFile => {
        expect(
          existsSync(join(hostContractsRoot, moduleFile)),
          `packages/sail-desktop-agent/src/host-contracts/${moduleFile} should exist`
        ).toBe(true)
      }
    )

    it("host-contracts/index.ts re-exports all three host contract modules", () => {
      const barrel = readSrc("host-contracts/index.ts")

      expect(barrel, "host-contracts barrel should export app launch contract").toMatch(
        /app-launcher/i
      )
      expect(barrel, "host-contracts barrel should export intent resolver contract").toMatch(
        /intent-resolver/i
      )
      expect(barrel, "host-contracts barrel should export channel control contract").toMatch(
        /channel-control/i
      )
    })
  })

  describe("top-level package exports host contracts", () => {
    it("src/index.ts re-exports the host-contracts barrel for platform builders", () => {
      const entry = readSrc("index.ts")

      expect(entry, "top-level entry should export host-contracts alongside core").toMatch(
        /export\s+\*\s+from\s+["']\.\/host-contracts["']/
      )
    })

    it.each(HOST_CONTRACT_TYPE_EXPORTS)(
      "host-contracts/index.ts exports %s for top-level re-export",
      exportName => {
        const barrel = readSrc("host-contracts/index.ts")

        expect(barrel, `host-contracts barrel should export ${exportName}`).toMatch(
          new RegExp(`\\b${exportName}\\b`)
        )
      }
    )
  })
})
