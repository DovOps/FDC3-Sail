/**

 * Top-level browser Desktop Agent preset tests.

 *

 * Verifies createBrowserDesktopAgent is exported from @finos/sail-desktop-agent,

 * seeds apps directly, and wires intentResolver to WCPConnector resolution.

 *

 * @vitest-environment jsdom

 */

import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import type { BrowserTypes, Context } from "@finos/fdc3"

import * as sailDesktopAgent from "../../index"

import { DesktopAgent } from "../../core/desktop-agent"
import { createBrowserDesktopAgentEdgeLink } from "../../app-connection/browser-da-edge-link"
import { getBrowserDesktopAgentSession, isBrowserDesktopAgent } from "../browser-session"
import * as sailPresets from "../index"
import { WCPConnector } from "../index"

import {
  mockApp1,
  mockApp2,
  mockApp3,
} from "../../core/app-directory/__tests__/app-directory-test-fixtures"
import type { DirectoryApp } from "../../core/app-directory/types"
import { retrieveAllApps } from "../../core/app-directory/app-directory-queries"
import type { AppConnectionMetadata } from "../../app-connection/wcp-connector"

import type {
  IntentHandler,
  IntentResolutionChoice,
  IntentResolutionRequest,
  IntentResolver,
  IntentResolverUIMethods,
} from "../../host-contracts"

type BrowserHostControllerSurface = {
  intentResolver: {
    getPendingRequests: () => IntentResolutionRequest[]
    onRequest: (listener: (request: IntentResolutionRequest) => void) => () => void
    select: (requestId: string, choice: IntentResolutionChoice | IntentHandler) => void
    cancel: (requestId: string) => void
  }
  channels: {
    getUserChannels: () => BrowserTypes.Channel[]
    getAppChannel: (instanceId: string) => BrowserTypes.Channel | null
    getAppChannelId: (instanceId: string) => string | null
    changeAppChannel: (instanceId: string, channelId: string | null) => Promise<void>
    onAppChannelChange: (
      listener: (event: {
        instanceId: string
        channelId: string | null
        channel: BrowserTypes.Channel | null
      }) => void
    ) => () => void
  }
  apps: BrowserAppsControllerSurface
}

type BrowserAppOpenOptions = {
  context?: Context
  instanceId?: string
}

type BrowserAppInstance = {
  appId: string
  instanceId: string
  status: "pending" | "connected"
  currentUserChannel?: string | null
}

type HandshakeFailureEvent = {
  error: Error
  connectionAttemptUuid: string
}

