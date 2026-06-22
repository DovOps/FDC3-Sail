/**
 * DACP Utility Functions
 *
 * Helper functions for DACP protocol operations including timeouts, UUID generation, and logging.
 */

import { DACPTimeoutError } from "./dacp-errors"
import { DACP_TIMEOUTS } from "./dacp-constants"
import { consoleLogger, type Logger, type LogPayloadDetail } from "../../core/interfaces/logger"

/**
 * Wraps a promise with a timeout, rejecting with DACPTimeoutError if exceeded.
 */
export function withDACPTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = DACP_TIMEOUTS.DEFAULT,
  operation: string = "DACP operation"
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new DACPTimeoutError(`${operation} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    }),
  ])
}

/**
 * Generates a UUID for events.
 */
export function generateEventUuid(): string {
  return crypto.randomUUID()
}

export interface DACPLoggingOptions {
  logger: Logger
  logPayloadDetail?: LogPayloadDetail
}

/**
 * Build metadata-only fields for structured DACP/WCP logs (no sensitive context values).
 */
export function extractDACPMessageLogMetadata(message: unknown): Record<string, unknown> {
  if (typeof message !== "object" || message === null) {
    return { messageFormat: typeof message }
  }

  const msg = message as Record<string, unknown>
  const meta = msg.meta as Record<string, unknown> | undefined
  const payload = msg.payload as Record<string, unknown> | undefined
  const context = payload?.context as Record<string, unknown> | undefined

  const metadata: Record<string, unknown> = {
    type: msg.type,
    requestUuid: meta?.requestUuid,
    eventUuid: meta?.eventUuid,
  }

  if (payload?.channelId !== undefined) {
    metadata.channelId = payload.channelId
  }

  if (context) {
    metadata.contextType = context.type
    metadata.contextKeys = Object.keys(context)
  }

  return metadata
}

/**
 * Logs DACP messages for debugging. Metadata-only at info/warn/error; full payloads
 * only on {@link Logger.debug} when `logPayloadDetail` is `'full'`.
 */
export function logDACPMessage(
  direction: "incoming" | "outgoing",
  message: unknown,
  source?: string,
  options?: DACPLoggingOptions
): void {
  const logger = options?.logger ?? consoleLogger
  const logPayloadDetail = options?.logPayloadDetail ?? "metadata"

  try {
    if (typeof message === "object" && message !== null) {
      const metadata = extractDACPMessageLogMetadata(message)
      logger.debug(`[DACP ${direction.toUpperCase()}]`, { ...metadata, source })

      if (logPayloadDetail === "full") {
        logger.debug(`[DACP ${direction.toUpperCase()} full payload]`, {
          source,
          fullMessage: JSON.stringify(message),
        })
      }
    } else {
      logger.warn(`[DACP INVALID ${direction.toUpperCase()}]`, {
        message: "Invalid message format",
        source,
      })
    }
  } catch (error) {
    logger.error(`[DACP LOG ERROR]`, error)
  }
}
