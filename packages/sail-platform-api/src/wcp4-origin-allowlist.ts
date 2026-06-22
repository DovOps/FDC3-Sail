import type { Transport } from "@finos/sail-desktop-agent"
import type { DesktopAgent } from "@finos/sail-desktop-agent"

type DesktopAgentInternals = {
  handleMessage: (message: unknown) => Promise<void>
  transport: Transport
}

function isWcp4ValidateAppIdentity(message: unknown): boolean {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    (message as { type: unknown }).type === "WCP4ValidateAppIdentity"
  )
}

function extractWcp4AllowlistContext(message: unknown): {
  instanceId?: string
  messageOrigin?: string
  connectionAttemptUuid?: string
} {
  if (!isWcp4ValidateAppIdentity(message)) {
    return {}
  }

  const meta = (message as { meta?: Record<string, unknown> }).meta
  const source = meta?.source as { instanceId?: string } | undefined

  return {
    instanceId: source?.instanceId,
    messageOrigin: typeof meta?.messageOrigin === "string" ? meta.messageOrigin : undefined,
    connectionAttemptUuid:
      typeof meta?.connectionAttemptUuid === "string" ? meta.connectionAttemptUuid : undefined,
  }
}

function sendWcp5IdentityFailure(
  transport: Transport,
  instanceId: string,
  connectionAttemptUuid: string,
  errorMessage: string
): void {
  transport.send({
    type: "WCP5ValidateAppIdentityFailedResponse",
    payload: { message: errorMessage },
    meta: {
      timestamp: new Date().toISOString(),
      connectionAttemptUuid,
      destination: { instanceId },
    },
  })
}

/**
 * Sail deployment policy: optional origin allowlist enforced during WCP4 identity
 * validation (after WCP3Handshake), responding with WCP5ValidateAppIdentityFailedResponse
 * per FDC3 2.2 when an origin is not trusted.
 *
 * When `allowedOrigins` is undefined, no additional check is applied.
 */
export function wireWcp4OriginAllowlist(
  desktopAgent: DesktopAgent,
  allowedOrigins: readonly string[],
  debug?: boolean
): void {
  const agent = desktopAgent as unknown as DesktopAgentInternals
  const originalHandleMessage = agent.handleMessage.bind(desktopAgent)

  agent.handleMessage = async (message: unknown) => {
    if (isWcp4ValidateAppIdentity(message)) {
      const { instanceId, messageOrigin, connectionAttemptUuid } =
        extractWcp4AllowlistContext(message)

      if (messageOrigin !== undefined && !allowedOrigins.includes(messageOrigin)) {
        const resolvedConnectionAttemptUuid =
          connectionAttemptUuid ??
          (instanceId?.startsWith("temp-") ? instanceId.slice("temp-".length) : undefined)

        if (instanceId !== undefined && resolvedConnectionAttemptUuid !== undefined) {
          if (debug) {
            console.log("[SailBrowserDesktopAgent] WCP4 origin allowlist rejected connection", {
              messageOrigin,
              allowedOrigins,
            })
          }

          sendWcp5IdentityFailure(
            agent.transport,
            instanceId,
            resolvedConnectionAttemptUuid,
            `Origin "${messageOrigin}" is not allowed`
          )
          return
        }
      }
    }

    await originalHandleMessage(message)
  }
}