type BrowserAppsControllerSurface = {
  add: (app: DirectoryApp) => void
  addAll: (apps: DirectoryApp[]) => void
  addDirectory: (url: string) => Promise<void>
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

type TestBrowserDesktopAgent = DesktopAgent &
  BrowserHostControllerSurface & {
    readonly intentResolverUI?: IntentResolverUIMethods
  }

type BrowserDesktopAgentFactory = (options?: {
  appLauncher?: unknown

  intentResolver?: IntentResolver

  apps?: DirectoryApp[]

  userChannels?: unknown

  appDirectories?: string[]

  autoStart?: boolean

  wcpOptions?: { intentResolutionTimeout?: number }
}) => TestBrowserDesktopAgent

const mockDirectoryApps: DirectoryApp[] = [
  {
    appId: "preset-app-one",

    title: "Preset App One",

    type: "web",

    details: { url: "https://example.com/preset-one" },
  },

  {
    appId: "preset-app-two",

    title: "Preset App Two",

    type: "web",

    details: { url: "https://example.com/preset-two" },
  },
]

function requireBrowserDesktopAgentFactory(): BrowserDesktopAgentFactory {
  const factory = (sailDesktopAgent as Record<string, unknown>).createBrowserDesktopAgent

  expect(factory).toBeDefined()

  expect(typeof factory).toBe("function")

  return factory as BrowserDesktopAgentFactory
}

describe("createBrowserDesktopAgent top-level preset", () => {
  const activeAgents: DesktopAgent[] = []

  afterEach(() => {
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }

    vi.useRealTimers()
  })

  it("exports createBrowserDesktopAgent from the top-level package entry", () => {
    expect((sailDesktopAgent as Record<string, unknown>).createBrowserDesktopAgent).toBeDefined()
  })

  it("returns a DesktopAgent with coupled browser edge lifecycle", () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()

    const desktopAgent = createBrowserDesktopAgent()

    activeAgents.push(desktopAgent)

    expect(isBrowserDesktopAgent(desktopAgent)).toBe(true)

    expect(getBrowserDesktopAgentSession(desktopAgent).wcpConnector).toBeDefined()

    expect(typeof desktopAgent.start).toBe("function")

    expect(typeof desktopAgent.stop).toBe("function")
  })

  it("seeds the App Directory from apps without appDirectories URLs", () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()

    const desktopAgent = createBrowserDesktopAgent({ apps: mockDirectoryApps })

    activeAgents.push(desktopAgent)

    const registeredApps = retrieveAllApps(desktopAgent.getState().appDirectory)

    expect(registeredApps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ appId: "preset-app-one" }),

        expect.objectContaining({ appId: "preset-app-two" }),
      ])
    )

    expect(registeredApps).toHaveLength(2)
  })

  it("wires intentResolver to WCPConnector intent resolution", async () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()

    const resolveMock = vi.fn((request: IntentResolutionRequest) =>
      Promise.resolve({
        selectedHandler: request.handlers[0],
        target: {
          appId: request.handlers[0].app.appId,
          instanceId: request.handlers[0].instanceId,
        },
      })
    )

    const intentResolver: IntentResolver = {
      resolve: resolveMock,
    }

    const desktopAgent = createBrowserDesktopAgent({ intentResolver })

    activeAgents.push(desktopAgent)

    const resolutionPromise = getBrowserDesktopAgentSession(
      desktopAgent
    ).wcpConnector.requestIntentResolution({
      requestId: "preset-intent-req-1",

      intent: "ViewContact",

      context: { type: "fdc3.contact", name: "Preset Contact" } satisfies Context,

      handlers: [
        {
          appId: "handler-a",

          title: "Handler A",

          isRunning: true,

          instanceId: "instance-a",
        },

        {
          appId: "handler-b",

          title: "Handler B",

          isRunning: false,
        },
      ],
    })

    await vi.waitFor(() => {
      expect(resolveMock).toHaveBeenCalledOnce()
    })

    const resolverRequest = resolveMock.mock.calls[0]?.[0]
    expect(resolverRequest).toMatchObject({
      requestId: "preset-intent-req-1",
      intent: "ViewContact",
    })
    expect(resolverRequest?.handlers[0]).toMatchObject({
      app: { appId: "handler-a" },
      isRunning: true,
      instanceId: "instance-a",
    })

    await expect(resolutionPromise).resolves.toEqual({
      requestId: "preset-intent-req-1",

      selectedHandler: { appId: "handler-a", instanceId: "instance-a" },
    })
  })

  it("exposes framework-neutral intent resolver UI methods from the browser preset", async () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const desktopAgent = createBrowserDesktopAgent()
    activeAgents.push(desktopAgent)

    const session = getBrowserDesktopAgentSession(desktopAgent)
    const intentResolverUI = desktopAgent.intentResolverUI

    expect(intentResolverUI).toBeDefined()
    expect(session.intentResolverUI).toBe(intentResolverUI)

    let requestFromUi: IntentResolutionRequest | undefined
    intentResolverUI!.onRequest(request => {
      requestFromUi = request
    })

    const resolutionPromise = session.wcpConnector.requestIntentResolution({
      requestId: "preset-ui-select-1",
      intent: "ViewContact",
      context: { type: "fdc3.contact", name: "Preset Contact" } satisfies Context,
      handlers: [
        {
          appId: "handler-a",
          title: "Handler A",
          icons: [{ src: "https://example.com/handler-a.svg" }],
          isRunning: true,
          instanceId: "instance-a",
        },
      ],
    })

    await vi.waitFor(() => {
      expect(requestFromUi).toBeDefined()
    })

    expect(requestFromUi).toMatchObject({
      requestId: "preset-ui-select-1",
    })
    expect(requestFromUi?.handlers[0]).toMatchObject({
      app: {
        appId: "handler-a",
        title: "Handler A",
        icons: [{ src: "https://example.com/handler-a.svg" }],
      },
      isRunning: true,
      instanceId: "instance-a",
    })

    intentResolverUI!.select("preset-ui-select-1", requestFromUi!.handlers[0])

    await expect(resolutionPromise).resolves.toEqual({
      requestId: "preset-ui-select-1",
      selectedHandler: { appId: "handler-a", instanceId: "instance-a" },
      intent: "ViewContact",
    })
  })

  it("cancels through intentResolverUI before the WCP timeout fires", async () => {
    vi.useFakeTimers()

    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const desktopAgent = createBrowserDesktopAgent({
      wcpOptions: { intentResolutionTimeout: 20 },
    })
    activeAgents.push(desktopAgent)

    const session = getBrowserDesktopAgentSession(desktopAgent)
    const resolutionPromise = session.wcpConnector.requestIntentResolution({
      requestId: "preset-ui-timeout-1",
      intent: "ViewContact",
      context: { type: "fdc3.contact", name: "Preset Contact" } satisfies Context,
      handlers: [
        {
          appId: "handler-a",
          title: "Handler A",
          isRunning: false,
        },
      ],
    })

    await vi.advanceTimersByTimeAsync(19)

    await expect(resolutionPromise).resolves.toEqual({
      requestId: "preset-ui-timeout-1",
      selectedHandler: null,
    })
  })
})

