import { describe, expect, it } from "vite-plus/test"
import { MockTransport } from "../../../../__tests__/utils/mock-transport"
import type { DirectoryApp } from "../../../app-directory/types"
import { retrieveAppsById } from "../../../app-directory/app-directory-queries"
import { addApplications } from "../../../state/mutators/app-directory"
import { DesktopAgent } from "../../../desktop-agent"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../default-user-channels"
import { connectInstance, updateInstanceState } from "../../../state/mutators"
import { createInitialState } from "../../../state/initial-state"
import { AppInstanceState, type AgentState } from "../../../state/types"
import { handleFindInstancesRequest, handleGetAppMetadataRequest } from "../app-handlers"
import {
  createDACPTestContext,
  createDacpRequestMeta,
  withResponseDispatcher,
} from "./test-context"

const TEST_PROVIDER = "test-provider"

const chartApp: DirectoryApp = {
  appId: "chartApp",
  name: "chartApp",
  title: "Chart App",
  type: "web",
  details: { url: "https://example.com/chart" },
}

function withCatalogApps(state: AgentState, apps: DirectoryApp[]): AgentState {
  return addApplications(state, apps)
}

type GetAppMetadataSuccessResponse = {
  type: "getAppMetadataResponse"
  payload: {
    appMetadata: {
      appId: string
      instanceId?: string
      desktopAgent?: string
    }
  }
}

function getAppMetadataResponse(transport: MockTransport): GetAppMetadataSuccessResponse {
  const last = transport.getLastMessage() as GetAppMetadataSuccessResponse
  expect(last.type).toBe("getAppMetadataResponse")
  return last
}

function createConnectedCallerState() {
  let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
  state = connectInstance(state, {
    instanceId: "a1",
    appId: "portfolioApp",
    metadata: { appId: "portfolioApp", name: "portfolioApp" },
  })
  state = updateInstanceState(state, "a1", AppInstanceState.CONNECTED)
  return state
}

