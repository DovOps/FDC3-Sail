import { DataTable, Given, Then, When } from "@cucumber/cucumber"
import { CustomWorld } from "../world/index.ts"
import type {
  AddEventListenerRequest,
  HeartbeatAcknowledgementRequest,
  WebConnectionProtocol6Goodbye,
} from "@finos/fdc3-schema/dist/generated/api/BrowserTypes"
import { createMeta, getAppInstanceId } from "./generic.steps"
import { matchDataSubset } from "../support/testing-utils"
import { AppInstanceState } from "../../src/core/state/types"
import { getInstance, getEventListenersForInstance } from "../../src/core/state/selectors"
import { connectInstance, updateInstanceState } from "../../src/core/state/mutators"

/** WCP5 may replace the connection id; assertions and DACP meta must use the canonical id. */
function resolveCanonicalInstanceId(world: CustomWorld, appStr: string): string {
  const connectionId = getAppInstanceId(world, appStr)
  return world.mockTransport.resolveWcp5InstanceId(connectionId)
}

/**
 * Test fixture helper: Ensures an app instance exists before sending heartbeat/goodbye messages.
 *
 * This simulates an app that has already connected via WCP protocol.
 * In real scenarios, apps connect via WCP4ValidateAppIdentity before sending DACP messages.
 * For tests, we directly create the instance to set up the test fixture.
 *
 * @param world - The Cucumber world context
 * @param appStr - The app identifier string
 * @returns The instanceId that was created or already existed
 */
function ensureAppInstanceForTesting(world: CustomWorld, appStr: string): string {
  const instanceId = resolveCanonicalInstanceId(world, appStr)

  const state = world.getState()
  const instance = getInstance(state, instanceId)
  if (!instance) {
    const meta = createMeta(world, appStr)
    meta.source.instanceId = instanceId
    // Test fixture setup: Create connected instance directly
    world.updateState(currentState =>
      updateInstanceState(
        connectInstance(currentState, {
          instanceId,
          appId: meta.source.appId,
          metadata: {
            appId: meta.source.appId,
            name: meta.source.appId,
          },
        }),
        instanceId,
        AppInstanceState.CONNECTED
      )
    )
  }

  return instanceId
}

Given(
  "{string} sends a heartbeat response to eventUuid {string}",
  async function (this: CustomWorld, appStr: string, eventUuid: string) {
    // Test fixture setup: Ensure app instance exists
    ensureAppInstanceForTesting(this, appStr)
    const meta = createMeta(this, appStr)
    meta.source.instanceId = resolveCanonicalInstanceId(this, appStr)

    // Send DACP heartbeatAcknowledgementRequest message (this is what we're testing)
    const message: HeartbeatAcknowledgementRequest = {
      meta,
      payload: {
        heartbeatEventUuid: eventUuid,
      },
      type: "heartbeatAcknowledgementRequest",
    }

    await this.mockTransport.receiveMessage(message)
  }
)

Given("{string} sends a goodbye message", async function (this: CustomWorld, appStr: string) {
  // Test fixture setup: Ensure app instance exists
  ensureAppInstanceForTesting(this, appStr)
  const meta = createMeta(this, appStr)
  meta.source.instanceId = resolveCanonicalInstanceId(this, appStr)

  // Send DACP WCP6Goodbye message (this is what we're testing)
  const message: WebConnectionProtocol6Goodbye = {
    meta,
    type: "WCP6Goodbye",
  }

  await this.mockTransport.receiveMessage(message)
})

/**
 * After WCP4/WCP5, the Desktop Agent may assign a new instance id (see createAppInstance).
 * DACP from the app must use that id so heartbeat timeout cleanup matches event-listener state.
 */
When(
  "the WCP-validated instance for app {string} adds an event listener for {string} [fdc3.addEventListener]",
  async function (this: CustomWorld, appId: string, eventType: string) {
    const instanceId = this.mockTransport.lastWcp5ValidatedInstanceId
    if (!instanceId) {
      throw new Error(
        "No WCP5 validated instance id recorded; send WCP4 validate before this step."
      )
    }
    const desktopAgentName =
      this.desktopAgent.getImplementationMetadata()?.provider ?? "cucumber-provider"
    const meta = {
      requestUuid: this.createUUID(),
      timestamp: new Date(),
      source: {
        appId,
        instanceId,
        desktopAgent: desktopAgentName,
      },
    }

    const message: AddEventListenerRequest = {
      meta,
      payload: {
        type: eventType as AddEventListenerRequest["payload"]["type"],
      },
      type: "addEventListenerRequest",
    }

    await this.mockTransport.receiveMessage(message)
  }
)

Then("I test the liveness of {string}", function (this: CustomWorld, appStr: string) {
  const instanceId = resolveCanonicalInstanceId(this, appStr)

  // Assertion: Verify internal state of app instance
  // Note: This queries internal state directly to verify liveness tracking
  const state = this.getState()
  const instance = getInstance(state, instanceId)

  // Check if instance exists and is connected
  const out = !!instance && instance.state === AppInstanceState.CONNECTED
  this.props["result"] = out
})

Then("I get the heartbeat times", function (this: CustomWorld) {
  const state = this.getState()
  const instances = Object.values(state.instances)
  const result = instances.map(instance => ({
    instanceId: instance.instanceId,
    state: instance.state === AppInstanceState.CONNECTED ? "Connected" : "Disconnected",
  }))
  this.props["result"] = result
})

Then("no DA event listeners remain for {string}", function (this: CustomWorld, appStr: string) {
  const instanceId = getAppInstanceId(this, appStr)
  const remaining = getEventListenersForInstance(this.getState(), instanceId)
  if (remaining.length > 0) {
    throw new Error(
      `Expected no DA event listeners for ${instanceId}, but found: ${JSON.stringify(remaining)}`
    )
  }
})

Then("no DA event listeners remain for the WCP-validated instance", function (this: CustomWorld) {
  const instanceId = this.mockTransport.lastWcp5ValidatedInstanceId
  if (!instanceId) {
    throw new Error("No WCP5 validated instance id recorded; send WCP4 validate before this step.")
  }
  const remaining = getEventListenersForInstance(this.getState(), instanceId)
  if (remaining.length > 0) {
    throw new Error(
      `Expected no DA event listeners for WCP-validated instance ${instanceId}, but found: ${JSON.stringify(remaining)}`
    )
  }
})

Then(
  "messaging will have outgoing heartbeat events for the WCP-validated instance",
  function (this: CustomWorld, dataTable: DataTable) {
    const canonicalId = this.mockTransport.lastWcp5ValidatedInstanceId
    if (!canonicalId) {
      throw new Error(
        "No WCP5 validated instance id recorded; send WCP4 validate before this step."
      )
    }

    const headers = dataTable.raw()[0]
    const resolvedRows = dataTable.hashes().map(row => {
      const resolved = { ...row }
      if (headers.includes("to.instanceId")) {
        resolved["to.instanceId"] = canonicalId
      }
      return headers.map(column => resolved[column] ?? "")
    })
    const table = new DataTable([headers, ...resolvedRows])

    const allMessages = this.mockTransport.getPostedMessages()
    matchDataSubset(this, allMessages, table)
  }
)
