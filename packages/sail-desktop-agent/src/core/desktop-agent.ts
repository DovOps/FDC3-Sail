/**
 * FDC3 Desktop Agent
 *
 * Pure, environment-agnostic implementation of the FDC3 Desktop Agent.
 * All external dependencies (transport, app launcher, registries) are injected
 * via constructor, making this portable across different environments
 * (browser, Node.js, Electron, etc.)
 */

import type { Transport } from "./interfaces/transport"
import type { AppLauncher } from "../host-contracts/app-launcher"
import { routeDACPMessage, cleanupDACPHandlers } from "./handlers/dacp"
import { createDacpResponseDispatcher } from "./handlers/dacp/utils/dacp-response-utils"
import type {
  DACPHandlerContext,
  MessageValidator,
  PendingIntentPromiseEntry,
} from "./handlers/types"
import type { IntentResolutionCallback } from "./handlers/dacp/intent-resolution-callback"
import type { DirectoryApp } from "./app-directory/types"
import { addApp } from "./state/mutators/app-directory"
import type { BrowserTypes } from "@finos/fdc3"
import type { AgentState, StateSetter } from "./state/types"
import { createInitialState, createStateWithOverrides } from "./state/initial-state"
import { consoleLogger, type Logger, type LogPayloadDetail } from "./interfaces/logger"
import { resolveDesktopAgentConfig, type SailImplementationMetadata } from "./sail-default-config"
import { InMemoryTransport } from "../transports/in-memory-transport"
import {
  handleJoinUserChannelRequest,
  handleLeaveCurrentChannelRequest,
} from "./handlers/dacp/channel-handlers"
import { NoChannelFoundError } from "./errors/fdc3-errors"
import { getAllUserChannels, getInstance, getUserChannel } from "./state/selectors"
import { connectInstance } from "./state/mutators"

/**
 * Structure of DACP message metadata for routing
 */
interface DACPMessageMeta {
  source?: {
    instanceId?: string
  }
  destination?: {
    instanceId?: string
  }
}

/**
 * Options for creating a Desktop Agent. Omitted fields use FDC3-Sail product
 * defaults from `sail-default-config.ts` (merged in the constructor).
 */
export interface DesktopAgentOptions {
  /**
   * Transport for bidirectional message communication.
   * Defaults to an unpaired `InMemoryTransport` (dev/tests only — use a pair in browser).
   */
  transport?: Transport

  appLauncher?: AppLauncher
  /** Pre-seeded catalog apps (merged into `state.appDirectory.apps` at construction). */
  apps?: DirectoryApp[]
  userChannels?: BrowserTypes.Channel[]
  requestIntentResolution?: IntentResolutionCallback
  validator?: MessageValidator
  /**
   * Injectable logger sink for agent-internal structured logs.
   *
   * @remarks Pair with {@link DesktopAgentOptions.logPayloadDetail}: the logger
   * selects where output goes; `logPayloadDetail` selects how much payload is
   * included (metadata at info/warn/error; full JSON at debug when `'full'`).
   */
  logger?: Logger
  /**
   * How much message/context detail agent-internal structured logs include.
   *
   * @defaultValue 'metadata'
   *
   * - `'metadata'` — log type, ids, contextType, key names only; never full
   *   context JSON at info/warn/error.
   * - `'full'` — may include serialized payloads on {@link Logger.debug} only;
   *   requires a logger that implements `debug`.
   *
   * @remarks Use with {@link DesktopAgentOptions.logger}: config selects *what*
   * to log; the logger selects *where* it goes.
   */
  logPayloadDetail?: LogPayloadDetail
  initialState?: Partial<AgentState>

  /** Partial overrides merged with {@link DEFAULT_SAIL_IMPLEMENTATION_METADATA}. */
  implementationMetadata?: Partial<SailImplementationMetadata>

