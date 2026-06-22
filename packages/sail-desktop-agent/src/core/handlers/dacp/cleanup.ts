import {
  resolvePendingIntent,
  removeListenersForInstance,
  removeInstance,
} from "../../state/mutators"
import { type DACPHandlerContext } from "../types"
import * as eventHandlers from "./event-handlers"
import * as privateChannelHandlers from "./private-channel-handlers"
import { resolveLinkedInstanceId } from "../../state/selectors/wcp-handshake-routing"
import { clearHandshakeRoutingIdsForInstance } from "../../state/mutators/wcp-handshake-routing"
import { getActiveHeartbeatInstanceIds, stopHeartbeat } from "./heartbeat-runtime"
import {
  clearPendingOpenWithContextForInstance,
  clearPendingOpenWithContextForSourceInstance,
} from "./utils/open-with-context"
import { pruneInstanceIdentity } from "./instance-identity-registry"
import type { AgentState } from "../../state/types"

/**
 * WCP4 validation runs under a temp connection id while heartbeat and instance state
 * use the canonical WCP5 instanceId (see wcp-handlers startHeartbeat call).
 */
function resolveCleanupInstanceId(context: DACPHandlerContext): string {
  const { instanceId, getState } = context
  const state = getState()

  if (state.heartbeats[instanceId] || getActiveHeartbeatInstanceIds().includes(instanceId)) {
    return instanceId
  }

  if (instanceId.startsWith("temp-")) {
    const linkedInstanceId = resolveLinkedInstanceId(state, instanceId)
    if (
      linkedInstanceId &&
      (state.heartbeats[linkedInstanceId] ||
        getActiveHeartbeatInstanceIds().includes(linkedInstanceId) ||
        state.instances[linkedInstanceId])
    ) {
      return linkedInstanceId
    }
  }

  return instanceId
}

function instanceHasCleanupWork(state: AgentState, instanceId: string): boolean {
  if (state.instances[instanceId] || state.heartbeats[instanceId]) {
    return true
  }

  if (getActiveHeartbeatInstanceIds().includes(instanceId)) {
    return true
  }

  if ((state.open.pendingWithContext[instanceId]?.length ?? 0) > 0) {
    return true
  }

  return Object.values(state.intents.pending).some(
    pending => pending.targetInstanceId === instanceId || pending.sourceInstanceId === instanceId
  )
}

/**
 * Cleanup when a DACP connection is closed, heartbeat times out, or the app sends WCP6Goodbye.
 * Kept in a leaf module so callers (heartbeat-handlers, wcp-handlers, desktop-agent) do not
 * import the DACP router `index.ts`, avoiding circular module graphs.
 */
export function cleanupDACPHandlers(context: DACPHandlerContext): void {
  const resolvedContext = {
    ...context,
    instanceId: resolveCleanupInstanceId(context),
  }
  const { instanceId, getState, setState, logger } = resolvedContext

  if (!instanceHasCleanupWork(getState(), instanceId)) {
    logger.debug("Skipping cleanup for already-removed instance", { instanceId })
    return
  }

  logger.info("Cleaning up DACP handlers for instance", { instanceId })

  // Cancel any pending intents involving this instance (as source or target)
  const state = getState()
  const pendingIntents = Object.values(state.intents.pending).filter(
    p => p.targetInstanceId === instanceId || p.sourceInstanceId === instanceId
  )
  pendingIntents.forEach(pending => {
    // Reject promise if it exists (from intent-helpers Map)
    const promiseData = resolvedContext.pendingIntentPromises.get(pending.requestId)
    if (promiseData) {
      if (promiseData.timeoutHandle) {
        clearTimeout(promiseData.timeoutHandle)
      }
      if (promiseData.deliveryTimeoutHandle) {
        clearTimeout(promiseData.deliveryTimeoutHandle)
      }
      const disconnectRole = pending.sourceInstanceId === instanceId ? "source" : "target"
      promiseData.reject(new Error(`Intent cancelled - ${disconnectRole} instance disconnected`))
      resolvedContext.pendingIntentPromises.delete(pending.requestId)
    }
    setState(state => resolvePendingIntent(state, pending.requestId))
  })
  if (pendingIntents.length > 0) {
    logger.info(`Cancelled ${pendingIntents.length} pending intents for disconnected instance`, {
      instanceId,
    })
  }

  clearPendingOpenWithContextForInstance(instanceId, resolvedContext)
  clearPendingOpenWithContextForSourceInstance(instanceId, resolvedContext)

  // Remove event listeners
  eventHandlers.removeInstanceEventListeners(instanceId, setState)
  logger.info("Removed event listeners for disconnected instance", { instanceId })

  // Remove private channels
  const removedPrivateChannels =
    privateChannelHandlers.removeInstancePrivateChannels(resolvedContext)
  if (removedPrivateChannels > 0) {
    logger.info(`Removed ${removedPrivateChannels} private channels for disconnected instance`, {
      instanceId,
    })
  }

  // Stop heartbeat
  stopHeartbeat(instanceId, setState)

  setState(state => clearHandshakeRoutingIdsForInstance(state, instanceId))

  // Remove intent listeners
  setState(state => removeListenersForInstance(state, instanceId))

  // Remove instance from state
  setState(state => removeInstance(state, instanceId))

  pruneInstanceIdentity(resolvedContext.responses.edgeTransport, instanceId)

  logger.info("DACP handlers cleanup completed", { instanceId })
}
