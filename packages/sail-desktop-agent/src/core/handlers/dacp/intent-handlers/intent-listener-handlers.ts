/**
 * Intent Listener Handlers
 *
 * Handlers for adding and removing intent listeners
 */

import { createDACPSuccessResponse } from "../../../dacp/dacp-message-creators"
import { generateEventUuid } from "../../../dacp/dacp-utils"
import { type DACPHandlerContext } from "../../types"
import { sendDACPResponse, sendDACPErrorResponse } from "../utils/dacp-response-utils"
import type { BrowserTypes } from "@finos/fdc3"
import { ResolveError } from "@finos/fdc3"
import { FDC3ResolveError, TargetInstanceUnavailableError } from "../../../errors/fdc3-errors"
import { getInstance } from "../../../state/selectors"
import { registerIntentListener, unregisterIntentListener } from "../../../state/mutators"
import { deliverPendingIntentsForListener } from "./intent-delivery-helpers"

export function handleAddIntentListener(
  message: BrowserTypes.AddIntentListenerRequest,
  context: DACPHandlerContext
): void {
  const { responses, instanceId, getState, setState, logger } = context

  try {
    const payload = message.payload
    const instance = getInstance(getState(), instanceId)

    if (!instance) {
      throw new TargetInstanceUnavailableError(
        `Instance ${instanceId} not found for adding intent listener`
      )
    }

    const listenerId = generateEventUuid()

    setState(state =>
      registerIntentListener(state, {
        listenerId,
        intentName: payload.intent,
        instanceId,
        appId: instance.appId,
        contextTypes: [],
      })
    )

    const response = createDACPSuccessResponse(message, "addIntentListenerResponse", {
      listenerUUID: listenerId,
    })

    sendDACPResponse({ response, instanceId, responses })

    deliverPendingIntentsForListener(context, payload.intent)
  } catch (error) {
    logger.error("DACP: Add intent listener failed", error)

    // Use ResolveError for intent listener errors (AddIntentListenerResponse validates ResolveError enum values)
    const errorType = error instanceof FDC3ResolveError ? error.errorType : ResolveError.ApiTimeout
    const errorMessage = error instanceof Error ? error.message : "Failed to add intent listener"

    sendDACPErrorResponse({
      message,
      errorType,
      errorMessage,
      instanceId,
      responses,
    })
  }
}

export function handleIntentListenerUnsubscribe(
  message: BrowserTypes.IntentListenerUnsubscribeRequest,
  context: DACPHandlerContext
): void {
  const { responses, instanceId, getState, setState, logger } = context

  try {
    const { listenerUUID } = message.payload

    // Check if listener exists before removing
    const state = getState()
    const listener = state.intents.listeners[listenerUUID]
    if (!listener) {
      throw new TargetInstanceUnavailableError(`Intent listener ${listenerUUID} not found`)
    }

    setState(state => unregisterIntentListener(state, listenerUUID))

    const response = createDACPSuccessResponse(message, "intentListenerUnsubscribeResponse")
    sendDACPResponse({ response, instanceId, responses })
  } catch (error) {
    logger.error("DACP: Intent listener unsubscribe failed", error)

    // Use ResolveError for intent listener errors
    const errorType = error instanceof FDC3ResolveError ? error.errorType : ResolveError.ApiTimeout
    const errorMessage =
      error instanceof Error ? error.message : "Failed to unsubscribe intent listener"

    sendDACPErrorResponse({
      message,
      errorType,
      errorMessage,
      instanceId,
      responses,
    })
  }
}
