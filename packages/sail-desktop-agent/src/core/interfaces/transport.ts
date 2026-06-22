/**
 * Transport Interface
 *
 * Abstraction for bidirectional message transport to/from the Desktop Agent.
 *
 * **Key Concept**: Transport represents "WHERE is the Desktop Agent" - it is
 * ONE pipe to the Desktop Agent location (server, browser, worker), NOT a
 * per-app connection.
 *
 * Message routing to specific apps happens via `instanceId` embedded in DACP
 * message metadata (message.meta.source.instanceId, message.meta.destination.instanceId),
 * not at the transport layer.
 *
 * Implementations handle environment-specific details:
 * - Socket.IO (server-based Desktop Agent)
 * - MessagePort (worker or browser-based Desktop Agent)
 * - IPC (Electron/native Desktop Agent)
 * - In-memory (Desktop Agent in same process)
 */

/**
 * Handler function for incoming messages from apps
 */
export type MessageHandler = (message: unknown) => void | Promise<void>

/**
 * Handler function for disconnect events
 */
export type DisconnectHandler = () => void

/**
 * Transport interface for sending and receiving DACP messages.
 *
 * The Desktop Agent uses this to communicate without knowing the underlying
 * transport mechanism (Socket.IO, MessagePort, IPC, etc.).
 *
 * **Important**: This is ONE transport for the entire Desktop Agent, not
 * per-app. Message routing to specific apps is handled by:
 * 1. ConnectionManager (browser) - routes via MessagePort map
 * 2. Desktop Agent - reads instanceId from message.meta.destination
 */
export interface Transport {
  /**
   * Send a DACP message through the transport.
   *
   * The message MUST contain routing information in its metadata:
   * - message.meta.source.instanceId - sender's instance ID
   * - message.meta.destination.instanceId - recipient's instance ID (if applicable)
   *
   * The transport implementation is responsible for delivering the message
   * to the destination. For example:
   * - Socket.IO: Emits message to server, which routes to destination
   * - MessagePort: Posts directly to worker/browser
   * - ConnectionManager: Routes to correct MessagePort based on destination
   *
   * @param message - DACP message with routing metadata
   */
  send(message: unknown): void

  /**
   * Register a handler for incoming DACP messages.
   *
   * The transport should call this handler when it receives a message from
   * ANY app. The Desktop Agent will inspect message.meta.destination to
   * determine if it should process the message.
   *
   * @param handler - Function to call when a message is received
   */
  onMessage(handler: MessageHandler): void

  /**
   * Register a handler for transport-level disconnect events.
   *
   * NOTE: This is for the entire transport pipe disconnecting (e.g., WebSocket
   * closes, worker terminates), NOT individual app disconnects.
   *
   * Individual app disconnects are handled via DACP heartbeat mechanism.
   *
   * @param handler - Function to call when the transport disconnects
   */
  onDisconnect(handler: DisconnectHandler): void

  /**
   * Check if the transport connection is still active.
   *
   * Returns true if the underlying connection (Socket.IO, MessagePort, etc.)
   * is open and can send/receive messages.
   */
  isConnected(): boolean

  /**
   * Close the transport connection and clean up resources.
   *
   * This disconnects the entire Desktop Agent from the transport layer.
   * All connected apps will be disconnected as a result.
   */
  /**
   * Get the instance ID associated with this transport connection, if any.
   *
   * This is used when the transport represents a direct connection to a specific
   * app instance (e.g. Socket.IO socket).
   */
  getInstanceId(): string | null

  /**
   * Close the transport connection and clean up resources.
   *
   * This disconnects the entire Desktop Agent from the transport layer.
   * All connected apps will be disconnected as a result.
   */
  disconnect(): void
}
