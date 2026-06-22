import { resolveLinkedInstanceId } from "../../../state/selectors/wcp-handshake-routing"
import type { DACPHandlerContext } from "../../types"
import { getInstance } from "../../../state/selectors"
import { AppInstanceState } from "../../../state/types"

type MessageWithDacpInstanceMeta = {
  meta?: {
    hostInstanceId?: string
    source?: { appId?: string; instanceId?: string }
  }
}

/**
 * Resolve the agent instance bucket for DACP handlers during WCP handshake.
 *
 * MessagePort routing may still use a temp id while fdc3.open pre-registers a PENDING
 * instance on the host launcher / iframe name. Prefer the host launcher id when present.
 */
export function resolveDacpHandlerInstanceId(
  message: MessageWithDacpInstanceMeta,
  context: DACPHandlerContext
): string {
  const { instanceId, getState } = context
  const state = getState()
  const hostInstanceId = message.meta?.hostInstanceId

  if (hostInstanceId && getInstance(state, hostInstanceId)) {
    return hostInstanceId
  }

  // Prefer the MessagePort-routed instance when it is already registered. Pending
  // open-with-context targets are for a *different* instance awaiting a listener;
  // redirecting here breaks broadcastResponse routing back to the connected sender
  // (orphan tabs accumulate when windowClosed broadcasts time out).
  if (getInstance(state, instanceId)) {
    return instanceId
  }

  const sourceAppId = message.meta?.source?.appId
  const pendingHostInstanceId = findPendingOpenWithContextHostInstanceId(
    state,
    sourceAppId,
    instanceId
  )
  if (pendingHostInstanceId) {
    return pendingHostInstanceId
  }

  const linkedInstanceId = resolveLinkedInstanceId(state, instanceId)
  if (linkedInstanceId && getInstance(state, linkedInstanceId)) {
    return linkedInstanceId
  }

  if (sourceAppId) {
    const connectedInstancesForSourceApp = Object.values(state.instances).filter(
      instance =>
        instance.appId === sourceAppId &&
        instance.state === AppInstanceState.CONNECTED &&
        instance.instanceId !== instanceId
    )
    if (connectedInstancesForSourceApp.length === 1) {
      return connectedInstancesForSourceApp[0].instanceId
    }

    const pendingHostInstance = Object.values(state.instances).find(
      instance =>
        instance.appId === sourceAppId &&
        instance.state === AppInstanceState.PENDING &&
        instance.instanceId !== instanceId
    )
    if (pendingHostInstance) {
      return pendingHostInstance.instanceId
    }
  }

  return instanceId
}

function findPendingOpenWithContextHostInstanceId(
  state: ReturnType<DACPHandlerContext["getState"]>,
  sourceAppId: string | undefined,
  routedInstanceId: string
): string | undefined {
  if (!sourceAppId) {
    return undefined
  }

  const pendingTargets = Object.entries(state.open.pendingWithContext).filter(
    ([targetInstanceId, pendingList]) =>
      pendingList.length > 0 &&
      targetInstanceId !== routedInstanceId &&
      state.instances[targetInstanceId]?.appId === sourceAppId
  )

  if (pendingTargets.length !== 1) {
    return undefined
  }

  return pendingTargets[0][0]
}
