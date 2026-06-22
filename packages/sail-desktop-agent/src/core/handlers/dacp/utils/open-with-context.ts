import type { BrowserTypes, Context } from "@finos/fdc3"
import { OpenError } from "@finos/fdc3"
import { createDACPEvent, createDACPSuccessResponse } from "../../../dacp/dacp-message-creators"
import { sendDACPResponse, sendDACPErrorResponse } from "./dacp-response-utils"
import type { DACPHandlerContext } from "../../types"
import { getInstance } from "../../../state/selectors"
import type { AgentState, PendingOpenWithContext } from "../../../state/types"
import {
  addPendingOpenWithContext,
  removePendingOpenWithContextByRequest,
  setPendingOpenWithContextForInstance,
} from "../../../state/mutators"

// Timeout handles are not serializable, so keep them separate from AgentState.
// Pending open-with-context requests themselves live in AgentState so they can be
// inspected/cleared alongside other agent state.
const pendingOpenWithContextTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

/** @internal Returns scheduled open-with-context timeout count (for tests). */
export function getPendingOpenWithContextTimeoutCount(): number {
  return pendingOpenWithContextTimeouts.size
}

/** @internal Clears all open-with-context timeouts (tests only). */
export function clearAllPendingOpenWithContextTimeoutsForTesting(): void {
  for (const handle of pendingOpenWithContextTimeouts.values()) {
    clearTimeout(handle)
  }
  pendingOpenWithContextTimeouts.clear()
}

export function registerOpenWithContext(
  message: BrowserTypes.OpenRequest,
  appIdentifier: BrowserTypes.AppIdentifier,
  launchContext: Context,
  context: DACPHandlerContext
): void {
  const { instanceId: sourceInstanceId, openContextListenerTimeoutMs } = context
  const targetInstanceId = appIdentifier.instanceId
  if (!targetInstanceId) {
    throw new Error("App identifier missing instanceId for open-with-context")
  }

  // Fast path: if the app already has a matching listener, deliver immediately.
  if (hasMatchingContextListener(targetInstanceId, launchContext.type, context)) {
    deliverOpenWithContext(message, appIdentifier, launchContext, context, sourceInstanceId)
    return
  }

  // Otherwise, store the request and time out if no listener appears.
  // The timeout triggers an AppTimeout error to the caller.
  const requestUuid = message.meta.requestUuid
  const timeoutHandle = setTimeout(() => {
    context.setState((state: AgentState) =>
      removePendingOpenWithContextByRequest(state, targetInstanceId, requestUuid)
    )
    pendingOpenWithContextTimeouts.delete(requestUuid)
    sendDACPErrorResponse({
      message,
      errorType: OpenError.AppTimeout,
      errorMessage: "Timed out waiting for context listener",
      instanceId: sourceInstanceId,
      responses: context.responses,
    })
  }, openContextListenerTimeoutMs)

  const pendingEntry: PendingOpenWithContext = {
    message,
    appIdentifier,
    launchContext,
    sourceInstanceId,
  }

  // Track the pending request in state; the timeout map is keyed by requestUuid.
  context.setState((state: AgentState) =>
    addPendingOpenWithContext(state, targetInstanceId, pendingEntry)
  )
  pendingOpenWithContextTimeouts.set(requestUuid, timeoutHandle)
}

export function notifyContextListenerAdded(
  instanceId: string,
  contextType: string,
  context: DACPHandlerContext
): void {
  // Called when an instance adds a context listener; resolve any pending opens.
  const state: AgentState = context.getState()
  const pendingList = state.open.pendingWithContext[instanceId]
  if (!pendingList || pendingList.length === 0) {
    return
  }

  // A listener for "*" matches any pending context type.
  const { matched, remaining } = partitionPending(pendingList, contextType)
  if (matched.length === 0) {
    return
  }

  context.setState((state: AgentState) =>
    setPendingOpenWithContextForInstance(state, instanceId, remaining)
  )

  matched.forEach(pending => {
    clearPendingTimeout(pending.message.meta.requestUuid)
    deliverOpenWithContext(
      pending.message,
      pending.appIdentifier,
      pending.launchContext,
      context,
      pending.sourceInstanceId
    )
  })
}

