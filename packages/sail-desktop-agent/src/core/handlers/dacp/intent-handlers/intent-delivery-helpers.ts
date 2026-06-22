import { ResolveError } from "@finos/fdc3"
import {
  createDACPErrorResponse,
  createDACPSuccessResponse,
  createIntentEvent,
} from "../../../dacp/dacp-message-creators"
import { sendDACPResponse } from "../utils/dacp-response-utils"
import { getInstance, getListenersForInstance, getPendingIntent } from "../../../state/selectors"
import { resolvePendingIntent, updatePendingIntentTarget } from "../../../state/mutators"
import type { DACPHandlerContext, IntentRequestType } from "../../types"
import { AppInstanceState } from "../../../state/types"
import {
  extractAppProvidedIntentContextMetadata,
  mergeIntentEventContextMetadata,
} from "./intent-result-metadata"

type IntentResponseType = "raiseIntentResponse" | "raiseIntentForContextResponse"

function getResponseTypeForRequest(requestType: IntentRequestType): IntentResponseType {
  return requestType === "raiseIntentForContextRequest"
    ? "raiseIntentForContextResponse"
    : "raiseIntentResponse"
}

export function isIntentListenerReady(
  context: DACPHandlerContext,
  instanceId: string,
  intentName: string
): boolean {
  const listeners = getListenersForInstance(context.getState(), instanceId).filter(
    listener => listener.intentName === intentName && listener.active
  )
  return listeners.length > 0
}

export function attemptIntentDelivery(
  context: DACPHandlerContext,
  requestId: string,
  requireListener: boolean
): boolean {
  const { getState, responses, logger } = context
  const pendingIntent = getPendingIntent(getState(), requestId)
  if (!pendingIntent) {
    return true
  }

  const deliveryEntry = context.pendingIntentPromises.get(requestId)
  if (deliveryEntry?.delivered) {
    return true
  }

  if (
    requireListener &&
    !isIntentListenerReady(context, pendingIntent.targetInstanceId, pendingIntent.intentName)
  ) {
    return false
  }

  const sourceInstance = getInstance(getState(), pendingIntent.sourceInstanceId)
  if (!sourceInstance) {
    logger.warn("DACP: Source instance not found for pending intent delivery", {
      requestId,
      sourceInstanceId: pendingIntent.sourceInstanceId,
    })
    return true
  }

  const targetInstance = getInstance(getState(), pendingIntent.targetInstanceId)
  if (
    !targetInstance ||
    (targetInstance.state !== AppInstanceState.PENDING &&
      targetInstance.state !== AppInstanceState.CONNECTED)
  ) {
    logger.warn("DACP: Target instance not ready for pending intent delivery", {
      requestId,
      targetInstanceId: pendingIntent.targetInstanceId,
    })
    return false
  }

  const intentEvent = createIntentEvent(
    pendingIntent.intentName,
    pendingIntent.context,
    requestId,
    {
      appId: sourceInstance.appId,
      instanceId: sourceInstance.instanceId,
    }
  )

  const appContextMetadata = extractAppProvidedIntentContextMetadata(pendingIntent.context)
  const intentEventPayload = intentEvent.payload as typeof intentEvent.payload & {
    metadata: Parameters<typeof mergeIntentEventContextMetadata>[0]
  }
  const payloadWithMergedMetadata = {
    ...intentEventPayload,
    metadata: mergeIntentEventContextMetadata(intentEventPayload.metadata, appContextMetadata),
  }

  responses.sendOutbound({
    ...intentEvent,
    payload: payloadWithMergedMetadata,
    meta: {
      ...intentEvent.meta,
      destination: { instanceId: pendingIntent.targetInstanceId },
    },
  })

  const requestType = deliveryEntry?.requestType ?? "raiseIntentRequest"
  const response = createDACPSuccessResponse(
    { type: requestType, meta: { requestUuid: requestId } },
    getResponseTypeForRequest(requestType),
    {
      intentResolution: {
        source: {
          appId: pendingIntent.targetAppId,
          instanceId: pendingIntent.targetInstanceId,
        },
        intent: pendingIntent.intentName,
      },
    }
  )

  sendDACPResponse({ response, instanceId: pendingIntent.sourceInstanceId, responses })

  if (deliveryEntry?.deliveryTimeoutHandle) {
    clearTimeout(deliveryEntry.deliveryTimeoutHandle)
  }
  if (deliveryEntry) {
    deliveryEntry.delivered = true
  }

  return true
}

export function queueIntentDelivery(
  context: DACPHandlerContext,
  requestId: string,
  requireListener: boolean
): void {
  const deliveryEntry = context.pendingIntentPromises.get(requestId)
  if (!deliveryEntry) {
    return
  }

  const delivered = attemptIntentDelivery(context, requestId, requireListener)
  if (delivered) {
    return
  }

  const timeoutHandle = setTimeout(() => {
    if (deliveryEntry.delivered) {
      return
    }
    const requestType = deliveryEntry.requestType ?? "raiseIntentRequest"
    const response = createDACPErrorResponse(
      { type: requestType, meta: { requestUuid: requestId } },
      ResolveError.IntentDeliveryFailed,
      getResponseTypeForRequest(requestType),
      "Intent listener not registered within timeout"
    )

    const pendingIntent = getPendingIntent(context.getState(), requestId)
    if (pendingIntent) {
      sendDACPResponse({
        response,
        instanceId: pendingIntent.sourceInstanceId,
        responses: context.responses,
      })
      context.setState(state => resolvePendingIntent(state, requestId))
    }

    deliveryEntry.delivered = true
  }, context.openContextListenerTimeoutMs)

  deliveryEntry.deliveryTimeoutHandle = timeoutHandle
}

export function deliverPendingIntentsForListener(
  context: DACPHandlerContext,
  intentName: string
): void {
  const listenerInstance = getInstance(context.getState(), context.instanceId)
  if (!listenerInstance) {
    return
  }

  const pendingIntents = Object.values(context.getState().intents.pending).filter(
    pending => pending.targetAppId === listenerInstance.appId && pending.intentName === intentName
  )

  pendingIntents.forEach(pending => {
    const deliveryEntry = context.pendingIntentPromises.get(pending.requestId)
    if (deliveryEntry?.delivered) {
      return
    }

    if (pending.targetInstanceId !== context.instanceId) {
      context.setState(state =>
        updatePendingIntentTarget(
          state,
          pending.requestId,
          context.instanceId,
          listenerInstance.appId
        )
      )
    }
    attemptIntentDelivery(context, pending.requestId, true)
  })
}
