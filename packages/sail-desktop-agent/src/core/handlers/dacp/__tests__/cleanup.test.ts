import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import type { BrowserTypes, Context } from "@finos/fdc3"
import { cleanupDACPHandlers } from "../cleanup"
import { startHeartbeat } from "../heartbeat-handlers"
import { handleWCP6Goodbye } from "../wcp-handlers"
import {
  clearAllHeartbeatTimersForTesting,
  getActiveHeartbeatTimerCount,
} from "../heartbeat-runtime"
import {
  linkHandshakeRoutingId,
  clearHandshakeRoutingIdsForInstance,
} from "../../../state/mutators/wcp-handshake-routing"
import {
  resolveLinkedInstanceId,
  resolveInstanceId,
} from "../../../state/selectors/wcp-handshake-routing"
import { registerOpenWithContext } from "../utils/open-with-context"
import {
  clearAllPendingOpenWithContextTimeoutsForTesting,
  getPendingOpenWithContextTimeoutCount,
} from "../utils/open-with-context"
import { connectInstance, addPendingIntent, updateInstanceState } from "../../../state/mutators"
import { AppInstanceState, type AgentState } from "../../../state/types"
import { createInitialState } from "../../../state/initial-state"
import type { PendingIntentPromiseEntry } from "../../types"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../default-user-channels"
import { createDACPTestContext } from "./test-context"
import { withResponseDispatcher } from "./test-context"
import { DesktopAgent } from "../../../desktop-agent"
import { MockTransport } from "../../../../__tests__/utils/mock-transport"
import { MockTransport as CucumberMockTransport } from "../../../../../test/support/mock-transport"

const TEST_WCP_DIRECTORY_APP = {
  appId: "test-app",
  title: "Test App",
  type: "web" as const,
  details: { url: "https://example.com/app" },
}

afterEach(() => {
  clearAllPendingOpenWithContextTimeoutsForTesting()
  clearAllHeartbeatTimersForTesting()
  vi.useRealTimers()
})

describe("wcp handshake routing state contract", () => {
  it("resolveLinkedInstanceId returns linked instanceId for a handshake routing id", () => {
    let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
    state = linkHandshakeRoutingId(state, "temp-resolver-contract", "canonical-resolver-contract")

    expect(resolveLinkedInstanceId(state, "temp-resolver-contract")).toBe(
      "canonical-resolver-contract"
    )
    expect(resolveLinkedInstanceId(state, "temp-unlinked")).toBeUndefined()
    expect(resolveInstanceId(state, "temp-unlinked")).toBe("temp-unlinked")
  })

  it("clearHandshakeRoutingIdsForInstance removes all routing entries for the instanceId", () => {
    let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
    state = linkHandshakeRoutingId(state, "temp-unlink-a", "canonical-unlink-target")
    state = linkHandshakeRoutingId(state, "temp-unlink-b", "canonical-unlink-target")

    state = clearHandshakeRoutingIdsForInstance(state, "canonical-unlink-target")

    expect(resolveLinkedInstanceId(state, "temp-unlink-a")).toBeUndefined()
    expect(resolveLinkedInstanceId(state, "temp-unlink-b")).toBeUndefined()
  })

  it("MockTransport.registerWcp5Mapping mirrors routing links via onHandshakeRoutingLinked", () => {
    const transport = new CucumberMockTransport()
    let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
    transport.onHandshakeRoutingLinked = (handshakeRoutingId, instanceId) => {
      state = linkHandshakeRoutingId(state, handshakeRoutingId, instanceId)
    }

    const tempConnectionId = "temp-cucumber-wcp5"
    const canonicalInstanceId = "canonical-cucumber-wcp5"

    transport.registerWcp5Mapping(tempConnectionId, canonicalInstanceId)

    expect(resolveLinkedInstanceId(state, tempConnectionId)).toBe(canonicalInstanceId)
    expect(transport.resolveWcp5InstanceId(tempConnectionId)).toBe(canonicalInstanceId)
  })
})

