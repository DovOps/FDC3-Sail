import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import type { AppLauncher } from "../../../../host-contracts/app-launcher"
import type { BrowserTypes, Context } from "@finos/fdc3"
import { OpenError } from "@finos/fdc3"
import { DesktopAgent } from "../../../desktop-agent"
import { MockTransport } from "../../../../__tests__/utils/mock-transport"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../default-user-channels"
import { connectInstance, updateInstanceState } from "../../../state/mutators"
import { AppInstanceState } from "../../../state/types"
import { createInitialState } from "../../../state/initial-state"
import { getInstance } from "../../../state/selectors"
import { clearAllPendingOpenWithContextTimeoutsForTesting } from "../utils/open-with-context"
import { clearAllHeartbeatTimersForTesting } from "../heartbeat-runtime"

const HOST_INSTANCE_ID = "uuid-0"
const SOURCE_INSTANCE_ID = "a1"
const APP_URL = "https://example.com/chart"

const CHART_APP = {
  appId: "chartApp",
  title: "Chart App",
  type: "web" as const,
  details: { url: APP_URL },
}

const PORTFOLIO_APP = {
  appId: "portfolioApp",
  title: "Portfolio App",
  type: "web" as const,
  details: { url: "https://example.com/portfolio" },
}

const LAUNCH_CONTEXT: Context = {
  type: "fdc3.instrument",
  id: { ticker: "AAPL" },
}

function createHostInstanceAppLauncher(): AppLauncher {
  let launchCount = 0
  return {
    launch(request) {
      const instanceId = request.app.instanceId ?? `uuid-${launchCount++}`
      return Promise.resolve({ appId: request.app.appId, instanceId })
    },
  }
}

function createAgentWithSourceInstance(options?: { openContextListenerTimeoutMs?: number }) {
  const transport = new MockTransport()
  const initialState = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
  const stateWithSource = updateInstanceState(
    connectInstance(initialState, {
      instanceId: SOURCE_INSTANCE_ID,
      appId: PORTFOLIO_APP.appId,
      metadata: { appId: PORTFOLIO_APP.appId, name: PORTFOLIO_APP.appId },
    }),
    SOURCE_INSTANCE_ID,
    AppInstanceState.CONNECTED
  )

  const agent = new DesktopAgent({
    transport,
    apps: [CHART_APP, PORTFOLIO_APP],
    appLauncher: createHostInstanceAppLauncher(),
    initialState: stateWithSource,
    openContextListenerTimeoutMs: options?.openContextListenerTimeoutMs ?? 5000,
    heartbeatIntervalMs: 5000,
    heartbeatTimeoutMs: 15000,
  })
  agent.start()
  return { agent, transport }
}

function createWcp4FirstConnectMessage(
  connectionAttemptUuid: string,
  hostInstanceId?: string,
  hostInstanceUuid = "host-instance-uuid"
) {
  return {
    type: "WCP4ValidateAppIdentity",
    payload: {
      identityUrl: APP_URL,
      actualUrl: APP_URL,
      ...(hostInstanceId ? { instanceId: hostInstanceId } : {}),
      instanceUuid: hostInstanceUuid,
    },
    meta: {
      connectionAttemptUuid,
      timestamp: new Date().toISOString(),
      messageOrigin: new URL(APP_URL).origin,
      wcpSourceWindow: hostInstanceId ? { hostPanel: hostInstanceId } : { hostPanel: "anonymous" },
    },
  } as unknown as BrowserTypes.WebConnectionProtocol4ValidateAppIdentity
}

function createOpenRequestMessage(context?: Context): BrowserTypes.OpenRequest {
  return {
    type: "openRequest",
    meta: {
      requestUuid: "open-req-host-instance",
      timestamp: new Date(),
      source: {
        appId: PORTFOLIO_APP.appId,
        instanceId: SOURCE_INSTANCE_ID,
      },
    },
    payload: {
      app: { appId: CHART_APP.appId },
      context,
    },
  }
}

