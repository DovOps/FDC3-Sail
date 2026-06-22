import { describe, expect, it } from "vite-plus/test"

import {
  createCapturingLogger,
  SENSITIVE_MARKER,
  serializeLogCalls,
  serializeNonDebugLogs,
} from "../../../__tests__/utils/capturing-logger"
import type { Logger } from "../../../core/interfaces/logger"
import { logDACPMessage } from "../dacp-utils"

type LogDACPMessageOptions = {
  logger: Logger
  logPayloadDetail?: "metadata" | "full"
}

function logWithOptions(
  direction: "incoming" | "outgoing",
  message: unknown,
  source: string,
  options: LogDACPMessageOptions
): void {
  logDACPMessage(direction, message, source, options)
}

describe("logDACPMessage", () => {
  const sensitiveMessage = {
    type: "broadcastRequest",
    meta: { requestUuid: "broadcast-log-redaction-uuid" },
    payload: {
      channelId: "fdc3.channel.1",
      context: {
        type: "fdc3.instrument",
        accountNumber: SENSITIVE_MARKER,
      },
    },
  }

  it("uses the injected logger instead of hardcoded consoleLogger", () => {
    const logger = createCapturingLogger()

    logWithOptions("incoming", sensitiveMessage, "DACP Router", {
      logger,
      logPayloadDetail: "metadata",
    })

    expect(logger.debugCalls.length).toBeGreaterThan(0)
  })

  it("does not include sensitive values in warn or error logs for invalid messages", () => {
    const logger = createCapturingLogger()

    logWithOptions("incoming", "not-an-object", "DACP Router", {
      logger,
      logPayloadDetail: "metadata",
    })

    expect(serializeNonDebugLogs(logger)).not.toContain(SENSITIVE_MARKER)
    expect(logger.warnCalls.length).toBeGreaterThan(0)
  })

  it("includes full payload on debug only when logPayloadDetail is full", () => {
    const logger = createCapturingLogger()

    logWithOptions("incoming", sensitiveMessage, "DACP Router", {
      logger,
      logPayloadDetail: "full",
    })

    expect(serializeNonDebugLogs(logger)).not.toContain(SENSITIVE_MARKER)
    expect(serializeLogCalls(logger.debugCalls)).toContain(SENSITIVE_MARKER)
  })

  it("omits full payload from debug when logPayloadDetail is metadata", () => {
    const logger = createCapturingLogger()

    logWithOptions("incoming", sensitiveMessage, "DACP Router", {
      logger,
      logPayloadDetail: "metadata",
    })

    expect(serializeLogCalls(logger.debugCalls)).not.toContain(SENSITIVE_MARKER)
    expect(serializeLogCalls(logger.debugCalls)).toContain("broadcastRequest")
  })
})