describe("desktopAgent.intentResolver canonical host controller", () => {
  const activeAgents: DesktopAgent[] = []

  const ambiguousHandlers = [
    {
      appId: "handler-a",
      title: "Handler A",
      icons: [{ src: "https://example.com/handler-a.svg" }],
      isRunning: true,
      instanceId: "instance-a",
    },
    {
      appId: "handler-b",
      title: "Handler B",
      isRunning: false,
    },
  ]

  afterEach(() => {
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }

    vi.useRealTimers()
  })

  it("receives typed ambiguous intent requests via onRequest", async () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const desktopAgent = createBrowserDesktopAgent()
    activeAgents.push(desktopAgent)

    const session = getBrowserDesktopAgentSession(desktopAgent)
    const { intentResolver } = desktopAgent

    let requestFromResolver: IntentResolutionRequest | undefined
    intentResolver.onRequest(request => {
      requestFromResolver = request
    })

    const resolutionPromise = session.wcpConnector.requestIntentResolution({
      requestId: "canonical-on-request-1",
      intent: "ViewContact",
      context: { type: "fdc3.contact", name: "Canonical Contact" } satisfies Context,
      handlers: ambiguousHandlers,
    })

    await vi.waitFor(() => {
      expect(requestFromResolver).toBeDefined()
    })

    expect(requestFromResolver).toMatchObject({
      requestId: "canonical-on-request-1",
      intent: "ViewContact",
    })
    expect(requestFromResolver?.handlers).toHaveLength(2)
    expect(requestFromResolver?.handlers[0]).toMatchObject({
      app: {
        appId: "handler-a",
        title: "Handler A",
        icons: [{ src: "https://example.com/handler-a.svg" }],
      },
      isRunning: true,
      instanceId: "instance-a",
    })

    intentResolver.select("canonical-on-request-1", requestFromResolver!.handlers[0])

    await expect(resolutionPromise).resolves.toEqual({
      requestId: "canonical-on-request-1",
      selectedHandler: { appId: "handler-a", instanceId: "instance-a" },
      intent: "ViewContact",
    })
  })

  it("continues intent delivery when select is called with an IntentResolutionChoice", async () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const desktopAgent = createBrowserDesktopAgent()
    activeAgents.push(desktopAgent)

    const session = getBrowserDesktopAgentSession(desktopAgent)
    const { intentResolver } = desktopAgent

    let requestFromResolver: IntentResolutionRequest | undefined
    intentResolver.onRequest(request => {
      requestFromResolver = request
    })

    const resolutionPromise = session.wcpConnector.requestIntentResolution({
      requestId: "canonical-choice-select-1",
      intent: "ViewContact",
      context: { type: "fdc3.contact", name: "Choice Select Contact" } satisfies Context,
      handlers: [ambiguousHandlers[0]],
    })

    await vi.waitFor(() => {
      expect(requestFromResolver).toBeDefined()
    })

    const choice: IntentResolutionChoice = {
      intent: { name: "ViewContact", displayName: "View Contact" },
      handler: requestFromResolver!.handlers[0],
    }

    intentResolver.select("canonical-choice-select-1", choice)

    await expect(resolutionPromise).resolves.toEqual({
      requestId: "canonical-choice-select-1",
      selectedHandler: { appId: "handler-a", instanceId: "instance-a" },
      intent: "ViewContact",
    })
  })

  it("cancels pending resolution when cancel is called", async () => {
    vi.useFakeTimers()

    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const desktopAgent = createBrowserDesktopAgent({
      wcpOptions: { intentResolutionTimeout: 60_000 },
    })
    activeAgents.push(desktopAgent)

    const session = getBrowserDesktopAgentSession(desktopAgent)
    const { intentResolver } = desktopAgent

    expect(typeof intentResolver.cancel).toBe("function")

    let requestFromResolver: IntentResolutionRequest | undefined
    intentResolver.onRequest(request => {
      requestFromResolver = request
    })

    const resolutionPromise = session.wcpConnector.requestIntentResolution({
      requestId: "canonical-cancel-1",
      intent: "ViewContact",
      context: { type: "fdc3.contact", name: "Cancel Contact" } satisfies Context,
      handlers: [ambiguousHandlers[1]],
    })

    await vi.waitFor(() => {
      expect(requestFromResolver).toBeDefined()
    })

    intentResolver.cancel("canonical-cancel-1")

    await expect(resolutionPromise).resolves.toEqual({
      requestId: "canonical-cancel-1",
      selectedHandler: null,
    })

    await vi.advanceTimersByTimeAsync(60_000)
  })

  it("stops delivering requests to a listener after onRequest unsubscribe", async () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const desktopAgent = createBrowserDesktopAgent()
    activeAgents.push(desktopAgent)

    const session = getBrowserDesktopAgentSession(desktopAgent)
    const { intentResolver } = desktopAgent

    let notificationCount = 0
    const unsubscribe = intentResolver.onRequest(() => {
      notificationCount += 1
    })

    const firstResolution = session.wcpConnector.requestIntentResolution({
      requestId: "canonical-unsub-1",
      intent: "ViewContact",
      context: { type: "fdc3.contact", name: "Unsub Contact One" } satisfies Context,
      handlers: [ambiguousHandlers[0]],
    })

    await vi.waitFor(() => {
      expect(notificationCount).toBe(1)
    })

    const pendingAfterFirst = intentResolver.getPendingRequests()
    intentResolver.select("canonical-unsub-1", pendingAfterFirst[0].handlers[0])
    await firstResolution

    unsubscribe()

    const secondResolution = session.wcpConnector.requestIntentResolution({
      requestId: "canonical-unsub-2",
      intent: "ViewContact",
      context: { type: "fdc3.contact", name: "Unsub Contact Two" } satisfies Context,
      handlers: [ambiguousHandlers[0]],
    })

    await vi.waitFor(() => {
      expect(intentResolver.getPendingRequests()).toEqual(
        expect.arrayContaining([expect.objectContaining({ requestId: "canonical-unsub-2" })])
      )
    })

    expect(notificationCount).toBe(1)

    const pendingAfterSecond = intentResolver.getPendingRequests()
    intentResolver.select("canonical-unsub-2", pendingAfterSecond[0].handlers[0])
    await secondResolution
  })

  it("keeps intentResolverUI compatible with the canonical intentResolver surface", async () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const desktopAgent = createBrowserDesktopAgent()
    activeAgents.push(desktopAgent)

    const session = getBrowserDesktopAgentSession(desktopAgent)
    const { intentResolver, intentResolverUI } = desktopAgent

    expect(intentResolverUI).toBeDefined()
    expect(session.intentResolverUI).toBe(intentResolverUI)

    let requestFromCanonical: IntentResolutionRequest | undefined
    let requestFromAlias: IntentResolutionRequest | undefined

    intentResolver.onRequest(request => {
      requestFromCanonical = request
    })
    intentResolverUI!.onRequest(request => {
      requestFromAlias = request
    })

    const resolutionPromise = session.wcpConnector.requestIntentResolution({
      requestId: "canonical-alias-compat-1",
      intent: "ViewContact",
      context: { type: "fdc3.contact", name: "Alias Compat Contact" } satisfies Context,
      handlers: [ambiguousHandlers[0]],
    })

    await vi.waitFor(() => {
      expect(requestFromCanonical).toBeDefined()
      expect(requestFromAlias).toBeDefined()
    })

    expect(requestFromCanonical).toEqual(requestFromAlias)
    expect(intentResolver.getPendingRequests()).toEqual(intentResolverUI!.getPendingRequests())

    intentResolverUI!.select("canonical-alias-compat-1", requestFromAlias!.handlers[0])

    await expect(resolutionPromise).resolves.toEqual({
      requestId: "canonical-alias-compat-1",
      selectedHandler: { appId: "handler-a", instanceId: "instance-a" },
      intent: "ViewContact",
    })
  })
})