  openContextListenerTimeoutMs?: number
  /**
   * When `true`, the agent sends DACP `heartbeatEvent` messages for liveness after WCP5.
   * FDC3 2.2 leaves this as a Desktop Agent policy (apps cannot opt out via `getAgent()`).
   *
   * @defaultValue `true`
   */
  heartbeatEnabled?: boolean
  heartbeatIntervalMs?: number
  heartbeatTimeoutMs?: number
}

/**
 * Fully resolved Desktop Agent configuration after Sail defaults are applied.
 */
export interface DesktopAgentConfig {
  transport?: Transport
  appLauncher?: AppLauncher
  apps?: DirectoryApp[]
  userChannels: BrowserTypes.Channel[]
  requestIntentResolution?: IntentResolutionCallback
  validator?: MessageValidator
  logger?: Logger
  logPayloadDetail: LogPayloadDetail
  initialState?: Partial<AgentState>
  implementationMetadata: SailImplementationMetadata
  openContextListenerTimeoutMs: number
  heartbeatEnabled: boolean
  heartbeatIntervalMs: number
  heartbeatTimeoutMs: number
}

/**
 * Pure FDC3 Desktop Agent implementation.
 *
 * This class is environment-agnostic and has zero dependencies on specific
 * transport mechanisms, UI frameworks, or runtime environments. All external
 * concerns are injected via the constructor.
 *
 * When no `transport` is provided, the constructor defaults to an unpaired
 * `new InMemoryTransport()`. That default is not suitable for production
 * browser bridge use — browser deployments must use `createInMemoryTransportPair()`
 * (see `createBrowserDesktopAgent()` in `@finos/sail-desktop-agent/browser`).
 *
 * @example
 * ```typescript
 * import { createInMemoryTransportPair } from "../transports/in-memory-transport"
 *
 * // Browser: prefer createBrowserDesktopAgent() or a transport pair
 * const [daTransport] = createInMemoryTransportPair()
 * const agent = new DesktopAgent({
 *   transport: daTransport,
 *   implementationMetadata: { provider: "My Desk" },
 * })
 * agent.start()
 * ```
 */
export class DesktopAgent {
  private state: AgentState
  private transport: Transport
  private appLauncher?: AppLauncher
  private requestIntentResolution?: IntentResolutionCallback
  private validator?: MessageValidator
  private logger: Logger
  private logPayloadDetail: LogPayloadDetail
  private isStarted: boolean = false
  private implementationMetadata: SailImplementationMetadata
  private openContextListenerTimeoutMs: number
  private heartbeatEnabled: boolean
  private heartbeatIntervalMs: number
  private heartbeatTimeoutMs: number
  private pendingIntentPromises = new Map<string, PendingIntentPromiseEntry>()

  constructor(options: DesktopAgentOptions) {
    const config = resolveDesktopAgentConfig(options)

    this.transport = config.transport ?? new InMemoryTransport()
    this.implementationMetadata = config.implementationMetadata
    this.openContextListenerTimeoutMs = config.openContextListenerTimeoutMs
    this.heartbeatEnabled = config.heartbeatEnabled
    this.heartbeatIntervalMs = config.heartbeatIntervalMs
    this.heartbeatTimeoutMs = config.heartbeatTimeoutMs
    // userChannels config seeds state once; runtime reads use state.channels.user only.
    this.state = config.initialState
      ? createStateWithOverrides(config.initialState, config.userChannels)
      : createInitialState(config.userChannels)

    if (config.apps) {
      for (const app of config.apps) {
        this.state = addApp(this.state, app)
      }
    }

    this.appLauncher = config.appLauncher
    this.requestIntentResolution = config.requestIntentResolution
    this.validator = config.validator
    this.logger = config.logger ?? consoleLogger
    this.logPayloadDetail = config.logPayloadDetail
  }

