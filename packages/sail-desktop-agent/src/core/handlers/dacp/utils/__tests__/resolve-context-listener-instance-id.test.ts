import { describe, expect, it, afterEach } from "vite-plus/test"
import type { BrowserTypes } from "@finos/fdc3"
import {
  connectInstance,
  updateInstanceState,
  addPendingOpenWithContext,
} from "../../../../state/mutators"
import { AppInstanceState } from "../../../../state/types"
import { createInitialState } from "../../../../state/initial-state"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../../default-user-channels"
import { createDACPTestContext } from "../../__tests__/test-context"
import { resolveDacpHandlerInstanceId } from "../resolve-context-listener-instance-id"
import { linkHandshakeRoutingId } from "../../../../state/mutators/wcp-handshake-routing"
import { clearAllHeartbeatTimersForTesting } from "../../heartbeat-runtime"

const CHART_APP_ID = "chartApp"

afterEach(() => {
  clearAllHeartbeatTimersForTesting()
})

describe("resolveDacpHandlerInstanceId", () => {
  it("routes temp WCP connection id to host launcher placeholder instance", () => {
    const hostInstanceId = "launcher-instance-id"
    const tempInstanceId = "temp-wcp-handshake"
    const initialState = connectInstance(createInitialState(DEFAULT_FDC3_USER_CHANNELS), {
      instanceId: hostInstanceId,
      appId: CHART_APP_ID,
      metadata: { appId: CHART_APP_ID, name: CHART_APP_ID },
    })

    const { context } = createDACPTestContext({
      instanceId: tempInstanceId,
      initialState,
    })

    const message = {
      type: "addContextListenerRequest",
      meta: {
        requestUuid: "listener-1",
        timestamp: new Date(),
        hostInstanceId,
        source: { appId: CHART_APP_ID, instanceId: tempInstanceId },
      },
      payload: { channelId: null, contextType: "*" },
    } as BrowserTypes.AddContextListenerRequest

    expect(resolveDacpHandlerInstanceId(message, context)).toBe(hostInstanceId)
  })

  it("routes temp id to linked instance after WCP4 handshake mapping", () => {
    const instanceId = "canonical-wcp5-id"
    const handshakeRoutingId = "temp-linked-handshake"

    const initialState = connectInstance(createInitialState(DEFAULT_FDC3_USER_CHANNELS), {
      instanceId,
      appId: CHART_APP_ID,
      metadata: { appId: CHART_APP_ID, name: CHART_APP_ID },
    })
    const stateWithLink = linkHandshakeRoutingId(initialState, handshakeRoutingId, instanceId)

    const { context } = createDACPTestContext({
      instanceId: handshakeRoutingId,
      initialState: stateWithLink,
    })

    const message = {
      type: "addContextListenerRequest",
      meta: {
        requestUuid: "listener-2",
        timestamp: new Date(),
        source: { appId: CHART_APP_ID, instanceId: handshakeRoutingId },
      },
      payload: { channelId: null, contextType: "fdc3.instrument" },
    } as BrowserTypes.AddContextListenerRequest

    expect(resolveDacpHandlerInstanceId(message, context)).toBe(instanceId)
  })

  it("routes a stale source id to the only connected instance for that app", () => {
    const staleInstanceId = "stale-conformance-instance"
    const liveInstanceId = "live-conformance-instance"
    const appId = "Conformance1"
    const initialState = updateInstanceState(
      connectInstance(createInitialState(DEFAULT_FDC3_USER_CHANNELS), {
        instanceId: liveInstanceId,
        appId,
        metadata: { appId, name: appId },
      }),
      liveInstanceId,
      AppInstanceState.CONNECTED
    )

    const { context } = createDACPTestContext({
      instanceId: staleInstanceId,
      initialState,
    })

    const message = {
      type: "addContextListenerRequest",
      meta: {
        requestUuid: "listener-stale-source",
        timestamp: new Date(),
        source: { appId, instanceId: staleInstanceId },
      },
      payload: { channelId: "app-control", contextType: "windowClosed" },
    } as BrowserTypes.AddContextListenerRequest

    expect(resolveDacpHandlerInstanceId(message, context)).toBe(liveInstanceId)
  })

  it("routes to host launcher pending bucket when open-with-context is pending there", () => {
    const hostInstanceId = "launcher-instance-id"
    const tempRoutedInstanceId = "temp-wcp-not-in-registry"
    const openRequest = {
      type: "openRequest",
      meta: {
        requestUuid: "open-req-pending-host",
        timestamp: new Date(),
        source: { appId: "portfolioApp", instanceId: "source-1" },
      },
      payload: {
        app: { appId: CHART_APP_ID, instanceId: hostInstanceId },
        context: { type: "fdc3.instrument", id: { ticker: "AAPL" } },
      },
    } as BrowserTypes.OpenRequest

    const initialState = addPendingOpenWithContext(
      connectInstance(createInitialState(DEFAULT_FDC3_USER_CHANNELS), {
        instanceId: hostInstanceId,
        appId: CHART_APP_ID,
        metadata: { appId: CHART_APP_ID, name: CHART_APP_ID },
      }),
      hostInstanceId,
      {
        message: openRequest,
        appIdentifier: { appId: CHART_APP_ID, instanceId: hostInstanceId },
        launchContext: openRequest.payload.context!,
        sourceInstanceId: "source-1",
      }
    )

    const { context } = createDACPTestContext({
      instanceId: tempRoutedInstanceId,
      initialState,
    })

    const message = {
      type: "addContextListenerRequest",
      meta: {
        requestUuid: "listener-pending-host",
        timestamp: new Date(),
        source: { appId: CHART_APP_ID, instanceId: tempRoutedInstanceId },
      },
      payload: { channelId: null, contextType: "fdc3.instrument" },
    } as BrowserTypes.AddContextListenerRequest

    expect(resolveDacpHandlerInstanceId(message, context)).toBe(hostInstanceId)
  })

  it("keeps the connected sender when another instance has pending open-with-context", () => {
    const connectedSenderId = "connected-mock-instance"
    const pendingTargetId = "pending-mock-launch"
    const appId = "MockAppId"
    const openRequest = {
      type: "openRequest",
      meta: {
        requestUuid: "open-req-pending-other",
        timestamp: new Date(),
        source: { appId: "Conformance1", instanceId: "conformance-1" },
      },
      payload: {
        app: { appId, instanceId: pendingTargetId },
        context: { type: "fdc3.instrument", id: { ticker: "MSFT" } },
      },
    } as BrowserTypes.OpenRequest

    const withConnected = updateInstanceState(
      connectInstance(createInitialState(DEFAULT_FDC3_USER_CHANNELS), {
        instanceId: connectedSenderId,
        appId,
        metadata: { appId, name: appId },
      }),
      connectedSenderId,
      AppInstanceState.CONNECTED
    )
    const initialState = addPendingOpenWithContext(
      connectInstance(withConnected, {
        instanceId: pendingTargetId,
        appId,
        metadata: { appId, name: appId },
      }),
      pendingTargetId,
      {
        message: openRequest,
        appIdentifier: { appId, instanceId: pendingTargetId },
        launchContext: openRequest.payload.context!,
        sourceInstanceId: "conformance-1",
      }
    )

    const { context } = createDACPTestContext({
      instanceId: connectedSenderId,
      initialState,
    })

    const message = {
      type: "broadcastRequest",
      meta: {
        requestUuid: "window-closed-broadcast",
        timestamp: new Date(),
        source: { appId, instanceId: connectedSenderId },
      },
      payload: {
        channelId: "app-control",
        context: { type: "windowClosed", testId: "teardown-1" },
      },
    } as BrowserTypes.BroadcastRequest

    expect(resolveDacpHandlerInstanceId(message, context)).toBe(connectedSenderId)
  })

  it("does not guess a stale source id when multiple connected instances share the appId", () => {
    const staleInstanceId = "stale-conformance-instance"
    const appId = "Conformance1"
    const withFirst = updateInstanceState(
      connectInstance(createInitialState(DEFAULT_FDC3_USER_CHANNELS), {
        instanceId: "live-conformance-one",
        appId,
        metadata: { appId, name: appId },
      }),
      "live-conformance-one",
      AppInstanceState.CONNECTED
    )
    const initialState = updateInstanceState(
      connectInstance(withFirst, {
        instanceId: "live-conformance-two",
        appId,
        metadata: { appId, name: appId },
      }),
      "live-conformance-two",
      AppInstanceState.CONNECTED
    )

    const { context } = createDACPTestContext({
      instanceId: staleInstanceId,
      initialState,
    })

    const message = {
      type: "addContextListenerRequest",
      meta: {
        requestUuid: "listener-ambiguous-stale-source",
        timestamp: new Date(),
        source: { appId, instanceId: staleInstanceId },
      },
      payload: { channelId: "app-control", contextType: "windowClosed" },
    } as BrowserTypes.AddContextListenerRequest

    expect(resolveDacpHandlerInstanceId(message, context)).toBe(staleInstanceId)
  })
})
