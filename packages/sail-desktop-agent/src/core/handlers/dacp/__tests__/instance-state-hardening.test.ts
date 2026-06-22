import { describe, expect, it } from "vite-plus/test"
import { MockTransport } from "../../../../__tests__/utils/mock-transport"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../default-user-channels"
import { createInitialState } from "../../../state/initial-state"
import { connectInstance, removeInstance, updateInstanceState } from "../../../state/mutators"
import {
  getActiveListenersForIntent,
  getInstance,
  getInstancesWithIntentListener,
} from "../../../state/selectors"
import { AppInstanceState } from "../../../state/types"
import { cleanupDACPHandlers } from "../cleanup"
import { handleAddIntentListener } from "../intent-handlers/intent-listener-handlers"
import { createDACPTestContext, createDacpRequestMeta } from "./test-context"
import { withResponseDispatcher } from "./test-context"

const INTENT_NAME = "ViewPortfolio"

function connectListenerInstance(instanceId: string) {
  let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
  state = connectInstance(state, {
    instanceId,
    appId: "PortfolioApp",
    metadata: { appId: "PortfolioApp", name: "PortfolioApp" },
  })
  return updateInstanceState(state, instanceId, AppInstanceState.CONNECTED)
}

function registerIntentViaDacp(
  instanceId: string,
  initialState = connectListenerInstance(instanceId)
) {
  const transport = new MockTransport()
  const { context, getState } = createDACPTestContext({ instanceId, initialState })

  handleAddIntentListener(
    {
      type: "addIntentListenerRequest",
      meta: createDacpRequestMeta("add-intent-listener-hardening"),
      payload: { intent: INTENT_NAME },
    },
    withResponseDispatcher(context, transport)
  )

  return { getState, transport }
}

describe("instance state hardening — intent listener discovery", () => {
  it("registers intent listeners in the global registry keyed by instance id", () => {
    const instanceId = "listener-instance"
    const { getState } = registerIntentViaDacp(instanceId)

    const listeners = getActiveListenersForIntent(getState(), INTENT_NAME)
    expect(listeners).toHaveLength(1)
    expect(listeners[0]?.instanceId).toBe(instanceId)
    expect(listeners[0]?.intentName).toBe(INTENT_NAME)
  })

  it("does not denormalize intent listener names onto the app instance record", () => {
    const instanceId = "listener-instance"
    const { getState } = registerIntentViaDacp(instanceId)

    const instance = getInstance(getState(), instanceId)
    expect(instance).toBeDefined()
    expect(Object.prototype.hasOwnProperty.call(instance, "intentListeners")).toBe(false)
  })

  it("finds instances with intent listeners via the global registry, not instance arrays", () => {
    const instanceId = "listener-instance"
    const { getState } = registerIntentViaDacp(instanceId)

    const instancesWithListener = getInstancesWithIntentListener(getState(), INTENT_NAME)
    expect(instancesWithListener.map(entry => entry.instanceId)).toContain(instanceId)
  })
})

describe("instance state hardening — disconnected instance presence", () => {
  it("removes disconnected instances from state instead of tombstoning them", () => {
    const instanceId = "disconnect-instance"
    const initialState = connectListenerInstance(instanceId)
    const { context, getState } = createDACPTestContext({ instanceId, initialState })

    expect(getInstance(getState(), instanceId)).toBeDefined()

    cleanupDACPHandlers(context)

    expect(getInstance(getState(), instanceId)).toBeUndefined()
    expect(getState().instances[instanceId]).toBeUndefined()
  })

  it("does not retain terminated lifecycle enum values on any instance record", () => {
    const instanceId = "removed-instance"
    let state = connectListenerInstance(instanceId)
    state = removeInstance(state, instanceId)

    const terminatedInstances = Object.values(state.instances).filter(
      instance => String(instance.state) === "terminated"
    )
    expect(terminatedInstances).toHaveLength(0)
    expect(Object.prototype.hasOwnProperty.call(AppInstanceState, "TERMINATED")).toBe(false)
  })
})
