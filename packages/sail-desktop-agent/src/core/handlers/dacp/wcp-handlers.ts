/**
 * WCP (Web Connection Protocol) Handlers
 *
 * Handles FDC3 Web Connection Protocol messages for app identity validation.
 * Per FDC3 spec, after receiving WCP3Handshake, apps send Wcp4Validateappidentity
 * to validate their identity before sending DACP messages.
 */

import type {
  AppMetadata as SchemaAppMetadata,
  ImplementationMetadata,
  WebConnectionProtocol4ValidateAppIdentity,
  WebConnectionProtocol5ValidateAppIdentityFailedResponse,
  WebConnectionProtocol5ValidateAppIdentitySuccessResponse,
} from "@finos/fdc3-schema/dist/generated/api/BrowserTypes"
import type { DACPHandlerContext } from "../types"
import { sendDACPResponse } from "./utils/dacp-response-utils"
import { startHeartbeat } from "./heartbeat-handlers"
import { cleanupDACPHandlers } from "./cleanup"
import { linkHandshakeRoutingId } from "../../state/mutators/wcp-handshake-routing"
import { getInstance } from "../../state/selectors"
import { connectInstance, updateInstanceState } from "../../state/mutators"
import { AppInstanceState } from "../../state/types"
import type { DirectoryApp } from "../../app-directory/types"
import { getInstanceIdentityMap, type InstanceIdentityRecord } from "./instance-identity-registry"
import { takePendingWcpSourceWindow } from "./wcp-pending-source-window"
import { findBestAppMatchByIdentityUrl } from "./utils/wcp-identity-url-matching"
import {
  reconcileOrphanPendingHostInstances,
  tryAdoptHostPreRegisteredInstance,
} from "./utils/wcp-host-instance-adoption"

type Wcp4ValidateAppIdentity = WebConnectionProtocol4ValidateAppIdentity
type WCP5ValidateAppIdentityResponse = WebConnectionProtocol5ValidateAppIdentitySuccessResponse
type WCP5ValidateAppIdentityFailedResponse = WebConnectionProtocol5ValidateAppIdentityFailedResponse

/**
 * Handles Wcp4Validateappidentity messages from FDC3 apps.
 *
 * Per FDC3 spec:
 * - This is the first message sent by app after receiving WCP3Handshake
 * - Desktop Agent MUST validate the app identity before accepting DACP messages
 * - Origin of identityUrl, actualUrl, and MessageEvent.origin MUST all match
 *
 * @param message - Wcp4Validateappidentity message
 * @param context - Handler context with desktop agent access
 */
