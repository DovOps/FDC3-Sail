import {
  createBrowserDesktopAgent,
  type BrowserDesktopAgentOptions,
  type DesktopAgent,
} from "@finos/sail-desktop-agent"
import { MiddlewarePipeline, type Middleware } from "./middleware/middleware"
import { wireWcp4OriginAllowlist } from "./wcp4-origin-allowlist"
export type { Middleware }

/**
 * Configuration for Sail Browser Desktop Agent
 */
export interface SailBrowserDesktopAgentConfig extends Omit<
  BrowserDesktopAgentOptions,
  "wcpOptions"
> {
  /**
   * WCP options with Sail-specific defaults.
   */
  wcpOptions?: BrowserDesktopAgentOptions["wcpOptions"]

  /**
   * Optional Sail deployment policy: origins permitted to complete WCP4 identity
   * validation. When set, connections from other `MessageEvent.origin` values receive
   * `WCP5ValidateAppIdentityFailedResponse` (FDC3-compliant rejection path).
   *
   * When **undefined** (default), no additional origin allowlist is applied — only
   * standard FDC3 WCP4 checks (origin consistency + App Directory match) apply.
   */
  allowedOrigins?: readonly string[]

  /**
   * Enable debug logging
   */
  debug?: boolean
}

/**
 * Sail Browser Desktop Agent - browser-specific wrapper.
 *
 * This class wraps the browser Desktop Agent with Sail-specific features:
 * - Sail-specific WCP configuration defaults
 * - Middleware support (logging, metrics)
 * - Connection lifecycle management
 *
 * For host channel chrome, use {@link SailPlatform} (`changeAppChannel`, `getAppUserChannel`)
 * instead of sending raw DACP messages.
 *
 * @example
 * ```typescript
 * const desktopAgent = createSailBrowserDesktopAgent({
 *   appLauncher: myLauncher,
 *   debug: true,
 * })
 * ```
 */
export function createSailBrowserDesktopAgent(
  config?: SailBrowserDesktopAgentConfig
): DesktopAgent & {
  /**
   * Add middleware to the message processing pipeline
   */
  use: (middleware: Middleware<unknown>) => void
} {
  // Merge Sail-specific defaults with user config
  const wcpOptions: BrowserDesktopAgentOptions["wcpOptions"] = {
    // Sail-specific defaults: UI is provided by Sail parent window
    getIntentResolverUrl: () => false,
    getChannelSelectorUrl: () => false,
    fdc3Version: "2.2",
    handshakeTimeout: 5000,
    ...config?.wcpOptions,
  }

  const desktopAgent = createBrowserDesktopAgent({
    ...config,
    wcpOptions,
  })

  if (config?.allowedOrigins !== undefined) {
    wireWcp4OriginAllowlist(desktopAgent, config.allowedOrigins, config.debug)
  }

  // Create middleware pipeline for future use
  const pipeline = new MiddlewarePipeline<unknown>()

  // Add middleware support
  const use = (middleware: Middleware<unknown>) => {
    pipeline.use(middleware)
  }

  // This will require wrapping the agent's transport with middleware

  if (config?.debug) {
    console.log("[SailBrowserDesktopAgent] Created with Sail-specific defaults")
  }

  return Object.assign(desktopAgent, { use })
}
