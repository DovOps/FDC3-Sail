import type { Transport } from "../../core/interfaces/transport"
import type {
  AppRequestMessage,
  WebConnectionProtocolMessage,
} from "@finos/fdc3-schema/dist/generated/api/BrowserTypes"
import { MessagePortTransport } from "../message-port-transport"
import type { WCPConnectorEvents } from "../wcp-connector-events"
import { isAgentMessage, isAppMessage } from "./wcp-types"
import type { Logger } from "../../core/interfaces/logger"

type EmitFunction = <EventName extends keyof WCPConnectorEvents>(
  event: EventName,
  ...args: Parameters<WCPConnectorEvents[EventName]>
) => void

export interface WCPRoutingContext {
  desktopAgentTransport: Transport
  messagePortTransports: Map<string, MessagePortTransport>
  transportToInstanceId: Map<MessagePortTransport, string>
  emit: EmitFunction
  logger: Logger
  updateConnectionMetadata: (
    tempInstanceId: string,
    actualInstanceId: string,
    appId: string
  ) => void
  handleWCP6Goodbye: (instanceId: string) => void
  enrichMessageWithSource: (
    message: AppRequestMessage | WebConnectionProtocolMessage,
    instanceId: string
  ) => AppRequestMessage | WebConnectionProtocolMessage
  disconnectApp: (instanceId: string) => void
}

/**
 * Bridge messages between app MessagePort and Desktop Agent transport
 *
 * This sets up bidirectional message routing:
 * - App → Desktop Agent: Add source metadata (instanceId) to identify message origin
 * - Desktop Agent → App: Route by destination metadata (instanceId) to target app
 *
 * Message format: DACP messages with meta.source/destination.instanceId for routing
 *
 * Note: Uses dynamic instanceId lookup via transportToInstanceId map because
 * the instanceId changes from temp-{uuid} to actual instanceId after WCP5 validation.
 */
export function bridgeTransports(
  appTransport: MessagePortTransport,
  context: WCPRoutingContext
): void {
  // App → Desktop Agent: Enrich messages with source instanceId
  // Note: message is unknown from Transport.onMessage by design - validates untrusted input
  appTransport.onMessage((message: unknown) => {
    // Type guard: validate message structure using type guard
    if (!isAppMessage(message)) {
      context.logger.warn("Received invalid message from app, ignoring", message)
      return
    }

    // Look up current instanceId dynamically (may have changed after WCP5 migration)
    const currentInstanceId = context.transportToInstanceId.get(appTransport)
    if (!currentInstanceId) {
      context.logger.warn("Cannot route message: transport not found in reverse lookup")
      return
    }

    // Handle WCP6Goodbye from app (FDC3 standard: app sends goodbye when closing)
    if (message.type === "WCP6Goodbye") {
      // Forward to Desktop Agent via transport for registry cleanup
      // This allows cleanup to work regardless of where Desktop Agent lives
      // (same process, worker, or server)
      const enrichedGoodbye = context.enrichMessageWithSource(message, currentInstanceId)
      context.desktopAgentTransport.send(enrichedGoodbye)

      // Also handle locally for WCPConnector's own state (MessagePorts, connections map)
      context.handleWCP6Goodbye(currentInstanceId)
      return
    }

    // Add source metadata to message for Desktop Agent routing
    const enrichedMessage = context.enrichMessageWithSource(message, currentInstanceId)

    // Forward enriched message to Desktop Agent
    context.desktopAgentTransport.send(enrichedMessage)
  })

  // Handle app disconnection
  appTransport.onDisconnect(() => {
    // Look up current instanceId dynamically for cleanup
    const currentInstanceId = context.transportToInstanceId.get(appTransport)
    if (currentInstanceId) {
      context.disconnectApp(currentInstanceId)
    }
    // Clean up reverse lookup
    context.transportToInstanceId.delete(appTransport)
  })
}

/**
 * Handle messages from Desktop Agent transport
 * Route to appropriate app based on destination metadata
 *
 * Note: message is unknown from Transport.onMessage by design - validates untrusted input
 */
