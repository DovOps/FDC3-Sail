import { describe, expect, it, vi } from "vite-plus/test"
import type { BrowserTypes } from "@finos/fdc3"

import { MockTransport } from "../../../../../__tests__/utils/mock-transport"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../../default-user-channels"
import { createInitialState } from "../../../../state/initial-state"
import { addPendingIntent, connectInstance, updateInstanceState } from "../../../../state/mutators"
import { AppInstanceState } from "../../../../state/types"
import {
  createDACPTestContext,
  createDacpRequestMeta,
  withResponseDispatcher,
} from "../../__tests__/test-context"
import type { PendingIntentPromiseEntry } from "../../../types"
import { handleIntentResultRequest } from "../intent-result-handlers"
import type { IntentResultContextMetadata } from "../intent-result-metadata"

type RaiseIntentResultResponse = BrowserTypes.AgentResponseMessage & {
  type: "raiseIntentResultResponse"
  payload: {
    intentResult?: BrowserTypes.IntentResult
    metadata?: IntentResultContextMetadata
    error?: string
  }
  meta: BrowserTypes.AgentResponseMessageMeta & {
    destination?: { instanceId: string }
  }
}

const BASE = {
  requestId: "ABC123",
  targetInstanceId: "l1",
  targetAppId: "PortfolioApp",
  sourceInstanceId: "a1",
  sourceAppId: "App1",
  handlerInstanceId: "l1",
} as const

function setupPendingIntentContext() {
  const pendingIntentPromises = new Map<string, PendingIntentPromiseEntry>()
  const resolve = vi.fn()
  pendingIntentPromises.set(BASE.requestId, {
    resolve,
    reject: vi.fn(),
    requestType: "raiseIntentRequest",
  })

  let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
  state = connectInstance(state, {
    instanceId: BASE.sourceInstanceId,
    appId: BASE.sourceAppId,
    metadata: { appId: BASE.sourceAppId, name: BASE.sourceAppId },
  })
  state = connectInstance(state, {
    instanceId: BASE.targetInstanceId,
    appId: BASE.targetAppId,
    metadata: { appId: BASE.targetAppId, name: BASE.targetAppId },
  })
  state = updateInstanceState(state, BASE.sourceInstanceId, AppInstanceState.CONNECTED)
  state = updateInstanceState(state, BASE.targetInstanceId, AppInstanceState.CONNECTED)
  state = addPendingIntent(state, {
    requestId: BASE.requestId,
    intentName: "ViewPortfolio",
    context: { type: "fdc3.portfolio" },
    sourceInstanceId: BASE.sourceInstanceId,
    targetInstanceId: BASE.targetInstanceId,
    targetAppId: BASE.targetAppId,
  })

  const { context } = createDACPTestContext({
    instanceId: BASE.handlerInstanceId,
    pendingIntentPromises,
    initialState: state,
  })

  const transport = new MockTransport()
  return {
    context: withResponseDispatcher(context, transport),
    transport,
    resolve,
  }
}

function findRaiseIntentResultResponse(
  transport: MockTransport
): RaiseIntentResultResponse | undefined {
  return transport.sentMessages.find(
    (message): message is RaiseIntentResultResponse =>
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      (message as { type: string }).type === "raiseIntentResultResponse"
  )
}

describe("handleIntentResultRequest", () => {
  it.each([
    {
      name: "context result",
      intentResult: { context: { type: "fdc3.portfolio" } },
    },
    {
      name: "channel result",
      intentResult: { channel: { id: "pc1", type: "app" as const } },
    },
    {
      name: "void result",
      intentResult: {},
    },
  ])("sends raiseIntentResultResponse with DA metadata for $name", ({ intentResult }) => {
    const { context, transport, resolve } = setupPendingIntentContext()

    handleIntentResultRequest(
      {
        type: "intentResultRequest",
        meta: createDacpRequestMeta("intent-result-req", {
          appId: BASE.targetAppId,
          instanceId: BASE.targetInstanceId,
        }),
        payload: {
          raiseIntentRequestUuid: BASE.requestId,
          intentEventUuid: "event-1",
          intentResult,
        },
      },
      context
    )

    const response = findRaiseIntentResultResponse(transport)
    expect(response).toBeDefined()
    expect(response?.meta.destination?.instanceId).toBe(BASE.sourceInstanceId)

    const metadata = response!.payload.metadata
    expect(metadata).toBeDefined()
    expect(metadata!.source).toEqual({
      appId: BASE.targetAppId,
      instanceId: BASE.targetInstanceId,
    })
    expect(typeof metadata!.timestamp).toBe("string")
    expect(Number.isNaN(Date.parse(metadata!.timestamp))).toBe(false)
    expect(metadata!.traceId).toEqual(expect.any(String))
    expect(metadata!.traceId.length).toBeGreaterThan(0)
    expect(resolve).toHaveBeenCalledOnce()
  })
})
