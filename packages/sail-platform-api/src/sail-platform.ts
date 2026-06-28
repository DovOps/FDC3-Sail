/**
 * SailPlatform - Main entry point for Sail Platform SDK
 *
 * Provides a unified, namespaced API for:
 * - FDC3 Desktop Agent operations
 * - Sail platform features (workspaces, layouts, config)
 * - UI integration via injectable interfaces
 */

import {
  createBrowserDesktopAgent,
  DesktopAgent,
  type AppLauncher,
  type DirectoryApp,
  type SailImplementationMetadata,
  type IntentResolver,
} from "@finos/sail-desktop-agent"
import {
  getBrowserDesktopAgentSession,
  type BrowserDesktopAgent,
  type BrowserAppsController,
  type BrowserChannelsController,
  type BrowserIntentResolverController,
  type WCPConnector,
} from "@finos/sail-desktop-agent/presets"
import type { AppConnectionMetadata } from "@finos/sail-desktop-agent/browser"
import type { BrowserTypes } from "@finos/fdc3"

import type { ChannelSelector } from "./interfaces/channel-selector"
import { SailPlatformClient, type SailPlatformClientConfig } from "./client/sail-platform-client"

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Configuration for SailPlatform
 */
export interface SailPlatformConfig {
  // ===== UI Interfaces (injectable) =====

  /**
   * App launcher implementation for opening FDC3 applications.
   * REQUIRED - must be provided to launch apps.
   */
  appLauncher: AppLauncher

  /**
   * Intent resolver implementation for handling intent resolution UI.
   * OPTIONAL - if not provided, first handler is auto-selected.
   */
  intentResolver?: IntentResolver

  /**
   * Channel selector implementation for handling channel selection UI.
   * OPTIONAL - if not provided, channel selection is handled by apps.
   */
  channelSelector?: ChannelSelector

  // ===== Event Callbacks =====

  /**
   * Called when an app successfully connects via WCP.
   */
  onAppConnected?: (metadata: AppConnectionMetadata) => void

  /**
   * Called when an app disconnects.
   */
  onAppDisconnected?: (instanceId: string) => void

  /**
   * Called when an app changes channel.
   */
  onChannelChanged?: (instanceId: string, channelId: string | null) => void

  /**
   * Called when WCP handshake fails.
   */
  onHandshakeFailed?: (error: Error, instanceId?: string) => void

  // ===== Data =====

  /**
   * Initial apps to load into the directory.
   */
  apps?: DirectoryApp[]

  /**
   * App Directory endpoint URLs to load into the directory.
   */
  appDirectories?: string[]

  /**
   * Custom user channels (defaults to standard FDC3 channels).
   */
  userChannels?: BrowserTypes.Channel[]

  /**
   * Override FDC3 implementation metadata (defaults to FDC3-Sail product values).
   */
  implementationMetadata?: Partial<SailImplementationMetadata>

  /**
   * Timeout (ms) to wait for a context listener after open-with-context.
   */
  openContextListenerTimeoutMs?: number

  /**
   * Heartbeat interval (ms).
   */
  heartbeatIntervalMs?: number

  /**
   * Heartbeat timeout (ms).
   */
  heartbeatTimeoutMs?: number

  /**
   * When `false`, the agent does not send DACP heartbeat events (host policy).
   *
   * @defaultValue `true`
   */
  heartbeatEnabled?: boolean

  // ===== Storage =====

  /**
   * Configuration for platform storage (workspaces, layouts, config).
   * Defaults to localStorage.
   */
  storage?: SailPlatformClientConfig

  // ===== Options =====

  /**
   * Enable debug logging.
   */
  debug?: boolean
}

// ============================================================================
// NAMESPACED API TYPES
// ============================================================================

/**
 * Workspaces namespace API
 */
export interface WorkspacesApi {
  list(): Promise<unknown[]>
  get(workspaceId: string): Promise<unknown>
  create(name: string, initialLayout?: unknown): Promise<unknown>
  delete(workspaceId: string): Promise<boolean>
}

/**
 * Layouts namespace API
 */
export interface LayoutsApi {
  get(workspaceId: string): Promise<unknown>
  save(workspaceId: string, layout: unknown): Promise<boolean>
}