function connectTestInstance(instanceId: string): AgentState {
  let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
  state = connectInstance(state, {
    instanceId,
    appId: "TestApp",
    metadata: { appId: "TestApp", name: "TestApp" },
  })
  return updateInstanceState(state, instanceId, AppInstanceState.CONNECTED)
}

function createHeartbeatTestContext(options: Parameters<typeof createDACPTestContext>[0]) {
  const { context, getState } = createDACPTestContext(options)
  return {
    context: withResponseDispatcher(context, new MockTransport()),
    getState,
  }
}

function expectHeartbeatFullyCleared(getState: () => AgentState, instanceId: string): void {
  expect(getActiveHeartbeatTimerCount()).toBe(0)
  expect(getState().heartbeats[instanceId]).toBeUndefined()
}

describe("cleanupDACPHandlers", () => {
  it("clears pending intents and promise state when the raising instance disconnects", () => {
    const pendingIntentPromises = new Map<string, PendingIntentPromiseEntry>()
    const reject = vi.fn()
    const timeoutHandle = setTimeout(() => {}, 60_000)
    pendingIntentPromises.set("req-source-disconnect", {
      resolve: vi.fn(),
      reject,
      timeoutHandle,
      requestType: "raiseIntentRequest",
    })

    let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
    state = connectInstance(state, {
      instanceId: "a1",
      appId: "App1",
      metadata: { appId: "App1", name: "App1" },
    })
    state = connectInstance(state, {
      instanceId: "l1",
      appId: "portfolioApp",
      metadata: { appId: "portfolioApp", name: "portfolioApp" },
    })
    state = updateInstanceState(state, "a1", AppInstanceState.CONNECTED)
    state = updateInstanceState(state, "l1", AppInstanceState.CONNECTED)
    state = addPendingIntent(state, {
      requestId: "req-source-disconnect",
      intentName: "ViewPortfolio",
      context: { type: "fdc3.portfolio" },
      sourceInstanceId: "a1",
      targetInstanceId: "l1",
      targetAppId: "portfolioApp",
    })

    const { context, getState } = createDACPTestContext({
      instanceId: "a1",
      pendingIntentPromises,
      initialState: state,
    })

    cleanupDACPHandlers(context)

    expect(Object.keys(getState().intents.pending)).toHaveLength(0)
    expect(pendingIntentPromises.has("req-source-disconnect")).toBe(false)
    expect(reject).toHaveBeenCalledOnce()
  })

  it("clears pending intents when the target instance disconnects", () => {
    const pendingIntentPromises = new Map<string, PendingIntentPromiseEntry>()
    const reject = vi.fn()
    pendingIntentPromises.set("req-target-disconnect", {
      resolve: vi.fn(),
      reject,
      requestType: "raiseIntentRequest",
    })

    let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
    state = connectInstance(state, {
      instanceId: "a1",
      appId: "App1",
      metadata: { appId: "App1", name: "App1" },
    })
    state = connectInstance(state, {
      instanceId: "l1",
      appId: "portfolioApp",
      metadata: { appId: "portfolioApp", name: "portfolioApp" },
    })
    state = addPendingIntent(state, {
      requestId: "req-target-disconnect",
      intentName: "ViewPortfolio",
      context: { type: "fdc3.portfolio" },
      sourceInstanceId: "a1",
      targetInstanceId: "l1",
      targetAppId: "portfolioApp",
    })

    const { context, getState } = createDACPTestContext({
      instanceId: "l1",
      pendingIntentPromises,
      initialState: state,
    })

    cleanupDACPHandlers(context)

    expect(Object.keys(getState().intents.pending)).toHaveLength(0)
    expect(pendingIntentPromises.has("req-target-disconnect")).toBe(false)
    expect(reject).toHaveBeenCalledOnce()
  })

  it("clears open-with-context pending state and timeouts when the target instance disconnects", () => {
    let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
    state = connectInstance(state, {
      instanceId: "a1",
      appId: "portfolioApp",
      metadata: { appId: "portfolioApp", name: "portfolioApp" },
    })
    state = updateInstanceState(state, "a1", AppInstanceState.CONNECTED)

    const { context, getState } = createDACPTestContext({
      instanceId: "a1",
      initialState: state,
    })

    const launchContext: Context = {
      type: "fdc3.instrument",
      id: { ticker: "AAPL" },
    }

    const message = {
      type: "openRequest",
      meta: {
        requestUuid: "open-req-1",
        timestamp: new Date(),
      },
      payload: {
        app: { appId: "chartApp", instanceId: "uuid-0" },
        context: launchContext,
      },
    } as BrowserTypes.OpenRequest

    registerOpenWithContext(
      message,
      { appId: "chartApp", instanceId: "uuid-0" },
      launchContext,
      context
    )

    expect(getState().open.pendingWithContext["uuid-0"]?.length).toBe(1)
    expect(getPendingOpenWithContextTimeoutCount()).toBe(1)

    cleanupDACPHandlers({ ...context, instanceId: "uuid-0" })

    expect(getState().open.pendingWithContext["uuid-0"]).toBeUndefined()
    expect(getPendingOpenWithContextTimeoutCount()).toBe(0)
  })

  it("clears open-with-context pending state and timeouts when the source instance disconnects without sending an error", () => {
    let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
    state = connectInstance(state, {
      instanceId: "a1",
      appId: "launcherApp",
      metadata: { appId: "launcherApp", name: "launcherApp" },
    })
    state = connectInstance(state, {
      instanceId: "uuid-0",
      appId: "chartApp",
      metadata: { appId: "chartApp", name: "chartApp" },
    })
    state = updateInstanceState(state, "a1", AppInstanceState.CONNECTED)
    state = updateInstanceState(state, "uuid-0", AppInstanceState.CONNECTED)

    const transport = new MockTransport()
    const { context, getState } = createDACPTestContext({
      instanceId: "a1",
      initialState: state,
    })
    const contextWithTransport = withResponseDispatcher(context, transport)

    const launchContext: Context = {
      type: "fdc3.instrument",
      id: { ticker: "AAPL" },
    }

    const message = {
      type: "openRequest",
      meta: {
        requestUuid: "open-req-source-disconnect",
        timestamp: new Date(),
      },
      payload: {
        app: { appId: "chartApp", instanceId: "uuid-0" },
        context: launchContext,
      },
    } as BrowserTypes.OpenRequest

    registerOpenWithContext(
      message,
      { appId: "chartApp", instanceId: "uuid-0" },
      launchContext,
      contextWithTransport
    )

    expect(getState().open.pendingWithContext["uuid-0"]?.length).toBe(1)
    expect(getPendingOpenWithContextTimeoutCount()).toBe(1)

    cleanupDACPHandlers(contextWithTransport)

    expect(getState().open.pendingWithContext["uuid-0"]).toBeUndefined()
    expect(getPendingOpenWithContextTimeoutCount()).toBe(0)

    const openErrorResponses = transport.sentMessages.filter(message => {
      const typed = message as { type?: string; payload?: { error?: string } }
      return typed.type === "openResponse" && typed.payload?.error !== undefined
    })
    expect(openErrorResponses).toHaveLength(0)
  })
})

