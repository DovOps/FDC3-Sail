import { describe, expect, it } from "vite-plus/test"
import { MockTransport } from "../../../../__tests__/utils/mock-transport"
import { connectInstance, updateInstanceState } from "../../../state/mutators"
import { AppInstanceState } from "../../../state/types"
import { createInitialState } from "../../../state/initial-state"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../default-user-channels"
import { CloseError } from "../../../errors/fdc3-errors"
import { MockAppLauncher } from "../../../../../test/support/mock-app-launcher"
import { createDACPTestContext, createDacpRequestMeta } from "./test-context"
import { withResponseDispatcher } from "./test-context"
import { handleCloseRequest } from "../app-handlers"

function createConnectedCloseContext(instanceId: string) {
  let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
  state = connectInstance(state, {
    instanceId,
    appId: "TestApp",
    metadata: { appId: "TestApp", name: "TestApp" },
  })
  state = updateInstanceState(state, instanceId, AppInstanceState.CONNECTED)

  const transport = new MockTransport()
  const appLauncher = new MockAppLauncher()
  const { context, getState } = createDACPTestContext({ instanceId, initialState: state })

  return {
    context: { ...withResponseDispatcher(context, transport), appLauncher },
    transport,
    appLauncher,
    getState,
    instanceId,
  }
}

describe("handleCloseRequest", () => {
  it("closes via AppLauncher and removes instance without sending success closeResponse", async () => {
    const { context, transport, appLauncher, getState, instanceId } =
      createConnectedCloseContext("close-me")

    await handleCloseRequest(
      {
        type: "closeRequest",
        meta: createDacpRequestMeta("close-success", {
          appId: "TestApp",
          instanceId,
        }),
        payload: {},
      },
      context
    )

    expect(appLauncher.getCloseHistory()).toEqual([instanceId])
    expect(getState().instances[instanceId]).toBeUndefined()
    expect(transport.sentMessages).toHaveLength(0)
  })

  it("returns ErrorOnClose when AppLauncher.close is not configured", async () => {
    const { context, transport, instanceId } = createConnectedCloseContext("no-close-launcher")

    await handleCloseRequest(
      {
        type: "closeRequest",
        meta: createDacpRequestMeta("close-no-launcher", {
          appId: "TestApp",
          instanceId,
        }),
        payload: {},
      },
      { ...context, appLauncher: undefined }
    )

    const last = transport.getLastMessage() as {
      type: string
      payload: { error: string }
    }
    expect(last.type).toBe("closeResponse")
    expect(last.payload.error).toBe(CloseError.ErrorOnClose)
  })

  it("returns ErrorOnClose when AppLauncher.close throws", async () => {
    const { context, transport, appLauncher, instanceId } =
      createConnectedCloseContext("close-fails")
    appLauncher.setInstanceToFailOnClose(instanceId)

    await handleCloseRequest(
      {
        type: "closeRequest",
        meta: createDacpRequestMeta("close-throws", {
          appId: "TestApp",
          instanceId,
        }),
        payload: {},
      },
      context
    )

    const last = transport.getLastMessage() as {
      type: string
      payload: { error: string }
    }
    expect(last.type).toBe("closeResponse")
    expect(last.payload.error).toBe(CloseError.ErrorOnClose)
    expect(context.getState().instances[instanceId]).toBeDefined()
  })

  it("returns ErrorOnClose when instance is unknown", async () => {
    const transport = new MockTransport()
    const appLauncher = new MockAppLauncher()
    const missingInstanceId = "missing-instance"
    const { context } = createDACPTestContext({ instanceId: missingInstanceId })

    await handleCloseRequest(
      {
        type: "closeRequest",
        meta: createDacpRequestMeta("close-missing", {
          appId: "TestApp",
          instanceId: missingInstanceId,
        }),
        payload: {},
      },
      { ...withResponseDispatcher(context, transport), appLauncher }
    )

    const last = transport.getLastMessage() as {
      type: string
      payload: { error: string }
    }
    expect(last.type).toBe("closeResponse")
    expect(last.payload.error).toBe(CloseError.ErrorOnClose)
  })
})
