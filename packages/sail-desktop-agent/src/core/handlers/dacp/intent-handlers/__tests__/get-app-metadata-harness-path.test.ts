import { afterEach, describe, expect, it } from "vite-plus/test"
import type { BrowserTypes } from "@finos/fdc3"

import { MockTransport } from "../../../../../__tests__/utils/mock-transport"
import type { DirectoryApp } from "../../../../app-directory/types"
import { DesktopAgent } from "../../../../desktop-agent"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../../default-user-channels"
import { DEFAULT_SAIL_IMPLEMENTATION_METADATA } from "../../../../sail-default-config"
import { connectInstance, updateInstanceState } from "../../../../state/mutators"
import { createInitialState } from "../../../../state/initial-state"
import { AppInstanceState } from "../../../../state/types"
import { createDacpRequestMeta } from "../../__tests__/test-context"

const CONFORMANCE_APP: DirectoryApp = {
  appId: "intent-a",
  name: "intent-a",
  title: "Intent A",
  type: "web",
  details: { url: "https://example.com/intent-a" },
}

type GetAppMetadataResponse = BrowserTypes.AgentResponseMessage & {
  type: "getAppMetadataResponse"
  payload: {
    appMetadata?: Record<string, unknown>
    error?: string
  }
}

function wireVisibleAppMetadata(response: GetAppMetadataResponse): Record<string, unknown> {
  return JSON.parse(JSON.stringify(response.payload.appMetadata ?? {})) as Record<string, unknown>
}

describe("getAppMetadata harness-equivalent DesktopAgent path", () => {
  const activeAgents: DesktopAgent[] = []

  afterEach(() => {
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }
  })

  it("GetAppMetadata includes desktopAgent on wire JSON for directory lookup", async () => {
    const transport = new MockTransport()
    const initialState = updateInstanceState(
      connectInstance(createInitialState(DEFAULT_FDC3_USER_CHANNELS), {
        instanceId: "caller-1",
        appId: "conformance1",
        metadata: { appId: "conformance1", name: "conformance1" },
      }),
      "caller-1",
      AppInstanceState.CONNECTED
    )

    const agent = new DesktopAgent({
      transport,
      apps: [CONFORMANCE_APP],
      initialState,
      implementationMetadata: DEFAULT_SAIL_IMPLEMENTATION_METADATA,
    })
    activeAgents.push(agent)
    agent.start()

    await transport.receiveMessage({
      type: "getAppMetadataRequest",
      meta: createDacpRequestMeta("get-app-metadata-harness-directory", {
        appId: "conformance1",
        instanceId: "caller-1",
      }),
      payload: {
        app: { appId: CONFORMANCE_APP.appId },
      },
    })

    const response = transport.sentMessages.find(
      (message): message is GetAppMetadataResponse =>
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        (message as { type: string }).type === "getAppMetadataResponse"
    )

    expect(response).toBeDefined()
    const wireMetadata = wireVisibleAppMetadata(response!)
    expect(Object.keys(wireMetadata)).toContain("desktopAgent")
    expect(wireMetadata.desktopAgent).toBe(DEFAULT_SAIL_IMPLEMENTATION_METADATA.provider)
  })

  it("AppInstanceMetadata includes desktopAgent on wire JSON for running instance lookup", async () => {
    const transport = new MockTransport()
    let initialState = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
    initialState = connectInstance(initialState, {
      instanceId: "caller-1",
      appId: "conformance1",
      metadata: { appId: "conformance1", name: "conformance1" },
    })
    initialState = connectInstance(initialState, {
      instanceId: "intent-a-instance",
      appId: CONFORMANCE_APP.appId,
      metadata: { appId: CONFORMANCE_APP.appId, name: CONFORMANCE_APP.appId },
    })
    initialState = updateInstanceState(initialState, "caller-1", AppInstanceState.CONNECTED)
    initialState = updateInstanceState(
      initialState,
      "intent-a-instance",
      AppInstanceState.CONNECTED
    )

    const agent = new DesktopAgent({
      transport,
      apps: [CONFORMANCE_APP],
      initialState,
      implementationMetadata: DEFAULT_SAIL_IMPLEMENTATION_METADATA,
    })
    activeAgents.push(agent)
    agent.start()

    await transport.receiveMessage({
      type: "getAppMetadataRequest",
      meta: createDacpRequestMeta("get-app-metadata-harness-instance", {
        appId: "conformance1",
        instanceId: "caller-1",
      }),
      payload: {
        app: { appId: CONFORMANCE_APP.appId, instanceId: "intent-a-instance" },
      },
    })

    const response = transport.sentMessages.find(
      (message): message is GetAppMetadataResponse =>
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        (message as { type: string }).type === "getAppMetadataResponse"
    )

    expect(response).toBeDefined()
    const wireMetadata = wireVisibleAppMetadata(response!)
    expect(Object.keys(wireMetadata)).toContain("desktopAgent")
    expect(wireMetadata.instanceId).toBe("intent-a-instance")
    expect(wireMetadata.desktopAgent).toBe(DEFAULT_SAIL_IMPLEMENTATION_METADATA.provider)
  })
})
