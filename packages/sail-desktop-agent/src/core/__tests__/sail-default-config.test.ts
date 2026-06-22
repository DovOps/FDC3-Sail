import { readFileSync } from "node:fs"
import { describe, expect, it } from "vite-plus/test"
import { MockTransport } from "../../__tests__/utils/mock-transport"
import { DesktopAgent } from "../desktop-agent"
import {
  DEFAULT_SAIL_IMPLEMENTATION_METADATA,
  resolveDesktopAgentConfig,
} from "../sail-default-config"

const { version: packageVersion } = JSON.parse(
  readFileSync(new URL("../../../package.json", import.meta.url), "utf-8")
) as { version: string }

describe("DEFAULT_SAIL_IMPLEMENTATION_METADATA", () => {
  it("uses the published package version as providerVersion", () => {
    expect(DEFAULT_SAIL_IMPLEMENTATION_METADATA.providerVersion).toBe(packageVersion)
  })
})

describe("resolveDesktopAgentConfig", () => {
  it("applies FDC3-Sail product defaults when overrides omit implementationMetadata", () => {
    const config = resolveDesktopAgentConfig({ transport: new MockTransport() })

    expect(config.implementationMetadata).toEqual(DEFAULT_SAIL_IMPLEMENTATION_METADATA)
    expect(config.implementationMetadata.provider).toBe("FDC3-Sail")
    expect(config.heartbeatIntervalMs).toBe(30_000)
    expect(config.heartbeatTimeoutMs).toBe(60_000)
    expect(config.heartbeatEnabled).toBe(true)
  })

  it("does not let explicit undefined heartbeat options clobber product defaults", () => {
    const config = resolveDesktopAgentConfig({
      transport: new MockTransport(),
      heartbeatEnabled: undefined,
      heartbeatIntervalMs: undefined,
      heartbeatTimeoutMs: undefined,
    })

    expect(config.heartbeatEnabled).toBe(true)
    expect(config.heartbeatIntervalMs).toBe(30_000)
    expect(config.heartbeatTimeoutMs).toBe(60_000)
  })

  it("allows disabling heartbeat at the Desktop Agent level", () => {
    const config = resolveDesktopAgentConfig({
      transport: new MockTransport(),
      heartbeatEnabled: false,
    })

    expect(config.heartbeatEnabled).toBe(false)
  })

  it("does not let explicit undefined heartbeat timing clobber defaults", () => {
    const config = resolveDesktopAgentConfig({
      transport: new MockTransport(),
      heartbeatIntervalMs: undefined,
      heartbeatTimeoutMs: undefined,
    })

    expect(config.heartbeatIntervalMs).toBe(30_000)
    expect(config.heartbeatTimeoutMs).toBe(60_000)
  })

  it("deep-merges partial implementationMetadata overrides", () => {
    const config = resolveDesktopAgentConfig({
      transport: new MockTransport(),
      implementationMetadata: {
        provider: "cucumber-provider",
        providerVersion: "1.0.0",
      },
    })

    expect(config.implementationMetadata.provider).toBe("cucumber-provider")
    expect(config.implementationMetadata.providerVersion).toBe("1.0.0")
    expect(config.implementationMetadata.fdc3Version).toBe("2.2")
    expect(config.implementationMetadata.optionalFeatures).toEqual(
      DEFAULT_SAIL_IMPLEMENTATION_METADATA.optionalFeatures
    )
  })
})

describe("DesktopAgent constructor defaults", () => {
  it("applies Sail defaults when only transport is provided", () => {
    const agent = new DesktopAgent({ transport: new MockTransport() })
    expect(agent.getImplementationMetadata()).toEqual(DEFAULT_SAIL_IMPLEMENTATION_METADATA)
  })

  it("deep-merges partial implementationMetadata from constructor options", () => {
    const agent = new DesktopAgent({
      transport: new MockTransport(),
      implementationMetadata: { provider: "Acme" },
    })
    const metadata = agent.getImplementationMetadata()
    expect(metadata.provider).toBe("Acme")
    expect(metadata.providerVersion).toBe(DEFAULT_SAIL_IMPLEMENTATION_METADATA.providerVersion)
    expect(metadata.optionalFeatures).toEqual(DEFAULT_SAIL_IMPLEMENTATION_METADATA.optionalFeatures)
  })
})