function createFindInstancesMessage(): BrowserTypes.FindInstancesRequest {
  return {
    type: "findInstancesRequest",
    meta: {
      requestUuid: "find-instances-req",
      timestamp: new Date(),
      source: {
        appId: PORTFOLIO_APP.appId,
        instanceId: SOURCE_INSTANCE_ID,
      },
    },
    payload: {
      app: { appId: CHART_APP.appId },
    },
  }
}

function createAddContextListenerMessage(
  targetInstanceId: string,
  contextType: string
): BrowserTypes.AddContextListenerRequest {
  return {
    type: "addContextListenerRequest",
    meta: {
      requestUuid: "listener-req-1",
      timestamp: new Date(),
      source: {
        appId: CHART_APP.appId,
        instanceId: targetInstanceId,
      },
    },
    payload: {
      channelId: null,
      contextType,
    },
  }
}

function getWcp5InstanceId(transport: MockTransport): string {
  const response = transport.sentMessages.find(
    message => (message as { type?: string }).type === "WCP5ValidateAppIdentityResponse"
  ) as { payload?: { instanceId?: string } } | undefined
  expect(response?.payload?.instanceId).toBeDefined()
  return response!.payload!.instanceId!
}

afterEach(() => {
  clearAllHeartbeatTimersForTesting()
  clearAllPendingOpenWithContextTimeoutsForTesting()
  vi.useRealTimers()
})