/**
 * Config namespace API
 */
export interface ConfigApi {
  get(): Promise<unknown>
  update(config: unknown): Promise<boolean>
}

// ============================================================================
// SAIL PLATFORM CLASS
// ============================================================================

/**
 * SailPlatform - Unified platform SDK for Sail
 *
 * @example
 * ```typescript
 * const platform = new SailPlatform({
 *   appLauncher: myAppLauncher,
 *   intentResolver: myIntentResolver,
 *   onAppConnected: (metadata) => console.log('Connected:', metadata.appId),
 *   apps: directoryApps,
 * })
 *
 * await platform.start()
 *
 * // Access desktop agent
 * platform.agent
 * platform.connector
 *
 * // Access platform features
 * await platform.workspaces.list()
 * await platform.layouts.save(workspaceId, layout)
 * await platform.config.get()
 *
 * await platform.stop()
 * ```
 */
export class SailPlatform {
  private readonly config: SailPlatformConfig
  private platformClient: SailPlatformClient
  private started = false

  // Browser Desktop Agent session (created on start via preset)
  private _desktopAgent: BrowserDesktopAgent | null = null
  private _wcpConnector: WCPConnector | null = null
  private _stopBrowserSession: (() => void) | null = null

  // Namespaced APIs (initialized in constructor)
  public readonly workspaces: WorkspacesApi
  public readonly layouts: LayoutsApi
  public readonly sailConfig: ConfigApi // Renamed to avoid conflict with config property

  constructor(config: SailPlatformConfig) {
    this.config = config
    this.platformClient = new SailPlatformClient(config.storage)

    // Initialize namespaced APIs
    this.workspaces = this.createWorkspacesApi()
    this.layouts = this.createLayoutsApi()
    this.sailConfig = this.createConfigApi()
  }

  // ===== Lifecycle =====

  /**
   * Start the platform and desktop agent.
   */
  start(): void {
    if (this.started) {
      throw new Error("SailPlatform already started")
    }

    const desktopAgent = createBrowserDesktopAgent({
      appLauncher: this.config.appLauncher,
      apps: this.config.apps,
      appDirectories: this.config.appDirectories,
      userChannels: this.config.userChannels,
      implementationMetadata: this.config.implementationMetadata,
      openContextListenerTimeoutMs: this.config.openContextListenerTimeoutMs,
      heartbeatEnabled: this.config.heartbeatEnabled,
      heartbeatIntervalMs: this.config.heartbeatIntervalMs,
      heartbeatTimeoutMs: this.config.heartbeatTimeoutMs,
      intentResolver: this.config.intentResolver,
      wcpOptions: {
        // Sail controls UI externally (no injected iframes)
        getIntentResolverUrl: () => false,
        getChannelSelectorUrl: () => false,
        fdc3Version: "2.2",
      },
    })

    const { wcpConnector } = getBrowserDesktopAgentSession(desktopAgent)

    this._desktopAgent = desktopAgent
    this._wcpConnector = wcpConnector
    this._stopBrowserSession = () => desktopAgent.stop()

    this.wireEvents()

    this.started = true

    if (this.config.debug) {
      console.log("[SailPlatform] Started")
    }
  }

  /**
   * Stop the platform and desktop agent.
   */
  stop(): void {
    if (!this.started) {
      return
    }

    this._stopBrowserSession?.()

    this._wcpConnector = null
    this._desktopAgent = null
    this._stopBrowserSession = null
    this.started = false

    if (this.config.debug) {
      console.log("[SailPlatform] Stopped")
    }
  }

  // ===== Accessors =====

  /**
   * Get the underlying DesktopAgent instance.
   * @throws Error if platform not started
   */
  get agent(): DesktopAgent {
    this.ensureStarted()
    return this._desktopAgent!
  }

  /**
   * Grouped host channel chrome over the browser Desktop Agent preset.
   * Prefer this over raw {@link connector} `channelChanged` for host UI.
   */
  get channels(): BrowserChannelsController {
    this.ensureStarted()
    return this._desktopAgent!.channels
  }

