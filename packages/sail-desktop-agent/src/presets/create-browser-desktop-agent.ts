/**
 * Browser Desktop Agent preset — local DA + WCP edge + host intent resolver wiring.
 */

import type { Context } from "@finos/fdc3"
import { DesktopAgent } from "../core/desktop-agent"
import type { DesktopAgentOptions } from "../core/desktop-agent"
import type { AgentState } from "../core/state/types"
import { loadDirectoryIntoState } from "../core/state/mutators/app-directory"
import type { SailImplementationMetadata } from "../core/sail-default-config"
import { consoleLogger } from "../core/interfaces/logger"
import type { Logger, LogPayloadDetail } from "../core/interfaces/logger"
import { WCPConnector } from "../app-connection/wcp-connector"
import type { AppConnectionMetadata, WCPConnectorOptions } from "../app-connection/wcp-connector"
import { createBrowserDesktopAgentEdgeLink } from "../app-connection/browser-da-edge-link"
import {
  createHostIntentResolver,
  type HostIntentResolverChoice,
  type HostIntentResolverHandler,
  type IntentHandler,
  type IntentResolutionChoice,
  type IntentResolver,
  type IntentResolverUIMethods,
  type IntentResolutionRequest,
} from "../host-contracts"
import {
  createBrowserHostControllers,
  getBrowserDesktopAgentSession,
  registerBrowserDesktopAgentSession,
  type BrowserHostControllers,
} from "./browser-session.js"

const DEFAULT_WCP_INTENT_RESOLUTION_TIMEOUT_MS = 60000
const HOST_RESOLVER_TIMEOUT_BUFFER_MS = 1000

/** Preset-only access to DesktopAgent private state for async directory URL loading. */
type DesktopAgentMutableState = { state: AgentState }

async function loadAppDirectoriesFromUrls(agent: DesktopAgent, urls: string[]): Promise<void> {
  const internal = agent as unknown as DesktopAgentMutableState
  for (const url of urls) {
    internal.state = await loadDirectoryIntoState(internal.state, url)
  }
}

/**
 * Options for {@link createBrowserDesktopAgent}.
 */
export interface BrowserDesktopAgentOptions extends Pick<
  DesktopAgentOptions,
  | "appLauncher"
  | "userChannels"
  | "apps"
  | "openContextListenerTimeoutMs"
  | "heartbeatEnabled"
  | "heartbeatIntervalMs"
  | "heartbeatTimeoutMs"
> {
  implementationMetadata?: Partial<SailImplementationMetadata>
  wcpOptions?: WCPConnectorOptions
  appDirectories?: string[]
  logger?: Logger
  logPayloadDetail?: LogPayloadDetail
  /**
   * Call {@link DesktopAgent.start} before returning.
   * @defaultValue `true`
   */
  autoStart?: boolean
  onAppConnected?: (metadata: AppConnectionMetadata) => void
  onAppDisconnected?: (instanceId: string) => void
  onHandshakeFailed?: (error: Error, connectionAttemptUuid: string) => void
  /** Host intent resolver; wired to WCPConnector `intentResolverNeeded`. */
  intentResolver?: IntentResolver
}

export type BrowserDesktopAgent = DesktopAgent &
  BrowserHostControllers & {
    readonly intentResolverUI?: IntentResolverUIMethods
  }

function wireBrowserDesktopAgentLifecycle(
  desktopAgent: DesktopAgent,
  wcpConnector: WCPConnector
): void {
  const originalStart = desktopAgent.start.bind(desktopAgent)
  const originalStop = desktopAgent.stop.bind(desktopAgent)

  desktopAgent.start = () => {
    if (!wcpConnector.getIsStarted()) {
      wcpConnector.start()
    }
    originalStart()
  }

  desktopAgent.stop = () => {
    wcpConnector.stop()
    originalStop()
  }
}

function hasIntentResolverUI(
  resolver: IntentResolver
): resolver is IntentResolver & IntentResolverUIMethods {
  const candidate = resolver as Partial<IntentResolverUIMethods>
  return (
    typeof candidate.onRequest === "function" &&
    typeof candidate.select === "function" &&
    typeof candidate.cancel === "function" &&
    typeof candidate.getPendingRequests === "function"
  )
}

function mapHandler(intentName: string, handler: HostIntentResolverHandler): IntentHandler {
  return {
    app: handler,
    intent: { name: intentName, displayName: intentName },
    instanceId: handler.instanceId,
    isRunning: handler.isRunning,
  }
}

function mapChoice(choice: HostIntentResolverChoice): IntentResolutionChoice {
  return {
    intent: choice.intent,
    handler: {
      ...mapHandler(choice.intent.name, choice.handler),
      intent: choice.intent,
    },
  }
}