export function handleWcp4ValidateAppIdentity(message: unknown, context: DACPHandlerContext): void {
  const wcp4Message = message as Wcp4ValidateAppIdentity
  const { responses, getState, logger } = context

  logger.info("[WCP4] Received app identity validation request", wcp4Message.payload)

  try {
    const {
      identityUrl,
      actualUrl,
      instanceId: reconnectInstanceId,
      instanceUuid: reconnectInstanceUuid,
    } = wcp4Message.payload

    // 1. Extract origins from URLs
    const identityOrigin = new URL(identityUrl).origin
    const actualOrigin = new URL(actualUrl).origin
    const messageMeta = (
      message as {
        meta?: { messageOrigin?: string; wcpSourceWindow?: unknown }
      }
    ).meta
    const messageOrigin = messageMeta?.messageOrigin
    const sourceWindow =
      takePendingWcpSourceWindow(responses.edgeTransport, context.instanceId) ??
      messageMeta?.wcpSourceWindow

    // 2. Validate origins match (per FDC3 spec requirement)
    if (identityOrigin !== actualOrigin) {
      logger.error("[WCP4] Origin mismatch", { identityOrigin, actualOrigin })
      sendFailureResponse(
        context,
        "Origin mismatch: identityUrl and actualUrl must have same origin",
        wcp4Message.meta.connectionAttemptUuid
      )
      return
    }

    if (!messageOrigin) {
      logger.error("[WCP4] Missing WCP1Hello message origin for validation")
      sendFailureResponse(
        context,
        "Origin mismatch: WCP1Hello MessageEvent.origin must be provided",
        wcp4Message.meta.connectionAttemptUuid
      )
      return
    }

    if (messageOrigin !== identityOrigin) {
      logger.error("[WCP4] Origin mismatch", {
        identityOrigin,
        actualOrigin,
        messageOrigin,
      })
      sendFailureResponse(
        context,
        "Origin mismatch: MessageEvent.origin must match identityUrl and actualUrl",
        wcp4Message.meta.connectionAttemptUuid
      )
      return
    }

    // 3. Look up app in app directory (spec: identityUrl is the lookup key)
    const apps = getState().appDirectory.apps
    const appMetadata = findBestAppMatchByIdentityUrl(identityUrl, apps)

    if (!appMetadata) {
      logger.error("[WCP4] App not found in directory for identity", identityUrl)
      sendFailureResponse(
        context,
        "App not found in app directory",
        wcp4Message.meta.connectionAttemptUuid
      )
      return
    }

    logger.info("[WCP4] App found in directory", appMetadata.appId)

    // 4. Check if reconnecting to existing instance
    let instanceId: string
    let instanceUuid: string
    const identityMap = getInstanceIdentityMap(responses.edgeTransport)

    const existingInstance = reconnectInstanceId
      ? getInstance(getState(), reconnectInstanceId)
      : undefined

    const canReuseExistingIdentity =
      reconnectInstanceId &&
      reconnectInstanceUuid &&
      sourceWindow &&
      canReuseInstanceIdentity({
        existingInstance,
        identityRecord: identityMap.get(reconnectInstanceId),
        reconnectInstanceUuid,
        expectedAppId: appMetadata.appId,
        expectedOrigin: identityOrigin,
        sourceWindow,
      })

    const adoptedHostInstance = tryAdoptHostPreRegisteredInstance({
      reconnectInstanceId,
      reconnectInstanceUuid,
      sourceWindow,
      appId: appMetadata.appId,
      getState,
      identityMap,
    })

    if (canReuseExistingIdentity && reconnectInstanceId) {
      logger.info("[WCP4] Reconnecting to existing instance", reconnectInstanceId)
      instanceId = reconnectInstanceId
      instanceUuid = reconnectInstanceUuid
      identityMap.set(instanceId, {
        appId: appMetadata.appId,
        instanceUuid,
        origin: identityOrigin,
        sourceWindow,
      })
    } else if (adoptedHostInstance) {
      logger.info(
        "[WCP4] Adopting host-pre-registered pending instance",
        adoptedHostInstance.instanceId
      )
      instanceId = adoptedHostInstance.instanceId
      instanceUuid = adoptedHostInstance.instanceUuid
      identityMap.set(instanceId, {
        appId: appMetadata.appId,
        instanceUuid,
        origin: identityOrigin,
        sourceWindow,
      })
    } else {
      const newInstance = createAppInstance(
        context,
        appMetadata,
        identityUrl,
        identityOrigin,
        sourceWindow
      )
      instanceId = newInstance.instanceId
      instanceUuid = newInstance.instanceUuid
      identityMap.set(instanceId, {
        appId: appMetadata.appId,
        instanceUuid,
        origin: identityOrigin,
        sourceWindow,
      })
      reconcileOrphanPendingHostInstances(context, appMetadata.appId, instanceId)
    }

    // Extract connectionAttemptUuid from WCP4 message or from temporary instanceId
    // The temporary instanceId format is "temp-{connectionAttemptUuid}"
    let connectionAttemptUuid: string | undefined = wcp4Message.meta.connectionAttemptUuid
    if (!connectionAttemptUuid && context.instanceId.startsWith("temp-")) {
      connectionAttemptUuid = context.instanceId.replace("temp-", "")
    }

    if (!connectionAttemptUuid) {
      throw new Error("Missing connectionAttemptUuid for WCP5 response")
    }

    const appMetadataForImplementation: SchemaAppMetadata = {
      appId: appMetadata.appId,
      instanceId,
      name: appMetadata.name,
      title: appMetadata.title,
      description: appMetadata.description,
      icons: appMetadata.icons,
      screenshots: appMetadata.screenshots,
    }

    const baseImplementationMetadata = context.implementationMetadata
    const implementationMetadata: ImplementationMetadata = {
      appMetadata: appMetadataForImplementation,
      fdc3Version: baseImplementationMetadata.fdc3Version,
      provider: baseImplementationMetadata.provider,
      providerVersion: baseImplementationMetadata.providerVersion,
      optionalFeatures: baseImplementationMetadata.optionalFeatures,
    }

    // 5. Send success response
    const response = {
      type: "WCP5ValidateAppIdentityResponse",
      payload: {
        appId: appMetadata.appId,
        instanceId,
        instanceUuid,
        implementationMetadata,
      },
      meta: {
        timestamp: new Date().toISOString(),
        connectionAttemptUuid,
      },
      // BrowserTypes currently type meta.timestamp as Date, but wire schema expects ISO string.
      // TODO: Raise GitHub issue to align generated types with schema (timestamp as string).
    } as unknown as WCP5ValidateAppIdentityResponse

    logger.info("[WCP4] Validation successful, sending WCP5 response", response.payload)

    // Option A lifecycle: host open pre-register stays PENDING until WCP5 succeeds.
    context.setState(state => updateInstanceState(state, instanceId, AppInstanceState.CONNECTED))

    // Use the source instanceId (temporary) as destination so WCP connector can migrate it
    // The WCP connector will intercept this response and migrate from temp to actual instanceId
    const sourceInstanceId = context.instanceId

    // Add routing metadata - use source instanceId so WCP connector can find the connection
    // Include connectionAttemptUuid so FDC3 get-agent library can match the response
    const responseWithRouting = {
      ...response,
      meta: {
        ...response.meta,
        connectionAttemptUuid,
        destination: { instanceId: sourceInstanceId },
      },
    }

    responses.sendOutbound(responseWithRouting)

    if (sourceInstanceId !== instanceId) {
      context.setState(state => linkHandshakeRoutingId(state, sourceInstanceId, instanceId))
    }

    // Heartbeat liveness is optional; WCP6 still removes the instance when heartbeat is off.
    if (context.heartbeatEnabled) {
      startHeartbeat(instanceId, context)
    }
  } catch (error) {
    logger.error("[WCP4] Error during validation", error)
    sendFailureResponse(
      context,
      error instanceof Error ? error.message : "Internal validation error",
      wcp4Message.meta.connectionAttemptUuid
    )
  }
}