  /**
   * Grouped host intent resolver chrome over the browser Desktop Agent preset.
   */
  get intentResolver(): BrowserIntentResolverController {
    this.ensureStarted()
    return this._desktopAgent!.intentResolver
  }

  /**
   * Grouped app catalog and instance lifecycle chrome over the browser preset.
   */
  get apps(): BrowserAppsController {
    this.ensureStarted()
    return this._desktopAgent!.apps
  }

  /**
   * Get the WCP Connector for managing app connections.
   * Advanced integrators only — host UI should use {@link channels}, {@link intentResolver}, and {@link apps}.
   * @throws Error if platform not started
   */
  get connector(): WCPConnector {
    this.ensureStarted()
    return this._wcpConnector!
  }

  /**
   * Check if the platform is currently running.
   */
  get isRunning(): boolean {
    return this.started
  }

  // ===== Channel Management =====

  /**
   * Change an app's channel membership on behalf of the host shell.
   *
   * Updates agent state via {@link DesktopAgent.changeAppUserChannel} and resolves
   * when the WCP connector emits `channelChanged` (push model for host UI).
   * Do not poll `getState()` — use {@link getAppUserChannel} for one-off reads.
   *
   * @param instanceId - The app instance to change channel for
   * @param channelId - The channel ID to join, or null to leave current channel
   * @returns Promise that resolves when the channel change is confirmed
   */
  async changeAppChannel(instanceId: string, channelId: string | null): Promise<void> {
    this.ensureStarted()
    return this.channels.changeAppChannel(instanceId, channelId)
  }

  /**
   * Get the available user channels.
   */
  getUserChannels(): BrowserTypes.Channel[] {
    this.ensureStarted()
    return this.channels.getUserChannels()
  }

  /**
   * Read an app's current user channel from Desktop Agent state.
   *
   * Does not send DACP on behalf of the app — use for host chrome that needs
   * an authoritative read without waiting for channel push events.
   *
   * @param instanceId - Connected app instance id
   * @returns Channel id when joined; `null` when not on a channel or instance unknown
   */
  getAppUserChannel(instanceId: string): string | null {
    this.ensureStarted()
    return this.channels.getAppChannelId(instanceId)
  }

  // ===== Private Methods =====

  private ensureStarted(): void {
    if (!this.started || !this._desktopAgent) {
      throw new Error("SailPlatform not started. Call start() first.")
    }
  }

  /**
   * Wire grouped host controllers to config callbacks.
   *
   * SailPlatform is stateless - it forwards events to consumers who manage their own state.
   */
  private wireEvents(): void {
    if (!this._desktopAgent) return

    const { apps, channels } = this._desktopAgent

    if (this.config.onAppConnected) {
      apps.onConnect(this.config.onAppConnected)
    }

    if (this.config.onAppDisconnected) {
      apps.onDisconnect(this.config.onAppDisconnected)
    }

    if (this.config.onChannelChanged) {
      channels.onAppChannelChange(event => {
        this.config.onChannelChanged!(event.instanceId, event.channelId)
      })
    }

    if (this.config.onHandshakeFailed) {
      apps.onHandshakeFailure(event => {
        this.config.onHandshakeFailed!(event.error, event.connectionAttemptUuid)
      })
    }
  }

  // ===== Namespaced API Factories =====

  private createWorkspacesApi(): WorkspacesApi {
    return {
      list: () => this.platformClient.getWorkspaces(),
      get: (workspaceId: string) => this.platformClient.getWorkspace(workspaceId),
      create: (name: string, initialLayout?: unknown) =>
        this.platformClient.createWorkspace(name, initialLayout),
      delete: (workspaceId: string) => this.platformClient.deleteWorkspace(workspaceId),
    }
  }

  private createLayoutsApi(): LayoutsApi {
    return {
      get: (workspaceId: string) => this.platformClient.getWorkspaceLayout(workspaceId),
      save: (workspaceId: string, layout: unknown) =>
        this.platformClient.saveWorkspaceLayout(workspaceId, layout),
    }
  }

  private createConfigApi(): ConfigApi {
    return {
      get: () => this.platformClient.getConfig(),
      update: (config: unknown) => this.platformClient.updateConfig(config),
    }
  }
}