function wireIntentResolver(wcpConnector: WCPConnector, resolver: IntentResolver): void {
  wcpConnector.on("intentResolverNeeded", payload => {
    void (async () => {
      try {
        const request: IntentResolutionRequest = {
          requestId: payload.requestId,
          intent: payload.intent,
          context: payload.context as Context,
          handlers:
            payload.choices?.map(choice => mapChoice(choice).handler) ??
            payload.handlers.map(handler => mapHandler(payload.intent, handler)),
          choices:
            payload.choices?.map(choice => mapChoice(choice)) ??
            payload.handlers.map(handler => ({
              intent: { name: payload.intent, displayName: payload.intent },
              handler: mapHandler(payload.intent, handler),
            })),
        }

        const response = await resolver.resolve(request)

        wcpConnector.resolveIntentSelection({
          requestId: payload.requestId,
          selectedHandler: response
            ? {
                appId: response.target.appId,
                instanceId: response.target.instanceId,
              }
            : null,
          ...(response?.intent ? { intent: response.intent } : {}),
        })
      } catch {
        wcpConnector.resolveIntentSelection({
          requestId: payload.requestId,
          selectedHandler: null,
        })
      }
    })()
  })
}

/**
 * Create a browser Desktop Agent with WCP edge coupled to {@link DesktopAgent.start}.
 */
export function createBrowserDesktopAgent(
  options?: BrowserDesktopAgentOptions
): BrowserDesktopAgent {
  const { intentResolver: providedIntentResolver, autoStart, ...localOptions } = options ?? {}
  const logger = localOptions.logger ?? consoleLogger

  const wcpIntentResolutionTimeout =
    localOptions.wcpOptions?.intentResolutionTimeout ?? DEFAULT_WCP_INTENT_RESOLUTION_TIMEOUT_MS
  const hostIntentResolver =
    providedIntentResolver ??
    createHostIntentResolver({
      timeoutMs: Math.max(0, wcpIntentResolutionTimeout - HOST_RESOLVER_TIMEOUT_BUFFER_MS),
    })
  const intentResolverUI = hasIntentResolverUI(hostIntentResolver) ? hostIntentResolver : undefined

  const [daEdge, wcpEdge] = createBrowserDesktopAgentEdgeLink()
  const wcpConnector = new WCPConnector(wcpEdge, {
    ...localOptions.wcpOptions,
    logger,
  })

  const desktopAgent = new DesktopAgent({
    transport: daEdge,
    appLauncher: localOptions.appLauncher,
    apps: localOptions.apps,
    userChannels: localOptions.userChannels,
    implementationMetadata: localOptions.implementationMetadata,
    openContextListenerTimeoutMs: localOptions.openContextListenerTimeoutMs,
    heartbeatEnabled: localOptions.heartbeatEnabled,
    heartbeatIntervalMs: localOptions.heartbeatIntervalMs,
    heartbeatTimeoutMs: localOptions.heartbeatTimeoutMs,
    logger,
    logPayloadDetail: localOptions.logPayloadDetail,
    requestIntentResolution: request => wcpConnector.requestIntentResolution(request),
  }) as BrowserDesktopAgent

  const agentWithState = desktopAgent as unknown as DesktopAgentMutableState
  wcpConnector.bindAgentState({
    getAgentState: () => desktopAgent.getState(),
    setAgentState: callback => {
      agentWithState.state = callback(agentWithState.state)
    },
  })

  if (localOptions.appDirectories && localOptions.appDirectories.length > 0) {
    void loadAppDirectoriesFromUrls(desktopAgent, localOptions.appDirectories)
  }

  wcpConnector.on("appConnected", metadata => {
    logger.info(`[BrowserDA] App connected: ${metadata.appId} (${metadata.instanceId})`)
    localOptions.onAppConnected?.(metadata)
  })

  wcpConnector.on("appDisconnected", instanceId => {
    logger.info(`[BrowserDA] App disconnected: ${instanceId}`)
    localOptions.onAppDisconnected?.(instanceId)
  })

  wcpConnector.on("handshakeFailed", (error, connectionAttemptUuid) => {
    logger.error(`[BrowserDA] WCP handshake failed for ${connectionAttemptUuid}:`, error)
    localOptions.onHandshakeFailed?.(error, connectionAttemptUuid)
  })

  registerBrowserDesktopAgentSession(desktopAgent, { wcpConnector })
  wireBrowserDesktopAgentLifecycle(desktopAgent, wcpConnector)

  if (intentResolverUI) {
    Object.defineProperty(desktopAgent, "intentResolverUI", {
      value: intentResolverUI,
      enumerable: true,
      configurable: false,
    })
  }

  const controllers = createBrowserHostControllers({
    desktopAgent,
    wcpConnector,
    intentResolverUI,
  })

  for (const [key, controller] of Object.entries(controllers) as Array<
    [keyof BrowserHostControllers, BrowserHostControllers[keyof BrowserHostControllers]]
  >) {
    Object.defineProperty(desktopAgent, key, {
      value: controller,
      enumerable: true,
      configurable: false,
    })
  }

  const session = getBrowserDesktopAgentSession(desktopAgent)
  session.intentResolverUI = intentResolverUI
  wireIntentResolver(session.wcpConnector, hostIntentResolver)

  if (autoStart !== false) {
    desktopAgent.start()
  }

  return desktopAgent
}
