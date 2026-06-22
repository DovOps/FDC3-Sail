/**
 * In-tab Desktop Agent ↔ WCP connector link.
 *
 * Same-process direct delivery (no structuredClone). Used by the browser preset
 * instead of {@link createInMemoryTransportPair} — not a remote DA transport.
 */

import type { Transport, MessageHandler, DisconnectHandler } from "../core/interfaces/transport"
import { consoleLogger } from "../core/interfaces/logger"

export class BrowserDaEdgeLink implements Transport {
  private messageHandler?: MessageHandler
  private disconnectHandler?: DisconnectHandler
  private connected = true
  private peer?: BrowserDaEdgeLink

  linkPeer(peer: BrowserDaEdgeLink): void {
    this.peer = peer
  }

  getLinkedPeer(): BrowserDaEdgeLink | undefined {
    return this.peer
  }

  send(message: unknown): void {
    if (!this.connected) {
      throw new Error("Cannot send message: BrowserDaEdgeLink is disconnected")
    }
    if (!this.peer?.connected) {
      throw new Error("Cannot send message: peer BrowserDaEdgeLink is disconnected")
    }
    if (!this.peer.messageHandler) {
      return
    }

    setTimeout(() => {
      if (!this.peer?.connected || !this.peer.messageHandler) {
        return
      }
      try {
        void Promise.resolve(this.peer.messageHandler(message)).catch(error => {
          consoleLogger.error("Error in BrowserDaEdgeLink peer message handler:", error)
        })
      } catch (error) {
        consoleLogger.error("Error in BrowserDaEdgeLink peer message handler:", error)
      }
    }, 0)
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler
  }

  onDisconnect(handler: DisconnectHandler): void {
    this.disconnectHandler = handler
  }

  isConnected(): boolean {
    return this.connected
  }

  getInstanceId(): string | null {
    return null
  }

  disconnect(): void {
    if (!this.connected) {
      return
    }

    const peer = this.peer
    this.connected = false
    this.peer = undefined

    if (peer?.connected) {
      peer.tearDownFromPeerDisconnect()
    }

    this.invokeDisconnectHandler()
  }

  private tearDownFromPeerDisconnect(): void {
    if (!this.connected) {
      return
    }

    this.connected = false
    this.peer = undefined
    this.invokeDisconnectHandler()
  }

  private invokeDisconnectHandler(): void {
    if (!this.disconnectHandler) {
      return
    }

    try {
      this.disconnectHandler()
    } catch (error) {
      consoleLogger.error("Error in BrowserDaEdgeLink disconnect handler:", error)
    }
  }
}

export function getBrowserDaEdgeLinkPeer(transport: Transport): Transport | undefined {
  if (transport instanceof BrowserDaEdgeLink) {
    return transport.getLinkedPeer()
  }
  return undefined
}

/**
 * Create linked transports for in-tab Desktop Agent ↔ WCP connector wiring.
 *
 * @returns `[desktopAgentSide, wcpConnectorSide]`
 */
export function createBrowserDesktopAgentEdgeLink(): [Transport, Transport] {
  const desktopAgentSide = new BrowserDaEdgeLink()
  const wcpConnectorSide = new BrowserDaEdgeLink()
  desktopAgentSide.linkPeer(wcpConnectorSide)
  wcpConnectorSide.linkPeer(desktopAgentSide)
  return [desktopAgentSide, wcpConnectorSide]
}