  /**
   * Start the Desktop Agent by wiring up transport message handlers.
   * Call this after construction to begin processing messages.
   */
  start(): void {
    if (this.isStarted) {
      throw new Error("DesktopAgent is already started")
    }

    // Set up message handler
    this.transport.onMessage(async message => {
      await this.handleMessage(message)
    })

    // Set up disconnect handler
    this.transport.onDisconnect(() => {
      this.handleDisconnect()
    })

    this.isStarted = true
  }

  /**
   * Stop the Desktop Agent and clean up resources.
   */
  stop(): void {
    if (!this.isStarted) {
      return
    }

    this.transport.disconnect()
    this.isStarted = false
  }
  /**
   * Handle an incoming DACP message from an app and route it.
   */
  private async handleMessage(message: unknown): Promise<void> {
    const messageType = (message as { type?: string })?.type
    if (messageType?.startsWith("WCP")) {
      await this.handleWcpMessage(message)
      return
    }

    // Only process messages FROM apps (have source.instanceId)
    // Messages TO apps (have destination.instanceId but no source) should pass through
    const instanceId = this.extractInstanceId(message)

    if (!instanceId) {
      // Message has no source.instanceId - this is likely a message going TO an app
      // (e.g., contextEvent, responses). Let it pass through without processing.
      return
    }

    const context = this.createHandlerContext(instanceId)
    await routeDACPMessage(message, context)
  }
  /**
   * Extract instanceId from DACP message metadata.
   * Messages from apps have meta.source.instanceId set by WCPConnector; messages to apps do not.
   */
  private extractInstanceId(message: unknown): string | null {
    if (!message || typeof message !== "object") {
      return null
    }

    const messageObj = message as { meta?: DACPMessageMeta }
    return messageObj.meta?.source?.instanceId || null
  }
  private async handleWcpMessage(message: unknown): Promise<void> {
    if (!message || typeof message !== "object") {
      return
    }

    const messageObj = message as {
      type?: string
      meta?: { connectionAttemptUuid?: string }
    }

    if (messageObj.type === "WCP4ValidateAppIdentity") {
      const connectionAttemptUuid = messageObj.meta?.connectionAttemptUuid
      if (!connectionAttemptUuid) {
        this.logger.warn("[WCP4] Missing connectionAttemptUuid, cannot route message")
        return
      }

      const tempInstanceId = `temp-${connectionAttemptUuid}`
      const wcpContext = this.createHandlerContext(tempInstanceId)
      await routeDACPMessage(message, wcpContext)
      return
    }

    const instanceId = this.extractInstanceId(message) ?? this.transport.getInstanceId()
    if (!instanceId) {
      this.logger.warn("[WCP] Missing instanceId, cannot route message", {
        messageType: messageObj.type,
      })
      return
    }

    const wcpContext = this.createHandlerContext(instanceId)
    await routeDACPMessage(message, wcpContext)
  }
  /**
   * Handle transport-level disconnection; app disconnects use WCP6Goodbye/heartbeat.
   */
  private handleDisconnect(): void {
    // Transport is already disconnected - we cannot send messages
    // Clean up all instances from internal state
    const allInstances = Object.values(this.state.instances)
    for (const instance of allInstances) {
      // createHandlerContext is needed because cleanupDACPHandlers requires
      // a DACPHandlerContext with responses, instanceId, getState, setState, logger, etc.
      const context = this.createHandlerContext(instance.instanceId)
      cleanupDACPHandlers(context)
    }
  }
  /**
   * Create the handler context for DACP message handlers.
   * @param instanceId - The app instance ID extracted from message metadata
   */
  private createHandlerContext(instanceId: string): DACPHandlerContext {
    const setState: StateSetter = callback => {
      this.state = callback(this.state)
    }
    return {
      responses: createDacpResponseDispatcher(this.transport),
      instanceId,
      getState: () => this.getState(),
      setState,
      appLauncher: this.appLauncher,
      requestIntentResolution: this.requestIntentResolution,
      validator: this.validator,
      logger: this.logger,
      logPayloadDetail: this.logPayloadDetail,
      implementationMetadata: this.implementationMetadata,
      openContextListenerTimeoutMs: this.openContextListenerTimeoutMs,
      heartbeatEnabled: this.heartbeatEnabled,
      heartbeatIntervalMs: this.heartbeatIntervalMs,
      heartbeatTimeoutMs: this.heartbeatTimeoutMs,
      pendingIntentPromises: this.pendingIntentPromises,
    }
  }
  /**
   * Full agent state snapshot — **tests and debugging only**.
   *
   * Do not use for host channel UI. Prefer {@link getAppUserChannelId},
   * {@link getUserChannels}, and WCP connector `channelChanged` events (or
   * platform-api `getAppUserChannel` / `changeAppChannel` when using SailPlatform).
   * Mutating the returned object bypasses Desktop Agent invariants.
   */
  getState(): AgentState {
    return this.state
  }

