/**
 * Transport Implementations
 *
 * This module exports various Transport implementations for different
 * communication scenarios.
 *
 * ## Available Transports
 *
 * - **InMemoryTransport** - For same-process communication (any environment)
 *
 * ## Usage
 *
 * ### InMemoryTransport (Browser Desktop Agent)
 * ```typescript
 * import { createInMemoryTransportPair } from '@finos/sail-desktop-agent/transports'
 * import { DesktopAgent } from '@finos/sail-desktop-agent'
 * import { WCPConnector } from '@finos/sail-desktop-agent/browser'
 *
 * // Create linked transports
 * const [daTransport, wcpTransport] = createInMemoryTransportPair()
 *
 * // Desktop Agent uses one
 * const da = new DesktopAgent({ transport: daTransport })
 *
 * // WCP Connector uses the other
 * const wcp = new WCPConnector(wcpTransport)
 * ```
 *
 * ## Environment-Specific Transports
 *
 * Some transports are environment-specific and live in other packages:
 *
 * - **SocketIOTransport** - In `@finos/fdc3-sail-api/transports` (Node.js/browser)
 * - **WorkerTransport** - Future implementation for SharedWorker
 */

export { InMemoryTransport, createInMemoryTransportPair } from "./in-memory-transport"
