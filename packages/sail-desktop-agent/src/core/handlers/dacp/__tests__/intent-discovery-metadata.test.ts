import { readFileSync } from "node:fs"
import { describe, expect, it } from "vite-plus/test"
import { MockTransport } from "../../../../__tests__/utils/mock-transport"
import type { DirectoryApp } from "../../../app-directory/types"
import { retrieveIntents } from "../../../app-directory/app-directory-queries"
import { addApplications } from "../../../state/mutators/app-directory"
import { DesktopAgent } from "../../../desktop-agent"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../default-user-channels"
import { connectInstance, updateInstanceState } from "../../../state/mutators"
import { registerIntentListener } from "../../../state/mutators/intent"
import { createInitialState } from "../../../state/initial-state"
import { AppInstanceState, type AgentState } from "../../../state/types"
import { createDACPTestContext, createDacpRequestMeta } from "./test-context"
import { withResponseDispatcher } from "./test-context"
import { createAppIntents, findIntentsByContext } from "../intent-handlers/intent-helpers"
import {
  handleFindIntentRequest,
  handleFindIntentsByContextRequest,
} from "../intent-handlers/intent-discovery-handlers"

const INTENT_APP_A_DISPLAY_NAME = "A Testing Intent"
const INTENT_APP_A_INTENT_NAME = "aTestingIntent"
const TEST_CONTEXT_X = "testContextX"
const TEST_CONTEXT_Y = "testContextY"

/** Mirrors intent-a / IntentAppAId from conformance-appd.json */
const intentAppA: DirectoryApp = {
  appId: "IntentAppAId",
  name: "IntentAppA",
  title: "Intent App A",
  description: "Part of the FDC3 Conformance Tests",
  type: "web",
  details: {
    url: "https://fdc3.finos.org/toolbox/fdc3-conformance/apps/intent-a/index.html",
  },
  version: "1.0.0",
  interop: {
    intents: {
      listensFor: {
        [INTENT_APP_A_INTENT_NAME]: {
          displayName: INTENT_APP_A_DISPLAY_NAME,
          contexts: [TEST_CONTEXT_X, "testContextZ"],
        },
        sharedTestingIntent1: {
          displayName: "Shared Testing Intent 1",
          contexts: [TEST_CONTEXT_X],
        },
      },
    },
  },
}

function loadConformanceIntentAppA(): DirectoryApp {
  const raw = readFileSync(
    new URL("../../../../../../sail-conformance-harness/conformance-appd.json", import.meta.url),
    "utf-8"
  )
  const data = JSON.parse(raw) as { applications: DirectoryApp[] }
  const app = data.applications.find(entry => entry.appId === "IntentAppAId")
  if (!app) {
    throw new Error("IntentAppAId not found in conformance-appd.json")
  }
  return app
}

function withCatalogApps(state: AgentState, apps: DirectoryApp[]): AgentState {
  return addApplications(state, apps)
}

type FindIntentSuccessResponse = {
  type: "findIntentResponse"
  payload: {
    appIntent: {
      intent: { name: string; displayName?: string }
      apps: Array<{ appId: string; instanceId?: string }>
    }
  }
}

type FindIntentsByContextSuccessResponse = {
  type: "findIntentsByContextResponse"
  payload: {
    appIntents: Array<{
      intent: { name: string; displayName?: string }
      apps: Array<{ appId: string; instanceId?: string }>
    }>
  }
}

function getFindIntentResponse(transport: MockTransport): FindIntentSuccessResponse {
  const last = transport.getLastMessage() as FindIntentSuccessResponse
  expect(last.type).toBe("findIntentResponse")
  return last
}

function getFindIntentsByContextResponse(
  transport: MockTransport
): FindIntentsByContextSuccessResponse {
  const last = transport.getLastMessage() as FindIntentsByContextSuccessResponse
  expect(last.type).toBe("findIntentsByContextResponse")
  return last
}

