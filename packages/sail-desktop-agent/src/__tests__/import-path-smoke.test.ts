/**
 * Smoke test: reorganized runtime folders resolve via package entrypoints.
 */
import { describe, expect, it } from "vite-plus/test"

describe("reorganized import paths", () => {
  it("resolves DACP protocol modules from core/dacp", async () => {
    const dacp = await import("../core/dacp/index.js")
    expect(dacp.DACP_TIMEOUTS).toBeDefined()
    expect(dacp.createDACPSuccessResponse).toBeTypeOf("function")
    expect(dacp.logDACPMessage).toBeTypeOf("function")
  })

  it("resolves WCP protocol modules from app-connection/wcp", async () => {
    const wcp = await import("../app-connection/wcp/index.js")
    expect(wcp.handleWCP1Hello).toBeTypeOf("function")
    expect(wcp.bridgeTransports).toBeTypeOf("function")
  })

  it("resolves app-connection mechanisms from app-connection", async () => {
    const appConnection = await import("../app-connection/index.js")
    expect(appConnection.WCPConnector).toBeTypeOf("function")
    expect(appConnection.MessagePortTransport).toBeTypeOf("function")
  })

  it("re-exports DACP protocol from core entry", async () => {
    const core = await import("../core/index.js")
    expect(core.DACP_TIMEOUTS).toBeDefined()
    expect(core.createDACPSuccessResponse).toBeTypeOf("function")
  })

  it("resolves preset factories from presets", async () => {
    const presets = await import("../presets/index.js")
    expect(presets.createBrowserDesktopAgent).toBeTypeOf("function")
    expect(presets.getBrowserDesktopAgentSession).toBeTypeOf("function")
  })
})
