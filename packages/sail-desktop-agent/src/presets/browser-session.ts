import type { BrowserTypes, Context } from "@finos/fdc3"

import { retrieveAllApps, retrieveAppsById } from "../core/app-directory/app-directory-queries"
import type { DirectoryApp } from "../core/app-directory/types"
import type { DesktopAgent } from "../core/desktop-agent"
import type { AppLauncher } from "../host-contracts/app-launcher"
import type { AgentState, AppInstance } from "../core/state/types"
import { AppInstanceState } from "../core/state/types"
import {
  addApp,
  addApplications,
  loadDirectoryIntoState,
  removeApplicationsByAppId,
} from "../core/state/mutators/app-directory"
import { getAllInstances, getInstance } from "../core/state/selectors/instance"
import type { WCPConnector } from "../app-connection/wcp-connector"
import type { AppConnectionMetadata } from "../app-connection/wcp/wcp-types"
import type {
  BrowserIntentResolverController,
  IntentHandler,
  IntentResolutionChoice,
  IntentResolutionRequest,
  IntentResolverUIMethods,
} from "../host-contracts"

export type { BrowserIntentResolverController } from "../host-contracts"

/** Options for host-initiated {@link BrowserAppsController.open}. */
export interface BrowserAppOpenOptions {
  context?: Context
  instanceId?: string
}

/** Host-facing app instance snapshot (pending until WCP5, then connected). */
export interface BrowserAppInstance {
  appId: string
  instanceId: string
  status: "pending" | "connected"
  currentUserChannel?: string | null
}

/** WCP handshake failure surfaced to host apps controller subscribers. */
export interface HandshakeFailureEvent {
  error: Error
  connectionAttemptUuid: string
}

/** Grouped browser host controllers attached to the preset handle. */
export interface BrowserHostControllers {
  intentResolver: BrowserIntentResolverController
  channels: BrowserChannelsController
  apps: BrowserAppsController
}

/** Host notification when an app's user channel membership changes. */
export interface AppChannelChangeEvent {
  instanceId: string
  channelId: string | null
  channel: BrowserTypes.Channel | null
}

/** Browser host channel chrome over DesktopAgent + WCP connector events. */
export interface BrowserChannelsController {
  getUserChannels: () => BrowserTypes.Channel[]
  getAppChannelId: (instanceId: string) => string | null
  getAppChannel: (instanceId: string) => BrowserTypes.Channel | null
  changeAppChannel: (instanceId: string, channelId: string | null) => Promise<void>
  onAppChannelChange: (listener: (event: AppChannelChangeEvent) => void) => () => void
}

/** App catalog and instance lifecycle host chrome for the browser preset. */
export interface BrowserAppsController {
  add: (app: DirectoryApp) => void
  addAll: (apps: DirectoryApp[]) => void
  addDirectory: (url: string) => Promise<void>
  /** Removes all catalog entries whose appId matches case-insensitively. */
  remove: (appId: string) => void
  getAll: () => DirectoryApp[]
  getById: (appId: string) => DirectoryApp | undefined
  open: (
    app: string | BrowserTypes.AppIdentifier,
    options?: BrowserAppOpenOptions
  ) => Promise<BrowserTypes.AppIdentifier>
  getInstances: () => BrowserAppInstance[]
  getInstance: (instanceId: string) => BrowserAppInstance | undefined
  getConnections: () => AppConnectionMetadata[]
  getConnection: (instanceId: string) => AppConnectionMetadata | undefined
  disconnect: (instanceId: string) => void
  onConnect: (listener: (metadata: AppConnectionMetadata) => void) => () => void
  onDisconnect: (listener: (instanceId: string) => void) => () => void
  onHandshakeFailure: (listener: (event: HandshakeFailureEvent) => void) => () => void
}

export interface BrowserHostControllerOptions {
  desktopAgent: DesktopAgent
  wcpConnector: WCPConnector
  intentResolverUI?: IntentResolverUIMethods
}

export interface BrowserDesktopAgentSession {
  wcpConnector: WCPConnector
  intentResolverUI?: IntentResolverUIMethods
}

