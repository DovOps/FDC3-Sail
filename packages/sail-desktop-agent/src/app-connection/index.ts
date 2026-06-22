/**
 * App connection layer — browser mechanisms for connecting FDC3 apps to the Desktop Agent.
 *
 * WCP1–3 handshake, MessagePort bridging, and connection lifecycle. Convenience factories
 * live under `presets/` (`createBrowserDesktopAgent`).
 */

export { WCPConnector } from "./wcp-connector.js"
export { MessagePortTransport } from "./message-port-transport.js"

export type {
  WCPConnectorEvents,
  WCPConnectorOptions,
  AppConnectionMetadata,
  IntentHandler,
  IntentResolverPayload,
  IntentResolverResponse,
} from "./wcp-connector.js"

export { DesktopAgent } from "../core/desktop-agent.js"
export type { DesktopAgentConfig } from "../core/desktop-agent.js"
