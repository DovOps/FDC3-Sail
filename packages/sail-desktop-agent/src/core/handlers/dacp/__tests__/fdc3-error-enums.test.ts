import { describe, expect, it } from "vite-plus/test"
import type { Context } from "@finos/fdc3"
import { ChannelError, OpenError, ResolveError } from "@finos/fdc3"
import { MockTransport } from "../../../../__tests__/utils/mock-transport"
import { connectInstance, updateInstanceState } from "../../../state/mutators"
import { AppInstanceState } from "../../../state/types"
import { createInitialState } from "../../../state/initial-state"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../default-user-channels"
import {
  createDACPTestContext,
  createDacpRequestMeta,
  withResponseDispatcher,
} from "./test-context"
import { handleBroadcastRequest } from "../context-handlers"
import { handleContextListenerUnsubscribe } from "../context-handlers"
import { handleJoinUserChannelRequest } from "../channel-handlers"
import { handleCreatePrivateChannelRequest } from "../private-channel-handlers"
import { handleOpenRequest } from "../app-handlers"
import { handleAddIntentListener } from "../intent-handlers/intent-listener-handlers"

type ErrorResponseMessage = {
  type: string
  payload: { error: string }
}

function createConnectedHandlerContext(instanceId: string) {
  let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
  state = connectInstance(state, {
    instanceId,
    appId: "TestApp",
    metadata: { appId: "TestApp", name: "TestApp" },
  })
  state = updateInstanceState(state, instanceId, AppInstanceState.CONNECTED)

  const transport = new MockTransport()
  const { context } = createDACPTestContext({ instanceId, initialState: state })
  return { context: withResponseDispatcher(context, transport), transport }
}

function getLastErrorPayload(transport: MockTransport): ErrorResponseMessage["payload"] {
  const last = transport.getLastMessage() as ErrorResponseMessage
  return last.payload
}

describe("DACP handler error responses use @finos/fdc3 enum values", () => {
  const cases: Array<{
    name: string
    expectedError: string
    invoke: () => void | Promise<void>
  }> = [
    {
      name: "broadcastRequest with invalid context",
      expectedError: ChannelError.MalformedContext,
      invoke: () => {
        const { context, transport } = createConnectedHandlerContext("a1")
        handleBroadcastRequest(
          {
            type: "broadcastRequest",
            meta: createDacpRequestMeta("broadcast-malformed"),
            payload: {
              channelId: "missing-channel",
              context: { bogus: true } as unknown as Context,
            },
          },
          context
        )
        expect(getLastErrorPayload(transport).error).toBe(ChannelError.MalformedContext)
      },
    },
    {
      name: "joinUserChannelRequest for missing channel",
      expectedError: ChannelError.NoChannelFound,
      invoke: () => {
        const { context, transport } = createConnectedHandlerContext("a1")
        handleJoinUserChannelRequest(
          {
            type: "joinUserChannelRequest",
            meta: createDacpRequestMeta("join-missing-channel"),
            payload: { channelId: "nonexistent-user-channel" },
          },
          context
        )
        expect(getLastErrorPayload(transport).error).toBe(ChannelError.NoChannelFound)
      },
    },
    {
      name: "broadcastRequest to missing channel",
      expectedError: ChannelError.NoChannelFound,
      invoke: () => {
        const { context, transport } = createConnectedHandlerContext("a1")
        handleBroadcastRequest(
          {
            type: "broadcastRequest",
            meta: createDacpRequestMeta("broadcast-missing-channel"),
            payload: {
              channelId: "nonexistent-app-channel",
              context: { type: "fdc3.instrument", id: { ticker: "AAPL" } },
            },
          },
          context
        )
        expect(getLastErrorPayload(transport).error).toBe(ChannelError.NoChannelFound)
      },
    },
    {
      name: "contextListenerUnsubscribe for unknown listener",
      expectedError: "ListenerNotFound",
      invoke: () => {
        const { context, transport } = createConnectedHandlerContext("a1")
        handleContextListenerUnsubscribe(
          {
            type: "contextListenerUnsubscribeRequest",
            meta: createDacpRequestMeta("unsub-unknown-listener"),
            payload: { listenerUUID: "unknown-listener-uuid" },
          },
          context
        )
        expect(getLastErrorPayload(transport).error).toBe("ListenerNotFound")
      },
    },
    {
      name: "createPrivateChannelRequest without connected instance",
      expectedError: ChannelError.CreationFailed,
      invoke: () => {
        const transport = new MockTransport()
        const { context } = createDACPTestContext({ instanceId: "disconnected-instance" })
        handleCreatePrivateChannelRequest(
          {
            type: "createPrivateChannelRequest",
            meta: createDacpRequestMeta("create-private-no-instance"),
            payload: {},
          },
          withResponseDispatcher(context, transport)
        )
        expect(getLastErrorPayload(transport).error).toBe(ChannelError.CreationFailed)
      },
    },
    {
      name: "openRequest without app launcher",
      expectedError: OpenError.ErrorOnLaunch,
      invoke: async () => {
        const { context, transport } = createConnectedHandlerContext("a1")
        await handleOpenRequest(
          {
            type: "openRequest",
            meta: createDacpRequestMeta("open-no-launcher"),
            payload: { app: { appId: "SomeApp" } },
          },
          context
        )
        expect(getLastErrorPayload(transport).error).toBe(OpenError.ErrorOnLaunch)
      },
    },
    {
      name: "addIntentListener for missing instance",
      expectedError: ResolveError.TargetInstanceUnavailable,
      invoke: () => {
        const transport = new MockTransport()
        const { context } = createDACPTestContext({ instanceId: "missing-instance" })
        handleAddIntentListener(
          {
            type: "addIntentListenerRequest",
            meta: createDacpRequestMeta("intent-listener-missing-instance"),
            payload: { intent: "ViewChart" },
          },
          withResponseDispatcher(context, transport)
        )
        expect(getLastErrorPayload(transport).error).toBe(ResolveError.TargetInstanceUnavailable)
      },
    },
  ]

  it.each(cases)("$name returns $expectedError", async ({ invoke }) => {
    await invoke()
  })
})
