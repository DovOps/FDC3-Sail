import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import type { BrowserTypes } from "@finos/fdc3"
import { DesktopAgent } from "../../../desktop-agent"
import { MockTransport } from "../../../../__tests__/utils/mock-transport"
import { cleanupDACPHandlers } from "../cleanup"
import { startHeartbeat } from "../heartbeat-handlers"
import {
  clearAllHeartbeatTimersForTesting,
  getActiveHeartbeatTimerCount,
} from "../heartbeat-runtime"
import {
  getInstanceIdentityCountForTesting,
  getInstanceIdentityMap,
  hasInstanceIdentityForTesting,
} from "../instance-identity-registry"
import { connectInstance, updateInstanceState } from "../../../state/mutators"
import { AppInstanceState } from "../../../state/types"
import { createInitialState } from "../../../state/initial-state"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../default-user-channels"
import { createDACPTestContext } from "./test-context"
import { withResponseDispatcher } from "./test-context"

const TEST_APP = {
  appId: "test-app",
  title: "Test App",
  type: "web" as const,
  details: { url: "https://example.com/app" },
}

function createWcp4Message(
  connectionAttemptUuid: string,
  overrides: Partial<BrowserTypes.WebConnectionProtocol4ValidateAppIdentity["payload"]> = {}
) {
  return {
    type: "WCP4ValidateAppIdentity",
    payload: {
      identityUrl: "https://example.com/app",
      actualUrl: "https://example.com/app",
      ...overrides,
    },
    meta: {
      connectionAttemptUuid,
      timestamp: new Date().toISOString(),
      messageOrigin: "https://example.com",
    },
  } as unknown as BrowserTypes.WebConnectionProtocol4ValidateAppIdentity
}

function createAgentWithTransport(options?: {
  heartbeatIntervalMs?: number
  heartbeatTimeoutMs?: number
}) {
  const transport = new MockTransport()
  const agent = new DesktopAgent({
    transport,
    apps: [TEST_APP],
    // Avoid immediate heartbeat on connect (see heartbeat-handlers short-interval branch).
    heartbeatIntervalMs: options?.heartbeatIntervalMs ?? 5000,
    heartbeatTimeoutMs: options?.heartbeatTimeoutMs ?? 15000,
  })
  agent.start()
  return { agent, transport }
}

function getWcp5CanonicalInstanceId(transport: MockTransport, occurrence = 0): string {
  const wcp5Responses = transport.sentMessages.filter(
    message => (message as { type?: string }).type === "WCP5ValidateAppIdentityResponse"
  ) as Array<{ payload?: { instanceId?: string } }>
  const instanceId = wcp5Responses[occurrence]?.payload?.instanceId
  expect(instanceId).toBeDefined()
  return instanceId!
}

afterEach(() => {
  clearAllHeartbeatTimersForTesting()
  vi.useRealTimers()
})