describe("desktopAgent.channels canonical host controller", () => {
  const activeAgents: DesktopAgent[] = []

  afterEach(() => {
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }

    vi.useRealTimers()
  })

  it("exposes getAppChannelId, getAppChannel, changeAppChannel, and onAppChannelChange", () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const desktopAgent = createBrowserDesktopAgent()
    activeAgents.push(desktopAgent)

    const { channels } = desktopAgent

    expect(typeof channels.getUserChannels).toBe("function")
    expect(typeof channels.getAppChannelId).toBe("function")
    expect(typeof channels.getAppChannel).toBe("function")
    expect(typeof channels.changeAppChannel).toBe("function")
    expect(typeof channels.onAppChannelChange).toBe("function")
  })

  it("returns null from getAppChannelId for an unknown instance id", () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const desktopAgent = createBrowserDesktopAgent()
    activeAgents.push(desktopAgent)

    const { channels } = desktopAgent

    expect(channels.getAppChannelId("nonexistent-instance")).toBeNull()
    expect(channels.getAppChannel("nonexistent-instance")).toBeNull()
  })
})

describe("browser host controller composition", () => {
  const activeAgents: DesktopAgent[] = []

  afterEach(() => {
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }

    vi.useRealTimers()
  })

  it("exposes intentResolver, channels, and apps controller objects on the browser preset handle", () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const desktopAgent = createBrowserDesktopAgent()
    activeAgents.push(desktopAgent)

    expect(desktopAgent.intentResolver).toBeDefined()
    expect(desktopAgent.channels).toBeDefined()
    expect(desktopAgent.apps).toBeDefined()
    expect(typeof desktopAgent.intentResolver).toBe("object")
    expect(typeof desktopAgent.channels).toBe("object")
    expect(typeof desktopAgent.apps).toBe("object")
  })

  it("allows destructured controller methods without the original Desktop Agent as this", async () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const desktopAgent = createBrowserDesktopAgent()
    activeAgents.push(desktopAgent)

    const { intentResolver, channels, apps } = desktopAgent

    expect(typeof intentResolver.getPendingRequests).toBe("function")
    expect(intentResolver.getPendingRequests()).toEqual([])

    expect(typeof channels.getUserChannels).toBe("function")
    expect(() => channels.getUserChannels()).not.toThrow()

    expect(typeof apps.getAll).toBe("function")
    expect(() => apps.getAll()).not.toThrow()

    let requestFromDestructuredResolver: IntentResolutionRequest | undefined
    const unsubscribe = intentResolver.onRequest(request => {
      requestFromDestructuredResolver = request
    })

    const session = getBrowserDesktopAgentSession(desktopAgent)
    const resolutionPromise = session.wcpConnector.requestIntentResolution({
      requestId: "destructure-intent-req-1",
      intent: "ViewContact",
      context: { type: "fdc3.contact", name: "Destructured Contact" } satisfies Context,
      handlers: [
        {
          appId: "handler-a",
          title: "Handler A",
          isRunning: true,
          instanceId: "instance-a",
        },
      ],
    })

    await vi.waitFor(() => {
      expect(requestFromDestructuredResolver).toBeDefined()
    })

    expect(intentResolver.getPendingRequests()).toEqual(
      expect.arrayContaining([expect.objectContaining({ requestId: "destructure-intent-req-1" })])
    )

    intentResolver.select("destructure-intent-req-1", requestFromDestructuredResolver!.handlers[0])
    await expect(resolutionPromise).resolves.toEqual({
      requestId: "destructure-intent-req-1",
      selectedHandler: { appId: "handler-a", instanceId: "instance-a" },
      intent: "ViewContact",
    })

    unsubscribe()
  })

  it("exports createBrowserHostControllers for manual DesktopAgent + WCPConnector composition", () => {
    const createBrowserHostControllers = (sailPresets as Record<string, unknown>)
      .createBrowserHostControllers

    expect(createBrowserHostControllers).toBeDefined()
    expect(typeof createBrowserHostControllers).toBe("function")
  })

  it("constructs the same controller shape via createBrowserHostControllers without the preset factory", () => {
    const createBrowserHostControllers = (sailPresets as Record<string, unknown>)
      .createBrowserHostControllers as (options: {
      desktopAgent: DesktopAgent
      wcpConnector: WCPConnector
      intentResolverUI?: IntentResolverUIMethods
    }) => BrowserHostControllerSurface

    const [daEdge, wcpEdge] = createBrowserDesktopAgentEdgeLink()
    const wcpConnector = new WCPConnector(wcpEdge)
    const desktopAgent = new DesktopAgent({ transport: daEdge })
    activeAgents.push(desktopAgent)

    const controllers = createBrowserHostControllers({
      desktopAgent,
      wcpConnector,
    })

    expect(controllers.intentResolver).toBeDefined()
    expect(controllers.channels).toBeDefined()
    expect(controllers.apps).toBeDefined()

    const { intentResolver, channels, apps } = controllers

    expect(typeof intentResolver.getPendingRequests).toBe("function")
    expect(intentResolver.getPendingRequests()).toEqual([])

    expect(typeof channels.getUserChannels).toBe("function")
    expect(() => channels.getUserChannels()).not.toThrow()

    expect(typeof apps.getAll).toBe("function")
    expect(() => apps.getAll()).not.toThrow()
  })
})

