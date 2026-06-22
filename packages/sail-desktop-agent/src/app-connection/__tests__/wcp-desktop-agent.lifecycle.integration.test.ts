/**
 * WCP Option A instance lifecycle integration tests.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach, vi } from "vite-plus/test"
import type { DesktopAgent } from "../../core/desktop-agent"
import { AppInstanceState } from "../../core/state/types"
import {
  clearAllHeartbeatTimersForTesting,
  getActiveHeartbeatTimerCount,
} from "../../core/handlers/dacp/heartbeat-runtime"
import {
  connectWcpApp,
  createOpenRequestMessage,
  flushAsyncDelivery,
  postDacpOnPort,
} from "./wcp-edge-test-helpers"
import {
  CHART_APP,
  createHostInstanceAppLauncher,
  createTestAgent,
  HOST_LAUNCHER_INSTANCE_ID,
  PORTFOLIO_APP,
} from "./wcp-desktop-agent.integration.fixtures"

describe("Option A instance lifecycle (WCP path)", () => {
  const activeAgents: DesktopAgent[] = []

  afterEach(() => {
    clearAllHeartbeatTimersForTesting()
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }
  })

  it("marks instance connected after WCP5 success without manual state updates", async () => {
    const agent = createTestAgent()
    activeAgents.push(agent)

    const connected = await connectWcpApp(agent, {
      connectionAttemptUuid: "lifecycle-wcp5-connected-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    expect(agent.getState().instances[connected.canonicalInstanceId]?.appId).toBe("portfolioApp")
    expect(agent.getState().instances[connected.canonicalInstanceId]?.state).toBe(
      AppInstanceState.CONNECTED
    )
  })

  it("keeps host pre-registered instance pending until WCP5 succeeds", async () => {
    const agent = createTestAgent({ appLauncher: createHostInstanceAppLauncher() })
    activeAgents.push(agent)

    const source = await connectWcpApp(agent, {
      connectionAttemptUuid: "lifecycle-pending-source-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    await postDacpOnPort(
      source.appPort,
      createOpenRequestMessage(source.canonicalInstanceId, source.appId, CHART_APP.appId)
    )
    await flushAsyncDelivery()

    await vi.waitFor(() => {
      const preWcp5 = agent.getState().instances[HOST_LAUNCHER_INSTANCE_ID]
      expect(preWcp5?.appId).toBe(CHART_APP.appId)
      expect(preWcp5?.state).toBe(AppInstanceState.PENDING)
    })

    const chart = await connectWcpApp(agent, {
      connectionAttemptUuid: "lifecycle-pending-target-uuid",
      appId: "chartApp",
      identityUrl: CHART_APP.details.url,
      hostInstanceId: HOST_LAUNCHER_INSTANCE_ID,
      instanceUuid: crypto.randomUUID(),
    })

    expect(chart.canonicalInstanceId).toBe(HOST_LAUNCHER_INSTANCE_ID)
    expect(agent.getState().instances[HOST_LAUNCHER_INSTANCE_ID]?.state).toBe(
      AppInstanceState.CONNECTED
    )
  })

  it("removes instance from agent state when app sends WCP6Goodbye", async () => {
    const agent = createTestAgent({ disconnectGracePeriod: 0 })
    activeAgents.push(agent)

    const connected = await connectWcpApp(agent, {
      connectionAttemptUuid: "lifecycle-wcp6-goodbye-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    expect(agent.getState().instances[connected.canonicalInstanceId]?.state).toBe(
      AppInstanceState.CONNECTED
    )

    connected.appPort.postMessage({
      type: "WCP6Goodbye",
      meta: { timestamp: new Date().toISOString() },
    })
    await flushAsyncDelivery()

    await vi.waitFor(() => {
      expect(agent.getState().instances[connected.canonicalInstanceId]).toBeUndefined()
    })
  })

  it("skips heartbeat machinery when heartbeat is disabled and keeps instance until disconnect", async () => {
    const agent = createTestAgent({
      heartbeatEnabled: false,
      disconnectGracePeriod: 0,
    })
    activeAgents.push(agent)

    const connected = await connectWcpApp(agent, {
      connectionAttemptUuid: "lifecycle-heartbeat-off-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    expect(agent.getState().instances[connected.canonicalInstanceId]?.state).toBe(
      AppInstanceState.CONNECTED
    )
    expect(getActiveHeartbeatTimerCount()).toBe(0)
    expect(agent.getState().heartbeats[connected.canonicalInstanceId]).toBeUndefined()

    await new Promise(resolve => setTimeout(resolve, 300))

    expect(agent.getState().instances[connected.canonicalInstanceId]).toBeDefined()
    expect(getActiveHeartbeatTimerCount()).toBe(0)
  })

  it("removes canonical instance when disconnectInstance is called with WCP4 temp id and heartbeat is disabled", async () => {
    const agent = createTestAgent({
      heartbeatEnabled: false,
      disconnectGracePeriod: 0,
    })
    activeAgents.push(agent)

    const connected = await connectWcpApp(agent, {
      connectionAttemptUuid: "lifecycle-temp-disconnect-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    expect(agent.getState().instances[connected.canonicalInstanceId]?.state).toBe(
      AppInstanceState.CONNECTED
    )

    agent.disconnectInstance(connected.tempInstanceId)

    expect(agent.getState().instances[connected.canonicalInstanceId]).toBeUndefined()
  })

  it("removes instance on heartbeat timeout when heartbeat is enabled", async () => {
    const agent = createTestAgent({
      heartbeatEnabled: true,
      heartbeatIntervalMs: 50,
      heartbeatTimeoutMs: 150,
      disconnectGracePeriod: 0,
    })
    activeAgents.push(agent)

    const connected = await connectWcpApp(agent, {
      connectionAttemptUuid: "lifecycle-heartbeat-timeout-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    expect(agent.getState().instances[connected.canonicalInstanceId]?.state).toBe(
      AppInstanceState.CONNECTED
    )
    expect(getActiveHeartbeatTimerCount()).toBeGreaterThan(0)

    await vi.waitFor(
      () => {
        expect(agent.getState().instances[connected.canonicalInstanceId]).toBeUndefined()
      },
      { timeout: 2000 }
    )
    expect(getActiveHeartbeatTimerCount()).toBe(0)
  })
})
