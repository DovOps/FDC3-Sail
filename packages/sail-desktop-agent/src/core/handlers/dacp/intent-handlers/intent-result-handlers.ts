/**
 * Intent Result Handlers
 *
 * Handlers for processing intent results. When the handler returns nothing
 * (intentResult null) or signals rejection (intentResult.error), the DA sends
 * raiseIntentResultResponse with ResultError so IntentResolution.getResult() rejects.
 */

import {
  createDACPSuccessResponse,
  createDACPErrorResponse,
} from "../../../dacp/dacp-message-creators"
import { type DACPHandlerContext } from "../../types"
import { sendDACPResponse, sendDACPErrorResponse } from "../utils/dacp-response-utils"
import type { BrowserTypes } from "@finos/fdc3"
import { ResultError, ResolveError } from "@finos/fdc3"
import { getInstance, getPendingIntent } from "../../../state/selectors"
import { resolvePendingIntent } from "../../../state/mutators"
import {
  buildIntentResultWirePayload,
  attachIntentResultClientMetadata,
  cloneIntentResultContextMetadata,
} from "./intent-result-metadata"
import { resolveDacpHandlerInstanceId } from "../utils/resolve-context-listener-instance-id"

function isHandlerRejection(intentResult: unknown): boolean {
  return (
    typeof intentResult === "object" &&
    intentResult !== null &&
    "error" in intentResult &&
    (intentResult as { error: string }).error === "IntentHandlerRejected"
  )
}

export function handleIntentResultRequest(
  message: BrowserTypes.IntentResultRequest,
  context: DACPHandlerContext
): void {
  const { responses, instanceId, getState, setState, logger } = context

  try {
    const payload = message.payload

    logger.info("DACP: Processing intent result request", {
      requestUuid: message.meta.requestUuid,
      raiseIntentRequestUuid: payload.raiseIntentRequestUuid,
    })

    const originalRequestId = payload.raiseIntentRequestUuid
    const state = getState()
    const pendingIntent = getPendingIntent(state, originalRequestId)

    if (!pendingIntent) {
      throw new Error(`No pending intent found for request: ${originalRequestId}`)
    }

    const resolvedInstanceId = resolveDacpHandlerInstanceId(message, context)
    if (pendingIntent.targetInstanceId !== resolvedInstanceId) {
      throw new Error(
        `Intent result from wrong instance. Expected ${pendingIntent.targetInstanceId}, got ${resolvedInstanceId}`
      )
    }

    const intentResult = payload.intentResult
    const sourceInstanceId = pendingIntent.sourceInstanceId
    const resultTimestamp = new Date().toISOString()

    const promiseData = context.pendingIntentPromises.get(originalRequestId)
    let wireIntentResult: BrowserTypes.IntentResult = intentResult
    let resultMetadata:
      | ReturnType<typeof buildIntentResultWirePayload>["resultMetadata"]
      | undefined = undefined
    let isContextWithMetadata = false

    if (promiseData) {
      if (promiseData.timeoutHandle) {
        clearTimeout(promiseData.timeoutHandle)
      }

      if (intentResult !== null && !isHandlerRejection(intentResult)) {
        const normalized = buildIntentResultWirePayload(
          intentResult,
          pendingIntent.targetAppId,
          pendingIntent.targetInstanceId,
          resultTimestamp
        )
        wireIntentResult = normalized.wireIntentResult
        resultMetadata = normalized.resultMetadata
        isContextWithMetadata = normalized.isContextWithMetadata
      }

      promiseData.resolve(wireIntentResult)
      context.pendingIntentPromises.delete(originalRequestId)
    }

    setState(state => resolvePendingIntent(state, originalRequestId))

    const response = createDACPSuccessResponse(message, "intentResultResponse")
    sendDACPResponse({ response, instanceId, responses })

    const sourceInstance = getInstance(getState(), sourceInstanceId)
    if (!sourceInstance) {
      logger.warn("DACP: Source instance not found for intent result delivery", {
        originalRequestId,
        sourceInstanceId,
      })
      return
    }

    const raiseIntentRequestLike = {
      type: "raiseIntentRequest" as const,
      meta: { requestUuid: originalRequestId },
    }

    if (intentResult === null) {
      const resultErrorResponse = createDACPErrorResponse(
        raiseIntentRequestLike,
        ResultError.NoResultReturned,
        "raiseIntentResultResponse"
      )
      sendDACPResponse({
        response: resultErrorResponse,
        instanceId: sourceInstanceId,
        responses,
      })
    } else if (isHandlerRejection(intentResult)) {
      const resultErrorResponse = createDACPErrorResponse(
        raiseIntentRequestLike,
        ResultError.IntentHandlerRejected,
        "raiseIntentResultResponse"
      )
      sendDACPResponse({
        response: resultErrorResponse,
        instanceId: sourceInstanceId,
        responses,
      })
    } else {
      let metadata = resultMetadata
      let contextWithMetadataFlag = isContextWithMetadata
      if (!metadata) {
        const built = buildIntentResultWirePayload(
          intentResult,
          pendingIntent.targetAppId,
          pendingIntent.targetInstanceId,
          resultTimestamp
        )
        metadata = built.resultMetadata
        contextWithMetadataFlag = built.isContextWithMetadata
      }

      const payloadMetadata = metadata
      const clientMetadata = cloneIntentResultContextMetadata(payloadMetadata)

      const intentResultForClient = attachIntentResultClientMetadata(
        wireIntentResult,
        clientMetadata,
        contextWithMetadataFlag
      )

      const resultResponse = createDACPSuccessResponse(
        raiseIntentRequestLike,
        "raiseIntentResultResponse",
        {
          intentResult: intentResultForClient,
          metadata: payloadMetadata,
        }
      )
      sendDACPResponse({
        response: resultResponse,
        instanceId: sourceInstanceId,
        responses,
      })
    }

    logger.info("DACP: Intent result processed successfully", {
      originalRequestId,
      hasResult: !!intentResult,
    })
  } catch (error) {
    logger.error("DACP: Intent result request failed", error)
    sendDACPErrorResponse({
      message,
      errorType: ResolveError.IntentDeliveryFailed,
      errorMessage: error instanceof Error ? error.message : "Failed to process intent result",
      instanceId,
      responses,
    })
  }
}