/**
 * Helper to create a new app instance
 */
function createAppInstance(
  context: DACPHandlerContext,
  appMetadata: DirectoryApp,
  identityUrl: string,
  identityOrigin: string,
  sourceWindow: unknown
) {
  const instanceId = crypto.randomUUID()
  const instanceUuid = crypto.randomUUID()

  context.setState(state =>
    connectInstance(state, {
      instanceId,
      appId: appMetadata.appId,
      metadata: {
        appId: appMetadata.appId,
        name: appMetadata.name,
        title: appMetadata.title,
        description: appMetadata.description,
        icons: appMetadata.icons,
        screenshots: appMetadata.screenshots,
      },
    })
  )

  context.logger.info("[WCP4] Created new app instance", {
    instanceId,
    instanceUuid,
    appId: appMetadata.appId,
    identityUrl,
    identityOrigin,
    hasSourceWindow: !!sourceWindow,
  })

  return { instanceId, instanceUuid }
}

/**
 * Handles WCP6Goodbye messages from FDC3 apps.
 *
 * Per FDC3 spec:
 * - Apps send WCP6Goodbye when they are closing/unloading
 * - Desktop Agent should clean up all resources for that instance
 *
 * This handler is called when WCPConnector forwards the goodbye message
 * through the responses, allowing cleanup to happen regardless of where
 * the Desktop Agent is running (same process, worker, or server).
 *
 * @param message - WCP6Goodbye message
 * @param context - Handler context with desktop agent access
 */
export function handleWCP6Goodbye(_message: unknown, context: DACPHandlerContext): void {
  const { instanceId, logger } = context

  logger.info("[WCP6] Received goodbye from app instance", instanceId)

  // Context may still carry the WCP4 temp connection id; cleanup resolves the canonical
  // WCP5 instanceId because heartbeat is started on that id during WCP4 validation.
  cleanupDACPHandlers(context)

  logger.info("[WCP6] Cleanup completed for instance", instanceId)
}

/**
 * Helper to send WCP5 failure response
 */
function sendFailureResponse(
  context: DACPHandlerContext,
  error: string,
  connectionAttemptUuid?: string
): void {
  const resolvedConnectionAttemptUuid =
    connectionAttemptUuid ??
    (context.instanceId.startsWith("temp-") ? context.instanceId.replace("temp-", "") : undefined)

  if (!resolvedConnectionAttemptUuid) {
    context.logger.error("[WCP4] Cannot send failure response: connectionAttemptUuid not available")
    return
  }

  const response = {
    type: "WCP5ValidateAppIdentityFailedResponse",
    payload: {
      message: error,
    },
    meta: {
      timestamp: new Date().toISOString(),
      connectionAttemptUuid: resolvedConnectionAttemptUuid,
    },
    // BrowserTypes currently type meta.timestamp as Date, but wire schema expects ISO string.
    // TODO: Raise GitHub issue to align generated types with schema (timestamp as string).
  } as unknown as WCP5ValidateAppIdentityFailedResponse

  context.logger.info("[WCP4] Validation failed, sending WCP5 failure response", error)

  // Try to get the instance ID from the transport (e.g. socket ID)
  const instanceId = context.responses.getInboundInstanceId()

  if (instanceId) {
    sendDACPResponse({
      response,
      instanceId,
      responses: context.responses,
    })
    return
  }

  // Fall back to sending without routing metadata when instanceId is unknown
  const fallbackResponse = {
    ...response,
    meta: {
      ...response.meta,
      destination: { instanceId: `temp-${resolvedConnectionAttemptUuid}` },
    },
  }

  context.responses.sendOutbound(fallbackResponse)
}

function canReuseInstanceIdentity(params: {
  existingInstance: ReturnType<typeof getInstance>
  identityRecord?: InstanceIdentityRecord
  reconnectInstanceUuid: string
  expectedAppId: string
  expectedOrigin: string
  sourceWindow: unknown
}): boolean {
  const {
    existingInstance,
    identityRecord,
    reconnectInstanceUuid,
    expectedAppId,
    expectedOrigin,
    sourceWindow,
  } = params

  if (!existingInstance || !identityRecord) {
    return false
  }

  return (
    identityRecord.instanceUuid === reconnectInstanceUuid &&
    identityRecord.appId === expectedAppId &&
    identityRecord.origin === expectedOrigin &&
    identityRecord.sourceWindow === sourceWindow
  )
}
