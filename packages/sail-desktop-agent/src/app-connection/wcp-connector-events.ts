import type { HostIntentResolverPayload } from "../host-contracts"
import type { AppConnectionMetadata } from "./wcp/wcp-types"

/**
 * Browser connector events emitted by {@link WCPConnector}.
 *
 * These are Sail connector API events, not official FDC3 WCP wire messages.
 */
export interface WCPConnectorEvents {
  /** Fired when a new app successfully completes WCP handshake. */
  appConnected: (metadata: AppConnectionMetadata) => void

  /** Fired when an app disconnects. */
  appDisconnected: (instanceId: string) => void

  /** Fired when handshake fails. */
  handshakeFailed: (error: Error, connectionAttemptUuid: string) => void

  /** Fired when an app's channel membership changes; null means no user channel. */
  channelChanged: (instanceId: string, channelId: string | null) => void

  /**
   * Fired when host-owned intent resolver UI is needed.
   *
   * Sail host UI adapter event, not an official FDC3 WCP wire message.
   */
  intentResolverNeeded: (payload: HostIntentResolverPayload) => void
}