const browserDesktopAgentSessions = new WeakMap<DesktopAgent, BrowserDesktopAgentSession>()

/** Preset-only access to DesktopAgent private state and injected launcher. */
type DesktopAgentInternals = {
  state: AgentState
  appLauncher?: AppLauncher
}

function getDesktopAgentInternals(desktopAgent: DesktopAgent): DesktopAgentInternals {
  return desktopAgent as unknown as DesktopAgentInternals
}

function resolveOpenAppIdentifier(
  app: string | BrowserTypes.AppIdentifier,
  options?: BrowserAppOpenOptions
): BrowserTypes.AppIdentifier {
  if (typeof app === "string") {
    return options?.instanceId ? { appId: app, instanceId: options.instanceId } : { appId: app }
  }
  return options?.instanceId ? { ...app, instanceId: options.instanceId } : app
}

function mapToBrowserAppInstance(instance: AppInstance): BrowserAppInstance {
  return {
    appId: instance.appId,
    instanceId: instance.instanceId,
    status: instance.state === AppInstanceState.CONNECTED ? "connected" : "pending",
    currentUserChannel: instance.currentUserChannel,
  }
}

export function registerBrowserDesktopAgentSession(
  desktopAgent: DesktopAgent,
  session: BrowserDesktopAgentSession
): void {
  browserDesktopAgentSessions.set(desktopAgent, session)
}

export function isBrowserDesktopAgent(desktopAgent: DesktopAgent): boolean {
  return browserDesktopAgentSessions.has(desktopAgent)
}

/**
 * Edge internals for a {@link DesktopAgent} created by {@link createBrowserDesktopAgent}.
 * Integrators normally do not need this — use {@link SailPlatform} or host contracts instead.
 */
export function getBrowserDesktopAgentSession(
  desktopAgent: DesktopAgent
): BrowserDesktopAgentSession {
  const session = browserDesktopAgentSessions.get(desktopAgent)
  if (!session) {
    throw new Error(
      "Not a browser Desktop Agent from createBrowserDesktopAgent(). Use getBrowserDesktopAgentSession only on preset instances."
    )
  }
  return session
}

export function clearBrowserDesktopAgentSession(desktopAgent: DesktopAgent): void {
  browserDesktopAgentSessions.delete(desktopAgent)
}

/**
 * Build grouped browser host controllers for preset or manual DesktopAgent + WCP wiring.
 * Methods are closure-based so hosts can destructure them safely.
 */
function resolveUserChannelById(
  desktopAgent: DesktopAgent,
  channelId: string | null
): BrowserTypes.Channel | null {
  if (channelId === null) {
    return null
  }
  return desktopAgent.getUserChannels().find(channel => channel.id === channelId) ?? null
}

