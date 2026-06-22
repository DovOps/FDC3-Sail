/**
 * Desktop Agent Communication Protocol (DACP) Message Types
 * FDC3 2.2 Standard Protocol Messages
 */

import type { BrowserTypes } from "@finos/fdc3"

/**
 * Union type of all DACP request message types
 * These are the request messages that follow FDC3 2.2 specification
 */
export type DACPRequestType = BrowserTypes.RequestMessageType

/**
 * Union type of all DACP response message types
 * These are the response messages that follow FDC3 2.2 specification
 */
export type DACPResponseType = BrowserTypes.ResponseMessageType

/**
 * Union type of all DACP event message types
 * These are the event messages that follow FDC3 2.2 specification
 */
export type DACPEventType = BrowserTypes.EventMessageType

/**
 * Union type of all DACP message types (requests, responses, and events)
 */
export type DACPMessageType = DACPRequestType | DACPResponseType | DACPEventType