describe("instance identity registry lifecycle", () => {
  it("does not add identity entries when WCP4 validation fails", async () => {
    const { transport } = createAgentWithTransport()

    await transport.receiveMessage(
      createWcp4Message("failed-wcp4-uuid", {
        identityUrl: "https://example.com/not-in-directory",
        actualUrl: "https://example.com/not-in-directory",
      })
    )

    expect(getInstanceIdentityCountForTesting(transport)).toBe(0)
  })

  it("records identity after successful WCP4 validation", async () => {
    const { transport } = createAgentWithTransport()

    await transport.receiveMessage(createWcp4Message("success-wcp4-uuid"))

    const instanceId = getWcp5CanonicalInstanceId(transport)
    expect(hasInstanceIdentityForTesting(transport, instanceId)).toBe(true)
    expect(getInstanceIdentityCountForTesting(transport)).toBe(1)
  })

  it("prunes identity entry when cleanupDACPHandlers runs after successful WCP4", async () => {
    const { agent, transport } = createAgentWithTransport()

    await transport.receiveMessage(createWcp4Message("cleanup-wcp4-uuid"))

    const instanceId = getWcp5CanonicalInstanceId(transport)
    expect(hasInstanceIdentityForTesting(transport, instanceId)).toBe(true)

    agent.disconnectInstance(instanceId)

    expect(hasInstanceIdentityForTesting(transport, instanceId)).toBe(false)
    expect(getInstanceIdentityCountForTesting(transport)).toBe(0)
  })

  it("prunes identity entry when WCP6Goodbye runs after successful WCP4", async () => {
    const { agent, transport } = createAgentWithTransport()

    await transport.receiveMessage(createWcp4Message("goodbye-wcp4-uuid"))

    const canonicalInstanceId = getWcp5CanonicalInstanceId(transport)
    expect(hasInstanceIdentityForTesting(transport, canonicalInstanceId)).toBe(true)

    await transport.receiveMessage({
      type: "WCP6Goodbye",
      meta: {
        source: { instanceId: canonicalInstanceId },
        timestamp: new Date().toISOString(),
      },
    })

    expect(agent.getState().instances[canonicalInstanceId]).toBeUndefined()
    expect(hasInstanceIdentityForTesting(transport, canonicalInstanceId)).toBe(false)
    expect(getInstanceIdentityCountForTesting(transport)).toBe(0)
  })

  it("prunes identity entry when heartbeat timeout fires after successful WCP4", async () => {
    vi.useFakeTimers()
    const { transport } = createAgentWithTransport({
      heartbeatIntervalMs: 500,
      heartbeatTimeoutMs: 2000,
    })

    await transport.receiveMessage(createWcp4Message("heartbeat-timeout-uuid"))

    const instanceId = getWcp5CanonicalInstanceId(transport)
    expect(hasInstanceIdentityForTesting(transport, instanceId)).toBe(true)
    expect(getActiveHeartbeatTimerCount()).toBe(1)

    vi.advanceTimersByTime(2500)

    expect(hasInstanceIdentityForTesting(transport, instanceId)).toBe(false)
    expect(getInstanceIdentityCountForTesting(transport)).toBe(0)
  })

  it("prunes only the disconnected instance when multiple identities exist on one transport", async () => {
    const { agent, transport } = createAgentWithTransport()

    await transport.receiveMessage(createWcp4Message("first-connect-uuid"))
    const firstInstanceId = getWcp5CanonicalInstanceId(transport)

    await transport.receiveMessage(createWcp4Message("second-connect-uuid"))
    const secondInstanceId = getWcp5CanonicalInstanceId(transport, 1)

    expect(getInstanceIdentityCountForTesting(transport)).toBe(2)

    agent.disconnectInstance(firstInstanceId)

    expect(hasInstanceIdentityForTesting(transport, firstInstanceId)).toBe(false)
    expect(hasInstanceIdentityForTesting(transport, secondInstanceId)).toBe(true)
    expect(getInstanceIdentityCountForTesting(transport)).toBe(1)

    agent.disconnectInstance(secondInstanceId)

    expect(getInstanceIdentityCountForTesting(transport)).toBe(0)
  })

  it("prunes identity when cleanupDACPHandlers resolves canonical id from WCP4 temp context", () => {
    const transport = new MockTransport()
    const canonicalInstanceId = "canonical-prune-instance"
    let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
    state = connectInstance(state, {
      instanceId: canonicalInstanceId,
      appId: TEST_APP.appId,
      metadata: { appId: TEST_APP.appId, name: TEST_APP.title },
    })
    state = updateInstanceState(state, canonicalInstanceId, AppInstanceState.CONNECTED)

    const { context, getState } = createDACPTestContext({
      instanceId: "temp-prune-attempt",
      initialState: state,
    })
    const contextWithTransport = withResponseDispatcher(context, transport)

    getInstanceIdentityMap(transport).set(canonicalInstanceId, {
      appId: TEST_APP.appId,
      instanceUuid: "uuid-prune",
      origin: "https://example.com",
      sourceWindow: undefined,
    })
    expect(hasInstanceIdentityForTesting(transport, canonicalInstanceId)).toBe(true)

    startHeartbeat(canonicalInstanceId, contextWithTransport)
    cleanupDACPHandlers(contextWithTransport)

    expect(getState().instances[canonicalInstanceId]).toBeUndefined()
    expect(hasInstanceIdentityForTesting(transport, canonicalInstanceId)).toBe(false)
  })
})
