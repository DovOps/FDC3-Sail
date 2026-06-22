import { When } from "@cucumber/cucumber"
import { CustomWorld } from "../world/index.ts"
import { getAppInstanceId } from "./generic.steps"

function resolveCanonicalInstanceId(world: CustomWorld, appStr: string): string {
  const connectionId = getAppInstanceId(world, appStr)
  return world.mockTransport.resolveWcp5InstanceId(connectionId)
}

When("{string} disconnects from the DA", function (this: CustomWorld, appStr: string) {
  const connectionId = getAppInstanceId(this, appStr)
  const canonicalId = resolveCanonicalInstanceId(this, appStr)
  // Production teardown runs on the WCP5 instance; launch-time keys may still use the connection id.
  this.desktopAgent.disconnectInstance(canonicalId)
  if (canonicalId !== connectionId) {
    this.desktopAgent.disconnectInstance(connectionId)
  }
})
