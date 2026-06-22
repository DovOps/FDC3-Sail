import type { BrowserTypes } from "@finos/fdc3"
import type { Transport } from "../../../interfaces/transport"
import { createDACPErrorResponse, type DACPRequestLike } from "../../../dacp/dacp-message-creators"
import type { DACPResponseType } from "../../../dacp/dacp-messages"
import type { DacpOutboundMessage, DacpResponseDispatcher } from "../../types"

/**
 * Options for sending a DACP response
 */
export interface SendDACPResponseOptions {
  /** The DACP response message to send */
  response: BrowserTypes.AgentResponseMessage | BrowserTypes.WebConnectionProtocolMessage
  /** The target instance ID for routing */
  instanceId: string
  /** Response delivery for the connected app edge */
  responses: DacpResponseDispatcher
}

/**
 * Adds routing metadata to a DACP response and sends it via the dispatcher.
 */
export function sendDACPResponse(options: SendDACPResponseOptions): void {
  options.responses.sendToInstance(options.instanceId, options.response)
}

/**
 * Options for sending a DACP error response
 */
export interface SendDACPErrorResponseOptions {
  /** Original request message (must have type and meta.requestUuid) */
  message: DACPRequestLike
  /** FDC3 response payload error (use OpenError, ResolveError, ChannelError, ResultError, BridgingError from @finos/fdc3) */
  errorType: BrowserTypes.ResponsePayloadError
  /** Human-readable error message */
  errorMessage: string
  /** The target instance ID for routing */
  instanceId: string
  /** Response delivery for the connected app edge */
  responses: DacpResponseDispatcher
}

/**
 * Derives response type from request type.
 * Converts "addEventListenerRequest" → "addEventListenerResponse"
 */
function deriveResponseType(requestType: string): string {
  if (requestType.endsWith("Request")) {
    return requestType.replace("Request", "Response")
  }
  return requestType
}

/**
 * Creates and sends a DACP error response with routing metadata.
 */
export function sendDACPErrorResponse(options: SendDACPErrorResponseOptions): void {
  const { message, errorType, errorMessage, instanceId, responses } = options
  const responseType = deriveResponseType(message.type) as DACPResponseType
  const errorResponse = createDACPErrorResponse(message, errorType, responseType, errorMessage)
  sendDACPResponse({ response: errorResponse, instanceId, responses })
}

function withDestinationRouting(instanceId: string, message: DacpOutboundMessage): unknown {
  return {
    ...message,
    meta: {
      ...message.meta,
      destination: { instanceId },
    },
  }
}

/**
 * Browser-local DACP response delivery — routes to app instances without exposing
 * generic remote Desktop Agent transport placement to handlers.
 */
export function createDacpResponseDispatcher(edgeTransport: Transport): DacpResponseDispatcher {
  return {
    edgeTransport,

    sendToInstance(instanceId, message) {
      edgeTransport.send(withDestinationRouting(instanceId, message))
    },

    sendOutbound(message) {
      edgeTransport.send(message)
    },

    getInboundInstanceId() {
      return edgeTransport.getInstanceId()
    },
  }
}