  /**
   * Pre-register a host-assigned instance id before WCP4 (same contract as openRequest pre-register).
   * Used when the host sets iframe/window `name` before the app connects.
   */
  registerPendingHostInstance(params: { appId: string; instanceId: string }): void {
    if (getInstance(this.state, params.instanceId)) {
      return
    }

    this.state = connectInstance(this.state, {
      instanceId: params.instanceId,
      appId: params.appId,
      metadata: {
        appId: params.appId,
        name: params.appId,
      },
    })
  }

  /**
   * Tear down DACP state for an app instance (pending intents, listeners, heartbeat, registry).
   * Same path as WCP6 goodbye and heartbeat timeout cleanup.
   */
  disconnectInstance(instanceId: string): void {
    cleanupDACPHandlers(this.createHandlerContext(instanceId))
  }

  /** Export state as JSON string (for debugging/persistence) */
  exportState(): string {
    return JSON.stringify(this.state, null, 2)
  }

  /** Check if the agent is started */
  getIsStarted(): boolean {
    return this.isStarted
  }
  /**
   * Get the implementation metadata (for testing/inspection)
   */
  getImplementationMetadata(): SailImplementationMetadata {
    return this.implementationMetadata
  }
  /**
   * Get user channels from agent state (same source as DACP getUserChannelsResponse).
   */
  getUserChannels(): BrowserTypes.Channel[] {
    return getAllUserChannels(this.state)
  }

  /**
   * Read the app's current user channel from agent state (no DACP round-trip).
   *
   * @returns Channel id when the instance exists and has joined a user channel; otherwise `null`.
   */
  getAppUserChannelId(instanceId: string): string | null {
    const instance = getInstance(this.state, instanceId)
    return instance?.currentUserChannel ?? null
  }

  /**
   * Host-initiated user channel join or leave for an app instance.
   *
   * Runs the same DACP join/leave handlers as app-originated requests but does not
   * require an app MessagePort to receive the response. When no apps registered
   * `channelChanged` event listeners, emits a `channelChangedEvent` on the transport
   * so the WCP connector can raise `channelChanged` for host UI (push model).
   */
  changeAppUserChannel(instanceId: string, channelId: string | null): void {
    if (channelId !== null && !getUserChannel(this.state, channelId)) {
      throw new NoChannelFoundError(`Channel ${channelId} does not exist`)
    }

    const context = this.createHandlerContext(instanceId)
    const requestUuid = crypto.randomUUID()
    const instance = getInstance(this.state, instanceId)
    const source: BrowserTypes.AppIdentifier = {
      appId: instance?.appId ?? "unknown",
      instanceId,
    }
    const meta: BrowserTypes.AppRequestMessageMeta = {
      requestUuid,
      timestamp: new Date(),
      source,
    }

    if (channelId !== null) {
      handleJoinUserChannelRequest(
        {
          type: "joinUserChannelRequest",
          payload: { channelId },
          meta,
        },
        context
      )
    } else {
      handleLeaveCurrentChannelRequest(
        {
          type: "leaveCurrentChannelRequest",
          payload: {},
          meta,
        },
        context
      )
    }
  }
}
