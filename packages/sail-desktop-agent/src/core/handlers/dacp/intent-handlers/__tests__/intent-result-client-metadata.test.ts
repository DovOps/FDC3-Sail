import { describe, expect, it, vi } from "vite-plus/test"
import type { BrowserTypes } from "@finos/fdc3"

import { MockTransport } from "../../../../../__tests__/utils/mock-transport"
import { createInMemoryTransportPair } from "../../../../../transports/in-memory-transport"
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
    intentResult?: BrowserTypes.IntentResult & {
      metadata?: IntentResultContextMetadata
    }
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

/**
 * FDC3 client IntentResolution.getResultMetadata() reads result metadata from the
 * intentResult object on raiseIntentResultResponse (not only the sibling payload field).
 */
function readClientGetResultMetadata(
  response: RaiseIntentResultResponse
): IntentResultContextMetadata | undefined {
  return response.payload.intentResult?.metadata
}

describe("IntentResolution.getResultMetadata() client metadata path", () => {
  it.each([
    {
      toolboxScenario: "RaiseIntentVoidResultMetadata",
      intentResult: {},
    },
    {
      toolboxScenario: "RaiseIntentContextResultMetadata",
      intentResult: { context: { type: "testContextY", id: { value: "1" } } },
    },
    {
      toolboxScenario: "RaiseIntentChannelResultMetadata",
      intentResult: { channel: { id: "app-channel-1", type: "app" as const } },
    },
  ])(
    "$toolboxScenario exposes non-empty intentResult.metadata for client getResultMetadata()",
    ({ intentResult }) => {
      const { context, transport, resolve } = setupPendingIntentContext()

      handleIntentResultRequest(
        {
          type: "intentResultRequest",
          meta: createDacpRequestMeta("intent-result-client-metadata", {
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

      const clientMetadata = readClientGetResultMetadata(response!)
      expect(clientMetadata).toBeDefined()
      expect(clientMetadata?.source).toEqual({
        appId: BASE.targetAppId,
        instanceId: BASE.targetInstanceId,
      })
      expect(typeof clientMetadata?.timestamp).toBe("string")
      expect(Number.isNaN(Date.parse(clientMetadata!.timestamp))).toBe(false)
      expect(clientMetadata?.traceId).toEqual(expect.any(String))
      const traceId = clientMetadata?.traceId
      expect(typeof traceId).toBe("string")
      if (typeof traceId !== "string") {
        throw new Error("expected traceId string")
      }
      expect(traceId.length).toBeGreaterThan(0)

      expect(resolve).toHaveBeenCalledOnce()
      expect(resolve.mock.calls[0]?.[0]).not.toHaveProperty("metadata")
    }
  )

  it("RaiseIntentContextWithMetadataResult returns plain context on getResult() and merged metadata on getResultMetadata()", () => {
    const contextPayload = { type: "testContextY", id: { value: "1" } }
    const appSignature = "conformance-signature"
    const appCustom = { conformanceKey: "value" }
    const { context, transport, resolve } = setupPendingIntentContext()

    handleIntentResultRequest(
      {
        type: "intentResultRequest",
        meta: createDacpRequestMeta("intent-result-context-with-metadata", {
          appId: BASE.targetAppId,
          instanceId: BASE.targetInstanceId,
        }),
        payload: {
          raiseIntentRequestUuid: BASE.requestId,
          intentEventUuid: "event-1",
          intentResult: {
            context: contextPayload,
            metadata: {
              traceId: "app-trace-should-not-win",
              signature: appSignature,
              custom: appCustom,
            },
          } as unknown as BrowserTypes.IntentResult,
        },
      },
      context
    )

    const response = findRaiseIntentResultResponse(transport)
    expect(response).toBeDefined()
    expect(response?.payload.intentResult).toEqual({ context: contextPayload })
    expect(resolve).toHaveBeenCalledWith({ context: contextPayload })

    const clientMetadata = readClientGetResultMetadata(response!)
    expect(clientMetadata?.signature).toBe(appSignature)
    expect(clientMetadata?.custom).toEqual(appCustom)
    expect(clientMetadata?.traceId).toEqual(expect.any(String))
    expect(clientMetadata?.traceId).not.toBe("app-trace-should-not-win")
    const traceId = clientMetadata?.traceId
    expect(typeof traceId).toBe("string")
    if (typeof traceId !== "string") {
      throw new Error("expected traceId string")
    }
    expect(traceId.length).toBeGreaterThan(0)
  })

  it("raiseIntentResultResponse clones through InMemoryTransport without circular metadata refs", async () => {
    const { context, resolve } = setupPendingIntentContext()
    const [daTransport, peerTransport] = createInMemoryTransportPair()
    const received: unknown[] = []
    peerTransport.onMessage(message => {
      received.push(message)
    })

    handleIntentResultRequest(
      {
        type: "intentResultRequest",
        meta: createDacpRequestMeta("intent-result-inmemory-clone", {
          appId: BASE.targetAppId,
          instanceId: BASE.targetInstanceId,
        }),
        payload: {
          raiseIntentRequestUuid: BASE.requestId,
          intentEventUuid: "event-1",
          intentResult: { context: { type: "testContextY", id: { value: "1" } } },
        },
      },
      withResponseDispatcher(context, daTransport)
    )

    await vi.waitFor(() => {
      expect(received.length).toBeGreaterThanOrEqual(1)
    })

    const response = received.find(
      (message): message is RaiseIntentResultResponse =>
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        (message as { type: string }).type === "raiseIntentResultResponse"
    )
    expect(response).toBeDefined()
    expect(response!.payload.metadata).toBeDefined()
    expect(response!.payload.intentResult?.metadata).toBeDefined()
    expect(response!.payload.metadata).not.toBe(response!.payload.intentResult?.metadata)
    expect(readClientGetResultMetadata(response!)?.traceId).toEqual(expect.any(String))
    expect(resolve).toHaveBeenCalledOnce()
  })
})