describe("heartbeat cleanup on disconnect", () => {
  it("cleanupDACPHandlers clears active heartbeat interval and state entry", () => {
    const instanceId = "instance-cleanup-dacp"
    const initialState = connectTestInstance(instanceId)
    const { context, getState } = createHeartbeatTestContext({ instanceId, initialState })

    startHeartbeat(instanceId, context)
    expect(getActiveHeartbeatTimerCount()).toBe(1)
    expect(getState().heartbeats[instanceId]).toBeDefined()

    cleanupDACPHandlers(context)

    expectHeartbeatFullyCleared(getState, instanceId)
  })

  it("handleWCP6Goodbye clears active heartbeat interval and state entry", () => {
    const instanceId = "instance-wcp6-goodbye"
    const initialState = connectTestInstance(instanceId)
    const { context, getState } = createHeartbeatTestContext({ instanceId, initialState })

    startHeartbeat(instanceId, context)
    expect(getActiveHeartbeatTimerCount()).toBe(1)
    expect(getState().heartbeats[instanceId]).toBeDefined()

    handleWCP6Goodbye({}, context)

    expectHeartbeatFullyCleared(getState, instanceId)
  })

  it("heartbeat timeout clears active heartbeat interval and state entry", () => {
    vi.useFakeTimers()
    const instanceId = "instance-heartbeat-timeout"
    const initialState = connectTestInstance(instanceId)
    const { context, getState } = createHeartbeatTestContext({ instanceId, initialState })

    startHeartbeat(instanceId, context)
    expect(getActiveHeartbeatTimerCount()).toBe(1)
    expect(getState().heartbeats[instanceId]).toBeDefined()

    vi.advanceTimersByTime(2500)

    expectHeartbeatFullyCleared(getState, instanceId)
  })

  it("DesktopAgent.disconnectInstance clears active heartbeat interval and state entry", async () => {
    const transport = new MockTransport()
    const agent = new DesktopAgent({
      transport,
      apps: [TEST_WCP_DIRECTORY_APP],
      heartbeatIntervalMs: 500,
      heartbeatTimeoutMs: 2000,
    })
    agent.start()

    const wcp4Message = {
      type: "WCP4ValidateAppIdentity",
      payload: {
        identityUrl: "https://example.com/app",
        actualUrl: "https://example.com/app",
      },
      meta: {
        connectionAttemptUuid: "heartbeat-disconnect-uuid",
        timestamp: new Date().toISOString(),
        messageOrigin: "https://example.com",
      },
    } as unknown as BrowserTypes.WebConnectionProtocol4ValidateAppIdentity

    await transport.receiveMessage(wcp4Message)

    const wcp5Response = transport.sentMessages.find(
      message => (message as { type?: string }).type === "WCP5ValidateAppIdentityResponse"
    ) as { payload?: { instanceId?: string } } | undefined
    const canonicalInstanceId = wcp5Response?.payload?.instanceId
    expect(canonicalInstanceId).toBeDefined()

    expect(getActiveHeartbeatTimerCount()).toBe(1)
    expect(agent.getState().heartbeats[canonicalInstanceId!]).toBeDefined()

    agent.disconnectInstance(canonicalInstanceId!)

    expectHeartbeatFullyCleared(() => agent.getState(), canonicalInstanceId!)
  })

  it("stops heartbeat on canonical instanceId when cleanup runs from WCP4 temp context", () => {
    const tempInstanceId = "temp-wcp4-attempt"
    const canonicalInstanceId = "canonical-wcp5-instance"
    const initialState = connectTestInstance(canonicalInstanceId)
    const { context, getState } = createHeartbeatTestContext({
      instanceId: tempInstanceId,
      initialState,
    })

    startHeartbeat(canonicalInstanceId, context)
    expect(getActiveHeartbeatTimerCount()).toBe(1)
    expect(getState().heartbeats[canonicalInstanceId]).toBeDefined()

    handleWCP6Goodbye({}, context)

    expectHeartbeatFullyCleared(getState, canonicalInstanceId)
  })

  it("heartbeat timeout stops heartbeat on canonical instanceId when WCP4 temp context was used", () => {
    vi.useFakeTimers()
    const tempInstanceId = "temp-wcp4-timeout"
    const canonicalInstanceId = "canonical-wcp5-timeout"
    const initialState = connectTestInstance(canonicalInstanceId)
    const { context, getState } = createHeartbeatTestContext({
      instanceId: tempInstanceId,
      initialState,
    })

    startHeartbeat(canonicalInstanceId, context)
    expect(getActiveHeartbeatTimerCount()).toBe(1)
    expect(getState().heartbeats[canonicalInstanceId]).toBeDefined()

    vi.advanceTimersByTime(2500)

    expectHeartbeatFullyCleared(getState, canonicalInstanceId)
  })

  it("cleanupDACPHandlers clears heartbeat when invoked with WCP4 temp context id", () => {
    const tempInstanceId = "temp-wcp4-direct-cleanup"
    const canonicalInstanceId = "canonical-wcp5-direct-cleanup"
    const initialState = connectTestInstance(canonicalInstanceId)
    const { context, getState } = createHeartbeatTestContext({
      instanceId: tempInstanceId,
      initialState,
    })

    startHeartbeat(canonicalInstanceId, context)
    expect(getActiveHeartbeatTimerCount()).toBe(1)
    expect(getState().heartbeats[canonicalInstanceId]).toBeDefined()

    cleanupDACPHandlers(context)

    expectHeartbeatFullyCleared(getState, canonicalInstanceId)
  })

  it("DesktopAgent.disconnectInstance clears heartbeat when called with WCP4 connectionAttemptUuid", async () => {
    const transport = new MockTransport()
    const agent = new DesktopAgent({
      transport,
      apps: [TEST_WCP_DIRECTORY_APP],
      heartbeatIntervalMs: 500,
      heartbeatTimeoutMs: 2000,
    })
    agent.start()

    const connectionAttemptUuid = "temp-disconnect-by-attempt-uuid"
    const wcp4Message = {
      type: "WCP4ValidateAppIdentity",
      payload: {
        identityUrl: "https://example.com/app",
        actualUrl: "https://example.com/app",
      },
      meta: {
        connectionAttemptUuid,
        timestamp: new Date().toISOString(),
        messageOrigin: "https://example.com",
      },
    } as unknown as BrowserTypes.WebConnectionProtocol4ValidateAppIdentity

    await transport.receiveMessage(wcp4Message)

    const wcp5Response = transport.sentMessages.find(
      message => (message as { type?: string }).type === "WCP5ValidateAppIdentityResponse"
    ) as { payload?: { instanceId?: string } } | undefined
    const canonicalInstanceId = wcp5Response?.payload?.instanceId
    expect(canonicalInstanceId).toBeDefined()

    expect(getActiveHeartbeatTimerCount()).toBe(1)
    expect(agent.getState().heartbeats[canonicalInstanceId!]).toBeDefined()

    agent.disconnectInstance(`temp-${connectionAttemptUuid}`)

    expectHeartbeatFullyCleared(() => agent.getState(), canonicalInstanceId!)
  })

  it("transport disconnect clears all active heartbeat timers and state entries", async () => {
    const transport = new MockTransport()
    const agent = new DesktopAgent({
      transport,
      apps: [TEST_WCP_DIRECTORY_APP],
      heartbeatIntervalMs: 500,
      heartbeatTimeoutMs: 2000,
    })
    agent.start()

    const wcp4Message = {
      type: "WCP4ValidateAppIdentity",
      payload: {
        identityUrl: "https://example.com/app",
        actualUrl: "https://example.com/app",
      },
      meta: {
        connectionAttemptUuid: "transport-disconnect-uuid",
        timestamp: new Date().toISOString(),
        messageOrigin: "https://example.com",
      },
    } as unknown as BrowserTypes.WebConnectionProtocol4ValidateAppIdentity

    await transport.receiveMessage(wcp4Message)

    const wcp5Response = transport.sentMessages.find(
      message => (message as { type?: string }).type === "WCP5ValidateAppIdentityResponse"
    ) as { payload?: { instanceId?: string } } | undefined
    const canonicalInstanceId = wcp5Response?.payload?.instanceId
    expect(canonicalInstanceId).toBeDefined()
    expect(getActiveHeartbeatTimerCount()).toBe(1)

    transport.disconnect()

    expectHeartbeatFullyCleared(() => agent.getState(), canonicalInstanceId!)
  })

  it("duplicate WCP6Goodbye for a closed instance does not clean up another connected app", () => {
    const closedMockInstanceId = "mock-app-closed"
    const conformanceInstanceId = "conformance1-still-open"

    let state = connectTestInstance(closedMockInstanceId)
    state = connectTestInstance(conformanceInstanceId)
    state = updateInstanceState(state, conformanceInstanceId, AppInstanceState.CONNECTED)

    const { context: mockContext, getState } = createHeartbeatTestContext({
      instanceId: closedMockInstanceId,
      initialState: state,
    })
    const { context: conformanceContext } = createHeartbeatTestContext({
      instanceId: conformanceInstanceId,
      initialState: state,
    })

    startHeartbeat(closedMockInstanceId, mockContext)
    startHeartbeat(conformanceInstanceId, conformanceContext)
    expect(getActiveHeartbeatTimerCount()).toBe(2)

    cleanupDACPHandlers(mockContext)
    expect(getState().instances[closedMockInstanceId]).toBeUndefined()
    expect(getState().instances[conformanceInstanceId]).toBeDefined()
    expect(getActiveHeartbeatTimerCount()).toBe(1)

    handleWCP6Goodbye({}, mockContext)

    expect(getState().instances[conformanceInstanceId]).toBeDefined()
    expect(getState().heartbeats[conformanceInstanceId]).toBeDefined()
    expect(getActiveHeartbeatTimerCount()).toBe(1)
  })

  it("cleanupDACPHandlers removes canonical instance state when invoked with WCP4 temp context after WCP5 link without heartbeat", () => {
    const tempInstanceId = "temp-wcp5-no-heartbeat-cleanup"
    const canonicalInstanceId = "canonical-wcp5-no-heartbeat-cleanup"
    let initialState = connectTestInstance(canonicalInstanceId)
    initialState = linkHandshakeRoutingId(initialState, tempInstanceId, canonicalInstanceId)

    const { context, getState } = createHeartbeatTestContext({
      instanceId: tempInstanceId,
      initialState,
    })

    expect(getState().instances[canonicalInstanceId]).toBeDefined()
    expect(getActiveHeartbeatTimerCount()).toBe(0)

    cleanupDACPHandlers(context)

    expect(getState().instances[canonicalInstanceId]).toBeUndefined()
  })

  it("cleanupDACPHandlers clears only the targeted heartbeat when multiple instances are connected and WCP4 temp context is used", () => {
    const tempInstanceId = "temp-wcp4-multi"
    const canonicalInstanceId = "canonical-wcp5-multi"
    const otherInstanceId = "other-connected-instance"

    let state = connectTestInstance(canonicalInstanceId)
    state = connectTestInstance(otherInstanceId)
    state = updateInstanceState(state, otherInstanceId, AppInstanceState.CONNECTED)

    const { context: targetContext, getState: getTargetState } = createHeartbeatTestContext({
      instanceId: tempInstanceId,
      initialState: state,
    })
    const { context: otherContext } = createHeartbeatTestContext({
      instanceId: otherInstanceId,
      initialState: state,
    })

    startHeartbeat(canonicalInstanceId, targetContext)
    startHeartbeat(otherInstanceId, otherContext)
    expect(getActiveHeartbeatTimerCount()).toBe(2)

    cleanupDACPHandlers(targetContext)

    expect(getActiveHeartbeatTimerCount()).toBe(1)
    expect(getTargetState().heartbeats[canonicalInstanceId]).toBeUndefined()
    expect(getTargetState().heartbeats[otherInstanceId]).toBeDefined()
  })
})
