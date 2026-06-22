import { describe, expect, it } from "vite-plus/test"
import type { BrowserTypes } from "@finos/fdc3"

import { MockTransport } from "../../../../../__tests__/utils/mock-transport"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../../default-user-channels"
import { createInitialState } from "../../../../state/initial-state"
import { addPendingIntent, connectInstance, updateInstanceState } from "../../../../state/mutators"
import { AppInstanceState } from "../../../../state/types"
import { createDACPTestContext, withResponseDispatcher } from "../../__tests__/test-context"
import type { AppProvidedIntentContextMetadata } from "../intent-result-metadata"
import { registerPendingIntentPromise } from "../intent-raise-shared"
import { attemptIntentDelivery } from "../intent-delivery-helpers"

type IntentEventMetadata = {
  source: { appId: string; instanceId?: string }
  timestamp: string
} & AppProvidedIntentContextMetadata

const APP_TRACE_ID = "intent-trace-456"
const APP_SIGNATURE = "intent-signature-value"
const APP_ANTI_REPLAY = "intent-anti-replay-nonce"
const APP_CUSTOM = { intentCustomKey: "intent-custom-value" }

type IntentEvent = BrowserTypes.AgentEventMessage & {
  type: "intentEvent"
  payload: {
    metadata?: IntentEventMetadata
  }
}

function findIntentEvent(transport: MockTransport): IntentEvent | undefined {
  return transport.sentMessages.find(
    (message): message is IntentEvent =>
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      (message as { type: string }).type === "intentEvent"
  )
}

describe("IntentContextMetadataWithAppMetadata on raise", () => {
  it("forwards app-provided traceId, signature, antiReplay, and custom on intentEvent ContextMetadata", () => {
    const transport = new MockTransport()
    let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
    state = connectInstance(state, {
      instanceId: "a1",
      appId: "App1",
      metadata: { appId: "App1", name: "App1" },
    })
    state = connectInstance(state, {
      instanceId: "b1",
      appId: "intent-b",
      metadata: { appId: "intent-b", name: "intent-b" },
    })
    state = updateInstanceState(state, "a1", AppInstanceState.CONNECTED)
    state = updateInstanceState(state, "b1", AppInstanceState.CONNECTED)

    const requestId = "raise-with-app-metadata"
    const raisedContext = {
      type: "testContextY",
      id: { value: "1" },
      metadata: {
        traceId: APP_TRACE_ID,
        signature: APP_SIGNATURE,
        antiReplay: APP_ANTI_REPLAY,
        custom: APP_CUSTOM,
      },
    }

    state = addPendingIntent(state, {
      requestId,
      intentName: "aTestingIntent",
      context: raisedContext,
      sourceInstanceId: "a1",
      targetInstanceId: "b1",
      targetAppId: "intent-b",
    })

    const { context } = createDACPTestContext({
      instanceId: "a1",
      initialState: state,
    })
    const handlerContext = withResponseDispatcher(context, transport)

    registerPendingIntentPromise(handlerContext, requestId, "raiseIntentRequest")
    attemptIntentDelivery(handlerContext, requestId, false)

    const intentEvent = findIntentEvent(transport)
    expect(intentEvent).toBeDefined()
    expect(intentEvent?.payload.metadata).toBeDefined()
    expect(intentEvent?.payload.metadata?.source).toEqual({
      appId: "App1",
      instanceId: "a1",
    })
    expect(typeof intentEvent?.payload.metadata?.timestamp).toBe("string")
    expect(intentEvent?.payload.metadata?.traceId).toBe(APP_TRACE_ID)
    expect(intentEvent?.payload.metadata?.signature).toBe(APP_SIGNATURE)
    expect(intentEvent?.payload.metadata?.antiReplay).toBe(APP_ANTI_REPLAY)
    expect(intentEvent?.payload.metadata?.custom).toEqual(APP_CUSTOM)
  })
})