describe("getAppMetadata desktopAgent field", () => {
  it("includes desktopAgent for directory-only lookup", () => {
    const state = withCatalogApps(createConnectedCallerState(), [chartApp])
    const transport = new MockTransport()
    const { context } = createDACPTestContext({ instanceId: "a1", initialState: state })

    handleGetAppMetadataRequest(
      {
        type: "getAppMetadataRequest",
        meta: createDacpRequestMeta("get-app-metadata-directory-only", {
          appId: "portfolioApp",
          instanceId: "a1",
        }),
        payload: {
          app: { appId: "chartApp" },
        },
      },
      {
        ...withResponseDispatcher(context, transport),
        implementationMetadata: {
          ...context.implementationMetadata,
          provider: TEST_PROVIDER,
        },
      }
    )

    const response = getAppMetadataResponse(transport)
    expect(response.payload.appMetadata.appId).toBe("chartApp")
    expect(response.payload.appMetadata.instanceId).toBeUndefined()
    expect(response.payload.appMetadata.desktopAgent).toBe(TEST_PROVIDER)
  })

  it("includes instanceId and desktopAgent for running instance", () => {
    let state = createConnectedCallerState()
    state = connectInstance(state, {
      instanceId: "chart-123",
      appId: "chartApp",
      metadata: { appId: "chartApp", name: "chartApp" },
    })
    state = updateInstanceState(state, "chart-123", AppInstanceState.CONNECTED)
    state = withCatalogApps(state, [chartApp])

    const transport = new MockTransport()
    const { context } = createDACPTestContext({ instanceId: "a1", initialState: state })

    handleGetAppMetadataRequest(
      {
        type: "getAppMetadataRequest",
        meta: createDacpRequestMeta("get-app-metadata-running-instance", {
          appId: "portfolioApp",
          instanceId: "a1",
        }),
        payload: {
          app: { appId: "chartApp" },
        },
      },
      {
        ...withResponseDispatcher(context, transport),
        implementationMetadata: {
          ...context.implementationMetadata,
          provider: TEST_PROVIDER,
        },
      }
    )

    const response = getAppMetadataResponse(transport)
    expect(response.payload.appMetadata.appId).toBe("chartApp")
    expect(response.payload.appMetadata.instanceId).toBe("chart-123")
    expect(response.payload.appMetadata.desktopAgent).toBe(TEST_PROVIDER)
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

describe("app directory vs runtime instance separation", () => {
  it("findInstances returns empty when app is in directory but not connected", () => {
    const state = withCatalogApps(createConnectedCallerState(), [chartApp])
    const transport = new MockTransport()
    const { context } = createDACPTestContext({ instanceId: "a1", initialState: state })

    handleFindInstancesRequest(
      {
        type: "findInstancesRequest",
        meta: createDacpRequestMeta("find-instances-directory-only", {
          appId: "portfolioApp",
          instanceId: "a1",
        }),
        payload: {
          app: { appId: "chartApp" },
        },
      },
      withResponseDispatcher(context, transport)
    )

    const response = transport.getLastMessage() as {
      type: string
      payload: { appIdentifiers: Array<{ appId: string; instanceId?: string }> }
    }
    expect(response.type).toBe("findInstancesResponse")
    expect(response.payload.appIdentifiers).toEqual([])
  })

  it("getAppMetadata directory lookup reads from the same appDirectory slice as agent state", () => {
    const agent = new DesktopAgent({
      userChannels: DEFAULT_FDC3_USER_CHANNELS,
      apps: [chartApp],
    })
    const state = createConnectedCallerState()
    const transport = new MockTransport()
    const { context, getState } = createDACPTestContext({ instanceId: "a1", initialState: state })

    context.setState(current => withCatalogApps(current, agent.getState().appDirectory.apps))

    handleGetAppMetadataRequest(
      {
        type: "getAppMetadataRequest",
        meta: createDacpRequestMeta("get-app-metadata-state-slice", {
          appId: "portfolioApp",
          instanceId: "a1",
        }),
        payload: {
          app: { appId: "chartApp" },
        },
      },
      {
        ...withResponseDispatcher(context, transport),
        implementationMetadata: {
          ...context.implementationMetadata,
          provider: TEST_PROVIDER,
        },
      }
    )

    const response = getAppMetadataResponse(transport)
    const stateSlice = expectAppDirectoryOnState(getState())

    expect(stateSlice.apps).toContainEqual(chartApp)
    expect(response.payload.appMetadata.appId).toBe("chartApp")
    expect(retrieveAppsById(getState().appDirectory, "chartApp")).toEqual(
      stateSlice.apps.filter(app => app.appId === "chartApp")
    )
  })

  it("running instances remain keyed by instanceId and separate from directory apps", () => {
    let state = createConnectedCallerState()
    state = connectInstance(state, {
      instanceId: "chart-456",
      appId: "chartApp",
      metadata: { appId: "chartApp", name: "chartApp" },
    })
    state = updateInstanceState(state, "chart-456", AppInstanceState.CONNECTED)
    state = withCatalogApps(state, [chartApp])

    const transport = new MockTransport()
    const { context, getState } = createDACPTestContext({ instanceId: "a1", initialState: state })

    handleFindInstancesRequest(
      {
        type: "findInstancesRequest",
        meta: createDacpRequestMeta("find-instances-running", {
          appId: "portfolioApp",
          instanceId: "a1",
        }),
        payload: {
          app: { appId: "chartApp" },
        },
      },
      withResponseDispatcher(context, transport)
    )

    const findResponse = transport.getLastMessage() as {
      payload: { appIdentifiers: Array<{ appId: string; instanceId: string }> }
    }
    expect(findResponse.payload.appIdentifiers).toEqual([
      { appId: "chartApp", instanceId: "chart-456" },
    ])
    expect(Object.keys(getState().instances)).toEqual(["a1", "chart-456"])
    expect(getState().appDirectory.apps).toHaveLength(1)
    expect(getState().appDirectory.apps[0]).not.toHaveProperty("instanceId")
  })
})