describe("desktopAgent.apps canonical host controller", () => {
  const activeAgents: DesktopAgent[] = []

  afterEach(() => {
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }

    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it("exposes the full apps controller surface on the browser preset handle", () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const desktopAgent = createBrowserDesktopAgent()
    activeAgents.push(desktopAgent)

    const { apps } = desktopAgent

    expect(typeof apps.add).toBe("function")
    expect(typeof apps.addAll).toBe("function")
    expect(typeof apps.addDirectory).toBe("function")
    expect(typeof apps.remove).toBe("function")
    expect(typeof apps.getAll).toBe("function")
    expect(typeof apps.getById).toBe("function")
    expect(typeof apps.open).toBe("function")
    expect(typeof apps.getInstances).toBe("function")
    expect(typeof apps.getInstance).toBe("function")
    expect(typeof apps.getConnections).toBe("function")
    expect(typeof apps.getConnection).toBe("function")
    expect(typeof apps.disconnect).toBe("function")
    expect(typeof apps.onConnect).toBe("function")
    expect(typeof apps.onDisconnect).toBe("function")
    expect(typeof apps.onHandshakeFailure).toBe("function")
  })

  it("adds a runtime app to the catalog after agent creation", () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const desktopAgent = createBrowserDesktopAgent()
    activeAgents.push(desktopAgent)

    desktopAgent.apps.add(mockApp1)

    expect(desktopAgent.apps.getAll()).toEqual(
      expect.arrayContaining([expect.objectContaining({ appId: "app-1" })])
    )
    expect(desktopAgent.apps.getById("app-1")).toMatchObject({
      appId: "app-1",
      title: "Test App 1",
    })
  })

  it("addAll merges apps with duplicate appId dedupe", () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const desktopAgent = createBrowserDesktopAgent({ apps: [mockApp1] })
    activeAgents.push(desktopAgent)

    desktopAgent.apps.addAll([mockApp1, mockApp2])

    const catalog = desktopAgent.apps.getAll()
    expect(catalog).toHaveLength(2)
    expect(catalog.map(app => app.appId).sort()).toEqual(["app-1", "app-2"])
  })

  it("loads apps from addDirectory and makes them readable from the controller", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([mockApp2, mockApp3]),
      })
    )

    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const desktopAgent = createBrowserDesktopAgent()
    activeAgents.push(desktopAgent)

    await desktopAgent.apps.addDirectory("https://example.com/v2/apps")

    expect(desktopAgent.apps.getAll()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ appId: "app-2" }),
        expect.objectContaining({ appId: "app-3" }),
      ])
    )
    expect(desktopAgent.apps.getById("app-3")).toMatchObject({ appId: "app-3" })
  })

  it("remove drops an app from catalog reads", () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const desktopAgent = createBrowserDesktopAgent({ apps: [mockApp1, mockApp2] })
    activeAgents.push(desktopAgent)

    desktopAgent.apps.remove("app-1")

    expect(desktopAgent.apps.getById("app-1")).toBeUndefined()
    expect(desktopAgent.apps.getAll()).toHaveLength(1)
    expect(desktopAgent.apps.getById("app-2")).toMatchObject({ appId: "app-2" })
  })

  it("opens a catalog app through the configured app launcher", async () => {
    const launchMock = vi.fn((request: { app: BrowserTypes.AppIdentifier }) =>
      Promise.resolve({
        appId: request.app.appId,
        instanceId: "host-open-instance-1",
      })
    )

    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const desktopAgent = createBrowserDesktopAgent({
      apps: [mockApp1],
      appLauncher: { launch: launchMock },
    })
    activeAgents.push(desktopAgent)

    const opened = await desktopAgent.apps.open("app-1")

    expect(launchMock).toHaveBeenCalledOnce()
    expect(opened).toEqual({ appId: "app-1", instanceId: "host-open-instance-1" })
    expect(desktopAgent.apps.getInstance("host-open-instance-1")).toMatchObject({
      appId: "app-1",
      instanceId: "host-open-instance-1",
      status: "pending",
    })
  })

  it("passes open options context and instanceId to the app launcher", async () => {
    const launchMock = vi.fn((request: BrowserTypes.OpenRequestPayload) =>
      Promise.resolve({
        appId: request.app.appId,
        instanceId: request.app.instanceId ?? "fallback-instance",
      })
    )
    const launchContext = { type: "fdc3.contact", name: "Open Contact" } satisfies Context

    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const desktopAgent = createBrowserDesktopAgent({
      apps: [mockApp1],
      appLauncher: { launch: launchMock },
    })
    activeAgents.push(desktopAgent)

    await desktopAgent.apps.open(
      { appId: "app-1", instanceId: "preset-open-instance" },
      { context: launchContext }
    )

    expect(launchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        app: { appId: "app-1", instanceId: "preset-open-instance" },
        context: launchContext,
      }),
      expect.objectContaining({ appId: "app-1" })
    )
  })

  it("returns empty connection reads before any WCP handshake", () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const desktopAgent = createBrowserDesktopAgent()
    activeAgents.push(desktopAgent)

    expect(desktopAgent.apps.getConnections()).toEqual([])
    expect(desktopAgent.apps.getConnection("unknown-instance")).toBeUndefined()
  })

  it("lists pending instances from host-initiated open", async () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const desktopAgent = createBrowserDesktopAgent({
      apps: [mockApp1, mockApp2],
      appLauncher: {
        launch: (request: BrowserTypes.OpenRequestPayload) =>
          Promise.resolve({
            appId: request.app.appId,
            instanceId: `pending-${request.app.appId}`,
          }),
      },
    })
    activeAgents.push(desktopAgent)

    await desktopAgent.apps.open("app-1")
    await desktopAgent.apps.open("app-2")

    expect(desktopAgent.apps.getInstances()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ appId: "app-1", instanceId: "pending-app-1", status: "pending" }),
        expect.objectContaining({ appId: "app-2", instanceId: "pending-app-2", status: "pending" }),
      ])
    )
  })

  it("allows destructured apps methods without the original Desktop Agent as this", async () => {
    const launchMock = vi.fn((request: { app: BrowserTypes.AppIdentifier }) =>
      Promise.resolve({
        appId: request.app.appId,
        instanceId: "destructured-open-instance",
      })
    )

    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const desktopAgent = createBrowserDesktopAgent({
      apps: [mockApp1],
      appLauncher: { launch: launchMock },
    })
    activeAgents.push(desktopAgent)

    const { add, getAll, getById, open } = desktopAgent.apps

    add(mockApp2)
    expect(getAll()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ appId: "app-1" }),
        expect.objectContaining({ appId: "app-2" }),
      ])
    )
    expect(getById("app-2")).toMatchObject({ appId: "app-2" })

    await open("app-1")
    expect(launchMock).toHaveBeenCalledOnce()
  })
})