describe("intent discovery metadata from app directory", () => {
  describe("createAppIntents", () => {
    const displayNameCases = [
      {
        name: "inline conformance-style intent-a fixture",
        app: intentAppA,
      },
      {
        name: "IntentAppAId from conformance-appd.json",
        app: loadConformanceIntentAppA(),
      },
    ] as const

    it.each(displayNameCases)(
      "maps directory displayName for aTestingIntent ($name)",
      ({ app }) => {
        const state = withCatalogApps(createInitialState(DEFAULT_FDC3_USER_CHANNELS), [app])

        const appIntents = createAppIntents(
          state,
          state.appDirectory,
          INTENT_APP_A_INTENT_NAME,
          TEST_CONTEXT_X
        )

        expect(appIntents).toHaveLength(1)
        expect(appIntents[0].intent.name).toBe(INTENT_APP_A_INTENT_NAME)
        expect(appIntents[0].intent.displayName).toBe(INTENT_APP_A_DISPLAY_NAME)
      }
    )
  })

  describe("findIntentsByContext", () => {
    it("returns directory displayName for intents matching the context", () => {
      const state = withCatalogApps(createInitialState(DEFAULT_FDC3_USER_CHANNELS), [intentAppA])

      const intents = findIntentsByContext(state, state.appDirectory, TEST_CONTEXT_X)
      const testingIntent = intents.find(entry => entry.name === INTENT_APP_A_INTENT_NAME)

      expect(testingIntent).toBeDefined()
      expect(testingIntent?.displayName).toBe(INTENT_APP_A_DISPLAY_NAME)
    })
  })

  describe("handleFindIntentRequest", () => {
    it("responds with directory displayName for aTestingIntent", () => {
      let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
      state = connectInstance(state, {
        instanceId: "a1",
        appId: "TestApp",
        metadata: { appId: "TestApp", name: "TestApp" },
      })
      state = updateInstanceState(state, "a1", AppInstanceState.CONNECTED)

      state = withCatalogApps(state, [intentAppA])

      const transport = new MockTransport()
      const { context } = createDACPTestContext({ instanceId: "a1", initialState: state })

      handleFindIntentRequest(
        {
          type: "findIntentRequest",
          meta: createDacpRequestMeta("find-intent-display-name"),
          payload: {
            intent: INTENT_APP_A_INTENT_NAME,
            context: { type: TEST_CONTEXT_X },
          },
        },
        withResponseDispatcher(context, transport)
      )

      const response = getFindIntentResponse(transport)
      expect(response.payload.appIntent.intent.displayName).toBe(INTENT_APP_A_DISPLAY_NAME)
    })
  })

  describe("handleFindIntentsByContextRequest", () => {
    it("returns each matching intent once when directory and running listener both handle the context", () => {
      let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
      state = connectInstance(state, {
        instanceId: "instance-a",
        appId: "IntentAppAId",
        metadata: { appId: "IntentAppAId", name: "IntentAppA" },
      })
      state = updateInstanceState(state, "instance-a", AppInstanceState.CONNECTED)
      state = registerIntentListener(state, {
        listenerId: "listener-a",
        intentName: INTENT_APP_A_INTENT_NAME,
        instanceId: "instance-a",
        appId: "IntentAppAId",
        contextTypes: [],
      })
      state = connectInstance(state, {
        instanceId: "a1",
        appId: "TestApp",
        metadata: { appId: "TestApp", name: "TestApp" },
      })
      state = updateInstanceState(state, "a1", AppInstanceState.CONNECTED)

      state = withCatalogApps(state, [intentAppA])

      const transport = new MockTransport()
      const { context } = createDACPTestContext({ instanceId: "a1", initialState: state })

      handleFindIntentsByContextRequest(
        {
          type: "findIntentsByContextRequest",
          meta: createDacpRequestMeta("find-intents-by-context-dedupe"),
          payload: {
            context: { type: TEST_CONTEXT_X },
          },
        },
        withResponseDispatcher(context, transport)
      )

      const response = getFindIntentsByContextResponse(transport)
      const intentNames = response.payload.appIntents.map(entry => entry.intent.name)

      expect(intentNames).toEqual(
        expect.arrayContaining([INTENT_APP_A_INTENT_NAME, "sharedTestingIntent1"])
      )
      expect(new Set(intentNames).size).toBe(intentNames.length)
      expect(response.payload.appIntents).toHaveLength(2)

      const testingIntent = response.payload.appIntents.find(
        entry => entry.intent.name === INTENT_APP_A_INTENT_NAME
      )
      expect(testingIntent?.intent.displayName).toBe(INTENT_APP_A_DISPLAY_NAME)
      expect(testingIntent?.apps).toHaveLength(2)
      expect(testingIntent?.apps.filter(app => app.instanceId === "instance-a")).toHaveLength(1)
    })

    it("does not add intents from running listeners when directory excludes the context type", () => {
      const contextYOnlyApp: DirectoryApp = {
        appId: "ContextYOnlyApp",
        title: "Context Y Only App",
        type: "web",
        details: { url: "https://example.com/context-y-only" },
        interop: {
          intents: {
            listensFor: {
              contextYOnlyIntent: {
                displayName: "Context Y Only Intent",
                contexts: [TEST_CONTEXT_Y],
              },
            },
          },
        },
      }

      let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
      state = connectInstance(state, {
        instanceId: "listener-instance",
        appId: "ContextYOnlyApp",
        metadata: { appId: "ContextYOnlyApp", name: "ContextYOnlyApp" },
      })
      state = updateInstanceState(state, "listener-instance", AppInstanceState.CONNECTED)
      state = registerIntentListener(state, {
        listenerId: "listener-y-only",
        intentName: "contextYOnlyIntent",
        instanceId: "listener-instance",
        appId: "ContextYOnlyApp",
        contextTypes: [],
      })
      state = connectInstance(state, {
        instanceId: "a1",
        appId: "TestApp",
        metadata: { appId: "TestApp", name: "TestApp" },
      })
      state = updateInstanceState(state, "a1", AppInstanceState.CONNECTED)

      state = withCatalogApps(state, [intentAppA, contextYOnlyApp])

      const transport = new MockTransport()
      const { context } = createDACPTestContext({ instanceId: "a1", initialState: state })

      handleFindIntentsByContextRequest(
        {
          type: "findIntentsByContextRequest",
          meta: createDacpRequestMeta("find-intents-by-context-no-listener-inflation"),
          payload: {
            context: { type: TEST_CONTEXT_X },
          },
        },
        withResponseDispatcher(context, transport)
      )

      const response = getFindIntentsByContextResponse(transport)
      const intentNames = response.payload.appIntents.map(entry => entry.intent.name)

      expect(intentNames).not.toContain("contextYOnlyIntent")
      expect(response.payload.appIntents).toHaveLength(2)
    })
  })
})

