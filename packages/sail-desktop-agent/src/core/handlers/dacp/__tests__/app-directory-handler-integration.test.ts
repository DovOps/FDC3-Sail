/**
 * Handler integration: DACP paths read catalog data from AgentState via query
 * helpers — catalog lives on state.appDirectory only.
 */

import { describe, expect, it } from "vite-plus/test"
import { MockTransport } from "../../../../__tests__/utils/mock-transport"
import type { DirectoryApp } from "../../../app-directory/types"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../default-user-channels"
import { addApplications } from "../../../state/mutators/app-directory"
import { connectInstance, updateInstanceState } from "../../../state/mutators"
import { createInitialState } from "../../../state/initial-state"
import { AppInstanceState } from "../../../state/types"
import { handleGetAppMetadataRequest } from "../app-handlers"
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

describe("DACP handlers without context.appDirectory", () => {
  it("getAppMetadata resolves directory app from state.appDirectory via query helpers", () => {
    let state = createConnectedCallerState()
    state = addApplications(state, [chartApp])

    const transport = new MockTransport()
    const { context, getState } = createDACPTestContext({
      instanceId: "a1",
      initialState: state,
    })

    expect("appDirectory" in context).toBe(false)

    handleGetAppMetadataRequest(
      {
        type: "getAppMetadataRequest",
        meta: createDacpRequestMeta("get-app-metadata-state-catalog", {
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

    const last = transport.getLastMessage() as {
      type: string
      payload: { appMetadata: { appId: string; desktopAgent?: string } }
    }
    expect(last.type).toBe("getAppMetadataResponse")
    expect(last.payload.appMetadata.appId).toBe("chartApp")
    expect(last.payload.appMetadata.desktopAgent).toBe(TEST_PROVIDER)
    expect(getState().appDirectory.apps).toContainEqual(chartApp)
  })

  it("createDACPTestContext does not attach appDirectory on handler context", () => {
    const { context } = createDACPTestContext({ instanceId: "test-instance" })
    expect(context).not.toHaveProperty("appDirectory")
  })
})