describe("host-assigned instanceId at WCP4", () => {
  it("registers launcher instanceId as pending instance when openRequest launches an app", async () => {
    const { agent, transport } = createAgentWithSourceInstance()

    await transport.receiveMessage(createOpenRequestMessage())

    const hostInstance = getInstance(agent.getState(), HOST_INSTANCE_ID)
    expect(hostInstance).toBeDefined()
    expect(hostInstance?.appId).toBe(CHART_APP.appId)
    expect(hostInstance?.state).toBe(AppInstanceState.PENDING)
  })

  it("includes launcher pre-registered instanceId in findInstances before WCP validation completes", async () => {
    const { transport } = createAgentWithSourceInstance()

    await transport.receiveMessage(createOpenRequestMessage())
    transport.clear()

    await transport.receiveMessage(createFindInstancesMessage())

    const response = transport.getLastMessage() as {
      type: string
      payload?: { appIdentifiers?: Array<{ appId: string; instanceId?: string }> }
    }
    expect(response.type).toBe("findInstancesResponse")
    expect(response.payload?.appIdentifiers).toEqual(
      expect.arrayContaining([{ appId: CHART_APP.appId, instanceId: HOST_INSTANCE_ID }])
    )
  })

  it("adopts host-assigned instanceId as canonical WCP5 id on first WCP4 validation", async () => {
    const transport = new MockTransport()
    const initialState = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
    const stateWithInstances = updateInstanceState(
      connectInstance(
        connectInstance(initialState, {
          instanceId: SOURCE_INSTANCE_ID,
          appId: PORTFOLIO_APP.appId,
          metadata: { appId: PORTFOLIO_APP.appId, name: PORTFOLIO_APP.appId },
        }),
        {
          instanceId: HOST_INSTANCE_ID,
          appId: CHART_APP.appId,
          metadata: { appId: CHART_APP.appId, name: CHART_APP.appId },
        }
      ),
      SOURCE_INSTANCE_ID,
      AppInstanceState.CONNECTED
    )

    const agent = new DesktopAgent({
      transport,
      apps: [CHART_APP, PORTFOLIO_APP],
      appLauncher: createHostInstanceAppLauncher(),
      initialState: stateWithInstances,
      heartbeatIntervalMs: 5000,
      heartbeatTimeoutMs: 15000,
    })
    agent.start()

    await transport.receiveMessage(
      createWcp4FirstConnectMessage("wcp4-host-bind", HOST_INSTANCE_ID)
    )

    expect(getWcp5InstanceId(transport)).toBe(HOST_INSTANCE_ID)
    expect(getInstance(agent.getState(), HOST_INSTANCE_ID)).toBeDefined()
    expect(
      Object.values(agent.getState().instances).filter(
        instance => instance.appId === CHART_APP.appId
      )
    ).toHaveLength(1)
  })

  it("delivers open-with-context without AppTimeout when the target adds a listener on the host instanceId", async () => {
    vi.useFakeTimers()
    const { agent, transport } = createAgentWithSourceInstance({
      openContextListenerTimeoutMs: 2000,
    })

    await transport.receiveMessage(createOpenRequestMessage(LAUNCH_CONTEXT))

    expect(getInstance(agent.getState(), HOST_INSTANCE_ID)).toBeDefined()
    expect(agent.getState().open.pendingWithContext[HOST_INSTANCE_ID]?.length).toBe(1)

    await transport.receiveMessage(
      createWcp4FirstConnectMessage("wcp4-open-with-context", HOST_INSTANCE_ID)
    )
    expect(getWcp5InstanceId(transport)).toBe(HOST_INSTANCE_ID)

    transport.clear()
    await transport.receiveMessage(
      createAddContextListenerMessage(HOST_INSTANCE_ID, LAUNCH_CONTEXT.type)
    )

    const openResponses = transport.sentMessages.filter(
      message => (message as { type?: string }).type === "openResponse"
    ) as Array<{ payload?: { error?: string; appIdentifier?: { instanceId?: string } } }>
    const appTimeoutResponses = openResponses.filter(
      response => response.payload?.error === OpenError.AppTimeout
    )
    const broadcastEvents = transport.sentMessages.filter(
      message => (message as { type?: string }).type === "broadcastEvent"
    ) as Array<{ meta?: { destination?: { instanceId?: string } } }>

    expect(appTimeoutResponses).toHaveLength(0)
    expect(broadcastEvents.length).toBeGreaterThanOrEqual(1)
    expect(broadcastEvents[0]?.meta?.destination?.instanceId).toBe(HOST_INSTANCE_ID)
    expect(openResponses.some(response => response.payload?.error === undefined)).toBe(true)

    vi.advanceTimersByTime(2500)
    const timeoutAfterDelivery = transport.sentMessages.filter(message => {
      const typed = message as { type?: string; payload?: { error?: string } }
      return typed.type === "openResponse" && typed.payload?.error === OpenError.AppTimeout
    })
    expect(timeoutAfterDelivery).toHaveLength(0)
  })

  it("adopts sole host-pre-registered pending when WCP4 omits instanceId", async () => {
    const { agent, transport } = createAgentWithSourceInstance()

    await transport.receiveMessage(createOpenRequestMessage())

    await transport.receiveMessage(createWcp4FirstConnectMessage("wcp4-cross-origin-no-name"))

    expect(getWcp5InstanceId(transport)).toBe(HOST_INSTANCE_ID)
    expect(
      Object.values(agent.getState().instances).filter(
        instance => instance.appId === CHART_APP.appId
      )
    ).toHaveLength(1)
  })

  it("delivers open-with-context for a specific context type when WCP4 omits instanceId", async () => {
    vi.useFakeTimers()
    const { agent, transport } = createAgentWithSourceInstance({
      openContextListenerTimeoutMs: 2000,
    })

    await transport.receiveMessage(createOpenRequestMessage(LAUNCH_CONTEXT))
    expect(agent.getState().open.pendingWithContext[HOST_INSTANCE_ID]?.length).toBe(1)

    await transport.receiveMessage(createWcp4FirstConnectMessage("wcp4-specific-context-no-name"))
    expect(getWcp5InstanceId(transport)).toBe(HOST_INSTANCE_ID)

    transport.clear()
    await transport.receiveMessage(
      createAddContextListenerMessage(HOST_INSTANCE_ID, LAUNCH_CONTEXT.type)
    )

    const appTimeoutResponses = transport.sentMessages.filter(message => {
      const typed = message as { type?: string; payload?: { error?: string } }
      return typed.type === "openResponse" && typed.payload?.error === OpenError.AppTimeout
    })
    expect(appTimeoutResponses).toHaveLength(0)
  })
})