export function createBrowserHostControllers(
  options: BrowserHostControllerOptions
): BrowserHostControllers {
  const { desktopAgent, wcpConnector, intentResolverUI } = options
  const agentInternals = getDesktopAgentInternals(desktopAgent)

  const intentResolver: BrowserIntentResolverController = {
    getPendingRequests: () => intentResolverUI?.getPendingRequests() ?? [],
    onRequest: (listener: (request: IntentResolutionRequest) => void) =>
      intentResolverUI?.onRequest(listener) ?? (() => {}),
    select: (requestId: string, choice: IntentResolutionChoice | IntentHandler) => {
      intentResolverUI?.select(requestId, choice)
    },
    cancel: (requestId: string) => {
      intentResolverUI?.cancel(requestId)
    },
  }

  const channels: BrowserChannelsController = {
    getUserChannels: () => desktopAgent.getUserChannels(),
    getAppChannelId: instanceId => desktopAgent.getAppUserChannelId(instanceId),
    getAppChannel: instanceId => {
      const channelId = desktopAgent.getAppUserChannelId(instanceId)
      return resolveUserChannelById(desktopAgent, channelId)
    },
    changeAppChannel: (instanceId, channelId) => {
      if (channelId !== null) {
        const userChannels = desktopAgent.getUserChannels()
        if (!userChannels.find(channel => channel.id === channelId)) {
          return Promise.reject(new Error(`Channel "${channelId}" does not exist`))
        }
      }

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup()
          reject(new Error(`Channel change timeout for instance ${instanceId}`))
        }, 10000)

        const handleChannelChanged = (
          changedInstanceId: string,
          changedChannelId: string | null
        ) => {
          if (changedInstanceId === instanceId && changedChannelId === channelId) {
            cleanup()
            resolve()
          }
        }

        const cleanup = () => {
          clearTimeout(timeout)
          wcpConnector.off("channelChanged", handleChannelChanged)
        }

        wcpConnector.on("channelChanged", handleChannelChanged)

        try {
          desktopAgent.changeAppUserChannel(instanceId, channelId)
        } catch (error) {
          cleanup()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      })
    },
    onAppChannelChange: listener => {
      const handler = (instanceId: string, channelId: string | null) => {
        listener({
          instanceId,
          channelId,
          channel: resolveUserChannelById(desktopAgent, channelId),
        })
      }
      wcpConnector.on("channelChanged", handler)
      return () => {
        wcpConnector.off("channelChanged", handler)
      }
    },
  }

  const apps: BrowserAppsController = {
    add: app => {
      agentInternals.state = addApp(agentInternals.state, app)
    },
    addAll: appsToAdd => {
      agentInternals.state = addApplications(agentInternals.state, appsToAdd)
    },
    addDirectory: async url => {
      agentInternals.state = await loadDirectoryIntoState(agentInternals.state, url)
    },
    remove: appId => {
      agentInternals.state = removeApplicationsByAppId(agentInternals.state, appId)
    },
    getAll: () => retrieveAllApps(desktopAgent.getState().appDirectory),
    getById: appId => retrieveAppsById(desktopAgent.getState().appDirectory, appId)[0],
    open: async (app, openOptions) => {
      const appLauncher = agentInternals.appLauncher
      if (!appLauncher) {
        throw new Error("App launching not available - no AppLauncher configured")
      }

      const appIdentifier = resolveOpenAppIdentifier(app, openOptions)
      const catalogApps = retrieveAppsById(
        desktopAgent.getState().appDirectory,
        appIdentifier.appId
      )
      if (catalogApps.length === 0) {
        throw new Error(`App not found in directory: ${appIdentifier.appId}`)
      }

      const payload: BrowserTypes.OpenRequestPayload = {
        app: appIdentifier,
        ...(openOptions?.context !== undefined ? { context: openOptions.context } : {}),
      }

      const launched = await appLauncher.launch(payload, catalogApps[0])

      if (launched.instanceId) {
        desktopAgent.registerPendingHostInstance({
          appId: launched.appId,
          instanceId: launched.instanceId,
        })
      }

      return launched
    },
    getInstances: () => getAllInstances(desktopAgent.getState()).map(mapToBrowserAppInstance),
    getInstance: instanceId => {
      const instance = getInstance(desktopAgent.getState(), instanceId)
      return instance ? mapToBrowserAppInstance(instance) : undefined
    },
    getConnections: () => wcpConnector.getConnections(),
    getConnection: instanceId => wcpConnector.getConnection(instanceId),
    disconnect: instanceId => {
      wcpConnector.disconnectAppByInstanceId(instanceId)
      desktopAgent.disconnectInstance(instanceId)
    },
    onConnect: listener => {
      wcpConnector.on("appConnected", listener)
      return () => {
        wcpConnector.off("appConnected", listener)
      }
    },
    onDisconnect: listener => {
      wcpConnector.on("appDisconnected", listener)
      return () => {
        wcpConnector.off("appDisconnected", listener)
      }
    },
    onHandshakeFailure: listener => {
      const handler = (error: Error, connectionAttemptUuid: string) => {
        listener({ error, connectionAttemptUuid })
      }
      wcpConnector.on("handshakeFailed", handler)
      return () => {
        wcpConnector.off("handshakeFailed", handler)
      }
    },
  }

  return { intentResolver, channels, apps }
}
