import { describe, expect, it } from "vite-plus/test"
import type { BrowserTypes } from "@finos/fdc3"

import { MockTransport } from "../../../../__tests__/utils/mock-transport"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../default-user-channels"
import { createInitialState } from "../../../state/initial-state"
import {
  addContextListener,
  addPendingOpenWithContext,
  connectInstance,
  createAppChannel,
  updateInstanceState,
} from "../../../state/mutators"
import { AppInstanceState } from "../../../state/types"
import { createDACPTestContext, createDacpRequestMeta } from "./test-context"
import { withResponseDispatcher } from "./test-context"
import { handleBroadcastRequest } from "../context-handlers"

describe("handleBroadcastRequest stale instance routing", () => {
  it("resolves stale source instance id to the live connected instance for the same app", () => {
    const transport = new MockTransport()
    const staleInstanceId = "stale-conformance-instance"
    const liveInstanceId = "live-conformance-instance"
    const listenerInstanceId = "mock-app-instance"
    const appControlChannelId = "app-control"

    let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
    state = connectInstance(state, {
      instanceId: liveInstanceId,
      appId: "Conformance1",
      metadata: { appId: "Conformance1", name: "Conformance1" },
    })
    state = connectInstance(state, {
      instanceId: listenerInstanceId,
      appId: "MockAppId",
      metadata: { appId: "MockAppId", name: "MockAppId" },
    })
    state = updateInstanceState(state, liveInstanceId, AppInstanceState.CONNECTED)
    state = updateInstanceState(state, listenerInstanceId, AppInstanceState.CONNECTED)
    state = createAppChannel(state, appControlChannelId)
    state = addContextListener(
      state,
      listenerInstanceId,
      "close-listener",
      "closeWindow",
      appControlChannelId
    )

    const { context } = createDACPTestContext({
      instanceId: staleInstanceId,
      initialState: state,
    })

    handleBroadcastRequest(
      {
        type: "broadcastRequest",
        meta: createDacpRequestMeta("broadcast-close-window", {
          appId: "Conformance1",
          instanceId: staleInstanceId,
        }),
        payload: {
          channelId: appControlChannelId,
          context: { type: "closeWindow", testId: "close-1" },
        },
      },
      withResponseDispatcher(context, transport)
    )

    const response = transport.getLastMessage() as { type: string; payload?: { error?: string } }
    expect(response.type).toBe("broadcastResponse")
    expect(response.payload?.error).toBeUndefined()

    const broadcastEvent = transport.sentMessages.find(
      (message): message is { type: string; meta?: { destination?: { instanceId?: string } } } =>
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        (message as { type: string }).type === "broadcastEvent"
    )

    expect(broadcastEvent?.meta?.destination?.instanceId).toBe(listenerInstanceId)
  })

  it("returns broadcastResponse to the connected sender when another instance has pending open", () => {
    const transport = new MockTransport()
    const connectedSenderId = "connected-mock-instance"
    const pendingTargetId = "pending-mock-launch"
    const conformanceInstanceId = "conformance-1"
    const appControlChannelId = "app-control"
    const appId = "MockAppId"

    const openRequest = {
      type: "openRequest",
      meta: {
        requestUuid: "open-req-pending-other",
        timestamp: new Date(),
        source: { appId: "Conformance1", instanceId: conformanceInstanceId },
      },
      payload: {
        app: { appId, instanceId: pendingTargetId },
        context: { type: "fdc3.instrument", id: { ticker: "MSFT" } },
      },
    } as BrowserTypes.OpenRequest

    let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
    state = connectInstance(state, {
      instanceId: connectedSenderId,
      appId,
      metadata: { appId, name: appId },
    })
    state = updateInstanceState(state, connectedSenderId, AppInstanceState.CONNECTED)
    state = connectInstance(state, {
      instanceId: pendingTargetId,
      appId,
      metadata: { appId, name: appId },
    })
    state = createAppChannel(state, appControlChannelId)
    state = addPendingOpenWithContext(state, pendingTargetId, {
      message: openRequest,
      appIdentifier: { appId, instanceId: pendingTargetId },
      launchContext: openRequest.payload.context!,
      sourceInstanceId: conformanceInstanceId,
    })

    const { context } = createDACPTestContext({
      instanceId: connectedSenderId,
      initialState: state,
    })

    handleBroadcastRequest(
      {
        type: "broadcastRequest",
        meta: createDacpRequestMeta("window-closed-broadcast", {
          appId,
          instanceId: connectedSenderId,
        }),
        payload: {
          channelId: appControlChannelId,
          context: { type: "windowClosed", testId: "teardown-1" },
        },
      },
      withResponseDispatcher(context, transport)
    )

    const response = transport.getLastMessage() as {
      type: string
      meta?: { destination?: { instanceId?: string } }
      payload?: { error?: string }
    }
    expect(response.type).toBe("broadcastResponse")
    expect(response.payload?.error).toBeUndefined()
    expect(response.meta?.destination?.instanceId).toBe(connectedSenderId)
  })
})
