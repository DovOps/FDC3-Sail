import { describe, expect, it } from "vite-plus/test"

import { MockTransport } from "../../../../../__tests__/utils/mock-transport"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../../default-user-channels"
import { createInitialState } from "../../../../state/initial-state"
import {
  addPendingIntent,
  connectInstance,
  registerIntentListener,
  updateInstanceState,
} from "../../../../state/mutators"
import { AppInstanceState } from "../../../../state/types"
import { createDACPTestContext, withResponseDispatcher } from "../../__tests__/test-context"
import { registerPendingIntentPromise } from "../intent-raise-shared"
import { attemptIntentDelivery, deliverPendingIntentsForListener } from "../intent-delivery-helpers"
import { handleIntentResultRequest } from "../intent-result-handlers"

describe("deliverPendingIntentsForListener retargeting", () => {
  it("does not retarget pending intent after delivery when another instance adds a listener", () => {
    const transport = new MockTransport()
    let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
    state = connectInstance(state, {
      instanceId: "source-1",
      appId: "Conformance1",
      metadata: { appId: "Conformance1", name: "Conformance1" },
    })
    state = connectInstance(state, {
      instanceId: "target-delivered",
      appId: "MockAppId",
      metadata: { appId: "MockAppId", name: "MockAppId" },
    })
    state = connectInstance(state, {
      instanceId: "target-stale",
      appId: "MockAppId",
      metadata: { appId: "MockAppId", name: "MockAppId" },
    })
    state = updateInstanceState(state, "source-1", AppInstanceState.CONNECTED)
    state = updateInstanceState(state, "target-delivered", AppInstanceState.CONNECTED)
    state = updateInstanceState(state, "target-stale", AppInstanceState.CONNECTED)

    const requestId = "raise-after-delivery"
    state = addPendingIntent(state, {
      requestId,
      intentName: "aTestingIntent",
      context: { type: "testContextY", id: { value: "1" } },
      sourceInstanceId: "source-1",
      targetInstanceId: "target-delivered",
      targetAppId: "MockAppId",
    })
    state = registerIntentListener(state, {
      listenerId: "listener-delivered",
      intentName: "aTestingIntent",
      instanceId: "target-delivered",
      appId: "MockAppId",
      contextTypes: [],
    })

    const pendingIntentPromises = new Map<
      string,
      {
        resolve: () => void
        reject: () => void
        delivered?: boolean
        requestType?: "raiseIntentRequest"
      }
    >()

    const { context, getState } = createDACPTestContext({
      instanceId: "target-delivered",
      initialState: state,
      pendingIntentPromises,
    })
    const handlerContext = withResponseDispatcher(context, transport)

    registerPendingIntentPromise(handlerContext, requestId, "raiseIntentRequest")
    expect(attemptIntentDelivery(handlerContext, requestId, false)).toBe(true)

    state = registerIntentListener(getState(), {
      listenerId: "listener-stale",
      intentName: "aTestingIntent",
      instanceId: "target-stale",
      appId: "MockAppId",
      contextTypes: [],
    })

    deliverPendingIntentsForListener(
      { ...handlerContext, instanceId: "target-stale" },
      "aTestingIntent"
    )

    expect(getState().intents.pending[requestId]?.targetInstanceId).toBe("target-delivered")

    handleIntentResultRequest(
      {
        type: "intentResultRequest",
        meta: {
          requestUuid: "result-1",
          timestamp: new Date(),
          source: { appId: "MockAppId", instanceId: "target-delivered" },
        },
        payload: {
          raiseIntentRequestUuid: requestId,
          intentEventUuid: "event-1",
          intentResult: { context: { type: "testContextY", id: { value: "1" } } },
        },
      },
      { ...handlerContext, instanceId: "target-delivered" }
    )

    expect(
      transport.sentMessages.some(
        (message): message is { type: string } =>
          typeof message === "object" &&
          message !== null &&
          "type" in message &&
          (message as { type: string }).type === "raiseIntentResultResponse"
      )
    ).toBe(true)
  })
})
