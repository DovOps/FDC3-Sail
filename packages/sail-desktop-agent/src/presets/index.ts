/**
 * High-level preset factories for common Desktop Agent integration paths.
 *
 * Prefer presets when you want a batteries-included setup; use manual composition
 * primitives from `@finos/sail-desktop-agent`, `/app-connection`, and `/transports`
 * when you need full control over wiring.
 */
export {
  createBrowserDesktopAgent,
  type BrowserDesktopAgent,
  type BrowserDesktopAgentOptions,
} from "./create-browser-desktop-agent.js"

export {
  getBrowserDesktopAgentSession,
  isBrowserDesktopAgent,
  clearBrowserDesktopAgentSession,
  createBrowserHostControllers,
  type BrowserDesktopAgentSession,
  type BrowserHostControllers,
  type BrowserHostControllerOptions,
  type BrowserIntentResolverController,
  type BrowserChannelsController,
  type AppChannelChangeEvent,
  type BrowserAppsController,
  type BrowserAppOpenOptions,
  type BrowserAppInstance,
  type HandshakeFailureEvent,
} from "./browser-session.js"

export { WCPConnector } from "../app-connection/wcp-connector.js"