export function handleDesktopAgentMessage(message: unknown, context: WCPRoutingContext): void {
  // Type guard: validate message structure using type guard
  if (!isAgentMessage(message)) {
    context.logger.warn("Received invalid message from Desktop Agent, ignoring", message)
    return
  }

  // Extract destination instanceId from message metadata
  let destinationId: string | undefined
  if (
    "destination" in message.meta &&
    message.meta.destination &&
    typeof message.meta.destination === "object" &&
    "instanceId" in message.meta.destination
  ) {
    destinationId = message.meta.destination.instanceId as string | undefined
  }

  context.logger.debug("Received message from Desktop Agent", {
    messageType: message.type,
    destinationId: destinationId ?? "",
    hasDestination: !!destinationId,
  })

  if (!destinationId) {
    // Broadcast message or Desktop Agent internal message - not routed to apps
    context.logger.debug("No destinationId, skipping routing", { messageType: message.type })
    return
  }

  // Intercept WCP5ValidateAppIdentityResponse to migrate temp→actual instanceId
  // This happens after Desktop Agent validates app identity via WCP4
  if (message.type === "WCP5ValidateAppIdentityResponse") {
    let actualInstanceId: string | undefined
    let appId: string | undefined

    if ("payload" in message && message.payload && typeof message.payload === "object") {
      if ("instanceId" in message.payload && typeof message.payload.instanceId === "string") {
        actualInstanceId = message.payload.instanceId
      }
      if ("appId" in message.payload && typeof message.payload.appId === "string") {
        appId = message.payload.appId
      }
    }

    if (actualInstanceId && appId && destinationId !== actualInstanceId) {
      // Migrate from temp instanceId to actual instanceId
      // destinationId is the temp instanceId (temp-{uuid})
      // actualInstanceId is the real instanceId from Desktop Agent
      context.updateConnectionMetadata(destinationId, actualInstanceId, appId)

      // Now route to the actual instanceId (maps have been updated)
      const appTransport = context.messagePortTransports.get(actualInstanceId)
      if (appTransport && appTransport.isConnected()) {
        appTransport.send(message)
      } else {
        context.logger.warn(
          `Cannot route WCP5 response to app ${actualInstanceId}: transport not found`
        )
      }
      return
    }
  }

  // On identity validation failure, route the failure response and then
  // terminate the temporary MessageChannel as required by the WCP spec.
  if (message.type === "WCP5ValidateAppIdentityFailedResponse") {
    const appTransport = context.messagePortTransports.get(destinationId)
    if (appTransport && appTransport.isConnected()) {
      appTransport.send(message)
    }
    context.disconnectApp(destinationId)
    return
  }

  // Intercept channelChangedEvent to emit UI event
  // This allows the UI to update channel indicators
  if (message.type === "channelChangedEvent") {
    let channelId: string | null | undefined
    let changedInstanceId: string | undefined

    if ("payload" in message && message.payload && typeof message.payload === "object") {
      if ("channelId" in message.payload) {
        const ch = message.payload.channelId
        channelId = ch === null || typeof ch === "string" ? ch : undefined
      }
      if (
        "identity" in message.payload &&
        message.payload.identity &&
        typeof message.payload.identity === "object"
      ) {
        if (
          "instanceId" in message.payload.identity &&
          typeof message.payload.identity.instanceId === "string"
        ) {
          changedInstanceId = message.payload.identity.instanceId
        }
      }
    }

    if (changedInstanceId) {
      // Only emit if we have a valid instanceId
      context.emit("channelChanged", changedInstanceId, channelId ?? null)
    }
  }

  // Route to specific app if transport exists and is connected
  const appTransport = context.messagePortTransports.get(destinationId)
  if (appTransport && appTransport.isConnected()) {
    // Extract metadata fields for logging
    const logMetadata: Record<string, string | number | boolean | null | undefined> = {
      destinationId,
      messageType: message.type,
    }

    if ("meta" in message && message.meta && typeof message.meta === "object") {
      if ("eventUuid" in message.meta && typeof message.meta.eventUuid === "string") {
        logMetadata.eventUuid = message.meta.eventUuid
      }
      if ("requestUuid" in message.meta && typeof message.meta.requestUuid === "string") {
        logMetadata.requestUuid = message.meta.requestUuid
      }
      if ("responseUuid" in message.meta && typeof message.meta.responseUuid === "string") {
        logMetadata.responseUuid = message.meta.responseUuid
      }
    }

    // Add intent-specific logging
    if (
      message.type === "intentEvent" &&
      "payload" in message &&
      message.payload &&
      typeof message.payload === "object"
    ) {
      if ("intent" in message.payload && typeof message.payload.intent === "string") {
        logMetadata.intent = message.payload.intent
      }
      if (
        "context" in message.payload &&
        message.payload.context &&
        typeof message.payload.context === "object"
      ) {
        if ("type" in message.payload.context && typeof message.payload.context.type === "string") {
          logMetadata.contextType = message.payload.context.type
        }
        if ("name" in message.payload.context) {
          logMetadata.contextHasName = typeof message.payload.context.name === "string"
        }
      }
    }

    // Add broadcast-specific logging
    if (
      message.type === "broadcastEvent" &&
      "payload" in message &&
      message.payload &&
      typeof message.payload === "object"
    ) {
      if ("channelId" in message.payload && typeof message.payload.channelId === "string") {
        logMetadata.channelId = message.payload.channelId
      }
      if (
        "context" in message.payload &&
        message.payload.context &&
        typeof message.payload.context === "object"
      ) {
        if ("type" in message.payload.context && typeof message.payload.context.type === "string") {
          logMetadata.contextType = message.payload.context.type
        }
      }
    }

    context.logger.debug("Routing message to app", logMetadata)

    try {
      appTransport.send(message)
      context.logger.debug("Message sent successfully to app transport", {
        destinationId,
        messageType: message.type,
      })
    } catch (error) {
      context.logger.error("[WCPConnector] Error sending message to app transport", {
        destinationId,
        messageType: message.type,
        error,
      })
    }
  } else {
    context.logger.warn(
      `[WCPConnector] Cannot route message to app ${destinationId}: transport not found or disconnected`,
      {
        messageType: message.type,
        hasTransport: !!appTransport,
        isConnected: appTransport?.isConnected(),
      }
    )
  }
}