type AppDirectorySlice = {
  apps: DirectoryApp[]
  directoryUrls: string[]
}

function expectAppDirectoryOnState(state: AgentState): AppDirectorySlice {
  expect(state).toHaveProperty("appDirectory")
  const slice = (state as AgentState & { appDirectory: AppDirectorySlice }).appDirectory
  expect(Array.isArray(slice.apps)).toBe(true)
  expect(Array.isArray(slice.directoryUrls)).toBe(true)
  return slice
}

const launchOnlyApp: DirectoryApp = {
  appId: "LaunchOnlyApp",
  title: "Launch Only App",
  type: "web",
  details: { url: "https://example.com/launch-only" },
  interop: {
    intents: {
      listensFor: {
        [INTENT_APP_A_INTENT_NAME]: {
          displayName: "Launch Only Copy",
          contexts: [TEST_CONTEXT_X],
        },
      },
    },
  },
}

describe("state-owned app directory intent discovery contract", () => {
  it("createAppIntents derives launchable apps without instanceId separately from running instances", () => {
    let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
    state = connectInstance(state, {
      instanceId: "running-instance",
      appId: "IntentAppAId",
      metadata: { appId: "IntentAppAId", name: "IntentAppA" },
    })
    state = updateInstanceState(state, "running-instance", AppInstanceState.CONNECTED)
    state = registerIntentListener(state, {
      listenerId: "listener-running",
      intentName: INTENT_APP_A_INTENT_NAME,
      instanceId: "running-instance",
      appId: "IntentAppAId",
      contextTypes: [],
    })

    state = withCatalogApps(state, [intentAppA, launchOnlyApp])
    const appIntents = createAppIntents(
      state,
      state.appDirectory,
      INTENT_APP_A_INTENT_NAME,
      TEST_CONTEXT_X
    )

    expect(appIntents).toHaveLength(1)
    const apps = appIntents[0].apps
    expect(apps).toHaveLength(3)

    const launchableOnly = apps.find(app => app.appId === "LaunchOnlyApp")
    const directoryLaunchable = apps.find(
      app => app.appId === "IntentAppAId" && app.instanceId === undefined
    )
    const running = apps.find(app => app.instanceId === "running-instance")

    expect(launchableOnly).toBeDefined()
    expect(launchableOnly?.instanceId).toBeUndefined()
    expect(directoryLaunchable).toBeDefined()
    expect(running).toBeDefined()
    expect(running?.appId).toBe("IntentAppAId")
  })

  it("DesktopAgent intent lookup uses state.appDirectory as the directory source", () => {
    const agent = new DesktopAgent({
      userChannels: DEFAULT_FDC3_USER_CHANNELS,
      apps: [intentAppA],
    })
    let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
    state = connectInstance(state, {
      instanceId: "a1",
      appId: "TestApp",
      metadata: { appId: "TestApp", name: "TestApp" },
    })
    state = updateInstanceState(state, "a1", AppInstanceState.CONNECTED)

    state = withCatalogApps(state, agent.getState().appDirectory.apps)

    const transport = new MockTransport()
    const { context } = createDACPTestContext({ instanceId: "a1", initialState: state })
    const stateSlice = expectAppDirectoryOnState(context.getState())

    handleFindIntentRequest(
      {
        type: "findIntentRequest",
        meta: createDacpRequestMeta("find-intent-state-owned-directory"),
        payload: {
          intent: INTENT_APP_A_INTENT_NAME,
          context: { type: TEST_CONTEXT_X },
        },
      },
      withResponseDispatcher(context, transport)
    )

    const response = getFindIntentResponse(transport)
    expect(stateSlice.apps).toContainEqual(intentAppA)
    expect(response.payload.appIntent.intent.displayName).toBe(INTENT_APP_A_DISPLAY_NAME)
    expect(response.payload.appIntent.apps.every(app => app.instanceId === undefined)).toBe(true)
  })

  it("preserves duplicate appId policy for intent lookup from state.appDirectory.apps", () => {
    const duplicateVariant: DirectoryApp = {
      ...intentAppA,
      title: "Duplicate Intent App A",
    }
    const agent = new DesktopAgent({ userChannels: DEFAULT_FDC3_USER_CHANNELS })

    const internal = agent as unknown as { state: AgentState }
    internal.state = addApplications(internal.state, [intentAppA, duplicateVariant])

    const stateSlice = expectAppDirectoryOnState(agent.getState())
    expect(stateSlice.apps.filter(app => app.appId === "IntentAppAId")).toHaveLength(1)

    const intents = retrieveIntents(stateSlice, TEST_CONTEXT_X, INTENT_APP_A_INTENT_NAME, undefined)
    expect(intents).toHaveLength(1)
    expect(intents[0].appId).toBe("IntentAppAId")
  })
})
