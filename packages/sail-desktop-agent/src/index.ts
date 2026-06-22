/**
 * FDC3 Desktop Agent - Core Package
 *
 * This is the main entry point for the FDC3 Desktop Agent core.
 * It exports only environment-agnostic components.
 *
 * ## Application code
 *
 * Prefer the browser preset from `@finos/sail-desktop-agent/presets` (also re-exported here).
 * Advanced WCP edge access: `getBrowserDesktopAgentSession` from `/presets`.
 *
 * ```typescript
 * import { createBrowserDesktopAgent } from '@finos/sail-desktop-agent/presets'
 * import type { AppLauncher } from '@finos/sail-desktop-agent'
 *
 * const desktopAgent = createBrowserDesktopAgent({ appLauncher })
 * // Auto-started by default — edge runs with desktopAgent.start() / stop()
 * ```
 *
 * ## What's Exported
 *
 * - **DesktopAgent** - Core Desktop Agent class
 * - **createBrowserDesktopAgent** - Browser preset (re-export from `./presets`)
 * - **Host contracts** - AppLauncher, IntentResolver, ChannelControl via `./host-contracts`
 * - **App Directory** - Catalog query helpers, mutators, and core types
 *
 * ## Advanced subpaths
 *
 * - `/browser` (app-connection) - WCPConnector, MessagePortTransport
 * - `/presets` - createBrowserDesktopAgent, getBrowserDesktopAgentSession
 */

// Re-export everything from core
export * from "./core"

// UI-free host contracts for platform builders (launch, intent resolver, channel control)
export * from "./host-contracts"

// Browser Desktop Agent preset (WCP + in-tab edge link wiring)
export {
  createBrowserDesktopAgent,
  type BrowserDesktopAgent,
  type BrowserDesktopAgentOptions,
} from "./presets/create-browser-desktop-agent.js"

// NOTE: Lower-level browser connector APIs are NOT exported here
// Import from @finos/sail-desktop-agent/browser for:
// - WCPConnector
// - MessagePortTransport
//
// Import from @finos/sail-desktop-agent/presets for:
// - createBrowserDesktopAgent
// - getBrowserDesktopAgentSession

// NOTE: Transport implementations are NOT exported here
// Import from @finos/sail-desktop-agent/transports for:
// - InMemoryTransport
// - createInMemoryTransportPair()