function partitionPending(
  pendingList: PendingOpenWithContext[],
  contextType: string
): { matched: PendingOpenWithContext[]; remaining: PendingOpenWithContext[] } {
  const matched: PendingOpenWithContext[] = []
  const remaining: PendingOpenWithContext[] = []

  pendingList.forEach(pending => {
    const matches = contextType === "*" || pending.launchContext.type === contextType
    if (matches) {
      matched.push(pending)
    } else {
      remaining.push(pending)
    }
  })

  return { matched, remaining }
}

function clearPendingTimeout(requestUuid: string): void {
  const timeoutHandle = pendingOpenWithContextTimeouts.get(requestUuid)
  if (!timeoutHandle) {
    return
  }
  clearTimeout(timeoutHandle)
  pendingOpenWithContextTimeouts.delete(requestUuid)
}

/**
 * Clears all open-with-context pending entries and module timeouts when the
 * target instance disconnects (invoked from cleanupDACPHandlers).
 */
export function clearPendingOpenWithContextForInstance(
  targetInstanceId: string,
  context: DACPHandlerContext
): void {
  const pendingList = context.getState().open.pendingWithContext[targetInstanceId]
  if (!pendingList || pendingList.length === 0) {
    return
  }

  pendingList.forEach(pending => {
    clearPendingTimeout(pending.message.meta.requestUuid)
  })
  context.setState(state => setPendingOpenWithContextForInstance(state, targetInstanceId, []))
}

/**
 * Clears open-with-context pending entries whose source disconnected.
 * Scans all target buckets; does not send an error response to the gone source.
 */
export function clearPendingOpenWithContextForSourceInstance(
  sourceInstanceId: string,
  context: DACPHandlerContext
): void {
  const pendingByInstance = context.getState().open.pendingWithContext
  const bucketsToUpdate: Array<{ targetInstanceId: string; remaining: PendingOpenWithContext[] }> =
    []

  for (const [targetInstanceId, pendingList] of Object.entries(pendingByInstance)) {
    const toRemove = pendingList.filter(pending => pending.sourceInstanceId === sourceInstanceId)
    if (toRemove.length === 0) {
      continue
    }

    toRemove.forEach(pending => {
      clearPendingTimeout(pending.message.meta.requestUuid)
    })
    bucketsToUpdate.push({
      targetInstanceId,
      remaining: pendingList.filter(pending => pending.sourceInstanceId !== sourceInstanceId),
    })
  }

  if (bucketsToUpdate.length === 0) {
    return
  }

  context.setState(state => {
    let nextState = state
    for (const { targetInstanceId, remaining } of bucketsToUpdate) {
      nextState = setPendingOpenWithContextForInstance(nextState, targetInstanceId, remaining)
    }
    return nextState
  })
}

function hasMatchingContextListener(
  targetInstanceId: string,
  contextType: string,
  context: DACPHandlerContext
): boolean {
  const instance = getInstance(context.getState(), targetInstanceId)
  if (!instance) {
    return false
  }

  // Each entry is a listener registration: { contextType, optional channelId } keyed by listener id.
  return Object.values(instance.contextListeners).some(
    listenerRegistration =>
      listenerRegistration.contextType === contextType || listenerRegistration.contextType === "*"
  )
}

function deliverOpenWithContext(
  message: BrowserTypes.OpenRequest,
  appIdentifier: BrowserTypes.AppIdentifier,
  launchContext: Context,
  context: DACPHandlerContext,
  sourceInstanceId: string
): void {
  // "Open with context" is modeled as a broadcast to the target instance,
  // then the original openRequest is completed with openResponse.
  const callerInstance = getInstance(context.getState(), sourceInstanceId)
  const broadcastEvent = createDACPEvent("broadcastEvent", {
    channelId: null,
    context: launchContext,
    originatingApp: {
      appId: callerInstance?.appId ?? "unknown",
      instanceId: sourceInstanceId,
    },
  })

  const broadcastEventWithRouting = {
    ...broadcastEvent,
    meta: {
      ...broadcastEvent.meta,
      destination: { instanceId: appIdentifier.instanceId },
    },
  }

  context.responses.sendOutbound(broadcastEventWithRouting)

  const response = createDACPSuccessResponse(message, "openResponse", {
    appIdentifier,
  })

  sendDACPResponse({
    response,
    instanceId: sourceInstanceId,
    responses: context.responses,
  })
}
