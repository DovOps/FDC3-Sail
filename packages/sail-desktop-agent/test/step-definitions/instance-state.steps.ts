import { Then } from "@cucumber/cucumber"
import { CustomWorld } from "../world/index.ts"
import { getAppInstanceId } from "./generic.steps"
import {
  getActiveListenersForIntent,
  getInstance,
  getInstancesWithIntentListener,
} from "../../src/core/state/selectors"
import { AppInstanceState } from "../../src/core/state/types"

Then(
  "instance {string} does not expose a denormalized intent listener name list",
  function (this: CustomWorld, instanceId: string) {
    const instance = getInstance(this.getState(), instanceId)
    if (!instance) {
      throw new Error(`Expected instance ${instanceId} to exist`)
    }

    if (Object.prototype.hasOwnProperty.call(instance, "intentListeners")) {
      throw new Error(`Instance ${instanceId} must not carry a denormalized intentListeners field`)
    }
  }
)

Then(
  "intent discovery for {string} finds listener instance {string} from the global registry",
  function (this: CustomWorld, intentName: string, instanceId: string) {
    const state = this.getState()

    const registryListeners = getActiveListenersForIntent(state, intentName)
    const registryInstanceIds = registryListeners.map(listener => listener.instanceId)
    if (!registryInstanceIds.includes(instanceId)) {
      throw new Error(
        `Expected global registry to include listener for ${instanceId} on ${intentName}, got ${registryInstanceIds.join(", ")}`
      )
    }

    const instancesFromSelector = getInstancesWithIntentListener(state, intentName).map(
      entry => entry.instanceId
    )
    if (!instancesFromSelector.includes(instanceId)) {
      throw new Error(
        `Expected intent discovery to resolve ${instanceId} for ${intentName} from the global registry, got ${instancesFromSelector.join(", ")}`
      )
    }
  }
)

Then(
  "instance {string} is not present in agent state",
  function (this: CustomWorld, instanceId: string) {
    const resolvedId = getAppInstanceId(this, instanceId)
    const instance = getInstance(this.getState(), resolvedId)
    if (instance !== undefined) {
      throw new Error(
        `Expected instance ${resolvedId} to be absent after disconnect, but found state ${instance.state}`
      )
    }
  }
)

Then(
  "no app instance has lifecycle state {string}",
  function (this: CustomWorld, stateName: string) {
    const normalized = stateName.toLowerCase()
    const instances = Object.values(this.getState().instances)
    const matches = instances.filter(instance => String(instance.state) === normalized)

    if (matches.length > 0) {
      throw new Error(
        `Expected no instances with lifecycle state ${stateName}, found ${matches.map(entry => entry.instanceId).join(", ")}`
      )
    }

    if (
      normalized === "terminated" &&
      Object.prototype.hasOwnProperty.call(AppInstanceState, "TERMINATED")
    ) {
      throw new Error(
        "AppInstanceState must not define TERMINATED once Option A lifecycle is enforced"
      )
    }
  }
)
