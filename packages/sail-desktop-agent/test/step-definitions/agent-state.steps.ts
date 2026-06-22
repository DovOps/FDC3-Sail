import { Then } from "@cucumber/cucumber"
import { CustomWorld } from "../world/index.ts"
import { getAppInstanceId } from "./generic.steps"
import { getActiveHeartbeatTimerCount } from "../../src/core/handlers/dacp/heartbeat-runtime"
import { getPendingOpenWithContextTimeoutCount } from "../../src/core/handlers/dacp/utils/open-with-context"

Then("the agent has no pending intents", function (this: CustomWorld) {
  const pending = this.getState().intents.pending
  const keys = Object.keys(pending)
  if (keys.length > 0) {
    throw new Error(`Expected no pending intents, but found: ${JSON.stringify(pending, null, 2)}`)
  }
})

Then(
  "open-with-context pending is empty for instance {string}",
  function (this: CustomWorld, appRef: string) {
    const instanceId = getAppInstanceId(this, appRef)
    const pendingList = this.getState().open.pendingWithContext[instanceId]
    if (pendingList && pendingList.length > 0) {
      throw new Error(
        `Expected no open-with-context pending for ${instanceId}, found ${pendingList.length} entries`
      )
    }
  }
)

Then("no open-with-context timeouts are scheduled", function () {
  const count = getPendingOpenWithContextTimeoutCount()
  if (count > 0) {
    throw new Error(`Expected no open-with-context timeouts, but ${count} are scheduled`)
  }
})

Then("no heartbeat timers are active", function () {
  const count = getActiveHeartbeatTimerCount()
  if (count > 0) {
    throw new Error(`Expected no active heartbeat timers, but ${count} remain`)
  }
})
